/**
 * Launch monitor connection + shot processing.
 *
 * Browsers cannot accept the TCP connection a GSPro Open Connect connector makes, so the
 * SquarePutt bridge (bridge/squareputt-bridge.mjs) plays the part of GSPro on port 921 and
 * relays shots to this page over a local WebSocket (default ws://127.0.0.1:9210).
 */

import { RawOpenConnectPacket, PuttingShotData, ConnectionState, AppMode, PuttLayout, ReadCheck } from './types';
import { NormalizedStroke, telemetrySanitizer } from './dataSanitizer';
import { IdealStroke, PuttSetup, simulatePutt, solveLineForSpeed, MPH_TO_MPS } from './physicsEngine';
import { paceIsGood } from './diagnosis';
import { gradeFaceAngle, gradePutterPath, analyzeDynamicLoft, gradeSpeedError } from './calculations';
import { QuinticGrade } from './types';

export type ShotListener = (shot: PuttingShotData) => void;
export type ConnectionListener = (state: ConnectionState) => void;
export type FilterListener = (reason: string) => void;

export const DEFAULT_BRIDGE_PORT = 9210;
const PORT_KEY = 'squareputt_bridge_port_v2';

export interface ShotContext {
  setup: PuttSetup;
  layout: PuttLayout;
  ideal: IdealStroke | null;
  mode: AppMode;
  /** Start line the player chose (deg, + right of the hole). Start line is graded against this. */
  aimHlaDeg?: number;
  /** 'player' when the player picked the line (enables the read check); 'ideal' with "Read + line". */
  aimSource?: 'player' | 'ideal';
}

class OpenConnectService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private context: ShotContext | null = null;
  /** When false, incoming shots are dropped (e.g. while a putt is still rolling). */
  private accepting = true;

  private shotListeners = new Set<ShotListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private filterListeners = new Set<FilterListener>();

  private state: ConnectionState = {
    connected: false,
    connecting: false,
    launchMonitorConnected: false,
    launchMonitorName: null,
    url: `ws://127.0.0.1:${DEFAULT_BRIDGE_PORT}`,
    port: DEFAULT_BRIDGE_PORT,
    lastMessageTime: null,
    errorMessage: null,
    packetsReceived: 0,
    packetsFiltered: 0,
  };

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      const saved = parseInt(localStorage.getItem(PORT_KEY) ?? '', 10);
      if (saved > 0 && saved < 65536) this.applyPort(saved);
    } catch {
      /* storage unavailable */
    }
  }

  setContext(ctx: ShotContext) {
    this.context = ctx;
  }

  setAccepting(accepting: boolean) {
    this.accepting = accepting;
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  private applyPort(port: number) {
    this.state.port = port;
    this.state.url = `ws://127.0.0.1:${port}`;
  }

  setPort(port: number) {
    this.applyPort(port);
    try {
      localStorage.setItem(PORT_KEY, String(port));
    } catch {
      /* ignore */
    }
    this.disconnect();
    this.connect();
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.shouldReconnect = true;
    this.update({ connecting: true, errorMessage: null });
    try {
      const ws = new WebSocket(this.state.url);
      this.ws = ws;
      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.update({ connected: true, connecting: false, errorMessage: null });
      };
      ws.onmessage = (ev) => this.handleMessage(typeof ev.data === 'string' ? ev.data : '');
      ws.onerror = () => {
        this.update({ errorMessage: `SquarePutt bridge not found at ${this.state.url}. Start it with "npm run bridge".` });
      };
      ws.onclose = () => {
        this.update({ connected: false, connecting: false, launchMonitorConnected: false });
        if (this.shouldReconnect) this.scheduleReconnect();
      };
    } catch (err) {
      this.update({ connected: false, connecting: false, errorMessage: String(err) });
      if (this.shouldReconnect) this.scheduleReconnect();
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.update({ connected: false, connecting: false, launchMonitorConnected: false });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Back off gently but never give up: the bridge may be started later.
    const delay = Math.min(15000, 2000 + this.reconnectAttempts * 1000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleMessage(data: string) {
    this.state.packetsReceived++;
    this.state.lastMessageTime = Date.now();
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      this.notify();
      return;
    }
    const m = msg as { type?: string; packet?: RawOpenConnectPacket; launchMonitorConnected?: boolean; device?: string };
    if (m.type === 'status') {
      this.update({ launchMonitorConnected: !!m.launchMonitorConnected, launchMonitorName: m.device ?? null });
      return;
    }
    const packet = (m.type === 'shot' ? m.packet : msg) as RawOpenConnectPacket;
    this.notify();
    this.processPacket(packet, 'live');
  }

  processPacket(packet: RawOpenConnectPacket, source: 'live' | 'sim'): PuttingShotData | null {
    const res = telemetrySanitizer.sanitize(packet);
    if (res.kind === 'ignore') return null;
    if (res.kind === 'reject') {
      this.state.packetsFiltered++;
      this.notify();
      this.filterListeners.forEach((l) => l(res.reason));
      return null;
    }
    if (!this.accepting) {
      this.filterListeners.forEach((l) => l('Putt ignored — wait for the next ball to be set'));
      return null;
    }
    return this.processStroke(res.stroke, source);
  }

  private processStroke(s: NormalizedStroke, source: 'live' | 'sim'): PuttingShotData | null {
    const ctx = this.context;
    if (!ctx) return null;
    const sim = simulatePutt(ctx.setup, {
      ballSpeedMph: s.ballSpeedMph,
      hlaDeg: s.hlaDeg,
      backspinRpm: s.backspinRpm,
    });

    const effSpeed = s.ballSpeedMph * (ctx.setup.speedCalibration ?? 1);
    const speedErrorPct = ctx.ideal ? ((effSpeed - ctx.ideal.ballSpeedMph) / ctx.ideal.ballSpeedMph) * 100 : undefined;
    const aim = ctx.aimHlaDeg ?? ctx.ideal?.hlaDeg;
    const startLineErrorDeg = aim !== undefined ? s.hlaDeg - aim : undefined;

    // Green reading: would the chosen line have holed at ideal pace? (the read on its own, stroke removed)
    let read: ReadCheck | undefined;
    if (ctx.ideal && aim !== undefined && ctx.aimSource === 'player') {
      const distIn = Math.hypot(ctx.setup.ball.x, ctx.setup.ball.z) * 39.3701;
      const aimIn = Math.tan((aim * Math.PI) / 180) * distIn;
      const idealIn = ctx.ideal.aimOffsetIn;
      const errorIn = aimIn - idealIn;
      const rs = simulatePutt({ ...ctx.setup, speedCalibration: 1 }, { ballSpeedMph: ctx.ideal.ballSpeedMph, hlaDeg: aim }, { dt: 0.002 });
      const idealDeg = ctx.ideal.hlaDeg;
      const errorDeg = aim - idealDeg;
      const breaking = Math.abs(idealDeg) >= 0.25; // the smallest aim step
      const verdict: ReadCheck['verdict'] = rs.isHoled
        ? 'good'
        : !breaking
        ? errorDeg > 0
          ? 'right'
          : 'left'
        : errorDeg * Math.sign(idealDeg) > 0
        ? 'over'
        : 'under';
      read = {
        aimIn: Number(aimIn.toFixed(1)),
        idealIn: Number(idealIn.toFixed(1)),
        errorIn: Number(errorIn.toFixed(1)),
        holesAtIdealPace: rs.isHoled,
        missIn: Number((rs.lateralErrorIn ?? 0).toFixed(1)),
        verdict,
        aimDeg: Number(aim.toFixed(2)),
        idealDeg: Number(idealDeg.toFixed(2)),
        errorDeg: Number(errorDeg.toFixed(2)),
        breakPlayedPct: breaking ? Math.round((aim / idealDeg) * 100) : undefined,
        // Read and pace are linked: if the pace was off, which line would have holed at THAT pace?
        paceLineDeg:
          !paceIsGood(sim.isHoled, sim.distanceErrorFt, Math.hypot(ctx.setup.ball.x, ctx.setup.ball.z) * 3.28084)
            ? (() => {
                const h = solveLineForSpeed(ctx.setup, effSpeed, idealDeg);
                return h === null ? null : Number(h.toFixed(2));
              })()
            : undefined,
      };
      if (typeof read.paceLineDeg === 'number') {
        read.paceLineHoles = simulatePutt({ ...ctx.setup, speedCalibration: 1 }, { ballSpeedMph: effSpeed, hlaDeg: read.paceLineDeg }, { dt: 0.002 }).isHoled;
      }
    }

    // Start line is graded against the line the player chose (the ideal one with "Read + line").
    const faceGrade = gradeFaceAngle(startLineErrorDeg ?? s.faceAngleDeg);
    const pathGrade = gradePutterPath(s.pathDeg);
    const speedGrade: QuinticGrade = speedErrorPct !== undefined ? gradeSpeedError(speedErrorPct) : 'par';
    const loft = analyzeDynamicLoft(s.dynamicLoftDeg, s.aoaDeg, s.vlaDeg);
    const rank: Record<QuinticGrade, number> = { eagle: 0, birdie: 1, par: 2, bogey: 3 };
    // The read counts too: a line that holes at perfect pace is eagle; within 3 in of ideal, par; else bogey.
    const readRank = !read ? 0 : read.holesAtIdealPace ? 0 : Math.abs(read.errorIn) <= 3 ? 2 : 3;
    const worst = Math.max(rank[faceGrade], rank[speedGrade], readRank);
    const overall = sim.isHoled && worst > 1 ? 'birdie' : (['eagle', 'birdie', 'par', 'bogey'] as QuinticGrade[])[worst];

    const rollFt = sim.pathLengthFt;
    const skidFt = sim.skidDistanceIn / 12;
    const ball = ctx.setup.ball;

    const shot: PuttingShotData = {
      id: `shot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      shotNumber: s.shotNumber,
      source,
      mode: ctx.mode,
      ballSpeedMph: s.ballSpeedMph,
      ballSpeedMps: Number((s.ballSpeedMph * MPH_TO_MPS).toFixed(2)),
      vla: s.vlaDeg,
      hla: s.hlaDeg,
      backspinRpm: s.backspinRpm,
      clubSpeedMph: s.clubSpeedMph,
      angleOfAttackDeg: s.aoaDeg,
      putterPathDeg: s.pathDeg,
      faceAngleDeg: s.faceAngleDeg,
      faceToPathDeg: Number((s.faceAngleDeg - s.pathDeg).toFixed(2)),
      dynamicLoftDeg: s.dynamicLoftDeg,
      clubMeasured: s.hasClubData,
      stimpSetting: ctx.setup.stimp,
      slopeDifficulty: ctx.layout.difficulty,
      greenSeed: ctx.layout.seed,
      targetDistanceFt: Number((Math.hypot(ball.x, ball.z) * 3.28084).toFixed(1)),
      ballStart: { x: ball.x, z: ball.z },
      rest: sim.rest,
      rollDistanceFt: Number(rollFt.toFixed(2)),
      lateralErrorInches: Number(sim.lateralErrorIn.toFixed(1)),
      distanceErrorFt: Number(sim.distanceErrorFt.toFixed(2)),
      leaveFt: Number(sim.leaveFt.toFixed(2)),
      isHoled: sim.isHoled,
      lipOut: sim.lipOut,
      timeToZeroSkidMs: sim.skidTimeMs,
      skidDistanceInches: Number(sim.skidDistanceIn.toFixed(1)),
      trueRollDistanceFt: Number(Math.max(0, rollFt - skidFt).toFixed(2)),
      skidPercentage: Number(((skidFt / Math.max(0.01, rollFt)) * 100).toFixed(1)),
      idealSpeedMph: ctx.ideal?.ballSpeedMph,
      idealHlaDeg: ctx.ideal?.hlaDeg,
      aimHlaDeg: aim !== undefined ? Number(aim.toFixed(2)) : undefined,
      read,
      speedErrorPct: speedErrorPct !== undefined ? Number(speedErrorPct.toFixed(1)) : undefined,
      startLineErrorDeg: startLineErrorDeg !== undefined ? Number(startLineErrorDeg.toFixed(2)) : undefined,
      grades: {
        faceAngleGrade: faceGrade,
        pathGrade,
        speedConsistencyGrade: speedGrade,
        launchGrade: loft.grade,
        overallGrade: overall,
      },
      trajectoryPoints: sim.samples,
      trajectoryDt: sim.sampleDt,
    };
    this.shotListeners.forEach((l) => l(shot));
    return shot;
  }

  /** Virtual stroke for practicing without hardware. */
  triggerSimulatedShot(p: {
    ballSpeedMph: number;
    hlaDeg: number;
    faceAngleDeg?: number;
    pathDeg?: number;
    angleOfAttackDeg?: number;
    dynamicLoftDeg?: number;
  }) {
    const face = p.faceAngleDeg ?? p.hlaDeg / 0.82;
    return this.processPacket(
      {
        BallData: { Speed: p.ballSpeedMph, HLA: p.hlaDeg, VLA: 1.2 + 0.3 * (p.dynamicLoftDeg ?? 2.5) - 0.5 },
        ClubData: {
          Path: p.pathDeg ?? 0,
          FaceAngle: face,
          AngleOfAttack: p.angleOfAttackDeg ?? 1.5,
          DynamicLoft: p.dynamicLoftDeg ?? 2.5,
          Speed: p.ballSpeedMph * 0.62,
        },
        ShotDataOptions: { ContainsBallData: true, ContainsClubData: true },
        ShotNumber: Math.floor(Math.random() * 1e6),
        Confidence: 99,
      },
      'sim'
    );
  }

  subscribeShot(l: ShotListener) {
    this.shotListeners.add(l);
    return () => {
      this.shotListeners.delete(l);
    };
  }

  subscribeConnection(l: ConnectionListener) {
    this.connectionListeners.add(l);
    l(this.getState());
    return () => {
      this.connectionListeners.delete(l);
    };
  }

  subscribeFilter(l: FilterListener) {
    this.filterListeners.add(l);
    return () => {
      this.filterListeners.delete(l);
    };
  }

  private update(partial: Partial<ConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    const s = this.getState();
    this.connectionListeners.forEach((l) => l(s));
  }
}

export const openConnectService = new OpenConnectService();
