import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useSensors } from "@/state/sensors.tsx";

/**
 * The enable control has to call requestPermission from the tap itself.
 * Do not wrap this click in setTimeout, startTransition, or an await that
 * runs before requestPermission — iOS Safari will ignore the prompt.
 */
export function CompassAccess() {
  const sensors = useSensors();
  const { permission, needsGesture, ios, motionSeen, promptStalled, magneticHeading, useManual, source } = sensors;

  const enable = () => {
    void sensors.requestPermission();
  };

  if (useManual && magneticHeading != null) {
    return (
      <div className="mb-4 rounded-3xl border-2 border-primary bg-[#fff8ef] p-4" role="status">
        <p className="font-serif text-xl leading-none">Dial is set by hand</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It will stay still until you follow the live compass again.
        </p>
        <Button className="mt-3 h-12 w-full text-base" size="lg" onClick={sensors.followLive}>
          Follow the live compass
        </Button>
      </div>
    );
  }

  if (permission === "granted" && magneticHeading != null) {
    const via = source === "ios" ? "iPhone compass" : source === "sensor" ? "orientation sensor" : "absolute heading";
    return (
      <p className="mb-3 text-center text-sm font-medium text-primary" role="status" aria-live="polite">
        Live · {via}
      </p>
    );
  }

  if (permission === "unsupported") {
    return (
      <div className="mb-4 rounded-3xl border border-border bg-card px-4 py-3 text-sm leading-relaxed" role="status">
        This browser isn’t providing a compass heading. Drag the dial to set one.
        <Button className="mt-3 w-full" variant="secondary" onClick={enable}>
          Try again
        </Button>
      </div>
    );
  }

  if (permission === "unknown" && !needsGesture) return null;

  const copy = messageFor(permission, { ios, motionSeen, promptStalled });
  const waitingOnPrompt = permission === "requesting";

  return (
    <div
      className="mb-4 rounded-3xl border-2 border-primary bg-[#fff8ef] p-4 shadow-[0_16px_36px_-22px_rgba(196,98,45,0.95)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
        <p className="font-serif text-2xl leading-none">{copy.title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{copy.body}</p>
      <Button className="mt-3 h-12 w-full text-base" size="lg" disabled={waitingOnPrompt} onClick={enable}>
        {copy.action}
      </Button>
    </div>
  );
}

function messageFor(
  permission: string,
  flags: { ios: boolean; motionSeen: boolean; promptStalled: boolean },
): { title: string; body: string; action: string } {
  if (permission === "requesting") {
    return {
      title: "Allow compass access",
      body: flags.ios
        ? "Tap Allow on the iPhone prompt. The dial stays still until motion access is allowed."
        : "Tap Allow on the browser prompt. The dial stays still until motion access is allowed.",
      action: flags.ios ? "Waiting for iPhone…" : "Waiting for permission…",
    };
  }
  if (permission === "denied") {
    return {
      title: "Compass access is off",
      body: flags.ios
        ? "iPhone blocked motion for this site. Open Settings → Safari → Motion & Orientation Access and set it to Allow. iPhone will not ask again while that switch is off. Then come back and tap Try again."
        : "Compass access was denied. Allow motion and orientation for this site in the browser settings, then tap Try again.",
      action: "Try again",
    };
  }
  if (permission === "no-events") {
    const calibrate =
      "The phone is sending tilt, but no compass heading arrived within 3 seconds. Lay it flat, step away from metal, and trace a slow figure-8 to calibrate. Then tap Try again.";
    return {
      title: flags.motionSeen ? "No compass heading yet" : "No compass events",
      body: flags.motionSeen
        ? calibrate
        : flags.ios
          ? "No compass events arrived within 3 seconds. On iPhone, set Settings → Safari → Motion & Orientation Access to Allow, then tap Try again. A normal Safari tab is more reliable than Private."
          : "No compass events arrived within 3 seconds. Tap Try again and allow motion if the browser asks. Android Chrome needs a device with a compass.",
      action: "Try again",
    };
  }
  if (permission === "granted") {
    return {
      title: "Listening for the compass",
      body: "Access is on. Point the top of the phone the way you are facing. The dial and the zone wheel follow that heading.",
      action: "Try again",
    };
  }
  return {
    title: "Enable compass",
    body: flags.promptStalled
      ? flags.ios
        ? "The iPhone prompt didn’t finish. Open Settings → Safari → Motion & Orientation Access, set it to Allow, then tap Enable compass again."
        : "The permission prompt didn’t finish. Allow motion and orientation for this site, then tap Enable compass again."
      : flags.ios
        ? "iPhone only shares a heading after a tap. Tap Enable compass, then allow Motion & Orientation. The dial turns with the top of the phone."
        : "The browser shares the compass heading after a tap. Tap Enable compass, then allow motion. The dial turns with the top of the phone.",
    action: "Enable compass",
  };
}
