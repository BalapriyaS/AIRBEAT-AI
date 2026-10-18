import React from 'react';
import {
  Award,
  Camera,
  CheckCircle,
  Clock,
  Disc,
  Drum,
  HelpCircle,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  X,
  Zap
} from 'lucide-react';
import { GameStats } from '../types/game';
import { INSTRUMENT_LIST, SUPER_ATTACK_LIST } from '../game/instrumentsConfig';

// ==================== START SCREEN ====================
interface StartScreenProps {
  onStart: () => void;
  onOpenCalibration: () => void;
  onOpenHowToPlay: () => void;
  onOpenSuperGuide: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onOpenCalibration,
  onOpenHowToPlay,
  onOpenSuperGuide
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-2xl w-full text-center flex flex-col items-center">
        {/* Futuristic Cyber Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-mono-tech mb-4 tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>HAND-GESTURE 3D DANCING MONSTER RHYTHM GAME</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white mb-2 font-heading">
          AIRBEAT <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400">AI</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-slate-300 font-medium italic mb-8">
          Control Virtual Instruments with Your Hands. Make the 3D Monster Dance!
        </p>

        {/* 6 Instrument Badges Preview */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-xl mb-8">
          {INSTRUMENT_LIST.map((inst) => (
            <div
              key={inst.id}
              className="flex flex-col items-center p-2 rounded-xl bg-slate-900/70 border border-slate-700/60"
            >
              <div style={{ color: inst.color }} className="text-sm font-heading font-bold">
                {inst.name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tech truncate">
                {inst.subtitle}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <button
            onClick={onStart}
            className="flex-1 w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-heading font-bold text-lg tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START DANCING</span>
          </button>

          <button
            onClick={onOpenCalibration}
            className="w-full sm:w-auto px-5 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>CALIBRATE</span>
          </button>
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs font-mono-tech text-slate-400">
          <button
            onClick={onOpenHowToPlay}
            className="hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>HOW TO PLAY</span>
          </button>
          <span>•</span>
          <button
            onClick={onOpenSuperGuide}
            className="hover:text-purple-300 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SUPER DANCES</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== HOW TO PLAY MODAL ====================
export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="max-w-xl w-full bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-heading font-bold text-cyan-400 mb-1 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-cyan-400" />
          HOW TO PLAY AIRBEAT AI
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-mono-tech">
          Follow the musical challenges to make the 3D creature dance using real-time webcam hand tracking or mouse clicks!
        </p>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30">
            <h3 className="font-heading font-bold text-white mb-1 text-cyan-300">
              1. Follow the Rhythm Challenge
            </h3>
            <p className="text-xs text-slate-400">
              The top banner announces which instrument to play (e.g. Drums to stomp, Guitar to headbang). That instrument circle lights up and pulses!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30">
            <h3 className="font-heading font-bold text-white mb-1 text-amber-300">
              2. Hover & Pinch (or Click)
            </h3>
            <p className="text-xs text-slate-400">
              Move your index fingertip over the highlighted instrument circle and pinch your thumb and index together (or click with your mouse).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30">
            <h3 className="font-heading font-bold text-white mb-1 text-emerald-300">
              3. Monster Performs Synchronized Dance
            </h3>
            <p className="text-xs text-slate-400">
              The creature instantly performs the matching dance move! Drums stomp with knee bends, Guitar headbangs, Piano swags, Trumpet marches, Violin pirouettes, and DJ breakdance drops!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30">
            <h3 className="font-heading font-bold text-white mb-1 text-purple-300">
              4. Combos, Fever Mode & Two-Hand Super Dances
            </h3>
            <p className="text-xs text-slate-400">
              Time your hits accurately to score PERFECT ratings (+700) and build combos. Reach 5x combo to unlock FEVER MODE! Pinch 2 instruments with both hands for cosmic super dances!
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-heading font-bold cursor-pointer transition-colors"
        >
          LET'S DANCE!
        </button>
      </div>
    </div>
  );
};

// ==================== SUPER ATTACK GUIDE MODAL ====================
export const SuperAttackGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="max-w-xl w-full bg-slate-900 border border-purple-500/50 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-heading font-bold text-purple-400 mb-1 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" />
          TWO-HAND SUPER ATTACKS
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-mono-tech">
          Pinch both hands simultaneously on these pairs to trigger ultimate attacks!
        </p>

        <div className="space-y-4">
          {SUPER_ATTACK_LIST.map((superAttack) => (
            <div
              key={superAttack.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/40 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-base text-amber-300 tracking-wider">
                  ⚡ {superAttack.name}
                </span>
                <span className="text-xs font-mono-tech text-purple-300 font-bold">
                  {superAttack.damage} DAMAGE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono-tech text-cyan-300 uppercase">
                <span>{superAttack.instruments[0]}</span>
                <span>+</span>
                <span>{superAttack.instruments[1]}</span>
              </div>
              <p className="text-xs text-slate-400">{superAttack.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-heading font-bold cursor-pointer transition-colors"
        >
          BACK TO GAME
        </button>
      </div>
    </div>
  );
};

// ==================== VICTORY SCREEN ====================
export const VictoryScreen: React.FC<{ stats: GameStats; onReplay: () => void }> = ({
  stats,
  onReplay
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-lg w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
          <Trophy className="w-9 h-9" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white font-heading mb-2">
          VICTORY!
        </h1>
        <p className="text-cyan-300 font-medium text-sm mb-6 font-mono-tech">
          ALL MONSTERS DEFEATED • ARENA SAVED BY THE POWER OF MUSIC!
        </p>

        {/* Performance Title Badge */}
        <div className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-900 to-cyan-900 border border-amber-400/80 text-amber-300 font-heading font-bold text-lg mb-6 shadow-xl">
          RANK: {stats.rankTitle}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
            <div className="text-[11px] text-slate-400 font-mono-tech uppercase">FINAL SCORE</div>
            <div className="text-2xl font-heading font-extrabold text-cyan-400">
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
            <div className="text-[11px] text-slate-400 font-mono-tech uppercase">MAX COMBO</div>
            <div className="text-2xl font-heading font-extrabold text-amber-400">
              x{stats.maxCombo}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
            <div className="text-[11px] text-slate-400 font-mono-tech uppercase">SUPER ATTACKS</div>
            <div className="text-2xl font-heading font-extrabold text-purple-400">
              {stats.superAttacksUsed}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
            <div className="text-[11px] text-slate-400 font-mono-tech uppercase">TIME REMAINING</div>
            <div className="text-2xl font-heading font-extrabold text-emerald-400">
              {stats.timeRemaining}s
            </div>
          </div>
        </div>

        <button
          onClick={onReplay}
          className="w-full max-w-xs py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-heading font-bold text-base tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
          <span>PLAY AGAIN</span>
        </button>
      </div>
    </div>
  );
};

// ==================== GAME OVER SCREEN ====================
export const GameOverScreen: React.FC<{ stats: GameStats; onReplay: () => void }> = ({
  stats,
  onReplay
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        <Clock className="w-14 h-14 text-rose-500 mb-3" />

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white font-heading mb-2">
          TIME EXPIRED!
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          The 3-minute round ended! Outstanding dance moves in the arena.
        </p>

        <div className="w-full p-4 rounded-xl bg-slate-900/80 border border-rose-500/40 mb-6">
          <div className="text-xs text-slate-400 font-mono-tech uppercase">TOTAL SCORE</div>
          <div className="text-3xl font-heading font-extrabold text-cyan-400 my-1">
            {stats.score.toLocaleString()}
          </div>
          <div className="text-sm font-heading font-semibold text-amber-300">
            RANK: {stats.rankTitle}
          </div>
        </div>

        <button
          onClick={onReplay}
          className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-heading font-bold text-base tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          <span>TRY AGAIN</span>
        </button>
      </div>
    </div>
  );
};
