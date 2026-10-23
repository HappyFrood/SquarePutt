# SquarePutt ⛳

**SquarePutt** is a dedicated, high-fidelity web-based putting analysis, simulation, and drill gamification application engineered specifically for golfers using the **Square Golf Launch Monitor (Home Edition)**, as well as any launch monitor supporting the **Open Connect API** standard (GSPro connectors, OpenGolfSim, OpenFlight, allsquare).

Built with **Next.js (App Router)**, **TypeScript**, **Three.js**, and **Vanilla CSS**, SquarePutt delivers tour-caliber biomechanical stroke telemetry, calibrated terrain-aware roll physics, and an immersive 3D championship green optimized for full-screen single-monitor simulator bays.

---

## 🌟 What Sets SquarePutt Apart

### 1. Hands-Free Full-Screen Kiosk Experience
* **Designed for the Putting Mat:** Built specifically for single-monitor or projector simulator setups where the golfer steps away to putt.
* **Zero Annoyances:** Strictly **no voice callouts, no countdown timers, and no forced button clicks** between putts. The launch monitor automatically detects when you strike a ball, and SquarePutt immediately runs the simulation and logs the shot.
* **Clean Kiosk HUD:** Distraction-free high-visibility telemetry overlay showing face angle, ball speed, club path, face-to-path delta, and target distance.
* **Modal Settings:** Green speed (Stimp), break undulation, target distance, camera perspectives, and display overlays are configured cleanly in the `⚙️ Settings` dialog, keeping the main viewport 100% clutter-free.

---

### 2. High-Fidelity Three.js 3D Graphics Engine
* **Physical Analytical Atmospheric Sky:** Powered by Three.js's physical Rayleigh and Mie scattering analytical `Sky` shader (`three/examples/jsm/objects/Sky.js`) with realistic sun disk bloom, atmospheric haze, and zero empty black void above the horizon.
* **360° Panoramic Horizon & Meadow:** Expansive distant golf course pine and oak tree line with rolling hill ridges and outer rough meadow.
* **USGA Regulation 3D Cup:**
  * Concave hole depressed directly into the 3D green mesh geometry.
  * 1.5-inch white molded plastic cup liner (`#f8fafc`) with beveled upper lip.
  * Sheared turf collar cut contour.
  * Deep dark lower cup cavity down to USGA 4-inch depth (10.16 cm).
  * Perforated cast drainage bottom plate with radial slots.
  * Central polished brass ferrule flagstick socket (`#d97706`).
  * Soft interior cup accent light.
* **PGA Tour Striped Flagstick:**
  * Regulation 7.5-foot tournament pin with 14 alternating high-contrast yellow (`#f59e0b`) and carbon black (`#18181b`) barber-pole bands.
  * Solid polished brass spherical finial cap at top and brass ferrule sleeve at base.
  * Double-sided cloth pennant flag with continuous multi-harmonic wind flutter dynamics.
* **Championship Mowed Turf & Golf Ball:**
  * Procedural cross-cut diamond mower striping with fine grass blade noise stippling.
  * High-frequency micro-surface turf bump map for realistic sun grazing highlights.
  * High-detail golf ball with procedural crater dimple normal map, clearcoat specular reflections, and contact soft shadow.
  * Dynamic camera perspectives: **Behind Putter**, **Drone (Overhead)**, **Follow Ball**, and **Free Orbit**.
* **Cinematic Lighting & Tone Mapping:** ACES Filmic tone mapping, PCF soft shadow mapping, warm directional sun with shadow bias calibration, and sky rim fill lighting.

---

### 3. Open-Birdie Aligned Physics Engine
* **Rigorous Ball Roll Dynamics:** Directly implements the solid-sphere rolling inertia factor ($I = \frac{5}{7}$) and velocity decay equations validated by open-source golf research (Open-Birdie and USGA studies).
* **Two-Phase Skid-to-Roll Model:**
  * **Phase 1 (Skid):** Kinetic sliding friction ($\mu_k \approx 0.18$) with forward rotation spin acceleration until $\omega \cdot R = v$. Calculates exact **Time to Zero Skid** ($t_{\text{skid}} = \frac{2v_0}{7\mu g}$).
  * **Phase 2 (True Roll):** Rolling friction coefficient ($\mu_r$) derived dynamically from the green's Stimpmeter rating:
    $$\mu_r = \frac{2v_0^2}{2g \cdot d_{\text{stimp}}}$$
* **Terrain-Aware Gradient Integration:** 4th-order Euler/Verlet step integration across undulating bicubic bezier terrain elevation grids. Gravity acceleration directly pulls the ball down slopes ($a_g = -g \cdot \nabla h$).
* **Regulation Cup Capture Dynamics:**
  * Ball center within hole radius ($r \le 5.39\text{ cm}$) evaluates arrival velocity.
  * Captures putts at speeds $\le 1.62\text{ m/s}$ (~3.6 mph); high-speed strikes lip out or skip over the back edge.

---

### 4. Synthesized Multi-Harmonic Cup Drop Audio
* **Zero Audio Files / Zero Latency:** 100% procedural Web Audio API audio synthesis.
* **Hollow Plastic/Metallic Resonance:** Dual decaying bandpass-filtered harmonics (180 Hz body thud + 720 Hz cup lip ping) followed by secondary rattle micro-clicks simulating the ball settling into the bottom of the cup.
* **Crisp Impact Strike:** Transient click + short white noise turf burst triggered on ball impact.

---

### 5. Tour Telemetry & Biomechanical Metrics
* **Quintic-Inspired Consistency Tiers:**
  * 🟦 **Eagle (Tour Level):** Face angle standard deviation $\sigma \le 0.45^\circ$, speed $\sigma \le 0.35\text{ mph}$.
  * 🟩 **Birdie (Scratch / Pro):** Face angle $\sigma \le 0.75^\circ$, speed $\sigma \le 0.65\text{ mph}$.
  * 🟨 **Par (Single Digit):** Face angle $\sigma \le 1.25^\circ$, speed $\sigma \le 1.10\text{ mph}$.
  * 🟥 **Bogey (High Variance):** Face angle $\sigma > 1.25^\circ$, needs mechanical face stability drills.
* **Impact Delivery Visualizer:** Dynamic visual display of face angle at impact, putter path, face-to-path delta, and launch line.
* **Dynamic Loft & Skid Analysis:** Evaluates launch angle against the optimal **1.2° to 1.8° window** to prevent bounce or hop.

---

### 6. Gamified Putting Drills
1. **The Pressure Circle (Survival Mode):**
   * Distances: **3ft**, **5ft**, **8ft**.
   * Test: Continuous consecutive makes.
   * **Dynamic Shrinking Cup:** Cup shrinks down from regulation 4.25″ to 2.3″ as streak grows. Missed putt resets streak.
2. **Speed Control Zone (Bullseye Lag Mode):**
   * Distances: **20ft**, **30ft**, **50ft**.
   * Test: Stop the ball in the **3-foot safe zone past the hole**. Never leave putts short.
   * Points awarded for safe-zone stops; heavy point deductions for putts left short of the cup.
3. **The Scramble (9-Hole Gauntlet Challenge):**
   * 9 randomized holes with varying distances (**6ft to 40ft**) and randomized course breaks (mild, medium, hard).
   * **Dynamic Gimme Circle:** Scales with putt distance (1.5ft for short putts, up to 3.8ft for 40ft lag putts).
   * Computes **Circular Error Probable (CEP 50%)** and **Strokes Gained: Putting (SG:P)** against PGA Tour ShotLink baselines.

---

### 7. Zero-Hardware-Code Architecture & Open Connect Bridge
* **Open Connect Standard:** Connects via local WebSocket (`ws://127.0.0.1:921`).
* **Universal Compatibility:** Works seamlessly with community bridges for Square Golf, GSPro, OpenGolfSim, and OpenFlight.
* **OpenSkyPlus-Style Sanitization:** Discards phantom swings, accidental foot taps (< 0.75 mph), chip shots (> 32 mph), and duplicate burst packets.
* **Virtual Shot Simulator Studio:** Built-in test bench with 1-click test shots (*Pure Holed, Safe Zone, Push, Pull, Decel Short, Delofted Skid*) for instant development and testing without physical launch monitor hardware.

---

## Quick start (v2)

```bash
npm install          # adds Tailwind CSS (new dependency)
npm run dev          # app at http://localhost:3000
npm run bridge       # in a second terminal, to receive putts from your Square
```

**Connecting the Square:** GSPro Open Connect connectors dial *into* a server on port 921, which a web page cannot be. `npm run bridge` plays GSPro's role on 127.0.0.1:921 and relays shots to the app on ws://127.0.0.1:9210. Close GSPro first, then point your Square/GSPro connector at GSPro as usual. The bridge also tells the monitor a putter is selected.

**Physics:** skid-then-roll model (Penner 2002) with rolling resistance from the Stimpmeter (1.83 m/s release), full-gravity skid / 5/7-gravity roll on slopes, and a capture model where cup entry speed limits depend on how centred the ball is (lip-outs happen). Validate with `npm run check:physics`.

**Greens:** deterministic seeded surfaces (tilts, crowns, bowls, double breaks, tiers), scaled so the steepest slope matches the difficulty (Mild ≤1°, Medium ≤2°, Hard ≤3°), with the hole location capped to a fair slope for the stimp.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 16+ (App Router, Turbopack)
* **Language:** TypeScript 5+ (Strict mode, 100% typed)
* **3D Graphics:** Three.js (`three` + `three/examples/jsm/objects/Sky.js`)
* **Styling:** Vanilla CSS (Dark mode kiosk aesthetic, responsive single-monitor layout)
* **Audio:** Web Audio API Procedural Synthesizer
* **Code Quality:** 0 ESLint errors, 0 ESLint warnings, 0 TypeScript errors

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+ (tested on Node 20 and Node 24)
* npm, pnpm, or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/SquarePutt.git
cd SquarePutt

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run start
```

---

## ⛳ Connecting Your Square Golf Launch Monitor

1. Power on your **Square Golf Launch Monitor** and pair it to your PC via Bluetooth.
2. Launch your preferred community connector (e.g. OpenGolfSim or GSPro Open Connect bridge) and set the broadcast port to `921`.
3. In SquarePutt, verify the status badge in the top right shows **Square Live** (green).
4. Step up to your putting mat and roll a putt — live photometric metrics and 3D roll physics will instantly stream to your screen!

---

## 📄 License
MIT License. Created for the golf simulation community.
