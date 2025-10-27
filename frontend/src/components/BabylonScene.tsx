import { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  MeshBuilder,
  Camera,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials/grid';
import '@babylonjs/core/Materials/standardMaterial';

interface BabylonSceneProps {
  onSceneReady: (scene: Scene) => void;
  onRender?: (scene: Scene) => void;
}

export const BabylonScene: React.FC<BabylonSceneProps> = ({ onSceneReady, onRender }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.95, 0.95, 0.95, 1);

    // Camera - configured for Z-up coordinate system (our extrusion direction)
    // Start with top view for Plan mode
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,  // alpha: looking along -Y axis (front)
      0.1,           // beta: almost 0 (top view, avoiding gimbal lock)
      20,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    // Set Z as the up vector since we extrude along Z-axis
    camera.upVector = new Vector3(0, 0, 1);

    // Start in orthographic mode for Plan view
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    const size = 20;
    const aspectRatio = engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoLeft = -size * aspectRatio;
    camera.orthoRight = size * aspectRatio;
    camera.orthoBottom = -size;
    camera.orthoTop = size;

    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 50;
    camera.pinchPrecision = 50;

    // Custom zoom handling for orthographic mode
    canvas.addEventListener('wheel', (event) => {
      if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        event.preventDefault();

        // Zoom factor based on scroll direction
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;

        // Get current ortho size (based on top bound)
        const currentSize = Math.abs(camera.orthoTop || 20);
        const newSize = currentSize * zoomFactor;

        // Clamp zoom limits (min 2, max 100)
        const clampedSize = Math.max(2, Math.min(100, newSize));

        // Update ortho bounds with proper aspect ratio
        const aspectRatio = engine.getRenderWidth() / engine.getRenderHeight();
        camera.orthoLeft = -clampedSize * aspectRatio;
        camera.orthoRight = clampedSize * aspectRatio;
        camera.orthoBottom = -clampedSize;
        camera.orthoTop = clampedSize;
      }
    }, { passive: false });

    // Light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    // Add grid helper - Create a plane in X-Y (horizontal, since Z is up)
    const ground = MeshBuilder.CreatePlane('ground', { width: 50, height: 50 }, scene);
    // CreatePlane creates a plane in X-Y by default, which is what we want for Z-up
    const gridMaterial = new GridMaterial('gridMaterial', scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new Color4(1, 1, 1, 1);
    gridMaterial.lineColor = new Color4(0.5, 0.5, 0.5, 1.0);
    gridMaterial.opacity = 0.98;
    gridMaterial.zOffset = -10; // Render behind everything else
    ground.material = gridMaterial;
    ground.position.z = -0.05; // Slightly below ground level (Z=0) to avoid z-fighting
    ground.renderingGroupId = 0; // Render in background group
    ground.isPickable = false; // Don't interfere with picking
    ground.setEnabled(false); // Start hidden for Plan mode

    // Call onSceneReady
    onSceneReady(scene);

    // Render loop
    engine.runRenderLoop(() => {
      if (onRender) onRender(scene);
      scene.render();
    });

    // Handle resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, [onSceneReady, onRender]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
      }}
    />
  );
};
