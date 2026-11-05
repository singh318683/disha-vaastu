/** Icon keys allowed in checks.json. The quiz maps these to drawn glyphs. */
export const CHECK_ICON_KEYS = [
  "door",
  "house",
  "pot",
  "flame",
  "bed",
  "pillow",
  "child",
  "guests",
  "flower",
  "pray",
  "spark",
  "bath",
  "drop",
  "tank",
  "septic",
  "book",
  "laptop",
  "lock",
  "sofa",
  "utensils",
  "stairs",
  "mirror",
  "tv",
  "window",
  "tree",
  "car",
  "store",
  "chair",
] as const;

export type CheckIconKey = (typeof CHECK_ICON_KEYS)[number];

export function isCheckIcon(value: string): value is CheckIconKey {
  return (CHECK_ICON_KEYS as readonly string[]).includes(value);
}
