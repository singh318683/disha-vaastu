import { scoreColor } from "@/lib/scoring.ts";

export function ScoreRing({ score, size = 112 }: { score: number | null; size?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = score == null ? circumference : circumference * (1 - score / 100);
  const color = score == null ? "#c8b8a4" : scoreColor(score);
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r={radius} fill="none" stroke="#f0e4d4" strokeWidth="8" />
      <circle
        cx="56"
        cy="56"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="52" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="26" fill="#2a2118">
        {score == null ? "–" : score}
      </text>
      <text x="56" y="70" textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="9" fill="#6f5b48" letterSpacing="1.4">
        {score == null ? "" : "OF 100"}
      </text>
    </svg>
  );
}
