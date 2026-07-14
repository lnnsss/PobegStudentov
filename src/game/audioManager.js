const SOUND_KEY = 'pobeg-studentov-sound-enabled';

function createGain(context, value, destination = context.destination) {
  const gain = context.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function nowOrZero(context) {
  return context?.currentTime || 0;
}

class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicPlaying = false;
    this.enabled = localStorage.getItem(SOUND_KEY) !== 'off';
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');

    if (!enabled) {
      this.stopMusic();
    } else if (this.musicPlaying) {
      this.startMusic();
    }
  }

  async unlock() {
    if (!this.enabled) return;
    this.ensureContext();
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  ensureContext() {
    if (this.context) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.context = new AudioContext();
    this.master = createGain(this.context, 0.28);
    this.musicGain = createGain(this.context, 0.12, this.master);
  }

  tone(frequency, duration, options = {}) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context || !this.master) return;

    const {
      delay = 0,
      type = 'square',
      volume = 0.3,
      endFrequency = frequency,
      destination = this.master,
    } = options;
    const start = this.context.currentTime + delay;
    const end = start + duration;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  noise(duration, options = {}) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context || !this.master) return;

    const { volume = 0.22, delay = 0 } = options;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;

    filter.type = 'lowpass';
    filter.frequency.value = 780;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
  }

  play(eventName) {
    if (!this.enabled) return;

    if (eventName === 'jump') {
      this.tone(420, 0.12, { endFrequency: 760, type: 'square', volume: 0.18 });
      this.tone(760, 0.08, { delay: 0.06, endFrequency: 980, type: 'square', volume: 0.1 });
    }

    if (eventName === 'star') {
      [720, 960, 1280].forEach((note, index) => {
        this.tone(note, 0.08, { delay: index * 0.055, endFrequency: note * 1.12, type: 'triangle', volume: 0.16 });
      });
    }

    if (eventName === 'damage') {
      this.noise(0.16, { volume: 0.22 });
      this.tone(170, 0.16, { endFrequency: 86, type: 'sawtooth', volume: 0.18 });
    }

    if (eventName === 'death') {
      [440, 330, 247, 165].forEach((note, index) => {
        this.tone(note, 0.22, { delay: index * 0.16, endFrequency: note * 0.82, type: 'triangle', volume: 0.16 });
      });
      this.noise(0.4, { delay: 0.42, volume: 0.08 });
    }

    if (eventName === 'record') {
      [523, 659, 784, 1046, 1318].forEach((note, index) => {
        this.tone(note, 0.09, { delay: index * 0.07, endFrequency: note * 1.05, type: 'square', volume: 0.14 });
      });
    }

    if (eventName === 'button') {
      this.tone(540, 0.06, { endFrequency: 680, volume: 0.1 });
    }
  }

  startMusic() {
    this.musicPlaying = true;
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context || !this.musicGain || this.musicTimer) return;

    const lead = [392, 494, 587, 494, 659, 587, 494, 440];
    const bass = [98, 98, 147, 147, 131, 131, 110, 110];

    this.musicTimer = window.setInterval(() => {
      if (!this.enabled || !this.context || this.context.state !== 'running') return;

      const step = this.musicStep % lead.length;
      const beat = nowOrZero(this.context);
      const leadOsc = this.context.createOscillator();
      const leadGain = this.context.createGain();
      const bassOsc = this.context.createOscillator();
      const bassGain = this.context.createGain();

      leadOsc.type = 'square';
      leadOsc.frequency.value = lead[step];
      leadGain.gain.setValueAtTime(0.0001, beat);
      leadGain.gain.linearRampToValueAtTime(0.12, beat + 0.01);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, beat + 0.16);

      bassOsc.type = 'triangle';
      bassOsc.frequency.value = bass[step];
      bassGain.gain.setValueAtTime(0.0001, beat);
      bassGain.gain.linearRampToValueAtTime(0.075, beat + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, beat + 0.24);

      leadOsc.connect(leadGain);
      bassOsc.connect(bassGain);
      leadGain.connect(this.musicGain);
      bassGain.connect(this.musicGain);
      leadOsc.start(beat);
      bassOsc.start(beat);
      leadOsc.stop(beat + 0.18);
      bassOsc.stop(beat + 0.26);
      this.musicStep += 1;
    }, 185);
  }

  stopMusic() {
    this.musicPlaying = false;
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }
}

export const gameAudio = new GameAudio();
