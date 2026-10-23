'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ConnectionState } from '@/lib/types';
import { openConnectService } from '@/lib/openConnectService';
import { Button } from '@/components/ui/controls';

export function ConnectionDrawer({ open, onClose, state }: { open: boolean; onClose: () => void; state: ConnectionState }) {
  const [port, setPort] = useState(String(state.port));
  if (!open) return null;
  const steps = [
    {
      done: state.connected,
      title: 'Start the SquarePutt bridge',
      body: (
        <>
          In the SquarePutt folder run <code className="rounded bg-club-950 px-1.5 py-0.5 text-chalk">npm run bridge</code> and leave it open. Close GSPro first — the bridge takes its place on port 921.
        </>
      ),
    },
    {
      done: state.launchMonitorConnected,
      title: 'Connect your Square to “GSPro”',
      body: <>In the Square Golf app (or any GSPro Open Connect connector) choose GSPro as the simulator. It will connect to the bridge as if it were GSPro, and switch to putting mode automatically.</>,
    },
    {
      done: state.launchMonitorConnected && state.packetsReceived > 0,
      title: 'Hit a putt',
      body: <>Putts appear on the green as soon as the monitor reads them. Phantom reads, chips and duplicates are filtered out.</>,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="sp-slide flex h-full w-[420px] max-w-full flex-col bg-club-900 ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Launch monitor</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-club-800 hover:text-chalk">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? 'bg-birdie text-club-950' : 'bg-club-800 text-mist ring-1 ring-line'}`}>
                  {s.done ? '✓' : i + 1}
                </span>
                <div>
                  <p className="font-semibold text-chalk">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {state.errorMessage && !state.connected && <p className="rounded-lg bg-club-950 p-3 text-sm text-mist ring-1 ring-line">{state.errorMessage}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Messages received" value={state.packetsReceived} />
            <Stat label="Reads filtered out" value={state.packetsFiltered} />
          </div>

          <details className="text-sm text-mist">
            <summary className="cursor-pointer font-semibold text-chalk">Advanced</summary>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-fog" htmlFor="bridge-port">Bridge WebSocket port (default 9210)</label>
              <div className="flex gap-2">
                <input
                  id="bridge-port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="num w-full rounded-lg bg-club-950 px-3 py-2 text-chalk ring-1 ring-line outline-none focus:ring-flag"
                />
                <Button
                  variant="quiet"
                  onClick={() => {
                    const p = parseInt(port, 10);
                    if (p > 0 && p < 65536) openConnectService.setPort(p);
                  }}
                >
                  Apply
                </Button>
              </div>
              <Button variant="quiet" onClick={() => openConnectService.connect()} className="w-full">
                Reconnect now
              </Button>
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-club-950/60 p-3 ring-1 ring-line">
      <div className="num text-2xl font-semibold">{value}</div>
      <div className="text-xs text-fog">{label}</div>
    </div>
  );
}
