import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Stats } from "@react-three/drei";
import { observer } from "mobx-react-lite";
import { useMainContext } from "../../../hooks/useMainContext";
import { Cameras } from "../camera/Camera";
import { Model3DCompute } from "../Model3DCompute";
import * as THREE from "three";

const MODEL_DND_MIME = "application/x-montage-model-id";

type CameraTrackerProps = {
  onCameraChange: (camera: THREE.Camera) => void;
};

function CameraTracker({ onCameraChange }: CameraTrackerProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    onCameraChange(camera);
  }, [camera, onCameraChange]);

  return null;
}

export const Canvas3D = observer(() => {
  const stateManager = useMainContext();
  const designManager = stateManager.designManager;
  const modelManager = designManager.modelManager;
  const nodeManager = designManager.nodeManager;
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const intersectionRef = useRef(new THREE.Vector3());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const [adaptiveDpr, setAdaptiveDpr] = useState(1.5);

  const placedModels = modelManager.placedModels;
  const selectedId = modelManager.selectedPlacedModelId;
  const floorPlanMode = stateManager.viewMode === "2d";

  const canAcceptDrag = useCallback((event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return types.includes(MODEL_DND_MIME) || types.includes("text/plain");
  }, []);

  const resolveModelFromDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const customTypeId = event.dataTransfer.getData(MODEL_DND_MIME);
      const plainTextId = event.dataTransfer.getData("text/plain");
      const droppedModelId = customTypeId || plainTextId;
      if (!droppedModelId) {
        console.warn("[DnD] Drop payload missing model id");
        return null;
      }

      const model = modelManager.models.find((m) => m.id === droppedModelId) ?? null;

      if (!model) {
        console.warn("[DnD] Dropped model id not found in loaded models", {
          droppedModelId,
        });
      }

      return model;
    },
    [modelManager.models],
  );

  const toWorldPosition = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const camera = activeCameraRef.current;
      const host = canvasHostRef.current;
      if (!camera || !host) {
        console.warn("[DnD] Cannot convert drop point to world position", {
          hasCamera: Boolean(camera),
          hasHost: Boolean(host),
        });
        return null;
      }

      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      ndcRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(ndcRef.current, camera);

      const hit = raycasterRef.current.ray.intersectPlane(
        groundPlaneRef.current,
        intersectionRef.current,
      );
      if (!hit) {
        console.warn("[DnD] Ray did not hit ground plane", {
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return null;
      }

      console.log("[DnD] Screen point converted to world", {
        clientX: event.clientX,
        clientY: event.clientY,
        worldX: hit.x,
        worldY: 0,
        worldZ: hit.z,
      });
      return [hit.x, 0, hit.z] as [number, number, number];
    },
    [],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const model = resolveModelFromDrop(event);
      if (!model) return;

      console.log("[DnD] Drop received on canvas", {
        modelId: model.id,
        modelName: model.name,
      });

      const worldPosition = toWorldPosition(event);
      if (!worldPosition) {
        const hasExistingModules = modelManager.placedModels.length > 0;
        if (hasExistingModules) {
          if (typeof window !== "undefined") {
            window.alert(
              "Drop failed near canvas edge. Please drop inside the scene area.",
            );
          }
          console.warn(
            "[DnD] Drop blocked because world position could not be resolved for non-first module",
          );
          return;
        }

        console.warn("[DnD] World position unavailable; first module will use center");
      }
      modelManager.addModel(model, worldPosition ?? undefined);
    },
    [modelManager, resolveModelFromDrop, toWorldPosition],
  );

  return (
    <div
      ref={canvasHostRef}
      className="h-full w-full"
      onDragOver={(event) => {
        if (!canAcceptDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      <Canvas
        dpr={adaptiveDpr}
        style={{ background: "#ffffff" }}
        onPointerMissed={() => {
          modelManager.clearSelection();
        }}
      >
        <PerformanceMonitor
          bounds={(refreshRate) => (refreshRate > 90 ? [55, 90] : [45, 60]) }
          onChange={({ factor }) => {
            // Scale DPR between 1 and 2 using monitor confidence.
            setAdaptiveDpr(1 + factor);
          }}
        />
        {import.meta.env.DEV && <Stats showPanel={0} className="r3f-stats-top-right"
        />}

        <CameraTracker
          onCameraChange={(camera) => {
            activeCameraRef.current = camera;
          }}
        />

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
              onDrag={(nextPosition) => {
                if (!model.selectable) return false;
                return designManager.moveModelWithSnap(model.id, nextPosition);
              }}
              onRotate={(nextPosition, nextRotationY) =>
                modelManager.rotateModel(model.id, nextPosition, nextRotationY)
              }
              onBoundsReady={(sizeX, sizeZ) =>
                modelManager.setModelBounds(model.id, sizeX, sizeZ)
              }
              onNodesReady={(nodes) => nodeManager.registerModelNodes(model.id, nodes)}
              floorPlanMode={floorPlanMode}
              isSelected={model.id === selectedId}
              onSelect={() => designManager.selectModelForEditing(model.id)}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
});
