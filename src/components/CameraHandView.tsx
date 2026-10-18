import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CornerDownRight,
  Eye,
  EyeOff,
  GripHorizontal,
  Hand,
  HelpCircle,
  Move,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';
import { handTracker, TrackingStateInfo } from '../vision/HandTracker';
import { TrackedHand } from '../types/game';

interface CameraHandViewProps {
  onHandsDetected: (hands: TrackedHand[]) => void;
  onCameraStatusChange?: (isActive: boolean) => void;
  onTrackingStateChange?: (state: TrackingStateInfo) => void;
  isVisible: boolean;
  onToggleVisible: () => void;
}

export type DockPreset = 'bottom-left' | 'bottom-right' | 'top-right' | 'custom';

export const CameraHandView: React.FC<CameraHandViewProps> = ({
  onHandsDetected,
  onCameraStatusChange,
  onTrackingStateChange,
  isVisible,
  onToggleVisible
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);

  const [cameraStatus, setCameraStatus] = useState<
    'requesting' | 'active' | 'denied' | 'error'
  >('requesting');
  const [trackingState, setTrackingState] = useState<TrackingStateInfo>({
    status: 'initializing_camera',
    statusText: 'Initializing Camera...',
    isReady: false,
    handsCount: 0,
    isPinching: false
  });

  const [lastPinchAnim, setLastPinchAnim] = useState<{ x: number; y: number; time: number } | null>(
    null
  );
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);

  // Drag & Positioning State (Ensures preview NEVER covers instruments)
  const [dockPreset, setDockPreset] = useState<DockPreset>('bottom-left');
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Stabilize callbacks in refs to prevent stream teardown on parent re-renders
  const onHandsDetectedRef = useRef(onHandsDetected);
  onHandsDetectedRef.current = onHandsDetected;
  const onCameraStatusChangeRef = useRef(onCameraStatusChange);
  onCameraStatusChangeRef.current = onCameraStatusChange;
  const onTrackingStateChangeRef = useRef(onTrackingStateChange);
  onTrackingStateChangeRef.current = onTrackingStateChange;

  // Initialize camera and MediaPipe (Runs ONCE on mount)
  useEffect(() => {
    let isMounted = true;

    async function setupCameraAndAI() {
      try {
        setCameraStatus('requesting');

        // Request webcam access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('webkit-playsinline', '');
          video.setAttribute('muted', '');

          // Wait for video metadata to ensure dimensions are valid before play
          await new Promise<void>((resolve) => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              resolve();
            } else {
              const onLoaded = () => {
                video.removeEventListener('loadeddata', onLoaded);
                video.removeEventListener('loadedmetadata', onLoaded);
                resolve();
              };
              video.addEventListener('loadeddata', onLoaded);
              video.addEventListener('loadedmetadata', onLoaded);
              setTimeout(resolve, 800);
            }
          });

          try {
            await video.play();
          } catch (playErr) {
            console.warn('[AIRBEAT AI] video.play() waiting for interaction:', playErr);
          }

          handTracker.setVideoSource(video);
          setCameraStatus('active');
          if (onCameraStatusChangeRef.current) onCameraStatusChangeRef.current(true);

          // Interaction unlock safeguard for strict browser autoplay policies
          const unlockVideo = () => {
            if (video.paused) {
              video.play().catch(() => {});
            }
          };
          window.addEventListener('pointerdown', unlockVideo, { once: true });
          window.addEventListener('keydown', unlockVideo, { once: true });
        }

        // Initialize MediaPipe Tasks Vision HandLandmarker
        const aiReady = await handTracker.initializeModel((state) => {
          if (!isMounted) return;
          setTrackingState(state);
          if (onTrackingStateChangeRef.current) onTrackingStateChangeRef.current(state);
        });

        if (aiReady && isMounted) {
          handTracker.startTracking((hands) => {
            if (!isMounted) return;
            onHandsDetectedRef.current(hands);
            renderHandOverlay(hands);

            // Trigger pinch ripple animation
            for (const h of hands) {
              if (h.isPinching) {
                setLastPinchAnim({ x: h.indexTip.x, y: h.indexTip.y, time: Date.now() });
              }
            }
          });
        }
      } catch (err: unknown) {
        console.warn('[AIRBEAT AI] Camera or MediaPipe initialization notice:', err);
        if (isMounted) {
          const errorName = err instanceof Error ? err.name : '';
          const status =
            errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
              ? 'denied'
              : 'error';
          setCameraStatus(status);
          if (onCameraStatusChangeRef.current) onCameraStatusChangeRef.current(false);
          const stateErr: TrackingStateInfo = {
            status: status === 'denied' ? 'waiting_permission' : 'camera_unavailable',
            statusText:
              status === 'denied' ? 'Camera Permission Denied' : 'Webcam Not Accessible',
            isReady: false,
            handsCount: 0,
            isPinching: false
          };
          setTrackingState(stateErr);
          if (onTrackingStateChangeRef.current) onTrackingStateChangeRef.current(stateErr);
        }
      }
    }

    setupCameraAndAI();

    return () => {
      isMounted = false;
      handTracker.stopTracking();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []); // Run ONCE on mount so stream is never torn down by parent re-renders

  // Render hand landmark bones & glowing joints on canvas
  const renderHandOverlay = (hands: TrackedHand[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // MediaPipe hand skeleton connection pairs
    const CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17] // Palm base
    ];

    for (const hand of hands) {
      const lms = hand.landmarks;
      if (!lms || lms.length < 21) continue;

      // Draw skeleton lines
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = hand.isPinching ? 'rgba(245, 158, 11, 0.85)' : 'rgba(6, 182, 212, 0.75)';
      ctx.shadowColor = hand.isPinching ? '#f59e0b' : '#06b6d4';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      for (const [i, j] of CONNECTIONS) {
        const pt1 = lms[i];
        const pt2 = lms[j];
        if (pt1 && pt2) {
          ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
          ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
        }
      }
      ctx.stroke();

      // Draw joints
      for (let i = 0; i < lms.length; i++) {
        const pt = lms[i];
        const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;

        ctx.fillStyle = isTip ? '#ffffff' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, isTip ? 4.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fingertip glowing halo on index and thumb
      const idxX = (lms[8]?.x ?? 0) * canvas.width;
      const idxY = (lms[8]?.y ?? 0) * canvas.height;
      const thbX = (lms[4]?.x ?? 0) * canvas.width;
      const thbY = (lms[4]?.y ?? 0) * canvas.height;

      // Pinch line
      ctx.lineWidth = 2;
      ctx.strokeStyle = hand.isPinching ? '#f59e0b' : 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(idxX, idxY);
      ctx.lineTo(thbX, thbY);
      ctx.stroke();

      // Index and Thumb tip markers
      ctx.fillStyle = hand.isPinching ? '#f59e0b' : '#06b6d4';
      ctx.shadowColor = hand.isPinching ? '#f59e0b' : '#06b6d4';
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(idxX, idxY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(thbX, thbY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  // Dragging Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    const rect = pipContainerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const newX = Math.max(10, Math.min(window.innerWidth - 240, e.clientX - dragOffsetRef.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 180, e.clientY - dragOffsetRef.current.y));
    setCustomPosition({ x: newX, y: newY });
    setDockPreset('custom');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const cycleDockPreset = () => {
    const next: Record<DockPreset, DockPreset> = {
      'bottom-left': 'top-right',
      'top-right': 'bottom-right',
      'bottom-right': 'bottom-left',
      'custom': 'bottom-left'
    };
    setDockPreset(next[dockPreset] || 'bottom-left');
    setCustomPosition(null);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  // Determine container style based on dock preset or custom drag position
  const getPositionClasses = () => {
    if (dockPreset === 'custom' && customPosition) {
      return '';
    }
    switch (dockPreset) {
      case 'top-right':
        return 'top-16 right-4';
      case 'bottom-right':
        return 'bottom-16 right-4';
      case 'bottom-left':
      default:
        // Positioned safely with generous clearance so it never covers Violin pad
        return 'bottom-16 left-4';
    }
  };

  return (
    <>
      {/* 1. Movable Picture-in-Picture Webcam Panel */}
      <div
        ref={pipContainerRef}
        style={
          dockPreset === 'custom' && customPosition
            ? { left: `${customPosition.x}px`, top: `${customPosition.y}px` }
            : {}
        }
        className={`fixed z-20 w-[200px] sm:w-[220px] md:w-[240px] aspect-4/3 rounded-xl overflow-hidden border border-cyan-500/60 bg-slate-950/95 shadow-2xl transition-all duration-200 ${
          isVisible ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'
        } ${getPositionClasses()}`}
      >
        {/* Real Live Webcam Video Feed (Mirrored) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover transform -scale-x-100 bg-slate-950"
        />

        {/* Real-time Hand Skeleton Landmark Canvas Overlay */}
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Futuristic Corner Tech Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        {/* Draggable Title / Status Header Bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-mono-tech px-2 py-0.5 rounded bg-black/85 backdrop-blur-xs border border-cyan-500/40 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-1 text-cyan-300 truncate">
            <GripHorizontal className="w-3 h-3 text-cyan-400/80 shrink-0" />
            <span
              className={`truncate font-semibold tracking-wide ${
                trackingState.handsCount > 0
                  ? 'text-emerald-400'
                  : trackingState.status === 'pinch_detected'
                  ? 'text-amber-300'
                  : trackingState.isReady
                  ? 'text-cyan-300'
                  : 'text-rose-400'
              }`}
            >
              {trackingState.statusText}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Reposition preset cycle button */}
            <button
              onClick={cycleDockPreset}
              title={`Cycle Dock Corner (Current: ${dockPreset})`}
              className="p-0.5 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Move className="w-3 h-3" />
            </button>

            {/* Hide Preview button */}
            <button
              onClick={onToggleVisible}
              title="Hide Webcam Preview (Hand gestures stay active)"
              className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Pinch feedback ripple effect */}
        {lastPinchAnim && Date.now() - lastPinchAnim.time < 500 && (
          <div
            className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-ping pointer-events-none"
            style={{
              left: `${lastPinchAnim.x * 100}%`,
              top: `${lastPinchAnim.y * 100}%`
            }}
          />
        )}

        {/* Camera Permission Denied or Not Available Overlay */}
        {(cameraStatus === 'denied' || cameraStatus === 'error') && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-3 text-center z-30">
            <AlertTriangle className="w-6 h-6 text-amber-400 mb-1" />
            <p className="text-xs font-semibold text-amber-300 mb-0.5">
              {cameraStatus === 'denied' ? 'Camera Permission Denied' : 'Webcam Unavailable'}
            </p>
            <p className="text-[10px] text-slate-400 mb-2">
              Mouse click controls are 100% active!
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowTroubleshooting(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                Guide
              </button>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Minimized Floating Status Pill when preview is hidden */}
      {!isVisible && (
        <div className="fixed bottom-16 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-500/50 shadow-xl backdrop-blur-md">
          <Hand className="w-3.5 h-3.5 text-cyan-400" />
          <span
            className={`text-[11px] font-mono-tech font-bold ${
              trackingState.handsCount > 0 ? 'text-emerald-400' : 'text-cyan-300'
            }`}
          >
            {trackingState.statusText}
          </span>
          <button
            onClick={onToggleVisible}
            title="Show Webcam Preview"
            className="flex items-center gap-1 text-[10px] font-mono-tech px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            <span>Show Cam</span>
          </button>
        </div>
      )}

      {/* 3. Camera Permission Troubleshooting Modal */}
      {showTroubleshooting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowTroubleshooting(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-heading font-bold text-cyan-400 mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyan-400" />
              CAMERA PERMISSION GUIDE
            </h3>

            <p className="text-xs text-slate-300 mb-4 font-mono-tech">
              AIRBEAT AI runs hand tracking entirely on your device inside your browser using MediaPipe.
            </p>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                  1
                </span>
                <p>
                  Look at your browser address bar on the left (lock or tune icon) and click it.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                  2
                </span>
                <p>Toggle <strong>Camera</strong> from "Blocked" to <strong>"Allow"</strong>.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                  3
                </span>
                <p>
                  Click the <strong>Retry Camera</strong> button below or refresh your page.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  <strong>Mouse click controls are always enabled:</strong> You can click any instrument with your mouse or hotkeys 1-6 right now!
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-heading font-bold text-sm transition-colors cursor-pointer"
              >
                RETRY CAMERA
              </button>
              <button
                onClick={() => setShowTroubleshooting(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-heading font-bold text-sm transition-colors cursor-pointer"
              >
                PLAY WITH MOUSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
