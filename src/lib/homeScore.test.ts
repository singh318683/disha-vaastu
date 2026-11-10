import { describe, expect, it } from "vitest";
import { CHECKS, requireCheck } from "./checks.ts";
import { bandFor, confidenceFor, homeScore, pointsFor } from "./homeScore.ts";
import type { StoredQuizResult } from "./quizStore.ts";

function saved(checkId: string, heading: number): StoredQuizResult {
  return { checkId, heading, trueNorth: true, at: 1 };
}

describe("home score", () => {
  it("maps a verdict to best, good, neutral, or avoid, with partial credit when a remedy is done", () => {
    expect(pointsFor("auspicious", false)).toBe(100);
    expect(pointsFor("auspicious", true)).toBe(100);
    expect(pointsFor("neutral", false)).toBe(50);
    expect(pointsFor("neutral", true)).toBe(75);
    expect(pointsFor("inauspicious", false)).toBe(15);
    expect(pointsFor("inauspicious", true)).toBe(50);
  });

  it("weights a heavy door above a light mirror in the average", () => {
    expect(requireCheck("main_door").weight).toBeGreaterThan(requireCheck("mirror").weight);
    expect(requireCheck("toilet").weight).toBe(5);
    expect(CHECKS.every((check) => check.weight >= 1 && check.weight <= 5)).toBe(true);
    const pulledDown = homeScore([saved("main_door", 20), saved("mirror", 0)]);
    const onlyMirror = homeScore([saved("mirror", 0)]);
    expect(onlyMirror.score).toBe(100);
    expect(pulledDown.score).toBeLessThan(100);
    const doorOnly = homeScore([saved("main_door", 20)]);
    const doorFixed = homeScore([saved("main_door", 20)], { main_door: 20 });
    expect((doorFixed.score ?? 0) - (doorOnly.score ?? 0)).toBe(35);
  });

  it("scores only completed checks and reports coverage", () => {
    const report = homeScore([saved("pooja", 0)]);
    expect(report.done).toBe(1);
    expect(report.total).toBe(34);
    expect(report.confidence).toBe("low");
    expect(report.score).not.toBeNull();
    expect(confidenceFor(3)).toBe("low");
    expect(confidenceFor(8)).toBe("mid");
    expect(confidenceFor(12)).toBe("high");
  });

  it("names the bands at the published edges", () => {
    expect(bandFor(85)).toBe("excellent");
    expect(bandFor(84)).toBe("good");
    expect(bandFor(70)).toBe("good");
    expect(bandFor(69)).toBe("fair");
    expect(bandFor(50)).toBe("fair");
    expect(bandFor(49)).toBe("care");
  });

  it("says how many points a heavy remedy would add", () => {
    const before = homeScore([saved("main_door", 20), saved("kitchen", 135)]);
    const boost = before.boosts[0];
    expect(boost).toBeTruthy();
    const after = homeScore([saved("main_door", 20), saved("kitchen", 135)], { [boost!.checkId]: before.done ? saved(boost!.checkId, boost!.checkId === "main_door" ? 20 : 135).heading : 0 });
    expect(before.boosts.some((item) => item.gain > 0)).toBe(true);
    expect((after.score ?? 0) - (before.score ?? 0)).toBeGreaterThanOrEqual(0);
  });
});
