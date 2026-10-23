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
import { GAME_CONFIG } from './gameConfig';

const TOTAL_GAME_TIME = GAME_CONFIG.durationSeconds;

// Rhythm Challenges Choreography Pools (Snappy fast-paced arcade challenges)
const CHOREOGRAPHY_ROUTINES: Record<string, Omit<RhythmChallenge, 'id'>[]> = {
  stage_1: [
    {
      instruction: 'HIT THE DRUMS TO STOMP THE BEAT!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Rhythmic Stomp',
      points: 500,
      timeLimit: 3.2
    },
    {
      instruction: 'SHRED THE GUITAR FOR A ROCK HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Rock Headbang',
      points: 500,
      timeLimit: 3.2
    },
    {
      instruction: 'PLAY THE PIANO FOR A GRACEFUL SWAY!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Piano Sway',
      points: 500,
      timeLimit: 3.2
    },
    {
      instruction: 'BLOW THE TRUMPET FOR A BRASS STRUT!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Fanfare March',
      points: 500,
      timeLimit: 3.2
    },
    {
      instruction: 'BOW THE VIOLIN FOR A 360 PIRUETTE!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Violin Pirouette',
      points: 500,
      timeLimit: 3.2
    },
    {
      instruction: 'DROP THE BASS TO BREAKDANCE!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Breakdance Drop',
      points: 500,
      timeLimit: 3.2
    }
  ],
  stage_2: [
    {
      instruction: 'DRUM SHUFFLE: DOUBLE STOMP THE CYBER BEAT!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Cyber Stomp',
      points: 600,
      timeLimit: 2.4
    },
    {
      instruction: 'SYNTH DROP: POP & BREAKDANCE!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Electro Pop',
      points: 600,
      timeLimit: 2.4
    },
    {
      instruction: 'GUITAR SOLO: POWER HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Power Riff',
      points: 600,
      timeLimit: 2.4
    },
    {
      instruction: 'VIOLIN WHIRL: GLIDING SPINS!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Gliding Spin',
      points: 600,
      timeLimit: 2.4
    },
    {
      instruction: 'PIANO CASCADE: FLUID FOOTWORK!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Fluid Footwork',
      points: 600,
      timeLimit: 2.4
    },
    {
      instruction: 'BRASS POP: TRIUMPHANT FANFARE!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Triumphant March',
      points: 600,
      timeLimit: 2.4
    }
  ],
  stage_3: [
    {
      instruction: 'HYPER BASS DROP: BREAKDANCE CLIMAX!',
      targetInstrument: 'dj',
      danceMove: 'dj_bassdrop',
      actionName: 'Hyper Drop',
      points: 800,
      timeLimit: 1.8
    },
    {
      instruction: 'THUNDER DRUMS: SEISMIC DOUBLE STOMP!',
      targetInstrument: 'drums',
      danceMove: 'drums_stomp',
      actionName: 'Thunder Stomp',
      points: 800,
      timeLimit: 1.8
    },
    {
      instruction: 'ROCK OVERDRIVE: WILD HEADBANG!',
      targetInstrument: 'guitar',
      danceMove: 'guitar_headbang',
      actionName: 'Overdrive Riff',
      points: 800,
      timeLimit: 1.8
    },
    {
      instruction: 'ROYAL TRUMPET: FANFARE CHEST POP!',
      targetInstrument: 'trumpet',
      danceMove: 'trumpet_march',
      actionName: 'Chest Pop Strut',
      points: 800,
      timeLimit: 1.8
    },
    {
      instruction: 'COSMIC VIOLIN: ULTRA PIRUETTE!',
      targetInstrument: 'violin',
      danceMove: 'violin_spin',
      actionName: 'Cosmic Pirouette',
      points: 800,
      timeLimit: 1.8
    },
    {
      instruction: 'PIANO GLIDE: MASTER KEY RIFF!',
      targetInstrument: 'piano',
      danceMove: 'piano_sway',
      actionName: 'Master Riff',
      points: 800,
      timeLimit: 1.8
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

  const [superAttackGauge, setSuperAttackGauge] = useState<number>(GAME_CONFIG.superGaugeStart); // 0..100
  const [superAttackNotification, setSuperAttackNotification] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // References to avoid stale closures in high-frequency callbacks
  const arenaRef = useRef<GameArena | null>(null);
  const stageRef = useRef<GameStage>(stage);
  const monsterRef = useRef<MonsterState>(monster);
  const statsRef = useRef<GameStats>(stats);
  const comboRef = useRef<number>(stats.combo);
  const superGaugeRef = useRef<number>(superAttackGauge);
  const currentChallengeRef = useRef<RhythmChallenge | null>(null);
  const challengeEndTimeRef = useRef<number>(0);
  const challengeDurationRef = useRef<number>(4.0);
  const isPausedRef = useRef<boolean>(false);
  const pausedChallengeTimeLeftRef = useRef<number>(0);

  // Intervals & Timers
  const timerIntervalRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef<number>(0);
  const pausedRoundTimeLeftRef = useRef<number>(0);
  const roundIsTerminalRef = useRef(false);
  const roundGenerationRef = useRef(0);
  const startSequenceTimeoutsRef = useRef<number[]>([]);
  const challengeTickRef = useRef<number | null>(null);
  const finalVictoryTimeoutsRef = useRef<number[]>([]);
  const defeatedPhaseRef = useRef<number>(0);
  const isDefeatSequenceRef = useRef<boolean>(false);

  // Two-hand pinch memory
  const recentPinchesRef = useRef<{ instrument: InstrumentId; time: number; handId: string }[]>([]);

  const scheduleRoundTimeout = useCallback((callback: () => void, delay: number) => {
    const generation = roundGenerationRef.current;
    return window.setTimeout(() => {
      if (
        generation !== roundGenerationRef.current ||
        roundIsTerminalRef.current ||
        isDefeatSequenceRef.current
      ) {
        return;
      }
      callback();
    }, delay);
  }, []);

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
    arena.setImpactCallback((isSuperAttack, instrumentId, comboCount, judgment) =>
      audioEngine.playMonsterHitSound(isSuperAttack, instrumentId, comboCount, judgment)
    );
  }, []);

  useEffect(() => {
    if (!judgmentFeedback) return;
    const timeoutId = window.setTimeout(
      () => setJudgmentFeedback(null),
      GAME_CONFIG.comboFeedbackDurationMs
    );
    return () => clearTimeout(timeoutId);
  }, [judgmentFeedback]);

  // Update Rank Title helper
  const calculateRank = (score: number): string => {
    if (score >= 16000) return 'Legendary Dance Master';
    if (score >= 10000) return 'Sonic Superstar';
    if (score >= 5000) return 'Beat Warrior';
    return 'Rhythm Rookie';
  };

  const dispatchInstrumentAttack = useCallback(
    (
      instrumentId: InstrumentId,
      startCoord: { x: number; y: number },
      damage: number,
      comboCount: number,
      judgment?: 'perfect' | 'great'
    ) => {
      const arena = arenaRef.current;
      if (!arena) return;

      audioEngine.playAttackLaunch(instrumentId, comboCount);
      const config = INSTRUMENTS[instrumentId];
      arena.triggerMonsterHitReaction(
        parseInt(config.color.replace('#', '0x'), 16),
        damage,
        instrumentId
      );
      arena.fireAttack({
        id: Math.random().toString(),
        instrumentId,
        startX: startCoord.x,
        startY: startCoord.y,
        targetX: 0.5,
        targetY: 0.5,
        damage,
        color: config.color,
        comboCount,
        judgment,
        timestamp: Date.now()
      });
    },
    []
  );

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
        // TIME OUT: Counted as a missed beat - handleChallengeMiss clears currentChallengeRef so this ONLY fires once!
        handleChallengeMiss('TOO SLOW');
      } else {
        setChallengeProgress(Math.max(0, Math.min(1, timeLeft / totalTime)));
      }
    }, 50);

    return () => {
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
    };
  }, [stage]);

  // Handle Miss / Stumble - Deduct points and trigger monster deflection
  const handleChallengeMiss = (reason: string = 'TOO SLOW') => {
    // 1. Immediately invalidate current challenge to prevent 50ms interval from repeatedly firing!
    currentChallengeRef.current = null;
    comboRef.current = 1;
    setCurrentChallenge(null);
    setChallengeProgress(0);

    audioEngine.playMissSound();

    if (arenaRef.current) {
      arenaRef.current.triggerMonsterDeflect();
    }

    setJudgmentFeedback({
      rating: 'MISS',
      scoreAdd: 0,
      text: `⏱️ ${reason}!`,
      id: Date.now()
    });

    setStats((prev) => {
      return {
        ...prev,
        combo: 1,
        feverActive: false,
        missCount: prev.missCount + 1
      };
    });

    setMonster((prev) => ({
      ...prev,
      grooveLevel: Math.max(0, prev.grooveLevel - 2)
    }));

    // Spawn next challenge cleanly
    scheduleRoundTimeout(() => {
      spawnNextChallenge();
    }, GAME_CONFIG.missChallengeDelayMs);
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

      if (
        isPausedRef.current ||
        statsRef.current.timeRemaining <= 0 ||
        roundDeadlineRef.current <= performance.now() ||
        isDefeatSequenceRef.current
      ) return;

      const instConfig = INSTRUMENTS[instrumentId];
      const startCoord = customStart || instConfig.position;

      // 1. Play instrument sound immediately (zero latency)
      // Check Two-Hand Super Attack
      const now = performance.now();
      const pinches = recentPinchesRef.current.filter((p) => now - p.time < 350);
      const otherPinch = pinches.find((p) => p.instrument !== instrumentId);

      if (otherPinch && superGaugeRef.current >= GAME_CONFIG.superGaugeReady) {
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

      audioEngine.playInstrument(instrumentId, handVariation);

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

        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        audioEngine.setComboIntensity(nextCombo);
        audioEngine.playComboAccent(nextCombo);

        dispatchInstrumentAttack(
          instrumentId,
          startCoord,
          hitPts + Math.min(nextCombo, 8) * 90,
          nextCombo,
          isPerfect ? 'perfect' : 'great'
        );

        const isFever = nextCombo >= 5;
        const multiplier = isFever ? 2.5 : Math.min(nextCombo, 5);
        const totalAddedScore = Math.round(hitPts * multiplier);

        if (isFever && !statsRef.current.feverActive) {
          audioEngine.playFeverSound();
          setActivePrompt('🔥 FEVER DANCE ACTIVATED! 2.5X SCORE MULTIPLIER! 🔥');
          scheduleRoundTimeout(() => setActivePrompt(null), 2000);
        }

        setJudgmentFeedback({
          rating: isFever ? 'FEVER' : isPerfect ? 'PERFECT' : 'GREAT',
          scoreAdd: totalAddedScore,
          text: isFever
            ? `🔥 FEVER! +${totalAddedScore} PTS`
            : isPerfect
            ? `💥 HIT! +${totalAddedScore} PTS`
            : `🎵 HIT! +${totalAddedScore} PTS`,
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
        const nextGauge = Math.min(100, superGaugeRef.current + GAME_CONFIG.superGaugePerHit);
        superGaugeRef.current = nextGauge;
        setSuperAttackGauge(nextGauge);
        increaseGroove(isFever ? 22 : 16);

        // Advance to next challenge quickly for snappy, energetic pacing
        currentChallengeRef.current = null;
        setCurrentChallenge(null);
        scheduleRoundTimeout(() => {
          spawnNextChallenge();
        }, GAME_CONFIG.successChallengeDelayMs);
      } else if (challenge) {
        // Player clicked the WRONG instrument!
        // Immediately consume challenge so no rapid duplicates occur
        currentChallengeRef.current = null;
        setCurrentChallenge(null);
        setChallengeProgress(0);
        comboRef.current = 1;

        const WRONG_PENALTY = 50;
        audioEngine.playMissSound();
        audioEngine.setComboIntensity(1);

        if (arenaRef.current) {
          arenaRef.current.triggerMonsterDeflect();
        }

        // Deduct points, reset combo
        setStats((prev) => {
          const nextScore = Math.max(0, prev.score - WRONG_PENALTY);
          return {
            ...prev,
            score: nextScore,
            combo: 1,
            feverActive: false,
            missCount: prev.missCount + 1,
            rankTitle: calculateRank(nextScore)
          };
        });

        // Reduce monster groove
        setMonster((prev) => ({
          ...prev,
          grooveLevel: Math.max(0, prev.grooveLevel - 2)
        }));

        setJudgmentFeedback({
          rating: 'MISS',
          scoreAdd: -WRONG_PENALTY,
          text: `❌ WRONG BEAT! -${WRONG_PENALTY} PTS`,
          id: Date.now()
        });

        scheduleRoundTimeout(() => {
          spawnNextChallenge();
        }, GAME_CONFIG.missChallengeDelayMs);
      } else {
        // Freestyle play outside of active challenge
        dispatchInstrumentAttack(instrumentId, startCoord, 100, comboRef.current);
        increaseGroove(8);
      }
    },
    [challengeProgress, dispatchInstrumentAttack, scheduleRoundTimeout, spawnNextChallenge]
  );

  // ==================== SUPER ATTACK EXECUTION ====================
  const executeSuperAttack = (superId: SuperAttackId, startCoord: { x: number; y: number }) => {
    const config = SUPER_ATTACKS[superId];
    audioEngine.playSuperAttack(superId);
    audioEngine.playFeverSound();
    const nextGauge = Math.max(0, superGaugeRef.current - 50);
    superGaugeRef.current = nextGauge;
    setSuperAttackGauge(nextGauge);

    setSuperAttackNotification(`SUPER ATTACK! ${config.name}`);
    scheduleRoundTimeout(
      () => setSuperAttackNotification(null),
      GAME_CONFIG.comboFeedbackDurationMs * 2
    );

    const superDanceMap: Record<SuperAttackId, DanceMoveId> = {
      thunderquake: 'super_thunder',
      sonic_storm: 'super_storm',
      resonance_drop: 'super_drop'
    };

    if (arenaRef.current) {
      arenaRef.current.triggerMonsterHitReaction(
        parseInt(config.color.replace('#', '0x'), 16),
        1500,
        config.instruments[0]
      );
      arenaRef.current.setDanceMove(superDanceMap[superId], 3.2);
    }
    const nextCombo = comboRef.current + 3;
    comboRef.current = nextCombo;
    audioEngine.setComboIntensity(nextCombo);
    audioEngine.playComboAccent(nextCombo);

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
      comboCount: nextCombo,
      timestamp: Date.now()
    };

    if (arenaRef.current) {
      arenaRef.current.fireAttack(attackEvent);
    }

    const addedScore = 1500 * Math.min(nextCombo - 3, 5);
    setStats((prev) => {
      const nextScore = prev.score + addedScore;
      return {
        ...prev,
        score: nextScore,
        combo: nextCombo,
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

    scheduleRoundTimeout(() => {
      spawnNextChallenge();
    }, GAME_CONFIG.superChallengeDelayMs);
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
    const phase =
      stageRef.current === 'stage_1_beat_eater' ? 1 :
      stageRef.current === 'stage_2_rhythm_breaker' ? 2 :
      stageRef.current === 'stage_3_music_destroyer' ? 3 : 0;
    if (phase === 0 || defeatedPhaseRef.current >= phase || isDefeatSequenceRef.current) return;
    defeatedPhaseRef.current = phase;

    if (phase < 3) {
      audioEngine.playVictoryFanfare();
      arenaRef.current?.playDefeatAnimation();
    }

    setStats((prev) => ({
      ...prev,
      score: prev.score + 3000,
      monstersDefeated: prev.monstersDefeated + 1
    }));

    if (stageRef.current === 'stage_1_beat_eater') {
      setActivePrompt('✨ ROUTINE 1 MASTERED! UNLOCKING CYBER SHUFFLE! ✨');
      scheduleRoundTimeout(() => {
        transitionToStage('stage_2_rhythm_breaker');
      }, 1600);
    } else if (stageRef.current === 'stage_2_rhythm_breaker') {
      setActivePrompt('✨ ROUTINE 2 MASTERED! UNLOCKING HYPER-BEAT FINALE! ✨');
      scheduleRoundTimeout(() => {
        transitionToStage('stage_3_music_destroyer');
      }, 1600);
    } else if (stageRef.current === 'stage_3_music_destroyer') {
      isDefeatSequenceRef.current = true;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
      setActivePrompt('FINAL HIT!');

      const beginDestruction = window.setTimeout(() => {
        audioEngine.stopBattleMusic();
        audioEngine.playMonsterDefeat();
        arenaRef.current?.playFinalDefeatAnimation();

        const showDestroyedMessage = window.setTimeout(() => {
          setActivePrompt('MONSTER DESTROYED!');
        }, 1700);
        const showVictoryMessage = window.setTimeout(() => {
          setActivePrompt('VICTORY!');
        }, 2550);
        const finishVictory = window.setTimeout(() => {
          setActivePrompt(null);
          triggerVictory();
        }, 3450);
        finalVictoryTimeoutsRef.current.push(showDestroyedMessage, showVictoryMessage, finishVictory);
      }, 380);
      finalVictoryTimeoutsRef.current.push(beginDestruction);
    } else {
      arenaRef.current?.playDefeatAnimation();
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
      scheduleRoundTimeout(() => {
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
      superGaugeRef.current = 100;
      setSuperAttackGauge(100); // instant super readiness for finale!
      setActivePrompt('ROUTINE 3: HYPER-BEAT CLIMAX! PINCH 2 HANDS FOR SUPER DANCES!');
      scheduleRoundTimeout(() => {
        setActivePrompt(null);
        spawnNextChallenge();
      }, 2500);
    }
  };

  const triggerVictory = () => {
    if (roundIsTerminalRef.current) return;
    roundIsTerminalRef.current = true;
    roundGenerationRef.current += 1;
    isDefeatSequenceRef.current = true;
    setStage('victory');
    stageRef.current = 'victory';
    audioEngine.stopBattleMusic();
    audioEngine.playVictoryFanfare();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
  };

  const triggerGameOver = () => {
    if (roundIsTerminalRef.current) return;
    roundIsTerminalRef.current = true;
    roundGenerationRef.current += 1;
    stageRef.current = 'game_over';
    setStage('game_over');
    setStats((prev) => ({ ...prev, timeRemaining: 0 }));
    audioEngine.stopBattleMusic();
    audioEngine.playGameOver();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
    startSequenceTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    startSequenceTimeoutsRef.current = [];
  };

  // ==================== ROUND COUNTDOWN TIMER ====================
  const startGame = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    startSequenceTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    startSequenceTimeoutsRef.current = [];
    if (challengeTickRef.current) clearInterval(challengeTickRef.current);
    roundGenerationRef.current += 1;
    const roundGeneration = roundGenerationRef.current;
    roundIsTerminalRef.current = false;
    pausedRoundTimeLeftRef.current = 0;
    roundDeadlineRef.current = performance.now() + TOTAL_GAME_TIME * 1000;
    isPausedRef.current = false;
    setIsPaused(false);
    finalVictoryTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    finalVictoryTimeoutsRef.current = [];
    defeatedPhaseRef.current = 0;
    isDefeatSequenceRef.current = false;
    currentChallengeRef.current = null;
    recentPinchesRef.current = [];
    setCurrentChallenge(null);
    setChallengeProgress(1);
    audioEngine.setComboIntensity(1);
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
    comboRef.current = 1;
    superGaugeRef.current = GAME_CONFIG.superGaugeStart;

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

    setSuperAttackGauge(GAME_CONFIG.superGaugeStart);
    setJudgmentFeedback(null);
    setSuperAttackNotification(null);

    if (arenaRef.current) {
      arenaRef.current.setStage('stage_1_beat_eater');
      arenaRef.current.setMonsterHealthRatio(1.0);
    }

    const scheduleStartSequence = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(() => {
        startSequenceTimeoutsRef.current = startSequenceTimeoutsRef.current.filter(
          (activeTimeoutId) => activeTimeoutId !== timeoutId
        );
        if (
          roundGenerationRef.current !== roundGeneration ||
          roundIsTerminalRef.current
        ) {
          return;
        }
        callback();
      }, delay);
      startSequenceTimeoutsRef.current.push(timeoutId);
    };

    // Start the 60-second clock immediately; the ready prompt remains a short overlay.
    setActivePrompt('GET READY... 3');
    scheduleStartSequence(() => setActivePrompt('GET READY... 2'), 1000);
    scheduleStartSequence(() => setActivePrompt('GET READY... 1'), 2000);
    scheduleStartSequence(() => {
      setActivePrompt('GROOVE! FOLLOW THE CHALLENGES!');
      scheduleStartSequence(() => setActivePrompt(null), 2500);

      // Spawn first challenge after player is ready
      spawnNextChallenge();
    }, 3000);

    timerIntervalRef.current = window.setInterval(() => {
      if (
        roundGenerationRef.current !== roundGeneration ||
        roundIsTerminalRef.current ||
        isPausedRef.current
      ) {
        return;
      }

      const secondsRemaining = Math.max(
        0,
        Math.ceil((roundDeadlineRef.current - performance.now()) / 1000)
      );
      setStats((prev) =>
        prev.timeRemaining === secondsRemaining
          ? prev
          : { ...prev, timeRemaining: secondsRemaining }
      );

      if (secondsRemaining === 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        if (!isDefeatSequenceRef.current) triggerGameOver();
      }
    }, 100);
  };

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      const now = performance.now();
      if (next) {
        pausedRoundTimeLeftRef.current = Math.max(0, roundDeadlineRef.current - now);
        pausedChallengeTimeLeftRef.current = Math.max(0, challengeEndTimeRef.current - now);
        audioEngine.stopBattleMusic();
      } else {
        roundDeadlineRef.current = now + pausedRoundTimeLeftRef.current;
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

      // Process hand triggers (single edge trigger only: pinch edge, air-tap, or dwell charge)
      // Strictly prevents repeated activations from a single held pinch
      for (const hand of hands) {
        if (hand.isTriggering && hand.hoveredInstrument) {
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
      roundIsTerminalRef.current = true;
      roundGenerationRef.current += 1;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (challengeTickRef.current) clearInterval(challengeTickRef.current);
      startSequenceTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      finalVictoryTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
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
