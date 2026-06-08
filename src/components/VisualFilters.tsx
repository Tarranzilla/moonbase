'use client';

import { useGameStore } from '@/store/useGameStore';

export default function VisualFilters() {
  const { filters, toggleFilter } = useGameStore();

  return (
    <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-3 mt-2 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-64 text-green-500 font-mono text-xs">
      <div className="mb-2 opacity-70 uppercase tracking-wider">Visual Filters</div>
      
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => toggleFilter('showEquator')}
          className={`w-full py-1 px-2 border transition-colors flex justify-between items-center ${
            filters.showEquator 
              ? 'bg-green-500/20 border-green-500 text-green-400' 
              : 'border-green-500/30 text-green-500/50 hover:border-green-500/50 hover:text-green-500'
          }`}
        >
          <span>EQUATOR & POLES</span>
          <span>{filters.showEquator ? '[ON]' : '[OFF]'}</span>
        </button>
        
        <button 
          onClick={() => toggleFilter('showCraters')}
          className={`w-full py-1 px-2 border transition-colors flex justify-between items-center ${
            filters.showCraters 
              ? 'bg-green-500/20 border-green-500 text-green-400' 
              : 'border-green-500/30 text-green-500/50 hover:border-green-500/50 hover:text-green-500'
          }`}
        >
          <span>LUNAR CRATERS</span>
          <span>{filters.showCraters ? '[ON]' : '[OFF]'}</span>
        </button>

        <button 
          onClick={() => toggleFilter('showMares')}
          className={`w-full py-1 px-2 border transition-colors flex justify-between items-center ${
            filters.showMares 
              ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
              : 'border-blue-500/30 text-blue-500/50 hover:border-blue-500/50 hover:text-blue-500'
          }`}
        >
          <span>LUNAR SEAS (MARES)</span>
          <span>{filters.showMares ? '[ON]' : '[OFF]'}</span>
        </button>
      </div>
    </div>
  );
}
