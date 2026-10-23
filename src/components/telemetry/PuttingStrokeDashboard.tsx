'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { MetricCard } from './MetricCard';
import { ImpactVisualizer } from './ImpactVisualizer';
import { SkidAnalysisCard } from './SkidAnalysisCard';
import { calculateMean, calculateStdDev, gradeFaceAngleVariance, QUINTIC_TIERS } from '@/lib/calculations';
import { Activity, Gauge, Navigation, Compass, Target, Clock } from 'lucide-react';

interface PuttingStrokeDashboardProps {
  currentShot: PuttingShotData | null;
  recentShots: PuttingShotData[];
}

export const PuttingStrokeDashboard: React.FC<PuttingStrokeDashboardProps> = ({
  currentShot,
  recentShots,
}) => {
  // Take last 10 putts for rolling averages
  const last10 = recentShots.slice(0, 10);
  const faceAngles = last10.map((s) => s.faceAngleDeg);
  const paths = last10.map((s) => s.putterPathDeg);
  const speeds = last10.map((s) => s.ballSpeedMph);

  const avgFace = calculateMean(faceAngles);
  const stdDevFace = calculateStdDev(faceAngles);
  const avgPath = calculateMean(paths);
  const avgSpeed = calculateMean(speeds);

  const varianceGrade = gradeFaceAngleVariance(stdDevFace);
  const varianceTier = QUINTIC_TIERS[varianceGrade];

  return (
    <div className="space-y-4">
      {/* Top Banner: Mode Title & Rolling Trend Overview */}
      <div className="sp-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Stroke Mechanics & Photometric Telemetry</span>
            </h2>
            <span className="sp-badge-green">FLAT GREEN MODE</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Live launch monitor telemetry with rolling consistency averages across your last 10 putts.
          </p>
        </div>

        {last10.length > 0 && (
          <div className="flex items-center gap-4 bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-800">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">10-Putt Face Variance</div>
              <div className="sp-mono font-bold text-sm text-slate-200">
                σ = {stdDevFace.toFixed(2)}°
              </div>
            </div>
            <div
              className="px-2.5 py-1 rounded-md text-xs font-bold border"
              style={{
                backgroundColor: varianceTier.bgRgba,
                color: varianceTier.color,
                borderColor: varianceTier.borderHex,
              }}
            >
              {varianceTier.label.split(' ')[0]} CONSISTENCY
            </div>
          </div>
        )}
      </div>

      {/* Primary Telemetry Grid: Ball & Club Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Ball Data */}
        <MetricCard
          label="Ball Speed"
          value={currentShot ? currentShot.ballSpeedMph.toFixed(1) : '--'}
          unit="MPH"
          idealRange="Match Stimp"
          grade={currentShot?.grades.speedConsistencyGrade ?? 'birdie'}
          icon={<Gauge className="w-3.5 h-3.5 text-emerald-400" />}
        />

        <MetricCard
          label="Launch Dir (HLA)"
          value={
            currentShot
              ? currentShot.hla > 0
                ? `+${currentShot.hla.toFixed(1)}°`
                : `${currentShot.hla.toFixed(1)}°`
              : '--'
          }
          unit="deg"
          idealRange="0.0° ± 0.6°"
          grade={currentShot?.grades.faceAngleGrade ?? 'birdie'}
          icon={<Navigation className="w-3.5 h-3.5 text-sky-400" />}
        />

        <MetricCard
          label="Roll Distance"
          value={currentShot ? currentShot.rollDistanceFt.toFixed(1) : '--'}
          unit="FT"
          idealRange={`Target ${currentShot?.targetDistanceFt ?? 10}ft`}
          grade={
            currentShot && Math.abs(currentShot.distanceErrorFt) < 1.0
              ? 'eagle'
              : currentShot && Math.abs(currentShot.distanceErrorFt) < 2.0
              ? 'birdie'
              : 'par'
          }
          icon={<Target className="w-3.5 h-3.5 text-amber-400" />}
        />

        <MetricCard
          label="Angle of Attack"
          value={
            currentShot
              ? currentShot.angleOfAttackDeg > 0
                ? `+${currentShot.angleOfAttackDeg.toFixed(1)}°`
                : `${currentShot.angleOfAttackDeg.toFixed(1)}°`
              : '--'
          }
          unit="deg"
          idealRange="+1.0° to +2.0°"
          grade={currentShot?.grades.launchGrade ?? 'birdie'}
          icon={<Compass className="w-3.5 h-3.5 text-purple-400" />}
        />
      </div>

      {/* Middle Split: Putter Face Impact Visualizer + Skid Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ImpactVisualizer shot={currentShot} />
        <SkidAnalysisCard shot={currentShot} />
      </div>

      {/* Bottom Section: Rolling Trend Table (Last 10 Putts) */}
      <div className="sp-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
              10-Putt Mechanical Biases & History
            </h3>
          </div>
          {last10.length > 0 && (
            <div className="text-xs text-slate-400 flex items-center gap-3 font-mono">
              <span>Avg Face: <strong className="text-slate-200">{avgFace > 0 ? `+${avgFace.toFixed(1)}°` : `${avgFace.toFixed(1)}°`}</strong></span>
              <span>Avg Path: <strong className="text-slate-200">{avgPath > 0 ? `+${avgPath.toFixed(1)}°` : `${avgPath.toFixed(1)}°`}</strong></span>
              <span>Avg Speed: <strong className="text-slate-200">{avgSpeed.toFixed(1)} mph</strong></span>
            </div>
          )}
        </div>

        {last10.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            No putts recorded in this session yet. Strike a putt with your Square Launch Monitor or use the Virtual Simulator below!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <th className="pb-2 pl-2">#</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Speed</th>
                  <th className="pb-2">Face</th>
                  <th className="pb-2">Path</th>
                  <th className="pb-2">Face/Path</th>
                  <th className="pb-2">Distance</th>
                  <th className="pb-2">Skid</th>
                  <th className="pb-2 pr-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {last10.map((shot, idx) => (
                  <tr key={shot.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 pl-2 text-slate-500">{last10.length - idx}</td>
                    <td className="py-2 text-slate-400">
                      {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2 font-bold text-slate-200">{shot.ballSpeedMph.toFixed(1)} mph</td>
                    <td
                      className="py-2 font-semibold"
                      style={{ color: QUINTIC_TIERS[shot.grades.faceAngleGrade].color }}
                    >
                      {shot.faceAngleDeg > 0 ? `+${shot.faceAngleDeg.toFixed(1)}°` : `${shot.faceAngleDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-sky-400">
                      {shot.putterPathDeg > 0 ? `+${shot.putterPathDeg.toFixed(1)}°` : `${shot.putterPathDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-amber-300">
                      {shot.faceToPathDeg > 0 ? `+${shot.faceToPathDeg.toFixed(1)}°` : `${shot.faceToPathDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-slate-300">{shot.rollDistanceFt.toFixed(1)} ft</td>
                    <td className="py-2 text-slate-400">{shot.skidDistanceInches.toFixed(1)} in</td>
                    <td className="py-2 pr-2 text-right">
                      {shot.isHoled ? (
                        <span className="text-emerald-400 font-bold">⛳ HOLED</span>
                      ) : (
                        <span className="text-slate-400">
                          {shot.distanceErrorFt > 0 ? `+${shot.distanceErrorFt.toFixed(1)}ft` : `${shot.distanceErrorFt.toFixed(1)}ft`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
