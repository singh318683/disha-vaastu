export type Locale = "en" | "hi";

export interface L10n {
  en: string;
  hi: string;
}

export const LOCALE_KEY = "disha.locale";

let current: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "hi";
}

export function detectLocale(language = typeof navigator === "undefined" ? "" : navigator.language): Locale {
  return language.toLowerCase().startsWith("hi") ? "hi" : "en";
}

export function readStoredLocale(): Locale | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const saved = localStorage.getItem(LOCALE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function initialLocale(): Locale {
  return readStoredLocale() ?? detectLocale();
}

export function getLocale(): Locale {
  return current;
}

export function applyLocale(locale: Locale): void {
  current = locale;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* Private mode can refuse storage. The choice still lasts for this visit. */
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

export function lt(value: L10n | string | null | undefined, locale: Locale = current): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const text = value[locale]?.trim() ? value[locale] : value.en;
  return text;
}

export function L(en: string, hi: string): L10n {
  return { en, hi };
}

export function isL10n(value: unknown): value is L10n {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<L10n>;
  return typeof row.en === "string" && row.en.trim().length > 0 && typeof row.hi === "string" && row.hi.trim().length > 0;
}

const DIR: Record<string, L10n> = {
  N: L("North", "उत्तर"),
  NE: L("Northeast", "ईशान"),
  E: L("East", "पूर्व"),
  SE: L("Southeast", "आग्नेय"),
  S: L("South", "दक्षिण"),
  SW: L("Southwest", "नैऋत्य"),
  W: L("West", "पश्चिम"),
  NW: L("Northwest", "वायव्य"),
  NNE: L("North-northeast", "उत्तर-ईशान"),
  ENE: L("East-northeast", "पूर्व-ईशान"),
  ESE: L("East-southeast", "पूर्व-आग्नेय"),
  SSE: L("South-southeast", "दक्षिण-आग्नेय"),
  SSW: L("South-southwest", "दक्षिण-नैऋत्य"),
  WSW: L("West-southwest", "पश्चिम-नैऋत्य"),
  WNW: L("West-northwest", "पश्चिम-वायव्य"),
  NNW: L("North-northwest", "उत्तर-वायव्य"),
};

const ELEMENT: Record<string, L10n> = {
  water: L("Water", "जल"),
  fire: L("Fire", "अग्नि"),
  earth: L("Earth", "पृथ्वी"),
  air: L("Air", "वायु"),
  space: L("Space", "आकाश"),
};

const FACING: Record<string, L10n> = {
  N: L("North-facing", "उत्तरमुखी"),
  E: L("East-facing", "पूर्वमुखी"),
  S: L("South-facing", "दक्षिणमुखी"),
  W: L("West-facing", "पश्चिममुखी"),
};

export function directionName(id: string, locale: Locale = current): string {
  return DIR[id] ? lt(DIR[id], locale) : id;
}

export function facingName(side: string, locale: Locale = current): string {
  return FACING[side] ? lt(FACING[side], locale) : side;
}

export function elementName(id: string, locale: Locale = current): string {
  return ELEMENT[id] ? lt(ELEMENT[id], locale) : id;
}

export function hasDevanagari(value: string): boolean {
  return /[\u0900-\u097F]/.test(value);
}
