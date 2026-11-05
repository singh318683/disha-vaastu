import { zoneFromPlanPoint } from "./geometry.ts";
import type { Property } from "./types.ts";

/** Recompute plan-tagged rooms after the center or the north alignment changes. */
export function recomputePlan(property: Property): Property {
  if (!property.plan) return property;
  const plan = property.plan;
  return {
    ...property,
    rooms: property.rooms.map((room) => {
      if (room.source !== "plan" || !room.point) return room;
      const placed = zoneFromPlanPoint(plan, room.point);
      return {
        ...room,
        trueBearing: placed.trueBearing,
        zoneId: placed.zoneId,
        isCenter: placed.isCenter,
        declinationApplied: true,
      };
    }),
  };
}
