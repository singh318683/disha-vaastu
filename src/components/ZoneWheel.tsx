import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { normalizeDegrees } from "@/lib/angles.ts";
import { formatHeading } from "@/lib/format.ts";
import { ELEMENTS, ZONES, zoneFromBearing, type ElementId } from "@/lib/zones.ts";
import { cn } from "@/lib/utils.ts";

const CX = 180;
const CY = 180;

function polar(radius: number, bearing: number): [number, number] {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function wedge(inner: number, outer: number, start: number, end: number): string {
  const [x0, y0] = polar(outer, start);
  const [x1, y1] = polar(outer, end);
  const [x2, y2] = polar(inner, end);
  const [x3, y3] = polar(inner, start);
  return `M ${x0} ${y0} A ${outer} ${outer} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 0 0 ${x3} ${y3} Z`;
}

export interface WheelMarker {
  id: string;
  bearing: number;
  label: string;
  color: string;
}

interface ZoneWheelProps {
  heading: number;
  interactive?: boolean;
  onHeading?: (heading: number) => void;
  markers?: WheelMarker[];
  northUp?: boolean;
  caption?: { title: string; subtitle: string };
  className?: string;
  basisNote?: string;
}

export function ZoneWheel({
  heading,
  interactive = false,
  onHeading,
  markers = [],
  northUp = false,
  caption,
  className,
  basisNote,
}: ZoneWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startAngle: number; startHeading: number } | null>(null);
  const rotation = northUp ? 0 : heading;
  const zone = zoneFromBearing(heading);
  const element = ELEMENTS[zone.element];

  function pointerAngle(event: { clientX: number; clientY: number }) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || !onHeading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startAngle: pointerAngle(event), startHeading: heading };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || !onHeading) return;
    let delta = pointerAngle(event) - drag.current.startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    onHeading(normalizeDegrees(drag.current.startHeading - delta));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  const title = caption?.title ?? formatHeading(heading);
  const subtitle = caption?.subtitle ?? zone.label;

  return (
    <div className={cn("mx-auto w-full max-w-[420px]", className)}>
      <div
        ref={ref}
        role={interactive ? "slider" : "img"}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? `Manual true heading ${formatHeading(heading)}, ${zone.label}. Drag or use the arrow keys.`
            : `Facing ${zone.label}, ${formatHeading(heading)}`
        }
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 359 : undefined}
        aria-valuenow={interactive ? Math.round(normalizeDegrees(heading)) : undefined}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (!interactive || !onHeading) return;
          if (event.key === "ArrowRight") onHeading(normalizeDegrees(heading + 5));
          if (event.key === "ArrowLeft") onHeading(normalizeDegrees(heading - 5));
        }}
        className={cn(
          "relative aspect-square w-full touch-none rounded-full",
          interactive && "cursor-grab active:cursor-grabbing",
        )}
      >
        <svg viewBox="0 0 360 360" className="h-full w-full drop-shadow-[0_18px_30px_rgba(90,50,20,0.16)]">
          <circle cx={CX} cy={CY} r="176" fill="#fffaf3" />
          <circle cx={CX} cy={CY} r="170" fill="none" stroke="#e7d7c3" strokeWidth="8" />
          <g style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: "180px 180px" }}>
            {ZONES.map((slice) => (
              <path
                key={slice.id}
                d={wedge(78, 158, slice.center - 11.25, slice.center + 11.25)}
                fill={ELEMENTS[slice.element].color}
                stroke="#fffaf3"
                strokeWidth="1.4"
              />
            ))}
            {markers.map((marker) => {
              const [x, y] = polar(118, marker.bearing);
              return (
                <g key={marker.id}>
                  <circle cx={x} cy={y} r="7" fill={marker.color} stroke="#fffaf3" strokeWidth="2" />
                </g>
              );
            })}
          </g>
          {ZONES.map((slice) => {
            const screen = normalizeDegrees(slice.center - rotation);
            const [x, y] = polar(slice.short.length > 2 ? 116 : 118, screen);
            const cardinal = slice.short.length <= 2;
            return (
              <text
                key={`${slice.id}-label`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={cardinal ? "#fffaf3" : "rgba(255,250,243,0.82)"}
                fontSize={cardinal ? 13 : 8}
                fontFamily="Outfit, sans-serif"
                fontWeight={cardinal ? 600 : 500}
              >
                {slice.short}
              </text>
            );
          })}
          <circle cx={CX} cy={CY} r="70" fill="#f6edd8" stroke="#d7b56a" strokeWidth="2" />
          <polygon points="180,8 188,22 172,22" fill="#c4622d" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="font-serif text-[clamp(1.6rem,7vw,2.4rem)] leading-none text-[#2a2118]">{title}</p>
            <p className="mt-1 text-sm font-medium text-[#6f5b48]">{subtitle}</p>
            <p className="mt-1 text-[0.68rem] tracking-[0.14em] uppercase" style={{ color: element.color }}>
              {element.label}
              {basisNote ? ` · ${basisNote}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ElementLegend({ className }: { className?: string }) {
  const items: { id: ElementId; note: string }[] = [
    { id: "water", note: "N & NE" },
    { id: "fire", note: "E & SE" },
    { id: "earth", note: "S & SW" },
    { id: "air", note: "W & NW" },
    { id: "space", note: "Center" },
  ];
  return (
    <ul className={cn("grid grid-cols-5 gap-1 text-center", className)}>
      {items.map((item) => {
        const element = ELEMENTS[item.id];
        return (
          <li key={item.id} className="rounded-2xl bg-card/80 px-1 py-2">
            <span className="mx-auto mb-1 block h-2 w-2 rounded-full" style={{ background: element.color }} />
            <p className="text-[0.68rem] font-semibold">{element.label}</p>
            <p className="text-[0.62rem] text-muted-foreground">{item.note}</p>
          </li>
        );
      })}
    </ul>
  );
}
