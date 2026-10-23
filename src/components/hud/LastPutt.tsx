'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { analyzeDynamicLoft, calculateStdDev, gradeFaceAngleVariance } from '@/lib/calculations';
import { Grade, Panel, signed } from '@/components/ui/controls';

const K = 4; // angle exaggeration in the diagram

function outcome(s: PuttingShotData) {
  if (s.isHoled) return 'Holed';
  const dist = Math.abs(s.distanceErrorFt);
  const lat = Math.abs(s.lateralErrorInches);
  const parts: string[] = [];
  parts.push(dist < 0.2 ? 'Pin high' : `${dist.toFixed(1)} ft ${s.distanceErrorFt < 0 ? 'short' : 'past'}`);
  if (lat >= 1) parts.push(`${lat.toFixed(0)} in ${s.lateralErrorInches > 0 ? 'right' : 'left'}`);
  return (s.lipOut ? 'Lipped out · ' : '') + parts.join(', ');
}

const dirWord = (v: number, pos: string, neg: string, eps = 0.15) => (Math.abs(v) < eps ? 'square' : v > 0 ? pos : neg);

export function ImpactDiagram({ shot }: { shot: PuttingShotData }) {
  const face = shot.faceAngleDeg * K;
  const path = shot.putterPathDeg * K;
  const showPath = shot.clubMeasured !== false;
  const start = shot.hla * K;
  const cx = 150;
  const cy = 112;
  return (
    <svg viewBox="0 0 300 190" className="w-full" role="img" aria-label="Putter face, path and start line at impact, seen from above">
      <line x1={cx} y1={8} x2={cx} y2={182} stroke="#6f8a7c" strokeWidth={1.5} strokeDasharray="5 5" />
      <text x={cx + 6} y={18} fill="#6f8a7c" fontSize={11}>to target</text>
      {/* path (only when measured) */}
      {showPath && (
        <g transform={`rotate(${path} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 70} x2={cx} y2={cy - 30} stroke="#4fb3ff" strokeWidth={3} strokeLinecap="round" />
          <path d={`M ${cx - 6} ${cy - 24} L ${cx} ${cy - 36} L ${cx + 6} ${cy - 24} Z`} fill="#4fb3ff" />
        </g>
      )}
      {/* start line */}
      <g transform={`rotate(${start} ${cx} ${cy})`}>
        <line x1={cx} y1={cy - 12} x2={cx} y2={cy - 92} stroke="#f5c84c" strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${cx - 7} ${cy - 86} L ${cx} ${cy - 100} L ${cx + 7} ${cy - 86} Z`} fill="#f5c84c" />
      </g>
      {/* putter face */}
      <g transform={`rotate(${face} ${cx} ${cy})`}>
        <rect x={cx - 48} y={cy + 11} width={96} height={12} rx={3} fill="#1a3629" stroke="#eef2ea" strokeWidth={1.5} />
        <line x1={cx - 48} y1={cy + 11} x2={cx + 48} y2={cy + 11} stroke="#eef2ea" strokeWidth={3.5} />
        <line x1={cx} y1={cy + 13} x2={cx} y2={cy + 21} stroke="#eef2ea" strokeWidth={1.5} />
      </g>
      <circle cx={cx} cy={cy} r={9} fill="#ffffff" />
      <text x={292} y={184} fill="#6f8a7c" fontSize={10} textAnchor="end">angles drawn {K}× actual</text>
    </svg>
  );
}

export function LastPutt({ shot, recent }: { shot: PuttingShotData | null; recent: PuttingShotData[] }) {
  if (!shot) {
    return (
      <Panel className="p-5">
        <h3 className="text-base font-bold">Last putt</h3>
        <p className="mt-2 text-sm text-mist">Your stroke data shows up here after each putt — speed, start line, face and path, and how it compares with the ideal stroke.</p>
      </Panel>
    );
  }
  const loft = analyzeDynamicLoft(shot.dynamicLoftDeg, shot.angleOfAttackDeg, shot.vla);
  const speedErr = shot.speedErrorPct;
  const lineErr = shot.startLineErrorDeg;
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-mist">Last putt</h3>
          <Grade grade={shot.grades.overallGrade} />
        </div>
        <p className={`num mt-1 text-3xl font-semibold leading-tight ${shot.isHoled ? 'text-birdie' : 'text-chalk'}`}>{outcome(shot)}</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line">
        <Metric
          label="Ball speed"
          value={shot.ballSpeedMph.toFixed(1)}
          unit="mph"
          note={speedErr !== undefined ? `${Math.abs(speedErr) < 1 ? 'Ideal pace' : `${Math.abs(speedErr).toFixed(0)}% ${speedErr > 0 ? 'firm' : 'soft'}`}` : undefined}
          grade={shot.grades.speedConsistencyGrade}
        />
        <Metric
          label="Start line"
          value={`${Math.abs(shot.hla).toFixed(1)}°`}
          unit={Math.abs(shot.hla) < 0.05 ? 'straight' : shot.hla > 0 ? 'right' : 'left'}
          note={lineErr !== undefined ? (Math.abs(lineErr) < 0.1 ? 'On your line' : `${Math.abs(lineErr).toFixed(1)}° ${lineErr > 0 ? 'right' : 'left'} of ideal`) : undefined}
          grade={shot.grades.faceAngleGrade}
        />
      </div>

      <div className="px-5 pt-4">
        <ImpactDiagram shot={shot} />
        <div className="mt-2 grid grid-cols-3 gap-2 pb-4">
          <Angle color="bg-chalk" label={shot.clubMeasured === false ? 'Face (est.)' : 'Face'} value={shot.faceAngleDeg} word={dirWord(shot.faceAngleDeg, 'open', 'closed')} />
          {shot.clubMeasured === false ? (
            <Angle color="bg-eagle" label="Path" value={null} word="not measured" />
          ) : (
            <Angle color="bg-eagle" label="Path" value={shot.putterPathDeg} word={dirWord(shot.putterPathDeg, 'in-to-out', 'out-to-in')} />
          )}
          <Angle color="bg-flag" label="Start" value={shot.hla} word={dirWord(shot.hla, 'right', 'left', 0.05)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-line bg-line text-center">
        <Small label="Skid" value={`${shot.skidDistanceInches.toFixed(0)} in`} />
        <Small label="Launch" value={`${shot.vla.toFixed(1)}°`} tone={loft.status === 'optimal' ? 'text-birdie' : 'text-par'} />
        <Small label="Rolled" value={`${shot.rollDistanceFt.toFixed(1)} ft`} />
      </div>
      {loft.status !== 'optimal' && <p className="bg-club-900 px-5 py-2 text-xs text-mist">{loft.status === 'low' ? 'Low launch: ball is driven into the turf — check shaft lean.' : 'High launch: the ball hops — reduce dynamic loft.'}</p>}

      {recent.length >= 3 && <Trend recent={recent.slice(0, 10)} />}
    </Panel>
  );
}

function Metric({ label, value, unit, note, grade }: { label: string; value: string; unit: string; note?: string; grade: PuttingShotData['grades']['overallGrade'] }) {
  return (
    <div className="bg-club-900 px-5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fog">{label}</span>
        <Grade grade={grade} />
      </div>
      <div className="num mt-0.5 text-4xl font-semibold leading-none">
        {value}
        <span className="ml-1 text-base font-medium text-mist">{unit}</span>
      </div>
      {note && <div className="mt-1 text-xs text-mist">{note}</div>}
    </div>
  );
}

function Angle({ color, label, value, word }: { color: string; label: string; value: number | null; word: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-fog">
        <span className={`h-1 w-3 rounded-full ${color}`} />
        {label}
      </div>
      <div className="num text-2xl font-semibold">{value === null ? '–' : `${signed(value)}°`}</div>
      <div className="text-xs text-mist">{word}</div>
    </div>
  );
}

function Small({ label, value, tone = 'text-chalk' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-club-900 py-2.5">
      <div className={`num text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-fog">{label}</div>
    </div>
  );
}

/** Rolling last-10 trend: face angle and speed error, newest on the right. */
function Trend({ recent }: { recent: PuttingShotData[] }) {
  const shots = [...recent].reverse();
  const faces = shots.map((s) => s.faceAngleDeg);
  const sd = calculateStdDev(faces);
  const w = 300;
  const h = 64;
  const x = (i: number) => 10 + (i * (w - 20)) / Math.max(1, shots.length - 1);
  const yFace = (v: number) => h / 2 - Math.max(-3, Math.min(3, v)) * (h / 2 - 6) / 3;
  const speeds = shots.map((s) => s.speedErrorPct ?? 0);
  const ySpeed = (v: number) => h / 2 - Math.max(-20, Math.min(20, v)) * (h / 2 - 6) / 20;
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mist">Last {shots.length} putts</span>
        <span className="flex items-center gap-2 text-xs text-mist">
          Face spread ±{sd.toFixed(2)}° <Grade grade={gradeFaceAngleVariance(sd)} />
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full">
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#2a4a3b" />
        <polyline points={speeds.map((v, i) => `${x(i)},${ySpeed(v)}`).join(' ')} fill="none" stroke="#f5c84c" strokeWidth={2} opacity={0.8} />
        {faces.map((v, i) => (
          <circle key={i} cx={x(i)} cy={yFace(v)} r={3.5} fill="#eef2ea" />
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-fog">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chalk" />Face angle (±3°)</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full bg-flag" />Speed vs ideal (±20%)</span>
      </div>
    </div>
  );
}
