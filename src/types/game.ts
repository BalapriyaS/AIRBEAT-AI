export type InstrumentId = 'drums' | 'guitar' | 'piano' | 'trumpet' | 'violin' | 'dj';

export interface InstrumentConfig {
  id: InstrumentId;
  name: string;
  subtitle: string;
  attackName: string;
  danceMoveName: string;
  color: string; // hex
  colorTailwind: string;
  glowClass: string;
  iconName: string;
  position: { x: number; y: number }; // normalized 0..1 coordinates on screen
  description: string;
  side: 'left' | 'right';
  row: 'top' | 'middle' | 'bottom';
}

export type SuperAttackId = 'thunderquake' | 'sonic_storm' | 'resonance_drop';

export interface SuperAttackConfig {
  id: SuperAttackId;
  name: string;
  instruments: [InstrumentId, InstrumentId];
  description: string;
  damage: number;
  color: string;
}

export type DanceMoveId =
  | 'idle'
  | 'drums_stomp'
  | 'guitar_headbang'
  | 'piano_sway'
  | 'trumpet_march'
  | 'violin_spin'
  | 'dj_bassdrop'
  | 'missed_stumble'
  | 'fever_dance'
  | 'super_thunder'
  | 'super_storm'
  | 'super_drop';

export interface RhythmChallenge {
  id: string;
  instruction: string;
  targetInstrument: InstrumentId;
  isSuperMove?: boolean;
  superMoveId?: SuperAttackId;
  danceMove: DanceMoveId;
  actionName: string;
  points: number;
  timeLimit: number; // seconds
}

export type JudgmentRating = 'PERFECT' | 'GREAT' | 'MISS' | 'FEVER' | null;

export type GameStage = 
  | 'start_screen'
  | 'stage_1_beat_eater'
  | 'stage_2_rhythm_breaker'
  | 'stage_3_music_destroyer'
  | 'victory'
  | 'game_over';

export interface MonsterState {
  name: string;
  title: string;
  maxHealth: number;
  currentHealth: number;
  grooveLevel: number; // 0..100%
  activeDanceMove: DanceMoveId;
  danceMoveTimer: number;
  weakness?: InstrumentId;
  shieldActive: boolean;
  phase: number;
  isStunned: boolean;
  hitReactionTime: number;
}

export interface HandPoint {
  x: number; // 0..1 normalized (mirrored for intuitive gameplay)
  y: number; // 0..1 normalized
  z?: number;
}

export interface TrackedHand {
  id: string;
  indexTip: HandPoint;
  thumbTip: HandPoint;
  wrist: HandPoint;
  isPinching: boolean;
  pinchDistance: number;
  hoveredInstrument: InstrumentId | null;
  hoverProgress?: number; // 0..1 hover dwell charge progress for visual ring
  isTriggering?: boolean; // True if triggered via air-tap, pinch, or dwell
  triggerType?: 'pinch' | 'tap' | 'dwell';
  landmarks: HandPoint[];
}

export interface AttackEvent {
  id: string;
  instrumentId: InstrumentId;
  isSuperAttack?: boolean;
  superAttackId?: SuperAttackId;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  damage: number;
  color: string;
  comboCount: number;
  timestamp: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  superAttacksUsed: number;
  monstersDefeated: number;
  timeRemaining: number;
  rankTitle: string;
  perfectHits: number;
  greatHits: number;
  missCount: number;
  feverActive: boolean;
}
