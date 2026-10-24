/**
 * Drill engine: pure state machines for the three practice games.
 *
 * Design notes (why these drills):
 *  - Short putts — "Pressure Circle". The classic circle drill: 12 balls around a random hole
 *    at 2, 3 or 4 ft, each from a different clock position so each breaks differently. Make
 *    36 in a row (three sets of 12, same hole) to win the level; any miss restarts the run
 *    on a new hole.
 *  - Lag putts — "Leapfrog". The proven pace-control ladder: from one spot, each ball must
 *    finish just past the previous one between the 3 ft rung and the 30 ft line. Trains feel for
 *    small, incremental changes in distance; the score is how many balls fit.
 *  - Random putts — "The Scramble". A 9/18-hole putting round: every hole is a new green,
 *    distance (6–40 ft) and break. You putt out from wherever the ball stops (inside the
 *    gimme circle is given), and strokes gained is measured against the PGA Tour baseline.
 */

import { PuttLayout, PuttingShotData, SlopeDifficulty } from './types';
import { mulberry32 } from './green';
import { calculateStdDev, getPgaExpectedPutts, calculateCepInches } from './calculations';

export type DrillEventKind = 'make' | 'miss' | 'lip' | 'level-up' | 'milestone' | 'mega' | 'win' | 'zone' | 'short' | 'long' | 'gimme' | 'hole-done' | 'game-over';

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
/*
 * 12 balls evenly spaced on a circle (2, 3 or 4 ft) around a random hole, putted in order around
 * the clock. Every make counts toward a run; a miss sends you back to ball 1 on a different hole.
 * 12 in a row: mini celebration, same hole, 12 new balls. 24: mega celebration, 12 more.
 * 36 in a row wins the level.
 */

export type CircleRadiusFt = 2 | 3 | 4;

export interface PressureConfig {
  radius: CircleRadiusFt;
  difficulty: SlopeDifficulty;
}

export const CIRCLE_BALLS = 12;
export const CIRCLE_GOAL = 36;

export interface PressureState {
  cfg: PressureConfig;
  /** Current hole (green + pin). */
  seed: number;
  /** Clock position of ball 1 on this hole (radians). */
  startAngle: number;
  /** Ball being putted in the current set of 12 (0–11). */
  ballIdx: number;
  /** Consecutive makes in this run (0–36). */
  run: number;
  bestRun: number;
  makes: number;
  attempts: number;
  holes: number;
  faceAngles: number[];
  history: boolean[];
  status: 'playing' | 'won';
}

const randomAngle = () => Math.random() * Math.PI * 2;

export function newPressure(cfg: PressureConfig): PressureState {
  return {
    cfg,
    seed: randomSeed(),
    startAngle: randomAngle(),
    ballIdx: 0,
    run: 0,
    bestRun: 0,
    makes: 0,
    attempts: 0,
    holes: 1,
    faceAngles: [],
    history: [],
    status: 'playing',
  };
}

/** Ball i of the circle (0–11), clockwise. */
export function circleBall(s: PressureState, i: number) {
  return ballFromLayout(s.cfg.radius, s.startAngle + (i * 2 * Math.PI) / CIRCLE_BALLS);
}

export function pressureLayout(s: PressureState): PuttLayout {
  return {
    seed: s.seed,
    difficulty: s.cfg.difficulty,
    distanceFt: s.cfg.radius,
    angleRad: s.startAngle + (s.ballIdx * 2 * Math.PI) / CIRCLE_BALLS,
    holeRadiusMultiplier: 1,
    ball: circleBall(s, s.ballIdx),
  };
}

export function pressureOnShot(s: PressureState, shot: PuttingShotData): { state: PressureState; event: DrillEvent } {
  if (s.status !== 'playing') return { state: s, event: { kind: 'game-over', title: 'Level complete' } };
  const n: PressureState = {
    ...s,
    attempts: s.attempts + 1,
    // Start line against the chosen line (the Square measures start direction, not face).
    faceAngles: [...s.faceAngles, shot.startLineErrorDeg ?? shot.hla],
    history: [...s.history, shot.isHoled],
  };
  let event: DrillEvent;
  if (shot.isHoled) {
    n.makes++;
    n.run++;
    n.bestRun = Math.max(n.bestRun, n.run);
    n.ballIdx = (s.ballIdx + 1) % CIRCLE_BALLS;
    const left = CIRCLE_BALLS - n.ballIdx;
    event = { kind: 'make', title: `${n.run} in a row`, detail: n.ballIdx === 0 ? undefined : `${left} to go in this set` };
    if (n.run >= CIRCLE_GOAL) {
      n.status = 'won';
      event = { kind: 'win', title: `${CIRCLE_GOAL} in a row!`, detail: `${s.cfg.radius} ft level complete` };
    } else if (n.run === 24) {
      event = { kind: 'mega', title: '24 in a row!', detail: 'Same hole — 12 more for the level' };
    } else if (n.run % CIRCLE_BALLS === 0) {
      event = { kind: 'milestone', title: `${n.run} in a row!`, detail: 'Same hole — 12 new balls' };
    }
  } else {
    // Miss: back to ball 1, on a different hole
    n.run = 0;
    n.ballIdx = 0;
    n.seed = randomSeed();
    n.startAngle = randomAngle();
    n.holes++;
    const how = shot.lipOut ? 'Lipped out' : shot.offGreen ? 'Off the green' : shot.distanceErrorFt < 0 ? 'Short' : Math.abs(shot.lateralErrorInches) > 2 ? (shot.lateralErrorInches > 0 ? 'Missed right' : 'Missed left') : 'Missed';
    event = { kind: shot.lipOut ? 'lip' : 'miss', title: how, detail: s.run > 0 ? `Run ended at ${s.run} · new hole` : 'New hole' };
  }
  return { state: n, event };
}

export const pressureFaceStdDev = (s: PressureState) => calculateStdDev(s.faceAngles);

/* ============================ Leapfrog (pace control) ============================ */
/*
 * All putts from one spot along a 30 ft ladder (no cup). The first ball must finish past the
 * 3 ft rung; each next ball just past the previous one, as close to it as possible. A ball that
 * finishes short of the previous one, or beyond the 30 ft line, ends the round: the score is how
 * many balls you fitted in. Trains feel for small, incremental changes in distance.
 */

export const LEAP_START_FT = 3;
export const LEAP_END_FT = 30;

export interface LeapConfig {
  difficulty: SlopeDifficulty;
}

export interface LeapBall {
  x: number;
  z: number;
  /** Distance along the ladder from the start spot (ft). */
  ft: number;
}

export interface LeapState {
  cfg: LeapConfig;
  seed: number;
  angleRad: number;
  balls: LeapBall[];
  best: number;
  /** Best before this round started (to celebrate beating it once). */
  bestBefore: number;
  rounds: number;
  scores: number[];
  status: 'playing';
}

export function newLeap(cfg: LeapConfig): LeapState {
  return { cfg, seed: randomSeed(), angleRad: Math.random() * Math.PI * 2, balls: [], best: 0, bestBefore: 0, rounds: 1, scores: [], status: 'playing' };
}

export function leapLayout(s: LeapState): PuttLayout {
  // The ladder runs from the ball toward the (hidden, cupless) pin 30 ft away.
  return { seed: s.seed, difficulty: s.cfg.difficulty, distanceFt: LEAP_END_FT, angleRad: s.angleRad, holeRadiusMultiplier: 0 };
}

/** Where a putt finished along the ladder (ft from the start spot, toward the 30 ft line). */
export function leapDistanceFt(shot: PuttingShotData): number {
  const st = shot.ballStart;
  const d = Math.hypot(st.x, st.z) || 1;
  const ux = -st.x / d;
  const uz = -st.z / d;
  return ((shot.rest.x - st.x) * ux + (shot.rest.z - st.z) * uz) * 3.28084;
}

export function leapOnShot(s: LeapState, shot: PuttingShotData): { state: LeapState; event: DrillEvent } {
  const ft = leapDistanceFt(shot);
  const last = s.balls.length ? s.balls[s.balls.length - 1].ft : LEAP_START_FT;
  const ok = !shot.offGreen && ft > last && ft <= LEAP_END_FT;
  if (ok) {
    const balls = [...s.balls, { x: shot.rest.x, z: shot.rest.z, ft }];
    const n = balls.length;
    const gapIn = (ft - last) * 12;
    let event: DrillEvent = {
      kind: 'make',
      title: `${n} ${n === 1 ? 'ball' : 'balls'}`,
      detail: s.balls.length ? `${gapIn < 12 ? `${Math.round(gapIn)} in` : `${(gapIn / 12).toFixed(1)} ft`} past the last · ${(LEAP_END_FT - ft).toFixed(1)} ft of room left` : `Past the ${LEAP_START_FT} ft rung · ${(LEAP_END_FT - ft).toFixed(1)} ft of room left`,
    };
    if (s.bestBefore >= 3 && n === s.bestBefore + 1) event = { kind: 'milestone', title: `New best: ${n}`, detail: event.detail };
    else if (n % 10 === 0) event = { kind: 'milestone', title: `${n} balls!`, detail: event.detail };
    return { state: { ...s, balls, best: Math.max(s.best, n) }, event };
  }
  // Round over: score it and start again
  const score = s.balls.length;
  const why = shot.offGreen
    ? 'Off the green'
    : ft > LEAP_END_FT
    ? `Past the ${LEAP_END_FT} ft line`
    : s.balls.length
    ? `Short of the last ball by ${Math.round((last - ft) * 12)} in`
    : `Short of the ${LEAP_START_FT} ft rung`;
  return {
    // Each new round is on a different green, from a different direction.
    state: { ...s, seed: randomSeed(), angleRad: Math.random() * Math.PI * 2, balls: [], rounds: s.rounds + 1, scores: [...s.scores, score], best: Math.max(s.best, score), bestBefore: Math.max(s.best, score) },
    event: { kind: ft > LEAP_END_FT ? 'long' : 'short', title: why, detail: `Score ${score} · new green` },
  };
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
  } else if (shot.offGreen) {
    // Rolled off the green: the hole ends here — never putt from off the surface. Counts +1.
    finalStrokes = Math.min(MAX_STROKES, strokes + 1);
    event = { kind: 'miss', title: 'Off the green', detail: 'Hole over · +1 stroke' };
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
