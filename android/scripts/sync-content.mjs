#!/usr/bin/env node
/**
 * Copy the web app's content into the Android assets folder.
 *
 *   node android/scripts/sync-content.mjs
 *
 * Reads, from the repo root:
 *   src/data/checks.json, rules.json, remedies.json
 *   src/i18n/messages.ts
 *   src/lib/l10n.ts
 * and writes android/app/src/main/assets/. Safe to re-run. Does not touch the web app.
 *
 * checks.json on main has no tier field. This script stamps tier and freeChecks
 * the same way the iOS sync does, using the freemium split:
 * house facing, main door, kitchen, master bedroom, pooja, living.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const outDir = resolve(here, "../app/src/main/assets");

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
  remedyDoneShort: { en: "A gentle remedy is in place", hi: "हल्का उपाय कर दिया है" },
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
    en: "Location is off, so this reading stays on magnetic north. You can allow location in Settings. Android will not ask again.",
    hi: "स्थान बंद है, इसलिए यह माप चुंबकीय उत्तर पर रहेगी। सेटिंग में स्थान की अनुमति दे सकते हैं। एंड्रॉइड फिर नहीं पूछेगा।",
  },
  calibration: {
    en: "The compass is unsure. Move the phone in a slow figure-8, away from steel.",
    hi: "कम्पास अनिश्चित है। फ़ोन को लोहे से दूर, धीमे 8 के आकार में घुमाएँ।",
  },
  waitingCompass: { en: "Waiting for the compass…", hi: "कम्पास का इंतज़ार…" },
  setByHand: { en: "Set the direction by hand.", hi: "दिशा हाथ से चुनें।" },
  usingMagnetic: { en: "Still magnetic north.", hi: "अभी चुंबकीय उत्तर।" },
  approximateNorth: {
    en: "True north, from the phone's magnetic model.",
    hi: "सही उत्तर, फ़ोन के चुंबकीय मॉडल से।",
  },
  boostLine: { en: "If this remedy is counted", hi: "अगर यह उपाय जुड़ जाए" },
  pointsWord: { en: "points", hi: "अंक" },
  clearConfirm: { en: "Clear every saved check in this home?", hi: "इस घर की सारी जाँचें मिटाएँ?" },
  done: { en: "Done", hi: "हो गया" },
  cancel: { en: "Cancel", hi: "रद्द करें" },
  scorePreview: { en: "Preview", hi: "झलक" },
  previewNote: {
    en: "Preview from the free checks. The full score uses every room.",
    hi: "मुफ़्त जाँचों की झलक। पूरा अंक हर कमरे को गिनता है।",
  },
  unlock: { en: "Unlock", hi: "खोलें" },
  moreRemedies: { en: "The other remedies are in Premium.", hi: "बाकी उपाय प्रीमियम में हैं।" },
  lockedFixes: { en: "Room scores and the top fixes are in Premium.", hi: "कमरों के अंक और बड़े सुधार प्रीमियम में हैं।" },
  lockedCheck: { en: "Premium", hi: "प्रीमियम" },
  bestValue: { en: "Best value", hi: "सबसे अच्छा मूल्य" },
  premiumTitle: { en: "Disha Premium", hi: "दिशा प्रीमियम" },
  premiumLine: {
    en: "All 34 checks, every remedy, the full score, and the PDF.",
    hi: "सारी 34 जाँचें, हर उपाय, पूरा अंक, और पीडीएफ़।",
  },
  paywallTitle: { en: "Disha Premium", hi: "दिशा प्रीमियम" },
  paywallLine: {
    en: "All 34 checks, every remedy, the full score, and the PDF.",
    hi: "सारी 34 जाँचें, हर उपाय, पूरा अंक, और पीडीएफ़।",
  },
  restore: { en: "Restore Purchases", hi: "खरीदारी बहाल करें" },
  restorePurchase: { en: "Restore Purchases", hi: "खरीदारी बहाल करें" },
  terms: { en: "Terms", hi: "शर्तें" },
  privacy: { en: "Privacy", hi: "गोपनीयता" },
  priceUnavailable: { en: "Price unavailable", hi: "कीमत उपलब्ध नहीं" },
  loadingPrice: { en: "Loading price…", hi: "कीमत आ रही है…" },
  savedHomes: { en: "Saved homes", hi: "सहेजे घर" },
  savedHomeOpen: { en: "This home is saved on this phone.", hi: "यह घर इस फ़ोन पर सहेजा है।" },
  savedHomeLocked: { en: "Premium keeps every saved home.", hi: "प्रीमियम हर सहेजा घर रखता है।" },
  yearlyPlan: { en: "Yearly", hi: "वार्षिक" },
  monthlyPlan: { en: "Monthly", hi: "मासिक" },
  lifetimePlan: { en: "Lifetime", hi: "जीवनभर" },
  homeReportPlan: { en: "Home Report", hi: "घर की रिपोर्ट" },
  planYearly: { en: "Yearly", hi: "वार्षिक" },
  planMonthly: { en: "Monthly", hi: "मासिक" },
  planLifetime: { en: "Lifetime", hi: "जीवनभर" },
  planReport: { en: "Home Report", hi: "घर की रिपोर्ट" },
  homeReportLine: {
    en: "Unlock every check and the PDF for this saved home.",
    hi: "इस सहेजे घर की हर जाँच और पीडीएफ़ खोलें।",
  },
  renewDisclosure: {
    en: "Payment is charged to your Google Play account at confirmation. A subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel anytime in the Play Store. If a free trial is offered, it becomes a paid subscription unless you cancel before the trial ends.",
    hi: "भुगतान पुष्टि पर आपके Google Play खाते से लिया जाता है। सदस्यता अपने आप चलती रहती है, जब तक आप वर्तमान अवधि के अंत से कम से कम 24 घंटे पहले रद्द न करें। Play Store में कभी भी बदलें या रद्द करें। मुफ़्त परीक्षण हो तो अवधि से पहले रद्द न करने पर वह सशुल्क सदस्यता बन जाता है।",
  },
  reportDisclosure: {
    en: "Home Report is a one-time purchase for one saved home on this Google account. It does not renew. Play treats it as a non-consumable, so it can be bought once and Restore Purchases returns that same home.",
    hi: "घर की रिपोर्ट इस Google खाते पर एक सहेजे घर के लिए एक बार की खरीद है। यह अपने आप नहीं चलती। Play इसे गैर-उपभोग्य मानता है, इसलिए यह एक बार खरीदी जाती है और खरीदारी बहाल करें वही घर लौटाता है।",
  },
  manageSubs: { en: "Manage subscription", hi: "सदस्यता बदलें" },
  paymentPending: { en: "Payment pending", hi: "भुगतान रुका है" },
  billingRetry: { en: "The store did not answer. Try again.", hi: "स्टोर ने जवाब नहीं दिया। फिर कोशिश करें।" },
  billingUnavailable: { en: "Play Billing is unavailable on this device.", hi: "इस फ़ोन पर Play Billing उपलब्ध नहीं है।" },
  verifyFailed: { en: "This purchase could not be verified.", hi: "यह खरीदारी सत्यापित नहीं हो पाई।" },
  settings: { en: "Settings", hi: "सेटिंग" },
  about: { en: "About", hi: "परिचय" },
  retry: { en: "Try again", hi: "फिर कोशिश करें" },
  newHome: { en: "New home", hi: "नया घर" },
  homeName: { en: "Home name", hi: "घर का नाम" },
  thisHome: { en: "This home", hi: "यह घर" },
  periodYear: { en: "year", hi: "वर्ष" },
  periodMonth: { en: "month", hi: "महीना" },
  periodWeek: { en: "week", hi: "सप्ताह" },
  daysFreeThen: { en: "{days} days free, then {price}", hi: "{days} दिन मुफ़्त, फिर {price}" },
  perPeriod: { en: "{price} per {period}", hi: "{price} प्रति {period}" },
  premiumOn: { en: "Premium is on", hi: "प्रीमियम चालू है" },
  previewScore: { en: "Preview", hi: "झलक" },
  debugBilling: { en: "Billing lab", hi: "बिलिंग प्रयोगशाला" },
  debugNote: {
    en: "Debug build. Prices below are stand-in ProductDetails, not a live Play catalog.",
    hi: "डीबग बिल्ड। नीचे की कीमतें असली Play सूची नहीं, जाँच के लिए रखी गई हैं।",
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
console.log(`Synced ${Object.keys(ordered).length} strings and 3 data files into android/app/src/main/assets`);
