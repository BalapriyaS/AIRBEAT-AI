import { InstrumentId, SuperAttackId } from '../types/game';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.9;
  private musicVolume: number = 0.4;
  private isMusicPlaying: boolean = false;
  private musicIntervalId: number | null = null;
  private isInitialized: boolean = false;

  public init() {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioContext initialization error:', err);
    }
  }

  public ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Distortion curve generator for electric guitar
  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Play instrument attack sound
   * parameter `variation` (0..1) allows dynamic tonal modulation based on hand Y or pinch velocity!
   */
  public playInstrument(instrument: InstrumentId, variation: number = 0.5) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    switch (instrument) {
      case 'drums':
        this.playDrums(t, variation);
        break;
      case 'guitar':
        this.playGuitar(t, variation);
        break;
      case 'piano':
        this.playPiano(t, variation);
        break;
      case 'trumpet':
        this.playTrumpet(t, variation);
        break;
      case 'violin':
        this.playViolin(t, variation);
        break;
      case 'dj':
        this.playDJMixer(t, variation);
        break;
    }
  }

  // --- 1. DRUMS (Shockwave Smash) ---
  private drumHitCount: number = 0;
  private playDrums(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    this.drumHitCount++;
    const isSnare = this.drumHitCount % 2 === 0;

    // Heavy punchy kick
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    const startFreq = isSnare ? 120 : 170 + variation * 30;

    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(startFreq, t);
    kickOsc.frequency.exponentialRampToValueAtTime(34, t + 0.18);

    kickGain.gain.setValueAtTime(0.9, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    kickOsc.connect(kickGain);
    kickGain.connect(this.sfxGain);

    kickOsc.start(t);
    kickOsc.stop(t + 0.32);

    // Snappy snare noise burst (crisper on snare hits)
    const bufferSize = Math.floor(this.ctx.sampleRate * (isSnare ? 0.22 : 0.1));
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = isSnare ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(isSnare ? 1800 : 2500, t);
    filter.Q.setValueAtTime(1.5, t);

    const snareGain = this.ctx.createGain();
    snareGain.gain.setValueAtTime(isSnare ? 0.85 : 0.45, t);
    snareGain.gain.exponentialRampToValueAtTime(0.01, t + (isSnare ? 0.2 : 0.1));

    whiteNoise.connect(filter);
    filter.connect(snareGain);
    snareGain.connect(this.sfxGain);

    whiteNoise.start(t);
    whiteNoise.stop(t + (isSnare ? 0.2 : 0.1));
  }

  // --- 2. ELECTRIC GUITAR (Thunder Strike - Heavy Power Chords) ---
  private guitarNoteIdx: number = 0;
  private playGuitar(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    this.guitarNoteIdx++;
    // Power chord root frequencies: E2, G2, A2, C3, D3, E3
    const roots = [82.41, 98.00, 110.00, 130.81, 146.83, 164.81];
    const root = roots[(this.guitarNoteIdx + Math.floor(variation * 3)) % roots.length];
    const fifth = root * 1.4983; // Perfect fifth
    const octave = root * 2.0;

    [root, fifth, octave].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Heavy rock distortion
      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this.makeDistortionCurve(70) as Float32Array<ArrayBuffer>;
      distortion.oversample = '4x';

      // Guitar amp cabinet filter (peaking 2.8kHz + lowpass 4.5kHz)
      const cabFilter = this.ctx.createBiquadFilter();
      cabFilter.type = 'lowpass';
      cabFilter.frequency.setValueAtTime(3800, t);
      cabFilter.frequency.exponentialRampToValueAtTime(1200, t + 0.45);

      const ampGain = this.ctx.createGain();
      ampGain.gain.setValueAtTime(idx === 0 ? 0.6 : 0.4, t);
      ampGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(distortion);
      distortion.connect(cabFilter);
      cabFilter.connect(ampGain);
      ampGain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  // --- 3. PIANO (Falling Keys - Grand Piano) ---
  private pianoNoteIdx: number = 0;
  private playPiano(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    this.pianoNoteIdx++;
    // Concert grand piano notes across C major / pentatonic scale
    const pianoPitches = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    const freq = pianoPitches[(this.pianoNoteIdx + Math.floor(variation * 3)) % pianoPitches.length];

    // 1. Hammer strike transient (wood felt click)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1800, t);
    clickGain.gain.setValueAtTime(0.3, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(this.sfxGain);
    clickOsc.start(t);
    clickOsc.stop(t + 0.02);

    // 2. Harmonic additive synthesis: Fundamental + 2nd, 3rd, 4th, 5th harmonics
    const harmonics = [1, 2, 3, 4, 5];
    const weights = [0.9, 0.45, 0.22, 0.1, 0.04];

    harmonics.forEach((h, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * h, t);

      const decayTime = 0.85 / Math.sqrt(h);
      gain.gain.setValueAtTime(weights[i] * 0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decayTime);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + decayTime);
    });
  }

  // --- 4. TRUMPET (Sonic Blast - Bright Brass Fanfare) ---
  private trumpetNoteIdx: number = 0;
  private playTrumpet(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    this.trumpetNoteIdx++;
    // Bold brass fanfare pitches: F4, A4, C5, D5, F5
    const trumpetPitches = [349.23, 440.00, 523.25, 587.33, 698.46];
    const baseFreq = trumpetPitches[(this.trumpetNoteIdx + Math.floor(variation * 2)) % trumpetPitches.length];

    // FM Synthesis for brilliant brass fanfare
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(baseFreq, t);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(baseFreq * 2.0, t);

    // Dynamic brass modulation envelope (piercing attack, steady sustain)
    modGain.gain.setValueAtTime(baseFreq * 3.5, t);
    modGain.gain.exponentialRampToValueAtTime(baseFreq * 1.2, t + 0.1);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.setValueAtTime(1750, t);
    filter.Q.setValueAtTime(3.0, t);
    filter.gain.setValueAtTime(10, t);

    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.001, t);
    amp.gain.linearRampToValueAtTime(0.75, t + 0.03); // punchy brass attack
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    carrier.connect(filter);
    filter.connect(amp);
    amp.connect(this.sfxGain);

    modulator.start(t);
    carrier.start(t);
    modulator.stop(t + 0.42);
    carrier.stop(t + 0.42);
  }

  // --- 5. VIOLIN (Resonance Wave) ---
  private playViolin(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    const violinPitches = [329.63, 392.00, 440.00, 493.88, 587.33, 659.25];
    const pitch = violinPitches[Math.min(violinPitches.length - 1, Math.floor(variation * violinPitches.length))];

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, t);

    // LFO Vibrato
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(6.0, t); // 6 Hz vibrato
    lfoGain.gain.setValueAtTime(pitch * 0.02, t);

    lfo.connect(osc.frequency);

    // Formant filter (simulating violin body resonance)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(4.0, t);
    filter.gain.setValueAtTime(8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.65, t + 0.08); // bowed string attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.65);
    osc.stop(t + 0.65);
  }

  // --- 6. DJ MIXER (Bass Drop & Electronic Beat) ---
  private djBeatStep: number = 0;
  private playDJMixer(t: number, variation: number) {
    if (!this.ctx || !this.sfxGain) return;

    this.djBeatStep++;

    // 1. Massive 808 sub-bass drop sweep 150Hz -> 32Hz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 + variation * 25, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.45);

    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    // Overdrive saturation
    const distortion = this.ctx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(25) as Float32Array<ArrayBuffer>;

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.65);

    // 2. Vinyl record scratch sweep (chirp)
    const scratchOsc = this.ctx.createOscillator();
    const scratchGain = this.ctx.createGain();
    scratchOsc.type = 'sawtooth';
    scratchOsc.frequency.setValueAtTime(750, t);
    scratchOsc.frequency.linearRampToValueAtTime(1900, t + 0.05);
    scratchOsc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

    const scratchFilter = this.ctx.createBiquadFilter();
    scratchFilter.type = 'bandpass';
    scratchFilter.frequency.setValueAtTime(1400, t);
    scratchFilter.Q.setValueAtTime(4.0, t);

    scratchGain.gain.setValueAtTime(0.45, t);
    scratchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    scratchOsc.connect(scratchFilter);
    scratchFilter.connect(scratchGain);
    scratchGain.connect(this.sfxGain);

    scratchOsc.start(t);
    scratchOsc.stop(t + 0.14);

    // 3. Stuttered electronic electro-beat punch
    [0, 0.09, 0.18].forEach((offset, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'square';
      bOsc.frequency.setValueAtTime(idx === 0 ? 320 : 180, t + offset);
      bOsc.frequency.exponentialRampToValueAtTime(60, t + offset + 0.06);

      bGain.gain.setValueAtTime(idx === 0 ? 0.4 : 0.25, t + offset);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.06);

      bOsc.connect(bGain);
      bGain.connect(this.sfxGain);

      bOsc.start(t + offset);
      bOsc.stop(t + offset + 0.06);
    });
  }

  // --- 7. SUPER ATTACKS ---
  public playSuperAttack(id: SuperAttackId) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    switch (id) {
      case 'thunderquake': // Drums + Guitar
        this.playDrums(t, 0.8);
        this.playGuitar(t, 0.9);
        this.playThunderRumble(t);
        break;

      case 'sonic_storm': // Piano + Trumpet
        this.playPiano(t, 0.8);
        this.playTrumpet(t, 0.9);
        this.playShimmeringChord(t);
        break;

      case 'resonance_drop': // Violin + DJ Mixer
        this.playViolin(t, 0.9);
        this.playDJMixer(t, 0.9);
        this.playSirenRiser(t);
        break;
    }
  }

  private playThunderRumble(t: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, t);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.95);
  }

  private playShimmeringChord(t: number) {
    if (!this.ctx || !this.sfxGain) return;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5 major
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);

      gain.gain.setValueAtTime(0.25, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.7);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.7);
    });
  }

  private playSirenRiser(t: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.8);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.85);
  }

  // --- 8. GAME SFX: Hits, Deflections, Shields & Victory ---
  public playShieldDeflect() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playShieldBreak() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
    osc2.frequency.setValueAtTime(1200, t);
    osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.3);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
  }

  public playMonsterHurt(isBoss: boolean = false) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    if (isBoss) {
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.linearRampToValueAtTime(70, t + 0.25);
    } else {
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.linearRampToValueAtTime(140, t + 0.2);
    }

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playMonsterDefeat() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Victory comic slide down & pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.35);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playPerfectSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // High crystal sparkle chime (C6 + G6)
    [1046.50, 1567.98].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);
      gain.gain.setValueAtTime(0.35, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.35);
    });
  }

  public playGreatSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Upbeat bell chime (E5 + B5)
    [659.25, 987.77].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);
      gain.gain.setValueAtTime(0.3, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.28);
    });
  }

  public playMissSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Stumble / record slip descending wobble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playFeverSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Upward dazzling synth arpeggio
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.25, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.4);
    });
  }

  public playVictoryFanfare() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Triumphant arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);

      const duration = idx === notes.length - 1 ? 1.2 : 0.25;
      gain.gain.setValueAtTime(0.6, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + duration);
    });
  }

  public playGameOver() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const notes = [392.00, 369.99, 349.23, 311.13];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.2);

      gain.gain.setValueAtTime(0.4, t + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.2 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.2);
      osc.stop(t + idx * 0.2 + 0.35);
    });
  }

  // --- 9. PROCEDURAL BACKGROUND BATTLE BEAT ---
  public startBattleMusic() {
    if (this.isMusicPlaying) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.isMusicPlaying = true;
    let step = 0;
    const bpm = 124;
    const stepInterval = (60 / bpm / 4) * 1000; // 16th notes

    // Bassline notes (F minor / cyber groove)
    const bassline = [87.31, 87.31, 103.83, 87.31, 116.54, 87.31, 130.81, 103.83];

    this.musicIntervalId = window.setInterval(() => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicGain || this.isMuted) return;
      const t = this.ctx.currentTime;

      // Kick on quarter beats (steps 0, 4, 8, 12)
      if (step % 4 === 0) {
        const kOsc = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kOsc.frequency.setValueAtTime(110, t);
        kOsc.frequency.exponentialRampToValueAtTime(38, t + 0.1);
        kGain.gain.setValueAtTime(0.35, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        kOsc.connect(kGain);
        kGain.connect(this.musicGain);
        kOsc.start(t);
        kOsc.stop(t + 0.18);
      }

      // Snare on beats 4 and 12
      if (step % 8 === 4) {
        const sOsc = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sOsc.type = 'triangle';
        sOsc.frequency.setValueAtTime(180, t);
        sGain.gain.setValueAtTime(0.2, t);
        sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        sOsc.connect(sGain);
        sGain.connect(this.musicGain);
        sOsc.start(t);
        sOsc.stop(t + 0.12);
      }

      // Bass synth on 8th notes
      if (step % 2 === 0) {
        const note = bassline[(step / 2) % bassline.length];
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(note, t);
        bGain.gain.setValueAtTime(0.12, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        bOsc.connect(bGain);
        bGain.connect(this.musicGain);
        bOsc.start(t);
        bOsc.stop(t + 0.1);
      }

      step = (step + 1) % 16;
    }, stepInterval);
  }

  public stopBattleMusic() {
    this.isMusicPlaying = false;
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  public cleanup() {
    this.stopBattleMusic();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (e) {
        console.warn('Error closing AudioContext', e);
      }
    }
    this.ctx = null;
    this.isInitialized = false;
  }
}

export const audioEngine = new AudioEngine();
