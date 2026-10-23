'use client';

import React, { useState } from 'react';
import { PuttingShotData, UserProfile } from '@/lib/types';
import {
  getActiveProfile,
  saveActiveProfile,
  getDrillBests,
  clearShotHistory,
  exportSessionData,
  importSessionData,
} from '@/lib/storage';
import { QUINTIC_TIERS } from '@/lib/calculations';
import {
  User,
  Trophy,
  History,
  Download,
  Upload,
  Trash2,
  Check,
} from 'lucide-react';

interface SessionHistoryViewProps {
  shots: PuttingShotData[];
  onShotsUpdated: () => void;
}

export const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  shots,
  onShotsUpdated,
}) => {
  const [profile, setProfile] = useState<UserProfile>(getActiveProfile());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [handicapInput, setHandicapInput] = useState(profile.handicap.toString());
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const drillBests = getDrillBests();

  const handleSaveProfile = () => {
    const updated: UserProfile = {
      ...profile,
      name: nameInput.trim() || 'Golfer',
      handicap: parseFloat(handicapInput) || 0.0,
    };
    saveActiveProfile(updated);
    setProfile(updated);
    setIsEditingProfile(false);
  };

  const handleExport = () => {
    const dataStr = exportSessionData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SquarePutt_Session_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ok = importSessionData(content);
      if (ok) {
        setImportStatus('Data imported successfully!');
        setProfile(getActiveProfile());
        onShotsUpdated();
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus('Failed to import JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your local putting shot history?')) {
      clearShotHistory();
      onShotsUpdated();
    }
  };

  return (
    <div className="space-y-4">
      {/* User Profile & Drill High Scores Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Profile Card */}
        <div className="sp-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Player Profile</span>
            </span>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="text-xs text-emerald-400 hover:underline"
            >
              {isEditingProfile ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditingProfile ? (
            <div className="space-y-2 my-1">
              <div>
                <label className="text-[10px] text-slate-400">Player Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Handicap Index</label>
                <input
                  type="number"
                  step="0.1"
                  value={handicapInput}
                  onChange={(e) => setHandicapInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                />
              </div>
              <button onClick={handleSaveProfile} className="sp-btn-primary w-full text-xs py-1 mt-1">
                Save Profile
              </button>
            </div>
          ) : (
            <div className="my-1">
              <div className="text-xl font-black text-slate-100">{profile.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Handicap: <strong className="text-emerald-400">{profile.handicap.toFixed(1)}</strong> | Stimp: {profile.preferredStimp}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
            Cloud Sync: Local Storage Ready (PostgreSQL Schema Compatible)
          </div>
        </div>

        {/* Drill High Scores */}
        <div className="sp-card p-4 md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Drill Personal Bests</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ALL-TIME</span>
          </div>

          <div className="grid grid-cols-3 gap-3 my-1">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 uppercase">Pressure Circle</div>
              <div className="sp-mono font-black text-xl text-amber-400 my-0.5">
                {drillBests.pressureCircle.bestStreak}
              </div>
              <div className="text-[9px] text-slate-500">Consecutive Makes</div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 uppercase">Speed Control</div>
              <div className="sp-mono font-black text-xl text-sky-400 my-0.5">
                {drillBests.speedControl.highScore}
              </div>
              <div className="text-[9px] text-slate-500">Bullseye Points</div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 uppercase">Scramble Gauntlet</div>
              <div className="sp-mono font-black text-xl text-emerald-400 my-0.5">
                {drillBests.scrambleGauntlet.highestStrokesGained > -900
                  ? drillBests.scrambleGauntlet.highestStrokesGained > 0
                    ? `+${drillBests.scrambleGauntlet.highestStrokesGained.toFixed(2)}`
                    : drillBests.scrambleGauntlet.highestStrokesGained.toFixed(2)
                  : '--'}
              </div>
              <div className="text-[9px] text-slate-500">Strokes Gained</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="sp-btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                title="Export session data as JSON file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <label className="sp-btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

              {importStatus && (
                <span className="text-emerald-400 text-xs font-medium ml-2 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {importStatus}
                </span>
              )}
            </div>

            <button
              onClick={handleClearHistory}
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historical Putts Table */}
      <div className="sp-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Complete Session Shot History ({shots.length} Putts)
            </h3>
          </div>
        </div>

        {shots.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono">
            No shots in history yet. Strike putts on the green to log telemetry!
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-2 pl-2">#</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Target</th>
                  <th className="py-2">Rolled</th>
                  <th className="py-2">Speed</th>
                  <th className="py-2">Face</th>
                  <th className="py-2">Path</th>
                  <th className="py-2">AoA</th>
                  <th className="py-2">Skid</th>
                  <th className="py-2 pr-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {shots.map((shot, idx) => (
                  <tr key={shot.id} className="hover:bg-slate-800/30">
                    <td className="py-2 pl-2 text-slate-500">{shots.length - idx}</td>
                    <td className="py-2 text-slate-400">
                      {new Date(shot.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2 text-slate-300">{shot.targetDistanceFt.toFixed(1)} ft</td>
                    <td className="py-2 font-bold text-slate-200">
                      {shot.rollDistanceFt.toFixed(1)} ft
                    </td>
                    <td className="py-2 text-emerald-400">{shot.ballSpeedMph.toFixed(1)} mph</td>
                    <td
                      className="py-2 font-semibold"
                      style={{ color: QUINTIC_TIERS[shot.grades.faceAngleGrade].color }}
                    >
                      {shot.faceAngleDeg > 0
                        ? `+${shot.faceAngleDeg.toFixed(1)}°`
                        : `${shot.faceAngleDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-sky-400">
                      {shot.putterPathDeg > 0
                        ? `+${shot.putterPathDeg.toFixed(1)}°`
                        : `${shot.putterPathDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-purple-400">
                      {shot.angleOfAttackDeg > 0
                        ? `+${shot.angleOfAttackDeg.toFixed(1)}°`
                        : `${shot.angleOfAttackDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-amber-400">{shot.skidDistanceInches.toFixed(1)}″</td>
                    <td className="py-2 pr-2 text-right">
                      {shot.isHoled ? (
                        <span className="text-emerald-400 font-bold">⛳ HOLED</span>
                      ) : (
                        <span className="text-slate-400">
                          {shot.distanceErrorFt > 0
                            ? `+${shot.distanceErrorFt.toFixed(1)}ft`
                            : `${shot.distanceErrorFt.toFixed(1)}ft`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
