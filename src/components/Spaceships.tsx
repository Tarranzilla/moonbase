'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Spaceship } from '@/store/useGameStore';
import { getFaceCenter } from '@/utils/geo';
import { Text, Line } from '@react-three/drei';

export const shipVisualProgress = new Map<string, number>();

export const getSpaceshipCurve = (faceIndex: number) => {
  const earthPos = new THREE.Vector3(-400, 0, 0);
  // Assuming moon radius 10
  const moonPos = getFaceCenter(faceIndex, 10)!.multiplyScalar(1.05);
  
  // Realistic Hohmann-style transfer orbit (simplified)
  // Instead of arcing "up" (Y axis), orbital transfers happen in the orbital plane (X-Z axis)
  // We use a Cubic Bezier to simulate an elliptical transfer arc.
  // P1: Ejection burn from Earth, swinging outwards
  const p1 = new THREE.Vector3(-300, 0, 150);
  // P2: Injection burn at Moon, approaching from the side
  const p2 = new THREE.Vector3(-50, 0, 150);
  
  return new THREE.CubicBezierCurve3(earthPos, p1, p2, moonPos);
};

function ShipVisual({ ship, isSelected, filters }: { ship: Spaceship, isSelected: boolean, filters: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const gameTime = useGameStore(state => state.gameTime);
  const curve = useMemo(() => getSpaceshipCurve(ship.targetFaceIndex), [ship.targetFaceIndex]);
  const curvePoints = useMemo(() => curve.getPoints(50), [curve]);

  const calculateShipPosAndRot = (progress: number) => {
    const t = ship.status === 'EN_ROUTE_TO_EARTH' ? 1 - progress : progress;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    if (ship.status === 'EN_ROUTE_TO_EARTH') {
      tangent.multiplyScalar(-1);
    }
    const rot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize()));
    return { pos, rot };
  };

  const visualProgress = useRef(ship.progress);
  const lastStatus = useRef(ship.status);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    const timeScale = useGameStore.getState().timeScale;
    
    // If status changed, reset visual progress to sync with reality immediately
    if (ship.status !== lastStatus.current) {
      visualProgress.current = ship.progress;
      lastStatus.current = ship.status;
    } else {
      // Extrapolate smoothly between simulation ticks!
      // 1 real second = 60 in-game minutes = 3600 in-game seconds
      // delta is in real seconds
      const inGameSecondsElapsed = delta * timeScale * 60;
      const inGameHoursElapsed = inGameSecondsElapsed / 3600;
      let progressDelta = 0;
      
      // Different transit times depending on status
      if (ship.status === 'DOCKED') {
         progressDelta = inGameHoursElapsed / 24; // 1 day docked
      } else {
         progressDelta = inGameHoursElapsed / 72; // 3 days transit
      }
      
      visualProgress.current += progressDelta;
    }
    
    // Clamp to [0,1]
    const clampedProgress = Math.max(0, Math.min(1, visualProgress.current));
    shipVisualProgress.set(ship.id, clampedProgress);
    
    let pos = new THREE.Vector3();
    let rot = new THREE.Euler();
    
    if (ship.status === 'DOCKED') {
       pos = curve.getPointAt(1); // The moon endpoint of the curve
       rot = new THREE.Euler(0, 0, 0); // Flat on the ground
    } else {
       const { pos: p, rot: r } = calculateShipPosAndRot(clampedProgress);
       pos = p;
       rot = r;
    }
    
    // Directly snap to the extrapolated position for perfect smoothness without rubber-banding
    groupRef.current.position.copy(pos);
    if (ship.status !== 'DOCKED') {
       groupRef.current.quaternion.setFromEuler(rot);
    } else {
       // Look down/flat if docked
       groupRef.current.lookAt(new THREE.Vector3(0,0,0));
    }
  });

  // Initialize position/rotation immediately to prevent spawning at origin
  let initialPos = new THREE.Vector3();
  let initialRot = new THREE.Euler();
  if (ship.status === 'DOCKED') {
     initialPos = curve.getPointAt(1);
  } else {
     const { pos: p, rot: r } = calculateShipPosAndRot(ship.progress);
     initialPos = p;
     initialRot = r;
  }

  return (
    <group>
      {filters.showTrajectories && ship.status !== 'DOCKED' && (
        <Line 
          points={curvePoints}
          color="#5500aa"
          lineWidth={1}
          transparent
          opacity={0.5}
          dashed
          dashScale={10}
          dashSize={1}
          dashOffset={gameTime / 1000}
        />
      )}
      
      <group ref={groupRef} name={`ship-model-${ship.id}`} position={initialPos} rotation={initialRot}>
        <group scale={0.15}>
          {/* Simple Ship Model */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.4, 1, 8]} />
            <meshBasicMaterial color={isSelected ? "#00ff00" : "#00aa00"} wireframe={true} />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshBasicMaterial color={isSelected ? "#00ff00" : "#00aa00"} wireframe={true} />
          </mesh>
          
          {/* Engine Glow */}
          <mesh position={[0, -0.6, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.6} wireframe={true} />
          </mesh>
        </group>

        {isSelected && (
          <Text
            position={[0, 0.4, 0]}
            fontSize={0.2}
            color="#00ff00"
            outlineWidth={0.02}
            outlineColor="#000000"
            rotation={new THREE.Euler(-Math.PI/2, 0, 0)} // Face camera roughly
          >
            STS {ship.id.split('-')[1] || ship.id}
          </Text>
        )}
      </group>
    </group>
  );
}

export default function Spaceships() {
  const spaceships = useGameStore(state => state.spaceships);
  const selectedId = useGameStore(state => state.selectedTeamId);
  const filters = useGameStore(state => state.filters);

  if (spaceships.length === 0) return null;

  return (
    <group>
      {spaceships.map(ship => (
        <ShipVisual 
          key={ship.id} 
          ship={ship} 
          isSelected={selectedId === ship.id}
          filters={filters}
        />
      ))}
    </group>
  );
}
