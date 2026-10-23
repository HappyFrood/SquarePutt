/**
 * SquarePutt sound.
 *
 * Cup drop is physically modelled rather than "beeped": the ball falls ~85 mm onto the
 * plastic cup bottom (≈130 ms), then rebounds with a coefficient of restitution of ~0.45,
 * so impacts come closer together and quieter (118 ms, 53 ms, 24 ms…). Each impact is a
 * very short noise burst ringing a small bank of resonators tuned to a hollow plastic cup.
 * Every drop is slightly randomized so it never sounds canned.
 *
 * To use a recording instead, place an audio file at /public/sounds/cup-drop.mp3.
 */

const CUP_SAMPLE_URL = '/sounds/cup-drop.mp3';

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private cupSample: AudioBuffer | null = null;
  private sampleTried = false;

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.enabled = localStorage.getItem('squareputt_sound') !== 'off';
    } catch {
      /* ignore */
    }
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      comp.attack.value = 0.001;
      comp.release.value = 0.1;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.loadSample();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private async loadSample() {
    if (this.sampleTried || !this.ctx) return;
    this.sampleTried = true;
    try {
      const res = await fetch(CUP_SAMPLE_URL);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      this.cupSample = await this.ctx.decodeAudioData(buf);
    } catch {
      /* no sample — use the synthesized drop */
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem('squareputt_sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private noiseBuffer(ctx: AudioContext) {
    if (!this.noise || this.noise.sampleRate !== ctx.sampleRate) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    return this.noise;
  }

  /** A single hard contact: noise impulse exciting tuned resonators. */
  private impact(
    t: number,
    gain: number,
    modes: [number, number, number][], // [freq Hz, Q, level]
    burstMs = 1.6,
    lowThump = 0
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.0004);
    env.gain.exponentialRampToValueAtTime(0.0005, t + burstMs / 1000 + 0.002);
    src.connect(env);
    for (const [f, q, lvl] of modes) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = lvl * Math.sqrt(q); // resonant energy roughly independent of Q
      env.connect(bp);
      bp.connect(g);
      g.connect(this.master!);
    }
    // direct click
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const hg = ctx.createGain();
    hg.gain.value = 0.35;
    env.connect(hp);
    hp.connect(hg);
    hg.connect(this.master!);
    src.start(t);
    src.stop(t + 0.06);

    if (lowThump > 0) {
      const o = ctx.createOscillator();
      o.frequency.value = 140 + Math.random() * 20;
      const og = ctx.createGain();
      og.gain.setValueAtTime(lowThump, t);
      og.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
      o.connect(og);
      og.connect(this.master!);
      o.start(t);
      o.stop(t + 0.07);
    }
  }

  playPutterStrike() {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    // milled face on urethane cover: short bright click with a little head ring
    this.impact(t, 0.55, [
      [1900, 5, 0.25],
      [3400, 9, 0.35],
      [5600, 14, 0.18],
    ], 1.2, 0.25);
  }

  playCupDrop() {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    if (this.cupSample) {
      const s = ctx.createBufferSource();
      s.buffer = this.cupSample;
      s.connect(this.master!);
      s.start(t0);
      return;
    }
    const j = () => 1 + (Math.random() - 0.5) * 0.08; // ±4% per drop
    const cupModes: [number, number, number][] = [
      [430 * j(), 7, 0.45],
      [980 * j(), 11, 0.9],
      [1680 * j(), 13, 0.7],
      [2750 * j(), 15, 0.45],
      [4300 * j(), 12, 0.22],
    ];
    // rim tick as the ball tips over the edge
    this.impact(t0, 0.12, [[3100, 8, 0.4], [5200, 10, 0.2]], 0.8);
    // fall ~85 mm, then rebound with decreasing intervals
    const g = 9.81;
    const e = 0.42 + Math.random() * 0.08;
    let v = Math.sqrt(2 * g * 0.085);
    let t = t0 + Math.sqrt((2 * 0.085) / g);
    for (let i = 0; i < 6 && v > 0.04; i++) {
      const level = Math.min(1, Math.pow(v / 1.3, 1.1));
      this.impact(t, 0.9 * level, cupModes, 1.8, i === 0 ? 0.55 : 0.15 * level);
      v *= e;
      t += (2 * v) / g;
    }
    // short settle/rattle as it comes to rest
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.05, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.master!);
    src.start(t);
    src.stop(t + 0.2);
  }

  playLipOut() {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const modes: [number, number, number][] = [
      [980, 10, 0.5],
      [1700, 12, 0.4],
      [2800, 14, 0.25],
    ];
    this.impact(t, 0.3, modes, 1.4);
    this.impact(t + 0.045, 0.14, modes, 1.0);
  }

  playChime() {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const gn = ctx.createGain();
      const t = now + i * 0.09;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(gn);
      gn.connect(this.master!);
      o.start(t);
      o.stop(t + 0.65);
    });
  }
}

export const audioEngine = new AudioSynthesizer();
