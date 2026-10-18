import React, { useEffect, useRef, useState } from 'react';
import { GameArena } from './three/GameArena';
import { useGameEngine } from './game/useGameEngine';
import { CameraHandView } from './components/CameraHandView';
import { InstrumentPads } from './components/InstrumentPads';
import { TopHUD } from './components/TopHUD';
import { BottomDock } from './components/BottomDock';
import { HandCursorOverlay } from './components/HandCursorOverlay';
import { CalibrationModal } from './components/CalibrationModal';
import {
  GameOverScreen,
  HowToPlayModal,
  StartScreen,
  SuperAttackGuideModal,
  VictoryScreen
} from './components/ModalsAndScreens';
import { InstrumentId, TrackedHand } from './types/game';
import { TrackingStateInfo } from './vision/HandTracker';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<GameArena | null>(null);

  // Modal and layout states
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showSuperGuide, setShowSuperGuide] = useState<boolean>(false);
  const [showCalibration, setShowCalibration] = useState<boolean>(false);
  const [isCameraVisible, setIsCameraVisible] = useState<boolean>(true);
  const [currentHands, setCurrentHands] = useState<TrackedHand[]>([]);
  const [trackingState, setTrackingState] = useState<TrackingStateInfo>({
    status: 'initializing_camera',
    statusText: 'Initializing Camera...',
    isReady: false,
    handsCount: 0,
    isPinching: false
  });

  // Core Game Engine
  const {
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
  } = useGameEngine();

  // Initialize Three.js Arena on mount
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const arena = new GameArena(canvasMountRef.current);
    arenaRef.current = arena;
    attachArena(arena);

    return () => {
      arena.dispose();
      arenaRef.current = null;
    };
  }, [attachArena]);

  // Handle incoming hand detection updates from CameraHandView
  const handleHandsDetected = (hands: TrackedHand[]) => {
    setCurrentHands(hands);
    handleHandsUpdate(hands);
  };

  // Mouse move pointer fallback for realistic creature head & eye tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (currentHands.length === 0) {
        setPointerTarget(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [currentHands.length, setPointerTarget]);

  // Keyboard shortcut fallback for testing / accessibility (1-6 for instruments, Space/Esc for pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stage === 'start_screen' || stage === 'victory' || stage === 'game_over') return;

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      const keyMap: Record<string, InstrumentId> = {
        '1': 'drums',
        '2': 'guitar',
        '3': 'piano',
        '4': 'trumpet',
        '5': 'violin',
        '6': 'dj'
      };

      if (keyMap[e.key]) {
        triggerAttack(keyMap[e.key], 0.5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, triggerAttack, togglePause]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans text-slate-100">
      {/* 1. Dedicated Three.js WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-0 w-full h-full pointer-events-none"
      />

      {/* 2. Real-time Hand Targeting Cursor Overlay (Zero React Tree overhead) */}
      <HandCursorOverlay hands={currentHands} isPinching={trackingState.isPinching} />

      {/* 3. Top HUD: Score, Monster Groove Bar, Timer, Rhythm Challenge Banner & Pause */}
      {stage !== 'start_screen' && (
        <TopHUD
          stats={stats}
          monster={monster}
          currentChallenge={currentChallenge}
          challengeProgress={challengeProgress}
          judgmentFeedback={judgmentFeedback}
          superAttackGauge={superAttackGauge}
          activePrompt={activePrompt}
          superAttackNotification={superAttackNotification}
          isPaused={isPaused}
          onTogglePause={togglePause}
          onRestart={resetGame}
        />
      )}

      {/* 4. Live Webcam & Real-time Hand Landmark Overlay (PiP in bottom-left corner) */}
      <CameraHandView
        onHandsDetected={handleHandsDetected}
        onTrackingStateChange={setTrackingState}
        isVisible={isCameraVisible && stage !== 'start_screen'}
        onToggleVisible={() => setIsCameraVisible((prev) => !prev)}
      />

      {/* 5. Six Holographic Virtual Instrument Pads */}
      {stage !== 'start_screen' && (
        <InstrumentPads
          hands={currentHands}
          onActivateInstrument={(id, variation) => triggerAttack(id, variation ?? 0.5)}
          requiredInstrument={currentChallenge?.targetInstrument || monster.weakness}
        />
      )}

      {/* 6. Collapsible Bottom Dock Controls */}
      {stage !== 'start_screen' && (
        <BottomDock
          onToggleHowToPlay={() => setShowHowToPlay(true)}
          onToggleSuperGuide={() => setShowSuperGuide(true)}
          onOpenCalibration={() => setShowCalibration(true)}
          isCameraVisible={isCameraVisible}
          onToggleCameraVisible={() => setIsCameraVisible((prev) => !prev)}
        />
      )}

      {/* 7. Start Screen */}
      {stage === 'start_screen' && (
        <StartScreen
          onStart={startGame}
          onOpenCalibration={() => setShowCalibration(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          onOpenSuperGuide={() => setShowSuperGuide(true)}
        />
      )}

      {/* 8. Victory Screen */}
      {stage === 'victory' && (
        <VictoryScreen stats={stats} onReplay={resetGame} />
      )}

      {/* 9. Game Over Screen */}
      {stage === 'game_over' && (
        <GameOverScreen stats={stats} onReplay={resetGame} />
      )}

      {/* 10. Modals */}
      {showCalibration && (
        <CalibrationModal
          trackingInfo={trackingState}
          hands={currentHands}
          onStartGame={startGame}
          onClose={() => setShowCalibration(false)}
        />
      )}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showSuperGuide && <SuperAttackGuideModal onClose={() => setShowSuperGuide(false)} />}
    </div>
  );
}
