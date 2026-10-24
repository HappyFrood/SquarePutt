/**
 * Splits a putt into four parts — pace, face control (start vs your aim), the read (share of the
 * break played) and launch/loft — and says which of read, face and pace cost it. The read is
 * judged on its own: SquarePutt rolls the player's chosen line at the ideal pace.
 */

import { PuttingShotData } from './types';
import { calculateMean } from './calculations';

export type PartState = 'good' | 'off' | 'na';

export interface DiagPart {
  state: PartState;
  /** Main result, e.g. "12% soft", "0.8° right", "60% of the break", "Too little loft". */
  text: string;
  /** Supporting detail, e.g. "4.1 mph · 1.2 ft short". */
  detail?: string;
  /** Direction for the arrow: up = firm / too much, down = soft / too little, left / right = side. */
  dir?: 'up' | 'down' | 'left' | 'right';
}

export interface Diagnosis {
  pace: DiagPart;
  /** Face control: how far off your chosen aim the ball started. */
  face: DiagPart;
  read: DiagPart;
  /** Launch vs the ideal window — too much or too little loft. */
  loft: DiagPart;
  /** One-line verdict, e.g. "Misread", "Pace cost it". */
  headline: string;
}

/**
 * Ideal putting launch window (degrees): the ball lifts out of its resting depression without
 * hopping, giving the shortest skid. 1.5–4° per Quintic / SAM PuttLab research (as cited by fitters).
 */
export const LAUNCH_WINDOW: [number, number] = [1.5, 4];

/** Degrees for display, one decimal: 1.0° → "1°", 0.5° → "0.5°", 0.19° → "0.2°". */
export const fmtDeg = (d: number) => {
  const n = Math.abs(d);
  return `${n >= 10 ? n.toFixed(0) : Number(n.toFixed(1)).toString()}°`;
};

/** Read numbers in degrees; older putts (stored in inches only) are converted. */
export function readDegrees(s: PuttingShotData) {
  const r = s.read!;
  const distIn = Math.max(12, s.targetDistanceFt * 12);
  const toDeg = (inch: number) => (Math.atan(inch / distIn) * 180) / Math.PI;
  const aimDeg = r.aimDeg ?? toDeg(r.aimIn);
  const idealDeg = r.idealDeg ?? toDeg(r.idealIn);
  const errorDeg = r.errorDeg ?? aimDeg - idealDeg;
  const breakPlayedPct = r.breakPlayedPct ?? (Math.abs(idealDeg) >= 0.25 ? Math.round((aimDeg / idealDeg) * 100) : undefined);
  return { aimDeg, idealDeg, errorDeg, breakPlayedPct };
}

const side = (d: number) => (Math.abs(d) < 0.01 ? 'straight' : `${fmtDeg(d)} ${d > 0 ? 'right' : 'left'}`);

/** Start-line tolerance: what moves the ball ~1.5 in at the hole, but never under 0.5°. */
export function lineToleranceDeg(distanceFt: number) {
  return Math.max(0.5, (Math.atan(1.5 / Math.max(12, distanceFt * 12)) * 180) / Math.PI);
}
/**
 * Pace is judged by where the ball ends up, not a ± % band: the ideal pace (through the centre,
 * dying 6 in past) leaves little room on the soft side. A holed putt had good pace; a miss had
 * good pace if it got to the hole and finished no more than 1.5 ft (or 5% of the putt) past.
 */
export function paceIsGood(isHoled: boolean, distanceErrorFt: number, distanceFt: number) {
  if (isHoled) return true;
  return distanceErrorFt >= 0 && distanceErrorFt <= Math.max(1.5, distanceFt * 0.05);
}

export function diagnose(s: PuttingShotData): Diagnosis {
  // Pace: % soft / firm against the ideal pace, judged by where the ball finished
  const pe = s.speedErrorPct;
  const pct = pe === undefined ? '–' : Math.abs(pe) < 1 ? 'Ideal pace' : `${Math.abs(pe).toFixed(0)}% ${pe > 0 ? 'firm' : 'soft'}`;
  const finish = s.isHoled ? 'holed' : s.distanceErrorFt < 0 ? `${Math.abs(s.distanceErrorFt).toFixed(1)} ft short` : `${s.distanceErrorFt.toFixed(1)} ft past`;
  const pace: DiagPart = {
    state: pe === undefined ? 'na' : paceIsGood(s.isHoled, s.distanceErrorFt, s.targetDistanceFt) ? 'good' : 'off',
    text: pct,
    detail: `${s.ballSpeedMph.toFixed(1)} mph · ${finish}`,
    dir: pe === undefined || Math.abs(pe) < 1 ? undefined : pe > 0 ? 'up' : 'down',
  };

  // Face control: start direction against the aim you chose
  const le = s.startLineErrorDeg;
  const tol = lineToleranceDeg(s.targetDistanceFt);
  const face: DiagPart =
    le === undefined
      ? { state: 'na', text: '–' }
      : {
          state: Math.abs(le) <= tol ? 'good' : 'off',
          text: Math.abs(le) < 0.05 ? 'Dead straight' : `${fmtDeg(le)} ${le > 0 ? 'right' : 'left'}`,
          detail: Math.abs(le) <= tol ? 'started on your aim' : 'off your aim',
          dir: Math.abs(le) < 0.05 ? undefined : le > 0 ? 'right' : 'left',
        };

  // Read: share of the break played (100% = ideal), tested at perfect pace
  const r = s.read;
  const rd = r ? readDegrees(s) : null;
  let read: DiagPart;
  if (!r || !rd) read = { state: 'na', text: 'Ideal line', detail: 'Read + line is on' };
  else if (rd.breakPlayedPct === undefined)
    read = {
      state: r.verdict === 'good' ? 'good' : 'off',
      text: 'Straight putt',
      detail: Math.abs(rd.aimDeg) < 0.01 ? 'aimed at the hole' : `aimed ${side(rd.aimDeg)}`,
      dir: r.verdict === 'good' || Math.abs(rd.errorDeg) < 0.01 ? undefined : rd.errorDeg > 0 ? 'right' : 'left',
    };
  else
    read = {
      state: r.verdict === 'good' ? 'good' : 'off',
      text: r.verdict === 'good' ? 'Good read' : `${rd.breakPlayedPct}% of the break`,
      detail: r.verdict === 'good' ? `${rd.breakPlayedPct}% of the break · holes at perfect pace` : `${r.verdict === 'over' ? 'over-read' : 'under-read'} by ${fmtDeg(rd.errorDeg)}`,
      dir: r.verdict === 'good' ? undefined : r.verdict === 'over' ? 'up' : 'down',
    };

  // Launch & roll: launch angle against the ideal window, and how soon the ball starts rolling.
  const v = s.vla;
  const [lo, hi] = LAUNCH_WINDOW;
  const roll = rollSummary(s);
  const loft: DiagPart =
    v === undefined || Number.isNaN(v)
      ? { state: 'na', text: '–', detail: roll }
      : v < lo
      ? { state: 'off', text: 'Too little loft', detail: `launch ${v.toFixed(1)}° (ideal ${lo}–${hi}°) · ${roll}`, dir: 'down' }
      : v > hi
      ? { state: 'off', text: 'Too much loft', detail: `launch ${v.toFixed(1)}° (ideal ${lo}–${hi}°) · ${roll}`, dir: 'up' }
      : { state: 'good', text: 'Good launch', detail: `launch ${v.toFixed(1)}° · ${roll}` };

  // Headline: which of read, face, pace cost the putt (loft is shown, not blamed)
  const off = [read.state === 'off' && 'read', face.state === 'off' && 'face', pace.state === 'off' && 'pace'].filter(Boolean) as string[];
  const name: Record<string, string> = { read: 'the read', face: 'face control', pace: 'pace' };
  let headline: string;
  if (s.isHoled) headline = off.length ? `Holed, despite ${off.map((k) => name[k]).join(' and ')}` : 'Holed — read, face and pace all good';
  else if (!off.length) headline = 'Unlucky — read, face and pace were all close';
  else if (off.length === 1) headline = off[0] === 'read' ? 'Misread' : off[0] === 'face' ? 'Face control cost it' : 'Pace cost it';
  else if (off.length === 2) headline = `${cap(name[off[0]])} and ${name[off[1]]} both off`;
  else headline = 'Read, face and pace all off';
  return { pace, face, read, loft, headline };
}

/** "rolling after 24 in (14%)": skid from the physics model (speed + launch; no spin is measured). */
export function rollSummary(s: PuttingShotData) {
  const pct = s.rollDistanceFt > 0 ? Math.round((s.skidDistanceInches / 12 / s.rollDistanceFt) * 100) : 0;
  return `rolling after ${s.skidDistanceInches.toFixed(0)} in (${pct}%)`;
}

const median = (sorted: number[]) => {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export interface ReadStats {
  /** Putts where the player chose the line. */
  n: number;
  /** % of those whose chosen line would have holed at ideal pace. */
  readMakePct: number;
  /** Average gap between the chosen and ideal start direction, degrees. */
  avgErrorDeg: number;
  /** Breaking putts (ideal start ≥ 0.25° off the hole). */
  breaking: number;
  underPct: number;
  overPct: number;
  /** Median share of the break played on breaking putts (100% = the ideal amount). */
  breakPlayedPct: number | null;
  /** On missed putts: % where the read, face control, the pace was off (each can count). */
  missCause: { misses: number; readPct: number; facePct: number; pacePct: number } | null;
}

export function readStats(shots: PuttingShotData[]): ReadStats | null {
  const withRead = shots.filter((s) => s.read);
  if (!withRead.length) return null;
  const reads = withRead.map((s) => s.read!);
  const degs = withRead.map(readDegrees);
  const breakingIdx = degs.map((d, i) => (d.breakPlayedPct !== undefined ? i : -1)).filter((i) => i >= 0);
  const breaking = breakingIdx.map((i) => reads[i]);
  const ratios = breakingIdx.map((i) => Math.max(-1, Math.min(3, degs[i].breakPlayedPct! / 100))).sort((a, b) => a - b);
  const misses = withRead.filter((s) => !s.isHoled);
  const d = misses.map(diagnose);
  return {
    n: withRead.length,
    readMakePct: (reads.filter((r) => r.holesAtIdealPace).length / reads.length) * 100,
    avgErrorDeg: calculateMean(degs.map((d) => Math.abs(d.errorDeg))),
    breaking: breaking.length,
    underPct: breaking.length ? (breaking.filter((r) => r.verdict === 'under').length / breaking.length) * 100 : 0,
    overPct: breaking.length ? (breaking.filter((r) => r.verdict === 'over').length / breaking.length) * 100 : 0,
    breakPlayedPct: ratios.length ? median(ratios) * 100 : null,
    missCause: misses.length
      ? {
          misses: misses.length,
          readPct: (d.filter((x) => x.read.state === 'off').length / misses.length) * 100,
          facePct: (d.filter((x) => x.face.state === 'off').length / misses.length) * 100,
          pacePct: (d.filter((x) => x.pace.state === 'off').length / misses.length) * 100,
        }
      : null,
  };
}
