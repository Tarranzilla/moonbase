'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import Engineers from './Engineers';
import Craters from './Craters';
import Mares from './Mares';
import { LUNAR_CRATERS } from '@/data/craters';
import { LUNAR_MARES } from '@/data/mares';
import Buildings from './Buildings';
import Spaceships from './Spaceships';
import { findShortestPath, getFaceCenter } from '@/utils/geo';

const sunShader = {
  vertexShader: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    void main() {
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    uniform vec3 uSunPosition;
    uniform vec3 uEarthPosition;
    uniform float uSunRadius;
    uniform float uEarthRadius;

    void main() {
      vec3 dirToSun = normalize(uSunPosition - vWorldPosition);
      vec3 dirToEarth = normalize(uEarthPosition - vWorldPosition);
      
      // Calculate angular radius of bodies from this exact pixel
      float distSun = length(uSunPosition - vWorldPosition);
      float distEarth = length(uEarthPosition - vWorldPosition);
      
      float r_sun = asin(uSunRadius / distSun);
      float r_earth = asin(uEarthRadius / distEarth);
      
      // Calculate angular separation between Sun and Earth centers (clamped to prevent NaN)
      float theta = acos(clamp(dot(dirToSun, dirToEarth), -1.0, 1.0));
      
      // Calculate eclipse occlusion (penumbra smoothstep)
      // 1.0 = Fully illuminated, 0.0 = Total eclipse
      float sunVisibility = smoothstep(r_earth - r_sun, r_earth + r_sun, theta);
      
      // Calculate diffuse lighting (facing the sun)
      float light = dot(vWorldNormal, dirToSun);
      
      // Apply physical occlusion
      light = light * sunVisibility;
      
      // Smooth terminator line for illumination (hatch is on the light side)
      float illuminated = smoothstep(-0.1, 0.1, light);
      
      // Cross-hatch pattern on screen coordinates for uniform retro look
      float scale = 0.4;
      float hatch1 = sin((gl_FragCoord.x + gl_FragCoord.y) * scale);
      float hatch2 = sin((gl_FragCoord.x - gl_FragCoord.y) * scale);
      
      // Combine into a strict line pattern (higher threshold = thinner lines)
      float pattern = smoothstep(0.92, 0.98, hatch1) + smoothstep(0.92, 0.98, hatch2);
      pattern = clamp(pattern, 0.0, 1.0);
      
      // Greenish illumination color
      vec3 lightColor = vec3(0.0, 0.15, 0.0);
      
      // Base opacity cut in half again, faint lines
      float alpha = illuminated * (0.05 + pattern * 0.1); 
      
      gl_FragColor = vec4(lightColor, alpha);
    }
  `
};

const earthShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPosition;
    uniform vec3 uSunPosition;

    void main() {
      // Vectors from current point on Earth to Sun and Moon(origin)
      vec3 dirToSun = normalize(uSunPosition - vWorldPosition);
      vec3 dirToMoon = normalize(vec3(0.0) - vWorldPosition);
      
      float distSun = length(uSunPosition - vWorldPosition);
      float distMoon = length(vec3(0.0) - vWorldPosition);
      
      float r_sun = asin(4.5 / distSun); // Sun physical radius = 4.5
      float r_moon = asin(5.0 / distMoon); // Moon physical radius = 5.0
      
      // Angle between Sun and Moon from this pixel (clamped to prevent NaN)
      float theta = acos(clamp(dot(dirToSun, dirToMoon), -1.0, 1.0));
      
      // Calculate eclipse shadow (Moon blocking Sun)
      float sunVisibility = smoothstep(max(0.0, r_moon - r_sun), r_moon + r_sun, theta);
      
      vec3 earthColor = vec3(0.0, 0.66, 1.0); // #00aaff base color
      
      // Apply shadow with 10% ambient brightness so it's never pitch black
      vec3 finalColor = earthColor * (0.1 + 0.9 * sunVisibility);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export default function Moon() {
  const setSelectedCell = useGameStore((state) => state.setSelectedCell);
  const selectedCellId = useGameStore((state) => state.selectedCellId);
  const showEquator = useGameStore((state) => state.filters.showEquator);
  const buildMode = useGameStore((state) => state.buildMode);
  const connectionStartFace = useGameStore((state) => state.connectionStartFace);

  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const sunRef = useRef<THREE.Group>(null);

  // Memoize materials and geometry so they don't recreate on every render
  const moonMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00ff00', wireframe: true }), []);
  
  const shadowMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sunShader.vertexShader,
    fragmentShader: sunShader.fragmentShader,
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(1000, 0, 0) },
      uEarthPosition: { value: new THREE.Vector3(-400, 0, 0) },
      uSunRadius: { value: 4.5 },
      uEarthRadius: { value: 6.6 }
    },
    transparent: true,
    depthWrite: false,
  }), []);

  const earthMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: earthShader.vertexShader,
    fragmentShader: earthShader.fragmentShader,
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(1000, 0, 0) }
    },
    transparent: true,
    depthWrite: false,
    wireframe: true,
  }), []);

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(5, 4);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Update sun direction based on gameTime in useFrame to avoid React state re-renders
  useFrame(() => {
    const gameTime = useGameStore.getState().gameTime;
    
    // 1 lunar day = 28 in-game days
    // 28 days = 28 * 24 * 60 * 60 * 1000 = 2,419,200,000 ms
    const LUNAR_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;
    
    // Calculate rotation angle (theta)
    const theta = ((gameTime % LUNAR_CYCLE_MS) / LUNAR_CYCLE_MS) * Math.PI * 2;
    
    // Calculate 3D position
    const sunPos = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).multiplyScalar(1000);
    const earthPos = new THREE.Vector3(-400, 0, 0);
    
    shadowMaterial.uniforms.uSunPosition.value.copy(sunPos);
    shadowMaterial.uniforms.uEarthPosition.value.copy(earthPos);
    earthMaterial.uniforms.uSunPosition.value.copy(sunPos);
    
    if (sunRef.current) {
      sunRef.current.position.copy(sunPos);
    }
  });

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

  const isBuildingMode = buildMode !== 'NONE' && buildMode !== 'DECONSTRUCT';

  useEffect(() => {
    const colorHex = isBuildingMode ? "#eab308" : "#00ff00";
    hatchedMaterial.uniforms.color.value.set(colorHex);
    wallMaterial.uniforms.color.value.set(colorHex);
  }, [isBuildingMode, hatchedMaterial, wallMaterial]);

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

  const pathPreviewGeometry = useMemo(() => {
    if (buildMode !== 'CONNECTION' || connectionStartFace === null || hoveredFace === null) return null;
    if (connectionStartFace === hoveredFace) return null;

    const path = findShortestPath(connectionStartFace, hoveredFace);
    if (!path || path.length < 2) return null;

    const points: THREE.Vector3[] = [];
    path.forEach(faceIndex => {
      const center = getFaceCenter(faceIndex, 5.05); // slightly above surface
      if (center) points.push(center);
    });

    // Create a tube or line geometry for the path preview
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.03, 4, false);
    return tubeGeo;
  }, [buildMode, connectionStartFace, hoveredFace]);

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

      const state = useGameStore.getState();
      
      if (state.buildMode !== 'NONE' && state.selectedTeamId) {
        if (state.buildMode === 'CONNECTION') {
          if (state.connectionStartFace === null) {
            // First click
            state.setConnectionStartFace(e.faceIndex);
          } else {
            // Second click: create connection job(s)
            const path = findShortestPath(state.connectionStartFace, e.faceIndex);
            if (path && path.length > 1) {
              const pendingJobs: { f1: number, f2: number }[] = [];
              state.teams.forEach(t => {
                const jobs = [t.buildJob, ...(t.jobQueue || [])];
                jobs.forEach(j => {
                  if (j && j.type === 'CONNECTION' && j.secondaryFaceIndex !== undefined) {
                     pendingJobs.push({ f1: j.targetFaceIndex, f2: j.secondaryFaceIndex });
                  }
                });
              });

              for (let i = 0; i < path.length - 1; i++) {
                const f1 = path[i];
                const f2 = path[i+1];
                
                const alreadyBuilt = state.connections.some(c => 
                  (c.fromFaceIndex === f1 && c.toFaceIndex === f2) ||
                  (c.fromFaceIndex === f2 && c.toFaceIndex === f1)
                );
                const alreadyQueued = pendingJobs.some(j => 
                  (j.f1 === f1 && j.f2 === f2) ||
                  (j.f1 === f2 && j.f2 === f1)
                );

                if (!alreadyBuilt && !alreadyQueued) {
                  state.queueBuildJob(state.selectedTeamId, {
                    type: 'CONNECTION',
                    targetFaceIndex: f1,
                    secondaryFaceIndex: f2
                  });
                }
              }
            }
            // Keep connection mode active and update start face to the end of the new path
            // This allows sequential placement!
            state.setConnectionStartFace(e.faceIndex);
          }
        } else {
          // Normal building or deconstruct
          state.queueBuildJob(state.selectedTeamId, {
            type: state.buildMode,
            targetFaceIndex: e.faceIndex
          });
          if (!e.shiftKey) {
            state.setBuildMode('NONE'); // Reset mode after placing
          }
        }
      } else {
        setSelectedCell(e.faceIndex.toString(), { lat, lon });
      }
    }
  };

  return (
    <group>
      <Buildings hoveredFace={hoveredFace} />
      <Spaceships />
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

      {showEquator && (
        <group>
          {/* Equator Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[5.2, 0.015, 8, 64]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.2} depthWrite={false} />
          </mesh>

          {/* Longitude Markers */}
          {longitudeMarkers.map((marker, i) => (
            <Billboard key={`lon-${i}`} position={marker.position}>
              <Text position={[0, -0.2, 0]} fontSize={0.15} color="#00ff00" anchorX="center" anchorY="top" fillOpacity={0.8} depthOffset={-10}>
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
        </group>
      )}

      {/* Hovered Face Highlight */}
      {highlightGeometry && (
        <mesh geometry={highlightGeometry} material={hatchedMaterial} />
      )}

      {/* Connection Path Preview */}
      {pathPreviewGeometry && (
        <mesh geometry={pathPreviewGeometry}>
          <meshBasicMaterial color="#eab308" opacity={0.6} transparent />
        </mesh>
      )}

      {/* Selected Face Marker and Highlight */}
      {selectedData && (
        <group>
          {/* Solid highlighted face */}
          <mesh geometry={selectedData.faceGeo}>
            <meshBasicMaterial color={isBuildingMode ? "#eab308" : "#00ff00"} side={THREE.DoubleSide} opacity={0.4} transparent />
          </mesh>
          {/* Fading Walls Extruding Outward */}
          <mesh geometry={selectedData.wallsGeo} material={wallMaterial} />
          
          {/* Hovering Sector ID */}
          <Billboard position={selectedData.center.clone().add(selectedData.normal.clone().multiplyScalar(1.5))}>
            <Text fontSize={0.25} color={isBuildingMode ? "#eab308" : "#00ff00"} anchorX="center" anchorY="middle" fillOpacity={0.9} depthOffset={-2}>
              [{selectedCellId}]
            </Text>
          </Billboard>
        </group>
      )}

      {/* Base solid sphere underneath for visual depth */}
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Illumination overlay representing the lit side of the moon */}
      <mesh geometry={geometry} material={shadowMaterial} scale={1.002} />

      {/* The Distant Sun Marker */}
      <group ref={sunRef}>
        <mesh>
          <icosahedronGeometry args={[4.5, 3]} />
          <meshBasicMaterial color="#00ff00" wireframe />
        </mesh>
        <Billboard>
          <Text position={[0, 12.0, 0]} fontSize={8.75} color="#00ff00" anchorX="center" anchorY="bottom" fillOpacity={0.9}>
            SUN
          </Text>
        </Billboard>
      </group>

      {/* Distant Earth Marker - Stationary due to tidal locking */}
      <group position={[-400, 0, 0]}>
        <mesh material={earthMaterial}>
          <icosahedronGeometry args={[6.6, 3]} />
        </mesh>
        <Billboard>
          <Text position={[0, 8.0, 0]} fontSize={3.5} color="#00aaff" anchorX="center" anchorY="bottom" fillOpacity={0.9}>
            EARTH
          </Text>
        </Billboard>
      </group>

      <Craters />
      <Mares />
      <Engineers geometry={geometry} />
    </group>
  );
}
