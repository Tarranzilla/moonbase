import { create } from 'zustand';

export interface Team {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'DEPLOYED';
  faceIndex: number | null;
  path: number[];
  targetFaceIndex: number | null;
  arrivalTime: number;
}

interface GameState {
  selectedCellId: string | null;
  selectedCoordinates: { lat: number; lon: number } | null;
  setSelectedCell: (id: string | null, coords?: { lat: number; lon: number }) => void;
  
  teams: Team[];
  selectedTeamId: string | null;
  setSelectedTeam: (id: string | null) => void;
  deployTeam: (teamId: string, faceIndex: number) => void;
  moveTeam: (teamId: string, targetFaceIndex: number) => void;
  setTeamPath: (teamId: string, path: number[]) => void;
  updateTeamProgress: (teamId: string, newFaceIndex: number, newPath: number[]) => void;

  timeScale: number;
  setTimeScale: (scale: number) => void;
  gameTime: number;
  setGameTime: (time: number) => void;
  autoRotate: boolean;
  setAutoRotate: (value: boolean) => void;

  filters: {
    showCraters: boolean;
    showEquator: boolean;
    showMares: boolean;
  };
  toggleFilter: (filterName: keyof GameState['filters']) => void;
}

// Start at year 2142, Jan 1st
const START_TIME = new Date("2142-01-01T08:00:00Z").getTime();

export const useGameStore = create<GameState>((set) => ({
  selectedCellId: null,
  selectedCoordinates: null,
  setSelectedCell: (id, coords) => set({ selectedCellId: id, selectedCoordinates: coords || null }),

  timeScale: 1,
  setTimeScale: (scale) => set({ timeScale: scale }),
  
  gameTime: START_TIME,
  setGameTime: (time) => set({ gameTime: time }),

  autoRotate: true,
  setAutoRotate: (value) => set({ autoRotate: value }),

  filters: {
    showCraters: true,
    showEquator: true,
    showMares: true,
  },
  toggleFilter: (filterName) => set((state) => ({
    filters: {
      ...state.filters,
      [filterName]: !state.filters[filterName]
    }
  })),

  teams: [
    { id: 'eng-1', name: 'ENGINEERING ALPHA', status: 'AVAILABLE', faceIndex: null, path: [], targetFaceIndex: null, arrivalTime: 0 },
    { id: 'eng-2', name: 'ENGINEERING BETA', status: 'AVAILABLE', faceIndex: null, path: [], targetFaceIndex: null, arrivalTime: 0 },
    { id: 'eng-3', name: 'ENGINEERING GAMMA', status: 'AVAILABLE', faceIndex: null, path: [], targetFaceIndex: null, arrivalTime: 0 },
  ],
  selectedTeamId: null,
  setSelectedTeam: (id) => set({ selectedTeamId: id }),
  
  deployTeam: (teamId, faceIndex) => set((state) => ({
    teams: state.teams.map(t => 
      t.id === teamId 
        ? { ...t, status: 'DEPLOYED', faceIndex, path: [], targetFaceIndex: null, arrivalTime: Date.now() } 
        : t
    )
  })),

  moveTeam: (teamId, targetFaceIndex) => set((state) => ({
    teams: state.teams.map(t =>
      t.id === teamId
        ? { ...t, targetFaceIndex, path: [] }
        : t
    )
  })),

  setTeamPath: (teamId, path) => set((state) => ({
    teams: state.teams.map(t =>
      t.id === teamId
        ? { ...t, path }
        : t
    )
  })),

  updateTeamProgress: (teamId, newFaceIndex, newPath) => set((state) => ({
    teams: state.teams.map(t =>
      t.id === teamId
        ? { ...t, faceIndex: newFaceIndex, path: newPath, targetFaceIndex: newPath.length > 0 ? t.targetFaceIndex : null, arrivalTime: Date.now() }
        : t
    )
  })),
}));
