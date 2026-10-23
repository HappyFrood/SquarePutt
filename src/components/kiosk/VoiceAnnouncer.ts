/**
 * SquarePutt Hands-Free Voice Announcer
 * Uses browser-native Web Speech API for audible distance, face angle,
 * and drill results so golfers can keep putting without looking at a screen.
 */

import { PuttingShotData } from '@/lib/types';

class VoiceAnnouncer {
  private enabled = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speak('Voice telemetry enabled.');
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public speak(text: string): void {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // cancel previous utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05; // slightly brisk and natural
      utterance.pitch = 1.0;
      utterance.volume = 0.85;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => (v.lang.startsWith('en') && v.name.includes('Natural')) || v.name.includes('Google') || v.name.includes('Siri')
      );
      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  /**
   * Announces putting result
   */
  public announceShot(shot: PuttingShotData): void {
    if (!this.enabled) return;

    if (shot.isHoled) {
      this.speak(`Holed! ${shot.rollDistanceFt.toFixed(1)} feet. Square face.`);
      return;
    }

    const distFt = shot.rollDistanceFt.toFixed(1);
    const errFt = Math.abs(shot.distanceErrorFt).toFixed(1);
    const speedDir = shot.distanceErrorFt > 0 ? 'long' : 'short';

    const faceDeg = Math.abs(shot.faceAngleDeg).toFixed(1);
    const faceDir = shot.faceAngleDeg > 0.2 ? 'open' : shot.faceAngleDeg < -0.2 ? 'closed' : 'square';

    this.speak(`${distFt} feet. ${errFt} feet ${speedDir}. Face ${faceDeg} degrees ${faceDir}.`);
  }
}

export const voiceAnnouncer = new VoiceAnnouncer();
