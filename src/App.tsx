/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, RefreshCw, Eye, EyeOff, Info, Zap, Palette, ChevronRight, Home, Volume2, VolumeX } from 'lucide-react';

// Types
interface Color {
  h: number;
  s: number;
  l: number;
}

interface TimeFeedback {
  id: number;
  value: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  type: 'correct' | 'wrong' | 'click';
}

// Sound Utility
const playSound = (type: 'correct' | 'wrong' | 'click') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'correct') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.1); // E6
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } else if (type === 'wrong') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(220, now); // A3
      oscillator.frequency.linearRampToValueAtTime(110, now + 0.2); // A2
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, now); // A4
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    }
  } catch (e) {
    console.error('Audio context error:', e);
  }
};

export default function App() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [grid, setGrid] = useState<{ id: number; color: string; isTarget: boolean }[]>([]);
  const [cheatMode, setCheatMode] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [colors, setColors] = useState<{ base: Color; target: Color } | null>(null);
  const [timeFeedbacks, setTimeFeedbacks] = useState<TimeFeedback[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shake, setShake] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  const gridSize = 5; // Fixed 5x5 as requested

  const spawnParticles = (e: React.MouseEvent | React.TouchEvent, type: 'correct' | 'wrong' | 'click') => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : (e as React.TouchEvent).touches[0].clientX;
    const y = 'clientY' in e ? e.clientY : (e as React.TouchEvent).touches[0].clientY;
    
    const color = type === 'correct' ? '#10b981' : type === 'wrong' ? '#ef4444' : '#ffffff';
    const newParticles = Array.from({ length: type === 'click' ? 1 : 8 }, (_, i) => ({
      id: Date.now() + i,
      x,
      y,
      color,
      type
    }));

    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  };

  const triggerSound = (type: 'correct' | 'wrong' | 'click') => {
    if (soundEnabled) playSound(type);
  };

  const addTimeFeedback = (value: number) => {
    const id = Date.now();
    setTimeFeedbacks(prev => [...prev, { id, value }]);
    setTimeout(() => {
      setTimeFeedbacks(prev => prev.filter(f => f.id !== id));
    }, 1000);
  };

  const generateColors = useCallback((currentScore: number) => {
    const h = Math.floor(Math.random() * 360);
    const s = 50 + Math.floor(Math.random() * 30);
    const l = 40 + Math.floor(Math.random() * 20);

    const diff = Math.max(1, 15 - Math.floor(currentScore / 3));
    
    const changeLightness = Math.random() > 0.5;
    const targetL = changeLightness ? (l > 50 ? l - diff : l + diff) : l;
    const targetS = !changeLightness ? (s > 50 ? s - diff : s + diff) : s;

    const baseColor: Color = { h, s, l };
    const targetColor: Color = { h, s: targetS, l: targetL };

    return { base: baseColor, target: targetColor };
  }, []);

  const generateGrid = useCallback((currentScore: number) => {
    const { base, target } = generateColors(currentScore);
    setColors({ base, target });

    const targetIndex = Math.floor(Math.random() * (gridSize * gridSize));
    const newGrid = Array.from({ length: gridSize * gridSize }, (_, i) => ({
      id: i,
      color: i === targetIndex 
        ? `hsl(${target.h}, ${target.s}%, ${target.l}%)` 
        : `hsl(${base.h}, ${base.s}%, ${base.l}%)`,
      isTarget: i === targetIndex,
    }));
    setGrid(newGrid);
  }, [generateColors]);

  const startGame = (e: React.MouseEvent) => {
    spawnParticles(e, 'click');
    triggerSound('click');
    setScore(0);
    setTimeLeft(15);
    setGameState('playing');
    setCheatMode(false);
    generateGrid(0);
  };

  const handleBlockClick = (e: React.MouseEvent, isTarget: boolean) => {
    if (gameState !== 'playing') return;

    if (isTarget) {
      spawnParticles(e, 'correct');
      triggerSound('correct');
      const nextScore = score + 1;
      setScore(nextScore);
      setTimeLeft(prev => Math.min(prev + 2, 15));
      addTimeFeedback(2);
      generateGrid(nextScore);
    } else {
      spawnParticles(e, 'wrong');
      triggerSound('wrong');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeLeft(prev => Math.max(prev - 3, 0));
      addTimeFeedback(-3);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      setGameState('gameover');
      if (score > bestScore) setBestScore(score);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, score, bestScore]);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1F36] font-sans selection:bg-black selection:text-white flex flex-col items-center p-4 md:p-8 overflow-x-hidden">
      {/* Particle Layer */}
      <div className="fixed inset-0 pointer-events-none z-[100]">
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ 
                opacity: 1, 
                x: p.x, 
                y: p.y, 
                scale: p.type === 'click' ? 0.5 : 1 
              }}
              animate={{ 
                opacity: 0, 
                x: p.x + (p.type === 'click' ? 0 : (Math.random() - 0.5) * 200),
                y: p.y + (p.type === 'click' ? 0 : (Math.random() - 0.5) * 200),
                scale: p.type === 'click' ? 2 : 0,
                rotate: p.type === 'click' ? 0 : Math.random() * 360
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.type === 'click' ? 0.4 : 0.8, ease: "easeOut" }}
              className="absolute w-4 h-4 -ml-2 -mt-2 flex items-center justify-center"
            >
              {p.type === 'click' ? (
                <div className="w-full h-full rounded-full border-2 border-black/20" />
              ) : (
                <div 
                  className={`w-full h-full ${p.type === 'correct' ? 'rounded-full' : 'rotate-45'}`}
                  style={{ backgroundColor: p.color }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="w-full max-w-2xl mb-8 flex flex-col items-center text-center relative">
        <div className="absolute right-0 top-0">
          <button 
            onClick={(e) => {
              spawnParticles(e, 'click');
              setSoundEnabled(!soundEnabled);
              triggerSound('click');
            }}
            className="p-3 rounded-full bg-white border border-black/5 shadow-sm hover:bg-gray-50 transition-colors"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold tracking-tighter mb-2"
        >
          COLOR<span className="italic font-serif font-light">SENSE</span>
        </motion.h1>
        <p className="text-sm uppercase tracking-widest opacity-50 font-medium">
          色彩敏感度挑战 · 艺术生专项
        </p>
      </header>

      {/* Stats Bar */}
      <div className="w-full max-w-md grid grid-cols-2 gap-4 mb-6">
        <motion.div 
          key={score}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.05, 1] }}
          className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2 opacity-60">
            <Trophy size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">得分</span>
          </div>
          <span className="text-2xl font-mono font-bold">{score}</span>
        </motion.div>
        <div className={`bg-white border border-black/5 rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors relative ${timeLeft < 5 ? 'text-red-500' : ''}`}>
          <div className="flex items-center gap-2 opacity-60">
            <Timer size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">时间</span>
          </div>
          <span className="text-2xl font-mono font-bold">{timeLeft}s</span>
          
          <AnimatePresence>
            {timeFeedbacks.map(feedback => (
              <motion.span
                key={feedback.id}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: -30 }}
                exit={{ opacity: 0 }}
                className={`absolute right-4 font-bold text-lg ${feedback.value > 0 ? 'text-emerald-500' : 'text-red-500'}`}
              >
                {feedback.value > 0 ? `+${feedback.value}` : feedback.value}s
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Game Area */}
      <motion.main 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md aspect-square bg-white border border-black/10 rounded-3xl p-3 shadow-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {gameState === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm p-8 text-center"
            >
              <div className="mb-6 p-4 rounded-full bg-black/5">
                <Zap size={48} className="text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-4">准备好挑战视觉极限了吗？</h2>
              <p className="text-sm opacity-60 mb-8 max-w-xs">
                在 5x5 的网格中找出那个颜色略有不同的色块。随着得分增加，差异会越来越小。
              </p>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => startGame(e)}
                className="w-full py-4 bg-black text-white rounded-xl font-bold uppercase tracking-widest transition-transform"
              >
                开始挑战
              </motion.button>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col bg-[#FDFCFB] overflow-y-auto"
            >
              <div className="flex-1 p-6 flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="mt-4 mb-4"
                >
                  <div className="relative">
                    <Trophy size={80} className="text-yellow-400 drop-shadow-lg" />
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                      className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 border-2 border-white"
                    >
                      <Zap size={16} className="text-white" />
                    </motion.div>
                  </div>
                </motion.div>

                <h2 className="text-3xl font-serif font-black text-[#1A1F36] mb-1 text-center">挑战报告</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#1A1F36]/40 font-bold mb-8 text-center">Session Performance Analysis</p>

                <div className="w-full grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold text-[#1A1F36]/40 uppercase tracking-widest mb-2">感官得分</span>
                    <span className="text-4xl font-mono font-bold text-[#1A1F36]">{score}</span>
                  </div>
                  <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold text-[#1A1F36]/40 uppercase tracking-widest mb-2">辨识等级</span>
                    <span className="text-4xl font-mono font-bold text-[#1A1F36]">{Math.floor(score / 5) + 1}</span>
                  </div>
                </div>

                <div className="w-full bg-white/50 rounded-3xl p-6 border border-black/5 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Palette size={20} className="text-violet-500" />
                    <span className="font-bold text-[#1A1F36]">导师点评</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#1A1F36]/70 italic">
                    {score < 10 && "“你的视觉感知尚处于萌芽阶段。目前的明度感知阈值较高，容易受到‘同时对比’现象的干扰。建议从大色块写生开始，训练对色彩冷暖的基本判断。”"}
                    {score >= 10 && score < 20 && "“你的色彩敏感度已经初具规模。在基础色相的辨析上表现良好，但在极端明度下的微弱变化仍有提升空间。多观察自然光影下的补色关系会大有裨益。”"}
                    {score >= 20 && score < 35 && "“非常出色的表现！你对色彩的捕捉已经达到了专业艺术生的水准。能够精准识别极低对比度的色彩差异，这在复杂的绘画创作中将是巨大的优势。”"}
                    {score >= 35 && "“惊人的视觉天赋！你对色彩的敏锐度已经跨越了专业门槛，进入了大师级的感知领域。这种对微观色彩变化的掌控力是极少数人才能拥有的天赋。”"}
                  </p>
                </div>

                <div className="w-full flex flex-col gap-3 mt-auto">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => startGame(e)}
                    className="w-full py-4 bg-[#1A1F36] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#2D3359] transition-all shadow-lg shadow-blue-900/10"
                  >
                    <RefreshCw size={18} /> 再次挑战
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      spawnParticles(e, 'click');
                      triggerSound('click');
                      setGameState('idle');
                    }}
                    className="w-full py-4 bg-white text-[#1A1F36] border border-black/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                  >
                    返回主页
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Grid */}
        <div 
          className="grid gap-2 h-full w-full"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {grid.map((block) => (
            <motion.button
              key={block.id}
              whileHover={{ scale: 0.98 }}
              whileTap={{ scale: 0.92 }}
              onClick={(e) => handleBlockClick(e, block.isTarget)}
              className={`relative rounded-lg transition-all duration-200 shadow-sm ${cheatMode && block.isTarget ? 'ring-4 ring-black ring-offset-2 z-20' : ''}`}
              style={{ backgroundColor: block.color }}
            >
              {cheatMode && block.isTarget && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full shadow-lg animate-ping" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.main>

      {/* Controls & Info */}
      <div className="w-full max-w-md mt-6 flex flex-col gap-4">
        <div className="flex gap-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              spawnParticles(e, 'click');
              triggerSound('click');
              setCheatMode(!cheatMode);
            }}
            disabled={gameState !== 'playing'}
            className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${
              cheatMode 
                ? 'bg-black text-white border-black' 
                : 'bg-white text-black border-black/10 hover:border-black/30 disabled:opacity-30'
            }`}
          >
            {cheatMode ? <EyeOff size={16} /> : <Eye size={16} />}
            {cheatMode ? '关闭作弊' : '开启作弊'}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              spawnParticles(e, 'click');
              triggerSound('click');
              setGameState('idle');
            }}
            className="px-4 py-3 rounded-xl border border-black/10 bg-white hover:bg-black hover:text-white transition-all"
          >
            <RefreshCw size={18} />
          </motion.button>
        </div>

        {/* Color Diff Visualization */}
        {colors && gameState === 'playing' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3 opacity-60">
              <Info size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">色彩差异分析</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-8 rounded-md" style={{ backgroundColor: `hsl(${colors.base.h}, ${colors.base.s}%, ${colors.base.l}%)` }} />
                <span className="text-[10px] font-mono opacity-40 text-center">BASE</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold">Δ {Math.abs(colors.base.l - colors.target.l) || Math.abs(colors.base.s - colors.target.s)}%</span>
                <div className="w-8 h-[1px] bg-black/10 my-1" />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-8 rounded-md" style={{ backgroundColor: `hsl(${colors.target.h}, ${colors.target.s}%, ${colors.target.l}%)` }} />
                <span className="text-[10px] font-mono opacity-40 text-center">TARGET</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-12 pb-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-30 font-bold">
          Designed for Visual Precision & Artistic Training
        </p>
      </footer>
    </div>
  );
}
