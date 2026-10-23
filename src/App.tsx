import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameArena, GraphicsQuality } from './three/GameArena';
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
import { handTracker, TrackingStateInfo } from './vision/HandTracker';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<GameArena | null>(null);

  // Modal and layout states
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showSuperGuide, setShowSuperGuide] = useState<boolean>(false);
  const [showCalibration, setShowCalibration] = useState<boolean>(false);
  const [isCameraVisible, setIsCameraVisible] = useState<boolean>(true);
  const [reducedEffects, setReducedEffects] = useState<boolean>(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('AUTO');
  const graphicsQualityRef = useRef(graphicsQuality);
  graphicsQualityRef.current = graphicsQuality;
  const reducedEffectsRef = useRef(reducedEffects);
  reducedEffectsRef.current = reducedEffects;
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [performanceInfo, setPerformanceInfo] = useState({
    fps: 0,
    frameTimeMs: 0,
    activeParticles: 0,
    quality: 'HIGH',
    qualityMode: 'AUTO',
    processing: false,
    detectionMs: 0,
    frequencyHz: 30
  });
  const [currentHands, setCurrentHands] = useState<TrackedHand[]>([]);
  const lastHandsUiUpdateRef = useRef(0);
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

    let isDisposed = false;
    let arena: GameArena | null = null;

    import('./three/GameArena').then(({ GameArena: GameArenaClass }) => {
      if (isDisposed || !canvasMountRef.current) return;
      arena = new GameArenaClass(canvasMountRef.current);
      arenaRef.current = arena;
      arena.setGraphicsQuality(graphicsQualityRef.current);
      arena.setReducedEffects(reducedEffectsRef.current);
      attachArena(arena);
    }).catch((error: unknown) => {
      console.error('[AIRBEAT AI] Failed to load the 3D arena:', error);
    });

    return () => {
      isDisposed = true;
      arena?.dispose();
      if (arenaRef.current === arena) arenaRef.current = null;
    };
  }, [attachArena]);

  useEffect(() => {
    arenaRef.current?.setReducedEffects(reducedEffects);
  }, [reducedEffects]);

  useEffect(() => {
    if (!showPerformancePanel) return;
    const updatePerformanceInfo = () => {
      const arenaInfo = arenaRef.current?.getPerformanceInfo();
      const trackerInfo = handTracker.getPerformanceMetrics();
      setPerformanceInfo({
        fps: arenaInfo?.fps ?? 0,
        frameTimeMs: arenaInfo?.frameTimeMs ?? 0,
        activeParticles: arenaInfo?.activeParticles ?? 0,
        quality: arenaInfo?.quality ?? 'HIGH',
        qualityMode: arenaInfo?.qualityMode ?? graphicsQuality,
        processing: trackerInfo.isProcessing,
        detectionMs: trackerInfo.detectionDurationMs,
        frequencyHz: trackerInfo.frequencyHz
      });
    };
    updatePerformanceInfo();
    const intervalId = window.setInterval(updatePerformanceInfo, 500);
    return () => window.clearInterval(intervalId);
  }, [showPerformancePanel, graphicsQuality]);

  const handleGraphicsQualityChange = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    arenaRef.current?.setGraphicsQuality(quality);
  };

  const handleQualitySelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const quality = event.target.value;
    if (quality === 'AUTO' || quality === 'HIGH' || quality === 'MEDIUM' || quality === 'LOW') {
      handleGraphicsQualityChange(quality);
    }
  };

  useEffect(() => {
    const handlePerformanceShortcut = (event: KeyboardEvent) => {
      if (event.key === 'F3') {
        event.preventDefault();
        setShowPerformancePanel((visible) => !visible);
      }
    };
    window.addEventListener('keydown', handlePerformanceShortcut);
    return () => window.removeEventListener('keydown', handlePerformanceShortcut);
  }, []);

  // Handle incoming hand detection updates from CameraHandView
  const handleHandsDetected = useCallback((hands: TrackedHand[]) => {
    handleHandsUpdate(hands);
    const now = performance.now();
    const hasGesture = hands.some((hand) => hand.isTriggering);
    if (hasGesture || now - lastHandsUiUpdateRef.current >= 33) {
      lastHandsUiUpdateRef.current = now;
      setCurrentHands(hands);
    }
  }, [handleHandsUpdate]);

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

      <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-2">
        {showPerformancePanel && (
          <section className="w-64 rounded-xl border border-cyan-400/30 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold tracking-wide text-cyan-300">PERFORMANCE</h2>
              <label className="flex items-center gap-2 text-slate-400">
                Quality
                <select
                  value={graphicsQuality}
                  onChange={handleQualitySelect}
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-100"
                  aria-label="Graphics quality"
                >
                  <option value="AUTO">AUTO</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-slate-400">FPS</span>
              <span>{performanceInfo.fps || 'Measuring...'}</span>
              <span className="text-slate-400">Frame time</span>
              <span>{performanceInfo.frameTimeMs.toFixed(1)} ms</span>
              <span className="text-slate-400">Webcam</span>
              <span>{isCameraActive ? 'Active' : 'Inactive'}</span>
              <span className="text-slate-400">Graphics mode</span>
              <span>{performanceInfo.quality} ({performanceInfo.qualityMode})</span>
              <span className="text-slate-400">Active particles</span>
              <span>{performanceInfo.activeParticles}</span>
              <span className="text-slate-400">Hand tracking</span>
              <span>{trackingState.isReady ? 'Ready' : 'Inactive'}</span>
              <span className="text-slate-400">Detection</span>
              <span>{performanceInfo.processing ? 'Processing' : 'Idle'}</span>
              <span className="text-slate-400">Last inference</span>
              <span>{performanceInfo.detectionMs.toFixed(1)} ms</span>
              <span className="text-slate-400">Target rate</span>
              <span>{performanceInfo.frequencyHz} Hz</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Press F3 to close</p>
          </section>
        )}
      </div>

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
        onCameraStatusChange={setIsCameraActive}
        onTrackingStateChange={setTrackingState}
        isVisible={isCameraVisible}
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
          reducedEffects={reducedEffects}
          onToggleReducedEffects={() => setReducedEffects((prev) => !prev)}
        />
      )}

      {/* 7. Start Screen */}
      {stage === 'start_screen' && (
        <StartScreen
          onStart={startGame}
          onOpenCalibration={() => setShowCalibration(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          onOpenSuperGuide={() => setShowSuperGuide(true)}
          trackingInfo={trackingState}
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
