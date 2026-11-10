import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { RoomChips } from "@/components/RoomChips.tsx";
import { Disclaimer, TierMark } from "@/components/VerdictCard.tsx";
import { VerdictCard } from "@/components/VerdictCard.tsx";
import { CompassAccess } from "@/components/CompassAccess.tsx";
import { ZoneWheel } from "@/components/ZoneWheel.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { uid } from "@/lib/id.ts";
import { promptFor, requireRule } from "@/lib/rules.ts";
import { scorePlacement, scoreRoom } from "@/lib/scoring.ts";
import type { Placement, TaggedRoom } from "@/lib/types.ts";
import { useProperties } from "@/state/properties.tsx";
import { useSensors } from "@/state/sensors.tsx";

type CheckTab = "desk" | "bed" | "room";

export function CheckView() {
  const sensors = useSensors();
  const { t, u } = useI18n();
  const homes = useProperties();
  const [tab, setTab] = useState<CheckTab>("desk");
  const [roomType, setRoomType] = useState("kitchen");
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const { effective } = sensors;

  const item = useMemo(() => {
    if (tab === "room") {
      const room: TaggedRoom = {
        id: "preview",
        typeId: roomType,
        source: "point",
        trueBearing: effective.trueHeading,
        zoneId: effective.zone.id,
        isCenter: false,
        declinationApplied: effective.declinationApplied,
      };
      return scoreRoom(room, [room]);
    }
    const placement: Placement = {
      id: "preview",
      typeId: tab === "desk" ? "desk_facing" : "bed_head",
      trueBearing: effective.trueHeading,
      zoneId: effective.zone.id,
      declinationApplied: effective.declinationApplied,
      createdAt: 0,
    };
    return scorePlacement(placement, [placement]);
  }, [effective.declinationApplied, effective.trueHeading, effective.zone.id, roomType, tab]);

  const prompt = promptFor(requireRule(tab === "room" ? roomType : tab === "desk" ? "desk_facing" : "bed_head"));

  function save() {
    const home = homes.active ?? homes.createProperty("My home");
    if (tab === "room") {
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
    } else {
      const placement: Placement = {
        id: uid(),
        typeId: tab === "desk" ? "desk_facing" : "bed_head",
        label: label.trim() || undefined,
        trueBearing: effective.trueHeading,
        zoneId: effective.zone.id,
        declinationApplied: effective.declinationApplied,
        createdAt: Date.now(),
      };
      homes.addPlacement(home.id, placement);
    }
    if (sensors.declination != null && sensors.location && home.declination == null) {
      homes.stampLocation(home.id, {
        lat: sensors.location.lat,
        lon: sensors.location.lon,
        declination: sensors.declination,
        model: sensors.model?.modelName,
        label: sensors.location.label,
      });
    }
    setSaved(`${u("savedTo")} ${home.name}.`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{u("instant")}</p>
          <h1 className="mt-1 text-[2rem] leading-snug">{u("pointRead")}</h1>
        </div>
        <TierMark tier="free" />
      </header>
      <Tabs value={tab} onValueChange={(value) => { setTab(value as CheckTab); setSaved(null); }}>
        <TabsList>
          <TabsTrigger value="desk">{u("desk")}</TabsTrigger>
          <TabsTrigger value="bed">{u("bed")}</TabsTrigger>
          <TabsTrigger value="room">{u("room")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(prompt)}</p>
          <div className="mt-3">
            <CompassAccess />
          </div>
          <ZoneWheel
            className="max-w-[300px]"
            heading={effective.trueHeading}
            interactive
            onHeading={sensors.setHeadingFromUser}
            basisNote={effective.basis === "manual" ? "Manual" : effective.declinationApplied ? "True" : "Magnetic"}
          />
          {tab === "room" && (
            <div className="mt-4">
              <p className="eyebrow mb-2">{u("room")}</p>
              <RoomChips value={roomType} onChange={setRoomType} />
            </div>
          )}
          <label className="mt-4 block">
            <span className="eyebrow">{u("optionalName")}</span>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Street-side desk" className="mt-1" />
          </label>
          <div className="mt-4">
            <VerdictCard item={item} />
          </div>
          {!effective.declinationApplied && (
            <p className="mt-2 text-xs text-primary">
              Declination is not applied yet, so this zone is magnetic. Set a location on the North tab for true north.
            </p>
          )}
          <Button className="mt-4 w-full" onClick={save}>
            Save to {homes.active?.name ?? "a new home"}
          </Button>
          {saved && <p className="mt-2 text-center text-sm text-muted-foreground">{saved}</p>}
        </TabsContent>
      </Tabs>
      <Disclaimer className="mt-4" />
    </div>
  );
}
