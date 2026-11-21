// audio.js — every sound is synthesized with WebAudio, no audio files.
// Footsteps are short filtered-noise ticks: Wick's are soft and high, a
// guard's are heavy and low, and their volume and stereo pan follow the
// guard's distance and direction from the player — so you can hear a guard
// coming around a corner before you see the cone. The near-miss alarm is a
// two-note sting; pickups chime; the exit plays a small rising arpeggio.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.stepPhase = 0;
  }

  // Created lazily on the first user gesture; browsers block audio before it.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  // A single footstep tick. `heavy` = guard boot, `pan` = -1..1, `vol` 0..1.
  footstep(heavy, pan, vol) {
    if (!this.enabled || !this.ensure() || vol <= 0.01) return;
    const t = this.ctx.currentTime;
    const dur = heavy ? 0.09 : 0.06;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const decay = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = heavy ? 320 : 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filter).connect(gain).connect(panner).connect(this.master);
    src.start(t);
  }

  // A short sine blip at `freq` Hz, `dur` seconds, `vol` 0..1.
  tone(freq, dur, vol, when = 0) {
    if (!this.enabled || !this.ensure()) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Two-note alarm sting for a near miss; a harsher pair for a full alert.
  alarm(full) {
    if (full) {
      this.tone(392, 0.16, 0.35);
      this.tone(311, 0.22, 0.35, 0.14);
      this.tone(392, 0.16, 0.3, 0.3);
    } else {
      this.tone(523, 0.12, 0.25);
      this.tone(659, 0.18, 0.22, 0.1);
    }
  }

  // Lantern pickup: a bright two-note chime.
  pickup() {
    this.tone(880, 0.12, 0.3);
    this.tone(1318, 0.2, 0.25, 0.07);
  }

  // Pebble toss: a soft click.
  toss() {
    this.tone(180, 0.05, 0.2);
  }

  // Pebble landing: a tiny tick that guards hear.
  pebbleLand() {
    this.tone(1200, 0.04, 0.18);
    this.tone(900, 0.05, 0.14, 0.05);
  }

  // Level clear: a rising four-note arpeggio.
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 0.3, i * 0.09));
  }

  // Caught: a low falling note.
  caught() {
    this.tone(220, 0.4, 0.3);
    this.tone(147, 0.5, 0.3, 0.15);
  }
}
