# Changelog

## 2.7.0 — October 2026

### Changed
- **Lag putts are now the Leapfrog drill.** Putt from one spot along a 30 ft ladder (rungs every 3 ft, no hole): the first ball just past the 3 ft rung, then each ball just past the previous one. Short of the last ball, or past 30 ft, ends the round, and your score is how many balls fit. Every round is on a different green. Balls stay on the green where they finished. The panel shows a ladder strip, room left, best and recent rounds. Virtual putts aim about a foot past the last ball.
- Leapfrog putts have no hole, so they're left out of make %, strokes gained and reading stats, and the Last putt panel just shows how far out the ball finished.


## 2.6.0 — October 2026

### Changed
- **Pressure circle redesigned.**
  - **Setup:** pick a 2, 3 or 4 ft circle. Twelve balls are placed evenly around a random hole, and all of them show on the green. Putt them in order.
  - **Runs:** 12 in a row is a mini celebration, then 12 new balls on the same hole. 24 is a mega celebration, then 12 more. 36 wins the level, with the option to go on to the next circle size.
  - **Misses:** you start again from ball 1 on a different hole.
  - **Removed:** lives, the shrinking cup and the 3→8 ft ladder.


## 2.5.0 — October 2026

### Added
- **Strokes gained in Stats** (per putt, per 18 holes, total, and per distance band), with a choice of baseline: **PGA Tour, scratch, 5, 10, 15 or 20 handicap**. The make-rate chart marks the same baseline. The Tour uses Broadie's table. The amateur baselines are built from Shot Scope make rates by handicap and Arccos 3-putt rates (see the README).
- **Practice: after each putt** stay on the same putt, move to a new green after a make, or play a random putt every time.
- **Drill result card:** during drills, the putt's verdict (read · start line · pace, speed and % firm/soft) shows on the green for about 7 s. Click to dismiss.

### Changed
- **Results wait for the ball to stop.** The Last putt panel, grades, lag markers and drill scores update when the roll ends, not at impact.
- **Rolling off the green ends it.** The roll is cut short just after the ball leaves the green. In the Scramble the hole ends (+1 stroke); in the other drills it's a miss. You're never asked to putt from off the green.
- **Cameras:** Follow is the default (everyone is moved to it once) and sits 20% further back. "Behind ball" is renamed **Putter view**, sits 20% further back, and flies behind the ball where it stopped (the putt is held a little longer, 3.2 s, so you can see it).
- Read diagnosis: a good read just says "Holes at perfect pace", and the explanation says "the ideal line was…".

### Fixed
- The result banner and new card are centred (the pop-in animation was shifting them left).
- The miss scatter in Stats no longer draws outside its frame after a very long miss.


## 2.4.3 — October 2026

### Changed
- **Ideal pace is a setting** (Settings → Green reading → Ideal pace): the ball would finish 6, **8.5 (default, two cups)**, 12 or 17 in past. The aim hint, ideal line, % firm/soft, read check and "line at your pace" all follow it.


## 2.4.2 — October 2026

### Changed
- **Ideal pace is now 6 in past the hole,** through the centre of the cup (was Pelz's ~17 in). The aim hint, ideal line, % firm/soft, read check and grades all use it. A dying pace takes more break, so ideal aim points are a little wider than before.
- **Pace is judged by where the ball finishes:** good if holed, or if it reached the hole and finished within 1.5 ft past (5% of the putt on long ones). A ±% band doesn't work with only 6 in to spare.

### Added
- **Read and pace linked:** when the pace was off, the diagnosis gives the start line that would have holed at the pace you actually hit. Or it says that no line reaches (too soft), or that even the centre line lips out (too firm).


## 2.4.1 — October 2026

### Changed
- **Aiming gives less away.** The full-length start line with a crossbar at the hole is replaced by a strong yellow arrow about 2 ft long from the ball, showing direction only. The aim box shows degrees ("1.25° left") instead of inches at the hole.
- **Aim steps in degrees:** 0.25° up to 1.5°, then 0.5° up to 3°, then 1° up to 15°. Holding a button repeats every 0.15 s.
- **Misreads in degrees plus % of break,** e.g. "Under-read 2.1° · 26% of break", with "You aimed 0.75° left; the read needed 2.9° left". Inches are gone from the read. Stats show the average gap in degrees. Older putts are converted.
- The aim arrow is always shown; the old "Line to the hole" toggle is removed. If that toggle had been switched off, it used to hide the arrow.


## 2.4.0 — October 2026

### Added
- **Read · start line · pace diagnosis** for every putt where you chose the line. SquarePutt rolls your line at perfect pace to test the read on its own (good, or under-read / over-read by N in), checks start line (within ~1.5 in at the hole, at least 0.5°) and pace (within 8%), and gives a verdict such as "Misread" or "Pace cost it". The overall grade now includes the read.
- **Stats → Green reading:** read make % at perfect pace, average aim gap, share of the break you play, under/over-read rate, and what cost your misses.
- **Choose your start line.** Tap ◀ ▶ (bottom right of the green), press ← →, or use a presentation remote (Page Up / Page Down). Each press moves the aim point 1 inch per 10 ft of putt; hold to repeat, and tap the label to reset to the hole. The start line on the green swings to match and ends in a crossbar at hole distance. It resets for each new putt. With "Read + line" on, the start line is locked to the ideal line and the controls are disabled.
- Start line is now graded against the line you chose, not the ideal line: the Last putt panel ("On your line", "0.4° right of your line"), the stats, the trend and the virtual putts all use it.
- Spin is shown in the Last putt panel.

### Removed
- **Face and path, and the impact diagram.** The Home Edition doesn't measure them on putts (tested in putter and wedge modes), so SquarePutt no longer shows an estimate as if it were measured. The Last putt trend and the Pressure Circle spread now use start line.
- **"Read putts as" (wedge mode)** from the launch monitor panel. Putts are always read in putter mode, and a saved wedge choice is cleared. The custom club code box stays.
- **"Show slopes"** setting: the green's on-screen height is fixed at 3×.


## 2.3.3 — October 2026

### Fixed (from a real Home Edition log)
- **Device state:** status messages carry the state in byte 3 (byte 2 is a counter): `11 03 <ctr> <state> <state> 07 01 00 01`. SquarePutt was reading byte 2, so the panel never showed ready/detecting and the re-arm-on-idle backstop couldn't fire.
- **Club data:** the club reply's byte 2 is a validity mask on the Home Edition too, and `ffff` means blank. In putter mode the Home Edition answers `11 07 00 ffff…`, i.e. nothing measured. SquarePutt now treats this as no club data instead of showing near-zero values.

### Added
- **Read putts as Putter / Wedge** (launch monitor panel, remembered). Wedge tells the Square you're holding a sand wedge (Home `0c 06`, Omni `0c 02`) so it reports club data. Putt as normal: valid face and path go to the impact panel, and blank values are ignored. It's an experiment: path needs the club sticker, and very slow putts may not register.

## 2.3.2 — October 2026

### Added
- **Club data from the Home Edition (experimental).** After each putt SquarePutt now asks the Home Edition for club metrics (path, face, attack angle, dynamic loft) and uses them unless they're empty markers. squaregolf-connector discards these for the putter, so how good they are on putts is unconfirmed. Path and attack angle need the Square's reflective club sticker; face is the device's estimate. The raw reply appears in the launch monitor log.

### Changed
- When no club data arrives, the impact panel says so: face is labelled "Face (est.)" (estimated from start line) and path shows "not measured", with no path arrow, instead of a made-up 0°.

## 2.3.1 — October 2026

### Fixed
- **Only one putt per connection.** After a putt, the Square leaves detection mode and waits to be re-armed. SquarePutt now re-arms it about 1.2 s after each putt, and whenever the Square reports idle or done, so you no longer need to disconnect and reconnect.
- **Slope arrows breaking up over time or after switching windows.** The arrow clock was the page's uptime, so small speed differences along an edge drifted apart, and returning to the window made the clock jump. The clock now advances by the capped frame time and wraps every 20 s. Arrow speeds are set in steps that all repeat within that period, so the arrows stay crisp however long the page is open.

### Changed
- Slope arrows move at half their previous speed (0.1–0.6 grid edges per second).

## 2.3.0 — October 2026

### Changed
- **Home Edition support.** SquarePutt had been speaking the Omni's dialect, from allsquare, to every Square. It now follows squaregolf-connector's Home Edition protocol when the model is Home Edition:
  - commands start with `0x11`
  - the putter code is `01 07` (`01 03` is the Omni's)
  - device state is read from byte 2 of the status message
  - the shot capacitor's charge is polled until it reports charged
  - the Omni-only units and green-speed commands are no longer sent
  - putts are passed on straight away, without waiting for club data the Home Edition doesn't send.
- **Model detection and switch.** The model is detected from the Square's Bluetooth advertisement when Chrome allows it. Otherwise it comes from a Home Edition / Omni switch (default Home Edition) in the launch monitor panel and the placement guide.
- The arming test now compares the Home Edition and Omni putter codes. The custom putter code field defaults to the model's own code.

## 2.2.1 — October 2026

### Added
- **Ball placement guide**: a small top-right panel shows the ball position reported by the Square, the read zone learned from its own readings, and an arrow toward the zone. Plays a ding and fades once the ball is set. A Home Edition / Omni switch shows where the ball goes for each model (about 23 cm vs 5 cm in front of the unit).
- **Test arming** in the launch monitor panel tries several club codes and reports what the Square does with each.

### Fixed
- **Brief green flashes in odd places on the Home Edition.** The Home Edition's read zone is much smaller than the Omni's (about 6×6 in versus 10×10 in), so a ball at its edge flickers between ready and not ready. SquarePutt now treats the ball as ready only after the Square has reported ready steadily for 0.4 s. Flickers no longer trigger the ding or "Ready", and only steady readings teach the zone. The zone is relearned from scratch (old samples are discarded).


## 2.2.0 — October 2026

### Added
- **Direct Bluetooth connection to the Square** from Chrome/Edge on a laptop (Connect Square in the launch monitor panel): selects the putter, arms detection, heartbeats, reads ball and club data. No bridge, connector or GSPro needed. Protocol from the open-source allsquare project. Adjustable putter code and raw message log for Home Edition diagnosis. The GSPro bridge remains for other monitors.

### Changed
- Slope arrows are now small (about 2 cm), a single soft green-white colour, and exactly one per 1 ft grid edge, sliding crossing to crossing (speed shows steepness).
- Follow camera keeps the ball in frame at address.
- Slope arrows use slope averaged over ~1.5 m and appear only above 0.5%, so small bumps no longer flip neighbouring arrows in opposite directions.

## 2.1.1 — October 2026

### Changed
- Slope lines redrawn as bright, self-lit **arrowheads** on the 1 ft grid that point and move steadily downhill along each axis (constant size, speed proportional to slope), with the grid line tinted by steepness. Replaces the dim dashes whose direction was hard to read.

## 2.1.0 — October 2026

### Added
- **Real greens:** 19 lidar-surveyed greens from Augusta National, Hazeltine National, Cog Hill, TPC Sawgrass and Pinehurst No. 2 with 128 pre-rated pin positions (Mild / Medium / Hard, a third each). Used by default in Practice, all drills and the Scramble; generated greens remain available.
- True green outlines rendered from survey data; ball always placed on the putting surface.
- Green library build pipeline (`scripts/greens/`) and `npm run check:real-greens`.

## 2.0.1 — October 2026

### Changed
- Fall lines replaced with Square-style **slope lines** on the 1 ft grid: each grid direction animates its own component of the slope (left/right vs up/down), coloured and paced by steepness. The dots, which looked like golf balls, are gone.
- **Greens regenerated** to look and play like real greens: weaker overall tilt, stretched ridges and swales at varied angles, and rolling undulation everywhere. Slope direction now varies across the green (plane-likeness measure fell from ~0.75 to ~0.3–0.4). Difficulty limits (1°/2°/3°) are now strict maximums.
- Greens are shown with adjustable height exaggeration (Settings → Green reading → Show slopes; default 3×) and lower, raking sunlight so slopes are visible. Physics is unaffected.

## 2.0.0 — October 2026

### Added
- **Launch monitor bridge** (`npm run bridge`): stands in for GSPro on TCP port 921, selects the putter so the monitor enters putting mode, and relays shots to the app over WebSocket port 9210. Zero dependencies.
- **Ideal stroke solver:** aim point and ideal speed for every putt, an optional ideal line, and "% firm" / "° right of ideal" feedback.
- **Green reading panel:** distance, uphill/downhill, break and slope %, aim point in golfer terms.
- **Overlays:** contour lines, height map, draped 1 ft grid, animated fall lines.
- **Drills:** around-the-clock positions, lives and 3→8 ft ladder (short putts); mixed-distance sets, combos and on-green zone markers (lag); 9/18-hole putt-out rounds with scorecard and strokes gained (Scramble).
- **Stats page:** make % vs PGA Tour by distance, finish scatter, pace and start-line bias, personal bests, export/import.
- **Virtual putts** for playing without a launch monitor.
- Ball speed calibration setting; lip-out sound; optional recorded cup-drop override (`public/sounds/cup-drop.mp3`).
- `npm run check:physics` validation report.

### Changed
- **Physics rebuilt:** proper skid-to-roll transition, stimp-derived rolling resistance (previously ~3.5× too high), slope forces for sliding vs rolling balls, and an entry-position-dependent cup capture model with lip-outs. Matches measured launch-monitor putting data.
- **Greens rebuilt:** contoured surfaces (tilts, crowns, bowls, double breaks, tiers) scaled to Mild ≤1°, Medium ≤2°, Hard ≤3°, with a fair slope at the hole for the green speed.
- **3D scene simplified:** one terrain mesh with shader-drawn overlays, real-time ball playback, cleaner cup and flag; removed hand-drawn tree panorama and extra lights.
- **UI redesigned:** new layout, readable impact diagram, slide-out settings and launch monitor panels, drill scoreboards.
- **Cup drop sound** replaced with a physically modelled drop and rattle.
- Strokes Gained uses an interpolated PGA Tour baseline instead of distance steps; CEP uses a true median.
- Shot history stores up to 1,000 putts without trajectories (storage key `squareputt_history_v2`; earlier history is not migrated).

### Fixed
- Tailwind CSS was used throughout but never installed, so most styling did not apply.
- Left/right were mirrored in the 3D view.
- The 3D canvas removed its own on-screen overlays on load.
- The Scramble stopped after hole 9 and shots during the hole transition were miscounted.
- Ball roll animation always lasted ~1.2 s regardless of putt length.

### Removed
- Unused components (old drill panels, voice announcer, stroke dashboard, green controls, modals). Copies are in `_to_delete/` for reference.
