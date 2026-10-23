/**
 * Real putting greens built from OpenStreetMap outlines and USGS 3DEP lidar elevation
 * (see scripts/greens/). Each green has several pre-rated pin positions.
 *
 * Library coordinates: metres from the green centroid, x = east, y = north.
 * Physics coordinates (hole at origin): x = east - pin.x, z = north - pin.y.
 */

import { PuttingSurface, Vec2 } from './green';
import { SlopeDifficulty } from './types';

export interface LibraryPin {
  x: number;
  y: number;
  rating: Exclude<SlopeDifficulty, 'flat'>;
  p90SlopePct: number;
  meanSlopePct: number;
  holeSlopePct: number;
  longestPuttFt: number;
}

export interface LibraryGreen {
  id: string;
  course: string;
  courseName: string;
  label: string;
  hole: string | null;
  areaM2: number;
  cell: number;
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  heightsMm: string;
  outline: [number, number][];
  reliefCm: number;
  p90SlopePct: number;
  pins: LibraryPin[];
  source: string;
}

export interface GreenLibrary {
  version: number;
  about: string;
  ratingThresholds: { mildMaxP90SlopePct: number; mediumMaxP90SlopePct: number };
  greens: LibraryGreen[];
}

let cache: Promise<GreenLibrary | null> | null = null;

export function loadGreenLibrary(): Promise<GreenLibrary | null> {
  if (!cache) {
    cache = fetch('/greens/library.json')
      .then((r) => (r.ok ? (r.json() as Promise<GreenLibrary>) : null))
      .catch(() => null);
  }
  return cache;
}

function decodeHeights(b64: string, n: number): Float32Array {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    if (v & 0x8000) v -= 0x10000;
    out[i] = v / 1000;
  }
  return out;
}

/** Catmull-Rom weights */
function cr(t: number, p0: number, p1: number, p2: number, p3: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

export class RealGreenSurface implements PuttingSurface {
  readonly difficulty: SlopeDifficulty;
  readonly seed: number;
  readonly stimp: number;
  readonly label: string;
  readonly outline: Vec2[];
  readonly green: LibraryGreen;
  readonly pin: LibraryPin;
  readonly pinIndex: number;
  private h: Float32Array;
  private base: number;

  constructor(green: LibraryGreen, pinIndex: number, stimp: number, seed: number) {
    this.green = green;
    this.pinIndex = pinIndex;
    this.pin = green.pins[pinIndex];
    this.difficulty = this.pin.rating;
    this.seed = seed;
    this.stimp = stimp;
    this.label = `${green.label} · pin ${pinIndex + 1}`;
    this.h = decodeHeights(green.heightsMm, green.nx * green.ny);
    this.outline = green.outline.map(([x, y]) => ({ x: x - this.pin.x, z: y - this.pin.y }));
    this.base = 0;
    this.base = this.height(0, 0);
  }

  private cellAt(i: number, j: number) {
    const g = this.green;
    const ii = Math.min(g.nx - 1, Math.max(0, i));
    const jj = Math.min(g.ny - 1, Math.max(0, j));
    return this.h[jj * g.nx + ii];
  }

  /** Height (m) relative to the hole. */
  height(x: number, z: number): number {
    const g = this.green;
    // grid cell centres are at x0 + (i + 0.5) * cell
    const fx = (x + this.pin.x - g.x0) / g.cell - 0.5;
    const fy = (z + this.pin.y - g.y0) / g.cell - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const rows: number[] = [];
    for (let m = -1; m <= 2; m++) {
      rows.push(cr(tx, this.cellAt(i - 1, j + m), this.cellAt(i, j + m), this.cellAt(i + 1, j + m), this.cellAt(i + 2, j + m)));
    }
    return cr(ty, rows[0], rows[1], rows[2], rows[3]) - this.base;
  }

  gradient(x: number, z: number) {
    const e = 0.04;
    return {
      dhdx: (this.height(x + e, z) - this.height(x - e, z)) / (2 * e),
      dhdz: (this.height(x, z + e) - this.height(x, z - e)) / (2 * e),
    };
  }

  slopePct(x: number, z: number) {
    const g = this.gradient(x, z);
    return Math.hypot(g.dhdx, g.dhdz) * 100;
  }

  contains(p: Vec2) {
    return pointInPolygon(p, this.outline);
  }
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** All (green, pin) pairs with a rating, in a stable order. */
export function pinsWithRating(lib: GreenLibrary, rating: Exclude<SlopeDifficulty, 'flat'>) {
  const out: { green: LibraryGreen; pinIndex: number }[] = [];
  lib.greens.forEach((g) => g.pins.forEach((p, i) => p.rating === rating && out.push({ green: g, pinIndex: i })));
  return out;
}

/** Picks a real green + pin for a difficulty and seed (same seed -> same pin). */
export function pickRealGreen(lib: GreenLibrary, rating: Exclude<SlopeDifficulty, 'flat'>, seed: number, stimp: number) {
  const list = pinsWithRating(lib, rating);
  if (!list.length) return null;
  const pick = list[Math.abs(Math.floor(seed)) % list.length];
  return new RealGreenSurface(pick.green, pick.pinIndex, stimp, seed);
}

/**
 * Finds a ball spot on the green at `distanceFt` from the hole, as close as possible to the
 * preferred direction. If the green isn't that long in any direction, uses the longest putt
 * available (up to the fringe).
 */
export function placeBallOnGreen(surface: RealGreenSurface, distanceFt: number, preferredAngle: number): Vec2 {
  const D = distanceFt * 0.3048;
  const at = (a: number, d: number) => ({ x: Math.sin(a) * d, z: -Math.cos(a) * d });
  const inset = (a: number, d: number) => surface.contains(at(a, d)) && surface.contains(at(a, d + 0.6));
  for (let k = 0; k <= 36; k++) {
    for (const s of k === 0 ? [0] : [1, -1]) {
      const a = preferredAngle + s * k * (Math.PI / 36);
      if (inset(a, D)) return at(a, D);
    }
  }
  // too long for this green: longest spot still on the green
  let best = { a: preferredAngle, d: 0 };
  for (let k = 0; k < 72; k++) {
    const a = (k * Math.PI) / 36;
    let d = 0;
    while (d < 40 && surface.contains(at(a, d + 0.25))) d += 0.25;
    if (d > best.d) best = { a, d };
  }
  return at(best.a, Math.max(0.5, best.d - 0.4));
}
