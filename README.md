# SquarePutt

Putting practice, stroke analysis and drills for the **Square Golf launch monitor** (Home Edition), and any launch monitor that speaks the **GSPro Open Connect** protocol.

You putt on your real mat; SquarePutt rolls the ball on a virtual green with realistic speed, slope and cup physics, shows what your stroke did, and turns practice into scored drills.

Built with Next.js (App Router), TypeScript, Three.js and Tailwind CSS. Runs in the browser; a tiny local bridge connects your launch monitor.

---

## Getting started

Requires Node.js 18+ (tested on 22). Run in Chrome or Edge for Bluetooth.

```bash
npm install
npm run dev            # open http://localhost:3000
```

No launch monitor? Use **Hit a virtual putt** (bottom-left of the green) to play every mode with simulated strokes.

### Connecting your Square (Bluetooth, no extra software)

Use **Chrome or Edge** on your laptop (Mac, Windows or ChromeOS). Web Bluetooth is not available in Safari or Firefox.

1. Turn the Square on. Close the Square app / GSPro connector on other devices — the monitor talks to one app at a time.
2. In SquarePutt, click the status pill in the top bar → **Connect Square**, and pick `SquareGolf(…)` from the browser's list.
3. SquarePutt selects the putter (which puts the monitor in putting mode), arms ball detection and keeps the link alive. The top bar shows when a ball is detected and ready. Putt.
4. Place the ball using the guide in the top-right corner. The dot is where the Square sees the ball; the green box is its read zone, learned from the Square's own readings. When the ball is set, you hear a ding and the guide fades.

The Square decides its own read zone and its LED colour; SquarePutt can show the zone but can't move it. The zone differs by model: the ball sits about 5 cm (2 in) in front of an Omni but about 23 cm (9 in) in front of a Home Edition, and the Home Edition's zone is smaller. Pick your model in the guide to see the right placement. At the edge of the zone the Square flickers between ready and not ready, so SquarePutt waits for 0.4 s of steady "ready" before calling the ball set.

How it works: SquarePutt speaks the Square's Bluetooth protocol directly (`src/lib/squareBle.ts`). The two models share a Bluetooth service but use different message dialects.

- **Home Edition** follows [squaregolf-connector](https://github.com/brentyates/squaregolf-connector):
  - commands are prefixed `0x11`
  - the putter code is `01 07`
  - the shot capacitor's charge is polled until it reports charged
  - ball speed, launch, start direction and spin are read. The Home Edition reports no club data (face, path) for putts: its club reply's validity byte is 0. Testing found it measures the club only on real swings (a wedge chip came back with full club data), not on putts in any club mode, so SquarePutt always reads putts in putter mode and doesn't show face or path.
  - the device state is in byte 3 of `11 03` (byte 2 is a counter), as seen on real hardware.
- **Omni** follows [allsquare](https://github.com/divotmaker/allsquare) (MIT/Apache-2.0):
  - the putter code is `01 03`
  - units are set on connect
  - path, face, attack, loft and club speed are requested after each putt.

The model is detected from the Square's advertisement when Chrome allows it. Otherwise, set it with the Home Edition / Omni switch in the launch monitor panel; the default is Home Edition. SquarePutt re-arms the Square about a second after each putt, and again if it reports idle, so you can putt continuously without reconnecting. If putts aren't read, the panel's **Test arming** button and raw message log show what the monitor answers to. Not affiliated with or endorsed by Square Golf.

### Other launch monitors (GSPro connector bridge)

For other GSPro-compatible monitors: close GSPro, run `npm run bridge` in a second terminal, and connect the monitor's GSPro connector as usual. The bridge plays GSPro's part on 127.0.0.1:921, selects the putter, and relays shots to the app on ws://127.0.0.1:9210. Options: `npm run bridge -- --gspro-port 921 --ws-port 9210 --handed LH --verbose`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run bridge` | Bridge for GSPro-connector monitors (TCP 921 → WebSocket 9210) |
| `npm run lint` | ESLint |
| `npm run check:physics` | Prints physics calibration, green slope statistics and aim-solver results |

---

## Modes

### Practice
Free putting at any distance (3–50 ft), slope (Flat, Mild, Medium, Hard) and green speed (stimp 9–12). **New green** generates a different contour. The read panel tells you the putt like a caddie would: distance, uphill/downhill in inches, break direction and slope %, where to aim ("inside left edge", "1.5 cups right") and the ideal ball speed.

**After each putt** (Settings): stay on the **same putt**, move to a **new green after a make**, or play a **random** putt every time (any green and pin, mild to hard slope, 3–35 ft).

### Short putts — Pressure circle
Twelve balls sit evenly around a random hole on a **2, 3 or 4 ft circle** (your choice), all shown on the green. Each comes from a different side, so every putt breaks differently. Putt them in order around the clock:
- **12 in a row:** mini celebration, then 12 new balls on the same hole.
- **24 in a row:** mega celebration, then 12 more.
- **36 in a row:** you win the level, with the option to move up to the next circle size.
- **A miss:** start again from ball 1 on a different hole.

The panel tracks your run, which ball you're on in the set, best run, make %, holes played and start-line spread.

### Lag putts — Leapfrog
The classic pace-control ladder, for feeling small, step-by-step changes in distance. Every putt goes from the same spot along a 30 ft ladder drawn on the green (rungs every 3 ft, red line at 30 ft, no hole).
- Roll the first ball just past the **3 ft rung**.
- Roll each next ball **just past the previous one**, as close to it as you can. The balls stay on the green where they finished.
- A ball that comes up **short of the last one**, or rolls **past the 30 ft line** (or off the green), ends the round, and you start again on a **different green**.
- **Your score** is how many balls you fitted in.

The panel shows a ladder strip with each ball's finish, the room left, your best and your recent rounds. Leapfrog putts have no hole, so they're left out of make %, strokes gained and reading stats.

### The Scramble
A 9- or 18-hole putting round. Each hole is a new green, distance (6–40 ft) and break. You putt out from wherever the ball stops; anything inside the gimme circle is given (gimme grows with putt length, 1.5–3.8 ft). Par is two putts per hole. Shows score to par, a scorecard, and **strokes gained** against the PGA Tour putting baseline, plus one-putts, three-putts and first-putt proximity.

### Stats
Pick who to compare against: **PGA Tour, scratch, 5, 10, 15 or 20 handicap**. Then see:
- **Strokes gained** per putt, per 18 holes and in total, and per distance band. Each putt scores expected putts from where it started − 1 − expected putts from where it finished.
- **Make % by distance** with that baseline marked.
- A scatter of where missed putts finish.
- Average pace and start-line bias.
- Green-reading accuracy.
- Personal bests, and export / import / clear of your data.

Filter by under 10 ft, 10–20 ft or 20 ft+.

Baselines: the PGA Tour figures are Broadie's ShotLink table. The amateur ones are built from Shot Scope make rates by handicap (published by MyGolfSpy, 2025) plus a 3-putt chance shaped like the Tour's and scaled to Lou Stagner's Arccos 3-putt rates from ~38 ft. Nobody publishes full expected-putts tables by handicap, so treat them as close approximations (`src/lib/baselines.ts`).

---

## What you see after each putt

- Everything appears **when the ball stops**, not when it's struck: result, grades, markers and drill scores.
- **Result:** holed, lipped out, off the green, or e.g. "2.1 ft short, 3 in left".
- **Ball speed** and how it compares with the ideal speed for that putt ("4% firm").
- **Start line** and how far it was from the start line you chose ("0.5° right of your line").
- **Launch angle, spin, skid and roll distance**, with a note if launch is too low or high.
- **Last 10 putts:** start line (against your line) and pace trend, with start-line spread graded.

The Square measures the ball, not the putter, so SquarePutt shows no face or path.

### Diagnosis: read, start line or pace?

When you choose your own start line, every putt is split into its three parts, with a one-line verdict ("Misread", "Pace cost it", "Holed — read, line and pace all good"):

- **Read:** SquarePutt rolls *your* chosen line at perfect pace. If it drops, the read was good. If not, it says by how many degrees you under-read or over-read (or how far left/right of a straight putt you aimed) and what share of the break you played: "Under-read 2.1° · 26% of break". Degrees match the aim control; the percentage reads the same at any distance and is the usual coaching measure (most golfers play well under half the real break).
- **Start line:** good within ~1.5 in at the hole (never stricter than 0.5°).
- **Pace:** judged by where the ball ends up. Holed, or it reached the hole and finished no more than 1.5 ft past (5% of the putt on long ones). Shown with % firm/soft against the ideal pace.
- **Read and pace are linked:** a firmer putt needs less break, a softer one more. When the pace was off, the diagnosis says which line would have holed *at the pace you hit*, that even the centre line lips out at that pace, or that no line reaches.

The overall grade includes the read. With **Read + line** on, the read isn't tested: you're putting on the ideal line.

**Stats → Green reading** collects this over time:
- how often your reads would hole at perfect pace
- the average gap between your start direction and the ideal one, in degrees
- how much of the break you play on breaking putts (100% = the ideal amount)
- how often you under-read vs over-read
- what cost your misses (read, start line, pace).

### Choosing your start line

Before each putt, pick the direction you intend to start the ball. Tap **◀ ▶** (bottom right of the green), press the **← →** arrow keys, or use a presentation remote (its **Page Up / Page Down** buttons). Steps are 0.25° up to 1.5°, then 0.5° up to 3°, then 1° up to 15°. Hold a button to keep moving, and tap the readout to go back to straight at the hole. The box shows only the angle (e.g. "1.25° left"), and the green shows a short (~2 ft) yellow arrow from the ball. Neither gives away where your line meets the hole, so the read stays yours. Start-line results, the trend and drill spreads are then measured against this line, so you're grading your stroke, not your read. With **Help reading the putt → Read + line**, the start line is locked to the ideal line and the controls are disabled.

Grades use the Quintic-style tiers: **Eagle** (tour level), **Birdie**, **Par**, **Bogey**.

---

## How it works

### Physics (`src/lib/physicsEngine.ts`)
Based on Penner, *The physics of putting* (Can. J. Phys., 2002) and Holmes (1991).

- **Skid:** the ball leaves the face sliding. Kinetic friction (μ = 0.2) slows it and spins it up until it rolls; with no launch spin it keeps 5/7 of its speed. Backspin/topspin from the monitor is used when sent.
- **Roll:** constant rolling resistance from the Stimpmeter definition (the USGA ramp releases a rolling ball at 1.83 m/s, which rolls *S* ft). On slopes, gravity acts fully on a sliding ball and at 5/7 strength on a rolling ball.
- **Cup:** a ball falls in if it drops a ball-radius while its centre crosses the hole: max speed ≈ 1.63 m/s dead centre, much less near the edge. Faster balls lip out (deflected) or hop the cup.
- **Calibration:** on flat ground this gives ~0.39 ft per mph² at stimp 10 (e.g. 9 mph → ~31 ft), matching measured launch-monitor putting data. A **ball speed calibration** setting (85–115%) lets you match your monitor to a real green.
- **Ideal stroke:** a solver finds the start line and speed that send the ball through the centre of the cup and, without the cup, a set distance past: **8.5 in (two cups) by default**, or 6, 12 or 17 in under Settings → Green reading → Ideal pace. Softer pace means a wider effective cup and more break. Firmer pace means less break, and more margin against bumps and coming up short: Pelz's 17 in is meant to roll through the bumpy ring around real holes, and about 12 in is the common tour target. It drives the aim hint, the optional ideal line, and the "% firm" and "° right of ideal" feedback.

Putts play back in real time — a 40 ft lag takes several seconds, as on a real green.

### Real greens (`src/lib/realGreens.ts`, `public/greens/library.json`)
By default SquarePutt plays on **19 real championship greens**, surveyed from public data:

| Course | Greens |
|---|---|
| Augusta National | 3 (holes 8, 10, 11) |
| Hazeltine National | 4 |
| Cog Hill | 4 |
| TPC Sawgrass | 4 (holes 1, 5, 9, 18) |
| Pinehurst No. 2 | 4 (lower-detail elevation, ~3 m) |

- **Outlines** come from OpenStreetMap (`golf=green`); **elevation** from USGS 3DEP lidar (1 m), lightly smoothed and stored on a 0.5 m grid. Physics reads it with smooth bicubic interpolation.
- Each green has up to **7 pin positions** (at least 3.5 m from the edge, no steeper than 3% at the hole, spread apart) — 128 pins in total.
- Each pin is **pre-rated** from the slopes within 7 m (23 ft) of the hole: Mild if the 90th-percentile slope is ≤ 3.1%, Medium ≤ 4.2%, Hard above — the gentlest, middle and steepest thirds of real pins (42 / 44 / 42).
- The **Slope** setting picks a real pin with that rating; **Next green or pin** cycles through them. Drills and the Scramble use them too. Flat, and Settings → Greens → Generated, use generated greens.
- The ball is always placed on the real putting surface; the green's true outline is drawn with a 1 m collar.
- Validate with `npm run check:real-greens` (solves and holes the ideal stroke from 6, 15 and 30 ft on every pin).

**Rebuilding or adding courses** (`scripts/greens/`, Python with numpy, scipy, tifffile, pyproj, shapely; needs access to overpass-api.de and elevation.nationalmap.gov):
```bash
python3 osm_one.py <key> "<course name regex>" "<south,west,north,east>"   # OSM greens + course outline
python3 build.py <key> "<course name>" 4                                   # elevation, pins, ratings
python3 merge.py                                                           # writes public/greens/library.json
```
Mapped "greens" whose interior median slope exceeds 3.5% are rejected (usually par-3-course greens or outlines that include banks). Elevation reflects the lidar survey date; greens rebuilt since then will differ.

### Generated greens (`src/lib/green.ts`)
Each green is a smooth, deterministic function of a seed built from real green features: a gentle drainage tilt (usually back to front); a signature feature (crown, bowl, double break, two-tier ridge, or a spine/swale running down the green); 4–8 stretched mounds and swales at varied angles; and a rolling undulation over the whole surface. Slope direction changes across the green as on real greens — typically 40–50% of the putting area falls in a clearly different direction from the main tilt (`npx tsx scripts/green-shape.ts` measures this). The whole surface is scaled so its steepest slope (a hard cap) matches the difficulty:

| Difficulty | Steepest slope on the green |
|---|---|
| Flat | 0° |
| Mild | 0.6–1.0° |
| Medium | 1.3–2.0° |
| Hard | 2.2–3.0° |

Slope at the hole is capped to what superintendents use for that green speed (about 3.5% at stimp 9 down to 2% at stimp 12), so the ball can stop near the cup. Physics and graphics read the same surface.

### Graphics (`src/components/green/greenScene.ts`)
Plain Three.js, kept lightweight: one terrain mesh, a sky, a distant treeline. A low sun rakes across the green so slopes catch light and shadow. A small shader on the terrain draws the green edge, mowing stripes, and the optional overlays without extra geometry:

- **Slope arrows** (as in the Square app): the slope is split into its two parts and shown on the 1 ft grid. Each grid edge carries one small arrow that slides from one grid crossing to the next in the downhill direction along that edge; edges across the putt show the left/right slope, edges toward the hole the uphill/downhill slope, so you combine the two to find the fall line. Steeper edges move their arrow faster, at a calm 0.1–0.6 grid edges per second. Slope is averaged over ~1.5 m, and edges under 0.5% show no arrow
- **Height exaggeration:** fixed at 3×, on screen only. Real greens rarely tilt more than 3°, which looks flat on a screen; the ball always rolls on the true-scale green
- **1 ft grid:** bends with the surface
- **Contour lines:** lines of equal height
- **Height map:** red high, blue low
- **Aim arrow** (a short yellow arrow from the ball in your chosen start direction; always shown) and **ideal line**

Cameras:
- **Follow** (default): chases the ball, set back a little so more of the green is in view.
- **Putter view:** behind the ball at address, set back a little. Holds still during the roll, then flies behind the ball where it stopped, looking at the hole.
- **Overhead**.
- **Free:** drag to rotate, scroll to zoom.

During drills, a short card with the putt's result appears at the top of the green for about 7 s (click to dismiss), since the drill panel pushes the full Last putt panel down the sidebar.

**Rolling off the green:** the roll is cut short just after the ball leaves the putting surface, and you're never asked to putt from off the green. In the Scramble the hole ends (+1 stroke). In the other drills it's a miss, and the next putt comes up.

### Sound (`src/components/ui/AudioEngine.ts`)
Synthesized, no audio files. The cup drop is physically modelled: the ball falls ~85 mm onto the cup bottom and rebounds with shrinking gaps, each impact ringing resonances tuned to a plastic cup, slightly different every time. To use a recording instead, put it at `public/sounds/cup-drop.mp3`.

### Launch monitor data (`src/lib/dataSanitizer.ts`, `src/lib/openConnectService.ts`)
Heartbeats and status messages are ignored. Phantom triggers (< 0.75 mph), chips (> 30 mph), odd launch angles, low-confidence reads and duplicate packets are filtered out and briefly reported on screen. Putts that arrive while a ball is still rolling are ignored.

### Drills (`src/lib/drills.ts`)
Each drill is a pure state machine (`new… / …Layout / …OnShot`), separate from the UI.

---

## Project layout

```
bridge/squareputt-bridge.mjs     GSPro Open Connect → WebSocket bridge
scripts/physics-check.ts         Physics and green validation report
src/app/                         Next.js entry, global styles (Tailwind theme)
src/components/App.tsx           App state: modes, drills, shots, layout
src/components/green/            Three.js scene + React wrapper
src/components/hud/              Read panel, result banner, virtual putts, last-putt panel
src/components/drills/           Drill scoreboards
src/components/settings/         Settings and launch monitor panels
src/components/stats/            Stats page
src/components/ui/               Top bar, controls, sound
src/lib/                         Physics, greens, drills, scoring, storage, connection
```

## Data and privacy
Everything is stored in your browser's local storage (settings, last 1,000 putts, personal bests). Use **Stats → Export** to back up or move to another computer.

## Known limitations
- Direct Bluetooth: Home Edition per squaregolf-connector, Omni per allsquare. Tested here with simulated packets; Home Edition connection, ball detection and the ready flag confirmed on real hardware, and putt reading with the `01 07` code awaits confirmation.
- Fonts load from Google Fonts; offline, a system font is used.
- No cloud accounts or sync yet (the spec's PostgreSQL profiles are not built).
- Real greens use public lidar, which can't capture features smaller than about 1 m and may predate recent green rebuilds.

## Data credits
Green outlines © OpenStreetMap contributors (ODbL). Elevation: USGS 3D Elevation Program (public domain).

## License
MIT
