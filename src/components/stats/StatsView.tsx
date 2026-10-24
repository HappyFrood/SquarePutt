'use client';

import React, { useMemo, useRef, useState } from 'react';
import { PuttingShotData } from '@/lib/types';
import { calculateBagMapping, clearShotHistory, exportSessionData, getDrillBests, importSessionData } from '@/lib/storage';
import { calculateMean, calculateStdDev } from '@/lib/calculations';
import { readStats } from '@/lib/diagnosis';
import { Baseline, BASELINES, makePct, strokesGained } from '@/lib/baselines';
import { Button, Panel, Segmented, signed } from '@/components/ui/controls';

type Filter = 'all' | 'short' | 'mid' | 'lag';
const FILTERS: Record<Filter, (s: PuttingShotData) => boolean> = {
  all: () => true,
  short: (s) => s.targetDistanceFt < 10,
  mid: (s) => s.targetDistanceFt >= 10 && s.targetDistanceFt < 20,
  lag: (s) => s.targetDistanceFt >= 20,
};

export function StatsView({ shots, onDataChanged, baseline, onBaseline }: { shots: PuttingShotData[]; onDataChanged: () => void; baseline: Baseline; onBaseline: (b: Baseline) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Leapfrog putts have no cup: leave them out of make rates, strokes gained and reading.
  const holeShots = useMemo(() => shots.filter((s) => !s.noHole), [shots]);
  const filtered = useMemo(() => holeShots.filter(FILTERS[filter]), [holeShots, filter]);
  const bests = getDrillBests();
  const buckets = calculateBagMapping(holeShots);

  const made = filtered.filter((s) => s.isHoled).length;
  const speedErr = filtered.filter((s) => s.speedErrorPct !== undefined).map((s) => s.speedErrorPct!);
  const lineErr = filtered.filter((s) => s.startLineErrorDeg !== undefined).map((s) => s.startLineErrorDeg!);
  const rs = readStats(filtered);
  const bl = BASELINES.find((b) => b.id === baseline) ?? BASELINES[0];
  // Strokes gained per putt: expected putts from the start − 1 − expected putts from where it finished.
  const sgOf = (s: PuttingShotData) => strokesGained(baseline, s.targetDistanceFt, s.isHoled, s.leaveFt);
  const sgs = filtered.map(sgOf);
  const sgPerPutt = sgs.length ? calculateMean(sgs) : null;
  const sgTotal = sgs.reduce((a, b) => a + b, 0);
  // Baseline make rate for each distance bucket, at the distances actually putted
  const bucketBase = buckets.map((b) => {
    const inB = holeShots.filter((s) => s.targetDistanceFt >= b.minDistFt && s.targetDistanceFt <= b.maxDistFt);
    const base = inB.length ? calculateMean(inB.map((s) => makePct(baseline, s.targetDistanceFt))) : makePct(baseline, (b.minDistFt + b.maxDistFt) / 2);
    const sg = inB.length ? calculateMean(inB.map(sgOf)) : null;
    return { base, sg };
  });

  const exportData = () => {
    const blob = new Blob([exportSessionData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `squareputt-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your putting</h1>
            <p className="text-mist">{shots.length ? `${shots.length} putts recorded on this device.` : 'No putts yet — hit some in Practice or a drill.'}</p>
          </div>
          <div className="w-[420px] max-w-full space-y-2">
            <Segmented
              value={baseline}
              onChange={onBaseline}
              options={BASELINES.map((b) => ({ value: b.id, label: b.label }))}
              size="sm"
            />
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'short', label: 'Under 10 ft' },
                { value: 'mid', label: '10–20 ft' },
                { value: 'lag', label: '20 ft +' },
              ]}
              size="sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Tile
            value={sgPerPutt !== null ? signed(sgPerPutt, 2) : '–'}
            label={`strokes gained per putt vs ${bl.long}`}
            tone={sgPerPutt === null ? undefined : sgPerPutt >= 0 ? 'text-birdie' : 'text-bogey'}
          />
          <Tile value={sgPerPutt !== null ? signed(sgPerPutt * 18, 1) : '–'} label="per 18 holes, if every hole started with putts like these" tone={sgPerPutt === null ? undefined : sgPerPutt >= 0 ? 'text-birdie' : 'text-bogey'} />
          <Tile value={sgs.length ? signed(sgTotal, 1) : '–'} label={`total over ${sgs.length} putts`} />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile value={filtered.length ? `${Math.round((made / filtered.length) * 100)}%` : '–'} label={`made (${made}/${filtered.length})`} />
          <Tile value={speedErr.length ? `${signed(calculateMean(speedErr), 0)}%` : '–'} label={speedErr.length ? `average pace vs ideal, ±${calculateStdDev(speedErr).toFixed(0)}%` : 'average pace vs ideal'} />
          <Tile value={lineErr.length ? `${signed(calculateMean(lineErr), 1)}°` : '–'} label={lineErr.length ? `start line bias, ±${calculateStdDev(lineErr).toFixed(1)}°` : 'start line bias'} />
          <Tile value={filtered.filter((s) => !s.isHoled).length ? `${calculateMean(filtered.filter((s) => !s.isHoled).map((s) => s.leaveFt)).toFixed(1)} ft` : '–'} label="average leave on misses" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Panel className="p-5">
            <h2 className="text-lg font-bold">Where putts finish</h2>
            <p className="text-sm text-mist">Relative to the hole, in the direction of each putt. Rings every foot.</p>
            <Dispersion shots={filtered} />
          </Panel>

          <Panel className="p-5">
            <h2 className="text-lg font-bold">Make rate by distance</h2>
            <p className="text-sm text-mist">Your one-putt rate, with {bl.long}&apos;s marked, and strokes gained per putt.</p>
            <div className="mt-4 space-y-3">
              {buckets.map((b, bi) => (
                <div key={b.distanceLabel} className="grid grid-cols-[52px_1fr_88px_56px] items-center gap-3">
                  <span className="num text-lg font-semibold">{b.distanceLabel}</span>
                  <div className="relative h-3 rounded-full bg-club-800">
                    <div
                      className={`h-3 rounded-full ${b.makeRatePct >= bucketBase[bi].base ? 'bg-birdie' : 'bg-par'}`}
                      style={{ width: `${b.attempts ? Math.max(2, b.makeRatePct) : 0}%` }}
                    />
                    <div className="absolute -top-1 h-5 w-0.5 bg-chalk" style={{ left: `${bucketBase[bi].base}%` }} title={`${bl.label} ${Math.round(bucketBase[bi].base)}%`} />
                  </div>
                  <span className="text-right text-sm text-mist">
                    {b.attempts ? (
                      <>
                        <span className="num text-base font-semibold text-chalk">{Math.round(b.makeRatePct)}%</span> of {b.attempts}
                      </>
                    ) : (
                      'no putts'
                    )}
                  </span>
                  <span className={`num text-right text-sm ${bucketBase[bi].sg === null ? 'text-fog' : bucketBase[bi].sg! >= 0 ? 'text-birdie' : 'text-bogey'}`} title="Strokes gained per putt">
                    {bucketBase[bi].sg === null ? '' : signed(bucketBase[bi].sg!, 2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-fog">
              <span className="inline-block h-3 w-0.5 bg-chalk" /> {bl.label} average · right-hand column: strokes gained per putt
              {baseline !== 'tour' && <span className="ml-1">· amateur baselines from Shot Scope make rates and Arccos 3-putt rates</span>}
            </p>
          </Panel>
        </div>

        <Panel className="p-5">
          <h2 className="text-lg font-bold">Green reading</h2>
          {rs ? (
            <>
              <p className="text-sm text-mist">
                From {rs.n} putts where you chose the start line. Your read is tested on its own: SquarePutt rolls your line at perfect pace and checks whether it drops.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Tile value={`${Math.round(rs.readMakePct)}%`} label="of your reads would hole at perfect pace" />
                <Tile value={`${rs.avgErrorDeg.toFixed(2)}°`} label="average gap between your start direction and the ideal one" />
                <Tile
                  value={rs.breakPlayedPct !== null ? `${Math.round(rs.breakPlayedPct)}%` : '–'}
                  label={
                    rs.breakPlayedPct === null
                      ? 'of the break played (no breaking putts yet)'
                      : `of the break you play on breaking putts (${rs.breaking}) — ${rs.breakPlayedPct < 90 ? 'you tend to under-read' : rs.breakPlayedPct > 110 ? 'you tend to over-read' : 'about right'}`
                  }
                />
                <Tile
                  value={rs.breaking ? `${Math.round(rs.underPct)}% / ${Math.round(rs.overPct)}%` : '–'}
                  label="breaking putts under-read / over-read"
                />
              </div>
              {rs.missCause && (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-mist">What cost your {rs.missCause.misses === 1 ? 'miss' : `${rs.missCause.misses} misses`}</div>
                  <div className="mt-2 space-y-2">
                    {(
                      [
                        ['Read', rs.missCause.readPct],
                        ['Face control', rs.missCause.facePct],
                        ['Pace', rs.missCause.pacePct],
                      ] as const
                    ).map(([label, pct]) => (
                      <div key={label} className="grid grid-cols-[88px_1fr_48px] items-center gap-3">
                        <span className="text-sm text-chalk">{label}</span>
                        <div className="h-3 rounded-full bg-club-800">
                          <div className="h-3 rounded-full bg-bogey" style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }} />
                        </div>
                        <span className="num text-right text-sm text-chalk">{Math.round(pct)}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-fog">A miss can count against more than one. Face control: started within ~1.5 in at the hole of your aim (at least 0.5°); pace is good if the ball reached the hole and finished no more than 1.5 ft past (5% of the putt on long ones).</p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-mist">Choose your own start line before putting (◀ ▶, arrow keys or a remote) with &ldquo;Read + line&rdquo; off, and your green-reading accuracy appears here.</p>
          )}
        </Panel>

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Panel className="p-5">
            <h2 className="text-lg font-bold">Personal bests</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Tile value={bests.pressureCircle.bestStreak || '–'} label="Pressure circle: longest streak" />
              <Tile value={bests.leapfrog.best || '–'} label="Leapfrog: most balls" />
              <Tile value={bests.scrambleGauntlet.highestStrokesGained > -900 ? signed(bests.scrambleGauntlet.highestStrokesGained, 1) : '–'} label="Scramble: strokes gained per 18" />
            </div>
          </Panel>
          <Panel className="space-y-3 p-5">
            <h2 className="text-lg font-bold">Your data</h2>
            <p className="text-sm text-mist">Saved in this browser. Export a backup or move it to another computer.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="quiet" onClick={exportData}>Export</Button>
              <Button variant="quiet" onClick={() => fileRef.current?.click()}>Import</Button>
              <Button
                variant="quiet"
                onClick={() => {
                  if (window.confirm('Delete all recorded putts? Personal bests are kept.')) {
                    clearShotHistory();
                    onDataChanged();
                    setMsg('History cleared.');
                  }
                }}
              >
                Clear history
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                f.text().then((t) => {
                  setMsg(importSessionData(t) ? 'Imported.' : 'That file is not a SquarePutt export.');
                  onDataChanged();
                });
              }}
            />
            {msg && <p className="text-sm text-mist">{msg}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Tile({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-club-900 p-4 ring-1 ring-line">
      <div className={`num text-4xl font-semibold ${tone ?? ''}`}>{value}</div>
      <div className="mt-1 text-sm text-mist">{label}</div>
    </div>
  );
}

function Dispersion({ shots }: { shots: PuttingShotData[] }) {
  const R = 6; // feet shown
  const S = 160;
  const pts = shots.filter((s) => !s.isHoled).slice(0, 300);
  const xs = pts.map((s) => s.lateralErrorInches / 12);
  const zs = pts.map((s) => s.distanceErrorFt);
  const mx = calculateMean(xs);
  const mz = calculateMean(zs);
  const k = S / R;
  const clampv = (v: number) => Math.max(-R, Math.min(R, v));
  return (
    <svg viewBox={`${-S - 10} ${-S - 10} ${2 * S + 20} ${2 * S + 20}`} className="mx-auto mt-4 w-full max-w-[440px] overflow-hidden" role="img" aria-label="Scatter of where missed putts finished around the hole">
      {[1, 2, 3, 4, 5, 6].map((r) => (
        <circle key={r} r={r * k} fill={r === 3 ? 'rgba(74,222,128,0.06)' : 'none'} stroke={r === 3 ? '#4ade80' : '#2a4a3b'} strokeWidth={r === 3 ? 1.5 : 1} />
      ))}
      <line x1={-S} x2={S} y1={0} y2={0} stroke="#2a4a3b" />
      <line y1={-S} y2={S} x1={0} x2={0} stroke="#2a4a3b" />
      <text y={-S + 14} textAnchor="middle" fill="#6f8a7c" fontSize={12}>long</text>
      <text y={S - 4} textAnchor="middle" fill="#6f8a7c" fontSize={12}>short</text>
      <text x={-S + 4} y={-6} fill="#6f8a7c" fontSize={12}>left</text>
      <text x={S - 4} y={-6} textAnchor="end" fill="#6f8a7c" fontSize={12}>right</text>
      <circle r={5} fill="#0b1a14" stroke="#eef2ea" strokeWidth={2} />
      {pts.map((s, i) => (
        <circle key={s.id} cx={clampv(xs[i]) * k} cy={-clampv(zs[i]) * k} r={4} fill={zs[i] < 0 ? '#f87171' : '#4fb3ff'} opacity={0.75} />
      ))}
      {pts.length >= 3 && (
        <g transform={`translate(${clampv(mx) * k} ${-clampv(mz) * k})`}>
          <ellipse rx={Math.max(4, calculateStdDev(xs) * k)} ry={Math.max(4, calculateStdDev(zs) * k)} fill="none" stroke="#f5c84c" strokeWidth={2} strokeDasharray="5 4" />
          <circle r={3.5} fill="#f5c84c" />
        </g>
      )}
    </svg>
  );
}
