import { create } from 'zustand';

interface GameState {
  selectedCellId: string | null;
  selectedCoordinates: { lat: number; lon: number } | null;
  setSelectedCell: (id: string | null, coords?: { lat: number; lon: number }) => void;
}

export const useGameStore = create<GameState>((set) => ({
  selectedCellId: null,
  selectedCoordinates: null,
  setSelectedCell: (id, coords) => set({ selectedCellId: id, selectedCoordinates: coords || null }),
}));
