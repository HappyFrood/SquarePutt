'use client';

import React from 'react';
import { X, Shuffle } from 'lucide-react';
import { AppSettings } from '@/lib/settings';
import { AppMode, SlopeDifficulty } from '@/lib/types';
import { Button, Field, Segmented, Toggle } from '@/components/ui/controls';
import { audioEngine } from '@/components/ui/AudioEngine';
import { flatDistanceFt } from '@/lib/physicsEngine';

export const SLOPE_OPTIONS: { value: SlopeDifficulty; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const REAL_SLOPE_HINT: Record<SlopeDifficulty, string> = {
  flat: 'Dead level — pure stroke mechanics.',
  mild: 'The gentlest third of real championship pin positions.',
  medium: 'Typical championship pins: distinct breaks around the hole.',
  hard: 'The most severe third — Augusta-style slopes around the hole.',
};

const SLOPE_HINT: Record<SlopeDifficulty, string> = {
  flat: 'Dead level — pure stroke mechanics.',
  mild: 'Gentle breaks, up to 1°.',
  medium: 'Typical course greens, up to 2°.',
  hard: 'Tiers and severe undulation, up to 3°.',
};

function stimpLabel(s: number) {
  if (s < 9.5) return 'Everyday club greens';
  if (s < 10.8) return 'Well-kept club greens';
  if (s < 11.8) return 'Tour average';
  return 'Major championship';
}

export function SettingsDrawer({
  open,
  onClose,
  mode,
  settings,
  onChange,
  onNewGreen,
  realGreensAvailable,
}: {
  open: boolean;
  onClose: () => void;
  mode: AppMode;
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onNewGreen: () => void;
  realGreensAvailable: boolean;
}) {
  if (!open) return null;
  const s = settings;
  const practice = mode === 'analysis';
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="sp-slide flex h-full w-[400px] max-w-full flex-col bg-club-900 ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-club-800 hover:text-chalk">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
          <Group title="Green">
            {realGreensAvailable && (
              <Field label="Greens">
                <Segmented
                  value={s.greenSource}
                  onChange={(v) => onChange({ greenSource: v })}
                  options={[
                    { value: 'real', label: 'Real greens' },
                    { value: 'generated', label: 'Generated' },
                  ]}
                />
                <p className="text-xs text-fog">
                  {s.greenSource === 'real'
                    ? '19 surveyed greens from Augusta National, Hazeltine, Cog Hill, TPC Sawgrass and Pinehurst No. 2, each with rated pin positions.'
                    : 'Endless computer-generated greens.'}
                </p>
              </Field>
            )}
            <Field label={`Speed — ${stimpLabel(s.stimp)}`} value={`Stimp ${s.stimp.toFixed(1)}`}>
              <input
                type="range"
                min={9}
                max={12}
                step={0.1}
                value={s.stimp}
                onChange={(e) => onChange({ stimp: parseFloat(e.target.value) })}
                className="w-full"
                aria-label="Stimp"
              />
              <p className="text-xs text-fog">
                A 6 mph putt rolls {flatDistanceFt(6, s.stimp).toFixed(0)} ft on flat ground at this speed.
              </p>
            </Field>

            {practice && (
              <>
                <Field label="Distance" value={`${s.practiceDistanceFt} ft`}>
                  <input
                    type="range"
                    min={3}
                    max={50}
                    step={1}
                    value={s.practiceDistanceFt}
                    onChange={(e) => onChange({ practiceDistanceFt: parseInt(e.target.value, 10) })}
                    className="w-full"
                    aria-label="Distance"
                  />
                  <div className="flex gap-1.5">
                    {[3, 5, 8, 12, 20, 30, 40].map((d) => (
                      <button
                        key={d}
                        onClick={() => onChange({ practiceDistanceFt: d })}
                        className={`num flex-1 rounded-md py-1 text-sm font-semibold ${s.practiceDistanceFt === d ? 'bg-chalk text-club-950' : 'bg-club-800 text-mist hover:text-chalk'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Slope">
                  <Segmented value={s.practiceDifficulty} options={SLOPE_OPTIONS} onChange={(v) => onChange({ practiceDifficulty: v })} />
                  <p className="text-xs text-fog">{(realGreensAvailable && s.greenSource === 'real' ? REAL_SLOPE_HINT : SLOPE_HINT)[s.practiceDifficulty]}</p>
                </Field>
                <Button variant="quiet" onClick={onNewGreen} className="w-full" disabled={s.practiceDifficulty === 'flat'}>
                  <Shuffle size={16} /> {realGreensAvailable && s.greenSource === 'real' ? 'Next green or pin' : 'New green'}
                </Button>
              </>
            )}
            {!practice && mode !== 'analytics' && (
              <p className="text-xs text-fog">Distance and slope are set by the drill.</p>
            )}
          </Group>

          <Group title="Green reading">
            <Field label="Ideal pace — finishes past the hole">
              <Segmented
                value={s.idealPastIn}
                onChange={(v) => onChange({ idealPastIn: v })}
                options={[
                  { value: 6, label: '6 in' },
                  { value: 8.5, label: '8.5 in' },
                  { value: 12, label: '12 in' },
                  { value: 17, label: '17 in' },
                ]}
              />
              <p className="text-xs text-fog">
                {s.idealPastIn === 6
                  ? 'Dies at the hole: widest cup, most break, least margin if short.'
                  : s.idealPastIn === 8.5
                  ? 'Two cups past (default): a soft pace with a little margin.'
                  : s.idealPastIn === 12
                  ? 'One foot past: the common tour target.'
                  : 'Pelz: firm enough to roll through the bumpy ring around real holes.'}{' '}
                Sets the ideal line and speed that your pace and read are judged against.
              </p>
            </Field>
            <Field label="Help reading the putt">
              <Segmented
                value={s.readAssist}
                onChange={(v) => onChange({ readAssist: v })}
                options={[
                  { value: 'off', label: 'None' },
                  { value: 'read', label: 'Read' },
                  { value: 'line', label: 'Read + line' },
                ]}
              />
              <p className="text-xs text-fog">
                {s.readAssist === 'off'
                  ? 'Read it yourself, like on the course.'
                  : s.readAssist === 'read'
                  ? 'Shows slope, elevation and where to aim.'
                  : 'Also draws the ideal path at perfect speed, and sets your start line to it.'}
              </p>
            </Field>
            <div className="divide-y divide-line/60">
              <Toggle checked={s.fallLines} onChange={(v) => onChange({ fallLines: v })} label="Slope lines" hint="A small arrow on each grid edge slides downhill along that edge — combine the two directions to find the fall line. Steeper slopes move faster." />
              <Toggle checked={s.grid} onChange={(v) => onChange({ grid: v })} label="1 ft grid" hint="Bends with the surface to show contour" />
              <Toggle checked={s.contours} onChange={(v) => onChange({ contours: v })} label="Contour lines" hint="Lines of equal height" />
              <Toggle checked={s.heatmap} onChange={(v) => onChange({ heatmap: v })} label="Height map" hint="Red is high, blue is low" />
            </div>
          </Group>

          <Group title="Camera">
            <Segmented
              value={s.camera}
              onChange={(v) => onChange({ camera: v })}
              options={[
                { value: 'behind', label: 'Behind ball' },
                { value: 'follow', label: 'Follow' },
                { value: 'overhead', label: 'Overhead' },
                { value: 'orbit', label: 'Free' },
              ]}
              size="sm"
            />
            {s.camera === 'orbit' && <p className="text-xs text-fog">Drag to rotate, scroll to zoom.</p>}
          </Group>

          <Group title="Launch monitor">
            <Field label="Ball speed calibration" value={`${Math.round(s.speedCalibration * 100)}%`}>
              <input
                type="range"
                min={0.85}
                max={1.15}
                step={0.01}
                value={s.speedCalibration}
                onChange={(e) => onChange({ speedCalibration: parseFloat(e.target.value) })}
                className="w-full"
                aria-label="Ball speed calibration"
              />
              <p className="text-xs text-fog">
                If putts you hit on your mat consistently roll farther or shorter here than they would on a real green of this speed, nudge this. 100% uses the monitor&apos;s reading as is.
              </p>
            </Field>
          </Group>

          <Group title="Sound">
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => audioEngine.playPutterStrike()}>Play strike</Button>
              <Button variant="quiet" onClick={() => audioEngine.playCupDrop()}>Play cup drop</Button>
            </div>
          </Group>
        </div>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-bold text-chalk">{title}</h3>
      {children}
    </section>
  );
}
