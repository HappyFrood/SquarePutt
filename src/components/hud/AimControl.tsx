'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Bottom-right: choose the start line by tapping left / right (or with a remote / keyboard:
 * ← → arrow keys, or Page Up / Page Down as sent by presentation clickers). Each tap moves the
 * aim point at the hole by a step that grows with distance. Hold a button to keep moving.
 * Locked to the ideal line when the "Read + line" assist is on.
 */
export function AimControl({
  aimIn,
  aimDeg,
  locked,
  disabled,
  onNudge,
  onReset,
}: {
  aimIn: number;
  aimDeg: number;
  locked: boolean;
  disabled: boolean;
  onNudge: (dir: -1 | 1) => void;
  onReset: () => void;
}) {
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const stop = () => {
    clearTimeout(hold.current.t);
    clearInterval(hold.current.i);
    hold.current = {};
  };
  useEffect(() => stop, []);
  const start = (dir: -1 | 1) => {
    stop();
    onNudge(dir);
    hold.current.t = setTimeout(() => {
      hold.current.i = setInterval(() => onNudge(dir), 90);
    }, 350);
  };

  const n = Math.abs(aimIn);
  const label = locked
    ? 'Ideal start line'
    : n < 0.5
    ? 'Aim at the hole'
    : `Aim ${n >= 12 ? `${(n / 12).toFixed(1)} ft` : `${Math.round(n)} in`} ${aimIn > 0 ? 'right' : 'left'}`;
  const off = locked || disabled;
  const btn =
    'pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-club-900 text-chalk ring-1 ring-line transition-colors hover:bg-club-800 active:bg-club-700 disabled:opacity-35 disabled:hover:bg-club-900';

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-3 rounded-full bg-club-950/85 p-1.5 ring-1 ring-line backdrop-blur">
      <button
        aria-label="Aim left"
        className={btn}
        disabled={off}
        onPointerDown={(e) => {
          e.preventDefault();
          start(-1);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        <ChevronLeft size={26} />
      </button>
      <button
        className="pointer-events-auto min-w-[150px] text-center disabled:cursor-default"
        onClick={onReset}
        disabled={off || n < 0.5}
        title={off ? undefined : 'Reset to the hole'}
      >
        <div className="text-base font-semibold text-chalk">{label}</div>
        <div className="num text-xs text-fog">
          {locked ? 'Read + line is on' : `start line ${Math.abs(aimDeg) < 0.05 ? '0.0°' : `${Math.abs(aimDeg).toFixed(1)}° ${aimDeg > 0 ? 'R' : 'L'}`} · ← →`}
        </div>
      </button>
      <button
        aria-label="Aim right"
        className={btn}
        disabled={off}
        onPointerDown={(e) => {
          e.preventDefault();
          start(1);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        <ChevronRight size={26} />
      </button>
    </div>
  );
}
