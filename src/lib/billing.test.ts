import { describe, expect, it } from "vitest";
import { demoPremiumRequested, shownRemedies } from "./accessRules.ts";
import { CHECKS, FREE_CHECK_IDS, isFreeCheck } from "./checks.ts";
import { issueToken, readToken } from "./entitlementToken.ts";
import { homeScore } from "./homeScore.ts";
import { currencyFor, expiryFor, formatPrice, PLANS } from "./plans.ts";
import type { StoredQuizResult } from "./quizStore.ts";

describe("access rules", () => {
  it("shows only the first remedy until premium, and ignores the demo flag in production", () => {
    expect(shownRemedies(["a", "b", "c"], false)).toEqual(["a"]);
    expect(shownRemedies(["a", "b"], true)).toEqual(["a", "b"]);
    expect(demoPremiumRequested(false, "?premium=demo")).toBe(false);
    expect(demoPremiumRequested(true, "?premium=demo")).toBe(true);
    expect(demoPremiumRequested(true, "?premium=no")).toBe(false);
  });
});

describe("free and premium checks", () => {
  it("marks the six core rooms free and everything else premium", () => {
    expect([...FREE_CHECK_IDS].sort()).toEqual(
      ["house_facing", "kitchen", "living", "main_door", "master_bedroom", "pooja"].sort(),
    );
    expect(CHECKS.filter((check) => check.tier === "free").map((check) => check.id).sort()).toEqual(
      [...FREE_CHECK_IDS].sort(),
    );
    expect(CHECKS.filter((check) => check.tier === "premium")).toHaveLength(28);
    expect(isFreeCheck("toilet")).toBe(false);
    expect(isFreeCheck("living")).toBe(true);
  });
});

describe("currency", () => {
  it("shows rupees in India and dollars elsewhere", () => {
    expect(currencyFor("Asia/Kolkata", "en-US")).toBe("INR");
    expect(currencyFor("America/New_York", "hi-IN")).toBe("INR");
    expect(currencyFor("Europe/London", "en-GB")).toBe("USD");
    expect(formatPrice(14900, "INR")).toBe("₹149");
    expect(formatPrice(399, "USD")).toBe("$3.99");
    expect(PLANS.find((plan) => plan.id === "yearly")?.trialDays).toBe(7);
  });
});

describe("preview score", () => {
  it("ignores premium checks until the account is premium", () => {
    const results: StoredQuizResult[] = [
      { checkId: "main_door", heading: 0, trueNorth: true, at: 1 },
      { checkId: "toilet", heading: 90, trueNorth: true, at: 2 },
    ];
    const preview = homeScore(results.filter((item) => isFreeCheck(item.checkId)));
    const full = homeScore(results);
    expect(preview.done).toBe(1);
    expect(full.done).toBe(2);
    expect(preview.score).not.toBe(full.score);
  });
});

describe("entitlement token", () => {
  const secret = "test-secret";
  const now = Date.parse("2026-11-10T00:00:00Z");

  it("accepts a signed token and rejects a bad signature or an expiry", async () => {
    const token = await issueToken(
      { v: 1, email: "a@b.co", plan: "monthly", paymentId: "pay_1", iat: now, exp: expiryFor("monthly", now) },
      secret,
    );
    expect((await readToken(token, secret, now))?.email).toBe("a@b.co");
    expect(await readToken(`${token}x`, secret, now)).toBeNull();
    expect(await readToken(token, "other", now)).toBeNull();
    const expired = await issueToken(
      { v: 1, email: "a@b.co", plan: "monthly", paymentId: "pay_1", iat: now - 1000, exp: now - 1 },
      secret,
    );
    expect(await readToken(expired, secret, now)).toBeNull();
    const lifetime = await issueToken(
      { v: 1, email: "a@b.co", plan: "lifetime", paymentId: "pay_2", iat: now, exp: null },
      secret,
    );
    expect((await readToken(lifetime, secret, now + 10 * 365 * 86400000))?.plan).toBe("lifetime");
  });
});
