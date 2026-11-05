import { normalizeDegrees } from "./angles.ts";
import { zoneFromBearing, ZONES } from "./zones.ts";

/**
 * Eight directions, 45° each, with North centered on 0°.
 * North owns [337.5°, 22.5°). The clockwise edge belongs to the next direction,
 * so 22.5° is northeast and 337.5° is north. 0° and 360° are both north.
 */
export const DIR8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Dir8 = (typeof DIR8)[number];

export const DIR8_LABEL: Record<Dir8, string> = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
};

const DIR8_WIDTH = 45;

export function directionFromHeading(heading: number): Dir8 {
  const shifted = normalizeDegrees(heading + DIR8_WIDTH / 2);
  const index = Math.floor(shifted / DIR8_WIDTH) % DIR8.length;
  return DIR8[index]!;
}

export function isDir8(value: string): value is Dir8 {
  return (DIR8 as readonly string[]).includes(value);
}

/**
 * Thirty-two entrance padas, each 11.25°, laid clockwise around true heading.
 *
 * Each wall is a 90° sector. The sectors meet at the intercardinal corners.
 * Numbering follows the classical clockwise order of the 32 entrance devatas
 * (east from Shikhi, then south, west, and north from Roga):
 *
 * - East:  [45°, 135°)   E1 at the northeast corner → E8 toward the southeast
 * - South: [135°, 225°)  S1 → S8
 * - West:  [225°, 315°)  W1 → W8
 * - North: [315°, 45°)   N1 at the northwest corner → N8 toward the northeast
 *
 * Intervals are half-open. The start angle belongs to that pada; the clockwise
 * edge belongs to the next pada. 0° and 360° are the same heading and fall in
 * N5 (Soma), the first pada east of true north.
 *
 * Cardinal samples from this rule: 0° N5 Soma, 90° E5 Surya, 180° S5 Yama,
 * 270° W5 Varuna. Corner samples: 45° E1, 135° S1, 225° W1, 315° N1.
 *
 * A phone measures the direction you face, not a tape along the wall, so this
 * is the classical list projected onto equal compass sectors.
 */
export const PADA_WIDTH = 11.25;
export const PADA_SIDES = ["E", "S", "W", "N"] as const;
export type PadaSide = (typeof PADA_SIDES)[number];

const PADA_COUNT = 32;

export function padaFromHeading(heading: number): string {
  const shifted = normalizeDegrees(heading - 45);
  const index = Math.floor(shifted / PADA_WIDTH) % PADA_COUNT;
  const side = PADA_SIDES[Math.floor(index / 8)]!;
  const n = (index % 8) + 1;
  return `${side}${n}`;
}

export function padaSide(id: string): PadaSide {
  const side = id.charAt(0);
  if (side !== "E" && side !== "S" && side !== "W" && side !== "N") {
    throw new Error(`Not a pada id: ${id}`);
  }
  const n = Number(id.slice(1));
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error(`Not a pada id: ${id}`);
  return side;
}

export function isPadaId(value: string): boolean {
  try {
    padaSide(value);
    return true;
  } catch {
    return false;
  }
}

export type Granularity = 8 | 16 | 32;

export function slotFromHeading(heading: number, granularity: Granularity): string {
  if (granularity === 8) return directionFromHeading(heading);
  if (granularity === 16) return zoneFromBearing(heading).id;
  if (granularity === 32) return padaFromHeading(heading);
  throw new Error(`Unknown granularity ${granularity as string}`);
}

export function expectedSlotIds(granularity: Granularity): string[] {
  if (granularity === 8) return [...DIR8];
  if (granularity === 16) return ZONES.map((zone) => zone.id);
  const ids: string[] = [];
  for (const side of ["N", "E", "S", "W"] as const) {
    for (let n = 1; n <= 8; n += 1) ids.push(`${side}${n}`);
  }
  return ids;
}
