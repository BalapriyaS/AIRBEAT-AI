import { InstrumentId, SuperAttackId } from '../types/game';

/**
 * AIRBEAT AI - Procedural Web Audio engine for instrument motifs, battle music,
 * and responsive arcade game sound effects.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private guitarShaper: WaveShaperNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private sfxVolume: number = 0.72;
  private musicVolume: number = 0.3;
  private isMusicPlaying: boolean = false;
  private musicSchedulerId: number | null = null;
  private musicStep: number = 0;
  private nextMusicStepTime: number = 0;
  private comboIntensity: number = 1;
  private isInitialized: boolean = false;

  // Active instrument indicator
  private currentActiveInstrument: InstrumentId | null = null;
  private currentPhraseGain: GainNode | null = null;
  private currentPhraseOscs: { stop: (time: number) => void }[] = [];
  private phraseStartTime: number = 0;
  private phraseEndTime: number = 0;
  private activePhraseTimeoutId: number | null = null;

  public init() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.resumeContext();
      return;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-8, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.guitarShaper = this.ctx.createWaveShaper();
      this.guitarShaper.curve = new Float32Array(this.makeDistortionCurve(120));
      this.guitarShaper.oversample = '2x';
      this.guitarShaper.connect(this.sfxGain);
      this.noiseBuffer = this.createNoiseBuffer();
      this.isInitialized = true;
    } catch (err) {
      console.warn('[AIRBEAT AI] AudioContext initialization notice:', err);
    }
  }

  public ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.init();
    } else {
      this.resumeContext();
    }
  }

  private resumeContext() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch((error: unknown) => {
        console.warn('[AIRBEAT AI] Audio playback could not be resumed:', error);
      });
    }
  }

  private rampGain(gain: GainNode | null, value: number) {
    if (!gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + 0.025);
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.rampGain(this.masterGain, this.isMuted ? 0 : this.masterVolume);
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.rampGain(this.sfxGain, this.sfxVolume);
    }
  }

  public setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.rampGain(this.musicGain, this.musicVolume);
    }
  }

  public setComboIntensity(combo: number) {
    this.comboIntensity = Math.max(1, Math.min(10, combo));
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.rampGain(this.masterGain, this.isMuted ? 0 : this.masterVolume);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getActiveInstrument(): InstrumentId | null {
    return this.currentActiveInstrument;
  }

  public getSoloRemainingSeconds(): number {
    if (!this.currentActiveInstrument) return 0;
    const remaining = (this.phraseEndTime - performance.now()) / 1000;
    return Math.max(0, Math.min(1.0, remaining));
  }

  public getSoloProgress(): number {
    if (!this.currentActiveInstrument) return 0;
    const remaining = (this.phraseEndTime - performance.now()) / 1000;
    return Math.max(0, Math.min(1.0, 1.0 - remaining / 1.0));
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext is not initialized');
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.25, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    }
    return buffer;
  }

  // Non-linear distortion curve generator for authentic electric guitar & 808 saturation
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
   * Stop previous instrument phrase gracefully without killing new notes or causing clicks
   */
  private stopCurrentPhrase(fadeTime: number = 0.05) {
    if (this.currentPhraseGain && this.ctx) {
      const t = this.ctx.currentTime;
      const oldGain = this.currentPhraseGain;
      const oldOscs = this.currentPhraseOscs;

      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      oldGain.gain.linearRampToValueAtTime(0.0001, t + fadeTime);

      setTimeout(() => {
        for (const osc of oldOscs) {
          try {
            osc.stop(0);
          } catch {}
        }
        try {
          oldGain.disconnect();
        } catch {}
      }, fadeTime * 1000 + 40);
    }

    this.currentPhraseGain = null;
    this.currentPhraseOscs = [];

    if (this.activePhraseTimeoutId) {
      clearTimeout(this.activePhraseTimeoutId);
      this.activePhraseTimeoutId = null;
    }
    this.currentActiveInstrument = null;
  }

  private playTone(
    bus: AudioNode,
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency?: number
  ) {
    if (!this.ctx) return;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private playNoise(bus: AudioNode, start: number, duration: number, volume: number, highPassHz = 900) {
    if (!this.ctx || !this.noiseBuffer) return;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const envelope = this.ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highPassHz, start);
    envelope.gain.setValueAtTime(volume, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  private playInstrumentMotif(
    instrument: InstrumentId,
    start: number,
    variation: number,
    targetBus: AudioNode
  ) {
    if (!this.ctx) return;
    const beat = 60 / 160;
    const offset = (variation - 0.5) * 0.025;
    const minor = [0, 3, 5, 7, 10];
    const root = 87.31;
    const note = (degree: number) => root * Math.pow(2, minor[degree % minor.length] / 12);
    const bus = targetBus;

    switch (instrument) {
      case 'drums':
        this.playTone(bus, 150, start, 0.16, 'sine', 0.72, 42);
        this.playNoise(bus, start + 0.035, 0.12, 0.23, 1200);
        this.playNoise(bus, start + beat * 0.25, 0.09, 0.18, 1800);
        this.playTone(bus, 72, start + beat * 0.5, 0.22, 'triangle', 0.42, 38);
        break;
      case 'piano':
        [note(2) * 2, note(4) * 2, note(1) * 4].forEach((freq, index) => {
          this.playTone(bus, freq, start + index * beat * 0.24 + offset, 0.24, 'triangle', 0.22);
          this.playTone(bus, freq * 2, start + index * beat * 0.24 + offset, 0.14, 'sine', 0.07);
        });
        break;
      case 'violin':
        [note(0) * 2, note(2) * 2, note(4) * 2, note(3) * 2].forEach((freq, index) => {
          const at = start + index * beat * 0.18 + offset;
          this.playTone(bus, freq, at, 0.22, 'sawtooth', 0.13, freq * 1.025);
          this.playTone(bus, freq * 2, at, 0.16, 'triangle', 0.06);
        });
        this.playTone(bus, note(4), start, 0.32, 'sawtooth', 0.18, note(0) * 2);
        break;
      case 'guitar': {
        const chord = [note(0) * 2, note(2) * 2, note(4) * 2];
        chord.forEach((freq, index) => {
          const oscillator = this.ctx!.createOscillator();
          const envelope = this.ctx!.createGain();
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(freq, start + index * 0.008);
          envelope.gain.setValueAtTime(0.0001, start);
          envelope.gain.linearRampToValueAtTime(0.12, start + 0.012);
          envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
          oscillator.connect(envelope);
          envelope.connect(this.guitarShaper || bus);
          oscillator.start(start + index * 0.008);
          oscillator.stop(start + 0.3);
        });
        this.playTone(bus, 1250, start, 0.09, 'square', 0.08, 240);
        break;
      }
      case 'trumpet':
        [note(0) * 2, note(3) * 2, note(4) * 2].forEach((freq, index) => {
          const at = start + index * beat * 0.22 + offset;
          this.playTone(bus, freq, at, 0.2, 'sawtooth', 0.17);
          this.playTone(bus, freq * 2, at, 0.16, 'triangle', 0.08);
        });
        this.playTone(bus, 520, start, 0.16, 'sawtooth', 0.1, 980);
        break;
      case 'dj':
        this.playTone(bus, 95, start, 0.45, 'sawtooth', 0.34, 34);
        this.playTone(bus, 55, start + 0.04, 0.32, 'sine', 0.34, 32);
        this.playTone(bus, 180, start + beat * 0.25, 0.2, 'square', 0.1, 70);
        this.playNoise(bus, start, 0.14, 0.11, 1100);
        break;
    }
  }

  public playInstrument(instrument: InstrumentId, variation: number = 0.5) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.stopCurrentPhrase(0.025);
    if (this.activePhraseTimeoutId !== null) {
      clearTimeout(this.activePhraseTimeoutId);
    }
    const phraseGain = this.ctx.createGain();
    phraseGain.gain.setValueAtTime(0.72, this.ctx.currentTime);
    phraseGain.connect(this.sfxGain);
    this.currentPhraseGain = phraseGain;
    this.currentPhraseOscs = [];
    this.currentActiveInstrument = instrument;
    const now = performance.now();
    this.phraseStartTime = now;
    this.phraseEndTime = now + 900;
    this.playInstrumentMotif(
      instrument,
      this.ctx.currentTime + 0.004,
      variation,
      phraseGain
    );

    this.activePhraseTimeoutId = window.setTimeout(() => {
      if (this.currentActiveInstrument === instrument) {
        this.currentActiveInstrument = null;
      }
      if (this.currentPhraseGain === phraseGain) {
        this.currentPhraseGain = null;
        this.currentPhraseOscs = [];
        phraseGain.disconnect();
      }
      this.activePhraseTimeoutId = null;
    }, 900);
  }

  public playAttackLaunch(instrument: InstrumentId, combo: number = 1) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime + 0.004;
    const intensity = Math.min(1.25, 0.8 + Math.max(0, combo - 1) * 0.035);

    switch (instrument) {
      case 'drums':
        this.playTone(this.sfxGain, 105, t, 0.18, 'sine', 0.34 * intensity, 38);
        this.playNoise(this.sfxGain, t, 0.055, 0.12 * intensity, 1600);
        break;
      case 'piano':
        this.playTone(this.sfxGain, 880, t, 0.11, 'triangle', 0.18 * intensity, 1320);
        break;
      case 'violin':
        this.playTone(this.sfxGain, 330, t, 0.22, 'sawtooth', 0.12 * intensity, 990);
        break;
      case 'guitar':
        this.playTone(this.sfxGain, 196, t, 0.14, 'square', 0.2 * intensity, 98);
        break;
      case 'trumpet':
        this.playTone(this.sfxGain, 440, t, 0.16, 'sawtooth', 0.14 * intensity, 660);
        break;
      case 'dj':
        this.playTone(this.sfxGain, 140, t, 0.28, 'sawtooth', 0.3 * intensity, 36);
        break;
    }
  }

  public playComboAccent(combo: number) {
    if (combo !== 3 && combo !== 8) return;
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime + 0.004;
    const notes = combo === 8 ? [523.25, 659.25, 783.99] : [659.25, 783.99];
    notes.forEach((frequency, index) => {
      this.playTone(
        this.sfxGain!,
        frequency,
        t + index * 0.045,
        combo === 8 ? 0.34 : 0.22,
        'triangle',
        combo === 8 ? 0.17 : 0.12
      );
    });
    if (combo === 8) {
      this.playNoise(this.sfxGain, t, 0.13, 0.1, 1800);
    }
  }

  // =========================================================================
  // 1. REAL ACOUSTIC / ROCK DRUMS — FULL 5.0-SECOND COMPLETE DRUM GROOVE & SOLO
  // =========================================================================
  private playDrumsPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // 1. Punchy Kick Drum (beater transient + deep 42Hz chest punch)
    const triggerKick = (t: number, punch: number = 1.0) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155 + variation * 20, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);

      gain.gain.setValueAtTime(0.95 * punch, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.28);
      this.currentPhraseOscs.push(osc);
    };

    // 2. Crisp Wooden Snare Drum (snare shell tone + sizzling wire snap)
    const triggerSnare = (t: number, accent: boolean = true) => {
      if (!this.ctx) return;
      // Shell body
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      oscGain.gain.setValueAtTime(accent ? 0.75 : 0.35, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(oscGain);
      oscGain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.15);
      this.currentPhraseOscs.push(osc);

      // Snare wires noise snap
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.24);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1400, t);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(accent ? 0.85 : 0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(targetBus);
      noise.start(t);
      noise.stop(t + 0.22);
      this.currentPhraseOscs.push(noise);
    };

    // 3. Crisp Metallic Hi-Hat (closed & open)
    const triggerHiHat = (t: number, isOpen: boolean = false) => {
      if (!this.ctx) return;
      const dur = isOpen ? 0.38 : 0.06;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(isOpen ? 6000 : 7500, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isOpen ? 0.4 : 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);
      noise.start(t);
      noise.stop(t + dur);
      this.currentPhraseOscs.push(noise);
    };

    // 4. Acoustic Tom Drums (Hi, Mid, Low)
    const triggerTom = (t: number, freq: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.52, t + 0.22);
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.26);
      this.currentPhraseOscs.push(osc);
    };

    // 5. Grand Crash Cymbal with Rich Decay
    const triggerCrash = (t: number, duration: number = 1.9) => {
      if (!this.ctx) return;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4600, t);
      filter.Q.setValueAtTime(0.85, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);
      noise.start(t);
      noise.stop(t + duration);
      this.currentPhraseOscs.push(noise);
    };

    // --- 5.0-SECOND DRUM SCORE (124 BPM) ---
    // Bar 1 (0.0s - 1.92s): Driving Rock Groove
    triggerCrash(startTime + 0.0);
    triggerKick(startTime + 0.0);
    triggerHiHat(startTime + 0.24);
    triggerSnare(startTime + 0.48);
    triggerHiHat(startTime + 0.72);
    triggerKick(startTime + 0.96);
    triggerKick(startTime + 1.20, 0.85);
    triggerSnare(startTime + 1.44);
    triggerHiHat(startTime + 1.68, true);

    // Bar 2 (1.92s - 3.36s): Double-Time Groove & Snare Accents
    triggerKick(startTime + 1.92);
    triggerHiHat(startTime + 2.16);
    triggerSnare(startTime + 2.40);
    triggerHiHat(startTime + 2.64);
    triggerKick(startTime + 2.88);
    // Fast 16th Hi-Hat Roll
    triggerHiHat(startTime + 3.00);
    triggerHiHat(startTime + 3.12);
    triggerHiHat(startTime + 3.24, true);

    // Bar 3 (3.36s - 4.15s): Virtuosic 5-Tom Descending Roll
    triggerTom(startTime + 3.36, 220); // High rack tom
    triggerTom(startTime + 3.52, 190); // High rack tom 2
    triggerTom(startTime + 3.68, 155); // Mid rack tom
    triggerTom(startTime + 3.84, 120); // Low floor tom
    triggerTom(startTime + 4.00, 92);  // Deep floor tom

    // Grand Finale Climax (4.15s - 5.0s): Big Double Kick, Snare Rimshot & Shimmering Crash Finish!
    triggerKick(startTime + 4.15);
    triggerKick(startTime + 4.28, 0.85);
    triggerSnare(startTime + 4.15, true);
    triggerCrash(startTime + 4.15, 1.8); // Resonates with metallic wash through 5.0s!
  }

  // =========================================================================
  // 2. REAL ELECTRIC GUITAR — FULL 5.0-SECOND HEAVY ROCK RIFF & SCREAMING SOLO
  // =========================================================================
  private playGuitarPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // Heavy Distorted Power Chord (Root + 5th + Octave through amp cabinet)
    const playPowerChord = (t: number, rootFreq: number, duration: number, palmMute: boolean = false) => {
      if (!this.ctx) return;
      const fifthFreq = rootFreq * 1.4983;
      const octaveFreq = rootFreq * 2.0;

      [rootFreq, fifthFreq, octaveFreq].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        // Guitar amplifier distortion
        const distortion = this.ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(70) as Float32Array<ArrayBuffer>;
        distortion.oversample = '4x';

        // Amp cabinet filter (speaker response curve)
        const cabFilter = this.ctx.createBiquadFilter();
        cabFilter.type = 'lowpass';
        cabFilter.frequency.setValueAtTime(palmMute ? 1300 : 3900, t);
        if (!palmMute) {
          cabFilter.frequency.exponentialRampToValueAtTime(1700, t + duration);
        }

        const gain = this.ctx.createGain();
        const baseGain = idx === 0 ? 0.45 : 0.32;
        gain.gain.setValueAtTime(baseGain, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(distortion);
        distortion.connect(cabFilter);
        cabFilter.connect(gain);
        gain.connect(targetBus);

        osc.start(t);
        osc.stop(t + duration);
        this.currentPhraseOscs.push(osc);
      });
    };

    // Singing Lead Guitar Note with Finger Vibrato & String Bend
    const playLeadNote = (t: number, freq: number, duration: number, vibratoAmount: number = 0.025, bendTo?: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      if (bendTo) {
        osc.frequency.linearRampToValueAtTime(bendTo, t + duration * 0.4);
      }

      // Vibrato LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(5.8, t);
      lfoGain.gain.setValueAtTime(freq * vibratoAmount, t);
      lfo.connect(osc.frequency);

      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this.makeDistortionCurve(78) as Float32Array<ArrayBuffer>;

      const cabFilter = this.ctx.createBiquadFilter();
      cabFilter.type = 'peaking';
      cabFilter.frequency.setValueAtTime(2700, t);
      cabFilter.Q.setValueAtTime(2.2, t);
      cabFilter.gain.setValueAtTime(8, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.42, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(distortion);
      distortion.connect(cabFilter);
      cabFilter.connect(gain);
      gain.connect(targetBus);

      lfo.start(t);
      osc.start(t);
      lfo.stop(t + duration);
      osc.stop(t + duration);
      this.currentPhraseOscs.push(osc);
      this.currentPhraseOscs.push(lfo);
    };

    const baseRoot = variation > 0.5 ? 98.0 : 82.41; // G2 or E2

    // --- 5.0-SECOND ELECTRIC GUITAR SCORE ---
    // 0.0s: Heavy Power Chord punch (E5)
    playPowerChord(startTime + 0.0, baseRoot, 0.38);

    // 0.40s: Palm-mute chug-chug
    playPowerChord(startTime + 0.40, baseRoot, 0.18, true);
    playPowerChord(startTime + 0.58, baseRoot, 0.18, true);

    // 0.78s: G5 Power Chord Punch
    playPowerChord(startTime + 0.78, baseRoot * 1.189, 0.38);

    // 1.20s: A5 Power Chord Punch
    playPowerChord(startTime + 1.20, baseRoot * 1.335, 0.42);

    // 1.65s: Screaming blues bend note on D4 -> E4 with vibrato!
    playLeadNote(startTime + 1.65, baseRoot * 3.56, 0.8, 0.035, baseRoot * 4.0);

    // 2.50s - 3.4s: Rapid rock pentatonic shred run
    playLeadNote(startTime + 2.50, baseRoot * 4.0, 0.18);
    playLeadNote(startTime + 2.70, baseRoot * 4.75, 0.18);
    playLeadNote(startTime + 2.90, baseRoot * 5.34, 0.18);
    playLeadNote(startTime + 3.10, baseRoot * 6.0, 0.22);
    playLeadNote(startTime + 3.32, baseRoot * 7.12, 0.35);

    // 3.70s: Double-stop rock punch
    playPowerChord(startTime + 3.70, baseRoot * 1.5, 0.35);

    // 4.10s - 5.0s: Climax: Massive Sustained High Power Chord + Singing Lead Harmonic ringing out to 5.0s!
    playPowerChord(startTime + 4.10, baseRoot, 1.2);
    playLeadNote(startTime + 4.10, baseRoot * 4.0, 1.2, 0.04);
  }

  // =========================================================================
  // 3. REAL CONCERT GRAND PIANO — FULL 5.0-SECOND VIRTUOSIC ARPEGGIATED PROGRESSION
  // =========================================================================
  private playPianoPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // Multi-harmonic additive grand piano note with felt hammer transient click
    const playPianoNote = (t: number, freq: number, duration: number, velocity: number = 0.75) => {
      if (!this.ctx) return;
      // Felt hammer click
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(2400, t);
      clickGain.gain.setValueAtTime(0.18 * velocity, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      click.connect(clickGain);
      clickGain.connect(targetBus);
      click.start(t);
      click.stop(t + 0.02);
      this.currentPhraseOscs.push(click);

      // 5 acoustic harmonics
      const harmonics = [1, 2, 3, 4, 5];
      const weights = [0.9, 0.45, 0.24, 0.10, 0.05];

      harmonics.forEach((h, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq * h, t);

        const decay = duration / Math.sqrt(h);
        gain.gain.setValueAtTime(weights[idx] * velocity * 0.48, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

        osc.connect(gain);
        gain.connect(targetBus);
        osc.start(t);
        osc.stop(t + decay);
        this.currentPhraseOscs.push(osc);
      });
    };

    // --- 5.0-SECOND GRAND PIANO SCORE ---
    // Chord 1 (0.0s): Deep C-minor / Eb progression
    playPianoNote(startTime + 0.0, 130.81, 1.8, 0.85); // C3 bass
    playPianoNote(startTime + 0.05, 196.00, 1.8, 0.75); // G3
    playPianoNote(startTime + 0.12, 311.13, 1.6, 0.8);  // Eb4
    playPianoNote(startTime + 0.25, 392.00, 1.5, 0.75); // G4

    // Right-Hand Classical Flourish (0.60s - 1.25s)
    playPianoNote(startTime + 0.60, 523.25, 0.85, 0.8); // C5
    playPianoNote(startTime + 0.85, 622.25, 0.85, 0.8); // Eb5
    playPianoNote(startTime + 1.10, 783.99, 0.85, 0.85); // G5

    // Chord 2 (1.30s): Flowing Ab Major
    playPianoNote(startTime + 1.30, 103.83, 1.8, 0.85); // Ab2 bass
    playPianoNote(startTime + 1.35, 155.56, 1.8, 0.75); // Eb3
    playPianoNote(startTime + 1.42, 261.63, 1.6, 0.8);  // C4
    playPianoNote(startTime + 1.60, 415.30, 1.5, 0.8);  // Ab4

    // Emotional High Singing Melody (1.95s - 2.6s)
    playPianoNote(startTime + 1.95, 523.25, 0.85, 0.8); // C5
    playPianoNote(startTime + 2.20, 698.46, 0.95, 0.88); // F5

    // Cascading Downward Trill Flourish (2.65s - 3.3s)
    playPianoNote(startTime + 2.65, 622.25, 0.5, 0.75); // Eb5
    playPianoNote(startTime + 2.85, 587.33, 0.5, 0.75); // D5
    playPianoNote(startTime + 3.05, 523.25, 0.5, 0.75); // C5
    playPianoNote(startTime + 3.25, 466.16, 0.6, 0.8);  // Bb4

    // Suspense G-Dominant 7th (3.45s)
    playPianoNote(startTime + 3.45, 98.00, 1.6, 0.85); // G2
    playPianoNote(startTime + 3.55, 196.00, 1.5, 0.75); // G3
    playPianoNote(startTime + 3.65, 246.94, 1.5, 0.8); // B3
    playPianoNote(startTime + 3.78, 349.23, 1.4, 0.8); // F4

    // Grand Triumphant Resolution (4.0s - 5.0s): Low C2/C3 Bass + Sparkling Cascading High C6 Chime ringing to 5.0s!
    playPianoNote(startTime + 4.05, 65.41, 1.8, 0.9);   // Low C2
    playPianoNote(startTime + 4.08, 130.81, 1.8, 0.85); // C3
    playPianoNote(startTime + 4.15, 261.63, 1.6, 0.8);  // C4
    playPianoNote(startTime + 4.25, 329.63, 1.6, 0.8);  // E4
    playPianoNote(startTime + 4.35, 392.00, 1.5, 0.85); // G4
    playPianoNote(startTime + 4.45, 523.25, 1.4, 0.88); // C5
    playPianoNote(startTime + 4.58, 659.25, 1.3, 0.88); // E5
    playPianoNote(startTime + 4.70, 1046.50, 1.5, 0.95); // High C6 Crystal Shimmer!
  }

  // =========================================================================
  // 4. REAL TRUMPET / BRASS — FULL 5.0-SECOND ROYAL FANFARE & HARMONIES
  // =========================================================================
  private playTrumpetPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // Dynamic FM Brass Synthesis with Dual Formant Bell Filters
    const playBrassNote = (t: number, freq: number, duration: number, isAccent: boolean = false) => {
      if (!this.ctx) return;
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(freq, t);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq * 2.0, t);

      const biteAmount = isAccent ? freq * 3.8 : freq * 2.4;
      modGain.gain.setValueAtTime(biteAmount, t);
      modGain.gain.exponentialRampToValueAtTime(freq * 0.9, t + 0.12);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // Dual formant filters simulating acoustic brass bell resonance
      const formant1 = this.ctx.createBiquadFilter();
      formant1.type = 'peaking';
      formant1.frequency.setValueAtTime(1150, t);
      formant1.Q.setValueAtTime(2.5, t);
      formant1.gain.setValueAtTime(9, t);

      const formant2 = this.ctx.createBiquadFilter();
      formant2.type = 'peaking';
      formant2.frequency.setValueAtTime(2500, t);
      formant2.Q.setValueAtTime(3.2, t);
      formant2.gain.setValueAtTime(7, t);

      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(0.001, t);
      amp.gain.linearRampToValueAtTime(isAccent ? 0.65 : 0.48, t + 0.035);
      amp.gain.exponentialRampToValueAtTime(0.001, t + duration);

      carrier.connect(formant1);
      formant1.connect(formant2);
      formant2.connect(amp);
      amp.connect(targetBus);

      modulator.start(t);
      carrier.start(t);
      modulator.stop(t + duration);
      carrier.stop(t + duration);
      this.currentPhraseOscs.push(carrier);
      this.currentPhraseOscs.push(modulator);
    };

    // --- 5.0-SECOND TRUMPET FANFARE SCORE ---
    // 0.0s: Bold pickup call on G4
    playBrassNote(startTime + 0.0, 392.00, 0.35, true);

    // 0.38s: Ascending fanfare blast: C5 -> E5 -> G5
    playBrassNote(startTime + 0.38, 523.25, 0.38, true);
    playBrassNote(startTime + 0.78, 659.25, 0.42, true);

    // 1.25s: Held High G5 with expressive brass swell and vibrato
    playBrassNote(startTime + 1.25, 783.99, 0.88, true);

    // 2.20s: Rapid staccato fanfare triplet blast
    playBrassNote(startTime + 2.20, 783.99, 0.20, true);
    playBrassNote(startTime + 2.42, 783.99, 0.20, true);
    playBrassNote(startTime + 2.65, 783.99, 0.32, true);

    // 3.00s: Melodic climb: A5 -> B5
    playBrassNote(startTime + 3.00, 880.00, 0.35, false);
    playBrassNote(startTime + 3.40, 987.77, 0.38, true);

    // 4.00s - 5.0s: Grand Royal Triumphant Fanfare Chord: High C6 with E5 + G5 brass harmony sustaining to 5.0s!
    playBrassNote(startTime + 4.00, 1046.50, 1.25, true);
    playBrassNote(startTime + 4.00, 783.99, 1.25, false);
    playBrassNote(startTime + 4.00, 659.25, 1.25, false);
  }

  // =========================================================================
  // 5. REAL ACOUSTIC VIOLIN — FULL 5.0-SECOND BOWED VIRTUOSIC CLASSICAL SOLO
  // =========================================================================
  private playViolinPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // Bowed Acoustic Violin Note with Wood Body Formant & Human Vibrato
    const playBowedViolinNote = (
      t: number,
      freq: number,
      duration: number,
      vibratoHz: number = 5.5,
      vibratoDepth: number = 0.026
    ) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Expressive vibrato LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(vibratoHz, t);
      lfoGain.gain.setValueAtTime(freq * vibratoDepth, t);
      lfo.connect(osc.frequency);

      // Acoustic violin wooden body formant filter
      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.setValueAtTime(1250, t);
      bodyFilter.Q.setValueAtTime(3.8, t);
      bodyFilter.gain.setValueAtTime(10, t);

      const highAir = this.ctx.createBiquadFilter();
      highAir.type = 'highshelf';
      highAir.frequency.setValueAtTime(4200, t);
      highAir.gain.setValueAtTime(-3, t);

      // Gentle bowed attack swell (no percussive click)
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.52, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(bodyFilter);
      bodyFilter.connect(highAir);
      highAir.connect(gain);
      gain.connect(targetBus);

      lfo.start(t);
      osc.start(t);
      lfo.stop(t + duration);
      osc.stop(t + duration);
      this.currentPhraseOscs.push(osc);
      this.currentPhraseOscs.push(lfo);
    };

    // --- 5.0-SECOND VIOLIN SCORE ---
    // 0.0s: Warm, deep bowed A4 melody note with rosin friction
    playBowedViolinNote(startTime + 0.0, 440.00, 0.72, 5.2, 0.02);

    // 0.72s: Seamless lyrical legato transition to C5
    playBowedViolinNote(startTime + 0.72, 523.25, 0.68, 5.5, 0.025);

    // 1.40s: Soaring rise to High E5 with deep singing vibrato
    playBowedViolinNote(startTime + 1.40, 659.25, 0.95, 5.6, 0.03);

    // 2.35s - 3.4s: Virtuosic Classical Ornament Passage
    playBowedViolinNote(startTime + 2.35, 698.46, 0.32, 5.8, 0.02); // F5
    playBowedViolinNote(startTime + 2.68, 659.25, 0.32, 5.8, 0.02); // E5
    playBowedViolinNote(startTime + 3.00, 587.33, 0.35, 5.6, 0.02); // D5
    playBowedViolinNote(startTime + 3.35, 523.25, 0.35, 5.5, 0.025); // C5

    // 3.70s: Quick grace-note slide
    playBowedViolinNote(startTime + 3.70, 783.99, 0.28, 5.8, 0.02);

    // 4.00s - 5.0s: High virtuosic climax on High A5 (880 Hz) and E6 shimmering harmonic sustaining to 5.0s!
    playBowedViolinNote(startTime + 4.00, 880.00, 1.25, 5.8, 0.035);
    playBowedViolinNote(startTime + 4.00, 1318.51, 1.20, 5.8, 0.02);
  }

  // =========================================================================
  // 6. REAL DJ MIXER — FULL 5.0-SECOND ELECTRONIC FESTIVAL DROP, SCRATCH & ACID
  // =========================================================================
  private playDJPhrase(startTime: number, targetBus: GainNode, variation: number) {
    if (!this.ctx) return;

    // 1. Noise Riser Build-up (0.0s - 1.20s): Filtered sweeping white noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const riserFilter = this.ctx.createBiquadFilter();
    riserFilter.type = 'bandpass';
    riserFilter.Q.setValueAtTime(4.0, startTime);
    riserFilter.frequency.setValueAtTime(220, startTime);
    riserFilter.frequency.exponentialRampToValueAtTime(4800, startTime + 1.2);

    const riserGain = this.ctx.createGain();
    riserGain.gain.setValueAtTime(0.01, startTime);
    riserGain.gain.exponentialRampToValueAtTime(0.55, startTime + 1.2);

    noise.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(targetBus);
    noise.start(startTime);
    noise.stop(startTime + 1.2);
    this.currentPhraseOscs.push(noise);

    // 2. Vinyl Turntable Scratch (1.20s - 1.55s): "Wicka-Wicka-Scratch"
    const scratch1 = this.ctx.createOscillator();
    const scratchGain1 = this.ctx.createGain();
    scratch1.type = 'sawtooth';
    scratch1.frequency.setValueAtTime(1800, startTime + 1.20);
    scratch1.frequency.exponentialRampToValueAtTime(250, startTime + 1.35);
    scratchGain1.gain.setValueAtTime(0.45, startTime + 1.20);
    scratchGain1.gain.exponentialRampToValueAtTime(0.001, startTime + 1.35);
    scratch1.connect(scratchGain1);
    scratchGain1.connect(targetBus);
    scratch1.start(startTime + 1.20);
    scratch1.stop(startTime + 1.35);
    this.currentPhraseOscs.push(scratch1);

    const scratch2 = this.ctx.createOscillator();
    const scratchGain2 = this.ctx.createGain();
    scratch2.type = 'sawtooth';
    scratch2.frequency.setValueAtTime(1400, startTime + 1.38);
    scratch2.frequency.exponentialRampToValueAtTime(80, startTime + 1.55);
    scratchGain2.gain.setValueAtTime(0.45, startTime + 1.38);
    scratchGain2.gain.exponentialRampToValueAtTime(0.001, startTime + 1.55);
    scratch2.connect(scratchGain2);
    scratchGain2.connect(targetBus);
    scratch2.start(startTime + 1.38);
    scratch2.stop(startTime + 1.55);
    this.currentPhraseOscs.push(scratch2);

    // 3. Colossal 808 Sub-Bass Drop (1.55s): Earth-shaking sine sweep 180Hz -> 32Hz
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180 + variation * 20, startTime + 1.55);
    subOsc.frequency.exponentialRampToValueAtTime(32, startTime + 2.2);
    subGain.gain.setValueAtTime(1.0, startTime + 1.55);
    subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);

    const subDist = this.ctx.createWaveShaper();
    subDist.curve = this.makeDistortionCurve(35) as Float32Array<ArrayBuffer>;
    subOsc.connect(subDist);
    subDist.connect(subGain);
    subGain.connect(targetBus);
    subOsc.start(startTime + 1.55);
    subOsc.stop(startTime + 2.5);
    this.currentPhraseOscs.push(subOsc);

    // 4. High-Energy Acid Synth Riff (1.90s - 4.2s)
    const acidNotes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    for (let i = 0; i < 12; i++) {
      if (!this.ctx) break;
      const stepTime = startTime + 1.90 + i * 0.18;
      const noteFreq = acidNotes[i % acidNotes.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(noteFreq, stepTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(6.5, stepTime);
      filter.frequency.setValueAtTime(800 + (i % 4) * 650, stepTime);
      filter.frequency.exponentialRampToValueAtTime(180, stepTime + 0.16);

      gain.gain.setValueAtTime(0.38, stepTime);
      gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);

      osc.start(stepTime);
      osc.stop(stepTime + 0.16);
      this.currentPhraseOscs.push(osc);
    }

    // 5. Laser Filter Sweep & Sub Echo Finish (4.20s - 5.0s)
    const laserOsc = this.ctx.createOscillator();
    const laserGain = this.ctx.createGain();
    laserOsc.type = 'sawtooth';
    laserOsc.frequency.setValueAtTime(1500, startTime + 4.2);
    laserOsc.frequency.exponentialRampToValueAtTime(60, startTime + 4.95);

    laserGain.gain.setValueAtTime(0.35, startTime + 4.2);
    laserGain.gain.exponentialRampToValueAtTime(0.001, startTime + 5.0);

    laserOsc.connect(laserGain);
    laserGain.connect(targetBus);
    laserOsc.start(startTime + 4.2);
    laserOsc.stop(startTime + 5.0);
    this.currentPhraseOscs.push(laserOsc);
  }

  // =========================================================================
  // 7. SUPER ATTACKS (TWO-HAND COMBOS)
  // =========================================================================
  public playSuperAttack(id: SuperAttackId) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime + 0.004;
    const root = id === 'sonic_storm' ? 523.25 : id === 'resonance_drop' ? 415.3 : 349.23;
    this.playTone(this.sfxGain, root * 0.5, t, 0.42, 'sawtooth', 0.13, root * 2.5);
    this.playTone(this.sfxGain, root, t + 0.1, 0.3, 'triangle', 0.12, root * 1.5);
    this.playNoise(this.sfxGain, t + 0.24, 0.18, 0.12, 1100);
  }

  public playMonsterDefeat() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    this.playTone(this.sfxGain, 72, t, 1.1, 'sine', 0.65, 26);
    this.playTone(this.sfxGain, 180, t, 0.65, 'sawtooth', 0.16, 720);
    this.playNoise(this.sfxGain, t + 0.72, 0.32, 0.22, 500);
  }

  private playThunderRumble(t: number, targetBus: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, t);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(targetBus);

    osc.start(t);
    osc.stop(t + 1.4);
    this.currentPhraseOscs.push(osc);
  }

  private playShimmeringChord(t: number, targetBus: GainNode) {
    if (!this.ctx) return;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.32, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 1.2);

      osc.connect(gain);
      gain.connect(targetBus);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 1.2);
      this.currentPhraseOscs.push(osc);
    });
  }

  private playSirenRiser(t: number, targetBus: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.6);
    osc.frequency.exponentialRampToValueAtTime(45, t + 1.3);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    osc.connect(gain);
    gain.connect(targetBus);

    osc.start(t);
    osc.stop(t + 1.4);
    this.currentPhraseOscs.push(osc);
  }

  // =========================================================================
  // 8. GAME SFX: Judgments, Hits, Shields & Fanfares
  // =========================================================================
  public playPerfectSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    [1046.5, 1567.98].forEach((freq, idx) => {
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

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playMonsterHitSound(
    isSuper: boolean = false,
    instrument: InstrumentId = 'drums',
    combo: number = 1,
    judgment?: 'perfect' | 'great'
  ) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Visceral sub-bass body thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(isSuper ? 160 : 120, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + (isSuper ? 0.45 : 0.28));

    subGain.gain.setValueAtTime(isSuper ? 0.72 : 0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + (isSuper ? 0.45 : 0.28));

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(t);
    subOsc.stop(t + (isSuper ? 0.45 : 0.28));

    // 2. Punchy impact crackle / zap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(isSuper ? 1400 : 900, t);
    snapOsc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

    snapGain.gain.setValueAtTime(isSuper ? 0.45 : 0.35, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.12);

    const impactNotes: Record<InstrumentId, number> = {
      drums: 82.41,
      piano: 783.99,
      violin: 659.25,
      guitar: 196,
      trumpet: 523.25,
      dj: 55
    };
    if (isSuper) {
      this.playNoise(this.sfxGain, t, 0.2, 0.18, 700);
      this.playTone(this.sfxGain, 180, t, 0.5, 'sine', 0.48, 32);
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        this.playTone(this.sfxGain!, frequency, t + 0.035 * index, 0.35, 'triangle', 0.12);
      });
    } else {
      const impactGain = combo >= 8 ? 0.12 : combo >= 4 ? 0.08 : 0.055;
      this.playTone(
        this.sfxGain,
        impactNotes[instrument],
        t,
        0.15,
        instrument === 'guitar' || instrument === 'trumpet' ? 'sawtooth' : 'triangle',
        impactGain
      );
      if (combo >= 8) this.playNoise(this.sfxGain, t, 0.075, 0.08, 2200);
    }
    if (judgment === 'perfect') {
      this.playTone(this.sfxGain, 1046.5, t + 0.015, 0.22, 'sine', 0.16);
      this.playTone(this.sfxGain, 1567.98, t + 0.06, 0.25, 'sine', 0.13);
    } else if (judgment === 'great') {
      this.playTone(this.sfxGain, 659.25, t + 0.015, 0.18, 'triangle', 0.11);
      this.playTone(this.sfxGain, 987.77, t + 0.06, 0.2, 'triangle', 0.09);
    }
  }

  public playFeverSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

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

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);

      const duration = idx === notes.length - 1 ? 1.4 : 0.28;
      gain.gain.setValueAtTime(0.65, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + duration);
    });
    [523.25, 659.25, 783.99].forEach((frequency) => {
      this.playTone(this.sfxGain!, frequency, t + 0.5, 1.25, 'triangle', 0.12);
    });
    this.playTone(this.sfxGain, 130, t + 0.48, 0.7, 'sine', 0.35, 65);
    this.playNoise(this.sfxGain, t + 0.5, 0.42, 0.11, 2600);
  }

  public playGameOver() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const notes = [392.0, 369.99, 349.23, 311.13];
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

  // =========================================================================
  // 9. PROCEDURAL BACKGROUND BATTLE BEAT (136 BPM)
  // =========================================================================
  private scheduleMusicStep(time: number, step: number) {
    if (!this.ctx || !this.musicGain || this.isMuted) return;

    const beat = 60 / 136;
    const barStep = step % 16;
    const bar = Math.floor(step / 16);
    const energy = 0.9 + (this.comboIntensity - 1) * 0.035;
    const bassline = [65.41, 65.41, 77.78, 65.41, 87.31, 65.41, 98, 77.78];
    const arpeggio = [523.25, 622.25, 698.46, 783.99, 932.33, 783.99, 698.46, 622.25];

    if (barStep % 4 === 0) {
      this.playTone(
        this.musicGain,
        barStep === 0 ? 145 : 118,
        time,
        0.18,
        'sine',
        0.22 * energy,
        38
      );
    }
    if (barStep === 4 || barStep === 12) {
      this.playTone(this.musicGain, 205, time, 0.1, 'triangle', 0.1 * energy, 95);
      this.playNoise(this.musicGain, time, 0.11, 0.095 * energy, 1500);
    }
    if (barStep % 2 === 1 || barStep === 6 || barStep === 14) {
      this.playNoise(this.musicGain, time, 0.045, 0.035 * energy, 6500);
    }
    if (barStep % 2 === 0) {
      this.playTone(
        this.musicGain,
        bassline[(bar * 2 + barStep / 2) % bassline.length],
        time,
        beat * 0.28,
        'triangle',
        0.1 * energy
      );
      this.playTone(
        this.musicGain,
        arpeggio[(barStep / 2 + bar) % arpeggio.length],
        time,
        beat * 0.2,
        'triangle',
        (this.comboIntensity >= 5 ? 0.048 : 0.032) * energy
      );
    }
    if (this.comboIntensity >= 3 && (barStep === 10 || barStep === 14)) {
      this.playTone(this.musicGain, 880, time, beat * 0.18, 'square', 0.025 * energy);
    }
    if (this.comboIntensity >= 8 && barStep >= 12) {
      this.playNoise(this.musicGain, time, 0.035, 0.045 * energy, 3200);
    }
    if (step % 64 >= 60) {
      this.playTone(this.musicGain, 170 + (step % 4) * 95, time, beat * 0.24, 'sawtooth', 0.035, 900);
    }
    if (step % 64 === 0) {
      this.playTone(this.musicGain, 110, time, 0.38, 'sine', 0.16, 32);
    }
  }

  public startBattleMusic() {
    if (this.isMusicPlaying) return;
    this.ensureContext();
    if (!this.ctx || !this.musicGain) return;

    this.isMusicPlaying = true;
    const stepDuration = 60 / 136 / 4;
    this.nextMusicStepTime = this.ctx.currentTime + 0.02;
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.isMusicPlaying || !this.ctx || this.ctx.state !== 'running') return;
      const scheduleThrough = this.ctx.currentTime + 0.12;
      while (this.nextMusicStepTime < scheduleThrough) {
        this.scheduleMusicStep(this.nextMusicStepTime, this.musicStep);
        this.nextMusicStepTime += stepDuration;
        this.musicStep = (this.musicStep + 1) % 64;
      }
    }, 25);
  }

  public stopBattleMusic() {
    this.isMusicPlaying = false;
    if (this.musicSchedulerId !== null) {
      clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = null;
    }
  }

  public cleanup() {
    this.stopBattleMusic();
    this.stopCurrentPhrase(0.02);
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (e) {
        console.warn('Error closing AudioContext', e);
      }
    }
    this.ctx = null;
    this.compressor = null;
    this.guitarShaper = null;
    this.noiseBuffer = null;
    this.isInitialized = false;
  }
}

export const audioEngine = new AudioEngine();
