import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { ScoreRing } from "@/components/ScoreRing.tsx";
import { TierMark } from "@/components/VerdictCard.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { formatWhen } from "@/lib/format.ts";
import { scoreProperty } from "@/lib/scoring.ts";
import { useProperties } from "@/state/properties.tsx";

export function HomesView({ onOpen }: { onOpen: (view: "scan" | "report") => void }) {
  const homes = useProperties();
  const { u } = useI18n();
  const [compare, setCompare] = useState(false);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const rows = homes.properties.map((property) => ({ property, scored: scoreProperty(property) }));
  const ordered = compare
    ? [...rows].sort((a, b) => (b.scored?.score ?? -1) - (a.scored?.score ?? -1))
    : rows;

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Saved on this device</p>
          <h1 className="mt-1 text-[2rem] leading-none">Homes</h1>
        </div>
        <TierMark tier="paid" />
      </header>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Keep more than one place — useful while you are looking at apartments. House-hunting ranks them by the same traditional score. Nothing is uploaded.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-3xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">House-hunting</p>
          <p className="text-xs text-muted-foreground">Rank the saved homes. A higher score is closer to the guidelines, not a promise.</p>
        </div>
        <Switch checked={compare} onCheckedChange={setCompare} aria-label="House-hunting mode" />
      </div>

      {homes.storageError && <p className="mt-3 text-sm text-destructive">{u("storageFull")}</p>}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          homes.createProperty(name);
          setName("");
          onOpen("scan");
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New home name" />
        <Button type="submit">Add</Button>
      </form>
      <Button
        variant="secondary"
        className="mt-2 w-full"
        onClick={() => {
          homes.loadSample();
          onOpen("report");
        }}
      >
        Load the sample apartment
      </Button>

      <ul className="mt-4 space-y-3">
        {ordered.map(({ property, scored }, index) => (
          <li key={property.id} className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <ScoreRing score={scored?.score ?? null} size={76} />
              <div className="min-w-0 flex-1">
                {compare && <p className="eyebrow">Rank {index + 1}</p>}
                <input
                  aria-label={`Name of ${property.name}`}
                  value={property.name}
                  onChange={(event) =>
                    homes.updateProperty(property.id, (current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full bg-transparent font-serif text-xl outline-none"
                />
                <p className="text-xs text-muted-foreground">
                  {property.rooms.length} rooms · {formatWhen(property.updatedAt)}
                  {scored ? ` · ${scored.issueCount} to look at` : ""}
                </p>
                {scored && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${scored.score}%` }} />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  homes.setActiveId(property.id);
                  onOpen(property.rooms.length ? "report" : "scan");
                }}
              >
                {property.rooms.length ? "Open report" : "Continue scan"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(property.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
        {ordered.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No homes yet. Add one before a viewing, or open the sample to see a finished report.
          </li>
        )}
      </ul>

      <Dialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this home?</DialogTitle>
            <DialogDescription>It is only stored on this device. Deleting it cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) homes.deleteProperty(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
