import { Info, LocateFixed } from "lucide-react";
import { useState } from "react";
import { BubbleLevel } from "@/components/BubbleLevel.tsx";
import { Disclaimer, TierMark } from "@/components/VerdictCard.tsx";
import { ElementLegend, ZoneWheel } from "@/components/ZoneWheel.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { trueToMagnetic } from "@/lib/angles.ts";
import { formatCoordinates, formatDeclination, formatField, formatHeading, qualityFromSensors } from "@/lib/format.ts";
import { useSensors } from "@/state/sensors.tsx";

export function CompassView() {
  const sensors = useSensors();
  const [tipsOpen, setTipsOpen] = useState(false);
  const [welcomed, setWelcomed] = useState(() => localStorage.getItem("disha.welcomed") === "1");
  const [latText, setLatText] = useState("40.06");
  const [lonText, setLonText] = useState("-74.41");
  const [declText, setDeclText] = useState("12.2");
  const [declWest, setDeclWest] = useState(true);
  const [coordError, setCoordError] = useState<string | null>(null);
  const { effective, declination, magneticHeading, model } = sensors;
  const quality = qualityFromSensors(sensors.accuracy, sensors.stability);
  const shownMagnetic =
    effective.basis === "manual" && declination != null
      ? trueToMagnetic(effective.trueHeading, declination)
      : magneticHeading;
  const basisNote =
    effective.basis === "live-true" ? "True" : effective.basis === "live-magnetic" ? "Magnetic" : "Manual";

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Disha</p>
          <h1 className="mt-1 text-[2rem] leading-none">True north</h1>
        </div>
        <div className="flex items-center gap-2">
          <TierMark tier="free" />
          <Button variant="outline" size="icon" aria-label="Calibration tips" onClick={() => setTipsOpen(true)}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Vaastu uses geographic north. The dial takes the compass heading and adds the local magnetic declination.
      </p>

      {!welcomed && (
        <div className="mb-4 rounded-3xl border border-border bg-card p-4">
          <p className="text-sm leading-relaxed">
            Point the top of the phone the way you are facing. Sixteen zones, each 22.5° wide, turn with you. On a
            laptop, drag the dial — the New Jersey sample shows the 12° west correction the compass would apply.
          </p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => {
              localStorage.setItem("disha.welcomed", "1");
              setWelcomed(true);
            }}
          >
            Got it
          </Button>
        </div>
      )}

      {sensors.permission === "need-tap" && (
        <div className="mb-4 rounded-3xl border border-[#e7c9a4] bg-[#fff8ef] p-4">
          <p className="text-sm">iOS only shares compass heading after a tap.</p>
          <Button className="mt-3" onClick={() => void sensors.requestPermission()}>
            Enable compass
          </Button>
        </div>
      )}
      {sensors.permission === "denied" && (
        <p className="mb-4 rounded-3xl bg-[#fff8ef] px-4 py-3 text-sm">
          Compass access was denied. On iPhone, allow Motion & Orientation for this site, or drag the dial below.
        </p>
      )}

      <ZoneWheel
        heading={effective.trueHeading}
        interactive
        onHeading={sensors.setHeadingFromUser}
        basisNote={basisNote}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {effective.basis === "manual"
          ? "Drag the dial or use the arrow keys. This heading is treated as true north."
          : "The tick at the top is the direction you are facing."}
      </p>
      {sensors.magneticHeading != null && sensors.useManual && (
        <div className="mt-2 text-center">
          <Button variant="ghost" size="sm" onClick={sensors.followLive}>
            Follow the live compass
          </Button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Magnetic" value={shownMagnetic == null ? "—" : formatHeading(shownMagnetic)} />
        <Stat label="Declination" value={declination == null ? "—" : formatDeclination(declination)} />
        <Stat label="True" value={formatHeading(effective.trueHeading)} accent />
      </div>
      {effective.basis === "live-magnetic" && (
        <p className="mt-2 text-xs text-[#8a4e22]">
          This is still magnetic north. Add a location so the World Magnetic Model can correct it.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <BubbleLevel beta={sensors.beta} gamma={sensors.gamma} />
        <div className="rounded-3xl border border-border bg-card px-3 py-3">
          <p className="eyebrow">Accuracy</p>
          <p className="mt-1 font-serif text-xl leading-none">{quality.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{quality.detail}</p>
          {sensors.accuracy != null && sensors.accuracy >= 0 && (
            <p className="mt-1 text-xs text-muted-foreground">webkitCompassAccuracy ±{Math.round(sensors.accuracy)}°</p>
          )}
        </div>
      </div>

      <section className="mt-3 rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Location</p>
            <p className="mt-1 text-sm">
              {sensors.location
                ? `${sensors.location.label} · ${formatCoordinates(sensors.location.lat, sensors.location.lon)}`
                : "Declination depends on where you are."}
            </p>
          </div>
          <LocateFixed className="h-4 w-4 text-muted-foreground" />
        </div>
        {model && (
          <p className="mt-2 text-sm text-muted-foreground">
            {model.modelName}
            {model.approximate ? " (extended past its published window)" : ""} · expected field{" "}
            {formatField(model.totalFieldNt)}. A browser cannot read the magnetometer’s field strength, so this is the
            model’s figure only.
          </p>
        )}
        {sensors.modelError && <p className="mt-2 text-sm text-destructive">{sensors.modelError}</p>}
        {sensors.locationError && <p className="mt-2 text-sm text-[#8a4e22]">{sensors.locationError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={sensors.requestLocation} disabled={sensors.locationStatus === "locating"}>
            {sensors.locationStatus === "locating" ? "Finding you…" : "Use my location"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => sensors.setManualLocation(40.0583, -74.4057, "New Jersey (sample)")}
          >
            New Jersey sample
          </Button>
        </div>
        <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" inputMode="decimal" value={latText} onChange={(event) => setLatText(event.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lon">Longitude</Label>
                <Input id="lon" inputMode="decimal" value={lonText} onChange={(event) => setLonText(event.target.value)} className="mt-1" />
              </div>
            </div>
            {coordError && <p className="text-xs text-destructive">{coordError}</p>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lat = Number(latText);
                const lon = Number(lonText);
                if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
                  setCoordError("Latitude is -90 to 90, longitude -180 to 180.");
                  return;
                }
                setCoordError(null);
                sensors.setManualLocation(lat, lon, "Entered by hand");
              }}
            >
              Apply coordinates
            </Button>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label htmlFor="decl">Manual declination</Label>
                <Input id="decl" inputMode="decimal" value={declText} onChange={(event) => setDeclText(event.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="side">Side</Label>
                <select
                  id="side"
                  value={declWest ? "W" : "E"}
                  onChange={(event) => setDeclWest(event.target.value === "W")}
                  className="mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm"
                >
                  <option value="W">West</option>
                  <option value="E">East</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const amount = Number(declText);
                  if (!Number.isFinite(amount)) return;
                  sensors.setDeclinationOverride(declWest ? -Math.abs(amount) : Math.abs(amount));
                }}
              >
                Use this declination
              </Button>
              {sensors.declinationOverride != null && (
                <Button variant="ghost" size="sm" onClick={() => sensors.setDeclinationOverride(null)}>
                  Use the model
                </Button>
              )}
            </div>
        </div>
      </section>

      <ElementLegend className="mt-3" />
      <Disclaimer className="mt-4" />

      <Dialog open={tipsOpen} onOpenChange={setTipsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A steadier reading</DialogTitle>
            <DialogDescription>The phone is easily pulled off magnetic north indoors.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm leading-relaxed">
            <li>Lay the phone flat. The bubble should sit in the middle of the circle.</li>
            <li>Trace a slow figure-8 in the air to calibrate the compass.</li>
            <li>Step away from refrigerators, speakers, steel beams, and vehicles.</li>
            <li>In a steel-frame building, take the heading near a window, then align the floor plan to it.</li>
            <li>Each zone is only 22.5° wide, so the declination — about 12° west in New Jersey — is worth applying.</li>
          </ol>
          <svg viewBox="0 0 120 48" className="mt-4 h-12 w-full text-[#c4622d]" aria-hidden="true">
            <path d="M20 30c0-10 12-10 12 0s12 10 12 0 12-10 12 0 12 10 12 0 12-10 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-2 text-center">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-serif text-lg leading-none ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
