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
      if (h.isPinching || h.isTriggering) {
        setHasTestedPinch(true);
        audioEngine.playInstrument('drums', 0.5);
      }
    }
  }, [hands]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="max-w-xl w-full bg-[#111C2D]/95 border-2 border-[#1687FF]/60 rounded-3xl p-6 shadow-2xl relative text-[#F1F5F9] flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-[#00D9FF] p-1.5 rounded-lg hover:bg-[#080D18] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-[#00D9FF] font-heading font-bold text-xl sm:text-2xl">
          <Camera className="w-6 h-6 text-[#00D9FF]" />
          <span>HAND-TRACKING OPTICAL CALIBRATION</span>
        </div>
        <p className="text-xs text-slate-400 mb-6 text-center font-mono-tech max-w-md">
          Move your index finger to aim the cursor, then pinch thumb and index together to fire the trigger!
        </p>

        {/* Interactive Test Pad Area */}
        <div className="w-full aspect-16/9 max-w-md bg-[#080D18] border border-[#1687FF]/40 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center p-4 mb-6 shadow-inner">
          {/* Cyber grid lines */}
          <div className="absolute inset-0 hologram-grid opacity-30 pointer-events-none" />

          {/* Test target circle in center */}
          <div
            className={`w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-200 select-none ${
              hasTestedPinch
                ? 'border-[#00D9FF] bg-[#00D9FF]/20 shadow-[0_0_25px_rgba(0,217,255,0.6)] scale-110'
                : hands.length > 0
                ? 'border-[#1687FF] bg-[#1687FF]/20 animate-pulse'
                : 'border-slate-800 bg-[#111C2D]/60'
            }`}
          >
            <Zap
              className={`w-8 h-8 mb-1 ${
                hasTestedPinch
                  ? 'text-[#00D9FF]'
                  : hands.length > 0
                  ? 'text-[#1687FF]'
                  : 'text-slate-600'
              }`}
            />
            <span className="text-[11px] font-heading font-bold tracking-wider text-[#F1F5F9]">
              {hasTestedPinch
                ? 'TRIGGER FIRED!'
                : hands.length > 0
                ? 'PINCH TO TEST'
                : 'RAISE HAND'}
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
                    ? 'border-[#00D9FF] bg-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.9)] scale-125'
                    : 'border-[#1687FF] bg-[#1687FF]/40'
                }`}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            </div>
          ))}

          {/* Tips banner if no hand */}
          {hands.length === 0 && (
            <div className="absolute bottom-2 left-2 right-2 text-center text-[11px] font-mono-tech text-[#00D9FF] bg-[#111C2D]/85 py-1 px-2 rounded border border-[#1687FF]/40 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Raise your hand in front of the camera with standard lighting</span>
            </div>
          )}
        </div>

        {/* Real-time Checklist */}
        <div className="w-full max-w-md grid grid-cols-2 gap-2.5 mb-6 text-xs font-mono-tech">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#080D18]/90 border border-[#1687FF]/30">
            {trackingInfo.isReady ? (
              <CheckCircle2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
            )}
            <span className={trackingInfo.isReady ? 'text-[#00D9FF] font-semibold' : 'text-slate-400'}>
              Camera Active
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#080D18]/90 border border-[#1687FF]/30">
            {hasTestedHand ? (
              <CheckCircle2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
            )}
            <span className={hasTestedHand ? 'text-[#00D9FF] font-semibold' : 'text-slate-400'}>
              Hand Detected
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#080D18]/90 border border-[#1687FF]/30">
            {hasTestedPinch ? (
              <CheckCircle2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
            )}
            <span className={hasTestedPinch ? 'text-[#00D9FF] font-semibold' : 'text-slate-400'}>
              Pinch Edge Trigger
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#080D18]/90 border border-[#1687FF]/30">
            <CheckCircle2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
            <span className="text-[#00D9FF] font-semibold">
              Mouse / Keys 1-6 Ready
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
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-black text-base tracking-wider shadow-lg shadow-[#1687FF]/30 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-current text-[#080D18]" />
            <span>{hasTestedPinch ? 'COMMENCE BATTLE NOW' : 'INITIALIZE BATTLE [START]'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onStartGame();
            }}
            className="w-full sm:w-auto px-4 py-4 rounded-2xl bg-[#080D18] hover:bg-[#111C2D] border border-[#1687FF]/40 text-[#F1F5F9] font-mono-tech text-xs cursor-pointer whitespace-nowrap transition-colors flex items-center justify-center gap-1.5"
          >
            <MousePointer className="w-3.5 h-3.5 text-[#00D9FF]" />
            <span>Play with Mouse</span>
          </button>
        </div>
      </div>
    </div>
  );
};
