import * as THREE from "three";

export type FloorPlaneConfig = {
  centerX: number;
  centerZ: number;
  size: number;
};

export type GridConfig = {
  size: number;
  divisions: number;
  colorCenterLine: string;
  colorGrid: string;
};

export class CanvasRenderManager {
  private readonly minGridScale = 0.01;
  private readonly maxGridScale = 3;
  private readonly gridZoomDivisor = 60;
  private readonly defaultFloorPlaneSize = 1000;
  private readonly minFootprint = 10;
  private readonly floorPlaneMultiplier = 3;
  private readonly defaultGridSize = 320;

  getGridScale(camera: THREE.Camera): number {
    if (!(camera instanceof THREE.OrthographicCamera)) {
      return 1;
    }

    return THREE.MathUtils.clamp(
      camera.zoom / this.gridZoomDivisor,
      this.minGridScale,
      this.maxGridScale,
    );
  }

  applyGridScale(
    majorGrid: THREE.GridHelper | null,
    minorGrid: THREE.GridHelper | null,
    camera: THREE.Camera,
    visible: boolean,
  ) {
    if (!visible) return;
    const scale = this.getGridScale(camera);
    majorGrid?.scale.setScalar(scale);
    minorGrid?.scale.setScalar(scale);
  }

  getFloorPlaneConfig(bounds: THREE.Box3 | null): FloorPlaneConfig {
    if (!bounds) {
      return {
        centerX: 0,
        centerZ: 0,
        size: this.defaultFloorPlaneSize,
      };
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);

    const footprint = Math.max(size.x, size.z, this.minFootprint);
    return {
      centerX: center.x,
      centerZ: center.z,
      size: footprint * this.floorPlaneMultiplier,
    };
  }

  getMinorGridConfig(): GridConfig {
    return {
      size: this.defaultGridSize,
      divisions: 160,
      colorCenterLine: "#dfe4ea",
      colorGrid: "#dfe4ea",
    };
  }

  getMajorGridConfig(): GridConfig {
    return {
      size: this.defaultGridSize,
      divisions: 40,
      colorCenterLine: "#c8d0d9",
      colorGrid: "#c8d0d9",
    };
  }
}
