import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { directionFromHeading } from "@/lib/bearings.ts";
import { directionName } from "@/lib/l10n.ts";
import { phoneIsLevel } from "@/lib/heading.ts";
import {
  CHECK_CATALOG,
  CHECKS,
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
import { CompassDial } from "./CompassDial.tsx";
import { HomePager } from "./HomePager.tsx";
import { MoodFace } from "./MoodFace.tsx";

type Step =
  | { name: "welcome" }
  | { name: "home" }
  | { name: "lock"; id: string }
  | { name: "verdict"; id: string }
  | { name: "summary" };

const STEADY_DEG = 8;

type PromptKind = "flat" | "metal" | "unsteady" | "quiet" | "manual" | "steady" | "relative";

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
  if (input.permission === "relative") return "relative";
  if (input.permission === "unsupported" || input.permission === "no-events") return "manual";
  return "quiet";
}

function SteadyPrompt() {
  const { u } = useI18n();
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return <p>{held ? u("holding") : u("steadyEnough")}</p>;
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
    const locked = sensors.headingToLock();
    const next = upsertResult(results, {
      checkId: step.id,
      heading: locked.trueHeading,
      trueNorth: locked.trueNorth,
      at: Date.now(),
    });
    setResults(next);
    setStep({ name: "verdict", id: step.id });
  }

  const savedById = useMemo(() => new Map(results.map((item) => [item.checkId, item])), [results]);

  return (
    <div className="mx-auto h-dvh max-w-lg overflow-hidden">
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
  const { t, u } = useI18n();
  return (
    <section data-screen="welcome" className="relative flex h-full flex-col justify-between overflow-hidden px-6 py-8">
      <Mandala className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 opacity-50" />
      <div className="relative flex items-center justify-between">
        <p className="eyebrow">Disha</p>
        <LanguageToggle />
      </div>
      <div className="relative">
        <h1 className="max-w-[12ch] text-[clamp(2.35rem,9vw,3.25rem)] leading-[1.15]">{u("welcomeTitle")}</h1>
        <p className="mt-5 max-w-[28ch] text-lg leading-relaxed text-muted-foreground">{u("welcomeLine")}</p>
      </div>
      <div>
        <Button className="h-14 w-full text-lg" onClick={onStart}>
          {u("start")}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">{t(CHECK_CATALOG.framing)}</p>
      </div>
    </section>
  );
}

function HomeScreen(props: {
  savedById: Map<string, StoredQuizResult>;
  onOpen: (id: string) => void;
  onSummary: () => void;
  onAdvanced: () => void;
}) {
  return <HomePager {...props} />;
}

function LockScreen({ id, onBack, onLock }: { id: string; onBack: () => void; onLock: () => void }) {
  const sensors = useSensors();
  const { locale, t, u } = useI18n();
  const check = requireCheck(id);
  const heading = sensors.effective.trueHeading;
  const label = directionName(directionFromHeading(heading), locale);
  const live = sensors.magneticHeading != null && !sensors.useManual;
  const level = phoneIsLevel(sensors.beta, sensors.gamma);
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
    permission: sensors.relativeOnly && sensors.magneticHeading == null ? "relative" : sensors.permission,
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
    <section data-screen="lock" data-reference={check.reference} className="flex h-full flex-col overflow-hidden px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(0.45rem,env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onBack} aria-label={u("back")} className="grid h-10 w-10 place-items-center rounded-full bg-card">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-2xl leading-none">{t(check.title)}</h1>
        <LanguageToggle />
      </div>
      <p className="mt-2 line-clamp-2 shrink-0 text-sm leading-snug text-muted-foreground">{t(check.instructions)}</p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <CompassDial
          heading={heading}
          label={label}
          interactive={!live}
          onHeading={live ? undefined : sensors.setHeadingFromUser}
        />
      </div>
      <div className="line-clamp-2 shrink-0 text-center text-sm leading-snug text-muted-foreground" role="status" aria-live="polite">
        {promptKind === "steady" ? <SteadyPrompt /> : <span>{u(promptKind)}</span>}
        {sensors.noisy && <span className="mt-0.5 block text-xs">{u("figure8")}</span>}
      </div>
      {sensors.effective.basis === "live-magnetic" && (
        <button type="button" className="mt-1 line-clamp-2 shrink-0 text-center text-xs text-primary" onClick={sensors.requestLocation}>
          {u("magneticHint")}
        </button>
      )}
      {askPermission ? (
        <Button className="mt-2 h-11 w-full shrink-0 text-base" disabled={waiting} onClick={enableCompass}>
          {sensors.permission === "denied" ? u("tryCompass") : u("enableCompass")}
        </Button>
      ) : (
        <Button className="mt-2 h-11 w-full shrink-0 text-base" disabled={waiting} onClick={onLock}>
          {waiting ? u("waiting") : u("lock")}
        </Button>
      )}
      {askPermission && (
        <Button className="mt-1.5 h-10 w-full shrink-0" variant="secondary" onClick={onLock}>
          {u("lockRing")}
        </Button>
      )}
      {!live && sensors.magneticHeading != null && (
        <button type="button" className="mt-1 shrink-0 text-center text-xs text-primary" onClick={sensors.followLive}>
          {u("followLive")}
        </button>
      )}
      <MoreSheet>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            {u("trueHeading")} {formatHeading(heading)} · {u("facingWord")} {label}
          </p>
          <p>
            {u("magnetic")} {sensors.magneticHeading == null ? "—" : formatHeading(sensors.magneticHeading)}
            {" · "}
            {u("declination")} {sensors.declination == null ? "—" : formatDeclination(sensors.declination)}
          </p>
          {check.detailNote && <p>{t(check.detailNote)}</p>}
          <p>{u("metalNote")}</p>
          {sensors.declination == null && (
            <Button size="sm" variant="outline" onClick={sensors.requestLocation}>
              {u("useLocation")}
            </Button>
          )}
        </div>
        {!live && (
          <div className="mt-4">
            <p className="text-base font-medium">{u("setDirection")}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {directions.map(([name, degrees]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => sensors.setHeadingFromUser(degrees)}
                  className="h-11 rounded-2xl bg-secondary text-sm font-medium"
                >
                  {directionName(name, locale)}
                </button>
              ))}
            </div>
          </div>
        )}
      </MoreSheet>
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
  const { locale, u } = useI18n();
  const check = requireCheck(id);
  const verdict = verdictForHeading(check, saved?.heading ?? 0, locale);
  return (
    <section data-screen="verdict" className="flex h-full flex-col overflow-hidden px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(0.45rem,env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center justify-between">
        <button type="button" onClick={onHome} className="grid h-10 w-10 place-items-center rounded-full bg-card" aria-label={u("back")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <LanguageToggle />
      </div>
      <VerdictBody verdict={verdict} trueNorth={saved?.trueNorth !== false} />
      <div className="mt-2 grid shrink-0 gap-1.5">
        <Button className="h-11 text-base" onClick={onHome}>
          {u("checkAnother")}
        </Button>
        <Button className="h-10" variant="secondary" onClick={onRetake}>
          {u("retake")}
        </Button>
        {canSummarize && (
          <button type="button" onClick={onSummary} className="py-1 text-sm text-primary">
            {u("seeHarmony")}
          </button>
        )}
      </div>
    </section>
  );
}

function VerdictBody({ verdict, trueNorth }: { verdict: QuizVerdict; trueNorth: boolean }) {
  const { t, u } = useI18n();
  const ideal = verdict.rating === "auspicious" && verdict.remedies.length === 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mt-2 flex shrink-0 items-center gap-3">
        <MoodFace rating={verdict.rating} className="h-12 w-12" />
        <p className="font-serif text-2xl leading-none">{u(verdict.rating)}</p>
      </div>
      <h1 className="mt-2 line-clamp-2 shrink-0 text-[clamp(1.55rem,6vw,2rem)] leading-tight">{verdict.placementLine}</h1>
      {verdict.check.granularity === 32 && <p className="mt-1 line-clamp-1 shrink-0 text-sm">{verdict.slotLine}</p>}
      <p className="mt-2 line-clamp-3 shrink-0 text-sm leading-snug">{verdict.meaning}</p>
      {ideal ? (
        <p className="mt-2 line-clamp-2 text-sm leading-snug">{u("nothingToMove")}</p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {verdict.remedies.map((remedy) => (
            <li key={remedy} className="line-clamp-2 rounded-2xl bg-card px-3 py-2 text-sm leading-snug">
              {remedy}
            </li>
          ))}
        </ul>
      )}
      {!trueNorth && <p className="mt-1 line-clamp-2 shrink-0 text-xs text-primary">{u("stillMagnetic")}</p>}
      <MoreSheet>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>{verdict.bestNote}</p>
          {verdict.toward && <p className="text-muted-foreground">{verdict.toward}</p>}
          <p className="text-muted-foreground">
            {formatHeading(verdict.heading)} · {verdict.directionLabel} · {verdict.slotId}
            {verdict.check.detailNote ? ` · ${t(verdict.check.detailNote)}` : ""}
          </p>
          <p className="text-muted-foreground">{t(CHECK_CATALOG.framing)}</p>
        </div>
      </MoreSheet>
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
  const { locale, t, u } = useI18n();
  const rows = CHECKS.flatMap((check) => {
    const saved = results.find((item) => item.checkId === check.id);
    if (!saved) return [];
    const verdict = verdictForHeading(check, saved.heading, locale);
    return [{ verdict, trueNorth: saved.trueNorth }];
  });
  const harmony = harmonyOf(rows.map((row) => row.verdict.rating), locale);
  const card: HarmonyCardInput = {
    title: harmony.title,
    line: harmony.line,
    framing: t(CHECK_CATALOG.framing),
    auspicious: harmony.auspicious,
    neutral: harmony.neutral,
    inauspicious: harmony.inauspicious,
    rows: rows.map((row) => ({
      title: t(row.verdict.check.title),
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
      if (outcome === "downloaded") onNote(u("cardSaved"));
      if (outcome === "shared") onNote(u("cardShared"));
    } catch {
      onNote(u("cardFailed"));
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
      onNote(u("pdfSaved"));
    } catch {
      onNote(u("pdfFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section data-screen="summary" className="flex h-full flex-col overflow-hidden px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(0.45rem,env(safe-area-inset-bottom))]">
      <div className="flex shrink-0 items-center justify-between">
        <button type="button" onClick={onBack} aria-label={u("back")} className="grid h-10 w-10 place-items-center rounded-full bg-card">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <LanguageToggle />
      </div>
      <p className="eyebrow mt-2 shrink-0">{u("homeHarmony")}</p>
      <h1 className="mt-1 line-clamp-2 shrink-0 text-[clamp(1.6rem,6vw,2rem)] leading-tight">{harmony.title}</h1>
      <p className="mt-1 line-clamp-2 shrink-0 text-sm leading-snug text-muted-foreground">{harmony.line}</p>
      <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
        <Count value={harmony.auspicious} label={u("auspicious")} rating="auspicious" />
        <Count value={harmony.neutral} label={u("neutral")} rating="neutral" />
        <Count value={harmony.inauspicious} label={u("toSoften")} rating="inauspicious" />
      </div>
      <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain">
        {rows.length === 0 && <li className="text-sm text-muted-foreground">{u("nothingChecked")}</li>}
        {rows.map((row) => (
          <li key={row.verdict.check.id} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2">
            <MoodFace rating={row.verdict.rating} className="h-8 w-8" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t(row.verdict.check.title)}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.verdict.placementLine}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid shrink-0 gap-1.5">
        <Button className="h-11 text-base" disabled={busy !== null || rows.length === 0} onClick={() => void shareCard()}>
          {busy === "card" ? u("makingCard") : u("shareCard")}
        </Button>
        <Button className="h-10" variant="outline" disabled={busy !== null || rows.length === 0} onClick={() => void savePdf()}>
          {busy === "pdf" ? u("makingPdf") : u("downloadPdf")}
        </Button>
      </div>
      {note && <p className="mt-1 shrink-0 text-center text-xs text-muted-foreground">{note}</p>}
      <div className="mt-1 flex shrink-0 items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="line-clamp-1">{t(CHECK_CATALOG.framing)}</p>
        {rows.length > 0 && (
          <button type="button" onClick={onClear} className="shrink-0 underline">
            {u("clearChecks")}
          </button>
        )}
      </div>
    </section>
  );
}

function MoreSheet({ children }: { children: ReactNode }) {
  const { u } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="mt-1.5 h-10 w-full shrink-0 rounded-2xl bg-card text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {u("more")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#050814]/70" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={u("more")}
            className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl border border-[#e4c36a]/30 bg-card px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{u("more")}</h2>
              <button type="button" className="rounded-full px-3 py-1 text-sm text-primary" onClick={() => setOpen(false)}>
                {u("close")}
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

function Mandala({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g fill="none" stroke="#e4c36a" strokeWidth="0.8">
        <circle cx="100" cy="100" r="28" />
        <circle cx="100" cy="100" r="52" />
        <circle cx="100" cy="100" r="78" />
        <path d="M100 16 L108 92 L184 100 L108 108 L100 184 L92 108 L16 100 L92 92 Z" />
        <path d="M100 38 L106 94 L162 100 L106 106 L100 162 L94 106 L38 100 L94 94 Z" />
      </g>
    </svg>
  );
}

function Count({ value, label, rating }: { value: number; label: string; rating: Rating }) {
  const color = rating === "auspicious" ? "text-[#9be7c0]" : rating === "neutral" ? "text-[#f0d78c]" : "text-[#f3b4a6]";
  return (
    <div className="rounded-3xl bg-card px-3 py-3 text-center">
      <p className={`font-serif text-3xl leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
