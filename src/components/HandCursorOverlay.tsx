import React from 'react';
import { TrackedHand } from '../types/game';

interface HandCursorOverlayProps {
  hands: TrackedHand[];
  isPinching: boolean;
}

export const HandCursorOverlay: React.FC<HandCursorOverlayProps> = ({ hands, isPinching }) => {
  if (!hands || hands.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-35 overflow-hidden">
      {hands.map((hand, idx) => {
        const x = hand.indexTip.x * 100;
        const y = hand.indexTip.y * 100;
        const isTargetLocked = hand.hoveredInstrument !== null;
        const pinching = hand.isPinching || isPinching;

        return (
          <div
            key={hand.id || idx}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            className="absolute transition-transform duration-75 ease-out will-change-transform"
          >
            {/* Outer Target Reticle Ring */}
            <div
              className={`relative flex items-center justify-center transition-all duration-150 ${
                pinching
                  ? 'w-14 h-14 scale-75'
                  : isTargetLocked
                  ? 'w-16 h-16 scale-110'
                  : 'w-12 h-12'
              }`}
            >
              {/* Outer Glowing Ring */}
              <div
                className={`absolute inset-0 rounded-full border-2 transition-colors duration-200 ${
                  pinching
                    ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-ping'
                    : isTargetLocked
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]'
                    : 'border-white/70 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                }`}
              />

              {/* Crosshair Lines */}
              <div className="absolute w-full h-[1.5px] bg-cyan-400/60" />
              <div className="absolute h-full w-[1.5px] bg-cyan-400/60" />

              {/* Center Fingertip Core */}
              <div
                className={`w-3.5 h-3.5 rounded-full transition-transform duration-100 ${
                  pinching
                    ? 'bg-amber-400 scale-150'
                    : isTargetLocked
                    ? 'bg-cyan-300 scale-125'
                    : 'bg-white'
                }`}
              />

              {/* Target Locked Badge */}
              {isTargetLocked && (
                <div className="absolute -bottom-6 px-2 py-0.5 rounded bg-black/80 border border-cyan-400/80 text-[10px] font-mono-tech text-cyan-300 whitespace-nowrap uppercase tracking-wider">
                  {hand.hoveredInstrument} {pinching ? '• ACTIVATED' : '• PINCH'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
