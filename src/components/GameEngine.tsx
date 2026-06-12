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
  const reachableCacheRef = useRef<Map<string, Building[]>>(new Map());
  const timeAccumulator = useRef<number>(0);

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
                let foodMax = 0, goodsMax = 0, oxygenMax = 0, populationMax = 0;
                if (team.buildJob.type === 'BATTERY') energyMax = 100;
                if (team.buildJob.type === 'CORE') { energyMax = 50; waterMax = 100; mineralsMax = 100; foodMax = 100; goodsMax = 100; oxygenMax = 100; populationMax = 20; }
                if (team.buildJob.type === 'WAREHOUSE') { waterMax = 0; mineralsMax = 0; foodMax = 0; goodsMax = 0; oxygenMax = 0; }
                if (team.buildJob.type === 'HABITATION') { populationMax = 20; }

                store.addBuilding({
                  id: `bldg-${Date.now()}-${Math.random()}`,
                  type: team.buildJob.type as any,
                  faceIndex: team.faceIndex!,
                  status: 'OPERATIONAL',
                  completionTime: gameTime,
                  energyStored: 0, energyMax,
                  waterStored: 0, waterMax,
                  mineralsStored: 0, mineralsMax,
                  foodStored: 0, foodMax,
                  goodsStored: 0, goodsMax,
                  oxygenStored: 0, oxygenMax,
                  population: 0, populationMax
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
        reachableCacheRef.current.clear();
      }

      const outGraph = outGraphRef.current;
      const inGraph = inGraphRef.current;
      const bothGraph = bothGraphRef.current;
      const components = componentsRef.current;
      const faceToComp = faceToCompRef.current;

      const GAME_SECONDS_PER_REAL_SECOND = 60;
      const theta = ((gameTime % LUNAR_DAY_MS) / LUNAR_DAY_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();

      timeAccumulator.current += delta;
      
      // Run simulation logic at a fixed tick rate (10 ticks per second)
      if (timeAccumulator.current >= 0.1) {
        const tickDelta = timeAccumulator.current;
        timeAccumulator.current = 0;
        
        const inGameSeconds = tickDelta * timeScale * GAME_SECONDS_PER_REAL_SECOND;
        const inGameHoursElapsed = inGameSeconds / 3600;

        const initialEnergy = new Map<string, number>();
        store.buildings.forEach(b => {
          if (b.type === 'BATTERY' || b.type === 'CORE') initialEnergy.set(b.id, b.energyStored);
        });

        // O(1) Lookup Maps
        const buildingMap = new Map<number, Building>();
        const buildingIdMap = new Map<string, Building>();
        store.buildings.forEach(b => {
          buildingMap.set(b.faceIndex, b);
          buildingIdMap.set(b.id, b);
        });

        const findReachable = (startFace: number, graph: Map<number, number[]>, targetTypes: string[], graphType: 'in' | 'out' | 'both') => {
          const cacheKey = `${startFace}:${targetTypes.join(',')}:${graphType}`;
          if (reachableCacheRef.current.has(cacheKey)) return reachableCacheRef.current.get(cacheKey)!;

          const visited = new Set<number>();
          const queue = [startFace];
          visited.add(startFace);
          const reachableBuildings: Building[] = [];
          while (queue.length > 0) {
            const curr = queue.shift()!;
            const b = buildingMap.get(curr);
            if (b && targetTypes.includes(b.type)) reachableBuildings.push(b);
            for (const n of graph.get(curr) || []) {
              if (!visited.has(n)) { visited.add(n); queue.push(n); }
            }
          }
          reachableCacheRef.current.set(cacheKey, reachableBuildings);
          return reachableBuildings;
        };

        const pendingUpdates: Record<string, Partial<Building>> = {};
        const getB = (id: string) => ({ ...(buildingIdMap.get(id) || {} as Building), ...(pendingUpdates[id] || {}) });
        const updateB = (id: string, updates: Partial<Building>) => {
          pendingUpdates[id] = { ...(pendingUpdates[id] || {}), ...updates };
        };
        
        let removedCount = 0;
        let addedCount = 0;
        const prosperity = store.prosperity;
        const spaceports = store.buildings.filter(b => b.type === 'SPACEPORT' && b.status === 'OPERATIONAL');
        
        if (spaceports.length > 0) {
          const connectedHabitations = new Set<Building>();
          spaceports.forEach(sp => {
            findReachable(sp.faceIndex, bothGraph, ['HABITATION'], 'both').forEach(hab => connectedHabitations.add(hab));
          });
          const hList = Array.from(connectedHabitations);
          
          if (prosperity <= -20) {
            hList.sort((a, b) => (getB(b.id).population || 0) - (getB(a.id).population || 0));
            hList.forEach(hab => {
              const currentHab = getB(hab.id);
              if (removedCount < 20 && currentHab.population && currentHab.population > 0) {
                const toRemove = Math.min(20 - removedCount, currentHab.population);
                updateB(hab.id, { population: currentHab.population - toRemove });
                removedCount += toRemove;
              }
            });
            store.setProsperity(prosperity + 20);
          } else if (prosperity >= 20) {
            hList.forEach(hab => {
              const currentHab = getB(hab.id);
              const space = (currentHab.populationMax || 20) - (currentHab.population || 0);
              if (space > 0 && addedCount < 20) {
                const toAdd = Math.min(space, 20 - addedCount);
                updateB(hab.id, { population: (currentHab.population || 0) + toAdd });
                addedCount += toAdd;
              }
            });
            store.setProsperity(prosperity - 20);
            
            const connectedWarehouses = new Set<Building>();
            spaceports.forEach(sp => {
              findReachable(sp.faceIndex, bothGraph, ['WAREHOUSE'], 'both').forEach(wh => connectedWarehouses.add(wh));
            });
            Array.from(connectedWarehouses).forEach(wh => {
              const currentWh = getB(wh.id);
              updateB(wh.id, { 
                waterStored: Math.min(currentWh.waterMax ?? 0, (currentWh.waterStored ?? 0) + 20),
                foodStored: Math.min(currentWh.foodMax ?? 0, (currentWh.foodStored ?? 0) + 20),
                goodsStored: Math.min(currentWh.goodsMax ?? 0, (currentWh.goodsStored ?? 0) + 20),
                oxygenStored: Math.min(currentWh.oxygenMax ?? 0, (currentWh.oxygenStored ?? 0) + 20)
              });
            });
          }
        }

      // 1. Solar Panels
      const panels = store.buildings.filter(b => b.type === 'SOLAR_PANEL' && b.status === 'OPERATIONAL' && b.isOn !== false);
      panels.forEach(panel => {
        const center = getFaceCenter(panel.faceIndex);
        if (center) {
          const dot = center.clone().normalize().dot(sunPos);
          if (dot > 0) {
            const energy = dot * 100 * inGameHoursElapsed;
            const sinks = findReachable(panel.faceIndex, outGraph, ['BATTERY', 'CORE'], 'out');
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

      // Habitation Consumption Logic
      let totalProsperityDelta = 0;
      store.buildings.filter(b => b.type === 'HABITATION' && b.status === 'OPERATIONAL').forEach(hab => {
        const currentHab = getB(hab.id);
        const pop = currentHab.population || 0;
        if (pop > 0) {
          const consumption = pop * 0.1 * inGameHoursElapsed;
          
          let waterMet = false;
          let foodMet = false;
          let goodsMet = false;
          let oxygenMet = false;
          
          const whs = findReachable(hab.faceIndex, inGraph, ['WAREHOUSE', 'CORE'], 'in').map(w => getB(w.id));
          const totalWater = whs.reduce((sum, w) => sum + (w.waterStored || 0), 0);
          const totalFood = whs.reduce((sum, w) => sum + (w.foodStored || 0), 0);
          const totalGoods = whs.reduce((sum, w) => sum + (w.goodsStored || 0), 0);
          const totalOxygen = whs.reduce((sum, w) => sum + (w.oxygenStored || 0), 0);
          
          if (totalWater >= consumption) {
            waterMet = true;
            whs.forEach(w => updateB(w.id, { waterStored: Math.max(0, w.waterStored - (consumption * ((w.waterStored || 0) / totalWater))) }));
          }
          if (totalFood >= consumption) {
            foodMet = true;
            whs.forEach(w => updateB(w.id, { foodStored: Math.max(0, (w.foodStored || 0) - (consumption * ((w.foodStored || 0) / totalFood))) }));
          }
          if (totalGoods >= consumption) {
            goodsMet = true;
            whs.forEach(w => updateB(w.id, { goodsStored: Math.max(0, (w.goodsStored || 0) - (consumption * ((w.goodsStored || 0) / totalGoods))) }));
          }
          if (totalOxygen >= consumption) {
            oxygenMet = true;
            whs.forEach(w => updateB(w.id, { oxygenStored: Math.max(0, (w.oxygenStored || 0) - (consumption * ((w.oxygenStored || 0) / totalOxygen))) }));
          }
          
          if (!waterMet || !foodMet || !goodsMet || !oxygenMet) {
            totalProsperityDelta -= pop * inGameHoursElapsed * 0.5;
          } else {
            totalProsperityDelta += pop * inGameHoursElapsed * 0.5;
          }
        }
      });
      
      let intrinsicProsperityDelta = 0;
      const poweredSpaceports = spaceports.filter(b => b.isPowered && b.isOn !== false);
      if (poweredSpaceports.length > 0) {
        intrinsicProsperityDelta += 0.5 * inGameHoursElapsed;
      }
      if (store.prosperity < 0) {
        intrinsicProsperityDelta += 1.0 * inGameHoursElapsed;
      }

      if (Math.abs(totalProsperityDelta) > 0 || intrinsicProsperityDelta !== 0) {
         store.setProsperity(prev => {
           let next = prev + totalProsperityDelta + intrinsicProsperityDelta;
           // If we are applying negative decay, don't let it overshoot 0
           if (prev < 0 && next > 0 && totalProsperityDelta === 0) next = 0;
           return next;
         });
      }

      // 3. Extractors
      const processExtractor = (ext: Building, resourceType: 'water' | 'minerals') => {
        const currentExt = getB(ext.id);
        const liveSinks = findReachable(ext.faceIndex, outGraph, ['WAREHOUSE', 'CORE'], 'out').map(s => getB(s.id));
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
        const liveSources = findReachable(ext.faceIndex, inGraph, ['BATTERY', 'CORE'], 'in').map(s => getB(s.id));
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

      // Greenhouse, Factory, Oxygen Generator Logic
      const processProduction = (building: Building, type: string) => {
        const currentB = getB(building.id);
        const rate = currentB.extractionRate ?? 1.0;
        
        let energyNeeded = 0;
        let waterNeeded = 0;
        let mineralsNeeded = 0;
        let producedAmount = 0;
        let resourceType: 'food' | 'goods' | 'oxygen' = 'food';
        
        if (type === 'GREENHOUSE') {
          energyNeeded = 10 * rate * inGameHoursElapsed;
          waterNeeded = 5 * rate * inGameHoursElapsed;
          producedAmount = 10 * rate * inGameHoursElapsed;
          resourceType = 'food';
        } else if (type === 'FACTORY') {
          energyNeeded = 20 * rate * inGameHoursElapsed;
          mineralsNeeded = 10 * rate * inGameHoursElapsed;
          producedAmount = 5 * rate * inGameHoursElapsed;
          resourceType = 'goods';
        } else if (type === 'OXYGEN_GENERATOR') {
          energyNeeded = 15 * rate * inGameHoursElapsed;
          waterNeeded = 10 * rate * inGameHoursElapsed;
          producedAmount = 20 * rate * inGameHoursElapsed;
          resourceType = 'oxygen';
        }

        const liveSinks = findReachable(building.faceIndex, outGraph, ['WAREHOUSE', 'CORE'], 'out').map(s => getB(s.id));
        let totalSpace = 0;
        liveSinks.forEach(sink => {
          if (resourceType === 'food') totalSpace += Math.max(0, (sink.foodMax ?? 0) - (sink.foodStored ?? 0));
          else if (resourceType === 'goods') totalSpace += Math.max(0, (sink.goodsMax ?? 0) - (sink.goodsStored ?? 0));
          else if (resourceType === 'oxygen') totalSpace += Math.max(0, (sink.oxygenMax ?? 0) - (sink.oxygenStored ?? 0));
        });

        if (totalSpace <= 0) {
          updateB(building.id, { isBlocked: true, isPowered: true });
        } else {
          let hasSufficientInputs = true;
          
          const inSources = findReachable(building.faceIndex, inGraph, ['BATTERY', 'CORE', 'WAREHOUSE'], 'in').map(s => getB(s.id));
          
          const availableEnergy = inSources.reduce((sum, s) => sum + (s.energyStored ?? 0), 0);
          if (availableEnergy < energyNeeded) hasSufficientInputs = false;
          
          if (waterNeeded > 0) {
            const availableWater = inSources.reduce((sum, s) => sum + (s.waterStored ?? 0), 0);
            if (availableWater < waterNeeded) hasSufficientInputs = false;
          }
          if (mineralsNeeded > 0) {
            const availableMinerals = inSources.reduce((sum, s) => sum + (s.mineralsStored ?? 0), 0);
            if (availableMinerals < mineralsNeeded) hasSufficientInputs = false;
          }

          if (hasSufficientInputs) {
            updateB(building.id, { isBlocked: false, isPowered: true });
            
            inSources.forEach(s => {
              if (energyNeeded > 0 && s.energyStored !== undefined) {
                const draw = Math.min(s.energyStored, energyNeeded * (s.energyStored / availableEnergy));
                updateB(s.id, { energyStored: s.energyStored - draw });
              }
              if (waterNeeded > 0 && s.waterStored !== undefined) {
                const availableWater = inSources.reduce((sum, xs) => sum + (xs.waterStored ?? 0), 0);
                const draw = Math.min(s.waterStored, waterNeeded * (s.waterStored / availableWater));
                updateB(s.id, { waterStored: s.waterStored - draw });
              }
              if (mineralsNeeded > 0 && s.mineralsStored !== undefined) {
                const availableMinerals = inSources.reduce((sum, xs) => sum + (xs.mineralsStored ?? 0), 0);
                const draw = Math.min(s.mineralsStored, mineralsNeeded * (s.mineralsStored / availableMinerals));
                updateB(s.id, { mineralsStored: s.mineralsStored - draw });
              }
            });

            const generated = Math.min(producedAmount, totalSpace);
            liveSinks.forEach(sink => {
              if (resourceType === 'food') {
                const space = Math.max(0, (sink.foodMax ?? 0) - (sink.foodStored ?? 0));
                updateB(sink.id, { foodStored: (sink.foodStored ?? 0) + generated * (space / totalSpace) });
              } else if (resourceType === 'goods') {
                const space = Math.max(0, (sink.goodsMax ?? 0) - (sink.goodsStored ?? 0));
                updateB(sink.id, { goodsStored: (sink.goodsStored ?? 0) + generated * (space / totalSpace) });
              } else if (resourceType === 'oxygen') {
                const space = Math.max(0, (sink.oxygenMax ?? 0) - (sink.oxygenStored ?? 0));
                updateB(sink.id, { oxygenStored: (sink.oxygenStored ?? 0) + generated * (space / totalSpace) });
              }
            });
          } else {
            if (currentB.isPowered !== false) updateB(building.id, { isPowered: false });
          }
        }
      };

      store.buildings.filter(b => b.type === 'GREENHOUSE' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(b => processProduction(b, 'GREENHOUSE'));
      store.buildings.filter(b => b.type === 'FACTORY' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(b => processProduction(b, 'FACTORY'));
      store.buildings.filter(b => b.type === 'OXYGEN_GENERATOR' && b.status === 'OPERATIONAL' && b.isOn !== false).forEach(b => processProduction(b, 'OXYGEN_GENERATOR'));

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
        const validSinks = findReachable(source.faceIndex, outGraph, ['BATTERY', 'CORE'], 'out')
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

        let tWater = 0, mWater = 0;
        let tMinerals = 0, mMinerals = 0;
        let tPower = 0, mPower = 0;
        let tFood = 0, mFood = 0;
        let tGoods = 0, mGoods = 0;
        let tOxygen = 0, mOxygen = 0;
        let tPop = 0, mPop = 0;

        store.buildings.forEach(b => {
          const cb = getB(b.id);
          tWater += cb.waterStored || 0; mWater += cb.waterMax || 0;
          tMinerals += cb.mineralsStored || 0; mMinerals += cb.mineralsMax || 0;
          tPower += cb.energyStored || 0; mPower += cb.energyMax || 0;
          tFood += cb.foodStored || 0; mFood += cb.foodMax || 0;
          tGoods += cb.goodsStored || 0; mGoods += cb.goodsMax || 0;
          tOxygen += cb.oxygenStored || 0; mOxygen += cb.oxygenMax || 0;
          tPop += cb.population || 0; mPop += cb.populationMax || 0;
        });
        
        store.setResourceTotals({
          water: tWater, maxWater: mWater,
          minerals: tMinerals, maxMinerals: mMinerals,
          power: tPower, maxPower: mPower,
          food: tFood, maxFood: mFood,
          goods: tGoods, maxGoods: mGoods,
          oxygen: tOxygen, maxOxygen: mOxygen,
          pop: tPop, maxPop: mPop,
        });

        if (Object.keys(pendingUpdates).length > 0) {
          store.batchUpdateBuildings(pendingUpdates);
        }
      } // end of tick logic
    }
  });

  return null;
}
