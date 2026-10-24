'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AppMode, ConnectionState, PuttingShotData, PuttLayout } from '@/lib/types';
import { AppSettings, loadSettings, saveSettings } from '@/lib/settings';
import { generatedGreenContains, GreenSurface, PuttingSurface, readPutt } from '@/lib/green';
import { GreenLibrary, loadGreenLibrary, pickRealGreen, placeBallOnGreen, RealGreenSurface } from '@/lib/realGreens';
import { PuttSetup, solveIdealStroke, speedForFlatDistanceMph } from '@/lib/physicsEngine';
import { openConnectService } from '@/lib/openConnectService';
import { squareBle, SquareStatus } from '@/lib/squareBle';
import { getStoredShots, saveShotToHistory, getDrillBests, updateDrillBests } from '@/lib/storage';
import {
  DrillEvent,
  ballFromLayout,
  PressureConfig,
  CircleRadiusFt,
  CIRCLE_BALLS,
  circleBall,
  PressureState,
  newPressure,
  pressureLayout,
  pressureOnShot,
  pressureFaceStdDev,
  LeapConfig,
  LeapState,
  newLeap,
  leapLayout,
  leapOnShot,
  LEAP_START_FT,
  LEAP_END_FT,
  ScrambleConfig,
  ScrambleState,
  newScramble,
  scrambleLayout,
  scrambleOnShot,
  scrambleAdvance,
  scrambleStats,
  gimmeRadiusFt,
} from '@/lib/drills';
import { TopBar } from '@/components/ui/TopBar';
import { PuttingGreenCanvas } from '@/components/green/PuttingGreenCanvas';
import { MarkerSpec, RingSpec } from '@/components/green/greenScene';
import { ReadChip, ResultBanner, PracticePad } from '@/components/hud/CanvasHud';
import { LastPutt } from '@/components/hud/LastPutt';
import { BallPlacement } from '@/components/hud/BallPlacement';
import { AimControl } from '@/components/hud/AimControl';
import { PuttFlash } from '@/components/hud/PuttFlash';
import { PressurePanel, LeapfrogPanel, ScramblePanel } from '@/components/drills/DrillPanels';
import { SettingsDrawer } from '@/components/settings/SettingsDrawer';
import { ConnectionDrawer } from '@/components/settings/ConnectionDrawer';
import { StatsView } from '@/components/stats/StatsView';
import { audioEngine } from '@/components/ui/AudioEngine';

const sameLayout = (a: PuttLayout, b: PuttLayout) =>
  a.seed === b.seed &&
  a.difficulty === b.difficulty &&
  a.distanceFt === b.distanceFt &&
  a.angleRad === b.angleRad &&
  a.holeRadiusMultiplier === b.holeRadiusMultiplier &&
  a.ball?.x === b.ball?.x &&
  a.ball?.z === b.ball?.z &&
  a.greenRadiusM === b.greenRadiusM;

/** Aim steps (degrees): 0.5° at a time, up to 6° either side. */
const AIM_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];


const CONFETTI = ['#f5c84c', '#eef2ea', '#4ade80'];
/** Mini (milestone / level-up), mega (24 in a row) and win (level complete) celebrations. */
function celebrate(ev: DrillEvent | null) {
  if (!ev) return;
  if (ev.kind === 'milestone' || ev.kind === 'level-up') {
    audioEngine.playChime();
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.55, x: 0.4 }, colors: CONFETTI });
  } else if (ev.kind === 'mega') {
    audioEngine.playChime();
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6, x: 0.25 }, angle: 60, colors: CONFETTI });
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6, x: 0.6 }, angle: 120, colors: CONFETTI });
    setTimeout(() => confetti({ particleCount: 120, spread: 140, startVelocity: 45, origin: { y: 0.4, x: 0.4 }, colors: CONFETTI }), 350);
  } else if (ev.kind === 'win') {
    audioEngine.playChime();
    setTimeout(() => audioEngine.playChime(), 300);
    const end = Date.now() + 2200;
    const burst = () => {
      confetti({ particleCount: 40, spread: 70, angle: 60, origin: { x: 0, y: 0.7 }, colors: CONFETTI });
      confetti({ particleCount: 40, spread: 70, angle: 120, origin: { x: 0.72, y: 0.7 }, colors: CONFETTI });
      if (Date.now() < end) setTimeout(burst, 160);
    };
    burst();
    confetti({ particleCount: 250, spread: 160, startVelocity: 50, origin: { y: 0.45, x: 0.36 }, colors: CONFETTI, scalar: 1.2 });
  }
}

function makeRandomPutt(): Omit<PuttLayout, 'holeRadiusMultiplier'> {
  const r = Math.random;
  const diffs: PuttLayout['difficulty'][] = ['mild', 'medium', 'hard'];
  return {
    seed: Math.floor(r() * 1e6),
    difficulty: diffs[Math.floor(r() * diffs.length)],
    distanceFt: Math.round(3 + 32 * r() ** 1.6), // weighted toward makeable lengths
    angleRad: r() * Math.PI * 2,
  };
}

function practiceEvent(s: PuttingShotData): DrillEvent {
  if (s.isHoled) return { kind: 'make', title: 'Holed', detail: s.speedErrorPct !== undefined ? `${Math.abs(s.speedErrorPct) < 1 ? 'Perfect pace' : `${Math.abs(s.speedErrorPct).toFixed(0)}% ${s.speedErrorPct > 0 ? 'firm' : 'soft'}`}` : undefined };
  const d = Math.abs(s.distanceErrorFt);
  const title = s.offGreen ? 'Off the green' : s.lipOut ? 'Lipped out' : d < 0.2 ? 'Pin high' : `${d.toFixed(1)} ft ${s.distanceErrorFt < 0 ? 'short' : 'past'}`;
  const lat = Math.abs(s.lateralErrorInches);
  const parts = [];
  if (lat >= 1) parts.push(`${lat.toFixed(0)} in ${s.lateralErrorInches > 0 ? 'right' : 'left'}`);
  if (s.startLineErrorDeg !== undefined && Math.abs(s.startLineErrorDeg) >= 0.2) parts.push(`started ${Math.abs(s.startLineErrorDeg).toFixed(1)}° ${s.startLineErrorDeg > 0 ? 'right' : 'left'}`);
  return { kind: 'miss', title, detail: parts.join(' · ') || undefined };
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('analysis');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const patch = useCallback((p: Partial<AppSettings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
      saveSettings(n);
      return n;
    });
  }, []);

  const [shots, setShots] = useState<PuttingShotData[]>(getStoredShots);
  const [shot, setShot] = useState<PuttingShotData | null>(null);
  /** The putt whose results are on screen: set only once the ball has stopped. */
  const [shownShot, setShownShot] = useState<PuttingShotData | null>(null);
  /** Drills: brief on-green card with the last putt's numbers. */
  const [flash, setFlash] = useState<PuttingShotData | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<DrillEvent | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const pendingEvent = useRef<DrillEvent | null>(null);
  const pendingCommit = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [bests, setBests] = useState(getDrillBests);
  const [filterNote, setFilterNote] = useState<string | null>(null);

  const [pCfg, setPCfg] = useState<PressureConfig>({ radius: 3, difficulty: 'mild' });
  const [pState, setPState] = useState<PressureState | null>(null);
  const [lCfg, setLCfg] = useState<LeapConfig>({ difficulty: 'mild' });
  const [lState, setLState] = useState<LeapState | null>(null);
  const [sCfg, setSCfg] = useState<ScrambleConfig>({ holes: 9, difficulty: 'mixed' });
  const [sState, setSState] = useState<ScrambleState | null>(null);

  const [conn, setConn] = useState<ConnectionState>(openConnectService.getState());
  const [library, setLibrary] = useState<GreenLibrary | null>(null);
  const [ble, setBle] = useState<SquareStatus>(squareBle.status);
  useEffect(() => {
    let alive = true;
    loadGreenLibrary().then((lib) => alive && setLibrary(lib));
    return () => {
      alive = false;
    };
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);

  /* ------------------------------- layout & physics ------------------------------- */

  // Practice "random" mode: any green and pin, mild–hard slope, 3–35 ft.
  const [randomPutt, setRandomPutt] = useState(makeRandomPutt);

  const liveLayout: PuttLayout = useMemo(() => {
    switch (mode) {
      case 'pressure-circle':
        return pState
          ? { ...pressureLayout(pState), greenRadiusM: 6.5 }
          : { seed: 777, difficulty: pCfg.difficulty, distanceFt: pCfg.radius, angleRad: 0, holeRadiusMultiplier: 1, greenRadiusM: 6.5 };
      case 'speed-control':
        return lState
          ? { ...leapLayout(lState), greenRadiusM: 17.5 }
          : { seed: 778, difficulty: lCfg.difficulty, distanceFt: LEAP_END_FT, angleRad: 0, holeRadiusMultiplier: 0, greenRadiusM: 17.5 };
      case 'scramble-gauntlet': {
        if (!sState) return { seed: 779, difficulty: 'medium', distanceFt: 18, angleRad: 0.4, holeRadiusMultiplier: 1 };
        const h = sState.holes[Math.min(sState.holeIdx, sState.holes.length - 1)];
        return { ...scrambleLayout(sState), anchor: ballFromLayout(h.startDistanceFt, h.angleRad) };
      }
      default:
        if (settings.practiceNext === 'random') return { ...randomPutt, holeRadiusMultiplier: 1 };
        return {
          seed: settings.practiceSeed,
          difficulty: settings.practiceDifficulty,
          distanceFt: settings.practiceDistanceFt,
          angleRad: 0,
          holeRadiusMultiplier: 1,
        };
    }
  }, [mode, pState, pCfg, lState, lCfg, sState, settings.practiceSeed, settings.practiceDifficulty, settings.practiceDistanceFt, settings.practiceNext, randomPutt]);

  // Freeze the green while a putt is rolling and its result is on screen.
  const [layout, setLayout] = useState<PuttLayout>(liveLayout);
  if (!busy && !sameLayout(layout, liveLayout)) setLayout(liveLayout);

  const stimp = settings.stimp;
  const useReal = settings.greenSource === 'real' && !!library && layout.difficulty !== 'flat';
  const surface: PuttingSurface = useMemo(() => {
    if (useReal && library && layout.difficulty !== 'flat') {
      const real = pickRealGreen(library, layout.difficulty, layout.seed, stimp);
      if (real) return real;
    }
    return new GreenSurface(layout.difficulty, layout.seed, stimp);
  }, [useReal, library, layout.difficulty, layout.seed, stimp]);
  const ball = useMemo(() => {
    if (layout.ball) return layout.ball;
    if (surface instanceof RealGreenSurface) return placeBallOnGreen(surface, layout.distanceFt, layout.angleRad);
    return ballFromLayout(layout.distanceFt, layout.angleRad);
  }, [surface, layout.ball, layout.distanceFt, layout.angleRad]);
  const onGreen = useMemo(() => {
    if (surface instanceof RealGreenSurface) return (x: number, z: number) => surface.contains({ x, z });
    const anchor = layout.anchor ?? ball;
    const r = layout.greenRadiusM;
    return (x: number, z: number) => generatedGreenContains({ x, z }, anchor, r);
  }, [surface, layout.anchor, layout.greenRadiusM, ball]);
  const setup: PuttSetup = useMemo(
    () => ({ surface, stimp, ball, holeRadiusMultiplier: layout.holeRadiusMultiplier, speedCalibration: settings.speedCalibration, onGreen }),
    [surface, stimp, ball, layout.holeRadiusMultiplier, settings.speedCalibration, onGreen]
  );
  const idealPastM = settings.idealPastIn * 0.0254;
  const ideal = useMemo(() => solveIdealStroke({ ...setup, holeRadiusMultiplier: 1 }, idealPastM), [setup, idealPastM]);

  /* ------------------------------ chosen start line ------------------------------ */
  // Start direction off the line to the hole, as a step on AIM_STEPS (+ right / − left);
  // resets for every new putt.
  const ballKey = `${layout.seed}|${ball.x.toFixed(3)}|${ball.z.toFixed(3)}`;
  const [aim, setAim] = useState({ key: ballKey, step: 0 });
  if (aim.key !== ballKey) setAim({ key: ballKey, step: 0 });
  const aimLocked = settings.readAssist === 'line';
  const aimStep = aim.key === ballKey ? aim.step : 0;
  const aimHlaDeg = aimLocked ? ideal.hlaDeg : Math.sign(aimStep) * (AIM_STEPS[Math.abs(aimStep) - 1] ?? 0);
  const nudgeAim = useCallback((dir: -1 | 1) => {
    setAim((a) => ({ key: a.key, step: Math.max(-AIM_STEPS.length, Math.min(AIM_STEPS.length, a.step + dir)) }));
  }, []);
  // Keyboard / remote: ← → arrows, or Page Up / Page Down (what presentation clickers send).
  useEffect(() => {
    if (mode === 'analytics' || aimLocked) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (!busy) nudgeAim(dir);
    };
    window.addEventListener('keydown', onKey);
    // The Square's own remote (its left / right buttons, over Bluetooth)
    const offRemote = squareBle.onRemote((b) => {
      if (!busy) nudgeAim(b === 'left' ? -1 : 1);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      offRemote();
    };
  }, [mode, aimLocked, busy, nudgeAim]);
  const read = useMemo(() => readPutt(surface, ball), [surface, ball]);

  const drillPlaying =
    mode === 'analysis' ||
    (mode === 'pressure-circle' && pState?.status === 'playing') ||
    (mode === 'speed-control' && lState?.status === 'playing') ||
    (mode === 'scramble-gauntlet' && sState?.status === 'playing');

  useEffect(() => {
    openConnectService.setContext({ setup, layout, ideal, mode, aimHlaDeg, aimSource: aimLocked ? 'ideal' : 'player' });
  }, [setup, layout, ideal, mode, aimHlaDeg, aimLocked]);
  useEffect(() => {
    openConnectService.setAccepting(!busy && drillPlaying);
  }, [busy, drillPlaying]);

  /* ----------------------------------- shots ----------------------------------- */

  const handleShot = (s: PuttingShotData) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShot(s); // starts the roll on the green
    setFlash(null);
    setBusy(true);
    setBanner(null);
    saveShotToHistory(s);

    // Everything the player sees about the result waits until the ball stops (onRollComplete).
    let ev: DrillEvent = practiceEvent(s);
    const commits: (() => void)[] = [
      () => {
        setShownShot(s);
        if (mode !== 'analysis' && mode !== 'speed-control') {
          setFlash(s);
          timers.current.push(setTimeout(() => setFlash((f) => (f === s ? null : f)), 6500));
        }
        setShots((prev) => [{ ...s, trajectoryPoints: undefined }, ...prev].slice(0, 1000));
      },
    ];
    if (mode === 'pressure-circle' && pState) {
      const r = pressureOnShot(pState, s);
      ev = r.event;
      commits.push(() => {
        setPState(r.state);
        if (r.state.bestRun > 0) {
          updateDrillBests({ pressureCircle: { bestStreak: r.state.bestRun, lowestFaceStdDev: r.state.faceAngles.length >= 5 ? pressureFaceStdDev(r.state) : 999, lastUpdated: Date.now() } });
        }
      });
    } else if (mode === 'speed-control' && lState) {
      const r = leapOnShot(lState, s);
      ev = r.event;
      commits.push(() => {
        setLState(r.state);
        if (r.state.best > 0) updateDrillBests({ leapfrog: { best: r.state.best, lastUpdated: Date.now() } });
      });
    } else if (mode === 'scramble-gauntlet' && sState) {
      const r = scrambleOnShot(sState, s);
      ev = r.event;
      commits.push(() => {
        setSState(r.state);
        if (r.state.status === 'over') {
          const st = scrambleStats(r.state);
          updateDrillBests({ scrambleGauntlet: { highestStrokesGained: st.sgPer18, lowestCepInches: st.cepInches, lastUpdated: Date.now() } });
        }
      });
    }
    pendingEvent.current = ev;
    pendingCommit.current = () => commits.forEach((c) => c());
  };
  const handleShotRef = useRef(handleShot);
  useEffect(() => {
    handleShotRef.current = handleShot;
  });

  const practiceNextRef = useRef<{ mode: AppMode; next: AppSettings['practiceNext']; shot: PuttingShotData | null }>({ mode: 'analysis', next: 'same', shot: null });
  useEffect(() => {
    practiceNextRef.current = { mode, next: settings.practiceNext, shot };
  });
  const cameraRef = useRef(settings.camera);
  useEffect(() => {
    cameraRef.current = settings.camera;
  }, [settings.camera]);
  const onRollComplete = useCallback(() => {
    pendingCommit.current?.();
    pendingCommit.current = null;
    const ev = pendingEvent.current;
    pendingEvent.current = null;
    setBanner(ev);
    celebrate(ev);
    setBests(getDrillBests());
    // Putter view flies to where the ball stopped: give it time to arrive and be seen.
    const hold = ev?.kind === 'game-over' ? 600 : cameraRef.current === 'behind' ? 3200 : 1900;
    timers.current.push(
      setTimeout(() => {
        setBusy(false);
        setResetKey((k) => k + 1);
        setSState((st) => (st && st.status === 'hole-complete' ? scrambleAdvance(st) : st));
        // Practice: move on to a new putt if the player asked for that
        const nx = practiceNextRef.current;
        if (nx.mode === 'analysis' && nx.shot) {
          if (nx.next === 'random') setRandomPutt(makeRandomPutt());
          else if (nx.next === 'new-on-make' && nx.shot.isHoled) setSettings((p) => ({ ...p, practiceSeed: p.practiceSeed + 1 }));
        }
      }, hold)
    );
    timers.current.push(setTimeout(() => setBanner(null), ev?.kind === 'game-over' ? 5000 : 2800));
  }, []);

  useEffect(() => {
    openConnectService.connect();
    const u1 = openConnectService.subscribeConnection(setConn);
    const ub1 = squareBle.onStatus(setBle);
    const ub2 = squareBle.onShot((packet) => openConnectService.processPacket(packet, 'live'));
    const u2 = openConnectService.subscribeShot((s) => handleShotRef.current(s));
    let t: ReturnType<typeof setTimeout> | null = null;
    const u3 = openConnectService.subscribeFilter((reason) => {
      setFilterNote(reason);
      if (t) clearTimeout(t);
      t = setTimeout(() => setFilterNote(null), 3500);
    });
    const pending = timers.current;
    return () => {
      u1();
      u2();
      u3();
      ub1();
      ub2();
      if (t) clearTimeout(t);
      pending.forEach(clearTimeout);
    };
  }, []);

  const switchMode = (m: AppMode) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pendingEvent.current = null;
    pendingCommit.current?.(); // a putt still rolling when switching: record it now
    pendingCommit.current = null;
    setMode(m);
    setBusy(false);
    setBanner(null);
    setShot(null);
    setFlash(null);
  };

  /* ------------------------------ scene decorations ------------------------------ */

  const rings: RingSpec[] = useMemo(() => {
    if (mode === 'scramble-gauntlet' && sState) {
      const d = layout.ball ? Math.hypot(layout.ball.x, layout.ball.z) * 3.28084 : layout.distanceFt;
      return [{ radiusFt: gimmeRadiusFt(d), color: '#4fb3ff' }];
    }
    return [];
  }, [mode, sState, layout]);

  const markers: MarkerSpec[] = useMemo(() => [], []);
  // Pressure circle: the rest of this set of 12 sits around the hole, waiting its turn.
  // Leapfrog: the balls of this round stay where they finished.
  const waitingBalls = useMemo(() => {
    if (mode === 'speed-control' && lState) return lState.balls.map((b) => ({ x: b.x, z: b.z }));
    if (mode !== 'pressure-circle' || !pState || pState.status !== 'playing') return [];
    return Array.from({ length: CIRCLE_BALLS - pState.ballIdx - 1 }, (_, k) => circleBall(pState, pState.ballIdx + 1 + k));
  }, [mode, pState, lState]);
  // Leapfrog has no cup: virtual putts aim about a foot past the last ball instead.
  const padIdeal = useMemo(() => {
    if (mode !== 'speed-control' || !lState) return ideal;
    const lastFt = lState.balls.length ? lState.balls[lState.balls.length - 1].ft : LEAP_START_FT;
    return { ...ideal, ballSpeedMph: speedForFlatDistanceMph(lastFt + 1, stimp) };
  }, [mode, lState, ideal, stimp]);
  const ladder = useMemo(() => (mode === 'speed-control' ? { fromFt: LEAP_START_FT, toFt: LEAP_END_FT, stepFt: 3 } : null), [mode]);
  const overlays = useMemo(
    () => ({ grid: settings.grid, contours: settings.contours, heatmap: settings.heatmap, fallLines: settings.fallLines, aimLine: settings.aimLine }),
    [settings.grid, settings.contours, settings.heatmap, settings.fallLines, settings.aimLine]
  );
  const outline = useMemo(() => ({ anchor: layout.anchor, radiusM: layout.greenRadiusM }), [layout.anchor, layout.greenRadiusM]);
  const recent = useMemo(() => shots.filter((s) => s.mode === mode).slice(0, 10), [shots, mode]);
  const live = (conn.connected && conn.launchMonitorConnected) || ble.connected;
  useEffect(() => {
    if (ble.connected) squareBle.setGreenSpeed(stimp);
  }, [ble.connected, stimp]);

  const drillPanel =
    mode === 'pressure-circle' ? (
      <PressurePanel
        state={pState}
        config={pCfg}
        onConfig={setPCfg}
        onStart={() => setPState(newPressure(pState?.cfg ?? pCfg))}
        onNextLevel={() => {
          const cfg = { ...(pState?.cfg ?? pCfg), radius: Math.min(4, (pState?.cfg.radius ?? pCfg.radius) + 1) as CircleRadiusFt };
          setPCfg(cfg);
          setPState(newPressure(cfg));
        }}
        onReset={() => setPState(null)}
        best={bests.pressureCircle.bestStreak}
      />
    ) : mode === 'speed-control' ? (
      <LeapfrogPanel
        state={lState}
        config={lCfg}
        onConfig={setLCfg}
        onStart={() => setLState(newLeap(lState?.cfg ?? lCfg))}
        onReset={() => setLState(null)}
        best={bests.leapfrog.best}
      />
    ) : mode === 'scramble-gauntlet' ? (
      <ScramblePanel
        state={sState}
        config={sCfg}
        onConfig={setSCfg}
        onStart={() => setSState(newScramble(sState?.cfg ?? sCfg))}
        onReset={() => setSState(null)}
        bestSg18={bests.scrambleGauntlet.highestStrokesGained}
      />
    ) : null;

  const waitingForSetup = mode !== 'analysis' && mode !== 'analytics' && !drillPlaying;

  return (
    <div className="flex h-screen flex-col">
      <TopBar mode={mode} onMode={switchMode} connection={conn} ble={ble} onOpenConnection={() => setConnOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />

      {mode === 'analytics' ? (
        <main className="min-h-0 flex-1">
          <StatsView
            shots={shots}
            baseline={settings.statsBaseline}
            onBaseline={(b) => patch({ statsBaseline: b })}
            onDataChanged={() => {
              setShots(getStoredShots());
              setBests(getDrillBests());
            }}
          />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 bg-club-950">
            <PuttingGreenCanvas
              surface={surface}
              ball={ball}
              holeRadiusMultiplier={layout.holeRadiusMultiplier}
              shot={shot}
              cameraMode={settings.camera}
              overlays={overlays}
              idealSamples={settings.readAssist === 'line' ? ideal.samples : null}
              rings={rings}
              markers={markers}
              outline={outline}
              resetKey={resetKey}
              exaggeration={3}
              aimDeg={aimHlaDeg}
              waitingBalls={waitingBalls}
              ladder={ladder}
              onRollComplete={onRollComplete}
            />
            {mode !== 'speed-control' && <ReadChip read={read} ideal={settings.readAssist === 'off' ? null : ideal} assist={settings.readAssist} stimp={stimp} greenLabel={surface.label} rating={surface instanceof RealGreenSurface ? surface.difficulty : undefined} />}
            <ResultBanner event={banner} />
            <PuttFlash shot={flash} onClose={() => setFlash(null)} />
            {waitingForSetup && !banner && (
              <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-club-950/85 px-5 py-2 text-sm text-mist ring-1 ring-line">
                Set up the drill on the right, then press start
              </div>
            )}
            {filterNote && (
              <div className="absolute right-4 top-4 z-10 max-w-xs rounded-xl bg-club-950/90 px-4 py-2 text-sm text-mist ring-1 ring-line">{filterNote}</div>
            )}
            {!live && <PracticePad ideal={padIdeal} aimDeg={aimHlaDeg} disabled={busy || !drillPlaying} />}
            {!waitingForSetup && (
              <AimControl
                aimDeg={aimHlaDeg}
                locked={aimLocked}
                disabled={busy}
                onNudge={nudgeAim}
                onReset={() => setAim((a) => ({ ...a, step: 0 }))}
              />
            )}
            <BallPlacement ble={ble} active={!busy && drillPlaying} />
          </div>

          <aside className="w-[400px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-club-950 p-4">
            {drillPanel}
            <LastPutt shot={shownShot && shownShot.mode === mode ? shownShot : recent[0] ?? null} recent={recent} />
          </aside>
        </main>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        settings={settings}
        onChange={patch}
        onNewGreen={() => patch({ practiceSeed: settings.practiceSeed + 1 })}
        realGreensAvailable={!!library}
      />
      <ConnectionDrawer open={connOpen} onClose={() => setConnOpen(false)} state={conn} ble={ble} />
    </div>
  );
}


