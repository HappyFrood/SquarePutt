/**
 * SquarePutt Audio Synthesizer (Web Audio API)
 * High-fidelity procedural acoustic sound engine for:
 * 1. Solid milled putter face strike ("click-thock")
 * 2. Divine golf ball falling in regulation cup (lip clip, bottom plate clack, multi-bounce rattle, and pin ferrule chatter)
 * 3. Milestone celebratory chimes
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this.unlocked) {
          this.initCtx();
          this.unlocked = true;
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
          window.removeEventListener('touchstart', unlock);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  public initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Generates or retrieves cached white noise buffer for realistic physical contact clicks
   */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const sampleRate = ctx.sampleRate;
      const bufferSize = sampleRate * 0.5; // 500ms
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /**
   * Putter strike sound: Solid milled putter face strike "click-thud"
   */
  public playPutterStrike(): void {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.7, now);
    master.connect(ctx.destination);

    // 1. Transient contact click (noise burst)
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseFilter.Q.setValueAtTime(3.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.03);

    // 2. High transient metallic click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1450, now);
    clickOsc.frequency.exponentialRampToValueAtTime(380, now + 0.038);

    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    clickOsc.connect(clickGain);
    clickGain.connect(master);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    // 3. Deep ball compression core thud
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(260, now);
    thudOsc.frequency.exponentialRampToValueAtTime(75, now + 0.085);

    thudGain.gain.setValueAtTime(0.5, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    thudOsc.connect(thudGain);
    thudGain.connect(master);
    thudOsc.start(now);
    thudOsc.stop(now + 0.1);
  }

  /**
   * The divine sound of a golf ball falling into the cup:
   * Layered physical acoustics:
   * - Lip clip transient
   * - Primary heavy bottom plate strike ("CLACK")
   * - Hollow cylinder acoustic body resonance
   * - 3 natural secondary plastic rebounds / rattle
   * - Subtle pin flagstick ferrule chatter
   */
  public playCupDrop(): void {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master Compressor / Limiter for punchy, rich, crisp acoustic impact
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-8, now);
    compressor.knee.setValueAtTime(6, now);
    compressor.ratio.setValueAtTime(5, now);
    compressor.attack.setValueAtTime(0.001, now);
    compressor.release.setValueAtTime(0.08, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Helper: Trigger a contact click + resonant tone for each bounce
    const playBounce = (timeOffset: number, baseFreq: number, gainLevel: number, decaySec: number, noiseFreq: number) => {
      const t = now + timeOffset;

      // A. Resonant body strike
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, t + decaySec);

      oscGain.gain.setValueAtTime(gainLevel, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + decaySec);

      osc.connect(oscGain);
      oscGain.connect(compressor);
      osc.start(t);
      osc.stop(t + decaySec);

      // B. Hollow cup cylinder resonance harmonic
      const harmOsc = ctx.createOscillator();
      const harmGain = ctx.createGain();
      harmOsc.type = 'sine';
      harmOsc.frequency.setValueAtTime(baseFreq * 1.85, t);
      harmOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, t + decaySec * 0.8);

      harmGain.gain.setValueAtTime(gainLevel * 0.45, t);
      harmGain.gain.exponentialRampToValueAtTime(0.001, t + decaySec * 0.8);

      harmOsc.connect(harmGain);
      harmGain.connect(compressor);
      harmOsc.start(t);
      harmOsc.stop(t + decaySec * 0.8);

      // C. Sharp surface impact transient (dimpled urethane meeting hard plastic/aluminum)
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(noiseFreq, t);
      filter.Q.setValueAtTime(4.0, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gainLevel * 0.6, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(compressor);
      noise.start(t);
      noise.stop(t + 0.025);
    };

    // 1. Initial Lip Clip & Drop Entry (t = 0ms)
    playBounce(0.0, 680, 0.4, 0.05, 3400);

    // 2. Primary Hard Bottom Plate Impact — THE SATISFYING CLACK (t = 18ms)
    playBounce(0.018, 480, 0.85, 0.11, 2600);

    // Hollow cup low-end cavity thud (t = 18ms)
    const subThud = ctx.createOscillator();
    const subGain = ctx.createGain();
    subThud.type = 'sine';
    subThud.frequency.setValueAtTime(280, now + 0.018);
    subThud.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    subGain.gain.setValueAtTime(0.65, now + 0.018);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    subThud.connect(subGain);
    subGain.connect(compressor);
    subThud.start(now + 0.018);
    subThud.stop(now + 0.14);

    // 3. First Rebound Clack inside Cup (t = 64ms)
    playBounce(0.064, 430, 0.55, 0.08, 2200);

    // 4. Second Bounce Rattle (t = 112ms)
    playBounce(0.112, 380, 0.38, 0.065, 1900);

    // 5. Third Light Settling Bounce (t = 158ms)
    playBounce(0.158, 330, 0.22, 0.05, 1600);

    // 6. Final Settling Flutter / Roll (t = 198ms)
    playBounce(0.198, 280, 0.14, 0.04, 1400);

    // 7. Flagstick Ferrule Chatter Vibration (t = 25ms - 220ms)
    const pinChime = ctx.createOscillator();
    const pinGain = ctx.createGain();
    pinChime.type = 'sine';
    pinChime.frequency.setValueAtTime(2150, now + 0.025);
    pinChime.frequency.exponentialRampToValueAtTime(1920, now + 0.2);

    pinGain.gain.setValueAtTime(0.18, now + 0.025);
    pinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    pinChime.connect(pinGain);
    pinGain.connect(compressor);
    pinChime.start(now + 0.025);
    pinChime.stop(now + 0.23);
  }

  /**
   * Streak / Celebration sound for holed putts in survival drills
   */
  public playCelebrationChime(): void {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.25, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.42);
    });
  }
}

export const audioEngine = new AudioSynthesizer();
