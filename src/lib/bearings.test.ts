import { describe, expect, it } from "vitest";
import { normalizeDegrees } from "./angles.ts";
import {
  DIR8,
  directionFromHeading,
  expectedSlotIds,
  padaFromHeading,
  padaSide,
  slotFromHeading,
} from "./bearings.ts";
import { zoneFromBearing } from "./zones.ts";

describe("directionFromHeading", () => {
  it("centers north on 0° and treats 360° as the same heading", () => {
    expect(directionFromHeading(0)).toBe("N");
    expect(directionFromHeading(360)).toBe("N");
    expect(directionFromHeading(720)).toBe("N");
    expect(directionFromHeading(-360)).toBe("N");
    expect(directionFromHeading(359.9)).toBe("N");
  });

  it("gives the clockwise edge to the next direction", () => {
    expect(directionFromHeading(337.5)).toBe("N");
    expect(directionFromHeading(337.499)).toBe("NW");
    expect(directionFromHeading(22.499)).toBe("N");
    expect(directionFromHeading(22.5)).toBe("NE");
    expect(directionFromHeading(-22.5)).toBe("N");
    expect(directionFromHeading(67.5)).toBe("E");
    expect(directionFromHeading(67.499)).toBe("NE");
    expect(directionFromHeading(180)).toBe("S");
    expect(directionFromHeading(270)).toBe("W");
  });

  it("maps each direction center to that direction", () => {
    const centers: [number, (typeof DIR8)[number]][] = [
      [0, "N"],
      [45, "NE"],
      [90, "E"],
      [135, "SE"],
      [180, "S"],
      [225, "SW"],
      [270, "W"],
      [315, "NW"],
    ];
    for (const [heading, id] of centers) {
      expect(directionFromHeading(heading)).toBe(id);
      expect(directionFromHeading(heading + 360)).toBe(id);
      expect(directionFromHeading(heading - 360)).toBe(id);
    }
  });
});

describe("padaFromHeading", () => {
  const starts: [number, string][] = [
    [45, "E1"],
    [56.25, "E2"],
    [67.5, "E3"],
    [78.75, "E4"],
    [90, "E5"],
    [101.25, "E6"],
    [112.5, "E7"],
    [123.75, "E8"],
    [135, "S1"],
    [146.25, "S2"],
    [157.5, "S3"],
    [168.75, "S4"],
    [180, "S5"],
    [191.25, "S6"],
    [202.5, "S7"],
    [213.75, "S8"],
    [225, "W1"],
    [236.25, "W2"],
    [247.5, "W3"],
    [258.75, "W4"],
    [270, "W5"],
    [281.25, "W6"],
    [292.5, "W7"],
    [303.75, "W8"],
    [315, "N1"],
    [326.25, "N2"],
    [337.5, "N3"],
    [348.75, "N4"],
    [0, "N5"],
    [11.25, "N6"],
    [22.5, "N7"],
    [33.75, "N8"],
  ];

  it("maps cardinal and corner angles onto the classical padas", () => {
    expect(padaFromHeading(0)).toBe("N5");
    expect(padaFromHeading(360)).toBe("N5");
    expect(padaFromHeading(90)).toBe("E5");
    expect(padaFromHeading(180)).toBe("S5");
    expect(padaFromHeading(270)).toBe("W5");
    expect(padaFromHeading(45)).toBe("E1");
    expect(padaFromHeading(135)).toBe("S1");
    expect(padaFromHeading(225)).toBe("W1");
    expect(padaFromHeading(315)).toBe("N1");
  });

  it("includes the start of each pada and gives the clockwise edge to the next", () => {
    for (let i = 0; i < starts.length; i += 1) {
      const [heading, id] = starts[i]!;
      const previous = starts[(i + starts.length - 1) % starts.length]![1];
      expect(padaFromHeading(heading)).toBe(id);
      expect(padaFromHeading(heading + 360)).toBe(id);
      expect(padaFromHeading(heading - 360)).toBe(id);
      expect(padaFromHeading(normalizeDegrees(heading - 0.001))).toBe(previous);
    }
  });

  it("wraps 0° and 360° onto N5, with the last sliver of the circle still N4", () => {
    expect(padaFromHeading(0)).toBe("N5");
    expect(padaFromHeading(360)).toBe("N5");
    expect(padaFromHeading(720)).toBe("N5");
    expect(padaFromHeading(-360)).toBe("N5");
    expect(padaFromHeading(359.999)).toBe("N4");
    expect(padaFromHeading(-0.001)).toBe("N4");
    expect(padaSide("N5")).toBe("N");
  });
});

describe("slotFromHeading", () => {
  it("follows the eight-point, sixteen-zone, and thirty-two-pada maps", () => {
    expect(slotFromHeading(0, 8)).toBe("N");
    expect(slotFromHeading(360, 8)).toBe("N");
    expect(slotFromHeading(22.5, 8)).toBe("NE");
    expect(slotFromHeading(0, 16)).toBe(zoneFromBearing(0).id);
    expect(slotFromHeading(360, 16)).toBe("N");
    expect(slotFromHeading(348.75, 16)).toBe("N");
    expect(slotFromHeading(11.25, 16)).toBe("NNE");
    expect(slotFromHeading(11.24, 16)).toBe("N");
    expect(slotFromHeading(0, 32)).toBe("N5");
    expect(slotFromHeading(360, 32)).toBe("N5");
    expect(slotFromHeading(45, 32)).toBe("E1");
    expect(slotFromHeading(44.999, 32)).toBe("N8");
  });

  it("names every slot the checks are allowed to use", () => {
    expect(expectedSlotIds(8)).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    expect(expectedSlotIds(16)).toHaveLength(16);
    expect(expectedSlotIds(32)).toHaveLength(32);
    expect(new Set(expectedSlotIds(32)).size).toBe(32);
  });
});
