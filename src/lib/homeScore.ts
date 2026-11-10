import { CHECKS, checkGroups, verdictForHeading, type Rating, type VaastuCheck } from "./checks.ts";
import type { L10n, Locale } from "./l10n.ts";
import type { StoredQuizResult } from "./quizStore.ts";

/** Best, good, neutral, and avoid, as a percent of a perfect placement. */
export const POINTS = { best: 100, good: 75, neutral: 50, avoid: 15 } as const;

export type ScoreBand = "excellent" | "good" | "fair" | "care";
export type ScoreConfidence = "low" | "mid" | "high";

export interface ScoreBoost {
  checkId: string;
  title: L10n;
  group: L10n;
  remedy: string;
  /** Points the overall score would gain if this remedy is counted. */
  gain: number;
  weight: number;
}

export interface CategoryScore {
  group: L10n;
  score: number | null;
  done: number;
  total: number;
}

export interface HomeScore {
  /** Null until at least one check is completed. */
  score: number | null;
  band: ScoreBand | null;
  done: number;
  total: number;
  confidence: ScoreConfidence;
  categories: CategoryScore[];
  boosts: ScoreBoost[];
}

export function pointsFor(rating: Rating, remedyDone: boolean): number {
  if (rating === "auspicious") return POINTS.best;
  if (rating === "neutral") return remedyDone ? POINTS.good : POINTS.neutral;
  return remedyDone ? POINTS.neutral : POINTS.avoid;
}

export function bandFor(score: number): ScoreBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "care";
}

export function confidenceFor(done: number): ScoreConfidence {
  if (done < 4) return "low";
  if (done < 12) return "mid";
  return "high";
}

export function homeScore(
  results: readonly StoredQuizResult[],
  remedies: Readonly<Record<string, number>> = {},
  locale: Locale = "en",
): HomeScore {
  const byId = new Map(results.map((item) => [item.checkId, item]));
  const scored = CHECKS.flatMap((check) => {
    const saved = byId.get(check.id);
    if (!saved) return [];
    const verdict = verdictForHeading(check, saved.heading, locale);
    const remedyDone = remedies[check.id] === saved.heading && verdict.remedies.length > 0;
    return [{ check, verdict, points: pointsFor(verdict.rating, remedyDone), remedyDone }];
  });

  const score = weighted(scored.map((item) => ({ weight: item.check.weight, points: item.points })));
  const categories = checkGroups().map((group) => {
    const rows = scored.filter((item) => item.check.group.en === group.group.en);
    return {
      group: group.group,
      score: weighted(rows.map((item) => ({ weight: item.check.weight, points: item.points }))),
      done: rows.length,
      total: group.checks.length,
    };
  });

  return {
    score,
    band: score == null ? null : bandFor(score),
    done: scored.length,
    total: CHECKS.length,
    confidence: confidenceFor(scored.length),
    categories,
    boosts: biggestBoosts(scored),
  };
}

function weighted(rows: readonly { weight: number; points: number }[]): number | null {
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return null;
  const earned = rows.reduce((sum, row) => sum + row.weight * row.points, 0);
  return Math.round(earned / totalWeight);
}

function biggestBoosts(
  scored: readonly { check: VaastuCheck; verdict: { remedies: string[]; rating: Rating }; points: number; remedyDone: boolean }[],
): ScoreBoost[] {
  const current = weighted(scored.map((item) => ({ weight: item.check.weight, points: item.points })));
  if (current == null) return [];
  const lifts = scored.flatMap((item) => {
    if (item.remedyDone || item.verdict.remedies.length === 0) return [];
    const lifted = pointsFor(item.verdict.rating, true);
    if (lifted <= item.points) return [];
    const next = weighted(
      scored.map((row) => ({
        weight: row.check.weight,
        points: row.check.id === item.check.id ? lifted : row.points,
      })),
    );
    const gain = (next ?? current) - current;
    if (gain <= 0) return [];
    return [
      {
        checkId: item.check.id,
        title: item.check.title,
        group: item.check.group,
        remedy: item.verdict.remedies[0] ?? "",
        gain,
        weight: item.check.weight,
      },
    ];
  });
  lifts.sort((a, b) => b.gain - a.gain || b.weight - a.weight);
  return lifts.slice(0, 3);
}
