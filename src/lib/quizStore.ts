import type { Rating } from "./checks.ts";

const STORAGE_KEY = "disha.quiz.results.v1";

export interface StoredQuizResult {
  checkId: string;
  heading: number;
  trueNorth: boolean;
  at: number;
}

export function isStoredQuizResult(value: unknown): value is StoredQuizResult {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredQuizResult>;
  return typeof row.checkId === "string" && typeof row.heading === "number" && Number.isFinite(row.heading) && typeof row.at === "number";
}

export function upsertResult(list: readonly StoredQuizResult[], next: StoredQuizResult): StoredQuizResult[] {
  return [...list.filter((item) => item.checkId !== next.checkId), next];
}

export function loadQuizResults(): StoredQuizResult[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredQuizResult).map((item) => ({
      checkId: item.checkId,
      heading: item.heading,
      trueNorth: item.trueNorth !== false,
      at: item.at,
    }));
  } catch {
    return [];
  }
}

export function saveQuizResults(results: readonly StoredQuizResult[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch {
    /* A private browser can refuse storage. The summary still works for this visit. */
  }
}

export function ratingsOf(results: readonly { rating: Rating }[]): Rating[] {
  return results.map((item) => item.rating);
}
