/**
 * SquarePutt Types & Data Models
 * High-fidelity putting analysis and gamified practice for Square Golf Launch Monitor.
 */

// Open Connect API standard telemetry packet formats
export interface RawOpenConnectPacket {
  BallData?: {
    Speed?: number;        // mph or m/s depending on connector
    VLA?: number;          // Vertical Launch Angle (deg)
    HLA?: number;          // Horizontal Launch Angle (deg, - left, + right)
    TotalSpin?: number;    // RPM
    SpinAxis?: number;     // deg
    CarryDistance?: number;
  };
  ClubData?: {
    Speed?: number;        // mph
    Path?: number;         // deg (- in-to-out or out-to-in depending on standard)
    FaceToPath?: number;   // deg
    FaceAngle?: number;    // deg (- closed, + open)
    AngleOfAttack?: number;// deg (- downward, + upward)
    DynamicLoft?: number;  // deg
    Lie?: number;
  };
  ShotNumber?: number;
  Confidence?: number;     // 0-100% confidence rating if supplied
  DeviceStatus?: string;
  Timestamp?: number;
}

// Sanitized and normalized telemetry shot record
export interface PuttingShotData {
  id: string;
  timestamp: number;
  shotNumber: number;

  // Ball Telemetry
  ballSpeedMph: number;     // mph
  ballSpeedMps: number;     // m/s
  vla: number;              // Vertical Launch Angle (deg)
  hla: number;              // Horizontal Launch Angle (deg, - left, + right)
  totalSpinRpm?: number;

  // Club Telemetry
  clubSpeedMph?: number;    // mph
  angleOfAttackDeg: number; // deg (+ upward, - downward)
  putterPathDeg: number;    // deg (+ in-to-out, - out-to-in)
  faceAngleDeg: number;     // deg (+ open, - closed)
  faceToPathDeg: number;    // faceAngle - putterPath
  dynamicLoftDeg: number;   // deg

  // Physics Simulation Results
  stimpSetting: number;     // Stimp 9.0 to 12.0
  slopeDifficulty: 'flat' | 'mild' | 'medium' | 'hard';
  targetDistanceFt: number; // distance to hole in feet
  rollDistanceFt: number;   // total distance rolled in feet
  lateralErrorInches: number;// lateral deviation at rest (- left, + right in inches)
  distanceErrorFt: number;  // (rollDistanceFt - targetDistanceFt)
  isHoled: boolean;         // entered cup below threshold speed
  timeToZeroSkidMs: number; // calculated skid duration
  skidDistanceInches: number;// distance traveled before pure rolling
  trueRollDistanceFt: number;// pure roll distance
  skidPercentage: number;   // skid / total distance

  // Quintic Consistency Grades
  grades: {
    faceAngleGrade: QuinticGrade;
    pathGrade: QuinticGrade;
    speedConsistencyGrade: QuinticGrade;
    launchGrade: QuinticGrade;
    overallGrade: QuinticGrade;
  };

  // Trajectory points for 3D animation [x, y, z] in meters
  trajectoryPoints?: [number, number, number][];
}

// Quintic-inspired color-coding tiers
export type QuinticGrade = 'eagle' | 'birdie' | 'par' | 'bogey';

export interface QuinticTierInfo {
  tier: QuinticGrade;
  label: string;
  color: string;
  bgRgba: string;
  borderHex: string;
  description: string;
}

// Green Environment Configuration
export type SlopeDifficulty = 'flat' | 'mild' | 'medium' | 'hard';

export interface GreenEnvironmentConfig {
  stimp: number;            // 9.0 - 12.0
  slopeDifficulty: SlopeDifficulty;
  gridVisible: boolean;
  heatmapVisible: boolean;
  fallLinesVisible: boolean;
  cameraMode: 'behind' | 'overhead' | 'follow' | 'orbit';
  cameraAngle: number;      // rotation angle in rad
}

// Gamified Drill Modes
export type AppMode = 'analysis' | 'pressure-circle' | 'speed-control' | 'scramble-gauntlet' | 'analytics';

// Drill A: Short Putts ("The Pressure Circle" - Survival Mode)
export interface PressureCircleState {
  currentDistanceFt: 3 | 5 | 8;
  targetHoleRadiusMultiplier: number; // shrinks as streak increases (1.0 down to 0.5)
  streak: number;
  bestStreak: number;
  totalAttempts: number;
  totalMakes: number;
  faceAngles: number[];
  faceAngleStdDev: number;
  status: 'active' | 'game-over' | 'completed';
}

// Drill B: Lag Putts ("Speed Control Zone" - Bullseye)
export interface SpeedControlState {
  currentDistanceFt: 20 | 30 | 50;
  safeZoneDepthFt: number;  // 3ft past the hole
  score: number;
  attempts: number;
  pastHoleSafeCount: number;
  shortCount: number;
  longCount: number;
  ballSpeeds: number[];
  ballSpeedStdDev: number;
  distanceDispersionStdDevFt: number;
}

// Drill C: Random Putts ("The Scramble" - The Gauntlet)
export interface ScrambleGauntletState {
  holeNumber: number;
  totalHoles: number;
  currentDistanceFt: number;  // 6ft to 40ft randomized
  currentSlopeDifficulty: SlopeDifficulty;
  currentGimmeRadiusFt: number; // scales dynamically with distance
  strokesGainedTotal: number;
  totalCepInches: number;     // Circular Error Probable
  puttsInsideGimme: number;
  puttsHoled: number;
}

// User Profile & Bag Mapping
export interface UserProfile {
  id: string;
  name: string;
  handicap: number;
  preferredStimp: number;
  createdAt: string;
}

export interface DistanceBagBucket {
  distanceLabel: string;
  minDistFt: number;
  maxDistFt: number;
  attempts: number;
  makes: number;
  makeRatePct: number;
  avgMissDistanceInches: number;
  avgFaceAngleDeg: number;
  avgSpeedMph: number;
}

// Open Connect WebSocket Connection State
export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  url: string;
  port: number;
  lastMessageTime: number | null;
  errorMessage: string | null;
  packetsReceived: number;
  packetsFiltered: number;
}
