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
      const realDeltaSeconds = delta * timeScale;
      const inGameHoursElapsed = realDeltaSeconds / 3600; // delta is in seconds
      
      const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
      
      // Build Directed Adjacency Lists
      const outGraph = new Map<number, number[]>();
      const inGraph = new Map<number, number[]>();
      
      store.buildings.forEach(b => {
        if (b.status === 'OPERATIONAL') {
          outGraph.set(b.faceIndex, []);
          inGraph.set(b.faceIndex, []);
        }
      });

      store.connections.forEach(conn => {
        const a = conn.fromFaceIndex;
        const b = conn.toFaceIndex;
        const flow = conn.flowType || 'BOTH';

        const canAtoB = flow === 'BOTH' || flow === 'A_TO_B';
        const canBtoA = flow === 'BOTH' || flow === 'B_TO_A';

        if (canAtoB && outGraph.has(a) && outGraph.has(b)) {
          outGraph.get(a)!.push(b);
          inGraph.get(b)!.push(a);
        }
        if (canBtoA && outGraph.has(b) && outGraph.has(a)) {
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
              const energyPerSink = energy / sinks.length;
              sinks.forEach(sink => {
                const newEnergy = Math.min(sink.energyMax, sink.energyStored + energyPerSink);
                if (newEnergy !== sink.energyStored) {
                  store.updateBuilding(sink.id, { energyStored: newEnergy });
                }
              });
            }
          }
        }
      });

      // 2. Cores balance energy with BOTH-connected Batteries/Cores
      // To prevent complex cycles, we just run a simple average with immediate neighbors connected by BOTH edges.
      // A more complete simulation would find strongly connected components, but this is a good approximation per tick.
      const cores = store.buildings.filter(b => b.type === 'CORE' && b.status === 'OPERATIONAL');
      cores.forEach(core => {
        // Find neighbors connected by BOTH edges
        const neighbors = (outGraph.get(core.faceIndex) || []).filter(n => (inGraph.get(core.faceIndex) || []).includes(n));
        const balancers = store.buildings.filter(b => neighbors.includes(b.faceIndex) && (b.type === 'BATTERY' || b.type === 'CORE'));
        if (balancers.length > 0) {
          const group = [core, ...balancers];
          const totalEnergy = group.reduce((sum, b) => sum + b.energyStored, 0);
          const totalMax = group.reduce((sum, b) => sum + b.energyMax, 0);
          const ratio = totalEnergy / totalMax;
          group.forEach(b => {
            const newEnergy = b.energyMax * ratio;
            if (Math.abs(newEnergy - b.energyStored) > 0.1) {
               store.updateBuilding(b.id, { energyStored: newEnergy });
            }
          });
        }
      });

      // 3. Extractors consume energy and produce resources
      const ENERGY_PER_HOUR = 50;
      
      const processExtractor = (ext: Building, resourceType: 'water' | 'minerals') => {
        const energyNeeded = ENERGY_PER_HOUR * inGameHoursElapsed;
        const sources = findReachable(ext.faceIndex, inGraph, ['BATTERY', 'CORE']);
        const totalAvailable = sources.reduce((sum, b) => sum + b.energyStored, 0);
        
        if (totalAvailable >= energyNeeded) {
          if (!ext.isPowered) store.updateBuilding(ext.id, { isPowered: true });
          // Consume energy proportionally
          sources.forEach(src => {
             const fraction = src.energyStored / totalAvailable;
             store.updateBuilding(src.id, { energyStored: Math.max(0, src.energyStored - (energyNeeded * fraction)) });
          });

          // Produce
          const center = getFaceCenter(ext.faceIndex);
          if (center) {
            const { lat, lon } = vector3ToCoord(center);
            const resources = getSectorResources(lat, lon);
            const generated = 10 * (resourceType === 'water' ? resources.waterMultiplier : resources.mineralsMultiplier) * inGameHoursElapsed;
            
            // Distribute
            const sinks = findReachable(ext.faceIndex, outGraph, ['WAREHOUSE', 'CORE']);
            if (sinks.length > 0) {
               const perSink = generated / sinks.length;
               sinks.forEach(sink => {
                 if (resourceType === 'water') {
                   store.updateBuilding(sink.id, { waterStored: Math.min(sink.waterMax, sink.waterStored + perSink) });
                 } else {
                   store.updateBuilding(sink.id, { mineralsStored: Math.min(sink.mineralsMax, sink.mineralsStored + perSink) });
                 }
               });
            }
          }
        } else {
          if (ext.isPowered !== false) store.updateBuilding(ext.id, { isPowered: false });
        }
      };

      const iceExtractors = store.buildings.filter(b => b.type === 'ICE_EXTRACTOR' && b.status === 'OPERATIONAL');
      iceExtractors.forEach(ext => processExtractor(ext, 'water'));

      const mineralExtractors = store.buildings.filter(b => b.type === 'MINERAL_EXTRACTOR' && b.status === 'OPERATIONAL');
      mineralExtractors.forEach(ext => processExtractor(ext, 'minerals'));
    }
  });

  return null;
}
