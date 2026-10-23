'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { analyzeDynamicLoft, QUINTIC_TIERS } from '@/lib/calculations';
import { Compass, Zap } from 'lucide-react';

interface SkidAnalysisCardProps {
  shot: PuttingShotData | null;
}

export const SkidAnalysisCard: React.FC<SkidAnalysisCardProps> = ({ shot }) => {
  const timeToZeroSkidMs = shot?.timeToZeroSkidMs ?? 115;
  const skidDistInches = shot?.skidDistanceInches ?? 8.2;
  const trueRollFt = shot?.trueRollDistanceFt ?? 9.3;
  const rollFt = shot?.rollDistanceFt ?? 10.0;
  const skidPct = shot?.skidPercentage ?? 6.8;

  const dynamicLoft = shot?.dynamicLoftDeg ?? 2.4;
  const aoa = shot?.angleOfAttackDeg ?? 1.2;
  const vla = shot?.vla ?? 1.5;

  const loftAnalysis = analyzeDynamicLoft(dynamicLoft, aoa, vla);
  const loftTier = QUINTIC_TIERS[loftAnalysis.grade];

  return (
    <div className="sp-card p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Skid vs. True Roll & Dynamic Loft</span>
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold"
          style={{
            backgroundColor: loftTier.bgRgba,
            color: loftTier.color,
            border: `1px solid ${loftTier.borderHex}`,
          }}
        >
          {loftAnalysis.diagnosis}
        </span>
      </div>

      {/* Skid vs True Roll Visual Progress Bar */}
      <div className="my-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
            <span>Skid Phase:</span>
            <span className="sp-mono font-bold text-amber-300 ml-1">
              {skidDistInches.toFixed(1)} in ({timeToZeroSkidMs}ms)
            </span>
          </span>
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" />
            <span>True Roll:</span>
            <span className="sp-mono font-bold text-emerald-300 ml-1">
              {trueRollFt.toFixed(1)} ft ({rollFt > 0 ? (100 - skidPct).toFixed(0) : 93}%)
            </span>
          </span>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${Math.min(35, Math.max(5, skidPct))}%` }}
            title={`Skid Phase: ${skidPct}% of total distance`}
          />
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 flex-1"
            title={`True Roll Phase: ${(100 - skidPct).toFixed(1)}% of total distance`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
          <span>Impact (0ms)</span>
          <span className="text-amber-400 font-semibold">Zero Skid Point ({timeToZeroSkidMs}ms)</span>
          <span>Full Stop</span>
        </div>
      </div>

      {/* Dynamic Loft Optimization Diagnostic */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Launch Angle</div>
          <div className="sp-mono font-bold text-base text-emerald-400">
            {vla.toFixed(1)}°
          </div>
          <div className="text-[9px] text-slate-500">Target: 1.0° - 2.0°</div>
        </div>

        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Dynamic Loft</div>
          <div className="sp-mono font-bold text-base text-sky-400">
            {dynamicLoft.toFixed(1)}°
          </div>
          <div className="text-[9px] text-slate-500">Effective Loft</div>
        </div>

        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Angle of Attack</div>
          <div className="sp-mono font-bold text-base text-purple-400">
            {aoa > 0 ? `+${aoa.toFixed(1)}°` : `${aoa.toFixed(1)}°`}
          </div>
          <div className="text-[9px] text-slate-500">
            {aoa > 0 ? 'UPWARD (+)' : 'DOWNWARD (-)'}
          </div>
        </div>
      </div>

      {/* Biomechanical Recommendation */}
      <div className="mt-2.5 p-2 rounded-lg bg-slate-900/30 border border-slate-800 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
        <Compass className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-emerald-300">Pro Tip: </span>
          <span>{loftAnalysis.recommendation}</span>
        </div>
      </div>
    </div>
  );
};
