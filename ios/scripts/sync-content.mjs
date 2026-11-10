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

const CANONICAL_FREE_CHECKS = [
  "house_facing",
  "main_door",
  "kitchen",
  "master_bedroom",
  "pooja",
  "living",
];

function stampAccess(raw) {
  const catalog = JSON.parse(raw);
  const declared = Array.isArray(catalog.freeChecks) ? catalog.freeChecks.filter((id) => typeof id === "string") : null;
  const freeIds = new Set(declared && declared.length ? declared : CANONICAL_FREE_CHECKS);
  const tierOf = new Map();
  for (const check of catalog.checks) {
    if (check.tier === "free" || check.tier === "premium") tierOf.set(check.id, check.tier);
    else tierOf.set(check.id, freeIds.has(check.id) ? "free" : "premium");
  }
  let text = raw.replace(/^ {6}"id": "([A-Za-z0-9_]+)",(?!\r?\n {6}"tier":)/gm, (line, id) => {
    const tier = tierOf.get(id);
    if (!tier) return line;
    return `${line}\n      "tier": "${tier}",`;
  });
  if (!text.includes('"freeChecks"')) {
    const list = JSON.stringify(CANONICAL_FREE_CHECKS);
    text = text.replace(/"version":\s*(\d+),/, `"version": $1,\n  "freeChecks": ${list},`);
  }
  return text;
}

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
  scorePreview: { en: "Preview", hi: "झलक" },
  previewNote: {
    en: "Preview from the free checks. The full score uses every room.",
    hi: "मुफ़्त जाँचों की झलक। पूरा अंक हर कमरे को गिनता है।",
  },
  unlock: { en: "Unlock", hi: "खोलें" },
  moreRemedies: { en: "The other remedies are in Premium.", hi: "बाकी उपाय प्रीमियम में हैं।" },
  bestValue: { en: "Best value", hi: "सबसे अच्छा मूल्य" },
  premiumTitle: { en: "Disha Premium", hi: "दिशा प्रीमियम" },
  premiumLine: {
    en: "All 34 checks, every remedy, the full score, and the PDF.",
    hi: "सारी 34 जाँचें, हर उपाय, पूरा अंक, और पीडीएफ़।",
  },
  restore: { en: "Restore Purchases", hi: "खरीदारी बहाल करें" },
  terms: { en: "Terms", hi: "शर्तें" },
  privacy: { en: "Privacy", hi: "गोपनीयता" },
  priceUnavailable: { en: "Price unavailable", hi: "कीमत उपलब्ध नहीं" },
  loadingPrice: { en: "Loading price…", hi: "कीमत आ रही है…" },
  savedHomes: { en: "Saved homes", hi: "सहेजे घर" },
  savedHomeOpen: { en: "This home is saved on this iPhone.", hi: "यह घर इस आईफ़ोन पर सहेजा है।" },
  savedHomeLocked: { en: "Premium keeps every saved home.", hi: "प्रीमियम हर सहेजा घर रखता है।" },
  yearlyPlan: { en: "Yearly", hi: "वार्षिक" },
  monthlyPlan: { en: "Monthly", hi: "मासिक" },
  lifetimePlan: { en: "Lifetime", hi: "जीवनभर" },
  homeReportPlan: { en: "Home Report", hi: "घर की रिपोर्ट" },
  homeReportLine: {
    en: "Unlock every check and the PDF for this saved home.",
    hi: "इस सहेजे घर की हर जाँच और पीडीएफ़ खोलें।",
  },
  renewDisclosure: {
    en: "Payment is charged to your Apple ID at confirmation. A subscription renews automatically unless you cancel at least 24 hours before the end of the current period. The account is charged for renewal within 24 hours before the period ends. Manage or cancel in Settings → Apple ID → Subscriptions. If a free trial is offered, it becomes a paid subscription unless you cancel before the trial ends.",
    hi: "भुगतान पुष्टि पर आपके Apple ID से लिया जाता है। सदस्यता अपने आप चलती रहती है, जब तक आप वर्तमान अवधि के अंत से कम से कम 24 घंटे पहले रद्द न करें। नवीनीकरण का शुल्क अवधि समाप्त होने से 24 घंटे के अंदर लिया जाता है। सेटिंग → Apple ID → Subscriptions में बदलें या रद्द करें। मुफ़्त परीक्षण हो तो अवधि से पहले रद्द न करने पर वह सशुल्क सदस्यता बन जाता है।",
  },
  reportDisclosure: {
    en: "Home Report is a one-time purchase for this saved home on this iPhone. It does not renew. Restore Purchases restores the subscription and lifetime unlock.",
    hi: "घर की रिपोर्ट इस आईफ़ोन पर इस सहेजे घर के लिए एक बार की खरीद है। यह अपने आप नहीं चलती। खरीदारी बहाल करें सदस्यता और जीवनभर की खरीद लौटाता है।",
  },
};

for (const [key, value] of Object.entries(extra)) {
  if (!ui[key]) ui[key] = value;
}

mkdirSync(outDir, { recursive: true });
for (const name of ["rules.json", "remedies.json"]) {
  writeFileSync(resolve(outDir, name), readFileSync(resolve(repo, "src/data", name)));
}
const checksRaw = readFileSync(resolve(repo, "src/data/checks.json"), "utf8");
writeFileSync(resolve(outDir, "checks.json"), stampAccess(checksRaw));

const ordered = Object.fromEntries(Object.keys(ui).sort().map((key) => [key, ui[key]]));
writeFileSync(resolve(outDir, "ui.json"), `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`Synced ${Object.keys(ordered).length} strings and 3 data files into ios/Disha/Resources`);
