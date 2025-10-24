import { useState, useCallback, useRef } from 'react';
import { Scene, AbstractMesh, PointerEventTypes, HighlightLayer, Color3, Vector3, MeshBuilder, StandardMaterial, TransformNode, GizmoManager, UtilityLayerRenderer, AxesViewer, Camera, Mesh } from '@babylonjs/core';
import { BabylonScene } from './BabylonScene';
import { create2DPolygon, create3DExtrudedPolygon, getColorForType, getAlphaForType } from '../utils/polygonExtrusion';
import type { PolygonData } from '../utils/polygonExtrusion';

const API_BASE_URL = 'http://localhost:8000';

type ViewMode = 'plan' | 'perspective' | 'isometric';

interface ApartmentPolygonData {
  apartment_id: string;
  areas: PolygonData[];
  separators: PolygonData[];
  openings: PolygonData[];
}

interface MeshMetadata {
  entity_type: string;
  entity_subtype: string;
  roomtype: string;
  zoning: string;
  elevation: number;
  height: number;
  area_id: number | null;
  unit_id: number | null;
  coordinates: number[][];
}

interface SelectedMeshInfo {
  name: string;
  metadata: MeshMetadata;
}

interface ApartmentViewerProps {
  apartmentId: string;
}

export const ApartmentViewer: React.FC<ApartmentViewerProps> = ({ apartmentId }) => {
  const [selectedMesh, setSelectedMesh] = useState<SelectedMeshInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWalls, setShowWalls] = useState(true);
  const [showDoors, setShowDoors] = useState(true);
  const [showWindows, setShowWindows] = useState(true);
  const [showGizmo, setShowGizmo] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('plan');

  const sceneRef = useRef<Scene | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const apartmentRootRef = useRef<TransformNode | null>(null);
  const axesViewerRef = useRef<AxesViewer | null>(null);
  const polygonDataRef = useRef<ApartmentPolygonData | null>(null);

  // Camera view presets for Z-up coordinate system (right-hand rule)
  // X = right, Y = forward, Z = up (extrusion direction)
  const setCameraView = useCallback((view: 'top' | 'front' | 'left' | 'right' | 'bottom' | 'isometric') => {
    if (!sceneRef.current?.activeCamera) return;

    const camera = sceneRef.current.activeCamera as any;
    const radius = camera.radius || 20;

    switch (view) {
      case 'top':
        // Looking down the Z-axis (top view of floor plan)
        camera.alpha = -Math.PI / 2;
        camera.beta = 0.1; // Almost 0 but not exactly (to avoid gimbal lock)
        camera.radius = radius;
        break;
      case 'bottom':
        // Looking up the Z-axis
        camera.alpha = -Math.PI / 2;
        camera.beta = Math.PI - 0.1; // Almost π
        camera.radius = radius;
        break;
      case 'front':
        // Looking along -Y axis (front view)
        camera.alpha = -Math.PI / 2;
        camera.beta = Math.PI / 2; // Horizontal
        camera.radius = radius;
        break;
      case 'left':
        // Looking along +X axis (from left side)
        camera.alpha = Math.PI;
        camera.beta = Math.PI / 2; // Horizontal
        camera.radius = radius;
        break;
      case 'right':
        // Looking along -X axis (from right side)
        camera.alpha = 0;
        camera.beta = Math.PI / 2; // Horizontal
        camera.radius = radius;
        break;
      case 'isometric':
        // Nice 3D view at an angle
        camera.alpha = -Math.PI / 4;
        camera.beta = Math.PI / 3;
        camera.radius = radius;
        break;
    }
  }, []);

  // Render apartment meshes based on view mode
  const renderApartment = useCallback((
    scene: Scene,
    polygonData: ApartmentPolygonData,
    mode: ViewMode
  ): Mesh[] => {
    const meshes: Mesh[] = [];
    const is3D = mode === 'perspective' || mode === 'isometric';

    // Render areas (rooms)
    polygonData.areas.forEach((area, idx) => {
      const meshName = `area_${idx}_${area.type}_${area.id || idx}`;
      const mesh = is3D
        ? create3DExtrudedPolygon(meshName, area, scene)
        : create2DPolygon(meshName, area, scene, 0); // Base level

      // Apply material
      const material = new StandardMaterial(`${meshName}_mat`, scene);
      material.diffuseColor = getColorForType(area.type);
      material.alpha = getAlphaForType(area.type);
      material.backFaceCulling = false; // Render both sides

      // Add emissive color for better visibility (self-illuminating)
      material.emissiveColor = getColorForType(area.type).scale(0.5); // 50% brightness

      mesh.material = material;

      // Attach metadata for selection
      mesh.metadata = {
        entity_type: 'area',
        entity_subtype: area.type,
        roomtype: area.roomtype || area.type,
        zoning: area.zoning || '',
        elevation: area.elevation,
        height: area.height,
        area_id: area.id || null,
        unit_id: null,
        coordinates: area.coordinates,
      };

      meshes.push(mesh);
    });

    // Render separators (walls)
    polygonData.separators.forEach((separator, idx) => {
      const meshName = `separator_${idx}_${separator.type}_${idx}`;
      const mesh = is3D
        ? create3DExtrudedPolygon(meshName, separator, scene)
        : create2DPolygon(meshName, separator, scene, 0.001); // Slightly above areas

      // Apply material
      const material = new StandardMaterial(`${meshName}_mat`, scene);
      material.diffuseColor = getColorForType(separator.type);
      material.alpha = getAlphaForType(separator.type);
      material.backFaceCulling = false; // Render both sides

      // Add emissive color for better visibility (self-illuminating)
      material.emissiveColor = getColorForType(separator.type).scale(0.5); // 50% brightness

      mesh.material = material;

      // Attach metadata for selection
      mesh.metadata = {
        entity_type: 'separator',
        entity_subtype: separator.type,
        roomtype: '',
        zoning: '',
        elevation: separator.elevation,
        height: separator.height,
        area_id: null,
        unit_id: null,
        coordinates: separator.coordinates,
      };

      meshes.push(mesh);
    });

    // Render openings (doors, windows)
    polygonData.openings.forEach((opening, idx) => {
      const meshName = `opening_${idx}_${opening.type}_${idx}`;
      const mesh = is3D
        ? create3DExtrudedPolygon(meshName, opening, scene)
        : create2DPolygon(meshName, opening, scene, 0.002); // Highest - easiest to select

      // Apply material
      const material = new StandardMaterial(`${meshName}_mat`, scene);
      material.diffuseColor = getColorForType(opening.type);
      material.alpha = getAlphaForType(opening.type);
      material.backFaceCulling = false; // Render both sides

      // Make openings more visible with emissive colors
      if (opening.type === 'WINDOW') {
        material.emissiveColor = new Color3(1, 1, 1); // Self-illuminating white
      } else if (opening.type === 'DOOR') {
        material.emissiveColor = new Color3(0.6, 0.4, 0.2); // Self-illuminating brown
      } else if (opening.type === 'ENTRANCE_DOOR') {
        material.emissiveColor = new Color3(0.5, 0.3, 0.1); // Self-illuminating dark brown
      }

      mesh.material = material;

      // Attach metadata for selection
      mesh.metadata = {
        entity_type: 'opening',
        entity_subtype: opening.type,
        roomtype: '',
        zoning: '',
        elevation: opening.elevation,
        height: opening.height,
        area_id: null,
        unit_id: null,
        coordinates: opening.coordinates,
      };

      meshes.push(mesh);
    });

    return meshes;
  }, []);

  const onSceneReady = useCallback(async (scene: Scene) => {
    // Check if scene is already disposed (happens in React StrictMode)
    if (scene.isDisposed) {
      console.log('Scene already disposed, skipping setup');
      return;
    }

    sceneRef.current = scene;
    highlightLayerRef.current = new HighlightLayer('hl', scene);

    // Load polygon data from backend
    try {
      setLoading(true);
      setError(null);

      // Fetch polygon data
      const response = await fetch(`${API_BASE_URL}/apartment/${apartmentId}/polygons`);
      if (!response.ok) {
        throw new Error(`Failed to fetch polygon data: ${response.statusText}`);
      }

      const polygonData: ApartmentPolygonData = await response.json();
      polygonDataRef.current = polygonData;

      // Check if scene was disposed during loading
      if (scene.isDisposed) {
        console.log('Scene disposed during loading');
        return;
      }

      console.log(`Loaded polygon data: ${polygonData.areas.length} areas, ${polygonData.separators.length} separators, ${polygonData.openings.length} openings`);

      // Render meshes based on current view mode
      const meshes = renderApartment(scene, polygonData, viewMode);

      // Check if scene was disposed during rendering
      if (scene.isDisposed) {
        console.log('Scene disposed during rendering');
        return;
      }

      console.log(`Rendered ${meshes.length} meshes`);

      // Transform apartment: center at origin, ground at Z=0, align with axes
      if (meshes.length > 0) {
        // Filter out root/transform nodes, only consider actual meshes
        const actualMeshes = meshes.filter(m => m.getTotalVertices() > 0);

        if (actualMeshes.length > 0) {
          // Create a parent transform node for all meshes
          const apartmentRoot = new TransformNode('apartmentRoot', scene);

          // Parent all loaded meshes to the transform node
          meshes.forEach(mesh => {
            mesh.parent = apartmentRoot;
          });

          // Force initial matrix computation
          apartmentRoot.computeWorldMatrix(true);
          actualMeshes.forEach(m => m.computeWorldMatrix(true));

          // Step 1: Calculate initial bounding box in world coordinates
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;

          actualMeshes.forEach(mesh => {
            const positions = mesh.getVerticesData('position');
            if (positions) {
              for (let i = 0; i < positions.length; i += 3) {
                const worldPos = Vector3.TransformCoordinates(
                  new Vector3(positions[i], positions[i + 1], positions[i + 2]),
                  mesh.getWorldMatrix()
                );
                minX = Math.min(minX, worldPos.x);
                maxX = Math.max(maxX, worldPos.x);
                minY = Math.min(minY, worldPos.y);
                maxY = Math.max(maxY, worldPos.y);
                minZ = Math.min(minZ, worldPos.z);
                maxZ = Math.max(maxZ, worldPos.z);
              }
            }
          });

          const sizeX = maxX - minX;
          const sizeY = maxY - minY;

          console.log(`Initial bounding box: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}] (${sizeX.toFixed(2)}), Y[${minY.toFixed(2)}, ${maxY.toFixed(2)}] (${sizeY.toFixed(2)}), Z[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);

          // Step 2: Determine rotation needed by analyzing wall orientations
          // Find dominant wall direction and align it with grid axes
          let rotationAngle = 0;

          if (polygonData.separators && polygonData.separators.length > 0) {
            const angles: number[] = [];

            // Analyze all wall segments
            polygonData.separators.forEach(separator => {
              const coords = separator.coordinates;
              if (coords && coords.length >= 2) {
                // For each wall, calculate the angle of its longest edge
                for (let i = 0; i < coords.length - 1; i++) {
                  const [x1, y1] = coords[i];
                  const [x2, y2] = coords[i + 1];
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const length = Math.sqrt(dx * dx + dy * dy);

                  // Only consider edges longer than 0.1 units
                  if (length > 0.1) {
                    const angle = Math.atan2(dy, dx);
                    angles.push(angle);
                  }
                }
              }
            });

            if (angles.length > 0) {
              // Normalize angles to [0, π/2] by taking absolute values and modulo π/2
              // This groups angles that are 90° apart (perpendicular walls)
              const normalizedAngles = angles.map(a => {
                let normalized = Math.abs(a) % (Math.PI / 2);
                return normalized;
              });

              // Find the median angle (more robust than mean for this use case)
              normalizedAngles.sort((a, b) => a - b);
              const medianAngle = normalizedAngles[Math.floor(normalizedAngles.length / 2)];

              // Determine rotation: snap to 0°, 45°, or 90° based on median
              if (medianAngle < Math.PI / 8) {
                // Walls are mostly horizontal/vertical, no rotation needed
                rotationAngle = 0;
                console.log(`Walls already aligned with grid (median angle: ${(medianAngle * 180 / Math.PI).toFixed(1)}°)`);
              } else if (medianAngle > 3 * Math.PI / 8) {
                // Walls are close to 90°, rotate by the angle to straighten
                rotationAngle = Math.PI / 2 - medianAngle;
                console.log(`Rotating ${(rotationAngle * 180 / Math.PI).toFixed(1)}° to align walls with grid (median angle was: ${(medianAngle * 180 / Math.PI).toFixed(1)}°)`);
              } else {
                // Walls are at an angle, rotate to align
                rotationAngle = -medianAngle;
                console.log(`Rotating ${(rotationAngle * 180 / Math.PI).toFixed(1)}° to align walls with grid (median angle was: ${(medianAngle * 180 / Math.PI).toFixed(1)}°)`);
              }
            } else {
              console.log('No wall angles found, using bounding box method');
              // Fallback to bounding box method
              if (sizeY > sizeX) {
                rotationAngle = Math.PI / 2;
              }
            }
          } else {
            console.log('No separators found, using bounding box method');
            // Fallback to bounding box method
            if (sizeY > sizeX) {
              rotationAngle = Math.PI / 2;
            }
          }

          // Step 3: Apply rotation around the object's center
          apartmentRoot.rotation.z = rotationAngle;
          apartmentRoot.computeWorldMatrix(true);
          actualMeshes.forEach(m => m.computeWorldMatrix(true));

          // Step 4: Recalculate center after rotation
          minX = Infinity; maxX = -Infinity;
          minY = Infinity; maxY = -Infinity;
          minZ = Infinity; maxZ = -Infinity;

          actualMeshes.forEach(mesh => {
            const positions = mesh.getVerticesData('position');
            if (positions) {
              for (let i = 0; i < positions.length; i += 3) {
                const worldPos = Vector3.TransformCoordinates(
                  new Vector3(positions[i], positions[i + 1], positions[i + 2]),
                  mesh.getWorldMatrix()
                );
                minX = Math.min(minX, worldPos.x);
                maxX = Math.max(maxX, worldPos.x);
                minY = Math.min(minY, worldPos.y);
                maxY = Math.max(maxY, worldPos.y);
                minZ = Math.min(minZ, worldPos.z);
                maxZ = Math.max(maxZ, worldPos.z);
              }
            }
          });

          const newCenterX = (minX + maxX) / 2;
          const newCenterY = (minY + maxY) / 2;
          const newGroundZ = minZ;

          // Step 5: Translate to origin (center at 0,0 and ground slightly above grid)
          apartmentRoot.position.x = -newCenterX;
          apartmentRoot.position.y = -newCenterY;
          apartmentRoot.position.z = -newGroundZ + 0.01; // +0.01 to sit above grid at Z=-0.01

          console.log(`Moved to origin: translation (${apartmentRoot.position.x.toFixed(2)}, ${apartmentRoot.position.y.toFixed(2)}, ${apartmentRoot.position.z.toFixed(2)})`);

          // Force final matrix update
          apartmentRoot.computeWorldMatrix(true);
          meshes.forEach(mesh => mesh.computeWorldMatrix(true));

          // Store apartment root for gizmo attachment
          apartmentRootRef.current = apartmentRoot;

          // Create gizmo manager
          const utilLayer = UtilityLayerRenderer.DefaultUtilityLayer;
          const gizmoManager = new GizmoManager(scene, 1, utilLayer);
          gizmoManager.positionGizmoEnabled = false;
          gizmoManager.rotationGizmoEnabled = false;
          gizmoManager.scaleGizmoEnabled = false;
          gizmoManager.boundingBoxGizmoEnabled = false;
          gizmoManager.attachToMesh(apartmentRoot);
          gizmoManagerRef.current = gizmoManager;

          console.log('Gizmo manager created and attached to apartment root');

          // Create 3D axes viewer at origin
          const axesViewer = new AxesViewer(scene, 2); // 2 units size
          axesViewerRef.current = axesViewer;
          console.log('Axes viewer created at origin');

          // Set camera to look at origin
          scene.activeCamera?.setTarget(Vector3.Zero());

          console.log('Apartment transformed: centered, grounded, and aligned');

          // Add debug markers
          // // 1. World origin marker (RED)
          // const worldOriginMarker = MeshBuilder.CreateSphere('worldOriginMarker', { diameter: 0.5 }, scene);
          // worldOriginMarker.position = new Vector3(0, 0, 0);
          // const worldOriginMat = new StandardMaterial('worldOriginMat', scene);
          // worldOriginMat.diffuseColor = new Color3(1, 0, 0); // Red
          // worldOriginMat.emissiveColor = new Color3(1, 0, 0);
          // worldOriginMarker.material = worldOriginMat;
          // console.log('World origin marker (RED) at (0, 0, 0)');

          // // 2. Apartment local origin marker (GREEN) - calculate center after transformation
          // let postMinX = Infinity, postMaxX = -Infinity;
          // let postMinY = Infinity, postMaxY = -Infinity;
          // let postMinZ = Infinity, postMaxZ = -Infinity;

          // actualMeshes.forEach(mesh => {
          //   const positions = mesh.getVerticesData('position');
          //   if (positions) {
          //     for (let i = 0; i < positions.length; i += 3) {
          //       const worldPos = Vector3.TransformCoordinates(
          //         new Vector3(positions[i], positions[i + 1], positions[i + 2]),
          //         mesh.getWorldMatrix()
          //       );
          //       postMinX = Math.min(postMinX, worldPos.x);
          //       postMaxX = Math.max(postMaxX, worldPos.x);
          //       postMinY = Math.min(postMinY, worldPos.y);
          //       postMaxY = Math.max(postMaxY, worldPos.y);
          //       postMinZ = Math.min(postMinZ, worldPos.z);
          //       postMaxZ = Math.max(postMaxZ, worldPos.z);
          //     }
          //   }
          // });

          // const postCenterX = (postMinX + postMaxX) / 2;
          // const postCenterY = (postMinY + postMaxY) / 2;
          // const postCenterZ = (postMinZ + postMaxZ) / 2;

          // const apartmentOriginMarker = MeshBuilder.CreateSphere('apartmentOriginMarker', { diameter: 0.5 }, scene);
          // apartmentOriginMarker.position = new Vector3(postCenterX, postCenterY, postCenterZ);
          // const apartmentOriginMat = new StandardMaterial('apartmentOriginMat', scene);
          // apartmentOriginMat.diffuseColor = new Color3(0, 1, 0); // Green
          // apartmentOriginMat.emissiveColor = new Color3(0, 1, 0);
          // apartmentOriginMarker.material = apartmentOriginMat;
          // console.log(`Apartment center marker (GREEN) at (${postCenterX.toFixed(2)}, ${postCenterY.toFixed(2)}, ${postCenterZ.toFixed(2)})`);
          // console.log(`Ground level at Z=${postMinZ.toFixed(2)}`);
        }
      }

      // Setup click handler
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          const pickedMesh = pointerInfo.pickInfo?.pickedMesh;

          if (pickedMesh && pickedMesh.metadata) {
            // Remove previous highlight
            if (highlightLayerRef.current) {
              highlightLayerRef.current.removeAllMeshes();
              highlightLayerRef.current.addMesh(pickedMesh as AbstractMesh, Color3.Yellow());
            }

            // Update selected mesh info
            setSelectedMesh({
              name: pickedMesh.name,
              metadata: pickedMesh.metadata as MeshMetadata,
            });
          } else {
            // Clicked on empty space - clear selection
            if (highlightLayerRef.current) {
              highlightLayerRef.current.removeAllMeshes();
            }
            setSelectedMesh(null);
          }
        }
      });

      setLoading(false);

    } catch (err) {
      console.error('Error in scene setup:', err);
      setError(`Error: ${err}`);
      setLoading(false);
    }
  }, [apartmentId, viewMode, renderApartment]);

  // Toggle visibility functions
  const toggleWalls = useCallback(() => {
    if (!sceneRef.current) {
      console.log('No scene available');
      return;
    }
    const newShowWalls = !showWalls;
    setShowWalls(newShowWalls);

    let wallCount = 0;
    sceneRef.current.meshes.forEach((mesh) => {
      // Check mesh name for "separator_" and "_WALL_"
      if (mesh.name.includes('separator_') && mesh.name.includes('_WALL_')) {
        mesh.setEnabled(newShowWalls);
        wallCount++;
      }
    });
    console.log(`Toggled ${wallCount} walls to ${newShowWalls ? 'visible' : 'hidden'}`);
  }, [showWalls]);

  const toggleDoors = useCallback(() => {
    if (!sceneRef.current) {
      console.log('No scene available');
      return;
    }
    const newShowDoors = !showDoors;
    setShowDoors(newShowDoors);

    let doorCount = 0;
    sceneRef.current.meshes.forEach((mesh) => {
      // Check mesh name for "opening_" and "_DOOR" or "_ENTRANCE_DOOR"
      if (mesh.name.includes('opening_') && (mesh.name.includes('_DOOR_') || mesh.name.includes('_ENTRANCE_DOOR_'))) {
        mesh.setEnabled(newShowDoors);
        doorCount++;
      }
    });
    console.log(`Toggled ${doorCount} doors to ${newShowDoors ? 'visible' : 'hidden'}`);
  }, [showDoors]);

  const toggleWindows = useCallback(() => {
    if (!sceneRef.current) {
      console.log('No scene available');
      return;
    }
    const newShowWindows = !showWindows;
    setShowWindows(newShowWindows);

    let windowCount = 0;
    sceneRef.current.meshes.forEach((mesh) => {
      // Check mesh name for "opening_" and "_WINDOW_"
      if (mesh.name.includes('opening_') && mesh.name.includes('_WINDOW_')) {
        mesh.setEnabled(newShowWindows);
        windowCount++;
      }
    });
    console.log(`Toggled ${windowCount} windows to ${newShowWindows ? 'visible' : 'hidden'}`);
  }, [showWindows]);

  const toggleGizmo = useCallback(() => {
    if (!gizmoManagerRef.current) {
      console.log('No gizmo manager available');
      return;
    }
    const newShowGizmo = !showGizmo;
    setShowGizmo(newShowGizmo);

    gizmoManagerRef.current.rotationGizmoEnabled = newShowGizmo;
    console.log(`Rotation gizmo ${newShowGizmo ? 'enabled' : 'disabled'}`);
  }, [showGizmo]);

  const toggleAxes = useCallback(() => {
    if (!axesViewerRef.current) {
      console.log('No axes viewer available');
      return;
    }
    const newShowAxes = !showAxes;
    setShowAxes(newShowAxes);

    // Show/hide axes by enabling/disabling the mesh visibility
    axesViewerRef.current.xAxis.setEnabled(newShowAxes);
    axesViewerRef.current.yAxis.setEnabled(newShowAxes);
    axesViewerRef.current.zAxis.setEnabled(newShowAxes);

    console.log(`Axes viewer ${newShowAxes ? 'shown' : 'hidden'}`);
  }, [showAxes]);

  const setViewModeAndCamera = useCallback((newMode: ViewMode) => {
    if (!sceneRef.current?.activeCamera) {
      console.log('No camera available');
      return;
    }

    setViewMode(newMode);

    const camera = sceneRef.current.activeCamera as any;

    // Hide/show grid based on view mode
    const ground = sceneRef.current.getMeshByName('ground');
    if (ground) {
      // Hide grid in plan mode to avoid obscuring the floor plan
      ground.setEnabled(newMode !== 'plan');
    }

    // Set camera mode based on view mode
    if (newMode === 'plan') {
      // Plan view uses orthographic projection looking down
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      const size = camera.radius || 20;
      const aspectRatio = sceneRef.current.getEngine().getRenderWidth() / sceneRef.current.getEngine().getRenderHeight();
      camera.orthoLeft = -size * aspectRatio;
      camera.orthoRight = size * aspectRatio;
      camera.orthoBottom = -size;
      camera.orthoTop = size;

      // Set camera to top view
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.1; // Almost 0 but not exactly (to avoid gimbal lock)

      console.log('Switched to Plan view (orthographic, top-down)');
    } else if (newMode === 'isometric') {
      // Isometric view uses orthographic projection at an angle
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      const size = camera.radius || 20;
      const aspectRatio = sceneRef.current.getEngine().getRenderWidth() / sceneRef.current.getEngine().getRenderHeight();
      camera.orthoLeft = -size * aspectRatio;
      camera.orthoRight = size * aspectRatio;
      camera.orthoBottom = -size;
      camera.orthoTop = size;

      // Set camera to isometric angle
      camera.alpha = -Math.PI / 4;
      camera.beta = Math.PI / 3;

      console.log('Switched to Isometric view (orthographic)');
    } else {
      // Perspective view uses perspective projection
      camera.mode = Camera.PERSPECTIVE_CAMERA;

      // Set camera to 3D view angle
      camera.alpha = -Math.PI / 4;
      camera.beta = Math.PI / 3;

      console.log('Switched to Perspective view');
    }

    // Re-render meshes if we have polygon data
    if (polygonDataRef.current && sceneRef.current) {
      // Dispose old meshes
      sceneRef.current.meshes.filter(m =>
        m.name.startsWith('area_') ||
        m.name.startsWith('separator_') ||
        m.name.startsWith('opening_')
      ).forEach(m => m.dispose());

      // Dispose old apartment root
      if (apartmentRootRef.current) {
        apartmentRootRef.current.dispose();
        apartmentRootRef.current = null;
      }

      // Render new meshes
      const meshes = renderApartment(sceneRef.current, polygonDataRef.current, newMode);

      // Transform apartment (same logic as onSceneReady)
      if (meshes.length > 0) {
        const actualMeshes = meshes.filter(m => m.getTotalVertices() > 0);

        if (actualMeshes.length > 0) {
          const apartmentRoot = new TransformNode('apartmentRoot', sceneRef.current);
          meshes.forEach(mesh => { mesh.parent = apartmentRoot; });

          apartmentRoot.computeWorldMatrix(true);
          actualMeshes.forEach(m => m.computeWorldMatrix(true));

          // Calculate bounding box and center/align
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;

          actualMeshes.forEach(mesh => {
            const positions = mesh.getVerticesData('position');
            if (positions) {
              for (let i = 0; i < positions.length; i += 3) {
                const worldPos = Vector3.TransformCoordinates(
                  new Vector3(positions[i], positions[i + 1], positions[i + 2]),
                  mesh.getWorldMatrix()
                );
                minX = Math.min(minX, worldPos.x);
                maxX = Math.max(maxX, worldPos.x);
                minY = Math.min(minY, worldPos.y);
                maxY = Math.max(maxY, worldPos.y);
                minZ = Math.min(minZ, worldPos.z);
                maxZ = Math.max(maxZ, worldPos.z);
              }
            }
          });

          const sizeX = maxX - minX;
          const sizeY = maxY - minY;

          // Rotate based on wall orientations
          let rotationAngle = 0;

          if (polygonDataRef.current.separators && polygonDataRef.current.separators.length > 0) {
            const angles: number[] = [];

            // Analyze all wall segments
            polygonDataRef.current.separators.forEach(separator => {
              const coords = separator.coordinates;
              if (coords && coords.length >= 2) {
                for (let i = 0; i < coords.length - 1; i++) {
                  const [x1, y1] = coords[i];
                  const [x2, y2] = coords[i + 1];
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const length = Math.sqrt(dx * dx + dy * dy);

                  if (length > 0.1) {
                    const angle = Math.atan2(dy, dx);
                    angles.push(angle);
                  }
                }
              }
            });

            if (angles.length > 0) {
              const normalizedAngles = angles.map(a => {
                let normalized = Math.abs(a) % (Math.PI / 2);
                return normalized;
              });

              normalizedAngles.sort((a, b) => a - b);
              const medianAngle = normalizedAngles[Math.floor(normalizedAngles.length / 2)];

              if (medianAngle < Math.PI / 8) {
                rotationAngle = 0;
              } else if (medianAngle > 3 * Math.PI / 8) {
                rotationAngle = Math.PI / 2 - medianAngle;
              } else {
                rotationAngle = -medianAngle;
              }
            } else {
              if (sizeY > sizeX) {
                rotationAngle = Math.PI / 2;
              }
            }
          } else {
            if (sizeY > sizeX) {
              rotationAngle = Math.PI / 2;
            }
          }

          apartmentRoot.rotation.z = rotationAngle;
          apartmentRoot.computeWorldMatrix(true);
          actualMeshes.forEach(m => m.computeWorldMatrix(true));

          // Recalculate bounds after rotation
          minX = Infinity; maxX = -Infinity;
          minY = Infinity; maxY = -Infinity;
          minZ = Infinity; maxZ = -Infinity;

          actualMeshes.forEach(mesh => {
            const positions = mesh.getVerticesData('position');
            if (positions) {
              for (let i = 0; i < positions.length; i += 3) {
                const worldPos = Vector3.TransformCoordinates(
                  new Vector3(positions[i], positions[i + 1], positions[i + 2]),
                  mesh.getWorldMatrix()
                );
                minX = Math.min(minX, worldPos.x);
                maxX = Math.max(maxX, worldPos.x);
                minY = Math.min(minY, worldPos.y);
                maxY = Math.max(maxY, worldPos.y);
                minZ = Math.min(minZ, worldPos.z);
                maxZ = Math.max(maxZ, worldPos.z);
              }
            }
          });

          // Center and ground (slightly above grid)
          apartmentRoot.position.x = -(minX + maxX) / 2;
          apartmentRoot.position.y = -(minY + maxY) / 2;
          apartmentRoot.position.z = -minZ + 0.01; // +0.01 to sit above grid at Z=-0.01

          apartmentRoot.computeWorldMatrix(true);
          meshes.forEach(mesh => mesh.computeWorldMatrix(true));

          apartmentRootRef.current = apartmentRoot;

          // Reattach gizmo
          if (gizmoManagerRef.current) {
            gizmoManagerRef.current.attachToMesh(apartmentRoot);
          }
        }
      }
    }
  }, [renderApartment]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* 3D Scene */}
      <BabylonScene onSceneReady={onSceneReady} />

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          fontSize: '24px',
          fontWeight: 'bold',
        }}>
          Loading apartment...
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '8px',
          fontSize: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Controls Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '200px',
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Controls</h3>

        {/* Visibility Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={toggleWalls}
            style={{
              padding: '10px',
              backgroundColor: showWalls ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showWalls ? '✓ ' : '✗ '} Walls
          </button>
          <button
            onClick={toggleDoors}
            style={{
              padding: '10px',
              backgroundColor: showDoors ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showDoors ? '✓ ' : '✗ '} Doors
          </button>
          <button
            onClick={toggleWindows}
            style={{
              padding: '10px',
              backgroundColor: showWindows ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showWindows ? '✓ ' : '✗ '} Windows
          </button>
          <button
            onClick={toggleGizmo}
            style={{
              padding: '10px',
              backgroundColor: showGizmo ? '#FF9800' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showGizmo ? '✓ ' : '✗ '} Rotation Gizmo
          </button>
          <button
            onClick={toggleAxes}
            style={{
              padding: '10px',
              backgroundColor: showAxes ? '#9C27B0' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showAxes ? '✓ ' : '✗ '} 3D Axes
          </button>
        </div>

        {/* Camera Views */}
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Camera Views</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => setCameraView('top')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Top
            </button>
            <button
              onClick={() => setCameraView('bottom')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Bottom
            </button>
            <button
              onClick={() => setCameraView('front')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Front
            </button>
            <button
              onClick={() => setCameraView('left')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Left
            </button>
            <button
              onClick={() => setCameraView('right')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Right
            </button>
            <button
              onClick={() => setCameraView('isometric')}
              style={{
                padding: '8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              3D View
            </button>
          </div>
        </div>

        {/* View Mode */}
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>View Mode</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setViewModeAndCamera('perspective')}
              style={{
                padding: '10px',
                backgroundColor: viewMode === 'perspective' ? '#00BCD4' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: viewMode === 'perspective' ? 'bold' : 'normal',
              }}
            >
              {viewMode === 'perspective' ? '✓ ' : ''}📐 Perspective
            </button>
            <button
              onClick={() => setViewModeAndCamera('isometric')}
              style={{
                padding: '10px',
                backgroundColor: viewMode === 'isometric' ? '#00BCD4' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: viewMode === 'isometric' ? 'bold' : 'normal',
              }}
            >
              {viewMode === 'isometric' ? '✓ ' : ''}📏 Isometric
            </button>
            <button
              onClick={() => setViewModeAndCamera('plan')}
              style={{
                padding: '10px',
                backgroundColor: viewMode === 'plan' ? '#00BCD4' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: viewMode === 'plan' ? 'bold' : 'normal',
              }}
            >
              {viewMode === 'plan' ? '✓ ' : ''}📋 Plan (2D)
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Panel */}
      {selectedMesh && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px',
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>
            {selectedMesh.metadata.roomtype || selectedMesh.metadata.entity_subtype}
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#666' }}>
            <div><strong>Type:</strong> {selectedMesh.metadata.entity_type}</div>
            <div><strong>Subtype:</strong> {selectedMesh.metadata.entity_subtype}</div>
            {selectedMesh.metadata.zoning && (
              <div><strong>Zone:</strong> {selectedMesh.metadata.zoning}</div>
            )}
            {selectedMesh.metadata.area_id && (
              <div><strong>Area ID:</strong> {selectedMesh.metadata.area_id}</div>
            )}
            {selectedMesh.metadata.unit_id && (
              <div><strong>Unit ID:</strong> {selectedMesh.metadata.unit_id}</div>
            )}
            {selectedMesh.metadata.elevation !== undefined && (
              <div><strong>Elevation:</strong> {selectedMesh.metadata.elevation.toFixed(2)}m</div>
            )}
            {selectedMesh.metadata.height !== undefined && (
              <div><strong>Height:</strong> {selectedMesh.metadata.height.toFixed(2)}m</div>
            )}
            <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
              <strong>Mesh:</strong> {selectedMesh.name}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!selectedMesh && !loading && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '15px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#666',
        }}>
          Click on any room, wall, door, or window to see details
        </div>
      )}
    </div>
  );
};
