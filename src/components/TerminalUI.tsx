'use client';

import { useGameStore } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';
import Clock from './Clock';
import CameraControls from './CameraControls';
import VisualFilters from './VisualFilters';

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
    moveTeam,
    buildMode,
    setBuildMode,
    buildings
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

      {/* Top Right: Clock, Camera Controls, and Filters */}
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        <Clock />
        <CameraControls />
        <VisualFilters />
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
              ) : selectedTeam.status === 'MOVING_TO_BUILD' || selectedTeam.status === 'BUILDING' || selectedTeam.status === 'MOVING_TO' ? (
                <div className="text-xs space-y-1 opacity-80">
                  <p>STATUS: <span className="animate-pulse text-green-300">{selectedTeam.status}</span></p>
                  {selectedTeam.buildJob && <p>JOB: {selectedTeam.buildJob.type}</p>}
                  
                  {/* Allow cancelling movement if just moving */}
                  {selectedTeam.status === 'MOVING_TO' && (
                    <button 
                      onClick={() => useGameStore.getState().setTeamPath(selectedTeam.id, [])}
                      className="w-full py-1 border border-red-500/50 text-red-400 hover:bg-red-900/30 transition-colors mt-2"
                    >
                      HALT MOVEMENT
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={handleMove}
                    disabled={!selectedCellId || selectedCellId === selectedTeam.faceIndex?.toString()}
                    className="w-full py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-bold"
                  >
                    MOVE TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                  </button>
                  
                  <div className="h-px w-full bg-green-500/20 my-1" />
                  
                  <p className="text-[10px] opacity-70">CONSTRUCTION MANAGER:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setBuildMode('SOLAR_PANEL')}
                      className={`py-1 border text-[10px] transition-colors ${buildMode === 'SOLAR_PANEL' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      SOLAR PNL
                    </button>
                    <button 
                      onClick={() => setBuildMode('BATTERY')}
                      className={`py-1 border text-[10px] transition-colors ${buildMode === 'BATTERY' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      BATTERY
                    </button>
                    <button 
                      onClick={() => setBuildMode('NODE')}
                      className={`py-1 border text-[10px] transition-colors ${buildMode === 'NODE' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      PWR NODE
                    </button>
                    <button 
                      onClick={() => setBuildMode('CONNECTION')}
                      className={`py-1 border text-[10px] transition-colors ${buildMode === 'CONNECTION' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      LINK
                    </button>
                  </div>
                  <button 
                    onClick={() => setBuildMode(buildMode === 'DECONSTRUCT' ? 'NONE' : 'DECONSTRUCT')}
                    className={`w-full py-1 border text-[10px] transition-colors mt-1 ${buildMode === 'DECONSTRUCT' ? 'bg-red-900/80 text-red-100 border-red-500' : 'text-red-500 border-red-900 hover:bg-red-900/30'}`}
                  >
                    DECONSTRUCT
                  </button>
                  
                  {buildMode !== 'NONE' && (
                    <button 
                      onClick={() => setBuildMode('NONE')}
                      className="w-full py-1 border border-green-500/30 text-xs hover:bg-green-500/10 transition-colors mt-1"
                    >
                      CANCEL BUILD MODE
                    </button>
                  )}
                </div>
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
              {(() => {
                const building = buildings.find(b => b.faceIndex === parseInt(selectedCellId, 10));
                if (building) {
                  let isIlluminated = false;
                  if (building.type === 'SOLAR_PANEL') {
                    const gameTime = useGameStore.getState().gameTime;
                    const LUNAR_DAY_MS = 28 * 24 * 60 * 60 * 1000;
                    const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
                    const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
                    const center = getFaceCenter(building.faceIndex);
                    if (center) {
                      const dot = center.clone().normalize().dot(sunPos);
                      isIlluminated = dot > 0;
                    }
                  }

                  return (
                    <div className="mt-2 pt-2 border-t border-green-500/20 text-xs">
                      <p className="font-bold text-blue-400">STRUCTURE DETECTED</p>
                      <p>TYPE: {building.type}</p>
                      <p>STATUS: <span className={building.status === 'OPERATIONAL' ? 'text-green-400' : 'animate-pulse text-yellow-400'}>{building.status}</span></p>
                      {building.type === 'SOLAR_PANEL' && building.status === 'OPERATIONAL' && (
                        <p>LIGHT: <span className={isIlluminated ? "text-yellow-400 font-bold" : "text-blue-900"}>{isIlluminated ? "DIRECT SUNLIGHT" : "IN SHADOW"}</span></p>
                      )}
                      {building.type === 'BATTERY' && building.status === 'OPERATIONAL' && (
                        <p>ENERGY: {Math.floor(building.energyStored)} / {building.energyMax}</p>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="mt-2 text-xs">
                    <p>STATUS: <span className="animate-pulse text-green-300">UNEXPLORED</span></p>
                    <p className="opacity-70 mt-1">Awaiting engineering deployment...</p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-xs opacity-70">AWAITING SECTOR SELECTION...</p>
          )}
        </div>

      </div>

      {/* Build Hints Overlay */}
      {buildMode !== 'NONE' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none bg-black/80 border border-green-500 p-2 text-center shadow-[0_0_20px_rgba(0,255,0,0.2)]">
          <p className="animate-pulse text-sm font-bold">
            {buildMode === 'CONNECTION' 
              ? useGameStore.getState().connectionStartFace === null 
                ? "> CLICK FIRST STRUCTURE TO LINK <" 
                : "> CLICK SECOND STRUCTURE TO LINK <"
              : buildMode === 'DECONSTRUCT'
                ? "> CLICK STRUCTURE TO DECONSTRUCT <"
                : `> CLICK SECTOR TO BUILD ${buildMode} <`
            }
          </p>
        </div>
      )}

      {/* Scanline overlay (CSS based in addition to PostProcessing, or just extra styling) */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
