import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Hand,
  MousePointer,
  Play,
  Sparkles,
  X,
  Zap
} from 'lucide-react';
import { TrackedHand } from '../types/game';
import { TrackingStateInfo } from '../vision/HandTracker';
import { audioEngine } from '../audio/AudioEngine';

interface CalibrationModalProps {
  trackingInfo: TrackingStateInfo;
  hands: TrackedHand[];
  onStartGame: () => void;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  trackingInfo,
  hands,
  onStartGame,
  onClose
}) => {
  const [hasTestedHand, setHasTestedHand] = useState<boolean>(false);
  const [hasTestedPinch, setHasTestedPinch] = useState<boolean>(false);

  useEffect(() => {
    if (hands.length > 0) {
      setHasTestedHand(true);
    }
    for (const h of hands) {
      if (h.isPinching) {
        setHasTestedPinch(true);
        audioEngine.playInstrument('drums', 0.5);
      }
    }
  }, [hands]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="max-w-xl w-full bg-slate-900 border border-cyan-500/60 rounded-2xl p-6 shadow-2xl relative text-slate-100 flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-cyan-400 font-heading font-bold text-xl sm:text-2xl">
          <Camera className="w-6 h-6 text-cyan-400" />
          <span>HAND-TRACKING CALIBRATION</span>
        </div>
        <p className="text-xs text-slate-400 mb-6 text-center font-mono-tech max-w-md">
          Move your index finger to aim the cursor, then pinch your thumb and index finger together to strike!
        </p>

        {/* Interactive Test Pad Area */}
        <div className="w-full aspect-16/9 max-w-md bg-slate-950 border border-slate-700/80 rounded-xl relative overflow-hidden flex flex-col items-center justify-center p-4 mb-6 shadow-inner">
          {/* Cyber grid lines */}
          <div className="absolute inset-0 hologram-grid opacity-30 pointer-events-none" />

          {/* Test target circle in center */}
          <div
            className={`w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-200 select-none ${
              hasTestedPinch
                ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-110'
                : hands.length > 0
                ? 'border-cyan-400 bg-cyan-950/30 animate-pulse'
                : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <Zap
              className={`w-8 h-8 mb-1 ${
                hasTestedPinch
                  ? 'text-emerald-400'
                  : hands.length > 0
                  ? 'text-cyan-400'
                  : 'text-slate-500'
              }`}
            />
            <span className="text-[11px] font-heading font-bold tracking-wider text-slate-200">
              {hasTestedPinch
                ? 'PINCH SUCCESS!'
                : hands.length > 0
                ? 'PINCH TO TEST'
                : 'SHOW HAND'}
            </span>
          </div>

          {/* Fingertip Position Pointer when Hand Detected */}
          {hands.map((h, i) => (
            <div
              key={i}
              style={{
                left: `${h.indexTip.x * 100}%`,
                top: `${h.indexTip.y * 100}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
            >
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  h.isPinching
                    ? 'border-amber-400 bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.9)] scale-125'
                    : 'border-cyan-400 bg-cyan-400/40'
                }`}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            </div>
          ))}

          {/* Tips banner if no hand */}
          {hands.length === 0 && (
            <div className="absolute bottom-2 left-2 right-2 text-center text-[11px] font-mono-tech text-amber-300 bg-black/60 py-1 px-2 rounded border border-amber-500/30 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Raise your hand in front of the camera with good lighting</span>
            </div>
          )}
        </div>

        {/* Real-time Checklist */}
        <div className="w-full max-w-md grid grid-cols-2 gap-2.5 mb-6 text-xs font-mono-tech">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            {trackingInfo.isReady ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
            )}
            <span className={trackingInfo.isReady ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
              Camera Active
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            {hasTestedHand ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
            )}
            <span className={hasTestedHand ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
              Hand Detected
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            {hasTestedPinch ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
            )}
            <span className={hasTestedPinch ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
              Pinch Recognized
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-semibold">
              Mouse / Touch Fallback
            </span>
          </div>
        </div>

        {/* Start Game Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <button
            onClick={() => {
              onClose();
              onStartGame();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-heading font-bold text-base tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{hasTestedPinch ? 'START BATTLE NOW!' : 'READY • START BATTLE'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onStartGame();
            }}
            className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono-tech text-xs cursor-pointer whitespace-nowrap transition-colors flex items-center justify-center gap-1.5"
          >
            <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Play with Mouse</span>
          </button>
        </div>
      </div>
    </div>
  );
};
