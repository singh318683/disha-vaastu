import { normalizeDegrees } from "./angles.ts";
import { zoneFromBearing, type ZoneId } from "./zones.ts";

export interface Point {
  x: number;
  y: number;
}

/**
 * A tap this close to the center, in normalized image space, is treated as the
 * Brahmasthan rather than a direction. 0.055 is about a twentieth of the plan.
 */
export const BRAHMASTHAN_RADIUS = 0.055;

/**
 * Delta in "height fraction" units. X is scaled by the image's width/height so a
 * wide photo does not squash east-west angles. aspect = naturalWidth / naturalHeight.
 */
export function planarDelta(center: Point, point: Point, aspect = 1): { dx: number; dy: number } {
  return {
    dx: (point.x - center.x) * (aspect > 0 ? aspect : 1),
    dy: point.y - center.y,
  };
}

export function isBrahmasthan(
  center: Point,
  point: Point,
  radius = BRAHMASTHAN_RADIUS,
  aspect = 1,
): boolean {
  const { dx, dy } = planarDelta(center, point, aspect);
  return Math.hypot(dx, dy) <= radius;
}

/**
 * Clockwise degrees from image-up to the room, then shifted by the true bearing
 * of image-up. Image Y grows downward, matching a photo on screen.
 *
 * If the top of the plan points east (northBearingOfImageUp = 90), a room above
 * the center is East. A room to the right of center is South.
 */
export function bearingFromCenter(
  center: Point,
  point: Point,
  northBearingOfImageUp: number,
  aspect = 1,
): number | null {
  const { dx, dy } = planarDelta(center, point, aspect);
  if (Math.hypot(dx, dy) < 1e-8) return null;
  const imageAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return normalizeDegrees(imageAngle + northBearingOfImageUp);
}

/** Screen angle, clockwise from image-up, where a true bearing should be drawn. */
export function screenAngleOfBearing(trueBearing: number, northBearingOfImageUp: number): number {
  return normalizeDegrees(trueBearing - northBearingOfImageUp);
}

export function centroid(points: Point[]): Point | null {
  if (points.length === 0) return null;
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: total.x / points.length, y: total.y / points.length };
}

export interface PlanZone {
  trueBearing: number | null;
  zoneId: ZoneId | "center";
  isCenter: boolean;
}

export function zoneFromPlanPoint(
  plan: { center: Point; northBearingOfImageUp: number; aspect?: number },
  point: Point,
): PlanZone {
  const aspect = plan.aspect && plan.aspect > 0 ? plan.aspect : 1;
  if (isBrahmasthan(plan.center, point, BRAHMASTHAN_RADIUS, aspect)) {
    return { trueBearing: null, zoneId: "center", isCenter: true };
  }
  const trueBearing = bearingFromCenter(plan.center, point, plan.northBearingOfImageUp, aspect);
  if (trueBearing == null) {
    return { trueBearing: null, zoneId: "center", isCenter: true };
  }
  return { trueBearing, zoneId: zoneFromBearing(trueBearing).id, isCenter: false };
}
