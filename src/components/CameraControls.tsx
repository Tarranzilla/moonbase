'use client';

import { useGameStore } from '@/store/useGameStore';

export default function CameraControls() {
  const { autoRotate, setAutoRotate } = useGameStore();

  return (
    <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-3 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-64 text-green-500 font-mono text-xs">
      <button 
        onClick={() => setAutoRotate(!autoRotate)}
        className={`w-full py-2 px-2 border transition-colors tracking-wider font-bold ${
          autoRotate 
            ? 'bg-green-500/20 border-green-500 text-green-400' 
            : 'border-green-500/30 text-green-500/50 hover:border-green-500/50 hover:text-green-500'
        }`}
      >
        AUTO-ROTATION: {autoRotate ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
