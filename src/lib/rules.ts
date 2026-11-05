import remediesFile from "../data/remedies.json" with { type: "json" };
import rulesFile from "../data/rules.json" with { type: "json" };
import type { Band, CenterPolicy, Remedy, RemedyKind, RemedyMap, Rule } from "./types.ts";
import { isZoneId, ZONES, type ZoneId } from "./zones.ts";

const KIND_SET = new Set<RemedyKind>(["direction", "color", "furniture", "mirror", "element"]);
const POLICIES = new Set<CenterPolicy>(["severe", "caution", "ok"]);
const BANDS: Band[] = ["best", "favorable", "neutral", "avoid"];

function zoneList(id: string, values: readonly string[], field: string): ZoneId[] {
  return values.map((value) => {
    if (!isZoneId(value)) {
      throw new Error(`${id}.${field} has unknown zone ${value}`);
    }
    return value;
  });
}

function remedyMap(id: string, raw: RemedyMap): RemedyMap {
  const map = {} as RemedyMap;
  for (const key of [...BANDS, "center", "nearToilet"] as const) {
    const list = raw[key];
    if (!Array.isArray(list)) throw new Error(`${id} remedies are missing ${key}`);
    map[key] = [...list];
  }
  return map;
}

function normalize(
  raw: (typeof rulesFile.rooms)[number],
  kind: Rule["kind"],
): Rule {
  if (!POLICIES.has(raw.centerPolicy as CenterPolicy)) {
    throw new Error(`${raw.id} has an unknown center policy`);
  }
  const rule: Rule = {
    id: raw.id,
    label: raw.label,
    weight: raw.weight,
    centerPolicy: raw.centerPolicy as CenterPolicy,
    kind,
    prompt: "prompt" in raw && typeof raw.prompt === "string" ? raw.prompt : undefined,
    best: zoneList(raw.id, raw.best, "best"),
    favorable: zoneList(raw.id, raw.favorable, "favorable"),
    neutral: zoneList(raw.id, raw.neutral, "neutral"),
    avoid: zoneList(raw.id, raw.avoid, "avoid"),
    reasoning: raw.reasoning,
    remedies: remedyMap(raw.id, raw.remedies as RemedyMap),
  };
  assertPartition(rule);
  return rule;
}

export function assertPartition(rule: Pick<Rule, "id" | "best" | "favorable" | "neutral" | "avoid">): void {
  const all = [...rule.best, ...rule.favorable, ...rule.neutral, ...rule.avoid];
  if (all.length !== ZONES.length || new Set(all).size !== ZONES.length) {
    throw new Error(`${rule.id} must list each of the 16 zones exactly once`);
  }
  for (const zone of ZONES) {
    if (!all.includes(zone.id)) throw new Error(`${rule.id} is missing ${zone.id}`);
  }
}

function loadRemedies(): Map<string, Remedy> {
  const map = new Map<string, Remedy>();
  for (const item of remediesFile.items) {
    if (map.has(item.id)) throw new Error(`Duplicate remedy ${item.id}`);
    const kinds = item.kinds.filter((kind): kind is RemedyKind => KIND_SET.has(kind as RemedyKind));
    if (kinds.length !== item.kinds.length || kinds.length === 0) {
      throw new Error(`Remedy ${item.id} has an unknown kind`);
    }
    if (!item.title.trim() || !item.detail.trim()) {
      throw new Error(`Remedy ${item.id} needs a title and a detail`);
    }
    map.set(item.id, { id: item.id, title: item.title, detail: item.detail, kinds });
  }
  return map;
}

export const REMEDIES = loadRemedies();

export const ROOM_RULES = rulesFile.rooms.map((rule) => normalize(rule, "room"));
export const ORIENTATION_RULES = rulesFile.orientations.map((rule) => normalize(rule, "orientation"));
export const ALL_RULES = [...ROOM_RULES, ...ORIENTATION_RULES];

const RULE_BY_ID = new Map(ALL_RULES.map((rule) => [rule.id, rule]));

export function ruleById(id: string): Rule | undefined {
  return RULE_BY_ID.get(id);
}

export function requireRule(id: string): Rule {
  const rule = RULE_BY_ID.get(id);
  if (!rule) throw new Error(`Unknown room or placement ${id}`);
  return rule;
}

export function remediesByIds(ids: string[]): Remedy[] {
  const seen = new Set<string>();
  const result: Remedy[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const remedy = REMEDIES.get(id);
    if (!remedy) throw new Error(`Missing remedy ${id}`);
    seen.add(id);
    result.push(remedy);
  }
  return result;
}

export const DEFAULT_ROOM_PROMPT =
  "Stand near the center of the home and point the top of the phone toward this room.";

export function promptFor(rule: Rule): string {
  return rule.prompt ?? DEFAULT_ROOM_PROMPT;
}
