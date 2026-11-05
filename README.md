# Disha — Vaastu Scanner

Disha is a mobile-first web app that turns a phone into a true-north Vaastu scanner. It reads the compass, corrects magnetic north to true north with the World Magnetic Model, and maps rooms onto the 16 traditional zones. Remedies stay non-structural: bed and desk direction, color, furniture, mirrors, and a few elements such as plants or a lamp.

Results are framed as **traditional Vaastu guidelines**, not guarantees. Everything runs in the browser. Homes are stored in `localStorage`. There is no account and no backend.

Free features (compass, desk and bed check, single-room check) and paid features (full-home scan, PDF report, saved homes) are labeled in the interface. Payments are not wired up, so every feature is unlocked in this build.

## Local development

```bash
npm install
npm run dev
```

The dev server listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test          # zone mapping, declination, geometry, rule scoring
npm run build     # typecheck and production bundle in dist/
npm run preview   # serve dist/ on port 43124
```

On a laptop there is no compass. Drag the dial, or type a heading. **New Jersey sample** on the North screen sets a location whose declination is about 12° west, which is the correction the concept note calls out. **Load the sample apartment** (Scan or Homes) drops in a floor plan with two rooms that the rules flag, so the report is not an empty all-green page.

## Deploy on Vercel

The app is a static Vite build. Vercel detects that with no dashboard settings.

1. Push this project to a Git repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave the defaults. Framework preset is **Vite**, the build command is `npm run build`, and the output directory is `dist`.
4. Do not add environment variables. Deploy.

From the Vercel CLI, in this folder:

```bash
npx vercel
```

`vercel.json` only sets a no-cache header on `sw.js` so a new deploy can replace the service worker. It does not change the build.

The site is an installable PWA: a web manifest, icons, and a small service worker. Add it to the home screen from the browser’s share sheet. iOS will ask for motion permission the first time you tap **Enable compass** — that call has to come from a tap, which the North screen does.

## What the scanner does

- **True north.** Android uses `deviceorientationabsolute` (`heading = (360 - alpha) mod 360`). iOS uses `webkitCompassHeading`, after `DeviceOrientationEvent.requestPermission()`. GPS (or a typed lat/long) feeds the `geomagnetism` package, World Magnetic Model 2025. True heading = magnetic heading + declination, east positive. The screen shows both headings, the declination, a bubble level from beta/gamma, and accuracy (`webkitCompassAccuracy` on iOS, otherwise how steady the recent headings are). A browser cannot read raw field strength, so the interference check from the concept note is a native-app feature; the web build says so and shows the field strength the model expects.
- **16-zone wheel.** Each zone is 22.5°, and North is centered on 0° (348.75°–11.25°). Colors group Water (N/NE), Fire (E/SE), Earth (S/SW), Air (W/NW), and Space at the center.
- **Desk, bed, and one room.** Point the phone, pick the type, read the zone and the verdict.
- **Full-home scan, two ways.** Point-and-tag stores the true bearing of each room from the center. A floor-plan photo can be aligned by a slider or by pointing the phone along the top edge of the drawing; taps are turned into zones from the center, and the 16-zone grid is drawn on the image.
- **Rules and remedies.** `src/data/rules.json` lists favorable and avoided zones, with the reasoning. `src/data/remedies.json` maps each weak placement to non-structural fixes. Edit the JSON to adjust a rule without touching the scoring code.
- **Report.** A color-coded diagram, room-by-room notes, a client-side PDF, and the system share sheet.
- **Saved homes.** Several properties live in `localStorage`, with a house-hunting rank.

## Web limits worth knowing

Indoors, steel and appliances pull the compass around. The app asks you to hold the phone flat, move in a figure-8, and step away from metal. In a steel-frame building, take the heading near a window and align the plan to that. Desktop browsers have no magnetometer; the manual dial is the fallback, and it is enough to try every screen.
