'use client';

import React, { useState } from 'react';
import { PuttRead } from '@/lib/green';
import { IdealStroke } from '@/lib/physicsEngine';
import { DrillEvent } from '@/lib/drills';
import { openConnectService } from '@/lib/openConnectService';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** Top-left: what this putt looks like, as a caddie would say it. */
export function ReadChip({
  read,
  ideal,
  assist,
  stimp,
  greenLabel,
  rating,
}: {
  read: PuttRead;
  ideal: IdealStroke | null;
  assist: 'off' | 'read' | 'line';
  stimp: number;
  greenLabel?: string;
  rating?: string;
}) {
  const off = ideal ? Math.abs(ideal.aimOffsetIn) : 0;
  const side = ideal && ideal.aimOffsetIn > 0 ? 'right' : 'left';
  const aim =
    off < 0.6
      ? 'Aim at the centre'
      : off < 1.6
      ? `Aim inside ${side} edge`
      : off < 2.6
      ? `Aim at the ${side} edge`
      : `Aim ${(off / 4.25).toFixed(1)} cups ${side}`;
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-2xl bg-club-950/80 px-4 py-3 ring-1 ring-line backdrop-blur">
      {greenLabel && (
        <p className="mb-1.5 text-xs font-medium text-mist">
          {greenLabel}
          {rating && <span className="text-fog"> · {rating} pin</span>}
        </p>
      )}
      <div className="flex items-baseline gap-3">
        <span className="num text-4xl font-semibold leading-none">{read.distanceFt.toFixed(read.distanceFt < 10 ? 1 : 0)}</span>
        <span className="text-sm text-mist">ft · stimp {stimp.toFixed(1)}</span>
      </div>
      {assist !== 'off' && (
        <div className="mt-2 space-y-0.5 text-sm">
          <p className="text-chalk">
            {read.slopeLabel}
            {read.slopeLabel !== 'Level' && ` ${Math.abs(read.elevationChangeIn).toFixed(1)} in`}
            {' · '}
            {read.breakLabel}
            {read.breakLabel !== 'Straight' && ` ${Math.abs(read.sideSlopePct).toFixed(1)}%`}
          </p>
          {ideal && (
            <p className="font-semibold text-flag">
              {aim} · {ideal.ballSpeedMph.toFixed(1)} mph
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const EVENT_STYLE: Record<string, string> = {
  make: 'bg-birdie text-club-950',
  milestone: 'bg-flag text-flag-ink',
  'level-up': 'bg-flag text-flag-ink',
  mega: 'bg-flag text-flag-ink',
  win: 'bg-flag text-flag-ink',
  zone: 'bg-birdie text-club-950',
  gimme: 'bg-eagle text-club-950',
  'hole-done': 'bg-chalk text-club-950',
  'game-over': 'bg-chalk text-club-950',
};

/** Result shown after the ball stops. */
export function ResultBanner({ event }: { event: DrillEvent | null }) {
  if (!event) return null;
  const cls = EVENT_STYLE[event.kind] ?? 'bg-club-800 text-chalk ring-1 ring-line';
  return (
    <div className={`sp-pop pointer-events-none absolute bottom-8 left-1/2 z-20 min-w-[280px] rounded-2xl px-7 py-4 text-center shadow-2xl ${cls}`} role="status">
      <div className="num text-4xl font-bold leading-tight">{event.title}</div>
      {event.detail && <div className="mt-1 text-base font-medium opacity-80">{event.detail}</div>}
    </div>
  );
}

/** Bottom-left: hit virtual putts when no launch monitor is attached. */
export function PracticePad({ ideal, aimDeg, disabled }: { ideal: IdealStroke | null; aimDeg: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [speedPct, setSpeedPct] = useState(0);
  const [lineDeg, setLineDeg] = useState(0);
  if (!ideal) return null;

  const hit = (dSpeedPct: number, dLine: number, face?: number, path?: number) => {
    const mph = ideal.ballSpeedMph * (1 + dSpeedPct / 100);
    const hla = aimDeg + dLine;
    openConnectService.triggerSimulatedShot({ ballSpeedMph: mph, hlaDeg: hla, faceAngleDeg: face ?? hla / 0.82, pathDeg: path ?? 0 });
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // A decent amateur: ~6% speed and ~0.8° start-line spread
  const realistic = () => {
    const path = gauss() * 1.2;
    const faceErr = gauss() * 0.75;
    hit(gauss() * 6, faceErr * 0.83 + path * 0.17, aimDeg + faceErr, path);
  };

  const presets: { label: string; run: () => void }[] = [
    { label: 'Realistic', run: realistic },
    { label: 'Perfect', run: () => hit(0, 0) },
    { label: 'Push 1°', run: () => hit(0, 1) },
    { label: 'Pull 1°', run: () => hit(0, -1) },
    { label: '10% firm', run: () => hit(10, 0) },
    { label: '10% soft', run: () => hit(-10, 0) },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[340px] rounded-2xl bg-club-950/85 ring-1 ring-line backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-semibold text-mist">Hit a virtual putt</span>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-fog hover:text-chalk" aria-expanded={open}>
          Custom {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {presets.map((p, i) => (
          <button
            key={p.label}
            disabled={disabled}
            onClick={p.run}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${i === 0 ? 'bg-flag text-flag-ink hover:bg-[#ffd765]' : 'bg-club-800 text-chalk hover:bg-club-700'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
          <label className="block">
            <span className="flex justify-between text-mist">
              Speed vs ideal <span className="num text-chalk">{speedPct > 0 ? '+' : ''}{speedPct}%</span>
            </span>
            <input type="range" min={-30} max={30} value={speedPct} onChange={(e) => setSpeedPct(parseInt(e.target.value, 10))} className="mt-2 w-full" />
          </label>
          <label className="block">
            <span className="flex justify-between text-mist">
              Start line vs your line <span className="num text-chalk">{lineDeg > 0 ? `${lineDeg.toFixed(1)}° right` : lineDeg < 0 ? `${(-lineDeg).toFixed(1)}° left` : 'on line'}</span>
            </span>
            <input type="range" min={-4} max={4} step={0.1} value={lineDeg} onChange={(e) => setLineDeg(parseFloat(e.target.value))} className="mt-2 w-full" />
          </label>
          <button disabled={disabled} onClick={() => hit(speedPct, lineDeg)} className="w-full rounded-lg bg-chalk py-2 font-semibold text-club-950 disabled:opacity-40">
            Hit it
          </button>
        </div>
      )}
    </div>
  );
}
