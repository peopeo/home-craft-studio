import { Vector3, Mesh, Scene, VertexData, Color3, MeshBuilder } from '@babylonjs/core';
import earcut from 'earcut';

export interface PolygonData {
  coordinates: number[][];
  elevation: number;
  height: number;
  type: string;
  id?: number;
  roomtype?: string;
  zoning?: string;
}

/**
 * Creates a 2D flat polygon mesh (for Plan view)
 */
export function create2DPolygon(
  name: string,
  data: PolygonData,
  scene: Scene,
  zOffset: number = 0
): Mesh {
  const { coordinates } = data;

  if (!coordinates || coordinates.length < 3) {
    console.warn(`Invalid polygon data for ${name}`);
    return new Mesh(name, scene);
  }

  // Flatten coordinates for earcut
  const flatCoords: number[] = [];
  coordinates.forEach(([x, y]) => {
    flatCoords.push(x, y);
  });

  // Triangulate
  const triangles = earcut(flatCoords);

  // Build mesh data - use zOffset to layer elements in 2D view
  const positions: number[] = [];
  coordinates.forEach(([x, y]) => {
    positions.push(x, y, zOffset);
  });

  // Create mesh
  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = triangles;

  // Calculate normals pointing up (Z+)
  const normals: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    normals.push(0, 0, 1); // All normals point up
  }
  vertexData.normals = normals;

  vertexData.applyToMesh(mesh);

  // Make the mesh double-sided so it's visible from both top and bottom
  mesh.sideOrientation = Mesh.DOUBLESIDE;

  return mesh;
}

/**
 * Creates an extruded 3D polygon mesh (for Perspective/Isometric view)
 */
export function create3DExtrudedPolygon(
  name: string,
  data: PolygonData,
  scene: Scene
): Mesh {
  const { coordinates, elevation, height } = data;

  if (!coordinates || coordinates.length < 3) {
    console.warn(`Invalid polygon data for ${name}`);
    return new Mesh(name, scene);
  }

  // Create a simple extruded box manually to avoid rotation issues
  // Build the geometry directly in Z-up orientation

  // Flatten coordinates for triangulation
  const flatCoords: number[] = [];
  coordinates.forEach(([x, y]) => {
    flatCoords.push(x, y);
  });

  // Triangulate the base polygon
  const triangles = earcut(flatCoords);

  // Create vertex positions for both top and bottom faces
  const positions: number[] = [];
  const indices: number[] = [];

  const numVertices = coordinates.length;

  // Bottom face vertices (at elevation)
  coordinates.forEach(([x, y]) => {
    positions.push(x, y, elevation);
  });

  // Top face vertices (at elevation + height)
  coordinates.forEach(([x, y]) => {
    positions.push(x, y, elevation + height);
  });

  // Bottom face indices (reverse winding for correct normal)
  for (let i = triangles.length - 1; i >= 0; i--) {
    indices.push(triangles[i]);
  }

  // Top face indices (offset by numVertices)
  for (let i = 0; i < triangles.length; i++) {
    indices.push(triangles[i] + numVertices);
  }

  // Side faces (walls)
  for (let i = 0; i < numVertices; i++) {
    const next = (i + 1) % numVertices;

    // Two triangles per side face
    // Triangle 1: bottom-i, bottom-next, top-i
    indices.push(i, next, i + numVertices);

    // Triangle 2: bottom-next, top-next, top-i
    indices.push(next, next + numVertices, i + numVertices);
  }

  // Create the mesh
  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;

  // Compute normals automatically
  VertexData.ComputeNormals(positions, indices, vertexData.normals = []);

  vertexData.applyToMesh(mesh);

  // Make double-sided
  mesh.sideOrientation = Mesh.DOUBLESIDE;

  return mesh;
}

/**
 * Gets color based on room/element type
 */
export function getColorForType(type: string): Color3 {
  const colorMap: { [key: string]: Color3 } = {
    // Areas (rooms)
    'BATHROOM': new Color3(0.7, 0.85, 1),      // Light blue
    'LIVING_ROOM': new Color3(1, 1, 0.7),      // Light yellow
    'KITCHEN': new Color3(1, 0.8, 0.8),        // Light red
    'ROOM': new Color3(0.8, 1, 0.8),           // Light green (bedroom)
    'BEDROOM': new Color3(0.8, 1, 0.8),        // Light green
    'BALCONY': new Color3(0.9, 0.85, 1),       // Light purple
    'CORRIDOR': new Color3(0.9, 0.9, 0.9),     // Light gray
    'LOGGIA': new Color3(0.85, 0.9, 1),        // Light cyan
    'STOREROOM': new Color3(0.95, 0.9, 0.85),  // Beige

    // Separators
    'WALL': new Color3(0.3, 0.3, 0.3),         // Dark gray

    // Openings
    'DOOR': new Color3(0.6, 0.4, 0.2),         // Brown
    'ENTRANCE_DOOR': new Color3(0.5, 0.3, 0.1), // Dark brown
    'WINDOW': new Color3(1, 1, 1),             // White
  };

  return colorMap[type] || new Color3(0.8, 0.8, 0.8);
}

/**
 * Gets alpha (transparency) based on element type
 */
export function getAlphaForType(type: string): number {
  if (type === 'WINDOW') return 0.8; // 80% opaque
  return 1.0;
}
