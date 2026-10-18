import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Hand,
  RefreshCw,
  Sparkles
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

  // Initialize camera and MediaPipe
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          handTracker.setVideoSource(videoRef.current);
          setCameraStatus('active');
          if (onCameraStatusChange) onCameraStatusChange(true);
        }

        // Initialize MediaPipe Tasks Vision HandLandmarker
        const aiReady = await handTracker.initializeModel((state) => {
          if (!isMounted) return;
          setTrackingState(state);
          if (onTrackingStateChange) onTrackingStateChange(state);
        });

        if (aiReady && isMounted) {
          handTracker.startTracking((hands) => {
            if (!isMounted) return;
            onHandsDetected(hands);
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
        console.warn('Camera or MediaPipe initialization failed:', err);
        if (isMounted) {
          const errorName = err instanceof Error ? err.name : '';
          const status = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
            ? 'denied'
            : 'error';
          setCameraStatus(status);
          if (onCameraStatusChange) onCameraStatusChange(false);
          const stateErr: TrackingStateInfo = {
            status: status === 'denied' ? 'waiting_permission' : 'camera_unavailable',
            statusText: status === 'denied' ? 'Camera Permission Denied' : 'Webcam Not Accessible',
            isReady: false,
            handsCount: 0,
            isPinching: false
          };
          setTrackingState(stateErr);
          if (onTrackingStateChange) onTrackingStateChange(stateErr);
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
  }, [onCameraStatusChange, onHandsDetected, onTrackingStateChange]);

  // Render hand landmark bones & glowing joints on canvas
  const renderHandOverlay = (hands: TrackedHand[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)'; // neon cyan
      ctx.shadowColor = '#06b6d4';
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

      ctx.lineWidth = 2;
      ctx.strokeStyle = hand.isPinching ? '#f59e0b' : 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(idxX, idxY);
      ctx.lineTo(thbX, thbY);
      ctx.stroke();

      ctx.fillStyle = hand.isPinching ? '#f59e0b' : '#06b6d4';
      ctx.shadowColor = hand.isPinching ? '#f59e0b' : '#06b6d4';
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(idxX, idxY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(thbX, thbY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <>
      {/* 1. Picture-in-Picture Webcam Panel */}
      <div
        className={`fixed z-20 w-[210px] sm:w-[230px] md:w-[250px] aspect-4/3 rounded-xl overflow-hidden border border-cyan-500/50 bg-slate-950/90 shadow-2xl transition-all duration-200 ${
          isVisible
            ? 'bottom-16 sm:bottom-18 left-3 sm:left-4 opacity-100 pointer-events-auto'
            : '-left-[9999px] -top-[9999px] opacity-0 pointer-events-none'
        }`}
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

        {/* Sci-Fi Corner Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        {/* Top Status & Hide Button Bar */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-mono-tech px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-cyan-500/30">
          <div className="flex items-center gap-1.5 text-cyan-300 truncate">
            <Camera className="w-3 h-3 text-cyan-400 shrink-0" />
            <span
              className={`truncate font-semibold ${
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
          <button
            onClick={onToggleVisible}
            title="Hide Webcam Preview (Hands still track)"
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>

        {/* Pinch feedback ripple effect */}
        {lastPinchAnim && Date.now() - lastPinchAnim.time < 500 && (
          <div
            className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-amber-400 animate-ping pointer-events-none"
            style={{
              left: `${lastPinchAnim.x * 100}%`,
              top: `${lastPinchAnim.y * 100}%`
            }}
          />
        )}

        {/* Camera Denied or Error Message */}
        {(cameraStatus === 'denied' || cameraStatus === 'error') && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-3 text-center z-30">
            <Camera className="w-6 h-6 text-rose-500 mb-1" />
            <p className="text-xs font-semibold text-rose-300 mb-0.5">
              {cameraStatus === 'denied' ? 'Camera Denied' : 'Webcam Error'}
            </p>
            <p className="text-[10px] text-slate-400 mb-2">
              Click or touch instruments to play
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* 2. Minimized Floating Status Pill when preview is hidden (Tracking continues!) */}
      {!isVisible && (
        <div className="fixed bottom-16 sm:bottom-18 left-3 sm:left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-500/50 shadow-xl backdrop-blur-md">
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
    </>
  );
};
