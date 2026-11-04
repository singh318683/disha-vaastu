import { remediesByIds, requireRule, ruleById } from "./rules.ts";
import type {
  Band,
  HomeScore,
  Placement,
  Property,
  Rule,
  ScoredItem,
  TaggedRoom,
  Verdict,
  VerdictId,
} from "./types.ts";
import { elementForZone, ELEMENTS, zonesAreNear, zoneById, type ElementId, type ZoneId } from "./zones.ts";

export const BAND_SCORE: Record<Band, number> = {
  best: 100,
  favorable: 84,
  neutral: 60,
  avoid: 28,
};

const VERDICTS: Record<VerdictId, Verdict> = {
  excellent: {
    id: "excellent",
    label: "Excellent",
    summary: "A traditional first choice.",
  },
  good: {
    id: "good",
    label: "Good",
    summary: "A favorable placement in the traditional system.",
  },
  acceptable: {
    id: "acceptable",
    label: "Acceptable",
    summary: "Workable, with a few adjustments.",
  },
  attention: {
    id: "attention",
    label: "Needs attention",
    summary: "Traditional texts would want this softened.",
  },
  unfavorable: {
    id: "unfavorable",
    label: "Unfavorable",
    summary: "Traditionally avoided. The remedies stay non-structural.",
  },
};

export function verdictForScore(score: number): Verdict {
  if (score >= 92) return VERDICTS.excellent;
  if (score >= 75) return VERDICTS.good;
  if (score >= 55) return VERDICTS.acceptable;
  if (score >= 40) return VERDICTS.attention;
  return VERDICTS.unfavorable;
}

export function scoreColor(score: number): string {
  const id = verdictForScore(score).id;
  if (id === "excellent") return "#3E7A4A";
  if (id === "good") return "#2E6F8A";
  if (id === "acceptable") return "#A37B32";
  if (id === "attention") return "#C4622D";
  return "#9D3B2F";
}

export function bandForZone(rule: Rule, zone: ZoneId): Band {
  if (rule.best.includes(zone)) return "best";
  if (rule.favorable.includes(zone)) return "favorable";
  if (rule.neutral.includes(zone)) return "neutral";
  if (rule.avoid.includes(zone)) return "avoid";
  throw new Error(`${rule.id} has no band for ${zone}`);
}

export interface ScoreInput {
  rule: Rule;
  zoneId: ZoneId | "center";
  isCenter?: boolean;
  nearToilet?: boolean;
}

export interface ScoreCore {
  band: Band;
  score: number;
  notes: string[];
  remedyIds: string[];
}

export function scoreAgainstRule(input: ScoreInput): ScoreCore {
  const { rule } = input;
  const isCenter = Boolean(input.isCenter) || input.zoneId === "center";
  const zone = input.zoneId === "center" ? null : input.zoneId;
  let band: Band = zone ? bandForZone(rule, zone) : "neutral";
  let score = zone ? BAND_SCORE[band] : 55;
  const notes: string[] = [];

  if (isCenter && rule.centerPolicy === "severe") {
    score = 12;
    band = "avoid";
    notes.push(
      "The Brahmasthan, the center of the home, is traditionally kept open. A toilet, kitchen, or staircase here is avoided.",
    );
  } else if (isCenter && rule.centerPolicy === "caution") {
    score = Math.min(score, 46);
    if (band === "best" || band === "favorable") band = "neutral";
    notes.push(
      "This sits on the center of the plan. Traditional guidance leaves that middle light — keep heavy furniture out of the middle of the room.",
    );
  }

  if (input.nearToilet && rule.id === "pooja") {
    score = Math.min(score, 42);
    band = "avoid";
    notes.push(
      "A prayer room is traditionally kept away from a toilet, including the neighboring zone or a shared wall.",
    );
  }

  let remedyIds: string[];
  if (isCenter && rule.centerPolicy === "severe") {
    remedyIds = [...rule.remedies.center, ...rule.remedies.avoid.slice(0, 2)];
  } else {
    remedyIds = [...rule.remedies[band]];
    if (isCenter) remedyIds.push(...rule.remedies.center);
  }
  if (input.nearToilet) remedyIds.push(...rule.remedies.nearToilet);

  return { band, score, notes, remedyIds };
}

const TOILET_TYPES = new Set(["toilet", "bathroom"]);

export function roomIsNearToilet(room: TaggedRoom, rooms: TaggedRoom[]): boolean {
  return rooms.some((other) => {
    if (other.id === room.id || !TOILET_TYPES.has(other.typeId)) return false;
    if (room.isCenter || other.isCenter || room.zoneId === "center" || other.zoneId === "center") {
      return true;
    }
    return zonesAreNear(room.zoneId, other.zoneId);
  });
}

function zoneLabel(zoneId: ZoneId | "center"): string {
  if (zoneId === "center") return "Brahmasthan";
  return zoneById(zoneId).label;
}

function elementOf(zoneId: ZoneId | "center"): ElementId {
  if (zoneId === "center") return "space";
  return elementForZone(zoneId).id;
}

export function displayName(
  typeId: string,
  customLabel: string | undefined,
  siblings: { id: string; typeId: string }[],
  selfId: string,
): string {
  if (customLabel?.trim()) return customLabel.trim();
  const rule = ruleById(typeId);
  const label = rule?.label ?? typeId;
  const same = siblings.filter((item) => item.typeId === typeId);
  if (same.length < 2) return label;
  const index = same.findIndex((item) => item.id === selfId) + 1;
  return `${label} ${index}`;
}

function toScored(
  id: string,
  typeId: string,
  name: string,
  zoneId: ZoneId | "center",
  bearing: number | null,
  isCenter: boolean,
  declinationApplied: boolean,
  nearToilet: boolean,
  source?: "point" | "plan",
): ScoredItem {
  const rule = requireRule(typeId);
  const core = scoreAgainstRule({ rule, zoneId, isCenter, nearToilet });
  return {
    id,
    typeId,
    name,
    kind: rule.kind,
    zoneId,
    zoneLabel: zoneLabel(zoneId),
    element: elementOf(zoneId),
    bearing,
    band: core.band,
    score: core.score,
    verdict: verdictForScore(core.score),
    reasoning: rule.reasoning,
    notes: core.notes,
    remedies: remediesByIds(core.remedyIds),
    weight: rule.weight,
    isCenter,
    declinationApplied,
    source,
  };
}

export function scoreRoom(room: TaggedRoom, rooms: TaggedRoom[]): ScoredItem {
  return toScored(
    room.id,
    room.typeId,
    displayName(room.typeId, room.label, rooms, room.id),
    room.zoneId,
    room.trueBearing,
    room.isCenter,
    room.declinationApplied,
    roomIsNearToilet(room, rooms),
    room.source,
  );
}

export function scorePlacement(placement: Placement, all: Placement[]): ScoredItem {
  return toScored(
    placement.id,
    placement.typeId,
    displayName(placement.typeId, placement.label, all, placement.id),
    placement.zoneId,
    placement.trueBearing,
    false,
    placement.declinationApplied,
    false,
  );
}

export function scoreProperty(property: Pick<Property, "rooms" | "placements">): HomeScore | null {
  const rooms = property.rooms.map((room) => scoreRoom(room, property.rooms));
  const placements = property.placements.map((placement) => scorePlacement(placement, property.placements));
  if (rooms.length === 0) return null;
  const weight = rooms.reduce((sum, room) => sum + room.weight, 0);
  const total = rooms.reduce((sum, room) => sum + room.score * room.weight, 0);
  const score = Math.round(total / weight);
  return {
    score,
    verdict: verdictForScore(score),
    rooms,
    placements,
    issueCount: rooms.filter((room) => room.score < 55).length,
  };
}

export function elementSoft(id: ElementId): string {
  return ELEMENTS[id].soft;
}
