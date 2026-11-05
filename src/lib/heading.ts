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
 * (or `deviceorientation` with `absolute: true`). There `alpha` is degrees
 * counter-clockwise from north, so the clockwise compass heading is
 * `(360 - alpha) mod 360`.
 */
export function headingFromOrientation(reading: OrientationReading): HeadingFix | null {
  const webkit = reading.webkitCompassHeading;
  // 0 is a real heading (magnetic north). Only reject non-numbers and the
  // iOS sentinel -1 / any other negative "no fix" value.
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
  if (absolute && typeof alpha === "number" && Number.isFinite(alpha)) {
    return {
      magnetic: normalizeDegrees(360 - alpha),
      source: "absolute",
    };
  }

  return null;
}

export function extractOrientation(reading: OrientationReading): OrientationFix {
  return {
    heading: headingFromOrientation(reading),
    beta: finiteOrNull(reading.beta),
    gamma: finiteOrNull(reading.gamma),
  };
}

/**
 * Clockwise degrees from magnetic north for an AbsoluteOrientationSensor
 * quaternion `[x, y, z, w]` in the East-North-Up frame (`referenceFrame: "device"`).
 *
 * The top of the phone (device +Y) is used while it still points somewhat
 * horizontally. When the phone is held upright, +Y points at the sky and the
 * direction the person is facing is out the back of the phone (device -Z).
 */
export function headingFromQuaternion(quaternion: ArrayLike<number> | null | undefined): number | null {
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
  return normalizeDegrees((Math.atan2(east, north) * 180) / Math.PI);
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
