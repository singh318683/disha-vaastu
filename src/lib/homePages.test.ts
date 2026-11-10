import { describe, expect, it } from "vitest";
import { checkGroups } from "./checks.ts";
import { homePages } from "./homePages.ts";

describe("home pages", () => {
  it("keeps each current category on one swipe page", () => {
    const pages = homePages(checkGroups());
    expect(pages.map((page) => page.group.en)).toEqual([
      "Entrance",
      "Kitchen",
      "Sleep",
      "Prayer",
      "Water",
      "Work",
      "Living",
      "Outside",
    ]);
    expect(pages.find((page) => page.group.en === "Work")?.columns).toBe(3);
    expect(pages.find((page) => page.group.en === "Living")?.checks).toHaveLength(7);
    expect(pages.find((page) => page.group.en === "Entrance")?.columns).toBe(2);
    expect(pages.every((page) => page.parts === 1)).toBe(true);
  });

  it("splits a crowded category into numbered pages of six", () => {
    const work = checkGroups().find((group) => group.group.en === "Work");
    if (!work) throw new Error("missing Work");
    const crowded = { group: { en: "Bedroom", hi: "शयनकक्ष" }, checks: [...work.checks, ...work.checks] };
    const pages = homePages([crowded]);
    expect(pages.map((page) => page.part)).toEqual([1, 2, 3]);
    expect(pages[0]?.parts).toBe(3);
    expect(pages[0]?.checks).toHaveLength(6);
    expect(pages[1]?.checks).toHaveLength(6);
    expect(pages[2]?.checks).toHaveLength(2);
    expect(pages[0]?.id).toBe("Bedroom:0");
  });
});
