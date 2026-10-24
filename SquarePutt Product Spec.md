# Product Specification: SquarePutt Web App

*Revision 2 — October 2026. Changes from revision 1 are summarized in §8 and in CHANGELOG.md.*

## 1. Overview & Objective
**SquarePutt** is a dedicated, web-based putting analysis and gamification application designed for users of the **Square Golf Launch Monitor (Home Edition)**, and compatible with any launch monitor that supports the GSPro Open Connect protocol. SquarePutt provides high-fidelity stroke analysis and gamified practice drills focused on dispersion tracking, bridging the gap left by basic simulator putting modes.

## 2. Technical Architecture
SquarePutt connects to the Square itself over Web Bluetooth (revision 1's zero-hardware-code approach was superseded; see Direct Bluetooth below).

*   **The Interface & Physics Engine (Web App):** Next.js, React, Three.js and Tailwind CSS. Runs in the browser.
    *   **Physics:** SquarePutt's own engine, based on published putting research (Penner 2002; Holmes 1991) and calibrated against measured launch-monitor putting data. *(Revision 1 planned to fork `rroojrooj/Open-Birdie`; this was not needed.)*
*   **Direct Bluetooth (primary):** The web app connects to the Square Golf launch monitor itself over Web Bluetooth (Chrome/Edge on a laptop), speaking each model's own dialect. **Home Edition** (per squaregolf-connector, corrected from a hardware log): commands prefixed `0x11`, putter `01 07`, state at byte 3 (byte 2 is a counter), capacitor charge polled, always putter mode. Club metrics are requested per putt, but the device reports none for putts (validity byte 0); it returns club data only for real swings, so no face/path is shown. **Omni** (per allsquare): putter `01 03`, units set, club metrics requested per shot. Common to both: select putter (putting mode), arm detection, 5 s heartbeat, re-arm about 1.2 s after every putt and whenever the device reports idle. The model is detected from the advertisement where the browser allows, otherwise chosen by the user (default Home Edition). Ball placement: the device's ready flag must hold 0.4 s before the ball counts as set; a guide shows the ball position against the read zone learned from the device. *(Supersedes revision 1's "zero-hardware-code" plan for Square users.)*
*   **The Data Bridge (other monitors):** Community connectors (the Square Golf software's GSPro integration, other GSPro Open Connect connectors) speak the GSPro Open Connect v1 protocol: they open a **TCP** connection to a GSPro server on `127.0.0.1:921`. A browser cannot accept TCP connections, so SquarePutt includes a small zero-dependency Node.js **bridge** (`npm run bridge`) that:
    *   listens on TCP 921 and behaves like GSPro (acknowledges shots with code 200),
    *   sends the "player information" message with a **putter** selected so the monitor switches to putting mode,
    *   relays every message to the web app over a local WebSocket (`ws://127.0.0.1:9210`).
    *   GSPro itself must be closed while the bridge runs.
*   **Data Sanitization:** Inspired by **OpenSkyPlus**. Heartbeats and status messages are ignored. Phantom triggers (< 0.75 mph), non-putts (> 30 mph), launch angles outside −3° to 12°, low-confidence reads (< 35%) and duplicate packets (within 1.2 s) are discarded and reported briefly on screen. Putts arriving while a ball is still rolling are ignored. Field-name differences between connectors (e.g. `FaceToTarget` vs `FaceAngle`, `Loft` vs `DynamicLoft`) are normalized.

## 3. Virtual Green Environment & Physics

*   **Green Speed (Stimp):** Adjustable from **9.0 to 12.0**. Converted to rolling resistance from the Stimpmeter definition (ball released rolling at 1.83 m/s rolls *S* feet).
*   **Physics model:**
    *   **Skid phase:** sliding friction (μ = 0.2) until the ball reaches pure roll; with no launch spin it keeps 5/7 of its launch speed. Backspin/topspin from the monitor is used when provided.
    *   **Roll phase:** constant rolling resistance; slope acceleration is 5/7 g·sin θ while rolling (full g while sliding).
    *   **Cup capture:** the ball falls if it drops one ball radius while its centre crosses the hole — about 1.63 m/s maximum for a dead-centre entry, much less near the edge. Faster balls lip out with a deflection, or hop the cup.
    *   **Calibration:** ~0.39 ft per mph² on a flat stimp-10 green, matching measured data. A user **ball speed calibration** (85–115%) adjusts for monitor differences.
    *   **Ideal stroke solver:** for every putt, finds the start line and speed that roll through the centre of the cup and would stop a set distance past (ideal pace: 8.5 in / two cups by default; user setting 6, 8.5, 12 or 17 in). Used for aim guidance and for grading speed and start line.
*   **Real greens (default):** 19 championship greens (Augusta National, Hazeltine National, Cog Hill, TPC Sawgrass, Pinehurst No. 2) built from OpenStreetMap green outlines and USGS 3DEP lidar elevation, each with up to 7 pin positions. Every pin is pre-rated Mild / Medium / Hard from the 90th-percentile slope within 7 m of the hole (thresholds 3.1% and 4.2%, splitting the 128 pins into thirds). The difficulty setting selects real pins of that rating; Flat uses a level generated green.
*   **Topography & Slopes (generated greens):** Seeded, deterministic green surfaces built from real green features (gentle drainage tilt, crowns, bowls, double breaks, two-tier ridges, spines and swales, stretched secondary mounds, rolling undulation), so the fall direction changes across the green. Scaled so the steepest slope on the green (a strict maximum) falls in the selected range:
    *   **Flat (0°):** Completely level. Used for pure stroke mechanics.
    *   **Mild (0.6° to 1°):** Gentle, subtle breaks.
    *   **Medium (1.3° to 2°):** Standard course conditions requiring distinct aim points.
    *   **Hard (2.2° to 3°):** Severe undulations and tiers.
    *   Slope at the hole is capped to a fair value for the green speed (about 3.5% at stimp 9 down to 2% at stimp 12).
*   **Visual Feedback (all optional):** adjustable **height exaggeration** of the rendered green (default 3×, display only) so real-world slopes are visible on screen; Square-style **slope lines** (the 1 ft grid lines animate the left/right and up/down components of the slope separately, paced and coloured by steepness), a **1 ft grid** draped on the surface, **contour lines**, a **height map** (red high, blue low), the **line to the hole**, and the **ideal line**. A read panel states distance, uphill/downhill (inches), break direction and slope %, the aim point ("inside left edge", "1.5 cups right") and ideal ball speed. The level of help is selectable: none, read, or read + ideal line.
*   **Playback:** putts roll in real time.

## 4. Advanced Metrics

*   **Skid vs. True Roll:** skid distance and time to pure roll from the physics simulation, plus total roll.
*   **Dynamic Loft Optimization:** launch angle benchmarked against the 1.0–2.0° window, with a note when launch is too low (ball driven into turf) or too high (ball hops).
*   **Versus the ideal stroke:** ball speed as % firm/soft, and start line in degrees left/right of the ideal line for that green.

## 5. Core Modes & Features

### 5.1 Practice (Putting Stroke Analysis)
Any distance (3–50 ft), any slope, new greens on demand.

**Metrics Displayed:**
*   **Ball Data:** Ball Speed (vs ideal), Start Line / HLA (vs the player's chosen line), Launch Angle, Spin, Skid, Roll Distance.
*   **Club Data:** none. The Square Home Edition reports no face or path for putts (tested in putter and wedge modes), so neither is shown.

**UI/UX:**
*   **Start line selection:** before each putt the player sets an intended start direction with on-screen ◀ ▶ buttons, the ← → keys, the Square's handheld remote (Bluetooth messages `12 6a …` left / `12 69 …` right; byte 5 = 01 press, 00 release), or a presentation remote (Page Up / Page Down). Steps of 0.5°, up to 6°; hold to repeat; tap the readout to reset. Shown only as degrees left/right and as a ~2 ft yellow arrow from the ball, so the aim point at the hole isn't revealed. Locked to the ideal line, with controls disabled, when "Read + line" is on.
*   **Trend:** start line (vs chosen line) and pace over the last 10 putts, with start-line spread graded.
*   **Diagnosis (read · start line · pace):** when the player chose the line, the chosen line is simulated at ideal pace. If it holes, the read is good; otherwise it's classed as under-read / over-read (or left / right on a straight putt, i.e. ideal under 0.25°), reported in degrees with the share of the break played (aim ÷ ideal start angle). Start line is good within max(0.5°, the angle that moves the ball 1.5 in at the hole); pace is good if holed, or if the ball reached the hole and finished ≤ max(1.5 ft, 5% of the putt) past. When pace was off, the start line that holes at the actual pace is solved and reported (or that none reaches / even the centre line lips out). A one-line verdict names what cost the putt, and the overall grade includes the read (holes = Eagle, within 3 in = Par, else Bogey).
*   **Green-reading stats:** read make % at ideal pace, average aim gap, median share of the break played, under- vs over-read rate on breaking putts, and the share of misses where the read, start line or pace was off.
*   **Display:** green height exaggerated 3× on screen (fixed; not a user setting).
*   **Result timing:** result, grades, markers and drill scores are revealed when the ball stops, not at impact.
*   **After each putt (Practice):** same putt / new green after a make / random putt (any green and pin, mild–hard, 3–35 ft).
*   **Cameras:** Follow (default), Putter view (flies behind the ball where it stopped), Overhead, Free. Follow and Putter view sit 20% further back than in revision 2.
*   **Off the green:** a putt that leaves the putting surface is cut short. In the Scramble the hole ends (+1); in the other drills it's a miss. Never putt from off the green.
*   **Drill result card:** during drills, a short card with the read · start line · pace verdict appears on the green for ~7 s.
*   **Stats baselines:** strokes gained (per putt, per 18, total, by distance) and make-rate marks against PGA Tour, scratch, 5, 10, 15 or 20 handicap. The Tour uses Broadie's table. Amateur tables are built from Shot Scope make % by handicap plus a Tour-shaped 3-putt curve scaled to Arccos 3-putt rates from ~38 ft.
*   **Virtual putts:** simulated strokes (realistic, perfect, push, pull, firm, soft, custom) for use without a launch monitor.

### 5.2 Gamified Putting Drills
All drills use the **Quintic-inspired color-coding system**:
*   **Blue (Eagle):** Elite consistency/variance (Tour level)
*   **Green (Birdie):** Very Good
*   **Amber (Par):** Average
*   **Red (Bogey):** Poor/High variance

#### A. Short Putts ("The Pressure Circle")
*   **Goal:** hole 36 short putts in a row around one hole, every one breaking differently.
*   **Setup:** a random hole (green + pin, slope selectable, Mild by default) and a circle of **2, 3 or 4 ft**. **12 balls** are placed evenly around the hole and all shown on the green; they're putted in order around the clock.
*   **Run:** each make extends the run. **12 in a row:** mini celebration, same hole, 12 new balls. **24:** mega celebration, 12 more. **36:** level won (offer the next circle size). **Any miss:** run resets to 0 and play restarts from ball 1 on a different hole.
*   **Tracking:** run (of 36), position in the current set of 12, best run (saved), make %, holes played.
*   **Dispersion Metric:** start-line standard deviation (against the chosen line) across the session, graded Eagle–Bogey.

#### B. Lag Putts ("Leapfrog")
*   **Goal:** pace control, meaning feel for incremental changes in distance.
*   **Setup:** a 30 ft ladder from a fixed spot on a random green (rungs every 3 ft, red boundary at 30 ft). There's no cup: the pin is hidden and cupless.
*   **Rules:** ball 1 must finish past the 3 ft rung; every next ball just past the previous one (as close as possible). Short of the previous ball, past 30 ft or off the green ends the round; the next round is on a different green and line. **Score = number of balls fitted.** Balls stay on the green where they finished.
*   **Tracking:** balls this round, room left, ladder strip of finishes, best (saved), rounds, average and recent scores. Celebrations on beating your best (from 4) and every 10 balls. Leapfrog putts are excluded from make %, strokes gained and reading stats.

#### C. Random Putts ("The Scramble")
*   **Goal:** Adaptability, green reading and feel.
*   **Mechanics:** A **9- or 18-hole putting round**. Each hole is a new green with a random distance (6–40 ft, weighted toward makeable lengths), direction and slope (Mild, Medium, Hard, or mixed).
*   **Gamification:** "The Gauntlet". You **putt out** from where the ball stops; finishing inside the dynamic **gimme circle** (1.5–3.8 ft, grows with putt length) is given. Par is two putts per hole; score to par and a scorecard are shown; maximum six putts per hole.
*   **Dispersion Metric:** Strokes Gained: Putting per hole against the PGA Tour baseline (Broadie, interpolated by distance), total and per 18 holes (graded); first-putt proximity (CEP 50%); one-putts and three-putts.

## 6. Session Tracking & Analytics
*   **Storage:** Local to the browser — settings, the last 1,000 putts and personal bests — with JSON export/import. *(Cloud profiles, e.g. PostgreSQL on Railway, remain planned.)*
*   **Dispersion:** Scatter of where missed putts finish relative to the hole (in each putt's own direction), with bias and spread, filterable by distance band.
*   **Bag Mapping (Putter):** Make % in distance buckets (3 ft to 40 ft+) compared with the approximate PGA Tour make %.
*   **Summary:** make %, average pace vs ideal, start-line bias, average leave on misses, personal bests.

## 7. Audio & Display
*   **Display:** dark kiosk interface built to be read from the putting mat, full-screen toggle, settings and launch monitor setup in slide-out panels.
*   **Audio:** synthesized putter strike, lip-out, and a physically modelled **cup drop** (fall and decaying rebounds in a plastic cup, varied each time). A recording at `public/sounds/cup-drop.mp3` overrides the synthesized cup drop.

## 8. Changes from Revision 1
*   Connection: browser now receives shots through the included bridge; direct `ws://127.0.0.1:921` was not compatible with GSPro Open Connect connectors (TCP clients).
*   Physics: rebuilt (rolling resistance from stimp was ~3.5× too high; capture speed did not depend on entry position). Open-Birdie fork dropped.
*   Greens: replaced a tilted plane with procedural contoured greens; slope ranges per difficulty made explicit; hole slope capped by stimp.
*   Drills: Pressure Circle adds around-the-clock positions, lives and a ladder; Speed Control adds mixed distances, sets, combos and a short-inside-3-ft category; The Scramble now plays holes out with strokes gained per hole.
*   Metrics: speed and start line graded against the ideal stroke for that putt (needed on breaking putts); Strokes Gained table interpolated instead of stepped.
*   UI: redesigned; Tailwind CSS installed (styles were previously not applied).
