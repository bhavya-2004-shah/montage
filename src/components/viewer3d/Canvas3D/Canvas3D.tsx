import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { observer } from "mobx-react-lite";
import { useMainContext } from "../../../hooks/useMainContext";
import { Cameras } from "../camera/Camera";
import { Model3DCompute } from "../Model3DCompute";

export const Canvas3D = observer(() => {
  const stateManager = useMainContext();
  const designManager = stateManager.designManager;
  const modelManager = designManager.modelManager;
  const nodeManager = designManager.nodeManager;

  const placedModels = modelManager.placedModels;
  const selectedId = modelManager.selectedPlacedModelId;
  const floorPlanMode = stateManager.viewMode === "2d";

  return (
    <Canvas
      dpr={[1, 2]}
      style={{ background: "#ffffff" }}
      onPointerMissed={() => {
        modelManager.clearSelection();
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[12, 14, 8]} intensity={1} />
      <directionalLight position={[-8, 10, -10]} intensity={0.6} />

      <Cameras floorPlanMode={floorPlanMode} />

      {floorPlanMode && (
        <gridHelper args={[250, 250, "#444444", "#bbbbbb"]} position={[0, -2, 0]} />
      )}

      <Suspense fallback={null}>
        {placedModels.map((model) => (
          <Model3DCompute
            key={model.id}
            modelId={model.id}
            modelUrl={model.modelPath}
            position={model.position}
            rotationY={model.rotationY ?? 0}
            onDrag={(nextPosition) =>
              designManager.moveModelWithSnap(model.id, nextPosition)
            }
            onRotate={(nextPosition, nextRotationY) =>
              modelManager.rotateModel(model.id, nextPosition, nextRotationY)
            }
            onBoundsReady={(sizeX) => modelManager.setModelSizeX(model.id, sizeX)}
            onNodesReady={(nodes) => nodeManager.registerModelNodes(model.id, nodes)}
            floorPlanMode={floorPlanMode}
            isSelected={model.id === selectedId}
            onSelect={() => modelManager.selectPlacedModel(model.id)}
          />
        ))}
      </Suspense>
    </Canvas>
  );
});
