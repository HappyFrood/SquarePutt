/**
 * SquarePutt Local Storage & Session Persistence
 * Manages player profiles, historical putting sessions, drill high scores,
 * and bag mapping data with export/import capabilities.
 */

import { PuttingShotData, UserProfile, DistanceBagBucket } from './types';

const STORAGE_KEY_SHOTS = 'squareputt_history_v1';
const STORAGE_KEY_ACTIVE_PROFILE = 'squareputt_active_profile_v1';
const STORAGE_KEY_DRILL_BESTS = 'squareputt_drill_bests_v1';

export interface DrillBests {
  pressureCircle: {
    bestStreak: number;
    lowestFaceStdDev: number;
    lastUpdated: number;
  };
  speedControl: {
    highScore: number;
    lowestSpeedStdDev: number;
    lastUpdated: number;
  };
  scrambleGauntlet: {
    highestStrokesGained: number;
    lowestCepInches: number;
    lastUpdated: number;
  };
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'default_user',
  name: 'Tour Pro',
  handicap: 2.4,
  preferredStimp: 10.5,
  createdAt: new Date().toISOString(),
};

const DEFAULT_DRILL_BESTS: DrillBests = {
  pressureCircle: { bestStreak: 0, lowestFaceStdDev: 999, lastUpdated: 0 },
  speedControl: { highScore: 0, lowestSpeedStdDev: 999, lastUpdated: 0 },
  scrambleGauntlet: { highestStrokesGained: -999, lowestCepInches: 999, lastUpdated: 0 },
};

export const DISTANCE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '3ft', min: 2.0, max: 4.0 },
  { label: '5ft', min: 4.1, max: 6.5 },
  { label: '8ft', min: 6.6, max: 9.0 },
  { label: '10ft', min: 9.1, max: 12.0 },
  { label: '15ft', min: 12.1, max: 17.5 },
  { label: '20ft', min: 17.6, max: 25.0 },
  { label: '30ft', min: 25.1, max: 35.0 },
  { label: '40ft+', min: 35.1, max: 60.0 },
];

export function getStoredShots(): PuttingShotData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read shots from localStorage', e);
    return [];
  }
}

export function saveShotToHistory(shot: PuttingShotData): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredShots();
    // Keep most recent 300 shots to prevent localstorage bloat
    const updated = [shot, ...current].slice(0, 300);
    localStorage.setItem(STORAGE_KEY_SHOTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save shot to localStorage', e);
  }
}

export function clearShotHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_SHOTS);
}

export function getActiveProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PROFILE;
}

export function saveActiveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save active profile', e);
  }
}

export function getDrillBests(): DrillBests {
  if (typeof window === 'undefined') return DEFAULT_DRILL_BESTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRILL_BESTS);
    if (raw) return { ...DEFAULT_DRILL_BESTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_DRILL_BESTS;
}

export function updateDrillBests(partial: Partial<DrillBests>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDrillBests();
    const updated = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY_DRILL_BESTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update drill bests', e);
  }
}

/**
 * Computes Bag Mapping statistics across distance intervals
 */
export function calculateBagMapping(shots: PuttingShotData[]): DistanceBagBucket[] {
  return DISTANCE_BUCKETS.map((bucket) => {
    const bucketShots = shots.filter(
      (s) => s.targetDistanceFt >= bucket.min && s.targetDistanceFt <= bucket.max
    );

    if (bucketShots.length === 0) {
      return {
        distanceLabel: bucket.label,
        minDistFt: bucket.min,
        maxDistFt: bucket.max,
        attempts: 0,
        makes: 0,
        makeRatePct: 0,
        avgMissDistanceInches: 0,
        avgFaceAngleDeg: 0,
        avgSpeedMph: 0,
      };
    }

    const makes = bucketShots.filter((s) => s.isHoled).length;
    const makeRatePct = Number(((makes / bucketShots.length) * 100).toFixed(1));
    const avgMissDistanceInches = Number(
      (
        bucketShots.reduce((sum, s) => sum + Math.abs(s.lateralErrorInches), 0) /
        bucketShots.length
      ).toFixed(1)
    );
    const avgFaceAngleDeg = Number(
      (
        bucketShots.reduce((sum, s) => sum + s.faceAngleDeg, 0) / bucketShots.length
      ).toFixed(2)
    );
    const avgSpeedMph = Number(
      (
        bucketShots.reduce((sum, s) => sum + s.ballSpeedMph, 0) / bucketShots.length
      ).toFixed(1)
    );

    return {
      distanceLabel: bucket.label,
      minDistFt: bucket.min,
      maxDistFt: bucket.max,
      attempts: bucketShots.length,
      makes,
      makeRatePct,
      avgMissDistanceInches,
      avgFaceAngleDeg,
      avgSpeedMph,
    };
  });
}

/**
 * Exports all player sessions to a JSON file
 */
export function exportSessionData(): string {
  const data = {
    profile: getActiveProfile(),
    drillBests: getDrillBests(),
    shots: getStoredShots(),
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Imports session data from JSON string
 */
export function importSessionData(jsonString: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.profile) saveActiveProfile(parsed.profile);
    if (parsed.drillBests) updateDrillBests(parsed.drillBests);
    if (Array.isArray(parsed.shots)) {
      localStorage.setItem(STORAGE_KEY_SHOTS, JSON.stringify(parsed.shots.slice(0, 300)));
    }
    return true;
  } catch (e) {
    console.error('Failed to import session data', e);
    return false;
  }
}
