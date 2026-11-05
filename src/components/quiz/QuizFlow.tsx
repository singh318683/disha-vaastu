import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { directionFromHeading, DIR8_LABEL } from "@/lib/bearings.ts";
import {
  CHECK_CATALOG,
  CHECKS,
  RATING_LABEL,
  checkGroups,
  harmonyOf,
  requireCheck,
  verdictForHeading,
  type QuizVerdict,
  type Rating,
} from "@/lib/checks.ts";
import { formatDeclination, formatHeading } from "@/lib/format.ts";
import type { HarmonyCardInput } from "@/lib/harmonyExport.ts";
import { loadQuizResults, saveQuizResults, upsertResult, type StoredQuizResult } from "@/lib/quizStore.ts";
import { useSensors } from "@/state/sensors.tsx";
import { CheckGlyph } from "./CheckGlyph.tsx";
import { CompassDial } from "./CompassDial.tsx";
import { MoodFace } from "./MoodFace.tsx";

type Step =
  | { name: "welcome" }
  | { name: "home" }
  | { name: "lock"; id: string }
  | { name: "verdict"; id: string }
  | { name: "summary" };

const LEVEL_DEG = 12;
const STEADY_DEG = 8;

const PROMPT = {
  flat: "Hold the phone flat, like a plate.",
  metal: "Step away from metal if the needle wanders.",
  unsteady: "Hold still for a moment.",
  quiet: "Turn the ring if the compass stays quiet.",
  manual: "This device has no compass. Turn the ring to the way you are facing.",
} as const;

type PromptKind = keyof typeof PROMPT | "steady";

function compassPromptKind(input: {
  live: boolean;
  level: boolean;
  steady: boolean;
  metal: boolean;
  permission: string;
}): PromptKind {
  if (input.live && !input.level) return "flat";
  if (input.live && input.metal) return "metal";
  if (input.live && !input.steady) return "unsteady";
  if (input.live) return "steady";
  if (input.permission === "unsupported" || input.permission === "no-events") return "manual";
  return "quiet";
}

function SteadyPrompt() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return <p>{held ? "Holding steady. You can lock this." : "Steady enough to lock."}</p>;
}

export function QuizFlow({ onAdvanced }: { onAdvanced: () => void }) {
  const sensors = useSensors();
  const [step, setStep] = useState<Step>({ name: "welcome" });
  const [results, setResults] = useState<StoredQuizResult[]>(() => loadQuizResults());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    saveQuizResults(results);
  }, [results]);

  function start() {
    void sensors.requestPermission();
    setStep({ name: "home" });
  }

  function openCheck(id: string) {
    setNote(null);
    setStep({ name: "lock", id });
  }

  function lockHeading() {
    if (step.name !== "lock") return;
    const trueNorth = sensors.effective.basis !== "live-magnetic";
    const next = upsertResult(results, {
      checkId: step.id,
      heading: sensors.effective.trueHeading,
      trueNorth,
      at: Date.now(),
    });
    setResults(next);
    setStep({ name: "verdict", id: step.id });
  }

  const savedById = useMemo(() => new Map(results.map((item) => [item.checkId, item])), [results]);

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {step.name === "welcome" && <WelcomeScreen onStart={start} />}
      {step.name === "home" && (
        <HomeScreen
          savedById={savedById}
          onOpen={openCheck}
          onSummary={() => setStep({ name: "summary" })}
          onAdvanced={onAdvanced}
        />
      )}
      {step.name === "lock" && (
        <LockScreen
          id={step.id}
          onBack={() => setStep({ name: "home" })}
          onLock={lockHeading}
        />
      )}
      {step.name === "verdict" && (
        <VerdictScreen
          id={step.id}
          saved={savedById.get(step.id)}
          onRetake={() => setStep({ name: "lock", id: step.id })}
          onHome={() => setStep({ name: "home" })}
          onSummary={() => setStep({ name: "summary" })}
          canSummarize={results.length > 0}
        />
      )}
      {step.name === "summary" && (
        <SummaryScreen
          results={results}
          note={note}
          onNote={setNote}
          onBack={() => setStep({ name: "home" })}
          onClear={() => {
            setResults([]);
            setNote(null);
          }}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <section data-screen="welcome" className="flex min-h-dvh flex-col justify-between px-6 py-10">
      <p className="eyebrow">Disha</p>
      <div>
        <h1 className="max-w-[12ch] text-5xl leading-[1.05]">A calmer way to read your home.</h1>
        <p className="mt-5 max-w-[28ch] text-lg leading-relaxed text-muted-foreground">
          One gentle question at a time, using true north.
        </p>
      </div>
      <div>
        <Button className="h-14 w-full text-lg" onClick={onStart}>
          Start
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">{CHECK_CATALOG.framing}</p>
      </div>
    </section>
  );
}

function HomeScreen({
  savedById,
  onOpen,
  onSummary,
  onAdvanced,
}: {
  savedById: Map<string, StoredQuizResult>;
  onOpen: (id: string) => void;
  onSummary: () => void;
  onAdvanced: () => void;
}) {
  const groups = checkGroups();
  const checked = savedById.size;
  return (
    <section data-screen="home" className="px-4 pt-8 pb-12">
      <p className="eyebrow">Disha</p>
      <h1 className="mt-2 text-4xl leading-none">What shall we check?</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">Stand, point, and lock. One place at a time.</p>
      {checked > 0 && (
        <button
          type="button"
          onClick={onSummary}
          className="mt-5 flex w-full items-center justify-between rounded-3xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-[0_10px_24px_-16px_rgba(150,60,20,0.9)]"
        >
          <span>
            <span className="block font-serif text-2xl leading-none">Home harmony</span>
            <span className="mt-1 block text-sm text-primary-foreground/80">
              {checked} {checked === 1 ? "place" : "places"} checked
            </span>
          </span>
          <span aria-hidden="true" className="text-2xl">
            →
          </span>
        </button>
      )}
      {groups.map((group) => (
        <div key={group.group} className="mt-8">
          <h2 className="text-2xl">{group.group}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {group.checks.map((check) => {
              const saved = savedById.get(check.id);
              const rating = saved ? verdictForHeading(check, saved.heading).rating : null;
              return (
                <button
                  key={check.id}
                  type="button"
                  onClick={() => onOpen(check.id)}
                  aria-label={`${check.title}. ${check.blurb}.${rating ? ` ${RATING_LABEL[rating]}.` : ""}`}
                  className="flex min-h-36 flex-col items-start rounded-3xl border border-border bg-card p-4 text-left shadow-[0_10px_30px_-24px_rgba(70,40,10,0.8)] active:scale-[0.99]"
                >
                  <span className="flex w-full items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary">
                      <CheckGlyph name={check.icon} />
                    </span>
                    {rating && <MoodFace rating={rating} className="h-8 w-8" />}
                  </span>
                  <span className="mt-3 font-serif text-xl leading-tight">{check.title}</span>
                  <span className="mt-1 text-sm leading-snug text-muted-foreground">{check.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" onClick={onAdvanced} className="mt-10 w-full rounded-3xl px-4 py-4 text-base text-muted-foreground">
        Advanced tools
        <span className="mt-1 block text-sm">Floor plan, detailed report, and saved homes.</span>
      </button>
    </section>
  );
}

function LockScreen({ id, onBack, onLock }: { id: string; onBack: () => void; onLock: () => void }) {
  const sensors = useSensors();
  const check = requireCheck(id);
  const heading = sensors.effective.trueHeading;
  const label = DIR8_LABEL[directionFromHeading(heading)];
  const live = sensors.magneticHeading != null && !sensors.useManual;
  const tilt =
    sensors.beta != null && sensors.gamma != null ? Math.hypot(sensors.beta, sensors.gamma) : null;
  const level = tilt == null || tilt < LEVEL_DEG;
  const steady = !live || (sensors.stability != null && sensors.stability <= STEADY_DEG);
  const metal =
    (sensors.accuracy != null && (sensors.accuracy < 0 || sensors.accuracy > 40)) ||
    (sensors.stability != null && sensors.stability > 18);
  const waiting = sensors.permission === "requesting";
  const askPermission = sensors.needsGesture && (sensors.permission === "need-tap" || sensors.permission === "denied");
  const promptKind = compassPromptKind({
    live,
    level,
    steady,
    metal,
    permission: sensors.permission,
  });

  function enableCompass() {
    void sensors.requestPermission();
  }

  const directions = [
    ["N", 0],
    ["NE", 45],
    ["E", 90],
    ["SE", 135],
    ["S", 180],
    ["SW", 225],
    ["W", 270],
    ["NW", 315],
  ] as const;

  return (
    <section data-screen="lock" data-reference={check.reference} className="flex min-h-dvh flex-col px-5 pt-5 pb-8">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full bg-card">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-3xl leading-none">{check.title}</h1>
      </div>
      <p className="mt-5 text-lg leading-relaxed">{check.instructions}</p>
      <div className="mt-6">
        <CompassDial
          heading={heading}
          label={label}
          interactive={!live}
          onHeading={live ? undefined : sensors.setHeadingFromUser}
        />
      </div>
      <div className="mt-4 min-h-12 text-center text-base leading-snug text-muted-foreground" role="status" aria-live="polite">
        {promptKind === "steady" ? <SteadyPrompt /> : <p>{PROMPT[promptKind]}</p>}
      </div>
      {sensors.effective.basis === "live-magnetic" && (
        <button type="button" className="text-center text-sm text-[#8a4e22]" onClick={sensors.requestLocation}>
          This is still magnetic north. Use my location for true north.
        </button>
      )}
      {askPermission ? (
        <Button className="mt-2 h-14 w-full text-lg" disabled={waiting} onClick={enableCompass}>
          {sensors.permission === "denied" ? "Try the compass again" : "Enable compass"}
        </Button>
      ) : (
        <Button className="mt-2 h-14 w-full text-lg" disabled={waiting} onClick={onLock}>
          {waiting ? "Waiting…" : "Lock direction"}
        </Button>
      )}
      {askPermission && (
        <Button className="mt-3 h-12 w-full" variant="secondary" onClick={onLock}>
          Lock the ring instead
        </Button>
      )}
      {!live && sensors.magneticHeading != null && (
        <button type="button" className="mt-3 text-sm text-primary" onClick={sensors.followLive}>
          Follow the live compass
        </button>
      )}
      <details className="mt-4 rounded-3xl bg-card px-4 py-3">
        <summary className="cursor-pointer text-base font-medium">Details</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>True heading {formatHeading(heading)} · facing {label}</p>
          <p>
            Magnetic {sensors.magneticHeading == null ? "—" : formatHeading(sensors.magneticHeading)}
            {" · "}
            Declination {sensors.declination == null ? "—" : formatDeclination(sensors.declination)}
          </p>
          {check.detailNote && <p>{check.detailNote}</p>}
          <p>A browser cannot read magnetic field strength. If the needle jumps, step away from steel.</p>
          {sensors.declination == null && (
            <Button size="sm" variant="outline" onClick={sensors.requestLocation}>
              Use my location
            </Button>
          )}
        </div>
      </details>
      {!live && (
        <details className="mt-3 rounded-3xl bg-card px-4 py-3">
          <summary className="cursor-pointer text-base font-medium">Set direction</summary>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {directions.map(([name, degrees]) => (
              <button
                key={name}
                type="button"
                onClick={() => sensors.setHeadingFromUser(degrees)}
                className="h-12 rounded-2xl bg-secondary text-base font-medium"
              >
                {name}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function VerdictScreen({
  id,
  saved,
  onRetake,
  onHome,
  onSummary,
  canSummarize,
}: {
  id: string;
  saved: StoredQuizResult | undefined;
  onRetake: () => void;
  onHome: () => void;
  onSummary: () => void;
  canSummarize: boolean;
}) {
  const check = requireCheck(id);
  const verdict = verdictForHeading(check, saved?.heading ?? 0);
  return (
    <section data-screen="verdict" className="px-5 pt-5 pb-10">
      <button type="button" onClick={onHome} className="grid h-12 w-12 place-items-center rounded-full bg-card" aria-label="Back">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <VerdictBody verdict={verdict} trueNorth={saved?.trueNorth !== false} />
      <div className="mt-6 grid gap-3">
        <Button className="h-14 text-lg" onClick={onHome}>
          Check another
        </Button>
        <Button className="h-12" variant="secondary" onClick={onRetake}>
          Retake
        </Button>
        {canSummarize && (
          <button type="button" onClick={onSummary} className="py-2 text-base text-primary">
            See home harmony
          </button>
        )}
      </div>
    </section>
  );
}

function VerdictBody({ verdict, trueNorth }: { verdict: QuizVerdict; trueNorth: boolean }) {
  const ideal = verdict.rating === "auspicious" && verdict.remedies.length === 0;
  return (
    <div>
      <div className="mt-4 flex items-center gap-3">
        <MoodFace rating={verdict.rating} className="h-16 w-16" />
        <p className="font-serif text-3xl leading-none">{RATING_LABEL[verdict.rating]}</p>
      </div>
      <h1 className="mt-5 text-4xl leading-tight">{verdict.placementLine}</h1>
      {verdict.check.granularity === 32 && <p className="mt-2 text-lg">{verdict.slotLine}</p>}
      {verdict.toward && <p className="mt-1 text-base text-muted-foreground">{verdict.toward}</p>}
      <p className="mt-4 text-lg leading-relaxed">{verdict.meaning}</p>
      <div className="mt-4 rounded-3xl bg-[#f8efe2] px-4 py-4">
        <p className="text-base leading-relaxed">{verdict.bestNote}</p>
      </div>
      {ideal ? (
        <p className="mt-4 text-lg leading-relaxed">Nothing to move. Keep this as it is.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {verdict.remedies.map((remedy) => (
            <li key={remedy} className="rounded-2xl bg-card px-4 py-3 text-base leading-snug">
              {remedy}
            </li>
          ))}
        </ul>
      )}
      {!trueNorth && (
        <p className="mt-3 text-sm text-[#8a4e22]">This reading is still magnetic. Allow location to correct it to true north.</p>
      )}
      <details className="mt-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-base font-medium text-foreground">Details</summary>
        <p className="mt-2 leading-relaxed">
          {formatHeading(verdict.heading)} · {verdict.directionLabel} · {verdict.slotId}
          {verdict.check.detailNote ? ` · ${verdict.check.detailNote}` : ""}
        </p>
      </details>
      <p className="mt-4 text-sm text-muted-foreground">{CHECK_CATALOG.framing}</p>
    </div>
  );
}

function SummaryScreen({
  results,
  note,
  onNote,
  onBack,
  onClear,
}: {
  results: StoredQuizResult[];
  note: string | null;
  onNote: (note: string | null) => void;
  onBack: () => void;
  onClear: () => void;
}) {
  const rows = CHECKS.flatMap((check) => {
    const saved = results.find((item) => item.checkId === check.id);
    if (!saved) return [];
    const verdict = verdictForHeading(check, saved.heading);
    return [{ verdict, trueNorth: saved.trueNorth }];
  });
  const harmony = harmonyOf(rows.map((row) => row.verdict.rating));
  const card: HarmonyCardInput = {
    title: harmony.title,
    line: harmony.line,
    framing: CHECK_CATALOG.framing,
    auspicious: harmony.auspicious,
    neutral: harmony.neutral,
    inauspicious: harmony.inauspicious,
    rows: rows.map((row) => ({
      title: row.verdict.check.title,
      placement: row.verdict.placementLine,
      rating: row.verdict.rating,
    })),
  };
  const [busy, setBusy] = useState<"card" | "pdf" | null>(null);

  async function shareCard() {
    setBusy("card");
    onNote(null);
    try {
      const { shareHarmonyCard } = await import("@/lib/harmonyExport.ts");
    const outcome = await shareHarmonyCard(card);
      if (outcome === "downloaded") onNote("Card saved.");
      if (outcome === "shared") onNote("Card shared.");
    } catch {
      onNote("Could not make the card in this browser.");
    } finally {
      setBusy(null);
    }
  }

  async function savePdf() {
    setBusy("pdf");
    onNote(null);
    try {
      const { buildQuizPdf, downloadHarmonyFile } = await import("@/lib/harmonyExport.ts");
      const blob = await buildQuizPdf(card);
      downloadHarmonyFile(blob, "disha-home-harmony.pdf");
      onNote("PDF saved.");
    } catch {
      onNote("Could not make the PDF in this browser.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section data-screen="summary" className="px-5 pt-5 pb-12">
      <button type="button" onClick={onBack} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full bg-card">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <p className="eyebrow mt-4">Home harmony</p>
      <h1 className="mt-2 text-4xl leading-none">{harmony.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{harmony.line}</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Count value={harmony.auspicious} label="Auspicious" rating="auspicious" />
        <Count value={harmony.neutral} label="Neutral" rating="neutral" />
        <Count value={harmony.inauspicious} label="To soften" rating="inauspicious" />
      </div>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 && <li className="text-base text-muted-foreground">Nothing checked yet.</li>}
        {rows.map((row) => (
          <li key={row.verdict.check.id} className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3">
            <MoodFace rating={row.verdict.rating} className="h-10 w-10" />
            <span>
              <span className="block font-medium">{row.verdict.check.title}</span>
              <span className="block text-sm text-muted-foreground">{row.verdict.placementLine}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-3">
        <Button className="h-14 text-lg" disabled={busy !== null || rows.length === 0} onClick={() => void shareCard()}>
          {busy === "card" ? "Making the card…" : "Share card"}
        </Button>
        <Button className="h-12" variant="outline" disabled={busy !== null || rows.length === 0} onClick={() => void savePdf()}>
          {busy === "pdf" ? "Making the PDF…" : "Download PDF"}
        </Button>
      </div>
      {note && <p className="mt-3 text-center text-sm text-muted-foreground">{note}</p>}
      <p className="mt-4 text-sm text-muted-foreground">{CHECK_CATALOG.framing}</p>
      {rows.length > 0 && (
        <button type="button" onClick={onClear} className="mt-4 text-sm text-muted-foreground underline">
          Clear these checks
        </button>
      )}
    </section>
  );
}

function Count({ value, label, rating }: { value: number; label: string; rating: Rating }) {
  const color = rating === "auspicious" ? "text-[#3E7A4A]" : rating === "neutral" ? "text-[#A37B32]" : "text-[#A15A3A]";
  return (
    <div className="rounded-3xl bg-card px-3 py-3 text-center">
      <p className={`font-serif text-3xl leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
