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

const inches = (n: number) => (Math.abs(n) >= 12 ? `${(Math.abs(n) / 12).toFixed(1)} ft` : `${Math.round(Math.abs(n))} in`);

/** Start-line tolerance: what moves the ball ~1.5 in at the hole, but never under 0.5°. */
export function lineToleranceDeg(distanceFt: number) {
  return Math.max(0.5, (Math.atan(1.5 / Math.max(12, distanceFt * 12)) * 180) / Math.PI);
}
export const PACE_TOLERANCE_PCT = 8;

export function diagnose(s: PuttingShotData): Diagnosis {
  const r = s.read;
  const read: DiagPart = !r
    ? { state: 'na', text: 'Ideal line (Read + line)' }
    : r.verdict === 'good'
    ? { state: 'good', text: Math.abs(r.idealIn) < 1 ? 'Holes at ideal pace' : `Holes · played ${inches(r.aimIn)} ${r.aimIn > 0 ? 'right' : 'left'}` }
    : r.verdict === 'over'
    ? { state: 'off', text: `Over-read ${inches(r.errorIn)}` }
    : r.verdict === 'under'
    ? { state: 'off', text: `Under-read ${inches(r.errorIn)}` }
    : { state: 'off', text: `Aimed ${inches(r.errorIn)} ${r.verdict}` };

  const le = s.startLineErrorDeg;
  const tol = lineToleranceDeg(s.targetDistanceFt);
  const line: DiagPart =
    le === undefined
      ? { state: 'na', text: '–' }
      : Math.abs(le) <= tol
      ? { state: 'good', text: 'On your line' }
      : { state: 'off', text: `${Math.abs(le).toFixed(1)}° ${le > 0 ? 'right' : 'left'}` };

  const pe = s.speedErrorPct;
  const pace: DiagPart =
    pe === undefined
      ? { state: 'na', text: '–' }
      : Math.abs(pe) <= PACE_TOLERANCE_PCT
      ? { state: 'good', text: 'Good pace' }
      : { state: 'off', text: `${Math.abs(pe).toFixed(0)}% ${pe > 0 ? 'firm' : 'soft'}` };

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
  /** Average distance between the chosen and ideal aim points, inches. */
  avgErrorIn: number;
  /** Breaking putts (ideal aim ≥ 2 in off the cup). */
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
  const breaking = reads.filter((r) => Math.abs(r.idealIn) >= 2);
  const ratios = breaking.map((r) => Math.max(-1, Math.min(3, r.aimIn / r.idealIn))).sort((a, b) => a - b);
  const misses = withRead.filter((s) => !s.isHoled);
  const d = misses.map(diagnose);
  return {
    n: withRead.length,
    readMakePct: (reads.filter((r) => r.holesAtIdealPace).length / reads.length) * 100,
    avgErrorIn: calculateMean(reads.map((r) => Math.abs(r.errorIn))),
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
