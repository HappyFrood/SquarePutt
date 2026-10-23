/**
 * Drill engine: pure state machines for the three practice games.
 *
 * Design notes (why these drills):
 *  - Short putts — "Pressure Circle". The classic circle / around-the-clock drill: every putt
 *    comes from a different clock position on a sloped green, so each one breaks differently
 *    and you must re-read and re-aim (no autopilot). Survival scoring with lives, a cup that
 *    shrinks as the streak grows, and an optional 3→8 ft ladder keep it tense.
 *  - Lag putts — "Speed Control". Ten-putt sets scored on where the ball finishes: the 3 ft
 *    zone around the hole, never short. Mixed distances are the default because randomized
 *    practice transfers better to the course than repeating one length (contextual
 *    interference). Consecutive zone finishes build a combo bonus.
 *  - Random putts — "The Scramble". A 9/18-hole putting round: every hole is a new green,
 *    distance (6–40 ft) and break. You putt out from wherever the ball stops (inside the
 *    gimme circle is given), and strokes gained is measured against the PGA Tour baseline.
 */

import { PuttLayout, PuttingShotData, SlopeDifficulty } from './types';
import { mulberry32 } from './green';
import { calculateStdDev, getPgaExpectedPutts, calculateCepInches } from './calculations';

export type DrillEventKind = 'make' | 'miss' | 'lip' | 'level-up' | 'milestone' | 'zone' | 'short' | 'long' | 'gimme' | 'hole-done' | 'game-over';

export interface DrillEvent {
  kind: DrillEventKind;
  title: string;
  detail?: string;
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const ballFromLayout = (distanceFt: number, angleRad: number) => {
  const d = distanceFt * 0.3048;
  return { x: Math.sin(angleRad) * d, z: -Math.cos(angleRad) * d };
};
export { ballFromLayout };

/* ================================ Pressure Circle ================================ */

export interface PressureConfig {
  distance: 3 | 5 | 8 | 'ladder';
  lives: 1 | 3 | 5;
  difficulty: SlopeDifficulty;
}

export interface PressureState {
  cfg: PressureConfig;
  seed: number;
  distanceFt: number;
  clock: number; // 0..11
  streak: number;
  bestStreak: number;
  lives: number;
  makes: number;
  attempts: number;
  ladderRun: number;
  faceAngles: number[];
  history: boolean[];
  status: 'playing' | 'over';
}

export const PRESSURE_MILESTONES = [5, 10, 15, 25, 50];

export function newPressure(cfg: PressureConfig): PressureState {
  return {
    cfg,
    seed: randomSeed(),
    distanceFt: cfg.distance === 'ladder' ? 3 : cfg.distance,
    clock: 0,
    streak: 0,
    bestStreak: 0,
    lives: cfg.lives,
    makes: 0,
    attempts: 0,
    ladderRun: 0,
    faceAngles: [],
    history: [],
    status: 'playing',
  };
}

export const cupMultiplierForStreak = (streak: number) => Math.max(0.6, 1 - 0.04 * streak);

export function pressureLayout(s: PressureState): PuttLayout {
  return {
    seed: s.seed,
    difficulty: s.cfg.difficulty,
    distanceFt: s.distanceFt,
    angleRad: (s.clock * Math.PI) / 6,
    holeRadiusMultiplier: cupMultiplierForStreak(s.streak),
  };
}

export function pressureOnShot(s: PressureState, shot: PuttingShotData): { state: PressureState; event: DrillEvent } {
  if (s.status !== 'playing') return { state: s, event: { kind: 'game-over', title: 'Game over' } };
  const n: PressureState = {
    ...s,
    attempts: s.attempts + 1,
    faceAngles: [...s.faceAngles, shot.faceAngleDeg],
    history: [...s.history, shot.isHoled],
    clock: (s.clock + 5) % 12, // jump around the clock so consecutive breaks differ
  };
  let event: DrillEvent;
  if (shot.isHoled) {
    n.makes++;
    n.streak++;
    n.bestStreak = Math.max(n.bestStreak, n.streak);
    n.ladderRun++;
    event = { kind: 'make', title: `${n.streak} in a row`, detail: `Cup now ${(4.25 * cupMultiplierForStreak(n.streak)).toFixed(2)}″` };
    if (s.cfg.distance === 'ladder' && n.ladderRun >= 3 && n.distanceFt < 8) {
      n.distanceFt++;
      n.ladderRun = 0;
      event = { kind: 'level-up', title: `Up to ${n.distanceFt} ft`, detail: 'Three straight — moving back' };
    }
    if (PRESSURE_MILESTONES.includes(n.streak)) {
      event = { kind: 'milestone', title: `${n.streak} straight!`, detail: 'Milestone streak' };
    }
  } else {
    n.lives--;
    n.streak = 0;
    n.ladderRun = 0;
    if (s.cfg.distance === 'ladder') n.distanceFt = Math.max(3, n.distanceFt - 1);
    const how = shot.lipOut ? 'Lipped out' : shot.distanceErrorFt < 0 ? 'Short' : Math.abs(shot.lateralErrorInches) > 2 ? (shot.lateralErrorInches > 0 ? 'Missed right' : 'Missed left') : 'Missed';
    event = {
      kind: shot.lipOut ? 'lip' : 'miss',
      title: how,
      detail: n.lives > 0 ? `${n.lives} ${n.lives === 1 ? 'life' : 'lives'} left` : undefined,
    };
    if (n.lives <= 0) {
      n.status = 'over';
      event = { kind: 'game-over', title: 'Game over', detail: `${n.makes}/${n.attempts} made · best streak ${n.bestStreak}` };
    }
  }
  return { state: n, event };
}

export const pressureFaceStdDev = (s: PressureState) => calculateStdDev(s.faceAngles);

/* ================================= Speed Control ================================= */

export interface LagConfig {
  distance: 20 | 30 | 50 | 'mixed';
  putts: 10 | 15;
  difficulty: SlopeDifficulty;
}

export type LagZone = 'holed' | 'zone' | 'close-short' | 'long' | 'short' | 'way-long';

export interface LagResult {
  distanceFt: number;
  leaveFt: number;
  distanceErrorFt: number;
  zone: LagZone;
  points: number;
}

export interface LagState {
  cfg: LagConfig;
  seed: number;
  distances: number[];
  angles: number[];
  idx: number;
  results: LagResult[];
  score: number;
  combo: number;
  bestCombo: number;
  status: 'playing' | 'over';
}

export const LAG_ZONE_FT = 3;

export function newLag(cfg: LagConfig): LagState {
  const rnd = mulberry32(randomSeed());
  const distances = Array.from({ length: cfg.putts }, () =>
    cfg.distance === 'mixed' ? Math.round(20 + rnd() * 30) : cfg.distance
  );
  const angles = Array.from({ length: cfg.putts }, () => (rnd() - 0.5) * Math.PI * 1.6);
  return { cfg, seed: randomSeed(), distances, angles, idx: 0, results: [], score: 0, combo: 0, bestCombo: 0, status: 'playing' };
}

export function lagLayout(s: LagState): PuttLayout {
  const i = Math.min(s.idx, s.distances.length - 1);
  return { seed: s.seed, difficulty: s.cfg.difficulty, distanceFt: s.distances[i], angleRad: s.angles[i], holeRadiusMultiplier: 1 };
}

export function classifyLag(shot: PuttingShotData): { zone: LagZone; points: number } {
  if (shot.isHoled) return { zone: 'holed', points: 5 };
  const leave = shot.leaveFt;
  const past = shot.distanceErrorFt >= 0;
  if (leave <= LAG_ZONE_FT && past) return { zone: 'zone', points: 3 };
  if (leave <= LAG_ZONE_FT) return { zone: 'close-short', points: 1 };
  if (!past) return { zone: 'short', points: -1 };
  if (leave <= 6) return { zone: 'long', points: 0 };
  return { zone: 'way-long', points: -1 };
}

export function lagOnShot(s: LagState, shot: PuttingShotData): { state: LagState; event: DrillEvent } {
  if (s.status !== 'playing') return { state: s, event: { kind: 'game-over', title: 'Set complete' } };
  const { zone, points } = classifyLag(shot);
  const good = zone === 'holed' || zone === 'zone';
  const combo = good ? s.combo + 1 : 0;
  const bonus = good && combo >= 3 ? 1 : 0;
  const result: LagResult = {
    distanceFt: s.distances[s.idx],
    leaveFt: shot.leaveFt,
    distanceErrorFt: shot.distanceErrorFt,
    zone,
    points: points + bonus,
  };
  const n: LagState = {
    ...s,
    idx: s.idx + 1,
    results: [...s.results, result],
    score: s.score + result.points,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
  };
  if (n.idx >= s.distances.length) n.status = 'over';
  const titles: Record<LagZone, string> = {
    holed: 'Holed it!',
    zone: 'In the zone',
    'close-short': 'Close — but short',
    long: 'A bit firm',
    short: 'Short',
    'way-long': 'Way too firm',
  };
  const sign = result.points > 0 ? `+${result.points}` : `${result.points}`;
  let event: DrillEvent = {
    kind: good ? 'zone' : zone === 'short' || zone === 'close-short' ? 'short' : 'long',
    title: titles[zone],
    detail: `${sign} pts${bonus ? ` · combo ×${combo}` : ''} · left ${shot.leaveFt.toFixed(1)} ft`,
  };
  if (zone === 'holed') event = { kind: 'make', title: titles.holed, detail: `${sign} pts` };
  if (n.status === 'over') {
    event = { kind: 'game-over', title: `Set complete: ${n.score} pts`, detail: `${n.results.filter((r) => r.zone === 'zone' || r.zone === 'holed').length}/${n.results.length} in the zone` };
  }
  return { state: n, event };
}

export function lagStats(s: LagState) {
  const errs = s.results.map((r) => r.distanceErrorFt);
  const inZone = s.results.filter((r) => r.zone === 'zone' || r.zone === 'holed').length;
  const shortCount = s.results.filter((r) => r.zone === 'short' || r.zone === 'close-short').length;
  const threePuttRisk = s.results.filter((r) => r.leaveFt > 6).length;
  return { distanceStdDevFt: calculateStdDev(errs), inZone, shortCount, threePuttRisk };
}

export function lagRating(score: number, putts: number) {
  const per = score / putts;
  if (per >= 3) return 'eagle' as const;
  if (per >= 2.2) return 'birdie' as const;
  if (per >= 1.4) return 'par' as const;
  return 'bogey' as const;
}

/* ================================== The Scramble ================================== */

export interface ScrambleConfig {
  holes: 9 | 18;
  difficulty: SlopeDifficulty | 'mixed';
}

export interface ScrambleHole {
  seed: number;
  difficulty: SlopeDifficulty;
  startDistanceFt: number;
  angleRad: number;
}

export interface ScrambleHoleResult {
  startDistanceFt: number;
  strokes: number;
  sg: number;
  firstLeaveFt: number;
  firstDev: { xInches: number; zInches: number };
}

export interface ScrambleState {
  cfg: ScrambleConfig;
  holes: ScrambleHole[];
  holeIdx: number;
  ball: { x: number; z: number } | null;
  strokes: number;
  firstLeaveFt: number | null;
  firstDev: { xInches: number; zInches: number } | null;
  card: ScrambleHoleResult[];
  status: 'playing' | 'hole-complete' | 'over';
}

export const gimmeRadiusFt = (distanceFt: number) => Math.min(3.8, Math.max(1.5, distanceFt * 0.1 + 0.8));
const MAX_STROKES = 6;

export function newScramble(cfg: ScrambleConfig): ScrambleState {
  const rnd = mulberry32(randomSeed());
  const diffs: SlopeDifficulty[] = ['mild', 'medium', 'hard'];
  const holes = Array.from({ length: cfg.holes }, () => ({
    seed: Math.floor(rnd() * 2 ** 31),
    difficulty: cfg.difficulty === 'mixed' ? diffs[Math.floor(rnd() * 3)] : cfg.difficulty,
    // skew toward makeable lengths: ~45% under 12 ft
    startDistanceFt: Math.round((6 + 34 * Math.pow(rnd(), 1.6)) * 2) / 2,
    angleRad: rnd() * Math.PI * 2,
  }));
  return { cfg, holes, holeIdx: 0, ball: null, strokes: 0, firstLeaveFt: null, firstDev: null, card: [], status: 'playing' };
}

export function scrambleCurrentDistanceFt(s: ScrambleState): number {
  const h = s.holes[Math.min(s.holeIdx, s.holes.length - 1)];
  return s.ball ? Math.hypot(s.ball.x, s.ball.z) * 3.28084 : h.startDistanceFt;
}

export function scrambleLayout(s: ScrambleState): PuttLayout {
  const h = s.holes[Math.min(s.holeIdx, s.holes.length - 1)];
  return {
    seed: h.seed,
    difficulty: h.difficulty,
    distanceFt: scrambleCurrentDistanceFt(s),
    angleRad: h.angleRad,
    holeRadiusMultiplier: 1,
    ball: s.ball ?? undefined,
  };
}

export function scrambleOnShot(s: ScrambleState, shot: PuttingShotData): { state: ScrambleState; event: DrillEvent } {
  if (s.status !== 'playing') return { state: s, event: { kind: 'hole-done', title: 'Next hole loading…' } };
  const hole = s.holes[s.holeIdx];
  const strokes = s.strokes + 1;
  const curDist = scrambleCurrentDistanceFt(s);
  const gimme = gimmeRadiusFt(curDist);
  const first = s.strokes === 0;
  // On real greens the ball spot may differ slightly from the planned length; score from the actual putt.
  const startFt = first ? shot.targetDistanceFt : hole.startDistanceFt;
  const holes = first ? s.holes.map((h, i) => (i === s.holeIdx ? { ...h, startDistanceFt: startFt } : h)) : s.holes;
  const n: ScrambleState = {
    ...s,
    holes,
    strokes,
    firstLeaveFt: first ? shot.leaveFt : s.firstLeaveFt,
    firstDev: first ? { xInches: shot.lateralErrorInches, zInches: shot.distanceErrorFt * 12 } : s.firstDev,
  };

  let finalStrokes: number | null = null;
  let event: DrillEvent;
  if (shot.isHoled) {
    finalStrokes = strokes;
    event = { kind: 'make', title: strokes === 1 ? 'Birdie! One-putt' : `Holed — ${strokes} putts` };
  } else if (shot.leaveFt <= gimme) {
    finalStrokes = strokes + 1;
    event = { kind: 'gimme', title: `Inside the gimme (${gimme.toFixed(1)} ft)`, detail: `${finalStrokes} putts` };
  } else if (strokes >= MAX_STROKES - 1) {
    finalStrokes = MAX_STROKES;
    event = { kind: 'miss', title: 'Pick up', detail: `${MAX_STROKES} putts max` };
  } else {
    n.ball = { ...shot.rest };
    event = {
      kind: shot.lipOut ? 'lip' : 'miss',
      title: shot.lipOut ? 'Lipped out' : `${shot.leaveFt.toFixed(1)} ft left`,
      detail: `Putt it out — gimme is ${gimmeRadiusFt(shot.leaveFt).toFixed(1)} ft`,
    };
  }

  if (finalStrokes !== null) {
    const sg = getPgaExpectedPutts(startFt) - finalStrokes;
    n.card = [
      ...s.card,
      {
        startDistanceFt: startFt,
        strokes: finalStrokes,
        sg,
        firstLeaveFt: n.firstLeaveFt ?? 0,
        firstDev: n.firstDev ?? { xInches: 0, zInches: 0 },
      },
    ];
    n.status = s.holeIdx + 1 >= s.holes.length ? 'over' : 'hole-complete';
    event.detail = `${event.detail ? event.detail + ' · ' : ''}SG ${sg >= 0 ? '+' : ''}${sg.toFixed(2)}`;
    if (n.status === 'over') {
      const st = scrambleStats(n);
      event = { kind: 'game-over', title: `Round complete: ${st.toPar === 0 ? 'E' : st.toPar > 0 ? `+${st.toPar}` : st.toPar}`, detail: `${st.totalStrokes} putts · SG ${st.sgTotal >= 0 ? '+' : ''}${st.sgTotal.toFixed(2)}` };
    }
  }
  return { state: n, event };
}

export function scrambleAdvance(s: ScrambleState): ScrambleState {
  if (s.status !== 'hole-complete') return s;
  return { ...s, holeIdx: s.holeIdx + 1, ball: null, strokes: 0, firstLeaveFt: null, firstDev: null, status: 'playing' };
}

export function scrambleStats(s: ScrambleState) {
  const totalStrokes = s.card.reduce((a, h) => a + h.strokes, 0);
  const sgTotal = s.card.reduce((a, h) => a + h.sg, 0);
  const played = s.card.length;
  return {
    totalStrokes,
    toPar: totalStrokes - 2 * played,
    sgTotal,
    sgPer18: played ? (sgTotal / played) * 18 : 0,
    onePutts: s.card.filter((h) => h.strokes === 1).length,
    threePutts: s.card.filter((h) => h.strokes >= 3).length,
    cepInches: calculateCepInches(s.card.map((h) => h.firstDev)),
    played,
  };
}
