import { CameraMode, ReadAssist, SlopeDifficulty } from './types';
import type { Baseline } from './baselines';

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
  /** Ideal pace: how far past the hole the ball would stop (inches) if it missed the cup. */
  idealPastIn: IdealPastIn;
  /** Practice: what comes after each putt. */
  practiceNext: 'same' | 'new-on-make' | 'random';
  settingsRev?: number;
  /** Stats: who to compare against (strokes gained and make rates). */
  statsBaseline: Baseline;
}

export type IdealPastIn = 6 | 8.5 | 12 | 17;

export const DEFAULT_SETTINGS: AppSettings = {
  stimp: 10.5,
  practiceDistanceFt: 10,
  practiceDifficulty: 'mild',
  practiceSeed: 4242,
  camera: 'follow',
  grid: true,
  contours: false,
  heatmap: false,
  fallLines: true,
  aimLine: true,
  readAssist: 'read',
  speedCalibration: 1,
  slopeExaggeration: 3,
  greenSource: 'real',
  idealPastIn: 8.5,
  practiceNext: 'same',
  settingsRev: 2,
  statsBaseline: 'tour',
};

const KEY = 'squareputt_settings_v2';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    // Slope display is fixed at 3× (no longer a user setting).
    if (raw) {
      const saved = JSON.parse(raw);
      // rev 2: Follow became the default camera — move everyone to it once.
      const migrated = saved.settingsRev === 2 ? {} : { camera: 'follow' as const, settingsRev: 2 };
      return { ...DEFAULT_SETTINGS, ...saved, ...migrated, slopeExaggeration: 3 };
    }
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
