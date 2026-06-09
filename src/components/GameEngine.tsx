import { useFrame } from '@react-three/fiber';
import { useGameStore, Building } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter, vector3ToCoord } from '@/utils/geo';
import { getSectorResources } from '@/utils/geology';

export function GameEngine() {
  useFrame((state, delta) => {
    const store = useGameStore.getState();
    const gameTime = store.gameTime;
    const timeScale = store.timeScale;
    
    // 1 lunar day = 28 in-game days
    const LUNAR_DAY_MS = 28 * 24 * 60 * 60 * 1000;
    // Construction takes 1 in-game day
    const BUILD_TIME_MS = 1 * 24 * 60 * 60 * 1000;
    
    let stateChanged = false;
    
    // Handle Engineer Building states
    store.teams.forEach(team => {
      // Transition from MOVING_TO_BUILD to BUILDING
      // We check if targetFaceIndex is null (meaning updateTeamProgress finished the path)
      // or if faceIndex === targetFaceIndex (meaning they were already there to begin with)
      if (team.status === 'MOVING_TO_BUILD' && team.path.length === 0 && (team.targetFaceIndex === null || team.faceIndex === team.targetFaceIndex)) {
        if (!team.buildJob) return;
        
        useGameStore.setState(s => ({
          teams: s.teams.map(t => t.id === team.id ? {
            ...t,
            status: 'BUILDING',
            arrivalTime: gameTime + BUILD_TIME_MS
          } : t)
        }));
        stateChanged = true;
      } 
      // Transition from MOVING_TO to DEPLOYED
      else if (team.status === 'MOVING_TO' && team.path.length === 0 && (team.targetFaceIndex === null || team.faceIndex === team.targetFaceIndex)) {
        useGameStore.setState(s => ({
          teams: s.teams.map(t => t.id === team.id ? {
            ...t,
            status: 'DEPLOYED',
          } : t)
        }));
        stateChanged = true;
      }
      // Handle Building Completion
      else if (team.status === 'BUILDING') {
        if (gameTime >= team.arrivalTime) {
          if (team.buildJob) {
            if (team.buildJob.type === 'DECONSTRUCT') {
              const building = store.buildings.find(b => b.faceIndex === team.faceIndex);
              if (building) store.removeBuilding(building.id);
            } else if (team.buildJob.type === 'DECONSTRUCT_CONNECTION') {
              const conn = store.connections.find(c => 
                (c.fromFaceIndex === team.buildJob!.targetFaceIndex && c.toFaceIndex === team.buildJob!.secondaryFaceIndex) ||
                (c.fromFaceIndex === team.buildJob!.secondaryFaceIndex && c.toFaceIndex === team.buildJob!.targetFaceIndex)
              );
              if (conn) store.removeConnection(conn.id);
            } else if (team.buildJob.type === 'CONNECTION') {
              store.addConnection({
                id: `conn-${Date.now()}-${Math.random()}`,
                fromFaceIndex: team.buildJob.targetFaceIndex,
                toFaceIndex: team.buildJob.secondaryFaceIndex!
              });
            } else {
              const existing = store.buildings.find(b => b.faceIndex === team.faceIndex);
              if (!existing) {
                let energyMax = 0;
                let waterMax = 0;
                let mineralsMax = 0;
                
                if (team.buildJob.type === 'BATTERY') energyMax = 100;
                if (team.buildJob.type === 'CORE') {
                  energyMax = 50;
                  waterMax = 100;
                  mineralsMax = 100;
                }
                if (team.buildJob.type === 'WAREHOUSE') {
                  waterMax = 1000;
                  mineralsMax = 1000;
                }

                store.addBuilding({
                  id: `bldg-${Date.now()}-${Math.random()}`,
                  type: team.buildJob.type as any,
                  faceIndex: team.faceIndex!,
                  status: 'OPERATIONAL',
                  completionTime: gameTime,
                  energyStored: 0,
                  energyMax,
                  waterStored: 0,
                  waterMax,
                  mineralsStored: 0,
                  mineralsMax
                });
              }
            }
          }
          store.completeBuildJob(team.id, '');
          stateChanged = true;
        }
      }
    });

    // Handle Power Grid Update
    if (timeScale > 0) {
      // Clock.tsx uses BASE_MULTIPLIER = 60, meaning 1 real second = 60 in-game seconds at 1x speed
      const GAME_SECONDS_PER_REAL_SECOND = 60;
      const inGameSeconds = delta * timeScale * GAME_SECONDS_PER_REAL_SECOND;
      const inGameHoursElapsed = inGameSeconds / 3600;
      
      const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
      
      const initialEnergy = new Map<string, number>();
      store.buildings.forEach(b => {
        if (b.type === 'BATTERY' || b.type === 'CORE') {
          initialEnergy.set(b.id, b.energyStored);
        }
      });

      // Build Directed Adjacency Lists
      const outGraph = new Map<number, number[]>();
      const inGraph = new Map<number, number[]>();
      
      store.buildings.forEach(b => {
        if (b.status === 'OPERATIONAL') {
          outGraph.set(b.faceIndex, []);
          inGraph.set(b.faceIndex, []);
        }
      });

      // Also add any cell that is part of a connection (acts as a relay if empty)
      store.connections.forEach(conn => {
        if (!outGraph.has(conn.fromFaceIndex)) {
          outGraph.set(conn.fromFaceIndex, []);
          inGraph.set(conn.fromFaceIndex, []);
        }
        if (!outGraph.has(conn.toFaceIndex)) {
          outGraph.set(conn.toFaceIndex, []);
          inGraph.set(conn.toFaceIndex, []);
        }
      });

      store.connections.forEach(conn => {
        const a = conn.fromFaceIndex;
        const b = conn.toFaceIndex;
        const flow = conn.flowType || 'BOTH';

        const canAtoB = flow === 'BOTH' || flow === 'A_TO_B';
        const canBtoA = flow === 'BOTH' || flow === 'B_TO_A';

        if (canAtoB) {
          outGraph.get(a)!.push(b);
          inGraph.get(b)!.push(a);
        }
        if (canBtoA) {
          outGraph.get(b)!.push(a);
          inGraph.get(a)!.push(b);
        }
      });

      const findReachable = (startFace: number, graph: Map<number, number[]>, targetTypes: string[]) => {
        const visited = new Set<number>();
        const queue = [startFace];
        visited.add(startFace);
        const reachableBuildings: Building[] = [];

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const b = store.buildings.find(b => b.faceIndex === curr);
          if (b && targetTypes.includes(b.type)) {
            reachableBuildings.push(b);
          }
          const neighbors = graph.get(curr) || [];
          for (const n of neighbors) {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
        return reachableBuildings;
      };

      // 1. Solar Panels generate energy and send to reachable Batteries/Cores
      const panels = store.buildings.filter(b => b.type === 'SOLAR_PANEL' && b.status === 'OPERATIONAL');
      panels.forEach(panel => {
        const center = getFaceCenter(panel.faceIndex);
        if (center) {
          const dot = center.clone().normalize().dot(sunPos);
          if (dot > 0) {
            const energy = dot * 100 * inGameHoursElapsed;
            const sinks = findReachable(panel.faceIndex, outGraph, ['BATTERY', 'CORE']);
            if (sinks.length > 0) {
              const liveSinks = sinks.map(s => useGameStore.getState().buildings.find(b => b.id === s.id)!);
              const totalSpace = liveSinks.reduce((sum, s) => sum + Math.max(0, s.energyMax - s.energyStored), 0);
              if (totalSpace > 0) {
                const energyToDistribute = Math.min(energy, totalSpace);
                liveSinks.forEach(sink => {
                  const space = Math.max(0, sink.energyMax - sink.energyStored);
                  const fraction = space / totalSpace;
                  const newEnergy = sink.energyStored + (energyToDistribute * fraction);
                  if (newEnergy !== sink.energyStored) {
                    store.updateBuilding(sink.id, { energyStored: newEnergy });
                  }
                });
              }
            }
          }
        }
      });

      // 2. Cores consume 1 E/h
      const CORE_CONSUMPTION = 1;
      const cores = store.buildings.filter(b => b.type === 'CORE' && b.status === 'OPERATIONAL');
      cores.forEach(core => {
        const currentCore = useGameStore.getState().buildings.find(b => b.id === core.id)!;
        const newEnergy = Math.max(0, currentCore.energyStored - (CORE_CONSUMPTION * inGameHoursElapsed));
        if (newEnergy !== currentCore.energyStored) {
          store.updateBuilding(core.id, { energyStored: newEnergy });
        }
      });

      // 3. Extractors consume energy and produce resources
      const ENERGY_PER_HOUR = 50;
      
      const processExtractor = (ext: Building, resourceType: 'water' | 'minerals') => {
        const currentExt = useGameStore.getState().buildings.find(b => b.id === ext.id)!;
        
        // Check if sinks can accept resources
        const sinks = findReachable(ext.faceIndex, outGraph, ['WAREHOUSE', 'CORE']);
        const liveSinks = sinks.map(s => useGameStore.getState().buildings.find(b => b.id === s.id)!);
        
        let totalSpace = 0;
        liveSinks.forEach(sink => {
          if (resourceType === 'water') {
            totalSpace += Math.max(0, sink.waterMax - sink.waterStored);
          } else {
            totalSpace += Math.max(0, sink.mineralsMax - sink.mineralsStored);
          }
        });

        if (totalSpace <= 0) {
           if (currentExt.isPowered !== false) store.updateBuilding(ext.id, { isPowered: false });
           return; // Stop consuming energy if storage is full
        }

        const energyNeeded = ENERGY_PER_HOUR * inGameHoursElapsed;
        const sources = findReachable(ext.faceIndex, inGraph, ['BATTERY', 'CORE']);
        const liveSources = sources.map(s => useGameStore.getState().buildings.find(b => b.id === s.id)!);
        const totalAvailable = liveSources.reduce((sum, b) => sum + b.energyStored, 0);
        
        if (totalAvailable >= energyNeeded) {
          if (!currentExt.isPowered) store.updateBuilding(ext.id, { isPowered: true });
          // Consume energy proportionally
          liveSources.forEach(src => {
             const fraction = src.energyStored / totalAvailable;
             store.updateBuilding(src.id, { energyStored: Math.max(0, src.energyStored - (energyNeeded * fraction)) });
          });

          // Produce
          const center = getFaceCenter(ext.faceIndex);
          if (center) {
            const { lat, lon } = vector3ToCoord(center);
            const resources = getSectorResources(lat, lon);
            const maxGenerated = 10 * (resourceType === 'water' ? resources.waterMultiplier : resources.mineralsMultiplier) * inGameHoursElapsed;
            const generated = Math.min(maxGenerated, totalSpace); // Don't produce more than space allows
            
            // Distribute based on available space
            if (liveSinks.length > 0) {
               liveSinks.forEach(sink => {
                 if (resourceType === 'water') {
                   const space = Math.max(0, sink.waterMax - sink.waterStored);
                   const fraction = space / totalSpace;
                   const amount = generated * fraction;
                   store.updateBuilding(sink.id, { waterStored: sink.waterStored + amount });
                 } else {
                   const space = Math.max(0, sink.mineralsMax - sink.mineralsStored);
                   const fraction = space / totalSpace;
                   const amount = generated * fraction;
                   store.updateBuilding(sink.id, { mineralsStored: sink.mineralsStored + amount });
                 }
               });
            }
          }
        } else {
          if (currentExt.isPowered !== false) store.updateBuilding(ext.id, { isPowered: false });
        }
      };

      const iceExtractors = store.buildings.filter(b => b.type === 'ICE_EXTRACTOR' && b.status === 'OPERATIONAL');
      iceExtractors.forEach(ext => processExtractor(ext, 'water'));

      const mineralExtractors = store.buildings.filter(b => b.type === 'MINERAL_EXTRACTOR' && b.status === 'OPERATIONAL');
      mineralExtractors.forEach(ext => processExtractor(ext, 'minerals'));

      // Pre-compute bidirectional edges for balancing
      const bothGraph = new Map<number, number[]>();
      outGraph.forEach((targets, src) => {
        bothGraph.set(src, targets.filter(t => (inGraph.get(src) || []).includes(t)));
      });

      // Find connected components of bothGraph
      const visitedBoth = new Set<number>();
      const components: number[][] = [];
      bothGraph.forEach((targets, startNode) => {
        if (!visitedBoth.has(startNode)) {
          const comp: number[] = [];
          const q = [startNode];
          visitedBoth.add(startNode);
          while (q.length > 0) {
            const curr = q.shift()!;
            comp.push(curr);
            const neighbors = bothGraph.get(curr) || [];
            for (const n of neighbors) {
              if (!visitedBoth.has(n)) {
                visitedBoth.add(n);
                q.push(n);
              }
            }
          }
          components.push(comp);
        }
      });

      // 4. Network Balancing (BOTH edges)
      components.forEach(comp => {
        const storage = store.buildings.filter(b => comp.includes(b.faceIndex) && (b.type === 'BATTERY' || b.type === 'CORE') && b.status === 'OPERATIONAL');
        if (storage.length > 1) {
          const liveStorage = storage.map(s => useGameStore.getState().buildings.find(b => b.id === s.id)!);
          const coresInGroup = liveStorage.filter(b => b.type === 'CORE');
          const batteriesInGroup = liveStorage.filter(b => b.type === 'BATTERY');
          
          let totalEnergy = liveStorage.reduce((sum, b) => sum + b.energyStored, 0);
          const coresMax = coresInGroup.reduce((sum, b) => sum + b.energyMax, 0);
          const batteriesMax = batteriesInGroup.reduce((sum, b) => sum + b.energyMax, 0);

          if (totalEnergy <= coresMax) {
            // Cores take everything
            const ratio = totalEnergy > 0 ? totalEnergy / coresMax : 0;
            coresInGroup.forEach(c => {
              store.updateBuilding(c.id, { energyStored: c.energyMax * ratio });
            });
            batteriesInGroup.forEach(b => {
              store.updateBuilding(b.id, { energyStored: 0 });
            });
          } else {
            // Cores are full
            coresInGroup.forEach(c => {
              store.updateBuilding(c.id, { energyStored: c.energyMax });
            });
            // Batteries share the rest
            const remaining = totalEnergy - coresMax;
            const actualRemaining = Math.min(remaining, batteriesMax);
            const ratio = batteriesMax > 0 ? actualRemaining / batteriesMax : 0;
            batteriesInGroup.forEach(b => {
              store.updateBuilding(b.id, { energyStored: b.energyMax * ratio });
            });
          }
        }
      });

      // Build a map of faceIndex to component index to prevent Directed Flow from fighting the Balancer
      const faceToComp = new Map<number, number>();
      components.forEach((comp, i) => {
        comp.forEach(face => faceToComp.set(face, i));
      });

      // 5. Directed Storage Flow
      const storageNodes = store.buildings.filter(b => (b.type === 'BATTERY' || b.type === 'CORE') && b.status === 'OPERATIONAL');
      // Sort by energy percentage descending, so most full nodes push first
      storageNodes.sort((a, b) => (b.energyStored / b.energyMax) - (a.energyStored / a.energyMax));
      
      storageNodes.forEach(source => {
        const currentSource = useGameStore.getState().buildings.find(b => b.id === source.id);
        if (!currentSource) return;
        const sourcePct = currentSource.energyStored / currentSource.energyMax;
        if (sourcePct <= 0) return;

        const sourceComp = faceToComp.get(source.faceIndex);
        const reachableSinks = findReachable(source.faceIndex, outGraph, ['BATTERY', 'CORE']).filter(s => {
          if (s.id === source.id) return false;
          // Do NOT push to sinks in the same BOTH-connected component, they are already balanced!
          if (sourceComp !== undefined && faceToComp.get(s.faceIndex) === sourceComp) return false;
          return true;
        });

        const validSinks = reachableSinks.map(s => useGameStore.getState().buildings.find(b => b.id === s.id)!)
          .filter(s => s && (s.energyStored / s.energyMax) < sourcePct);
        
        if (validSinks.length > 0) {
          // Equalize: move up to 500 E/h to balance with downstream sinks
          const transferRate = 500 * inGameHoursElapsed;
          let availableToTransfer = Math.min(currentSource.energyStored, transferRate);
          let distributed = 0;
          validSinks.forEach(sink => {
            const needed = (sourcePct * sink.energyMax) - sink.energyStored;
            const give = Math.min(availableToTransfer / validSinks.length, needed);
            if (give > 0) {
              useGameStore.getState().updateBuilding(sink.id, { energyStored: sink.energyStored + give });
              distributed += give;
            }
          });
          if (distributed > 0) {
            useGameStore.getState().updateBuilding(source.id, { energyStored: currentSource.energyStored - distributed });
          }
        }
      });

      // Calculate Energy Deltas for Batteries/Cores
      const postStore = useGameStore.getState();
      postStore.buildings.forEach(b => {
        if (b.type === 'BATTERY' || b.type === 'CORE') {
          const oldE = initialEnergy.get(b.id) || 0;
          const delta = (b.energyStored - oldE) / inGameHoursElapsed;
          
          // Only update if changed significantly to avoid excessive React renders
          // We'll round it to avoid floating point jitter
          const roundedDelta = Math.round(delta * 10) / 10;
          const currentRounded = Math.round((b.energyDelta || 0) * 10) / 10;
          
          if (roundedDelta !== currentRounded) {
            postStore.updateBuilding(b.id, { energyDelta: roundedDelta });
          }
        }
      });
    }
  });

  return null;
}
