/** Wrap any angle into [0, 360). */
export function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Angle must be a finite number.");
  }
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * True heading = magnetic heading + declination.
 * Declination is signed: positive east, negative west (NOAA convention).
 * New Jersey is about 12° west, so a magnetic heading of 0° is a true heading near 348°.
 */
export function magneticToTrue(magneticHeading: number, declinationEast: number): number {
  return normalizeDegrees(magneticHeading + declinationEast);
}

export function trueToMagnetic(trueHeading: number, declinationEast: number): number {
  return normalizeDegrees(trueHeading - declinationEast);
}

/** Smallest signed difference a - b, in (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  const delta = normalizeDegrees(to - from);
  return delta > 180 ? delta - 360 : delta;
}
