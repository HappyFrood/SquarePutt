/**
 * Open Connect API WebSocket Client & Shot Simulator Service
 * Handles live telemetry from community connectors (Square Golf, GSPro, OpenGolfSim)
 * with auto-reconnection, data sanitization, and virtual simulator fallback.
 */

import { RawOpenConnectPacket, PuttingShotData, ConnectionState, SlopeDifficulty } from './types';
import { telemetrySanitizer } from './dataSanitizer';
import { simulatePutt } from './physicsEngine';
import {
  gradeFaceAngle,
  gradePutterPath,
  analyzeDynamicLoft,
} from './calculations';

export type ShotListener = (shot: PuttingShotData) => void;
export type ConnectionListener = (state: ConnectionState) => void;
export type FilterListener = (reason: string, packet: RawOpenConnectPacket) => void;

class OpenConnectService {
  private ws: WebSocket | null = null;
  private url = 'ws://127.0.0.1:921';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectIntervalMs = 3000;
  private shouldReconnect = true;

  private shotListeners: Set<ShotListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();
  private filterListeners: Set<FilterListener> = new Set();

  private state: ConnectionState = {
    connected: false,
    connecting: false,
    url: 'ws://127.0.0.1:921',
    port: 921,
    lastMessageTime: null,
    errorMessage: null,
    packetsReceived: 0,
    packetsFiltered: 0,
  };

  private currentStimp = 10.5;
  private currentTargetDistanceFt = 10.0;
  private currentSlopeDifficulty: SlopeDifficulty = 'flat';
  private currentTerrainSeed = 42;
  private currentHoleRadiusMultiplier = 1.0;

  constructor() {
    // Only attempt browser WebSocket connection on client side
    if (typeof window !== 'undefined') {
      const savedPort = localStorage.getItem('squareputt_oc_port');
      if (savedPort) {
        const port = parseInt(savedPort, 10);
        if (!isNaN(port)) {
          this.state.port = port;
          this.url = `ws://127.0.0.1:${port}`;
          this.state.url = this.url;
        }
      }
    }
  }

  public setEnvironmentContext({
    stimp,
    targetDistanceFt,
    slopeDifficulty,
    terrainSeed = 42,
    holeRadiusMultiplier = 1.0,
  }: {
    stimp: number;
    targetDistanceFt: number;
    slopeDifficulty: SlopeDifficulty;
    terrainSeed?: number;
    holeRadiusMultiplier?: number;
  }) {
    this.currentStimp = stimp;
    this.currentTargetDistanceFt = targetDistanceFt;
    this.currentSlopeDifficulty = slopeDifficulty;
    this.currentTerrainSeed = terrainSeed;
    this.currentHoleRadiusMultiplier = holeRadiusMultiplier;
  }

  public getState(): ConnectionState {
    return { ...this.state };
  }

  public setPort(port: number): void {
    this.state.port = port;
    this.url = `ws://127.0.0.1:${port}`;
    this.state.url = this.url;
    if (typeof window !== 'undefined') {
      localStorage.setItem('squareputt_oc_port', port.toString());
    }
    if (this.state.connected || this.state.connecting) {
      this.disconnect();
      this.connect();
    }
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.updateState({ connecting: true, errorMessage: null });

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateState({
          connected: true,
          connecting: false,
          errorMessage: null,
        });
      };

      this.ws.onmessage = (event) => {
        this.handleRawMessage(event.data);
      };

      this.ws.onerror = () => {
        this.updateState({
          errorMessage: `Cannot reach Open Connect server at ${this.url}. Check connector software.`,
        });
      };

      this.ws.onclose = () => {
        this.updateState({
          connected: false,
          connecting: false,
        });
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        connected: false,
        connecting: false,
        errorMessage: `Connection failed: ${msg}`,
      });
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateState({
      connected: false,
      connecting: false,
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateState({
        errorMessage: `Connection suspended after ${this.maxReconnectAttempts} attempts. Use manual reconnect or the built-in simulator.`,
      });
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectIntervalMs);
  }

  private handleRawMessage(rawData: string): void {
    this.state.packetsReceived++;
    this.state.lastMessageTime = Date.now();
    this.notifyConnectionState();

    try {
      const parsed: RawOpenConnectPacket = JSON.parse(rawData);
      this.processPacket(parsed);
    } catch (err) {
      console.warn('[OpenConnect] Malformed JSON packet received:', err);
    }
  }

  /**
   * Processes a validated packet and generates a full PuttingShotData record with physics.
   */
  public processPacket(packet: RawOpenConnectPacket): PuttingShotData | null {
    // 1. Sanitize incoming telemetry
    const sanitization = telemetrySanitizer.sanitize(packet);
    if (!sanitization.isValid || !sanitization.sanitizedPacket) {
      this.state.packetsFiltered++;
      this.notifyConnectionState();
      this.filterListeners.forEach((listener) =>
        listener(sanitization.reason || 'Packet filtered', packet)
      );
      return null;
    }

    const clean = sanitization.sanitizedPacket;
    const ballSpeedMph = clean.BallData?.Speed ?? 5.0;
    const hlaDeg = clean.BallData?.HLA ?? 0.0;
    const vlaDeg = clean.BallData?.VLA ?? 1.5;
    const faceAngleDeg = clean.ClubData?.FaceAngle ?? hlaDeg * 0.85;
    const putterPathDeg = clean.ClubData?.Path ?? 0.0;
    const aoaDeg = clean.ClubData?.AngleOfAttack ?? 1.2;
    const dynamicLoftDeg = clean.ClubData?.DynamicLoft ?? 2.4;

    // 2. Run numerical putting physics simulation
    const sim = simulatePutt({
      ballSpeedMph,
      hlaDeg,
      vlaDeg,
      stimp: this.currentStimp,
      targetDistanceFt: this.currentTargetDistanceFt,
      slopeDifficulty: this.currentSlopeDifficulty,
      terrainSeed: this.currentTerrainSeed,
      holeRadiusMultiplier: this.currentHoleRadiusMultiplier,
    });

    // 3. Compute Biomechanical & Quintic Grades
    const faceGrade = gradeFaceAngle(faceAngleDeg);
    const pathGrade = gradePutterPath(putterPathDeg);
    const loftAnalysis = analyzeDynamicLoft(dynamicLoftDeg, aoaDeg, vlaDeg);

    // Speed consistency relative to target distance
    const expectedSpeedMph = Math.sqrt((this.currentTargetDistanceFt * 1.95) / (this.currentStimp * 0.12));
    const speedRatio = Math.abs(ballSpeedMph - expectedSpeedMph) / Math.max(1, expectedSpeedMph);
    const speedGrade = speedRatio < 0.06 ? 'eagle' : speedRatio < 0.12 ? 'birdie' : speedRatio < 0.20 ? 'par' : 'bogey';

    const overallGrade =
      faceGrade === 'eagle' && speedGrade === 'eagle'
        ? 'eagle'
        : faceGrade === 'bogey' || speedGrade === 'bogey'
        ? 'bogey'
        : faceGrade === 'birdie' || speedGrade === 'birdie'
        ? 'birdie'
        : 'par';

    const shotData: PuttingShotData = {
      id: `shot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      shotNumber: clean.ShotNumber ?? Date.now(),
      ballSpeedMph,
      ballSpeedMps: Number((ballSpeedMph * 0.44704).toFixed(2)),
      vla: vlaDeg,
      hla: hlaDeg,
      totalSpinRpm: clean.BallData?.TotalSpin ?? 0,
      clubSpeedMph: clean.ClubData?.Speed ?? Number((ballSpeedMph * 0.65).toFixed(1)),
      angleOfAttackDeg: aoaDeg,
      putterPathDeg,
      faceAngleDeg,
      faceToPathDeg: Number((faceAngleDeg - putterPathDeg).toFixed(2)),
      dynamicLoftDeg,
      stimpSetting: this.currentStimp,
      slopeDifficulty: this.currentSlopeDifficulty,
      targetDistanceFt: this.currentTargetDistanceFt,
      rollDistanceFt: sim.totalDistanceFt,
      lateralErrorInches: sim.lateralDeviationInches,
      distanceErrorFt: sim.distanceErrorFt,
      isHoled: sim.isHoled,
      timeToZeroSkidMs: sim.timeToZeroSkidMs,
      skidDistanceInches: sim.skidDistanceInches,
      trueRollDistanceFt: sim.trueRollDistanceFt,
      skidPercentage: Number(
        ((sim.skidDistanceInches / (sim.totalDistanceFt * 12 || 1)) * 100).toFixed(1)
      ),
      grades: {
        faceAngleGrade: faceGrade,
        pathGrade,
        speedConsistencyGrade: speedGrade,
        launchGrade: loftAnalysis.grade,
        overallGrade,
      },
      trajectoryPoints: sim.trajectory.map((p) => [p.x, p.y, p.z]),
    };

    // Notify listeners
    this.shotListeners.forEach((listener) => listener(shotData));
    return shotData;
  }

  /**
   * Virtual Simulator: Trigger a synthetic shot for testing & practice
   */
  public triggerSimulatedShot({
    ballSpeedMph,
    hlaDeg = 0.0,
    faceAngleDeg,
    pathDeg = 0.0,
    angleOfAttackDeg = 1.2,
    dynamicLoftDeg = 2.4,
    vlaDeg = 1.5,
  }: {
    ballSpeedMph?: number;
    hlaDeg?: number;
    faceAngleDeg?: number;
    pathDeg?: number;
    angleOfAttackDeg?: number;
    dynamicLoftDeg?: number;
    vlaDeg?: number;
  }): PuttingShotData | null {
    // If ball speed not specified, calculate optimal speed for current target distance & stimp
    const targetFt = this.currentTargetDistanceFt;
    const stimp = this.currentStimp;

    // Approximate speed in mph required on flat green: v ~ sqrt(distFt * (14.0 / stimp) * 2.8)
    const idealSpeedMph = Math.sqrt(targetFt * (11.0 / stimp) * 2.4);
    const speed = ballSpeedMph ?? Number(idealSpeedMph.toFixed(1));
    const face = faceAngleDeg ?? Number((hlaDeg * 0.85).toFixed(2));

    const syntheticPacket: RawOpenConnectPacket = {
      BallData: {
        Speed: speed,
        HLA: hlaDeg,
        VLA: vlaDeg,
        TotalSpin: 80,
        SpinAxis: 0,
      },
      ClubData: {
        Speed: Number((speed * 0.65).toFixed(1)),
        Path: pathDeg,
        FaceAngle: face,
        FaceToPath: Number((face - pathDeg).toFixed(2)),
        AngleOfAttack: angleOfAttackDeg,
        DynamicLoft: dynamicLoftDeg,
      },
      Confidence: 98,
      ShotNumber: Math.floor(Math.random() * 10000),
      Timestamp: Date.now(),
    };

    return this.processPacket(syntheticPacket);
  }

  public subscribeShot(listener: ShotListener): () => void {
    this.shotListeners.add(listener);
    return () => this.shotListeners.delete(listener);
  }

  public subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.getState());
    return () => this.connectionListeners.delete(listener);
  }

  public subscribeFilter(listener: FilterListener): () => void {
    this.filterListeners.add(listener);
    return () => this.filterListeners.delete(listener);
  }

  private updateState(partial: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyConnectionState();
  }

  private notifyConnectionState(): void {
    const s = this.getState();
    this.connectionListeners.forEach((listener) => listener(s));
  }
}

export const openConnectService = new OpenConnectService();
