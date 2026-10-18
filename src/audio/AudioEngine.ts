import { InstrumentId, SuperAttackId } from '../types/game';

/**
 * AIRBEAT AI - Professional Web Audio Engine
 * High-fidelity procedural audio synthesis engine delivering rich, recognizable
 * multi-voice musical phrases (~5 seconds each) for all six instruments,
 * background battle music, and game sound effects.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeInstrumentGain: GainNode | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private sfxVolume: number = 0.95;
  private musicVolume: number = 0.35;
  private isMusicPlaying: boolean = false;
  private musicIntervalId: number | null = null;
  private isInitialized: boolean = false;

  // Active phrase tracking to prevent duplicate triggers & overlapping noise
  private currentActiveInstrument: InstrumentId | null = null;
  private phraseEndTime: number = 0;
  private lastActivationTime: number = 0;
  private activeOscillators: { stop: (time: number) => void }[] = [];
  private activePhraseTimeoutId: number | null = null;

  public init() {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
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
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Dedicated Instrument Phrase Bus (allows smooth crossfades between instruments)
      this.activeInstrumentGain = this.ctx.createGain();
      this.activeInstrumentGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.activeInstrumentGain.connect(this.sfxGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (err) {
      console.warn('[AIRBEAT AI] AudioContext initialization notice:', err);
    }
  }

  public ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime
      );
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
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime
      );
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getActiveInstrument(): InstrumentId | null {
    return this.currentActiveInstrument;
  }

  // Distortion curve generator for electric guitar and sub-bass overdrive
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
   * Stop previous instrument phrase gracefully to avoid audio overlaps and clicks
   */
  private stopCurrentPhrase(fadeTime: number = 0.08) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const t = this.ctx.currentTime;

    // Fast, click-free fade out
    this.activeInstrumentGain.gain.cancelScheduledValues(t);
    this.activeInstrumentGain.gain.setValueAtTime(this.activeInstrumentGain.gain.value, t);
    this.activeInstrumentGain.gain.linearRampToValueAtTime(0.001, t + fadeTime);

    // Stop and discard tracked oscillators
    setTimeout(() => {
      for (const osc of this.activeOscillators) {
        try {
          osc.stop(0);
        } catch {
          // already stopped
        }
      }
      this.activeOscillators = [];
      if (this.activeInstrumentGain && this.ctx) {
        this.activeInstrumentGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      }
    }, fadeTime * 1000 + 20);

    if (this.activePhraseTimeoutId) {
      clearTimeout(this.activePhraseTimeoutId);
      this.activePhraseTimeoutId = null;
    }
    this.currentActiveInstrument = null;
  }

  /**
   * Play Instrument: Triggers an authentic, full-length musical phrase lasting ~5.0 - 5.2 seconds.
   * Single activation triggers the entire phrase; no need to hold gestures.
   * Prevents accidental duplicates and overlapping chaos.
   */
  public playInstrument(instrument: InstrumentId, variation: number = 0.5) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = performance.now();
    // 250ms debounce threshold
    if (now - this.lastActivationTime < 250) {
      return;
    }
    this.lastActivationTime = now;

    // Crossfade out previous phrase
    this.stopCurrentPhrase(0.08);

    const t = this.ctx.currentTime + 0.02; // Small lookahead for sample-accurate scheduling
    this.currentActiveInstrument = instrument;
    const phraseDuration = 5.2; // ~5.2 seconds musical phrase
    this.phraseEndTime = now + phraseDuration * 1000;

    switch (instrument) {
      case 'drums':
        this.playDrumsPhrase(t, variation);
        break;
      case 'guitar':
        this.playGuitarPhrase(t, variation);
        break;
      case 'piano':
        this.playPianoPhrase(t, variation);
        break;
      case 'trumpet':
        this.playTrumpetPhrase(t, variation);
        break;
      case 'violin':
        this.playViolinPhrase(t, variation);
        break;
      case 'dj':
        this.playDJPhrase(t, variation);
        break;
    }

    this.activePhraseTimeoutId = window.setTimeout(() => {
      this.currentActiveInstrument = null;
      this.activePhraseTimeoutId = null;
    }, phraseDuration * 1000);
  }

  // =========================================================================
  // 1. DRUMS — 5.2-SECOND COMPLETE ROCK / CYBER DRUM GROOVE & FILL
  // =========================================================================
  private playDrumsPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    // 120 BPM tempo: 1 beat = 0.5s. 10 beats = 5.0s phrase + cymbal decay.
    const beat = 0.5;

    // Drum hit helpers
    const triggerKick = (t: number, punch: number = 1.0) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + variation * 20, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.16);

      gain.gain.setValueAtTime(0.9 * punch, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.28);
      this.activeOscillators.push(osc);
    };

    const triggerSnare = (t: number, accent: boolean = true) => {
      if (!this.ctx) return;
      // Tone body
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(185, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.12);
      oscGain.gain.setValueAtTime(accent ? 0.7 : 0.35, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(oscGain);
      oscGain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.15);
      this.activeOscillators.push(osc);

      // Noise snap
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1600, t);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(accent ? 0.8 : 0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(targetBus);
      noise.start(t);
      noise.stop(t + 0.2);
      this.activeOscillators.push(noise);
    };

    const triggerHiHat = (t: number, isOpen: boolean = false) => {
      if (!this.ctx) return;
      const dur = isOpen ? 0.35 : 0.06;
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
      filter.frequency.setValueAtTime(7500, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isOpen ? 0.35 : 0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);
      noise.start(t);
      noise.stop(t + dur);
      this.activeOscillators.push(noise);
    };

    const triggerTom = (t: number, freq: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(targetBus);
      osc.start(t);
      osc.stop(t + 0.25);
      this.activeOscillators.push(osc);
    };

    const triggerCrash = (t: number) => {
      if (!this.ctx) return;
      const dur = 1.6;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4500, t);
      filter.Q.setValueAtTime(0.8, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);
      noise.start(t);
      noise.stop(t + dur);
      this.activeOscillators.push(noise);
    };

    // --- SCORE: 2 BARS OF DRIVING GROOVE + 1 BAR OF TOM/CRASH FILL ---
    // Bar 1 (0.0s - 2.0s)
    triggerKick(startTime + 0.0);
    triggerCrash(startTime + 0.0);
    triggerHiHat(startTime + 0.25);
    triggerSnare(startTime + 0.5);
    triggerHiHat(startTime + 0.75);
    triggerKick(startTime + 1.0);
    triggerKick(startTime + 1.25, 0.75);
    triggerSnare(startTime + 1.5);
    triggerHiHat(startTime + 1.75, true);

    // Bar 2 (2.0s - 4.0s)
    triggerKick(startTime + 2.0);
    triggerHiHat(startTime + 2.25);
    triggerSnare(startTime + 2.5);
    triggerHiHat(startTime + 2.75);
    triggerKick(startTime + 3.0);
    triggerKick(startTime + 3.25, 0.8);
    triggerSnare(startTime + 3.5);
    triggerHiHat(startTime + 3.75, true);

    // Bar 2.5: Rhythmic Fill (4.0s - 5.2s)
    triggerTom(startTime + 4.0, 200); // High tom
    triggerTom(startTime + 4.2, 160); // Mid tom
    triggerTom(startTime + 4.4, 120); // Low tom
    triggerKick(startTime + 4.6);
    triggerSnare(startTime + 4.6);
    triggerCrash(startTime + 4.6); // Explosive crash finish with 1.6s decay!
  }

  // =========================================================================
  // 2. ELECTRIC GUITAR — 5.2-SECOND HEAVY ROCK RIFF & SUSTAINED POWER CHORDS
  // =========================================================================
  private playGuitarPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    // Distorted heavy power chord player
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
        distortion.curve = this.makeDistortionCurve(65) as Float32Array<ArrayBuffer>;
        distortion.oversample = '4x';

        // Amp cabinet filter (speaker lowpass + presence peak)
        const cabFilter = this.ctx.createBiquadFilter();
        cabFilter.type = 'lowpass';
        cabFilter.frequency.setValueAtTime(palmMute ? 1400 : 3800, t);
        if (!palmMute) {
          cabFilter.frequency.exponentialRampToValueAtTime(1600, t + duration);
        }

        const gain = this.ctx.createGain();
        const baseGain = idx === 0 ? 0.45 : 0.3;
        gain.gain.setValueAtTime(baseGain, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(distortion);
        distortion.connect(cabFilter);
        cabFilter.connect(gain);
        gain.connect(targetBus);

        osc.start(t);
        osc.stop(t + duration);
        this.activeOscillators.push(osc);
      });
    };

    // Lead guitar singing tone with vibrato
    const playLeadNote = (t: number, freq: number, duration: number, vibratoAmount: number = 0.02) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Vibrato LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(5.8, t);
      lfoGain.gain.setValueAtTime(freq * vibratoAmount, t);
      lfo.connect(osc.frequency);

      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this.makeDistortionCurve(75) as Float32Array<ArrayBuffer>;

      const cabFilter = this.ctx.createBiquadFilter();
      cabFilter.type = 'peaking';
      cabFilter.frequency.setValueAtTime(2600, t);
      cabFilter.Q.setValueAtTime(2.0, t);
      cabFilter.gain.setValueAtTime(8, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(distortion);
      distortion.connect(cabFilter);
      cabFilter.connect(gain);
      gain.connect(targetBus);

      lfo.start(t);
      osc.start(t);
      lfo.stop(t + duration);
      osc.stop(t + duration);
      this.activeOscillators.push(osc);
      this.activeOscillators.push(lfo);
    };

    // Frequencies: E2 (82.4), G2 (98.0), A2 (110.0), B2 (123.5), C3 (130.8), D3 (146.8), E3 (164.8)
    const baseRoot = variation > 0.5 ? 98.0 : 82.41;

    // Phrase Score (5.2 seconds):
    // 0.0s: Chugging palm mute riff (E - E)
    playPowerChord(startTime + 0.0, baseRoot, 0.22, true);
    playPowerChord(startTime + 0.25, baseRoot, 0.22, true);

    // 0.5s: Power fifth punch (G)
    playPowerChord(startTime + 0.5, baseRoot * 1.189, 0.45);

    // 1.0s: Power fifth punch (A)
    playPowerChord(startTime + 1.0, baseRoot * 1.335, 0.45);

    // 1.5s: Screaming lead note with vibrato
    playLeadNote(startTime + 1.5, baseRoot * 2.0 * 1.335, 0.7, 0.03);

    // 2.25s: Second chug measure
    playPowerChord(startTime + 2.25, baseRoot, 0.22, true);
    playPowerChord(startTime + 2.5, baseRoot, 0.22, true);
    playPowerChord(startTime + 2.75, baseRoot * 1.5, 0.45); // B power chord

    // 3.25s: Melodic rock pentatonic lead run
    playLeadNote(startTime + 3.25, baseRoot * 2.0, 0.25);
    playLeadNote(startTime + 3.5, baseRoot * 2.0 * 1.189, 0.25);
    playLeadNote(startTime + 3.75, baseRoot * 2.0 * 1.335, 0.35);

    // 4.1s: Massive final Power Chord that sustains and rings out until 5.2s!
    playPowerChord(startTime + 4.1, baseRoot, 1.1);
  }

  // =========================================================================
  // 3. PIANO — 5.2-SECOND CONCERT GRAND ARPEGGIATED PROGRESSION
  // =========================================================================
  private playPianoPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    // Realistic acoustic piano note with felt hammer transient and overtone harmonics
    const playPianoNote = (t: number, freq: number, duration: number, velocity: number = 0.7) => {
      if (!this.ctx) return;
      // Felt hammer transient click
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(2200, t);
      clickGain.gain.setValueAtTime(0.18 * velocity, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      click.connect(clickGain);
      clickGain.connect(targetBus);
      click.start(t);
      click.stop(t + 0.02);
      this.activeOscillators.push(click);

      // Multi-harmonic additive string resonance
      const harmonics = [1, 2, 3, 4, 5];
      const weights = [0.85, 0.42, 0.22, 0.09, 0.04];

      harmonics.forEach((h, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq * h, t);

        const decay = duration / Math.sqrt(h);
        gain.gain.setValueAtTime(weights[idx] * velocity * 0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

        osc.connect(gain);
        gain.connect(targetBus);
        osc.start(t);
        osc.stop(t + decay);
        this.activeOscillators.push(osc);
      });
    };

    // Concert Grand Piano Chords: C minor / Ab major / F minor / G7 progression (120 BPM)
    // Chord 1 (0.0s): C minor (C3, G3, Eb4, G4)
    playPianoNote(startTime + 0.0, 130.81, 1.8, 0.8); // C3
    playPianoNote(startTime + 0.05, 196.00, 1.8, 0.7); // G3
    playPianoNote(startTime + 0.1, 311.13, 1.6, 0.75); // Eb4
    playPianoNote(startTime + 0.25, 392.00, 1.4, 0.7); // G4

    // Right-hand melodic flourish (0.6s - 1.2s)
    playPianoNote(startTime + 0.6, 523.25, 0.8, 0.75); // C5
    playPianoNote(startTime + 0.85, 622.25, 0.8, 0.75); // Eb5

    // Chord 2 (1.2s): Ab major (Ab2, Eb3, C4, Ab4)
    playPianoNote(startTime + 1.2, 103.83, 1.8, 0.8); // Ab2
    playPianoNote(startTime + 1.25, 155.56, 1.8, 0.7); // Eb3
    playPianoNote(startTime + 1.3, 261.63, 1.6, 0.75); // C4
    playPianoNote(startTime + 1.5, 415.30, 1.4, 0.75); // Ab4

    // Right-hand flourish 2 (1.8s - 2.4s)
    playPianoNote(startTime + 1.8, 523.25, 0.8, 0.75); // C5
    playPianoNote(startTime + 2.05, 659.25, 0.8, 0.8); // E5

    // Chord 3 (2.4s): F minor (F2, C3, Ab3, F4)
    playPianoNote(startTime + 2.4, 87.31, 1.8, 0.85); // F2
    playPianoNote(startTime + 2.45, 130.81, 1.8, 0.75); // C3
    playPianoNote(startTime + 2.5, 207.65, 1.6, 0.75); // Ab3
    playPianoNote(startTime + 2.7, 349.23, 1.4, 0.75); // F4

    // Chord 4 & Cascading Finale (3.6s - 5.2s): G7 to C5 resolution with long hall sustain!
    playPianoNote(startTime + 3.6, 98.00, 1.6, 0.8); // G2
    playPianoNote(startTime + 3.8, 196.00, 1.5, 0.7); // G3
    playPianoNote(startTime + 4.0, 246.94, 1.4, 0.75); // B3
    playPianoNote(startTime + 4.2, 392.00, 1.4, 0.8); // G4
    playPianoNote(startTime + 4.4, 523.25, 1.2, 0.85); // C5
    playPianoNote(startTime + 4.6, 659.25, 1.1, 0.85); // E5
    playPianoNote(startTime + 4.8, 1046.50, 1.4, 0.9); // C6 shimmering high finish!
  }

  // =========================================================================
  // 4. TRUMPET — 5.2-SECOND HEROIC BRASS FANFARE & SWELLING HARMONIES
  // =========================================================================
  private playTrumpetPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    const playBrassNote = (t: number, freq: number, duration: number, isAccent: boolean = false) => {
      if (!this.ctx) return;
      // Carrier & Modulator for bright FM brass bite
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(freq, t);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq * 2.0, t);

      // Dynamic brass mod envelope
      const biteAmount = isAccent ? freq * 3.8 : freq * 2.5;
      modGain.gain.setValueAtTime(biteAmount, t);
      modGain.gain.exponentialRampToValueAtTime(freq * 0.9, t + 0.12);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // Dual-formant filters for realistic brass bell acoustics
      const formant1 = this.ctx.createBiquadFilter();
      formant1.type = 'peaking';
      formant1.frequency.setValueAtTime(1150, t);
      formant1.Q.setValueAtTime(2.5, t);
      formant1.gain.setValueAtTime(9, t);

      const formant2 = this.ctx.createBiquadFilter();
      formant2.type = 'peaking';
      formant2.frequency.setValueAtTime(2450, t);
      formant2.Q.setValueAtTime(3.2, t);
      formant2.gain.setValueAtTime(7, t);

      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(0.001, t);
      amp.gain.linearRampToValueAtTime(isAccent ? 0.6 : 0.45, t + 0.035); // punchy brass attack
      amp.gain.exponentialRampToValueAtTime(0.001, t + duration);

      carrier.connect(formant1);
      formant1.connect(formant2);
      formant2.connect(amp);
      amp.connect(targetBus);

      modulator.start(t);
      carrier.start(t);
      modulator.stop(t + duration);
      carrier.stop(t + duration);
      this.activeOscillators.push(carrier);
      this.activeOscillators.push(modulator);
    };

    // Heroic Brass Fanfare Melody (C major / G major):
    // 0.0s: Bold pickup (G4)
    playBrassNote(startTime + 0.0, 392.00, 0.35, true);

    // 0.35s: Ascending fanfare (C5, E5)
    playBrassNote(startTime + 0.35, 523.25, 0.4, true);
    playBrassNote(startTime + 0.75, 659.25, 0.45, true);

    // 1.2s: Held glorious High G5 with vibrato
    playBrassNote(startTime + 1.2, 783.99, 0.9, true);

    // 2.2s: Triumphant staccato fanfare triplets
    playBrassNote(startTime + 2.2, 783.99, 0.22, true);
    playBrassNote(startTime + 2.45, 783.99, 0.22, true);
    playBrassNote(startTime + 2.7, 783.99, 0.35, true);

    // 3.1s: Fanfare descent & resolution (A5 -> B5 -> High C6)
    playBrassNote(startTime + 3.1, 880.00, 0.35, false);
    playBrassNote(startTime + 3.5, 987.77, 0.4, true);

    // 4.0s - 5.2s: Grand Triumphant High C6 fanfare chord that rings out until 5.2s!
    playBrassNote(startTime + 4.0, 1046.50, 1.2, true);
    // Harmony accompaniment (E5 + G5)
    playBrassNote(startTime + 4.0, 659.25, 1.2, false);
    playBrassNote(startTime + 4.0, 783.99, 1.2, false);
  }

  // =========================================================================
  // 5. VIOLIN — 5.2-SECOND VIRTUOSIC BOWED STRING MELODY & LUSH VIBRATO
  // =========================================================================
  private playViolinPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    const playBowedViolinNote = (
      t: number,
      freq: number,
      duration: number,
      vibratoHz: number = 5.5,
      vibratoDepth: number = 0.022
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

      // Acoustic violin body formant filter
      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.setValueAtTime(1250, t);
      bodyFilter.Q.setValueAtTime(3.8, t);
      bodyFilter.gain.setValueAtTime(10, t);

      const highAir = this.ctx.createBiquadFilter();
      highAir.type = 'highshelf';
      highAir.frequency.setValueAtTime(4200, t);
      highAir.gain.setValueAtTime(-4, t);

      // Bowing envelope with gentle rosin transient swell
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.09); // realistic bowed attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(bodyFilter);
      bodyFilter.connect(highAir);
      highAir.connect(gain);
      gain.connect(targetBus);

      lfo.start(t);
      osc.start(t);
      lfo.stop(t + duration);
      osc.stop(t + duration);
      this.activeOscillators.push(osc);
      this.activeOscillators.push(lfo);
    };

    // Emotional, sweeping violin melody (A minor / D minor):
    // 0.0s: Expressive bowed lead note (A4, 440 Hz)
    playBowedViolinNote(startTime + 0.0, 440.00, 0.75, 5.2, 0.02);

    // 0.75s: Legato transition to C5
    playBowedViolinNote(startTime + 0.75, 523.25, 0.7, 5.5, 0.025);

    // 1.45s: Soaring rise to E5 with deep vibrato
    playBowedViolinNote(startTime + 1.45, 659.25, 0.95, 5.6, 0.03);

    // 2.4s: Graceful ornaments (F5 -> E5 -> D5 -> C5)
    playBowedViolinNote(startTime + 2.4, 698.46, 0.35, 5.8, 0.02);
    playBowedViolinNote(startTime + 2.75, 659.25, 0.35, 5.8, 0.02);
    playBowedViolinNote(startTime + 3.1, 587.33, 0.4, 5.6, 0.02);
    playBowedViolinNote(startTime + 3.5, 523.25, 0.45, 5.5, 0.025);

    // 4.0s - 5.2s: High virtuosic climax on High A5 (880 Hz) with lush concert hall vibrato!
    playBowedViolinNote(startTime + 4.0, 880.00, 1.2, 5.8, 0.035);
  }

  // =========================================================================
  // 6. DJ MIXER — 5.2-SECOND ELECTRONIC DROP, SUB-BASS & ACID SYNTH SOLO
  // =========================================================================
  private playDJPhrase(startTime: number, variation: number) {
    if (!this.ctx || !this.activeInstrumentGain) return;
    const targetBus = this.activeInstrumentGain;

    // 1. Noise Riser (0.0s - 1.2s): Filtered sweeping white noise build-up
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
    riserFilter.frequency.setValueAtTime(250, startTime);
    riserFilter.frequency.exponentialRampToValueAtTime(4200, startTime + 1.2);

    const riserGain = this.ctx.createGain();
    riserGain.gain.setValueAtTime(0.01, startTime);
    riserGain.gain.exponentialRampToValueAtTime(0.5, startTime + 1.2);

    noise.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(targetBus);
    noise.start(startTime);
    noise.stop(startTime + 1.2);
    this.activeOscillators.push(noise);

    // 2. Vinyl Scratch / Tape Stop Glitch (1.2s - 1.45s)
    const scratch = this.ctx.createOscillator();
    const scratchGain = this.ctx.createGain();
    scratch.type = 'sawtooth';
    scratch.frequency.setValueAtTime(1800, startTime + 1.2);
    scratch.frequency.exponentialRampToValueAtTime(140, startTime + 1.45);
    scratchGain.gain.setValueAtTime(0.4, startTime + 1.2);
    scratchGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.45);
    scratch.connect(scratchGain);
    scratchGain.connect(targetBus);
    scratch.start(startTime + 1.2);
    scratch.stop(startTime + 1.45);
    this.activeOscillators.push(scratch);

    // 3. Colossal 808 Sub-Bass Drop (1.5s): Earth-shaking sine sweep 160Hz -> 34Hz
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160 + variation * 20, startTime + 1.5);
    subOsc.frequency.exponentialRampToValueAtTime(34, startTime + 2.1);
    subGain.gain.setValueAtTime(0.95, startTime + 1.5);
    subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.4);

    const subDist = this.ctx.createWaveShaper();
    subDist.curve = this.makeDistortionCurve(30) as Float32Array<ArrayBuffer>;
    subOsc.connect(subDist);
    subDist.connect(subGain);
    subGain.connect(targetBus);
    subOsc.start(startTime + 1.5);
    subOsc.stop(startTime + 2.4);
    this.activeOscillators.push(subOsc);

    // 4. Acid Synth Lead Chords & Arpeggio (2.0s - 4.2s)
    const acidNotes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    for (let i = 0; i < 12; i++) {
      if (!this.ctx) break;
      const stepTime = startTime + 2.0 + i * 0.18;
      const noteFreq = acidNotes[i % acidNotes.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(noteFreq, stepTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(6.0, stepTime);
      filter.frequency.setValueAtTime(800 + (i % 4) * 600, stepTime);
      filter.frequency.exponentialRampToValueAtTime(200, stepTime + 0.16);

      gain.gain.setValueAtTime(0.35, stepTime);
      gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(targetBus);

      osc.start(stepTime);
      osc.stop(stepTime + 0.16);
      this.activeOscillators.push(osc);
    }

    // 5. Laser Filter Sweep & Sub Echo Finish (4.2s - 5.2s)
    const laserOsc = this.ctx.createOscillator();
    const laserGain = this.ctx.createGain();
    laserOsc.type = 'sawtooth';
    laserOsc.frequency.setValueAtTime(1400, startTime + 4.2);
    laserOsc.frequency.exponentialRampToValueAtTime(80, startTime + 5.1);

    laserGain.gain.setValueAtTime(0.35, startTime + 4.2);
    laserGain.gain.exponentialRampToValueAtTime(0.001, startTime + 5.2);

    laserOsc.connect(laserGain);
    laserGain.connect(targetBus);
    laserOsc.start(startTime + 4.2);
    laserOsc.stop(startTime + 5.2);
    this.activeOscillators.push(laserOsc);
  }

  // =========================================================================
  // 7. SUPER ATTACKS (TWO-HAND COMBOS)
  // =========================================================================
  public playSuperAttack(id: SuperAttackId) {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.stopCurrentPhrase(0.05);
    const t = this.ctx.currentTime + 0.02;

    switch (id) {
      case 'thunderquake': // Drums + Guitar
        this.playDrumsPhrase(t, 0.9);
        this.playGuitarPhrase(t, 0.9);
        this.playThunderRumble(t);
        break;

      case 'sonic_storm': // Piano + Trumpet
        this.playPianoPhrase(t, 0.9);
        this.playTrumpetPhrase(t, 0.9);
        this.playShimmeringChord(t);
        break;

      case 'resonance_drop': // Violin + DJ Mixer
        this.playViolinPhrase(t, 0.9);
        this.playDJPhrase(t, 0.9);
        this.playSirenRiser(t);
        break;
    }
  }

  private playThunderRumble(t: number) {
    if (!this.ctx || !this.sfxGain) return;
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
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.4);
    this.activeOscillators.push(osc);
  }

  private playShimmeringChord(t: number) {
    if (!this.ctx || !this.sfxGain) return;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.3, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 1.2);
      this.activeOscillators.push(osc);
    });
  }

  private playSirenRiser(t: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.6);
    osc.frequency.exponentialRampToValueAtTime(45, t + 1.3);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.4);
    this.activeOscillators.push(osc);
  }

  // =========================================================================
  // 8. GAME SFX: Judgments, Hits, Shields & Fanfares
  // =========================================================================
  public playPerfectSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // High crystal sparkle chime (C6 + G6)
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

    // Descending wobble stumble
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

  public playFeverSound() {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Dazzling upward synth arpeggio
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

    // Triumphant fanfare arpeggio: C5, E5, G5, C6
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
  // 9. PROCEDURAL BACKGROUND BATTLE BEAT (120 BPM Cyber-Funk)
  // =========================================================================
  public startBattleMusic() {
    if (this.isMusicPlaying) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.isMusicPlaying = true;
    let step = 0;
    const bpm = 120;
    const stepInterval = (60 / bpm / 4) * 1000; // 16th notes (125ms)

    // Bassline notes (F minor cyber groove)
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
        kGain.gain.setValueAtTime(0.28, t);
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
        sGain.gain.setValueAtTime(0.18, t);
        sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        sOsc.connect(sGain);
        sGain.connect(this.musicGain);
        sOsc.start(t);
        sOsc.stop(t + 0.12);
      }

      // Sub-bass groove on 8th notes
      if (step % 2 === 0) {
        const note = bassline[(step / 2) % bassline.length];
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(note, t);
        bGain.gain.setValueAtTime(0.1, t);
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
    this.stopCurrentPhrase(0.02);
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
