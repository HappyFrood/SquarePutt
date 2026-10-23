'use client';

import React, { useState, useEffect } from 'react';
import { AppMode, ConnectionState, UserProfile } from '@/lib/types';
import { audioEngine } from './AudioEngine';
import {
  Activity,
  Shield,
  Crosshair,
  Shuffle,
  BarChart3,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
} from 'lucide-react';

interface HeaderProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  connectionState: ConnectionState;
  onOpenConnectModal: () => void;
  profile: UserProfile;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onSelectMode,
  connectionState,
  onOpenConnectModal,
  onOpenSettings,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioEngine.setEnabled(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const navItems: { id: AppMode; label: string; icon: React.ReactNode }[] = [
    { id: 'analysis', label: 'Stroke Analysis', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'pressure-circle', label: 'Pressure Circle', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'speed-control', label: 'Speed Control', icon: <Crosshair className="w-3.5 h-3.5" /> },
    { id: 'scramble-gauntlet', label: 'The Scramble', icon: <Shuffle className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sp-header py-2 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 select-none">
      {/* Brand Logo & Square Monitor Tag */}
      <div className="flex items-center gap-2.5">
        <div className="sp-logo-badge text-lg flex items-center gap-1.5">
          <span className="text-xl">⛳</span>
          <span className="font-extrabold tracking-tight">SquarePutt</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 sp-badge-green text-[10px] py-0.5 px-2">
          <span>KIOSK HUD</span>
        </div>
      </div>

      {/* Navigation Modes Switcher */}
      <nav className="sp-tabs py-0.5 px-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectMode(item.id)}
            className={`sp-tab-btn py-1 px-2.5 text-xs ${activeMode === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span className="hidden md:inline font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Right Controls: Mode Settings, Audio, Fullscreen, Hardware Pill */}
      <div className="flex items-center gap-1.5">
        {/* Mode Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/50 hover:text-white transition-all font-semibold text-xs cursor-pointer shadow-sm"
            title="Configure Mode & Green Settings"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}

        {/* Sound Effects Toggle */}
        <button
          onClick={toggleSound}
          className="p-1.5 rounded-lg bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 transition-colors"
          title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {/* Fullscreen Kiosk Mode Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 transition-colors"
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Kiosk View'}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <Maximize className="w-3.5 h-3.5 text-slate-300" />
          )}
        </button>

        {/* Hardware Status Button */}
        <button
          onClick={onOpenConnectModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            connectionState.connected
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/50'
              : connectionState.connecting
              ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 animate-pulse'
              : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
          }`}
          title="Open Connect API Hardware Settings"
        >
          {connectionState.connected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="hidden sm:inline">
            {connectionState.connected
              ? 'Square Live'
              : connectionState.connecting
              ? 'Connecting...'
              : 'Simulator Mode'}
          </span>
        </button>
      </div>
    </header>
  );
};
