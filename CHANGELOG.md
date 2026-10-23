# Changelog

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
