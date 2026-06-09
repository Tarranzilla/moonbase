'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Team } from '@/store/useGameStore';
import { buildAdjacencyGraph, findShortestPath } from '@/utils/geometryGraph';

interface EngineersProps {
  geometry: THREE.BufferGeometry;
}

function getFaceCenterAndNormal(geometry: THREE.BufferGeometry, faceIndex: number) {
  const positionAttribute = geometry.getAttribute('position');
  const indexAttribute = geometry.getIndex();
  
  let a, b, c;
  if (indexAttribute) {
    a = indexAttribute.getX(faceIndex * 3);
    b = indexAttribute.getX(faceIndex * 3 + 1);
    c = indexAttribute.getX(faceIndex * 3 + 2);
  } else {
    a = faceIndex * 3;
    b = faceIndex * 3 + 1;
    c = faceIndex * 3 + 2;
  }
  
  const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
  const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
  const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

  const center = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);
  const normal = center.clone().normalize();
  return { center, normal };
}

export default function Engineers({ geometry }: EngineersProps) {
  const { teams, setTeamPath, updateTeamProgress, setSelectedTeam, selectedTeamId, timeScale } = useGameStore();
  
  const graph = useMemo(() => buildAdjacencyGraph(geometry), [geometry]);

  return (
    <group>
      {teams.filter(t => t.status !== 'AVAILABLE').map(team => (
        <EngineerToken 
          key={team.id} 
          team={team} 
          teams={teams}
          timeScale={timeScale}
          geometry={geometry} 
          graph={graph} 
          setTeamPath={setTeamPath}
          updateTeamProgress={updateTeamProgress}
          isSelected={selectedTeamId === team.id}
          onSelect={() => setSelectedTeam(team.id)}
        />
      ))}
    </group>
  );
}

interface EngineerTokenProps {
  team: Team;
  teams: Team[];
  timeScale: number;
  geometry: THREE.BufferGeometry;
  graph: Map<number, number[]>;
  setTeamPath: (teamId: string, path: number[]) => void;
  updateTeamProgress: (teamId: string, faceIndex: number, path: number[]) => void;
  isSelected: boolean;
  onSelect: () => void;
}

function EngineerToken({ team, teams, timeScale, geometry, graph, setTeamPath, updateTeamProgress, isSelected, onSelect }: EngineerTokenProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [currentPos, setCurrentPos] = useState<THREE.Vector3 | null>(null);
  const [currentNormal, setCurrentNormal] = useState<THREE.Vector3 | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState(0);
  
  // Initialize position when first deployed or mounted
  useEffect(() => {
    if (team.faceIndex !== null && currentPos === null) {
      const { center, normal } = getFaceCenterAndNormal(geometry, team.faceIndex);
      setCurrentPos(center.clone().add(normal.clone().multiplyScalar(0.2)));
      setCurrentNormal(normal);
    }
  }, [team.faceIndex, geometry, currentPos]);

  // Pathfinding logic
  useEffect(() => {
    if (team.targetFaceIndex !== null && team.path.length === 0 && team.faceIndex !== null) {
      if (team.faceIndex === team.targetFaceIndex) {
         setTeamPath(team.id, []);
      } else {
        const newPath = findShortestPath(team.faceIndex, team.targetFaceIndex, graph);
        if (newPath.length > 0) {
          setTeamPath(team.id, newPath);
        }
      }
    }
  }, [team.targetFaceIndex, team.faceIndex, team.path.length, graph, team.id, setTeamPath]);

  // Movement animation
  useFrame((state, realDelta) => {
    if (!meshRef.current || !currentPos || !currentNormal || team.faceIndex === null) return;

    // Calculate Stacking Altitude
    let targetAltitude = 0;
    if (team.path.length === 0) {
      const sameCellTeams = teams.filter(t => t.status !== 'AVAILABLE' && t.faceIndex === team.faceIndex && t.path.length === 0);
      let stackIndex = 0;
      for (const other of sameCellTeams) {
        if (other.id !== team.id) {
          if (other.arrivalTime < team.arrivalTime) {
            stackIndex++;
          } else if (other.arrivalTime === team.arrivalTime && other.id < team.id) {
            stackIndex++;
          }
        }
      }
      targetAltitude = stackIndex * 0.6;
    }

    // Use realDelta for UI animations so it doesn't explode when fast-forwarding game time!
    const newAltitude = THREE.MathUtils.lerp(currentAltitude, targetAltitude, 10 * realDelta);
    setCurrentAltitude(newAltitude);

    let displayPos = currentPos.clone();
    let displayNormal = currentNormal.clone();

    // Only use timeScale for actual game movement
    const gameDelta = realDelta * timeScale;

    if (team.path.length > 0 && timeScale > 0) {
      const nextFace = team.path[0];
      const { center: nextCenter, normal: nextNormal } = getFaceCenterAndNormal(geometry, nextFace);
      
      const targetPos = nextCenter.clone().add(nextNormal.clone().multiplyScalar(0.2));
      
      const speed = 4.0; // Units per second
      const step = speed * gameDelta;
      const dist = currentPos.distanceTo(targetPos);
      
      if (dist <= step) {
        // Snap to next face and pop it from the path
        setCurrentPos(targetPos);
        setCurrentNormal(nextNormal);
        updateTeamProgress(team.id, nextFace, team.path.slice(1));
        displayPos = targetPos;
        displayNormal = nextNormal;
      } else {
        // Lerp position and normal
        displayPos = currentPos.clone().lerp(targetPos, step / dist);
        // Keep it exactly on the surface, accounting for the current jumping/stacking altitude
        displayPos.normalize().multiplyScalar(5.5 + newAltitude);
        setCurrentPos(displayPos);
        
        displayNormal = currentNormal.clone().lerp(nextNormal, step / dist).normalize();
        setCurrentNormal(displayNormal);
      }
    } else {
      // If not moving horizontally, apply vertical stacking offset
      displayPos.normalize().multiplyScalar(5.5 + newAltitude);
    }

    meshRef.current.position.copy(displayPos);
    
    // Orient diamond tip "up"
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), displayNormal);
    meshRef.current.quaternion.copy(quaternion);
    
    // Add a gentle floating bobbing effect (independent of timeScale!)
    const bobbing = Math.sin(state.clock.elapsedTime * 4 + parseInt(team.id.replace(/\D/g, ''))) * 0.05;
    meshRef.current.position.add(displayNormal.clone().multiplyScalar(bobbing));
  });

  if (!currentPos) return null;

  return (
    <mesh 
      ref={meshRef} 
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <octahedronGeometry args={[0.2, 0]} />
      <meshBasicMaterial 
        color={isSelected ? "#ffffff" : "#00ff00"} 
        wireframe={true}
        wireframeLinewidth={isSelected ? 2 : 1}
      />
    </mesh>
  );
}
