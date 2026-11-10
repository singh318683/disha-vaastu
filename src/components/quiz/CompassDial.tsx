import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { normalizeDegrees } from "@/lib/angles.ts";

export function CompassDial({
  heading,
  label,
  interactive,
  onHeading,
}: {
  heading: number;
  label: string;
  interactive: boolean;
  onHeading?: (heading: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);

  function pointToHeading(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!svg || !onHeading) return;
    const rect = svg.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    onHeading(normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI));
  }

  return (
    <div className="mx-auto flex w-[min(100%,16rem,40dvh)] flex-col items-center">
      <svg
        ref={ref}
        viewBox="0 0 200 200"
        role="img"
        aria-label={interactive ? `Direction dial, currently ${label}. Drag to turn it.` : `Compass showing ${label}.`}
        tabIndex={interactive ? 0 : undefined}
        className={`drop-shadow-[0_0_22px_rgba(228,195,106,0.22)] ${interactive ? "touch-none cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
        onPointerDown={(event) => {
          if (!interactive) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointToHeading(event);
        }}
        onPointerMove={(event) => {
          if (!interactive || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          pointToHeading(event);
        }}
        onKeyDown={(event) => {
          if (!interactive || !onHeading) return;
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          onHeading(normalizeDegrees(heading + (event.key === "ArrowRight" ? 11.25 : -11.25)));
        }}
      >
        <defs>
          <radialGradient id="royalDial" cx="50%" cy="42%" r="68%">
            <stop offset="0%" stopColor="#2a3568" />
            <stop offset="70%" stopColor="#141b3a" />
            <stop offset="100%" stopColor="#0c1228" />
          </radialGradient>
          <linearGradient id="royalGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f6e7b2" />
            <stop offset="48%" stopColor="#e4c36a" />
            <stop offset="100%" stopColor="#a8843a" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="none" stroke="url(#royalGold)" strokeWidth="1.4" opacity="0.85" />
        <circle cx="100" cy="100" r="90" fill="url(#royalDial)" stroke="#e4c36a" strokeWidth="1.6" />
        <g transform={`rotate(${-heading} 100 100)`}>
          <g fill="none" stroke="#e4c36a" strokeWidth="0.7" opacity="0.35">
            <circle cx="100" cy="100" r="22" />
            <path d="M100 78 L104 100 L100 122 L96 100 Z" />
            <path d="M78 100 L100 96 L122 100 L100 104 Z" />
          </g>
          {Array.from({ length: 32 }, (_, index) => {
            const angle = index * 11.25;
            const major = index % 8 === 0;
            const rad = ((angle - 90) * Math.PI) / 180;
            const inner = major ? 60 : 68;
            const outer = 78;
            return (
              <line
                key={angle}
                x1={100 + inner * Math.cos(rad)}
                y1={100 + inner * Math.sin(rad)}
                x2={100 + outer * Math.cos(rad)}
                y2={100 + outer * Math.sin(rad)}
                stroke={major ? "#f0d78c" : "#6d789e"}
                strokeWidth={major ? 2.2 : 1.2}
                strokeLinecap="round"
              />
            );
          })}
          <text x="100" y="52" textAnchor="middle" fill="#f6e7b2" fontSize="16" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="600">
            N
          </text>
          <text x="158" y="105" textAnchor="middle" fill="#f7f1e4" fontSize="15" fontFamily="Cormorant Garamond, Georgia, serif">
            E
          </text>
          <text x="100" y="164" textAnchor="middle" fill="#f7f1e4" fontSize="15" fontFamily="Cormorant Garamond, Georgia, serif">
            S
          </text>
          <text x="42" y="105" textAnchor="middle" fill="#f7f1e4" fontSize="15" fontFamily="Cormorant Garamond, Georgia, serif">
            W
          </text>
        </g>
        <polygon points="100,8 94,24 100,20 106,24" fill="url(#royalGold)" />
        <circle cx="100" cy="100" r="7" fill="none" stroke="#e4c36a" strokeWidth="1.4" />
        <circle cx="100" cy="100" r="3" fill="#f6e7b2" />
      </svg>
      <p className="mt-1 text-center font-serif text-[clamp(1.6rem,6vw,2.25rem)] leading-none text-foreground">{label}</p>
    </div>
  );
}
