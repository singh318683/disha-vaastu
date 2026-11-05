import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { applyLocale, getLocale, initialLocale, lt, type L10n, type Locale } from "@/lib/l10n.ts";
import { UI, type UiKey } from "./messages.ts";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (value: L10n | string | null | undefined) => string;
  u: (key: UiKey) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  if (getLocale() !== locale) applyLocale(locale);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (next) => {
        applyLocale(next);
        setLocaleState(next);
      },
      t: (item) => lt(item, locale),
      u: (key) => UI[key][locale],
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
