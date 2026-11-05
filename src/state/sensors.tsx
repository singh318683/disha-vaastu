import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { magneticToTrue, normalizeDegrees } from "@/lib/angles.ts";
import { declinationAt, type DeclinationResult } from "@/lib/declination.ts";
import { zoneFromBearing, type Zone } from "@/lib/zones.ts";

export interface LocationFix {
  lat: number;
  lon: number;
  accuracy?: number;
  label: string;
}

type Permission = "unknown" | "need-tap" | "granted" | "denied" | "unsupported";
type Basis = "live-true" | "live-magnetic" | "manual";

interface SensorsValue {
  magneticHeading: number | null;
  beta: number | null;
  gamma: number | null;
  accuracy: number | null;
  stability: number | null;
  source: "ios" | "absolute" | "none";
  permission: Permission;
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

export function SensorsProvider({ children }: { children: ReactNode }) {
  const [magneticHeading, setMagneticHeading] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [stability, setStability] = useState<number | null>(null);
  const [source, setSource] = useState<"ios" | "absolute" | "none">("none");
  const [permission, setPermission] = useState<Permission>("unknown");
  const [listenKey, setListenKey] = useState(0);
  const [useManual, setUseManual] = useState(false);
  const [manualTrueHeading, setManualTrueHeading] = useState(0);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locationStatus, setLocationStatus] = useState<SensorsValue["locationStatus"]>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [declinationOverride, setDeclinationOverride] = useState<number | null>(null);
  const [model, setModel] = useState<DeclinationResult | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const needsTap = useRef(false);
  const gotHeading = useRef(false);

  useEffect(() => {
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios && typeof orientation?.requestPermission === "function") {
      needsTap.current = true;
      setPermission("need-tap");
    }

    let samples: number[] = [];
    let frame = 0;
    const latest: {
      beta?: number;
      gamma?: number;
      magnetic?: number;
      source?: "ios" | "absolute";
      accuracy?: number;
    } = {};

    const flush = () => {
      frame = 0;
      if (typeof latest.beta === "number") setBeta(latest.beta);
      if (typeof latest.gamma === "number") setGamma(latest.gamma);
      if (typeof latest.accuracy === "number") setAccuracy(latest.accuracy);
      if (typeof latest.magnetic === "number") {
        gotHeading.current = true;
        setMagneticHeading(latest.magnetic);
        setSource(latest.source ?? "absolute");
        setPermission("granted");
        samples = [...samples, latest.magnetic].slice(-18);
        setStability(circularStdDev(samples));
      }
    };

    const onEvent = (event: DeviceOrientationEvent) => {
      const reading = event as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      };
      if (typeof reading.beta === "number") latest.beta = reading.beta;
      if (typeof reading.gamma === "number") latest.gamma = reading.gamma;
      if (typeof reading.webkitCompassHeading === "number" && !Number.isNaN(reading.webkitCompassHeading)) {
        latest.magnetic = normalizeDegrees(reading.webkitCompassHeading);
        latest.source = "ios";
        if (typeof reading.webkitCompassAccuracy === "number") latest.accuracy = reading.webkitCompassAccuracy;
      } else if (
        (event.type === "deviceorientationabsolute" || event.absolute === true) &&
        typeof event.alpha === "number"
      ) {
        latest.magnetic = normalizeDegrees(360 - event.alpha);
        latest.source = "absolute";
      }
      if (!frame) frame = window.requestAnimationFrame(flush);
    };

    window.addEventListener("deviceorientationabsolute", onEvent, true);
    window.addEventListener("deviceorientation", onEvent, true);
    const timer = window.setTimeout(() => {
      if (!gotHeading.current && !needsTap.current) setPermission("unsupported");
    }, 1600);

    return () => {
      window.removeEventListener("deviceorientationabsolute", onEvent, true);
      window.removeEventListener("deviceorientation", onEvent, true);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [listenKey]);

  const requestPermission = useCallback(async () => {
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };
    if (typeof orientation.requestPermission !== "function") return;
    try {
      const result = await orientation.requestPermission();
      if (result === "granted") {
        needsTap.current = false;
        setPermission("granted");
        setListenKey((key) => key + 1);
      } else {
        setPermission("denied");
      }
    } catch {
      setPermission("denied");
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("This browser has no location API. Enter a latitude and longitude instead.");
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
        setLocationError(
          denied
            ? "Location was denied. Type a latitude and longitude, or use the New Jersey sample."
            : "No location fix. Type one in, or use the New Jersey sample.",
        );
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
      setModelError(error instanceof Error ? error.message : "Could not compute declination.");
    }
  }, [location]);

  const declination = declinationOverride ?? model?.declination ?? null;

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
      requestPermission,
      useManual,
      setHeadingFromUser: (heading: number) => {
        setUseManual(true);
        setManualTrueHeading(normalizeDegrees(heading));
      },
      followLive: () => setUseManual(false),
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
      permission,
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
