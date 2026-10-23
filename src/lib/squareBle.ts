/**
 * Direct Bluetooth connection to a Square Golf launch monitor from the browser (Web Bluetooth:
 * Chrome or Edge on macOS, Windows, ChromeOS, Android). No bridge or GSPro connector needed.
 *
 * Two models share the GATT profile but not the dialect:
 *  - Home Edition: per squaregolf-connector (github.com/brentyates/squaregolf-connector, internal/core):
 *    commands start 0x11, putter club code 01 07, state at byte 2 of 11 03, a capacitor that must
 *    charge (poll 0x86 → 11 06), and no club data for putts.
 *  - Omni: per allsquare (github.com/divotmaker/allsquare, docs/WIRE.md, SEQUENCE.md): putter 01 03,
 *    state at byte 3, units/green-speed commands, club metrics with a validity mask.
 * The model is read from the advertisement (manufacturer data containing ASCII "0300A" = Omni)
 * when the browser allows it, otherwise taken from the user's choice.
 * Not affiliated with or endorsed by Square Golf / Invant Inc.
 */

import { RawOpenConnectPacket } from './types';

const uuid = (short: string) => `${short}-6b7e-439a-bdd1-489a3213e9bb`;
export const SQUARE_SERVICE = uuid('86601001');
const CMD = uuid('86602101');
const EVT = uuid('86602102');
const FIRMWARE = uuid('86602003');
const MPS_TO_MPH = 1 / 0.44704;
/** How long the Square must report 'ready' continuously before we treat the ball as set (ms). */
const READY_HOLD_MS = 400;

export type SquareModel = 'home' | 'omni';
const MODEL_KEY = 'squareputt_square_model_v1';
/** Putter ClubSelect bytes per model (Omni = Home code with category − 4). */
export const PUTTER_CODE: Record<SquareModel, [number, number]> = { home: [0x01, 0x07], omni: [0x01, 0x03] };
const OMNI_MFG = '0300A';
/** Club selected while putting. 'wedge' asks for club data (face/path), which putter mode doesn't report on the Home Edition. */
export type SquareClubMode = 'putter' | 'wedge';
const CLUB_MODE_KEY = 'squareputt_square_clubmode_v1';
export const WEDGE_CODE: Record<SquareModel, [number, number]> = { home: [0x0c, 0x06], omni: [0x0c, 0x02] };

function loadClubMode(): SquareClubMode {
  try {
    return JSON.parse(localStorage.getItem(CLUB_MODE_KEY) ?? 'null') === 'wedge' ? 'wedge' : 'putter';
  } catch {
    return 'putter';
  }
}

function loadModel(): SquareModel {
  try {
    const v = JSON.parse(localStorage.getItem(MODEL_KEY) ?? 'null');
    return v === 'omni' ? 'omni' : 'home';
  } catch {
    return 'home';
  }
}

export type SquareDeviceState = 'none' | 'idle' | 'initialising' | 'detecting' | 'ready' | 'shot' | 'done';
const STATES: SquareDeviceState[] = ['none', 'idle', 'initialising', 'detecting', 'ready', 'shot', 'done'];

export interface SquareStatus {
  supported: boolean;
  /** Which Square: decides club codes and message layout. */
  model: SquareModel;
  /** True once read from the device's advertisement rather than the user's choice. */
  modelDetected: boolean;
  clubMode: SquareClubMode;
  /** Home Edition shot capacitor charged (null = unknown / not reported). */
  charged: boolean | null;
  connected: boolean;
  connecting: boolean;
  deviceName: string | null;
  firmware: string | null;
  state: SquareDeviceState;
  ballDetected: boolean;
  ballReady: boolean;
  battery: number | null;
  error: string | null;
  shots: number;
  /** Raw ball position from the sensor stream (units/axes undocumented). */
  ballPos: { x: number; y: number; z: number } | null;
  /** Last raw notifications (hex), newest first, for diagnosing other Square models. */
  log: string[];
}

export interface SquareOptions {
  handed: 'right' | 'left';
  /** ClubSelect bytes for the putter; null = the model's default (Home 01 07, Omni 01 03). */
  putterCode: [number, number] | null;
}

type ShotHandler = (packet: RawOpenConnectPacket) => void;
type StatusHandler = (s: SquareStatus) => void;

const family0 = (b: Uint8Array) => b[0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const i16 = (v: DataView, o: number) => v.getInt16(o, true);

interface PendingBall {
  speedMps: number;
  launch: number;
  direction: number;
  totalSpin: number;
  spinAxis: number;
  backspin: number;
  sidespin: number;
}

class SquareBle {
  private device: BluetoothDevice | null = null;
  private cmd: BluetoothRemoteGATTCharacteristic | null = null;
  private evt: BluetoothRemoteGATTCharacteristic | null = null;
  private seq = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastNotify = '';
  private pending: PendingBall | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingClub = false;
  private writeChain: Promise<unknown> = Promise.resolve();
  private shotHandlers = new Set<ShotHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private opts: SquareOptions = { handed: 'right', putterCode: null };
  private chargePoll: ReturnType<typeof setInterval> | null = null;
  private rearmTimer: ReturnType<typeof setTimeout> | null = null;
  private lastArm = 0;
  private shotCounter = 0;
  private sensorCount = 0;
  private lastPosUpdate = 0;
  private readySince = 0;
  private lastStatusBody = '';

  status: SquareStatus = {
    supported: typeof navigator !== 'undefined' && !!navigator.bluetooth,
    model: typeof window !== 'undefined' ? loadModel() : 'home',
    modelDetected: false,
    clubMode: typeof window !== 'undefined' ? loadClubMode() : 'putter',
    charged: null,
    connected: false,
    connecting: false,
    deviceName: null,
    firmware: null,
    state: 'none',
    ballDetected: false,
    ballReady: false,
    battery: null,
    error: null,
    shots: 0,
    ballPos: null,
    log: [],
  };

  onShot(h: ShotHandler) {
    this.shotHandlers.add(h);
    return () => {
      this.shotHandlers.delete(h);
    };
  }

  onStatus(h: StatusHandler) {
    this.statusHandlers.add(h);
    h({ ...this.status });
    return () => {
      this.statusHandlers.delete(h);
    };
  }

  private set(p: Partial<SquareStatus>) {
    this.status = { ...this.status, ...p };
    const s = { ...this.status };
    this.statusHandlers.forEach((h) => h(s));
  }

  /** Choose the model by hand (remembered). Re-arms with the right codes if connected. */
  setModel(model: SquareModel) {
    try {
      localStorage.setItem(MODEL_KEY, JSON.stringify(model));
    } catch {
      /* ignore */
    }
    if (model === this.status.model) return;
    this.set({ model, modelDetected: false });
    if (this.status.connected) this.selectPutter().catch(() => {});
  }

  /** Putter or wedge for reading putts (remembered). Re-arms straight away if connected. */
  setClubMode(clubMode: SquareClubMode) {
    try {
      localStorage.setItem(CLUB_MODE_KEY, JSON.stringify(clubMode));
    } catch {
      /* ignore */
    }
    this.opts = { ...this.opts, putterCode: null }; // a typed custom code would override the mode
    this.set({ clubMode });
    if (this.status.connected) this.selectPutter().catch(() => {});
  }

  private get putterCode(): [number, number] {
    if (this.opts.putterCode) return this.opts.putterCode;
    return (this.status.clubMode === 'wedge' ? WEDGE_CODE : PUTTER_CODE)[this.status.model];
  }

  /** Read the model from the advertisement, where the browser supports it (best effort, ≤1.5 s). */
  private async detectModel(device: BluetoothDevice) {
    const d = device as BluetoothDevice & { watchAdvertisements?: (o?: { signal?: AbortSignal }) => Promise<void> };
    if (!d.watchAdvertisements) return;
    const ac = new AbortController();
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(t);
        device.removeEventListener('advertisementreceived', onAdv as EventListener);
        ac.abort();
        resolve();
      };
      const onAdv = (e: BluetoothAdvertisingEvent) => {
        const m = e.manufacturerData?.get(0xffff);
        if (m) {
          const ascii = new TextDecoder().decode(m.buffer.slice(m.byteOffset, m.byteOffset + m.byteLength));
          this.set({ model: ascii.includes(OMNI_MFG) ? 'omni' : 'home', modelDetected: true });
          this.pushLog(`advert ${ascii} → ${this.status.model}`);
          done();
        }
      };
      const t = setTimeout(done, 1500);
      device.addEventListener('advertisementreceived', onAdv as EventListener);
      d.watchAdvertisements!({ signal: ac.signal }).catch(done);
    });
  }

  /** Must be called from a user gesture (button click). */
  /** False when Bluetooth is off or the browser lacks permission (e.g. macOS privacy setting). */
  async available(): Promise<boolean | null> {
    try {
      return navigator.bluetooth?.getAvailability ? await navigator.bluetooth.getAvailability() : null;
    } catch {
      return null;
    }
  }

  async connect(opts?: Partial<SquareOptions>, showAll = false) {
    if (opts) this.opts = { ...this.opts, ...opts };
    if (!navigator.bluetooth) {
      this.set({ error: 'This browser has no Bluetooth support. Use Chrome or Edge on your laptop.' });
      return;
    }
    this.set({ connecting: true, error: null });
    try {
      const device = await navigator.bluetooth.requestDevice(
        showAll
          ? { acceptAllDevices: true, optionalServices: [SQUARE_SERVICE], optionalManufacturerData: [0xffff] }
          : {
              // The Square advertises "SquareGolf(XXXX)" plus manufacturer data under company id 0xFFFF
              // (an ASCII model code). macOS often doesn't pass the name to Chrome before connecting,
              // so also match on the manufacturer data.
              filters: [
                { namePrefix: 'SquareGolf' },
                { namePrefix: 'Square' },
                { manufacturerData: [{ companyIdentifier: 0xffff }] },
                { services: [SQUARE_SERVICE] },
              ],
              optionalServices: [SQUARE_SERVICE],
              optionalManufacturerData: [0xffff],
            }
      );
      this.device = device;
      await this.detectModel(device);
      device.addEventListener('gattserverdisconnected', this.handleDisconnect);
      const server = await device.gatt!.connect();
      await sleep(250);
      let service: BluetoothRemoteGATTService | null = null;
      for (let attempt = 0; attempt < 4 && !service; attempt++) {
        try {
          service = await server.getPrimaryService(SQUARE_SERVICE);
        } catch {
          await sleep(400);
        }
      }
      if (!service) throw new Error('Square service not found — is this a Square Golf launch monitor?');
      this.cmd = await service.getCharacteristic(CMD);
      this.evt = await service.getCharacteristic(EVT);
      await sleep(250);
      this.evt.addEventListener('characteristicvaluechanged', this.handleNotify);
      await this.evt.startNotifications();
      try {
        const fw = await (await service.getCharacteristic(FIRMWARE)).readValue();
        this.set({ firmware: new TextDecoder().decode(fw.buffer).replace(/\0/g, '').trim() });
      } catch {
        /* optional */
      }
      this.set({ connected: true, connecting: false, charged: null, deviceName: device.name ?? 'SquareGolf' });
      this.pushLog(`connected as ${this.status.model === 'omni' ? 'Omni' : 'Home Edition'}${this.status.modelDetected ? ' (detected)' : ' (your choice)'}`);

      await this.send(0x83); // Heartbeat
      this.heartbeat = setInterval(() => this.send(0x83).catch(() => {}), 5000);
      // Charge query; repeated every 3 s until the device says the capacitor is charged (11 06 … 01)
      await this.send(0x86);
      this.chargePoll = setInterval(() => {
        if (this.status.charged) this.stopChargePoll();
        else this.send(0x86).catch(() => {});
      }, 3000);
      if (this.status.model === 'omni') {
        // Omni-only configuration (allsquare SEQUENCE.md §3–4); the Home Edition doesn't take these.
        await this.send(0x88, [0x00, 0x00, 0x00]); // units: m/s, metres (wire format is unaffected)
      }
      await this.selectPutter();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cancelled = /cancel/i.test(msg);
      this.cleanup();
      this.set({ connecting: false, connected: false, error: cancelled ? null : msg });
    }
  }

  /** Putter selected = putting mode; then arm ball detection (stays armed between shots). */
  async selectPutter(opts?: Partial<SquareOptions>) {
    if (opts) this.opts = { ...this.opts, ...opts };
    const [num, cat] = this.putterCode;
    this.pushLog(`select ${this.opts.putterCode ? 'custom' : this.status.clubMode} ${[num, cat].map((b) => b.toString(16).padStart(2, '0')).join(' ')} (${this.status.model})`);
    this.lastArm = performance.now();
    await this.send(0x82, [num, cat, this.opts.handed === 'left' ? 0x01 : 0x00]);
    await this.send(0x81, [0x01, 0x11]); // DetectBall on, advanced spin
  }

  /**
   * Arming test for models whose club codes differ (e.g. Home Edition): tries each code,
   * then reports the device state and whether the ball-sensor stream started.
   */
  async testArming(
    candidates: { label: string; code: [number, number] }[],
    onResult: (r: { label: string; code: string; state: SquareDeviceState; sensor: boolean }) => void
  ) {
    for (const c of candidates) {
      await this.send(0x81, [0x00]); // disarm
      await sleep(400);
      this.sensorCount = 0;
      await this.send(0x82, [c.code[0], c.code[1], this.opts.handed === 'left' ? 0x01 : 0x00]);
      await this.send(0x81, [0x01, 0x11]);
      await sleep(600);
      await this.send(0x83); // ask for state now
      await sleep(900);
      onResult({
        label: c.label,
        code: c.code.map((b) => b.toString(16).padStart(2, '0')).join(' '),
        state: this.status.state,
        sensor: this.sensorCount > 0,
      });
    }
    await this.selectPutter(); // leave it in putting mode
  }

  /** Optional, Omni only: tell the device the green speed (affects only its own display). */
  async setGreenSpeed(stimp: number) {
    if (this.status.model !== 'omni' || !this.cmd) return;
    const v = Math.max(0, Math.min(5, Math.round(stimp - 8)));
    await this.send(0x89, [v]).catch(() => {});
  }

  async disconnect() {
    try {
      await this.send(0x81, [0x00]); // disarm (courtesy)
    } catch {
      /* ignore */
    }
    this.device?.gatt?.disconnect();
    this.cleanup();
    this.set({ connected: false, connecting: false, state: 'none', ballDetected: false, ballReady: false });
  }

  private send(type: number, payload: number[] = []) {
    const run = async () => {
      if (!this.cmd) return;
      const buf = new Uint8Array(9);
      buf[0] = this.status.model === 'omni' ? 0x00 : 0x11; // Home Edition expects 0x11 (squaregolf-connector)
      buf[1] = type;
      buf[2] = this.seq;
      this.seq = (this.seq + 1) & 0xff;
      payload.forEach((b, i) => (buf[3 + i] = b));
      if (this.cmd.writeValueWithResponse) await this.cmd.writeValueWithResponse(buf);
      else await this.cmd.writeValue(buf);
    };
    // GATT allows one operation at a time; serialize writes.
    this.writeChain = this.writeChain.then(run, run);
    return this.writeChain;
  }

  private handleDisconnect = () => {
    this.cleanup();
    this.set({ connected: false, connecting: false, state: 'none', ballDetected: false, ballReady: false, error: 'Launch monitor disconnected.' });
  };

  /**
   * After a shot the Square leaves detection mode and waits to be re-armed (the GSPro connector
   * re-arms on each "ready" from GSPro). Re-arm shortly after every putt.
   */
  private scheduleRearm(ms: number) {
    if (this.rearmTimer) clearTimeout(this.rearmTimer);
    this.rearmTimer = setTimeout(() => {
      this.rearmTimer = null;
      if (this.cmd) this.selectPutter().catch(() => {});
    }, ms);
  }

  private stopChargePoll() {
    if (this.chargePoll) clearInterval(this.chargePoll);
    this.chargePoll = null;
  }

  private cleanup() {
    this.stopChargePoll();
    if (this.rearmTimer) clearTimeout(this.rearmTimer);
    this.rearmTimer = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pending = null;
    this.awaitingClub = false;
    this.evt?.removeEventListener('characteristicvaluechanged', this.handleNotify);
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    this.cmd = null;
    this.evt = null;
    this.lastNotify = '';
    this.lastStatusBody = '';
  }

  private pushLog(hex: string) {
    this.set({ log: [`${new Date().toLocaleTimeString()}  ${hex}`, ...this.status.log].slice(0, 80) });
  }

  private handleNotify = (ev: Event) => {
    const v = (ev.target as BluetoothRemoteGATTCharacteristic).value;
    if (!v) return;
    if (v.byteLength === 0) {
      this.handleDisconnect();
      return;
    }
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    if (hex === this.lastNotify) return; // every notification arrives twice
    this.lastNotify = hex;
    // Log everything except the clock tick, the continuous sensor stream (logged on change, below)
    // and repeated status lines (11 03 <counter> …: logged only when the part after the counter changes).
    const isSensor = bytes[0] === 0x11 && bytes[1] === 0x01;
    const isStatus = bytes[0] === 0x11 && bytes[1] === 0x03;
    if (isStatus) {
      const body = hex.slice(6);
      if (body !== this.lastStatusBody) this.pushLog(hex);
      this.lastStatusBody = body;
    } else if (family0(bytes) !== 0x71 && !isSensor) this.pushLog(hex);

    const family = bytes[0];
    if (family === 0x91 && bytes.length >= 2) {
      this.set({ battery: bytes[1] });
      return;
    }
    if (family !== 0x11 || bytes.length < 3) return;
    const type = bytes[1];
    switch (type) {
      case 0x01: {
        // sensor: byte 3 = ready flag, byte 4 = ball detected (streams continuously while armed)
        this.sensorCount++;
        if (bytes.length < 5) break;
        const detected = bytes[4] === 0x01;
        const rawReady = detected && (bytes[3] === 0x01 || bytes[3] === 0x02);
        const pos = bytes.length >= 17 ? { x: v.getInt32(5, true), y: v.getInt32(9, true), z: v.getInt32(13, true) } : null;
        const now = performance.now();
        // Only trust a steady "ready": the Square flickers at the edge of its (small) read zone.
        if (!rawReady) this.readySince = 0;
        else if (!this.readySince) this.readySince = now;
        const ready = rawReady && now - this.readySince >= READY_HOLD_MS;
        const changed = detected !== this.status.ballDetected || ready !== this.status.ballReady;
        if (changed) this.pushLog(hex);
        // position streams continuously; update the UI at most ~12 times a second
        if (changed || now - this.lastPosUpdate > 80) {
          this.lastPosUpdate = now;
          this.set({ ballDetected: detected, ballReady: ready, ballPos: detected ? pos : null });
        }
        break;
      }
      case 0x03: {
        // Device state at byte 3 (byte 2 is a counter) — confirmed on a Home Edition:
        // 11 03 <ctr> <state> <state> <club 07> 01 00 01. Older notes put it at byte 2; fall back to that.
        const idx = bytes.length > 3 && bytes[3] <= 6 ? 3 : 2;
        if (bytes.length > idx) {
          const state = STATES[bytes[idx]];
          if (state && state !== this.status.state) this.set({ state });
          // Fell out of detection (idle / shot done) without a re-arm under way: arm again.
          if ((state === 'idle' || state === 'done') && !this.rearmTimer && performance.now() - this.lastArm > 3000) this.scheduleRearm(300);
        }
        break;
      }
      case 0x06: // capacitor charge status: byte 3 = 01 when charged
        if (bytes.length >= 4) {
          const charged = bytes[3] === 0x01;
          if (charged !== this.status.charged) this.set({ charged });
          if (charged) this.stopChargePoll();
        }
        break;
      case 0x02: {
        if (bytes.length < 17) return;
        if (i16(v, 3) === -32768) return; // no valid ball speed
        this.flushPending(); // an unanswered earlier ball
        const spin = (o: number) => (i16(v, o) === -32768 ? 0 : i16(v, o));
        this.pending = {
          speedMps: i16(v, 3) / 100,
          launch: i16(v, 5) / 100,
          direction: i16(v, 7) / 100,
          totalSpin: spin(9),
          spinAxis: -spin(11) / 100, // device sends these sign-inverted
          backspin: spin(13),
          sidespin: -spin(15),
        };
        // Club metrics are pulled, not pushed. The Home Edition measures path/attack (with the
        // reflective club sticker) and estimates face; squaregolf-connector discards them for the
        // putter, so on the Home Edition they are passed on only when not empty (experimental).
        this.awaitingClub = true;
        this.send(0x87).catch(() => {}); // club metrics are pulled, not pushed
        this.pendingTimer = setTimeout(() => this.flushPending(), 900);
        break;
      }
      case 0x07: {
        if (!this.awaitingClub || !this.pending) return; // stale club data from an older shot
        // Byte 2 is a validity mask on both models (Home Edition putts: 11 07 00 ffff… = nothing
        // measured). Path 3, face 5, attack 7, loft 9, club speed 15 (Omni only); ±1 sentinels.
        if (bytes.length < 11) return;
        const mask = bytes[2];
        const field = (n: number, o: number) => {
          if (o + 2 > bytes.length) return undefined;
          const raw = i16(v, o);
          return mask & (1 << n) && raw !== -1 && raw !== -32768 ? raw / 100 : undefined;
        };
        this.emit(this.pending, {
          path: field(0, 3),
          face: field(1, 5),
          attack: field(2, 7),
          loft: field(3, 9),
          clubSpeed: field(6, 15),
        });
        break;
      }
      default:
        break;
    }
  };

  private flushPending() {
    if (this.pending) this.emit(this.pending, {});
  }

  private emit(b: PendingBall, c: { path?: number; face?: number; attack?: number; loft?: number; clubSpeed?: number }) {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pending = null;
    this.awaitingClub = false;
    this.shotCounter++;
    this.set({ shots: this.status.shots + 1, ballDetected: false, ballReady: false });
    this.readySince = 0;
    this.scheduleRearm(1200);
    const hasClub = c.face !== undefined || c.path !== undefined;
    const packet: RawOpenConnectPacket = {
      DeviceID: this.status.deviceName ?? 'SquareGolf',
      Units: 'Yards',
      ShotNumber: this.shotCounter,
      BallData: {
        Speed: b.speedMps * MPS_TO_MPH,
        VLA: b.launch,
        HLA: b.direction,
        TotalSpin: b.totalSpin,
        SpinAxis: b.spinAxis,
        BackSpin: b.backspin,
        SideSpin: b.sidespin,
      },
      ClubData: hasClub
        ? {
            Path: c.path,
            FaceAngle: c.face,
            AngleOfAttack: c.attack,
            DynamicLoft: c.loft,
            Speed: c.clubSpeed !== undefined ? c.clubSpeed * MPS_TO_MPH : undefined,
          }
        : undefined,
      ShotDataOptions: { ContainsBallData: true, ContainsClubData: hasClub },
    };
    this.shotHandlers.forEach((h) => h(packet));
  }
}

export const squareBle = new SquareBle();
