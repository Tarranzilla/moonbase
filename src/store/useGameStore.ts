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
}

export const useGameStore = create<GameState>((set) => ({
  selectedCellId: null,
  selectedCoordinates: null,
  setSelectedCell: (id, coords) => set({ selectedCellId: id, selectedCoordinates: coords || null }),

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
