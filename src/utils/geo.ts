import * as THREE from 'three';

// 1 unit in Three.js = 1000 km in real life (Moon radius is 1737km, simulated as 5.0 units)
export const SIM_MOON_RADIUS = 5.0;
export const REAL_MOON_RADIUS_KM = 1737.4;
export const RADIUS_RATIO = SIM_MOON_RADIUS / REAL_MOON_RADIUS_KM;

export function coordToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = lat * (Math.PI / 180);
  const theta = lon * (Math.PI / 180);

  return new THREE.Vector3(
    radius * Math.sin(theta) * Math.cos(phi),
    radius * Math.sin(phi),
    radius * Math.cos(theta) * Math.cos(phi)
  );
}

export function vector3ToCoord(vec: THREE.Vector3): { lat: number; lon: number } {
  const radius = vec.length();
  const phi = Math.asin(vec.y / radius);
  const theta = Math.atan2(vec.x, vec.z);
  return {
    lat: phi * (180 / Math.PI),
    lon: theta * (180 / Math.PI)
  };
}

// Cached geometry for looking up cell coordinates without needing the React component
let cachedIcosahedron: THREE.IcosahedronGeometry | null = null;

export function getFaceCenter(faceIndex: number, radius: number = SIM_MOON_RADIUS): THREE.Vector3 | null {
  if (!cachedIcosahedron) {
    cachedIcosahedron = new THREE.IcosahedronGeometry(radius, 4);
    cachedIcosahedron.computeVertexNormals();
  }

  const positionAttribute = cachedIcosahedron.getAttribute('position');
  if (!positionAttribute || faceIndex < 0 || faceIndex >= positionAttribute.count / 3) {
    return null;
  }

  const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, faceIndex * 3);
  const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, faceIndex * 3 + 1);
  const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, faceIndex * 3 + 2);

  const center = new THREE.Vector3()
    .addVectors(vA, vB)
    .add(vC)
    .divideScalar(3);

  return center;
}
