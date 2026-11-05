import file from "../data/checks.json" with { type: "json" };
import { normalizeDegrees } from "./angles.ts";
import {
  directionFromHeading,
  expectedSlotIds,
  padaSide,
  slotFromHeading,
  type Dir8,
  type Granularity,
  type PadaSide,
} from "./bearings.ts";
import { isCheckIcon } from "./checkIcons.ts";
import { directionName, facingName, isL10n, lt, type L10n, type Locale } from "./l10n.ts";

export type Rating = "auspicious" | "neutral" | "inauspicious";
export type CheckReference = "facing-out" | "pointing-from-center";

export interface CheckZone {
  id: string;
  name: L10n;
  rating: Rating;
  meaning: L10n;
  remedies: L10n[];
}

export interface VaastuCheck {
  id: string;
  title: L10n;
  blurb: L10n;
  icon: string;
  group: L10n;
  reference: CheckReference;
  granularity: Granularity;
  instructions: L10n;
  bestNote: L10n;
  facingNotes?: Partial<Record<PadaSide, L10n>>;
  resultNoun?: L10n;
  detailNote?: L10n;
  zones: CheckZone[];
}

export interface CheckCatalog {
  version: number;
  framing: L10n;
  convention: L10n;
  checks: VaastuCheck[];
}

const RATINGS = new Set<Rating>(["auspicious", "neutral", "inauspicious"]);
const REFERENCES = new Set<CheckReference>(["facing-out", "pointing-from-center"]);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(source: Record<string, unknown>, key: string, label: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} needs ${key}`);
  return value.trim();
}

function loadL10n(value: unknown, label: string): L10n {
  if (!isL10n(value)) throw new Error(`${label} needs en and hi`);
  return { en: value.en.trim(), hi: value.hi.trim() };
}

function loadZone(raw: unknown, checkId: string, index: number): CheckZone {
  const zone = asRecord(raw, `${checkId} zone ${index}`);
  const id = requiredString(zone, "id", checkId);
  const name = loadL10n(zone.name, `${checkId} ${id} name`);
  const rating = zone.rating;
  if (typeof rating !== "string" || !RATINGS.has(rating as Rating)) {
    throw new Error(`${checkId} zone ${id} has an unknown rating`);
  }
  const meaning = loadL10n(zone.meaning, `${checkId} ${id} meaning`);
  if (!Array.isArray(zone.remedies)) throw new Error(`${checkId} ${id} remedies must be a list`);
  const remedies = zone.remedies.map((item, remedyIndex) => loadL10n(item, `${checkId} ${id} remedy ${remedyIndex}`));
  if (rating === "auspicious" && remedies.length > 1) {
    throw new Error(`${checkId} ${id} should keep an ideal placement, not a list of fixes`);
  }
  if (rating !== "auspicious" && (remedies.length < 2 || remedies.length > 3)) {
    throw new Error(`${checkId} ${id} needs 2 or 3 remedies`);
  }
  return { id, name, rating: rating as Rating, meaning, remedies };
}

function loadCheck(raw: unknown, index: number): VaastuCheck {
  const source = asRecord(raw, `check ${index}`);
  const id = requiredString(source, "id", `check ${index}`);
  const granularity = source.granularity;
  if (granularity !== 8 && granularity !== 16 && granularity !== 32) {
    throw new Error(`${id} has an unknown granularity`);
  }
  const reference = source.reference;
  if (typeof reference !== "string" || !REFERENCES.has(reference as CheckReference)) {
    throw new Error(`${id} has an unknown reference`);
  }
  const icon = requiredString(source, "icon", id);
  if (!isCheckIcon(icon)) throw new Error(`${id} has an unknown icon ${icon}`);
  const zonesRaw = source.zones;
  if (!Array.isArray(zonesRaw)) throw new Error(`${id} needs zones`);
  const zones = zonesRaw.map((zone, zoneIndex) => loadZone(zone, id, zoneIndex));
  const expected = expectedSlotIds(granularity);
  const got = zones.map((zone) => zone.id);
  if (got.length !== expected.length || new Set(got).size !== expected.length) {
    throw new Error(`${id} must list each of its ${granularity} zones once`);
  }
  for (const slot of expected) {
    if (!got.includes(slot)) throw new Error(`${id} is missing ${slot}`);
  }
  if (!zones.some((zone) => zone.rating === "auspicious")) {
    throw new Error(`${id} needs at least one auspicious zone`);
  }

  let facingNotes: VaastuCheck["facingNotes"];
  if (granularity === 32) {
    const notes = asRecord(source.facingNotes, `${id} facingNotes`);
    facingNotes = {};
    for (const side of ["N", "E", "S", "W"] as const) {
      facingNotes[side] = loadL10n(notes[side], `${id} facingNotes ${side}`);
    }
  }

  return {
    id,
    title: loadL10n(source.title, `${id} title`),
    blurb: loadL10n(source.blurb, `${id} blurb`),
    icon,
    group: loadL10n(source.group, `${id} group`),
    reference: reference as CheckReference,
    granularity,
    instructions: loadL10n(source.instructions, `${id} instructions`),
    bestNote: loadL10n(source.bestNote, `${id} bestNote`),
    ...(facingNotes ? { facingNotes } : {}),
    ...(source.resultNoun ? { resultNoun: loadL10n(source.resultNoun, `${id} resultNoun`) } : {}),
    ...(source.detailNote ? { detailNote: loadL10n(source.detailNote, `${id} detailNote`) } : {}),
    zones,
  };
}

function loadCatalog(raw: unknown): CheckCatalog {
  const source = asRecord(raw, "checks file");
  if (typeof source.version !== "number") throw new Error("checks file needs a version");
  if (!Array.isArray(source.checks) || source.checks.length === 0) throw new Error("checks file is empty");
  const checks = source.checks.map((item, index) => loadCheck(item, index));
  const ids = checks.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate check id");
  return {
    version: source.version,
    framing: loadL10n(source.framing, "checks file framing"),
    convention: loadL10n(source.convention, "checks file convention"),
    checks,
  };
}

export const CHECK_CATALOG = loadCatalog(file);
export const CHECKS = CHECK_CATALOG.checks;

const CHECK_BY_ID = new Map(CHECKS.map((item) => [item.id, item]));

export function checkById(id: string): VaastuCheck | undefined {
  return CHECK_BY_ID.get(id);
}

export function requireCheck(id: string): VaastuCheck {
  const check = CHECK_BY_ID.get(id);
  if (!check) throw new Error(`Unknown check ${id}`);
  return check;
}

export interface CheckGroup {
  group: L10n;
  checks: VaastuCheck[];
}

export function checkGroups(checks: readonly VaastuCheck[] = CHECKS): CheckGroup[] {
  const order: string[] = [];
  const map = new Map<string, { group: L10n; checks: VaastuCheck[] }>();
  for (const check of checks) {
    const key = check.group.en;
    const list = map.get(key);
    if (list) list.checks.push(check);
    else {
      map.set(key, { group: check.group, checks: [check] });
      order.push(key);
    }
  }
  return order.map((key) => map.get(key)!);
}

export interface QuizVerdict {
  check: VaastuCheck;
  heading: number;
  slotId: string;
  slotName: string;
  rating: Rating;
  meaning: string;
  remedies: string[];
  direction: Dir8;
  directionLabel: string;
  /** Cardinal wall for a 32-pada check, otherwise the slot's plain name. */
  facingLabel: string;
  placementLine: string;
  slotLine: string;
  bestNote: string;
  /** Set when a 32-pada heading sits on an in-between compass point. */
  toward: string | null;
}

function zoneOf(check: VaastuCheck, slotId: string): CheckZone {
  const zone = check.zones.find((item) => item.id === slotId);
  if (!zone) throw new Error(`${check.id} has no zone ${slotId}`);
  return zone;
}

export function verdictForHeading(check: VaastuCheck, heading: number, locale: Locale = "en"): QuizVerdict {
  const normalized = normalizeDegrees(heading);
  const slotId = slotFromHeading(normalized, check.granularity);
  const zone = zoneOf(check, slotId);
  const direction = directionFromHeading(heading);
  const directionLabel = directionName(direction, locale);
  const slotName = lt(zone.name, locale);

  let facingLabel = slotName;
  let placementLine = "";
  let slotLine = slotName;
  let bestNote = lt(check.bestNote, locale);
  let toward: string | null = null;

  if (check.granularity === 32) {
    const side = padaSide(slotId);
    facingLabel = facingName(side, locale);
    placementLine = facingLabel;
    const noun = check.resultNoun ? lt(check.resultNoun, locale) : "";
    slotLine = noun
      ? locale === "hi"
        ? `आपका ${noun} ${slotId} · ${slotName} में है`
        : `Your ${noun} is in ${slotId} · ${slotName}`
      : `${slotId} · ${slotName}`;
    bestNote = lt(check.facingNotes?.[side] ?? check.bestNote, locale);
    if (direction === "NE" || direction === "SE" || direction === "SW" || direction === "NW") {
      toward = locale === "hi" ? `${directionLabel} की तरफ़।` : `Toward the ${directionLabel.toLowerCase()}.`;
    }
  } else if (locale === "hi") {
    placementLine = check.reference === "facing-out" ? `${slotName} की ओर मुख` : `${slotName} की ओर`;
    facingLabel = placementLine;
    slotLine = slotName;
  } else if (check.reference === "facing-out") {
    placementLine = `Facing ${slotName.toLowerCase()}`;
    facingLabel = placementLine;
    slotLine = slotName;
  } else {
    placementLine = `Toward the ${slotName.toLowerCase()}`;
    facingLabel = placementLine;
    slotLine = slotName;
  }

  return {
    check,
    heading: normalized,
    slotId,
    slotName,
    rating: zone.rating,
    meaning: lt(zone.meaning, locale),
    remedies: zone.remedies.map((item) => lt(item, locale)),
    direction,
    directionLabel,
    facingLabel,
    placementLine,
    slotLine,
    bestNote,
    toward,
  };
}

export interface Harmony {
  title: string;
  line: string;
  auspicious: number;
  neutral: number;
  inauspicious: number;
  total: number;
}

export function harmonyOf(ratings: readonly Rating[], locale: Locale = "en"): Harmony {
  const auspicious = ratings.filter((rating) => rating === "auspicious").length;
  const neutral = ratings.filter((rating) => rating === "neutral").length;
  const inauspicious = ratings.filter((rating) => rating === "inauspicious").length;
  const total = ratings.length;
  const copy =
    total === 0
      ? { title: { en: "Home harmony", hi: "घर का संतुलन" }, line: { en: "Check a place to begin.", hi: "शुरू करने के लिए एक जगह देखें।" } }
      : inauspicious === 0 && auspicious >= neutral
        ? { title: { en: "A calm home", hi: "शांत घर" }, line: { en: "What you checked already sits gently.", hi: "जो आपने देखा, वह पहले से सहज बैठा है।" } }
        : inauspicious <= Math.max(1, Math.floor(total / 4))
          ? { title: { en: "Nearly there", hi: "लगभग ठीक" }, line: { en: "A few gentle fixes cover what is left.", hi: "बाकी के लिए कुछ हल्के उपाय काफी हैं।" } }
          : {
              title: { en: "Some care will help", hi: "थोड़ी देखभाल से बेहतर होगा" },
              line: { en: "Nothing here asks you to rebuild. Small changes are enough.", hi: "यहाँ कुछ तोड़ने को नहीं कहता। छोटे बदलाव काफी हैं।" },
            };
  return {
    title: lt(copy.title, locale),
    line: lt(copy.line, locale),
    auspicious,
    neutral,
    inauspicious,
    total,
  };
}

export const RATING_LABEL: Record<Rating, string> = {
  auspicious: "Auspicious",
  neutral: "Neutral",
  inauspicious: "Inauspicious",
};
