'use client';

import React, { useState } from 'react';
import { openConnectService } from '@/lib/openConnectService';
import { Play, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface ShotSimulatorStudioProps {
  targetDistanceFt: number;
  stimp: number;
}

export const ShotSimulatorStudio: React.FC<ShotSimulatorStudioProps> = ({
  targetDistanceFt,
  stimp,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Manual Tuning Sliders State
  const defaultSpeed = Number(Math.sqrt(targetDistanceFt * (11.0 / stimp) * 2.4).toFixed(1));
  const [speedMph, setSpeedMph] = useState(defaultSpeed);
  const [faceAngleDeg, setFaceAngleDeg] = useState(0.0);
  const [pathDeg, setPathDeg] = useState(0.0);
  const [aoaDeg, setAoaDeg] = useState(1.2);
  const [dynamicLoftDeg, setDynamicLoftDeg] = useState(2.4);

  // Quick Presets
  const triggerPreset = ({
    speedFactor = 1.0,
    face = 0.0,
    path = 0.0,
    aoa = 1.2,
    loft = 2.4,
  }: {
    speedFactor?: number;
    face?: number;
    path?: number;
    aoa?: number;
    loft?: number;
  }) => {
    const calculatedSpeed = Number((defaultSpeed * speedFactor).toFixed(1));
    setSpeedMph(calculatedSpeed);
    setFaceAngleDeg(face);
    setPathDeg(path);
    setAoaDeg(aoa);
    setDynamicLoftDeg(loft);

    openConnectService.triggerSimulatedShot({
      ballSpeedMph: calculatedSpeed,
      hlaDeg: face * 1.15,
      faceAngleDeg: face,
      pathDeg: path,
      angleOfAttackDeg: aoa,
      dynamicLoftDeg: loft,
      vlaDeg: Math.max(0.5, loft + 0.3 * aoa),
    });
  };

  const handleManualStrike = () => {
    openConnectService.triggerSimulatedShot({
      ballSpeedMph: speedMph,
      hlaDeg: faceAngleDeg * 1.15,
      faceAngleDeg: faceAngleDeg,
      pathDeg: pathDeg,
      angleOfAttackDeg: aoaDeg,
      dynamicLoftDeg: dynamicLoftDeg,
      vlaDeg: Math.max(0.5, dynamicLoftDeg + 0.3 * aoaDeg),
    });
  };

  return (
    <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl overflow-hidden shadow-2xl">
      {/* Sleek Compact Header / Quick Presets Line */}
      <div className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-slate-300 hover:text-emerald-400 font-bold text-[11px] uppercase tracking-wider transition-colors mr-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Bench</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Quick 1-Click Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => triggerPreset({ speedFactor: 1.0, face: 0.0, path: 0.0 })}
              className="sp-btn-primary text-[11px] py-0.5 px-2.5 rounded shadow-sm"
              title="Straight, perfect speed, holed putt"
            >
              🎯 Pure Holed
            </button>

            <button
              onClick={() => triggerPreset({ speedFactor: 1.07, face: 0.2, path: 0.0 })}
              className="sp-btn-secondary text-[11px] py-0.5 px-2 rounded text-emerald-300 border-emerald-500/40"
              title="Stops 1.5ft past hole inside safe zone"
            >
              ⛳ Bullseye Safe (+1.5ft)
            </button>

            <button
              onClick={() => triggerPreset({ speedFactor: 1.02, face: 1.5, path: -0.5 })}
              className="sp-btn-secondary text-[11px] py-0.5 px-2 rounded text-amber-300"
              title="Pushed right (+1.5° face)"
            >
              ↗️ Push (+1.5°)
            </button>

            <button
              onClick={() => triggerPreset({ speedFactor: 1.01, face: -1.6, path: 0.7 })}
              className="sp-btn-secondary text-[11px] py-0.5 px-2 rounded text-purple-300"
              title="Pulled left (-1.6° face)"
            >
              ↖️ Pull (-1.6°)
            </button>

            <button
              onClick={() => triggerPreset({ speedFactor: 0.8, face: -0.2, path: 0.0 })}
              className="sp-btn-secondary text-[11px] py-0.5 px-2 rounded text-red-300"
              title="Decelerated short (-2.5ft)"
            >
              📉 Decel Short
            </button>

            <button
              onClick={() => triggerPreset({ speedFactor: 1.25, face: 0.4, path: 0.0 })}
              className="sp-btn-secondary text-[11px] py-0.5 px-2 rounded text-amber-400"
              title="Blown past (+4.5ft)"
            >
              💥 Blown Past
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] text-slate-400 hover:text-slate-200 font-mono"
        >
          {isOpen ? 'Hide Custom Sliders' : 'Custom Tuning ▼'}
        </button>
      </div>

      {/* Expanded Manual Tuning Panel */}
      {isOpen && (
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {/* Speed */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Speed:</span>
              <strong className="sp-mono text-emerald-400">{speedMph.toFixed(1)} mph</strong>
            </div>
            <input
              type="range"
              min="1.0"
              max="16.0"
              step="0.1"
              value={speedMph}
              onChange={(e) => setSpeedMph(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Face Angle */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Face:</span>
              <strong className="sp-mono text-sky-400">
                {faceAngleDeg > 0 ? `+${faceAngleDeg.toFixed(1)}°` : `${faceAngleDeg.toFixed(1)}°`}
              </strong>
            </div>
            <input
              type="range"
              min="-4.0"
              max="4.0"
              step="0.1"
              value={faceAngleDeg}
              onChange={(e) => setFaceAngleDeg(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Putter Path */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Path:</span>
              <strong className="sp-mono text-purple-400">
                {pathDeg > 0 ? `+${pathDeg.toFixed(1)}°` : `${pathDeg.toFixed(1)}°`}
              </strong>
            </div>
            <input
              type="range"
              min="-4.0"
              max="4.0"
              step="0.1"
              value={pathDeg}
              onChange={(e) => setPathDeg(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Angle of Attack */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>AoA:</span>
              <strong className="sp-mono text-amber-400">
                {aoaDeg > 0 ? `+${aoaDeg.toFixed(1)}°` : `${aoaDeg.toFixed(1)}°`}
              </strong>
            </div>
            <input
              type="range"
              min="-4.0"
              max="4.0"
              step="0.1"
              value={aoaDeg}
              onChange={(e) => setAoaDeg(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Strike Button */}
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button
              onClick={handleManualStrike}
              className="sp-btn-primary w-full py-1.5 text-xs flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Strike</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
