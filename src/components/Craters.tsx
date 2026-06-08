'use client';

import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useGameStore } from '@/store/useGameStore';
import { LUNAR_CRATERS } from '@/data/craters';

function coordToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = lat * (Math.PI / 180);
  const theta = lon * (Math.PI / 180);

  return new THREE.Vector3(
    radius * Math.sin(theta) * Math.cos(phi),
    radius * Math.sin(phi),
    radius * Math.cos(theta) * Math.cos(phi)
  );
}

const REAL_MOON_RADIUS_KM = 1737.4;
const SIM_MOON_RADIUS = 5.0;
const RADIUS_RATIO = SIM_MOON_RADIUS / REAL_MOON_RADIUS_KM;

// For wireframe circles
const circleGeometry = new THREE.EdgesGeometry(new THREE.CircleGeometry(1, 32));
const craterMaterial = new THREE.LineBasicMaterial({ color: '#00ff00', transparent: true, opacity: 0.5 });

// Shared HUD pin geometries
const HUD_PIN_Y = 0.3; // Shift it diagonally away from the center
const HUD_PIN_Z = -1.0; // Push out far from the surface to avoid equator ring

const pointerLineGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, HUD_PIN_Y, HUD_PIN_Z)
]);
const pointerDotGeometry = new THREE.CircleGeometry(0.015, 8);
const pointerDotMaterial = new THREE.MeshBasicMaterial({ color: '#00ff00', transparent: true, opacity: 0.8 });

export default function Craters() {
  const showCraters = useGameStore((state) => state.filters.showCraters);

  if (!showCraters) return null;

  return (
    <group>
      {LUNAR_CRATERS.map((crater) => {
        // Place slightly above surface to prevent z-fighting
        const pos = coordToVector3(crater.lat, crater.lon, SIM_MOON_RADIUS * 1.005);
        
        // Calculate 3D radius based on real world scale
        const radius3D = (crater.diameterKm / 2) * RADIUS_RATIO;

        return (
          <group key={crater.id} position={pos}>
            <lineSegments 
              geometry={circleGeometry} 
              material={craterMaterial} 
              scale={[radius3D, radius3D, 1]} 
              // lookAt(0,0,0) points the local +Z axis toward the center of the moon, making the circle lie flat on the surface
              onUpdate={(self) => self.lookAt(0, 0, 0)}
            />
            
            {/* Orient a wrapper group to the surface normal so we can move "up" along the latitude */}
            <group onUpdate={(self) => self.lookAt(0, 0, 0)}>
              {/* The pin starts at the center of the crater */}
              <group position={[0, 0, 0]}>
                <lineSegments geometry={pointerLineGeometry} material={craterMaterial} />
                
                <group position={[0, HUD_PIN_Y, HUD_PIN_Z]}>
                  {/* Small dot at the end of the line */}
                  <Billboard>
                    <mesh geometry={pointerDotGeometry} material={pointerDotMaterial} />
                  </Billboard>
                  
                  {/* Text floating just above the dot */}
                  <Billboard>
                    <Text 
                      position={[0, 0.05, 0]}
                      fontSize={0.12} 
                      color="#00ff00" 
                      anchorX="center" 
                      anchorY="bottom" 
                      fillOpacity={0.8}
                    >
                      {crater.name}
                    </Text>
                  </Billboard>
                </group>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}
