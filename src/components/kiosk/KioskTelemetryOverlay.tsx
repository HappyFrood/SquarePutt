'use client';

import React from 'react';
import { PuttingShotData, AppMode, QuinticGrade } from '@/lib/types';
import { QUINTIC_TIERS } from '@/lib/calculations';
import { Shield, Crosshair, Shuffle, ArrowUp, ArrowDown, Settings } from 'lucide-react';

interface KioskTelemetryOverlayProps {
  currentShot: PuttingShotData | null;
  activeMode: AppMode;
  targetDistanceFt: number;
  isRolling: boolean;
  onOpenSettings?: () => void;
  // Mode-specific drill props
  streak?: number;
  bestStreak?: number;
  holeMultiplier?: number;
  bullseyeScore?: number;
  highScore?: number;
  scrambleHole?: number;
  totalHoles?: number;
  strokesGainedTotal?: number;
  gimmeRadiusFt?: number;
}

export const KioskTelemetryOverlay: React.FC<KioskTelemetryOverlayProps> = ({
  currentShot,
  activeMode,
  targetDistanceFt,
  isRolling,
  onOpenSettings,
  streak = 0,
  bestStreak = 0,
  holeMultiplier = 1.0,
  bullseyeScore = 0,
  highScore = 0,
  scrambleHole = 1,
  totalHoles = 9,
  strokesGainedTotal = 0,
  gimmeRadiusFt = 2.0,
}) => {
  const faceAngle = currentShot?.faceAngleDeg ?? 0.0;
  const path = currentShot?.putterPathDeg ?? 0.0;
  const faceToPath = currentShot?.faceToPathDeg ?? 0.0;
  const ballSpeed = currentShot?.ballSpeedMph ?? 0.0;
  const rollDist = currentShot?.rollDistanceFt ?? 0.0;
  const distError = currentShot?.distanceErrorFt ?? 0.0;
  const isHoled = currentShot?.isHoled ?? false;

  const faceGrade: QuinticGrade = currentShot?.grades.faceAngleGrade ?? 'birdie';
  const faceTier = QUINTIC_TIERS[faceGrade];

  return (
    <div className="flex flex-col justify-between h-full space-y-3">
      {/* 1. Top Glanceable Status: Ready State or Ball in Motion */}
      <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-2.5 rounded-xl">
        <div className="flex items-center gap-2.5">
          {isRolling ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
              <span className="sp-mono font-bold text-xs uppercase tracking-widest text-sky-300">
                BALL IN MOTION...
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 sp-glow-pulse" />
              <span className="sp-mono font-bold text-xs uppercase tracking-widest text-emerald-400">
                READY TO PUTT
              </span>
            </div>
          )}
        </div>

        {onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-xs font-mono hover:text-emerald-400 p-1 rounded transition-colors cursor-pointer"
            title="Configure Target Distance & Drill Settings"
          >
            <span className="text-slate-400">TARGET:</span>
            <span className="font-black text-slate-100 text-sm">{targetDistanceFt.toFixed(1)} FT</span>
            <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">TARGET:</span>
            <span className="font-black text-slate-100 text-sm">{targetDistanceFt.toFixed(1)} FT</span>
          </div>
        )}
      </div>

      {/* 2. Mode-Specific Hero Spotlight (Glanceable from 10ft!) */}
      {activeMode === 'pressure-circle' && (
        <div className="sp-card p-4 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/30 text-center">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-1">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Shield className="w-4 h-4 text-amber-400" /> Survival Mode
            </span>
            <span>Best: {bestStreak}</span>
          </div>
          <div className="my-1">
            <span className="text-5xl font-black sp-mono text-amber-400 drop-shadow-md">
              {streak}
            </span>
            <div className="text-xs uppercase font-bold text-slate-300 tracking-wider">
              Consecutive Makes
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Cup Size: <strong className="text-sky-300">{(4.25 * holeMultiplier).toFixed(2)}″</strong></span>
            <span>Target: <strong className="text-emerald-300">{targetDistanceFt} FT</strong></span>
          </div>
        </div>
      )}

      {activeMode === 'speed-control' && (
        <div className="sp-card p-4 bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-950 border-sky-500/30 text-center">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold mb-1">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Crosshair className="w-4 h-4 text-sky-400" /> Bullseye Mode
            </span>
            <span>High: {highScore} pts</span>
          </div>
          <div className="my-1">
            <span className="text-5xl font-black sp-mono text-sky-300 drop-shadow-md">
              {bullseyeScore}
            </span>
            <div className="text-xs uppercase font-bold text-slate-300 tracking-wider">
              Score (+50 Safe / -25 Short)
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Safe Zone: <strong className="text-emerald-300">0 to +3.0 ft past</strong></span>
            <span>Target: <strong className="text-slate-200">{targetDistanceFt} FT</strong></span>
          </div>
        </div>
      )}

      {activeMode === 'scramble-gauntlet' && (
        <div className="sp-card p-4 bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-950 border-purple-500/30 text-center">
          <div className="flex items-center justify-between text-xs text-purple-300 font-semibold mb-1">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Shuffle className="w-4 h-4 text-purple-400" /> Gauntlet Challenge
            </span>
            <span>Hole {scrambleHole} / {totalHoles}</span>
          </div>
          <div className="my-1">
            <span
              className={`text-5xl font-black sp-mono drop-shadow-md ${
                strokesGainedTotal >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {strokesGainedTotal >= 0 ? `+${strokesGainedTotal.toFixed(2)}` : strokesGainedTotal.toFixed(2)}
            </span>
            <div className="text-xs uppercase font-bold text-slate-300 tracking-wider">
              Strokes Gained vs. PGA Tour
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Gimme Circle: <strong className="text-sky-300">±{gimmeRadiusFt.toFixed(1)} FT</strong></span>
            <span>Target: <strong className="text-slate-200">{targetDistanceFt.toFixed(1)} FT</strong></span>
          </div>
        </div>
      )}

      {/* 3. Massive Last-Putt Result Billboard */}
      <div className="sp-card p-4 text-center bg-slate-950/80 border-slate-800 relative overflow-hidden">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Last Shot Roll Result
        </div>

        {currentShot ? (
          <div>
            <div className="my-1">
              <span className="sp-mono text-5xl font-black text-slate-100 tracking-tight">
                {rollDist.toFixed(1)}
              </span>
              <span className="text-base font-bold text-slate-400 ml-1.5">FT</span>
            </div>

            {/* Glowing Result Pill */}
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
              {isHoled ? (
                <span className="bg-emerald-500 text-slate-950 px-3 py-0.5 rounded-full flex items-center gap-1">
                  ⛳ HOLED IN ONE!
                </span>
              ) : distError > 0 ? (
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-3 py-0.5 rounded-full flex items-center gap-1">
                  <ArrowUp className="w-3.5 h-3.5" /> +{distError.toFixed(1)} FT PAST
                </span>
              ) : (
                <span className="bg-red-500/20 text-red-300 border border-red-500/40 px-3 py-0.5 rounded-full flex items-center gap-1">
                  <ArrowDown className="w-3.5 h-3.5" /> {distError.toFixed(1)} FT SHORT
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-5 text-slate-500 text-xs font-mono">
            Step up and take your putt on the mat.
          </div>
        )}
      </div>

      {/* 4. Core Mechanical Biometrics (Large Numbers for 10ft visibility) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Face Angle at Impact */}
        <div
          className="sp-card p-3 text-center border-t-2"
          style={{ borderTopColor: faceTier.color }}
        >
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Face Angle</div>
          <div
            className="sp-mono text-3xl font-black my-0.5"
            style={{ color: faceTier.color }}
          >
            {currentShot
              ? faceAngle > 0
                ? `+${faceAngle.toFixed(1)}°`
                : `${faceAngle.toFixed(1)}°`
              : '--'}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: faceTier.color }}>
            {currentShot
              ? faceAngle > 0.3
                ? 'OPEN'
                : faceAngle < -0.3
                ? 'CLOSED'
                : 'SQUARE'
              : 'IDLE'}
          </div>
        </div>

        {/* Ball Speed */}
        <div className="sp-card p-3 text-center border-t-2 border-t-emerald-400">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Ball Speed</div>
          <div className="sp-mono text-3xl font-black text-slate-100 my-0.5">
            {currentShot ? ballSpeed.toFixed(1) : '--'}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            MPH
          </div>
        </div>

        {/* Putter Path */}
        <div className="sp-card p-3 text-center border-t-2 border-t-sky-400">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Club Path</div>
          <div className="sp-mono text-2xl font-black text-sky-300 my-0.5">
            {currentShot
              ? path > 0
                ? `+${path.toFixed(1)}°`
                : `${path.toFixed(1)}°`
              : '--'}
          </div>
          <div className="text-[10px] text-slate-400 uppercase">
            {path > 0.3 ? 'IN-TO-OUT' : path < -0.3 ? 'OUT-TO-IN' : 'NEUTRAL'}
          </div>
        </div>

        {/* Face to Path */}
        <div className="sp-card p-3 text-center border-t-2 border-t-amber-400">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Face / Path</div>
          <div className="sp-mono text-2xl font-black text-amber-300 my-0.5">
            {currentShot
              ? faceToPath > 0
                ? `+${faceToPath.toFixed(1)}°`
                : `${faceToPath.toFixed(1)}°`
              : '--'}
          </div>
          <div className="text-[10px] text-slate-400 uppercase">DELTA</div>
        </div>
      </div>
    </div>
  );
};
