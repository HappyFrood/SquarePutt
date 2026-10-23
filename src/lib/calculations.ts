/**
 * SquarePutt Analytics & Biomechanical Calculation Suite
 * Quintic-inspired variance grading, Dynamic Loft & Skid optimization,
 * CEP, and PGA Tour Strokes Gained: Putting.
 */

import { QuinticGrade, QuinticTierInfo } from './types';

export const QUINTIC_TIERS: Record<QuinticGrade, QuinticTierInfo> = {
  eagle: {
    tier: 'eagle',
    label: 'Eagle (Tour Level)',
    color: '#38bdf8', // Light sky cyan / blue
    bgRgba: 'rgba(56, 189, 248, 0.15)',
    borderHex: '#0284c7',
    description: 'PGA Tour caliber consistency and minimal variance.',
  },
  birdie: {
    tier: 'birdie',
    label: 'Birdie (Very Good)',
    color: '#34d399', // Emerald
    bgRgba: 'rgba(52, 211, 153, 0.15)',
    borderHex: '#059669',
    description: 'High level amateur / scratch player consistency.',
  },
  par: {
    tier: 'par',
    label: 'Par (Solid)',
    color: '#fbbf24', // Amber
    bgRgba: 'rgba(251, 191, 36, 0.15)',
    borderHex: '#d97706',
    description: 'Moderate consistency with occasional directional or speed bias.',
  },
  bogey: {
    tier: 'bogey',
    label: 'Bogey (High Variance)',
    color: '#f87171', // Red
    bgRgba: 'rgba(248, 113, 113, 0.15)',
    borderHex: '#dc2626',
    description: 'High variance. Needs mechanical drills on face control or speed.',
  },
};

/**
 * Standard Deviation helper
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Grades Face Angle at impact (single shot absolute error from square)
 */
export function gradeFaceAngle(faceAngleDeg: number): QuinticGrade {
  const absAngle = Math.abs(faceAngleDeg);
  if (absAngle <= 0.6) return 'eagle';
  if (absAngle <= 1.2) return 'birdie';
  if (absAngle <= 2.0) return 'par';
  return 'bogey';
}

/**
 * Grades Face Angle variance across a drill session (std dev)
 */
export function gradeFaceAngleVariance(stdDevDeg: number): QuinticGrade {
  if (stdDevDeg <= 0.45) return 'eagle';
  if (stdDevDeg <= 0.85) return 'birdie';
  if (stdDevDeg <= 1.40) return 'par';
  return 'bogey';
}

/**
 * Grades Putter Path at impact (degrees)
 */
export function gradePutterPath(pathDeg: number): QuinticGrade {
  const absPath = Math.abs(pathDeg);
  if (absPath <= 1.0) return 'eagle';
  if (absPath <= 2.0) return 'birdie';
  if (absPath <= 3.2) return 'par';
  return 'bogey';
}

/**
 * Grades Ball Speed variance across identical distance putts
 * (Coefficient of variation = stdDev / mean)
 */
export function gradeSpeedVariance(speedsMph: number[]): QuinticGrade {
  if (speedsMph.length < 2) return 'birdie';
  const mean = calculateMean(speedsMph);
  if (mean === 0) return 'par';
  const stdDev = calculateStdDev(speedsMph);
  const cvPct = (stdDev / mean) * 100;

  if (cvPct <= 2.8) return 'eagle';
  if (cvPct <= 4.8) return 'birdie';
  if (cvPct <= 7.5) return 'par';
  return 'bogey';
}

/**
 * Dynamic Loft & Angle of Attack Optimization Benchmark
 * Ideal launch window is ~1.5° (1.0° to 2.0°).
 */
export interface DynamicLoftAnalysis {
  launchAngleDeg: number;
  angleOfAttackDeg: number;
  dynamicLoftDeg: number;
  status: 'optimal' | 'low' | 'high';
  grade: QuinticGrade;
  diagnosis: string;
  recommendation: string;
}

export function analyzeDynamicLoft(
  dynamicLoftDeg: number,
  angleOfAttackDeg: number,
  vlaDeg?: number
): DynamicLoftAnalysis {
  // Approximate effective launch angle if VLA not directly provided:
  // Effective launch ~ Dynamic Loft + 0.3 * AoA (compressed turf interaction)
  const launchAngle = vlaDeg !== undefined ? vlaDeg : dynamicLoftDeg + 0.3 * angleOfAttackDeg;

  if (launchAngle >= 1.0 && launchAngle <= 2.0) {
    return {
      launchAngleDeg: Number(launchAngle.toFixed(1)),
      angleOfAttackDeg: Number(angleOfAttackDeg.toFixed(1)),
      dynamicLoftDeg: Number(dynamicLoftDeg.toFixed(1)),
      status: 'optimal',
      grade: 'eagle',
      diagnosis: 'Optimal Launch Window (~1.5°)',
      recommendation: 'Ball lifts smoothly out of the turf depression with minimal hop and immediate true roll transition.',
    };
  }

  if (launchAngle < 1.0) {
    return {
      launchAngleDeg: Number(launchAngle.toFixed(1)),
      angleOfAttackDeg: Number(angleOfAttackDeg.toFixed(1)),
      dynamicLoftDeg: Number(dynamicLoftDeg.toFixed(1)),
      status: 'low',
      grade: launchAngle >= 0.4 ? 'birdie' : 'bogey',
      diagnosis: 'Low Launch / Driven into Turf',
      recommendation: 'Dynamic loft is too delofted or AoA is too steep downward. Ball is driven into the green cup, creating erratic bounce.',
    };
  }

  return {
    launchAngleDeg: Number(launchAngle.toFixed(1)),
    angleOfAttackDeg: Number(angleOfAttackDeg.toFixed(1)),
    dynamicLoftDeg: Number(dynamicLoftDeg.toFixed(1)),
    status: 'high',
    grade: launchAngle <= 2.7 ? 'par' : 'bogey',
    diagnosis: 'Excessive Launch / Bouncing Ball',
    recommendation: 'Too much dynamic loft is lifting the ball airborne, causing skidding hops and distance inconsistency.',
  };
}

/**
 * PGA Tour baseline: average putts to hole out from a distance (ft).
 * Source: Broadie, "Every Shot Counts" (ShotLink putting baseline). Linearly interpolated.
 */
const TOUR_EXPECTED_PUTTS: [number, number][] = [
  [0, 0], [1, 1.0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42],
  [8, 1.5], [9, 1.56], [10, 1.61], [15, 1.78], [20, 1.87], [30, 1.98], [40, 2.06],
  [50, 2.14], [60, 2.21], [90, 2.4],
];

/** Approximate PGA Tour one-putt percentage by distance (ft). */
const TOUR_MAKE_PCT: [number, number][] = [
  [2, 99], [3, 96], [4, 88], [5, 77], [6, 66], [7, 58], [8, 50], [9, 45], [10, 40],
  [15, 23], [20, 15], [25, 10], [30, 7], [40, 4], [60, 2],
];

function interp(table: [number, number][], x: number): number {
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

export function getPgaExpectedPutts(distanceFt: number): number {
  return interp(TOUR_EXPECTED_PUTTS, Math.max(0, distanceFt));
}

export function getTourMakePct(distanceFt: number): number {
  return interp(TOUR_MAKE_PCT, Math.max(0, distanceFt));
}

/**
 * Strokes gained for a single putt: expected(start) - 1 - expected(remaining).
 */
export function calculateStrokesGained({
  startDistanceFt,
  isHoled,
  remainingDistanceFt,
}: {
  startDistanceFt: number;
  isHoled: boolean;
  remainingDistanceFt: number;
}): number {
  const remaining = isHoled ? 0 : getPgaExpectedPutts(remainingDistanceFt);
  return getPgaExpectedPutts(startDistanceFt) - 1 - remaining;
}

/** Circular Error Probable (median miss radius) in inches. */
export function calculateCepInches(deviations: { xInches: number; zInches: number }[]): number {
  if (deviations.length === 0) return 0;
  const radii = deviations.map((d) => Math.hypot(d.xInches, d.zInches)).sort((a, b) => a - b);
  const mid = Math.floor(radii.length / 2);
  const median = radii.length % 2 ? radii[mid] : (radii[mid - 1] + radii[mid]) / 2;
  return Number(median.toFixed(1));
}

/** Grades ball speed versus the ideal speed for the putt (percent error). */
export function gradeSpeedError(speedErrorPct: number): QuinticGrade {
  const e = Math.abs(speedErrorPct);
  if (e <= 3) return 'eagle';
  if (e <= 6) return 'birdie';
  if (e <= 10) return 'par';
  return 'bogey';
}

/** Grades front-to-back distance dispersion (std dev, ft) for lag putting. */
export function gradeDistanceDispersion(stdDevFt: number): QuinticGrade {
  if (stdDevFt <= 1.0) return 'eagle';
  if (stdDevFt <= 1.75) return 'birdie';
  if (stdDevFt <= 2.75) return 'par';
  return 'bogey';
}

/** Grades strokes gained per 18 holes. */
export function gradeStrokesGainedPer18(sg18: number): QuinticGrade {
  if (sg18 >= 0) return 'eagle';
  if (sg18 >= -2) return 'birdie';
  if (sg18 >= -4.5) return 'par';
  return 'bogey';
}
