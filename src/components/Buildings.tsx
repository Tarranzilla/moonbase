import { useGameStore, Building, Connection } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import { useShallow } from 'zustand/react/shallow';

function BuildingMaterial({ color, isBuilding, isHovered, isDeconstructMode }: { color: string, isBuilding?: boolean, isHovered?: boolean, isDeconstructMode?: boolean }) {
  const isTargeted = isDeconstructMode && isHovered;
  return (
    <meshBasicMaterial 
      color={isTargeted ? '#ff0000' : color} 
      wireframe={true} 
      transparent={true}
      opacity={isTargeted ? 0.8 : isBuilding ? 0.3 : 1} 
    />
  );
}

function useBuildingInteractions(building: { faceIndex: number }) {
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
        type: 'DECONSTRUCT',
        targetFaceIndex: building.faceIndex
      });
      useGameStore.getState().setBuildMode('NONE');
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

  return { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick };
}

export default function Buildings() {
  const buildingsData = useGameStore(useShallow(state => 
    state.buildings.map(b => `${b.id}:${b.type}:${b.faceIndex}:${b.status}:${b.energyMax ? Math.round((b.energyStored / b.energyMax) * 10) / 10 : 0}`)
  ));

  const connectionsData = useGameStore(useShallow(state => 
    state.connections.map(c => `${c.id}:${c.fromFaceIndex}:${c.toFaceIndex}:${c.flowType}`)
  ));

  const buildings = useMemo(() => buildingsData.map(str => {
    const parts = str.split(':');
    return { 
      id: parts[0], 
      type: parts[1], 
      faceIndex: parseInt(parts[2]), 
      status: parts[3], 
      energyLevel: parseFloat(parts[4]) 
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

  // Group by type for instanced rendering or simple mapping
  const solarPanels = buildings.filter(b => b.type === 'SOLAR_PANEL');
  const batteries = buildings.filter(b => b.type === 'BATTERY');
  const nodes = buildings.filter(b => b.type === 'JUNCTION');
  const iceExtractors = buildings.filter(b => b.type === 'ICE_EXTRACTOR');
  const mineralExtractors = buildings.filter(b => b.type === 'MINERAL_EXTRACTOR');
  const warehouses = buildings.filter(b => b.type === 'WAREHOUSE');
  const cores = buildings.filter(b => b.type === 'CORE');

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

      {relayFaces.map(faceIndex => <PowerRelay key={`relay-${faceIndex}`} faceIndex={faceIndex} />)}

      {connections.map((c, idx) => (
        <PowerLine key={idx} connection={c as any} />
      ))}
    </group>
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

function SolarPanel({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05)); // Slightly above surface
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      {/* Panel */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.4, 0.4, 0.02]} />
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
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

function Battery({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.1));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const fillRatio = building.energyLevel;
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      {/* Energy Level Indicator */}
      {!isBuilding && (
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          {/* Keep the charge level color-coded so it's readable, but wireframe! */}
          <BuildingMaterial color={fillRatio > 0.5 ? "#00ff00" : fillRatio > 0.1 ? "#eab308" : "#ef4444"} isBuilding={false} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
        </mesh>
      )}
    </group>
  );
}

function Junction({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
      <BuildingMaterial color="#00ff00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
    </mesh>
  );
}


function IceExtractor({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.1));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#00ffff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      {/* Drill Head */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.1, 0.02, 0.1, 8]} />
        <BuildingMaterial color="#00ffff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
    </group>
  );
}

function MineralExtractor({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#ffaa00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.15, 0, 0.05]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
        <BuildingMaterial color="#ffaa00" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
    </group>
  );
}

function Warehouse({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.08));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#0088ff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      <mesh position={[0, 0, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.25, 16]} />
        <BuildingMaterial color="#0088ff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
    </group>
  );
}

function Core({ building, gameTime }: { building: any, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.12));
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const { isHovered, isDeconstructMode, handlePointerOver, handlePointerOut, handleClick } = useBuildingInteractions(building);

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
        <BuildingMaterial color="#0055ff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
      </mesh>
      {/* Inner Core */}
      <mesh position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.08, 0]} />
        <BuildingMaterial color="#ffffff" isBuilding={isBuilding} isHovered={isHovered} isDeconstructMode={isDeconstructMode} />
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
