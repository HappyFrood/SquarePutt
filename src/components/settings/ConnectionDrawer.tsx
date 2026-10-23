'use client';

import React, { useEffect, useState } from 'react';
import { Bluetooth, X } from 'lucide-react';
import { ConnectionState } from '@/lib/types';
import { openConnectService } from '@/lib/openConnectService';
import { squareBle, SquareStatus, PUTTER_CODE } from '@/lib/squareBle';
import { Button, Segmented } from '@/components/ui/controls';


export function ConnectionDrawer({ open, onClose, state, ble }: { open: boolean; onClose: () => void; state: ConnectionState; ble: SquareStatus }) {
  const [port, setPort] = useState(String(state.port));
  const [handed, setHanded] = useState<'right' | 'left'>('right');
  const [code, setCode] = useState('');
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [testRows, setTestRows] = useState<{ label: string; code: string; state: string; sensor: boolean }[]>([]);
  const runTest = async () => {
    setTesting(true);
    setTestRows([]);
    await squareBle.testArming(
      [
        { label: 'Putter (Home Edition)', code: [0x01, 0x07] },
        { label: 'Putter (Omni)', code: [0x01, 0x03] },
      ],
      (r) => setTestRows((rows) => [...rows, r])
    );
    setTesting(false);
  };
  useEffect(() => {
    if (!open) return;
    let alive = true;
    squareBle.available().then((a) => alive && setBtAvailable(a));
    return () => {
      alive = false;
    };
  }, [open]);
  if (!open) return null;

  // Accept "01 06", "0106", "01-06", "0x01 0x06"…
  const hexDigits = code.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  const parsed = hexDigits.length === 4 ? [parseInt(hexDigits.slice(0, 2), 16), parseInt(hexDigits.slice(2), 16)] : [];
  const putterCode: [number, number] | null = parsed.length === 2 && parsed.every((n) => n >= 0 && n <= 255) ? [parsed[0], parsed[1]] : null;
  const defaultCode = PUTTER_CODE[ble.model].map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const modelPicker = (
    <div className="space-y-2">
      <span className="text-sm text-mist">
        Model{ble.modelDetected && <span className="text-fog"> · detected from the device</span>}
      </span>
      <Segmented
        value={ble.model}
        onChange={(m) => squareBle.setModel(m)}
        options={[
          { value: 'home', label: 'Home Edition' },
          { value: 'omni', label: 'Omni' },
        ]}
        size="sm"
      />
    </div>
  );
  const opts = { handed, putterCode };
  const bleState = ble.connected
    ? ble.ballReady
      ? 'Ball ready — putt when you like'
      : ble.ballDetected
      ? 'Ball detected'
      : 'Connected — place a ball on the mat'
    : ble.connecting
    ? 'Choose your Square in the browser window…'
    : 'Not connected';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="sp-slide flex h-full w-[440px] max-w-full flex-col bg-club-900 ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Launch monitor</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-club-800 hover:text-chalk">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${ble.connected ? 'bg-birdie text-club-950' : 'bg-club-800 text-mist ring-1 ring-line'}`}>
                <Bluetooth size={18} />
              </span>
              <div>
                <p className="font-semibold">Square Golf over Bluetooth</p>
                <p className="text-sm text-mist">{bleState}</p>
              </div>
            </div>

            {!ble.supported ? (
              <p className="rounded-lg bg-club-950 p-3 text-sm text-mist ring-1 ring-line">
                This browser can&apos;t use Bluetooth. Open SquarePutt in <strong className="text-chalk">Chrome</strong> or <strong className="text-chalk">Edge</strong> on your laptop.
              </p>
            ) : ble.connected ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Battery" value={ble.battery !== null ? `${ble.battery}%` : '–'} />
                  <Stat label="Putts read" value={String(ble.shots)} />
                  <Stat label="State" value={ble.state} />
                </div>
                {ble.charged === false && <p className="text-sm text-par">The Square is still charging its sensor — wait for it before putting.</p>}
                {modelPicker}
                <div className="rounded-xl bg-club-950/60 p-3 ring-1 ring-line">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-mist">Not reading putts? Test which putter code your Square answers to.</p>
                    <Button variant="quiet" onClick={runTest} disabled={testing}>
                      {testing ? 'Testing…' : 'Test arming'}
                    </Button>
                  </div>
                  {testRows.length > 0 && (
                    <table className="mt-3 w-full text-left text-xs">
                      <thead className="text-fog">
                        <tr>
                          <th className="py-1 font-medium">Code</th>
                          <th className="font-medium">Device state</th>
                          <th className="font-medium">Ball sensor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((r) => (
                          <tr key={r.code} className="border-t border-line">
                            <td className="py-1.5 text-chalk">
                              {r.label} <span className="text-fog">({r.code})</span>
                            </td>
                            <td className={r.state === 'detecting' || r.state === 'ready' ? 'text-birdie' : 'text-mist'}>{r.state}</td>
                            <td className={r.sensor ? 'text-birdie' : 'text-mist'}>{r.sensor ? 'streaming' : 'silent'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="quiet" className="flex-1" onClick={() => squareBle.selectPutter(opts)}>
                    Re-arm
                  </Button>
                  <Button variant="quiet" className="flex-1" onClick={() => squareBle.disconnect()}>
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {modelPicker}
                <ol className="list-decimal space-y-1 pl-5 text-sm text-mist">
                  <li>Turn the Square on and close the Square app or GSPro connector on other devices — it talks to one app at a time.</li>
                  <li>Press Connect and pick <span className="text-chalk">SquareGolf(…)</span> from the list.</li>
                  <li>SquarePutt selects the putter and arms the monitor. Place a ball and putt.</li>
                </ol>
                {btAvailable === false && (
                  <div className="rounded-lg bg-club-950 p-3 text-sm text-mist ring-1 ring-line">
                    <p className="font-semibold text-par">Chrome can&apos;t use Bluetooth right now.</p>
                    <p className="mt-1">
                      Turn Bluetooth on, then on a Mac open <span className="text-chalk">System Settings → Privacy &amp; Security → Bluetooth</span> and switch on Google Chrome (or Edge). Quit and reopen the browser afterwards.
                    </p>
                  </div>
                )}
                <Button className="w-full py-3 text-base" onClick={() => squareBle.connect(opts)} disabled={ble.connecting}>
                  <Bluetooth size={18} /> {ble.connecting ? 'Connecting…' : 'Connect Square'}
                </Button>
                <div className="space-y-1 text-sm text-mist">
                  <p>
                    Square not in the list?{' '}
                    <button className="font-semibold text-chalk underline underline-offset-2" onClick={() => squareBle.connect(opts, true)} disabled={ble.connecting}>
                      Show all nearby Bluetooth devices
                    </button>{' '}
                    and pick it there — on a Mac it may show as &ldquo;Unknown or Unsupported Device&rdquo;; hold the Square next to the laptop and pick the strongest signal. Also check that no phone, tablet or PC is still connected to it — while connected, it stays hidden from everyone else.
                  </p>
                  <p className="text-xs text-fog">It won&apos;t appear in the Mac&apos;s own Bluetooth settings; that&apos;s normal for this kind of device.</p>
                </div>
              </>
            )}
            {ble.error && <p className="rounded-lg bg-club-950 p-3 text-sm text-bogey ring-1 ring-line">{ble.error}</p>}

            <div className="space-y-2">
              <span className="text-sm text-mist">Handedness</span>
              <Segmented value={handed} onChange={setHanded} options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]} size="sm" />
            </div>
            <details className="text-sm text-mist">
              <summary className="cursor-pointer text-chalk">If putts aren&apos;t detected</summary>
              <p className="mt-2">
                SquarePutt puts the monitor in putting mode by selecting the putter: club code <code>01 07</code> on the Home Edition, <code>01 03</code> on the Omni. Make sure the model above is right. To try another code, type it here; leave it empty to use the model&apos;s code. The raw messages below show what the monitor is sending.
              </p>
              <label className="mt-2 block text-xs text-fog" htmlFor="putter-code">Putter club code (hex)</label>
              <div className="mt-1 flex gap-2">
                <input id="putter-code" value={code} placeholder={defaultCode} onChange={(e) => setCode(e.target.value)} className="num w-28 rounded-lg bg-club-950 px-3 py-1.5 text-chalk ring-1 ring-line outline-none focus:ring-flag" />
                {ble.connected && (
                  <Button variant="quiet" onClick={() => squareBle.selectPutter(opts)}>Send</Button>
                )}
              </div>
              {ble.log.length > 0 && (
                <pre className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-club-950 p-2 text-[11px] leading-relaxed text-mist ring-1 ring-line">{ble.log.join('\n')}</pre>
              )}
              {ble.firmware && <p className="mt-2 text-xs text-fog">Firmware: {ble.firmware}</p>}
            </details>
          </section>

          <details className="border-t border-line pt-5 text-sm text-mist">
            <summary className="cursor-pointer font-semibold text-chalk">Other launch monitors (via GSPro connector)</summary>
            <div className="mt-3 space-y-3">
              <p>
                For monitors that work with GSPro, run <code className="rounded bg-club-950 px-1.5 py-0.5 text-chalk">npm run bridge</code> with GSPro closed, then connect the monitor&apos;s GSPro connector as usual. Status:{' '}
                <span className="text-chalk">
                  {state.connected ? (state.launchMonitorConnected ? `${state.launchMonitorName ?? 'monitor'} connected` : 'bridge running, no monitor yet') : 'bridge not running'}
                </span>
              </p>
              <div className="flex gap-2">
                <input
                  aria-label="Bridge WebSocket port"
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
                  Apply port
                </Button>
              </div>
              <p className="text-xs text-fog">
                {state.packetsReceived} messages received · {state.packetsFiltered} reads filtered out
              </p>
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-club-950/60 p-2.5 ring-1 ring-line">
      <div className="num text-xl font-semibold capitalize">{value}</div>
      <div className="text-xs text-fog">{label}</div>
    </div>
  );
}
