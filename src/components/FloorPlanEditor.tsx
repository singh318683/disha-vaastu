import { useEffect, useRef, useState } from "react";
import { screenAngleOfBearing } from "@/lib/geometry.ts";
import { formatHeading } from "@/lib/format.ts";
import { scoreColor } from "@/lib/scoring.ts";
import type { FloorPlan, ScoredItem } from "@/lib/types.ts";
import type { Point } from "@/lib/types.ts";
import { ELEMENTS, ZONES, zoneFromBearing } from "@/lib/zones.ts";
import { cn } from "@/lib/utils.ts";

interface FloorPlanCanvasProps {
  plan: FloorPlan;
  rooms: ScoredItem[];
  points: Record<string, Point | undefined>;
  interactive?: boolean;
  onTap?: (point: Point) => void;
  onCenter?: (point: Point) => void;
  className?: string;
}

export function FloorPlanCanvas({
  plan,
  rooms,
  points,
  interactive = false,
  onTap,
  onCenter,
  className,
}: FloorPlanCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const drag = useRef<{ pointerId: number; moved: boolean } | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [plan.image]);

  const { w, h } = box;
  const cx = plan.center.x * w;
  const cy = plan.center.y * h;
  const radius = Math.hypot(w, h);
  const north = screenAngleOfBearing(0, plan.northBearingOfImageUp);

  function localPoint(event: { clientX: number; clientY: number }): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  return (
    <div
      ref={stageRef}
      className={cn("relative overflow-hidden rounded-3xl border border-border bg-[#f7f1e6]", className)}
      onClick={(event) => {
        if (!interactive || !onTap || drag.current?.moved) return;
        if ((event.target as HTMLElement).closest("[data-marker]")) return;
        onTap(localPoint(event));
      }}
    >
      <img
        src={plan.image}
        alt="Floor plan"
        className="pointer-events-none block h-auto w-full select-none"
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          setBox({ w: image.clientWidth, h: image.clientHeight });
        }}
      />
      {w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`}>
          {ZONES.map((zone) => {
            const start = ((zone.center - 11.25 - plan.northBearingOfImageUp - 90) * Math.PI) / 180;
            const end = ((zone.center + 11.25 - plan.northBearingOfImageUp - 90) * Math.PI) / 180;
            const path = `M ${cx} ${cy} L ${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(end)} ${cy + radius * Math.sin(end)} Z`;
            return <path key={zone.id} d={path} fill={ELEMENTS[zone.element].color} opacity={0.16} />;
          })}
          <circle cx={cx} cy={cy} r={Math.max(12, 0.055 * h)} fill="#b8893d" opacity={0.18} />
          {(() => {
            const rad = ((north - 90) * Math.PI) / 180;
            const length = Math.min(w, h) * 0.18;
            const x2 = cx + length * Math.cos(rad);
            const y2 = cy + length * Math.sin(rad);
            return (
              <g>
                <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#c4622d" strokeWidth="2.5" />
                <circle cx={x2} cy={y2} r="9" fill="#c4622d" />
                <text x={x2} y={y2 + 3} textAnchor="middle" fill="#fffaf3" fontSize="10" fontFamily="Outfit, sans-serif">
                  N
                </text>
              </g>
            );
          })()}
        </svg>
      )}
      <button
        type="button"
        data-marker
        aria-label="Brahmasthan, the center. Drag to move."
        className={cn(
          "absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#b8893d] bg-[#f6edd8] shadow",
          interactive ? "cursor-grab" : "pointer-events-none",
        )}
        style={{ left: `${plan.center.x * 100}%`, top: `${plan.center.y * 100}%` }}
        onPointerDown={(event) => {
          if (!interactive || !onCenter) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, moved: false };
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId || !onCenter) return;
          drag.current.moved = true;
          onCenter(localPoint(event));
        }}
        onPointerUp={() => {
          window.setTimeout(() => {
            drag.current = null;
          }, 0);
        }}
      />
      {rooms.map((room) => {
        const point = points[room.id];
        if (!point) return null;
        return (
          <span
            key={room.id}
            data-marker
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          >
            <span
              className="mx-auto block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
              style={{ background: scoreColor(room.score) }}
            />
            <span className="mt-0.5 block max-w-24 truncate rounded-full bg-[#2a2118]/80 px-1.5 py-0.5 text-center text-[0.6rem] text-white">
              {room.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function alignmentLabel(northBearingOfImageUp: number): string {
  const zone = zoneFromBearing(northBearingOfImageUp);
  if (Math.abs(northBearingOfImageUp) < 0.5 || Math.abs(northBearingOfImageUp - 360) < 0.5) {
    return "Top of the plan is true north";
  }
  return `Top of the plan points ${formatHeading(northBearingOfImageUp)} · ${zone.label}`;
}
