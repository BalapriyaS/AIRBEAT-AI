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
}

export const BottomDock: React.FC<BottomDockProps> = ({
  onToggleHowToPlay,
  onToggleSuperGuide,
  onOpenCalibration,
  isCameraVisible,
  onToggleCameraVisible
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
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
    <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[min(940px,94vw)] w-full flex flex-col items-center pointer-events-auto">
      {/* Collapse / Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mb-1 px-3 py-1 text-[11px] font-mono-tech rounded-t-lg bg-slate-900/90 border-t border-x border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer shadow-lg"
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
        <div className="w-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Volume & Audio Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleMuteToggle}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer border border-slate-700"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-tech text-slate-400">VOL</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <button
              onClick={handleMusicToggle}
              title="Toggle Beat Track"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono-tech cursor-pointer transition-colors ${
                isMusicActive
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span>BEAT: {isMusicActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Center: Camera preview toggle & Calibration */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCameraVisible}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                isCameraVisible
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Webcam className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview: {isCameraVisible ? 'Visible' : 'Hidden'}</span>
            </button>

            {onOpenCalibration && (
              <button
                onClick={onOpenCalibration}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 cursor-pointer transition-colors text-xs font-mono-tech"
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
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/50 text-purple-300 cursor-pointer transition-colors font-mono-tech"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Super Attacks</span>
            </button>

            <button
              onClick={onToggleHowToPlay}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 cursor-pointer transition-colors font-mono-tech"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>How To Play</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
