import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';

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
            } else if (team.buildJob.type === 'CONNECTION') {
              store.addConnection({
                id: `conn-${Date.now()}-${Math.random()}`,
                fromFaceIndex: team.buildJob.targetFaceIndex,
                toFaceIndex: team.buildJob.secondaryFaceIndex!
              });
            } else {
              const existing = store.buildings.find(b => b.faceIndex === team.faceIndex);
              if (!existing) {
                store.addBuilding({
                  id: `bldg-${Date.now()}-${Math.random()}`,
                  type: team.buildJob.type as any,
                  faceIndex: team.faceIndex!,
                  status: 'OPERATIONAL',
                  completionTime: gameTime,
                  energyStored: 0,
                  energyMax: team.buildJob.type === 'BATTERY' ? 100 : 0
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
      
      // Build Adjacency List for power grid
      const gridGraph = new Map<number, number[]>();
      store.connections.forEach(conn => {
        if (!gridGraph.has(conn.fromFaceIndex)) gridGraph.set(conn.fromFaceIndex, []);
        if (!gridGraph.has(conn.toFaceIndex)) gridGraph.set(conn.toFaceIndex, []);
        gridGraph.get(conn.fromFaceIndex)!.push(conn.toFaceIndex);
        gridGraph.get(conn.toFaceIndex)!.push(conn.fromFaceIndex);
      });

      const visited = new Set<number>();
      const components: number[][] = [];
      
      // Find all connected components
      const allFacesWithBuildings = new Set(store.buildings.map(b => b.faceIndex));
      allFacesWithBuildings.forEach(startFace => {
        if (!visited.has(startFace)) {
          const comp: number[] = [];
          const queue = [startFace];
          visited.add(startFace);
          
          while (queue.length > 0) {
            const curr = queue.shift()!;
            comp.push(curr);
            const neighbors = gridGraph.get(curr) || [];
            for (const n of neighbors) {
              if (!visited.has(n)) {
                visited.add(n);
                queue.push(n);
              }
            }
          }
          components.push(comp);
        }
      });

      // Distribute power per component
      components.forEach(comp => {
        let componentEnergyProduced = 0;
        const compSet = new Set(comp);
        
        const panelsInComp = store.buildings.filter(b => b.type === 'SOLAR_PANEL' && b.status === 'OPERATIONAL' && compSet.has(b.faceIndex));
        const batteriesInComp = store.buildings.filter(b => b.type === 'BATTERY' && b.status === 'OPERATIONAL' && compSet.has(b.faceIndex));
        
        panelsInComp.forEach(panel => {
          const center = getFaceCenter(panel.faceIndex);
          if (center) {
            const normal = center.clone().normalize();
            const dot = normal.dot(sunPos);
            if (dot > 0) {
              // 100 energy per in-game hour at direct sunlight
              componentEnergyProduced += dot * 100 * inGameHoursElapsed;
            }
          }
        });
        
        if (componentEnergyProduced > 0 && batteriesInComp.length > 0) {
          // Distribute equally among batteries in this grid
          const energyPerBattery = componentEnergyProduced / batteriesInComp.length;
          batteriesInComp.forEach(battery => {
            const newEnergy = Math.min(battery.energyMax, battery.energyStored + energyPerBattery);
            if (newEnergy !== battery.energyStored) {
              store.updateBuilding(battery.id, { energyStored: newEnergy });
            }
          });
        }
      });
    }
  });

  return null;
}
