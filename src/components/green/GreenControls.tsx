'use client';

import React from 'react';
import { SlopeDifficulty } from '@/lib/types';
import { Grid, Flame, Shuffle, Video, Sparkles, Navigation, Layers } from 'lucide-react';

interface GreenControlsProps {
  stimp: number;
  onStimpChange: (stimp: number) => void;
  slopeDifficulty: SlopeDifficulty;
  onSlopeChange: (diff: SlopeDifficulty) => void;
  cameraMode: 'behind' | 'overhead' | 'follow' | 'orbit';
  onCameraChange: (mode: 'behind' | 'overhead' | 'follow' | 'orbit') => void;
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
  onRandomizeTerrain?: () => void;
  disabled?: boolean;
}

export const GreenControls: React.FC<GreenControlsProps> = ({
  stimp,
  onStimpChange,
  slopeDifficulty,
  onSlopeChange,
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
  onRandomizeTerrain,
  disabled = false,
}) => {
  return (
    <div className="sp-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Stimp Slider */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <span className="text-slate-400 font-medium">Stimp:</span>
        <input
          type="range"
          min="9.0"
          max="12.0"
          step="0.1"
          value={stimp}
          disabled={disabled}
          onChange={(e) => onStimpChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="sp-mono font-bold text-emerald-400 text-sm w-9 text-right">
          {stimp.toFixed(1)}
        </span>
      </div>

      {/* Slope Difficulty Selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium mr-1">Slope:</span>
        {(['flat', 'mild', 'medium', 'hard'] as SlopeDifficulty[]).map((diff) => (
          <button
            key={diff}
            onClick={() => onSlopeChange(diff)}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
              slopeDifficulty === diff
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-transparent'
            }`}
          >
            {diff}
          </button>
        ))}
      </div>

      {/* Visual Overlays & PuttView Features */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Mowed Stripes Toggle */}
        <button
          onClick={onToggleStripes}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium border transition-all ${
            showStripes
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle Tournament Mowed Turf Stripes"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Stripes</span>
        </button>

        {/* Break Beads (PuttView Style) */}
        <button
          onClick={onToggleBreakBeads}
          disabled={slopeDifficulty === 'flat'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium border transition-all disabled:opacity-40 ${
            showBreakBeads && slopeDifficulty !== 'flat'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle PuttView Animated Break Beads"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Break Flow</span>
        </button>

        {/* Laser Aim Line */}
        <button
          onClick={onToggleAimLine}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium border transition-all ${
            showAimLine
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle Laser Aim Guideline"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Aim Laser</span>
        </button>

        {/* Heatmap Toggle */}
        <button
          onClick={onToggleHeatmap}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium border transition-all ${
            showHeatmap
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle Elevation Heatmap Shading"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Heatmap</span>
        </button>

        {/* AR Grid */}
        <button
          onClick={onToggleGrid}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium border transition-all ${
            showGrid
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
          }`}
          title="Toggle AR Wireframe Topography Grid"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>

        {onRandomizeTerrain && (
          <button
            onClick={onRandomizeTerrain}
            disabled={disabled || slopeDifficulty === 'flat'}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:text-slate-200 disabled:opacity-40"
            title="Randomize Green Undulations / Break"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>New Break</span>
          </button>
        )}
      </div>

      {/* Camera Modes */}
      <div className="flex items-center gap-1 border-l border-slate-700/50 pl-2">
        <span className="text-slate-400 mr-1 flex items-center gap-1">
          <Video className="w-3.5 h-3.5" />
          <span>Cam:</span>
        </span>
        {[
          { id: 'behind', label: 'Behind' },
          { id: 'overhead', label: 'Drone' },
          { id: 'follow', label: 'Follow' },
          { id: 'orbit', label: 'Orbit' },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => onCameraChange(c.id as typeof cameraMode)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
              cameraMode === c.id
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
};
