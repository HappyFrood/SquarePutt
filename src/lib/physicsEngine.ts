/**
 * SquarePutt 3D Putting Physics Engine
 * Incorporates calibrated rolling sphere physics from rroojrooj/Open-Birdie
 * combined with USGA Stimpmeter friction calibration, Skid-to-Roll transition,
 * and cup capture dynamics.
 */

import { SlopeDifficulty } from './types';

export interface SurfacePoint {
  x: number;  // meters (lateral)
  y: number;  // meters (vertical elevation)
  z: number;  // meters (forward distance along green)
}

export interface TerrainGradient {
  dhdx: number; // lateral slope component
  dhdz: number; // forward/backward slope component
}

export interface SimulationResult {
  trajectory: SurfacePoint[];
  finalPosition: SurfacePoint;
  totalDistanceMeters: number;
  totalDistanceFt: number;
  lateralDeviationInches: number;
  distanceErrorFt: number;
  isHoled: boolean;
  timeToZeroSkidMs: number;
  skidDistanceInches: number;
  trueRollDistanceFt: number;
  durationSeconds: number;
}

// Physical Constants (aligned with Open-Birdie & USGA standard models)
const GRAVITY = 9.80665;       // m/s^2 (G)
const ROLL_INERTIA = 5 / 7;    // Solid sphere rolling inertia factor (from Open-Birdie)
const V_STOP = 0.018;          // m/s - resting threshold
const METERS_TO_FEET = 3.28084;
const FEET_TO_METERS = 0.3048;
const METERS_TO_INCHES = 39.3701;
const MPH_TO_MPS = 0.44704;

// Standard USGA hole diameter = 4.25 inches (0.10795 m) -> radius ~0.054 m
export const STANDARD_HOLE_RADIUS_METERS = 0.053975;
// Maximum capture velocity before ball skips over the cup or lips out violently
export const CUP_CAPTURE_SPEED_MPS = 1.62; // ~3.6 mph

/**
 * Converts Stimpmeter reading (ft) to rolling deceleration friction coefficient mu.
 * Derived from S = v^2 / (2 * mu * g), where v_stimp ~ 1.83 m/s (6.0 ft/s).
 */
export function stimpToFrictionCoefficient(stimpFt: number): number {
  const clampedStimp = Math.min(Math.max(stimpFt, 8.0), 14.0);
  return 1.95 / clampedStimp;
}

/**
 * Calculates procedural green elevation and gradients at coordinate (x, z).
 * Coordinate system:
 * - x: lateral axis (negative = left, positive = right)
 * - z: putting axis (0 = ball start position, +z = towards hole)
 * - y: elevation (height above base plane)
 */
export class GreenTerrain {
  public difficulty: SlopeDifficulty;
  public seed: number;

  private maxSlopeRad: number;
  private primaryBreakDirection: number;

  constructor(difficulty: SlopeDifficulty = 'flat', seed: number = 42) {
    this.difficulty = difficulty;
    this.seed = seed;
    this.maxSlopeRad = this.getMaxSlopeRad(difficulty);
    this.primaryBreakDirection = ((seed % 100) / 100) * Math.PI * 2;
  }

  private getMaxSlopeRad(difficulty: SlopeDifficulty): number {
    switch (difficulty) {
      case 'flat':
        return 0.0001;
      case 'mild':
        return 0.0175; // 1.0 deg
      case 'medium':
        return 0.0349; // 2.0 deg
      case 'hard':
        return 0.0524; // 3.0 deg
    }
  }

  /**
   * Elevation function h(x, z) in meters.
   */
  public getElevation(x: number, z: number): number {
    if (this.difficulty === 'flat') {
      return 0.0;
    }

    const slopeScale = Math.sin(this.maxSlopeRad);
    const cosDir = Math.cos(this.primaryBreakDirection);
    const sinDir = Math.sin(this.primaryBreakDirection);

    // Planar slope component
    const planarComponent = (x * cosDir + z * sinDir) * slopeScale * 0.7;

    // Procedural undulating undulation
    const wave1 = Math.sin(x * 0.8 + z * 0.4 + this.seed) * slopeScale * 0.2;
    const wave2 = Math.cos(x * 0.4 - z * 0.6 + this.seed * 0.5) * slopeScale * 0.15;

    return planarComponent + wave1 + wave2;
  }

  /**
   * Returns surface gradient [dh/dx, dh/dz] for physics forces.
   */
  public getGradient(x: number, z: number): TerrainGradient {
    if (this.difficulty === 'flat') {
      return { dhdx: 0, dhdz: 0 };
    }

    const delta = 0.01; // 1 cm sampling delta
    const hCenter = this.getElevation(x, z);
    const hRight = this.getElevation(x + delta, z);
    const hForward = this.getElevation(x, z + delta);

    return {
      dhdx: (hRight - hCenter) / delta,
      dhdz: (hForward - hCenter) / delta,
    };
  }
}

/**
 * Simulates a putt given launch monitor telemetry on a virtual green surface.
 * Incorporates Open-Birdie's rolling sphere inertia factor and numerical stability
 * alongside SquarePutt's Skid-to-Roll transition.
 */
export function simulatePutt({
  ballSpeedMph,
  hlaDeg,
  stimp = 10.5,
  targetDistanceFt = 10.0,
  slopeDifficulty = 'flat',
  terrainSeed = 42,
  holeRadiusMultiplier = 1.0,
}: {
  ballSpeedMph: number;
  hlaDeg: number;             // Horizontal Launch Angle (- left, + right)
  vlaDeg?: number;            // Vertical Launch Angle
  stimp?: number;             // Stimp 9.0 - 12.0
  targetDistanceFt?: number;  // Distance to cup in feet
  slopeDifficulty?: SlopeDifficulty;
  terrainSeed?: number;
  holeRadiusMultiplier?: number;
}): SimulationResult {
  const terrain = new GreenTerrain(slopeDifficulty, terrainSeed);
  const muRoll = stimpToFrictionCoefficient(stimp);
  const muKinetic = muRoll * 1.55; // Kinetic sliding friction during initial skid

  const v0_mps = ballSpeedMph * MPH_TO_MPS;
  const hlaRad = (hlaDeg * Math.PI) / 180.0;

  // Initial horizontal velocity vectors
  let vx = v0_mps * Math.sin(hlaRad);
  let vz = v0_mps * Math.cos(hlaRad);

  let x = 0;
  let z = 0;
  let y = terrain.getElevation(x, z);

  const targetDistanceMeters = targetDistanceFt * FEET_TO_METERS;
  const holeRadius = STANDARD_HOLE_RADIUS_METERS * holeRadiusMultiplier;
  const holeCenter = { x: 0, z: targetDistanceMeters };

  // Calculate Skid phase transition
  // Time to zero skid: t_skid = (2 * v0) / (7 * mu_k * g)
  const timeToZeroSkidSeconds = Math.max(0.02, (2 * v0_mps) / (7 * muKinetic * GRAVITY));
  const timeToZeroSkidMs = Math.round(timeToZeroSkidSeconds * 1000);

  // Approximate skid distance
  const skidDistMeters = Math.max(
    0.05,
    v0_mps * timeToZeroSkidSeconds - 0.5 * muKinetic * GRAVITY * Math.pow(timeToZeroSkidSeconds, 2)
  );
  const skidDistanceInches = Number((skidDistMeters * METERS_TO_INCHES).toFixed(1));

  const trajectory: SurfacePoint[] = [{ x, y, z }];
  let currentTime = 0;
  const dt = 0.002; // High-precision 2ms integration timestep (matching Open-Birdie)
  const MAX_TIME = 15.0;
  let lowSpeedTime = 0;
  let isHoled = false;

  while (currentTime < MAX_TIME) {
    const speed = Math.sqrt(vx * vx + vz * vz);

    // Open-Birdie Static Friction & Low Speed Hold
    if (speed < V_STOP) {
      lowSpeedTime += dt;
      const grad = terrain.getGradient(x, z);
      const gmag = Math.sqrt(grad.dhdx * grad.dhdx + grad.dhdz * grad.dhdz);
      // If slope gravity cannot overcome rolling friction or ball has dithered
      if (ROLL_INERTIA * GRAVITY * Math.min(gmag, 1.0) <= muRoll * GRAVITY || lowSpeedTime > 0.4) {
        break;
      }
    } else {
      lowSpeedTime = 0;
    }

    // Check Cup Capture
    const distToHole = Math.sqrt(Math.pow(x - holeCenter.x, 2) + Math.pow(z - holeCenter.z, 2));
    if (distToHole <= holeRadius) {
      if (speed <= CUP_CAPTURE_SPEED_MPS) {
        isHoled = true;
        x = holeCenter.x;
        z = holeCenter.z;
        y = terrain.getElevation(x, z) - 0.04; // Drop into cup depth
        trajectory.push({ x, y, z });
        break;
      }
    }

    // Determine current friction coefficient (skid vs pure roll)
    const activeMu = currentTime < timeToZeroSkidSeconds ? muKinetic : muRoll;

    // Get terrain slope gradients
    const grad = terrain.getGradient(x, z);
    const gmag = Math.sqrt(grad.dhdx * grad.dhdx + grad.dhdz * grad.dhdz);
    const gx = gmag > 1.0 ? grad.dhdx / gmag : grad.dhdx; // Open-Birdie slope clamp guard
    const gz = gmag > 1.0 ? grad.dhdz / gmag : grad.dhdz;

    // Forces (Integrating Open-Birdie's ROLL_INERTIA 5/7 solid sphere rolling factor):
    // 1. Gravity along slope: a_gravity = -ROLL_INERTIA * g * grad
    const ax_grav = -ROLL_INERTIA * GRAVITY * gx;
    const az_grav = -ROLL_INERTIA * GRAVITY * gz;

    // 2. Rolling friction opposite to velocity: a_friction = -mu * g * (v / |v|)
    let ax_fric = 0;
    let az_fric = 0;
    if (speed > 1e-6) {
      ax_fric = -activeMu * GRAVITY * (vx / speed);
      az_fric = -activeMu * GRAVITY * (vz / speed);
    }

    const ax = ax_grav + ax_fric;
    const az = az_grav + az_fric;

    // Open-Birdie friction direction reversal guard (prevents jitter at near-zero speeds)
    const nextVx = vx + ax * dt;
    const nextVz = vz + az * dt;
    if ((vx * nextVx + vz * nextVz) < 0 && gmag < 0.02) {
      vx = 0;
      vz = 0;
      break;
    } else {
      vx = nextVx;
      vz = nextVz;
    }

    x += vx * dt;
    z += vz * dt;
    y = terrain.getElevation(x, z);

    currentTime += dt;

    // Record trajectory point every 10 timesteps (20ms intervals) for smooth render
    if (Math.round(currentTime / dt) % 10 === 0) {
      trajectory.push({ x, y, z });
    }
  }

  const finalPosition: SurfacePoint = { x, y, z };
  trajectory.push(finalPosition);

  const totalDistanceMeters = Math.sqrt(x * x + z * z);
  const totalDistanceFt = Number((totalDistanceMeters * METERS_TO_FEET).toFixed(2));
  const lateralDeviationInches = Number((x * METERS_TO_INCHES).toFixed(1));
  const distanceErrorFt = Number((totalDistanceFt - targetDistanceFt).toFixed(2));
  const trueRollDistanceFt = Number(
    Math.max(0, totalDistanceFt - skidDistanceInches / 12).toFixed(2)
  );

  return {
    trajectory,
    finalPosition,
    totalDistanceMeters,
    totalDistanceFt,
    lateralDeviationInches,
    distanceErrorFt,
    isHoled,
    timeToZeroSkidMs,
    skidDistanceInches,
    trueRollDistanceFt,
    durationSeconds: Number(currentTime.toFixed(2)),
  };
}
