import { useGameStore, Building, Connection } from '@/store/useGameStore';
import * as THREE from 'three';
import { getFaceCenter } from '@/utils/geo';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function Buildings() {
  const buildings = useGameStore(state => state.buildings);
  const connections = useGameStore(state => state.connections);
  const gameTime = useGameStore(state => state.gameTime);

  // Group by type for instanced rendering or simple mapping
  const solarPanels = buildings.filter(b => b.type === 'SOLAR_PANEL');
  const batteries = buildings.filter(b => b.type === 'BATTERY');
  const nodes = buildings.filter(b => b.type === 'NODE');

  return (
    <group>
      {solarPanels.map(b => <SolarPanel key={b.id} building={b} gameTime={gameTime} />)}
      {batteries.map(b => <Battery key={b.id} building={b} gameTime={gameTime} />)}
      {nodes.map(b => <PowerNode key={b.id} building={b} gameTime={gameTime} />)}
      {connections.map(c => <PowerLine key={c.id} connection={c} />)}
    </group>
  );
}

function SolarPanel({ building, gameTime }: { building: Building, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05)); // Slightly above surface
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const progress = isBuilding && building.completionTime 
    ? Math.max(0, 1 - (building.completionTime - gameTime) / (24 * 60 * 60 * 1000))
    : 1;

  const handleBuildingClick = (e: any) => {
    e.stopPropagation();
    const radius = center.length();
    const lat = Math.asin(center.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(center.x, center.z) * (180 / Math.PI);
    useGameStore.getState().setSelectedCell(building.faceIndex.toString(), { lat, lon });
  };

  return (
    <group position={pos} quaternion={quaternion} onClick={handleBuildingClick}>
      {/* Base */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.05, 0.1, 8]} />
        <meshBasicMaterial color="#00ff00" wireframe={true} transparent opacity={isBuilding ? 0.3 : 1} />
      </mesh>
      {/* Panel */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.4, 0.4, 0.02]} />
        <meshBasicMaterial 
          color="#00ff00" 
          wireframe={true}
          transparent
          opacity={isBuilding ? 0.3 : 1} 
        />
      </mesh>
    </group>
  );
}

function Battery({ building, gameTime }: { building: Building, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.1));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

  const isBuilding = building.status === 'UNDER_CONSTRUCTION';
  const fillRatio = building.energyStored / building.energyMax;

  const handleBuildingClick = (e: any) => {
    e.stopPropagation();
    const radius = center.length();
    const lat = Math.asin(center.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(center.x, center.z) * (180 / Math.PI);
    useGameStore.getState().setSelectedCell(building.faceIndex.toString(), { lat, lon });
  };

  return (
    <group position={pos} quaternion={quaternion} onClick={handleBuildingClick}>
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        <meshBasicMaterial 
          color="#00ff00" 
          wireframe={true} 
          transparent
          opacity={isBuilding ? 0.3 : 1}
        />
      </mesh>
      {/* Energy Level Indicator */}
      {!isBuilding && (
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          {/* Keep the charge level color-coded so it's readable, but wireframe! */}
          <meshBasicMaterial color={fillRatio > 0.5 ? "#00ff00" : fillRatio > 0.1 ? "#eab308" : "#ef4444"} wireframe={true} />
        </mesh>
      )}
    </group>
  );
}

function PowerNode({ building, gameTime }: { building: Building, gameTime: number }) {
  const center = getFaceCenter(building.faceIndex);
  if (!center) return null;

  const normal = center.clone().normalize();
  const pos = center.clone().add(normal.clone().multiplyScalar(0.05));
  
  const isBuilding = building.status === 'UNDER_CONSTRUCTION';

  const handleBuildingClick = (e: any) => {
    e.stopPropagation();
    const radius = center.length();
    const lat = Math.asin(center.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(center.x, center.z) * (180 / Math.PI);
    useGameStore.getState().setSelectedCell(building.faceIndex.toString(), { lat, lon });
  };

  return (
    <mesh position={pos} onClick={handleBuildingClick}>
      <octahedronGeometry args={[0.08, 0]} />
      <meshBasicMaterial color="#00ff00" wireframe={true} transparent opacity={isBuilding ? 0.3 : 1} />
    </mesh>
  );
}

function PowerLine({ connection }: { connection: Connection }) {
  const start = getFaceCenter(connection.fromFaceIndex);
  const end = getFaceCenter(connection.toFaceIndex);
  if (!start || !end) return null;

  // Create a slight curve over the moon surface
  const midPoint = start.clone().lerp(end, 0.5).normalize().multiplyScalar(5.1); // Slightly higher
  
  const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);

  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.02, 8, false]} />
      {/* Yellow/Green mix for power line wireframe */}
      <meshBasicMaterial color="#74ff00" wireframe={true} transparent opacity={0.6} />
    </mesh>
  );
}
