'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { QUINTIC_TIERS } from '@/lib/calculations';

interface ImpactVisualizerProps {
  shot: PuttingShotData | null;
}

export const ImpactVisualizer: React.FC<ImpactVisualizerProps> = ({ shot }) => {
  const faceAngle = shot?.faceAngleDeg ?? 0.0;
  const pathAngle = shot?.putterPathDeg ?? 0.0;
  const hla = shot?.hla ?? 0.0;
  const faceToPath = shot?.faceToPathDeg ?? 0.0;

  // Visual scaling: amplify slight angles for clear visual comprehension on SVG
  const visualFaceAngle = faceAngle * 4.5;
  const visualPathAngle = pathAngle * 4.5;
  const visualHlaAngle = hla * 4.5;

  const faceGrade = shot?.grades.faceAngleGrade ?? 'birdie';
  const faceColor = QUINTIC_TIERS[faceGrade].color;

  return (
    <div className="sp-card p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
          Impact Dynamics & Face Delivery
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold"
          style={{
            backgroundColor: QUINTIC_TIERS[faceGrade].bgRgba,
            color: faceColor,
            border: `1px solid ${QUINTIC_TIERS[faceGrade].borderHex}`,
          }}
        >
          Face-to-Path: {faceToPath > 0 ? `+${faceToPath.toFixed(1)}°` : `${faceToPath.toFixed(1)}°`}
        </span>
      </div>

      {/* SVG Canvas for Impact */}
      <div className="relative w-full aspect-[16/10] bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center p-2">
        <svg
          viewBox="-100 -80 200 160"
          className="w-full h-full max-h-[190px]"
          style={{ overflow: 'visible' }}
        >
          {/* Target Line (Centered Vertical Axis) */}
          <line
            x1="0"
            y1="-75"
            x2="0"
            y2="75"
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Aim Target / Hole Direction Arrow */}
          <polygon points="0,-75 -4,-65 4,-65" fill="#64748b" />
          <text x="7" y="-66" fill="#64748b" fontSize="8" fontFamily="monospace">
            TARGET
          </text>

          {/* Club Path Arrow (Cyan) */}
          <g transform={`rotate(${visualPathAngle}, 0, 15)`}>
            <line
              x1="0"
              y1="55"
              x2="0"
              y2="-30"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="none"
              opacity="0.85"
            />
            <polygon points="0,-35 -4,-25 4,-25" fill="#38bdf8" />
            <text x="6" y="-20" fill="#38bdf8" fontSize="7" fontFamily="monospace">
              PATH {pathAngle > 0 ? `+${pathAngle.toFixed(1)}°` : `${pathAngle.toFixed(1)}°`}
            </text>
          </g>

          {/* Ball Launch Trajectory Vector (Emerald / Yellow) */}
          <g transform={`rotate(${visualHlaAngle}, 0, 0)`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-55"
              stroke="#34d399"
              strokeWidth="2"
              opacity="0.9"
            />
            <polygon points="0,-60 -3.5,-52 3.5,-52" fill="#34d399" />
            <text x="6" y="-48" fill="#34d399" fontSize="7" fontFamily="monospace">
              LAUNCH {hla > 0 ? `+${hla.toFixed(1)}°` : `${hla.toFixed(1)}°`}
            </text>
          </g>

          {/* Golf Ball at Impact (Center Origin) */}
          <circle cx="0" cy="0" r="8" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="-2" cy="-2" r="1.5" fill="#cbd5e1" opacity="0.6" />
          <circle cx="2" cy="1" r="1.2" fill="#cbd5e1" opacity="0.6" />

          {/* Putter Face Bar (Rotates based on Face Angle) */}
          <g transform={`rotate(${visualFaceAngle}, 0, 12)`}>
            {/* Putter Head Block */}
            <rect
              x="-46"
              y="10"
              width="92"
              height="14"
              rx="3"
              fill="#1e293b"
              stroke={faceColor}
              strokeWidth="2"
            />
            {/* Alignment Mark on Putter */}
            <line x1="0" y1="10" x2="0" y2="24" stroke="#ffffff" strokeWidth="2" />
            {/* Face Scorelines */}
            <line x1="-30" y1="10" x2="30" y2="10" stroke={faceColor} strokeWidth="3" />
            <line x1="-25" y1="14" x2="25" y2="14" stroke="#475569" strokeWidth="1" />
            <line x1="-25" y1="18" x2="25" y2="18" stroke="#475569" strokeWidth="1" />
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-1.5 left-2 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-sky-400 inline-block" />
            <span>Path</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-emerald-400 inline-block" />
            <span>Launch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm bg-slate-700 border border-emerald-400 inline-block" />
            <span>Face</span>
          </div>
        </div>
      </div>

      {/* Metrics Row Below Visualizer */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Face Angle</div>
          <div
            className="sp-mono font-bold text-sm"
            style={{ color: faceColor }}
          >
            {faceAngle > 0 ? `+${faceAngle.toFixed(1)}°` : `${faceAngle.toFixed(1)}°`}
          </div>
          <div className="text-[9px] text-slate-500">
            {faceAngle > 0.3 ? 'OPEN' : faceAngle < -0.3 ? 'CLOSED' : 'SQUARE'}
          </div>
        </div>

        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Putter Path</div>
          <div className="sp-mono font-bold text-sm text-sky-400">
            {pathAngle > 0 ? `+${pathAngle.toFixed(1)}°` : `${pathAngle.toFixed(1)}°`}
          </div>
          <div className="text-[9px] text-slate-500">
            {pathAngle > 0.4 ? 'IN-TO-OUT' : pathAngle < -0.4 ? 'OUT-TO-IN' : 'NEUTRAL'}
          </div>
        </div>

        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Launch Dir</div>
          <div className="sp-mono font-bold text-sm text-emerald-400">
            {hla > 0 ? `+${hla.toFixed(1)}°` : `${hla.toFixed(1)}°`}
          </div>
          <div className="text-[9px] text-slate-500">
            {hla > 0.3 ? 'PUSH' : hla < -0.3 ? 'PULL' : 'ONLINE'}
          </div>
        </div>

        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Face / Path</div>
          <div className="sp-mono font-bold text-sm text-amber-300">
            {faceToPath > 0 ? `+${faceToPath.toFixed(1)}°` : `${faceToPath.toFixed(1)}°`}
          </div>
          <div className="text-[9px] text-slate-500">DELTA</div>
        </div>
      </div>
    </div>
  );
};
