/**
 * SquarePutt green surface model.
 *
 * Coordinate system (meters, physics frame):
 *   x  -> right (as seen by a golfer facing the hole from the default ball position)
 *   z  -> forward (away from the golfer)
 *   y  -> up (elevation)
 * The hole is always at the origin (0, 0). Ball positions are placed relative to it.
 *
 * Surfaces are smooth, deterministic functions of a seed. They are built from features
 * real greens are made of — an overall drainage tilt, broad swales and crowns, and (on
 * harder settings) a tier — then scaled so the steepest slope on the green matches the
 * selected difficulty. Slope at the hole is capped to an agronomically sensible value
 * for the selected stimp so balls can actually stop near the cup.
 */

import { SlopeDifficulty } from './types';

export interface Vec2 {
  x: number;
  z: number;
}

/** Range of the steepest slope on the green (degrees) for each difficulty. */
export const DIFFICULTY_MAX_SLOPE_DEG: Record<SlopeDifficulty, [number, number]> = {
  flat: [0, 0],
  mild: [0.6, 1.0],
  medium: [1.3, 2.0],
  hard: [2.2, 3.0],
};

/** Radius around the hole (m) inside which slopes are normalized. Covers ~50 ft putts. */
export const PLAY_RADIUS_M = 16;

/** Recommended maximum slope at hole locations by green speed (percent grade). */
export function maxHoleSlopePct(stimp: number): number {
  // ~3.5% at stimp 9, 3% at 10, 2.5% at 11, 2% at 12 (common superintendent guidance)
  return Math.min(3.75, Math.max(1.75, 3.0 - 0.5 * (stimp - 10)));
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bump {
  cx: number;
  cz: number;
  sigma: number;
  amp: number;
}

interface Tier {
  nx: number; // unit normal of the tier line
  nz: number;
  offset: number; // signed distance of the tier line from the hole
  height: number; // total step height
  width: number; // transition half-width (m)
}

export type GreenArchetype =
  | 'flat'
  | 'back-to-front'
  | 'side-hill'
  | 'crowned'
  | 'bowl'
  | 'double-break'
  | 'two-tier';

export interface GreenDescriptor {
  archetype: GreenArchetype;
  maxSlopeDeg: number;
  holeSlopePct: number;
  /** Compass direction the hole location falls toward, radians (0 = toward +z). */
  holeFallDirRad: number;
}

export class GreenSurface {
  readonly difficulty: SlopeDifficulty;
  readonly seed: number;
  readonly stimp: number;
  readonly archetype: GreenArchetype;

  private tiltX = 0;
  private tiltZ = 0;
  private bumps: Bump[] = [];
  private tier: Tier | null = null;
  private scale = 1;
  // Local flattening around the hole: h -= flatK * w(r) * (gx*x + gz*z)
  private flatGx = 0;
  private flatGz = 0;
  private readonly flatSigma = 1.6;

  readonly descriptor: GreenDescriptor;

  constructor(difficulty: SlopeDifficulty, seed: number, stimp = 10.5) {
    this.difficulty = difficulty;
    this.seed = Math.floor(seed) >>> 0;
    this.stimp = stimp;

    if (difficulty === 'flat') {
      this.archetype = 'flat';
      this.scale = 0;
      this.descriptor = { archetype: 'flat', maxSlopeDeg: 0, holeSlopePct: 0, holeFallDirRad: 0 };
      return;
    }

    const rnd = mulberry32(this.seed * 7919 + difficulty.length * 104729);
    this.archetype = this.build(rnd);

    // 1. Normalize so the steepest (98th percentile) slope in the play area hits the target.
    const [lo, hi] = DIFFICULTY_MAX_SLOPE_DEG[difficulty];
    const targetDeg = lo + (hi - lo) * rnd();
    const targetGrade = Math.tan((targetDeg * Math.PI) / 180);
    const p98 = this.slopePercentile(0.98);
    this.scale = p98 > 1e-9 ? targetGrade / p98 : 0;

    // 2. Cap slope at the hole so the pin is fair for the green speed.
    const capGrade = Math.min(targetGrade, maxHoleSlopePct(stimp) / 100);
    const g = this.gradient(0, 0); // scaled, before any flattening
    const gm = Math.hypot(g.dhdx, g.dhdz);
    if (gm > capGrade) {
      const k = 1 - capGrade / gm;
      this.flatGx = g.dhdx * k;
      this.flatGz = g.dhdz * k;
    }

    const gh = this.gradient(0, 0);
    this.descriptor = {
      archetype: this.archetype,
      maxSlopeDeg: targetDeg,
      holeSlopePct: Math.hypot(gh.dhdx, gh.dhdz) * 100,
      holeFallDirRad: Math.atan2(-gh.dhdx, -gh.dhdz),
    };
  }

  /** Builds raw (un-normalized) features. Returns the archetype chosen. */
  private build(rnd: () => number): GreenArchetype {
    const d = this.difficulty;
    const pool: GreenArchetype[] =
      d === 'mild'
        ? ['back-to-front', 'side-hill', 'back-to-front', 'crowned', 'bowl']
        : d === 'medium'
        ? ['back-to-front', 'side-hill', 'crowned', 'bowl', 'double-break', 'two-tier']
        : ['side-hill', 'crowned', 'double-break', 'two-tier', 'two-tier', 'bowl'];
    const archetype = pool[Math.floor(rnd() * pool.length)];

    // Overall drainage tilt (every green has one). Biased toward draining to the front.
    const tiltDir =
      archetype === 'side-hill'
        ? (rnd() < 0.5 ? -1 : 1) * (Math.PI / 2 + (rnd() - 0.5) * 0.8)
        : Math.PI + (rnd() - 0.5) * 1.6; // falls roughly toward -z (front of green)
    const tiltMag = archetype === 'crowned' || archetype === 'bowl' ? 0.35 : 1.0;
    // Gradient vector points uphill; fall direction is tiltDir.
    this.tiltX = -Math.sin(tiltDir) * tiltMag;
    this.tiltZ = -Math.cos(tiltDir) * tiltMag;

    const addBump = (cx: number, cz: number, sigma: number, weight: number) => {
      // amplitude chosen so the bump's own max slope ~= |weight|
      this.bumps.push({ cx, cz, sigma, amp: (weight * sigma) / 0.6065 });
    };
    const rr = (a: number, b: number) => a + (b - a) * rnd();
    const sizeScale = d === 'mild' ? 1.4 : d === 'medium' ? 1.0 : 0.8;

    switch (archetype) {
      case 'crowned': {
        const ang = rnd() * Math.PI * 2;
        const dist = rr(3, 7);
        addBump(Math.cos(ang) * dist, Math.sin(ang) * dist, rr(4, 6.5) * sizeScale, rr(0.9, 1.3));
        break;
      }
      case 'bowl': {
        addBump(rr(-3, 3), rr(-3, 3), rr(5, 8) * sizeScale, -rr(0.9, 1.2));
        break;
      }
      case 'double-break': {
        const side = rnd() < 0.5 ? -1 : 1;
        addBump(side * rr(2, 4), rr(-9, -4), rr(3, 4.5) * sizeScale, rr(0.8, 1.1));
        addBump(-side * rr(2, 4), rr(-3, 1), rr(3, 4.5) * sizeScale, rr(0.8, 1.1));
        break;
      }
      case 'two-tier': {
        const ang = Math.PI + (rnd() - 0.5) * 1.2; // tier mostly crosses the line of play
        this.tier = {
          nx: Math.sin(ang),
          nz: Math.cos(ang),
          offset: rr(2.5, 6) * (rnd() < 0.5 ? 1 : -1),
          height: 1, // relative; normalization scales it
          width: rr(0.9, 1.6),
        };
        break;
      }
      default:
        break;
    }

    // Secondary undulations — what makes reads subtle.
    const extra = d === 'mild' ? 2 : d === 'medium' ? 3 : 4;
    for (let i = 0; i < extra; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = rr(1, PLAY_RADIUS_M * 0.8);
      addBump(
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        rr(2.5, 6) * sizeScale,
        (rnd() < 0.5 ? -1 : 1) * rr(0.25, 0.6)
      );
    }
    return archetype;
  }

  private rawHeight(x: number, z: number): number {
    let h = this.tiltX * x + this.tiltZ * z;
    for (const b of this.bumps) {
      const dx = x - b.cx;
      const dz = z - b.cz;
      h += b.amp * Math.exp(-(dx * dx + dz * dz) / (2 * b.sigma * b.sigma));
    }
    if (this.tier) {
      const t = this.tier;
      // height chosen so the tier face slope (h/2w) is ~1.6x the tilt
      const s = x * t.nx + z * t.nz - t.offset;
      h += 1.6 * t.width * (1 + Math.tanh(s / t.width));
    }
    return h;
  }

  private rawGradient(x: number, z: number): { dhdx: number; dhdz: number } {
    let gx = this.tiltX;
    let gz = this.tiltZ;
    for (const b of this.bumps) {
      const dx = x - b.cx;
      const dz = z - b.cz;
      const s2 = b.sigma * b.sigma;
      const e = b.amp * Math.exp(-(dx * dx + dz * dz) / (2 * s2));
      gx += (-dx / s2) * e;
      gz += (-dz / s2) * e;
    }
    if (this.tier) {
      const t = this.tier;
      const s = x * t.nx + z * t.nz - t.offset;
      const sech = 1 / Math.cosh(s / t.width);
      const dh = 1.6 * sech * sech; // d/ds of 1.6w(1+tanh(s/w))
      gx += dh * t.nx;
      gz += dh * t.nz;
    }
    return { dhdx: gx, dhdz: gz };
  }

  private slopePercentile(p: number): number {
    const vals: number[] = [];
    const step = 0.5;
    for (let x = -PLAY_RADIUS_M; x <= PLAY_RADIUS_M; x += step) {
      for (let z = -PLAY_RADIUS_M; z <= PLAY_RADIUS_M; z += step) {
        if (x * x + z * z > PLAY_RADIUS_M * PLAY_RADIUS_M) continue;
        const g = this.rawGradient(x, z);
        vals.push(Math.hypot(g.dhdx, g.dhdz));
      }
    }
    vals.sort((a, b) => a - b);
    return vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] ?? 0;
  }

  /** Elevation (m). */
  height(x: number, z: number): number {
    if (this.scale === 0) return 0;
    let h = this.scale * this.rawHeight(x, z);
    if (this.flatGx !== 0 || this.flatGz !== 0) {
      const w = Math.exp(-(x * x + z * z) / (2 * this.flatSigma * this.flatSigma));
      h -= w * (this.flatGx * x + this.flatGz * z);
    }
    return h;
  }

  /** Surface gradient (dimensionless rise/run). Points uphill. */
  gradient(x: number, z: number): { dhdx: number; dhdz: number } {
    if (this.scale === 0) return { dhdx: 0, dhdz: 0 };
    const g = this.rawGradient(x, z);
    let gx = this.scale * g.dhdx;
    let gz = this.scale * g.dhdz;
    if (this.flatGx !== 0 || this.flatGz !== 0) {
      const s2 = this.flatSigma * this.flatSigma;
      const w = Math.exp(-(x * x + z * z) / (2 * s2));
      const L = this.flatGx * x + this.flatGz * z;
      gx -= w * this.flatGx + (-x / s2) * w * L;
      gz -= w * this.flatGz + (-z / s2) * w * L;
    }
    return { dhdx: gx, dhdz: gz };
  }

  /** Slope magnitude in percent grade. */
  slopePct(x: number, z: number): number {
    const g = this.gradient(x, z);
    return Math.hypot(g.dhdx, g.dhdz) * 100;
  }
}

/** Plain-language read of a putt, as a caddie would describe it. */
export interface PuttRead {
  distanceFt: number;
  elevationChangeIn: number; // + = uphill to the hole
  sideSlopePct: number; // average cross-slope along the line; + = falls to the right
  breakLabel: string; // "Left to right" etc.
  slopeLabel: string; // "Uphill" / "Downhill" / "Level"
  holeSlopePct: number;
}

export function readPutt(surface: GreenSurface, ball: Vec2, hole: Vec2 = { x: 0, z: 0 }): PuttRead {
  const dx = hole.x - ball.x;
  const dz = hole.z - ball.z;
  const dist = Math.hypot(dx, dz);
  const fx = dx / (dist || 1);
  const fz = dz / (dist || 1);
  // right-hand vector (x right when facing +z)
  const rx = fz;
  const rz = -fx;
  let side = 0;
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const g = surface.gradient(ball.x + dx * t, ball.z + dz * t);
    // falls right if the surface rises to the left => gradient · right < 0
    side += -(g.dhdx * rx + g.dhdz * rz);
  }
  side = (side / (n + 1)) * 100;
  const elev = (surface.height(hole.x, hole.z) - surface.height(ball.x, ball.z)) * 39.3701;
  const breakLabel =
    Math.abs(side) < 0.25 ? 'Straight' : side > 0 ? 'Left to right' : 'Right to left';
  const slopeLabel = Math.abs(elev) < 1 ? 'Level' : elev > 0 ? 'Uphill' : 'Downhill';
  return {
    distanceFt: dist * 3.28084,
    elevationChangeIn: elev,
    sideSlopePct: side,
    breakLabel,
    slopeLabel,
    holeSlopePct: surface.slopePct(hole.x, hole.z),
  };
}
