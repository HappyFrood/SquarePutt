'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { PuttingShotData } from '@/lib/types';
import { diagnose, DiagPart } from '@/lib/diagnosis';

/**
 * Top-centre card during drills: the key numbers of the putt that just finished, shown for a few
 * seconds (the drill panel pushes the full 'Last putt' panel out of view). Click to dismiss.
 */
export function PuttFlash({
  shot,
  onClose,
}: {
  shot: PuttingShotData | null;
  onClose: () => void;
}) {
  if (!shot) return null;
  const d = diagnose(shot);
  const pe = shot.speedErrorPct;
  const le = shot.startLineErrorDeg;
  return (
    <div className='pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center'>
      <button
        onClick={onClose}
        title='Dismiss'
        className='sp-rise pointer-events-auto w-[440px] rounded-2xl bg-club-950/92 p-4 text-left shadow-2xl ring-1 ring-line backdrop-blur'
      >
        <div className='flex items-baseline justify-between gap-3'>
          <span className='text-base font-bold text-chalk'>{d.headline}</span>
          <span className='num text-sm text-mist'>
            {shot.ballSpeedMph.toFixed(1)} mph
            {pe !== undefined
              ? ` · ${Math.abs(pe) < 1 ? 'ideal pace' : `${Math.abs(pe).toFixed(0)}% ${pe > 0 ? 'firm' : 'soft'}`}`
              : ''}
          </span>
        </div>
        <div className='mt-2.5 grid grid-cols-3 gap-2'>
          <Chip label='Read' p={d.read} />
          <Chip
            label='Start line'
            p={
              le !== undefined && d.line.state === 'good'
                ? { ...d.line, text: `On line (${Math.abs(le).toFixed(1)}°)` }
                : d.line
            }
          />
          <Chip label='Pace' p={d.pace} />
        </div>
      </button>
    </div>
  );
}

function Chip({ label, p }: { label: string; p: DiagPart }) {
  const tone =
    p.state === 'good'
      ? 'text-birdie'
      : p.state === 'off'
        ? 'text-bogey'
        : 'text-fog';
  return (
    <div className='rounded-lg bg-club-900 px-2.5 py-2 ring-1 ring-line'>
      <div className='flex items-center gap-1 text-xs text-fog'>
        {p.state === 'good' ? (
          <Check size={13} className='text-birdie' />
        ) : p.state === 'off' ? (
          <X size={13} className='text-bogey' />
        ) : null}
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold leading-tight ${tone}`}>
        {p.text}
      </div>
    </div>
  );
}
