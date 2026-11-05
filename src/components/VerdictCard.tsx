import type { RemedyKind } from "@/lib/types.ts";
import type { ScoredItem } from "@/lib/types.ts";
import { ELEMENTS } from "@/lib/zones.ts";
import { cn } from "@/lib/utils.ts";

const KIND_LABEL: Record<RemedyKind, string> = {
  direction: "Direction",
  color: "Color",
  furniture: "Furniture",
  mirror: "Mirror",
  element: "Element",
};

export function VerdictCard({ item, className }: { item: ScoredItem; className?: string }) {
  const element = ELEMENTS[item.element];
  return (
    <article className={cn("rounded-3xl border border-border bg-card p-4 shadow-[0_16px_40px_-28px_rgba(80,40,10,0.65)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] uppercase" style={{ color: element.color }}>
            {item.zoneLabel} · {element.label}
          </p>
          <h3 className="mt-1 font-serif text-2xl leading-none">{item.verdict.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.score}/100 · per traditional Vaastu guidelines</p>
        </div>
        <span className="rounded-full px-2 py-1 text-xs font-semibold text-white" style={{ background: element.color }}>
          {item.zoneId === "center" ? "Center" : item.zoneId}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{item.reasoning}</p>
      {item.notes.map((note) => (
        <p key={note} className="mt-2 text-sm leading-relaxed text-[#8a4e22]">
          {note}
        </p>
      ))}
      <ul className="mt-4 space-y-3">
        {item.remedies.map((remedy) => (
          <li key={remedy.id} className="rounded-2xl bg-muted px-3 py-2.5">
            <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-[#c4622d] uppercase">
              {remedy.kinds.map((kind) => KIND_LABEL[kind]).join(" · ")}
            </p>
            <p className="mt-0.5 text-sm font-medium">{remedy.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{remedy.detail}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      Readings follow traditional Vaastu guidelines. They are not a structural, medical, or financial guarantee.
      Hold the phone flat, away from steel, and confirm a doubtful room near a window.
    </p>
  );
}

export function TierMark({ tier }: { tier: "free" | "paid" }) {
  if (tier === "free") {
    return <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-secondary-foreground">Free</span>;
  }
  return (
    <span
      className="rounded-full bg-[#f8ecdc] px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-[#8a4e22]"
      title="Paid in the product plan. Unlocked in this preview — no payment is required."
    >
      Paid · unlocked
    </span>
  );
}
