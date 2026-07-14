const SOUND_KEY = 'pobeg-studentov-sound-enabled';
const MUSIC_VOLUME_KEY = 'pobeg-studentov-music-volume';
const EFFECTS_VOLUME_KEY = 'pobeg-studentov-effects-volume';
const TRACK_KEY = 'pobeg-studentov-music-track';

const TRACKS = [
  { name: 'Стартовый забег', interval: 185, wave: 'square', lead: [392, 494, 587, 494, 659, 587, 494, 440], bass: [98, 98, 147, 147, 131, 131, 110, 110] },
  { name: 'Утренний кампус', interval: 205, wave: 'triangle', lead: [523, 587, 659, 784, 659, 587, 523, 440], bass: [131, 131, 165, 165, 147, 147, 110, 110] },
  { name: 'Пара началась', interval: 170, wave: 'square', lead: [330, 392, 494, 392, 523, 494, 392, 330], bass: [82, 123, 82, 123, 98, 147, 98, 147] },
  { name: 'Зачётный рывок', interval: 155, wave: 'sawtooth', lead: [587, 659, 784, 988, 784, 659, 587, 494], bass: [147, 147, 196, 196, 165, 165, 123, 123] },
  { name: 'Ночной дедлайн', interval: 225, wave: 'triangle', lead: [294, 349, 440, 523, 440, 349, 330, 262], bass: [73, 73, 110, 110, 98, 98, 87, 87] },
  { name: 'Сессия близко', interval: 178, wave: 'square', lead: [440, 523, 659, 523, 698, 659, 523, 494], bass: [110, 110, 165, 165, 147, 147, 131, 131] },
  { name: 'Большая перемена', interval: 198, wave: 'triangle', lead: [659, 587, 523, 587, 784, 698, 659, 523], bass: [165, 123, 131, 123, 196, 147, 165, 131] },
  { name: 'Бег по набережной', interval: 190, wave: 'square', lead: [494, 587, 740, 587, 880, 740, 587, 494], bass: [123, 123, 185, 185, 165, 165, 147, 147] },
  { name: 'Преподаватель рядом', interval: 165, wave: 'sawtooth', lead: [349, 440, 523, 659, 523, 440, 392, 330], bass: [87, 131, 87, 131, 98, 147, 98, 147] },
  { name: 'Рекордный маршрут', interval: 160, wave: 'square', lead: [523, 659, 784, 1046, 988, 784, 659, 587], bass: [131, 196, 131, 196, 165, 220, 165, 220] },
];

function createGain(context, value, destination = context.destination) {
  const gain = context.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function readVolume(key, fallback) {
  const storedValue = localStorage.getItem(key);
  if (storedValue == null) return fallback;

  const value = Number(storedValue);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function nowOrZero(context) {
  return context?.currentTime || 0;
}

class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicPlaying = false;
    this.enabled = localStorage.getItem(SOUND_KEY) !== 'off';
    this.musicVolume = readVolume(MUSIC_VOLUME_KEY, 0.8);
    this.effectsVolume = readVolume(EFFECTS_VOLUME_KEY, 0.8);
    this.trackIndex = Math.min(TRACKS.length - 1, Math.max(0, Number(localStorage.getItem(TRACK_KEY)) || 0));
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
    this.applyVolumes();

    if (!enabled) {
      this.clearMusicTimer();
    }
  }

  getTracks() {
    return TRACKS.map((track) => track.name);
  }

  getTrackIndex() {
    return this.trackIndex;
  }

  setTrackIndex(index) {
    const nextIndex = ((Number(index) || 0) + TRACKS.length) % TRACKS.length;
    const wasPlaying = this.musicPlaying;
    this.trackIndex = nextIndex;
    this.musicStep = 0;
    localStorage.setItem(TRACK_KEY, String(nextIndex));

    if (wasPlaying) {
      this.clearMusicTimer();
      this.startMusic();
    }
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setMusicVolume(value) {
    this.musicVolume = Math.min(1, Math.max(0, Number(value) || 0));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
    this.applyVolumes();
  }

  getEffectsVolume() {
    return this.effectsVolume;
  }

  setEffectsVolume(value) {
    this.effectsVolume = Math.min(1, Math.max(0, Number(value) || 0));
    localStorage.setItem(EFFECTS_VOLUME_KEY, String(this.effectsVolume));
    this.applyVolumes();
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
    this.master = createGain(this.context, 1);
    this.musicGain = createGain(this.context, 0, this.master);
    this.effectsGain = createGain(this.context, 0, this.master);
    this.applyVolumes();
  }

  applyVolumes() {
    if (this.musicGain) this.musicGain.gain.value = this.enabled ? this.musicVolume * 0.2 : 0;
    if (this.effectsGain) this.effectsGain.gain.value = this.enabled ? this.effectsVolume * 0.32 : 0;
  }

  tone(frequency, duration, options = {}) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context || !this.effectsGain) return;

    const { delay = 0, type = 'square', volume = 0.3, endFrequency = frequency, destination = this.effectsGain } = options;
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
    if (!this.context || !this.effectsGain) return;

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
    gain.connect(this.effectsGain);
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
    this.applyVolumes();

    const currentTrack = TRACKS[this.trackIndex];
    this.musicTimer = window.setInterval(() => {
      if (!this.enabled || !this.context || this.context.state !== 'running') return;

      const track = TRACKS[this.trackIndex];
      const step = this.musicStep % track.lead.length;
      const beat = nowOrZero(this.context);
      const leadOsc = this.context.createOscillator();
      const leadGain = this.context.createGain();
      const bassOsc = this.context.createOscillator();
      const bassGain = this.context.createGain();

      leadOsc.type = track.wave;
      leadOsc.frequency.value = track.lead[step];
      leadGain.gain.setValueAtTime(0.0001, beat);
      leadGain.gain.linearRampToValueAtTime(0.12, beat + 0.01);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, beat + 0.16);

      bassOsc.type = 'triangle';
      bassOsc.frequency.value = track.bass[step];
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
    }, currentTrack.interval);
  }

  clearMusicTimer() {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  stopMusic() {
    this.musicPlaying = false;
    this.clearMusicTimer();
  }
}

export const gameAudio = new GameAudio();
