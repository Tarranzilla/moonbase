import { create } from 'zustand';

export type BuildingType = 'CORE' | 'SOLAR_PANEL' | 'BATTERY' | 'JUNCTION' | 'ICE_EXTRACTOR' | 'MINERAL_EXTRACTOR' | 'WAREHOUSE';

export interface Building {
  id: string;
  type: BuildingType;
  faceIndex: number;
  status: 'UNDER_CONSTRUCTION' | 'OPERATIONAL';
  completionTime: number | null; // null if operational or not yet started
  energyStored: number;
  energyMax: number;
  waterStored: number;
  waterMax: number;
  mineralsStored: number;
  mineralsMax: number;
  isPowered?: boolean;
  energyDelta?: number; // Tracks net energy change per in-game hour
}

export type FlowType = 'BOTH' | 'A_TO_B' | 'B_TO_A' | 'NONE';

export interface Connection {
  id: string;
  fromFaceIndex: number;
  toFaceIndex: number;
  flowType?: FlowType; // Default is assumed to be BOTH if undefined
}

export interface Team {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'DEPLOYED' | 'MOVING_TO' | 'MOVING_TO_BUILD' | 'BUILDING';
  faceIndex: number | null;
  path: number[];
  targetFaceIndex: number | null;
  arrivalTime: number;
  
  // What this team is assigned to build when they arrive
  buildJob?: {
    type: BuildMode;
    targetFaceIndex: number;
    secondaryFaceIndex?: number;
  } | null;
  
  // Queue for multiple sequential jobs (e.g. path connections)
  jobQueue?: Array<{
    type: BuildMode;
    targetFaceIndex: number;
    secondaryFaceIndex?: number;
  }>;
}

export type BuildMode = 'NONE' | BuildingType | 'CONNECTION' | 'DECONSTRUCT' | 'DECONSTRUCT_CONNECTION';

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
  
  buildings: Building[];
  connections: Connection[];
  buildMode: BuildMode;
  connectionStartFace: number | null;
  setBuildMode: (mode: BuildMode) => void;
  setConnectionStartFace: (faceIndex: number | null) => void;
  queueBuildJob: (teamId: string, job: Team['buildJob']) => void;
  completeBuildJob: (teamId: string, buildingId: string) => void;
  
  addBuilding: (building: Building) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  batchUpdateBuildings: (updates: Record<string, Partial<Building>>) => void;
  removeBuilding: (id: string) => void;
  addConnection: (connection: Connection) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  topologyVersion: number;

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

  cameraTarget: { 
    type: 'ENTITY' | 'CELESTIAL';
    id: string; // 'sun', 'earth', 'moon', or entity ID
    pos?: { x: number; y: number; z: number }; 
    name: string;
  } | null;
  focusTarget: (target: GameState['cameraTarget']) => void;
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

  cameraTarget: null,
  focusTarget: (target) => {
    set({ 
      cameraTarget: target,
      autoRotate: target ? false : useGameStore.getState().autoRotate
    });
  },

  buildings: [],
  connections: [],
  buildMode: 'NONE',
  connectionStartFace: null,
  setBuildMode: (mode) => set({ buildMode: mode, connectionStartFace: null }),
  setConnectionStartFace: (faceIndex) => set({ connectionStartFace: faceIndex }),

  queueBuildJob: (teamId, job) => set((state) => {
    return {
      teams: state.teams.map(t => {
        if (t.id === teamId) {
          if (t.buildJob) {
            // Already has a job, append to queue
            return {
              ...t,
              jobQueue: [...(t.jobQueue || []), job!]
            };
          } else {
            // No active job, start immediately
            return {
              ...t,
              status: 'MOVING_TO_BUILD',
              targetFaceIndex: job?.targetFaceIndex ?? t.targetFaceIndex,
              buildJob: job,
              jobQueue: []
            };
          }
        }
        return t;
      })
    };
  }),

  completeBuildJob: (teamId, buildingId) => set((state) => {
    return {
      teams: state.teams.map(t => {
        if (t.id === teamId) {
          const nextJob = t.jobQueue && t.jobQueue.length > 0 ? t.jobQueue[0] : null;
          const remainingQueue = t.jobQueue && t.jobQueue.length > 0 ? t.jobQueue.slice(1) : [];
          
          if (nextJob) {
            return {
              ...t,
              status: 'MOVING_TO_BUILD',
              targetFaceIndex: nextJob.targetFaceIndex,
              buildJob: nextJob,
              jobQueue: remainingQueue
            };
          } else {
            return { ...t, status: 'DEPLOYED', buildJob: null, jobQueue: [] };
          }
        }
        return t;
      })
    };
  }),

  topologyVersion: 0,
  addBuilding: (building) => set((state) => ({ 
    buildings: [...state.buildings, building],
    topologyVersion: state.topologyVersion + 1
  })),
  updateBuilding: (id, updates) => set((state) => ({
    buildings: state.buildings.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
  batchUpdateBuildings: (updates) => set((state) => {
    let changed = false;
    const newBuildings = state.buildings.map(b => {
      if (updates[b.id]) {
        changed = true;
        return { ...b, ...updates[b.id] };
      }
      return b;
    });
    return changed ? { buildings: newBuildings } : state;
  }),
  removeBuilding: (id) => set((state) => ({
    buildings: state.buildings.filter(b => b.id !== id),
    connections: state.connections.filter(c => c.id !== id && c.fromFaceIndex !== state.buildings.find(b=>b.id===id)?.faceIndex && c.toFaceIndex !== state.buildings.find(b=>b.id===id)?.faceIndex),
    topologyVersion: state.topologyVersion + 1
  })),
  addConnection: (connection) => set((state) => ({ 
    connections: [...state.connections, connection],
    topologyVersion: state.topologyVersion + 1
  })),
  updateConnection: (id, updates) => set((state) => ({
    connections: state.connections.map(c => c.id === id ? { ...c, ...updates } : c),
    topologyVersion: state.topologyVersion + 1
  })),
  removeConnection: (id) => set((state) => ({ 
    connections: state.connections.filter(c => c.id !== id),
    topologyVersion: state.topologyVersion + 1
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
        ? { ...t, targetFaceIndex, path: [], status: 'MOVING_TO' }
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
