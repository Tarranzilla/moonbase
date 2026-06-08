import * as THREE from 'three';

let adjacencyGraph: Map<number, number[]> | null = null;

export function buildAdjacencyGraph(geometry: THREE.BufferGeometry) {
  if (adjacencyGraph) return adjacencyGraph;

  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const faceCount = index ? index.count / 3 : position.count / 3;

  adjacencyGraph = new Map<number, number[]>();

  // Map each edge to the faces that share it
  // Edge key will be a string combining the spatial hash of its two vertices
  const edgeToFaces = new Map<string, number[]>();

  // Helper to hash vertex positions so we can find shared vertices even without an index
  const getVertexHash = (idx: number) => {
    const x = position.getX(idx).toFixed(4);
    const y = position.getY(idx).toFixed(4);
    const z = position.getZ(idx).toFixed(4);
    return `${x},${y},${z}`;
  };

  for (let f = 0; f < faceCount; f++) {
    let a, b, c;
    if (index) {
      a = index.getX(f * 3);
      b = index.getX(f * 3 + 1);
      c = index.getX(f * 3 + 2);
    } else {
      a = f * 3;
      b = f * 3 + 1;
      c = f * 3 + 2;
    }

    const hashA = getVertexHash(a);
    const hashB = getVertexHash(b);
    const hashC = getVertexHash(c);

    const edges = [
      [hashA, hashB].sort().join('|'),
      [hashB, hashC].sort().join('|'),
      [hashC, hashA].sort().join('|')
    ];

    edges.forEach(edge => {
      if (!edgeToFaces.has(edge)) {
        edgeToFaces.set(edge, []);
      }
      edgeToFaces.get(edge)!.push(f);
    });

    adjacencyGraph.set(f, []);
  }

  // Populate adjacency graph
  edgeToFaces.forEach((faces) => {
    // In a closed manifold like an Icosahedron, exactly 2 faces share an edge
    if (faces.length === 2) {
      const [f1, f2] = faces;
      adjacencyGraph!.get(f1)!.push(f2);
      adjacencyGraph!.get(f2)!.push(f1);
    }
  });

  return adjacencyGraph;
}

export function findShortestPath(startFace: number, endFace: number, graph: Map<number, number[]>): number[] {
  if (startFace === endFace) return [];

  const queue: { face: number, path: number[] }[] = [{ face: startFace, path: [] }];
  const visited = new Set<number>([startFace]);

  while (queue.length > 0) {
    const { face, path } = queue.shift()!;
    const neighbors = graph.get(face) || [];

    for (const neighbor of neighbors) {
      if (neighbor === endFace) {
        return [...path, neighbor];
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ face: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return []; // No path found
}
