import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { useSensors } from "@/state/sensors.tsx";

/**
 * The enable control has to call requestPermission from the tap itself.
 * Do not wrap this click in setTimeout, startTransition, or an await that
 * runs before requestPermission — iOS Safari will ignore the prompt.
 */
export function CompassAccess() {
  const sensors = useSensors();
  const { u } = useI18n();
  const { permission, needsGesture, ios, motionSeen, promptStalled, magneticHeading, useManual, source } = sensors;

  const enable = () => {
    void sensors.requestPermission();
  };

  if (useManual && magneticHeading != null) {
    return (
      <div className="mb-4 rounded-3xl border-2 border-primary bg-card p-4" role="status">
        <p className="font-serif text-xl leading-none">{u("dialHand")}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u("dialStay")}</p>
        <Button className="mt-3 h-12 w-full text-base" size="lg" onClick={sensors.followLive}>
          {u("followLive")}
        </Button>
      </div>
    );
  }

  if (permission === "granted" && magneticHeading != null) {
    const via = source === "ios" ? u("iphoneCompass") : source === "sensor" ? u("orientationSensor") : u("absoluteHeading");
    return (
      <p className="mb-3 text-center text-sm font-medium text-primary" role="status" aria-live="polite">
        {u("live")} · {via}
      </p>
    );
  }

  if (permission === "unsupported") {
    return (
      <div className="mb-4 rounded-3xl border border-border bg-card px-4 py-3 text-sm leading-relaxed" role="status">
        {u("noCompassDrag")}
        <Button className="mt-3 w-full" variant="secondary" onClick={enable}>
          {u("tryAgain")}
        </Button>
      </div>
    );
  }

  if (permission === "unknown" && !needsGesture) return null;

  const copy = messageFor(permission, { ios, motionSeen, promptStalled }, u);
  const waitingOnPrompt = permission === "requesting";

  return (
    <div
      className="mb-4 rounded-3xl border-2 border-primary bg-card p-4 shadow-[0_16px_36px_-22px_rgba(228,195,106,0.45)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
        <p className="font-serif text-2xl leading-none">{copy.title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{copy.body}</p>
      {sensors.relativeOnly && sensors.magneticHeading == null && (
        <p className="mt-2 text-sm leading-relaxed">{u("relative")}</p>
      )}
      {sensors.noisy && <p className="mt-2 text-sm leading-relaxed">{u("figure8")}</p>}
      <Button className="mt-3 h-12 w-full text-base" size="lg" disabled={waitingOnPrompt} onClick={enable}>
        {copy.action}
      </Button>
    </div>
  );
}

function messageFor(
  permission: string,
  flags: { ios: boolean; motionSeen: boolean; promptStalled: boolean },
  u: (key: "allowCompass" | "allowIphone" | "allowBrowser" | "waitingIphone" | "waitingPermission" | "compassOff" | "deniedIos" | "deniedOther" | "tryAgain" | "calibrate" | "noHeadingYet" | "noEvents" | "noEventsIos" | "noEventsOther" | "listening" | "listeningBody" | "enableCompass" | "stallIos" | "stallOther" | "enableIos" | "enableOther") => string,
): { title: string; body: string; action: string } {
  if (permission === "requesting") {
    return {
      title: u("allowCompass"),
      body: flags.ios ? u("allowIphone") : u("allowBrowser"),
      action: flags.ios ? u("waitingIphone") : u("waitingPermission"),
    };
  }
  if (permission === "denied") {
    return {
      title: u("compassOff"),
      body: flags.ios ? u("deniedIos") : u("deniedOther"),
      action: u("tryAgain"),
    };
  }
  if (permission === "no-events") {
    return {
      title: flags.motionSeen ? u("noHeadingYet") : u("noEvents"),
      body: flags.motionSeen ? u("calibrate") : flags.ios ? u("noEventsIos") : u("noEventsOther"),
      action: u("tryAgain"),
    };
  }
  if (permission === "granted") {
    return {
      title: u("listening"),
      body: u("listeningBody"),
      action: u("tryAgain"),
    };
  }
  return {
    title: u("enableCompass"),
    body: flags.promptStalled ? (flags.ios ? u("stallIos") : u("stallOther")) : flags.ios ? u("enableIos") : u("enableOther"),
    action: u("enableCompass"),
  };
}
