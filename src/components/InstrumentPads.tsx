import React, { useEffect, useRef, useState } from 'react';
import { Activity, Disc, Drum, Music, Volume2, Zap } from 'lucide-react';
import { InstrumentId, TrackedHand } from '../types/game';
import { INSTRUMENT_LIST } from '../game/instrumentsConfig';
import { GAME_CONFIG } from '../game/gameConfig';
import { audioEngine } from '../audio/AudioEngine';

interface InstrumentPadsProps {
  hands: TrackedHand[];
  onActivateInstrument: (id: InstrumentId, variation?: number) => void;
  requiredInstrument?: InstrumentId;
}

export const InstrumentPads: React.FC<InstrumentPadsProps> = ({
  hands,
  onActivateInstrument,
  requiredInstrument
}) => {
  const [activeAnimId, setActiveAnimId] = useState<InstrumentId | null>(null);
  const [hoveredMouseId, setHoveredMouseId] = useState<InstrumentId | null>(null);
  const [activeSolo, setActiveSolo] = useState<InstrumentId | null>(null);
  const [soloRemainingSec, setSoloRemainingSec] = useState<number>(0);
  const [soloProgress, setSoloProgress] = useState<number>(0);
  const lastActivationTime = useRef<number>(0);

  // Poll the short active-instrument indicator from AudioEngine
  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = audioEngine.getActiveInstrument();
      setActiveSolo(active);
      if (active) {
        setSoloRemainingSec(audioEngine.getSoloRemainingSeconds());
        setSoloProgress(audioEngine.getSoloProgress());
      } else {
        setSoloRemainingSec(0);
        setSoloProgress(0);
      }
    }, 60);
    return () => clearInterval(timer);
  }, []);

  // Check which instruments are currently hovered by tracked hands
  const hoveredByHandSet = new Set<InstrumentId>();
  for (const h of hands) {
    if (h.hoveredInstrument) {
      hoveredByHandSet.add(h.hoveredInstrument);
    }
  }

  const handlePadTrigger = (id: InstrumentId, variation: number = 0.5) => {
    audioEngine.ensureContext();
    const now = performance.now();
    if (now - lastActivationTime.current < GAME_CONFIG.padInputCooldownMs) return;
    lastActivationTime.current = now;

    setActiveAnimId(id);
    onActivateInstrument(id, variation);
    setTimeout(() => {
      setActiveAnimId((curr) => (curr === id ? null : curr));
    }, 350);
  };

  const renderIcon = (name: string, className: string) => {
    switch (name) {
      case 'Drum':
        return <Drum className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Volume2':
        return <Volume2 className={className} />;
      case 'Music':
        return <Music className={className} />;
      case 'Disc':
        return <Disc className={className} />;
      case 'Piano':
      default:
        return (
          <div className="flex gap-1 items-end justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12">
            <span className="w-1.5 sm:w-2 h-5 sm:h-7 bg-current rounded-xs" />
            <span className="w-1.5 sm:w-2 h-3.5 sm:h-5 bg-current rounded-xs" />
            <span className="w-1.5 sm:w-2 h-7 sm:h-9 bg-current rounded-xs" />
            <span className="w-1.5 sm:w-2 h-5 sm:h-7 bg-current rounded-xs" />
          </div>
        );
    }
  };

  // Extract hover progress for each instrument
  const hoverProgressMap = new Map<InstrumentId, number>();
  for (const h of hands) {
    if (h.hoveredInstrument && h.hoverProgress) {
      hoverProgressMap.set(h.hoveredInstrument, Math.max(hoverProgressMap.get(h.hoveredInstrument) || 0, h.hoverProgress));
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {INSTRUMENT_LIST.map((inst, index) => {
        const isHovered = hoveredByHandSet.has(inst.id) || hoveredMouseId === inst.id;
        const isPulsing = activeAnimId === inst.id;
        const isRequired = requiredInstrument === inst.id;
        const isPlayingSolo = activeSolo === inst.id;
        const hoverProgress = hoverProgressMap.get(inst.id) || 0;

        return (
          <div
            key={inst.id}
            style={{
              left: `${inst.position.x * 100}%`,
              top: `${inst.position.y * 100}%`
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          >
            {/* Outer Rotating Cyber Arc */}
            <div
              style={{
                borderColor: inst.color,
                opacity: isHovered || isRequired || isPulsing || isPlayingSolo ? 0.95 : 0.3
              }}
              className={`absolute inset-[-14px] sm:inset-[-18px] rounded-full border-2 border-dashed pointer-events-none transition-all duration-700 ${
                isPulsing ? 'scale-125 rotate-90' : isHovered ? 'scale-110 rotate-45' : 'scale-100 rotate-0'
              }`}
            />

            {/* 5-Second Solo Countdown SVG Ring */}
            {isPlayingSolo && (
              <svg className="absolute inset-[-18px] sm:inset-[-22px] w-[calc(100%+36px)] sm:w-[calc(100%+44px)] h-[calc(100%+36px)] sm:h-[calc(100%+44px)] -rotate-90 pointer-events-none">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke={inst.color}
                  strokeWidth="4.5"
                  strokeDasharray="480"
                  strokeDashoffset={480 * soloProgress}
                  strokeLinecap="round"
                  className="transition-all duration-75 drop-shadow-[0_0_10px_currentColor]"
                />
              </svg>
            )}

            {/* Glowing Dwell Charge SVG Ring */}
            {hoverProgress > 0 && !isPlayingSolo && (
              <svg className="absolute inset-[-16px] sm:inset-[-20px] w-[calc(100%+32px)] sm:w-[calc(100%+40px)] h-[calc(100%+32px)] sm:h-[calc(100%+40px)] -rotate-90 pointer-events-none">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke={inst.color}
                  strokeWidth="5"
                  strokeDasharray="480"
                  strokeDashoffset={480 - hoverProgress * 480}
                  strokeLinecap="round"
                  className="transition-all duration-75 drop-shadow-[0_0_8px_currentColor]"
                />
              </svg>
            )}

            {/* Pulsing ring on required rhythm target */}
            {isRequired && (
              <div
                style={{ borderColor: inst.color }}
                className="absolute inset-[-18px] sm:inset-[-22px] rounded-full border-2 sm:border-3 animate-ping pointer-events-none"
              />
            )}

            {/* Expanding Ripple Burst when Activated */}
            {isPulsing && (
              <div
                style={{ borderColor: inst.color, boxShadow: `0 0 40px ${inst.color}` }}
                className="absolute inset-[-24px] rounded-full border-4 animate-ping pointer-events-none"
              />
            )}

            {/* Interactive Holographic Pad Button (Significantly Enlarged) */}
            <button
              onClick={() => handlePadTrigger(inst.id, 0.5)}
              onMouseEnter={() => setHoveredMouseId(inst.id)}
              onMouseLeave={() => setHoveredMouseId(null)}
              style={{
                boxShadow: isPulsing
                  ? `0 0 45px ${inst.color}, inset 0 0 25px ${inst.color}99`
                  : isRequired
                  ? `0 0 45px #00D9FF, inset 0 0 22px rgba(0, 217, 255, 0.5)`
                  : isHovered
                  ? `0 0 35px ${inst.color}ee, inset 0 0 16px ${inst.color}77`
                  : isPlayingSolo
                  ? `0 0 40px ${inst.color}, inset 0 0 20px ${inst.color}88`
                  : `0 8px 28px rgba(0, 0, 0, 0.75)`
              }}
              className={`group relative flex flex-col items-center justify-center w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-full border-2 sm:border-3 transition-all duration-200 cursor-pointer select-none backdrop-blur-2xl focus:outline-hidden ${
                isRequired
                  ? 'border-[#00D9FF] bg-[#111C2D]/95 scale-110 animate-pulse'
                  : isPulsing
                  ? 'scale-120 border-white bg-[#111C2D]'
                  : isPlayingSolo
                  ? 'scale-110 border-[#00D9FF] bg-[#111C2D]/95 shadow-2xl'
                  : isHovered
                  ? 'scale-110 border-white bg-[#111C2D]/95'
                  : 'border-[#1687FF]/50 bg-[#111C2D]/90 hover:scale-105 hover:border-[#00D9FF]'
              }`}
            >
              {/* Inner Gradient Disc Overlay */}
              <div
                style={{
                  background: isHovered || isRequired || isPulsing || isPlayingSolo
                    ? `radial-gradient(circle, ${inst.color}45 0%, transparent 70%)`
                    : 'none'
                }}
                className="absolute inset-0 rounded-full pointer-events-none"
              />

              {/* Audio-Reactive Waveform Bars if playing active solo */}
              {isPlayingSolo ? (
                <div className="flex items-end gap-1.5 h-10 sm:h-12 mb-1.5">
                  <span style={{ backgroundColor: inst.color }} className="w-2 sm:w-2.5 rounded-full animate-pulse h-6" />
                  <span style={{ backgroundColor: inst.color }} className="w-2 sm:w-2.5 rounded-full animate-pulse h-10 delay-75" />
                  <span style={{ backgroundColor: inst.color }} className="w-2 sm:w-2.5 rounded-full animate-pulse h-12 delay-150" />
                  <span style={{ backgroundColor: inst.color }} className="w-2 sm:w-2.5 rounded-full animate-pulse h-8 delay-100" />
                  <span style={{ backgroundColor: inst.color }} className="w-2 sm:w-2.5 rounded-full animate-pulse h-5 delay-200" />
                </div>
              ) : (
                /* Standard Icon (Enlarged) */
                <div
                  style={{ color: inst.color }}
                  className="transition-transform duration-200 group-hover:scale-115 mb-1 drop-shadow-[0_0_12px_currentColor]"
                >
                  {renderIcon(inst.iconName, 'w-11 h-11 sm:w-13 sm:h-13 md:w-15 md:h-15')}
                </div>
              )}

              {/* Instrument Title (Enlarged) */}
              <span className="text-sm sm:text-base md:text-lg font-heading font-black tracking-wider text-[#F1F5F9] drop-shadow-md">
                {inst.name}
              </span>

              {/* Subtitle / Move pill / 5-Second Solo Countdown */}
              <span
                style={{ color: inst.color }}
                className="text-[10px] sm:text-xs font-mono-tech tracking-tight font-bold mt-0.5"
              >
                {isPlayingSolo
                  ? `🎶 ${(soloRemainingSec > 0 ? soloRemainingSec : 5.0).toFixed(1)}s SOLO`
                  : isHovered
                  ? '⚡ AIR-TAP'
                  : inst.subtitle.split('&')[0]}
              </span>

              {/* Hotkey number badge (Enlarged) */}
              <span
                style={{ borderColor: inst.color }}
                className="absolute -top-1.5 -right-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#080D18] border-2 text-xs sm:text-sm font-mono-tech font-black flex items-center justify-center text-[#F1F5F9] shadow-xl"
              >
                {index + 1}
              </span>
            </button>

            {/* Hover Tooltip / Subtitle (Anchored inward towards center arena) */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 ${
                inst.side === 'left' ? 'left-full ml-3.5 text-left' : 'right-full mr-3.5 text-right'
              } px-3.5 py-2 rounded-xl bg-[#111C2D]/95 backdrop-blur-md border border-[#1687FF]/50 whitespace-nowrap transition-all duration-200 pointer-events-none z-30 shadow-2xl ${
                isHovered || isRequired ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-heading" style={{ color: inst.color }}>
                <span>{isRequired ? '⚡ RHYTHM CHALLENGE TARGET!' : inst.name}</span>
                <span className="text-[10px] text-slate-300 font-normal">({inst.subtitle})</span>
              </div>
              <p className="text-[10px] text-slate-300 font-mono-tech mt-0.5">
                {isHovered ? '👉 Air-Tap, Pinch, or Click to Play!' : inst.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
