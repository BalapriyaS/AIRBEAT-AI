import type { HandLandmarker as HandLandmarkerInstance } from '@mediapipe/tasks-vision';
import { HandPoint, InstrumentId, TrackedHand } from '../types/game';
import { INSTRUMENT_LIST } from '../game/instrumentsConfig';

export type TrackingStatus =
  | 'idle'
  | 'requesting_camera'
  | 'initializing_camera'
  | 'loading_model'
  | 'camera_ready'
  | 'hand_detected'
  | 'no_hand'
  | 'pinch_detected'
  | 'tracking_error'
  | 'waiting_permission'
  | 'camera_unavailable'
  | 'mouse_mode';

export interface TrackingStateInfo {
  status: TrackingStatus;
  statusText: string;
  isReady: boolean;
  handsCount: number;
  isPinching: boolean;
  errorMessage?: string;
}

export class HandTrackerService {
  private handLandmarker: HandLandmarkerInstance | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isModelLoading: boolean = false;
  private isModelReady: boolean = false;
  private modelInitialization: Promise<boolean> | null = null;
  private modelLoadGeneration: number = 0;
  private isProcessingFrame: boolean = false;
  private isTracking: boolean = false;
  private animationFrameId: number | null = null;
  private videoFrameCallbackId: number | null = null;

  private lastVideoTime: number = -1;
  private lastProcessedTimestampMs: number = 0;
  private lastDetectionStartMs: number = 0;
  private detectionFrequencyHz: number = 30;
  private lastDetectionDurationMs: number = 0;
  private lastReportedState: TrackingStateInfo | null = null;
  private gestureCooldownMs: number = 120;

  // Latest tracked hands reference for zero-overhead direct consumers
  public latestHands: TrackedHand[] = [];

  // Smoothing states for hands
  private smoothedHands: Map<
    number,
    { index: HandPoint; thumb: HandPoint; wrist: HandPoint; screenIndex: HandPoint }
  > = new Map();

  // Pinch state machine with scale-invariant ratios & hysteresis
  private pinchStates: Map<
    number,
    {
      isPinching: boolean;
      lastPinchTime: number;
      pinchRatio: number;
    }
  > = new Map();

  // Hover dwell state machine for instant air-tap and charge-up hits
  private hoverDwellStates: Map<
    number,
    {
      instrument: InstrumentId | null;
      startTime: number;
      triggered: boolean;
      lastTriggerTime: number;
    }
  > = new Map();

  // Previous motion history for air-strike velocity detection
  private motionHistory: Map<
    number,
    { x: number; y: number; time: number; speed: number }
  > = new Map();

  // Target stabilization for hovered instrument
  private currentHoveredTarget: InstrumentId | null = null;
  private hoverHoldFrames: number = 0;

  // Student Reach Assist (amplifies webcam center for effortless reach)
  public reachBoost: boolean = true;

  // Callbacks
  private onHandsDetectedCallback: ((hands: TrackedHand[]) => void) | null = null;
  private onStateChangeCallback: ((state: TrackingStateInfo) => void) | null = null;

  public setReachBoost(enabled: boolean) {
    this.reachBoost = enabled;
  }

  public setGestureCooldown(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 80 || milliseconds > 150) {
      throw new RangeError('Gesture cooldown must be between 80 and 150 milliseconds.');
    }
    this.gestureCooldownMs = milliseconds;
  }

  public setDetectionFrequency(frequencyHz: number) {
    if (!Number.isFinite(frequencyHz) || frequencyHz < 1 || frequencyHz > 60) {
      throw new RangeError('Detection frequency must be between 1 and 60 Hz.');
    }
    this.detectionFrequencyHz = frequencyHz;
  }

  public getPerformanceMetrics() {
    return {
      isProcessing: this.isProcessingFrame,
      detectionDurationMs: this.lastDetectionDurationMs,
      frequencyHz: this.detectionFrequencyHz
    };
  }

  public initializeModel(onState?: (state: TrackingStateInfo) => void): Promise<boolean> {
    if (onState) this.onStateChangeCallback = onState;

    if (this.isModelReady && this.handLandmarker) {
      this.reportStatus('camera_ready', 'MODEL READY • SHOW HAND', true);
      return Promise.resolve(true);
    }
    if (this.modelInitialization) return this.modelInitialization;
    this.modelInitialization = this.loadModel().finally(() => {
      this.modelInitialization = null;
    });
    return this.modelInitialization;
  }

  private async loadModel(): Promise<boolean> {
    this.isModelLoading = true;
    this.reportStatus('loading_model', 'INITIALIZING AI SENSOR...', false);

    const loadGeneration = ++this.modelLoadGeneration;
    const isCurrentLoad = () => loadGeneration === this.modelLoadGeneration;
    let initializationStep = 'loading the vision runtime';

    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(
          new Error(
            `Hand-tracking initialization timed out after 45 seconds while ${initializationStep}. Check the connection and retry.`
          )
        ),
        45000
      );
    });

    const initWorker = async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      initializationStep = 'resolving the local vision runtime';

      // 1. Resolve WASM assets: Local bundle first for instant offline exhibition speed, CDN fallback
      const wasmSources = [
        `${window.location.origin}/wasm`,
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
      ];

      let vision = null;
      let lastWasmErr: unknown = null;

      for (const wasmUrl of wasmSources) {
        try {
          console.log('[AIRBEAT AI] Trying WASM source:', wasmUrl);
          vision = await FilesetResolver.forVisionTasks(wasmUrl);
          if (vision) {
            console.log('[AIRBEAT AI] WASM FilesetResolver succeeded with:', wasmUrl);
            break;
          }
        } catch (err) {
          console.warn('[AIRBEAT AI] WASM source failed:', wasmUrl, err);
          lastWasmErr = err;
        }
      }

      if (!vision) {
        throw new Error(`Failed to resolve Vision WASM: ${lastWasmErr}`);
      }

      // 2. Load hand landmark model: Local first (instant), Google storage fallback
      const modelSources = [
        `${window.location.origin}/models/hand_landmarker.task`,
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
      ];
      let lastModelError: unknown = null;

      for (const modelPath of modelSources) {
        if (!isCurrentLoad()) return false;
        initializationStep = `loading the hand model from ${modelPath}`;
        // Try GPU first
        try {
          initializationStep = `initializing the hand model with GPU from ${modelPath}`;
          console.log('[AIRBEAT AI] Initializing HandLandmarker (GPU):', modelPath);
          const detector = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4
          });
          if (!isCurrentLoad()) {
            detector.close();
            return false;
          }
          this.handLandmarker = detector;
          console.log('[AIRBEAT AI] HandLandmarker initialized successfully (GPU)!');
          return true;
        } catch (gpuErr) {
          if (!isCurrentLoad()) return false;
          console.warn('[AIRBEAT AI] GPU delegate failed, trying CPU...', gpuErr);
          // Try CPU fallback
          try {
            initializationStep = `initializing the hand model with CPU from ${modelPath}`;
            console.log('[AIRBEAT AI] Initializing HandLandmarker (CPU):', modelPath);
            const detector = await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: modelPath,
                delegate: 'CPU'
              },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.4,
              minHandPresenceConfidence: 0.4,
              minTrackingConfidence: 0.4
            });
            if (!isCurrentLoad()) {
              detector.close();
              return false;
            }
            this.handLandmarker = detector;
            console.log('[AIRBEAT AI] HandLandmarker initialized successfully (CPU)!');
            return true;
          } catch (cpuErr) {
            if (!isCurrentLoad()) return false;
            lastModelError = cpuErr;
            console.warn('[AIRBEAT AI] CPU delegate failed for', modelPath, cpuErr);
          }
        }
      }

      const detail = lastModelError instanceof Error ? lastModelError.message : String(lastModelError);
      throw new Error(`All hand model sources failed. Last error: ${detail}`);
    };

    try {
      await Promise.race([initWorker(), timeoutPromise]);
      this.isModelReady = true;
      this.isModelLoading = false;
      this.reportStatus('camera_ready', 'MODEL READY • SHOW HAND', true);
      return true;
    } catch (err: unknown) {
      console.error('[AIRBEAT AI] HandLandmarker failed:', err);
      this.isModelLoading = false;
      this.isModelReady = false;
      this.modelLoadGeneration++;
      const errMsg = err instanceof Error ? err.message : 'Model loading error';
      this.reportStatus('tracking_error', 'TRACKING ERROR', false, 0, false, errMsg);
      return false;
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }

  public reportStatus(
    status: TrackingStatus,
    statusText: string,
    isReady: boolean,
    handsCount: number = 0,
    isPinching: boolean = false,
    errorMessage?: string
  ) {
    const nextState: TrackingStateInfo = {
      status,
      statusText,
      isReady,
      handsCount,
      isPinching,
      errorMessage
    };
    const previousState = this.lastReportedState;
    if (
      previousState &&
      previousState.status === nextState.status &&
      previousState.statusText === nextState.statusText &&
      previousState.isReady === nextState.isReady &&
      previousState.handsCount === nextState.handsCount &&
      previousState.isPinching === nextState.isPinching &&
      previousState.errorMessage === nextState.errorMessage
    ) {
      return;
    }
    this.lastReportedState = nextState;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(nextState);
    }
  }

  public setVideoSource(video: HTMLVideoElement) {
    this.videoElement = video;
  }

  public startTracking(onHands: (hands: TrackedHand[]) => void) {
    this.onHandsDetectedCallback = onHands;
    if (this.isTracking) return;
    this.isTracking = true;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.scheduleNextFrame();
  }

  public stopTracking() {
    this.isTracking = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.videoFrameCallbackId !== null) {
      this.videoElement?.cancelVideoFrameCallback?.(this.videoFrameCallbackId);
      this.videoFrameCallbackId = null;
    }
    this.isProcessingFrame = false;
    this.lastDetectionStartMs = 0;
    this.smoothedHands.clear();
    this.pinchStates.clear();
    this.hoverDwellStates.clear();
    this.motionHistory.clear();
    this.currentHoveredTarget = null;
    this.hoverHoldFrames = 0;
    this.lastVideoTime = -1;
    this.latestHands = [];
  }

  private scheduleNextFrame() {
    if (!this.isTracking || document.hidden) return;
    const video = this.videoElement;
    if (video?.requestVideoFrameCallback) {
      this.videoFrameCallbackId = video.requestVideoFrameCallback(() => {
        this.videoFrameCallbackId = null;
        this.processFrame();
        this.scheduleNextFrame();
      });
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.processFrame();
      this.scheduleNextFrame();
    });
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.videoFrameCallbackId !== null) {
        this.videoElement?.cancelVideoFrameCallback?.(this.videoFrameCallbackId);
        this.videoFrameCallbackId = null;
      }
      return;
    }
    this.scheduleNextFrame();
  };

  private processFrame() {
    if (!this.handLandmarker || !this.videoElement || this.isProcessingFrame) {
      return;
    }

    if (this.videoElement.paused && !this.videoElement.ended) {
      this.videoElement.play().catch(() => {});
      return;
    }

    if (
      this.videoElement.readyState < 2 ||
      this.videoElement.videoWidth === 0 ||
      this.videoElement.videoHeight === 0
    ) {
      return;
    }

    if (this.videoElement.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.videoElement.currentTime;

    const nowClock = performance.now();
    if (nowClock - this.lastDetectionStartMs < 1000 / this.detectionFrequencyHz) return;
    this.lastDetectionStartMs = nowClock;

    // Strictly monotonic timestamp required by MediaPipe
    let timestampMs = Math.round(nowClock);
    if (timestampMs <= this.lastProcessedTimestampMs) {
      timestampMs = this.lastProcessedTimestampMs + 1;
    }
    this.lastProcessedTimestampMs = timestampMs;

    this.isProcessingFrame = true;
    const detectionStartedAt = performance.now();

    try {
      const results = this.handLandmarker.detectForVideo(this.videoElement, timestampMs);
      this.lastDetectionDurationMs = performance.now() - detectionStartedAt;
      this.isProcessingFrame = false;

      // Handle no hand detected
      if (!results || !results.landmarks || results.landmarks.length === 0) {
        this.reportStatus('no_hand', 'NO HAND DETECTED', true, 0, false);
        this.smoothedHands.clear();
        this.hoverDwellStates.clear();
        this.motionHistory.clear();
        this.currentHoveredTarget = null;
        this.latestHands = [];
        if (this.onHandsDetectedCallback) {
          this.onHandsDetectedCallback([]);
        }
        return;
      }

      const trackedHands: TrackedHand[] = [];
      let anyPinching = false;

      for (let h = 0; h < results.landmarks.length; h++) {
        const landmarks = results.landmarks[h];
        if (!landmarks || landmarks.length < 21) continue;

        // Key MediaPipe landmark indices:
        // 0: Wrist, 4: Thumb Tip, 5: Index Base (MCP), 8: Index Tip, 17: Pinky Base (MCP)
        const wristLm = landmarks[0];
        const thumbTipLm = landmarks[4];
        const indexMcpLm = landmarks[5];
        const indexTipLm = landmarks[8];
        const pinkyMcpLm = landmarks[17];

        // 1. Mirror X for intuitive natural camera mirroring (move right -> cursor moves right)
        const rawIndexTip: HandPoint = {
          x: 1 - indexTipLm.x,
          y: indexTipLm.y,
          z: indexTipLm.z
        };

        const rawThumbTip: HandPoint = {
          x: 1 - thumbTipLm.x,
          y: thumbTipLm.y,
          z: thumbTipLm.z
        };

        const rawWrist: HandPoint = {
          x: 1 - wristLm.x,
          y: wristLm.y,
          z: wristLm.z
        };

        // 2. Natural Proportional Screen Mapping (1:1 with camera view)
        // Gentle margins (0.08..0.92) so user can reach entire screen comfortably without hitting borders
        const minX = 0.08;
        const maxX = 0.92;
        const minY = 0.06;
        const maxY = 0.94;
        const screenX = Math.max(0, Math.min(1, (rawIndexTip.x - minX) / (maxX - minX)));
        const screenY = Math.max(0, Math.min(1, (rawIndexTip.y - minY) / (maxY - minY)));
        const rawScreenPoint: HandPoint = { x: screenX, y: screenY, z: rawIndexTip.z };

        // 3. Velocity-Adaptive Zero-Lag Smoothing Filter
        const prev = this.smoothedHands.get(h);
        let alpha = 0.72; // Snappy instant response by default
        if (prev) {
          const moveDist = Math.hypot(rawScreenPoint.x - prev.screenIndex.x, rawScreenPoint.y - prev.screenIndex.y);
          // Fast motion -> alpha 0.98 (instant 0-lag tracking)
          // Stationary -> alpha 0.72 (smooth, zero jitter)
          alpha = Math.min(0.98, Math.max(0.72, 0.72 + moveDist * 10));
        }

        const smoothedIndex: HandPoint = prev
          ? {
              x: prev.index.x * (1 - alpha) + rawIndexTip.x * alpha,
              y: prev.index.y * (1 - alpha) + rawIndexTip.y * alpha,
              z: rawIndexTip.z
            }
          : rawIndexTip;

        const smoothedThumb: HandPoint = prev
          ? {
              x: prev.thumb.x * (1 - alpha) + rawThumbTip.x * alpha,
              y: prev.thumb.y * (1 - alpha) + rawThumbTip.y * alpha,
              z: rawThumbTip.z
            }
          : rawThumbTip;

        const smoothedWrist: HandPoint = prev
          ? {
              x: prev.wrist.x * (1 - alpha) + rawWrist.x * alpha,
              y: prev.wrist.y * (1 - alpha) + rawWrist.y * alpha,
              z: rawWrist.z
            }
          : rawWrist;

        const smoothedScreenIndex: HandPoint = prev
          ? {
              x: prev.screenIndex.x * (1 - alpha) + rawScreenPoint.x * alpha,
              y: prev.screenIndex.y * (1 - alpha) + rawScreenPoint.y * alpha,
              z: rawIndexTip.z
            }
          : rawScreenPoint;

        this.smoothedHands.set(h, {
          index: smoothedIndex,
          thumb: smoothedThumb,
          wrist: smoothedWrist,
          screenIndex: smoothedScreenIndex
        });

        // 4. Motion History & Velocity Calculation for Air-Strike / Drum Tap
        const prevMotion = this.motionHistory.get(h) || { x: screenX, y: screenY, time: nowClock, speed: 0 };
        const dt = Math.max(1, nowClock - prevMotion.time);
        const moveSpeed = Math.hypot(screenX - prevMotion.x, screenY - prevMotion.y) / (dt / 1000);
        this.motionHistory.set(h, { x: screenX, y: screenY, time: nowClock, speed: moveSpeed });

        // 5. Scale-Invariant Pinch Calculation
        // Palm scale reference: distance from wrist (0) to index base (5)
        const dxPalm = indexMcpLm.x - wristLm.x;
        const dyPalm = indexMcpLm.y - wristLm.y;
        const dzPalm = (indexMcpLm.z || 0) - (wristLm.z || 0);
        const palmDist = Math.sqrt(dxPalm * dxPalm + dyPalm * dyPalm + dzPalm * dzPalm);

        const dxWidth = pinkyMcpLm.x - indexMcpLm.x;
        const dyWidth = pinkyMcpLm.y - indexMcpLm.y;
        const widthDist = Math.sqrt(dxWidth * dxWidth + dyWidth * dyWidth);
        const handScale = Math.max(0.04, (palmDist + widthDist) * 0.5);

        // Distance between thumb tip and index tip
        const dxPinch = thumbTipLm.x - indexTipLm.x;
        const dyPinch = thumbTipLm.y - indexTipLm.y;
        const dzPinch = (thumbTipLm.z || 0) - (indexTipLm.z || 0);
        const pinchDist = Math.sqrt(dxPinch * dxPinch + dyPinch * dyPinch + dzPinch * dzPinch);

        const pinchRatio = pinchDist / handScale;

        // 6. Generous Pinch State Machine with Hysteresis
        // Thresholds: pinched < 0.52 (forgiving for all finger sizes), released > 0.65
        const PINCH_START = 0.52;
        const PINCH_RELEASE = 0.65;
        const pState = this.pinchStates.get(h) || {
          isPinching: false,
          lastPinchTime: 0,
          pinchRatio: 1.0
        };

        pState.pinchRatio = pinchRatio;
        let isEdgePinch = false;

        if (!pState.isPinching) {
          if (
            pinchRatio < PINCH_START &&
            nowClock - pState.lastPinchTime > this.gestureCooldownMs
          ) {
            pState.isPinching = true;
            pState.lastPinchTime = nowClock;
            isEdgePinch = true;
          }
        } else {
          if (pinchRatio > PINCH_RELEASE) {
            pState.isPinching = false;
          }
        }

        this.pinchStates.set(h, pState);
        if (pState.isPinching) anyPinching = true;

        // 7. Precise Real-Time Instrument Hit-Testing (Instant, zero-delay switching)
        const activeHovered = this.checkInstrumentHover(smoothedScreenIndex);

        // 8. Multi-Trigger Logic (Air-Pinch + Intentional Hover Dwell)
        let isDwellTrigger = false;
        let hoverProgress = 0;

        let dwell = this.hoverDwellStates.get(h);
        if (!dwell || dwell.instrument !== activeHovered) {
          dwell = {
            instrument: activeHovered,
            startTime: nowClock,
            triggered: false,
            lastTriggerTime: dwell ? dwell.lastTriggerTime : 0
          };
        } else if (activeHovered) {
          const DWELL_TIME_MS = 240;
          if (nowClock - dwell.lastTriggerTime > this.gestureCooldownMs) {
            hoverProgress = Math.min(1, (nowClock - dwell.startTime) / DWELL_TIME_MS);
            if (hoverProgress >= 1 && !dwell.triggered) {
              isDwellTrigger = true;
              dwell.triggered = true;
              dwell.lastTriggerTime = nowClock;
            }
          }
        }
        this.hoverDwellStates.set(h, dwell);

        // Combined trigger: either clean air-pinch or completed hover dwell
        const isTriggering = isEdgePinch || isDwellTrigger;
        const triggerType: 'pinch' | 'tap' | 'dwell' | undefined = isEdgePinch
          ? 'pinch'
          : isDwellTrigger
          ? 'dwell'
          : undefined;

        // Full real landmarks mirrored for canvas rendering
        const mirroredLandmarks: HandPoint[] = landmarks.map((lm) => ({
          x: 1 - lm.x,
          y: lm.y,
          z: lm.z
        }));

        trackedHands.push({
          id: `hand_${h}`,
          indexTip: smoothedScreenIndex,
          thumbTip: smoothedThumb,
          wrist: smoothedWrist,
          isPinching: isEdgePinch,
          pinchDistance: pinchRatio,
          hoveredInstrument: activeHovered,
          hoverProgress: activeHovered ? hoverProgress : 0,
          isTriggering,
          triggerType,
          landmarks: mirroredLandmarks
        });
      }

      this.latestHands = trackedHands;

      const anyTriggered = trackedHands.some((h) => h.isTriggering);
      const status = anyTriggered
        ? 'pinch_detected'
        : anyPinching
        ? 'pinch_detected'
        : 'hand_detected';
      const statusText = anyTriggered ? 'BEAT HIT! ⚡' : anyPinching ? 'PINCHING' : 'HAND ACTIVE';
      const triggeredHand = trackedHands.find((hand) => hand.isTriggering);
      const triggeredInstrument = triggeredHand?.hoveredInstrument
        ? INSTRUMENT_LIST.find((instrument) => instrument.id === triggeredHand.hoveredInstrument)
        : null;
      const feedbackText = triggeredInstrument
        ? `${triggeredInstrument.name} HIT! ⚡`
        : statusText;

      this.reportStatus(status, feedbackText, true, trackedHands.length, anyPinching || anyTriggered);

      if (this.onHandsDetectedCallback) {
        this.onHandsDetectedCallback(trackedHands);
      }
    } catch (e) {
      this.isProcessingFrame = false;
      console.warn('[AIRBEAT AI] Frame detection error:', e);
    }
  }

  // Exact screen-pixel hit testing against instrument pads (No overlap, no false hover)
  private checkInstrumentHover(screenPoint: HandPoint): InstrumentId | null {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    // Pad button is ~170px in diameter (85px radius). We give it an effortless ~135px grab radius.
    const HIT_RADIUS_PX = Math.min(screenWidth, screenHeight) * 0.13;

    let closestId: InstrumentId | null = null;
    let closestDist = HIT_RADIUS_PX;

    for (const inst of INSTRUMENT_LIST) {
      const targetPxX = inst.position.x * screenWidth;
      const targetPxY = inst.position.y * screenHeight;
      const cursorPxX = screenPoint.x * screenWidth;
      const cursorPxY = screenPoint.y * screenHeight;

      const dist = Math.hypot(cursorPxX - targetPxX, cursorPxY - targetPxY);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = inst.id;
      }
    }

    return closestId;
  }

  public dispose() {
    this.stopTracking();
    this.modelLoadGeneration++;
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (e) {
        console.warn('Error closing hand landmarker:', e);
      }
      this.handLandmarker = null;
    }
    this.isModelReady = false;
    this.isModelLoading = false;
  }
}

export const handTracker = new HandTrackerService();
