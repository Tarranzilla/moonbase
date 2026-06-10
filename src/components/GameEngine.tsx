import { useFrame } from '@react-three/fiber';
import { useGameStore, Building } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter, vector3ToCoord } from '@/utils/geo';
import { getSectorResources } from '@/utils/geology';
import { useRef } from 'react';

export function GameEngine() {
  const lastTopologyVersion = useRef<number>(-1);
  const outGraphRef = useRef<Map<number, number[]>>(new Map());
  const inGraphRef = useRef<Map<number, number[]>>(new Map());
  const bothGraphRef = useRef<Map<number, number[]>>(new Map());
  const componentsRef = useRef<number[][]>([]);
  const faceToCompRef = useRef<Map<number, number>>(new Map());

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
      if (team.status === 'MOVING_TO_BUILD' && team.path.length === 0 && (team.targetFaceIndex === null || team.faceIndex === team.targetFaceIndex)) {
        if (!team.buildJob) return;
        useGameStore.setState(s => ({
          teams: s.teams.map(t => t.id === team.id ? { ...t, status: 'BUILDING', arrivalTime: gameTime + BUILD_TIME_MS } : t)
        }));
        stateChanged = true;
      } 
      else if (team.status === 'MOVING_TO' && team.path.length === 0 && (team.targetFaceIndex === null || team.faceIndex === team.targetFaceIndex)) {
        useGameStore.setState(s => ({
          teams: s.teams.map(t => t.id === team.id ? { ...t, status: 'DEPLOYED' } : t)
        }));
        stateChanged = true;
      }
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
                let energyMax = 0, waterMax = 0, mineralsMax = 0;
                if (team.buildJob.type === 'BATTERY') energyMax = 100;
                if (team.buildJob.type === 'CORE') { energyMax = 50; waterMax = 100; mineralsMax = 100; }
                if (team.buildJob.type === 'WAREHOUSE') { waterMax = 1000; mineralsMax = 1000; }

                store.addBuilding({
                  id: `bldg-${Date.now()}-${Math.random()}`,
                  type: team.buildJob.type as any,
                  faceIndex: team.faceIndex!,
                  status: 'OPERATIONAL',
                  completionTime: gameTime,
                  energyStored: 0, energyMax,
                  waterStored: 0, waterMax,
                  mineralsStored: 0, mineralsMax
                });
              }
            }
          }
          store.completeBuildJob(team.id, '');
          stateChanged = true;
        }
      }
    });

    if (timeScale > 0) {
      const GAME_SECONDS_PER_REAL_SECOND = 60;
      const inGameSeconds = delta * timeScale * GAME_SECONDS_PER_REAL_SECOND;
      const inGameHoursElapsed = inGameSeconds / 3600;
      
      const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
      
      const initialEnergy = new Map<string, number>();
      store.buildings.forEach(b => {
        if (b.type === 'BATTERY' || b.type === 'CORE') initialEnergy.set(b.id, b.energyStored);
      });

      if (store.topologyVersion !== lastTopologyVersion.current) {
        lastTopologyVersion.current = store.topologyVersion;
        const outGraph = new Map<number, number[]>();
        const inGraph = new Map<number, number[]>();
        store.buildings.forEach(b => {
          if (b.status === 'OPERATIONAL') {
            outGraph.set(b.faceIndex, []);
            inGraph.set(b.faceIndex, []);
          }
        });
        store.connections.forEach(conn => {
          if (!outGraph.has(conn.fromFaceIndex)) { outGraph.set(conn.fromFaceIndex, []); inGraph.set(conn.fromFaceIndex, []); }
          if (!outGraph.has(conn.toFaceIndex)) { outGraph.set(conn.toFaceIndex, []); inGraph.set(conn.toFaceIndex, []); }
        });
        store.connections.forEach(conn => {
          const a = conn.fromFaceIndex, b = conn.toFaceIndex, flow = conn.flowType || 'BOTH';
          if (flow === 'BOTH' || flow === 'A_TO_B') { outGraph.get(a)!.push(b); inGraph.get(b)!.push(a); }
          if (flow === 'BOTH' || flow === 'B_TO_A') { outGraph.get(b)!.push(a); inGraph.get(a)!.push(b); }
        });

        const bothGraph = new Map<number, number[]>();
        outGraph.forEach((targets, src) => bothGraph.set(src, targets.filter(t => (inGraph.get(src) || []).includes(t))));

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
              for (const n of bothGraph.get(curr) || []) {
                if (!visitedBoth.has(n)) { visitedBoth.add(n); q.push(n); }
              }
            }
            components.push(comp);
          }
        });

        const faceToComp = new Map<number, number>();
        components.forEach((comp, i) => comp.forEach(face => faceToComp.set(face, i)));

        outGraphRef.current = outGraph;
        inGraphRef.current = inGraph;
        bothGraphRef.current = bothGraph;
        componentsRef.current = components;
        faceToCompRef.current = faceToComp;
      }

      const outGraph = outGraphRef.current;
      const inGraph = inGraphRef.current;
      const bothGraph = bothGraphRef.current;
      const components = componentsRef.current;
      const faceToComp = faceToCompRef.current;

      const findReachable = (startFace: number, graph: Map<number, number[]>, targetTypes: string[]) => {
        const visited = new Set<number>();
        const queue = [startFace];
        visited.add(startFace);
        const reachableBuildings: Building[] = [];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          const b = store.buildings.find(b => b.faceIndex === curr);
          if (b && targetTypes.includes(b.type)) reachableBuildings.push(b);
          for (const n of graph.get(curr) || []) {
            if (!visited.has(n)) { visited.add(n); queue.push(n); }
          }
        }
        return reachableBuildings;
      };

      const pendingUpdates: Record<string, Partial<Building>> = {};
      const getB = (id: string) => ({ ...(store.buildings.find(b => b.id === id) || {} as Building), ...(pendingUpdates[id] || {}) });
      const updateB = (id: string, updates: Partial<Building>) => {
        pendingUpdates[id] = { ...(pendingUpdates[id] || {}), ...updates };
      };

      // 1. Solar Panels
      const panels = store.buildings.filter(b => b.type === 'SOLAR_PANEL' && b.status === 'OPERATIONAL' && b.isOn !== false);
      panels.forEach(panel => {
        const center = getFaceCenter(panel.faceIndex);
        if (center) {
          const dot = center.clone().normalize().dot(sunPos);
          if (dot > 0) {
            const energy = dot * 100 * inGameHoursElapsed;
            const sinks = findReachable(panel.faceIndex, outGraph, ['BATTERY', 'CORE']);
            if (sinks.length > 0) {
              const liveSinks = sinks.map(s => getB(s.id));
              const totalSpace = liveSinks.reduce((sum, s) => sum + Math.max(0, s.energyMax - s.energyStored), 0);
              if (totalSpace > 0) {
                const energyToDistribute = Math.min(energy, totalSpace);
                liveSinks.forEach(sink => {
                  const space = Math.max(0, sink.energyMax - sink.energyStored);
                  const newEnergy = sink.energyStored + (energyToDistribute * (space / totalSpace));
                  if (newEnergy !== sink.energyStored) updateB(sink.id, { energyStored: newEnergy });
                });
              }
            }
          }
        }
      });

      // 2. Cores consume 1 E/h
      store.buildings.filter(b => b.type === 'CORE' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(core => {
        const currentCore = getB(core.id);
        const newEnergy = Math.max(0, currentCore.energyStored - (1 * inGameHoursElapsed));
        if (newEnergy !== currentCore.energyStored) updateB(core.id, { energyStored: newEnergy });
      });

      // 3. Extractors
      const processExtractor = (ext: Building, resourceType: 'water' | 'minerals') => {
        const currentExt = getB(ext.id);
        const liveSinks = findReachable(ext.faceIndex, outGraph, ['WAREHOUSE', 'CORE']).map(s => getB(s.id));
        let totalSpace = 0;
        liveSinks.forEach(sink => totalSpace += Math.max(0, resourceType === 'water' ? sink.waterMax - sink.waterStored : sink.mineralsMax - sink.mineralsStored));

        if (totalSpace <= 0) {
           if (!currentExt.isBlocked) updateB(ext.id, { isBlocked: true });
           return;
        } else {
           if (currentExt.isBlocked) updateB(ext.id, { isBlocked: false });
        }

        const rate = currentExt.extractionRate ?? 1.0;
        const energyNeeded = 10 * rate * inGameHoursElapsed;
        const liveSources = findReachable(ext.faceIndex, inGraph, ['BATTERY', 'CORE']).map(s => getB(s.id));
        const totalAvailable = liveSources.reduce((sum, b) => sum + b.energyStored, 0);
        
        if (totalAvailable >= energyNeeded) {
          if (!currentExt.isPowered) updateB(ext.id, { isPowered: true });
          liveSources.forEach(src => updateB(src.id, { energyStored: Math.max(0, src.energyStored - (energyNeeded * (src.energyStored / totalAvailable))) }));

          const center = getFaceCenter(ext.faceIndex);
          if (center) {
            const { lat, lon } = vector3ToCoord(center);
            const generated = Math.min(10 * rate * (resourceType === 'water' ? getSectorResources(lat, lon).waterMultiplier : getSectorResources(lat, lon).mineralsMultiplier) * inGameHoursElapsed, totalSpace);
            if (liveSinks.length > 0) {
               liveSinks.forEach(sink => {
                 const space = Math.max(0, resourceType === 'water' ? sink.waterMax - sink.waterStored : sink.mineralsMax - sink.mineralsStored);
                 if (resourceType === 'water') updateB(sink.id, { waterStored: sink.waterStored + generated * (space / totalSpace) });
                 else updateB(sink.id, { mineralsStored: sink.mineralsStored + generated * (space / totalSpace) });
               });
            }
          }
        } else {
          if (currentExt.isPowered !== false) updateB(ext.id, { isPowered: false });
        }
      };

      store.buildings.filter(b => b.type === 'ICE_EXTRACTOR' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(ext => processExtractor(ext, 'water'));
      store.buildings.filter(b => b.type === 'MINERAL_EXTRACTOR' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(ext => processExtractor(ext, 'minerals'));

      // 4. Network Balancing
      components.forEach(comp => {
        const storage = store.buildings.filter(b => comp.includes(b.faceIndex) && (b.type === 'BATTERY' || b.type === 'CORE') && b.status === 'OPERATIONAL');
        if (storage.length > 1) {
          const liveStorage = storage.map(s => getB(s.id));
          const coresInGroup = liveStorage.filter(b => b.type === 'CORE');
          const batteriesInGroup = liveStorage.filter(b => b.type === 'BATTERY');
          
          let totalEnergy = liveStorage.reduce((sum, b) => sum + b.energyStored, 0);
          const coresMax = coresInGroup.reduce((sum, b) => sum + b.energyMax, 0);
          const batteriesMax = batteriesInGroup.reduce((sum, b) => sum + b.energyMax, 0);

          if (totalEnergy <= coresMax) {
            const ratio = totalEnergy > 0 ? totalEnergy / coresMax : 0;
            coresInGroup.forEach(c => updateB(c.id, { energyStored: c.energyMax * ratio }));
            batteriesInGroup.forEach(b => updateB(b.id, { energyStored: 0 }));
          } else {
            coresInGroup.forEach(c => updateB(c.id, { energyStored: c.energyMax }));
            const remaining = totalEnergy - coresMax;
            batteriesInGroup.forEach(b => updateB(b.id, { energyStored: b.energyMax * (batteriesMax > 0 ? Math.min(remaining, batteriesMax) / batteriesMax : 0) }));
          }
        }
      });

      // 5. Directed Storage Flow
      const storageNodes = store.buildings.filter(b => (b.type === 'BATTERY' || b.type === 'CORE') && b.status === 'OPERATIONAL');
      storageNodes.sort((a, b) => (getB(b.id).energyStored / getB(b.id).energyMax) - (getB(a.id).energyStored / getB(a.id).energyMax));
      
      storageNodes.forEach(source => {
        const currentSource = getB(source.id);
        const sourcePct = currentSource.energyStored / currentSource.energyMax;
        if (sourcePct <= 0) return;

        const sourceComp = faceToComp.get(source.faceIndex);
        const validSinks = findReachable(source.faceIndex, outGraph, ['BATTERY', 'CORE'])
          .filter(s => s.id !== source.id && (sourceComp === undefined || faceToComp.get(s.faceIndex) !== sourceComp))
          .map(s => getB(s.id)).filter(s => (s.energyStored / s.energyMax) < sourcePct);
        
        if (validSinks.length > 0) {
          let availableToTransfer = Math.min(currentSource.energyStored, 500 * inGameHoursElapsed);
          let distributed = 0;
          validSinks.forEach(sink => {
            const give = Math.min(availableToTransfer / validSinks.length, (sourcePct * sink.energyMax) - sink.energyStored);
            if (give > 0) { updateB(sink.id, { energyStored: sink.energyStored + give }); distributed += give; }
          });
          if (distributed > 0) updateB(source.id, { energyStored: currentSource.energyStored - distributed });
        }
      });

      // Batch Final Updates
      store.buildings.forEach(b => {
        if (b.type === 'BATTERY' || b.type === 'CORE') {
          const currentB = getB(b.id);
          const roundedDelta = Math.round(((currentB.energyStored - (initialEnergy.get(b.id) || 0)) / inGameHoursElapsed) * 10) / 10;
          if (roundedDelta !== Math.round((b.energyDelta || 0) * 10) / 10) updateB(b.id, { energyDelta: roundedDelta });
        }
      });

      if (Object.keys(pendingUpdates).length > 0) {
        store.batchUpdateBuildings(pendingUpdates);
      }
    }
  });

  return null;
}
