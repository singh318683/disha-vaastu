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

const INK = "#2a2118";
const CLAY = "#6f5b48";
const CREAM = "#fffdf8";
const PAPER = "#f3eadc";
const SAFFRON = "#c4622d";

const RATING_COLOR: Record<Rating, string> = {
  auspicious: "#3E7A4A",
  neutral: "#A37B32",
  inauspicious: "#A15A3A",
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

  ctx.font = "28px Outfit, sans-serif";
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

  ctx.fillStyle = SAFFRON;
  ctx.font = "600 18px Outfit, sans-serif";
  ctx.fillText("DISHA", pad, 96);

  ctx.fillStyle = INK;
  ctx.font = "560 54px Fraunces, Georgia, serif";
  ctx.fillText(input.title, pad, 168);

  ctx.fillStyle = CLAY;
  ctx.font = "28px Outfit, sans-serif";
  const intro = wrap(ctx, input.line, width - pad * 2);
  intro.forEach((line, index) => ctx.fillText(line, pad, 214 + index * 36));

  const countsY = 214 + intro.length * 36 + 28;
  drawCount(ctx, pad, countsY, String(input.auspicious), "Auspicious", RATING_COLOR.auspicious);
  drawCount(ctx, pad + 220, countsY, String(input.neutral), "Neutral", RATING_COLOR.neutral);
  drawCount(ctx, pad + 440, countsY, String(input.inauspicious), "To soften", RATING_COLOR.inauspicious);

  let y = countsY + 96;
  ctx.font = "28px Outfit, sans-serif";
  if (input.rows.length === 0) {
    ctx.fillStyle = CLAY;
    ctx.fillText("No places checked yet.", pad, y);
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
    ctx.font = "22px Outfit, sans-serif";
    ctx.fillText(RATING_WORD[row.rating], pad + 28, y);
    ctx.font = "28px Outfit, sans-serif";
    y += 42;
  }

  ctx.fillStyle = CLAY;
  ctx.font = "22px Outfit, sans-serif";
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
) {
  ctx.fillStyle = color;
  ctx.font = "560 42px Fraunces, Georgia, serif";
  ctx.fillText(value, x, y);
  ctx.font = "20px Outfit, sans-serif";
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

export async function buildQuizPdf(input: HarmonyCardInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ink: [number, number, number] = [42, 33, 24];
  const clay: [number, number, number] = [111, 91, 72];
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 64;
  doc.setTextColor(...ink);
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.text(input.title, 48, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...clay);
  const intro = doc.splitTextToSize(input.line, pageWidth - 96) as string[];
  doc.text(intro, 48, y);
  y += intro.length * 16 + 18;
  doc.setTextColor(...ink);
  doc.text(
    `${input.auspicious} auspicious   ·   ${input.neutral} neutral   ·   ${input.inauspicious} to soften`,
    48,
    y,
  );
  y += 28;
  for (const row of input.rows) {
    if (y > 760) {
      doc.addPage();
      y = 56;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    doc.text(row.title, 48, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...clay);
    const detail = doc.splitTextToSize(`${row.placement} — ${RATING_WORD[row.rating]}`, pageWidth - 96) as string[];
    doc.text(detail, 48, y);
    y += detail.length * 14 + 14;
  }
  if (y > 780) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(10);
  doc.setTextColor(...clay);
  doc.text(input.framing, 48, y + 8);
  return doc.output("blob");
}
