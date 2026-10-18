import React, { useEffect, useRef, useState } from 'react';
import { Activity, Disc, Drum, Music, Volume2, Zap } from 'lucide-react';
import { InstrumentId, TrackedHand } from '../types/game';
import { INSTRUMENT_LIST } from '../game/instrumentsConfig';
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
  const lastActivationTime = useRef<number>(0);

  // Poll active instrument solo state from AudioEngine for visualizer animation
  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = audioEngine.getActiveInstrument();
      setActiveSolo(active);
    }, 100);
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
    const now = performance.now();
    // 250ms debounce cooldown
    if (now - lastActivationTime.current < 250) return;
    lastActivationTime.current = now;

    setActiveAnimId(id);
    onActivateInstrument(id, variation);
    setTimeout(() => {
      setActiveAnimId((curr) => (curr === id ? null : curr));
    }, 450);
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
          <div className="flex gap-0.5 items-end justify-center w-6 h-6 sm:w-7 sm:h-7">
            <span className="w-1.5 h-4 bg-current rounded-xs" />
            <span className="w-1.5 h-3 bg-current rounded-xs" />
            <span className="w-1.5 h-5 bg-current rounded-xs" />
            <span className="w-1.5 h-4 bg-current rounded-xs" />
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {INSTRUMENT_LIST.map((inst, index) => {
        const isHovered = hoveredByHandSet.has(inst.id) || hoveredMouseId === inst.id;
        const isPulsing = activeAnimId === inst.id;
        const isRequired = requiredInstrument === inst.id;
        const isPlayingSolo = activeSolo === inst.id;

        return (
          <div
            key={inst.id}
            style={{
              left: `${inst.position.x * 100}%`,
              top: `${inst.position.y * 100}%`
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          >
            <button
              onClick={() => handlePadTrigger(inst.id, 0.5)}
              onMouseEnter={() => setHoveredMouseId(inst.id)}
              onMouseLeave={() => setHoveredMouseId(null)}
              className={`group relative flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 transition-all duration-200 cursor-pointer select-none backdrop-blur-md focus:outline-hidden ${
                isRequired
                  ? 'border-amber-400 bg-amber-950/80 shadow-xl shadow-amber-500/50 scale-110 animate-pulse'
                  : isPulsing
                  ? 'scale-120 border-white bg-slate-800 shadow-2xl'
                  : isPlayingSolo
                  ? 'border-cyan-300 bg-cyan-950/70 shadow-lg shadow-cyan-500/40 scale-105'
                  : isHovered
                  ? `border-white bg-slate-900/95 scale-110 ${inst.glowClass}`
                  : `border-slate-700/80 bg-slate-950/75 hover:scale-105 hover:border-slate-400`
              }`}
            >
              {/* Outer Rotating Target Ring */}
              <div
                className={`absolute inset-[-6px] rounded-full border border-dashed transition-all duration-500 pointer-events-none ${
                  isHovered || isRequired || isPulsing || isPlayingSolo
                    ? 'border-cyan-400 opacity-100 rotate-45'
                    : 'border-slate-600/40 opacity-40'
                }`}
              />

              {/* Pulsing ring on required weakness */}
              {isRequired && (
                <div className="absolute inset-[-10px] rounded-full border-2 border-amber-400 animate-ping pointer-events-none" />
              )}

              {/* Expanding Ripple Burst when Activated */}
              {isPulsing && (
                <div
                  style={{ borderColor: inst.color }}
                  className="absolute inset-[-14px] rounded-full border-2 animate-ping pointer-events-none"
                />
              )}

              {/* Audio-Reactive Waveform Bars if playing 5-second solo */}
              {isPlayingSolo ? (
                <div className="flex items-end gap-1 h-7 sm:h-8 mb-1">
                  <span className="w-1 bg-cyan-300 rounded-full animate-pulse h-4" />
                  <span className="w-1 bg-cyan-200 rounded-full animate-pulse h-7 delay-75" />
                  <span className="w-1 bg-cyan-400 rounded-full animate-pulse h-8 delay-150" />
                  <span className="w-1 bg-cyan-200 rounded-full animate-pulse h-5 delay-100" />
                  <span className="w-1 bg-cyan-300 rounded-full animate-pulse h-3 delay-200" />
                </div>
              ) : (
                /* Standard Icon */
                <div
                  style={{ color: inst.color }}
                  className="transition-transform duration-200 group-hover:scale-110 mb-0.5"
                >
                  {renderIcon(inst.iconName, 'w-8 h-8 sm:w-9 sm:h-9')}
                </div>
              )}

              <span className="text-[11px] sm:text-xs font-heading font-bold tracking-wider text-white">
                {inst.name}
              </span>

              {/* Hotkey number badge */}
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-slate-600 text-[10px] font-mono-tech flex items-center justify-center text-slate-300 shadow">
                {index + 1}
              </span>
            </button>

            {/* Hover Tooltip / Subtitle */}
            <div
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 rounded-lg bg-black/90 backdrop-blur-md border border-cyan-500/40 text-center whitespace-nowrap transition-all duration-200 pointer-events-none z-30 shadow-xl ${
                isHovered || isRequired ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
              }`}
            >
              <p className="text-[11px] font-semibold text-cyan-300 tracking-wide uppercase font-heading">
                {isRequired ? '⚡ PLAY NOW TO DANCE!' : inst.subtitle}
              </p>
              <p className="text-[9px] text-slate-300 font-mono-tech">
                {isHovered ? 'PINCH OR CLICK TO PLAY' : inst.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
