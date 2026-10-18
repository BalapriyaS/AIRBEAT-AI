import React from 'react';
import { TrackedHand } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';

interface HandCursorOverlayProps {
  hands: TrackedHand[];
  isPinching: boolean;
}

export const HandCursorOverlay: React.FC<HandCursorOverlayProps> = ({ hands, isPinching }) => {
  if (!hands || hands.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-35 overflow-hidden">
      {hands.map((hand, idx) => {
        const xPercent = hand.indexTip.x * 100;
        const yPercent = hand.indexTip.y * 100;
        const isTargetLocked = hand.hoveredInstrument !== null;
        const isTriggered = hand.isTriggering || hand.isPinching || isPinching;
        const targetColor = hand.hoveredInstrument ? INSTRUMENTS[hand.hoveredInstrument]?.color || '#00D9FF' : '#00D9FF';
        const hoverProgress = hand.hoverProgress || 0;

        // Radius for radial dwell charge ring
        const radius = 26;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - hoverProgress * circumference;

        return (
          <div
            key={hand.id || idx}
            style={{
              left: `${xPercent}%`,
              top: `${yPercent}%`,
              transform: 'translate(-50%, -50%)'
            }}
            // NO CSS transition here to ensure instantaneous zero-lag responsiveness!
            className="absolute will-change-transform"
          >
            {/* Target Reticle Container */}
            <div className="relative flex items-center justify-center w-20 h-20">
              {/* Radial Dwell Charge Ring (Visible when hovering over an instrument) */}
              {isTargetLocked && hoverProgress > 0 && (
                <svg className="absolute w-16 h-16 -rotate-90 pointer-events-none">
                  <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    fill="transparent"
                    stroke={targetColor}
                    strokeWidth="3.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                </svg>
              )}

              {/* Outer Reticle Ring */}
              <div
                style={{
                  borderColor: isTriggered ? '#00D9FF' : isTargetLocked ? targetColor : 'rgba(0, 217, 255, 0.7)',
                  boxShadow: isTriggered
                    ? '0 0 25px rgba(0, 217, 255, 0.95), inset 0 0 10px rgba(0, 217, 255, 0.5)'
                    : isTargetLocked
                    ? `0 0 20px ${targetColor}99, inset 0 0 8px ${targetColor}66`
                    : '0 0 12px rgba(0, 217, 255, 0.4)'
                }}
                className={`rounded-full border-2 transition-transform duration-100 ${
                  isTriggered
                    ? 'w-14 h-14 scale-125 animate-ping'
                    : isTargetLocked
                    ? 'w-13 h-13 scale-110'
                    : 'w-10 h-10'
                }`}
              />

              {/* Pulsing Target Lock Orbit Dots */}
              {isTargetLocked && !isTriggered && (
                <>
                  <span
                    style={{ backgroundColor: targetColor }}
                    className="absolute -top-1 w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  />
                  <span
                    style={{ backgroundColor: targetColor }}
                    className="absolute -bottom-1 w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  />
                  <span
                    style={{ backgroundColor: targetColor }}
                    className="absolute -left-1 w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  />
                  <span
                    style={{ backgroundColor: targetColor }}
                    className="absolute -right-1 w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  />
                </>
              )}

              {/* Crosshair Lines */}
              <div
                style={{ backgroundColor: isTargetLocked ? targetColor : 'rgba(0, 217, 255, 0.7)' }}
                className="absolute w-8 h-[1.5px] pointer-events-none opacity-80"
              />
              <div
                style={{ backgroundColor: isTargetLocked ? targetColor : 'rgba(0, 217, 255, 0.7)' }}
                className="absolute h-8 w-[1.5px] pointer-events-none opacity-80"
              />

              {/* Center Fingertip Core Bead */}
              <div
                style={{
                  backgroundColor: isTriggered ? '#00D9FF' : isTargetLocked ? targetColor : '#F1F5F9',
                  boxShadow: isTriggered
                    ? '0 0 15px #00D9FF'
                    : isTargetLocked
                    ? `0 0 12px ${targetColor}`
                    : '0 0 8px rgba(0, 217, 255, 0.8)'
                }}
                className={`rounded-full transition-transform duration-75 ${
                  isTriggered ? 'w-4 h-4 scale-150' : isTargetLocked ? 'w-3.5 h-3.5 scale-110' : 'w-2.5 h-2.5'
                }`}
              />

              {/* Target Locked Floating Badge */}
              {isTargetLocked && (
                <div
                  style={{
                    borderColor: targetColor,
                    boxShadow: `0 4px 15px rgba(0, 0, 0, 0.8), 0 0 10px ${targetColor}40`
                  }}
                  className="absolute -bottom-7 px-2.5 py-0.5 rounded-full bg-[#111C2D]/95 border text-[10px] font-mono-tech whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5"
                >
                  <span
                    style={{ backgroundColor: targetColor }}
                    className="w-1.5 h-1.5 rounded-full animate-ping"
                  />
                  <span style={{ color: targetColor }} className="font-bold">
                    {hand.hoveredInstrument}
                  </span>
                  <span className="text-[#F1F5F9] text-[9px]">
                    {isTriggered ? '• HIT! ⚡' : hoverProgress > 0 ? `• ${Math.round(hoverProgress * 100)}%` : '• AIR-TAP'}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
