import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { directionFromHeading } from "@/lib/bearings.ts";
import { directionName } from "@/lib/l10n.ts";
import { phoneIsLevel } from "@/lib/heading.ts";
import {
  CHECK_CATALOG,
  CHECKS,
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
  const { t, u } = useI18n();
  return (
    <section data-screen="welcome" className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 py-10">
      <Mandala className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 opacity-50" />
      <div className="relative flex items-center justify-between">
        <p className="eyebrow">Disha</p>
        <LanguageToggle />
      </div>
      <div className="relative">
        <h1 className="max-w-[12ch] text-[3.25rem] leading-[1.15]">{u("welcomeTitle")}</h1>
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
  const { locale, t, u } = useI18n();
  const groups = checkGroups();
  const checked = savedById.size;
  return (
    <section data-screen="home" className="px-4 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Disha</p>
        <LanguageToggle />
      </div>
      <h1 className="mt-2 text-4xl leading-[1.15]">{u("whatCheck")}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{u("standPoint")}</p>
      {checked > 0 && (
        <button
          type="button"
          onClick={onSummary}
          className="mt-5 flex w-full items-center justify-between rounded-3xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-[0_16px_32px_-18px_rgba(228,195,106,0.8)]"
        >
          <span>
            <span className="block font-serif text-2xl leading-none">{u("homeHarmony")}</span>
            <span className="mt-1 block text-sm text-primary-foreground/80">
              {checked} {checked === 1 ? u("placeChecked") : u("placesChecked")}
            </span>
          </span>
          <span aria-hidden="true" className="text-2xl">
            →
          </span>
        </button>
      )}
      {groups.map((group) => (
        <div key={group.group.en} className="mt-8">
          <h2 className="text-2xl leading-snug">{t(group.group)}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {group.checks.map((check) => {
              const saved = savedById.get(check.id);
              const rating = saved ? verdictForHeading(check, saved.heading, locale).rating : null;
              return (
                <button
                  key={check.id}
                  type="button"
                  onClick={() => onOpen(check.id)}
                  aria-label={`${t(check.title)}. ${t(check.blurb)}.${rating ? ` ${u(rating)}.` : ""}`}
                  className="flex min-h-36 flex-col items-start rounded-3xl border border-[#e4c36a]/25 bg-card p-4 text-left shadow-[0_18px_36px_-24px_rgba(0,0,0,0.75)] active:scale-[0.99]"
                >
                  <span className="flex w-full items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary">
                      <CheckGlyph name={check.icon} />
                    </span>
                    {rating && <MoodFace rating={rating} className="h-8 w-8" />}
                  </span>
                  <span className="mt-3 font-serif text-xl leading-snug">{t(check.title)}</span>
                  <span className="mt-1 text-sm leading-snug text-muted-foreground">{t(check.blurb)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" onClick={onAdvanced} className="mt-10 w-full rounded-3xl px-4 py-4 text-base text-muted-foreground">
        {u("advanced")}
        <span className="mt-1 block text-sm">{u("advancedHint")}</span>
      </button>
    </section>
  );
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
    <section data-screen="lock" data-reference={check.reference} className="flex min-h-dvh flex-col px-5 pt-5 pb-8">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label={u("back")} className="grid h-12 w-12 place-items-center rounded-full bg-card">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="min-w-0 flex-1 text-3xl leading-snug">{t(check.title)}</h1>
        <LanguageToggle />
      </div>
      <p className="mt-5 text-lg leading-relaxed">{t(check.instructions)}</p>
      <div className="mt-6">
        <CompassDial
          heading={heading}
          label={label}
          interactive={!live}
          onHeading={live ? undefined : sensors.setHeadingFromUser}
        />
      </div>
      <div className="mt-4 min-h-12 text-center text-base leading-snug text-muted-foreground" role="status" aria-live="polite">
        {promptKind === "steady" ? <SteadyPrompt /> : <p>{u(promptKind)}</p>}
        {sensors.noisy && <p className="mt-1 text-sm">{u("figure8")}</p>}
      </div>
      {sensors.effective.basis === "live-magnetic" && (
        <button type="button" className="text-center text-sm text-primary" onClick={sensors.requestLocation}>
          {u("magneticHint")}
        </button>
      )}
      {askPermission ? (
        <Button className="mt-2 h-14 w-full text-lg" disabled={waiting} onClick={enableCompass}>
          {sensors.permission === "denied" ? u("tryCompass") : u("enableCompass")}
        </Button>
      ) : (
        <Button className="mt-2 h-14 w-full text-lg" disabled={waiting} onClick={onLock}>
          {waiting ? u("waiting") : u("lock")}
        </Button>
      )}
      {askPermission && (
        <Button className="mt-3 h-12 w-full" variant="secondary" onClick={onLock}>
          {u("lockRing")}
        </Button>
      )}
      {!live && sensors.magneticHeading != null && (
        <button type="button" className="mt-3 text-sm text-primary" onClick={sensors.followLive}>
          {u("followLive")}
        </button>
      )}
      <details className="mt-4 rounded-3xl bg-card px-4 py-3">
        <summary className="cursor-pointer text-base font-medium">{u("details")}</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
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
      </details>
      {!live && (
        <details className="mt-3 rounded-3xl bg-card px-4 py-3">
          <summary className="cursor-pointer text-base font-medium">{u("setDirection")}</summary>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {directions.map(([name, degrees]) => (
              <button
                key={name}
                type="button"
                onClick={() => sensors.setHeadingFromUser(degrees)}
                className="h-12 rounded-2xl bg-secondary text-base font-medium"
              >
                {directionName(name, locale)}
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
  const { locale, u } = useI18n();
  const check = requireCheck(id);
  const verdict = verdictForHeading(check, saved?.heading ?? 0, locale);
  return (
    <section data-screen="verdict" className="px-5 pt-5 pb-10">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onHome} className="grid h-12 w-12 place-items-center rounded-full bg-card" aria-label={u("back")}>
          <ChevronLeft className="h-6 w-6" />
        </button>
        <LanguageToggle />
      </div>
      <VerdictBody verdict={verdict} trueNorth={saved?.trueNorth !== false} />
      <div className="mt-6 grid gap-3">
        <Button className="h-14 text-lg" onClick={onHome}>
          {u("checkAnother")}
        </Button>
        <Button className="h-12" variant="secondary" onClick={onRetake}>
          {u("retake")}
        </Button>
        {canSummarize && (
          <button type="button" onClick={onSummary} className="py-2 text-base text-primary">
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
    <div>
      <div className="mt-4 flex items-center gap-3">
        <MoodFace rating={verdict.rating} className="h-16 w-16" />
        <p className="font-serif text-3xl leading-none">{u(verdict.rating)}</p>
      </div>
      <h1 className="mt-5 text-4xl leading-tight">{verdict.placementLine}</h1>
      {verdict.check.granularity === 32 && <p className="mt-2 text-lg">{verdict.slotLine}</p>}
      {verdict.toward && <p className="mt-1 text-base text-muted-foreground">{verdict.toward}</p>}
      <p className="mt-4 text-lg leading-relaxed">{verdict.meaning}</p>
      <div className="mt-4 rounded-3xl border border-[#e4c36a]/25 bg-secondary px-4 py-4">
        <p className="text-base leading-relaxed">{verdict.bestNote}</p>
      </div>
      {ideal ? (
        <p className="mt-4 text-lg leading-relaxed">{u("nothingToMove")}</p>
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
        <p className="mt-3 text-sm text-primary">{u("stillMagnetic")}</p>
      )}
      <details className="mt-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-base font-medium text-foreground">{u("details")}</summary>
        <p className="mt-2 leading-relaxed">
          {formatHeading(verdict.heading)} · {verdict.directionLabel} · {verdict.slotId}
          {verdict.check.detailNote ? ` · ${t(verdict.check.detailNote)}` : ""}
        </p>
      </details>
      <p className="mt-4 text-sm text-muted-foreground">{t(CHECK_CATALOG.framing)}</p>
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
    <section data-screen="summary" className="px-5 pt-5 pb-12">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} aria-label={u("back")} className="grid h-12 w-12 place-items-center rounded-full bg-card">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <LanguageToggle />
      </div>
      <p className="eyebrow mt-4">{u("homeHarmony")}</p>
      <h1 className="mt-2 text-4xl leading-snug">{harmony.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{harmony.line}</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Count value={harmony.auspicious} label={u("auspicious")} rating="auspicious" />
        <Count value={harmony.neutral} label={u("neutral")} rating="neutral" />
        <Count value={harmony.inauspicious} label={u("toSoften")} rating="inauspicious" />
      </div>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 && <li className="text-base text-muted-foreground">{u("nothingChecked")}</li>}
        {rows.map((row) => (
          <li key={row.verdict.check.id} className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3">
            <MoodFace rating={row.verdict.rating} className="h-10 w-10" />
            <span>
              <span className="block font-medium">{t(row.verdict.check.title)}</span>
              <span className="block text-sm text-muted-foreground">{row.verdict.placementLine}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-3">
        <Button className="h-14 text-lg" disabled={busy !== null || rows.length === 0} onClick={() => void shareCard()}>
          {busy === "card" ? u("makingCard") : u("shareCard")}
        </Button>
        <Button className="h-12" variant="outline" disabled={busy !== null || rows.length === 0} onClick={() => void savePdf()}>
          {busy === "pdf" ? u("makingPdf") : u("downloadPdf")}
        </Button>
      </div>
      {note && <p className="mt-3 text-center text-sm text-muted-foreground">{note}</p>}
      <p className="mt-4 text-sm text-muted-foreground">{t(CHECK_CATALOG.framing)}</p>
      {rows.length > 0 && (
        <button type="button" onClick={onClear} className="mt-4 text-sm text-muted-foreground underline">
          {u("clearChecks")}
        </button>
      )}
    </section>
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
