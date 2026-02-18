import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useRef, useEffect } from "react";
import * as THREE from "three";

type CamerasProps = {
  floorPlanMode: boolean;
};

export function Cameras({ floorPlanMode }: CamerasProps) {
  const orthoRef = useRef<THREE.OrthographicCamera>(null);

  useEffect(() => {
    if (floorPlanMode && orthoRef.current) {
      const cam = orthoRef.current;

      // True top-down view
      cam.position.set(0, 50, 0);

      // Make Y axis point downwards into scene
      cam.up.set(0, 0, -1);

      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
    }
  }, [floorPlanMode]);

  if (floorPlanMode) {
    return (
      <>
        <OrthographicCamera
          ref={orthoRef}
          makeDefault
          zoom={40}
          near={0.1}
          far={1000}
        />
        <OrbitControls
          makeDefault
          enableRotate={false}
          enablePan
          enableZoom
          screenSpacePanning
        />
      </>
    );
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[10, 8, 10]} />
      <OrbitControls />
    </>
  );
}
