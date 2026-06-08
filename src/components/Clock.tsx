'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';

// 1 real second = 1 game minute at 1x speed
const BASE_MULTIPLIER = 60; 

export default function Clock() {
  const timeScale = useGameStore(s => s.timeScale);
  const setTimeScale = useGameStore(s => s.setTimeScale);
  const gameTime = useGameStore(s => s.gameTime);
  const setGameTime = useGameStore(s => s.setGameTime);

  useEffect(() => {
    if (timeScale === 0) return;
    
    let lastTime = performance.now();
    let animationFrameId: number;

    const tick = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      
      // Update global store
      setGameTime(useGameStore.getState().gameTime + deltaMs * BASE_MULTIPLIER * timeScale);
      
      animationFrameId = requestAnimationFrame(tick);
    };
    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [timeScale]);

  const date = new Date(gameTime);
  const timeString = date.toISOString().substring(11, 16); // HH:mm
  const dateString = date.toISOString().substring(0, 10); // YYYY-MM-DD

  return (
    <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-3 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-64 text-right font-mono text-green-500">
      <div className="text-xs opacity-70 mb-1">{dateString}</div>
      <div className="text-2xl font-bold tracking-wider text-green-400 mb-2">{timeString}</div>
      
      <div className="flex justify-between items-center gap-1 border-t border-green-500/30 pt-2">
        <TimeButton label="||" active={timeScale === 0} onClick={() => setTimeScale(0)} />
        <TimeButton label="1x" active={timeScale === 1} onClick={() => setTimeScale(1)} />
        <TimeButton label="10x" active={timeScale === 10} onClick={() => setTimeScale(10)} />
        <TimeButton label="100x" active={timeScale === 100} onClick={() => setTimeScale(100)} />
        <TimeButton label="1000x" active={timeScale === 1000} onClick={() => setTimeScale(1000)} />
      </div>
    </div>
  );
}

function TimeButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`text-xs flex-1 py-1 border transition-colors text-center ${
        active 
          ? 'border-green-400 bg-green-900/50 text-white font-bold' 
          : 'border-green-500/20 hover:border-green-500/50 hover:bg-green-900/20 opacity-70'
      }`}
    >
      {label}
    </button>
  );
}
