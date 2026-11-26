// Synthesised engine, tyre, wind, horn and crash sounds (no audio files needed).
export class GameAudio {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('citydrive-muted') === '1'; this.paused = false; this.lastCrash = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.level();
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);

    // engine: detuned oscillators -> soft distortion -> low-pass
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    this.eFilter = ctx.createBiquadFilter(); this.eFilter.type = 'lowpass'; this.eFilter.Q.value = 2.5; this.eFilter.frequency.value = 600;
    this.eGain = ctx.createGain(); this.eGain.gain.value = 0;
    this.oscs = [];
    const mk = (type, mult, gain) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 50;
      const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(shaper); o.start();
      this.oscs.push({ o, mult });
    };
    mk('sawtooth', 1, .45); mk('square', .5, .3); mk('sawtooth', 2.004, .12); mk('triangle', .25, .45);
    shaper.connect(this.eFilter); this.eFilter.connect(this.eGain); this.eGain.connect(this.master);

    // noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const loopNoise = (type, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return g;
    };
    this.tire = loopNoise('bandpass', 1500, 7);
    this.wind = loopNoise('lowpass', 450, .7);

    // horn
    this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1800;
    for (const f of [415, 523]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(hf); o.start(); }
    hf.connect(this.hornGain); this.hornGain.connect(this.master);
  }

  level() { return this.muted || this.paused ? 0 : .55; }
  setMuted(m) { this.muted = m; localStorage.setItem('citydrive-muted', m ? '1' : '0'); this.apply(); }
  setPaused(p) { this.paused = p; this.apply(); }
  apply() { if (this.master) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, .05); }

  update(rpm, throttle, speed, slip, cyl) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = rpm / 60 * (cyl / 2);
    for (const o of this.oscs) o.o.frequency.setTargetAtTime(f * o.mult, t, .03);
    this.eFilter.frequency.setTargetAtTime(250 + rpm * .22 + throttle * 1400, t, .05);
    this.eGain.gain.setTargetAtTime(.09 + throttle * .17, t, .05);
    this.tire.gain.setTargetAtTime(Math.min(.3, Math.max(0, (slip - 2.5) * .04)), t, .05);
    this.wind.gain.setTargetAtTime(Math.min(.4, speed * speed * .000035), t, .1);
  }

  horn(on) { if (this.ctx) this.hornGain.gain.setTargetAtTime(on ? .22 : 0, this.ctx.currentTime, .02); }

  crash(k) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCrash < .25) return; this.lastCrash = now;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500 + k * 900;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(.9 * k + .15, now); g.gain.exponentialRampToValueAtTime(.001, now + .5 + k * .4);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(now); s.stop(now + 1.2);
  }
}
