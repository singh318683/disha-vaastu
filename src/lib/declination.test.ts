import { describe, expect, it, vi } from "vitest";
import { magneticToTrue, trueToMagnetic } from "./angles.ts";
import { approximateDeclination, declinationAt } from "./declination.ts";

describe("magnetic and true headings", () => {
  it("adds an east declination and subtracts a west one", () => {
    expect(magneticToTrue(90, 10)).toBe(100);
    expect(magneticToTrue(0, -12.5)).toBe(347.5);
    expect(magneticToTrue(5, -10)).toBe(355);
    expect(trueToMagnetic(100, 10)).toBe(90);
    expect(trueToMagnetic(magneticToTrue(27, -12.2), -12.2)).toBeCloseTo(27, 5);
  });
});

describe("World Magnetic Model", () => {
  const onDate = new Date("2026-11-04T12:00:00Z");

  it("gives New Jersey a west declination of about 12°", () => {
    const result = declinationAt(40.0583, -74.4057, onDate);
    expect(result.modelName).toMatch(/WMM-2025/);
    expect(result.approximate).toBe(false);
    expect(result.declination).toBeGreaterThan(-13);
    expect(result.declination).toBeLessThan(-11.5);
    expect(result.totalFieldNt / 1000).toBeGreaterThan(45);
    expect(result.totalFieldNt / 1000).toBeLessThan(55);
    expect(magneticToTrue(0, result.declination)).toBeGreaterThan(347);
    expect(magneticToTrue(0, result.declination)).toBeLessThan(349);
  });

  it("gives Denver an east declination", () => {
    const result = declinationAt(39.7392, -104.9903, onDate);
    expect(result.declination).toBeGreaterThan(6);
    expect(result.declination).toBeLessThan(9);
  });

  it("rejects impossible coordinates", () => {
    expect(() => declinationAt(120, 0, onDate)).toThrow(/Latitude/);
    expect(() => declinationAt(0, 200, onDate)).toThrow(/Longitude/);
  });

  it("still returns a value past the model window and marks it approximate", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = declinationAt(40.0583, -74.4057, new Date("2035-01-01T00:00:00Z"));
    expect(result.approximate).toBe(true);
    expect(result.declination).toBeGreaterThan(-20);
    expect(result.declination).toBeLessThan(-5);
    error.mockRestore();
  });

  it("uses a near-zero India declination when the timezone is Kolkata", () => {
    const result = approximateDeclination("Asia/Kolkata", -330);
    expect(result.approximate).toBe(true);
    expect(result.modelName).toBe("India approximate");
    expect(result.declination).toBeGreaterThan(-1);
    expect(result.declination).toBeLessThan(1);
  });
});
