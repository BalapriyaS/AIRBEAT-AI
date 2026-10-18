import { InstrumentConfig, InstrumentId, SuperAttackConfig, SuperAttackId } from '../types/game';

export const INSTRUMENTS: Record<InstrumentId, InstrumentConfig> = {
  // --- LEFT COLUMN (Comfortable reach zone x: 0.13) ---
  drums: {
    id: 'drums',
    name: 'DRUMS',
    subtitle: 'Stomp & Smash',
    attackName: 'SHOCKWAVE STOMP',
    danceMoveName: 'Rhythmic Stomp & Chest Hit',
    color: '#00D9FF', // Electric Cyan
    colorTailwind: 'text-[#00D9FF] border-[#00D9FF] bg-[#111C2D]/90',
    glowClass: 'glow-cyan',
    iconName: 'Drum',
    position: { x: 0.13, y: 0.22 }, // Left Column: Top (easy reach)
    side: 'left',
    row: 'top',
    description: 'Heavy kick & punchy snare that trigger powerful stomping movements!'
  },
  piano: {
    id: 'piano',
    name: 'PIANO',
    subtitle: 'Melody & Sway',
    attackName: 'FALLING KEYS',
    danceMoveName: 'Graceful Stepping & Fluid Sway',
    color: '#1687FF', // Electric Blue
    colorTailwind: 'text-[#1687FF] border-[#1687FF] bg-[#111C2D]/90',
    glowClass: 'glow-blue',
    iconName: 'Piano',
    position: { x: 0.13, y: 0.44 }, // Left Column: Middle (effortless center-left)
    side: 'left',
    row: 'middle',
    description: 'Cascading acoustic piano keys that trigger graceful fluid footwork.'
  },
  violin: {
    id: 'violin',
    name: 'VIOLIN',
    subtitle: 'Resonance & Spin',
    attackName: 'RESONANCE WAVE',
    danceMoveName: '360 Pirouette & Lyrical Extension',
    color: '#A78BFA', // Cyber Violet
    colorTailwind: 'text-[#A78BFA] border-[#A78BFA] bg-[#111C2D]/90',
    glowClass: 'glow-violet',
    iconName: 'Music',
    position: { x: 0.13, y: 0.66 }, // Left Column: Bottom (above camera dock)
    side: 'left',
    row: 'bottom',
    description: 'Hypnotic bowed tones that make the creature spin in a 360 pirouette!'
  },

  // --- RIGHT COLUMN (Comfortable reach zone x: 0.87) ---
  guitar: {
    id: 'guitar',
    name: 'GUITAR',
    subtitle: 'Headbang Riff',
    attackName: 'THUNDER RIFF',
    danceMoveName: 'High-Energy Rock Headbang',
    color: '#38BDF8', // Sky Plasma High-Voltage
    colorTailwind: 'text-[#38BDF8] border-[#38BDF8] bg-[#111C2D]/90',
    glowClass: 'glow-cyan',
    iconName: 'Zap',
    position: { x: 0.87, y: 0.22 }, // Right Column: Top (easy reach)
    side: 'right',
    row: 'top',
    description: 'Distorted electric lead riff that triggers aggressive rock headbanging!'
  },
  trumpet: {
    id: 'trumpet',
    name: 'TRUMPET',
    subtitle: 'Brass March',
    attackName: 'SONIC BLAST',
    danceMoveName: 'Fanfare Strut & Chest Pop',
    color: '#60A5FA', // Cobalt Flux Beam
    colorTailwind: 'text-[#60A5FA] border-[#60A5FA] bg-[#111C2D]/90',
    glowClass: 'glow-blue',
    iconName: 'Volume2',
    position: { x: 0.87, y: 0.44 }, // Right Column: Middle (effortless center-right)
    side: 'right',
    row: 'middle',
    description: 'Bright brass fanfare that triggers a triumphant parade march.'
  },
  dj: {
    id: 'dj',
    name: 'DJ MIXER',
    subtitle: 'Bass Drop & Bounce',
    attackName: 'BASS DROP',
    danceMoveName: 'Breakdance Drop & Turntable Shuffle',
    color: '#C084FC', // Neon Lilac Synth
    colorTailwind: 'text-[#C084FC] border-[#C084FC] bg-[#111C2D]/90',
    glowClass: 'glow-violet',
    iconName: 'Disc',
    position: { x: 0.87, y: 0.66 }, // Right Column: Bottom (above bottom dock)
    side: 'right',
    row: 'bottom',
    description: 'Sub-bass earth quakes that trigger a breakdance drop and robot pop!'
  }
};

export const SUPER_ATTACKS: Record<SuperAttackId, SuperAttackConfig> = {
  thunderquake: {
    id: 'thunderquake',
    name: 'THUNDERQUAKE DANCE',
    instruments: ['drums', 'guitar'],
    description: 'Drums + Electric Guitar: Seismic double stomp with lightning headbanging',
    damage: 65,
    color: '#00D9FF'
  },
  sonic_storm: {
    id: 'sonic_storm',
    name: 'SONIC STORM WALTZ',
    instruments: ['piano', 'trumpet'],
    description: 'Piano + Trumpet: Symphonic brass fanfare and dazzling cosmic spin',
    damage: 60,
    color: '#1687FF'
  },
  resonance_drop: {
    id: 'resonance_drop',
    name: 'RESONANCE BASS VORTEX',
    instruments: ['violin', 'dj'],
    description: 'Violin + DJ Mixer: Colossal sub-bass vortex and gravity-defying freeze',
    damage: 75,
    color: '#A78BFA'
  }
};

export const INSTRUMENT_LIST = Object.values(INSTRUMENTS);
export const SUPER_ATTACK_LIST = Object.values(SUPER_ATTACKS);
