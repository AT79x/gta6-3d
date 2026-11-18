// Solmar Bay 3D — procedural sound: every effect and the music loop are
// synthesised with WebAudio, no audio files. Everything is guarded: with no
// user gesture yet (or no audio device, as in a headless screenshot run) the
// system stays silent and every call is a no-op.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.enabled = false;
  }

  /** Call from a user gesture (keydown / click) to unlock audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this.startEngine();
      this.startSiren();
    } catch (e) {
      this.ctx = null;
      this.enabled = false;
    }
  }

  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { /* silent */ }
  }

  startSiren() {
    try {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { /* silent */ }
  }

  /** Per-frame update: engine hum follows speed, siren wails when wanted. */
  update(state, dt) {
    if (!this.enabled || !this.ctx) return;
    try {
      const speed = state.player.car ? Math.abs(state.player.car.speed) : 0;
      if (this.engineGain) {
        this.engineGain.gain.value = state.player.car ? 0.02 + speed * 0.0012 : 0;
        if (this.engineOsc) this.engineOsc.frequency.value = 45 + speed * 4;
      }
      if (this.sirenGain) {
        if (state.wanted > 0) {
          this.sirenTimer -= dt;
          if (this.sirenTimer <= 0) {
            this.sirenTimer = 0.45;
            this.sirenHigh = !this.sirenHigh;
            this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
          }
          this.sirenGain.gain.value = 0.02;
        } else {
          this.sirenGain.gain.value = 0;
        }
      }
      // A lazy bassline: A minor, one note every 0.28 s, very quiet.
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 0.28;
        const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
        this.tone(bass[this.musicStep % bass.length], 0.26, 'triangle', 0.05);
        this.musicStep += 1;
      }
    } catch (e) { /* silent */ }
  }

  tone(freq, dur, type, gain) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) { /* silent */ }
  }

  shoot() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.09);
      g.gain.setValueAtTime(0.14, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.11);
    } catch (e) { /* silent */ }
  }

  punch() { this.tone(90, 0.12, 'sine', 0.16); }
  enemyShot() { this.tone(160, 0.08, 'square', 0.05); }
  pickup() { this.tone(660, 0.1, 'sine', 0.09); this.tone(880, 0.14, 'sine', 0.09); }
  missionDone() {
    this.tone(523, 0.12, 'triangle', 0.1);
    setTimeout(() => this.tone(659, 0.12, 'triangle', 0.1), 120);
    setTimeout(() => this.tone(784, 0.2, 'triangle', 0.1), 240);
  }
  horn() { this.tone(370, 0.18, 'sawtooth', 0.07); }
}
