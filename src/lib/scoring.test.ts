import { describe, expect, it } from "vitest";
import { buildSampleProperty } from "./sample.ts";
import {
  BAND_SCORE,
  bandForZone,
  scoreAgainstRule,
  scoreProperty,
  verdictForScore,
} from "./scoring.ts";
import { ALL_RULES, REMEDIES, requireRule } from "./rules.ts";
import type { TaggedRoom } from "./types.ts";
import { ZONES, type ZoneId } from "./zones.ts";

function room(partial: Pick<TaggedRoom, "typeId" | "zoneId"> & Partial<TaggedRoom>): TaggedRoom {
  return {
    source: "point",
    trueBearing: 0,
    isCenter: partial.zoneId === "center",
    declinationApplied: true,
    ...partial,
    id: partial.id ?? partial.typeId,
  };
}

describe("rule file", () => {
  it("partitions all 16 zones for every room and orientation", () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(16);
    for (const rule of ALL_RULES) {
      const listed = [...rule.best, ...rule.favorable, ...rule.neutral, ...rule.avoid];
      expect(new Set(listed).size, rule.id).toBe(16);
      for (const zone of ZONES) {
        expect(listed, `${rule.id} ${zone.id}`).toContain(zone.id);
      }
      for (const id of Object.values(rule.remedies).flat()) {
        expect(REMEDIES.has(id), `${rule.id} → ${id}`).toBe(true);
      }
    }
  });
});

describe("scoreAgainstRule", () => {
  const kitchen = requireRule("kitchen");
  const master = requireRule("master_bedroom");
  const toilet = requireRule("toilet");
  const pooja = requireRule("pooja");

  it("follows the concept table for kitchen, master bedroom, pooja, and toilet", () => {
    expect(bandForZone(kitchen, "SE")).toBe("best");
    expect(bandForZone(kitchen, "NW")).toBe("favorable");
    expect(bandForZone(kitchen, "NE")).toBe("avoid");
    expect(bandForZone(kitchen, "SW")).toBe("avoid");
    expect(scoreAgainstRule({ rule: kitchen, zoneId: "SE" }).score).toBe(BAND_SCORE.best);
    expect(scoreAgainstRule({ rule: kitchen, zoneId: "NE" }).score).toBe(BAND_SCORE.avoid);

    expect(bandForZone(master, "SW")).toBe("best");
    expect(bandForZone(master, "NE")).toBe("avoid");
    expect(bandForZone(master, "SE")).toBe("avoid");

    expect(bandForZone(pooja, "NE")).toBe("best");
    expect(bandForZone(pooja, "S")).toBe("avoid");
    expect(bandForZone(pooja, "SW")).toBe("avoid");

    expect(bandForZone(toilet, "WNW")).toBe("best");
    expect(bandForZone(toilet, "SSW")).toBe("best");
    expect(bandForZone(toilet, "NE")).toBe("avoid");
  });

  it("scores a toilet in the Brahmasthan as severely unfavorable", () => {
    const result = scoreAgainstRule({ rule: toilet, zoneId: "WNW", isCenter: true });
    expect(result.score).toBe(12);
    expect(result.band).toBe("avoid");
    expect(result.remedyIds.length).toBeGreaterThan(0);
    expect(verdictForScore(result.score).id).toBe("unfavorable");
  });

  it("lowers a well-placed pooja room that sits next to a toilet", () => {
    const result = scoreAgainstRule({ rule: pooja, zoneId: "NE", nearToilet: true });
    expect(result.score).toBeLessThanOrEqual(42);
    expect(result.notes.join(" ")).toMatch(/toilet/i);
    expect(result.remedyIds).toContain("pooja-toilet");
  });

  it("offers non-structural remedies for a poor kitchen", () => {
    const result = scoreAgainstRule({ rule: kitchen, zoneId: "NE" });
    const kinds = new Set(
      result.remedyIds.flatMap((id) => REMEDIES.get(id)?.kinds ?? []),
    );
    expect(kinds.has("direction")).toBe(true);
    expect(kinds.has("color")).toBe(true);
    expect(kinds.has("furniture")).toBe(true);
    expect(kinds.has("mirror")).toBe(true);
    expect(kinds.has("element")).toBe(true);
  });
});

describe("scoreProperty", () => {
  it("weights rooms into one home score and ignores an empty home", () => {
    expect(scoreProperty({ rooms: [], placements: [] })).toBeNull();
    const scored = scoreProperty({
      placements: [],
      rooms: [
        room({ typeId: "kitchen", zoneId: "SE" as ZoneId }),
        room({ id: "master", typeId: "master_bedroom", zoneId: "SW" }),
        room({ id: "toilet", typeId: "toilet", zoneId: "NE" }),
      ],
    });
    expect(scored).not.toBeNull();
    const weight = 1.4 + 1.3 + 1.3;
    const raw = (100 * 1.4 + 100 * 1.3 + 28 * 1.3) / weight;
    expect(scored!.score).toBe(Math.round(raw));
    expect(scored!.issueCount).toBe(1);
    expect(scored!.rooms.map((item) => item.name)).toEqual(["Kitchen", "Master bedroom", "Toilet"]);
  });

  it("flags a pooja room in the zone next to a toilet", () => {
    const scored = scoreProperty({
      placements: [],
      rooms: [
        room({ id: "pooja", typeId: "pooja", zoneId: "NE" }),
        room({ id: "toilet", typeId: "toilet", zoneId: "NNE" }),
      ],
    });
    const pooja = scored!.rooms.find((item) => item.typeId === "pooja")!;
    expect(pooja.score).toBeLessThanOrEqual(42);
    expect(pooja.remedies.some((remedy) => remedy.id === "pooja-toilet")).toBe(true);
  });

  it("scores the sample apartment as a mixed but mostly favorable home", () => {
    const sample = buildSampleProperty();
    const scored = scoreProperty(sample)!;
    const zoneOf = (typeId: string) => scored.rooms.find((item) => item.typeId === typeId)!;
    expect(zoneOf("kitchen").zoneId).toBe("SW");
    expect(zoneOf("kitchen").score).toBe(28);
    expect(zoneOf("master_bedroom").zoneId).toBe("SE");
    expect(zoneOf("master_bedroom").score).toBe(28);
    expect(zoneOf("pooja").zoneId).toBe("NE");
    expect(zoneOf("pooja").score).toBe(100);
    expect(zoneOf("toilet").zoneId).toBe("WNW");
    expect(zoneOf("main_door").zoneId).toBe("N");
    expect(zoneOf("living").zoneId).toBe("N");
    expect(zoneOf("study").zoneId).toBe("E");
    expect(zoneOf("bedroom").zoneId).toBe("WSW");
    expect(scored.score).toBe(79);
    expect(scored.verdict.id).toBe("good");
    expect(scored.issueCount).toBe(2);
  });
});
