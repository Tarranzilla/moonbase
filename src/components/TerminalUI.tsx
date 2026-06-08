'use client';

import { useGameStore } from '@/store/useGameStore';
import Clock from './Clock';
import CameraControls from './CameraControls';

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
  const { 
    selectedCellId, 
    selectedCoordinates, 
    teams, 
    selectedTeamId, 
    setSelectedTeam, 
    deployTeam, 
    moveTeam 
  } = useGameStore();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const handleDeploy = () => {
    if (selectedTeamId && selectedCellId) {
      deployTeam(selectedTeamId, parseInt(selectedCellId, 10));
    }
  };

  const handleMove = () => {
    if (selectedTeamId && selectedCellId) {
      moveTeam(selectedTeamId, parseInt(selectedCellId, 10));
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-8 flex flex-col justify-between font-mono text-green-500 z-10">
      {/* Top Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-[0.2em] shadow-green-500/50 drop-shadow-md">
          MOONBASE COMMAND TERMINAL
        </h1>
        <p className="text-sm opacity-80">OFFLINE SANDBOX // V0.1.0</p>
        <div className="h-px w-full max-w-4xl bg-green-500/50 mt-2" />
      </div>

      {/* Top Right: Clock and Camera Controls */}
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        <Clock />
        <CameraControls />
      </div>

      {/* Middle/Bottom Layout */}
      <div className="flex justify-between items-end w-full">
        
        {/* Left Panel: Engineer Roster */}
        <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-72">
          <h2 className="mb-2 text-sm font-bold border-b border-green-500/30 pb-1">ENGINEER ROSTER</h2>
          <div className="flex flex-col gap-2">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`text-left p-2 border text-xs transition-colors ${
                  selectedTeamId === team.id 
                    ? 'border-green-400 bg-green-900/30 text-green-300' 
                    : 'border-green-500/20 hover:border-green-500/50 opacity-70'
                }`}
              >
                <div className="font-bold">{team.name}</div>
                <div className="flex justify-between mt-1">
                  <span>STS: {team.status}</span>
                  {team.status === 'DEPLOYED' && <span>LOC: [{team.faceIndex}]</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Action Context Menu for Selected Team */}
          {selectedTeam && (
            <div className="mt-4 pt-4 border-t border-green-500/30">
              <p className="text-xs mb-2 opacity-80">ACTION COMMAND:</p>
              {selectedTeam.status === 'AVAILABLE' ? (
                <button 
                  onClick={handleDeploy}
                  disabled={!selectedCellId}
                  className="w-full py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-bold"
                >
                  DEPLOY TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                </button>
              ) : (
                <button 
                  onClick={handleMove}
                  disabled={!selectedCellId || selectedCellId === selectedTeam.faceIndex?.toString()}
                  className="w-full py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-bold"
                >
                  MOVE TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Sector Status */}
        <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-80">
          <h2 className="mb-2 text-sm font-bold border-b border-green-500/30 pb-1">
            SECTOR STATUS
          </h2>
          {selectedCellId ? (
            <div className="space-y-1">
              <p>TARGET SECTOR: <span className="font-bold text-green-400">[{selectedCellId}]</span></p>
              {selectedCoordinates && (
                <p className="text-green-600/80 text-xs pb-1">
                  {formatCoords(selectedCoordinates.lat, selectedCoordinates.lon)}
                </p>
              )}
              <p>STATUS: <span className="animate-pulse text-green-300">UNEXPLORED</span></p>
              <p className="text-xs opacity-70 mt-2">Awaiting engineering deployment...</p>
            </div>
          ) : (
            <p className="text-xs opacity-70">AWAITING SECTOR SELECTION...</p>
          )}
        </div>

      </div>

      {/* Scanline overlay (CSS based in addition to PostProcessing, or just extra styling) */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
