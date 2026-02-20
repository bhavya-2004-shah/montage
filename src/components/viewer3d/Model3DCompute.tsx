import { useCallback, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { NodeRegistrationInput } from "../../state/NodeManager";
import {
  ROTATE_HANDLE_RADIUS,
  useModelRotation,
} from "./rotation/useModelRotation";

type ModelProps = {
  modelId: string;
  modelUrl: string;
  floorPlanMode: boolean;
  position?: [number, number, number];
  rotationY?: number;
  isSelected: boolean;
  onSelect: () => void;
  onDrag?: (nextPosition: [number, number, number]) => boolean | void;
  onRotate?: (
    nextPosition: [number, number, number],
    nextRotationY: number,
  ) => void;
  onBoundsReady?: (sizeX: number, sizeZ: number) => void;
  onNodesReady?: (nodes: NodeRegistrationInput[]) => void;
};

const HIDE_IN_FLOORPLAN = ["ceiling", "ceilings", "roof", "roofs"];

const NODE_COLOR = "#76aeee";
const HIERARCHY_COLOR = "#ffffff";
const EDGE_COLOR = "#000000";
const EDGE_SELECTED_COLOR = "#ff6a00";

const isNodeMeshName = (name: string) => name.toLowerCase().includes("node");

export function Model3DCompute({
  modelId,
  modelUrl,
  floorPlanMode,
  position = [0, 0, 0],
  rotationY = 0,
  isSelected,
  onSelect,
  onDrag,
  onRotate,
  onBoundsReady,
  onNodesReady,
}: ModelProps) {
  const { scene } = useGLTF(modelUrl);

  const rootRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Group | null>(null);
  const edgeGroupRef = useRef<THREE.Group>(new THREE.Group());
  const hasReportedBoundsRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffsetRef = useRef(new THREE.Vector3());
  const dragPointRef = useRef(new THREE.Vector3());
  const ignoreRaycast = useCallback(
    (_raycaster: THREE.Raycaster, _intersections: THREE.Intersection[]) => {
      // Selection overlay should not capture pointer hits.
    },
    [],
  );

  const originalMaterials = useRef(
    new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>(),
  );

  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const footprint = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const halfX = Math.max(size.x / 2, 0.5);
    const halfZ = Math.max(size.z / 2, 0.5);

    return { halfX, halfZ };
  }, [clonedScene]);

  const nodeSnapshots = useMemo(() => {
    const sceneBox = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    sceneBox.getCenter(center);

    clonedScene.updateWorldMatrix(true, true);

    const worldPosition = new THREE.Vector3();
    const nodeBox = new THREE.Box3();
    const snapshots: Array<{
      key: string;
      name: string;
      localPosition: [number, number, number];
    }> = [];

    let nodeIndex = 0;
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!isNodeMeshName(child.name)) return;

      // Some GLBs bake vertex positions and keep object origins at the same point.
      // Use world-space bounds center first, then fall back to object origin.
      nodeBox.setFromObject(child);
      if (!nodeBox.isEmpty()) {
        nodeBox.getCenter(worldPosition);
      } else {
        child.getWorldPosition(worldPosition);
      }

      const local = worldPosition.clone().sub(center);
      const key = `${child.name}-${nodeIndex}`;
      nodeIndex += 1;

      snapshots.push({
        key,
        name: child.name,
        localPosition: [local.x, local.y, local.z],
      });
    });

    return snapshots;
  }, [clonedScene]);

  const {
    handleLocalCorners,
    handleRotateHandleDown,
    handleRotatePointerMove,
    handleRotatePointerUp,
    isRotatingRef,
    getHandleColor,
  } = useModelRotation({
    rootRef,
    footprint,
    onSelect,
    onRotateStart: () => {
      isDraggingRef.current = false;
    },
    onRotateEnd: () => {
      isDraggingRef.current = false;
    },
    onRotate,
  });

  useEffect(() => {
    if (!onBoundsReady || hasReportedBoundsRef.current) return;

    const box = new THREE.Box3().setFromObject(clonedScene);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3();
    box.getSize(size);

    onBoundsReady(Math.max(size.x, 0.5), Math.max(size.z, 0.5));
    hasReportedBoundsRef.current = true;
  }, [clonedScene, onBoundsReady]);

  useEffect(() => {
    if (!sceneRef.current) return;

    // Center using local cloned geometry only. Using sceneRef (already under
    // translated root) introduces world-space offset and can visually stack modules.
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    sceneRef.current.position.set(-center.x, -center.y, -center.z);
  }, [clonedScene, modelId, modelUrl]);

  useEffect(() => {
    if (!onNodesReady) return;

    const worldNodes = nodeSnapshots.map((node) => {
      const local = new THREE.Vector3(...node.localPosition);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      local.add(new THREE.Vector3(...position));

      return {
        key: node.key,
        name: node.name,
        localPosition: node.localPosition,
        worldPosition: [local.x, local.y, local.z] as [number, number, number],
      };
    });

    onNodesReady(worldNodes);
  }, [nodeSnapshots, onNodesReady, position, rotationY]);

  useEffect(() => {
    if (!rootRef.current || !sceneRef.current) return;

    const root = rootRef.current;
    const sceneGroup = sceneRef.current;
    const edgeGroup = edgeGroupRef.current;
    const rootInverse = new THREE.Matrix4();
    const relativeMatrix = new THREE.Matrix4();

    edgeGroup.children.forEach((child) => {
      if (!(child instanceof THREE.LineSegments)) return;

      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    });
    edgeGroup.clear();

    root.updateWorldMatrix(true, true);
    rootInverse.copy(root.matrixWorld).invert();

    sceneGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const name = child.name.toLowerCase();
      const shouldHide = HIDE_IN_FLOORPLAN.some((cat) => name.includes(cat));

      if (floorPlanMode) {
        child.visible = !shouldHide;

        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }

        const isNode = isNodeMeshName(name);
        child.material = new THREE.MeshStandardMaterial({
          color: isNode ? NODE_COLOR : HIERARCHY_COLOR,
          roughness: 0.7,
          metalness: 0.05,
        });

        if (child.visible) {
          const edges = new THREE.EdgesGeometry(child.geometry);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
              color: isSelected ? EDGE_SELECTED_COLOR : EDGE_COLOR,
            }),
          );

          relativeMatrix.multiplyMatrices(rootInverse, child.matrixWorld);
          line.matrixAutoUpdate = false;
          line.matrix.copy(relativeMatrix);

          edgeGroup.add(line);
        }
      } else {
        child.visible = true;

        const original = originalMaterials.current.get(child);
        if (original) {
          child.material = original;
        }
      }
    });
  }, [floorPlanMode, isSelected]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDraggingRef.current = false;

    if (!isSelected) {
      onSelect();
      return;
    }

    if (!sceneRef.current || !rootRef.current) {
      onSelect();
      return;
    }

    if (isRotatingRef.current) {
      isDraggingRef.current = false;
      return;
    }

    const ownHits = e.intersections.filter((hit) =>
      Boolean(rootRef.current?.getObjectById(hit.object.id)),
    );
    if (ownHits.length === 0) return;

    const handleHit = ownHits.find(
      (hit) =>
        (hit.object as THREE.Object3D).userData?.rotateHandle === true &&
        typeof (hit.object as THREE.Object3D).userData?.rotateHandleIndex ===
          "number",
    );
    if (handleHit) {
      const handleObj = handleHit.object as THREE.Object3D;
      handleRotateHandleDown(e, handleObj.userData.rotateHandleIndex);
      return;
    }

    const hits = e.intersections.filter((hit) => {
      if (!(hit.object instanceof THREE.Mesh)) return false;
      if (hit.object.userData?.rotateHandle) return false;
      return Boolean(sceneRef.current?.getObjectById(hit.object.id));
    });

    const firstMeshHit = hits[0];
    const dragStartPoint = firstMeshHit?.point ?? ownHits[0]?.point ?? e.point;
    const root = rootRef.current;

    dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -root.position.y);

    dragOffsetRef.current.copy(root.position).sub(dragStartPoint);
    isDraggingRef.current = true;

    const targetWithCapture = e.target as {
      setPointerCapture?: (pointerId: number) => void;
    };
    targetWithCapture.setPointerCapture?.(e.pointerId);

    onSelect();
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!rootRef.current) return;

    if (handleRotatePointerMove(e)) return;

    if (!isDraggingRef.current) return;

    e.stopPropagation();

    const intersection = e.ray.intersectPlane(
      dragPlaneRef.current,
      dragPointRef.current,
    );

    if (!intersection) return;

    const nextX = intersection.x + dragOffsetRef.current.x;
    const nextY = rootRef.current.position.y;
    const nextZ = intersection.z + dragOffsetRef.current.z;

    rootRef.current.position.set(nextX, nextY, nextZ);
    const snapped = onDrag?.([nextX, nextY, nextZ]) === true;
    if (!snapped) return;

    isDraggingRef.current = false;
    const targetWithCapture = e.target as {
      releasePointerCapture?: (pointerId: number) => void;
    };
    targetWithCapture.releasePointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (handleRotatePointerUp(e)) return;

    if (!isDraggingRef.current) return;

    e.stopPropagation();
    isDraggingRef.current = false;

    const targetWithCapture = e.target as {
      releasePointerCapture?: (pointerId: number) => void;
    };
    targetWithCapture.releasePointerCapture?.(e.pointerId);
  };

  return (
    <group
      ref={rootRef}
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => {
        e.stopPropagation();
        handlePointerMove(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        handlePointerUp(e);
      }}
      onPointerCancel={handlePointerUp}
    >
      <group ref={sceneRef}>
        <primitive object={clonedScene} />
        {isSelected && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
            raycast={ignoreRaycast}
          >
            <planeGeometry args={[footprint.halfX * 2, footprint.halfZ * 2]} />
            <meshBasicMaterial color="#2a9dff" transparent opacity={0.15} />
          </mesh>
        )}

        {isSelected &&
          handleLocalCorners.map((corner, index) => {
            return (
              <mesh
                key={`rotate-handle-${index}`}
                position={[corner.x, corner.y, corner.z]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={1000}
                userData={{
                  rotateHandle: true,
                  rotateHandleIndex: index,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isDraggingRef.current = false;
                  handleRotateHandleDown(e, index);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <circleGeometry args={[ROTATE_HANDLE_RADIUS, 24]} />
                <meshBasicMaterial color={getHandleColor(index)} depthTest={false} />
              </mesh>
            );
          })}
      </group>

      <primitive object={edgeGroupRef.current} />
    </group>
  );
}
