'use client';

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, X } from 'lucide-react';
import { DiagPart } from '@/lib/diagnosis';

const ARROWS = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight };

/** One feedback item (pace, face control, read, launch): verdict mark, value with a direction arrow, detail. */
export function FeedbackCard({ label, p, compact = false }: { label: string; p: DiagPart; compact?: boolean }) {
  const tone = p.state === 'good' ? 'text-birdie' : p.state === 'off' ? 'text-bogey' : 'text-fog';
  const Arrow = p.dir ? ARROWS[p.dir] : null;
  return (
    <div className={`rounded-xl bg-club-950/60 ring-1 ring-line ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
      <div className="flex items-center justify-between text-xs text-fog">
        <span>{label}</span>
        {p.state === 'good' ? <Check size={14} className="text-birdie" /> : p.state === 'off' ? <X size={14} className="text-bogey" /> : null}
      </div>
      <div className={`mt-0.5 flex items-center gap-1 font-semibold leading-tight ${tone} ${compact ? 'text-sm' : 'text-lg'}`}>
        {Arrow && <Arrow size={compact ? 15 : 19} strokeWidth={2.6} className="shrink-0" />}
        <span>{p.text}</span>
      </div>
      {p.detail && !compact && <div className="mt-0.5 text-xs text-mist">{p.detail}</div>}
    </div>
  );
}
