import type { L10n } from "./l10n.ts";
import type { ElementId, ZoneId } from "./zones.ts";

export type Band = "best" | "favorable" | "neutral" | "avoid";

export type CenterPolicy = "severe" | "caution" | "ok";

export type RemedyKind = "direction" | "color" | "furniture" | "mirror" | "element";

export interface Remedy {
  id: string;
  title: L10n;
  detail: L10n;
  kinds: RemedyKind[];
}

export interface RemedyMap {
  best: string[];
  favorable: string[];
  neutral: string[];
  avoid: string[];
  center: string[];
  nearToilet: string[];
}

export interface Rule {
  id: string;
  label: L10n;
  weight: number;
  centerPolicy: CenterPolicy;
  kind: "room" | "orientation";
  prompt?: L10n;
  best: ZoneId[];
  favorable: ZoneId[];
  neutral: ZoneId[];
  avoid: ZoneId[];
  reasoning: L10n;
  remedies: RemedyMap;
}

export interface Point {
  x: number;
  y: number;
}

export interface TaggedRoom {
  id: string;
  typeId: string;
  label?: string;
  source: "point" | "plan";
  trueBearing: number | null;
  zoneId: ZoneId | "center";
  isCenter: boolean;
  declinationApplied: boolean;
  point?: Point;
}

export interface Placement {
  id: string;
  typeId: string;
  label?: string;
  trueBearing: number;
  zoneId: ZoneId;
  declinationApplied: boolean;
  createdAt: number;
}

export interface FloorPlan {
  image: string;
  /** True bearing that the top of the unrotated image points toward. 0 means north is up. */
  northBearingOfImageUp: number;
  center: Point;
  /** Natural width divided by natural height, so bearings stay true on a wide photo. */
  aspect?: number;
}

export interface Property {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  placeLabel?: string;
  latitude?: number;
  longitude?: number;
  declination?: number;
  declinationModel?: string;
  rooms: TaggedRoom[];
  placements: Placement[];
  plan?: FloorPlan;
}

export type VerdictId = "excellent" | "good" | "acceptable" | "attention" | "unfavorable";

export interface Verdict {
  id: VerdictId;
  label: L10n;
  summary: L10n;
}

export interface ScoredItem {
  id: string;
  typeId: string;
  name: string;
  kind: "room" | "orientation";
  zoneId: ZoneId | "center";
  zoneLabel: string;
  element: ElementId;
  bearing: number | null;
  band: Band;
  score: number;
  verdict: Verdict;
  reasoning: L10n;
  notes: L10n[];
  remedies: Remedy[];
  weight: number;
  isCenter: boolean;
  declinationApplied: boolean;
  source?: "point" | "plan";
}

export interface HomeScore {
  score: number;
  verdict: Verdict;
  rooms: ScoredItem[];
  placements: ScoredItem[];
  issueCount: number;
}
