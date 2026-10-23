/**
 * SquarePutt types & data models.
 */

// Open Connect (GSPro Connect v1) shot message
export interface RawOpenConnectPacket {
  DeviceID?: string;
  Units?: string;
  APIversion?: string;
  BallData?: {
    Speed?: number; // mph
    VLA?: number; // vertical launch (deg)
    HLA?: number; // horizontal launch (deg, + right)
    TotalSpin?: number;
    BackSpin?: number;
    SideSpin?: number;
    SpinAxis?: number;
    CarryDistance?: number;
  };
  ClubData?: {
    Speed?: number;
    Path?: number; // deg (+ in-to-out)
    FaceToPath?: number;
    FaceToTarget?: number; // GSPro name for face angle
    FaceAngle?: number; // alias used by some connectors
    AngleOfAttack?: number;
    DynamicLoft?: number;
    Loft?: number; // GSPro name for dynamic loft
    Lie?: number;
  };
  ShotDataOptions?: {
    ContainsBallData?: boolean;
    ContainsClubData?: boolean;
    LaunchMonitorIsReady?: boolean;
    LaunchMonitorBallDetected?: boolean;
    IsHeartBeat?: boolean;
  };
  ShotNumber?: number;
  Confidence?: number;
  Timestamp?: number;
}

export type QuinticGrade = 'eagle' | 'birdie' | 'par' | 'bogey';

export interface QuinticTierInfo {
  tier: QuinticGrade;
  label: string;
  color: string;
  bgRgba: string;
  borderHex: string;
  description: string;
}

export type SlopeDifficulty = 'flat' | 'mild' | 'medium' | 'hard';
export type CameraMode = 'behind' | 'overhead' | 'follow' | 'orbit';
export type AppMode = 'analysis' | 'pressure-circle' | 'speed-control' | 'scramble-gauntlet' | 'analytics';
export type ReadAssist = 'off' | 'read' | 'line';

/** Where the ball and hole are, on which green. The hole is always at the origin. */
export interface PuttLayout {
  seed: number;
  difficulty: SlopeDifficulty;
  distanceFt: number;
  /** Direction from hole to ball; 0 = ball straight "below" the hole (putting toward +z). */
  angleRad: number;
  holeRadiusMultiplier: number;
  /** Exact ball position override (m), e.g. a follow-up putt in The Scramble. */
  ball?: { x: number; z: number };
  /** Ball spot the green outline is drawn around (defaults to the ball). */
  anchor?: { x: number; z: number };
  /** Draw a round green of this radius around the hole instead (drills with many ball spots). */
  greenRadiusM?: number;
}

export interface PuttingShotData {
  id: string;
  timestamp: number;
  shotNumber: number;
  source: 'live' | 'sim';
  mode: AppMode;

  // Ball
  ballSpeedMph: number;
  ballSpeedMps: number;
  vla: number;
  hla: number;
  backspinRpm?: number;

  // Club
  clubSpeedMph?: number;
  angleOfAttackDeg: number;
  putterPathDeg: number;
  faceAngleDeg: number;
  faceToPathDeg: number;
  dynamicLoftDeg: number;

  // Setup
  stimpSetting: number;
  slopeDifficulty: SlopeDifficulty;
  greenSeed: number;
  targetDistanceFt: number;
  ballStart: { x: number; z: number };

  // Outcome
  rest: { x: number; z: number };
  rollDistanceFt: number;
  lateralErrorInches: number; // + right of the start line to the hole
  distanceErrorFt: number; // + past the hole
  leaveFt: number;
  isHoled: boolean;
  lipOut: boolean;
  timeToZeroSkidMs: number;
  skidDistanceInches: number;
  trueRollDistanceFt: number;
  skidPercentage: number;

  // Versus the ideal stroke for this putt
  idealSpeedMph?: number;
  idealHlaDeg?: number;
  speedErrorPct?: number; // + = too firm
  startLineErrorDeg?: number; // + = right of ideal line

  grades: {
    faceAngleGrade: QuinticGrade;
    pathGrade: QuinticGrade;
    speedConsistencyGrade: QuinticGrade;
    launchGrade: QuinticGrade;
    overallGrade: QuinticGrade;
  };

  /** [x, y, z] every trajectoryDt seconds (not persisted to history). */
  trajectoryPoints?: [number, number, number][];
  trajectoryDt?: number;
}

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
  tourMakeRatePct: number;
  avgMissDistanceInches: number;
  avgFaceAngleDeg: number;
  avgSpeedMph: number;
}

export interface ConnectionState {
  connected: boolean; // connected to the SquarePutt bridge
  connecting: boolean;
  launchMonitorConnected: boolean; // a launch monitor connector is attached to the bridge
  launchMonitorName: string | null;
  url: string;
  port: number;
  lastMessageTime: number | null;
  errorMessage: string | null;
  packetsReceived: number;
  packetsFiltered: number;
}
