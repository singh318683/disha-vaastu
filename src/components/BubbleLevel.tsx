import { cn } from "@/lib/utils.ts";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function BubbleLevel({ beta, gamma }: { beta: number | null; gamma: number | null }) {
  const live = beta != null && gamma != null;
  const tilt = live ? Math.hypot(beta ?? 0, gamma ?? 0) : null;
  const level = tilt != null && tilt < 8;
  const x = clamp((gamma ?? 0) / 28, -1, 1);
  const y = clamp((beta ?? 0) / 28, -1, 1);

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card px-3 py-3">
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border border-[#e4d3bc] bg-[#f6efe4]">
        <span className="absolute top-1/2 left-2 right-2 h-px -translate-y-1/2 bg-[#e4d3bc]" />
        <span className="absolute top-2 bottom-2 left-1/2 w-px -translate-x-1/2 bg-[#e4d3bc]" />
        <span
          className={cn(
            "absolute h-5 w-5 rounded-full shadow-sm",
            !live && "bg-[#d9cbb8]",
            live && level && "bg-[#4f7d55]",
            live && !level && "bg-[#c4622d]",
          )}
          style={{
            left: `calc(50% + ${x * 22}px)`,
            top: `calc(50% + ${y * 22}px)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      <div>
        <p className="eyebrow">Level</p>
        <p className="font-serif text-xl leading-none">
          {!live ? "No tilt" : level ? "Flat" : `${Math.round(tilt ?? 0)}°`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {live ? "Lay the phone flat. A centered bubble is steadier." : "Tilt appears when the phone shares it."}
        </p>
      </div>
    </div>
  );
}
