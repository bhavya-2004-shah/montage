import { Grid } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";

export function DynamicGrid() {
  const { camera } = useThree();
  const gridRef = useRef<any>(null);

  useFrame(() => {
    if (!gridRef.current) return;

    let zoomFactor = 1;

    // Orthographic camera
    if ("zoom" in camera) {
      zoomFactor = camera.zoom;
    }

    // Adjust grid scale based on zoom
    const scale = Math.max(0.5, 50 / zoomFactor);
    gridRef.current.scale.set(scale, 1, scale);
  });

  return (
    <Grid
      ref={gridRef}
      infiniteGrid
      cellSize={1}
      sectionSize={5}
      cellThickness={0.5}
      sectionThickness={1.2}
      fadeDistance={100}
      fadeStrength={1}
      position={[0, -0.01, 0]}
    />
  );
}
