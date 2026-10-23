/**
 * Telemetry sanitizer (OpenSkyPlus-inspired).
 * Drops heartbeats, phantom triggers, chips and duplicate packets before they reach a drill,
 * and normalizes field-name differences between connectors.
 */

import { RawOpenConnectPacket } from './types';

export interface NormalizedStroke {
  ballSpeedMph: number;
  hlaDeg: number;
  vlaDeg: number;
  backspinRpm?: number;
  clubSpeedMph?: number;
  faceAngleDeg: number;
  pathDeg: number;
  aoaDeg: number;
  dynamicLoftDeg: number;
  hasClubData: boolean;
  shotNumber: number;
}

export type SanitizationResult =
  | { kind: 'ignore'; reason: string } // heartbeats/status: not a shot, not an error
  | { kind: 'reject'; reason: string } // a shot we refuse to score
  | { kind: 'ok'; stroke: NormalizedStroke };

const MIN_SPEED_MPH = 0.75;
const MAX_SPEED_MPH = 30;
const MIN_VLA = -3;
const MAX_VLA = 12;
const MIN_CONFIDENCE = 35;
const DEBOUNCE_MS = 1200;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

class TelemetrySanitizer {
  private lastTime = 0;
  private lastHash = '';

  sanitize(raw: RawOpenConnectPacket): SanitizationResult {
    if (!raw || typeof raw !== 'object') return { kind: 'reject', reason: 'Malformed packet' };
    const opts = raw.ShotDataOptions;
    if (opts?.IsHeartBeat) return { kind: 'ignore', reason: 'heartbeat' };
    if (opts && opts.ContainsBallData === false) return { kind: 'ignore', reason: 'status update' };

    const ball = raw.BallData;
    let speed = num(ball?.Speed);
    if (speed === undefined) return { kind: 'ignore', reason: 'no ball data' };
    // GSPro Connect sends mph. A connector configured for metric may send m/s.
    if (raw.Units && /^met/i.test(raw.Units)) speed = speed / 0.44704;
    if (speed <= 0) return { kind: 'reject', reason: 'Zero ball speed' };
    if (speed < MIN_SPEED_MPH)
      return { kind: 'reject', reason: `Phantom trigger (${speed.toFixed(1)} mph)` };
    if (speed > MAX_SPEED_MPH)
      return { kind: 'reject', reason: `Not a putt (${speed.toFixed(1)} mph) — switch the monitor to putting mode` };

    const vla = num(ball?.VLA) ?? 1.5;
    if (vla < MIN_VLA || vla > MAX_VLA) return { kind: 'reject', reason: `Launch angle ${vla.toFixed(1)}° out of putting range` };
    if (typeof raw.Confidence === 'number' && raw.Confidence < MIN_CONFIDENCE)
      return { kind: 'reject', reason: `Low read confidence (${raw.Confidence.toFixed(0)}%)` };

    const hla = clamp(num(ball?.HLA) ?? 0, -20, 20);
    const club = raw.ClubData;
    const face = num(club?.FaceAngle) ?? num(club?.FaceToTarget);
    const path = num(club?.Path);
    const hasClubData = !!club && (face !== undefined || path !== undefined) && opts?.ContainsClubData !== false;

    const hash = `${speed.toFixed(2)}_${hla.toFixed(2)}_${(face ?? 0).toFixed(2)}`;
    const now = Date.now();
    if (now - this.lastTime < DEBOUNCE_MS && hash === this.lastHash)
      return { kind: 'reject', reason: 'Duplicate packet' };
    this.lastTime = now;
    this.lastHash = hash;

    // Face angle: if not measured, estimate from start direction (start line is ~80% face).
    const faceDeg = clamp(face ?? hla / 0.82, -15, 15);
    const pathDeg = clamp(path ?? 0, -15, 15);
    const backspin = num(ball?.BackSpin);

    return {
      kind: 'ok',
      stroke: {
        ballSpeedMph: speed,
        hlaDeg: hla,
        vlaDeg: clamp(vla, -5, 15),
        backspinRpm: backspin !== undefined ? clamp(backspin, -400, 400) : undefined,
        clubSpeedMph: num(club?.Speed),
        faceAngleDeg: faceDeg,
        pathDeg,
        aoaDeg: clamp(num(club?.AngleOfAttack) ?? 1.5, -8, 8),
        dynamicLoftDeg: clamp(num(club?.DynamicLoft) ?? num(club?.Loft) ?? 2.5, -4, 10),
        hasClubData,
        shotNumber: num(raw.ShotNumber) ?? Math.floor(now / 1000),
      },
    };
  }

  reset() {
    this.lastTime = 0;
    this.lastHash = '';
  }
}

export const telemetrySanitizer = new TelemetrySanitizer();
