'use client';

import React, { useState, useEffect } from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateStdDev, gradeFaceAngleVariance, QUINTIC_TIERS } from '@/lib/calculations';
import { updateDrillBests, getDrillBests } from '@/lib/storage';
import { audioEngine } from '@/components/ui/AudioEngine';
import confetti from 'canvas-confetti';
import { Shield, Flame, RotateCcw, Target, Trophy, Award } from 'lucide-react';

interface PressureCircleDrillProps {
  currentShot: PuttingShotData | null;
  onSetDistance: (dist: 3 | 5 | 8) => void;
  onSetHoleMultiplier: (mult: number) => void;
}

export const PressureCircleDrill: React.FC<PressureCircleDrillProps> = ({
  currentShot,
  onSetDistance,
  onSetHoleMultiplier,
}) => {
  const [distance, setDistance] = useState<3 | 5 | 8>(5);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return getDrillBests().pressureCircle.bestStreak;
  });
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalMakes, setTotalMakes] = useState(0);
  const [faceAngles, setFaceAngles] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [, setLastShotId] = useState<string | null>(null);

  // Update distance in parent green context
  useEffect(() => {
    onSetDistance(distance);
  }, [distance, onSetDistance]);

  // Dynamic hole shrinking calculation:
  // Starts at 1.0 (standard 4.25"), shrinks down to 0.55 as streak increases!
  const holeMultiplier = Math.max(0.55, 1.0 - streak * 0.05);

  useEffect(() => {
    onSetHoleMultiplier(holeMultiplier);
  }, [holeMultiplier, onSetHoleMultiplier]);

  // Handle new incoming shot
  useEffect(() => {
    if (!currentShot) return;
    const timer = setTimeout(() => {
      setLastShotId((prevId) => {
        if (prevId === currentShot.id) return prevId;

        setTotalAttempts((prev) => prev + 1);
        setFaceAngles((prev) => [...prev, currentShot.faceAngleDeg]);

        if (currentShot.isHoled) {
          setStreak((prevStreak) => {
            const nextStreak = prevStreak + 1;
            setBestStreak((prevBest) => {
              if (nextStreak > prevBest) {
                updateDrillBests({
                  pressureCircle: {
                    bestStreak: nextStreak,
                    lowestFaceStdDev: calculateStdDev([...faceAngles, currentShot.faceAngleDeg]),
                    lastUpdated: Date.now(),
                  },
                });
                return nextStreak;
              }
              return prevBest;
            });
            if (nextStreak % 5 === 0) {
              try {
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
              } catch {}
            }
            return nextStreak;
          });
          setTotalMakes((prev) => prev + 1);
          audioEngine.playCelebrationChime();
        } else {
          setGameOver(true);
        }
        return currentShot.id;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [currentShot, faceAngles]);

  const resetDrill = () => {
    setStreak(0);
    setGameOver(false);
  };

  const stdDevFace = calculateStdDev(faceAngles);
  const faceGrade = gradeFaceAngleVariance(stdDevFace);
  const varianceTier = QUINTIC_TIERS[faceGrade];
  const makePct = totalAttempts > 0 ? ((totalMakes / totalAttempts) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-4">
      {/* Header & Mode Selector */}
      <div className="sp-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">
              The Pressure Circle (Survival Mode)
            </h2>
            <span className="sp-badge-green">SHORT PUTTS</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Make consecutive putts under pressure. With every make, the simulated cup shrinks and tests pure face control!
          </p>
        </div>

        {/* Distance Selector (3ft, 5ft, 8ft) */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 px-2 font-medium">Distance:</span>
          {([3, 5, 8] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setDistance(d);
                resetDrill();
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                distance === d
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d} FT
            </button>
          ))}
        </div>
      </div>

      {/* Gamification Dashboard: Streak, Cup Size, Variance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Streak Counter */}
        <div className="sp-card p-4 text-center flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Current Streak</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-4xl font-black text-amber-400">
              {streak}
            </span>
            <span className="text-xs text-slate-400 ml-1">in a row</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <Trophy className="w-3 h-3 text-emerald-400" />
            <span>Best: <strong className="text-slate-300">{bestStreak}</strong></span>
          </div>
        </div>

        {/* Simulated Hole Diameter (Shrinks with Streak) */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Simulated Cup</span>
            <Target className="w-4 h-4 text-sky-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-sky-400">
              {(4.25 * holeMultiplier).toFixed(2)}″
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Standard: 4.25″ ({Math.round(holeMultiplier * 100)}% size)
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-400 h-full transition-all duration-300"
              style={{ width: `${holeMultiplier * 100}%` }}
            />
          </div>
        </div>

        {/* Face Angle Variance (Standard Deviation) */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Face Variance (σ)</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <span
              className="sp-mono text-3xl font-black"
              style={{ color: varianceTier.color }}
            >
              ±{stdDevFace.toFixed(2)}°
            </span>
            <div className="text-[10px] font-semibold mt-0.5" style={{ color: varianceTier.color }}>
              {varianceTier.label}
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            Tour Target: &lt; 0.50°
          </div>
        </div>

        {/* Make Rate */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Make %</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-emerald-400">
              {makePct}%
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {totalMakes} / {totalAttempts} makes
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            PGA Tour 5ft: ~77%
          </div>
        </div>
      </div>

      {/* Game Over Banner */}
      {gameOver && (
        <div className="sp-card p-5 bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-500/40 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
              <span>Survival Run Ended!</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              You sank <strong className="text-amber-400">{streak}</strong> consecutive putts from {distance}ft. Ready to beat your personal best?
            </p>
          </div>
          <button onClick={resetDrill} className="sp-btn-primary">
            <RotateCcw className="w-4 h-4 mr-1" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
};
