'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateStdDev, gradeFaceAngleVariance } from '@/lib/calculations';
import { Grade, Panel } from '@/components/ui/controls';
import { diagnose, fmtDeg, readDegrees } from '@/lib/diagnosis';
import { FeedbackCard } from '@/components/hud/Feedback';
import { leapDistanceFt } from '@/lib/drills';


function outcome(s: PuttingShotData) {
  if (s.noHole) return s.offGreen ? 'Off the green' : `Finished ${leapDistanceFt(s).toFixed(1)} ft out`;
  if (s.isHoled) return 'Holed';
  if (s.offGreen) return 'Off the green';
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
        <p className="mt-2 text-sm text-mist">After each putt: pace (% soft or firm), face control (start direction vs your aim), your read (share of the break played) and launch.</p>
      </Panel>
    );
  }
  const d = diagnose(shot);
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-mist">Last putt</h3>
          {!shot.noHole && <Grade grade={shot.grades.overallGrade} />}
        </div>
        <p className={`num mt-1 text-3xl font-semibold leading-tight ${shot.isHoled ? 'text-birdie' : 'text-chalk'}`}>{outcome(shot)}</p>
        {!shot.noHole && <p className="mt-1 text-sm font-semibold text-mist">{d.headline}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        {!shot.noHole && <FeedbackCard label="Pace" p={d.pace} />}
        <FeedbackCard label="Face control" p={d.face} />
        {!shot.noHole && <FeedbackCard label="Read" p={d.read} />}
        <FeedbackCard label="Launch & roll" p={d.loft} />
      </div>
      {shot.read && <ReadLine shot={shot} />}

      <div className="grid grid-cols-3 gap-px border-t border-line bg-line text-center">
        <Small label="Launch" value={`${shot.vla.toFixed(1)}°`} />
        <Small label="Skid (est.)" value={`${shot.skidDistanceInches.toFixed(0)} in`} />
        <Small label="Rolled" value={`${shot.rollDistanceFt.toFixed(1)} ft`} />
      </div>

      {recent.length >= 3 && <Trend recent={recent.slice(0, 10)} />}
    </Panel>
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

/** Face control: start direction relative to the aim (falls back to raw start direction for older putts). */
const faceOf = (s: PuttingShotData) => s.startLineErrorDeg ?? s.hla;

/** Last-10 face control: where each ball started relative to your aim, newest on the right. */
function Trend({ recent }: { recent: PuttingShotData[] }) {
  const shots = [...recent].reverse();
  const faces = shots.map(faceOf);
  const sd = calculateStdDev(faces);
  const bias = faces.reduce((a, b) => a + b, 0) / faces.length;
  const w = 300;
  const h = 72;
  const R = 2; // ±2° shown
  const x = (i: number) => 12 + (i * (w - 24)) / Math.max(1, shots.length - 1);
  const y = (v: number) => h / 2 - (Math.max(-R, Math.min(R, v)) * (h / 2 - 6)) / R;
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mist">Face control · last {shots.length}</span>
        <span className="flex items-center gap-2 text-xs text-mist">
          spread ±{sd.toFixed(2)}° <Grade grade={gradeFaceAngleVariance(sd)} />
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" role="img" aria-label="Start direction relative to your aim for recent putts">
        {/* ±0.5° band: on your aim */}
        <rect x={0} y={y(0.5)} width={w} height={y(-0.5) - y(0.5)} fill="#4ade80" opacity={0.1} />
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#2a4a3b" />
        <text x={w - 2} y={10} textAnchor="end" fontSize={9} fill="#6f8a7c">right</text>
        <text x={w - 2} y={h - 3} textAnchor="end" fontSize={9} fill="#6f8a7c">left</text>
        <polyline points={faces.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#a9bcb0" strokeWidth={1} opacity={0.5} />
        {faces.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={Math.abs(v) <= 0.5 ? '#4ade80' : '#f87171'} />
        ))}
      </svg>
      <p className="mt-1 text-xs text-fog">
        {Math.abs(bias) < 0.15 ? 'No left/right bias.' : `You tend to start it ${Math.abs(bias).toFixed(1)}° ${bias > 0 ? 'right' : 'left'} of your aim.`} Green band: within 0.5°.
      </p>
    </div>
  );
}

function ReadLine({ shot }: { shot: PuttingShotData }) {
  const d = readDegrees(shot);
  const dir = (v: number) => (Math.abs(v) < 0.01 ? 'straight at the hole' : `${fmtDeg(v)} ${v > 0 ? 'right' : 'left'}`);
  return (
    <p className="-mt-1 px-5 pb-4 text-xs text-mist">
      You aimed {dir(d.aimDeg)}; the ideal line was {dir(d.idealDeg)}
      {d.breakPlayedPct !== undefined ? ` — you played ${d.breakPlayedPct}% of the break` : ''}.
      {shot.read?.paceLineDeg !== undefined && shot.speedErrorPct !== undefined && (
        <>
          {' '}
          {shot.read.paceLineDeg === null
            ? `At the pace you hit (${Math.abs(shot.speedErrorPct).toFixed(0)}% soft), the ball can't reach the hole on any line.`
            : shot.read.paceLineHoles === false
            ? `At the pace you hit (${Math.abs(shot.speedErrorPct).toFixed(0)}% firm), even the centre line (${dir(shot.read.paceLineDeg)}) lips out.`
            : `At the pace you hit (${Math.abs(shot.speedErrorPct).toFixed(0)}% ${shot.speedErrorPct > 0 ? 'firm' : 'soft'}), the line that holes is ${dir(shot.read.paceLineDeg)}.`}
        </>
      )}
    </p>
  );
}
