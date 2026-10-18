import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AttackEvent,
  DanceMoveId,
  GameStage,
  GameStats,
  InstrumentId,
  JudgmentRating,
  MonsterState,
  RhythmChallenge,
  SuperAttackId,
  TrackedHand
} from '../types/game';
import { audioEngine } from '../audio/AudioEngine';
import { GameArena } from '../three/GameArena';
import { INSTRUMENTS, SUPER_ATTACKS } from './instrumentsConfig';

const TOTAL_GAME_TIME = 180; // 3-minute round (180s)

// Rhythm Challenges Choreography Pools (Generous exhibition-friendly time limits)
const CHOREOGRAPHY_ROUTINES: Record<string, Omit<RhythmChallenge, 'id'>[]> = {
  stage_1: [
    {
      instruction: 'HIT THE DRUMS TO STOMP THE BEAT!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Rhythmic Stomp',
      points: 500,
      timeLimit: 8.5
    },
    {
      instruction: 'SHRED THE GUITAR FOR A ROCK HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Rock Headbang',
      points: 500,
      timeLimit: 8.5
    },
    {
      instruction: 'PLAY THE PIANO FOR A GRACEFUL SWAY!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Piano Sway',
      points: 500,
      timeLimit: 8.5
    },
    {
      instruction: 'BLOW THE TRUMPET FOR A BRASS STRUT!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Fanfare March',
      points: 500,
      timeLimit: 8.5
    },
    {
      instruction: 'BOW THE VIOLIN FOR A 360 PIRUETTE!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Violin Pirouette',
      points: 500,
      timeLimit: 8.5
    },
    {
      instruction: 'DROP THE BASS TO BREAKDANCE!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Breakdance Drop',
      points: 500,
      timeLimit: 8.5
    }
  ],
  stage_2: [
    {
      instruction: 'DRUM SHUFFLE: DOUBLE STOMP THE CYBER BEAT!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Cyber Stomp',
      points: 600,
      timeLimit: 6.0
    },
    {
      instruction: 'SYNTH DROP: POP & BREAKDANCE!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Electro Pop',
      points: 600,
      timeLimit: 6.0
    },
    {
      instruction: 'GUITAR SOLO: POWER HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Power Riff',
      points: 600,
      timeLimit: 6.0
    },
    {
      instruction: 'VIOLIN WHIRL: GLIDING SPINS!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Gliding Spin',
      points: 600,
      timeLimit: 6.0
    },
    {
      instruction: 'PIANO CASCADE: FLUID FOOTWORK!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Fluid Footwork',
      points: 600,
      timeLimit: 6.0
    },
    {
      instruction: 'BRASS POP: TRIUMPHANT FANFARE!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Triumphant March',
      points: 600,
      timeLimit: 6.0
    }
  ],
  stage_3: [
    {
      instruction: 'HYPER BASS DROP: BREAKDANCE CLIMAX!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Hyper Drop',
      points: 800,
      timeLimit: 4.8
    },
    {
      instruction: 'THUNDER DRUMS: SEISMIC DOUBLE STOMP!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Thunder Stomp',
      points: 800,
      timeLimit: 4.8
    },
    {
      instruction: 'ROCK OVERDRIVE: WILD HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Overdrive Riff',
      points: 800,
      timeLimit: 4.8
    },
    {
      instruction: 'ROYAL TRUMPET: FANFARE CHEST POP!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Chest Pop Strut',
      points: 800,
      timeLimit: 4.8
    },
    {
      instruction: 'COSMIC VIOLIN: ULTRA PIRUETTE!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Cosmic Pirouette',
      points: 800,
      timeLimit: 4.8
    },
    {
      instruction: 'PIANO GLIDE: MASTER KEY RIFF!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Master Riff',
      points: 800,
      timeLimit: 4.8
    }
  ]
};

export interface JudgmentFeedbackState {
  rating: JudgmentRating;
  scoreAdd: number;
  text: string;
  id: number;
}

export function useGameEngine() {
  const [stage, setStage] = useState<GameStage>('start_screen');
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    combo: 1,
    maxCombo: 1,
    hits: 0,
    superAttacksUsed: 0,
    monstersDefeated: 0,
    timeRemaining: TOTAL_GAME_TIME,
    rankTitle: 'Rhythm Rookie',
    perfectHits: 0,
    greatHits: 0,
    missCount: 0,
    feverActive: false
  });

  const [monster, setMonster] = useState<MonsterState>({
    name: 'THE BEAT EATER',
    title: 'Star Dancer of the Arena',
    maxHealth: 100,
    currentHealth: 100,
    grooveLevel: 0,
    activeDanceMove: 'idle',
    danceMoveTimer: 0,
    shieldActive: false,
    phase: 1,
    isStunned: false,
    hitReactionTime: 0
  });

  // Current Rhythm Challenge & Judgment
  const [currentChallenge, setCurrentChallenge] = useState<RhythmChallenge | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<number>(1.0); // 1..0 countdown
  const [judgmentFeedback, setJudgmentFeedback] = useState<JudgmentFeedbackState | null>(null);

  const [superAttackGauge, setSuperAttackGauge] = useState<number>(35); // 0..100
  const [superAttackNotification, setSuperAttackNotification] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // References to avoid stale closures in high-frequency callbacks
  const arenaRef = useRef<GameArena | null>(null);
  const stageRef = useRef<GameStage>(stage);
  const monsterRef = useRef<MonsterState>(monster);
  const statsRef = useRef<GameStats>(stats);
  const superGaugeRef = useRef<number>(superAttackGauge);
  const currentChallengeRef = useRef<RhythmChallenge | null>(null);
  const challengeEndTimeRef = useRef<number>(0);
  const challengeDurationRef = useRef<number>(4.0);
  const isPausedRef = useRef<boolean>(false);
  const pausedChallengeTimeLeftRef = useRef<number>(0);

  // Intervals & Timers
  const timerIntervalRef = useRef<number | null>(null);
  const challengeTickRef = useRef<number | null>(null);

  // Two-hand pinch memory
  const recentPinchesRef = useRef<{ instrument: InstrumentId; time: number; handId: string }[]>([]);

  // Sync refs
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    monsterRef.current = monster;
  }, [monster]);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  useEffect(() => {
    superGaugeRef.current = superAttackGauge;
  }, [superAttackGauge]);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    currentChallengeRef.current = currentChallenge;
  }, [currentChallenge]);

  // Set 3D arena instance
  const attachArena = useCallback((arena: GameArena) => {
    arenaRef.current = arena;
  }, []);

  // Update Rank Title helper
  const calculateRank = (score: number): string => {
    if (score >= 32000) return 'Legendary Dance Master';
    if (score >= 18000) return 'Sonic Superstar';
    if (score >= 8000) return 'Beat Warrior';
    return 'Rhythm Rookie';
  };

  // ==================== CHALLENGE GENERATOR ====================
  const spawnNextChallenge = useCallback(() => {
    if (
      stageRef.current !== 'stage_1_beat_eater' &&
      stageRef.current !== 'stage_2_rhythm_breaker' &&
      stageRef.current !== 'stage_3_music_destroyer'
    ) {
      return;
    }

    const stageKey =
      stageRef.current === 'stage_1_beat_eater'
        ? 'stage_1'
        : stageRef.current === 'stage_2_rhythm_breaker'
        ? 'stage_2'
        : 'stage_3';

    const pool = CHOREOGRAPHY_ROUTINES[stageKey];
    const prevTarget = currentChallengeRef.current?.targetInstrument;
    const candidates = pool.filter((item) => item.targetInstrument !== prevTarget);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];

    const newChallenge: RhythmChallenge = {
      ...chosen,
      id: Math.random().toString()
    };

    setCurrentChallenge(newChallenge);
    currentChallengeRef.current = newChallenge;
    challengeDurationRef.current = newChallenge.timeLimit;
    challengeEndTimeRef.current = performance.now() + newChallenge.timeLimit * 1000;
    setChallengeProgress(1.0);

    // Update shield rune in Arena if Stage 2
    if (arenaRef.current && stageRef.current === 'stage_2_rhythm_breaker') {
      arenaRef.current.setShieldRequirement(newChallenge.targetInstrument);
    }
  }, []);

  // Challenge Countdown Tick (runs smoothly every 50ms)
  useEffect(() => {
    if (
      stage !== 'stage_1_beat_eater' &&
      stage !== 'stage_2_rhythm_breaker' &&
      stage !== 'stage_3_music_destroyer'
    ) {
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
      return;
    }

    challengeTickRef.current = window.setInterval(() => {
      if (!currentChallengeRef.current || isPausedRef.current) return;
      const now = performance.now();
      const timeLeft = challengeEndTimeRef.current - now;
      const totalTime = challengeDurationRef.current * 1000;

      if (timeLeft <= 0) {
        // TIME OUT: Counted as a missed beat
        handleChallengeMiss('TOO SLOW! MISS');
      } else {
        setChallengeProgress(Math.max(0, Math.min(1, timeLeft / totalTime)));
      }
    }, 50);

    return () => {
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
    };
  }, [stage]);

  // Handle Miss / Stumble
  const handleChallengeMiss = (reason: string = 'STUMBLE! MISS') => {
    if (stageRef.current === 'stage_1_beat_eater') {
      // In Stage 1: Forgiving transition to next routine so exhibition players are not penalized
      setJudgmentFeedback({
        rating: 'GREAT',
        scoreAdd: 0,
        text: 'SWITCHING BEAT! TRY THIS ONE!',
        id: Date.now()
      });
      setTimeout(() => {
        spawnNextChallenge();
      }, 700);
      return;
    }

    audioEngine.playMissSound();

    if (arenaRef.current) {
      arenaRef.current.setDanceMove('missed_stumble', 1.6);
    }

    setJudgmentFeedback({
      rating: 'MISS',
      scoreAdd: 0,
      text: reason,
      id: Date.now()
    });

    setStats((prev) => ({
      ...prev,
      combo: 1,
      feverActive: false,
      missCount: prev.missCount + 1
    }));

    // Spawn next challenge with a brief pause
    setTimeout(() => {
      spawnNextChallenge();
    }, 600);
  };

  // ==================== ATTACK / DANCE TRIGGER ====================
  const triggerAttack = useCallback(
    (instrumentId: InstrumentId, handVariation: number = 0.5, customStart?: { x: number; y: number }) => {
      if (
        stageRef.current !== 'stage_1_beat_eater' &&
        stageRef.current !== 'stage_2_rhythm_breaker' &&
        stageRef.current !== 'stage_3_music_destroyer'
      ) {
        return;
      }

      if (isPausedRef.current) return;

      const instConfig = INSTRUMENTS[instrumentId];
      const startCoord = customStart || instConfig.position;

      // 1. Play instrument sound immediately (zero latency)
      audioEngine.playInstrument(instrumentId, handVariation);

      // Check Two-Hand Super Attack
      const now = performance.now();
      const pinches = recentPinchesRef.current.filter((p) => now - p.time < 350);
      const otherPinch = pinches.find((p) => p.instrument !== instrumentId);

      if (otherPinch && superGaugeRef.current >= 40) {
        let matchedSuper: SuperAttackId | null = null;
        if (
          (instrumentId === 'drums' && otherPinch.instrument === 'guitar') ||
          (instrumentId === 'guitar' && otherPinch.instrument === 'drums')
        ) {
          matchedSuper = 'thunderquake';
        } else if (
          (instrumentId === 'piano' && otherPinch.instrument === 'trumpet') ||
          (instrumentId === 'trumpet' && otherPinch.instrument === 'piano')
        ) {
          matchedSuper = 'sonic_storm';
        } else if (
          (instrumentId === 'violin' && otherPinch.instrument === 'dj') ||
          (instrumentId === 'dj' && otherPinch.instrument === 'violin')
        ) {
          matchedSuper = 'resonance_drop';
        }

        if (matchedSuper) {
          executeSuperAttack(matchedSuper, startCoord);
          recentPinchesRef.current = [];
          return;
        }
      }

      // Register this hit for 2-hand window
      recentPinchesRef.current.push({ instrument: instrumentId, time: now, handId: Math.random().toString() });
      if (recentPinchesRef.current.length > 5) recentPinchesRef.current.shift();

      // Check against Current Rhythm Challenge
      const challenge = currentChallengeRef.current;
      const isMatch = challenge && challenge.targetInstrument === instrumentId;

      if (isMatch) {
        // SUCCESSFUL RHYTHM HIT!
        const timeLeftRatio = challengeProgress;
        const isPerfect = timeLeftRatio > 0.45;
        const basePts = challenge.points;
        const hitPts = isPerfect ? basePts + 200 : basePts;

        // Play positive chime
        if (isPerfect) {
          audioEngine.playPerfectSound();
        } else {
          audioEngine.playGreatSound();
        }

        // Monster performs the choreographed dance move!
        if (arenaRef.current) {
          arenaRef.current.setDanceMove(challenge.danceMove, 2.4);
        }

        // Send visual energy projectile to center
        const attackEvent: AttackEvent = {
          id: Math.random().toString(),
          instrumentId,
          startX: startCoord.x,
          startY: startCoord.y,
          targetX: 0.5,
          targetY: 0.5,
          damage: hitPts,
          color: instConfig.color,
          comboCount: statsRef.current.combo,
          timestamp: Date.now()
        };

        if (arenaRef.current) {
          arenaRef.current.fireAttack(attackEvent);
        }

        const nextCombo = statsRef.current.combo + 1;
        const isFever = nextCombo >= 5;
        const multiplier = isFever ? 2.5 : Math.min(nextCombo, 5);
        const totalAddedScore = Math.round(hitPts * multiplier);

        if (isFever && !statsRef.current.feverActive) {
          audioEngine.playFeverSound();
          if (arenaRef.current) {
            arenaRef.current.setDanceMove('fever_dance', 2.8);
          }
          setActivePrompt('🔥 FEVER DANCE ACTIVATED! 2.5X SCORE MULTIPLIER! 🔥');
          setTimeout(() => setActivePrompt(null), 2500);
        }

        setJudgmentFeedback({
          rating: isFever ? 'FEVER' : isPerfect ? 'PERFECT' : 'GREAT',
          scoreAdd: totalAddedScore,
          text: isFever ? `FEVER! +${totalAddedScore}` : isPerfect ? `PERFECT! +${totalAddedScore}` : `GREAT! +${totalAddedScore}`,
          id: Date.now()
        });

        setStats((prev) => {
          const nextScore = prev.score + totalAddedScore;
          return {
            ...prev,
            score: nextScore,
            combo: nextCombo,
            maxCombo: Math.max(prev.maxCombo, nextCombo),
            hits: prev.hits + 1,
            perfectHits: isPerfect ? prev.perfectHits + 1 : prev.perfectHits,
            greatHits: !isPerfect ? prev.greatHits + 1 : prev.greatHits,
            feverActive: isFever,
            rankTitle: calculateRank(nextScore)
          };
        });

        // Increase Super Gauge & Groove Level
        setSuperAttackGauge((prev) => Math.min(100, prev + 15));
        increaseGroove(isFever ? 22 : 16);

        // Advance to next challenge after short musical beat
        setTimeout(() => {
          spawnNextChallenge();
        }, 400);
      } else if (challenge) {
        // Player hit the WRONG instrument
        handleChallengeMiss(`MISSED! REQUIRED: ${INSTRUMENTS[challenge.targetInstrument].name}`);
      } else {
        // Freestyle play outside of active challenge
        const danceMap: Record<InstrumentId, DanceMoveId> = {
          drums: 'drums_stomp',
          guitar: 'guitar_headbang',
          piano: 'piano_sway',
          trumpet: 'trumpet_march',
          violin: 'violin_spin',
          dj: 'dj_bassdrop'
        };

        if (arenaRef.current) {
          arenaRef.current.setDanceMove(danceMap[instrumentId], 2.0);
        }
      }
    },
    [challengeProgress, spawnNextChallenge]
  );

  // ==================== SUPER ATTACK EXECUTION ====================
  const executeSuperAttack = (superId: SuperAttackId, startCoord: { x: number; y: number }) => {
    const config = SUPER_ATTACKS[superId];
    audioEngine.playSuperAttack(superId);
    audioEngine.playFeverSound();
    setSuperAttackGauge((prev) => Math.max(0, prev - 50));

    setSuperAttackNotification(`SUPER DANCE: ${config.name}!`);
    setTimeout(() => setSuperAttackNotification(null), 2500);

    const superDanceMap: Record<SuperAttackId, DanceMoveId> = {
      thunderquake: 'super_thunder',
      sonic_storm: 'super_storm',
      resonance_drop: 'super_drop'
    };

    if (arenaRef.current) {
      arenaRef.current.setDanceMove(superDanceMap[superId], 3.2);
    }

    const attackEvent: AttackEvent = {
      id: Math.random().toString(),
      instrumentId: config.instruments[0],
      isSuperAttack: true,
      superAttackId: superId,
      startX: startCoord.x,
      startY: startCoord.y,
      targetX: 0.5,
      targetY: 0.5,
      damage: 1500,
      color: config.color,
      comboCount: statsRef.current.combo + 3,
      timestamp: Date.now()
    };

    if (arenaRef.current) {
      arenaRef.current.fireAttack(attackEvent);
    }

    const addedScore = 1500 * Math.min(statsRef.current.combo, 5);
    setStats((prev) => {
      const nextScore = prev.score + addedScore;
      return {
        ...prev,
        score: nextScore,
        combo: prev.combo + 3,
        superAttacksUsed: prev.superAttacksUsed + 1,
        feverActive: true,
        rankTitle: calculateRank(nextScore)
      };
    });

    setJudgmentFeedback({
      rating: 'FEVER',
      scoreAdd: addedScore,
      text: `SUPER DANCE! +${addedScore}`,
      id: Date.now()
    });

    increaseGroove(35);

    setTimeout(() => {
      spawnNextChallenge();
    }, 600);
  };

  // ==================== GROOVE PROGRESSION ====================
  const increaseGroove = (amount: number) => {
    setMonster((prev) => {
      const newGroove = Math.min(100, prev.grooveLevel + amount);
      const remainingHealth = Math.max(0, 100 - newGroove);

      if (arenaRef.current) {
        arenaRef.current.setMonsterHealthRatio(remainingHealth / 100);
      }

      if (newGroove >= 100) {
        handleRoutineMastered();
      }

      return {
        ...prev,
        grooveLevel: newGroove,
        currentHealth: remainingHealth
      };
    });
  };

  const handleRoutineMastered = () => {
    audioEngine.playVictoryFanfare();

    if (arenaRef.current) {
      arenaRef.current.playDefeatAnimation();
    }

    setStats((prev) => ({
      ...prev,
      score: prev.score + 3000,
      monstersDefeated: prev.monstersDefeated + 1
    }));

    if (stageRef.current === 'stage_1_beat_eater') {
      setActivePrompt('✨ ROUTINE 1 MASTERED! UNLOCKING CYBER SHUFFLE! ✨');
      setTimeout(() => {
        transitionToStage('stage_2_rhythm_breaker');
      }, 1600);
    } else if (stageRef.current === 'stage_2_rhythm_breaker') {
      setActivePrompt('✨ ROUTINE 2 MASTERED! UNLOCKING HYPER-BEAT FINALE! ✨');
      setTimeout(() => {
        transitionToStage('stage_3_music_destroyer');
      }, 1600);
    } else if (stageRef.current === 'stage_3_music_destroyer') {
      setActivePrompt('👑 ULTIMATE DANCE VICTORY! ARENA CHAMPION! 👑');
      setTimeout(() => {
        triggerVictory();
      }, 2000);
    }
  };

  const transitionToStage = (nextStage: GameStage) => {
    setStage(nextStage);
    stageRef.current = nextStage;

    if (nextStage === 'stage_2_rhythm_breaker') {
      setMonster({
        name: 'THE CYBER SHUFFLER',
        title: 'Shielded Groove Titan',
        maxHealth: 100,
        currentHealth: 100,
        grooveLevel: 0,
        activeDanceMove: 'idle',
        danceMoveTimer: 0,
        shieldActive: true,
        phase: 2,
        isStunned: false,
        hitReactionTime: 0
      });
      if (arenaRef.current) {
        arenaRef.current.setStage('stage_2_rhythm_breaker');
        arenaRef.current.setMonsterHealthRatio(1.0);
      }
      setActivePrompt('ROUTINE 2: CYBER SHUFFLE! FASTER BEATS & SHIELD SYNCS!');
      setTimeout(() => {
        setActivePrompt(null);
        spawnNextChallenge();
      }, 2000);
    } else if (nextStage === 'stage_3_music_destroyer') {
      setMonster({
        name: 'THE HYPER-BEAT TITAN',
        title: 'Final Boss of the Dance Arena',
        maxHealth: 100,
        currentHealth: 100,
        grooveLevel: 0,
        activeDanceMove: 'idle',
        danceMoveTimer: 0,
        shieldActive: false,
        phase: 3,
        isStunned: false,
        hitReactionTime: 0
      });
      if (arenaRef.current) {
        arenaRef.current.setStage('stage_3_music_destroyer');
        arenaRef.current.setMonsterHealthRatio(1.0);
      }
      setSuperAttackGauge(100); // instant super readiness for finale!
      setActivePrompt('ROUTINE 3: HYPER-BEAT CLIMAX! PINCH 2 HANDS FOR SUPER DANCES!');
      setTimeout(() => {
        setActivePrompt(null);
        spawnNextChallenge();
      }, 2500);
    }
  };

  const triggerVictory = () => {
    setStage('victory');
    audioEngine.stopBattleMusic();
    audioEngine.playVictoryFanfare();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
  };

  const triggerGameOver = () => {
    setStage('game_over');
    audioEngine.stopBattleMusic();
    audioEngine.playGameOver();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
  };

  // ==================== ROUND COUNTDOWN TIMER ====================
  const startGame = () => {
    audioEngine.ensureContext();
    audioEngine.startBattleMusic();

    setStage('stage_1_beat_eater');
    stageRef.current = 'stage_1_beat_eater';

    setStats({
      score: 0,
      combo: 1,
      maxCombo: 1,
      hits: 0,
      superAttacksUsed: 0,
      monstersDefeated: 0,
      timeRemaining: TOTAL_GAME_TIME,
      rankTitle: 'Rhythm Rookie',
      perfectHits: 0,
      greatHits: 0,
      missCount: 0,
      feverActive: false
    });

    setMonster({
      name: 'THE BEAT EATER',
      title: 'Star Dancer of the Arena',
      maxHealth: 100,
      currentHealth: 100,
      grooveLevel: 0,
      activeDanceMove: 'idle',
      danceMoveTimer: 0,
      shieldActive: false,
      phase: 1,
      isStunned: false,
      hitReactionTime: 0
    });

    setSuperAttackGauge(30);

    if (arenaRef.current) {
      arenaRef.current.setStage('stage_1_beat_eater');
      arenaRef.current.setMonsterHealthRatio(1.0);
    }

    // 3-Second "GET READY" Grace Period: Timer stays paused, no penalties
    setActivePrompt('GET READY... 3');
    setTimeout(() => setActivePrompt('GET READY... 2'), 1000);
    setTimeout(() => setActivePrompt('GET READY... 1'), 2000);
    setTimeout(() => {
      setActivePrompt('GROOVE! FOLLOW THE CHALLENGES!');
      setTimeout(() => setActivePrompt(null), 2500);

      // Spawn first challenge after player is ready
      spawnNextChallenge();

      // Start the round timer ONLY after the countdown finishes
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        if (isPausedRef.current) return;
        setStats((prev) => {
          if (prev.timeRemaining <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            triggerGameOver();
            return { ...prev, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    }, 3000);
  };

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      const now = performance.now();
      if (next) {
        pausedChallengeTimeLeftRef.current = Math.max(0, challengeEndTimeRef.current - now);
        audioEngine.stopBattleMusic();
      } else {
        challengeEndTimeRef.current = now + (pausedChallengeTimeLeftRef.current || 2000);
        audioEngine.startBattleMusic();
      }
      return next;
    });
  }, []);

  const resetGame = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
    audioEngine.stopBattleMusic();
    setIsPaused(false);
    isPausedRef.current = false;
    startGame();
  };

  // ==================== HAND TRACKING HOOKUP ====================
  const handleHandsUpdate = useCallback(
    (hands: TrackedHand[]) => {
      if (
        stageRef.current === 'start_screen' ||
        stageRef.current === 'victory' ||
        stageRef.current === 'game_over'
      ) {
        return;
      }

      // Forward hand position to arena for realistic creature head & eye tracking
      if (hands.length > 0 && arenaRef.current) {
        arenaRef.current.setTargetPointer(hands[0].indexTip.x, hands[0].indexTip.y);
      }

      if (isPausedRef.current) return;

      // Process pinches
      for (const hand of hands) {
        if (hand.isPinching && hand.hoveredInstrument) {
          const variation = Math.max(0, Math.min(1, hand.indexTip.y));
          triggerAttack(hand.hoveredInstrument, variation, {
            x: hand.indexTip.x,
            y: hand.indexTip.y
          });
        }
      }
    },
    [triggerAttack]
  );

  // Set target pointer directly (for mouse tracking fallback)
  const setPointerTarget = useCallback((x: number, y: number) => {
    if (arenaRef.current) {
      arenaRef.current.setTargetPointer(x, y);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
      audioEngine.cleanup();
    };
  }, []);

  return {
    stage,
    stats,
    monster,
    currentChallenge,
    challengeProgress,
    judgmentFeedback,
    superAttackGauge,
    superAttackNotification,
    activePrompt,
    isPaused,
    togglePause,
    setPointerTarget,
    attachArena,
    startGame,
    resetGame,
    triggerAttack,
    handleHandsUpdate
  };
}
