import { zoneFromPlanPoint } from "./geometry.ts";
import { uid } from "./id.ts";
import type { FloorPlan, Property, TaggedRoom } from "./types.ts";

export const SAMPLE_PLAN_URL = "/samples/apartment.svg";

/**
 * Marker positions on the sample plan. North is up, and the apartment's center
 * is the center of the image. Two rooms are deliberately in avoided zones so
 * the report has something to remedy: the kitchen in the southwest, the master
 * bedroom in the southeast.
 */
export const SAMPLE_MARKERS: { typeId: string; label?: string; x: number; y: number }[] = [
  { typeId: "main_door", x: 0.5, y: 0.11 },
  { typeId: "living", x: 0.5, y: 0.22 },
  { typeId: "pooja", x: 0.78, y: 0.2 },
  { typeId: "study", x: 0.8, y: 0.49 },
  { typeId: "toilet", x: 0.18, y: 0.42 },
  { typeId: "bedroom", label: "West bedroom", x: 0.19, y: 0.58 },
  { typeId: "kitchen", x: 0.28, y: 0.78 },
  { typeId: "master_bedroom", x: 0.74, y: 0.78 },
];

export function buildSampleProperty(now = Date.now()): Property {
  const plan: FloorPlan = {
    image: SAMPLE_PLAN_URL,
    northBearingOfImageUp: 0,
    center: { x: 0.5, y: 0.5 },
    aspect: 1,
  };
  const rooms: TaggedRoom[] = SAMPLE_MARKERS.map((marker) => {
    const placed = zoneFromPlanPoint(plan, { x: marker.x, y: marker.y });
    return {
      id: uid(),
      typeId: marker.typeId,
      label: marker.label,
      source: "plan",
      trueBearing: placed.trueBearing,
      zoneId: placed.zoneId,
      isCenter: placed.isCenter,
      declinationApplied: true,
      point: { x: marker.x, y: marker.y },
    };
  });
  return {
    id: uid(),
    name: "Sample apartment",
    createdAt: now,
    updatedAt: now,
    placeLabel: "North is up on the drawing",
    rooms,
    placements: [],
    plan,
  };
}
