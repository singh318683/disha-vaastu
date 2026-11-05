import { normalizeDegrees } from "./angles.ts";

export const ZONE_WIDTH = 22.5;

export type ElementId = "water" | "fire" | "earth" | "air" | "space";

export type ZoneId =
  | "N"
  | "NNE"
  | "NE"
  | "ENE"
  | "E"
  | "ESE"
  | "SE"
  | "SSE"
  | "S"
  | "SSW"
  | "SW"
  | "WSW"
  | "W"
  | "WNW"
  | "NW"
  | "NNW";

export interface ElementInfo {
  id: ElementId;
  label: string;
  sanskrit: string;
  zones: string;
  color: string;
  soft: string;
}

export const ELEMENTS: Record<ElementId, ElementInfo> = {
  water: {
    id: "water",
    label: "Water",
    sanskrit: "Jal",
    zones: "N & NE",
    color: "#2E6F8A",
    soft: "#E4F0F5",
  },
  fire: {
    id: "fire",
    label: "Fire",
    sanskrit: "Agni",
    zones: "E & SE",
    color: "#C4542C",
    soft: "#F8E6DC",
  },
  earth: {
    id: "earth",
    label: "Earth",
    sanskrit: "Prithvi",
    zones: "S & SW",
    color: "#8A6239",
    soft: "#F3E6D4",
  },
  air: {
    id: "air",
    label: "Air",
    sanskrit: "Vayu",
    zones: "W & NW",
    color: "#4F7D55",
    soft: "#E3F0E4",
  },
  space: {
    id: "space",
    label: "Space",
    sanskrit: "Akash",
    zones: "Center",
    color: "#B8893D",
    soft: "#F6EDD8",
  },
};

export interface Zone {
  id: ZoneId;
  label: string;
  short: string;
  /** Center bearing in degrees clockwise from true north. */
  center: number;
  element: Exclude<ElementId, "space">;
}

/**
 * Sixteen zones of 22.5°, with North centered on 0° (348.75°–11.25°).
 * Element quadrants follow the concept note: Water N/NE, Fire E/SE, Earth S/SW, Air W/NW.
 * Each quadrant holds four zones. Boundaries sit halfway between the named corners
 * (for example, water ends and fire begins between NE and ENE).
 */
export const ZONES: readonly Zone[] = [
  { id: "N", label: "North", short: "N", center: 0, element: "water" },
  { id: "NNE", label: "North-northeast", short: "NNE", center: 22.5, element: "water" },
  { id: "NE", label: "Northeast", short: "NE", center: 45, element: "water" },
  { id: "ENE", label: "East-northeast", short: "ENE", center: 67.5, element: "fire" },
  { id: "E", label: "East", short: "E", center: 90, element: "fire" },
  { id: "ESE", label: "East-southeast", short: "ESE", center: 112.5, element: "fire" },
  { id: "SE", label: "Southeast", short: "SE", center: 135, element: "fire" },
  { id: "SSE", label: "South-southeast", short: "SSE", center: 157.5, element: "earth" },
  { id: "S", label: "South", short: "S", center: 180, element: "earth" },
  { id: "SSW", label: "South-southwest", short: "SSW", center: 202.5, element: "earth" },
  { id: "SW", label: "Southwest", short: "SW", center: 225, element: "earth" },
  { id: "WSW", label: "West-southwest", short: "WSW", center: 247.5, element: "air" },
  { id: "W", label: "West", short: "W", center: 270, element: "air" },
  { id: "WNW", label: "West-northwest", short: "WNW", center: 292.5, element: "air" },
  { id: "NW", label: "Northwest", short: "NW", center: 315, element: "air" },
  { id: "NNW", label: "North-northwest", short: "NNW", center: 337.5, element: "water" },
] as const;

const ZONE_BY_ID = new Map<ZoneId, Zone>(ZONES.map((zone) => [zone.id, zone]));

export function zoneById(id: ZoneId): Zone {
  const zone = ZONE_BY_ID.get(id);
  if (!zone) throw new Error(`Unknown zone ${id}`);
  return zone;
}

export function isZoneId(value: string): value is ZoneId {
  return ZONE_BY_ID.has(value as ZoneId);
}

/**
 * Map a clockwise-from-north bearing to a zone.
 * The clockwise edge of each zone belongs to the next zone, so North owns
 * [348.75, 11.25) after wrapping.
 */
export function zoneFromBearing(bearing: number): Zone {
  const shifted = normalizeDegrees(bearing + ZONE_WIDTH / 2);
  const index = Math.floor(shifted / ZONE_WIDTH) % ZONES.length;
  return ZONES[index]!;
}

export function elementForZone(id: ZoneId): ElementInfo {
  return ELEMENTS[zoneById(id).element];
}

/** Angular distance on the 16-zone ring. 0 = same zone, 1 = neighbor. */
export function zoneSteps(a: ZoneId, b: ZoneId): number {
  const ia = ZONES.findIndex((zone) => zone.id === a);
  const ib = ZONES.findIndex((zone) => zone.id === b);
  const raw = Math.abs(ia - ib);
  return Math.min(raw, ZONES.length - raw);
}

export function zonesAreNear(a: ZoneId, b: ZoneId): boolean {
  return zoneSteps(a, b) <= 1;
}
