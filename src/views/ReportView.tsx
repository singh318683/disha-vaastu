import { Download, Share2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { useMemo, useState } from "react";
import { FloorPlanCanvas } from "@/components/FloorPlanEditor.tsx";
import { ScoreRing } from "@/components/ScoreRing.tsx";
import { Disclaimer, TierMark, VerdictCard } from "@/components/VerdictCard.tsx";
import { ElementLegend, ZoneWheel } from "@/components/ZoneWheel.tsx";
import { Button } from "@/components/ui/button.tsx";
import { formatDeclination, formatHeading } from "@/lib/format.ts";
import { scoreColor, scoreProperty } from "@/lib/scoring.ts";
import { useProperties } from "@/state/properties.tsx";

export function ReportView({ onScan }: { onScan: () => void }) {
  const homes = useProperties();
  const { locale, t, u } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const active = homes.active;
  const scored = useMemo(() => (active ? scoreProperty(active) : null), [active, locale]);
  const issues = scored?.rooms.filter((room) => room.score < 55) ?? [];

  async function exportPdf() {
    if (!active || !scored) return;
    setBusy("pdf");
    setMessage(null);
    try {
      const { buildReportPdf, downloadBlob, slugify } = await import("@/lib/pdf.ts");
      const blob = await buildReportPdf(active, scored);
      downloadBlob(blob, `disha-${slugify(active.name)}.pdf`);
      setMessage(u("pdfDownloaded"));
    } catch {
      setMessage(u("pdfBuildFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!active || !scored) return;
    setBusy("share");
    setMessage(null);
    try {
      const { buildReportPdf, shareReport } = await import("@/lib/pdf.ts");
      const blob = await buildReportPdf(active, scored);
      const result = await shareReport(active, scored, blob);
      if (result === "downloaded") setMessage("Sharing is not available here, so the PDF was downloaded.");
      if (result === "shared") setMessage("Shared.");
    } catch {
      setMessage("Could not share the report.");
    } finally {
      setBusy(null);
    }
  }

  if (!active || !scored) {
    return (
      <div className="mx-auto max-w-lg">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="eyebrow">Report</p>
            <h1 className="mt-1 text-[2rem] leading-none">Nothing to read yet</h1>
          </div>
          <TierMark tier="paid" />
        </header>
        <p className="text-sm text-muted-foreground">
          Tag the rooms of a home, or load the sample apartment, and the notes will gather here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onScan}>Start a scan</Button>
          <Button
            variant="secondary"
            onClick={() => {
              homes.loadSample();
            }}
          >
            Load sample
          </Button>
        </div>
      </div>
    );
  }

  const points = Object.fromEntries(active.rooms.map((room) => [room.id, room.point]));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Per traditional Vaastu guidelines</p>
          <h1 className="mt-1 text-[2rem] leading-none">{active.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {active.placeLabel ? `${active.placeLabel} · ` : ""}
            {active.declination != null ? `Declination ${formatDeclination(active.declination)}` : "Declination not recorded"}
            {active.declinationModel ? ` · ${active.declinationModel}` : ""}
          </p>
        </div>
        <TierMark tier="paid" />
      </header>

      {homes.properties.length > 1 && (
        <label className="mb-4 block max-w-sm">
          <span className="eyebrow">Home</span>
          <select
            value={active.id}
            onChange={(event) => homes.setActiveId(event.target.value)}
            className="mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm"
          >
            {homes.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <ScoreRing score={scored.score} />
            <div>
              <h2 className="font-serif text-3xl leading-snug">{t(scored.verdict.label)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(scored.verdict.summary)}</p>
            </div>
          </div>
          {issues.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow">Look at these first</p>
              <ul className="mt-2 space-y-1">
                {issues.map((room) => (
                  <li key={room.id} className="flex items-center justify-between text-sm">
                    <span>{room.name}</span>
                    <span className="text-muted-foreground">
                      {room.zoneLabel} · {room.score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            {active.plan ? (
              <FloorPlanCanvas plan={active.plan} rooms={scored.rooms} points={points} />
            ) : (
              <ZoneWheel
                heading={0}
                northUp
                caption={{ title: "N", subtitle: "True north up" }}
                markers={scored.rooms.flatMap((room) =>
                  room.bearing == null
                    ? []
                    : [{ id: room.id, bearing: room.bearing, label: room.name, color: scoreColor(room.score) }],
                )}
              />
            )}
          </div>
          <ElementLegend className="mt-3" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void exportPdf()} disabled={busy != null}>
              <Download className="h-4 w-4" />
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
            <Button variant="secondary" onClick={() => void share()} disabled={busy != null}>
              <Share2 className="h-4 w-4" />
              {busy === "share" ? "Preparing…" : "Share"}
            </Button>
          </div>
          {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
        </section>

        <section className="space-y-3">
          {scored.rooms.map((room) => (
            <VerdictCard key={room.id} item={room} />
          ))}
          {scored.placements.length > 0 && (
            <div>
              <h2 className="mb-2 font-serif text-2xl">Desk and bed</h2>
              <p className="mb-2 text-xs text-muted-foreground">These directions are notes. They are not part of the home score.</p>
              {scored.placements.map((item) => (
                <div key={item.id} className="mb-3">
                  <VerdictCard item={item} />
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => homes.removePlacement(active.id, item.id)}
                  >
                    Remove {item.name}
                    {item.bearing != null ? ` · ${formatHeading(item.bearing)}` : ""}
                  </button>
                </div>
              ))}
            </div>
          )}
          <Disclaimer />
        </section>
      </div>
    </div>
  );
}
