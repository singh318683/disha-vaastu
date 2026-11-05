import { describe, expect, it } from "vitest";
import { expectedSlotIds } from "./bearings.ts";
import { CHECK_CATALOG, CHECKS, checkGroups, harmonyOf, requireCheck, verdictForHeading } from "./checks.ts";
import { isCheckIcon } from "./checkIcons.ts";
import { upsertResult } from "./quizStore.ts";

const CLASSICAL_GOOD = ["E3", "E4", "S4", "W4", "W5", "N3", "N4", "N5"];

describe("check catalog", () => {
  it("documents the 32-pada compass convention", () => {
    expect(CHECK_CATALOG.framing.en.toLowerCase()).toContain("traditional vaastu");
    expect(CHECK_CATALOG.framing.hi).toMatch(/[\u0900-\u097F]/);
    expect(CHECK_CATALOG.convention.en).toContain("11.25");
    expect(CHECK_CATALOG.convention.en).toContain("N5");
    expect(CHECK_CATALOG.convention.en).toContain("0°");
    expect(CHECK_CATALOG.convention.en).toContain("360°");
    expect(CHECK_CATALOG.convention.en.toLowerCase()).toContain("clockwise");
    expect(CHECK_CATALOG.convention.hi).toMatch(/[\u0900-\u097F]/);
  });

  it("gives every check a complete, unique zone list and usable remedies", () => {
    const ids = new Set<string>();
    expect(CHECKS.length).toBeGreaterThanOrEqual(30);
    for (const check of CHECKS) {
      expect(ids.has(check.id)).toBe(false);
      ids.add(check.id);
      expect(isCheckIcon(check.icon)).toBe(true);
      expect(check.instructions.en.length).toBeGreaterThan(20);
      expect(check.instructions.hi).toMatch(/[\u0900-\u097F]/);
      expect(check.bestNote.en.length).toBeGreaterThan(8);
      expect(check.bestNote.hi).toMatch(/[\u0900-\u097F]/);
      expect(check.reference === "facing-out" || check.reference === "pointing-from-center").toBe(true);
      const expected = expectedSlotIds(check.granularity);
      expect(check.zones.map((zone) => zone.id).sort()).toEqual([...expected].sort());
      expect(check.zones.some((zone) => zone.rating === "auspicious")).toBe(true);
      for (const zone of check.zones) {
        expect(zone.name.en.length).toBeGreaterThan(0);
        expect(zone.name.hi).toMatch(/[\u0900-\u097F]/);
        expect(zone.meaning.en.length).toBeGreaterThan(0);
        expect(zone.meaning.hi).toMatch(/[\u0900-\u097F]/);
        expect(["auspicious", "neutral", "inauspicious"]).toContain(zone.rating);
        if (zone.rating === "auspicious") expect(zone.remedies.length).toBeLessThanOrEqual(1);
        else expect(zone.remedies.length).toBeGreaterThanOrEqual(2);
        expect(zone.remedies.length).toBeLessThanOrEqual(3);
        expect(new Set(zone.remedies).size).toBe(zone.remedies.length);
      }
      if (check.granularity === 32) {
        expect(check.facingNotes?.N?.en).toBeTruthy();
        expect(check.facingNotes?.N?.hi).toMatch(/[\u0900-\u097F]/);
        expect(check.facingNotes?.E).toBeTruthy();
        expect(check.facingNotes?.S).toBeTruthy();
        expect(check.facingNotes?.W).toBeTruthy();
      }
    }
    expect(checkGroups().length).toBeGreaterThan(3);
    expect(checkGroups().reduce((sum, group) => sum + group.checks.length, 0)).toBe(CHECKS.length);
  });

  it("keeps the classical eight entrance padas auspicious and avoids gendered fault lines", () => {
    const door = requireCheck("main_door");
    for (const id of CLASSICAL_GOOD) {
      expect(door.zones.find((zone) => zone.id === id)?.rating).toBe("auspicious");
    }
    expect(door.zones.find((zone) => zone.id === "S3")?.rating).toBe("neutral");
    expect(door.zones.find((zone) => zone.id === "W3")?.rating).toBe("neutral");
    for (const zone of door.zones) {
      expect(zone.meaning.en.toLowerCase()).not.toMatch(/daughter|women/);
      expect(zone.name.hi).toMatch(/[\u0900-\u097F]/);
    }
    expect(door.zones.find((zone) => zone.id === "N5")?.name.hi).toBe("सोम");
  });
});

describe("verdict lookup", () => {
  it("reads a north door as N5 Soma and names the best north padas", () => {
    const verdict = verdictForHeading(requireCheck("main_door"), 0);
    expect(verdict.slotId).toBe("N5");
    expect(verdict.slotName).toBe("Soma");
    expect(verdict.rating).toBe("auspicious");
    expect(verdict.placementLine).toBe("North-facing");
    expect(verdict.slotLine).toContain("N5");
    expect(verdict.bestNote).toContain("N3, N4, or N5");
    expect(verdict.bestNote.toLowerCase()).toContain("wealth");
    expect(verdict.toward).toBeNull();
    expect(verdictForHeading(requireCheck("main_door"), 360)).toEqual(verdict);
    const hindi = verdictForHeading(requireCheck("main_door"), 0, "hi");
    expect(hindi.slotName).toBe("सोम");
    expect(hindi.placementLine).toBe("उत्तरमुखी");
    expect(hindi.slotLine).toContain("N5");
    expect(hindi.meaning).toMatch(/[\u0900-\u097F]/);
    expect(hindi.bestNote).toContain("N3");
  });

  it("wraps the northwest corner onto N1 and offers remedies", () => {
    const verdict = verdictForHeading(requireCheck("main_door"), 315);
    expect(verdict.slotId).toBe("N1");
    expect(verdict.slotName).toBe("Roga");
    expect(verdict.rating).toBe("inauspicious");
    expect(verdict.remedies.length).toBeGreaterThanOrEqual(2);
    expect(verdict.bestNote).toContain("N3, N4, or N5");
    expect(verdict.toward).toBe("Toward the northwest.");
    expect(verdictForHeading(requireCheck("main_door"), 315 - 360).slotId).toBe("N1");
  });

  it("puts exact east, south, and west on E5, S5, and W5", () => {
    const door = requireCheck("main_door");
    expect(verdictForHeading(door, 90).slotId).toBe("E5");
    expect(verdictForHeading(door, 180).slotId).toBe("S5");
    expect(verdictForHeading(door, 270).slotId).toBe("W5");
    expect(verdictForHeading(door, 270).rating).toBe("auspicious");
    expect(verdictForHeading(door, 44.999).slotId).toBe("N8");
    expect(verdictForHeading(door, 45).slotId).toBe("E1");
  });

  it("scores a from-center kitchen with the sixteen-zone map", () => {
    const kitchen = requireCheck("kitchen");
    expect(kitchen.reference).toBe("pointing-from-center");
    const good = verdictForHeading(kitchen, 135);
    expect(good.slotId).toBe("SE");
    expect(good.rating).toBe("auspicious");
    expect(good.placementLine.toLowerCase()).toContain("southeast");
    const poor = verdictForHeading(kitchen, 0);
    expect(poor.slotId).toBe("N");
    expect(poor.rating).toBe("inauspicious");
    expect(poor.remedies.length).toBeGreaterThanOrEqual(2);
    expect(verdictForHeading(kitchen, 360).slotId).toBe("N");
  });

  it("scores an eight-point facing check, including its boundaries", () => {
    const cooking = requireCheck("cooking_facing");
    expect(cooking.reference).toBe("facing-out");
    expect(verdictForHeading(cooking, 90).rating).toBe("auspicious");
    expect(verdictForHeading(cooking, 22.5).placementLine).toBe("Facing northeast");
    expect(verdictForHeading(cooking, 22.499).direction).toBe("N");
    expect(verdictForHeading(cooking, 180).rating).toBe("inauspicious");
  });
});

describe("home harmony", () => {
  it("stays calm when the checked places are mostly kind", () => {
    expect(harmonyOf([]).title).toBe("Home harmony");
    expect(harmonyOf(["auspicious", "auspicious", "neutral"]).title).toBe("A calm home");
    expect(harmonyOf(["auspicious", "inauspicious", "inauspicious", "neutral"]).title).toBe("Some care will help");
  });

  it("replaces a saved result for the same check", () => {
    const first = upsertResult([], { checkId: "kitchen", heading: 135, trueNorth: true, at: 1 });
    const next = upsertResult(first, { checkId: "kitchen", heading: 0, trueNorth: true, at: 2 });
    expect(next).toHaveLength(1);
    expect(next[0]?.heading).toBe(0);
  });
});
