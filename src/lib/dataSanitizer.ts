/**
 * OpenSkyPlus-Inspired Data Sanitizer
 * Discards phantom swings, accidental triggers, misreads, and out-of-bounds telemetry
 * before they affect user statistics or drill scores.
 */

import { RawOpenConnectPacket } from './types';

export interface SanitizationResult {
  isValid: boolean;
  reason?: string;
  sanitizedPacket?: RawOpenConnectPacket;
}

class TelemetrySanitizer {
  private lastShotTimestamp = 0;
  private lastShotHash = '';

  // Configurable thresholds for putting telemetry
  private readonly MIN_PUTTING_SPEED_MPH = 0.75;  // ~0.34 m/s (filters phantom club waggles)
  private readonly MAX_PUTTING_SPEED_MPH = 32.0;  // ~14.3 m/s (filters accidental chips/irons)
  private readonly MIN_VLA_DEG = -3.0;            // Extreme downward strike limit
  private readonly MAX_VLA_DEG = 12.0;            // Scooped / chipped limit
  private readonly MIN_CONFIDENCE_PCT = 35.0;     // Hardware read confidence floor
  private readonly DEBOUNCE_MS = 1200;            // Minimum duration between distinct putts

  /**
   * Evaluates raw packet incoming from Open Connect WebSocket or manual stream.
   */
  public sanitize(raw: RawOpenConnectPacket): SanitizationResult {
    const now = Date.now();

    // 1. Check packet presence
    if (!raw || typeof raw !== 'object') {
      return { isValid: false, reason: 'Empty or malformed telemetry packet' };
    }

    const ballData = raw.BallData;
    const clubData = raw.ClubData;

    // Must have at least ball data with speed
    if (!ballData || typeof ballData.Speed !== 'number' || isNaN(ballData.Speed)) {
      return { isValid: false, reason: 'Missing or invalid Ball Speed' };
    }

    // Convert speed to MPH if incoming data is in m/s (detected if speed < 12 and typical VLA)
    // Most Open Connect bridges transmit speed in MPH directly.
    const speedMph = ballData.Speed;
    if (speedMph <= 0) {
      return { isValid: false, reason: 'Zero or negative Ball Speed detected' };
    }

    // 2. Filter Phantom Swings / Sub-threshold movement
    if (speedMph < this.MIN_PUTTING_SPEED_MPH) {
      return {
        isValid: false,
        reason: `Ball speed (${speedMph.toFixed(1)} mph) is below putting threshold (${this.MIN_PUTTING_SPEED_MPH} mph) - phantom movement filtered`,
      };
    }

    // 3. Filter Chipping / Non-putting shots
    if (speedMph > this.MAX_PUTTING_SPEED_MPH) {
      return {
        isValid: false,
        reason: `Ball speed (${speedMph.toFixed(1)} mph) exceeds putting ceiling (${this.MAX_PUTTING_SPEED_MPH} mph) - likely chip or iron`,
      };
    }

    // 4. Validate Vertical Launch Angle
    const vla = ballData.VLA ?? 1.5;
    if (vla < this.MIN_VLA_DEG || vla > this.MAX_VLA_DEG) {
      return {
        isValid: false,
        reason: `Launch angle (${vla.toFixed(1)}°) out of realistic putting range [${this.MIN_VLA_DEG}°, ${this.MAX_VLA_DEG}°]`,
      };
    }

    // 5. Hardware Confidence Check
    if (typeof raw.Confidence === 'number' && raw.Confidence < this.MIN_CONFIDENCE_PCT) {
      return {
        isValid: false,
        reason: `Hardware confidence score (${raw.Confidence.toFixed(0)}%) below minimum threshold (${this.MIN_CONFIDENCE_PCT}%)`,
      };
    }

    // 6. Rapid Duplicate Debounce
    const packetHash = `${speedMph.toFixed(2)}_${(ballData.HLA ?? 0).toFixed(2)}_${(clubData?.FaceAngle ?? 0).toFixed(2)}`;
    const timeDelta = now - this.lastShotTimestamp;

    if (timeDelta < this.DEBOUNCE_MS && packetHash === this.lastShotHash) {
      return {
        isValid: false,
        reason: `Duplicate shot packet received within debounce window (${timeDelta}ms)`,
      };
    }

    // Update state for next check
    this.lastShotTimestamp = now;
    this.lastShotHash = packetHash;

    // Normalize and sanitize numerical fields to avoid NaN/Infinity
    const sanitized: RawOpenConnectPacket = {
      ...raw,
      BallData: {
        Speed: speedMph,
        VLA: clamp(vla, -5, 15),
        HLA: clamp(ballData.HLA ?? 0, -25, 25),
        TotalSpin: clamp(ballData.TotalSpin ?? 0, 0, 800),
        SpinAxis: clamp(ballData.SpinAxis ?? 0, -90, 90),
      },
      ClubData: clubData
        ? {
            Speed: clamp(clubData.Speed ?? speedMph * 0.6, 0.5, 25),
            Path: clamp(clubData.Path ?? 0, -15, 15),
            FaceAngle: clamp(clubData.FaceAngle ?? (ballData.HLA ?? 0) * 0.85, -15, 15),
            FaceToPath: clamp(
              clubData.FaceToPath ??
                ((clubData.FaceAngle ?? 0) - (clubData.Path ?? 0)),
              -20,
              20
            ),
            AngleOfAttack: clamp(clubData.AngleOfAttack ?? 1.2, -8, 8),
            DynamicLoft: clamp(clubData.DynamicLoft ?? 2.5, -4, 10),
          }
        : {
            Speed: speedMph * 0.6,
            Path: 0,
            FaceAngle: (ballData.HLA ?? 0) * 0.85,
            FaceToPath: (ballData.HLA ?? 0) * 0.85,
            AngleOfAttack: 1.2,
            DynamicLoft: 2.5,
          },
      ShotNumber: raw.ShotNumber ?? Math.floor(now / 1000),
      Timestamp: now,
    };

    return { isValid: true, sanitizedPacket: sanitized };
  }

  public reset(): void {
    this.lastShotTimestamp = 0;
    this.lastShotHash = '';
  }
}

function clamp(value: number, min: number, max: number): number {
  if (isNaN(value)) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

export const telemetrySanitizer = new TelemetrySanitizer();
