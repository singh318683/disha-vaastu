import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle.tsx";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { checkGroups, verdictForHeading, type VaastuCheck } from "@/lib/checks.ts";
import { homePages, type HomePage } from "@/lib/homePages.ts";
import type { StoredQuizResult } from "@/lib/quizStore.ts";
import { CheckGlyph } from "./CheckGlyph.tsx";
import { MoodFace } from "./MoodFace.tsx";

const PAGE_KEY = "disha.homePage";

export function HomePager({
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

  const checked = savedById.size;

  return (
    <section data-screen="home" data-home-page={index} className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="eyebrow">Disha</p>
        <LanguageToggle />
      </header>
      <button
        type="button"
        onClick={onSummary}
        className="mx-4 mt-2 flex shrink-0 items-center justify-between rounded-2xl bg-primary px-4 py-2 text-left text-primary-foreground shadow-[0_12px_24px_-16px_rgba(228,195,106,0.8)]"
      >
        <span className="min-w-0">
          <span className="block font-serif text-lg leading-none">{u("homeHarmony")}</span>
          <span className="mt-0.5 block truncate text-xs text-primary-foreground/80">
            {checked === 0
              ? u("nothingChecked")
              : `${checked} ${checked === 1 ? u("placeChecked") : u("placesChecked")}`}
          </span>
        </span>
        <span aria-hidden="true" className="text-xl">
          →
        </span>
      </button>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="mt-1 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page) => (
          <CategoryPage key={page.id} page={page} savedById={savedById} onOpen={onOpen} />
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
}: {
  page: HomePage;
  savedById: Map<string, StoredQuizResult>;
  onOpen: (id: string) => void;
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
          <CheckTile key={check.id} check={check} saved={savedById.get(check.id)} compact={page.columns === 3} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function CheckTile({
  check,
  saved,
  compact,
  onOpen,
}: {
  check: VaastuCheck;
  saved: StoredQuizResult | undefined;
  compact: boolean;
  onOpen: (id: string) => void;
}) {
  const { locale, t, u } = useI18n();
  const rating = saved ? verdictForHeading(check, saved.heading, locale).rating : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(check.id)}
      aria-label={`${t(check.title)}. ${t(check.blurb)}.${rating ? ` ${u(rating)}.` : ""}`}
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e4c36a]/25 bg-card p-2.5 text-left active:scale-[0.99]"
    >
      <span className="flex items-start justify-between gap-1">
        <span className={`grid shrink-0 place-items-center rounded-xl bg-secondary text-primary ${compact ? "h-7 w-7" : "h-8 w-8"}`}>
          <CheckGlyph name={check.icon} className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        {rating && <MoodFace rating={rating} className={compact ? "h-6 w-6" : "h-7 w-7"} />}
      </span>
      <span className={`mt-1 line-clamp-2 font-serif leading-snug ${compact ? "text-[0.82rem]" : "text-base"}`}>{t(check.title)}</span>
      <span className={`mt-0.5 text-muted-foreground ${compact ? "line-clamp-2 text-[0.68rem] leading-snug" : "line-clamp-2 text-xs leading-snug"}`}>
        {t(check.blurb)}
      </span>
    </button>
  );
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
