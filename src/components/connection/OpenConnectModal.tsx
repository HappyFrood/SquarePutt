'use client';

import React, { useState } from 'react';
import { ConnectionState } from '@/lib/types';
import { openConnectService } from '@/lib/openConnectService';
import {
  Radio,
  HelpCircle,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface OpenConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: ConnectionState;
}

export const OpenConnectModal: React.FC<OpenConnectModalProps> = ({
  isOpen,
  onClose,
  connectionState,
}) => {
  const [portInput, setPortInput] = useState(connectionState.port.toString());

  if (!isOpen) return null;

  const handleApplyPort = () => {
    const p = parseInt(portInput, 10);
    if (!isNaN(p) && p > 0 && p < 65536) {
      openConnectService.setPort(p);
    }
  };

  const handleToggleConnect = () => {
    if (connectionState.connected || connectionState.connecting) {
      openConnectService.disconnect();
    } else {
      openConnectService.connect();
    }
  };

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div
        className="sp-modal-content p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              Open Connect API Hardware Bridge
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Box */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            connectionState.connected
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : connectionState.connecting
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {connectionState.connected ? (
              <div className="w-3 h-3 rounded-full bg-emerald-400 sp-glow-pulse" />
            ) : connectionState.connecting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-slate-500" />
            )}
            <div>
              <div className="font-bold text-sm">
                {connectionState.connected
                  ? 'Connected to Open Connect Bridge'
                  : connectionState.connecting
                  ? 'Connecting to Local WebSocket...'
                  : 'Disconnected (Simulator Available)'}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {connectionState.url}
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleConnect}
            className={connectionState.connected ? 'sp-btn-secondary text-xs' : 'sp-btn-primary text-xs'}
          >
            {connectionState.connected
              ? 'Disconnect'
              : connectionState.connecting
              ? 'Cancel'
              : 'Connect'}
          </button>
        </div>

        {/* Port Configuration & Packet Counters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">WebSocket Port</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono w-full outline-none focus:border-emerald-500"
                placeholder="921"
              />
              <button onClick={handleApplyPort} className="sp-btn-secondary text-xs py-1.5">
                Apply
              </button>
            </div>
            <div className="text-[10px] text-slate-500">
              Standard Open Connect port is 921
            </div>
          </div>

          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Data Sanitization (OpenSkyPlus)</span>
            <div className="flex items-center justify-between text-xs font-mono pt-1">
              <span className="text-slate-400">Received:</span>
              <span className="font-bold text-slate-200">{connectionState.packetsReceived} pkts</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Filtered (Phantoms):</span>
              <span className="font-bold text-amber-400">{connectionState.packetsFiltered} pkts</span>
            </div>
          </div>
        </div>

        {/* Quick Setup Instructions for Square Launch Monitor */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
          <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>Zero-Hardware-Code Connector Guide</span>
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
            <li>
              Launch your community connector (e.g. OpenGolfSim, GSPro Connector, or `allsquare`).
            </li>
            <li>
              Verify that the connector is paired to your <strong>Square Golf Launch Monitor</strong> via Bluetooth.
            </li>
            <li>
              The connector broadcasts telemetry over local WebSocket port <strong>921</strong> in standard Open Connect format.
            </li>
            <li>
              Hit putts on your physical mat — SquarePutt automatically captures, filters, and renders every stroke!
            </li>
          </ol>
        </div>

        {/* Local Network Access note */}
        <div className="text-[11px] text-slate-500 leading-normal flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Browsers may request permission for Local Network Access when contacting 127.0.0.1. If your hardware is not active, you can test every drill immediately with the built-in Virtual Simulator.
          </span>
        </div>
      </div>
    </div>
  );
};
