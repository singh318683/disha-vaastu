export type PlanId = "monthly" | "yearly" | "lifetime" | "report";
export type PayCurrency = "INR" | "USD";

export interface PlanOffer {
  id: PlanId;
  /** Smallest currency unit: paise or cents. */
  inr: number;
  usd: number;
  recurring: boolean;
  trialDays: number;
}

export const PLANS: readonly PlanOffer[] = [
  { id: "monthly", inr: 14900, usd: 399, recurring: true, trialDays: 0 },
  { id: "yearly", inr: 99900, usd: 2499, recurring: true, trialDays: 7 },
  { id: "lifetime", inr: 249900, usd: 4999, recurring: false, trialDays: 0 },
  { id: "report", inr: 29900, usd: 699, recurring: false, trialDays: 0 },
];

export function planById(id: string): PlanOffer | null {
  return PLANS.find((plan) => plan.id === id) ?? null;
}

export function priceOf(plan: PlanOffer, currency: PayCurrency): number {
  return currency === "INR" ? plan.inr : plan.usd;
}

export function formatPrice(amount: number, currency: PayCurrency): string {
  const major = amount / 100;
  if (currency === "INR") return `₹${new Intl.NumberFormat("en-IN").format(major)}`;
  return `$${major.toFixed(2)}`;
}

/** India when the timezone or language says so. Everyone else sees USD. */
export function currencyFor(timeZone: string, language: string): PayCurrency {
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") return "INR";
  const lang = language.toLowerCase();
  if (lang === "hi" || lang.startsWith("hi-") || lang.endsWith("-in")) return "INR";
  return "USD";
}

export function detectCurrency(): PayCurrency {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const language = typeof navigator === "undefined" ? "" : navigator.language;
  return currencyFor(timeZone, language);
}

const DAY = 24 * 60 * 60 * 1000;

/** Lifetime and the one-off report do not expire. */
export function expiryFor(plan: PlanId, now: number): number | null {
  if (plan === "monthly") return now + 32 * DAY;
  if (plan === "yearly") return now + 370 * DAY;
  return null;
}
