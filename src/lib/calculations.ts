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
 * PGA Tour ShotLink Expected Putts Table (distance in feet)
 * Source: Broadie "Every Shot Counts" & PGA Tour baseline putting distribution
 */
export function getPgaExpectedPutts(distanceFt: number): number {
  if (distanceFt <= 1.0) return 1.00;
  if (distanceFt <= 3.0) return 1.04;
  if (distanceFt <= 5.0) return 1.23;
  if (distanceFt <= 8.0) return 1.50;
  if (distanceFt <= 10.0) return 1.62;
  if (distanceFt <= 15.0) return 1.78;
  if (distanceFt <= 20.0) return 1.88;
  if (distanceFt <= 25.0) return 1.94;
  if (distanceFt <= 30.0) return 1.98;
  if (distanceFt <= 40.0) return 2.05;
  if (distanceFt <= 50.0) return 2.14;
  return 2.25;
}

/**
 * Calculates Strokes Gained: Putting for a single shot
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
  const expectedStart = getPgaExpectedPutts(startDistanceFt);
  if (isHoled) {
    // 1 stroke taken, 0 expected remaining
    return Number((expectedStart - 1.0).toFixed(2));
  }
  const expectedRemaining = getPgaExpectedPutts(remainingDistanceFt);
  // 1 stroke taken + expected remaining
  const sg = expectedStart - 1.0 - expectedRemaining;
  return Number(sg.toFixed(2));
}

/**
 * Calculates Circular Error Probable (CEP 50%) in inches
 * The radius of a circle centered on the target containing 50% of shots.
 */
export function calculateCepInches(deviations: { xInches: number; zInches: number }[]): number {
  if (deviations.length === 0) return 0;
  const radii = deviations.map((d) => Math.sqrt(d.xInches * d.xInches + d.zInches * d.zInches));
  radii.sort((a, b) => a - b);
  const medianIndex = Math.floor(radii.length / 2);
  return Number(radii[medianIndex].toFixed(1));
}
