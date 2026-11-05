import { describe, expect, it } from "vitest";
import { zoneFromBearing, zoneSteps, zonesAreNear, ZONES } from "./zones.ts";

describe("zoneFromBearing", () => {
  it("centers North on 0° and wraps through 360°", () => {
    expect(zoneFromBearing(0).id).toBe("N");
    expect(zoneFromBearing(360).id).toBe("N");
    expect(zoneFromBearing(-11).id).toBe("N");
    expect(zoneFromBearing(359).id).toBe("N");
    expect(zoneFromBearing(348.75).id).toBe("N");
    expect(zoneFromBearing(11.24).id).toBe("N");
    expect(zoneFromBearing(11.25).id).toBe("NNE");
  });

  it("maps every zone center to that zone", () => {
    for (const zone of ZONES) {
      expect(zoneFromBearing(zone.center).id).toBe(zone.id);
    }
  });

  it("puts 135° in the southeast fire zone", () => {
    const zone = zoneFromBearing(135);
    expect(zone.id).toBe("SE");
    expect(zone.element).toBe("fire");
  });

  it("groups four zones to each element, matching N/NE, E/SE, S/SW, W/NW", () => {
    const counts = { water: 0, fire: 0, earth: 0, air: 0 };
    for (const zone of ZONES) counts[zone.element] += 1;
    expect(counts).toEqual({ water: 4, fire: 4, earth: 4, air: 4 });
    expect(zoneFromBearing(0).element).toBe("water");
    expect(zoneFromBearing(45).element).toBe("water");
    expect(zoneFromBearing(90).element).toBe("fire");
    expect(zoneFromBearing(135).element).toBe("fire");
    expect(zoneFromBearing(180).element).toBe("earth");
    expect(zoneFromBearing(225).element).toBe("earth");
    expect(zoneFromBearing(270).element).toBe("air");
    expect(zoneFromBearing(315).element).toBe("air");
  });

  it("treats neighbors as near and opposite zones as far", () => {
    expect(zoneSteps("N", "NNE")).toBe(1);
    expect(zoneSteps("N", "NNW")).toBe(1);
    expect(zonesAreNear("NE", "NNE")).toBe(true);
    expect(zonesAreNear("NE", "SW")).toBe(false);
    expect(zoneSteps("N", "S")).toBe(8);
  });
});
