import { useI18n } from "@/i18n/I18nProvider.tsx";
import { ROOM_RULES, requireRule } from "@/lib/rules.ts";
import { cn } from "@/lib/utils.ts";

export function RoomChips({
  value,
  onChange,
  ids,
}: {
  value: string;
  onChange: (id: string) => void;
  ids?: string[];
}) {
  const { t } = useI18n();
  const rules = ids ? ids.map((id) => requireRule(id)) : ROOM_RULES;
  return (
    <div className="flex flex-wrap gap-2">
      {rules.map((rule) => {
        const selected = value === rule.id;
        return (
          <button
            key={rule.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(rule.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
            )}
          >
            {t(rule.label)}
          </button>
        );
      })}
    </div>
  );
}
