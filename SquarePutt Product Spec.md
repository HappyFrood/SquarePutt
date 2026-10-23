# Product Specification: SquarePutt Web App

## 1. Overview & Objective
**SquarePutt** is a dedicated, web-based putting analysis and gamification application designed exclusively for users of the **Square Golf Launch Monitor (Home Edition)**. SquarePutt provides high-fidelity stroke analysis and gamified practice drills focused on dispersion tracking, bridging the gap left by basic simulator putting modes.

## 2. Technical Architecture (Zero-Hardware-Code Approach)
To eliminate friction and save development time, SquarePutt utilizes a decoupled architecture. **SquarePutt does not handle any direct Bluetooth (BLE) connections or hardware decoding.** 

*   **The Interface & Physics Engine (Web App):** The main application (Next.js, React) hosted in the cloud. It connects via a local WebSocket (typically port 921) to receive live telemetry in the **Open Connect API** standard JSON format.
    *   **Resource to Leverage:** We will fork and integrate the 3D physics and rendering engine from **`rroojrooj/Open-Birdie`** (an open-source Three.js simulator), granting us pre-calibrated terrain-aware roll physics without building from scratch.
*   **The Data Bridge (Third-Party Connectors):** Because SquarePutt accepts standard Open Connect JSON, we do not need to build proprietary connection software. Users will utilize existing, free community connectors (e.g., OpenGolfSim's connector, GSPro connectors, or `allsquare` ports) that already know how to talk to the Square monitor and broadcast its data.
*   **Data Sanitization:** We will implement a data filter inspired by the **`OpenSkyPlus`** framework to automatically discard phantom swings, misreads, or packets with low confidence scores before they impact a user's drill score.

## 3. Virtual Green Environment & Physics
To make drills realistic and test green-reading ability, the application will feature a dynamically generated 3D putting surface. 

*   **Green Speed (Stimp):** Adjustable slider from **9.0 to 12.0**. This directly impacts the physics engine's friction coefficient.
*   **Topography & Slopes:** The engine generates procedural meshes based on user-selected difficulty. 
    *   **Flat (0°):** Completely level. Used for pure stroke mechanics.
    *   **Mild (0° to 1°):** Gentle, subtle breaks.
    *   **Medium (0° to 2°):** Standard course conditions requiring distinct aim points.
    *   **Hard (0° to 3°):** Severe tournament-level undulations. 
*   **Visual Feedback:** In Drill modes, the green contour is rendered using an augmented reality-style topography grid. A color-coded heatmap (Red for high, Blue for low) visualizes the slope and fall lines.

## 4. Advanced Metrics 
Using the baseline telemetry provided natively by the Square launch monitor (Ball Speed, HLA, Angle of Attack, Putter Path, Face Angle, Dynamic Loft), the app will synthesize additional pro-level metrics:

*   **Skid vs. True Roll:** The app will calculate the estimated **Time to Zero Skid** using the Square's Ball Speed, Launch Angle, and the user's selected Stimp setting. 
*   **Dynamic Loft Optimization:** The app will benchmark the user's Dynamic Loft and Angle of Attack against the ideal window (~1.5 degrees of launch) to ensure the ball is lifted out of its depression efficiently.

## 5. Core Modes & Features

### 5.1 Putting Stroke Analysis (Flat Green)
This mode provides a sterile, data-first environment for dialing in the stroke mechanics using the Square's photometric tracking.

**Metrics Displayed:**
*   **Ball Data:** Ball Speed, Launch Direction (HLA), Total Roll Distance.
*   **Club Data:** Angle of Attack, Putter Path, Face Angle, Dynamic Loft.

**UI/UX:**
*   **Live Dashboard:** A visual representation of the putter face at impact and the path.
*   **Trend Graphs:** Rolling averages of the last 10 putts to identify mechanical biases.

### 5.2 Gamified Putting Drills
This section focuses on skill acquisition, tracking dispersion metrics to generate a "Putting Handicap." All drills utilize a **Quintic-inspired color-coding system** to grade stroke consistency and variance:
*   **Blue (Eagle):** Elite consistency/variance (Tour level)
*   **Green (Birdie):** Very Good
*   **Amber (Par):** Average
*   **Red (Bogey):** Poor/High variance

#### A. Short Putts ("The Pressure Circle")
*   **Goal:** Make-percentage and face control.
*   **Distances:** 3ft, 5ft, 8ft.
*   **Gamification:** "Survival Mode." The user must make consecutive putts. The target area shrinks visually based on the simulated hole size. 
*   **Dispersion Metric:** Face Angle variance. The app tracks the standard deviation of the face angle across the session and grades the variance tier (Blue to Red).

#### B. Lag Putts ("Speed Control Zone")
*   **Goal:** Distance control and ball speed consistency.
*   **Distances:** 20ft, 30ft, 50ft.
*   **Gamification:** "Bullseye." The user aims for a 3-foot radius circle behind the hole. Points are awarded for stopping the ball within the "safe zone"; points are deducted for leaving it short.
*   **Dispersion Metric:** Front-to-back distance dispersion. The app tracks Ball Speed variance and translates it to distance variance based on green speed.

#### C. Random Putts ("The Scramble")
*   **Goal:** Adaptability and reading feel.
*   **Mechanics:** Distances are randomized between 6ft and 40ft on every shot. The **slope is also randomized** based on the chosen difficulty (Mild, Medium, Hard). 
*   **Gamification:** "The Gauntlet." The user has one attempt to get it inside a dynamic "gimme" circle (gimme radius increases with the length of the putt). 
*   **Dispersion Metric:** Overall circular error probable (CEP) and Strokes Gained: Putting.

## 6. Session Tracking & Analytics
*   **User Profiles:** Save historical data in a cloud database (e.g., PostgreSQL on Railway).
*   **Dispersion Heatmaps:** Visual scatter plots of where the ball ends up relative to the target, color-coded by drill type.
*   **Bag Mapping (Putter):** Identify the user's "Make %" at every distance interval to highlight specific weaknesses.