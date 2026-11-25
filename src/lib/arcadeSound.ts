export class RetroSynth {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.08,
    endFreq?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, endFreq),
          now + duration
        );
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // Silenciar fallos de Web Audio en navegadores restringidos
    }
  }

  public pickup(combo: number) {
    const base = 440 + Math.min(combo, 8) * 55;
    this.tone(base, 0.09, 'triangle', 0.085, base * 1.35);
  }

  public note(laneIndex: number, perfect = true) {
    const scale = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
    const freq = scale[laneIndex % scale.length] ?? 523.25;
    this.tone(
      freq,
      perfect ? 0.12 : 0.09,
      perfect ? 'triangle' : 'sine',
      perfect ? 0.095 : 0.07,
      freq * 1.04
    );
  }

  public jump(boost = false) {
    this.tone(
      boost ? 340 : 240,
      boost ? 0.16 : 0.1,
      'sine',
      0.08,
      boost ? 820 : 520
    );
  }

  public shoot() {
    this.tone(620, 0.045, 'square', 0.028, 320);
  }

  public hitEnemy(isBoss = false) {
    this.tone(isBoss ? 180 : 280, isBoss ? 0.14 : 0.07, 'sawtooth', 0.07, 90);
  }

  public damage() {
    this.tone(160, 0.22, 'sawtooth', 0.11, 55);
  }

  public ability() {
    this.tone(360, 0.12, 'sine', 0.1, 880);
    setTimeout(() => this.tone(540, 0.16, 'triangle', 0.08, 1080), 55);
  }

  public successChime() {
    this.tone(523.25, 0.09, 'triangle', 0.085, 659.25);
    setTimeout(() => this.tone(783.99, 0.14, 'triangle', 0.085, 1046.5), 75);
  }

  public gameOver() {
    this.tone(320, 0.16, 'triangle', 0.09, 240);
    setTimeout(() => this.tone(220, 0.28, 'sawtooth', 0.08, 95), 140);
  }
}
