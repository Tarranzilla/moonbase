'use client';

import { useGameStore } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';
import Clock from './Clock';
import CameraControls from './CameraControls';
import VisualFilters from './VisualFilters';
import SearchUI from './SearchUI';
import { useState } from 'react';

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);

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
    <div className="absolute inset-0 pointer-events-none p-2 md:p-8 flex flex-col justify-between font-mono text-green-500 z-10 overflow-hidden">
      
      {/* Top Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-2 md:gap-4 w-full">
        
        {/* Top Left: Header & Search */}
        <div className="flex flex-col gap-2 w-full md:w-auto flex-shrink-0 mt-4 md:mt-0 pointer-events-auto">
          
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 pointer-events-none">
              <h1 className="text-xl md:text-3xl font-bold tracking-[0.1em] md:tracking-[0.2em] shadow-green-500/50 drop-shadow-md leading-tight md:whitespace-nowrap">
                MOONBASE COMMAND TERMINAL
              </h1>
              <p className="text-[10px] md:text-sm opacity-80">OFFLINE SANDBOX // V0.1.0</p>
            </div>
            
            {/* Mobile Settings Button */}
            <button 
              className="md:hidden pointer-events-auto border border-green-500/50 text-green-500 bg-black/60 px-2 py-1 text-[10px] hover:bg-green-500/20"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              {isSettingsOpen ? '[X] CFG' : '[+] CFG'}
            </button>
          </div>

          <div className="hidden md:block h-px w-full max-w-4xl bg-green-500/50 mt-1 md:mt-2 pointer-events-none" />
          
          {/* Clock for Mobile */}
          <div className="md:hidden w-full pointer-events-auto">
            <Clock />
          </div>

          <SearchUI />
        </div>

        {/* Top Right: Desktop Clock, Camera Controls, and Filters */}
        <div className="hidden md:flex pointer-events-auto flex-col gap-2 items-end mt-2 md:mt-0">
          <Clock />
          <CameraControls />
          <VisualFilters />
        </div>

      </div>

      {/* Mobile Settings Modal */}
      {isSettingsOpen && (
        <div className="md:hidden absolute top-20 right-2 pointer-events-auto flex flex-col gap-2 items-end z-30">
          <CameraControls />
          <VisualFilters />
        </div>
      )}

      {/* Build Hints Overlay */}
      {buildMode !== 'NONE' && (
        <div className="pointer-events-none absolute top-1/3 md:top-24 left-1/2 -translate-x-1/2 bg-black/80 border border-green-500 p-2 text-center shadow-[0_0_20px_rgba(0,255,0,0.2)] z-20 w-11/12 md:w-auto">
          <p className="animate-pulse text-sm font-bold">
            {buildMode === 'CONNECTION' 
              ? useGameStore.getState().connectionStartFace === null 
                ? "SELECT FIRST STRUCTURE TO LINK" 
                : "SELECT SECOND STRUCTURE TO LINK"
              : buildMode === 'DECONSTRUCT'
                ? "SELECT STRUCTURE TO DECONSTRUCT"
                : `SELECT SECTOR TO BUILD ${buildMode.replace('_', ' ')}`
            }
          </p>
        </div>
      )}

      {/* Bottom Layout */}
      <div className="flex flex-col md:flex-row justify-end md:justify-between items-end w-full gap-2 md:gap-0 pb-2 md:pb-0 max-h-[65vh] md:max-h-none overflow-hidden">
        
        {/* Left Panel: Engineer Roster */}
        <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 md:p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-full md:w-72 flex-shrink-0 flex flex-col max-h-full">
          <div 
            className="flex justify-between items-center cursor-pointer md:cursor-default mb-1 md:mb-2 border-b border-green-500/30 pb-1"
            onClick={() => setIsRosterExpanded(!isRosterExpanded)}
          >
            <h2 className="text-xs md:text-sm font-bold">ENGINEER ROSTER</h2>
            <span className="md:hidden text-xs font-bold text-green-400">{isRosterExpanded ? '[-]' : '[+]'}</span>
          </div>
          
          <div className={`${isRosterExpanded ? 'flex flex-col' : 'hidden md:flex md:flex-col'} overflow-y-auto terminal-scrollbar flex-1 min-h-0`}>
            <div className="flex flex-col gap-2 shrink-0">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`text-left p-1 md:p-2 border text-[10px] md:text-xs transition-colors ${
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
            <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-green-500/30">
              <p className="text-[10px] md:text-xs mb-1 md:mb-2 opacity-80">ACTION COMMAND:</p>
              {selectedTeam.status === 'AVAILABLE' ? (
                <button 
                  onClick={handleDeploy}
                  disabled={!selectedCellId}
                  className="w-full py-1 md:py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-[10px] md:text-xs font-bold"
                >
                  DEPLOY TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                </button>
              ) : selectedTeam.status === 'MOVING_TO_BUILD' || selectedTeam.status === 'BUILDING' || selectedTeam.status === 'MOVING_TO' ? (
                <div className="text-[10px] md:text-xs space-y-1 opacity-80">
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
                <div className="flex flex-col gap-1 md:gap-2">
                  <button 
                    onClick={handleMove}
                    disabled={!selectedCellId || selectedCellId === selectedTeam.faceIndex?.toString()}
                    className="w-full py-1 md:py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-[10px] md:text-xs font-bold"
                  >
                    MOVE TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                  </button>
                  
                  <div className="h-px w-full bg-green-500/20 my-1" />
                  
                  <p className="text-[9px] md:text-[10px] opacity-70">CONSTRUCTION MANAGER:</p>
                  <div className="grid grid-cols-2 gap-1 md:gap-2">
                    <button 
                      onClick={() => setBuildMode('SOLAR_PANEL')}
                      className={`py-1 border text-[9px] md:text-[10px] transition-colors ${buildMode === 'SOLAR_PANEL' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      SOLAR PNL
                    </button>
                    <button 
                      onClick={() => setBuildMode('BATTERY')}
                      className={`py-1 border text-[9px] md:text-[10px] transition-colors ${buildMode === 'BATTERY' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      BATTERY
                    </button>
                    <button 
                      onClick={() => setBuildMode('NODE')}
                      className={`py-1 border text-[9px] md:text-[10px] transition-colors ${buildMode === 'NODE' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      PWR NODE
                    </button>
                    <button 
                      onClick={() => setBuildMode('CONNECTION')}
                      className={`py-1 border text-[9px] md:text-[10px] transition-colors ${buildMode === 'CONNECTION' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                    >
                      LINK
                    </button>
                  </div>
                  <button 
                    onClick={() => setBuildMode(buildMode === 'DECONSTRUCT' ? 'NONE' : 'DECONSTRUCT')}
                    className={`w-full py-1 border text-[9px] md:text-[10px] transition-colors mt-1 ${buildMode === 'DECONSTRUCT' ? 'bg-red-900/80 text-red-100 border-red-500' : 'text-red-500 border-red-900 hover:bg-red-900/30'}`}
                  >
                    DECONSTRUCT
                  </button>
                  
                  {buildMode !== 'NONE' && (
                    <button 
                      onClick={() => setBuildMode('NONE')}
                      className="w-full py-1 border border-green-500/30 text-[10px] md:text-xs hover:bg-green-500/10 transition-colors mt-1"
                    >
                      CANCEL BUILD MODE
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Right Panel: Sector Status */}
        <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 md:p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-full md:w-80 flex-shrink-0 mt-auto">
          <h2 className="mb-1 md:mb-2 text-xs md:text-sm font-bold border-b border-green-500/30 pb-1">
            SECTOR STATUS
          </h2>
          {selectedCellId ? (
            <div className="space-y-1">
              <p className="text-[10px] md:text-xs">TARGET SECTOR: <span className="font-bold text-green-400">[{selectedCellId}]</span></p>
              {selectedCoordinates && (
                <p className="text-green-600/80 text-[9px] md:text-xs pb-1">
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
                    <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t border-green-500/20 text-[10px] md:text-xs">
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
                  <div className="mt-1 md:mt-2 text-[10px] md:text-xs">
                    <p>STATUS: <span className="animate-pulse text-green-300">UNEXPLORED</span></p>
                    <p className="opacity-70 mt-1 text-[9px] md:text-xs">Awaiting engineering deployment...</p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-[10px] md:text-xs opacity-70">AWAITING SECTOR SELECTION...</p>
          )}
        </div>

      </div>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
