'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AppMode, ConnectionState, PuttingShotData, PuttLayout } from '@/lib/types';
import { AppSettings, loadSettings, saveSettings } from '@/lib/settings';
import { GreenSurface, PuttingSurface, readPutt } from '@/lib/green';
import { GreenLibrary, loadGreenLibrary, pickRealGreen, placeBallOnGreen, RealGreenSurface } from '@/lib/realGreens';
import { PuttSetup, solveIdealStroke } from '@/lib/physicsEngine';
import { openConnectService } from '@/lib/openConnectService';
import { squareBle, SquareStatus } from '@/lib/squareBle';
import { getStoredShots, saveShotToHistory, getDrillBests, updateDrillBests } from '@/lib/storage';
import {
  DrillEvent,
  ballFromLayout,
  PressureConfig,
  PressureState,
  newPressure,
  pressureLayout,
  pressureOnShot,
  pressureFaceStdDev,
  LagConfig,
  LagState,
  newLag,
  lagLayout,
  lagOnShot,
  lagStats,
  ScrambleConfig,
  ScrambleState,
  newScramble,
  scrambleLayout,
  scrambleOnShot,
  scrambleAdvance,
  scrambleStats,
  gimmeRadiusFt,
  LagZone,
} from '@/lib/drills';
import { TopBar } from '@/components/ui/TopBar';
import { PuttingGreenCanvas } from '@/components/green/PuttingGreenCanvas';
import { MarkerSpec, RingSpec } from '@/components/green/greenScene';
import { ReadChip, ResultBanner, PracticePad } from '@/components/hud/CanvasHud';
import { LastPutt } from '@/components/hud/LastPutt';
import { BallPlacement } from '@/components/hud/BallPlacement';
import { AimControl } from '@/components/hud/AimControl';
import { PressurePanel, LagPanel, ScramblePanel } from '@/components/drills/DrillPanels';
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

/** Aim steps (degrees): 0.25° to 1.5°, then 0.5° to 3°, then 1° to 15°. */
const AIM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const ZONE_COLOR: Record<LagZone, string> = {
  holed: '#4fb3ff',
  zone: '#4ade80',
  'close-short': '#fbbf24',
  long: '#a9bcb0',
  short: '#f87171',
  'way-long': '#f87171',
};

function practiceEvent(s: PuttingShotData): DrillEvent {
  if (s.isHoled) return { kind: 'make', title: 'Holed', detail: s.speedErrorPct !== undefined ? `${Math.abs(s.speedErrorPct) < 1 ? 'Perfect pace' : `${Math.abs(s.speedErrorPct).toFixed(0)}% ${s.speedErrorPct > 0 ? 'firm' : 'soft'}`}` : undefined };
  const d = Math.abs(s.distanceErrorFt);
  const title = s.lipOut ? 'Lipped out' : d < 0.2 ? 'Pin high' : `${d.toFixed(1)} ft ${s.distanceErrorFt < 0 ? 'short' : 'past'}`;
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
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<DrillEvent | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const pendingEvent = useRef<DrillEvent | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [bests, setBests] = useState(getDrillBests);
  const [filterNote, setFilterNote] = useState<string | null>(null);

  const [pCfg, setPCfg] = useState<PressureConfig>({ distance: 5, lives: 3, difficulty: 'mild' });
  const [pState, setPState] = useState<PressureState | null>(null);
  const [lCfg, setLCfg] = useState<LagConfig>({ distance: 'mixed', putts: 10, difficulty: 'mild' });
  const [lState, setLState] = useState<LagState | null>(null);
  const [lagRests, setLagRests] = useState<MarkerSpec[]>([]);
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

  const liveLayout: PuttLayout = useMemo(() => {
    switch (mode) {
      case 'pressure-circle':
        return pState
          ? { ...pressureLayout(pState), greenRadiusM: 6.5 }
          : { seed: 777, difficulty: pCfg.difficulty, distanceFt: pCfg.distance === 'ladder' ? 3 : pCfg.distance, angleRad: 0, holeRadiusMultiplier: 1, greenRadiusM: 6.5 };
      case 'speed-control':
        return lState
          ? { ...lagLayout(lState), greenRadiusM: 17.5 }
          : { seed: 778, difficulty: lCfg.difficulty, distanceFt: lCfg.distance === 'mixed' ? 35 : lCfg.distance, angleRad: 0, holeRadiusMultiplier: 1, greenRadiusM: 17.5 };
      case 'scramble-gauntlet': {
        if (!sState) return { seed: 779, difficulty: 'medium', distanceFt: 18, angleRad: 0.4, holeRadiusMultiplier: 1 };
        const h = sState.holes[Math.min(sState.holeIdx, sState.holes.length - 1)];
        return { ...scrambleLayout(sState), anchor: ballFromLayout(h.startDistanceFt, h.angleRad) };
      }
      default:
        return {
          seed: settings.practiceSeed,
          difficulty: settings.practiceDifficulty,
          distanceFt: settings.practiceDistanceFt,
          angleRad: 0,
          holeRadiusMultiplier: 1,
        };
    }
  }, [mode, pState, pCfg, lState, lCfg, sState, settings.practiceSeed, settings.practiceDifficulty, settings.practiceDistanceFt]);

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
  const setup: PuttSetup = useMemo(
    () => ({ surface, stimp, ball, holeRadiusMultiplier: layout.holeRadiusMultiplier, speedCalibration: settings.speedCalibration }),
    [surface, stimp, ball, layout.holeRadiusMultiplier, settings.speedCalibration]
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
    return () => window.removeEventListener('keydown', onKey);
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
    setShot(s);
    setBusy(true);
    setBanner(null);
    saveShotToHistory(s);
    setShots((prev) => [{ ...s, trajectoryPoints: undefined }, ...prev].slice(0, 1000));

    let ev: DrillEvent = practiceEvent(s);
    if (mode === 'pressure-circle' && pState) {
      const r = pressureOnShot(pState, s);
      setPState(r.state);
      ev = r.event;
      if (r.state.bestStreak > 0) {
        updateDrillBests({ pressureCircle: { bestStreak: r.state.bestStreak, lowestFaceStdDev: r.state.faceAngles.length >= 5 ? pressureFaceStdDev(r.state) : 999, lastUpdated: Date.now() } });
      }
    } else if (mode === 'speed-control' && lState) {
      const r = lagOnShot(lState, s);
      setLState(r.state);
      ev = r.event;
      const last = r.state.results[r.state.results.length - 1];
      setLagRests((m) => [...m, { x: s.rest.x, z: s.rest.z, color: ZONE_COLOR[last.zone] }]);
      if (r.state.status === 'over') {
        updateDrillBests({ speedControl: { highScore: r.state.score, lowestSpeedStdDev: lagStats(r.state).distanceStdDevFt, lastUpdated: Date.now() } });
      }
    } else if (mode === 'scramble-gauntlet' && sState) {
      const r = scrambleOnShot(sState, s);
      setSState(r.state);
      ev = r.event;
      if (r.state.status === 'over') {
        const st = scrambleStats(r.state);
        updateDrillBests({ scrambleGauntlet: { highestStrokesGained: st.sgPer18, lowestCepInches: st.cepInches, lastUpdated: Date.now() } });
      }
    }
    pendingEvent.current = ev;
  };
  const handleShotRef = useRef(handleShot);
  useEffect(() => {
    handleShotRef.current = handleShot;
  });

  const onRollComplete = useCallback(() => {
    const ev = pendingEvent.current;
    pendingEvent.current = null;
    setBanner(ev);
    if (ev && (ev.kind === 'milestone' || ev.kind === 'level-up')) {
      audioEngine.playChime();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.55, x: 0.4 }, colors: ['#f5c84c', '#eef2ea', '#4ade80'] });
    }
    setBests(getDrillBests());
    const hold = ev?.kind === 'game-over' ? 600 : 1900;
    timers.current.push(
      setTimeout(() => {
        setBusy(false);
        setResetKey((k) => k + 1);
        setSState((st) => (st && st.status === 'hole-complete' ? scrambleAdvance(st) : st));
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
    setMode(m);
    setBusy(false);
    setBanner(null);
    setShot(null);
  };

  /* ------------------------------ scene decorations ------------------------------ */

  const rings: RingSpec[] = useMemo(() => {
    if (mode === 'speed-control') return [{ radiusFt: 3, color: '#4ade80', fill: true, pastOnly: true }, { radiusFt: 3, color: '#a9bcb0' }];
    if (mode === 'scramble-gauntlet' && sState) {
      const d = layout.ball ? Math.hypot(layout.ball.x, layout.ball.z) * 3.28084 : layout.distanceFt;
      return [{ radiusFt: gimmeRadiusFt(d), color: '#4fb3ff' }];
    }
    return [];
  }, [mode, sState, layout]);

  const markers = mode === 'speed-control' ? lagRests : [];
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
        onReset={() => setPState(null)}
        best={bests.pressureCircle.bestStreak}
      />
    ) : mode === 'speed-control' ? (
      <LagPanel
        state={lState}
        config={lCfg}
        onConfig={setLCfg}
        onStart={() => {
          setLagRests([]);
          setLState(newLag(lState?.cfg ?? lCfg));
        }}
        onReset={() => {
          setLagRests([]);
          setLState(null);
        }}
        best={bests.speedControl.highScore}
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
              onRollComplete={onRollComplete}
            />
            <ReadChip read={read} ideal={settings.readAssist === 'off' ? null : ideal} assist={settings.readAssist} stimp={stimp} greenLabel={surface.label} rating={surface instanceof RealGreenSurface ? surface.difficulty : undefined} />
            <ResultBanner event={banner} />
            {waitingForSetup && !banner && (
              <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-club-950/85 px-5 py-2 text-sm text-mist ring-1 ring-line">
                Set up the drill on the right, then press start
              </div>
            )}
            {filterNote && (
              <div className="absolute right-4 top-4 z-10 max-w-xs rounded-xl bg-club-950/90 px-4 py-2 text-sm text-mist ring-1 ring-line">{filterNote}</div>
            )}
            {!live && <PracticePad ideal={ideal} aimDeg={aimHlaDeg} disabled={busy || !drillPlaying} />}
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
            <LastPutt shot={shot && shot.mode === mode ? shot : recent[0] ?? null} recent={recent} />
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


