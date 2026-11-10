# Disha for iPhone

Native SwiftUI app for the Vaastu quiz. It lives entirely under `ios/` and does not change the web app.

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
5. Product → Test (`Cmd+U`) runs the pada, smoothing, scoring, catalog, declination, and storage tests.
6. Product → Run. The simulator has no magnetometer: on the compass, tap a direction chip or drag the gold dial, then **Lock direction**.

Screenshots worth taking: welcome, a home category page, the compass, a verdict, the score summary, and the same home page after switching to हिन्दी.

## What the app does

- Welcome, then English / हिन्दी. The first launch follows the iPhone language and remembers the choice.
- Home is one horizontal page per category (Entrance, Kitchen, Sleep, Prayer, Water, Work, Living, Outside), with a tab strip, page dots, and a gold score ring. The page lays the tiles out in the space it is given, from iPhone SE (4.7") through Pro Max, so the home screen does not scroll vertically.
- A check is the stand-and-face instruction, then a live compass. **Lock direction** averages the last second of headings and ticks the haptic engine.
- Verdicts use the same 32-pada map as the web app: 11.25° sectors, N1 at 315°, E1 at 45°, and 0°/360° = N5. Remedies come from the check. **More** opens the detail sheet. Marking a gentle remedy done gives partial credit.
- Heading uses Core Location. `trueHeading` is used after When In Use location is allowed. Otherwise the app uses `magneticHeading` plus a World Magnetic Model 2025 fallback when a location is known. The explanatory prompt is shown once. A denial stays denied and links to Settings. A poor `headingAccuracy` asks for a figure-8.
- The home score is 0–100, weighted like `rules.json`, with main door, house facing, kitchen, master bedroom, pooja, and toilet heavier. Bands are Excellent 85+, Good 70–84, Fair 50–69, Needs care below 50. The summary shows each category and the three biggest boosts. A +N/−N toast follows a verdict.
- The summary shares a card image and a PDF that states the score in English and Hindi.
- Results, language, and the “we already asked for location” flag are stored in UserDefaults.

## TestFlight and the App Store

1. Enroll in the Apple Developer Program and create an App Store Connect record for Disha.
2. In the target, set your team and a bundle id you own. Keep the display name **Disha**.
3. The 1024×1024 icon is already in the asset catalog. Archive with Product → Archive, Any iOS Device.
4. Upload from the Organizer. Fill in the privacy nutrition label: coarse location, used only for app functionality, not linked and not used for tracking. The privacy manifest is `PrivacyInfo.xcprivacy`.
5. Add a TestFlight group, install on a phone with a real compass, and walk the main door, kitchen, and a bedroom. Confirm true north against another compass after allowing location, then deny location and confirm the magnetic fallback and the Settings link.
6. For review, note that the reading is a traditional guideline, not a building instruction. The location string is in English in Info.plist and in Hindi in `hi.lproj/InfoPlist.strings`.
