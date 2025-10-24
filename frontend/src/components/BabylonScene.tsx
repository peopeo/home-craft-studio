import { useEffect, useRef } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  MeshBuilder,
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
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      20,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);

    // Set Z as the up vector since we extrude along Z-axis
    camera.upVector = new Vector3(0, 0, 1);

    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 50;
    camera.pinchPrecision = 50;

    // Light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    // Add grid helper - rotate to align with X-Y plane (since Z is up)
    const ground = MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene);
    ground.rotation.x = Math.PI / 2; // Rotate 90° to make it horizontal in X-Y plane
    const gridMaterial = new GridMaterial('gridMaterial', scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new Color4(1, 1, 1, 1);
    gridMaterial.lineColor = new Color4(0.5, 0.5, 0.5, 1.0);
    gridMaterial.opacity = 0.98;
    ground.material = gridMaterial;
    ground.position.z = -0.01; // Slightly below ground level (Z=0) to avoid z-fighting

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
