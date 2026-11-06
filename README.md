# Disha — Vaastu Scanner

Disha is a mobile-first web app that turns a phone into a true-north Vaastu guide. The primary path is a calm quiz: one question per screen, a live compass, and a plain-language result. **Start** is the tap that asks iPhone for compass permission. Each check tells you where to stand and which way to face. When the reading is steady you lock it, and the true heading becomes the answer.

Checks live in `src/data/checks.json`. A new check is a new entry: instructions, icon, whether you face out or point from the center, a granularity of 8, 16, or 32, and a verdict for every zone. The 32-pada entrance map is documented in that file. Results are framed as **traditional Vaastu guidelines**, not guarantees. Remedies stay non-structural.

Completed checks roll into a Home harmony summary with a shareable card. PDF export stays available as a secondary action. The older tools — the detailed compass, floor plan, report, and saved homes — sit under **Advanced tools**.

Everything runs in the browser. Homes and quiz results are stored in `localStorage`. There is no account and no backend. Payments are not wired up, so every feature is unlocked in this build.

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

On a laptop there is no compass. Open **Details** or **Set direction** on a check and turn the ring. **New Jersey sample** on the Advanced North screen sets a location whose declination is about 12° west, which is the correction the concept note calls out. **Load the sample apartment** (Advanced → Scan or Homes) drops in a floor plan with two rooms that the rules flag, so the report is not an empty all-green page.

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

`vercel.json` tells browsers not to cache `sw.js` or the HTML shell, and it allows `accelerometer`, `gyroscope`, and `magnetometer` so a Permissions-Policy cannot silently disable the compass. It does not change the build.

The site is an installable PWA: a web manifest, icons, and a small service worker. The worker calls `skipWaiting()` and `clients.claim()`, and the page reloads when a new worker takes control, so a deploy is not stuck behind an old shell. Add it to the home screen from the browser’s share sheet. iOS will ask for motion permission the first time you tap **Start**. That call, and the `deviceorientation` listener, both run inside the tap. The heading is `webkitCompassHeading`. Advanced → North still has its own **Enable compass** button, wired the same way.

## What the quiz does

- **Guided checks.** The home screen is a grid. Main door uses the 32 entrance padas (8 per side, 11.25° each, clockwise from the corners, so 0° and 360° are N5 Soma). Other checks use 8 directions or the 16 zones, either facing out or pointing from the center of the home. Edit `src/data/checks.json` to add one. The shared screens do not change.
- **True north.** The Start tap calls `requestPermission()` synchronously, and attaches the orientation listener in that same turn. Android prefers `AbsoluteOrientationSensor` when accelerometer, gyroscope, and magnetometer are allowed. Otherwise it uses `deviceorientationabsolute` (or `deviceorientation` only when `absolute` is true). On current Android Chrome that alpha is already clockwise from north — 0 north, 90 east — and the screen angle is removed so landscape does not mirror east and west. A tilted phone uses the rotation-matrix heading instead of raw alpha. iOS is unchanged: `webkitCompassHeading`. iOS uses `webkitCompassHeading` after `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()`. If no heading arrives within 3 seconds the screen says so. GPS feeds the `geomagnetism` package, World Magnetic Model 2025. True heading = magnetic heading + declination, east positive. The quiz hides degrees until you open Details. The Advanced North screen still shows both headings, the declination, a bubble level from beta/gamma, and accuracy (`webkitCompassAccuracy` on iOS, otherwise how steady the recent headings are). A browser cannot read raw field strength, so the interference check from the concept note is a native-app feature; the web build says so and shows the field strength the model expects. The zone wedges rotate with the SVG `transform` attribute so iOS Safari actually paints the turn.
- **16-zone wheel.** Each zone is 22.5°, and North is centered on 0° (348.75°–11.25°). Colors group Water (N/NE), Fire (E/SE), Earth (S/SW), Air (W/NW), and Space at the center.
- **Desk, bed, and one room.** Point the phone, pick the type, read the zone and the verdict.
- **Full-home scan, two ways.** Point-and-tag stores the true bearing of each room from the center. A floor-plan photo can be aligned by a slider or by pointing the phone along the top edge of the drawing; taps are turned into zones from the center, and the 16-zone grid is drawn on the image.
- **Rules and remedies.** `src/data/rules.json` lists favorable and avoided zones, with the reasoning. `src/data/remedies.json` maps each weak placement to non-structural fixes. Edit the JSON to adjust a rule without touching the scoring code.
- **Report.** A color-coded diagram, room-by-room notes, a client-side PDF, and the system share sheet.
- **Saved homes.** Several properties live in `localStorage`, with a house-hunting rank.

## Web limits worth knowing

Indoors, steel and appliances pull the compass around. The app asks you to hold the phone flat, move in a figure-8, and step away from metal. In a steel-frame building, take the heading near a window and align the plan to that. Desktop browsers have no magnetometer; the manual dial is the fallback, and it is enough to try every screen.
