import { CameraMode, ReadAssist, SlopeDifficulty } from './types';

export interface AppSettings {
  stimp: number;
  practiceDistanceFt: number;
  practiceDifficulty: SlopeDifficulty;
  practiceSeed: number;
  camera: CameraMode;
  grid: boolean;
  contours: boolean;
  heatmap: boolean;
  fallLines: boolean;
  aimLine: boolean;
  readAssist: ReadAssist;
  /** Multiplier on measured ball speed, for launch monitor calibration. */
  speedCalibration: number;
  /** On-screen height exaggeration of the green (display only). Fixed at 3×; not user-facing. */
  slopeExaggeration: number;
  /** Real lidar-surveyed championship greens, or generated greens. */
  greenSource: 'real' | 'generated';
}

export const DEFAULT_SETTINGS: AppSettings = {
  stimp: 10.5,
  practiceDistanceFt: 10,
  practiceDifficulty: 'mild',
  practiceSeed: 4242,
  camera: 'behind',
  grid: true,
  contours: false,
  heatmap: false,
  fallLines: true,
  aimLine: true,
  readAssist: 'read',
  speedCalibration: 1,
  slopeExaggeration: 3,
  greenSource: 'real',
};

const KEY = 'squareputt_settings_v2';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    // Slope display is fixed at 3× (no longer a user setting).
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), slopeExaggeration: 3 };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
