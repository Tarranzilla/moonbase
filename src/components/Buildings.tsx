import { useGameStore, Building, Connection } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import { useShallow } from 'zustand/react/shallow';

function BuildingMaterial({ color, isBuilding, isHovered, isDeconstructMode, isPreview, isOff }: { color: string, isBuilding?: boolean, isHovered?: boolean, isDeconstructMode?: boolean, isPreview?: boolean, isOff?: boolean }) {
  const isTargeted = isDeconstructMode && isHovered;
  return (
    <meshBasicMaterial 
      color={isTargeted ? '#ff0000' : (isOff ? '#880000' : (isPreview ? '#eab308' : (isBuilding ? '#ffff00' : color)))} 
      wireframe={true} 
      transparent={true}
      opacity={isTargeted ? 0.8 : (isPreview ? 0.6 : (isBuilding ? 0.3 : 1))} 
    />
  );
}

function useBuildingInteractions(building: { faceIndex: number, status?: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const buildMode = useGameStore(state => state.buildMode);
  const selectedTeamId = useGameStore(state => state.selectedTeamId);
  const isDeconstructMode = buildMode === 'DECONSTRUCT';
  const isPreview = building.status === 'PREVIEW';
  
  const handlePointerOver = isPreview ? undefined : (e: any) => { e.stopPropagation(); setIsHovered(true); };
  const handlePointerOut = isPreview ? undefined : (e: any) => { e.stopPropagation(); setIsHovered(false); };
  
  const handleClick = isPreview ? undefined : (e: any) => {
    if (useGameStore.getState().buildMode === 'CONNECTION') {
      return; // Let the click pass through to the moon surface
    }
    e.stopPropagation();
    if (isDeconstructMode && selectedTeamId) {
      useGameStore.getState().queueBuildJob(selectedTeamId, {
        type: 'DECONSTRUCT',
        targetFaceIndex: building.faceIndex
      });
      if (!e.shiftKey) {
        useGameStore.getState().setBuildMode('NONE');
      }
    } else if (!isDeconstructMode) {
      const center = getFaceCenter(building.faceIndex);
      if (center) {
        const radius = center.length();
        const lat = Math.asin(center.y / radius) * (180 / Math.PI);
        const lon = Math.atan2(center.x, center.z) * (180 / Math.PI);
        useGameStore.getState().setSelectedCell(building.faceIndex.toString(), { lat, lon });
      }
    }
  };

  return { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick };
}

export function useBuildingState(buildingId: string | undefined) {
  return useGameStore(useShallow(state => {
    if (!buildingId || buildingId.startsWith('pending-') || buildingId === 'preview') return { isOn: true, isPowered: true, extractionRate: 1, energyLevel: 0 };
    const b = state.buildings.find(b => b.id === buildingId);
    if (!b) return { isOn: true, isPowered: true, extractionRate: 1, energyLevel: 0 };
    return {
      isOn: b.isOn,
      isPowered: b.isPowered,
      extractionRate: b.extractionRate ?? 1,
      energyLevel: b.energyMax ? b.energyStored / b.energyMax : 0
    };
  }));
}

export default function Buildings({ hoveredFace = null }: { hoveredFace?: number | null }) {
  const buildMode = useGameStore(state => state.buildMode);

  const buildingsData = useGameStore(useShallow(state => state.buildings.map(b => `${b.id}:${b.type}:${b.faceIndex}:${b.status}`)));

  const connectionsData = useGameStore(useShallow(state => 
    state.connections.map(c => `${c.id}:${c.fromFaceIndex}:${c.toFaceIndex}:${c.flowType}`)
  ));

  const pendingConnectionsData = useGameStore(useShallow(state => {
    const jobs: string[] = [];
    state.teams.forEach(team => {
      const allJobs = [team.buildJob, ...(team.jobQueue || [])];
      allJobs.forEach(job => {
        if (job && job.type === 'CONNECTION' && job.secondaryFaceIndex !== undefined) {
          jobs.push(`${job.targetFaceIndex}:${job.secondaryFaceIndex}`);
        }
      });
    });
    return jobs;
  }));

  const pendingBuildingsData = useGameStore(useShallow(state => {
    const jobs: string[] = [];
    state.teams.forEach(team => {
      const allJobs = [team.buildJob, ...(team.jobQueue || [])];
      allJobs.forEach(job => {
        if (job && job.type !== 'CONNECTION' && job.type !== 'DECONSTRUCT' && job.type !== 'DECONSTRUCT_CONNECTION' && job.type !== 'NONE') {
          jobs.push(`${job.type}:${job.targetFaceIndex}`);
        }
      });
    });
    return jobs;
  }));

  const buildings = useMemo(() => buildingsData.map(str => {
    const parts = str.split(':');
    return { 
      id: parts[0], 
      type: parts[1], 
      faceIndex: parseInt(parts[2]), 
      status: parts[3]
    };
  }), [buildingsData]);

  const connections = useMemo(() => connectionsData.map(str => {
    const parts = str.split(':');
    return {
      id: parts[0],
      fromFaceIndex: parseInt(parts[1]),
      toFaceIndex: parseInt(parts[2]),
      flowType: parts[3]
    };
  }), [connectionsData]);

  const pendingConnections = useMemo(() => pendingConnectionsData.map(str => {
    const parts = str.split(':');
    return { fromFaceIndex: parseInt(parts[0]), toFaceIndex: parseInt(parts[1]) };
  }), [pendingConnectionsData]);

  const pendingBuildings = useMemo(() => pendingBuildingsData.map(str => {
    const parts = str.split(':');
    return { type: parts[0], faceIndex: parseInt(parts[1]) };
  }), [pendingBuildingsData]);

  // Group by type for instanced rendering or simple mapping
  const solarPanels = buildings.filter(b => b.type === 'SOLAR_PANEL');
  const batteries = buildings.filter(b => b.type === 'BATTERY');
  const nodes = buildings.filter(b => b.type === 'JUNCTION');
  const iceExtractors = buildings.filter(b => b.type === 'ICE_EXTRACTOR');
  const mineralExtractors = buildings.filter(b => b.type === 'MINERAL_EXTRACTOR');
  const warehouses = buildings.filter(b => b.type === 'WAREHOUSE');
  const cores = buildings.filter(b => b.type === 'CORE');
  const spaceports = buildings.filter(b => b.type === 'SPACEPORT');
  const habitations = buildings.filter(b => b.type === 'HABITATION');
  const greenhouses = buildings.filter(b => b.type === 'GREENHOUSE');
  const factories = buildings.filter(b => b.type === 'FACTORY');
  const oxygenGenerators = buildings.filter(b => b.type === 'OXYGEN_GENERATOR');

  // Identify empty relay faces (faces with connections but no buildings)
  const connectedFaces = new Set<number>();
  connections.forEach(c => {
    connectedFaces.add(c.fromFaceIndex);
    connectedFaces.add(c.toFaceIndex);
  });
  buildings.forEach(b => {
    connectedFaces.delete(b.faceIndex);
  });
  const relayFaces = Array.from(connectedFaces);

  return (
    <group>
      {solarPanels.map(b => <SolarPanel key={b.id} building={b as any} gameTime={0} />)}
      {batteries.map(b => <Battery key={b.id} building={b as any} gameTime={0} />)}
      {nodes.map(b => <Junction key={b.id} building={b as any} gameTime={0} />)}
      {iceExtractors.map(b => <IceExtractor key={b.id} building={b as any} gameTime={0} />)}
      {mineralExtractors.map(b => <MineralExtractor key={b.id} building={b as any} gameTime={0} />)}
      {warehouses.map(b => <Warehouse key={b.id} building={b as any} gameTime={0} />)}
      {cores.map(c => <Core key={c.id} building={c as any} gameTime={0} />)}
      {spaceports.map(b => <Spaceport key={b.id} building={b as any} />)}
      {habitations.map(b => <Habitation key={b.id} building={b as any} />)}
      {greenhouses.map(b => <Greenhouse key={b.id} building={b as any} />)}
      {factories.map(b => <Factory key={b.id} building={b as any} />)}
      {oxygenGenerators.map(b => <OxygenGenerator key={b.id} building={b as any} />)}

      {relayFaces.map(faceIndex => <PowerRelay key={`relay-${faceIndex}`} faceIndex={faceIndex} />)}

      {connections.map((c, idx) => (
        <PowerLine key={idx} connection={c as any} />
      ))}

      {pendingBuildings.map((job, idx) => {
        const previewBuilding = { id: `pending-${idx}`, faceIndex: job.faceIndex, status: 'PREVIEW' } as any;
        switch (job.type) {
          case 'CORE': return <Core key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'SOLAR_PANEL': return <SolarPanel key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'BATTERY': return <Battery key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'WAREHOUSE': return <Warehouse key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'ICE_EXTRACTOR': return <IceExtractor key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'MINERAL_EXTRACTOR': return <MineralExtractor key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'JUNCTION': return <Junction key={`pb-${idx}`} building={previewBuilding} gameTime={0} />;
          case 'SPACEPORT': return <Spaceport key={`pb-${idx}`} building={previewBuilding} />;
          case 'HABITATION': return <Habitation key={`pb-${idx}`} building={previewBuilding} />;
          case 'GREENHOUSE': return <Greenhouse key={`pb-${idx}`} building={previewBuilding} />;
          case 'FACTORY': return <Factory key={`pb-${idx}`} building={previewBuilding} />;
          case 'OXYGEN_GENERATOR': return <OxygenGenerator key={`pb-${idx}`} building={previewBuilding} />;
          default: return null;
        }
      })}

      {pendingConnections.map((c, idx) => (
        <PendingConnection key={`pending-${idx}`} connection={c} />
      ))}

      {hoveredFace !== null && buildMode !== 'NONE' && buildMode !== 'DECONSTRUCT' && buildMode !== 'CONNECTION' && (() => {
        const previewBuilding = { id: 'preview', faceIndex: hoveredFace, status: 'PREVIEW' } as any;
        switch (buildMode) {
          case 'CORE': return <Core key="preview" building={previewBuilding} gameTime={0} />;
          case 'SOLAR_PANEL': return <SolarPanel key="preview" building={previewBuilding} gameTime={0} />;
          case 'BATTERY': return <Battery key="preview" building={previewBuilding} gameTime={0} />;
          case 'WAREHOUSE': return <Warehouse key="preview" building={previewBuilding} gameTime={0} />;
          case 'ICE_EXTRACTOR': return <IceExtractor key="preview" building={previewBuilding} gameTime={0} />;
          case 'MINERAL_EXTRACTOR': return <MineralExtractor key="preview" building={previewBuilding} gameTime={0} />;
          case 'JUNCTION': return <Junction key="preview" building={previewBuilding} gameTime={0} />;
          case 'SPACEPORT': return <Spaceport key="preview" building={previewBuilding} />;
          case 'HABITATION': return <Habitation key="preview" building={previewBuilding} />;
          case 'GREENHOUSE': return <Greenhouse key="preview" building={previewBuilding} />;
          case 'FACTORY': return <Factory key="preview" building={previewBuilding} />;
          case 'OXYGEN_GENERATOR': return <OxygenGenerator key="preview" building={previewBuilding} />;
          default: return null;
        }
      })()}
    </group>
  );
}

function PendingConnection({ connection }: { connection: { fromFaceIndex: number, toFaceIndex: number } }) {
  const curve = useMemo(() => {
    const start = getFaceCenter(connection.fromFaceIndex);
    const end = getFaceCenter(connection.toFaceIndex);
    if (!start || !end) return null;
    const midPoint = start.clone().lerp(end, 0.5).normalize().multiplyScalar(5.02);
    return new THREE.QuadraticBezierCurve3(start, midPoint, end);
  }, [connection.fromFaceIndex, connection.toFaceIndex]);

  if (!curve) return null;

  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.03, 8, false]} />
      <meshBasicMaterial 
        color="#ffff00" 
        wireframe={true} 
        transparent 
        opacity={0.3} 
      />
    </mesh>
  );
}

function PowerRelay({ faceIndex }: { faceIndex: number }) {
  const center = getFaceCenter(faceIndex);
  if (!center) return null;

  // Align to surface normal
  const normal = center.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

  return (
    <mesh position={center} quaternion={quaternion}>
      {/* Mini 4-sided elongated pyramid */}
      <cylinderGeometry args={[0.02, 0.08, 0.25, 4, 1]} />
      <meshBasicMaterial color="#ffffff" wireframe={true} />
    </mesh>
  );
}

function SolarPanel({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05)); // Slightly above surface
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      {/* Base */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.05, 0.1, 8]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* Panel */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.4, 0.4, 0.02]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function DeconstructCross() {
  return (
    <group position={[0, 0, 0.2]}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    </group>
  );
}

function Battery({ building, gameTime }: { building: Partial<Building> & { faceIndex: number, energyLevel?: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.1));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const fillRatio = energyLevel;

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* Energy Level Indicator */}
      {!isBuilding && (
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          {/* Keep the charge level color-coded so it's readable, but wireframe! */}
          <BuildingMaterial color={fillRatio > 0.5 ? "#00ff00" : fillRatio > 0.1 ? "#eab308" : "#ef4444"} isBuilding={false} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
        </mesh>
      )}
    </group>
  );
}

function Junction({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <mesh 
      position={pos} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      <octahedronGeometry args={[0.08, 0]} />
      <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
    </mesh>
  );
}


function IceExtractor({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.1));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      {/* Drill Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.25, 8]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* Drill Head */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.1, 0.02, 0.1, 8]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function MineralExtractor({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      {/* Excavator Base */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.25, 0.15, 0.1]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.15, 0, 0.05]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function Warehouse({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.06));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      {/* Warehouse Box */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.15]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0, 0, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.25, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function Core({ building, gameTime }: { building: Partial<Building> & { faceIndex: number }, gameTime: number }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.12));
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {isDeconstructMode && isHovered && (
        <DeconstructCross />
      )}
      {/* Central Icosahedron */}
      <mesh position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.15, 1]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* Inner Core */}
      <mesh position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.08, 0]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function useConnectionInteractions(connection: { fromFaceIndex: number, toFaceIndex: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const buildMode = useGameStore(state => state.buildMode);
  const selectedTeamId = useGameStore(state => state.selectedTeamId);
  const isDeconstructMode = buildMode === 'DECONSTRUCT';
  
  const handlePointerOver = (e: any) => { e.stopPropagation(); setIsHovered(true); };
  const handlePointerOut = (e: any) => { e.stopPropagation(); setIsHovered(false); };
  
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (isDeconstructMode && selectedTeamId) {
      useGameStore.getState().queueBuildJob(selectedTeamId, {
        type: 'DECONSTRUCT_CONNECTION',
        targetFaceIndex: connection.fromFaceIndex,
        secondaryFaceIndex: connection.toFaceIndex
      });
      useGameStore.getState().setBuildMode('NONE');
    }
  };

  return { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick };
}

function PowerLine({ connection }: { connection: { fromFaceIndex: number, toFaceIndex: number } }) {
  const curve = useMemo(() => {
    const start = getFaceCenter(connection.fromFaceIndex);
    const end = getFaceCenter(connection.toFaceIndex);
    if (!start || !end) return null;
    const midPoint = start.clone().lerp(end, 0.5).normalize().multiplyScalar(5.02);
    return new THREE.QuadraticBezierCurve3(start, midPoint, end);
  }, [connection.fromFaceIndex, connection.toFaceIndex]);

  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useConnectionInteractions(connection);

  const isTargeted = isDeconstructMode && isHovered;

  if (!curve) return null;

  return (
    <mesh 
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <tubeGeometry args={[curve, 20, isTargeted ? 0.05 : 0.03, 8, false]} />
      <meshBasicMaterial 
        color={isTargeted ? "#ff0000" : "#74ff00"} 
        wireframe={true} 
        transparent 
        opacity={isTargeted ? 1 : 0.6} 
      />
    </mesh>
  );
}

function Spaceport({ building }: { building: Partial<Building> & { faceIndex: number } }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;
  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut} 
      onClick={handleClick}
    >
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function Habitation({ building }: { building: Partial<Building> & { faceIndex: number } }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;
  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut} 
      onClick={handleClick}
    >
      <mesh>
        <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function Greenhouse({ building }: { building: Partial<Building> & { faceIndex: number } }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;
  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut} 
      onClick={handleClick}
    >
      {/* Central Pillar */}
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 0.35, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      {/* 3 Stacked Disks */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function Factory({ building }: { building: Partial<Building> & { faceIndex: number } }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;
  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut} 
      onClick={handleClick}
    >
      <mesh>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0.1, 0.2, 0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}

function OxygenGenerator({ building }: { building: Partial<Building> & { faceIndex: number } }) {
  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);
  const isOff = isOn === false || isPowered === false || extractionRate === 0;
  const { isHovered, isDeconstructMode, isPreview, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;
  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  return (
    <group 
      position={pos} 
      quaternion={quaternion} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut} 
      onClick={handleClick}
    >
      <mesh>
        <cylinderGeometry args={[0.1, 0.15, 0.15, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} isPreview={isPreview} isOff={isOff} />
      </mesh>
    </group>
  );
}
