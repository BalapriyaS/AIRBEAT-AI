import React from 'react';
import {
  Flame,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Zap
} from 'lucide-react';
import { GameStats, JudgmentRating, MonsterState, RhythmChallenge } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';
import { audioEngine } from '../audio/AudioEngine';

interface JudgmentFeedbackState {
  rating: JudgmentRating;
  scoreAdd: number;
  text: string;
  id: number;
}

interface TopHUDProps {
  stats: GameStats;
  monster: MonsterState;
  currentChallenge: RhythmChallenge | null;
  challengeProgress: number; // 1..0
  judgmentFeedback: JudgmentFeedbackState | null;
  superAttackGauge: number;
  activePrompt: string | null;
  superAttackNotification: string | null;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onRestart?: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  stats,
  monster,
  currentChallenge,
  challengeProgress,
  judgmentFeedback,
  superAttackGauge,
  activePrompt,
  superAttackNotification,
  isPaused = false,
  onTogglePause,
  onRestart
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = stats.timeRemaining <= 30;
  const groovePercent = Math.max(0, Math.min(100, monster.grooveLevel));
  const targetInst = currentChallenge ? INSTRUMENTS[currentChallenge.targetInstrument] : null;
  const activeSolo = audioEngine.getActiveInstrument();

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none p-2 sm:p-4 flex flex-col items-center">
      {/* 1. Top Status Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Score & Combo */}
        <div className="flex items-center gap-2.5 sm:gap-3 bg-black/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-700/70 shadow-xl pointer-events-auto">
          <div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech tracking-wider uppercase">
              SCORE
            </div>
            <div className="text-base sm:text-xl font-heading font-extrabold text-cyan-400 tracking-wider">
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-700/60" />

          <div className="flex items-center gap-1.5">
            <Flame
              className={`w-4 h-4 ${
                stats.feverActive
                  ? 'text-amber-400 fill-amber-400 animate-bounce'
                  : stats.combo > 1
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-500'
              }`}
            />
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech uppercase flex items-center gap-1">
                <span>COMBO</span>
                {stats.feverActive && (
                  <span className="text-[8px] bg-amber-500/20 text-amber-300 font-bold px-1 rounded-xs">
                    FEVER
                  </span>
                )}
              </div>
              <div
                className={`text-sm sm:text-base font-heading font-bold ${
                  stats.feverActive
                    ? 'text-amber-300 animate-pulse'
                    : stats.combo > 2
                    ? 'text-amber-300'
                    : 'text-slate-200'
                }`}
              >
                x{stats.combo}
              </div>
            </div>
          </div>
        </div>

        {/* Center: DANCE GROOVE PROGRESS BAR */}
        <div className="flex-1 max-w-md bg-black/85 backdrop-blur-md px-3.5 py-1.5 sm:py-2 rounded-xl border border-cyan-500/40 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-heading font-bold text-cyan-300 tracking-wide flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400 inline-block animate-pulse" />
              {monster.name}
            </span>
            <span className="font-mono-tech font-bold text-amber-300 text-[11px] sm:text-xs">
              GROOVE {groovePercent}%
            </span>
          </div>

          {/* Groove Meter Bar Track */}
          <div className="relative w-full h-3 rounded-full bg-slate-900 border border-slate-700 overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                stats.feverActive
                  ? 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500'
              }`}
              style={{ width: `${groovePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono-tech text-slate-400 mt-1">
            <span>{monster.title}</span>
            <span className="text-cyan-400">TARGET: 100% TO MASTER</span>
          </div>
        </div>

        {/* Right: Round Countdown Timer & Pause Button */}
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-700/70 shadow-xl pointer-events-auto">
          <Timer className={`w-4 h-4 ${isLowTime ? 'text-rose-400' : 'text-cyan-400'}`} />
          <div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech uppercase">
              TIME
            </div>
            <div
              className={`text-base sm:text-xl font-mono-tech font-bold ${
                isLowTime ? 'text-rose-400 animate-pulse' : 'text-cyan-300'
              }`}
            >
              {formatTime(stats.timeRemaining)}
            </div>
          </div>

          {onTogglePause && (
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Resume Round [Space]' : 'Pause Round [Space]'}
              className="ml-1 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current text-emerald-400" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Active 5-Second Solo Indicator Badge */}
      {activeSolo && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/90 border border-cyan-400/70 shadow-lg text-cyan-300 text-[11px] font-mono-tech pointer-events-auto animate-pulse">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>SOLO PLAYING: <strong>{INSTRUMENTS[activeSolo].name}</strong></span>
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 bg-cyan-400 h-2 animate-pulse" />
            <span className="w-0.5 bg-cyan-400 h-3 animate-pulse delay-75" />
            <span className="w-0.5 bg-cyan-400 h-1.5 animate-pulse delay-150" />
          </div>
        </div>
      )}

      {/* 2. RHYTHM CHALLENGE PROMPT BANNER */}
      {currentChallenge && targetInst && (
        <div className="w-full max-w-lg mt-2 bg-black/85 backdrop-blur-lg px-4 py-2 sm:py-2.5 rounded-2xl border-2 border-amber-400/80 shadow-2xl flex flex-col items-center pointer-events-auto">
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: `${targetInst.color}35`, borderColor: targetInst.color }}
                className="px-2.5 py-0.5 rounded-md border text-xs font-heading font-black tracking-widest uppercase text-white shadow"
              >
                {targetInst.name}
              </span>
              <span className="text-xs sm:text-sm font-heading font-bold text-amber-200 tracking-wide">
                {currentChallenge.instruction}
              </span>
            </div>
            <span className="text-[10px] font-mono-tech font-bold text-emerald-400 whitespace-nowrap">
              +{currentChallenge.points} PTS
            </span>
          </div>

          {/* Rhythm Countdown Beat Bar */}
          <div className="w-full h-1.5 mt-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              style={{
                width: `${challengeProgress * 100}%`,
                backgroundColor: challengeProgress > 0.4 ? '#22c55e' : '#f59e0b'
              }}
              className="h-full transition-all duration-75 rounded-full"
            />
          </div>
        </div>
      )}

      {/* 3. Floating Judgment Feedback Badge (PERFECT, GREAT, MISS, FEVER) */}
      {judgmentFeedback && (
        <div
          key={judgmentFeedback.id}
          className={`mt-2 px-5 py-1.5 rounded-xl font-heading font-black text-sm sm:text-base tracking-widest shadow-2xl animate-bounce backdrop-blur-md border ${
            judgmentFeedback.rating === 'FEVER'
              ? 'bg-gradient-to-r from-amber-500/90 to-fuchsia-600/90 text-white border-amber-300 scale-110'
              : judgmentFeedback.rating === 'PERFECT'
              ? 'bg-cyan-500/90 text-white border-cyan-200 shadow-cyan-500/50'
              : judgmentFeedback.rating === 'GREAT'
              ? 'bg-emerald-500/90 text-white border-emerald-200'
              : 'bg-rose-600/90 text-white border-rose-300'
          }`}
        >
          {judgmentFeedback.text}
        </div>
      )}

      {/* 4. Super Attack Energy Gauge */}
      <div className="w-full max-w-sm mt-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-purple-500/30">
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[9px] font-mono-tech text-purple-300 tracking-wider whitespace-nowrap">
          SUPER DANCE
        </span>
        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-purple-500/40">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              superAttackGauge >= 50
                ? 'bg-gradient-to-r from-purple-500 via-fuchsia-400 to-cyan-400 animate-pulse'
                : 'bg-purple-600'
            }`}
            style={{ width: `${superAttackGauge}%` }}
          />
        </div>
        <span className="text-[9px] font-mono-tech text-purple-300 whitespace-nowrap">
          {superAttackGauge >= 50 ? 'READY (PINCH 2)' : `${superAttackGauge}%`}
        </span>
      </div>

      {/* 5. Central Announcement Banner */}
      {activePrompt && (
        <div className="mt-2 px-4 py-1.5 rounded-lg bg-black/90 backdrop-blur-md border border-cyan-400/80 text-cyan-200 text-xs sm:text-sm font-heading font-bold tracking-wide shadow-2xl text-center animate-bounce">
          {activePrompt}
        </div>
      )}

      {/* 6. Super Attack Notification */}
      {superAttackNotification && (
        <div className="mt-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-900/95 to-cyan-900/95 backdrop-blur-md border-2 border-amber-400 text-white font-heading font-extrabold text-sm sm:text-base tracking-widest shadow-2xl animate-pulse">
          ⚡ {superAttackNotification} ⚡
        </div>
      )}

      {/* 7. PAUSE OVERLAY MODAL */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="max-w-sm w-full bg-slate-950/95 border-2 border-cyan-500/60 rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center">
            <Pause className="w-12 h-12 text-cyan-400 mb-3" />
            <h2 className="text-3xl font-heading font-extrabold text-white mb-1">
              GAME PAUSED
            </h2>
            <p className="text-xs text-slate-400 font-mono-tech mb-6">
              Round timer is paused. Take a breath or adjust your webcam!
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={onTogglePause}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-heading font-bold text-base tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME ROUND</span>
              </button>

              {onRestart && (
                <button
                  onClick={onRestart}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESTART ROUND</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
