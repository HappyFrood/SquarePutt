'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Bottom-right: choose the start line by tapping left / right (or with a remote / keyboard:
 * ← → arrow keys, Page Up / Page Down as sent by presentation clickers, or the Square's own
 * remote). Steps of 0.5° up to 6°. Hold a button to keep moving. Shows degrees only, so it
 * doesn't give away where the line meets the hole.
 * Locked to the ideal line when the "Read + line" assist is on.
 */
export function AimControl({
  aimDeg,
  locked,
  disabled,
  onNudge,
  onReset,
}: {
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
      hold.current.i = setInterval(() => onNudge(dir), 150);
    }, 350);
  };

  const n = Math.abs(aimDeg);
  const deg = Number(n.toFixed(2)).toString(); // 0.25, 0.5, 1.5, 3, 12
  const label = locked ? 'Ideal start line' : n < 0.01 ? 'Straight at the hole' : `${deg}° ${aimDeg > 0 ? 'right' : 'left'}`;
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
        disabled={off || n < 0.01}
        title={off ? undefined : 'Reset to the hole'}
      >
        <div className="text-base font-semibold text-chalk">{label}</div>
        <div className="num text-xs text-fog">
          {locked ? 'Read + line is on' : 'start line · ← → to aim'}
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
