'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { LUNAR_CRATERS } from '@/data/craters';
import { LUNAR_MARES } from '@/data/mares';
import { getFaceCenter, SIM_MOON_RADIUS, coordToVector3 } from '@/utils/geo';

export default function SearchUI() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { focusTarget, cameraTarget, teams } = useGameStore();

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Compute search results
  const results = [];
  
  if (query.trim().length > 0) {
    const q = query.toLowerCase();
    
    // 1. Celestial Bodies
    ['Moon', 'Earth', 'Sun'].forEach((body) => {
      if (body.toLowerCase().includes(q)) {
        results.push({
          id: body.toLowerCase(),
          type: 'CELESTIAL',
          name: body.toUpperCase(),
          onSelect: () => focusTarget({ type: 'CELESTIAL', id: body.toLowerCase(), name: body.toUpperCase() })
        });
      }
    });

    // 2. Craters
    LUNAR_CRATERS.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          type: 'CRATER',
          name: c.name,
          onSelect: () => focusTarget({ 
            type: 'ENTITY', 
            id: c.id, 
            pos: coordToVector3(c.lat, c.lon, SIM_MOON_RADIUS * 1.01), 
            name: `CRATER: ${c.name}` 
          })
        });
      }
    });

    // 3. Mares
    LUNAR_MARES.forEach((m) => {
      if (m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) {
        results.push({
          id: m.id,
          type: 'MARE',
          name: m.name,
          onSelect: () => focusTarget({ 
            type: 'ENTITY', 
            id: m.id, 
            pos: coordToVector3(m.lat, m.lon, SIM_MOON_RADIUS * 1.005), 
            name: `MARE: ${m.name}` 
          })
        });
      }
    });

    // 4. Engineers (Teams)
    teams.forEach((t) => {
      if (t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          type: 'ENGINEER',
          name: t.name,
          onSelect: () => {
            // Also trigger selection
            useGameStore.getState().setSelectedTeam(t.id);
            if (t.faceIndex !== null) {
              const pos = getFaceCenter(t.faceIndex, SIM_MOON_RADIUS);
              if (pos) {
                focusTarget({ type: 'ENTITY', id: t.id, pos, name: `ENGINEER: ${t.name}` });
              }
            } else {
              // If not deployed, fly to Earth? Engineers start on Earth?
              focusTarget({ type: 'CELESTIAL', id: 'earth', name: 'EARTH' });
            }
          }
        });
      }
    });

    // 5. Cells
    const cellId = parseInt(q, 10);
    if (!isNaN(cellId) && cellId >= 0 && cellId <= 319) {
      results.push({
        id: `cell-${cellId}`,
        type: 'SECTOR',
        name: `SECTOR ${cellId}`,
        onSelect: () => {
          const pos = getFaceCenter(cellId, SIM_MOON_RADIUS);
          if (pos) {
            focusTarget({ type: 'ENTITY', id: `cell-${cellId}`, pos, name: `SECTOR ${cellId}` });
          }
        }
      });
    }
  }

  // Take top 8 results
  const displayResults = results.slice(0, 8);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (displayResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = displayResults[selectedIndex];
      if (selected) {
        selected.onSelect();
        setQuery('');
        setIsFocused(false);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayResults.length - 1 ? prev + 1 : 0));
    }
  };

  return (
    <div className="absolute top-32 left-8 z-10 w-80 pointer-events-none">
      {/* Search Input */}
      <div className="pointer-events-auto border border-green-500/50 bg-black/60 p-2 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)]">
        <div className="flex items-center gap-2">
          <span className="text-green-500 font-mono text-xs opacity-70">&gt;</span>
          <input
            type="text"
            className="w-full bg-transparent text-green-500 font-mono text-xs focus:outline-none placeholder-green-500/30"
            placeholder="SEARCH ENTITY OR SECTOR"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)} // delay to allow clicks
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Results Dropdown */}
      {isFocused && displayResults.length > 0 && (
        <div className="pointer-events-auto mt-1 border border-green-500/30 bg-black/80 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.1)] max-h-60 overflow-y-auto font-mono text-xs">
          {displayResults.map((res, idx) => (
            <button
              key={res.id}
              onClick={() => {
                res.onSelect();
                setQuery('');
                setIsFocused(false);
              }}
              className={`w-full text-left p-2 border-b border-green-500/10 transition-colors flex justify-between ${
                idx === selectedIndex 
                  ? 'bg-green-500/30 text-green-300' 
                  : 'text-green-500 hover:bg-green-500/20 hover:text-green-400'
              }`}
            >
              <span>{res.name}</span>
              <span className="opacity-50 text-[10px] uppercase">{res.type}</span>
            </button>
          ))}
        </div>
      )}

      {/* Target Indicator */}
      {cameraTarget && (
        <div className="pointer-events-auto mt-4 border border-blue-500/50 bg-blue-900/20 p-2 backdrop-blur-sm text-blue-400 font-mono text-xs flex justify-between items-center shadow-[0_0_15px_rgba(0,100,255,0.2)]">
          <div>
            <div className="opacity-70 text-[10px] uppercase tracking-wider mb-1 animate-pulse">CURRENTLY ORBITING</div>
            <div className="font-bold tracking-wide">{cameraTarget.name}</div>
          </div>
          <button 
            onClick={() => focusTarget(null)}
            className="border border-blue-500/50 px-2 py-1 hover:bg-blue-500/20 transition-colors opacity-80 hover:opacity-100"
          >
            [X]
          </button>
        </div>
      )}
    </div>
  );
}
