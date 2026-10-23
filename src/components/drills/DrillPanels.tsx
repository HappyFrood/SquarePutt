'use client';

import React from 'react';
import { Heart, RotateCcw } from 'lucide-react';
import {
  PressureConfig,
  PressureState,
  pressureFaceStdDev,
  cupMultiplierForStreak,
  LagConfig,
  LagState,
  lagStats,
  lagRating,
  LagZone,
  ScrambleConfig,
  ScrambleState,
  scrambleStats,
  gimmeRadiusFt,
  scrambleCurrentDistanceFt,
} from '@/lib/drills';
import { gradeFaceAngleVariance, gradeDistanceDispersion, gradeStrokesGainedPer18 } from '@/lib/calculations';
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
  best,
}: {
  state: PressureState | null;
  config: PressureConfig;
  onConfig: (c: PressureConfig) => void;
  onStart: () => void;
  onReset: () => void;
  best: number;
}) {
  if (!state) {
    return (
      <Panel>
        <Header title="Pressure circle" sub="Short putts, survival style" />
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-mist">
            Every putt comes from a new spot around the hole, so each one breaks differently. Makes in a row shrink the cup. Run out of lives and the game ends.
          </p>
          <Field label="Distance">
            <Segmented
              value={config.distance}
              onChange={(v) => onConfig({ ...config, distance: v })}
              options={[
                { value: 3, label: '3 ft' },
                { value: 5, label: '5 ft' },
                { value: 8, label: '8 ft' },
                { value: 'ladder', label: '3→8 ladder' },
              ]}
            />
          </Field>
          <Field label="Lives">
            <Segmented value={config.lives} onChange={(v) => onConfig({ ...config, lives: v })} options={[{ value: 1, label: 'One miss' }, { value: 3, label: '3' }, { value: 5, label: '5' }]} />
          </Field>
          <Field label="Slope">
            <Segmented value={config.difficulty} onChange={(v: SlopeDifficulty) => onConfig({ ...config, difficulty: v })} options={SLOPE_OPTIONS} size="sm" />
          </Field>
          <Button onClick={onStart} className="w-full py-3 text-base">Start</Button>
          {best > 0 && <p className="text-center text-sm text-fog">Best streak: {best}</p>}
        </div>
      </Panel>
    );
  }

  const sd = pressureFaceStdDev(state);
  const pct = state.attempts ? Math.round((state.makes / state.attempts) * 100) : 0;
  return (
    <Panel>
      <Header title="Pressure circle" sub={`${state.distanceFt} ft · ${state.cfg.difficulty} slope`} onRestart={onReset} />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-end justify-between">
          <Big value={state.streak} label="in a row" tone={state.streak >= 5 ? 'text-flag' : 'text-chalk'} />
          <div className="flex gap-1 pb-2" aria-label={`${state.lives} lives left`}>
            {Array.from({ length: state.cfg.lives }, (_, i) => (
              <Heart key={i} size={22} className={i < state.lives ? 'fill-bogey text-bogey' : 'text-club-700'} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${(4.25 * cupMultiplierForStreak(state.streak)).toFixed(2)}″`} label="cup size" />
          <Stat value={`${pct}%`} label={`made (${state.makes}/${state.attempts})`} />
          <Stat value={Math.max(best, state.bestStreak)} label="best streak" />
        </div>
        <History items={state.history} />
        {state.faceAngles.length >= 3 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist">Start line spread ±{sd.toFixed(2)}°</span>
            <Grade grade={gradeFaceAngleVariance(sd)} />
          </div>
        )}
        {state.status === 'over' && (
          <div className="space-y-2 rounded-xl bg-club-950/70 p-4 ring-1 ring-line">
            <p className="font-semibold">Game over</p>
            <p className="text-sm text-mist">
              {state.makes} of {state.attempts} made, best run {state.bestStreak}. {state.bestStreak >= best && state.bestStreak > 0 ? 'New personal best.' : ''}
            </p>
            <div className="flex gap-2 pt-1">
              <Button onClick={onStart} className="flex-1">Play again</Button>
              <Button variant="quiet" onClick={onReset} className="flex-1">Change setup</Button>
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

const ZONE_CLS: Record<LagZone, string> = {
  holed: 'bg-eagle text-club-950',
  zone: 'bg-birdie text-club-950',
  'close-short': 'bg-par text-club-950',
  long: 'bg-club-700 text-chalk',
  short: 'bg-bogey text-club-950',
  'way-long': 'bg-bogey text-club-950',
};

export function LagPanel({
  state,
  config,
  onConfig,
  onStart,
  onReset,
  best,
}: {
  state: LagState | null;
  config: LagConfig;
  onConfig: (c: LagConfig) => void;
  onStart: () => void;
  onReset: () => void;
  best: number;
}) {
  if (!state) {
    return (
      <Panel>
        <Header title="Speed control" sub="Lag putts into the 3 ft zone" />
        <div className="space-y-5 px-5 py-5">
          <ul className="space-y-1 text-sm text-mist">
            <li><span className="font-semibold text-chalk">+5</span> holed · <span className="font-semibold text-chalk">+3</span> past the hole, within 3 ft</li>
            <li><span className="font-semibold text-chalk">+1</span> within 3 ft but short · <span className="font-semibold text-chalk">−1</span> short, or over 6 ft long</li>
            <li>Three good ones in a row start a <span className="font-semibold text-chalk">+1</span> combo.</li>
          </ul>
          <Field label="Distance">
            <Segmented
              value={config.distance}
              onChange={(v) => onConfig({ ...config, distance: v })}
              options={[{ value: 20, label: '20 ft' }, { value: 30, label: '30 ft' }, { value: 50, label: '50 ft' }, { value: 'mixed', label: 'Mixed' }]}
            />
            <p className="text-xs text-fog">Mixed (20–50 ft) is the best practice — changing length every putt builds feel that holds up on the course.</p>
          </Field>
          <Field label="Putts per set">
            <Segmented value={config.putts} onChange={(v) => onConfig({ ...config, putts: v })} options={[{ value: 10, label: '10' }, { value: 15, label: '15' }]} />
          </Field>
          <Field label="Slope">
            <Segmented value={config.difficulty} onChange={(v: SlopeDifficulty) => onConfig({ ...config, difficulty: v })} options={SLOPE_OPTIONS} size="sm" />
          </Field>
          <Button onClick={onStart} className="w-full py-3 text-base">Start set</Button>
          {best > 0 && <p className="text-center text-sm text-fog">High score: {best}</p>}
        </div>
      </Panel>
    );
  }

  const st = lagStats(state);
  const cur = state.distances[Math.min(state.idx, state.distances.length - 1)];
  return (
    <Panel>
      <Header title="Speed control" sub={state.status === 'over' ? 'Set complete' : `Putt ${state.idx + 1} of ${state.distances.length} · ${cur} ft`} onRestart={onReset} />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-end justify-between">
          <Big value={state.score} label="points" />
          {state.combo >= 2 && <span className="mb-2 rounded-full bg-flag px-3 py-1 text-sm font-bold text-flag-ink">Combo ×{state.combo}</span>}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {state.distances.map((d, i) => {
            const r = state.results[i];
            return (
              <div
                key={i}
                className={`num rounded-md py-1 text-center text-sm font-semibold ${r ? ZONE_CLS[r.zone] : i === state.idx ? 'ring-2 ring-flag text-chalk' : 'bg-club-800 text-fog'}`}
                title={r ? `${d} ft → left ${r.leaveFt.toFixed(1)} ft` : `${d} ft`}
              >
                {r ? signed(r.points, 0) : d}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${st.inZone}/${state.results.length}`} label="in the zone" />
          <Stat value={st.shortCount} label="left short" />
          <Stat value={Math.max(best, state.score)} label="high score" />
        </div>
        {state.results.length >= 3 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist">Distance spread ±{st.distanceStdDevFt.toFixed(1)} ft</span>
            <Grade grade={gradeDistanceDispersion(st.distanceStdDevFt)} />
          </div>
        )}
        {state.status === 'over' && (
          <div className="space-y-2 rounded-xl bg-club-950/70 p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{state.score} points</p>
              <Grade grade={lagRating(state.score, state.distances.length)} />
            </div>
            <p className="text-sm text-mist">
              {st.inZone} of {state.results.length} in the zone · best combo {state.bestCombo} · {st.threePuttRisk} left over 6 ft
            </p>
            <div className="flex gap-2 pt-1">
              <Button onClick={onStart} className="flex-1">New set</Button>
              <Button variant="quiet" onClick={onReset} className="flex-1">Change setup</Button>
            </div>
          </div>
        )}
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
