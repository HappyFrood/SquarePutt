'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppMode,
  PuttingShotData,
  SlopeDifficulty,
  ConnectionState,
  UserProfile,
} from '@/lib/types';
import { openConnectService } from '@/lib/openConnectService';
import {
  getStoredShots,
  saveShotToHistory,
  getActiveProfile,
  updateDrillBests,
  getDrillBests,
} from '@/lib/storage';
import { calculateStdDev, calculateCepInches, calculateStrokesGained } from '@/lib/calculations';
import confetti from 'canvas-confetti';

import { Header } from '@/components/ui/Header';
import { PuttingGreenCanvas } from '@/components/green/PuttingGreenCanvas';
import { KioskTelemetryOverlay } from '@/components/kiosk/KioskTelemetryOverlay';
import { ImpactVisualizer } from '@/components/telemetry/ImpactVisualizer';
import { SkidAnalysisCard } from '@/components/telemetry/SkidAnalysisCard';
import { DispersionHeatmap } from '@/components/analytics/DispersionHeatmap';
import { BagMappingChart } from '@/components/analytics/BagMappingChart';
import { SessionHistoryView } from '@/components/analytics/SessionHistoryView';
import { OpenConnectModal } from '@/components/connection/OpenConnectModal';
import { ShotSimulatorStudio } from '@/components/connection/ShotSimulatorStudio';
import { ModeSettingsModal } from '@/components/modals/ModeSettingsModal';

export default function Home() {
  const [activeMode, setActiveMode] = useState<AppMode>('analysis');
  const [currentShot, setCurrentShot] = useState<PuttingShotData | null>(null);
  const [shots, setShots] = useState<PuttingShotData[]>(() => {
    if (typeof window === 'undefined') return [];
    return getStoredShots();
  });
  const [profile, setProfile] = useState<UserProfile>(getActiveProfile());

  // Environment Settings
  const [stimp, setStimp] = useState<number>(10.5);
  const [slopeDifficulty, setSlopeDifficulty] = useState<SlopeDifficulty>('flat');
  const [targetDistanceFt, setTargetDistanceFt] = useState<number>(10.0);
  const [terrainSeed, setTerrainSeed] = useState<number>(42);
  const [holeRadiusMultiplier, setHoleRadiusMultiplier] = useState<number>(1.0);

  // 3D Visual Controls
  const [cameraMode, setCameraMode] = useState<'behind' | 'overhead' | 'follow' | 'orbit'>('behind');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showBreakBeads, setShowBreakBeads] = useState<boolean>(true);
  const [showAimLine, setShowAimLine] = useState<boolean>(true);
  const [showStripes, setShowStripes] = useState<boolean>(true);

  // Hands-Free Kiosk State
  const [isRolling, setIsRolling] = useState<boolean>(false);

  // Drill State (Lifted to maintain hands-free state across auto-resets)
  // 1. Pressure Circle (Survival Mode)
  const [survivalStreak, setSurvivalStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return getDrillBests().pressureCircle.bestStreak;
  });
  const [pressureFaceAngles, setPressureFaceAngles] = useState<number[]>([]);

  // 2. Speed Control (Bullseye Lag Mode)
  const [bullseyeScore, setBullseyeScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return getDrillBests().speedControl.highScore;
  });
  const [lagSpeeds, setLagSpeeds] = useState<number[]>([]);

  // 3. The Scramble (Gauntlet Mode)
  const [scrambleHole, setScrambleHole] = useState<number>(1);
  const totalScrambleHoles = 9;
  const [strokesGainedTotal, setStrokesGainedTotal] = useState<number>(0);
  const [scrambleDeviations, setScrambleDeviations] = useState<{ xInches: number; zInches: number }[]>([]);

  // Connection & Modals
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    openConnectService.getState()
  );
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Sync environment with physics service
  useEffect(() => {
    openConnectService.setEnvironmentContext({
      stimp,
      targetDistanceFt,
      slopeDifficulty,
      terrainSeed,
      holeRadiusMultiplier,
    });
  }, [stimp, targetDistanceFt, slopeDifficulty, terrainSeed, holeRadiusMultiplier]);

  // Generate next random Scramble hole (hands-free)
  const advanceScrambleHole = useCallback((nextHole: number) => {
    const slopes: SlopeDifficulty[] = ['mild', 'medium', 'hard'];
    const randomDist = Number((7 + Math.random() * 30).toFixed(1));
    const randomSlope = slopes[Math.floor(Math.random() * slopes.length)];
    const seed = Math.floor(Math.random() * 999999);

    setTargetDistanceFt(randomDist);
    setSlopeDifficulty(randomSlope);
    setTerrainSeed(seed);
    setScrambleHole(nextHole);
  }, []);

  // Process incoming shot (hands-free telemetry and drill evaluation)
  const handleIncomingShot = (shot: PuttingShotData) => {
    setIsRolling(true);
    setCurrentShot(shot);
    saveShotToHistory(shot);
    setShots((prev) => [shot, ...prev]);

    // Mode-specific scoring updates
    if (activeMode === 'pressure-circle') {
      setPressureFaceAngles((prev) => [...prev, shot.faceAngleDeg]);
      if (shot.isHoled) {
        const nextStreak = survivalStreak + 1;
        setSurvivalStreak(nextStreak);
        if (nextStreak > bestStreak) {
          setBestStreak(nextStreak);
          updateDrillBests({
            pressureCircle: {
              bestStreak: nextStreak,
              lowestFaceStdDev: calculateStdDev([...pressureFaceAngles, shot.faceAngleDeg]),
              lastUpdated: Date.now(),
            },
          });
        }
        if (nextStreak % 5 === 0) {
          try {
            confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
          } catch {}
        }
        // Dynamic shrinking cup
        setHoleRadiusMultiplier(Math.max(0.55, 1.0 - nextStreak * 0.05));
      } else {
        // Missed putt resets streak
        setSurvivalStreak(0);
        setHoleRadiusMultiplier(1.0);
      }
    } else if (activeMode === 'speed-control') {
      setLagSpeeds((prev) => [...prev, shot.ballSpeedMph]);
      const err = shot.distanceErrorFt;
      let delta = 0;
      if (shot.isHoled) delta = 100;
      else if (err >= 0 && err <= 3.0) delta = 50;
      else if (err > 3.0 && err <= 5.0) delta = 15;
      else if (err < 0) delta = -25;
      else delta = -15;

      const nextScore = Math.max(0, bullseyeScore + delta);
      setBullseyeScore(nextScore);
      if (nextScore > highScore) {
        setHighScore(nextScore);
        updateDrillBests({
          speedControl: {
            highScore: nextScore,
            lowestSpeedStdDev: calculateStdDev([...lagSpeeds, shot.ballSpeedMph]),
            lastUpdated: Date.now(),
          },
        });
      }
    } else if (activeMode === 'scramble-gauntlet') {
      const lateralFt = (shot.lateralErrorInches || 0) / 12;
      const missDistanceFt = Math.sqrt(lateralFt * lateralFt + shot.distanceErrorFt * shot.distanceErrorFt);
      const sg = calculateStrokesGained({
        startDistanceFt: targetDistanceFt,
        isHoled: shot.isHoled,
        remainingDistanceFt: shot.isHoled ? 0 : missDistanceFt,
      });

      const nextSgTotal = Number((strokesGainedTotal + sg).toFixed(2));
      setStrokesGainedTotal(nextSgTotal);

      const dev = { xInches: shot.lateralErrorInches, zInches: shot.distanceErrorFt * 12 };
      const updatedDevs = [...scrambleDeviations, dev];
      setScrambleDeviations(updatedDevs);

      if (scrambleHole < totalScrambleHoles) {
        setTimeout(() => {
          advanceScrambleHole(scrambleHole + 1);
        }, 3500);
      } else {
        updateDrillBests({
          scrambleGauntlet: {
            highestStrokesGained: nextSgTotal,
            lowestCepInches: calculateCepInches(updatedDevs),
            lastUpdated: Date.now(),
          },
        });
      }
    }
  };

  const handleIncomingShotRef = useRef(handleIncomingShot);
  useEffect(() => {
    handleIncomingShotRef.current = handleIncomingShot;
  });

  // Connect to Open Connect WebSocket on mount & subscribe to shot events
  useEffect(() => {
    openConnectService.connect();

    const unsubConn = openConnectService.subscribeConnection((state) => {
      setConnectionState(state);
    });

    const unsubShot = openConnectService.subscribeShot((shot) => {
      handleIncomingShotRef.current(shot);
    });

    return () => {
      unsubConn();
      unsubShot();
    };
  }, []);

  // Mode Switcher handler (Opens Mode Settings so user can pick & refine parameters!)
  const handleSelectMode = (mode: AppMode) => {
    setActiveMode(mode);
    setIsRolling(false);

    if (mode === 'analysis') {
      setSlopeDifficulty('flat');
      setTargetDistanceFt(10.0);
      setHoleRadiusMultiplier(1.0);
    } else if (mode === 'pressure-circle') {
      setSlopeDifficulty('flat');
      setTargetDistanceFt(5.0);
      setSurvivalStreak(0);
      setHoleRadiusMultiplier(1.0);
    } else if (mode === 'speed-control') {
      setSlopeDifficulty('flat');
      setTargetDistanceFt(20.0);
      setBullseyeScore(0);
      setHoleRadiusMultiplier(1.0);
    } else if (mode === 'scramble-gauntlet') {
      setScrambleHole(1);
      setStrokesGainedTotal(0);
      setScrambleDeviations([]);
      advanceScrambleHole(1);
    }

    // Automatically prompt golfer with Mode Settings to pick and refine parameters
    if (mode !== 'analytics') {
      setIsSettingsModalOpen(true);
    }
  };

  const handleResetActiveDrill = () => {
    if (activeMode === 'pressure-circle') {
      setSurvivalStreak(0);
      setHoleRadiusMultiplier(1.0);
    } else if (activeMode === 'speed-control') {
      setBullseyeScore(0);
    } else if (activeMode === 'scramble-gauntlet') {
      setScrambleHole(1);
      setStrokesGainedTotal(0);
      setScrambleDeviations([]);
      advanceScrambleHole(1);
    }
  };

  // Dynamic gimme circle for the scramble
  const gimmeRadiusFt = Number(
    Math.min(3.8, Math.max(1.5, targetDistanceFt * 0.1 + 0.8)).toFixed(1)
  );

  return (
    <div className="sp-kiosk-app">
      {/* 1. Kiosk Top Bar */}
      <Header
        activeMode={activeMode}
        onSelectMode={handleSelectMode}
        connectionState={connectionState}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        profile={profile}
      />

      {/* 2. Fullscreen Single-Monitor Arena (No Scrollbar, Fits 100vh & any aspect ratio!) */}
      <div className="sp-arena">
        {/* Left/Center Stage: 3D Putting Green (Dominant, clean, distraction-free) */}
        <div className="sp-left-stage">
          {/* 3D Green Canvas Viewport */}
          <div className="sp-canvas-wrapper">
            <PuttingGreenCanvas
              currentShot={currentShot}
              targetDistanceFt={targetDistanceFt}
              stimp={stimp}
              slopeDifficulty={slopeDifficulty}
              terrainSeed={terrainSeed}
              cameraMode={cameraMode}
              showGrid={showGrid}
              showHeatmap={showHeatmap}
              showBreakBeads={showBreakBeads}
              showAimLine={showAimLine}
              showStripes={showStripes}
              holeRadiusMultiplier={holeRadiusMultiplier}
              isRolling={isRolling}
              onBallRollComplete={() => setIsRolling(false)}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />

            {/* Optional Floating Simulator Test Bench (Collapses to zero screen clutter) */}
            <div className="absolute bottom-3 left-14 z-20">
              {isSimulatorOpen ? (
                <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl max-w-xl">
                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800 px-1">
                    <span className="text-[11px] font-bold text-slate-300">🧪 Virtual Shot Simulator</span>
                    <button
                      onClick={() => setIsSimulatorOpen(false)}
                      className="text-slate-400 hover:text-slate-100 text-xs px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-slate-800"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <ShotSimulatorStudio targetDistanceFt={targetDistanceFt} stimp={stimp} />
                </div>
              ) : (
                <button
                  onClick={() => setIsSimulatorOpen(true)}
                  className="py-1 px-3 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700/60 text-xs font-semibold shadow-lg backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer pointer-events-auto"
                  title="Toggle Virtual Shot Simulator Test Bench"
                >
                  <span>🧪 Test Bench</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Stage: High-Contrast Stand-Away Telemetry & Mode Cockpit */}
        <div className="sp-right-stage">
          {/* A. Glanceable Kiosk Telemetry HUD (Visible from 10ft away!) */}
          <div className="shrink-0">
            <KioskTelemetryOverlay
              currentShot={currentShot}
              activeMode={activeMode}
              targetDistanceFt={targetDistanceFt}
              isRolling={isRolling}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              streak={survivalStreak}
              bestStreak={bestStreak}
              holeMultiplier={holeRadiusMultiplier}
              bullseyeScore={bullseyeScore}
              highScore={highScore}
              scrambleHole={scrambleHole}
              totalHoles={totalScrambleHoles}
              strokesGainedTotal={strokesGainedTotal}
              gimmeRadiusFt={gimmeRadiusFt}
            />
          </div>

          {/* B. Secondary Deep Telemetry Panels */}
          {activeMode === 'analysis' && (
            <div className="flex-1 min-h-0 space-y-3">
              <ImpactVisualizer shot={currentShot} />
              <SkidAnalysisCard shot={currentShot} />
            </div>
          )}

          {activeMode === 'pressure-circle' && (
            <div className="flex-1 min-h-0 sp-card p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Pressure Circle Rules</span>
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Stay on your putting mat and keep stroking. With each consecutive make, the cup shrinks! Once you miss, the streak resets automatically.
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-slate-400">Distance:</span>
                {([3, 5, 8] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setTargetDistanceFt(d);
                      setSurvivalStreak(0);
                      setHoleRadiusMultiplier(1.0);
                    }}
                    className={`px-3 py-1 rounded-md font-bold text-xs ${
                      targetDistanceFt === d
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d} FT
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeMode === 'speed-control' && (
            <div className="flex-1 min-h-0 sp-card p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider">
                Speed Control Rules
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Points are awarded for finishing inside the 3-foot safe zone past the hole (+50 pts). Leaving putts short incurs an immediate penalty (-25 pts).
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-slate-400">Distance:</span>
                {([20, 30, 50] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setTargetDistanceFt(d);
                      setBullseyeScore(0);
                    }}
                    className={`px-3 py-1 rounded-md font-bold text-xs ${
                      targetDistanceFt === d
                        ? 'bg-sky-400 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d} FT
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeMode === 'scramble-gauntlet' && (
            <div className="flex-1 min-h-0 sp-card p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider">
                9-Hole Gauntlet Challenge
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Take one putt per hole. SquarePutt will automatically advance to the next randomized distance and slope after every shot!
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                Strokes Gained benchmarks against PGA Tour ShotLink putting distributions.
              </div>
            </div>
          )}

          {activeMode === 'analytics' && (
            <div className="flex-1 min-h-0 space-y-3">
              <DispersionHeatmap shots={shots} />
              <BagMappingChart shots={shots} />
              <SessionHistoryView
                shots={shots}
                onShotsUpdated={() => {
                  setShots(getStoredShots());
                  setProfile(getActiveProfile());
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hardware Connection Modal */}
      <OpenConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        connectionState={connectionState}
      />

      {/* Mode & Green Settings Modal */}
      <ModeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        activeMode={activeMode}
        stimp={stimp}
        onStimpChange={setStimp}
        slopeDifficulty={slopeDifficulty}
        onSlopeChange={setSlopeDifficulty}
        targetDistanceFt={targetDistanceFt}
        onDistanceChange={setTargetDistanceFt}
        onRandomizeTerrain={() => setTerrainSeed(Math.floor(Math.random() * 999999))}
        cameraMode={cameraMode}
        onCameraChange={setCameraMode}
        showGrid={showGrid}
        showHeatmap={showHeatmap}
        showBreakBeads={showBreakBeads}
        showAimLine={showAimLine}
        showStripes={showStripes}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
        onToggleBreakBeads={() => setShowBreakBeads(!showBreakBeads)}
        onToggleAimLine={() => setShowAimLine(!showAimLine)}
        onToggleStripes={() => setShowStripes(!showStripes)}
        onResetDrill={handleResetActiveDrill}
      />
    </div>
  );
}
