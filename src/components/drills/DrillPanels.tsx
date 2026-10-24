'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  PressureConfig,
  PressureState,
  pressureFaceStdDev,
  CIRCLE_BALLS,
  CIRCLE_GOAL,
  LeapConfig,
  LeapState,
  LEAP_START_FT,
  LEAP_END_FT,
  ScrambleConfig,
  ScrambleState,
  scrambleStats,
  gimmeRadiusFt,
  scrambleCurrentDistanceFt,
} from '@/lib/drills';
import { gradeFaceAngleVariance, gradeStrokesGainedPer18 } from '@/lib/calculations';
import { Button, Field, Grade, Panel, Segmented, signed } from '@/components/ui/controls';
import { SLOPE_OPTIONS } from '@/components/settings/SettingsDrawer';
import { SlopeDifficulty } from '@/lib/types';

function Header({ title, sub, onRestart }: { title: string; sub: string; onRestart?: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-line px-5 py-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-mist">{sub}</p>
      </div>
      {onRestart && (
        <button onClick={onRestart} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-fog hover:bg-club-800 hover:text-chalk" title="End and change setup">
          <RotateCcw size={14} /> New game
        </button>
      )}
    </div>
  );
}

function Big({ value, label, tone = 'text-chalk' }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div>
      <div className={`num text-6xl font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-1 text-sm text-mist">{label}</div>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="num text-2xl font-semibold leading-tight">{value}</div>
      <div className="text-xs text-fog">{label}</div>
    </div>
  );
}

/* ---------------------------------- Short putts ---------------------------------- */

export function PressurePanel({
  state,
  config,
  onConfig,
  onStart,
  onReset,
  onNextLevel,
  best,
}: {
  state: PressureState | null;
  config: PressureConfig;
  onConfig: (c: PressureConfig) => void;
  onStart: () => void;
  onReset: () => void;
  onNextLevel: () => void;
  best: number;
}) {
  if (!state) {
    return (
      <Panel>
        <Header title="Pressure circle" sub="12 balls around the hole" />
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-mist">
            Twelve balls ring a random hole, each from a different side, so every putt breaks differently. Hole them in order. Twelve in a row earns a fresh set on the same hole; <strong className="text-chalk">36 in a row wins the level</strong>. Miss once and you start again from ball 1 on a new hole.
          </p>
          <Field label="Circle">
            <Segmented
              value={config.radius}
              onChange={(v) => onConfig({ ...config, radius: v })}
              options={[
                { value: 2, label: '2 ft' },
                { value: 3, label: '3 ft' },
                { value: 4, label: '4 ft' },
              ]}
            />
          </Field>
          <Field label="Slope">
            <Segmented value={config.difficulty} onChange={(v: SlopeDifficulty) => onConfig({ ...config, difficulty: v })} options={SLOPE_OPTIONS} size="sm" />
          </Field>
          <Button onClick={onStart} className="w-full py-3 text-base">Start</Button>
          {best > 0 && <p className="text-center text-sm text-fog">Best run: {best}</p>}
        </div>
      </Panel>
    );
  }

  const sd = pressureFaceStdDev(state);
  const pct = state.attempts ? Math.round((state.makes / state.attempts) * 100) : 0;
  const set = Math.min(2, Math.floor(state.run / CIRCLE_BALLS)); // 0,1,2
  const won = state.status === 'won';
  return (
    <Panel>
      <Header title="Pressure circle" sub={`${state.cfg.radius} ft circle · ${state.cfg.difficulty} slope`} onRestart={onReset} />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-end justify-between">
          <Big value={state.run} label={`in a row · goal ${CIRCLE_GOAL}`} tone={state.run >= 24 ? 'text-flag' : state.run >= 12 ? 'text-birdie' : 'text-chalk'} />
          <div className="pb-1 text-right">
            <div className="num text-lg font-semibold">{won ? 'Done' : `Set ${set + 1} of 3`}</div>
            <div className="text-xs text-fog">hole {state.holes}</div>
          </div>
        </div>
        {/* the 12 balls of the current set */}
        <div className="grid grid-cols-12 gap-1" aria-label="Balls in this set">
          {Array.from({ length: CIRCLE_BALLS }, (_, i) => {
            const done = won || i < state.ballIdx;
            const current = !won && i === state.ballIdx;
            return <span key={i} className={`h-3 rounded-full ${done ? 'bg-birdie' : current ? 'bg-chalk ring-2 ring-flag' : 'bg-club-700'}`} />;
          })}
        </div>
        {/* progress to 36 */}
        <div className="h-2 overflow-hidden rounded-full bg-club-800">
          <div className="h-2 rounded-full bg-flag transition-all" style={{ width: `${(state.run / CIRCLE_GOAL) * 100}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={Math.max(best, state.bestRun)} label="best run" />
          <Stat value={`${pct}%`} label={`made (${state.makes}/${state.attempts})`} />
          <Stat value={state.holes} label="holes played" />
        </div>
        <History items={state.history} />
        {state.faceAngles.length >= 3 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist">Start line spread ±{sd.toFixed(2)}°</span>
            <Grade grade={gradeFaceAngleVariance(sd)} />
          </div>
        )}
        {won && (
          <div className="space-y-2 rounded-xl bg-flag/15 p-4 ring-1 ring-flag">
            <p className="font-semibold text-flag">{state.cfg.radius} ft level complete!</p>
            <p className="text-sm text-mist">
              36 in a row after {state.holes} {state.holes === 1 ? 'hole' : 'holes'} ({state.makes} of {state.attempts} made).
            </p>
            <div className="flex gap-2 pt-1">
              {state.cfg.radius < 4 && <Button onClick={onNextLevel} className="flex-1">Next level: {state.cfg.radius + 1} ft</Button>}
              <Button variant="quiet" onClick={onStart} className="flex-1">Play {state.cfg.radius} ft again</Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function History({ items }: { items: boolean[] }) {
  const last = items.slice(-24);
  if (!last.length) return <p className="text-sm text-fog">Putts appear here as you go.</p>;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Recent makes and misses">
      {last.map((m, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${m ? 'bg-birdie' : 'bg-bogey/80'}`} />
      ))}
    </div>
  );
}

/* ----------------------------------- Lag putts ----------------------------------- */

export function LeapfrogPanel({
  state,
  config,
  onConfig,
  onStart,
  onReset,
  best,
}: {
  state: LeapState | null;
  config: LeapConfig;
  onConfig: (c: LeapConfig) => void;
  onStart: () => void;
  onReset: () => void;
  best: number;
}) {
  if (!state) {
    return (
      <Panel>
        <Header title="Leapfrog" sub="Pace control ladder" />
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-mist">
            Every putt goes from the same spot along a {LEAP_END_FT} ft ladder (no hole). Roll the first ball just past the {LEAP_START_FT} ft rung, then each next ball just past the one before, as close to it as you can. Come up short of the last ball, or roll past the {LEAP_END_FT} ft line, and the round is over: your score is how many balls you fitted in.
          </p>
          <Field label="Slope">
            <Segmented value={config.difficulty} onChange={(v: SlopeDifficulty) => onConfig({ ...config, difficulty: v })} options={SLOPE_OPTIONS} size="sm" />
          </Field>
          <Button onClick={onStart} className="w-full py-3 text-base">Start</Button>
          {best > 0 && <p className="text-center text-sm text-fog">Best: {best} balls</p>}
        </div>
      </Panel>
    );
  }

  const n = state.balls.length;
  const last = n ? state.balls[n - 1].ft : LEAP_START_FT;
  const span = LEAP_END_FT - LEAP_START_FT;
  const pos = (ft: number) => `${((Math.min(LEAP_END_FT, Math.max(LEAP_START_FT, ft)) - LEAP_START_FT) / span) * 100}%`;
  const recentScores = state.scores.slice(-8);
  return (
    <Panel>
      <Header title="Leapfrog" sub={`${LEAP_START_FT}–${LEAP_END_FT} ft ladder · ${state.cfg.difficulty} slope`} onRestart={onReset} />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-end justify-between">
          <Big value={n} label={n === 1 ? 'ball this round' : 'balls this round'} tone={n >= Math.max(1, best) ? 'text-flag' : 'text-chalk'} />
          <div className="pb-1 text-right">
            <div className="num text-lg font-semibold">{(LEAP_END_FT - last).toFixed(1)} ft</div>
            <div className="text-xs text-fog">room left</div>
          </div>
        </div>
        {/* the ladder: where each ball finished */}
        <div>
          <div className="relative h-8 rounded-lg bg-club-800 ring-1 ring-line">
            {Array.from({ length: span / 3 + 1 }, (_, i) => (
              <span key={i} className={`absolute inset-y-1 w-px ${i === 0 ? 'bg-chalk' : i === span / 3 ? 'bg-bogey' : 'bg-club-700'}`} style={{ left: pos(LEAP_START_FT + i * 3) }} />
            ))}
            {state.balls.map((b, i) => (
              <span key={i} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chalk ring-2 ring-club-950" style={{ left: pos(b.ft) }} title={`${b.ft.toFixed(1)} ft`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-fog">
            <span>{LEAP_START_FT} ft</span>
            <span>{LEAP_END_FT} ft</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={Math.max(best, state.best)} label="best" />
          <Stat value={state.rounds} label="round" />
          <Stat value={state.scores.length ? (state.scores.reduce((a, b) => a + b, 0) / state.scores.length).toFixed(1) : '–'} label="average score" />
        </div>
        {recentScores.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-mist">
            Last rounds:
            {recentScores.map((v, i) => (
              <span key={i} className="num rounded-md bg-club-800 px-2 py-0.5 text-chalk">{v}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-fog">Next ball: just past {n ? `${last.toFixed(1)} ft` : `the ${LEAP_START_FT} ft rung`}.</p>
      </div>
    </Panel>
  );
}

/* ---------------------------------- The Scramble ---------------------------------- */

export function ScramblePanel({
  state,
  config,
  onConfig,
  onStart,
  onReset,
  bestSg18,
}: {
  state: ScrambleState | null;
  config: ScrambleConfig;
  onConfig: (c: ScrambleConfig) => void;
  onStart: () => void;
  onReset: () => void;
  bestSg18: number;
}) {
  if (!state) {
    return (
      <Panel>
        <Header title="The Scramble" sub="A putting round on random greens" />
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-mist">
            Every hole is a new green, length (6–40 ft) and break. Putt out from wherever the ball stops; anything inside the gimme circle is given. Par is two putts a hole, and strokes gained compares you with PGA Tour players from the same distances.
          </p>
          <Field label="Holes">
            <Segmented value={config.holes} onChange={(v) => onConfig({ ...config, holes: v })} options={[{ value: 9, label: '9 holes' }, { value: 18, label: '18 holes' }]} />
          </Field>
          <Field label="Greens">
            <Segmented
              value={config.difficulty}
              onChange={(v) => onConfig({ ...config, difficulty: v })}
              options={[{ value: 'mixed', label: 'Mixed' }, { value: 'mild', label: 'Mild' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
              size="sm"
            />
          </Field>
          <Button onClick={onStart} className="w-full py-3 text-base">Tee off</Button>
          {bestSg18 > -900 && <p className="text-center text-sm text-fog">Best: {signed(bestSg18, 1)} strokes gained per 18</p>}
        </div>
      </Panel>
    );
  }

  const st = scrambleStats(state);
  const hole = state.holes[Math.min(state.holeIdx, state.holes.length - 1)];
  const cur = scrambleCurrentDistanceFt(state);
  const toPar = st.toPar === 0 ? 'E' : signed(st.toPar, 0);
  return (
    <Panel>
      <Header
        title="The Scramble"
        sub={state.status === 'over' ? 'Round complete' : `Hole ${state.holeIdx + 1} of ${state.holes.length} · ${hole.difficulty} green`}
        onRestart={onReset}
      />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-end justify-between">
          <Big value={toPar} label="to par" tone={st.toPar < 0 ? 'text-birdie' : st.toPar > 0 ? 'text-bogey' : 'text-chalk'} />
          <div className="text-right">
            <div className={`num text-3xl font-semibold ${st.sgTotal >= 0 ? 'text-birdie' : 'text-bogey'}`}>{signed(st.sgTotal, 2)}</div>
            <div className="text-xs text-fog">strokes gained</div>
          </div>
        </div>
        {state.status !== 'over' && (
          <div className="grid grid-cols-3 gap-3">
            <Stat value={`${cur.toFixed(cur < 10 ? 1 : 0)} ft`} label={state.strokes ? `putt ${state.strokes + 1}` : 'first putt'} />
            <Stat value={`${gimmeRadiusFt(cur).toFixed(1)} ft`} label="gimme" />
            <Stat value={st.totalStrokes} label="putts so far" />
          </div>
        )}
        <Scorecard state={state} />
        {state.status === 'over' && (
          <div className="space-y-2 rounded-xl bg-club-950/70 p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{st.totalStrokes} putts · {signed(st.sgPer18, 1)} per 18</p>
              <Grade grade={gradeStrokesGainedPer18(st.sgPer18)} />
            </div>
            <p className="text-sm text-mist">
              {st.onePutts} one-putts · {st.threePutts} three-putts · half your first putts finished within {(st.cepInches / 12).toFixed(1)} ft
            </p>
            <div className="flex gap-2 pt-1">
              <Button onClick={onStart} className="flex-1">New round</Button>
              <Button variant="quiet" onClick={onReset} className="flex-1">Change setup</Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Scorecard({ state }: { state: ScrambleState }) {
  return (
    <div className="grid grid-cols-9 gap-1">
      {state.holes.map((h, i) => {
        const r = state.card[i];
        const cls = !r
          ? i === state.holeIdx
            ? 'ring-2 ring-flag text-chalk'
            : 'bg-club-800 text-fog'
          : r.strokes === 1
          ? 'bg-birdie text-club-950'
          : r.strokes === 2
          ? 'bg-chalk text-club-950'
          : 'bg-bogey text-club-950';
        return (
          <div key={i} className={`num rounded-md py-1 text-center text-sm font-semibold ${cls}`} title={`Hole ${i + 1}: ${h.startDistanceFt} ft`}>
            {r ? r.strokes : i + 1}
          </div>
        );
      })}
    </div>
  );
}
