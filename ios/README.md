# Disha for iPhone

Native SwiftUI app for the Vaastu quiz. It lives entirely under `ios/` and does not change the web app.

**On hold.** Android is the next store build. Do not start new iOS IAP work from this note. The scanner and the first StoreKit pass are in the tree; the review and interrupted-purchase follow-ups below are not built.

### Unfinished IAP (do not treat as done)

- Guideline 3.1.2: each subscription row still needs an explicit duration and the sentence “7 days free, then {displayPrice}/year” (or /month), built only from the StoreKit product. Terms of Use and Privacy Policy are on the paywall only. There is no Settings or About screen, so those links and Restore Purchases are not repeated there.
- If `Product.products` returns an empty list or throws, the paywall shows “Price unavailable” or the error string. It does not yet have a single retry state that replaces the plan buttons. A spinner is not left up (`isLoading` is cleared), but this path was never run.
- `.pending` (Ask to Buy) and `.userCancelled` return without a message. Verified transactions are finished. An unverified `Transaction.updates` event is skipped and not finished. Revocation and expiry are checked when entitlements refresh. A thrown error before `finish()` can still drop the Home Report unlock.
- Home Report calls `finish()` after `rememberReport`, which writes UserDefaults, but launch does not walk `Transaction.unfinished` to re-deliver a purchase interrupted by a kill.
- Premium access is re-read from verified `Transaction.currentEntitlements`. The Home Report grant is a local set because a finished consumable leaves that list. That cache is not rebuilt from Apple on a fresh install.
- `Transaction.updates` starts in `RootView`’s `.task`, which is as soon as the first screen appears, not before any UI.
- No StoreKitTest / `SKTestSession` cases. No sandbox matrix. On-device StoreKit 2 JWS verification is the intended check; a server App Store Server API is not required for this offline app and was not added.
- App Store Connect checklist in this file does not yet say to submit every product with the first version, or include review notes that point a reviewer at the lock icons and the paywall. Sandbox tester steps are not written out.

The web app remains the source of truth for checks, rules, remedies, and the English and Hindi strings. Refresh the copies in the bundle with:

```bash
node ios/scripts/sync-content.mjs
node ios/scripts/generate-xcodeproj.mjs
```

Open `ios/Disha.xcodeproj`. The XcodeGen spec is `ios/project.yml` if you prefer `xcodegen generate` (that rewrites the project).

## Build on a Mac

This tree was written without Xcode, so it has not been compiled here.

1. Install Xcode 16 or newer (iOS 17 SDK).
2. Open `ios/Disha.xcodeproj`.
3. Select the **Disha** scheme and an iPhone simulator (iPhone 15 or 16).
4. For a simulator build, Signing can stay automatic. For a device, set the team and replace the bundle id `com.ikshanasolutions.disha` if you do not own that prefix.
5. Product → Test (`Cmd+U`) runs the pada, smoothing, scoring, catalog, declination, storage, and entitlement tests.
6. Product → Run. The **Disha** scheme already points at `Disha.storekit`, so the paywall can be bought in the simulator without App Store Connect. If products do not load, open the scheme editor, Run → Options, and set StoreKit Configuration to `Disha.storekit`.
7. The simulator has no magnetometer: on the compass, tap a direction chip or drag the gold dial, then **Lock direction**. A lock on a tile opens the paywall. Yearly is the highlighted plan and, in the configuration file, includes a 7-day free trial.

Screenshots worth taking: welcome, a home category page, the compass, a verdict, the score summary, and the same home page after switching to हिन्दी.

## What the app does

- Welcome, then English / हिन्दी. The first launch follows the iPhone language and remembers the choice.
- Home is one horizontal page per category (Entrance, Kitchen, Sleep, Prayer, Water, Work, Living, Outside), with a tab strip, page dots, and a gold score ring. The page lays the tiles out in the space it is given, from iPhone SE (4.7") through Pro Max, so the home screen does not scroll vertically.
- A check is the stand-and-face instruction, then a live compass. **Lock direction** averages the last second of headings and ticks the haptic engine.
- Verdicts use the same 32-pada map as the web app: 11.25° sectors, N1 at 315°, E1 at 45°, and 0°/360° = N5. Remedies come from the check. **More** opens the detail sheet. Marking a gentle remedy done gives partial credit.
- Heading uses Core Location. `trueHeading` is used after When In Use location is allowed. Otherwise the app uses `magneticHeading` plus a World Magnetic Model 2025 fallback when a location is known. The explanatory prompt is shown once. A denial stays denied and links to Settings. A poor `headingAccuracy` asks for a figure-8.
- The home score is 0–100, weighted like `rules.json`, with main door, house facing, kitchen, master bedroom, pooja, and toilet heavier. Bands are Excellent 85+, Good 70–84, Fair 50–69, Needs care below 50. The summary shows each category and the three biggest boosts. A +N/−N toast follows a verdict.
- The summary shares a card image (free, with a Disha mark) and a PDF that states the score in English and Hindi. The PDF is part of Premium or a Home Report.
- Six checks are free: house facing, main door, kitchen, master bedroom, pooja, and living. The synced `checks.json` marks each check `tier` and lists `freeChecks`. A free verdict shows the first remedy. The home score is a preview of those checks until the home is unlocked. Room scores and the top fixes stay locked.
- Premium (monthly, yearly, or lifetime) unlocks all 34 checks, every remedy, the full score, the PDF, and saved-home status. Home Report is a consumable that unlocks the full reading and PDF for the one home on this iPhone. Restore Purchases restores the subscription and lifetime purchase.
- Results, language, the home id, report grants, and the “we already asked for location” flag are stored in UserDefaults.

## App Store Connect

Prices in the app always come from StoreKit. The amounts below are what to enter in App Store Connect, not strings in the UI. The simulator configuration `ios/Disha.storekit` uses the US prices so `displayPrice` has something to show.

1. Sign the Paid Apps agreement. In App Store Connect, go to Business (or Agreements, Tax, and Banking) and complete the Paid Applications agreement, plus banking and tax. In-app purchases stay in Missing Metadata until that agreement is active.
2. Create the app record for Disha with the bundle id you ship (`com.ikshanasolutions.disha` is the placeholder).
3. Subscriptions → create a group named **Disha Premium**.
4. In that group, create an auto-renewable subscription:
   - Product id `com.ikshanasolutions.disha.premium.yearly`
   - Duration 1 year, subscription level 1
   - Price $24.99 in the US and ₹999 in India
   - Introductory offer: free trial, 1 week (7 days), new subscribers
   - English and Hindi display name and description
   - Review screenshot of the paywall
5. In the same group, create:
   - Product id `com.ikshanasolutions.disha.premium.monthly`
   - Duration 1 month, level 2
   - Price $3.99 / ₹149
   - No introductory offer
   - Review screenshot
6. In-App Purchases → Non-Consumable:
   - Product id `com.ikshanasolutions.disha.premium.lifetime`
   - Price $49.99 / ₹2,499
   - Review screenshot
7. In-App Purchases → Consumable:
   - Product id `com.ikshanasolutions.disha.report.single`
   - Reference name Home Report
   - Price $6.99 / ₹299
   - This purchase unlocks every check and the PDF for one saved home on that iPhone. It does not renew, and a finished consumable is not returned by Restore Purchases. The subscription and the lifetime unlock are.
   - Review screenshot
8. Add the paywall screenshot to each product’s review information. Terms and privacy in the app are placeholders (`https://disha.example.com/terms` and `https://disha.example.com/privacy` in `StoreConfig`). Replace those URLs before review, and put the same links in App Store Connect.
9. Archive, upload, and test with a Sandbox Apple ID. In Xcode, the StoreKit configuration file is enough for the simulator; Sandbox is what exercises the real store.

## TestFlight and the App Store

1. Enroll in the Apple Developer Program and create an App Store Connect record for Disha.
2. In the target, set your team and a bundle id you own. Keep the display name **Disha**.
3. The 1024×1024 icon is already in the asset catalog. Archive with Product → Archive, Any iOS Device.
4. Upload from the Organizer. Fill in the privacy nutrition label: coarse location, used only for app functionality, not linked and not used for tracking. The privacy manifest is `PrivacyInfo.xcprivacy`.
5. Add a TestFlight group, install on a phone with a real compass, and walk the main door, kitchen, and a bedroom. Confirm true north against another compass after allowing location, then deny location and confirm the magnetic fallback and the Settings link.
6. For review, note that the reading is a traditional guideline, not a building instruction. The location string is in English in Info.plist and in Hindi in `hi.lproj/InfoPlist.strings`.
