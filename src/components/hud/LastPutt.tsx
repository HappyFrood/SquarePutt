'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { analyzeDynamicLoft, calculateStdDev, gradeFaceAngleVariance } from '@/lib/calculations';
import { Grade, Panel } from '@/components/ui/controls';
import { Check, X } from 'lucide-react';
import { diagnose, DiagPart } from '@/lib/diagnosis';


function outcome(s: PuttingShotData) {
  if (s.isHoled) return 'Holed';
  const dist = Math.abs(s.distanceErrorFt);
  const lat = Math.abs(s.lateralErrorInches);
  const parts: string[] = [];
  parts.push(dist < 0.2 ? 'Pin high' : `${dist.toFixed(1)} ft ${s.distanceErrorFt < 0 ? 'short' : 'past'}`);
  if (lat >= 1) parts.push(`${lat.toFixed(0)} in ${s.lateralErrorInches > 0 ? 'right' : 'left'}`);
  return (s.lipOut ? 'Lipped out · ' : '') + parts.join(', ');
}


export function LastPutt({ shot, recent }: { shot: PuttingShotData | null; recent: PuttingShotData[] }) {
  if (!shot) {
    return (
      <Panel className="p-5">
        <h3 className="text-base font-bold">Last putt</h3>
        <p className="mt-2 text-sm text-mist">Your stroke data shows up here after each putt — ball speed, start line against the line you chose, launch and spin.</p>
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
          note={lineErr !== undefined ? (Math.abs(lineErr) < 0.1 ? 'On your line' : `${Math.abs(lineErr).toFixed(1)}° ${lineErr > 0 ? 'right' : 'left'} of your line`) : undefined}
          grade={shot.grades.faceAngleGrade}
        />
      </div>

      <Diagnosis shot={shot} />

      <div className="grid grid-cols-4 gap-px border-t border-line bg-line text-center">
        <Small label="Launch" value={`${shot.vla.toFixed(1)}°`} tone={loft.status === 'optimal' ? 'text-birdie' : 'text-par'} />
        <Small label="Spin" value={shot.backspinRpm !== undefined && shot.backspinRpm !== 0 ? `${Math.round(shot.backspinRpm)}` : '–'} />
        <Small label="Skid" value={`${shot.skidDistanceInches.toFixed(0)} in`} />
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


function Small({ label, value, tone = 'text-chalk' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-club-900 py-2.5">
      <div className={`num text-xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-fog">{label}</div>
    </div>
  );
}

/** Start line relative to the chosen line (falls back to raw start direction for older putts). */
const lineOf = (s: PuttingShotData) => s.startLineErrorDeg ?? s.hla;

/** Rolling last-10 trend: start line and speed error, newest on the right. */
function Trend({ recent }: { recent: PuttingShotData[] }) {
  const shots = [...recent].reverse();
  const lines = shots.map(lineOf);
  const sd = calculateStdDev(lines);
  const w = 300;
  const h = 64;
  const x = (i: number) => 10 + (i * (w - 20)) / Math.max(1, shots.length - 1);
  const yLine = (v: number) => h / 2 - Math.max(-3, Math.min(3, v)) * (h / 2 - 6) / 3;
  const speeds = shots.map((s) => s.speedErrorPct ?? 0);
  const ySpeed = (v: number) => h / 2 - Math.max(-20, Math.min(20, v)) * (h / 2 - 6) / 20;
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mist">Last {shots.length} putts</span>
        <span className="flex items-center gap-2 text-xs text-mist">
          Start line spread ±{sd.toFixed(2)}° <Grade grade={gradeFaceAngleVariance(sd)} />
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full">
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#2a4a3b" />
        <polyline points={speeds.map((v, i) => `${x(i)},${ySpeed(v)}`).join(' ')} fill="none" stroke="#f5c84c" strokeWidth={2} opacity={0.8} />
        {lines.map((v, i) => (
          <circle key={i} cx={x(i)} cy={yLine(v)} r={3.5} fill="#eef2ea" />
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-fog">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chalk" />Start line vs your line (±3°, right is up)</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full bg-flag" />Speed vs ideal (±20%)</span>
      </div>
    </div>
  );
}

/** Read · start line · pace: which part of the putt cost it. */
function Diagnosis({ shot }: { shot: PuttingShotData }) {
  const d = diagnose(shot);
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="text-sm font-semibold text-chalk">{d.headline}</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Part label="Read" p={d.read} />
        <Part label="Start line" p={d.line} />
        <Part label="Pace" p={d.pace} />
      </div>
      {shot.read && shot.read.verdict !== 'good' && (
        <p className="mt-2 text-xs text-mist">
          Your line at perfect pace would finish {Math.round(Math.abs(shot.read.missIn))} in {shot.read.missIn > 0 ? 'right' : 'left'} of the hole. The ideal line aims{' '}
          {Math.abs(shot.read.idealIn) < 1 ? 'at the centre' : `${Math.abs(shot.read.idealIn) >= 12 ? `${(Math.abs(shot.read.idealIn) / 12).toFixed(1)} ft` : `${Math.round(Math.abs(shot.read.idealIn))} in`} ${shot.read.idealIn > 0 ? 'right' : 'left'}`}.
        </p>
      )}
    </div>
  );
}

function Part({ label, p }: { label: string; p: DiagPart }) {
  const tone = p.state === 'good' ? 'text-birdie' : p.state === 'off' ? 'text-bogey' : 'text-fog';
  return (
    <div className="rounded-lg bg-club-950/60 px-2.5 py-2 ring-1 ring-line">
      <div className="flex items-center gap-1 text-xs text-fog">
        {p.state === 'good' ? <Check size={13} className="text-birdie" /> : p.state === 'off' ? <X size={13} className="text-bogey" /> : null}
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold leading-tight ${tone}`}>{p.text}</div>
    </div>
  );
}
