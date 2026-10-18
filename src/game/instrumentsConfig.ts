import { InstrumentConfig, InstrumentId, SuperAttackConfig, SuperAttackId } from '../types/game';

export const INSTRUMENTS: Record<InstrumentId, InstrumentConfig> = {
  // --- LEFT COLUMN ---
  drums: {
    id: 'drums',
    name: 'DRUMS',
    subtitle: 'Stomp & Smash',
    attackName: 'SHOCKWAVE STOMP',
    danceMoveName: 'Rhythmic Stomp & Chest Hit',
    color: '#06b6d4', // Cyan
    colorTailwind: 'text-cyan-400 border-cyan-500 bg-cyan-950/60',
    glowClass: 'glow-cyan',
    iconName: 'Drum',
    position: { x: 0.10, y: 0.22 }, // Left Column: Top
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
    color: '#3b82f6', // Blue
    colorTailwind: 'text-blue-400 border-blue-500 bg-blue-950/60',
    glowClass: 'glow-cyan',
    iconName: 'Piano',
    position: { x: 0.10, y: 0.47 }, // Left Column: Middle
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
    color: '#d946ef', // Magenta
    colorTailwind: 'text-fuchsia-400 border-fuchsia-500 bg-fuchsia-950/60',
    glowClass: 'glow-magenta',
    iconName: 'Music',
    position: { x: 0.10, y: 0.72 }, // Left Column: Bottom (elevated with clearance from dock)
    side: 'left',
    row: 'bottom',
    description: 'Hypnotic bowed tones that make the creature spin in a 360 pirouette!'
  },

  // --- RIGHT COLUMN ---
  guitar: {
    id: 'guitar',
    name: 'GUITAR',
    subtitle: 'Headbang Riff',
    attackName: 'THUNDER RIFF',
    danceMoveName: 'High-Energy Rock Headbang',
    color: '#f97316', // Orange
    colorTailwind: 'text-orange-400 border-orange-500 bg-orange-950/60',
    glowClass: 'glow-orange',
    iconName: 'Zap',
    position: { x: 0.90, y: 0.22 }, // Right Column: Top
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
    color: '#eab308', // Yellow
    colorTailwind: 'text-yellow-400 border-yellow-500 bg-yellow-950/60',
    glowClass: 'glow-yellow',
    iconName: 'Volume2',
    position: { x: 0.90, y: 0.47 }, // Right Column: Middle
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
    color: '#22c55e', // Neon Green
    colorTailwind: 'text-emerald-400 border-emerald-500 bg-emerald-950/60',
    glowClass: 'glow-green',
    iconName: 'Disc',
    position: { x: 0.90, y: 0.72 }, // Right Column: Bottom
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
    color: '#f59e0b'
  },
  sonic_storm: {
    id: 'sonic_storm',
    name: 'SONIC STORM WALTZ',
    instruments: ['piano', 'trumpet'],
    description: 'Piano + Trumpet: Symphonic brass fanfare and dazzling cosmic spin',
    damage: 60,
    color: '#06b6d4'
  },
  resonance_drop: {
    id: 'resonance_drop',
    name: 'RESONANCE BASS VORTEX',
    instruments: ['violin', 'dj'],
    description: 'Violin + DJ Mixer: Colossal sub-bass vortex and gravity-defying freeze',
    damage: 75,
    color: '#a855f7'
  }
};

export const INSTRUMENT_LIST = Object.values(INSTRUMENTS);
export const SUPER_ATTACK_LIST = Object.values(SUPER_ATTACKS);
