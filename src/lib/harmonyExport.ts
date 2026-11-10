import { jsPDF } from "jspdf";
import type { Rating } from "./checks.ts";

export interface HarmonyCardRow {
  title: string;
  placement: string;
  rating: Rating;
}

export interface HarmonyCardInput {
  title: string;
  line: string;
  framing: string;
  auspicious: number;
  neutral: number;
  inauspicious: number;
  rows: HarmonyCardRow[];
}

const INK = "#f7f1e4";
const CLAY = "#c9c2d8";
const CREAM = "#161d3a";
const PAPER = "#0b1024";
const SAFFRON = "#e4c36a";

const RATING_COLOR: Record<Rating, string> = {
  auspicious: "#9be7c0",
  neutral: "#f0d78c",
  inauspicious: "#f3b4a6",
};

const RATING_WORD: Record<Rating, string> = {
  auspicious: "Auspicious",
  neutral: "Neutral",
  inauspicious: "Inauspicious",
};

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderHarmonyCanvas(input: HarmonyCardInput): HTMLCanvasElement {
  const width = 800;
  const pad = 56;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the card.");
  const hindi = /[\u0900-\u097F]/.test(`${input.title}${input.line}${input.framing}`);
  const face = hindi ? '"Noto Sans Devanagari", sans-serif' : "Outfit, sans-serif";
  const display = hindi ? '"Noto Sans Devanagari", Georgia, serif' : "Fraunces, Georgia, serif";
  const countLabels = hindi ? ["शुभ", "सामान्य", "संभालें"] : ["Auspicious", "Neutral", "To soften"];
  const ratingWord = hindi
    ? { auspicious: "शुभ", neutral: "सामान्य", inauspicious: "अशुभ" }
    : RATING_WORD;

  ctx.font = `28px ${face}`;
  const bodyLines = input.rows.reduce((sum, row) => {
    return sum + wrap(ctx, `${row.title}  ·  ${row.placement}`, width - pad * 2 - 28).length;
  }, 0);
  const height = 420 + bodyLines * 36 + 80;
  canvas.height = Math.max(height, 960);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = CREAM;
  roundRect(ctx, 32, 32, width - 64, canvas.height - 64, 36);
  ctx.fill();
  ctx.strokeStyle = SAFFRON;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = SAFFRON;
  ctx.font = `600 18px ${face}`;
  ctx.fillText("DISHA", pad, 96);

  ctx.fillStyle = INK;
  ctx.font = `560 54px ${display}`;
  ctx.fillText(input.title, pad, 168);

  ctx.fillStyle = CLAY;
  ctx.font = `28px ${face}`;
  const intro = wrap(ctx, input.line, width - pad * 2);
  intro.forEach((line, index) => ctx.fillText(line, pad, 214 + index * 36));

  const countsY = 214 + intro.length * 36 + 28;
  drawCount(ctx, pad, countsY, String(input.auspicious), countLabels[0]!, RATING_COLOR.auspicious, display, face);
  drawCount(ctx, pad + 220, countsY, String(input.neutral), countLabels[1]!, RATING_COLOR.neutral, display, face);
  drawCount(ctx, pad + 440, countsY, String(input.inauspicious), countLabels[2]!, RATING_COLOR.inauspicious, display, face);

  let y = countsY + 96;
  ctx.font = `28px ${face}`;
  if (input.rows.length === 0) {
    ctx.fillStyle = CLAY;
    ctx.fillText(hindi ? "अभी कुछ नहीं देखा।" : "No places checked yet.", pad, y);
    y += 40;
  }
  for (const row of input.rows) {
    ctx.fillStyle = RATING_COLOR[row.rating];
    ctx.beginPath();
    ctx.arc(pad + 8, y - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    const lines = wrap(ctx, `${row.title}  ·  ${row.placement}`, width - pad * 2 - 28);
    for (const line of lines) {
      ctx.fillText(line, pad + 28, y);
      y += 36;
    }
    ctx.fillStyle = CLAY;
    ctx.font = `22px ${face}`;
    ctx.fillText(ratingWord[row.rating], pad + 28, y);
    ctx.font = `28px ${face}`;
    y += 42;
  }

  ctx.fillStyle = CLAY;
  ctx.font = `22px ${face}`;
  ctx.fillText(input.framing, pad, canvas.height - 72);
  return canvas;
}

function drawCount(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: string,
  label: string,
  color: string,
  display: string,
  face: string,
) {
  ctx.fillStyle = color;
  ctx.font = `560 42px ${display}`;
  ctx.fillText(value, x, y);
  ctx.font = `20px ${face}`;
  ctx.fillText(label, x, y + 28);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not save the card."));
    }, "image/png");
  });
}

export async function shareHarmonyCard(input: HarmonyCardInput): Promise<"shared" | "downloaded" | "aborted"> {
  if (typeof document !== "undefined" && document.fonts?.load) {
    await document.fonts.load('28px "Noto Sans Devanagari"');
    await document.fonts.load('54px "Noto Sans Devanagari"');
  }
  const blob = await canvasToPng(renderHarmonyCanvas(input));
  const file = new File([blob], "disha-home-harmony.png", { type: "image/png" });
  const text = `${input.title}. ${input.line} ${input.framing}`;
  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `Disha · ${input.title}`, text, files: [file] });
        return "shared";
      }
      await navigator.share({ title: `Disha · ${input.title}`, text });
      downloadHarmonyFile(blob, "disha-home-harmony.png");
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    }
  }
  downloadHarmonyFile(blob, "disha-home-harmony.png");
  return "downloaded";
}

export function downloadHarmonyFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function embedDevanagari(doc: jsPDF) {
  if (typeof fetch === "undefined") return;
  const response = await fetch("/fonts/NotoSansDevanagari-Regular.ttf");
  if (!response.ok) return;
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", btoa(binary));
  doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
  doc.setFont("NotoSansDevanagari", "normal");
}

function paintPdf(doc: jsPDF, text: string, x: number, y: number) {
  if (!/[\u0900-\u097F]/.test(text) || typeof document === "undefined") {
    doc.text(text, x, y);
    return;
  }
  const size = doc.getFontSize();
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) {
    doc.text(text, x, y);
    return;
  }
  const font = `${size}px "Noto Sans Devanagari", sans-serif`;
  measure.font = font;
  const lines = text.split("\n");
  const width = Math.ceil(Math.max(...lines.map((line) => measure.measureText(line).width))) + 8;
  const height = Math.ceil(size * 1.4 * lines.length) + 6;
  const scale = 2;
  canvas.width = Math.max(2, width * scale);
  canvas.height = Math.max(2, height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = "#101630";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => ctx.fillText(line, 0, index * size * 1.35));
  doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y - size * 0.8, width, height);
}

export async function buildQuizPdf(input: HarmonyCardInput): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.load) {
    await document.fonts.load('16px "Noto Sans Devanagari"');
    await document.fonts.load('28px "Noto Sans Devanagari"');
  }
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await embedDevanagari(doc);
  const hindi = /[\u0900-\u097F]/.test(input.title);
  const ink: [number, number, number] = [16, 22, 48];
  const clay: [number, number, number] = [92, 88, 118];
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(16, 22, 48);
  doc.rect(0, 0, pageWidth, 52, "F");
  doc.setTextColor(228, 195, 106);
  doc.setFontSize(13);
  doc.text("DISHA", 48, 32);
  let y = 84;
  doc.setTextColor(...ink);
  doc.setFontSize(28);
  paintPdf(doc, input.title, 48, y);
  y += 36;
  doc.setFontSize(12);
  doc.setTextColor(...clay);
  paintPdf(doc, input.line, 48, y);
  y += 28;
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  paintPdf(
    doc,
    hindi
      ? `${input.auspicious} शुभ   ·   ${input.neutral} सामान्य   ·   ${input.inauspicious} संभालें`
      : `${input.auspicious} auspicious   ·   ${input.neutral} neutral   ·   ${input.inauspicious} to soften`,
    48,
    y,
  );
  y += 28;
  const ratingWord = hindi
    ? { auspicious: "शुभ", neutral: "सामान्य", inauspicious: "अशुभ" }
    : RATING_WORD;
  for (const row of input.rows) {
    if (y > 760) {
      doc.addPage();
      y = 56;
    }
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    paintPdf(doc, row.title, 48, y);
    y += 20;
    doc.setFontSize(11);
    doc.setTextColor(...clay);
    const detail = `${row.placement} — ${ratingWord[row.rating]}`;
    const wrapped = doc.splitTextToSize(detail, pageWidth - 96) as string[];
    paintPdf(doc, wrapped.join("\n"), 48, y);
    y += wrapped.length * 16 + 12;
  }
  if (y > 780) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(10);
  doc.setTextColor(...clay);
  paintPdf(doc, input.framing, 48, y + 8);
  return doc.output("blob");
}
