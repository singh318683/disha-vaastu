import { useEffect, useState } from "react";

export function ScoreRing({
  score,
  size = 48,
  animate = false,
  caption,
}: {
  score: number | null;
  size?: number;
  animate?: boolean;
  caption?: string;
}) {
  const radius = (size - 8) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(animate ? 0 : (score ?? 0));

  useEffect(() => {
    if (!animate) {
      setShown(score ?? 0);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShown(score ?? 0));
    return () => window.cancelAnimationFrame(frame);
  }, [animate, score]);

  const offset = circumference * (1 - Math.min(100, Math.max(0, shown)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={caption ?? (score == null ? "No score yet" : `Score ${score}`)}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#3a4574" strokeWidth="4" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#e4c36a"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 700ms ease" }}
      />
      <text
        x={center}
        y={center + size * 0.06}
        textAnchor="middle"
        fill="#f6e7b2"
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontSize={size * 0.34}
        fontWeight="600"
      >
        {score == null ? "–" : score}
      </text>
    </svg>
  );
}
