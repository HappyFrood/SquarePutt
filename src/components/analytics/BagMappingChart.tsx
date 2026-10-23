'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateBagMapping } from '@/lib/storage';
import { BarChart3, AlertCircle } from 'lucide-react';

interface BagMappingChartProps {
  shots: PuttingShotData[];
}

export const BagMappingChart: React.FC<BagMappingChartProps> = ({ shots }) => {
  const buckets = calculateBagMapping(shots);

  return (
    <div className="sp-card p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Putter Bag Mapping (Distance Interval Make %)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Consistency Profiler
        </span>
      </div>

      {/* Bar Chart Display */}
      <div className="space-y-2.5 my-2">
        {buckets.map((b) => {
          // Color based on make rate: 80%+ emerald, 50-80% sky, 25-50% amber, <25% red
          const barColor =
            b.makeRatePct >= 75
              ? 'bg-emerald-500'
              : b.makeRatePct >= 50
              ? 'bg-sky-400'
              : b.makeRatePct >= 25
              ? 'bg-amber-400'
              : 'bg-red-400';

          return (
            <div key={b.distanceLabel} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-slate-300 w-12">{b.distanceLabel}</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  {b.attempts > 0 ? (
                    <>
                      <span>
                        Miss: <strong className="text-slate-200">{b.avgMissDistanceInches}″</strong>
                      </span>
                      <span>
                        Face:{' '}
                        <strong
                          className={b.avgFaceAngleDeg > 0 ? 'text-amber-400' : 'text-sky-400'}
                        >
                          {b.avgFaceAngleDeg > 0 ? `+${b.avgFaceAngleDeg}°` : `${b.avgFaceAngleDeg}°`}
                        </strong>
                      </span>
                      <span className="text-slate-500">({b.makes}/{b.attempts})</span>
                      <span className="sp-mono font-black text-slate-100 w-11 text-right">
                        {b.makeRatePct}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">No attempts yet</span>
                  )}
                </div>
              </div>

              {/* Bar Fill */}
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
                <div
                  className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                  style={{ width: `${Math.max(b.attempts > 0 ? 3 : 0, b.makeRatePct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weakness Diagnosis Alert */}
      <div className="mt-3 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Weakness Analysis: </span>
          <span>
            {shots.length < 5
              ? 'Accumulate 10+ putts to highlight specific distance inflection points and speed falloffs.'
              : 'Consistent make % drop occurs beyond 8ft. Focus on 10ft & 15ft speed drills to flatten the curve!'}
          </span>
        </div>
      </div>
    </div>
  );
};
