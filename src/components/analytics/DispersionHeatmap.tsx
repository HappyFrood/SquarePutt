'use client';

import React, { useState } from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateMean, calculateStdDev } from '@/lib/calculations';
import { Crosshair } from 'lucide-react';

interface DispersionHeatmapProps {
  shots: PuttingShotData[];
}

export const DispersionHeatmap: React.FC<DispersionHeatmapProps> = ({ shots }) => {
  const [hoveredShot, setHoveredShot] = useState<PuttingShotData | null>(null);

  // Maximum view radius in feet (e.g. 5 feet around cup)
  const viewRadiusFt = 5.0;
  const svgRadius = 140; // SVG coordinate units

  // Filter shots
  const filtered = shots; // All shots in history

  // Calculate centroid and dispersion
  const xInches = filtered.map((s) => s.lateralErrorInches);
  const zInches = filtered.map((s) => s.distanceErrorFt * 12);

  const meanXInches = calculateMean(xInches);
  const meanZInches = calculateMean(zInches);
  const stdXInches = calculateStdDev(xInches);
  const stdZInches = calculateStdDev(zInches);

  // Convert (lateralInches, distanceErrorFt) to SVG (cx, cy)
  const toSvgCoords = (latInches: number, distErrorFt: number) => {
    // 1 foot = svgRadius / viewRadiusFt
    const scale = svgRadius / viewRadiusFt;
    const cx = (latInches / 12) * scale;
    // +distanceError is past hole (upward in SVG = -Y)
    const cy = -distErrorFt * scale;
    return { cx, cy };
  };

  const centroid = toSvgCoords(meanXInches, meanZInches / 12);

  return (
    <div className="sp-card p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Dispersion Scatter Heatmap (Relative to Cup)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {filtered.length} Shots Plotted
        </span>
      </div>

      {/* 2D Concentric Target Plot */}
      <div className="relative w-full aspect-square max-h-[380px] bg-slate-950/70 rounded-2xl border border-slate-800 flex items-center justify-center p-2 overflow-hidden">
        <svg
          viewBox="-160 -160 320 320"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {/* Concentric Distance Rings (1ft, 2ft, 3ft, 4ft, 5ft) */}
          {[1, 2, 3, 4, 5].map((ft) => {
            const r = (ft / viewRadiusFt) * svgRadius;
            return (
              <g key={ft}>
                <circle
                  cx="0"
                  cy="0"
                  r={r}
                  fill={ft === 3 ? 'rgba(56, 189, 248, 0.04)' : 'none'}
                  stroke={ft === 3 ? '#0284c7' : '#334155'}
                  strokeWidth={ft === 3 ? '1.5' : '1'}
                  strokeDasharray={ft === 3 ? 'none' : '3 3'}
                  opacity={ft === 3 ? 0.7 : 0.4}
                />
                <text
                  x="4"
                  y={-r + 10}
                  fill="#64748b"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {ft} FT
                </text>
              </g>
            );
          })}

          {/* Crosshair Axes */}
          <line x1="-155" y1="0" x2="155" y2="0" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="0" y1="-155" x2="0" y2="155" stroke="#1e293b" strokeWidth="1.5" />

          {/* Directional Labels */}
          <text x="0" y="-146" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
            ▲ LONG / PAST CUP
          </text>
          <text x="0" y="152" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
            ▼ SHORT
          </text>
          <text x="-148" y="3" textAnchor="start" fill="#64748b" fontSize="8" fontFamily="monospace">
            ◄ LEFT
          </text>
          <text x="148" y="3" textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">
            RIGHT ►
          </text>

          {/* 3ft Bullseye Safe Zone Behind Cup (Light cyan tint) */}
          <path
            d={`M -${(3 / viewRadiusFt) * svgRadius} 0 A ${(3 / viewRadiusFt) * svgRadius} ${(3 / viewRadiusFt) * svgRadius} 0 0 1 ${(3 / viewRadiusFt) * svgRadius} 0 Z`}
            fill="rgba(16, 185, 129, 0.08)"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="4 2"
          />

          {/* The Cup (Center Target) */}
          <circle cx="0" cy="0" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.5" fill="#042f1f" />

          {/* Standard Deviation Ellipse */}
          {filtered.length >= 3 && (
            <ellipse
              cx={centroid.cx}
              cy={centroid.cy}
              rx={Math.max(8, (stdXInches / 12 / viewRadiusFt) * svgRadius)}
              ry={Math.max(8, (stdZInches / 12 / viewRadiusFt) * svgRadius)}
              fill="rgba(56, 189, 248, 0.12)"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Shot Points */}
          {filtered.map((shot) => {
            const { cx, cy } = toSvgCoords(shot.lateralErrorInches, shot.distanceErrorFt);
            const isHoled = shot.isHoled;

            return (
              <g
                key={shot.id}
                onMouseEnter={() => setHoveredShot(shot)}
                onMouseLeave={() => setHoveredShot(null)}
                className="cursor-pointer transition-transform hover:scale-150"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHoled ? 4.5 : 3.5}
                  fill={isHoled ? '#10b981' : shot.distanceErrorFt < 0 ? '#f87171' : '#38bdf8'}
                  stroke="#ffffff"
                  strokeWidth="1"
                  opacity={0.85}
                />
              </g>
            );
          })}

          {/* Centroid / Bias Cross (Gold) */}
          {filtered.length > 0 && (
            <g transform={`translate(${centroid.cx}, ${centroid.cy})`}>
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#fbbf24" strokeWidth="2" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="0" cy="0" r="3" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredShot && (
          <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg text-xs font-mono shadow-2xl pointer-events-none">
            <div className="font-bold text-slate-200">
              {hoveredShot.isHoled ? '⛳ Holed Putt' : 'Missed'}
            </div>
            <div className="text-slate-400 mt-1">
              Lateral: <span className="text-sky-400">{hoveredShot.lateralErrorInches > 0 ? `+${hoveredShot.lateralErrorInches}″` : `${hoveredShot.lateralErrorInches}″`}</span>
            </div>
            <div className="text-slate-400">
              Distance: <span className="text-emerald-400">{hoveredShot.distanceErrorFt > 0 ? `+${hoveredShot.distanceErrorFt}ft` : `${hoveredShot.distanceErrorFt}ft`}</span>
            </div>
            <div className="text-slate-400">
              Face Angle: <span className="text-amber-400">{hoveredShot.faceAngleDeg > 0 ? `+${hoveredShot.faceAngleDeg}°` : `${hoveredShot.faceAngleDeg}°`}</span>
            </div>
          </div>
        )}
      </div>

      {/* Statistical Summary */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Lateral Bias</div>
          <div className="sp-mono font-bold text-sm text-sky-400">
            {meanXInches > 0 ? `+${meanXInches.toFixed(1)}″ R` : `${Math.abs(meanXInches).toFixed(1)}″ L`}
          </div>
          <div className="text-[9px] text-slate-500">σ = ±{stdXInches.toFixed(1)}″</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Distance Bias</div>
          <div className="sp-mono font-bold text-sm text-emerald-400">
            {(meanZInches / 12) > 0 ? `+${(meanZInches / 12).toFixed(1)}ft Past` : `${Math.abs(meanZInches / 12).toFixed(1)}ft Short`}
          </div>
          <div className="text-[9px] text-slate-500">σ = ±{(stdZInches / 12).toFixed(1)}ft</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Make %</div>
          <div className="sp-mono font-bold text-sm text-amber-300">
            {filtered.length > 0 ? `${Math.round((filtered.filter((s) => s.isHoled).length / filtered.length) * 100)}%` : '0%'}
          </div>
          <div className="text-[9px] text-slate-500">{filtered.filter((s) => s.isHoled).length} holed</div>
        </div>
      </div>
    </div>
  );
};
