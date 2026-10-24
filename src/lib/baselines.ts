/**
 * Putting baselines for strokes gained and make-rate comparisons: PGA Tour, scratch, 5, 10,
 * 15 and 20 handicap.
 *
 * - PGA Tour: Broadie's ShotLink expected-putts table and Tour make % (calculations.ts).
 * - Amateurs: make % by distance and handicap from Shot Scope (published by MyGolfSpy, 2025),
 *   smoothed so a better handicap never makes fewer. Nobody publishes full expected-putts
 *   tables by handicap, so they are built as
 *       expected putts = 2 − P(make) + P(3-putt)
 *   with the 3-putt chance shaped like the Tour's by distance and scaled to Lou Stagner's Arccos
 *   3-putt rates from ~38 ft (scratch ≈25%, 5 hcp 33.8%, 10 hcp 38.6%, 15 hcp 43.5%, 20 hcp ≈48%).
 *   Treat the amateur baselines as good approximations, not official tables.
 */

import { getPgaExpectedPutts, getTourMakePct } from './calculations';

export type Baseline = 'tour' | 'scratch' | 'h5' | 'h10' | 'h15' | 'h20';

export const BASELINES: { id: Baseline; label: string; long: string }[] = [
  { id: 'tour', label: 'PGA Tour', long: 'PGA Tour' },
  { id: 'scratch', label: 'Scratch', long: 'a scratch golfer' },
  { id: 'h5', label: '5 hcp', long: 'a 5 handicap' },
  { id: 'h10', label: '10 hcp', long: 'a 10 handicap' },
  { id: 'h15', label: '15 hcp', long: 'a 15 handicap' },
  { id: 'h20', label: '20 hcp', long: 'a 20 handicap' },
];

// Shot Scope band midpoints (ft): 0–3, 3–6, 6–9, 9–12, 12–18, 18–24, 24–30, 30+
const MIDS = [2, 4.5, 7.5, 10.5, 15, 21, 27, 36];
const RAW_MAKE: Record<Exclude<Baseline, 'tour'>, number[]> = {
  scratch: [98, 76, 49, 34, 19, 12, 7, 4],
  h5: [96, 67, 44, 34, 19, 13, 7, 3],
  h10: [96, 65, 39, 26, 18, 10, 7, 3],
  h15: [93, 59, 36, 22, 16, 9, 7, 2],
  h20: [90, 55, 33, 18, 14, 7, 5, 2],
};
/** Arccos 3-putt rate from ~38 ft, used to scale the Tour's 3-putt curve. */
const THREE_PUTT_38: Record<Exclude<Baseline, 'tour'>, number> = { scratch: 0.25, h5: 0.338, h10: 0.386, h15: 0.435, h20: 0.48 };

// Smooth: a higher handicap never makes more than a lower one at the same distance.
const ORDER: Exclude<Baseline, 'tour'>[] = ['scratch', 'h5', 'h10', 'h15', 'h20'];
const MAKE: Record<string, [number, number][]> = {};
ORDER.forEach((b, bi) => {
  const row = RAW_MAKE[b].map((v, i) => (bi === 0 ? v : Math.min(v, MAKE[ORDER[bi - 1]][i + 1][1])));
  // anchors: certain at 1 ft, fading to ~half the 30+ figure by 55 ft
  MAKE[b] = [[1, 100], ...MIDS.map((d, i) => [d, row[i]] as [number, number]), [55, row[row.length - 1] / 2]];
});

function interp(table: [number, number][], x: number) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** One-putt chance (%) from a distance (ft). */
export function makePct(b: Baseline, distanceFt: number): number {
  if (b === 'tour') return getTourMakePct(distanceFt);
  return interp(MAKE[b], Math.max(0, distanceFt));
}

const tourThreePutt = (d: number) => Math.max(0, getPgaExpectedPutts(d) - 2 + getTourMakePct(d) / 100);
const K: Record<string, number> = {};
for (const b of ORDER) K[b] = THREE_PUTT_38[b] / tourThreePutt(38);

/** Average putts to hole out from a distance (ft). */
export function expectedPutts(b: Baseline, distanceFt: number): number {
  const d = Math.max(0, distanceFt);
  if (b === 'tour') return getPgaExpectedPutts(d);
  if (d <= 1) return d; // as the Tour table: tap-ins count ~1, zero at the hole
  const p3 = Math.min(0.55, K[b] * tourThreePutt(d));
  return Math.max(1, 2 - makePct(b, d) / 100 + p3);
}

/** Strokes gained by one putt against a baseline: expected(start) − 1 − expected(leave). */
export function strokesGained(b: Baseline, startFt: number, holed: boolean, leaveFt: number): number {
  return expectedPutts(b, startFt) - 1 - (holed ? 0 : expectedPutts(b, leaveFt));
}
