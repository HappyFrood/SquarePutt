/**
 * SquarePutt putting physics.
 *
 * Model (after Penner, "The physics of putting", Can. J. Phys. 2002, and Holmes 1991):
 *
 *  1. Skid. A putted ball leaves the face sliding with little or no forward spin. Kinetic
 *     friction (mu_s) decelerates the ball and spins it up until the contact point stops
 *     slipping. With no initial spin this takes t = 2 v0 / (7 mu_s g) and the ball keeps
 *     5/7 of its launch speed. Gravity acts with full strength on a sliding ball.
 *  2. Roll. Once rolling, the green's rolling resistance gives a constant deceleration a_r
 *     derived from the Stimpmeter: the USGA ramp releases a rolling ball at 1.83 m/s, which
 *     rolls S feet, so a_r = 1.83^2 / (2 S). Slope acceleration on a rolling solid sphere is
 *     (5/7) g sin(theta).
 *  3. Capture. A ball whose centre crosses the cup edge falls in if it drops at least one
 *     ball radius while its centre is over the hole: v <= L * sqrt(g / 2r), where L is the
 *     chord its centre travels across the cup. Dead-centre that is ~1.63 m/s; edge entries
 *     need far less speed. Faster balls lip out (deflected) or hop the cup.
 *
 * Calibration check (flat green, zero launch spin, mu_s = 0.2): roll distance ~ 0.36-0.42
 * ft per mph^2 for stimp 10-11, matching measured launch-monitor putting data (~0.37).
 */

import { GreenSurface, Vec2 } from './green';

export const GRAVITY = 9.80665;
export const BALL_RADIUS_M = 0.021335;
export const HOLE_RADIUS_M = 0.053975; // 4.25 in diameter
export const STIMP_RELEASE_SPEED_MPS = 1.83;
export const SKID_FRICTION = 0.2; // kinetic friction, ball sliding on bentgrass
export const MPH_TO_MPS = 0.44704;
export const M_TO_FT = 3.28084;
export const FT_TO_M = 0.3048;
export const M_TO_IN = 39.3701;
export const SAMPLE_DT = 1 / 60; // trajectory sample spacing (s)
/** Desired "die" distance past the hole for ideal speed (Pelz: ~17 in). */
export const IDEAL_PAST_HOLE_M = 0.43;

/** Rolling deceleration (m/s^2) implied by a stimp reading in feet. */
export function rollingDecel(stimp: number): number {
  const s = Math.min(Math.max(stimp, 6), 16) * FT_TO_M;
  return (STIMP_RELEASE_SPEED_MPS * STIMP_RELEASE_SPEED_MPS) / (2 * s);
}

/** Flat-green roll distance (ft) for a ball speed (mph), zero launch spin. */
export function flatDistanceFt(speedMph: number, stimp: number): number {
  const v = speedMph * MPH_TO_MPS;
  const a = rollingDecel(stimp);
  const mg = SKID_FRICTION * GRAVITY;
  const d = (v * v * (24 / (49 * mg) + 25 / (49 * a))) / 2;
  return d * M_TO_FT;
}

/** Inverse of flatDistanceFt: ball speed (mph) needed to roll a distance on a flat green. */
export function speedForFlatDistanceMph(distanceFt: number, stimp: number): number {
  const k = flatDistanceFt(1, stimp); // ft per mph^2
  return Math.sqrt(Math.max(0, distanceFt) / k);
}

export interface PuttSetup {
  surface: GreenSurface;
  stimp: number;
  /** Ball position; the hole is at the origin. */
  ball: Vec2;
  holeRadiusMultiplier?: number;
  /** Multiplier applied to measured ball speed to calibrate a launch monitor (1 = none). */
  speedCalibration?: number;
}

export interface StrokeInput {
  ballSpeedMph: number;
  /** Launch direction relative to the ball-to-hole line. + = right. */
  hlaDeg: number;
  /** Signed backspin at launch (rpm). Negative = topspin. */
  backspinRpm?: number;
}

export interface SimulationResult {
  /** [x, y, z] ball-contact positions every SAMPLE_DT seconds. */
  samples: [number, number, number][];
  sampleDt: number;
  rest: Vec2;
  isHoled: boolean;
  lipOut: boolean;
  durationS: number;
  pathLengthFt: number;
  skidTimeMs: number;
  skidDistanceIn: number;
  /** Signed distance of the rest position past the hole along the original line (ft). */
  distanceErrorFt: number;
  /** Signed lateral offset of the rest position from the original line (in, + right). */
  lateralErrorIn: number;
  /** Straight-line distance from rest position to the hole (ft). */
  leaveFt: number;
  /** Speed when the ball reached the cup, if it did (m/s). */
  cupEntrySpeedMps: number | null;
}

interface SimOptions {
  dt?: number;
  ignoreCup?: boolean;
  record?: boolean;
}

/** Unit vector pointing from ball to hole, and its right-hand normal. */
function frame(ball: Vec2) {
  const d = Math.hypot(ball.x, ball.z) || 1;
  const fx = -ball.x / d;
  const fz = -ball.z / d;
  return { fx, fz, rx: fz, rz: -fx, dist: d };
}

export function simulatePutt(setup: PuttSetup, stroke: StrokeInput, opts: SimOptions = {}): SimulationResult {
  const dt = opts.dt ?? 0.001;
  const record = opts.record ?? true;
  const { surface } = setup;
  const aR = rollingDecel(setup.stimp);
  const muG = SKID_FRICTION * GRAVITY;
  const holeR = HOLE_RADIUS_M * (setup.holeRadiusMultiplier ?? 1);
  const vMaxCenterFactor = Math.sqrt(GRAVITY / (2 * BALL_RADIUS_M));

  const { fx, fz, rx, rz } = frame(setup.ball);
  const th = (stroke.hlaDeg * Math.PI) / 180;
  const dirX = fx * Math.cos(th) + rx * Math.sin(th);
  const dirZ = fz * Math.cos(th) + rz * Math.sin(th);

  const v0 = Math.max(0, stroke.ballSpeedMph) * MPH_TO_MPS * (setup.speedCalibration ?? 1);
  let x = setup.ball.x;
  let z = setup.ball.z;
  let vx = v0 * dirX;
  let vz = v0 * dirZ;
  // Contact-point rolling velocity u = R*omega (in the direction of travel). Backspin < 0.
  const u0 = -((stroke.backspinRpm ?? 0) * 2 * Math.PI) / 60 * BALL_RADIUS_M;
  let ux = u0 * dirX;
  let uz = u0 * dirZ;

  let skidding = v0 > 0;
  let skidTime = 0;
  let skidDist = 0;
  let t = 0;
  let pathLen = 0;
  let isHoled = false;
  let lipOut = false;
  let overHole = false;
  let cupEntrySpeed: number | null = null;
  const samples: [number, number, number][] = [];
  let nextSample = 0;
  const MAX_T = 30;

  const push = () => {
    samples.push([x, surface.height(x, z), z]);
  };
  if (record) {
    push();
    nextSample = SAMPLE_DT;
  }

  while (t < MAX_T) {
    const speed = Math.hypot(vx, vz);
    const g = surface.gradient(x, z);
    const n = 1 / Math.sqrt(1 + g.dhdx * g.dhdx + g.dhdz * g.dhdz);
    // Downhill gravity component along the surface (per unit g)
    const sx = -g.dhdx * n;
    const sz = -g.dhdz * n;

    let ax: number;
    let az: number;
    if (skidding) {
      const slipX = vx - ux;
      const slipZ = vz - uz;
      const slip = Math.hypot(slipX, slipZ);
      // Slip shrinks by 3.5*mu*g per second; snap to rolling when it would cross zero.
      if (slip <= 3.5 * muG * dt * 1.05 + 1e-4) {
        skidding = false;
        skidTime = t;
        ux = vx;
        uz = vz;
        continue;
      }
      const ex = slipX / slip;
      const ez = slipZ / slip;
      ax = -muG * ex + GRAVITY * sx;
      az = -muG * ez + GRAVITY * sz;
      // friction torque spins the ball up toward rolling
      ux += 2.5 * muG * ex * dt;
      uz += 2.5 * muG * ez * dt;
    } else {
      const gravX = (5 / 7) * GRAVITY * sx;
      const gravZ = (5 / 7) * GRAVITY * sz;
      if (speed < 2e-3) {
        // At rest: does slope overcome rolling resistance?
        if (Math.hypot(gravX, gravZ) <= aR) break;
        ax = gravX - aR * (gravX / Math.hypot(gravX, gravZ));
        az = gravZ - aR * (gravZ / Math.hypot(gravX, gravZ));
      } else {
        ax = gravX - aR * (vx / speed);
        az = gravZ - aR * (vz / speed);
        // Prevent friction from reversing the ball within a step
        const nvx = vx + ax * dt;
        const nvz = vz + az * dt;
        if (nvx * vx + nvz * vz < 0 && Math.hypot(gravX, gravZ) <= aR) {
          vx = 0;
          vz = 0;
          break;
        }
      }
    }

    vx += ax * dt;
    vz += az * dt;
    if (!skidding) {
      ux = vx;
      uz = vz;
    }
    const stepX = vx * dt;
    const stepZ = vz * dt;
    x += stepX;
    z += stepZ;
    const stepLen = Math.hypot(stepX, stepZ);
    pathLen += stepLen;
    if (skidding) skidDist += stepLen;
    t += dt;

    if (record && t >= nextSample) {
      push();
      nextSample += SAMPLE_DT;
    }

    if (!opts.ignoreCup) {
      const dHole = Math.hypot(x, z);
      if (dHole < holeR && !overHole) {
        overHole = true;
        const sp = Math.hypot(vx, vz);
        if (cupEntrySpeed === null) cupEntrySpeed = sp;
        // perpendicular distance of travel line from cup centre
        const cross = sp > 1e-6 ? (x * vz - z * vx) / sp : 0;
        const b = Math.min(Math.abs(cross), holeR * 0.999);
        const chord = 2 * Math.sqrt(holeR * holeR - b * b);
        const vMax = chord * vMaxCenterFactor;
        if (sp <= vMax) {
          isHoled = true;
          break;
        }
        // Lip-out / hop: lose energy, edge hits are deflected away from the centre.
        lipOut = true;
        const edge = b / holeR;
        const loss = edge > 0.5 ? 0.82 : 0.68;
        let nvx = vx * loss;
        let nvz = vz * loss;
        if (edge > 0.35) {
          const ang = Math.min(0.6, 1.1 * edge * (1 - vMax / sp)) * (cross >= 0 ? -1 : 1);
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          const rvx = nvx * c - nvz * s;
          const rvz = nvx * s + nvz * c;
          nvx = rvx;
          nvz = rvz;
        }
        vx = nvx;
        vz = nvz;
        ux = vx;
        uz = vz;
        skidding = false;
      } else if (dHole >= holeR) {
        overHole = false;
      }
    }
  }

  if (!isHoled && !opts.ignoreCup && Math.hypot(x, z) < holeR) {
    // came to rest over the hole
    isHoled = true;
  }

  if (record) {
    if (isHoled) {
      // Animate the drop: slide to the centre and fall below the surface.
      const sx0 = x;
      const sz0 = z;
      const top = surface.height(0, 0);
      const frames = 8;
      for (let i = 1; i <= frames; i++) {
        const k = i / frames;
        samples.push([sx0 * (1 - k), top - 0.075 * k * k, sz0 * (1 - k)]);
      }
    } else {
      push();
    }
  }

  const rest: Vec2 = isHoled ? { x: 0, z: 0 } : { x, z };
  // Errors measured in the frame of the original ball-to-hole line, origin at the hole.
  const along = rest.x * fx + rest.z * fz; // + = past the hole
  const lateral = rest.x * rx + rest.z * rz; // + = right
  if (skidding) skidTime = t;

  return {
    samples,
    sampleDt: SAMPLE_DT,
    rest,
    isHoled,
    lipOut: lipOut && !isHoled,
    durationS: t,
    pathLengthFt: pathLen * M_TO_FT,
    skidTimeMs: Math.round(skidTime * 1000),
    skidDistanceIn: skidDist * M_TO_IN,
    distanceErrorFt: isHoled ? 0 : along * M_TO_FT,
    lateralErrorIn: isHoled ? 0 : lateral * M_TO_IN,
    leaveFt: isHoled ? 0 : Math.hypot(rest.x, rest.z) * M_TO_FT,
    cupEntrySpeedMps: cupEntrySpeed,
  };
}

export interface IdealStroke {
  ballSpeedMph: number;
  hlaDeg: number;
  /** Aim offset at the hole, inches (+ = aim right of the cup). */
  aimOffsetIn: number;
  /** Expected path (no cup) for drawing the ideal line. */
  samples: [number, number, number][];
  converged: boolean;
}

/**
 * Finds the start line and ball speed that send the ball through the centre of the cup
 * and, if the cup weren't there, stop IDEAL_PAST_HOLE_M past it.
 */
export function solveIdealStroke(setup: PuttSetup, pastHoleM = IDEAL_PAST_HOLE_M): IdealStroke {
  const { dist } = frame(setup.ball);
  const flatSetup = { ...setup, speedCalibration: 1 };

  const evaluate = (hla: number, mph: number) => {
    const r = simulatePutt(flatSetup, { ballSpeedMph: mph, hlaDeg: hla }, { dt: 0.002, ignoreCup: true });
    const s = r.samples;
    // closest approach to the hole
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < s.length; i++) {
      const d = s[i][0] * s[i][0] + s[i][2] * s[i][2];
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    let lat: number;
    let past: number;
    if (bi >= s.length - 1) {
      // stopped short: no pass; error is how far short, lateral from line to hole
      const p = s[s.length - 1];
      const prev = s[Math.max(0, s.length - 3)];
      const tx = p[0] - prev[0];
      const tz = p[2] - prev[2];
      const tl = Math.hypot(tx, tz) || 1;
      lat = ((tx / tl) * -p[2] - (tz / tl) * -p[0]); // cross(dir, hole - p)
      past = -Math.sqrt(best);
    } else {
      const a = s[Math.max(0, bi - 1)];
      const b = s[Math.min(s.length - 1, bi + 1)];
      const tx = b[0] - a[0];
      const tz = b[2] - a[2];
      const tl = Math.hypot(tx, tz) || 1;
      lat = (tx / tl) * -s[bi][2] - (tz / tl) * -s[bi][0];
      past = 0;
      for (let i = bi + 1; i < s.length; i++) {
        past += Math.hypot(s[i][0] - s[i - 1][0], s[i][2] - s[i - 1][2]);
      }
    }
    return { lat, past: past - pastHoleM, samples: s };
  };

  let hla = 0;
  let mph = speedForFlatDistanceMph((dist + pastHoleM) * M_TO_FT, setup.stimp);
  let res = evaluate(hla, mph);
  let converged = false;
  for (let iter = 0; iter < 25; iter++) {
    if (Math.abs(res.lat) < 0.004 && Math.abs(res.past) < 0.02) {
      converged = true;
      break;
    }
    const dh = 0.05;
    const dv = Math.max(0.03, mph * 0.01);
    const rh = evaluate(hla + dh, mph);
    const rv = evaluate(hla, mph + dv);
    const j11 = (rh.lat - res.lat) / dh;
    const j12 = (rv.lat - res.lat) / dv;
    const j21 = (rh.past - res.past) / dh;
    const j22 = (rv.past - res.past) / dv;
    const det = j11 * j22 - j12 * j21;
    let stepH: number;
    let stepV: number;
    if (Math.abs(det) < 1e-12) {
      stepH = j11 !== 0 ? -res.lat / j11 : 0;
      stepV = j22 !== 0 ? -res.past / j22 : 0;
    } else {
      stepH = (-res.lat * j22 + res.past * j12) / det;
      stepV = (-res.past * j11 + res.lat * j21) / det;
    }
    // damped step with trust region
    stepH = Math.max(-4, Math.min(4, stepH));
    stepV = Math.max(-mph * 0.4, Math.min(mph * 0.4, stepV));
    let lambda = 1;
    let next = evaluate(hla + stepH, mph + stepV);
    const err = (r: { lat: number; past: number }) => Math.abs(r.lat) * 10 + Math.abs(r.past);
    while (err(next) > err(res) && lambda > 0.1) {
      lambda *= 0.5;
      next = evaluate(hla + stepH * lambda, mph + stepV * lambda);
    }
    hla = Math.max(-25, Math.min(25, hla + stepH * lambda));
    mph = Math.max(0.5, Math.min(30, mph + stepV * lambda));
    res = next;
  }

  return {
    ballSpeedMph: mph,
    hlaDeg: hla,
    aimOffsetIn: Math.tan((hla * Math.PI) / 180) * dist * M_TO_IN,
    samples: res.samples,
    converged,
  };
}
