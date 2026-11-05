import { jsPDF } from "jspdf";
import { formatDeclination, formatHeading, summaryText } from "./format.ts";
import { elementName, getLocale, hasDevanagari, lt, type L10n } from "./l10n.ts";
import { UI } from "@/i18n/messages.ts";
import { embedDevanagari } from "./harmonyExport.ts";
import { scoreColor } from "./scoring.ts";
import type { HomeScore, Property, ScoredItem } from "./types.ts";
import { ELEMENTS, ZONES } from "./zones.ts";

const INK: [number, number, number] = [42, 33, 24];
const CLAY: [number, number, number] = [111, 91, 72];
const CREAM: [number, number, number] = [255, 252, 247];
const SAFFRON: [number, number, number] = [196, 98, 45];

function plain(value: string | L10n): string {
  return typeof value === "string" ? value : lt(value, getLocale());
}

function say(
  doc: jsPDF,
  value: string | L10n | Array<string | L10n>,
  x: number,
  y: number,
  options?: { align?: "left" | "center" | "right" },
) {
  const lines = (Array.isArray(value) ? value : [value]).map(plain);
  const text = lines.join("\n");
  if (!hasDevanagari(text) || typeof document === "undefined") {
    doc.text(lines.length === 1 ? lines[0]! : lines, x, y, options);
    return;
  }
  const size = doc.getFontSize();
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) {
    doc.text(text, x, y, options);
    return;
  }
  const font = `${size}px "Noto Sans Devanagari", sans-serif`;
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + 8;
  const height = Math.ceil(size * 1.45 * lines.length) + 4;
  const scale = 2;
  canvas.width = Math.max(2, width * scale);
  canvas.height = Math.max(2, height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = "#2a2118";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => ctx.fillText(line, 0, index * size * 1.35));
  let drawX = x;
  if (options?.align === "right") drawX = x - width;
  if (options?.align === "center") drawX = x - width / 2;
  doc.addImage(canvas.toDataURL("image/png"), "PNG", drawX, y - size * 0.85, width, height);
}

function splitPlain(doc: jsPDF, value: string | L10n, width: number): string[] {
  return doc.splitTextToSize(plain(value), width) as string[];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function polar(cx: number, cy: number, radius: number, bearing: number): [number, number] {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

function drawWheel(ctx: CanvasRenderingContext2D, size: number, rooms: ScoredItem[]) {
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = "#f6f0e6";
  ctx.fillRect(0, 0, size, size);
  const outer = size * 0.46;
  const inner = size * 0.18;

  for (const zone of ZONES) {
    const start = ((zone.center - 11.25 - 90) * Math.PI) / 180;
    const end = ((zone.center + 11.25 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, start, end);
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = ELEMENTS[zone.element].color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    const [lx, ly] = polar(cx, cy, (outer + inner) / 2, zone.center);
    ctx.fillStyle = "#fffaf3";
    ctx.font = `${zone.short.length > 2 ? size * 0.028 : size * 0.04}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(zone.short, lx, ly);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, inner - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#f6edd8";
  ctx.fill();
  ctx.fillStyle = "#8a6239";
  ctx.font = `${size * 0.032}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("North", cx, cy - 4);
  ctx.font = `${size * 0.022}px sans-serif`;
  ctx.fillText("up", cx, cy + size * 0.03);

  for (const room of rooms) {
    if (room.bearing == null || room.zoneId === "center") continue;
    const [x, y] = polar(cx, cy, outer * 0.78, room.bearing);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.018, 0, Math.PI * 2);
    ctx.fillStyle = scoreColor(room.score);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fffaf3";
    ctx.stroke();
  }
}

function drawPlan(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  property: Property,
  rooms: ScoredItem[],
) {
  const size = ctx.canvas.width;
  ctx.fillStyle = "#f6f0e6";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / image.width, size / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  ctx.drawImage(image, ox, oy, w, h);
  const plan = property.plan;
  if (!plan) return;
  const cx = ox + plan.center.x * w;
  const cy = oy + plan.center.y * h;
  const radius = Math.hypot(w, h);
  ctx.lineWidth = 1;
  for (const zone of ZONES) {
    const a0 = ((zone.center - 11.25 - plan.northBearingOfImageUp - 90) * Math.PI) / 180;
    const a1 = ((zone.center + 11.25 - plan.northBearingOfImageUp - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = ELEMENTS[zone.element].color;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#b8893d";
  ctx.fill();
  for (const room of rooms) {
    const source = property.rooms.find((item) => item.id === room.id);
    if (!source?.point) continue;
    const x = ox + source.point.x * w;
    const y = oy + source.point.y * h;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = scoreColor(room.score);
    ctx.fill();
  }
}

async function diagramDataUrl(property: Property, scored: HomeScore): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  if (!property.plan) {
    drawWheel(ctx, 800, scored.rooms);
    return canvas.toDataURL("image/jpeg", 0.86);
  }
  try {
    const image = await loadImage(property.plan.image);
    drawPlan(ctx, image, property, scored.rooms);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    drawWheel(ctx, 800, scored.rooms);
    return canvas.toDataURL("image/jpeg", 0.86);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw the floor plan."));
    image.src = src;
  });
}

export async function buildReportPdf(property: Property, scored: HomeScore): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.load) {
    await document.fonts.load('16px "Noto Sans Devanagari"');
  }
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await embedDevanagari(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const width = pageWidth - margin * 2;
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setFont("times", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...CLAY);
      say(doc, UI.pdfFooter[getLocale()], margin, pageHeight - 24);
      say(doc, `${page} / ${pages}`, pageWidth - margin, pageHeight - 24, { align: "right" });
    }
  };

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const ensure = (height: number) => {
    if (y + height > pageHeight - 42) newPage();
  };

  doc.setFillColor(...SAFFRON);
  doc.rect(0, 0, pageWidth, 78, "F");
  doc.setTextColor(...CREAM);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  say(doc, "Disha", margin, 36);
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  say(doc, UI.perGuidelines[getLocale()], margin, 56);
  y = 102;

  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  const title = doc.splitTextToSize(property.name, width) as string[];
  say(doc, title, margin, y);
  y += title.length * 22 + 4;

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...SAFFRON);
  say(doc, `${scored.score} / 100 · ${plain(scored.verdict.label)}`, margin, y);
  y += 16;
  doc.setTextColor(...CLAY);
  say(doc, scored.verdict.summary, margin, y);
  y += 18;

  const meta: string[] = [];
  if (property.placeLabel) meta.push(property.placeLabel);
  if (property.latitude != null && property.longitude != null) {
    meta.push(`${property.latitude.toFixed(2)}, ${property.longitude.toFixed(2)}`);
  }
  if (property.declination != null) {
    meta.push(`Declination ${formatDeclination(property.declination)}${property.declinationModel ? ` · ${property.declinationModel}` : ""}`);
  }
  meta.push(new Date(property.updatedAt).toLocaleDateString());
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metaLines = doc.splitTextToSize(meta.join("  ·  "), width) as string[];
  say(doc, metaLines, margin, y);
  y += metaLines.length * 12 + 10;

  const image = await diagramDataUrl(property, scored);
  if (image) {
    ensure(230);
    doc.addImage(image, "JPEG", margin, y, 210, 210);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CLAY);
    const caption = property.plan
      ? "Floor plan with the 16 zones. Color on each dot follows that room’s score."
      : "True north is up. Each dot is a room you tagged from the center.";
    const captionLines = doc.splitTextToSize(caption, width - 224) as string[];
    say(doc, captionLines, margin + 224, y + 18);
    let legendY = y + 18 + captionLines.length * 12 + 8;
    for (const element of [ELEMENTS.water, ELEMENTS.fire, ELEMENTS.earth, ELEMENTS.air, ELEMENTS.space]) {
      const rgb = hexToRgb(element.color);
      doc.setFillColor(...rgb);
      doc.circle(margin + 228, legendY - 3, 4, "F");
      doc.setTextColor(...INK);
      say(doc, `${elementName(element.id)} · ${element.zones}`, margin + 238, legendY);
      legendY += 14;
    }
    y += 224;
  }

  const writeItem = (item: ScoredItem) => {
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    const reasoning = splitPlain(doc, item.reasoning, width);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const notes = item.notes.flatMap((note) => splitPlain(doc, note, width));
    const remedyHeight = item.remedies.reduce((sum, remedy) => {
      const lines = splitPlain(doc, `${plain(remedy.title)}. ${plain(remedy.detail)}`, width - 12);
      return sum + lines.length * 11 + 8;
    }, 0);
    ensure(36 + reasoning.length * 12 + notes.length * 12 + remedyHeight);
    doc.setFillColor(...hexToRgb(scoreColor(item.score)));
    doc.rect(margin, y - 9, 4, 16, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    const bearing = item.bearing == null ? "" : ` · ${formatHeading(item.bearing)}`;
    say(doc, `${item.name}`, margin + 12, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CLAY);
    say(doc, `${item.zoneLabel}${bearing} · ${item.score}/100 · ${plain(item.verdict.label)}`, margin + 12, y + 14);
    y += 28;
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    say(doc, reasoning, margin, y);
    y += reasoning.length * 12 + 4;
    if (notes.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SAFFRON);
      say(doc, notes, margin, y);
      y += notes.length * 12 + 4;
    }
    for (const remedy of item.remedies) {
      const kind = remedy.kinds.map(kindLabel).join(" · ");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...SAFFRON);
      say(doc, kind, margin, y);
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      const lines = splitPlain(doc, `${plain(remedy.title)}. ${plain(remedy.detail)}`, width);
      say(doc, lines, margin, y);
      y += lines.length * 11 + 6;
    }
    if (!item.declinationApplied) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...CLAY);
      say(doc, "Tagged before declination was applied, so this zone is magnetic rather than true.", margin, y);
      y += 12;
    }
    y += 8;
  };

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  ensure(30);
  say(doc, UI.rooms[getLocale()], margin, y);
  y += 20;
  for (const item of scored.rooms) writeItem(item);

  if (scored.placements.length) {
    ensure(30);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    say(doc, UI.deskAndBed[getLocale()], margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CLAY);
    say(doc, UI.directionNotes[getLocale()], margin, y + 10);
    y += 24;
    for (const item of scored.placements) writeItem(item);
  }

  ensure(48);
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...CLAY);
  const closing = doc.splitTextToSize(
    "Hold the phone flat, away from steel and speakers. In a steel-frame building, take a reading near a window and align the plan to it. Results follow traditional Vaastu guidelines.",
    width,
  ) as string[];
  say(doc, closing, margin, y);

  footer();
  return doc.output("blob");
}

function kindLabel(kind: string): string {
  if (kind === "direction") return "Direction";
  if (kind === "color") return "Color";
  if (kind === "furniture") return "Furniture";
  if (kind === "mirror") return "Mirror";
  if (kind === "element") return "Element";
  return kind;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "home";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareReport(property: Property, scored: HomeScore | null, blob: Blob): Promise<"shared" | "downloaded" | "aborted"> {
  const filename = `disha-${slugify(property.name)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const text = summaryText(property, scored);
  const title = `Disha · ${property.name}`;
  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return "shared";
      }
      await navigator.share({ title, text });
      downloadBlob(blob, filename);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
