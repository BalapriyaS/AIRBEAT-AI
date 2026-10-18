import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Camera,
  CheckCircle,
  Clock,
  Disc,
  Drum,
  Flame,
  HelpCircle,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  X,
  Zap
} from 'lucide-react';
import { GameStats, InstrumentId } from '../types/game';
import { INSTRUMENT_LIST, SUPER_ATTACK_LIST } from '../game/instrumentsConfig';
import { TrackingStateInfo } from '../vision/HandTracker';
import { audioEngine } from '../audio/AudioEngine';

// ==================== CELEBRATION CONFETTI SHOWER ====================
const ConfettiCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#fbbf24', '#f43f5e', '#06b6d4', '#10b981', '#a855f7', '#ffffff', '#ec4899'];
    const particles = Array.from({ length: 85 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.7,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3.5,
      vy: 2.2 + Math.random() * 3.8,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.12
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      animId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};

// ==================== ROLLING ANIMATED SCORE COUNTER ====================
const useAnimatedCounter = (targetValue: number, durationMs: number = 1400) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Fast ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(ease * targetValue));
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [targetValue, durationMs]);

  return displayValue;
};

// ==================== PERFORMANCE GRADE CALCULATOR ====================
const evaluatePerformance = (stats: GameStats) => {
  const totalNotes = stats.perfectHits + stats.greatHits + stats.missCount;
  const accuracy =
    totalNotes > 0
      ? Math.round(((stats.perfectHits * 1.0 + stats.greatHits * 0.75) / totalNotes) * 100)
      : 100;

  if (stats.score >= 26000 || accuracy >= 88) {
    return {
      grade: 'S+',
      rankTitle: stats.rankTitle || 'Legendary Dance Master',
      stars: 5,
      praise: '⚡ OPTICAL SYNC PERFECTION! ARENA RESONANCE AT MAXIMUM!',
      accentColor: '#00D9FF',
      gradeClass: 'text-[#00D9FF] drop-shadow-[0_0_35px_rgba(0,217,255,0.7)]',
      badgeBorder: 'border-[#00D9FF] bg-[#111C2D] text-[#00D9FF]'
    };
  }
  if (stats.score >= 18000 || accuracy >= 78) {
    return {
      grade: 'S',
      rankTitle: stats.rankTitle || 'Sonic Cyber Headliner',
      stars: 5,
      praise: '✨ S-TIER GROOVE SYNTHESIS! CREATURE MASTERED THE BEAT!',
      accentColor: '#1687FF',
      gradeClass: 'text-[#1687FF] drop-shadow-[0_0_35px_rgba(22,135,255,0.7)]',
      badgeBorder: 'border-[#1687FF] bg-[#111C2D] text-[#1687FF]'
    };
  }
  if (stats.score >= 10000 || accuracy >= 62) {
    return {
      grade: 'A',
      rankTitle: stats.rankTitle || 'Beat Warrior',
      stars: 4,
      praise: '⚡ HIGH-VOLTAGE SHOW! THE 3D CREATURE LOVED IT!',
      accentColor: '#A78BFA',
      gradeClass: 'text-[#A78BFA] drop-shadow-[0_0_35px_rgba(167,139,250,0.7)]',
      badgeBorder: 'border-[#A78BFA] bg-[#111C2D] text-[#A78BFA]'
    };
  }
  if (stats.score >= 5000 || accuracy >= 45) {
    return {
      grade: 'B',
      rankTitle: stats.rankTitle || 'Groove Master',
      stars: 3,
      praise: '🎵 SOLID BEAT RUN! GREAT PERFORMANCE IN THE ARENA!',
      accentColor: '#38BDF8',
      gradeClass: 'text-[#38BDF8] drop-shadow-[0_0_25px_rgba(56,189,248,0.7)]',
      badgeBorder: 'border-[#38BDF8] bg-[#111C2D] text-[#38BDF8]'
    };
  }
  return {
    grade: 'C',
    rankTitle: stats.rankTitle || 'Rhythm Rookie',
    stars: 2,
    praise: '🎶 GOOD ATTEMPT! INITIALIZE AGAIN TO CRUSH THE HIGH SCORE!',
    accentColor: '#F1F5F9',
    gradeClass: 'text-[#F1F5F9] drop-shadow-[0_0_20px_rgba(241,245,249,0.5)]',
    badgeBorder: 'border-slate-700 bg-[#111C2D] text-slate-300'
  };
};

// =========================================================================
// 1. EXCITING CONCERT PERFORMANCE RESULTS SCREEN (For Both Round End & Victory)
// =========================================================================
interface ResultsScreenProps {
  stats: GameStats;
  onReplay: () => void;
  isVictory?: boolean;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ stats, onReplay, isVictory = false }) => {
  const animatedScore = useAnimatedCounter(stats.score);
  const evaluation = evaluatePerformance(stats);

  const totalHits = stats.perfectHits + stats.greatHits;
  const totalNotes = totalHits + stats.missCount;
  const accuracyPct = totalNotes > 0 ? Math.round((totalHits / totalNotes) * 100) : 100;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#080D18] concert-stage-bg overflow-y-auto">
      {/* Live Falling Confetti Celebration */}
      <ConfettiCanvas />

      {/* Sweeping Stage Spotlights in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#1687FF]/20 blur-3xl animate-pulse" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#A78BFA]/20 blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-48 bg-[#00D9FF]/10 blur-3xl" />
      </div>

      {/* Main Results Console Card */}
      <div className="relative z-20 max-w-2xl w-full flex flex-col items-center bg-[#111C2D]/95 border-2 border-[#1687FF]/50 rounded-3xl p-5 sm:p-8 shadow-[0_0_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        {/* Top Header Marquee Banner */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#080D18]/90 border border-[#1687FF]/50 shadow-lg text-[#00D9FF] text-xs font-mono-tech tracking-widest uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#00D9FF] animate-spin" />
          <span>{isVictory ? 'BATTLE CLEARED • HIGH ACCURACY ACHIEVED' : 'BATTLE SIMULATION COMPLETE • TELEMETRY REPORT'}</span>
          <Sparkles className="w-3.5 h-3.5 text-[#00D9FF] animate-spin" />
        </div>

        {/* Big Exciting Headline */}
        <h1 className="text-3xl sm:text-5xl font-arcade font-black tracking-tight uppercase text-center mb-1">
          {isVictory ? (
            <span className="text-[#00D9FF] drop-shadow-[0_0_30px_rgba(0,217,255,0.6)]">ARENA TRIUMPH!</span>
          ) : (
            <span className="text-[#F1F5F9] drop-shadow-[0_0_24px_rgba(241,245,249,0.3)]">SESSION COMPLETE!</span>
          )}
        </h1>

        {/* Dynamic Hype Appraisal */}
        <p className="text-xs sm:text-sm font-mono-tech font-bold text-[#A78BFA] text-center tracking-wide mb-6">
          {evaluation.praise}
        </p>

        {/* Centerpiece: Dramatic Grade Stamp & Rolling Score Board */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[#080D18]/90 border border-[#1687FF]/35 rounded-2xl p-4 sm:p-6 mb-6 shadow-2xl relative overflow-hidden">
          {/* Subtle Speaker Grille Overlay */}
          <div className="absolute inset-0 speaker-grille opacity-25 pointer-events-none" />

          {/* Left: Giant Stamped Grade Letter with Slam Animation */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 relative">
            <span className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-widest mb-1">
              PERFORMANCE GRADE
            </span>
            <div className="relative">
              <div
                className={`text-7xl sm:text-8xl font-arcade font-black leading-none animate-stamp-slam select-none ${evaluation.gradeClass}`}
              >
                {evaluation.grade}
              </div>
            </div>

            {/* Glowing Cyber Stars */}
            <div className="flex items-center gap-1.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 transition-all duration-300 ${
                    i < evaluation.stars
                      ? 'text-[#00D9FF] fill-[#00D9FF] filter drop-shadow-[0_0_8px_rgba(0,217,255,0.8)]'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="mt-2 px-3 py-0.5 rounded-full bg-[#111C2D] border border-[#1687FF]/40 text-[11px] font-mono-tech font-bold text-[#00D9FF]">
              {evaluation.rankTitle}
            </div>
          </div>

          {/* Right: Rolling Total Score & Accuracy Badge */}
          <div className="sm:col-span-7 flex flex-col justify-center sm:border-l border-slate-800 sm:pl-6 text-center sm:text-left relative">
            <span className="text-xs font-mono-tech uppercase tracking-widest text-slate-400">
              FINAL BATTLE SCORE
            </span>
            <div className="text-4xl sm:text-6xl font-arcade font-black text-[#00D9FF] drop-shadow-[0_0_30px_rgba(0,217,255,0.5)] tracking-tight mt-0.5">
              {animatedScore.toLocaleString()}
            </div>

            {/* Accuracy & Hits Pill Row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3 font-mono-tech text-xs">
              <span className="px-3 py-1 rounded-full bg-[#111C2D] border border-[#00D9FF]/60 text-[#00D9FF] font-bold flex items-center gap-1 shadow-md">
                🎯 {accuracyPct}% ACCURACY
              </span>
              <span className="px-3 py-1 rounded-full bg-[#111C2D] border border-[#1687FF]/60 text-[#1687FF] font-bold flex items-center gap-1 shadow-md">
                <Flame className="w-3.5 h-3.5 text-[#00D9FF]" />
                x{stats.maxCombo} MAX COMBO
              </span>
            </div>
          </div>
        </div>

        {/* 4 Rich Breakdown Module Cards */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* 1. Perfect Hits */}
          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#00D9FF]/40 flex flex-col items-center text-center shadow-lg hover:border-[#00D9FF] transition-colors">
            <span className="text-[#00D9FF] text-xs font-mono-tech font-bold uppercase tracking-wider mb-0.5">
              PERFECTS
            </span>
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#F1F5F9]">
              {stats.perfectHits}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-tech">+700 PTS EA</span>
          </div>

          {/* 2. Great Hits */}
          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#1687FF]/40 flex flex-col items-center text-center shadow-lg hover:border-[#1687FF] transition-colors">
            <span className="text-[#1687FF] text-xs font-mono-tech font-bold uppercase tracking-wider mb-0.5">
              GREATS
            </span>
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#F1F5F9]">
              {stats.greatHits}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-tech">+500 PTS EA</span>
          </div>

          {/* 3. Miss Count */}
          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-slate-700 flex flex-col items-center text-center shadow-lg hover:border-slate-500 transition-colors">
            <span className="text-slate-400 text-xs font-mono-tech font-bold uppercase tracking-wider mb-0.5">
              MISSES
            </span>
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#F1F5F9]">
              {stats.missCount}
            </span>
            <span className="text-[10px] text-slate-500 font-mono-tech">
              {stats.missCount === 0 ? 'FULL COMBO!' : '-150 PTS EA'}
            </span>
          </div>

          {/* 4. Super Attacks */}
          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#A78BFA]/40 flex flex-col items-center text-center shadow-lg hover:border-[#A78BFA] transition-colors">
            <span className="text-[#A78BFA] text-xs font-mono-tech font-bold uppercase tracking-wider mb-0.5">
              SUPER DANCES
            </span>
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#F1F5F9]">
              {stats.superAttacksUsed}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-tech">TWO-HAND PINCH</span>
          </div>
        </div>

        {/* Boss Encounter Outcome Card */}
        <div className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-[#080D18]/90 border border-[#1687FF]/40 mb-4 shadow-lg">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-[#00D9FF]/60 bg-gradient-to-br from-[#080D18] to-[#111C2D] flex items-center justify-center shadow-[0_0_15px_rgba(0,217,255,0.35)]">
            <span className="text-2xl select-none">{isVictory ? '🏆' : '👾'}</span>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-tech font-bold text-[#00D9FF] uppercase tracking-wider">
                STAGE 1 BOSS // VOID BEHEMOTH
              </span>
              <span className={`text-[9px] font-mono-tech font-bold px-2 py-0.5 rounded-full ${
                isVictory ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' : 'bg-[#111C2D] text-[#A78BFA] border border-[#A78BFA]/40'
              }`}>
                {isVictory ? 'NEUTRALIZED' : 'ENGAGED'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-heading mt-0.5">
              {isVictory
                ? 'The Void Behemoth was overwhelmed by your supersonic rhythmic combo!'
                : 'Great rhythmic conduct! Re-initialize battle to shatter the Behemoth\'s final core!'}
            </p>
          </div>
        </div>

        {/* Action Button: High-Impact Cyber Button */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              audioEngine.ensureContext();
              onReplay();
            }}
            className="w-full sm:w-auto flex-1 max-w-md py-4 px-8 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-black text-lg tracking-wider flex items-center justify-center gap-3 cursor-pointer select-none uppercase shadow-[0_0_35px_rgba(22,135,255,0.45)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-6 h-6 stroke-[2.5]" />
            <span>INITIALIZE NEW ROUND [PLAY AGAIN]</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Backwards-compatible aliases for App.tsx
export const VictoryScreen: React.FC<{ stats: GameStats; onReplay: () => void }> = (props) => (
  <ResultsScreen {...props} isVictory={true} />
);

export const GameOverScreen: React.FC<{ stats: GameStats; onReplay: () => void }> = (props) => (
  <ResultsScreen {...props} isVictory={false} />
);

// =========================================================================
// 2. RADICALLY REDESIGNED START SCREEN: ELECTRIC CONCERT FESTIVAL STAGE
// =========================================================================
interface StartScreenProps {
  onStart: () => void;
  onOpenCalibration: () => void;
  onOpenHowToPlay: () => void;
  onOpenSuperGuide: () => void;
  trackingInfo?: TrackingStateInfo;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onOpenCalibration,
  onOpenHowToPlay,
  onOpenSuperGuide,
  trackingInfo
}) => {
  const [activePreviewId, setActivePreviewId] = useState<InstrumentId | null>(null);
  const [soloRemainingSec, setSoloRemainingSec] = useState<number>(0);

  // Poll 5.0-second solo status from AudioEngine
  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = audioEngine.getActiveInstrument();
      setActivePreviewId(active);
      if (active) {
        setSoloRemainingSec(audioEngine.getSoloRemainingSeconds());
      } else {
        setSoloRemainingSec(0);
      }
    }, 60);
    return () => clearInterval(timer);
  }, []);

  const handlePreviewClick = (id: InstrumentId) => {
    audioEngine.ensureContext();
    audioEngine.playInstrument(id, 0.5);
  };

  const renderInstrumentIcon = (name: string, className: string) => {
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
          <div className="flex gap-0.5 items-end justify-center w-5 h-5">
            <span className="w-1 h-3.5 bg-current rounded-xs" />
            <span className="w-1 h-2.5 bg-current rounded-xs" />
            <span className="w-1 h-4 bg-current rounded-xs" />
            <span className="w-1 h-3 bg-current rounded-xs" />
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#080D18] concert-stage-bg overflow-y-auto">
      {/* Precision Cyber Science Lab Atmospheric Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full spotlight-left opacity-35" />
        <div className="absolute top-0 right-0 w-full h-full spotlight-right opacity-35" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-[#1687FF]/10 blur-[130px]" />
      </div>

      <div className="relative z-20 max-w-4xl w-full flex flex-col items-center">
        {/* Top Cyber Science Lab Telemetry Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111C2D]/95 border border-[#1687FF]/50 shadow-[0_0_20px_rgba(22,135,255,0.3)] text-[#00D9FF] text-xs font-mono-tech tracking-widest uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-ping" />
          <span className="font-bold">CYBER SCIENCE LAB // GESTURE MOTION AUDIO ARENA</span>
          <span className="w-2 h-2 rounded-full bg-[#1687FF]" />
        </div>

        {/* Hero Title: Premium PC Game Typography */}
        <div className="relative text-center mb-2">
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-arcade font-black tracking-tight leading-none uppercase select-none">
            <span className="text-[#F1F5F9] drop-shadow-[0_4px_24px_rgba(241,245,249,0.25)]">AIR</span>
            <span className="text-[#00D9FF] drop-shadow-[0_0_35px_rgba(0,217,255,0.55)]">BEAT</span>
            <span className="text-[#1687FF] ml-3 drop-shadow-[0_0_35px_rgba(22,135,255,0.65)]">AI</span>
          </h1>
          {/* Subtle reflection underglow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-transparent via-[#00D9FF]/40 to-transparent blur-md" />
        </div>

        {/* Sci-Fi Subtitle */}
        <p className="text-xs sm:text-sm font-mono-tech font-bold uppercase tracking-[0.22em] text-[#A78BFA] text-center mb-3">
          NEURAL OPTICAL HAND-TRACKING MUSIC BATTLE SIMULATION
        </p>

        <p className="text-xs sm:text-sm text-slate-300 font-heading font-normal tracking-wide text-center max-w-lg mb-5 text-balance">
          Conduct 6 virtual acoustic and electronic instruments in thin air. Attack the 3D creature and groove to your beat!
        </p>

        {/* 4 Precision Sensor Modes Ribbon */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 font-mono-tech text-xs">
          <span className="px-3.5 py-1 rounded-full bg-[#111C2D]/90 border border-[#1687FF]/40 text-[#00D9FF] font-semibold flex items-center gap-1.5 shadow-md">
            👉 Air-Strike Hit
          </span>
          <span className="px-3.5 py-1 rounded-full bg-[#111C2D]/90 border border-[#1687FF]/40 text-[#00D9FF] font-semibold flex items-center gap-1.5 shadow-md">
            🤏 Air-Pinch
          </span>
          <span className="px-3.5 py-1 rounded-full bg-[#111C2D]/90 border border-[#1687FF]/40 text-[#00D9FF] font-semibold flex items-center gap-1.5 shadow-md">
            ⏱️ Dwell Hover
          </span>
          <span className="px-3.5 py-1 rounded-full bg-[#111C2D]/90 border border-slate-700 text-[#F1F5F9] font-semibold flex items-center gap-1.5 shadow-md">
            ⌨️ Keyboard 1-6 & Mouse
          </span>
        </div>

        {/* SCIENCE EXHIBITION TOURNAMENT CHALLENGE & GESTURE COMBAT CONSOLE */}
        <div className="w-full max-w-3xl mb-5 rounded-3xl bg-[#111C2D]/95 border-2 border-[#1687FF]/50 p-4 sm:p-5 shadow-[0_0_35px_rgba(22,135,255,0.25)] relative overflow-hidden flex flex-col gap-4">
          {/* Header Row: Tournament Title & Live Equalizer Waves */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1687FF] to-[#00D9FF] flex items-center justify-center text-[#080D18] shadow-[0_0_15px_#00D9FF]">
                <Trophy className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-arcade font-black text-[#F1F5F9] uppercase tracking-wider">
                    COLLEGE SCIENCE EXHIBITION COMBAT CHALLENGE
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-[9px] font-mono-tech font-bold uppercase animate-pulse">
                    LIVE ARENA
                  </span>
                </div>
                <p className="text-[11px] text-[#A78BFA] font-mono-tech font-semibold">
                  Zero Controllers • Pure Optical Computer Vision • Interactive 3D Audio Battle
                </p>
              </div>
            </div>

            {/* Live Audio Spectrum Equalizer Animation */}
            <div className="flex items-center gap-1 shrink-0 self-end sm:self-center px-3 py-1 rounded-xl bg-[#080D18]/80 border border-[#1687FF]/30">
              <span className="text-[10px] font-mono-tech text-[#00D9FF] font-bold mr-1.5 uppercase">SPECTRUM</span>
              <span className="w-1 h-3.5 bg-[#00D9FF] rounded-full animate-pulse" />
              <span className="w-1 h-5 bg-[#1687FF] rounded-full animate-[pulse_0.7s_infinite]" />
              <span className="w-1 h-2.5 bg-[#A78BFA] rounded-full animate-pulse" />
              <span className="w-1 h-6 bg-[#00D9FF] rounded-full animate-[pulse_0.5s_infinite]" />
              <span className="w-1 h-3 bg-[#10B981] rounded-full animate-pulse" />
            </div>
          </div>

          {/* 3 Step Interactive Combat Briefing Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1 */}
            <div className="group relative p-3.5 rounded-2xl bg-gradient-to-br from-[#080D18]/90 to-[#111C2D] border border-[#00D9FF]/40 hover:border-[#00D9FF] transition-all hover:scale-[1.02] shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-lg bg-[#00D9FF]/20 border border-[#00D9FF]/60 text-[#00D9FF] font-arcade font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xl">🖐️</span>
                </div>
                <h3 className="text-xs font-arcade font-black text-[#F1F5F9] uppercase tracking-wide mb-1">
                  AIR-PLAY INSTRUMENTS
                </h3>
                <p className="text-[11px] text-slate-300 font-heading leading-relaxed mb-2.5">
                  Raise your hands in front of the camera and touch virtual floating instruments in mid-air to blast sonic attacks!
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono-tech font-bold text-[#00D9FF]">
                <Zap className="w-3 h-3 text-[#00D9FF]" />
                <span>6 LIVE INSTRUMENTS</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative p-3.5 rounded-2xl bg-gradient-to-br from-[#080D18]/90 to-[#111C2D] border border-[#1687FF]/40 hover:border-[#1687FF] transition-all hover:scale-[1.02] shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-lg bg-[#1687FF]/20 border border-[#1687FF]/60 text-[#1687FF] font-arcade font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xl">🔥</span>
                </div>
                <h3 className="text-xs font-arcade font-black text-[#F1F5F9] uppercase tracking-wide mb-1">
                  BUILD RHYTHM COMBOS
                </h3>
                <p className="text-[11px] text-slate-300 font-heading leading-relaxed mb-2.5">
                  Play on tempo to escalate from 2x up to 10x Frenzy Multipliers, staggering the 3D beast and racking up massive points!
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono-tech font-bold text-[#1687FF]">
                <Flame className="w-3 h-3 text-[#1687FF]" />
                <span>10x COMBO FRENZY</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative p-3.5 rounded-2xl bg-gradient-to-br from-[#080D18]/90 to-[#111C2D] border border-[#A78BFA]/40 hover:border-[#A78BFA] transition-all hover:scale-[1.02] shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/60 text-[#A78BFA] font-arcade font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span className="text-xl">💥</span>
                </div>
                <h3 className="text-xs font-arcade font-black text-[#F1F5F9] uppercase tracking-wide mb-1">
                  AIR-PINCH SUPER BLAST
                </h3>
                <p className="text-[11px] text-slate-300 font-heading leading-relaxed mb-2.5">
                  Pinch your thumb and index fingers together to fire the devastating 5,000-Point Thunder Strike finisher!
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono-tech font-bold text-[#A78BFA]">
                <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                <span>5,000 PTS FINISHER</span>
              </div>
            </div>
          </div>

          {/* Exhibition Leaderboard Tournament Banner & Real-time Hand Readiness Sensor */}
          <div className="p-3 rounded-2xl bg-[#080D18]/90 border border-[#1687FF]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1687FF]/20 border border-[#1687FF]/50 text-[#F1F5F9] font-arcade text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 text-[10px]">RECORD:</span>
                <span className="text-amber-400 font-black">34,500 PTS</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#F1F5F9] font-arcade text-xs">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-slate-400 text-[10px]">MAX COMBO:</span>
                <span className="text-orange-400 font-black">32x STREAK</span>
              </div>
            </div>

            {/* Dynamic Hand Detection Sensor Status */}
            <div className="flex items-center gap-2 text-xs font-mono-tech font-bold">
              {(trackingInfo?.handsCount ?? 0) > 0 || trackingInfo?.status === 'hand_detected' ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>HAND DETECTED! READY TO COMMENCE</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#111C2D] border border-cyan-500/40 text-[#00D9FF]">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>CAMERA READY • WAVE HAND TO START</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LIVE INSTRUMENT SOUNDBOARD (Cyber Science Lab Module) */}
        <div className="w-full max-w-3xl mb-6">
          <div className="flex items-center justify-between px-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-mono-tech font-bold text-[#00D9FF] uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span>LIVE SOUNDBOARD • CLICK ANY INSTRUMENT FOR 5-SECOND REAL SOUND</span>
            </div>
            {activePreviewId && (
              <span className="text-[11px] font-mono-tech font-bold text-[#A78BFA] animate-pulse">
                🎶 PLAYING {activePreviewId.toUpperCase()} ({(soloRemainingSec || 5.0).toFixed(1)}s)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {INSTRUMENT_LIST.map((inst, index) => {
              const isPlaying = activePreviewId === inst.id;

              return (
                <button
                  key={inst.id}
                  onClick={() => handlePreviewClick(inst.id)}
                  style={{
                    borderColor: isPlaying ? '#00D9FF' : 'rgba(22, 135, 255, 0.35)',
                    boxShadow: isPlaying ? `0 0 25px rgba(0, 217, 255, 0.5), inset 0 0 12px rgba(0, 217, 255, 0.25)` : undefined
                  }}
                  className={`group relative flex flex-col items-center p-3 rounded-2xl transition-all cursor-pointer select-none text-center ${
                    isPlaying
                      ? 'bg-[#111C2D] scale-105 border-2 shadow-2xl'
                      : 'bg-[#111C2D]/85 border hover:scale-105 hover:bg-[#111C2D] hover:border-[#00D9FF]'
                  }`}
                >
                  {/* Hotkey Number Pill */}
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#080D18] border border-[#1687FF]/60 text-[9px] font-mono-tech font-bold flex items-center justify-center text-[#F1F5F9]"
                  >
                    {index + 1}
                  </span>

                  {/* Icon or Animated Waveform Bars */}
                  {isPlaying ? (
                    <div className="flex items-end gap-0.5 h-7 my-1">
                      <span className="w-1 rounded-full animate-eq-1 h-3 bg-[#00D9FF]" />
                      <span className="w-1 rounded-full animate-eq-2 h-6 bg-[#00D9FF]" />
                      <span className="w-1 rounded-full animate-eq-3 h-7 bg-[#1687FF]" />
                      <span className="w-1 rounded-full animate-eq-4 h-4 bg-[#1687FF]" />
                      <span className="w-1 rounded-full animate-eq-5 h-2 bg-[#A78BFA]" />
                    </div>
                  ) : (
                    <div
                      style={{ color: inst.color }}
                      className="transition-transform duration-200 group-hover:scale-115 my-1 drop-shadow-[0_0_8px_currentColor]"
                    >
                      {renderInstrumentIcon(inst.iconName, 'w-7 h-7')}
                    </div>
                  )}

                  {/* Instrument Name */}
                  <div className="text-xs font-heading font-black text-[#F1F5F9] tracking-wide">
                    {inst.name}
                  </div>

                  {/* Subtitle / Move Name */}
                  <div
                    className="text-[9px] font-mono-tech font-semibold tracking-tight mt-0.5 text-slate-400 group-hover:text-[#00D9FF]"
                  >
                    {isPlaying
                      ? `🎶 ${(soloRemainingSec || 5.0).toFixed(1)}s SOLO`
                      : inst.subtitle.split('&')[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Camera & AI Tracking Readiness Radar */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#111C2D]/95 border border-[#1687FF]/50 text-xs font-mono-tech mb-6 shadow-lg">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              trackingInfo?.handsCount && trackingInfo.handsCount > 0
                ? 'bg-[#00D9FF] animate-ping'
                : trackingInfo?.isReady
                ? 'bg-[#00D9FF]'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-[#F1F5F9]">
            {trackingInfo?.handsCount && trackingInfo.handsCount > 0
              ? `AI OPTICAL SENSOR READY • ${trackingInfo.handsCount} HAND${trackingInfo.handsCount > 1 ? 'S' : ''} DETECTED`
              : trackingInfo?.isReady
              ? 'WEBCAM ACTIVE • RAISE HAND TO COMMENCE BATTLE'
              : trackingInfo?.status === 'waiting_permission'
              ? 'WEBCAM PERMISSION NEEDED (OR PLAY WITH MOUSE/KEYS)'
              : 'INITIALIZING AI SENSOR... (KEYBOARD 1-6 READY)'}
          </span>
        </div>

        {/* Primary Action Buttons: High-Impact Cyber PC Game Styling */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-lg mb-4">
          <button
            onClick={() => {
              audioEngine.ensureContext();
              onStart();
            }}
            className="flex-1 w-full py-4.5 px-8 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-black text-xl tracking-wider flex items-center justify-center gap-3 cursor-pointer select-none uppercase shadow-[0_0_35px_rgba(22,135,255,0.45)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-6 h-6 fill-current stroke-none text-[#080D18]" />
            <span>INITIALIZE BATTLE [START]</span>
          </button>

          <button
            onClick={onOpenCalibration}
            className="w-full sm:w-auto px-6 py-4.5 rounded-2xl bg-[#111C2D] hover:bg-[#16253c] border-2 border-[#1687FF]/60 hover:border-[#00D9FF] text-[#00D9FF] font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
          >
            <Camera className="w-4 h-4 text-[#00D9FF]" />
            <span>CALIBRATE</span>
          </button>
        </div>

        {/* Footer Quick Links */}
        <div className="flex items-center gap-5 text-xs font-mono-tech text-slate-400">
          <button
            onClick={onOpenHowToPlay}
            className="hover:text-[#00D9FF] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <HelpCircle className="w-4 h-4 text-[#00D9FF]" />
            <span>HOW TO PLAY</span>
          </button>
          <span>•</span>
          <button
            onClick={onOpenSuperGuide}
            className="hover:text-[#A78BFA] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-[#A78BFA]" />
            <span>TWO-HAND SUPER DANCES</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. HOW TO PLAY MODAL
// =========================================================================
export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="max-w-xl w-full bg-[#111C2D]/95 border-2 border-[#1687FF]/60 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-[#00D9FF] hover:bg-[#080D18] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-arcade font-bold text-[#00D9FF] mb-1 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-[#00D9FF]" />
          HOW TO PLAY AIRBEAT AI
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-mono-tech">
          Conduct 6 virtual air-instruments with optical hand tracking or keyboard/mouse to battle the 3D creature!
        </p>

        <div className="space-y-3.5 text-sm text-slate-300">
          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#00D9FF]/40">
            <h3 className="font-heading font-bold text-[#00D9FF] mb-1">
              1. Follow the Rhythm Target
            </h3>
            <p className="text-xs text-slate-400">
              The top banner announces the next required instrument. Target circles pulse in luminous cyan and electric blue!
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#1687FF]/40">
            <h3 className="font-heading font-bold text-[#1687FF] mb-1">
              2. Air-Strike, Pinch, Dwell, or Click
            </h3>
            <p className="text-xs text-slate-400">
              Move your hand to aim at the pad. Strike forward, pinch thumb & index, or hover for 240ms to trigger. Keys 1-6 and mouse clicks work with zero latency too!
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#A78BFA]/40">
            <h3 className="font-heading font-bold text-[#A78BFA] mb-1">
              3. 5-Second Real Instrument Solos & Reactive Dance Moves
            </h3>
            <p className="text-xs text-slate-400">
              Every strike triggers a full 5-second acoustic or electronic instrument solo while the 3D creature executes responsive dance moves in real time!
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#080D18]/90 border border-[#38BDF8]/40">
            <h3 className="font-heading font-bold text-[#38BDF8] mb-1">
              4. Fever Mode & Two-Hand Super Attacks
            </h3>
            <p className="text-xs text-slate-400">
              Chain combos to unlock Fever Mode (2.5x score!). Pinch two different instruments simultaneously with both hands to trigger screen-shaking Super Attacks!
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-black tracking-wider cursor-pointer transition-all shadow-lg shadow-[#1687FF]/30"
        >
          INITIALIZE SENSOR & PLAY
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 4. SUPER ATTACK GUIDE MODAL
// =========================================================================
export const SuperAttackGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="max-w-xl w-full bg-[#111C2D]/95 border-2 border-[#A78BFA]/60 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-[#A78BFA] hover:bg-[#080D18] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-arcade font-bold text-[#A78BFA] mb-1 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#A78BFA]" />
          TWO-HAND SUPER ATTACKS
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-mono-tech">
          Pinch both hands simultaneously on these pairs to trigger devastating ultimate attacks!
        </p>

        <div className="space-y-3.5">
          {SUPER_ATTACK_LIST.map((superAttack) => (
            <div
              key={superAttack.id}
              className="p-4 rounded-2xl bg-[#080D18]/90 border border-[#A78BFA]/40 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-heading font-black text-base text-[#00D9FF] tracking-wider">
                  ⚡ {superAttack.name}
                </span>
                <span className="text-xs font-mono-tech text-[#A78BFA] font-bold">
                  {superAttack.damage} DAMAGE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono-tech text-[#1687FF] uppercase">
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
          className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1687FF] to-[#00D9FF] hover:from-[#1476e0] hover:to-[#00c4e6] text-[#080D18] font-arcade font-black tracking-wider cursor-pointer transition-all shadow-lg shadow-[#1687FF]/30"
        >
          RETURN TO BATTLE ARENA
        </button>
      </div>
    </div>
  );
};
