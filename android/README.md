# Disha for Android

Native Kotlin app for the Vaastu quiz. It lives entirely under `android/` and does not change the web app.

The web app is the source of truth for checks, rules, remedies, and the English and Hindi strings. Refresh the copies in the APK with:

```bash
node android/scripts/sync-content.mjs
```

That writes `android/app/src/main/assets/` (`checks.json`, `rules.json`, `remedies.json`, `ui.json`). The script stamps `tier` and `freeChecks` when the web file does not have them yet. The free checks are house facing, main door, kitchen, master bedroom, pooja, and living.

## Build

Requirements: JDK 17+, Android SDK with platform 35 and build-tools 35 (or 34, which AGP will install).

```bash
# Point the SDK at this machine. This file is gitignored.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

cd android
./gradlew assembleDebug testDebugUnitTest lint
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

- `applicationId`: `com.ikshanasolutions.disha`
- `minSdk` 26, `compileSdk` / `targetSdk` 35
- Kotlin, Jetpack Compose, Material 3
- Play Billing Library `billing-ktx` 7.1.1
- Play services location, used only when Play services are on the device

### Install the APK

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

A debug build uses a fake Play catalog so the paywall can be exercised without a Play Console app. Set `disha.fakeBilling=false` in `android/local.properties` (or `DISHA_FAKE_BILLING=false`) to talk to real Play Billing from a debug build. Release builds always use Play Billing.

On an emulator with no magnetometer, the compass offers direction chips and a draggable dial. **Lock direction** still averages the last second and plays a haptic tick when a vibrator exists.

## What the app does

- Welcome, then English / हिन्दी. The first launch follows the phone language.
- Home is one horizontal page per category. The page lays the tiles out in the space it is given, so the home screen does not scroll vertically. Swipe between Entrance, Kitchen, Sleep, Prayer, Water, Work, Living, and Outside.
- A check shows the stand-and-face line, then a live gold compass. **Lock direction** averages the last second of headings on the circle.
- Verdicts use the same 32-pada map as the web app: 11.25° sectors, N1 at 315°, E1 at 45°, and 0°/360° = N5. A north-facing door's note is the web string, including “North-facing: Best in N3, N4, or N5”.
- The home score matches the web quiz: weights are the integers on each check, points are best 100, good 75, neutral 50, avoid 15, and a finished remedy lifts neutral to 75 or avoid to 50. Bands are Excellent 85+, Good 70–84, Fair 50–69, Needs care below 50. Coverage reads “Based on X of 34 checks”.
- The summary shares a card (free, with a Disha mark) and a PDF built with `android.graphics.pdf`. The PDF is part of Premium or a Home Report for this home.
- Results, language, homes, the “we already asked for location” flag, and the last latitude, longitude, and declination are stored on the device.

### Compass

`Sensor.TYPE_ROTATION_VECTOR`, then `TYPE_GEOMAGNETIC_ROTATION_VECTOR`, then accelerometer + magnetometer. The heading comes from `SensorManager.getRotationMatrix` / `getRotationMatrixFromVector`, `remapCoordinateSystem` for the current display rotation, and `getOrientation`. Azimuth is kept clockwise: 0° is north and 90° is east. The web compass once mirrored Android headings (`360 - alpha`), which swapped east and west. This app does not. A low-pass runs on the unit circle. `onAccuracyChanged` of `LOW` or `UNRELIABLE` shows a figure-8 calibration line. Tilt past about 40° asks for the phone to be held flat. The compass asks for no permission.

### True north

The first time the home screen appears, a royal rationale explains why location is used. **Use true north** then requests `ACCESS_COARSE_LOCATION` once. **Not now** records that the question was asked and does not ask on later launches. A denial stays denied: the compass keeps working on magnetic north, with a short note and a button that opens the app's system settings. It does not raise the system dialog again.

When permission is granted, the app reads a coarse fix from Fused Location if Play services are available, otherwise `LocationManager` last-known. Declination comes from `android.hardware.GeomagneticField` and is added to the magnetic heading (east positive). The last location and declination are cached so a later launch can correct the dial before a new fix arrives. Location is used on the device only, to compute that angle. It is not sent off the phone.

### Freemium

Free: compass, lock, language, and the six free checks. A free verdict shows the verdict and the first remedy. The home score is computed from the free checks only and labelled Preview. The share card is free and carries the Disha mark.

Premium (monthly, yearly, or lifetime): all 34 checks, every remedy, the full score with room scores and the top three fixes, the PDF, and saved homes.

Home Report (`home_report`) is a Play **non-consumable**. Play allows one purchase per Google account and keeps returning it from `queryPurchasesAsync`, including after a reinstall. The home it unlocks is the id passed as `setObfuscatedProfileId` and read back from `Purchase.accountIdentifiers`. A local cache mirrors that id. The purchase is never consumed. A second home needs Premium. If Play omits the profile id, the home that was open when the purchase completed is bound before the purchase is acknowledged.

### Play Billing

Prices on the paywall always come from `ProductDetails` (`formattedPrice`, trial phase, billing period). The debug fake supplies stand-in `formattedPrice` values so the same UI can be tested. Those stand-ins are not compiled into the release paywall.

Product ids to create in Play Console:

| Id | Type | Price to enter in Console | Notes |
| --- | --- | --- | --- |
| `premium_monthly` | Subscription | ₹149 / $3.99 | No trial |
| `premium_yearly` | Subscription | ₹999 / $24.99 | 7-day free trial offer |
| `premium_lifetime` | One-time, non-consumable | ₹2,499 / $49.99 | |
| `home_report` | One-time, non-consumable | ₹299 / $6.99 | Unlocks one home |

Handled on purpose:

1. `acknowledgePurchase` runs only after the signature verifies and the grant is stored. Unacknowledged purchases are retried on the next start or resume.
2. `ITEM_ALREADY_OWNED` queries purchases and restores. It is not shown as a failure.
3. `queryPurchasesAsync` runs on start and every resume, for subscriptions and one-time products, including a pending purchase that later becomes purchased.
4. `Purchase.products` is never read with an unguarded index. An empty list is ignored.
5. Pending shows “Payment pending”. User cancel is silent. `BILLING_UNAVAILABLE` and `SERVICE_DISCONNECTED` reconnect with backoff. An empty or failed product query shows a retry card, not a blank paywall or a spinner with no way out.
6. Home Report is the non-consumable described above.
7. The purchase signature is checked on the device with SHA1withRSA against the Play license public key. Put that key in `android/local.properties` as `BILLING_LICENSE_KEY` or in the environment as `DISHA_BILLING_LICENSE_KEY`. It is copied into `BuildConfig` and is not committed. This check can be bypassed by a modified APK. Verifying the token with the Play Developer API on a server is the recommended follow-up.
8. Restore Purchases is on the paywall and in Settings. Terms and Privacy in `Legal` are `https://disha-vaastu.vercel.app/terms` and `https://disha-vaastu.vercel.app/privacy`. The paywall states the price per period from the product, the trial when the offer has a free phase, that a subscription renews until cancelled, and links to Play subscription management.

The debug paywall has a Billing lab: pending, cancel, already owned, leave unacknowledged (then restart the app to recover it), complete pending, disconnect, empty catalog, and revoke.

## Play Console checklist

1. Create the app `com.ikshanasolutions.disha` and complete the merchant account.
2. Build a signed AAB (`./gradlew bundleRelease` after a release keystore is configured) and upload it.
3. Create the four products above, with those ids and prices. Put the yearly subscription in a subscription group and add a 7-day free-trial offer for new subscribers. Add English and Hindi names.
4. Add license testers. Upload the AAB to the internal testing track and install from that opt-in link. A debug APK sideloaded onto a device will not complete a real purchase unless it is signed with the Play app signing key and the package is the one Play knows.
5. Data safety form: location is coarse, collected for app functionality (true north), processed on device, not shared, not used for tracking. The compass sensors are not a data-safety collection. Purchases are handled by Google Play.
6. Put `https://disha-vaastu.vercel.app/terms` and `https://disha-vaastu.vercel.app/privacy` in the Play store listing. The app already opens those pages from `Legal`.
7. In the review notes, point at the lock badges and the paywall. Say the reading is a traditional guideline, not a building instruction.

## Billing test matrix

Run these on the internal track with a license tester, and again in the debug Billing lab where that lab can stand in.

| Case | What should happen |
| --- | --- |
| Interrupted purchase | Start a purchase and leave the Play sheet. Coming back does not grant until Play reports `PURCHASED`. |
| App killed mid-purchase | After Play has recorded the purchase, kill Disha before it acknowledges. Next launch calls `queryPurchasesAsync`, grants, then acknowledges. The debug lab's “Leave unacknowledged” plus a process restart covers the same path. |
| Already owned | Buying a product the account already owns does not show an error. Purchases are queried and the entitlement returns. |
| Restore on a fresh install | Clear app data or reinstall. Restore Purchases, or simply opening the app, grants Premium and the Home Report home from what Play returns. The home id travels in the purchase profile id. |
| Pending payment | A pending purchase shows “Payment pending” and does not unlock. When it becomes `PURCHASED`, the next resume grants and acknowledges. |
| Trial | The yearly row shows the free phase length and the paid `formattedPrice` from the offer, then charges only if the trial is not cancelled. |
| Refund or revocation | After Play stops returning the purchase, the next successful query drops Premium or that home's report. A failed query keeps the last good cache. |

## Reviewer code

Play review has no login. Settings has a quiet **Have a code?** row. A matching code grants Premium on that install: all 34 checks, every remedy, the full score, the PDF, and saved homes. The grant is stored in preferences and is separate from Play Billing (`isPremium` is the Play entitlement or this flag). **Remove code** clears only the local grant.

The repository holds the SHA-256 hex of the code, not the code. It is `ReviewCode.DIGEST` in `android/app/src/main/java/com/ikshanasolutions/disha/model/ReviewCode.kt`. To rotate it, choose a new code, trim it, uppercase it, and replace that constant with the hex digest. Do not commit the code.

```bash
python3 -c 'import hashlib,sys; text=sys.argv[1].strip().upper(); print(hashlib.sha256(text.encode()).hexdigest())' 'new code'
```

The field trims and uppercases before hashing, so the digest is of that trimmed uppercase text. Share the new code with the reviewer outside the repo.

## Fonts

Cormorant Garamond (headings) and Noto Sans Devanagari (Hindi) are under `android/app/src/main/res/font/`. Both are licensed under the SIL Open Font License. The license texts are in `android/third_party/fonts/`.
