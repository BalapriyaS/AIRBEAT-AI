import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Maximize2,
  Minimize2,
  Music2,
  Sparkles,
  Volume2,
  VolumeX,
  Webcam
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

interface BottomDockProps {
  onToggleHowToPlay: () => void;
  onToggleSuperGuide: () => void;
  onOpenCalibration?: () => void;
  isCameraVisible: boolean;
  onToggleCameraVisible: () => void;
  reducedEffects: boolean;
  onToggleReducedEffects: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  onToggleHowToPlay,
  onToggleSuperGuide,
  onOpenCalibration,
  isCameraVisible,
  onToggleCameraVisible,
  reducedEffects,
  onToggleReducedEffects
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [sfxVolume, setSfxVolume] = useState<number>(0.72);
  const [musicVolume, setMusicVolume] = useState<number>(0.3);
  const [isMusicActive, setIsMusicActive] = useState<boolean>(true);

  const handleMuteToggle = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setMasterVolume(val);
  };

  const handleSfxVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSfxVolume(val);
    audioEngine.setSfxVolume(val);
  };

  const handleMusicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMusicVolume(val);
    audioEngine.setMusicVolume(val);
  };

  const handleMusicToggle = () => {
    if (isMusicActive) {
      audioEngine.stopBattleMusic();
      setIsMusicActive(false);
    } else {
      audioEngine.startBattleMusic();
      setIsMusicActive(true);
    }
  };

  return (
    <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-xl sm:max-w-2xl w-auto flex flex-col items-center pointer-events-auto">
      {/* Collapse / Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mb-1 px-3 py-1 text-[11px] font-mono-tech rounded-t-lg bg-[#111C2D]/90 border-t border-x border-[#1687FF]/40 text-slate-300 hover:text-[#00D9FF] transition-colors flex items-center gap-1 cursor-pointer shadow-lg"
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Show Dock</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Hide Dock</span>
          </>
        )}
      </button>

      {/* Main Glassmorphic Dock Container */}
      {!isCollapsed && (
        <div className="bg-[#111C2D]/90 backdrop-blur-md border border-[#1687FF]/40 rounded-2xl px-4 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Volume & Audio Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleMuteToggle}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded-lg bg-[#080D18] hover:bg-[#16253c] text-slate-300 hover:text-[#00D9FF] transition-colors cursor-pointer border border-[#1687FF]/40"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono-tech text-slate-400">MASTER</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                aria-label="Master volume"
                className="w-14 accent-[#00D9FF] cursor-pointer h-1.5 bg-[#080D18] rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono-tech text-slate-400">MUSIC</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={handleMusicVolumeChange}
                aria-label="Music volume"
                className="w-14 accent-[#00D9FF] cursor-pointer h-1.5 bg-[#080D18] rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono-tech text-slate-400">SFX</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sfxVolume}
                onChange={handleSfxVolumeChange}
                aria-label="Sound effects volume"
                className="w-14 accent-[#00D9FF] cursor-pointer h-1.5 bg-[#080D18] rounded-lg"
              />
            </div>

            <button
              onClick={handleMusicToggle}
              title="Toggle Beat Track"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono-tech cursor-pointer transition-colors ${
                isMusicActive
                  ? 'border-[#00D9FF]/50 bg-[#1687FF]/20 text-[#00D9FF]'
                  : 'border-[#1687FF]/30 bg-[#080D18] text-slate-400'
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span>BEAT: {isMusicActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Center: Camera preview toggle & Calibration */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleReducedEffects}
              aria-pressed={reducedEffects}
              title="Reduce camera shake and bright flashes"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono-tech cursor-pointer transition-colors ${
                reducedEffects
                  ? 'border-[#A78BFA]/50 bg-[#A78BFA]/15 text-[#C4B5FD]'
                  : 'border-[#1687FF]/30 bg-[#080D18] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>FX: {reducedEffects ? 'REDUCED' : 'FULL'}</span>
            </button>
            <button
              onClick={onToggleCameraVisible}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                isCameraVisible
                  ? 'border-[#00D9FF]/50 bg-[#1687FF]/20 text-[#00D9FF]'
                  : 'border-[#1687FF]/30 bg-[#080D18] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Webcam className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span>Preview: {isCameraVisible ? 'Visible' : 'Hidden'}</span>
            </button>

            {onOpenCalibration && (
              <button
                onClick={onOpenCalibration}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#080D18] hover:bg-[#16253c] border border-[#1687FF]/40 text-slate-300 hover:text-[#00D9FF] cursor-pointer transition-colors text-xs font-mono-tech"
                title="Test and Calibrate Hand Tracking"
              >
                <span>Calibrate</span>
              </button>
            )}
          </div>

          {/* Right: Info & Super Combos Guide */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSuperGuide}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#080D18] hover:bg-[#16253c] border border-[#A78BFA]/50 text-[#A78BFA] cursor-pointer transition-colors font-mono-tech"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Super Attacks</span>
            </button>

            <button
              onClick={onToggleHowToPlay}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#080D18] hover:bg-[#16253c] border border-[#1687FF]/40 text-slate-300 hover:text-[#00D9FF] cursor-pointer transition-colors font-mono-tech"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span>How To Play</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
