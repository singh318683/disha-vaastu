import { describe, expect, it } from "vitest";
import { UI } from "@/i18n/messages.ts";
import checks from "../data/checks.json" with { type: "json" };
import remedies from "../data/remedies.json" with { type: "json" };
import rules from "../data/rules.json" with { type: "json" };
import { detectLocale, isL10n } from "./l10n.ts";

function walk(value: unknown, problems: string[], path: string) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, problems, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if ("en" in record || "hi" in record) {
    if (!isL10n(record)) problems.push(`${path} is missing en or hi`);
    else if (!/[\u0900-\u097F]/.test(record.hi)) problems.push(`${path} Hindi has no Devanagari: ${record.en.slice(0, 80)}`);
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    if (["id", "icon", "reference", "rating", "granularity", "version", "weight", "centerPolicy", "kind", "kinds"].includes(key)) {
      continue;
    }
    walk(child, problems, `${path}.${key}`);
  }
}

describe("bilingual copy", () => {
  it("gives every check, rule, remedy, and interface string both languages", () => {
    const problems: string[] = [];
    walk(checks, problems, "checks");
    walk(rules, problems, "rules");
    walk(remedies, problems, "remedies");
    for (const [key, value] of Object.entries(UI)) {
      if (!isL10n(value)) problems.push(`UI.${key} is missing en or hi`);
      else if (!/[\u0900-\u097F]/.test(value.hi)) problems.push(`UI.${key} Hindi has no Devanagari`);
    }
    expect(problems).toEqual([]);
  });

  it("defaults Hindi browsers to Hindi and everyone else to English", () => {
    expect(detectLocale("hi")).toBe("hi");
    expect(detectLocale("hi-IN")).toBe("hi");
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale("")).toBe("en");
  });
});
