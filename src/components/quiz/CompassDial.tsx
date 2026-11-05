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
    <div className="mx-auto w-full max-w-[18rem]">
      <svg
        ref={ref}
        viewBox="0 0 200 200"
        role="img"
        aria-label={interactive ? `Direction dial, currently ${label}. Drag to turn it.` : `Compass showing ${label}.`}
        tabIndex={interactive ? 0 : undefined}
        className={interactive ? "touch-none cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}
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
        <circle cx="100" cy="100" r="90" fill="#fffdf8" stroke="#e4d5c2" strokeWidth="3" />
        <circle cx="100" cy="100" r="74" fill="none" stroke="#f3e6d4" strokeWidth="10" />
        <g transform={`rotate(${-heading} 100 100)`}>
          {Array.from({ length: 32 }, (_, index) => {
            const angle = index * 11.25;
            const major = index % 8 === 0;
            const rad = ((angle - 90) * Math.PI) / 180;
            const inner = major ? 62 : 68;
            const outer = 78;
            return (
              <line
                key={angle}
                x1={100 + inner * Math.cos(rad)}
                y1={100 + inner * Math.sin(rad)}
                x2={100 + outer * Math.cos(rad)}
                y2={100 + outer * Math.sin(rad)}
                stroke={major ? "#c4622d" : "#e4d5c2"}
                strokeWidth={major ? 2.4 : 1.4}
                strokeLinecap="round"
              />
            );
          })}
          <text x="100" y="54" textAnchor="middle" fill="#c4622d" fontSize="16" fontFamily="Georgia, serif">
            N
          </text>
          <text x="158" y="105" textAnchor="middle" fill="#6f5b48" fontSize="15" fontFamily="Georgia, sans-serif">
            E
          </text>
          <text x="100" y="164" textAnchor="middle" fill="#6f5b48" fontSize="15" fontFamily="Georgia, sans-serif">
            S
          </text>
          <text x="42" y="105" textAnchor="middle" fill="#6f5b48" fontSize="15" fontFamily="Georgia, sans-serif">
            W
          </text>
        </g>
        <polygon points="100,16 92,34 108,34" fill="#c4622d" />
        <circle cx="100" cy="100" r="5" fill="#2a2118" />
      </svg>
      <p className="mt-2 text-center font-serif text-4xl leading-none text-foreground">{label}</p>
    </div>
  );
}
