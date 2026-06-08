'use client';

import { useRef, useState, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';

export default function Moon() {
  const setSelectedCell = useGameStore((state) => state.setSelectedCell);
  const selectedCellId = useGameStore((state) => state.selectedCellId);

  const [hoveredFace, setHoveredFace] = useState<number | null>(null);

  // We use useMemo to create the geometry once
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(5, 4);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const hatchedMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color("#00ff00") }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vPos;
        void main() {
          // Creates a diagonal stripe pattern based on spatial coordinates
          float pattern = sin((vPos.x + vPos.y - vPos.z) * 40.0);
          if (pattern < 0.0) discard;
          gl_FragColor = vec4(color, 0.2); // 50% less intense than selected face
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  const wallMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color("#00ff00") }
      },
      vertexShader: `
        attribute float aFade;
        varying float vFade;
        void main() {
          vFade = aFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vFade;
        void main() {
          // Smooth fade out using power curve, ensuring no negative bases for pow()
          float alpha = pow(max(vFade, 0.0), 1.5);
          gl_FragColor = vec4(color, alpha * 0.35);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false, // Helps avoid z-sorting issues with fading transparency
    });
  }, []);

  // Compute vertices for the hovered face to draw an outline or highlight
  const highlightGeometry = useMemo(() => {
    if (hoveredFace === null) return null;
    const positionAttribute = geometry.getAttribute('position');
    const indexAttribute = geometry.getIndex();
    
    let a, b, c;
    if (indexAttribute) {
      a = indexAttribute.getX(hoveredFace * 3);
      b = indexAttribute.getX(hoveredFace * 3 + 1);
      c = indexAttribute.getX(hoveredFace * 3 + 2);
    } else {
      a = hoveredFace * 3;
      b = hoveredFace * 3 + 1;
      c = hoveredFace * 3 + 2;
    }
    
    const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
    const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
    const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

    if (isNaN(vA.x) || isNaN(vB.x) || isNaN(vC.x)) return null;

    const scale = 1.01;
    vA.multiplyScalar(scale);
    vB.multiplyScalar(scale);
    vC.multiplyScalar(scale);

    const highlightGeo = new THREE.BufferGeometry();
    highlightGeo.setFromPoints([vA, vB, vC]);
    highlightGeo.computeVertexNormals();
    return highlightGeo;
  }, [hoveredFace, geometry]);

  // Compute selected face geometry and marker walls
  const selectedData = useMemo(() => {
    if (!selectedCellId) return null;
    const faceIndex = parseInt(selectedCellId, 10);
    if (isNaN(faceIndex)) return null;

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

    if (isNaN(vA.x) || isNaN(vB.x) || isNaN(vC.x)) return null;

    // Face highlight
    const vA_face = vA.clone().multiplyScalar(1.015); // slightly above hover
    const vB_face = vB.clone().multiplyScalar(1.015);
    const vC_face = vC.clone().multiplyScalar(1.015);

    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setFromPoints([vA_face, vB_face, vC_face]);
    faceGeo.computeVertexNormals();

    // Wall Marker (Extruding fading walls)
    const center = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);
    const normal = center.clone().normalize();
    
    const height = 1.2; // Extrusion height into space
    const vAt = vA_face.clone().add(normal.clone().multiplyScalar(height));
    const vBt = vB_face.clone().add(normal.clone().multiplyScalar(height));
    const vCt = vC_face.clone().add(normal.clone().multiplyScalar(height));

    const wallsGeo = new THREE.BufferGeometry();
    
    // Create the 3 quads (each quad is 2 triangles = 6 vertices)
    const positions = new Float32Array([
      // Wall 1: vA -> vB
      ...vA_face.toArray(), ...vB_face.toArray(), ...vAt.toArray(),
      ...vB_face.toArray(), ...vBt.toArray(), ...vAt.toArray(),
      // Wall 2: vB -> vC
      ...vB_face.toArray(), ...vC_face.toArray(), ...vBt.toArray(),
      ...vC_face.toArray(), ...vCt.toArray(), ...vBt.toArray(),
      // Wall 3: vC -> vA
      ...vC_face.toArray(), ...vA_face.toArray(), ...vCt.toArray(),
      ...vA_face.toArray(), ...vAt.toArray(), ...vCt.toArray(),
    ]);

    // Fade attribute: 1 at the base, 0 at the top
    const fades = new Float32Array([
      1, 1, 0,
      1, 0, 0,
      
      1, 1, 0,
      1, 0, 0,
      
      1, 1, 0,
      1, 0, 0,
    ]);

    wallsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    wallsGeo.setAttribute('aFade', new THREE.BufferAttribute(fades, 1));

    return { faceGeo, wallsGeo, center, normal };
  }, [selectedCellId, geometry]);

  const longitudeMarkers = useMemo(() => {
    const markers = [];
    const r = 5.4; // Slightly outside the equator ring
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;
      
      let label = `${i * 30}°`;
      if (i > 0 && i < 6) label = `${i * 30}°E`;
      if (i > 6) label = `${(12 - i) * 30}°W`;
      if (i === 6) label = `180°`;
      
      markers.push({ position: [x, 0, z] as [number, number, number], label });
    }
    return markers;
  }, []);

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.faceIndex !== undefined && e.faceIndex !== null) {
      setHoveredFace(e.faceIndex);
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredFace(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // e.delta measures the distance the pointer moved between pointerdown and pointerup.
    // If it's greater than a few pixels, the user was panning/rotating, not clicking.
    if (e.delta > 2) return; 
    
    if (e.faceIndex !== undefined && e.faceIndex !== null) {
      const positionAttribute = geometry.getAttribute('position');
      const indexAttribute = geometry.getIndex();
      
      let a, b, c;
      if (indexAttribute) {
        a = indexAttribute.getX(e.faceIndex * 3);
        b = indexAttribute.getX(e.faceIndex * 3 + 1);
        c = indexAttribute.getX(e.faceIndex * 3 + 2);
      } else {
        a = e.faceIndex * 3;
        b = e.faceIndex * 3 + 1;
        c = e.faceIndex * 3 + 2;
      }
      
      const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
      const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
      const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

      const center = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);
      const radius = center.length();
      
      const lat = Math.asin(center.y / radius) * (180 / Math.PI);
      const lon = Math.atan2(center.x, center.z) * (180 / Math.PI);

      setSelectedCell(e.faceIndex.toString(), { lat, lon });
    }
  };

  return (
    <group>
      {/* Main Moon Mesh */}
      <mesh
        geometry={geometry}
        onPointerMove={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <meshBasicMaterial 
          color="#104010" // Dark green
          wireframe={true} 
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Equator Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.2, 0.015, 8, 64]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Equator Longitude Markers */}
      {longitudeMarkers.map((marker, i) => (
        <Billboard key={`lon-${i}`} position={marker.position}>
          <Text fontSize={0.2} color="#00ff00" anchorX="center" anchorY="middle" opacity={0.6} transparent depthOffset={-2} renderOrder={1}>
            {marker.label}
          </Text>
        </Billboard>
      ))}

      {/* North Pole Marker */}
      <Billboard position={[0, 5.4, 0]}>
        <Text fontSize={0.5} color="#00ff00" anchorX="center" anchorY="middle">
          N
        </Text>
      </Billboard>

      {/* South Pole Marker */}
      <Billboard position={[0, -5.4, 0]}>
        <Text fontSize={0.5} color="#00ff00" anchorX="center" anchorY="middle">
          S
        </Text>
      </Billboard>

      {/* Hovered Face Highlight */}
      {highlightGeometry && (
        <mesh geometry={highlightGeometry} material={hatchedMaterial} />
      )}

      {/* Selected Face Marker and Highlight */}
      {selectedData && (
        <group>
          {/* Solid highlighted face */}
          <mesh geometry={selectedData.faceGeo}>
            <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} opacity={0.4} transparent />
          </mesh>
          {/* Fading Walls Extruding Outward */}
          <mesh geometry={selectedData.wallsGeo} material={wallMaterial} />
          
          {/* Hovering Sector ID */}
          <Billboard position={selectedData.center.clone().add(selectedData.normal.clone().multiplyScalar(1.5))}>
            <Text fontSize={0.25} color="#00ff00" anchorX="center" anchorY="middle" opacity={0.9} transparent depthOffset={-2}>
              [{selectedCellId}]
            </Text>
          </Billboard>
        </group>
      )}

      {/* Base solid sphere underneath to catch rays better if needed, or just for visual depth */}
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}
