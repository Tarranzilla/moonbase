'use client';

import { useGameStore } from '@/store/useGameStore';

function formatCoords(lat: number, lon: number) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  
  const latAbs = Math.abs(lat);
  const lonAbs = Math.abs(lon);
  
  const latDeg = Math.floor(latAbs);
  const latMin = Math.floor((latAbs - latDeg) * 60);
  const latSec = Math.floor((((latAbs - latDeg) * 60) - latMin) * 60);

  const lonDeg = Math.floor(lonAbs);
  const lonMin = Math.floor((lonAbs - lonDeg) * 60);
  const lonSec = Math.floor((((lonAbs - lonDeg) * 60) - lonMin) * 60);

  return `${latDeg}°${latMin}'${latSec}"${latDir}  ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
}

export default function TerminalUI() {
  const selectedCellId = useGameStore((state) => state.selectedCellId);
  const selectedCoordinates = useGameStore((state) => state.selectedCoordinates);

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-8 flex flex-col justify-between font-mono text-green-500 z-10">
      {/* Header */}
      <header className="border-b-2 border-green-500/50 pb-2 mb-4 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">
        <h1 className="text-xl md:text-3xl font-bold tracking-widest uppercase">
          Moonbase Command Terminal
        </h1>
        <p className="text-sm md:text-base opacity-80 uppercase tracking-widest">
          Offline Sandbox // v0.1.0
        </p>
      </header>

      {/* Info Panel */}
      <div className="pointer-events-auto border-2 border-green-500/50 bg-black/40 backdrop-blur-sm p-4 w-full max-w-md self-end drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
        <h2 className="text-lg font-bold border-b border-green-500/30 pb-1 mb-2 uppercase">
          Sector Status
        </h2>
        {selectedCellId ? (
          <div className="space-y-1">
            <p>TARGET SECTOR: <span className="font-bold text-green-400">[{selectedCellId}]</span>
              {selectedCoordinates && (
                <span className="ml-3 text-green-600/80 text-xs">
                  {formatCoords(selectedCoordinates.lat, selectedCoordinates.lon)}
                </span>
              )}
            </p>
            <p>STATUS: <span className="animate-pulse text-green-300">UNEXPLORED</span></p>
            <p className="text-xs opacity-70 mt-2">Awaiting engineering deployment...</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="animate-pulse">AWAITING SECTOR SELECTION...</p>
            <p className="text-xs opacity-70 mt-2">Click on the lunar grid to select a target.</p>
          </div>
        )}
      </div>

      {/* Scanline overlay (CSS based in addition to PostProcessing, or just extra styling) */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
