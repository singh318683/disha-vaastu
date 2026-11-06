import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { magneticToTrue, normalizeDegrees } from "@/lib/angles.ts";
import { declinationAt, type DeclinationResult } from "@/lib/declination.ts";
import {
  callDevicePermission,
  circularMean,
  extractOrientation,
  headingFromQuaternion,
  isIosBrowser,
  needsDirectGesture,
  queryOrientationSensorPermission,
  readScreenAngle,
  smoothHeading,
  type CircularSmooth,
  type OrientationReading,
} from "@/lib/heading.ts";
import { zoneFromBearing, type Zone } from "@/lib/zones.ts";

export interface LocationFix {
  lat: number;
  lon: number;
  accuracy?: number;
  label: string;
}

export type Permission = "unknown" | "need-tap" | "requesting" | "granted" | "denied" | "unsupported" | "no-events";
type Basis = "live-true" | "live-magnetic" | "manual";
type HeadingSource = "ios" | "absolute" | "sensor" | "none";

interface SensorsValue {
  magneticHeading: number | null;
  beta: number | null;
  gamma: number | null;
  accuracy: number | null;
  stability: number | null;
  source: HeadingSource;
  permission: Permission;
  needsGesture: boolean;
  ios: boolean;
  /** Android Chrome, not iPhone. Figure-8 hints stay off the iOS path. */
  android: boolean;
  /** deviceorientation events arrived, but none were absolute and no sensor is driving. */
  relativeOnly: boolean;
  /** Android readings are wandering enough to suggest a figure-8. */
  noisy: boolean;
  motionSeen: boolean;
  promptStalled: boolean;
  /** True heading from the last second of corrected samples, for Lock direction. */
  headingToLock: () => { trueHeading: number; trueNorth: boolean };
  requestPermission: () => Promise<void>;
  useManual: boolean;
  setHeadingFromUser: (heading: number) => void;
  followLive: () => void;
  location: LocationFix | null;
  locationStatus: "idle" | "locating" | "ready" | "denied" | "error";
  locationError: string | null;
  requestLocation: () => void;
  setManualLocation: (lat: number, lon: number, label: string) => void;
  declinationOverride: number | null;
  setDeclinationOverride: (value: number | null) => void;
  model: DeclinationResult | null;
  modelError: string | null;
  declination: number | null;
  effective: {
    trueHeading: number;
    basis: Basis;
    zone: Zone;
    declinationApplied: boolean;
  };
}

const SensorsContext = createContext<SensorsValue | null>(null);

/** How long to wait for a heading after permission (or on Android, after load). */
const SILENCE_MS = 3000;
const PROMPT_MS = 15000;
const CAPTURE = true;

interface AbsoluteOrientationSensorLike {
  quaternion: ArrayLike<number> | null;
  start: () => void;
  stop: () => void;
  addEventListener: (type: "reading" | "error", listener: () => void) => void;
}

interface AbsoluteOrientationSensorConstructor {
  new (options?: { frequency?: number; referenceFrame?: "device" | "screen" }): AbsoluteOrientationSensorLike;
}

interface HeadingSample {
  magnetic?: number;
  source?: Exclude<HeadingSource, "none">;
  accuracy?: number;
  beta?: number;
  gamma?: number;
  eventSeen?: boolean;
}

function circularStdDev(samples: number[]): number {
  if (samples.length < 2) return 0;
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    const rad = (sample * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  x /= samples.length;
  y /= samples.length;
  const resultant = Math.min(1, Math.hypot(x, y));
  if (resultant < 0.02) return 180;
  return (Math.sqrt(Math.max(0, -2 * Math.log(resultant))) * 180) / Math.PI;
}

function orientationConstructor(): unknown {
  return typeof DeviceOrientationEvent === "undefined" ? null : DeviceOrientationEvent;
}

function motionConstructor(): unknown {
  return typeof DeviceMotionEvent === "undefined" ? null : DeviceMotionEvent;
}

function gestureRequiredNow(): boolean {
  return needsDirectGesture(orientationConstructor(), motionConstructor());
}

function iosBrowserNow(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosBrowser(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}

export function SensorsProvider({ children }: { children: ReactNode }) {
  const [magneticHeading, setMagneticHeading] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [stability, setStability] = useState<number | null>(null);
  const [source, setSource] = useState<HeadingSource>("none");
  const [permission, setPermission] = useState<Permission>(() => (gestureRequiredNow() ? "need-tap" : "unknown"));
  const [needsGesture] = useState(() => gestureRequiredNow());
  const [ios] = useState(() => iosBrowserNow());
  const [android] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent) && !iosBrowserNow();
  });
  const [relativeOnly, setRelativeOnly] = useState(false);
  const [motionSeen, setMotionSeen] = useState(false);
  const [promptStalled, setPromptStalled] = useState(false);
  const [useManual, setUseManual] = useState(false);
  const [manualTrueHeading, setManualTrueHeading] = useState(0);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locationStatus, setLocationStatus] = useState<SensorsValue["locationStatus"]>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [declinationOverride, setDeclinationOverride] = useState<number | null>(null);
  const [model, setModel] = useState<DeclinationResult | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  const gestureRequired = useRef(needsGesture);
  const gotHeading = useRef(false);
  const sensorFreshUntil = useRef(0);
  const motionSeenRef = useRef(false);
  const asking = useRef(false);
  const requestGen = useRef(0);
  const silenceTimer = useRef(0);
  const promptTimer = useRef(0);
  const sensorRef = useRef<AbsoluteOrientationSensorLike | null>(null);
  const sensorGen = useRef(0);
  const ingestRef = useRef<(sample: HeadingSample) => void>(() => {});
  const recentMagnetic = useRef<{ t: number; magnetic: number }[]>([]);
  const declinationRef = useRef<number | null>(null);
  const manualRef = useRef(manualTrueHeading);
  const useManualRef = useRef(useManual);
  manualRef.current = manualTrueHeading;
  useManualRef.current = useManual;

  useEffect(() => {
    let displaySamples: number[] = [];
    let frame = 0;
    let smooth: CircularSmooth | null = null;
    let lastSmoothAt = 0;
    const latest: HeadingSample = {};

    const flush = () => {
      frame = 0;
      if (typeof latest.beta === "number") setBeta(latest.beta);
      if (typeof latest.gamma === "number") setGamma(latest.gamma);
      if (typeof latest.accuracy === "number") setAccuracy(latest.accuracy);
      if (typeof latest.magnetic !== "number") return;
      const now = performance.now();
      recentMagnetic.current.push({ t: now, magnetic: latest.magnetic });
      const keepFrom = now - 1500;
      while (recentMagnetic.current.length > 0 && recentMagnetic.current[0]!.t < keepFrom) {
        recentMagnetic.current.shift();
      }
      const smoothed = smoothHeading(smooth, latest.magnetic, lastSmoothAt === 0 ? 0 : now - lastSmoothAt);
      smooth = smoothed.state;
      lastSmoothAt = now;
      gotHeading.current = true;
      window.clearTimeout(silenceTimer.current);
      setMagneticHeading(smoothed.heading);
      setSource(latest.source ?? "absolute");
      setPermission("granted");
      setPromptStalled(false);
      setRelativeOnly(false);
      displaySamples = [...displaySamples, smoothed.heading].slice(-18);
      setStability(circularStdDev(displaySamples));
    };

    ingestRef.current = (sample) => {
      if (sample.eventSeen && !motionSeenRef.current) {
        motionSeenRef.current = true;
        setMotionSeen(true);
      }
      if (typeof sample.beta === "number") latest.beta = sample.beta;
      if (typeof sample.gamma === "number") latest.gamma = sample.gamma;
      if (typeof sample.accuracy === "number") latest.accuracy = sample.accuracy;
      if (typeof sample.magnetic === "number") {
        latest.magnetic = sample.magnetic;
        latest.source = sample.source;
      }
      if (frame === 0) frame = window.requestAnimationFrame(flush);
    };

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const onOrientation = useCallback((event: Event) => {
    const reading = event as OrientationReading;
    const fix = extractOrientation(reading, { screenAngle: readScreenAngle() });
    const sensorFresh = performance.now() < sensorFreshUntil.current;
    const iosHeading = fix.heading?.source === "ios";
    // AbsoluteOrientationSensor wins on Android. iOS webkit still wins, and a
    // non-absolute event never becomes a compass heading.
    const useEventHeading = fix.heading != null && (iosHeading || !sensorFresh);
    if (!useEventHeading && fix.heading == null && reading.absolute !== true && reading.type !== "deviceorientationabsolute") {
      if (!gotHeading.current && performance.now() >= sensorFreshUntil.current) setRelativeOnly(true);
    }
    ingestRef.current({
      eventSeen: true,
      beta: fix.beta ?? undefined,
      gamma: fix.gamma ?? undefined,
      magnetic: useEventHeading ? fix.heading?.magnetic : undefined,
      source: useEventHeading ? fix.heading?.source : undefined,
      accuracy: fix.heading?.accuracy,
    });
  }, []);

  const detachListeners = useCallback(() => {
    window.removeEventListener("deviceorientationabsolute", onOrientation, CAPTURE);
    window.removeEventListener("deviceorientation", onOrientation, CAPTURE);
  }, [onOrientation]);

  const attachListeners = useCallback(() => {
    // Remove + add in this turn so iOS treats the listener as part of the tap.
    detachListeners();
    window.addEventListener("deviceorientationabsolute", onOrientation, CAPTURE);
    window.addEventListener("deviceorientation", onOrientation, CAPTURE);
  }, [detachListeners, onOrientation]);

  const stopSensor = useCallback(() => {
    sensorGen.current += 1;
    const sensor = sensorRef.current;
    sensorRef.current = null;
    if (!sensor) return;
    try {
      sensor.stop();
    } catch {
      /* Already stopped. */
    }
  }, []);

  const startSensor = useCallback(() => {
    stopSensor();
    const generation = sensorGen.current;
    const Ctor = (window as Window & { AbsoluteOrientationSensor?: AbsoluteOrientationSensorConstructor })
      .AbsoluteOrientationSensor;
    if (typeof Ctor !== "function" || ios) return;
    void queryOrientationSensorPermission().then((permissionState) => {
      if (generation !== sensorGen.current) return;
      if (permissionState === "denied") return;
      if (sensorRef.current) return;
      try {
        const sensor = new Ctor({ frequency: 60, referenceFrame: "device" });
        sensor.addEventListener("reading", () => {
          const magnetic = headingFromQuaternion(sensor.quaternion, readScreenAngle());
          if (magnetic == null) return;
          // Keep the sensor ahead of deviceorientation for half a second after each sample.
          sensorFreshUntil.current = performance.now() + 500;
          ingestRef.current({ magnetic, source: "sensor" });
        });
        sensor.addEventListener("error", () => {
          sensorFreshUntil.current = 0;
          /* Permissions-Policy or a missing magnetometer. Absolute events may still work. */
        });
        sensor.start();
        sensorRef.current = sensor;
      } catch {
        /* Generic Sensor API missing or blocked. deviceorientationabsolute remains the fallback. */
      }
    });
  }, [ios, stopSensor]);

  const scheduleSilenceWatch = useCallback(() => {
    window.clearTimeout(silenceTimer.current);
    silenceTimer.current = window.setTimeout(() => {
      if (gotHeading.current) return;
      setPermission(gestureRequired.current ? "no-events" : "unsupported");
    }, SILENCE_MS);
  }, []);

  const requestPermission = useCallback(() => {
    if (asking.current) return Promise.resolve();
    const gen = ++requestGen.current;
    asking.current = true;

    // Both of these must run inside the tap, before any await. iOS Safari only
    // delivers webkitCompassHeading to a deviceorientation listener that was
    // added in that same turn, and it ignores requestPermission() if the
    // user-gesture bit was already consumed.
    attachListeners();
    const orientationPromise = callDevicePermission(orientationConstructor());
    const motionPromise = callDevicePermission(motionConstructor());

    setUseManual(false);
    setPromptStalled(false);
    if (gestureRequired.current) setPermission("requesting");

    window.clearTimeout(promptTimer.current);
    if (gestureRequired.current) {
      promptTimer.current = window.setTimeout(() => {
        asking.current = false;
        setPermission((current) => (current === "requesting" ? "need-tap" : current));
        setPromptStalled(true);
      }, PROMPT_MS);
    }

    return Promise.all([orientationPromise, motionPromise])
      .then(([orientation]) => {
        if (gen !== requestGen.current) return;
        window.clearTimeout(promptTimer.current);
        const orientationRequired = needsDirectGesture(orientationConstructor(), null);
        if (orientationRequired && orientation !== "granted") {
          setPermission("denied");
          setPromptStalled(false);
          return;
        }
        setPromptStalled(false);
        setPermission((current) => (current === "denied" ? current : "granted"));
        // A heading may already be in flight from the listener attached above.
        // Only arm the silence watch when nothing has arrived yet.
        if (!gotHeading.current) scheduleSilenceWatch();
        // Android prefers AbsoluteOrientationSensor. iOS keeps webkitCompassHeading.
        if (!ios) startSensor();
      })
      .finally(() => {
        if (gen === requestGen.current) asking.current = false;
      });
  }, [attachListeners, ios, scheduleSilenceWatch, startSensor]);

  useEffect(() => {
    const required = gestureRequiredNow();
    gestureRequired.current = required;
    if (!required) {
      attachListeners();
      startSensor();
      scheduleSilenceWatch();
    }
    return () => {
      detachListeners();
      stopSensor();
      window.clearTimeout(silenceTimer.current);
      window.clearTimeout(promptTimer.current);
    };
  }, [attachListeners, detachListeners, scheduleSilenceWatch, startSensor, stopSensor]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("no-api");
      return;
    }
    setLocationStatus("locating");
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          label: "This device",
        });
        setLocationStatus("ready");
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationStatus(denied ? "denied" : "error");
        setLocationError(denied ? "denied" : "no-fix");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lon: number, label: string) => {
    setLocation({ lat, lon, label });
    setLocationStatus("ready");
    setLocationError(null);
  }, []);

  useEffect(() => {
    if (!location) {
      setModel(null);
      setModelError(null);
      return;
    }
    try {
      setModel(declinationAt(location.lat, location.lon));
      setModelError(null);
    } catch (error) {
      setModel(null);
      setModelError("failed");
    }
  }, [location]);

  const declination = declinationOverride ?? model?.declination ?? null;
  declinationRef.current = declination;

  const effective = useMemo(() => {
    const sensorLive = magneticHeading != null && !useManual;
    let trueHeading = manualTrueHeading;
    let basis: Basis = "manual";
    if (sensorLive && declination != null) {
      trueHeading = magneticToTrue(magneticHeading, declination);
      basis = "live-true";
    } else if (sensorLive) {
      trueHeading = magneticHeading;
      basis = "live-magnetic";
    }
    return {
      trueHeading,
      basis,
      zone: zoneFromBearing(trueHeading),
      declinationApplied: basis !== "live-magnetic",
    };
  }, [declination, magneticHeading, manualTrueHeading, useManual]);

  const value = useMemo<SensorsValue>(
    () => ({
      magneticHeading,
      beta,
      gamma,
      accuracy,
      stability,
      source,
      permission,
      needsGesture,
      ios,
      android,
      relativeOnly,
      noisy: android && ((stability != null && stability > 12) || (accuracy != null && accuracy > 30)),
      motionSeen,
      promptStalled,
      requestPermission,
      useManual,
      setHeadingFromUser: (heading: number) => {
        setUseManual(true);
        setManualTrueHeading(normalizeDegrees(heading));
      },
      followLive: () => setUseManual(false),
      headingToLock: () => {
        if (useManualRef.current) return { trueHeading: manualRef.current, trueNorth: true };
        const now = performance.now();
        const recent = recentMagnetic.current.filter((sample) => now - sample.t <= 1000).map((sample) => sample.magnetic);
        const magnetic = circularMean(recent);
        if (magnetic == null) return { trueHeading: manualRef.current, trueNorth: true };
        const shift = declinationRef.current;
        if (shift == null) return { trueHeading: magnetic, trueNorth: false };
        return { trueHeading: magneticToTrue(magnetic, shift), trueNorth: true };
      },
      location,
      locationStatus,
      locationError,
      requestLocation,
      setManualLocation,
      declinationOverride,
      setDeclinationOverride,
      model,
      modelError,
      declination,
      effective,
    }),
    [
      accuracy,
      beta,
      declination,
      declinationOverride,
      effective,
      gamma,
      location,
      locationError,
      locationStatus,
      magneticHeading,
      model,
      modelError,
      ios,
      android,
      relativeOnly,
      motionSeen,
      needsGesture,
      permission,
      promptStalled,
      requestLocation,
      requestPermission,
      setManualLocation,
      source,
      stability,
      useManual,
    ],
  );

  return <SensorsContext.Provider value={value}>{children}</SensorsContext.Provider>;
}

export function useSensors(): SensorsValue {
  const value = useContext(SensorsContext);
  if (!value) throw new Error("useSensors must be used inside SensorsProvider");
  return value;
}
