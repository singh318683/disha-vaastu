import { useI18n } from "@/i18n/I18nProvider.tsx";
import { cn } from "@/lib/utils.ts";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, u } = useI18n();
  return (
    <div role="group" aria-label={u("language")} className={cn("inline-flex rounded-full bg-card p-1 ring-1 ring-[#e4c36a]/35", className)}>
      {(
        [
          ["en", "English"],
          ["hi", "हिन्दी"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={locale === id}
          onClick={() => setLocale(id)}
          className={cn(
            "h-10 rounded-full px-3 text-sm font-medium",
            locale === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
