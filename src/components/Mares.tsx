'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useGameStore } from '@/store/useGameStore';
import { LUNAR_MARES, Mare } from '@/data/mares';

import { coordToVector3, SIM_MOON_RADIUS, RADIUS_RATIO } from '@/utils/geo';

const mareMaterial = new THREE.MeshBasicMaterial({ 
  color: '#00aaff', 
  transparent: true, 
  opacity: 0.05,
  side: THREE.DoubleSide,
  depthWrite: false
});
const mareOutlineMaterial = new THREE.LineBasicMaterial({ color: '#00aaff', transparent: true, opacity: 0.15 });

// Shared HUD pin geometries (Taller and further than Craters to separate layers)
const HUD_PIN_Y = 0.6; // Shift it diagonally away from the center
const HUD_PIN_Z = -1.8; // Push out far from the surface

const pointerLineGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, HUD_PIN_Y, HUD_PIN_Z)
]);
const pointerDotGeometry = new THREE.CircleGeometry(0.015, 8);
const pointerDotMaterial = new THREE.MeshBasicMaterial({ color: '#00aaff', transparent: true, opacity: 0.8 });

function MareItem({ mare }: { mare: Mare }) {
  const radius3D = (mare.diameterKm / 2) * RADIUS_RATIO;
  
  const { capGeometry, boundaryGeometry, pos } = useMemo(() => {
    // Surface position for the anchor (float above shadow layer at 1.002)
    const position = coordToVector3(mare.lat, mare.lon, SIM_MOON_RADIUS * 1.005);
    
    // Angle from center of mare to its edge
    const thetaLength = Math.asin(Math.min(1.0, radius3D / SIM_MOON_RADIUS));
    
    // Generate spherical cap (centered at +Y, North pole)
    const cap = new THREE.SphereGeometry(SIM_MOON_RADIUS * 1.005, 32, 16, 0, Math.PI * 2, 0, thetaLength);
    
    // Generate curved boundary line points along the sphere surface
    const points = [];
    const r = SIM_MOON_RADIUS * 1.006;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const x = r * Math.sin(thetaLength) * Math.cos(angle);
      const z = r * Math.sin(thetaLength) * Math.sin(angle);
      const y = r * Math.cos(thetaLength);
      points.push(new THREE.Vector3(x, y, z));
    }
    const boundary = new THREE.BufferGeometry().setFromPoints(points);
    
    return { capGeometry: cap, boundaryGeometry: boundary, pos: position };
  }, [mare.lat, mare.lon, radius3D]);

  return (
    <group>
      {/* Curved geometry placed at origin and rotated to face the mare surface position */}
      <group onUpdate={(self) => self.lookAt(pos)}>
        <mesh 
          geometry={capGeometry} 
          material={mareMaterial} 
          rotation={[Math.PI / 2, 0, 0]} 
        />
        <primitive 
          object={new THREE.Line(boundaryGeometry, mareOutlineMaterial)} 
          rotation={[Math.PI / 2, 0, 0]} 
        />
      </group>
      
      {/* HUD Pin starts at the center of the mare on the surface */}
      <group position={pos} onUpdate={(self) => self.lookAt(0, 0, 0)}>
        <group position={[0, 0, 0]}>
          <lineSegments geometry={pointerLineGeometry} material={mareOutlineMaterial} />
          
          <group position={[0, HUD_PIN_Y, HUD_PIN_Z]}>
            <Billboard>
              <mesh geometry={pointerDotGeometry} material={pointerDotMaterial} />
            </Billboard>
            <Billboard>
              <Text 
                position={[0, 0.05, 0]}
                fontSize={0.15} 
                color="#00aaff" 
                anchorX="center" 
                anchorY="bottom" 
                fillOpacity={0.9}
                depthOffset={-10}
              >
                {mare.name}
              </Text>
            </Billboard>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Mares() {
  const showMares = useGameStore((state) => state.filters.showMares);

  if (!showMares) return null;

  return (
    <group>
      {LUNAR_MARES.map((mare) => (
        <MareItem key={mare.id} mare={mare} />
      ))}
    </group>
  );
}
