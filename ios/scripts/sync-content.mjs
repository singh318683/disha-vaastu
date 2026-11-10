#!/usr/bin/env node
/**
 * Copy the web app's content into the iOS bundle.
 *
 *   node ios/scripts/sync-content.mjs
 *
 * Reads, from the repo root:
 *   src/data/checks.json, rules.json, remedies.json
 *   src/i18n/messages.ts
 *   src/lib/l10n.ts
 * and writes ios/Disha/Resources/. Safe to re-run. Does not touch the web app.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const outDir = resolve(here, "../Disha/Resources");

function unescape(value) {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function pairs(block) {
  const re = /(\w+):\s*L\(\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*\)/g;
  const found = {};
  for (const match of block.matchAll(re)) {
    found[match[1]] = { en: unescape(match[2]), hi: unescape(match[3]) };
  }
  return found;
}

function block(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  const end = source.indexOf("};", start);
  if (end < 0) throw new Error(`Unclosed ${marker}`);
  return source.slice(start, end);
}

const messages = readFileSync(resolve(repo, "src/i18n/messages.ts"), "utf8");
const l10n = readFileSync(resolve(repo, "src/lib/l10n.ts"), "utf8");

const ui = pairs(messages);
const directions = pairs(block(l10n, "const DIR"));
const facings = pairs(block(l10n, "const FACING"));
const elements = pairs(block(l10n, "const ELEMENT"));
for (const [key, value] of Object.entries(directions)) ui[`dir.${key}`] = value;
for (const [key, value] of Object.entries(facings)) ui[`facing.${key}`] = value;
for (const [key, value] of Object.entries(elements)) ui[`element.${key}`] = value;

const extra = {
  continueOn: { en: "Continue", hi: "आगे" },
  more: { en: "More", hi: "और" },
  remedyDone: { en: "A gentle remedy is in place", hi: "हल्का उपाय कर दिया है" },
  boosts: { en: "Biggest boosts", hi: "सबसे बड़े सुधार" },
  byArea: { en: "By area", hi: "क्षेत्रों के अनुसार" },
  needsCare: { en: "Needs care", hi: "देखभाल चाहिए" },
  bandExcellent: { en: "Excellent", hi: "उत्तम" },
  bandGood: { en: "Good", hi: "अच्छा" },
  bandFair: { en: "Fair", hi: "ठीक" },
  homeScore: { en: "Home score", hi: "घर का अंक" },
  locationTitle: { en: "True north", hi: "सही उत्तर" },
  locationBody: {
    en: "Vaastu uses geographic north. Location lets Disha correct the compass from magnetic north to true north. This is asked once, and only while the app is open. The heading itself needs no permission.",
    hi: "वास्तु भौगोलिक उत्तर मानता है। स्थान से दिशा कम्पास को चुंबकीय उत्तर से सही उत्तर पर लाती है। यह एक बार पूछा जाता है, और केवल ऐप खुला हो तब। दिशा के लिए अनुमति की ज़रूरत नहीं।",
  },
  locationAllow: { en: "Use true north", hi: "सही उत्तर लें" },
  locationSkip: { en: "Not now", hi: "अभी नहीं" },
  openSettings: { en: "Open Settings", hi: "सेटिंग खोलें" },
  deniedBody: {
    en: "Location is off, so this reading stays on magnetic north. You can allow location in Settings. iPhone will not ask again.",
    hi: "स्थान बंद है, इसलिए यह माप चुंबकीय उत्तर पर रहेगी। सेटिंग में स्थान की अनुमति दे सकते हैं। आईफ़ोन फिर नहीं पूछेगा।",
  },
  calibration: {
    en: "The compass is unsure. Lay the phone flat, step away from steel, and trace a slow figure-8.",
    hi: "कम्पास अनिश्चित है। फ़ोन सपाट रखें, लोहे से दूर हों, और धीमा 8 का आकार बनाएँ।",
  },
  waitingCompass: { en: "Waiting for the compass…", hi: "कम्पास का इंतज़ार…" },
  setByHand: { en: "Set the direction by hand.", hi: "दिशा हाथ से चुनें।" },
  usingMagnetic: { en: "Still magnetic north.", hi: "अभी चुंबकीय उत्तर।" },
  approximateNorth: {
    en: "True north is approximate here, from the World Magnetic Model.",
    hi: "यहाँ सही उत्तर अनुमान है, विश्व चुंबकीय मॉडल से।",
  },
  boostLine: { en: "If this reached the traditional best", hi: "अगर यह पारंपरिक सर्वोत्तम तक पहुँचे" },
  pointsWord: { en: "points", hi: "अंक" },
  clearConfirm: { en: "Clear every saved check on this iPhone?", hi: "इस आईफ़ोन की सारी जाँचें मिटाएँ?" },
  done: { en: "Done", hi: "हो गया" },
  pageOf: { en: "Page", hi: "पृष्ठ" },
};

for (const [key, value] of Object.entries(extra)) {
  if (!ui[key]) ui[key] = value;
}

mkdirSync(outDir, { recursive: true });
for (const name of ["checks.json", "rules.json", "remedies.json"]) {
  const raw = readFileSync(resolve(repo, "src/data", name));
  writeFileSync(resolve(outDir, name), raw);
}

const ordered = Object.fromEntries(Object.keys(ui).sort().map((key) => [key, ui[key]]));
writeFileSync(resolve(outDir, "ui.json"), `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`Synced ${Object.keys(ordered).length} strings and 3 data files into ios/Disha/Resources`);
