import type { Rating } from "@/lib/checks.ts";
import { cn } from "@/lib/utils.ts";

const FILL: Record<Rating, string> = {
  auspicious: "#1f8f62",
  neutral: "#c9962e",
  inauspicious: "#c45c48",
};

export function MoodFace({ rating, className }: { rating: Rating; className?: string }) {
  const mouth =
    rating === "auspicious" ? "M8 17.5 Q16 24 24 17.5" : rating === "neutral" ? "M9 19 H23" : "M8 21 Q16 15.5 24 21";
  return (
    <svg viewBox="0 0 32 32" className={cn("h-12 w-12", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={FILL[rating]} />
      <circle cx="11.5" cy="13" r="1.7" fill="#fffaf4" />
      <circle cx="20.5" cy="13" r="1.7" fill="#fffaf4" />
      <path d={mouth} fill="none" stroke="#fffaf4" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
