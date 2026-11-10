import geomagnetism from "geomagnetism";
import { magneticToTrue, trueToMagnetic } from "./angles.ts";

export interface DeclinationResult {
  /** Signed degrees. Positive is east, negative is west. */
  declination: number;
  /** Total field intensity in nanotesla, from the World Magnetic Model. */
  totalFieldNt: number;
  modelName: string;
  /** True when the date sits outside the model's published window and the nearest model was used. */
  approximate: boolean;
}

export function declinationAt(lat: number, lon: number, date = new Date()): DeclinationResult {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  let approximate = false;
  let timed;
  try {
    timed = geomagnetism.model(date);
  } catch {
    approximate = true;
    timed = geomagnetism.model(date, { allowOutOfBoundsModel: true });
  }

  const point = timed.point([lat, lon]);
  if (!Number.isFinite(point.decl) || !Number.isFinite(point.f)) {
    throw new Error("The magnetic model could not compute a declination for that point.");
  }

  return {
    declination: point.decl,
    totalFieldNt: point.f,
    modelName: timed.name || "World Magnetic Model",
    approximate,
  };
}

const INDIA_ZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

/**
 * A coarse declination when GPS is refused. India uses a central point
 * (about 0° to 1°). Anywhere else uses the timezone's rough longitude.
 */
export function approximateDeclination(timeZone?: string, offsetMinutes?: number): DeclinationResult {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = offsetMinutes ?? new Date().getTimezoneOffset();
  const place = INDIA_ZONES.has(zone) ? { lat: 22.5, lon: 79 } : roughPlace(offset);
  const result = declinationAt(place.lat, place.lon);
  return {
    ...result,
    approximate: true,
    modelName: INDIA_ZONES.has(zone) ? "India approximate" : "Timezone approximate",
  };
}

function roughPlace(offsetMinutes: number): { lat: number; lon: number } {
  const hours = -offsetMinutes / 60;
  const lon = Math.max(-180, Math.min(180, hours * 15));
  return { lat: 20, lon };
}

export { magneticToTrue, trueToMagnetic };
