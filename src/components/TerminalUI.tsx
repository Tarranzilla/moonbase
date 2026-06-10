'use client';

import { useGameStore } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter, vector3ToCoord } from '@/utils/geo';
import { getSectorResources } from '@/utils/geology';
import Clock from './Clock';
import CameraControls from './CameraControls';
import VisualFilters from './VisualFilters';
import SearchUI from './SearchUI';
import { useState, useEffect } from 'react';

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
    buildings,
    connections,
    updateConnection
  } = useGameStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [isQueueExpanded, setIsQueueExpanded] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBuildMode('NONE');
      }
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      const state = useGameStore.getState();
      if (state.buildMode === 'CONNECTION') {
        e.preventDefault();
        
        let undone = false;
        if (state.selectedTeamId && state.connectionStartFace !== null) {
          undone = state.undoLastConnectionAction(state.selectedTeamId);
        }
        
        if (!undone) {
          if (state.connectionStartFace !== null) {
            state.setConnectionStartFace(null);
          } else {
            state.setBuildMode('NONE');
          }
        }
      } else if (state.buildMode !== 'NONE') {
        e.preventDefault();
        state.setBuildMode('NONE');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [setBuildMode]);

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

  const totalWater = buildings.reduce((sum, b) => sum + (b.waterStored || 0), 0);
  const maxWater = buildings.reduce((sum, b) => sum + (b.waterMax || 0), 0);
  const totalMinerals = buildings.reduce((sum, b) => sum + (b.mineralsStored || 0), 0);
  const maxMinerals = buildings.reduce((sum, b) => sum + (b.mineralsMax || 0), 0);

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
              <div className="flex gap-3 md:gap-6 items-center">
                <p className="text-[10px] md:text-sm opacity-80">OFFLINE SANDBOX // V0.1.0</p>
                <div className="flex gap-2 bg-black/60 px-2 py-0.5 border border-green-500/30">
                  <p className="text-[9px] md:text-xs text-cyan-400">H2O: {Math.floor(totalWater)}/{maxWater}</p>
                  <p className="text-[9px] md:text-xs text-orange-400">MIN: {Math.floor(totalMinerals)}/{maxMinerals}</p>
                </div>
              </div>
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
        
        {/* Left Side: Roster Container */}
        <div className="flex flex-col gap-2 w-full md:w-80 max-h-full min-h-0 flex-shrink">
          
          {/* Engineer Roster Panel */}
          <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 md:p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] flex-shrink flex flex-col max-h-full min-h-0">
            <div 
              className="flex justify-between items-center cursor-pointer md:cursor-default mb-1 md:mb-2 border-b border-green-500/30 pb-1"
              onClick={() => setIsRosterExpanded(!isRosterExpanded)}
            >
              <h2 className="text-sm md:text-base font-bold">ENGINEER ROSTER</h2>
              <span className="md:hidden text-xs font-bold text-green-400">{isRosterExpanded ? '[-]' : '[+]'}</span>
            </div>
            
            <div className={`${isRosterExpanded ? 'flex flex-col' : 'hidden md:flex md:flex-col'} flex-1 min-h-0`}>
              <div className="flex flex-col gap-2 overflow-y-auto terminal-scrollbar flex-1 min-h-0">
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className={`text-left p-1 md:p-2 border text-xs md:text-sm transition-colors shrink-0 ${
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
                <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-green-500/30 flex flex-col min-h-0 max-h-[65%] shrink">
                  <p className="text-sm md:text-base mb-1 md:mb-2 opacity-80 shrink-0">ACTION COMMAND:</p>
                  {selectedTeam.status === 'AVAILABLE' ? (
                    <button 
                      onClick={handleDeploy}
                      disabled={!selectedCellId}
                      className="w-full py-1 md:py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs md:text-sm font-bold shrink-0"
                    >
                      DEPLOY TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1 md:gap-2 overflow-y-auto terminal-scrollbar pr-1 min-h-0">
                      {/* Busy Status Overlay */}
                      {(selectedTeam.status === 'MOVING_TO_BUILD' || selectedTeam.status === 'BUILDING' || selectedTeam.status === 'MOVING_TO') && (
                        <div className="text-xs md:text-sm space-y-1 opacity-80 mb-1 border-b border-green-500/30 pb-2">
                          <p>STATUS: <span className="animate-pulse text-green-300">{selectedTeam.status}</span></p>
                          {selectedTeam.buildJob && <p>JOB: {selectedTeam.buildJob.type.replace('_', ' ')}</p>}
                          {selectedTeam.status === 'MOVING_TO' && (
                            <button 
                              onClick={() => useGameStore.getState().setTeamPath(selectedTeam.id, [])}
                              className="w-full py-1 border border-red-500/50 text-red-400 hover:bg-red-900/30 transition-colors mt-2"
                            >
                              HALT MOVEMENT
                            </button>
                          )}
                        </div>
                      )}

                      <button 
                        onClick={handleMove}
                        disabled={!selectedCellId || selectedCellId === selectedTeam.faceIndex?.toString()}
                        className="w-full py-1 md:py-2 border border-green-500 bg-green-900/20 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs md:text-sm font-bold"
                      >
                        MOVE TO SECTOR {selectedCellId ? `[${selectedCellId}]` : '...'}
                      </button>
                      
                      <div className="h-px w-full bg-green-500/20 my-1" />
                      
                      <p className="text-[10px] md:text-xs opacity-70 mt-2 text-blue-400">POWER & LOGISTICS:</p>
                      <div className="grid grid-cols-2 gap-1 md:gap-2">
                        <button 
                          onClick={() => setBuildMode('CORE')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'CORE' ? 'bg-blue-500 text-black border-blue-500' : 'border-blue-500/50 hover:bg-blue-900/40 text-blue-400'}`}
                        >
                          CORE
                        </button>
                        <button 
                          onClick={() => setBuildMode('WAREHOUSE')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'WAREHOUSE' ? 'bg-blue-500 text-black border-blue-500' : 'border-blue-500/50 hover:bg-blue-900/40 text-blue-400'}`}
                        >
                          WAREHOUSE
                        </button>
                        <button 
                          onClick={() => setBuildMode('SOLAR_PANEL')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'SOLAR_PANEL' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                        >
                          SOLAR PNL
                        </button>
                        <button 
                          onClick={() => setBuildMode('BATTERY')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'BATTERY' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                        >
                          BATTERY
                        </button>
                        <button 
                          onClick={() => setBuildMode('JUNCTION')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'JUNCTION' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                        >
                          JUNCTION
                        </button>
                        <button 
                          onClick={() => setBuildMode('CONNECTION')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'CONNECTION' ? 'bg-green-500 text-black border-green-500' : 'border-green-500/50 hover:bg-green-900/40'}`}
                        >
                          LINK
                        </button>
                      </div>

                      <p className="text-[10px] md:text-xs opacity-70 mt-1 text-cyan-400">RESOURCE EXTRACTION:</p>
                      <div className="grid grid-cols-2 gap-1 md:gap-2">
                        <button 
                          onClick={() => setBuildMode('ICE_EXTRACTOR')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'ICE_EXTRACTOR' ? 'bg-cyan-500 text-black border-cyan-500' : 'border-cyan-500/50 hover:bg-cyan-900/40 text-cyan-400'}`}
                        >
                          ICE DRILL
                        </button>
                        <button 
                          onClick={() => setBuildMode('MINERAL_EXTRACTOR')}
                          className={`py-2 border text-[10px] md:text-xs font-bold transition-colors ${buildMode === 'MINERAL_EXTRACTOR' ? 'bg-cyan-500 text-black border-cyan-500' : 'border-cyan-500/50 hover:bg-cyan-900/40 text-cyan-400'}`}
                        >
                          MINERAL EXCAV
                        </button>
                      </div>
                      <button 
                        onClick={() => setBuildMode(buildMode === 'DECONSTRUCT' ? 'NONE' : 'DECONSTRUCT')}
                        className={`w-full py-2 border text-[10px] md:text-xs font-bold transition-colors mt-1 ${buildMode === 'DECONSTRUCT' ? 'bg-red-900/80 text-red-100 border-red-500' : 'text-red-500 border-red-900 hover:bg-red-900/30'}`}
                      >
                        DECONSTRUCT
                      </button>
                      
                      {buildMode !== 'NONE' && (
                        <button 
                          onClick={() => setBuildMode('NONE')}
                          className="w-full py-1 border border-green-500/30 text-xs md:text-sm hover:bg-green-500/10 transition-colors mt-1"
                        >
                          CANCEL BUILD MODE
                        </button>
                      )}

                      {/* Cancel Orders (if busy) */}
                      {(selectedTeam.status === 'MOVING_TO_BUILD' || selectedTeam.status === 'BUILDING' || selectedTeam.status === 'MOVING_TO') && (
                        <button 
                          onClick={() => useGameStore.getState().cancelJob(selectedTeam.id)}
                          className="w-full py-1 border border-red-500/50 text-red-400 font-bold hover:bg-red-900/30 transition-colors mt-2 text-xs md:text-sm"
                        >
                          CANCEL ENGINEER ORDERS
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-80 max-h-full min-h-0 flex-shrink mt-auto md:mt-0">
          
          {/* Building Queue Panel (Moved here) */}
          {selectedTeam && (selectedTeam.buildJob || (selectedTeam.jobQueue && selectedTeam.jobQueue.length > 0)) && (
            <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 md:p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] flex-shrink-0 flex flex-col min-h-0">
              <div 
                className="flex justify-between items-center cursor-pointer mb-1 md:mb-2 border-b border-green-500/30 pb-1"
                onClick={() => setIsQueueExpanded(!isQueueExpanded)}
              >
                <h2 className="text-sm md:text-base font-bold">BUILDING QUEUE</h2>
                <span className="text-xs font-bold text-green-400">{isQueueExpanded ? '[-]' : '[+]'}</span>
              </div>
              
              <div className={`${isQueueExpanded ? 'flex flex-col' : 'hidden'} overflow-y-auto terminal-scrollbar max-h-40 min-h-0 text-xs md:text-sm gap-1`}>
                {selectedTeam.buildJob && (
                  <div className="border border-green-400 bg-green-900/30 text-green-300 p-1 md:p-2 flex justify-between items-center">
                    <span>ACTIVE: {selectedTeam.buildJob.type.replace('_', ' ')}</span>
                    <span>[{selectedTeam.buildJob.targetFaceIndex}]</span>
                  </div>
                )}
                {selectedTeam.jobQueue && selectedTeam.jobQueue.map((job, idx) => (
                  <div key={idx} className="border border-green-500/30 opacity-70 p-1 md:p-2 flex justify-between items-center">
                    <span>Q{idx + 1}: {job.type.replace('_', ' ')}</span>
                    <span>[{job.targetFaceIndex}]</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right Panel: Sector Status */}
          <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 md:p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] w-full flex-shrink-0 mt-auto">
            <h2 className="mb-1 md:mb-2 text-sm md:text-base font-bold border-b border-green-500/30 pb-1">
              SECTOR STATUS
            </h2>
          {selectedCellId ? (
            <div className="space-y-1">
              <p className="text-xs md:text-sm">TARGET SECTOR: <span className="font-bold text-green-400">[{selectedCellId}]</span></p>
              {selectedCoordinates && (
                <>
                  <p className="text-green-600/80 text-[10px] md:text-xs pb-1 border-b border-green-500/20">
                    {formatCoords(selectedCoordinates.lat, selectedCoordinates.lon)}
                  </p>
                  
                  {(() => {
                    const res = getSectorResources(selectedCoordinates.lat, selectedCoordinates.lon);
                    return (
                      <div className="py-1 text-[10px] md:text-xs space-y-0.5">
                        <p className="text-blue-400 font-bold">GEOLOGICAL SCAN:</p>
                        <p>H2O TRACES: <span className={res.water === 'HIGH' ? 'text-cyan-400 font-bold' : res.water === 'MEDIUM' ? 'text-cyan-600' : 'text-gray-500'}>{res.water}</span></p>
                        <p>MINERALS: <span className={res.minerals === 'HIGH' ? 'text-orange-400 font-bold' : res.minerals === 'MEDIUM' ? 'text-orange-600' : 'text-gray-500'}>{res.minerals}</span></p>
                      </div>
                    );
                  })()}
                </>
              )}
              {(() => {
                const building = buildings.find(b => b.faceIndex === parseInt(selectedCellId, 10));
                if (building) {
                  let isIlluminated = false;
                  let solarProduction = 0;
                  if (building.type === 'SOLAR_PANEL') {
                    const gameTime = useGameStore.getState().gameTime;
                    const LUNAR_DAY_MS = 28 * 24 * 60 * 60 * 1000;
                    const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
                    const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
                    const center = getFaceCenter(building.faceIndex);
                    if (center) {
                      const dot = center.clone().normalize().dot(sunPos);
                      isIlluminated = dot > 0;
                      if (isIlluminated) {
                        solarProduction = Math.floor(dot * 100);
                      }
                    }
                  }

                  return (
                    <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t border-green-500/20 text-xs md:text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-bold text-blue-400">STRUCTURE DETECTED</p>
                        <button 
                          onClick={() => useGameStore.getState().updateBuilding(building.id, { isOn: building.isOn === false ? true : false })} 
                          className={`px-2 py-0.5 border text-[10px] font-bold transition-colors ${building.isOn !== false ? 'border-green-500 text-green-400 bg-green-900/30' : 'border-red-500 text-red-400 bg-red-900/30'}`}
                        >
                          POWER {building.isOn !== false ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <p>ID: {building.name || building.type}</p>
                      <p>STATUS: <span className={building.status === 'OPERATIONAL' ? (building.isBlocked ? 'text-yellow-400 font-bold' : 'text-green-400') : 'animate-pulse text-yellow-400'}>
                        {building.status === 'OPERATIONAL' && building.isBlocked ? 'OFFLINE - WAREHOUSES FULL' : building.status}
                      </span></p>
                      {building.type === 'SOLAR_PANEL' && building.status === 'OPERATIONAL' && (
                        <>
                          <p>LIGHT: <span className={isIlluminated ? "text-yellow-400 font-bold" : "text-blue-900"}>{isIlluminated ? "DIRECT SUNLIGHT" : "IN SHADOW"}</span></p>
                          <p>PRODUCTION: <span className={isIlluminated ? "text-green-400 font-bold" : ""}>+{solarProduction} E/h</span></p>
                        </>
                      )}
                      {building.type === 'JUNCTION' && building.status === 'OPERATIONAL' && (
                        <div className="mt-2 border-t border-green-500/20 pt-1">
                          <p className="font-bold text-blue-400 mb-1">FLOW CONTROL</p>
                          {connections.filter(c => c.fromFaceIndex === building.faceIndex || c.toFaceIndex === building.faceIndex).map(c => {
                            const isFrom = c.fromFaceIndex === building.faceIndex;
                            const otherId = isFrom ? c.toFaceIndex : c.fromFaceIndex;
                            const otherBuilding = buildings.find(b => b.faceIndex === otherId);
                            const flow = c.flowType || 'BOTH';
                            
                            // Determine display text based on flow relative to this junction
                            let displayFlow = 'BOTH (IN/OUT)';
                            if (flow === 'NONE') displayFlow = 'BLOCKED';
                            else if (flow === 'A_TO_B') displayFlow = isFrom ? 'OUT ONLY' : 'IN ONLY';
                            else if (flow === 'B_TO_A') displayFlow = isFrom ? 'IN ONLY' : 'OUT ONLY';

                            const toggleFlow = () => {
                              // BOTH -> OUT -> IN -> BLOCKED -> BOTH
                              // OUT from Junction = if (isFrom) A_TO_B else B_TO_A
                              // IN to Junction = if (isFrom) B_TO_A else A_TO_B
                              let nextFlow: 'BOTH' | 'A_TO_B' | 'B_TO_A' | 'NONE' = 'BOTH';
                              if (flow === 'BOTH') nextFlow = isFrom ? 'A_TO_B' : 'B_TO_A'; // OUT
                              else if ((flow === 'A_TO_B' && isFrom) || (flow === 'B_TO_A' && !isFrom)) nextFlow = isFrom ? 'B_TO_A' : 'A_TO_B'; // IN
                              else if ((flow === 'B_TO_A' && isFrom) || (flow === 'A_TO_B' && !isFrom)) nextFlow = 'NONE'; // BLOCKED
                              else if (flow === 'NONE') nextFlow = 'BOTH';

                              updateConnection(c.id, { flowType: nextFlow });
                            };

                            return (
                              <div key={c.id} className="flex justify-between items-center mb-1">
                                <span className="truncate pr-2 text-[10px] md:text-xs">Link to {otherBuilding?.type || 'Unknown'}</span>
                                <button onClick={toggleFlow} className="px-1 border border-green-500/50 hover:bg-green-900/40 min-w-[70px] text-center text-[9px]">
                                  {displayFlow}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(building.type === 'BATTERY' || building.type === 'CORE') && building.status === 'OPERATIONAL' && (
                        <>
                          <p>ENERGY: {Math.floor(building.energyStored)} / {building.energyMax}</p>
                          {building.type === 'CORE' && (
                            <p>CONSUMPTION: <span className="text-red-400 font-bold">-1 E/h</span></p>
                          )}
                          {building.energyDelta !== undefined && (
                            <p>NET FLOW: <span className={building.energyDelta > 0 ? 'text-green-400 font-bold' : building.energyDelta < 0 ? 'text-red-400 font-bold' : ''}>
                              {building.energyDelta > 0 ? '+' : ''}{building.energyDelta} E/h
                            </span></p>
                          )}
                        </>
                      )}
                      {(building.type === 'WAREHOUSE' || building.type === 'CORE') && building.status === 'OPERATIONAL' && (
                        <>
                          <p>WATER: {Math.floor(building.waterStored)} / {building.waterMax}</p>
                          <p>MINERALS: {Math.floor(building.mineralsStored)} / {building.mineralsMax}</p>
                        </>
                      )}
                      {(building.type === 'ICE_EXTRACTOR' || building.type === 'MINERAL_EXTRACTOR') && building.status === 'OPERATIONAL' && (
                        <>
                          <div className="flex items-center gap-2 mt-2 mb-1">
                            <span>INTENSITY:</span>
                            <input 
                              type="range" 
                              min="0" max="1" step="0.1" 
                              value={building.extractionRate ?? 1.0} 
                              onChange={(e) => useGameStore.getState().updateBuilding(building.id, { extractionRate: parseFloat(e.target.value) })}
                              className="w-24 accent-green-500 cursor-pointer"
                            />
                            <span>{Math.round((building.extractionRate ?? 1.0) * 100)}%</span>
                          </div>
                          <p>POWER: <span className={building.isPowered ? 'text-green-400 font-bold' : 'text-red-500 font-bold animate-pulse'}>{building.isPowered ? '[POWERED]' : '[NO POWER]'}</span></p>
                          <p>CONSUMPTION: -{Math.round(10 * (building.extractionRate ?? 1.0))} E/h</p>
                          {(() => {
                            let prodRate = 0;
                            if (building.faceIndex !== null) {
                              const center = getFaceCenter(building.faceIndex);
                              if (center) {
                                const { lat, lon } = vector3ToCoord(center);
                                const res = getSectorResources(lat, lon);
                                const mult = building.type === 'ICE_EXTRACTOR' ? res.waterMultiplier : res.mineralsMultiplier;
                                prodRate = 10 * (building.extractionRate ?? 1.0) * mult;
                              }
                            }
                            return (
                              <p>PRODUCTION: <span className="text-cyan-400 font-bold">+{prodRate.toFixed(1)} {building.type === 'ICE_EXTRACTOR' ? 'WATER' : 'MINERALS'}/h</span></p>
                            );
                          })()}
                        </>
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
      </div>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
