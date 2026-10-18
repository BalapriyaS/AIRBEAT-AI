import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandPoint, InstrumentId, TrackedHand } from '../types/game';
import { INSTRUMENT_LIST } from '../game/instrumentsConfig';

export type TrackingStatus =
  | 'idle'
  | 'requesting_camera'
  | 'loading_model'
  | 'camera_ready'
  | 'hand_detected'
  | 'no_hand'
  | 'pinch_detected'
  | 'tracking_error'
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
  private handLandmarker: HandLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isModelLoading: boolean = false;
  private isModelReady: boolean = false;
  private isProcessingFrame: boolean = false;
  private animationFrameId: number | null = null;

  private lastVideoTime: number = -1;
  private lastProcessedTimestampMs: number = 0;
  private lastFrameClockMs: number = 0;

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

  // Target stabilization for hovered instrument
  private currentHoveredTarget: InstrumentId | null = null;
  private hoverHoldFrames: number = 0;

  // Callbacks
  private onHandsDetectedCallback: ((hands: TrackedHand[]) => void) | null = null;
  private onStateChangeCallback: ((state: TrackingStateInfo) => void) | null = null;

  public async initializeModel(onState?: (state: TrackingStateInfo) => void): Promise<boolean> {
    if (onState) this.onStateChangeCallback = onState;

    if (this.isModelReady && this.handLandmarker) {
      this.reportStatus('camera_ready', 'MODEL READY • SHOW HAND', true);
      return true;
    }
    if (this.isModelLoading) {
      return false;
    }

    this.isModelLoading = true;
    this.reportStatus('loading_model', 'LOADING MODEL...', false);

    // Timeout of 25 seconds for network / WASM compilation
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Hand-tracking model loading timed out (25s)')), 25000)
    );

    const initWorker = async () => {
      // 1. Resolve WASM assets: Try CDN first for maximum reliability, then local fallback
      const wasmSources = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm',
        `${window.location.origin}/wasm`
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

      // 2. Load hand landmark model
      const modelSources = [
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        `${window.location.origin}/models/hand_landmarker.task`
      ];

      for (const modelPath of modelSources) {
        // Try GPU first
        try {
          console.log('[AIRBEAT AI] Initializing HandLandmarker (GPU):', modelPath);
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
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
          console.log('[AIRBEAT AI] HandLandmarker initialized successfully (GPU)!');
          return true;
        } catch (gpuErr) {
          console.warn('[AIRBEAT AI] GPU delegate failed, trying CPU...', gpuErr);
          // Try CPU fallback
          try {
            console.log('[AIRBEAT AI] Initializing HandLandmarker (CPU):', modelPath);
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
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
            console.log('[AIRBEAT AI] HandLandmarker initialized successfully (CPU)!');
            return true;
          } catch (cpuErr) {
            console.warn('[AIRBEAT AI] CPU delegate failed for', modelPath, cpuErr);
          }
        }
      }

      throw new Error('All model loading sources failed');
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
      const errMsg = err instanceof Error ? err.message : 'Model loading error';
      this.reportStatus('tracking_error', 'TRACKING ERROR', false, 0, false, errMsg);
      return false;
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
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        status,
        statusText,
        isReady,
        handsCount,
        isPinching,
        errorMessage
      });
    }
  }

  public setVideoSource(video: HTMLVideoElement) {
    this.videoElement = video;
  }

  public startTracking(onHands: (hands: TrackedHand[]) => void) {
    this.onHandsDetectedCallback = onHands;
    if (this.animationFrameId === null) {
      this.loop();
    }
  }

  public stopTracking() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isProcessingFrame = false;
    this.smoothedHands.clear();
    this.pinchStates.clear();
    this.currentHoveredTarget = null;
    this.hoverHoldFrames = 0;
  }

  private loop = () => {
    this.processFrame();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private processFrame() {
    if (
      !this.handLandmarker ||
      !this.videoElement ||
      this.videoElement.readyState < 2 ||
      this.videoElement.paused ||
      this.videoElement.ended ||
      this.videoElement.videoWidth === 0 ||
      this.videoElement.videoHeight === 0 ||
      this.isProcessingFrame
    ) {
      return;
    }

    const nowClock = performance.now();
    // Throttle MediaPipe inference to ~30 FPS to save CPU/GPU and match webcam rate
    if (nowClock - this.lastFrameClockMs < 30) {
      return;
    }

    const currentTime = this.videoElement.currentTime;
    if (currentTime === this.lastVideoTime) {
      return;
    }
    this.lastVideoTime = currentTime;
    this.lastFrameClockMs = nowClock;

    // Strictly monotonic timestamp required by MediaPipe
    let timestampMs = Math.round(nowClock);
    if (timestampMs <= this.lastProcessedTimestampMs) {
      timestampMs = this.lastProcessedTimestampMs + 1;
    }
    this.lastProcessedTimestampMs = timestampMs;

    this.isProcessingFrame = true;

    try {
      const results = this.handLandmarker.detectForVideo(this.videoElement, timestampMs);
      this.isProcessingFrame = false;

      // Handle no hand detected
      if (!results || !results.landmarks || results.landmarks.length === 0) {
        this.reportStatus('no_hand', 'NO HAND DETECTED', true, 0, false);
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

        // 2. Active Zone Screen Mapping (expand comfortable center 0.12..0.88 to full 0..1 screen)
        const screenX = Math.max(0, Math.min(1, (rawIndexTip.x - 0.12) / (0.88 - 0.12)));
        const screenY = Math.max(0, Math.min(1, (rawIndexTip.y - 0.10) / (0.90 - 0.10)));
        const rawScreenPoint: HandPoint = { x: screenX, y: screenY, z: rawIndexTip.z };

        // 3. Fast responsive smoothing (alpha = 0.5)
        const prev = this.smoothedHands.get(h);
        const alpha = 0.5;

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

        // 4. Scale-Invariant Pinch Calculation
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

        // 5. Pinch State Machine with Hysteresis & Edge Trigger
        // Threshold: pinched < 0.40, released > 0.58
        const PINCH_START = 0.40;
        const PINCH_RELEASE = 0.58;
        const COOLDOWN_MS = 280;

        const pState = this.pinchStates.get(h) || {
          isPinching: false,
          lastPinchTime: 0,
          pinchRatio: 1.0
        };

        pState.pinchRatio = pinchRatio;
        let isEdgePinch = false;

        if (!pState.isPinching) {
          if (pinchRatio < PINCH_START && nowClock - pState.lastPinchTime > COOLDOWN_MS) {
            pState.isPinching = true;
            pState.lastPinchTime = nowClock;
            isEdgePinch = true; // Exactly one trigger per pinch
          }
        } else {
          if (pinchRatio > PINCH_RELEASE) {
            pState.isPinching = false;
          }
        }

        this.pinchStates.set(h, pState);
        if (pState.isPinching) anyPinching = true;

        // 6. Stabilized Instrument Hit-Testing
        const candidateInstrument = this.checkInstrumentHover(smoothedScreenIndex);
        let activeHovered = candidateInstrument;

        if (candidateInstrument !== this.currentHoveredTarget) {
          this.hoverHoldFrames++;
          if (this.hoverHoldFrames >= 2 || !this.currentHoveredTarget) {
            this.currentHoveredTarget = candidateInstrument;
            this.hoverHoldFrames = 0;
          }
          activeHovered = this.currentHoveredTarget;
        } else {
          this.hoverHoldFrames = 0;
        }

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
          landmarks: mirroredLandmarks
        });
      }

      const status = anyPinching ? 'pinch_detected' : 'hand_detected';
      const statusText = anyPinching ? 'PINCH DETECTED' : 'HAND DETECTED';

      this.reportStatus(status, statusText, true, trackedHands.length, anyPinching);

      if (this.onHandsDetectedCallback) {
        this.onHandsDetectedCallback(trackedHands);
      }
    } catch (e) {
      this.isProcessingFrame = false;
      console.warn('[AIRBEAT AI] Frame detection error:', e);
    }
  }

  // Hit-testing against instrument positions in normalized screen space
  private checkInstrumentHover(screenPoint: HandPoint): InstrumentId | null {
    const HOVER_RADIUS = 0.16;
    let closestId: InstrumentId | null = null;
    let closestDist = HOVER_RADIUS;

    for (const inst of INSTRUMENT_LIST) {
      const dx = screenPoint.x - inst.position.x;
      const dy = screenPoint.y - inst.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = inst.id;
      }
    }

    return closestId;
  }

  public dispose() {
    this.stopTracking();
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
