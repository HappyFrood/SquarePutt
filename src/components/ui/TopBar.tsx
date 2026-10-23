'use client';

import React, { useEffect, useState } from 'react';
import { AppMode, ConnectionState } from '@/lib/types';
import { audioEngine } from './AudioEngine';
import { Maximize, Minimize, Settings2, Volume2, VolumeX } from 'lucide-react';

const MODES: { id: AppMode; label: string }[] = [
  { id: 'analysis', label: 'Practice' },
  { id: 'pressure-circle', label: 'Short putts' },
  { id: 'speed-control', label: 'Lag putts' },
  { id: 'scramble-gauntlet', label: 'Scramble' },
  { id: 'analytics', label: 'Stats' },
];

export function TopBar({
  mode,
  onMode,
  connection,
  onOpenConnection,
  onOpenSettings,
}: {
  mode: AppMode;
  onMode: (m: AppMode) => void;
  connection: ConnectionState;
  onOpenConnection: () => void;
  onOpenSettings: () => void;
}) {
  const [sound, setSound] = useState(() => audioEngine.isEnabled());
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const live = connection.connected && connection.launchMonitorConnected;
  const status = live
    ? connection.launchMonitorName ?? 'Launch monitor'
    : connection.connected
    ? 'Bridge on — waiting for monitor'
    : 'No launch monitor';

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-club-950 px-4">
      <div className="flex items-center gap-2 pr-2">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="2" width="2" height="20" rx="1" fill="#eef2ea" />
          <path d="M6 3 L19 7 L6 11 Z" fill="#f5c84c" />
          <ellipse cx="5" cy="21.5" rx="4" ry="1.3" fill="#33614b" />
        </svg>
        <span className="text-lg font-bold tracking-tight">SquarePutt</span>
      </div>

      <nav className="flex h-full items-stretch gap-1">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => onMode(m.id)}
              className={`relative px-3 text-sm font-semibold transition-colors ${active ? 'text-chalk' : 'text-fog hover:text-mist'}`}
            >
              {m.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-flag" />}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={onOpenConnection}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-mist ring-1 ring-line hover:text-chalk"
        >
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-birdie' : connection.connected ? 'bg-par' : 'bg-fog'}`} />
          {status}
        </button>
        <IconBtn
          label={sound ? 'Mute' : 'Unmute'}
          onClick={() => {
            audioEngine.setEnabled(!sound);
            setSound(!sound);
          }}
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </IconBtn>
        <IconBtn
          label={fs ? 'Exit full screen' : 'Full screen'}
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
        >
          {fs ? <Minimize size={18} /> : <Maximize size={18} />}
        </IconBtn>
        <IconBtn label="Settings" onClick={onOpenSettings}>
          <Settings2 size={18} />
        </IconBtn>
      </div>
    </header>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-club-800 hover:text-chalk">
      {children}
    </button>
  );
}
