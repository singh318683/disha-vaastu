import { normalizeDegrees } from "./angles.ts";
import { getLocale, lt } from "./l10n.ts";
import { UI } from "@/i18n/messages.ts";
import type { HomeScore, Property } from "./types.ts";

export function formatHeading(value: number): string {
  const rounded = Math.round(normalizeDegrees(value)) % 360;
  return `${rounded}°`;
}

export function formatDeclination(declination: number): string {
  if (Math.abs(declination) < 0.05) return "0.0°";
  const side = declination > 0 ? "E" : "W";
  return `${Math.abs(declination).toFixed(1)}° ${side}`;
}

export function formatField(nanotesla: number): string {
  return `${(nanotesla / 1000).toFixed(1)} μT`;
}

export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

export function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

export function qualityFromSensors(accuracy: number | null, stability: number | null): {
  label: string;
  tone: "good" | "fair" | "poor" | "unknown";
  detail: string;
} {
  if (accuracy != null && accuracy >= 0) {
    if (accuracy <= 15) {
      return { label: "High", tone: "good", detail: `The compass reports about ±${Math.round(accuracy)}°.` };
    }
    if (accuracy <= 30) {
      return { label: "Good", tone: "good", detail: `The compass reports about ±${Math.round(accuracy)}°.` };
    }
    if (accuracy <= 45) {
      return {
        label: "Fair",
        tone: "fair",
        detail: `About ±${Math.round(accuracy)}°. Hold the phone flat, away from metal.`,
      };
    }
    return {
      label: "Poor",
      tone: "poor",
      detail: `About ±${Math.round(accuracy)}°. Move away from steel or trace a figure-8.`,
    };
  }
  if (accuracy != null && accuracy < 0) {
    return {
      label: "Unreliable",
      tone: "poor",
      detail: "The compass marked this reading as invalid. Calibrate with a figure-8, away from metal.",
    };
  }
  if (stability != null) {
    if (stability <= 4) {
      return { label: "Steady", tone: "good", detail: "The heading is holding still. Browsers cannot read raw field strength." };
    }
    if (stability <= 10) {
      return { label: "Fair", tone: "fair", detail: "The heading is drifting a little. Give it a second, away from appliances." };
    }
    return {
      label: "Unstable",
      tone: "poor",
      detail: "The heading is jumping. Step away from metal, or take the reading near a window.",
    };
  }
  return {
    label: "No sensor",
    tone: "unknown",
    detail: "Drag the dial, or type a heading. Declination still applies once you set a location.",
  };
}

export function summaryText(property: Property, scored: HomeScore | null): string {
  const lines = [`Disha · Vaastu notes for “${property.name}”`];
  if (!scored) {
    lines.push("No rooms tagged yet.");
  } else {
    lines.push(
      `${UI.overall[getLocale()]} ${scored.score}/100 — ${lt(scored.verdict.label)}, ${UI.perGuidelines[getLocale()]}.`,
    );
    for (const room of scored.rooms) {
      const bearing = room.bearing == null ? "" : ` · ${formatHeading(room.bearing)}`;
      lines.push(`${room.name} · ${room.zoneLabel}${bearing} · ${room.score}`);
    }
  }
  lines.push(UI.notGuarantee[getLocale()]);
  return lines.join("\n");
}
