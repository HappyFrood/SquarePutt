'use client';

import React, { useState } from 'react';
import { AppMode, SlopeDifficulty } from '@/lib/types';
import { audioEngine } from '@/components/ui/AudioEngine';
import {
  Settings,
  X,
  Play,
  Activity,
  Shield,
  Crosshair,
  Shuffle,
  Sparkles,
  Navigation,
  Layers,
  Flame,
  Grid,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ModeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AppMode;
  // Environment settings
  stimp: number;
  onStimpChange: (stimp: number) => void;
  slopeDifficulty: SlopeDifficulty;
  onSlopeChange: (diff: SlopeDifficulty) => void;
  targetDistanceFt: number;
  onDistanceChange: (dist: number) => void;
  onRandomizeTerrain?: () => void;
  // 3D Visual Aids
  cameraMode: 'behind' | 'overhead' | 'follow' | 'orbit';
  onCameraChange: (cam: 'behind' | 'overhead' | 'follow' | 'orbit') => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showBreakBeads: boolean;
  onToggleBreakBeads: () => void;
  showAimLine: boolean;
  onToggleAimLine: () => void;
  showStripes: boolean;
  onToggleStripes: () => void;
  // Mode-specific drill props
  holeRadiusMultiplier?: number;
  onHoleRadiusMultiplierChange?: (mult: number) => void;
  onResetDrill?: () => void;
}

export const ModeSettingsModal: React.FC<ModeSettingsModalProps> = ({
  isOpen,
  onClose,
  activeMode,
  stimp,
  onStimpChange,
  slopeDifficulty,
  onSlopeChange,
  targetDistanceFt,
  onDistanceChange,
  onRandomizeTerrain,
  cameraMode,
  onCameraChange,
  showGrid,
  onToggleGrid,
  showHeatmap,
  onToggleHeatmap,
  showBreakBeads,
  onToggleBreakBeads,
  showAimLine,
  onToggleAimLine,
  showStripes,
  onToggleStripes,
  onResetDrill,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => audioEngine.isEnabled());
  const [isPlayingTestSound, setIsPlayingTestSound] = useState<boolean>(false);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioEngine.setEnabled(next);
  };

  const handleTestCupSound = () => {
    audioEngine.setEnabled(true);
    setSoundEnabled(true);
    audioEngine.playCupDrop();
    setIsPlayingTestSound(true);
    setTimeout(() => setIsPlayingTestSound(false), 500);
  };

  if (!isOpen) return null;

  const modeMeta = {
    analysis: {
      title: 'Stroke Analysis Settings',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      tagline: 'Refine launch monitor telemetry, green conditions, and aim aids.',
      color: 'emerald',
    },
    'pressure-circle': {
      title: 'Pressure Circle (Survival Mode) Setup',
      icon: <Shield className="w-5 h-5 text-amber-400" />,
      tagline: 'Consecutive holed putts shrink the cup. One miss resets your streak!',
      color: 'amber',
    },
    'speed-control': {
      title: 'Speed Control (Bullseye) Setup',
      icon: <Crosshair className="w-5 h-5 text-sky-400" />,
      tagline: 'Master distance pacing. Safe zone: 0 to +3.0 ft past cup.',
      color: 'sky',
    },
    'scramble-gauntlet': {
      title: 'The Scramble Gauntlet Setup',
      icon: <Shuffle className="w-5 h-5 text-purple-400" />,
      tagline: '9-hole randomized PGA Tour pressure challenge with live Strokes Gained.',
      color: 'purple',
    },
    analytics: {
      title: 'Session Analytics Options',
      icon: <Settings className="w-5 h-5 text-slate-300" />,
      tagline: 'Putting dispersion, face angle distributions, and historical trends.',
      color: 'slate',
    },
  }[activeMode];

  const quickDistances = [3, 5, 8, 10, 15, 20, 25, 30];

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div
        className="sp-modal-content max-w-2xl w-full p-6 space-y-5 border border-slate-700/80 bg-slate-950/95 backdrop-blur-2xl shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
              {modeMeta.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">{modeMeta.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{modeMeta.tagline}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Target Putting Distance */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-200 uppercase tracking-wider">
              Target Putting Distance
            </label>
            <span className="sp-mono font-black text-emerald-400 text-sm">
              {targetDistanceFt.toFixed(1)} FT
            </span>
          </div>

          {/* Quick Distance Preset Pills */}
          <div className="flex flex-wrap gap-1.5">
            {quickDistances.map((d) => (
              <button
                key={d}
                onClick={() => onDistanceChange(d)}
                className={`py-1 px-3 rounded-lg text-xs font-semibold sp-mono transition-all ${
                  Math.abs(targetDistanceFt - d) < 0.2
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {d} FT
              </button>
            ))}
          </div>

          {/* Custom Distance Slider */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              min="3"
              max="40"
              step="0.5"
              value={targetDistanceFt}
              onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>

        {/* Section 2: Green Speed (USGA Stimpmeter) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-200 uppercase tracking-wider">
                Green Speed (Stimpmeter)
              </span>
              <span className="text-[11px] text-slate-400 ml-2">
                {stimp < 10.0
                  ? 'Muni / Club Average'
                  : stimp < 11.2
                  ? 'PGA Tour Average'
                  : 'Major Championship Lightning'}
              </span>
            </div>
            <span className="sp-mono font-black text-emerald-400 text-sm">
              STIMP {stimp.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono">9.0 Slow</span>
            <input
              type="range"
              min="9.0"
              max="12.5"
              step="0.1"
              value={stimp}
              onChange={(e) => onStimpChange(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-[11px] text-slate-500 font-mono">12.5 Fast</span>
          </div>
        </div>

        {/* Section 3: Terrain Slope & Break */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 uppercase tracking-wider">
              Green Break & Slope
            </span>
            {onRandomizeTerrain && slopeDifficulty !== 'flat' && (
              <button
                onClick={onRandomizeTerrain}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Shuffle className="w-3 h-3" /> Roll New Break
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['flat', 'mild', 'medium', 'hard'] as SlopeDifficulty[]).map((diff) => (
              <button
                key={diff}
                onClick={() => onSlopeChange(diff)}
                className={`py-2 px-3 rounded-xl capitalize font-bold text-xs transition-all border ${
                  slopeDifficulty === diff
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {diff === 'flat' ? 'Flat (Indoor Mat)' : `${diff} Break`}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Camera Angle */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Default 3D Camera Perspective
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'behind', label: 'Behind Ball' },
              { id: 'overhead', label: 'Drone View' },
              { id: 'follow', label: 'Follow Ball' },
              { id: 'orbit', label: '3D Orbit' },
            ].map((cam) => (
              <button
                key={cam.id}
                onClick={() => onCameraChange(cam.id as 'behind' | 'overhead' | 'follow' | 'orbit')}
                className={`py-1.5 px-2 rounded-xl font-bold text-xs transition-all border ${
                  cameraMode === cam.id
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-md'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Visual Guides & PuttView Aids */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            PuttView Augmented Guides
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <button
              onClick={onToggleAimLine}
              className={`p-2 rounded-xl flex items-center gap-2 border font-semibold transition-all ${
                showAimLine
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Laser Aim Line</span>
            </button>

            <button
              onClick={onToggleBreakBeads}
              disabled={slopeDifficulty === 'flat'}
              className={`p-2 rounded-xl flex items-center gap-2 border font-semibold transition-all disabled:opacity-30 ${
                showBreakBeads && slopeDifficulty !== 'flat'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Break Flow Beads</span>
            </button>

            <button
              onClick={onToggleStripes}
              className={`p-2 rounded-xl flex items-center gap-2 border font-semibold transition-all ${
                showStripes
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Mowed Stripes</span>
            </button>

            <button
              onClick={onToggleHeatmap}
              disabled={slopeDifficulty === 'flat'}
              className={`p-2 rounded-xl flex items-center gap-2 border font-semibold transition-all disabled:opacity-30 ${
                showHeatmap && slopeDifficulty !== 'flat'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Elevation Heatmap</span>
            </button>

            <button
              onClick={onToggleGrid}
              className={`p-2 rounded-xl flex items-center gap-2 border font-semibold transition-all ${
                showGrid
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Topography Grid</span>
            </button>
          </div>
        </div>

        {/* Section: Acoustics & Divine Cup Sound */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Acoustics & Cup Sound</span>
            </label>
            <span className="text-[11px] text-emerald-400 font-mono font-medium">
              Physical Acoustic Engine
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>Ball Falling in Cup</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold uppercase tracking-wide border border-emerald-500/30">
                  Divine Audio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Procedural multi-layer physics: lip-clip transient, 480Hz bottom plate impact clack, cavity thud, multi-bounce rattle, and flagstick ferrule chatter.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  soundEnabled
                    ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-red-950/30 text-red-300 border-red-800/40 hover:bg-red-900/40'
                }`}
                title={soundEnabled ? 'Mute app sounds' : 'Enable app sounds'}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    <span>Muted</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleTestCupSound}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                  isPlayingTestSound
                    ? 'bg-emerald-400 text-slate-950 scale-105 shadow-emerald-500/30 font-black'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500 hover:text-slate-950'
                }`}
                title="Play divine regulation cup drop acoustic simulation"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isPlayingTestSound ? 'animate-spin' : ''}`} />
                <span>{isPlayingTestSound ? 'Clacking... ⛳' : '🔊 Test Cup Sound'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {onResetDrill && (
            <button
              onClick={onResetDrill}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Progress</span>
            </button>
          )}
          <div className="flex items-center gap-2.5 ml-auto">
            <button onClick={onClose} className="sp-btn-secondary py-2 px-4 text-xs font-semibold">
              Cancel
            </button>
            <button
              onClick={onClose}
              className="sp-btn-primary py-2 px-6 text-sm font-bold flex items-center gap-2 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Save & Start Putting</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
