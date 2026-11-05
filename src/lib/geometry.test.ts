import { describe, expect, it } from "vitest";
import { bearingFromCenter, centroid, zoneFromPlanPoint } from "./geometry.ts";

const center = { x: 0.5, y: 0.5 };
const northUp = { center, northBearingOfImageUp: 0 };

describe("floor-plan geometry", () => {
  it("reads the cardinal directions when north is the top of the image", () => {
    expect(zoneFromPlanPoint(northUp, { x: 0.5, y: 0.2 }).zoneId).toBe("N");
    expect(zoneFromPlanPoint(northUp, { x: 0.8, y: 0.5 }).zoneId).toBe("E");
    expect(zoneFromPlanPoint(northUp, { x: 0.5, y: 0.8 }).zoneId).toBe("S");
    expect(zoneFromPlanPoint(northUp, { x: 0.2, y: 0.5 }).zoneId).toBe("W");
    expect(bearingFromCenter(center, { x: 0.8, y: 0.2 }, 0)).toBeCloseTo(45, 5);
    expect(zoneFromPlanPoint(northUp, { x: 0.8, y: 0.2 }).zoneId).toBe("NE");
  });

  it("shifts every room when the top of the plan points east", () => {
    const eastUp = { center, northBearingOfImageUp: 90 };
    expect(zoneFromPlanPoint(eastUp, { x: 0.5, y: 0.2 }).zoneId).toBe("E");
    expect(zoneFromPlanPoint(eastUp, { x: 0.8, y: 0.5 }).zoneId).toBe("S");
    expect(zoneFromPlanPoint(eastUp, { x: 0.5, y: 0.8 }).zoneId).toBe("W");
    expect(zoneFromPlanPoint(eastUp, { x: 0.2, y: 0.5 }).zoneId).toBe("N");
  });

  it("treats a tap on the center as the Brahmasthan", () => {
    const onCenter = zoneFromPlanPoint(northUp, { x: 0.5, y: 0.51 });
    expect(onCenter.isCenter).toBe(true);
    expect(onCenter.zoneId).toBe("center");
    expect(onCenter.trueBearing).toBeNull();
    expect(zoneFromPlanPoint(northUp, { x: 0.5, y: 0.2 }).isCenter).toBe(false);
  });

  it("keeps a 45° diagonal on a wide plan", () => {
    const wide = { center, northBearingOfImageUp: 0, aspect: 2 };
    expect(bearingFromCenter(center, { x: 0.6, y: 0.3 }, 0, 2)).toBeCloseTo(45, 5);
    expect(zoneFromPlanPoint(wide, { x: 0.6, y: 0.3 }).zoneId).toBe("NE");
  });

  it("averages room taps into a centroid", () => {
    expect(centroid([])).toBeNull();
    expect(centroid([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual({ x: 0.5, y: 0.5 });
  });
});
