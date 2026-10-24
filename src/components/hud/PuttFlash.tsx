'use client';

import React from 'react';
import { PuttingShotData } from '@/lib/types';
import { diagnose } from '@/lib/diagnosis';
import { FeedbackCard } from '@/components/hud/Feedback';

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
  return (
    <div className='pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center'>
      <button
        onClick={onClose}
        title='Dismiss'
        className='sp-rise pointer-events-auto w-[560px] rounded-2xl bg-club-950/92 p-4 text-left shadow-2xl ring-1 ring-line backdrop-blur'
      >
        <div className='text-base font-bold text-chalk'>{d.headline}</div>
        <div className='mt-2.5 grid grid-cols-4 gap-2'>
          <FeedbackCard compact label='Pace' p={d.pace} />
          <FeedbackCard compact label='Face control' p={d.face} />
          <FeedbackCard compact label='Read' p={d.read} />
          <FeedbackCard compact label='Launch' p={d.loft} />
        </div>
      </button>
    </div>
  );
}
