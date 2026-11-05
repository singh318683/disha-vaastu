import file from "../data/checks.json" with { type: "json" };
import { normalizeDegrees } from "./angles.ts";
import {
  DIR8_LABEL,
  directionFromHeading,
  expectedSlotIds,
  isDir8,
  padaSide,
  slotFromHeading,
  type Dir8,
  type Granularity,
  type PadaSide,
} from "./bearings.ts";
import { isCheckIcon } from "./checkIcons.ts";
import { zoneById, type ZoneId } from "./zones.ts";

export type Rating = "auspicious" | "neutral" | "inauspicious";
export type CheckReference = "facing-out" | "pointing-from-center";

export interface CheckZone {
  id: string;
  name: string;
  rating: Rating;
  meaning: string;
  remedies: string[];
}

export interface VaastuCheck {
  id: string;
  title: string;
  blurb: string;
  icon: string;
  group: string;
  reference: CheckReference;
  granularity: Granularity;
  instructions: string;
  bestNote: string;
  facingNotes?: Partial<Record<PadaSide, string>>;
  resultNoun?: string;
  detailNote?: string;
  zones: CheckZone[];
}

export interface CheckCatalog {
  version: number;
  framing: string;
  convention: string;
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

function loadZone(raw: unknown, checkId: string, index: number): CheckZone {
  const zone = asRecord(raw, `${checkId} zone ${index}`);
  const id = requiredString(zone, "id", checkId);
  const name = requiredString(zone, "name", checkId);
  const rating = zone.rating;
  if (typeof rating !== "string" || !RATINGS.has(rating as Rating)) {
    throw new Error(`${checkId} zone ${id} has an unknown rating`);
  }
  const meaning = requiredString(zone, "meaning", `${checkId} ${id}`);
  if (!Array.isArray(zone.remedies)) throw new Error(`${checkId} ${id} remedies must be a list`);
  const remedies = zone.remedies.map((item, remedyIndex) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${checkId} ${id} remedy ${remedyIndex} is empty`);
    }
    return item.trim();
  });
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
      facingNotes[side] = requiredString(notes, side, `${id} facingNotes`);
    }
  }

  const detail = source.detailNote;
  const noun = source.resultNoun;
  return {
    id,
    title: requiredString(source, "title", id),
    blurb: requiredString(source, "blurb", id),
    icon,
    group: requiredString(source, "group", id),
    reference: reference as CheckReference,
    granularity,
    instructions: requiredString(source, "instructions", id),
    bestNote: requiredString(source, "bestNote", id),
    ...(facingNotes ? { facingNotes } : {}),
    ...(typeof noun === "string" && noun.trim() ? { resultNoun: noun.trim() } : {}),
    ...(typeof detail === "string" && detail.trim() ? { detailNote: detail.trim() } : {}),
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
    framing: requiredString(source, "framing", "checks file"),
    convention: requiredString(source, "convention", "checks file"),
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
  group: string;
  checks: VaastuCheck[];
}

export function checkGroups(checks: readonly VaastuCheck[] = CHECKS): CheckGroup[] {
  const order: string[] = [];
  const map = new Map<string, VaastuCheck[]>();
  for (const check of checks) {
    const list = map.get(check.group);
    if (list) list.push(check);
    else {
      map.set(check.group, [check]);
      order.push(check.group);
    }
  }
  return order.map((group) => ({ group, checks: map.get(group)! }));
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

function friendlyName(check: VaastuCheck, slotId: string, fallback: string): string {
  if (check.granularity === 16) return zoneById(slotId as ZoneId).label;
  if (check.granularity === 8 && isDir8(slotId)) return DIR8_LABEL[slotId];
  return fallback;
}

export function verdictForHeading(check: VaastuCheck, heading: number): QuizVerdict {
  const normalized = normalizeDegrees(heading);
  const slotId = slotFromHeading(normalized, check.granularity);
  const zone = zoneOf(check, slotId);
  const direction = directionFromHeading(heading);
  const directionLabel = DIR8_LABEL[direction];
  const slotName = zone.name || friendlyName(check, slotId, zone.name);

  let facingLabel = slotName;
  let placementLine = "";
  let slotLine = slotName;
  let bestNote = check.bestNote;
  let toward: string | null = null;

  if (check.granularity === 32) {
    const side = padaSide(slotId);
    facingLabel = `${DIR8_LABEL[side]}-facing`;
    placementLine = facingLabel;
    const noun = check.resultNoun;
    slotLine = noun ? `Your ${noun} is in ${slotId} · ${slotName}` : `${slotId} · ${slotName}`;
    bestNote = check.facingNotes?.[side] ?? check.bestNote;
    if (direction === "NE" || direction === "SE" || direction === "SW" || direction === "NW") {
      toward = `Toward the ${directionLabel.toLowerCase()}.`;
    }
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
    meaning: zone.meaning,
    remedies: zone.remedies,
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

export function harmonyOf(ratings: readonly Rating[]): Harmony {
  const auspicious = ratings.filter((rating) => rating === "auspicious").length;
  const neutral = ratings.filter((rating) => rating === "neutral").length;
  const inauspicious = ratings.filter((rating) => rating === "inauspicious").length;
  const total = ratings.length;
  if (total === 0) {
    return {
      title: "Home harmony",
      line: "Check a place to begin.",
      auspicious,
      neutral,
      inauspicious,
      total,
    };
  }
  if (inauspicious === 0 && auspicious >= neutral) {
    return {
      title: "A calm home",
      line: "What you checked already sits gently.",
      auspicious,
      neutral,
      inauspicious,
      total,
    };
  }
  if (inauspicious <= Math.max(1, Math.floor(total / 4))) {
    return {
      title: "Nearly there",
      line: "A few gentle fixes cover what is left.",
      auspicious,
      neutral,
      inauspicious,
      total,
    };
  }
  return {
    title: "Some care will help",
    line: "Nothing here asks you to rebuild. Small changes are enough.",
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
