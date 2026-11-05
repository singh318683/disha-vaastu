import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { FloorPlanCanvas, alignmentLabel } from "@/components/FloorPlanEditor.tsx";
import { RoomChips } from "@/components/RoomChips.tsx";
import { Disclaimer, TierMark } from "@/components/VerdictCard.tsx";
import { ZoneWheel } from "@/components/ZoneWheel.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { formatHeading } from "@/lib/format.ts";
import { centroid, zoneFromPlanPoint } from "@/lib/geometry.ts";
import { uid } from "@/lib/id.ts";
import { compressImage } from "@/lib/images.ts";
import { ROOM_RULES } from "@/lib/rules.ts";
import { scoreColor, scoreProperty } from "@/lib/scoring.ts";
import type { FloorPlan, Point, TaggedRoom } from "@/lib/types.ts";
import { zoneById } from "@/lib/zones.ts";
import { useProperties } from "@/state/properties.tsx";
import { useSensors } from "@/state/sensors.tsx";

export function ScanView() {
  const homes = useProperties();
  const sensors = useSensors();
  const fileRef = useRef<HTMLInputElement>(null);
  const active = homes.active;
  const [mode, setMode] = useState<"point" | "plan">(active?.plan ? "plan" : "point");
  const [seenId, setSeenId] = useState(active?.id ?? null);
  if ((active?.id ?? null) !== seenId) {
    setSeenId(active?.id ?? null);
    setMode(active?.plan ? "plan" : "point");
  }
  const [roomType, setRoomType] = useState("kitchen");
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState<Point | null>(null);
  const [planType, setPlanType] = useState("kitchen");
  const [planLabel, setPlanLabel] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);
  const scored = active ? scoreProperty(active) : null;
  const { effective } = sensors;

  function remember(id: string, hadDeclination: boolean) {
    if (hadDeclination || sensors.declination == null || !sensors.location) return;
    homes.stampLocation(id, {
      lat: sensors.location.lat,
      lon: sensors.location.lon,
      declination: sensors.declination,
      model: sensors.model?.modelName,
      label: sensors.location.label,
    });
  }

  function tagPoint() {
    const home = active ?? homes.createProperty("My home");
    const room: TaggedRoom = {
      id: uid(),
      typeId: roomType,
      label: label.trim() || undefined,
      source: "point",
      trueBearing: effective.trueHeading,
      zoneId: effective.zone.id,
      isCenter: false,
      declinationApplied: effective.declinationApplied,
    };
    homes.addRoom(home.id, room);
    remember(home.id, home.declination != null);
    setLabel("");
  }

  async function onFile(file: File) {
    setBusy(true);
    setImageError(null);
    try {
      const compressed = await compressImage(file);
      const home = active ?? homes.createProperty("My home");
      const plan: FloorPlan = {
        image: compressed.dataUrl,
        northBearingOfImageUp: home.plan?.northBearingOfImageUp ?? 0,
        center: home.plan?.center ?? { x: 0.5, y: 0.5 },
        aspect: compressed.aspect,
      };
      homes.setPlan(home.id, plan);
      setMode("plan");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not use that image.");
    } finally {
      setBusy(false);
    }
  }

  function addPlanRoom() {
    if (!active?.plan || !pending) return;
    const placed = zoneFromPlanPoint(active.plan, pending);
    const room: TaggedRoom = {
      id: uid(),
      typeId: planType,
      label: planLabel.trim() || undefined,
      source: "plan",
      trueBearing: placed.trueBearing,
      zoneId: placed.zoneId,
      isCenter: placed.isCenter,
      declinationApplied: true,
      point: pending,
    };
    homes.addRoom(active.id, room);
    setPending(null);
    setPlanLabel("");
  }

  const points = Object.fromEntries((active?.rooms ?? []).map((room) => [room.id, room.point]));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Full-home scan</p>
          <h1 className="mt-1 text-[2rem] leading-none">Map the rooms</h1>
        </div>
        <TierMark tier="paid" />
      </header>
      <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Stand in the middle and tag each room, or lay a floor plan on the screen and tap the rooms. Both are saved on this device.
      </p>

      {!active ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-serif text-2xl">Start a home</h2>
          <p className="mt-1 text-sm text-muted-foreground">Name it after the address, or load the sample apartment.</p>
          <HomeNameForm
            onCreate={(name) => homes.createProperty(name)}
            onSample={() => {
              homes.loadSample();
              setMode("plan");
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <label className="block">
              <span className="eyebrow">This home</span>
              <Input
                value={active.name}
                onChange={(event) =>
                  homes.updateProperty(active.id, (property) => ({ ...property, name: event.target.value }))
                }
                className="mt-1 max-w-sm"
              />
            </label>
            <div className="mt-3 inline-flex rounded-full bg-secondary p-1">
              <button
                type="button"
                className={`h-9 rounded-full px-4 text-sm ${mode === "point" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMode("point")}
              >
                Point and tag
              </button>
              <button
                type="button"
                className={`h-9 rounded-full px-4 text-sm ${mode === "plan" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMode("plan")}
              >
                Floor plan
              </button>
            </div>

            {mode === "point" ? (
              <div className="mt-4">
                <ZoneWheel
                  className="max-w-[320px]"
                  heading={effective.trueHeading}
                  interactive
                  onHeading={sensors.setHeadingFromUser}
                  basisNote={effective.basis === "manual" ? "Manual" : effective.declinationApplied ? "True" : "Magnetic"}
                />
                {sensors.permission === "need-tap" && (
                  <Button className="mt-3" variant="secondary" onClick={() => void sensors.requestPermission()}>
                    Enable compass
                  </Button>
                )}
                {sensors.useManual && sensors.magneticHeading != null && (
                  <Button className="mt-2" variant="ghost" size="sm" onClick={sensors.followLive}>
                    Follow the live compass
                  </Button>
                )}
                {!effective.declinationApplied && (
                  <p className="mt-2 text-xs text-[#8a4e22]">
                    Tagging now stores a magnetic bearing. Set a location on the North tab for true north.
                  </p>
                )}
                <p className="eyebrow mt-4 mb-2">Tag the room you are pointing at</p>
                <RoomChips value={roomType} onChange={setRoomType} />
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Optional name"
                  className="mt-3 max-w-sm"
                />
                <Button className="mt-3" onClick={tagPoint}>
                  Tag {ROOM_RULES.find((rule) => rule.id === roomType)?.label} · {effective.zone.label}
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onFile(file);
                    event.target.value = "";
                  }}
                />
                {!active.plan ? (
                  <div className="rounded-3xl border border-dashed border-[#d7c4ae] bg-card/70 px-4 py-10 text-center">
                    <ImagePlus className="mx-auto h-6 w-6 text-[#c4622d]" />
                    <p className="mt-2 font-serif text-xl">Upload a floor plan</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                      A photo or a drawing is enough. You will rotate it until north sits where it does in the building.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                        {busy ? "Preparing…" : "Choose image"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (active.rooms.length > 0) setConfirmSample(true);
                          else {
                            homes.loadSample(active.id);
                            setMode("plan");
                          }
                        }}
                      >
                        Load sample apartment
                      </Button>
                    </div>
                    {imageError && <p className="mt-3 text-sm text-destructive">{imageError}</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FloorPlanCanvas
                      plan={active.plan}
                      rooms={scored?.rooms ?? []}
                      points={points}
                      interactive
                      onTap={setPending}
                      onCenter={(center) => homes.setPlan(active.id, { ...active.plan!, center })}
                    />
                    <p className="text-sm text-muted-foreground">{alignmentLabel(active.plan.northBearingOfImageUp)} Tap a room, then name it. Drag the gold pin to the center of the home.</p>
                    <div>
                      <Label>Rotate north</Label>
                      <Slider
                        className="mt-3"
                        min={0}
                        max={359}
                        step={1}
                        value={[Math.round(active.plan.northBearingOfImageUp) % 360]}
                        onValueChange={([value]) =>
                          homes.setPlan(active.id, { ...active.plan!, northBearingOfImageUp: value ?? 0 })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={effective.basis === "live-magnetic"}
                        onClick={() => {
                          homes.setPlan(active.id, {
                            ...active.plan!,
                            northBearingOfImageUp: effective.trueHeading,
                          });
                        }}
                      >
                        Capture phone as “up” · {formatHeading(effective.trueHeading)}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const marks = active.rooms.flatMap((room) => (room.point ? [room.point] : []));
                          const middle = centroid(marks);
                          if (middle) homes.setPlan(active.id, { ...active.plan!, center: middle });
                        }}
                      >
                        Center on tagged rooms
                      </Button>
                      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                        Replace image
                      </Button>
                      <Button variant="ghost" onClick={() => homes.setPlan(active.id, undefined)}>
                        Remove plan
                      </Button>
                    </div>
                    {!effective.declinationApplied && effective.basis !== "manual" && (
                      <p className="text-xs text-[#8a4e22]">Set a declination before capturing the phone’s heading as the plan’s up direction.</p>
                    )}
                    {imageError && <p className="text-sm text-destructive">{imageError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">Rooms</h2>
              <p className="font-serif text-xl text-primary">{scored ? scored.score : "—"}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {scored ? `${scored.verdict.label}, per traditional guidelines` : "Tag a room to score the home."}
            </p>
            <ul className="mt-3 space-y-2">
              {(scored?.rooms ?? []).map((room) => (
                <li key={room.id} className="flex items-center gap-2 rounded-2xl bg-muted px-2 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: scoreColor(room.score) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.zoneLabel}
                      {room.bearing != null ? ` · ${formatHeading(room.bearing)}` : ""} · {room.score}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${room.name}`}
                    className="rounded-full p-2 text-muted-foreground hover:bg-card"
                    onClick={() => homes.removeRoom(active.id, room.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {active.rooms.length === 0 && <li className="text-sm text-muted-foreground">Nothing tagged yet.</li>}
            </ul>
          </aside>
        </div>
      )}

      <Dialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which room is this?</DialogTitle>
            <DialogDescription>
              {active?.plan && pending
                ? describeTap(active.plan, pending)
                : "Choose the room that sits under the tap."}
            </DialogDescription>
          </DialogHeader>
          <RoomChips value={planType} onChange={setPlanType} />
          <Input
            value={planLabel}
            onChange={(event) => setPlanLabel(event.target.value)}
            placeholder="Optional name"
            className="mt-3"
          />
          <Button className="mt-4 w-full" onClick={addPlanRoom}>
            Add {ROOM_RULES.find((rule) => rule.id === planType)?.label}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmSample} onOpenChange={setConfirmSample}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace this home’s rooms?</DialogTitle>
            <DialogDescription>
              The sample apartment overwrites the rooms and floor plan saved in {active?.name ?? "this home"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (active) homes.loadSample(active.id);
                setMode("plan");
                setConfirmSample(false);
              }}
            >
              Load sample
            </Button>
            <Button variant="outline" onClick={() => setConfirmSample(false)}>
              Keep mine
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Disclaimer className="mt-4" />
    </div>
  );
}

function describeTap(plan: FloorPlan, point: Point): string {
  const placed = zoneFromPlanPoint(plan, point);
  if (placed.isCenter || placed.zoneId === "center") {
    return "This tap is on the Brahmasthan, the center. Traditional guidance keeps it open.";
  }
  return `This spot falls in ${zoneById(placed.zoneId).label}.`;
}

function HomeNameForm({ onCreate, onSample }: { onCreate: (name: string) => void; onSample: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(name);
      }}
    >
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="12 Cedar Apartment" />
      <Button type="submit">Create</Button>
      <Button type="button" variant="secondary" onClick={onSample}>
        Sample
      </Button>
    </form>
  );
}
