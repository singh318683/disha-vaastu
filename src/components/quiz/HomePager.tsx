import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle.tsx";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { checkGroups, verdictForHeading, type VaastuCheck } from "@/lib/checks.ts";
import { homePages, type HomePage } from "@/lib/homePages.ts";
import type { HomeScore } from "@/lib/homeScore.ts";
import type { StoredQuizResult } from "@/lib/quizStore.ts";
import { CheckGlyph } from "./CheckGlyph.tsx";
import { MoodFace } from "./MoodFace.tsx";
import { ScoreRing } from "./ScoreRing.tsx";

const PAGE_KEY = "disha.homePage";

export function HomePager({
  savedById,
  onOpen,
  onSummary,
  onAdvanced,
  report,
  premium,
}: {
  savedById: Map<string, StoredQuizResult>;
  onOpen: (id: string) => void;
  onSummary: () => void;
  onAdvanced: () => void;
  report: HomeScore;
  premium: boolean;
}) {
  const { t, u } = useI18n();
  const pages = useMemo(() => homePages(checkGroups()), []);
  const scroller = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [index, setIndex] = useState(() => savedIndex(pages));

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      el.scrollLeft = index * el.clientWidth;
    });
    return () => window.cancelAnimationFrame(frame);
    // Restore once, after the scroller has a width. Later swipes update the index themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tab = tabs.current[index];
    const row = strip.current;
    if (!tab || !row) return;
    const left = tab.offsetLeft - row.clientWidth / 2 + tab.clientWidth / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [index]);

  function remember(next: number) {
    const page = pages[next];
    if (!page) return;
    setIndex(next);
    try {
      localStorage.setItem(PAGE_KEY, page.id);
    } catch {
      /* Private mode can refuse storage. The swipe still works. */
    }
  }

  function go(next: number) {
    const el = scroller.current;
    const clamped = Math.min(pages.length - 1, Math.max(0, next));
    if (!el) {
      remember(clamped);
      return;
    }
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    remember(clamped);
  }

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next === index || next < 0 || next >= pages.length) return;
    remember(next);
  }

  return (
    <section data-screen="home" data-home-page={index} className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="eyebrow">Disha</p>
        <LanguageToggle />
      </header>
      <button
        type="button"
        onClick={onSummary}
        data-score={report.score ?? ""}
        className="mx-4 mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-[#e4c36a]/40 bg-card px-3 py-1.5 text-left shadow-[0_12px_24px_-18px_rgba(228,195,106,0.7)]"
      >
        <ScoreRing score={report.score} size={46} caption={report.score == null ? u("noScoreYet") : `${report.score}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-lg leading-none text-primary">
            {report.band ? `${premium ? "" : `${u("previewScore")} · `}${u(bandKey(report.band))}` : u("noScoreYet")}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {fill(u("basedOn"), { done: report.done, total: report.total })}
            {report.score != null ? ` · ${u(trustKey(report.confidence))}` : ""}
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-primary">
          →
        </span>
      </button>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="mt-1 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page) => (
          <CategoryPage key={page.id} page={page} savedById={savedById} onOpen={onOpen} premium={premium} />
        ))}
      </div>
      <nav className="shrink-0 px-3 pt-2 pb-[max(0.45rem,env(safe-area-inset-bottom))]" aria-label={u("categories")}>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label={u("previous")}
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-foreground disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-center gap-1.5">
            {pages.map((page, dot) => (
              <button
                key={page.id}
                type="button"
                aria-label={pageTitle(page, t)}
                aria-current={dot === index ? "page" : undefined}
                onClick={() => go(dot)}
                className={dot === index ? "h-2 w-5 rounded-full bg-primary" : "h-2 w-2 rounded-full bg-[#e4c36a]/40"}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label={u("next")}
            disabled={index === pages.length - 1}
            onClick={() => go(index + 1)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-foreground disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div ref={strip} className="mt-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((page, dot) => (
            <button
              key={page.id}
              ref={(node) => {
                tabs.current[dot] = node;
              }}
              type="button"
              aria-current={dot === index ? "page" : undefined}
              onClick={() => go(dot)}
              className={
                dot === index
                  ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {pageTitle(page, t)}
            </button>
          ))}
          <button type="button" onClick={onAdvanced} className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground">
            {u("advanced")}
          </button>
        </div>
      </nav>
    </section>
  );
}

function CategoryPage({
  page,
  savedById,
  onOpen,
  premium,
}: {
  page: HomePage;
  savedById: Map<string, StoredQuizResult>;
  onOpen: (id: string) => void;
  premium: boolean;
}) {
  const { t } = useI18n();
  const rows = Math.ceil(page.checks.length / page.columns);
  return (
    <div data-home-slide={page.id} className="flex h-full w-full shrink-0 snap-start flex-col px-4 pt-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary">
          <CheckGlyph name={page.icon} className="h-5 w-5" />
        </span>
        <h1 className="min-w-0 flex-1 truncate font-serif text-[1.7rem] leading-none">{pageTitle(page, t)}</h1>
      </div>
      <div
        className={page.columns === 3 ? "mt-2 grid min-h-0 flex-1 content-start grid-cols-3 gap-1.5" : "mt-2 grid min-h-0 flex-1 content-start grid-cols-2 gap-2"}
        style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
      >
        {page.checks.map((check) => (
          <CheckTile key={check.id} check={check} saved={savedById.get(check.id)} compact={page.columns === 3} locked={!premium && check.tier === "premium"} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function CheckTile({
  check,
  saved,
  compact,
  locked,
  onOpen,
}: {
  check: VaastuCheck;
  saved: StoredQuizResult | undefined;
  compact: boolean;
  locked: boolean;
  onOpen: (id: string) => void;
}) {
  const { locale, t, u } = useI18n();
  const rating = saved ? verdictForHeading(check, saved.heading, locale).rating : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(check.id)}
      data-locked={locked ? "true" : undefined}
      aria-label={`${t(check.title)}. ${t(check.blurb)}.${locked ? ` ${u("lockedCheck")}.` : ""}${rating ? ` ${u(rating)}.` : ""}`}
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e4c36a]/25 bg-card p-2.5 text-left active:scale-[0.99]"
    >
      <span className="flex items-start justify-between gap-1">
        <span className={`grid shrink-0 place-items-center rounded-xl bg-secondary text-primary ${compact ? "h-7 w-7" : "h-8 w-8"}`}>
          <CheckGlyph name={check.icon} className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        {locked ? <Lock className="h-4 w-4 text-primary" aria-hidden="true" /> : rating && <MoodFace rating={rating} className={compact ? "h-6 w-6" : "h-7 w-7"} />}
      </span>
      <span className={`mt-1 line-clamp-2 font-serif leading-snug ${compact ? "text-[0.82rem]" : "text-base"}`}>{t(check.title)}</span>
      <span className={`mt-0.5 text-muted-foreground ${compact ? "line-clamp-2 text-[0.68rem] leading-snug" : "line-clamp-2 text-xs leading-snug"}`}>
        {t(check.blurb)}
      </span>
    </button>
  );
}

function bandKey(band: NonNullable<HomeScore["band"]>): "scoreExcellent" | "scoreGood" | "scoreFair" | "scoreCare" {
  if (band === "excellent") return "scoreExcellent";
  if (band === "good") return "scoreGood";
  if (band === "fair") return "scoreFair";
  return "scoreCare";
}

function trustKey(confidence: HomeScore["confidence"]): "scoreTrustLow" | "scoreTrustMid" | "scoreTrustHigh" {
  if (confidence === "low") return "scoreTrustLow";
  if (confidence === "mid") return "scoreTrustMid";
  return "scoreTrustHigh";
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function pageTitle(page: HomePage, t: (value: HomePage["group"]) => string): string {
  const name = t(page.group);
  return page.parts > 1 ? `${name} ${page.part}/${page.parts}` : name;
}

function savedIndex(pages: HomePage[]): number {
  try {
    const id = localStorage.getItem(PAGE_KEY);
    const index = pages.findIndex((page) => page.id === id);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}
