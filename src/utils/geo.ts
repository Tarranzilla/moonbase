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

let cachedAdjacency: Map<number, number[]> | null = null;

function buildAdjacencyGraph(): Map<number, number[]> {
  if (!cachedIcosahedron) {
    cachedIcosahedron = new THREE.IcosahedronGeometry(SIM_MOON_RADIUS, 4);
    cachedIcosahedron.computeVertexNormals();
  }
  const pos = cachedIcosahedron.getAttribute('position');
  const faces = pos.count / 3;
  
  const edgeToFaces = new Map<string, number[]>();
  
  const roundVec = (v: THREE.Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  const edgeKey = (v1: THREE.Vector3, v2: THREE.Vector3) => {
    const s1 = roundVec(v1);
    const s2 = roundVec(v2);
    return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  };

  for (let i = 0; i < faces; i++) {
    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i * 3);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 1);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 2);
    
    const e1 = edgeKey(v0, v1);
    const e2 = edgeKey(v1, v2);
    const e3 = edgeKey(v2, v0);
    
    [e1, e2, e3].forEach(e => {
      if (!edgeToFaces.has(e)) edgeToFaces.set(e, []);
      edgeToFaces.get(e)!.push(i);
    });
  }

  const adjacency = new Map<number, number[]>();
  for (let i = 0; i < faces; i++) adjacency.set(i, []);

  edgeToFaces.forEach(faceList => {
    // faceList contains the face indices sharing this edge
    // for an icosahedron, edges are shared by exactly 2 faces
    if (faceList.length === 2) {
      const f1 = faceList[0];
      const f2 = faceList[1];
      adjacency.get(f1)!.push(f2);
      adjacency.get(f2)!.push(f1);
    }
  });

  return adjacency;
}

export function getAdjacentFaces(faceIndex: number): number[] {
  if (!cachedAdjacency) cachedAdjacency = buildAdjacencyGraph();
  return cachedAdjacency.get(faceIndex) || [];
}

export function findShortestPath(startFace: number, endFace: number): number[] | null {
  if (startFace === endFace) return [startFace];
  const adjacency = cachedAdjacency || (cachedAdjacency = buildAdjacencyGraph());
  
  const queue = [[startFace]];
  const visited = new Set<number>();
  visited.add(startFace);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    
    if (current === endFace) return path;

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}
