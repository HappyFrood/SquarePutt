'use client';

import React, { useState, useEffect } from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateStdDev, gradeSpeedVariance, QUINTIC_TIERS } from '@/lib/calculations';
import { updateDrillBests, getDrillBests } from '@/lib/storage';
import { Gauge, Target, Crosshair, Award, ArrowUp, ArrowDown } from 'lucide-react';

interface SpeedControlZoneDrillProps {
  currentShot: PuttingShotData | null;
  onSetDistance: (dist: 20 | 30 | 50) => void;
}

export const SpeedControlZoneDrill: React.FC<SpeedControlZoneDrillProps> = ({
  currentShot,
  onSetDistance,
}) => {
  const [distance, setDistance] = useState<20 | 30 | 50>(30);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return getDrillBests().speedControl.highScore;
  });
  const [attempts, setAttempts] = useState(0);
  const [safeZoneHits, setSafeZoneHits] = useState(0);
  const [shortCount, setShortCount] = useState(0);
  const [longCount, setLongCount] = useState(0);
  const [speeds, setSpeeds] = useState<number[]>([]);
  const [distanceErrors, setDistanceErrors] = useState<number[]>([]);
  const [, setLastShotId] = useState<string | null>(null);

  useEffect(() => {
    onSetDistance(distance);
  }, [distance, onSetDistance]);

  // Evaluate shot
  useEffect(() => {
    if (!currentShot) return;
    const timer = setTimeout(() => {
      setLastShotId((prevId) => {
        if (prevId === currentShot.id) return prevId;

        setAttempts((prev) => prev + 1);
        setSpeeds((prev) => [...prev, currentShot.ballSpeedMph]);
        setDistanceErrors((prev) => [...prev, currentShot.distanceErrorFt]);

        const errorFt = currentShot.distanceErrorFt;
        let deltaScore = 0;

        if (currentShot.isHoled) {
          deltaScore = 100;
          setSafeZoneHits((prev) => prev + 1);
        } else if (errorFt >= 0 && errorFt <= 3.0) {
          // Stopped in 3ft safe zone past the hole!
          deltaScore = 50;
          setSafeZoneHits((prev) => prev + 1);
        } else if (errorFt > 3.0 && errorFt <= 5.0) {
          deltaScore = 15;
          setLongCount((prev) => prev + 1);
        } else if (errorFt < 0) {
          // Left short: penalty deduction!
          deltaScore = -25;
          setShortCount((prev) => prev + 1);
        } else {
          // Blown way past
          deltaScore = -15;
          setLongCount((prev) => prev + 1);
        }

        setScore((prevScore) => {
          const newScore = Math.max(0, prevScore + deltaScore);
          setHighScore((prevHigh) => {
            if (newScore > prevHigh) {
              updateDrillBests({
                speedControl: {
                  highScore: newScore,
                  lowestSpeedStdDev: calculateStdDev([...speeds, currentShot.ballSpeedMph]),
                  lastUpdated: Date.now(),
                },
              });
              return newScore;
            }
            return prevHigh;
          });
          return newScore;
        });

        return currentShot.id;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [currentShot, speeds]);

  const speedGrade = gradeSpeedVariance(speeds);
  const speedTier = QUINTIC_TIERS[speedGrade];
  const distDispersionStdDev = calculateStdDev(distanceErrors);

  return (
    <div className="space-y-4">
      {/* Header & Distance Buttons */}
      <div className="sp-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">
              Speed Control Zone (Bullseye Mode)
            </h2>
            <span className="sp-badge-green">LAG PUTTS</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Stop every lag putt within the 3-foot safe zone past the cup. Never leave it short — points deducted for timid roll!
          </p>
        </div>

        {/* Distance Selector (20ft, 30ft, 50ft) */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 px-2 font-medium">Distance:</span>
          {([20, 30, 50] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setDistance(d);
                setScore(0);
                setAttempts(0);
                setSpeeds([]);
                setDistanceErrors([]);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                distance === d
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d} FT
            </button>
          ))}
        </div>
      </div>

      {/* Lag Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Score & Safe Zone Hits */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Bullseye Score</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-4xl font-black text-emerald-400">
              {score}
            </span>
            <span className="text-xs text-slate-400 ml-1">pts</span>
          </div>
          <div className="text-[10px] text-slate-500">
            High Score: <strong className="text-slate-300">{highScore}</strong>
          </div>
        </div>

        {/* Safe Zone Capture Rate */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Safe Zone Rate</span>
            <Crosshair className="w-4 h-4 text-sky-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-sky-400">
              {attempts > 0 ? `${Math.round((safeZoneHits / attempts) * 100)}%` : '0%'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {safeZoneHits} / {attempts} within 3ft past
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            Target: 0 to +3.0 ft past hole
          </div>
        </div>

        {/* Speed Consistency Grade */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Speed Consistency</span>
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <span
              className="sp-mono text-3xl font-black"
              style={{ color: speedTier.color }}
            >
              {speedTier.label.split(' ')[0]}
            </span>
            <div className="text-[10px] font-semibold mt-0.5" style={{ color: speedTier.color }}>
              {speedTier.description}
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            Quintic Tour Standard
          </div>
        </div>

        {/* Distance Dispersion σ */}
        <div className="sp-card p-4 text-center flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Distance Variance (σ)</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="sp-mono text-3xl font-black text-amber-300">
              ±{distDispersionStdDev.toFixed(1)} ft
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Front-to-back spread
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            Short: {shortCount} | Long: {longCount}
          </div>
        </div>
      </div>

      {/* Visual Safe Zone Gauge Breakdown */}
      <div className="sp-card p-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">
          Putt Length Distribution vs. Safe Zone
        </h4>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-red-400 flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" /> Short ({shortCount}) -25 pts
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              ⛳ Safe Zone [0 to +3ft] ({safeZoneHits}) +50 pts
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" /> Long ({longCount})
            </span>
          </div>

          <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
            <div
              className="bg-red-500/80 transition-all duration-300"
              style={{ width: `${attempts > 0 ? (shortCount / attempts) * 100 : 0}%` }}
              title="Short putts"
            />
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${attempts > 0 ? (safeZoneHits / attempts) * 100 : 0}%` }}
              title="Safe Zone makes"
            />
            <div
              className="bg-amber-500/80 transition-all duration-300 flex-1"
              title="Long putts"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
