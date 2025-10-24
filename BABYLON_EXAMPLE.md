# Using the GLB in Babylon.js

This guide shows how to load the apartment GLB file and interact with individual meshes using their metadata.

## Basic Loading Example

```typescript
import { SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

// Load the GLB file
const apartmentId = '3c3b1d6ca8b4b9092480b8c75f9eaa81';
const glbUrl = `http://localhost:8000/apartment/${apartmentId}/glb`;

SceneLoader.ImportMesh('', glbUrl, '', scene, (meshes) => {
  console.log(`Loaded ${meshes.length} meshes`);

  // Each mesh has a unique name and metadata
  meshes.forEach((mesh) => {
    console.log(`Mesh: ${mesh.name}`);
    console.log('Metadata:', mesh.metadata);
  });
});
```

## Interactive Selection with Metadata Display

```typescript
import { Scene, Mesh, PointerEventTypes } from '@babylonjs/core';

// Setup pointer click handler
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
    const pickedMesh = pointerInfo.pickInfo?.pickedMesh;

    if (pickedMesh && pickedMesh.metadata) {
      const metadata = pickedMesh.metadata;

      // Display room information
      displayRoomInfo({
        name: pickedMesh.name,
        type: metadata.entity_type,
        subtype: metadata.entity_subtype,
        roomType: metadata.roomtype,
        zoning: metadata.zoning,
        areaId: metadata.area_id,
        unitId: metadata.unit_id,
        elevation: metadata.elevation,
        height: metadata.height
      });

      // Highlight selected mesh
      highlightMesh(pickedMesh);
    }
  }
});

function displayRoomInfo(info: any) {
  // Update your UI with room information
  document.getElementById('room-info').innerHTML = `
    <h3>${info.roomType || info.subtype}</h3>
    <p>Type: ${info.type}</p>
    <p>Subtype: ${info.subtype}</p>
    <p>Zone: ${info.zoning}</p>
    <p>Area ID: ${info.areaId}</p>
    <p>Unit ID: ${info.unitId}</p>
    <p>Elevation: ${info.elevation}m</p>
    <p>Height: ${info.height}m</p>
  `;
}

function highlightMesh(mesh: Mesh) {
  // Add a highlight layer or change material
  // Example: Add glow effect
  const hl = new HighlightLayer('hl', scene);
  hl.addMesh(mesh, Color3.Yellow());
}
```

## Filter by Type

```typescript
// Get all areas (rooms)
const areas = scene.meshes.filter(mesh =>
  mesh.metadata?.entity_type === 'area'
);

// Get all walls
const walls = scene.meshes.filter(mesh =>
  mesh.metadata?.entity_subtype === 'WALL'
);

// Get all doors
const doors = scene.meshes.filter(mesh =>
  mesh.metadata?.entity_subtype === 'DOOR'
);

// Hide walls to see inside
walls.forEach(wall => wall.setEnabled(false));
```

## Room-based Interaction

```typescript
// Find specific room by type
const bathroom = scene.meshes.find(mesh =>
  mesh.metadata?.entity_subtype === 'BATHROOM'
);

if (bathroom) {
  // Focus camera on bathroom
  camera.setTarget(bathroom.position);

  // Get bathroom metadata
  console.log('Bathroom area ID:', bathroom.metadata.area_id);
  console.log('Bathroom coordinates:', bathroom.metadata.coordinates);
}

// Get all bedrooms
const bedrooms = scene.meshes.filter(mesh =>
  mesh.metadata?.entity_subtype === 'ROOM' ||
  mesh.metadata?.entity_subtype === 'BEDROOM'
);

console.log(`Found ${bedrooms.length} bedrooms`);
```

## Mesh Naming Convention

Meshes follow this naming pattern:
- **Areas**: `area_{index}_{SUBTYPE}_{area_id}`
  - Example: `area_0_BATHROOM_619311.0`
- **Separators**: `separator_{index}_{SUBTYPE}_{counter}`
  - Example: `separator_1_WALL_8`
- **Openings**: `opening_{index}_{SUBTYPE}_{counter}`
  - Example: `opening_3_DOOR_15`

## Available Metadata Fields

Each mesh contains the following metadata:
- `entity_type`: "area", "separator", or "opening"
- `entity_subtype`: "BATHROOM", "LIVING_ROOM", "KITCHEN", "WALL", "DOOR", "WINDOW", etc.
- `roomtype`: Human-readable name (e.g., "Bathroom", "Kitchen")
- `zoning`: Zone classification (e.g., "Zone1", "Zone2", "Zone3")
- `elevation`: Base Z coordinate (meters)
- `height`: Extrusion height (meters)
- `area_id`: Unique area identifier (number or null)
- `unit_id`: Unit identifier (number or null)
- `coordinates`: Array of [x, y] coordinate pairs defining the polygon

## Tips

1. **Use metadata for filtering** instead of parsing mesh names
2. **Store original coordinates** for 2D floor plan overlays
3. **Group meshes by zone** for zone-based highlighting
4. **Calculate room area** using the coordinates array
5. **Implement room-to-room navigation** using area_id relationships
