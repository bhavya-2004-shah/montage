import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

type UseModelRotationParams = {
  rootRef: RefObject<THREE.Group | null>;
  footprint: {
    halfX: number;
    halfZ: number;
  };
  onSelect: () => void;
  onRotateStart?: () => void;
  onRotateEnd?: () => void;
  onRotate?: (
    nextPosition: [number, number, number],
    nextRotationY: number,
  ) => void;
};

const HANDLE_MARGIN = 0.35;

export const ROTATE_HANDLE_RADIUS = 0.25;
export const ROTATE_HANDLE_COLOR = "#2a9dff";
export const ROTATE_HANDLE_ACTIVE_COLOR = "#ff6a00";

export function useModelRotation({
  rootRef,
  footprint,
  onSelect,
  onRotateStart,
  onRotateEnd,
  onRotate,
}: UseModelRotationParams) {
  const isRotatingRef = useRef(false);
  const dragPlaneRef = useRef(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  );
  const dragPointRef = useRef(new THREE.Vector3());
  const rotateCenterWorldRef = useRef(new THREE.Vector3());
  const rotateStartPointerAngleRef = useRef(0);
  const rotateStartRotationYRef = useRef(0);
  const [activeHandleIndex, setActiveHandleIndex] = useState<
    number | null
  >(null);

  const handleLocalCorners = useMemo(
    () => [
      new THREE.Vector3(
        footprint.halfX + HANDLE_MARGIN,
        0.05,
        footprint.halfZ + HANDLE_MARGIN,
      ),
      new THREE.Vector3(
        -footprint.halfX - HANDLE_MARGIN,
        0.05,
        footprint.halfZ + HANDLE_MARGIN,
      ),
      new THREE.Vector3(
        -footprint.halfX - HANDLE_MARGIN,
        0.05,
        -footprint.halfZ - HANDLE_MARGIN,
      ),
      new THREE.Vector3(
        footprint.halfX + HANDLE_MARGIN,
        0.05,
        -footprint.halfZ - HANDLE_MARGIN,
      ),
    ],
    [footprint.halfX, footprint.halfZ],
  );

  const normalizeAngle = (angle: number) => {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
  };

  const snapToQuarterTurn = (angle: number) => {
    const step = Math.PI / 2;
    return Math.round(angle / step) * step;
  };

  const handleRotateHandleDown = (
    e: ThreeEvent<PointerEvent>,
    handleIndex: number,
  ) => {
    e.stopPropagation();

    if (!rootRef.current) return;
    isRotatingRef.current = true;
    onRotateStart?.();

    const root = rootRef.current;
    dragPlaneRef.current.set(
      new THREE.Vector3(0, 1, 0),
      -root.position.y,
    );

    const intersection = e.ray.intersectPlane(
      dragPlaneRef.current,
      dragPointRef.current,
    );
    if (!intersection) {
      isRotatingRef.current = false;
      onRotateEnd?.();
      return;
    }

    rotateCenterWorldRef.current.copy(root.position);
    const startVector = intersection
      .clone()
      .sub(rotateCenterWorldRef.current);
    startVector.y = 0;

    if (startVector.lengthSq() < 1e-6) {
      isRotatingRef.current = false;
      onRotateEnd?.();
      return;
    }

    rotateStartPointerAngleRef.current = Math.atan2(
      startVector.z,
      startVector.x,
    );
    rotateStartRotationYRef.current = root.rotation.y;
    setActiveHandleIndex(handleIndex);

    const targetWithCapture = e.target as {
      setPointerCapture?: (pointerId: number) => void;
    };
    targetWithCapture.setPointerCapture?.(e.pointerId);

    onSelect();
  };

  const handleRotatePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isRotatingRef.current || !rootRef.current) return false;

    e.stopPropagation();

    const intersection = e.ray.intersectPlane(
      dragPlaneRef.current,
      dragPointRef.current,
    );
    if (!intersection) return true;

    const currentVector = intersection
      .clone()
      .sub(rotateCenterWorldRef.current);
    currentVector.y = 0;
    if (currentVector.lengthSq() < 1e-6) return true;

    const currentAngle = Math.atan2(currentVector.z, currentVector.x);
    const deltaAngle = normalizeAngle(
      currentAngle - rotateStartPointerAngleRef.current,
    );
    const nextRotationY = rotateStartRotationYRef.current - deltaAngle;

    rootRef.current.rotation.y = nextRotationY;

    return true;
  };

  const handleRotatePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isRotatingRef.current) return false;

    e.stopPropagation();

    if (rootRef.current) {
      const committedRotationY = snapToQuarterTurn(
        normalizeAngle(rootRef.current.rotation.y),
      );

      rootRef.current.rotation.y = committedRotationY;
      onRotate?.(
        [
          rootRef.current.position.x,
          rootRef.current.position.y,
          rootRef.current.position.z,
        ],
        committedRotationY,
      );
    }

    isRotatingRef.current = false;
    setActiveHandleIndex(null);
    onRotateEnd?.();

    const targetWithCapture = e.target as {
      releasePointerCapture?: (pointerId: number) => void;
    };
    targetWithCapture.releasePointerCapture?.(e.pointerId);

    return true;
  };

  const getHandleColor = (index: number) => {
    return activeHandleIndex === index
      ? ROTATE_HANDLE_ACTIVE_COLOR
      : ROTATE_HANDLE_COLOR;
  };

  return {
    activeHandleIndex,
    handleLocalCorners,
    handleRotateHandleDown,
    handleRotatePointerMove,
    handleRotatePointerUp,
    isRotatingRef,
    getHandleColor,
  };
}
