import * as THREE from "three";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersection = new THREE.Vector3();

export function getGroundPoint(
  raycaster: THREE.Raycaster,
): THREE.Vector3 | null {
  const result = raycaster.ray.intersectPlane(
    groundPlane,
    intersection,
  );
  return result ? intersection.clone() : null;
}
