import * as THREE from "three";

export function setRoofVisibility(object: THREE.Object3D, visible: boolean) {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.name.toLowerCase().includes("roof")
    ) {
      child.visible = visible;
    }
  });
}
