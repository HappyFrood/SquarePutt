/**
 * Splits a putt into its three parts — the read, the start line, the pace — and says which
 * one cost it. The read is judged on its own: SquarePutt rolls the player's chosen line at the
 * ideal pace and checks whether it would have dropped.
 */

import { PuttingShotData } from './types';
import { calculateMean } from './calculations';

export type PartState = 'good' | 'off' | 'na';

export interface DiagPart {
  state: PartState;
  /** Short result, e.g. "Under-read 3 in", "0.8° right", "12% firm". */
  text: string;
}

export interface Diagnosis {
  read: DiagPart;
  line: DiagPart;
  pace: DiagPart;
  /** One-line verdict, e.g. "Misread", "Pace cost it". */
  headline: string;
}

/** Degrees for display: 1.0°, 0.5°, 0.25° → "1°", "0.5°", "0.25°"; one decimal otherwise. */
export const fmtDeg = (d: number) => {
  const n = Math.abs(d);
  return `${n >= 10 ? n.toFixed(0) : Number(n.toFixed(n < 1 ? 2 : 1)).toString()}°`;
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
  const r = s.read;
  const rd = r ? readDegrees(s) : null;
  const played = rd?.breakPlayedPct !== undefined ? ` · ${rd.breakPlayedPct}% of break` : '';
  const read: DiagPart = !r || !rd
    ? { state: 'na', text: 'Ideal line (Read + line)' }
    : r.verdict === 'good'
    ? { state: 'good', text: 'Holes at perfect pace' }
    : r.verdict === 'over'
    ? { state: 'off', text: `Over-read ${fmtDeg(rd.errorDeg)}${played}` }
    : r.verdict === 'under'
    ? { state: 'off', text: `Under-read ${fmtDeg(rd.errorDeg)}${played}` }
    : { state: 'off', text: `${fmtDeg(rd.errorDeg)} ${r.verdict} of the read` };

  const le = s.startLineErrorDeg;
  const tol = lineToleranceDeg(s.targetDistanceFt);
  const line: DiagPart =
    le === undefined
      ? { state: 'na', text: '–' }
      : Math.abs(le) <= tol
      ? { state: 'good', text: 'On your line' }
      : { state: 'off', text: side(le) };

  const pe = s.speedErrorPct;
  const pct = pe !== undefined && Math.abs(pe) >= 1 ? `${Math.abs(pe).toFixed(0)}% ${pe > 0 ? 'firm' : 'soft'}` : 'ideal pace';
  const pace: DiagPart = paceIsGood(s.isHoled, s.distanceErrorFt, s.targetDistanceFt)
    ? { state: 'good', text: pe === undefined ? 'Good pace' : `Good · ${pct}` }
    : s.distanceErrorFt < 0
    ? { state: 'off', text: `Short · ${pct}` }
    : { state: 'off', text: `Too firm · ${pct}` };

  const off = [read.state === 'off' && 'read', line.state === 'off' && 'start line', pace.state === 'off' && 'pace'].filter(Boolean) as string[];
  let headline: string;
  if (s.isHoled) headline = off.length ? `Holed, despite the ${off.join(' and ')}` : 'Holed — read, line and pace all good';
  else if (!off.length) headline = 'Unlucky — read, line and pace were all close';
  else if (off.length === 1) headline = off[0] === 'read' ? 'Misread' : off[0] === 'start line' ? 'Start line cost it' : 'Pace cost it';
  else if (off.length === 2) headline = `${cap(off[0])} and ${off[1]} both off`;
  else headline = 'Read, start line and pace all off';
  return { read, line, pace, headline };
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
  /** On missed putts: % where the read, the start line, the pace was off (each can count). */
  missCause: { misses: number; readPct: number; linePct: number; pacePct: number } | null;
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
          linePct: (d.filter((x) => x.line.state === 'off').length / misses.length) * 100,
          pacePct: (d.filter((x) => x.pace.state === 'off').length / misses.length) * 100,
        }
      : null,
  };
}
