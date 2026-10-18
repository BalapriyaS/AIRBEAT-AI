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
import { handTracker } from '../vision/HandTracker';

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

  const isLowTime = stats.timeRemaining <= 20;
  const groovePercent = Math.max(0, Math.min(100, monster.grooveLevel));
  const targetInst = currentChallenge ? INSTRUMENTS[currentChallenge.targetInstrument] : null;
  const activeSolo = audioEngine.getActiveInstrument();

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none p-2 sm:p-4 flex flex-col items-center">
      {/* 1. Top Status Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Score & Combo */}
        <div className="flex items-center gap-2.5 sm:gap-3 bg-[#111C2D]/95 backdrop-blur-md px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-[#1687FF]/40 shadow-2xl pointer-events-auto">
          <div>
            <div className="text-[9px] sm:text-[10px] text-[#00D9FF] font-mono-tech font-bold tracking-widest uppercase">
              SCORE
            </div>
            <div className="text-lg sm:text-2xl font-arcade font-black text-[#00D9FF] drop-shadow-[0_0_15px_rgba(0,217,255,0.6)] tracking-tight">
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div className="h-7 w-px bg-[#1687FF]/40" />

          <div className="flex items-center gap-1.5">
            <Flame
              className={`w-5 h-5 ${
                stats.feverActive
                  ? 'text-[#00D9FF] fill-[#00D9FF] animate-bounce'
                  : stats.combo > 1
                  ? 'text-[#00D9FF] fill-[#00D9FF]'
                  : 'text-slate-500'
              }`}
            />
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech uppercase flex items-center gap-1">
                <span>COMBO</span>
                {stats.feverActive && (
                  <span className="text-[8px] bg-[#1687FF]/30 text-[#00D9FF] font-bold px-1 rounded-xs">
                    FEVER 2.5X
                  </span>
                )}
              </div>
              <div
                className={`text-sm sm:text-base font-arcade font-black ${
                  stats.feverActive
                    ? 'text-[#00D9FF] animate-pulse'
                    : stats.combo > 2
                    ? 'text-[#00D9FF]'
                    : 'text-slate-200'
                }`}
              >
                x{stats.combo}
              </div>
            </div>
          </div>
        </div>

        {/* Center: DANCE GROOVE PROGRESS BAR */}
        <div className="flex-1 max-w-md bg-[#111C2D]/95 backdrop-blur-md px-3.5 py-1.5 sm:py-2 rounded-xl border border-[#1687FF]/40 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-heading font-bold text-[#00D9FF] tracking-wide flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#00D9FF] inline-block animate-pulse" />
              {monster.name}
            </span>
            <span className="font-mono-tech font-bold text-[#00D9FF] text-[11px] sm:text-xs">
              GROOVE {groovePercent}%
            </span>
          </div>

          {/* Groove Meter Bar Track */}
          <div className="relative w-full h-3 rounded-full bg-[#080D18] border border-slate-800 overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                stats.feverActive
                  ? 'bg-gradient-to-r from-[#1687FF] via-[#00D9FF] to-[#A78BFA] animate-pulse'
                  : 'bg-gradient-to-r from-[#1687FF] to-[#00D9FF]'
              }`}
              style={{ width: `${groovePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono-tech text-slate-400 mt-1">
            <span className="truncate">{monster.title}</span>
            <div className="flex items-center gap-1.5 text-[#A78BFA] shrink-0">
              <Sparkles className="w-3 h-3 text-[#A78BFA]" />
              <span>
                SUPER:{' '}
                <strong
                  className={
                    superAttackGauge >= 50
                      ? 'text-[#00D9FF] font-bold animate-pulse'
                      : 'text-[#A78BFA]'
                  }
                >
                  {superAttackGauge >= 50 ? 'READY (PINCH 2)' : `${superAttackGauge}%`}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Round Countdown Timer & Reach Boost & Pause Button */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Student Reach Boost Toggle Badge */}
          <button
            onClick={() => {
              const current = handTracker.reachBoost;
              handTracker.setReachBoost(!current);
              // Force state refresh via custom event
              window.dispatchEvent(new Event('reach-boost-change'));
            }}
            title="Toggle Student Reach Assist: amplifies webcam motion so you can reach instruments effortlessly!"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111C2D]/90 hover:bg-[#16253c] border border-[#1687FF]/50 hover:border-[#00D9FF] text-[#00D9FF] text-xs font-mono-tech font-bold cursor-pointer transition-all shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00D9FF] animate-spin" />
            <span>REACH BOOST: ON</span>
          </button>

          {/* Time Counter */}
          <div className="flex items-center gap-2 bg-[#111C2D]/95 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-[#1687FF]/40 shadow-xl">
            <Timer className={`w-4 h-4 ${isLowTime ? 'text-rose-400' : 'text-[#00D9FF]'}`} />
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech uppercase">
                TIME
              </div>
              <div
                className={`text-base sm:text-xl font-mono-tech font-bold ${
                  isLowTime ? 'text-rose-400 animate-pulse' : 'text-[#00D9FF]'
                }`}
              >
                {formatTime(stats.timeRemaining)}
              </div>
            </div>

            {onTogglePause && (
              <button
                onClick={onTogglePause}
                title={isPaused ? 'Resume Round [Space]' : 'Pause Round [Space]'}
                className="ml-1 p-1.5 rounded-lg bg-[#080D18] hover:bg-[#16253c] text-slate-300 hover:text-[#00D9FF] border border-[#1687FF]/40 transition-colors cursor-pointer"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current text-[#00D9FF]" /> : <Pause className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active 5-Second Solo Indicator Badge */}
      {activeSolo && (
        <div className="mt-1 flex items-center gap-2 px-3.5 py-0.5 rounded-full bg-[#111C2D]/95 border border-[#00D9FF]/70 shadow-lg text-[#00D9FF] text-[10px] font-mono-tech pointer-events-auto animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D9FF] animate-ping" />
          <span>SOLO: <strong>{INSTRUMENTS[activeSolo].name}</strong> ({(audioEngine.getSoloRemainingSeconds() || 5.0).toFixed(1)}s)</span>
          <div className="flex items-end gap-0.5 h-2.5">
            <span className="w-0.5 bg-[#00D9FF] h-2 animate-pulse" />
            <span className="w-0.5 bg-[#00D9FF] h-2.5 animate-pulse delay-75" />
            <span className="w-0.5 bg-[#00D9FF] h-1.5 animate-pulse delay-150" />
          </div>
        </div>
      )}

      {/* 2. Compact Rhythm Challenge Prompt Banner */}
      {currentChallenge && targetInst && (
        <div className="w-full max-w-md mt-1.5 bg-[#111C2D]/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#1687FF]/60 shadow-2xl flex flex-col items-center pointer-events-auto">
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span
                style={{ backgroundColor: `${targetInst.color}35`, borderColor: targetInst.color }}
                className="px-2 py-0.5 rounded border text-[11px] font-heading font-black tracking-wider uppercase text-white shadow"
              >
                {targetInst.name}
              </span>
              <span className="text-xs font-heading font-bold text-[#F1F5F9] tracking-wide truncate">
                {currentChallenge.instruction}
              </span>
            </div>
            <span className="text-[10px] font-mono-tech font-bold text-[#00D9FF] whitespace-nowrap">
              +{currentChallenge.points} PTS
            </span>
          </div>

          {/* Rhythm Countdown Beat Bar */}
          <div className="w-full h-1 mt-1.5 rounded-full bg-[#080D18] overflow-hidden">
            <div
              style={{
                width: `${challengeProgress * 100}%`,
                backgroundColor: challengeProgress > 0.4 ? '#00D9FF' : '#1687FF'
              }}
              className="h-full transition-all duration-75 rounded-full"
            />
          </div>
        </div>
      )}

      {/* 3. Non-Pushing Floating Judgment Feedback Overlay */}
      {judgmentFeedback && (
        <div
          key={judgmentFeedback.id}
          className={`fixed top-24 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-xl font-heading font-black text-sm sm:text-base tracking-widest shadow-2xl animate-bounce backdrop-blur-md border pointer-events-none z-30 ${
            judgmentFeedback.rating === 'FEVER'
              ? 'bg-gradient-to-r from-[#1687FF]/95 to-[#A78BFA]/95 text-[#F1F5F9] border-[#00D9FF] scale-110 shadow-[0_0_25px_rgba(0,217,255,0.5)]'
              : judgmentFeedback.rating === 'PERFECT'
              ? 'bg-[#00D9FF] text-[#080D18] border-white shadow-[0_0_25px_rgba(0,217,255,0.7)]'
              : judgmentFeedback.rating === 'GREAT'
              ? 'bg-[#1687FF]/90 text-[#F1F5F9] border-[#00D9FF]'
              : 'bg-rose-600/90 text-white border-rose-300'
          }`}
        >
          {judgmentFeedback.text}
        </div>
      )}

      {/* 4. Non-Pushing Floating Announcement Overlay */}
      {activePrompt && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 px-5 py-2 rounded-xl bg-[#111C2D]/95 backdrop-blur-md border-2 border-[#1687FF] text-[#00D9FF] text-xs sm:text-sm font-heading font-bold tracking-wide shadow-2xl text-center pointer-events-none z-30 animate-pulse">
          {activePrompt}
        </div>
      )}

      {/* 6. Super Attack Notification */}
      {superAttackNotification && (
        <div className="mt-2 px-5 py-2 rounded-xl bg-[#111C2D]/95 backdrop-blur-md border-2 border-[#A78BFA] text-[#00D9FF] font-heading font-extrabold text-sm sm:text-base tracking-widest shadow-2xl animate-pulse">
          ⚡ {superAttackNotification} ⚡
        </div>
      )}

      {/* 7. PAUSE OVERLAY MODAL */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="max-w-sm w-full bg-[#111C2D]/95 border-2 border-[#1687FF]/60 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center">
            <Pause className="w-12 h-12 text-[#00D9FF] mb-3" />
            <h2 className="text-3xl font-heading font-extrabold text-[#F1F5F9] mb-1">
              GAME PAUSED
            </h2>
            <p className="text-xs text-slate-400 font-mono-tech mb-6">
              Round timer is paused. Take a breath or adjust your webcam!
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={onTogglePause}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-bold text-base tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
              >
                <Play className="w-4 h-4 fill-current text-[#080D18]" />
                <span>RESUME ROUND</span>
              </button>

              {onRestart && (
                <button
                  onClick={onRestart}
                  className="w-full py-3 rounded-2xl bg-[#080D18] hover:bg-[#16253c] border border-[#1687FF]/50 text-[#F1F5F9] font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
