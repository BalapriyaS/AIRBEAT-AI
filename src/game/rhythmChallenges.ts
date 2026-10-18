import { RhythmChallenge } from '../types/game';

export const STAGE_1_CHALLENGES: RhythmChallenge[] = [
  {
    id: 's1_c1',
    instruction: 'MAKE THE MONSTER STOMP — PLAY DRUMS!',
    targetInstrument: 'drums',
    danceMove: 'drums_stomp',
    actionName: 'DOUBLE STOMP',
    points: 150,
    timeLimit: 10
  },
  {
    id: 's1_c2',
    instruction: 'TIME TO HEADBANG — PLAY GUITAR!',
    targetInstrument: 'guitar',
    danceMove: 'guitar_headbang',
    actionName: 'POWER HEADBANG',
    points: 180,
    timeLimit: 9
  },
  {
    id: 's1_c3',
    instruction: 'PLAY A SWEET MELODY — SELECT PIANO!',
    targetInstrument: 'piano',
    danceMove: 'piano_sway',
    actionName: 'ELEGANT SWAY',
    points: 200,
    timeLimit: 8
  },
  {
    id: 's1_c4',
    instruction: 'BRING THE BRASS — ACTIVATE TRUMPET!',
    targetInstrument: 'trumpet',
    danceMove: 'trumpet_march',
    actionName: 'BRASS MARCH',
    points: 220,
    timeLimit: 8
  },
  {
    id: 's1_c5',
    instruction: 'MAKE IT SPIN — PLAY VIOLIN!',
    targetInstrument: 'violin',
    danceMove: 'violin_spin',
    actionName: 'PIROUETTE SPIN',
    points: 250,
    timeLimit: 7
  },
  {
    id: 's1_c6',
    instruction: 'DROP THE BASS — ACTIVATE DJ MIXER!',
    targetInstrument: 'dj',
    danceMove: 'dj_bassdrop',
    actionName: 'BASS DROP SQUAT',
    points: 300,
    timeLimit: 7
  }
];

export const STAGE_2_CHALLENGES: RhythmChallenge[] = [
  {
    id: 's2_c1',
    instruction: 'RAPID GROOVE: HIT THE DRUMS FAST!',
    targetInstrument: 'drums',
    danceMove: 'drums_stomp',
    actionName: 'HYPER STOMP',
    points: 250,
    timeLimit: 6
  },
  {
    id: 's2_c2',
    instruction: 'ELECTRIC RIFF: SHRED THE GUITAR!',
    targetInstrument: 'guitar',
    danceMove: 'guitar_headbang',
    actionName: 'GUITAR SHRED',
    points: 280,
    timeLimit: 6
  },
  {
    id: 's2_c3',
    instruction: 'SWAY WITH THE HARMONY — PLAY PIANO!',
    targetInstrument: 'piano',
    danceMove: 'piano_sway',
    actionName: 'HARMONIC FLOW',
    points: 300,
    timeLimit: 5.5
  },
  {
    id: 's2_c4',
    instruction: 'FANFARE BLAST — ACTIVATE TRUMPET!',
    targetInstrument: 'trumpet',
    danceMove: 'trumpet_march',
    actionName: 'SALUTE MARCH',
    points: 320,
    timeLimit: 5.5
  },
  {
    id: 's2_c5',
    instruction: 'VIRTUOSO TWIRL — SWEEP THE VIOLIN!',
    targetInstrument: 'violin',
    danceMove: 'violin_spin',
    actionName: 'CYCLONE TWIRL',
    points: 350,
    timeLimit: 5
  },
  {
    id: 's2_c6',
    instruction: 'CLUB EXPLOSION — DROP THE DJ MIXER!',
    targetInstrument: 'dj',
    danceMove: 'dj_bassdrop',
    actionName: 'RAVE BOUNCE',
    points: 400,
    timeLimit: 5
  }
];

export const STAGE_3_CHALLENGES: RhythmChallenge[] = [
  {
    id: 's3_c1',
    instruction: 'SUPER MOVE: PINCH DRUMS + GUITAR TOGETHER!',
    targetInstrument: 'drums',
    isSuperMove: true,
    superMoveId: 'thunderquake',
    danceMove: 'super_thunder',
    actionName: 'THUNDERQUAKE SLAM',
    points: 600,
    timeLimit: 8
  },
  {
    id: 's3_c2',
    instruction: 'PIANO + TRUMPET: UNLEASH SONIC STORM!',
    targetInstrument: 'piano',
    isSuperMove: true,
    superMoveId: 'sonic_storm',
    danceMove: 'super_storm',
    actionName: 'SONIC TORNADO',
    points: 700,
    timeLimit: 8
  },
  {
    id: 's3_c3',
    instruction: 'VIOLIN + DJ: HIT THE RESONANCE DROP!',
    targetInstrument: 'violin',
    isSuperMove: true,
    superMoveId: 'resonance_drop',
    danceMove: 'super_drop',
    actionName: 'GRAVITY FREEZE',
    points: 800,
    timeLimit: 8
  },
  {
    id: 's3_c4',
    instruction: 'FINALE: UNLEASH TOTAL MAYHEM DANCE!',
    targetInstrument: 'dj',
    danceMove: 'dj_bassdrop',
    actionName: 'FINAL SHOWDOWN',
    points: 1000,
    timeLimit: 6
  }
];
