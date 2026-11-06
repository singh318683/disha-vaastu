import { normalizeDegrees } from "./angles.ts";

/**
 * Compass heading extracted from a deviceorientation event.
 * `magnetic` is degrees clockwise from magnetic north, matching the direction
 * the top of the phone is facing.
 */
export interface HeadingFix {
  magnetic: number;
  source: "ios" | "absolute";
  /** webkitCompassAccuracy when iOS provides it. Negative means "invalid". */
  accuracy?: number;
}

export interface OrientationReading {
  type?: string;
  absolute?: boolean | null;
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  webkitCompassHeading?: number | null;
  webkitCompassAccuracy?: number | null;
}

export interface OrientationFix {
  heading: HeadingFix | null;
  beta: number | null;
  gamma: number | null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Pull a compass heading out of a DeviceOrientation event.
 *
 * iOS Safari (after a granted tap) reports `webkitCompassHeading`: degrees
 * clockwise from magnetic north. A value of -1 means the compass has no fix
 * yet and must not be treated as north. The event's `alpha` on iOS is not
 * referenced to north, so it is ignored unless the event is marked absolute.
 *
 * Android Chrome reports an absolute heading on `deviceorientationabsolute`
 * (or `deviceorientation` with `absolute: true`). On current Android, `alpha`
 * is already degrees clockwise from magnetic north: 0 is north and 90 is east.
 * Subtracting from 360 mirrors the rose, so east and west swap. A relative
 * event (`absolute` not true) is not a compass and is ignored.
 *
 * When the phone is tilted, alpha alone swings. The rotation-matrix heading
 * is used instead. Screen rotation is removed so the top of the screen is
 * what the user is aiming.
 */
export interface HeadingOptions {
  /** `screen.orientation.angle`, degrees clockwise. Android only. */
  screenAngle?: number;
}

export function headingFromOrientation(reading: OrientationReading, options?: HeadingOptions): HeadingFix | null {
  const webkit = reading.webkitCompassHeading;
  // 0 is a real heading (magnetic north). Only reject non-numbers and the
  // iOS sentinel -1 / any other negative "no fix" value. Screen rotation is
  // not applied: iOS already reports the compass heading of the device.
  if (typeof webkit === "number" && Number.isFinite(webkit) && webkit >= 0) {
    const accuracy = finiteOrNull(reading.webkitCompassAccuracy);
    return {
      magnetic: normalizeDegrees(webkit),
      source: "ios",
      ...(accuracy != null ? { accuracy } : {}),
    };
  }

  const absolute = reading.absolute === true || reading.type === "deviceorientationabsolute";
  const alpha = reading.alpha;
  if (!(absolute && typeof alpha === "number" && Number.isFinite(alpha))) return null;

  const tilted = tiltCompensatedHeading(alpha, finiteOrNull(reading.beta), finiteOrNull(reading.gamma));
  const deviceHeading = tilted ?? normalizeDegrees(alpha);
  return {
    magnetic: applyScreenAngle(deviceHeading, options?.screenAngle ?? 0),
    source: "absolute",
  };
}

export function extractOrientation(reading: OrientationReading, options?: HeadingOptions): OrientationFix {
  return {
    heading: headingFromOrientation(reading, options),
    beta: finiteOrNull(reading.beta),
    gamma: finiteOrNull(reading.gamma),
  };
}

/** Top of the screen, not the earpiece, when the browser has rotated. */
export function applyScreenAngle(heading: number, screenAngle: number): number {
  return normalizeDegrees(heading - screenAngle);
}

/**
 * Tilt-compensated compass for Android. `alphaClockwise` matches the absolute
 * event: 0 north, 90 east. The W3C matrix wants the counter-clockwise alpha,
 * so that one flip happens here and is not applied again outside.
 * Null when the phone is flat enough that raw alpha is the heading, or so
 * upright that the top edge no longer points along the ground.
 */
export function tiltCompensatedHeading(
  alphaClockwise: number,
  beta: number | null,
  gamma: number | null,
): number | null {
  if (beta == null || gamma == null) return null;
  if (Math.hypot(beta, gamma) < 8) return null;

  const alpha = ((360 - alphaClockwise) * Math.PI) / 180;
  const betaRad = (beta * Math.PI) / 180;
  const gammaRad = (gamma * Math.PI) / 180;
  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const sB = Math.sin(betaRad);
  const cG = Math.cos(gammaRad);
  const sG = Math.sin(gammaRad);
  const east = -cA * sG - sA * sB * cG;
  const north = -sA * sG + cA * sB * cG;
  if (east * east + north * north < 0.04) return null;
  return normalizeDegrees((Math.atan2(east, north) * 180) / Math.PI);
}

/** Hand-held "flat" is looser than a phone lying on a table. Missing tilt does not nag. */
export function phoneIsLevel(beta: number | null, gamma: number | null, limit = 40): boolean {
  if (beta == null || gamma == null) return true;
  return Math.hypot(beta, gamma) < limit;
}

export interface CircularSmooth {
  x: number;
  y: number;
}

/**
 * Low-pass on the unit circle. A step from 359° to 1° stays near north
 * instead of spinning through south. About 140ms is light smoothing.
 */
export function smoothHeading(
  state: CircularSmooth | null,
  heading: number,
  dtMs: number,
  tauMs = 140,
): { state: CircularSmooth; heading: number } {
  const rad = (normalizeDegrees(heading) * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  if (!state || !(dtMs > 0)) return { state: { x, y }, heading: normalizeDegrees(heading) };
  const gain = 1 - Math.exp(-dtMs / tauMs);
  const nextX = state.x + (x - state.x) * gain;
  const nextY = state.y + (y - state.y) * gain;
  const magnitude = Math.hypot(nextX, nextY);
  if (magnitude < 1e-6) return { state: { x, y }, heading: normalizeDegrees(heading) };
  return {
    state: { x: nextX / magnitude, y: nextY / magnitude },
    heading: normalizeDegrees((Math.atan2(nextY, nextX) * 180) / Math.PI),
  };
}

/** Mean on the circle. Samples around 0° average to north, not to south. */
export function circularMean(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    const rad = (sample * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  if (x * x + y * y < 1e-8) return null;
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

export function readScreenAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && Number.isFinite(angle)) return normalizeDegrees(angle);
  return 0;
}

const SENSOR_NAMES = ["accelerometer", "gyroscope", "magnetometer"] as const;

/** Granted only when accelerometer, gyroscope, and magnetometer are all granted. */
export async function queryOrientationSensorPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (typeof navigator === "undefined" || typeof navigator.permissions?.query !== "function") return "unknown";
  try {
    const states = await Promise.all(
      SENSOR_NAMES.map((name) => navigator.permissions.query({ name: name as PermissionName })),
    );
    if (states.some((state) => state.state === "denied")) return "denied";
    if (states.every((state) => state.state === "granted")) return "granted";
    return "prompt";
  } catch {
    return "unknown";
  }
}

/**
 * Clockwise degrees from magnetic north for an AbsoluteOrientationSensor
 * quaternion `[x, y, z, w]` in the East-North-Up frame (`referenceFrame: "device"`).
 *
 * The top of the phone (device +Y) is used while it still points somewhat
 * horizontally. When the phone is held upright, +Y points at the sky and the
 * direction the person is facing is out the back of the phone (device -Z).
 */
export function headingFromQuaternion(
  quaternion: ArrayLike<number> | null | undefined,
  screenAngle = 0,
): number | null {
  if (!quaternion || quaternion.length < 4) return null;
  const x = Number(quaternion[0]);
  const y = Number(quaternion[1]);
  const z = Number(quaternion[2]);
  const w = Number(quaternion[3]);
  if (![x, y, z, w].every(Number.isFinite)) return null;

  const yEast = 2 * (x * y - z * w);
  const yNorth = 1 - 2 * (x * x + z * z);
  const zEast = 2 * (x * z + y * w);
  const zNorth = 2 * (y * z - x * w);

  const yHorizontal = yEast * yEast + yNorth * yNorth;
  const east = yHorizontal >= 0.2 ? yEast : -zEast;
  const north = yHorizontal >= 0.2 ? yNorth : -zNorth;
  if (east * east + north * north < 1e-8) return null;
  return applyScreenAngle(normalizeDegrees((Math.atan2(east, north) * 180) / Math.PI), screenAngle);
}

interface PermissionHost {
  requestPermission?: () => Promise<unknown>;
}

function asPermissionHost(target: unknown): PermissionHost | null {
  if (typeof target !== "function" && (typeof target !== "object" || target === null)) return null;
  return target as PermissionHost;
}

/** iPhone, iPod, and iPadOS (which reports itself as a Mac with a touch screen). */
export function isIosBrowser(userAgent: string, platform = "", maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/** True when the browser will only deliver compass events after a tap-triggered requestPermission(). */
export function needsDirectGesture(deviceOrientation: unknown, deviceMotion: unknown): boolean {
  const orientation = asPermissionHost(deviceOrientation);
  const motion = asPermissionHost(deviceMotion);
  return typeof orientation?.requestPermission === "function" || typeof motion?.requestPermission === "function";
}

/**
 * Invoke `requestPermission()` synchronously and as a method.
 * iOS Safari drops the user-gesture bit if this is deferred with await,
 * queueMicrotask, or a detached call, and then the prompt never appears.
 */
export function callDevicePermission(target: unknown): Promise<"granted" | "denied"> {
  const host = asPermissionHost(target);
  if (!host || typeof host.requestPermission !== "function") return Promise.resolve("granted");
  try {
    const pending = host.requestPermission();
    return Promise.resolve(pending).then(
      (value) => (value === "granted" ? "granted" : "denied"),
      () => "denied",
    );
  } catch {
    return Promise.resolve("denied");
  }
}
