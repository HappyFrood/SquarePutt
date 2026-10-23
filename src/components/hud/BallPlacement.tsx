'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, FlipHorizontal2 } from 'lucide-react';
import { SquareStatus, squareBle } from '@/lib/squareBle';
import { audioEngine } from '@/components/ui/AudioEngine';

/**
 * Visual ball-placement guide, like the Square software's hitting-zone screen.
 *
 * The Square streams the ball's raw X/Y position and a "ready" flag (ball in the read zone).
 * The position units and axes aren't documented, so the green zone is learned from the
 * Square itself: every position it reports as ready is recorded (and saved), and the zone is
 * drawn around those. The dot shows where the ball sits now, green when ready, amber when it
 * is seen but outside the zone, with an arrow toward the zone centre.
 */

// v2: zone is learned only from steady (debounced) ready readings; v1 samples included edge flickers.
const ZONE_KEY = 'squareputt_square_zone_v2';
const VIEW_KEY = 'squareputt_square_view_v1';
type Model = 'home' | 'omni';
/** Where the ball goes relative to the unit, per model (centre of ball to front of the Square). */
const PLACEMENT: Record<Model, string> = {
  home: 'Home Edition: ball about 23 cm (9 in) in front of the Square, centred on it.',
  omni: 'Omni: ball about 5 cm (2 in) in front of the Square, centred on it.',
};
const MAX_SAMPLES = 400;

type P = { x: number; y: number };

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as T) : fallback;
  } catch {
    return fallback;
  }
}

function pct(vals: number[], p: number) {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

export function BallPlacement({ ble, active }: { ble: SquareStatus; active: boolean }) {
  const ready = ble.connected && ble.ballReady;
  const [samples, setSamples] = useState<P[]>(() => loadJSON<P[]>(ZONE_KEY, []));
  const [view, setView] = useState<{ rot: number; flip: boolean }>(() => loadJSON(VIEW_KEY, { rot: 0, flip: false }));
  const model = ble.model;
  const [confirm, setConfirm] = useState(false);
  const [trail, setTrail] = useState<P[]>([]);
  const wasReady = useRef(ready);

  const pos = ble.ballPos ? { x: ble.ballPos.x, y: ble.ballPos.y } : null;

  // Learn the read zone from positions the Square calls ready; keep a short trail of the dot.
  useEffect(
    () =>
      squareBle.onStatus((st) => {
        if (!st.ballPos) return;
        const p = { x: st.ballPos.x, y: st.ballPos.y };
        setTrail((t) => (t.length && t[t.length - 1].x === p.x && t[t.length - 1].y === p.y ? t : [...t.slice(-14), p]));
        if (st.ballReady) {
          setSamples((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.x === p.x && last.y === p.y) return prev;
            const next = [...prev, p].slice(-MAX_SAMPLES);
            try {
              localStorage.setItem(ZONE_KEY, JSON.stringify(next));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
      }),
    []
  );

  useEffect(() => {
    if (ready && !wasReady.current && active) {
      audioEngine.playReady();
      setConfirm(true);
      const t = setTimeout(() => setConfirm(false), 1000);
      wasReady.current = ready;
      return () => clearTimeout(t);
    }
    wasReady.current = ready;
  }, [ready, active]);

  if (!ble.connected || !active) return null;
  if (ready && !confirm) return null;

  // Zone from learned ready positions (robust 5th–95th percentile box)
  const zone =
    samples.length >= 3
      ? {
          x0: pct(samples.map((p) => p.x), 0.05),
          x1: pct(samples.map((p) => p.x), 0.95),
          y0: pct(samples.map((p) => p.y), 0.05),
          y1: pct(samples.map((p) => p.y), 0.95),
        }
      : null;

  // Visible window: zone plus wherever the ball has been, with padding
  const pts = [...trail, ...(pos ? [pos] : [])];
  const xs = [...pts.map((p) => p.x), ...(zone ? [zone.x0, zone.x1] : [])];
  const ys = [...pts.map((p) => p.y), ...(zone ? [zone.y0, zone.y1] : [])];
  const hasData = xs.length > 0;
  let minX = hasData ? Math.min(...xs) : -1;
  let maxX = hasData ? Math.max(...xs) : 1;
  let minY = hasData ? Math.min(...ys) : -1;
  let maxY = hasData ? Math.max(...ys) : 1;
  const span = Math.max(maxX - minX, maxY - minY, zone ? Math.max(zone.x1 - zone.x0, zone.y1 - zone.y0) * 3 : 1, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  minX = cx - span * 0.75;
  maxX = cx + span * 0.75;
  minY = cy - span * 0.75;
  maxY = cy + span * 0.75;

  const S = 200; // svg size
  const map = (p: P) => {
    let u = (p.x - minX) / (maxX - minX) - 0.5;
    let w = (p.y - minY) / (maxY - minY) - 0.5;
    if (view.flip) u = -u;
    for (let r = 0; r < view.rot; r++) [u, w] = [-w, u];
    return { x: (u + 0.5) * S, y: (0.5 - w) * S };
  };

  const zc = zone ? map({ x: (zone.x0 + zone.x1) / 2, y: (zone.y0 + zone.y1) / 2 }) : null;
  const zCorners = zone ? [map({ x: zone.x0, y: zone.y0 }), map({ x: zone.x1, y: zone.y1 })] : null;
  const ball = pos ? map(pos) : null;
  const state = ready ? 'ready' : ble.ballDetected ? 'adjust' : 'empty';
  const saveView = (v: { rot: number; flip: boolean }) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="absolute right-4 top-4 z-20 w-[280px] rounded-2xl bg-club-950/90 p-4 shadow-2xl ring-1 ring-line backdrop-blur" role="status" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className={`text-base font-bold ${state === 'ready' ? 'text-birdie' : state === 'adjust' ? 'text-par' : 'text-chalk'}`}>
          {state === 'ready' ? 'Ready — putt' : state === 'adjust' ? 'Move the ball into the zone' : 'Place a ball'}
        </span>
        <span className="flex gap-1">
          <button aria-label="Rotate view" title="Rotate view" onClick={() => saveView({ ...view, rot: (view.rot + 1) % 4 })} className="pointer-events-auto grid h-7 w-7 place-items-center rounded-md text-mist hover:bg-club-800 hover:text-chalk">
            <RotateCw size={15} />
          </button>
          <button aria-label="Mirror view" title="Mirror view" onClick={() => saveView({ ...view, flip: !view.flip })} className="pointer-events-auto grid h-7 w-7 place-items-center rounded-md text-mist hover:bg-club-800 hover:text-chalk">
            <FlipHorizontal2 size={15} />
          </button>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {(['home', 'omni'] as const).map((m) => (
          <button
            key={m}
            onClick={() => squareBle.setModel(m)}
            className={`pointer-events-auto rounded-md px-2 py-0.5 ring-1 ${model === m ? 'bg-club-800 text-chalk ring-flag' : 'text-mist ring-line hover:text-chalk'}`}
          >
            {m === 'home' ? 'Home Edition' : 'Omni'}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-mist">{PLACEMENT[model]}</p>

      <svg viewBox={`0 0 ${S} ${S}`} className="mt-3 w-full rounded-xl bg-club-900 ring-1 ring-line" aria-label="Ball position relative to the read zone">
        {/* grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f} stroke="#244a38" strokeWidth={1}>
            <line x1={f * S} x2={f * S} y1={0} y2={S} />
            <line y1={f * S} y2={f * S} x1={0} x2={S} />
          </g>
        ))}
        {zCorners ? (
          <rect
            x={Math.min(zCorners[0].x, zCorners[1].x) - 4}
            y={Math.min(zCorners[0].y, zCorners[1].y) - 4}
            width={Math.abs(zCorners[1].x - zCorners[0].x) + 8}
            height={Math.abs(zCorners[1].y - zCorners[0].y) + 8}
            rx={8}
            fill="rgba(74,222,128,0.18)"
            stroke="#4ade80"
            strokeWidth={2}
          />
        ) : (
          <text x={S / 2} y={S - 12} textAnchor="middle" fill="#6f8a7c" fontSize={11}>
            learning the read zone…
          </text>
        )}
        {trail.map((p, i) => {
          const m = map(p);
          return <circle key={i} cx={m.x} cy={m.y} r={2} fill="#a9bcb0" opacity={(i + 1) / trail.length / 2} />;
        })}
        {ball && zc && state === 'adjust' && Math.hypot(zc.x - ball.x, zc.y - ball.y) > 14 && (
          <g stroke="#fbbf24" strokeWidth={2.5} fill="#fbbf24">
            <line x1={ball.x} y1={ball.y} x2={ball.x + (zc.x - ball.x) * 0.8} y2={ball.y + (zc.y - ball.y) * 0.8} strokeDasharray="5 4" />
            <circle cx={zc.x} cy={zc.y} r={3} />
          </g>
        )}
        {ball && (
          <circle cx={ball.x} cy={ball.y} r={9} fill={state === 'ready' ? '#4ade80' : '#fbbf24'} stroke="#ffffff" strokeWidth={2.5} />
        )}
        {!ball && (
          <text x={S / 2} y={S / 2 + 4} textAnchor="middle" fill="#a9bcb0" fontSize={13}>
            no ball seen
          </text>
        )}
      </svg>
      <p className="mt-2 text-xs text-fog">
        {zone
          ? `Green box: where your Square has read the ball as ready (${samples.length} positions).`
          : 'Place the ball where the Square reads it — the green zone fills in from its own readings.'}{' '}
        <button
          className="pointer-events-auto underline underline-offset-2 hover:text-chalk"
          onClick={() => {
            setSamples([]);
            try {
              localStorage.removeItem(ZONE_KEY);
            } catch {
              /* ignore */
            }
          }}
        >
          Reset
        </button>
      </p>
    </div>
  );
}
