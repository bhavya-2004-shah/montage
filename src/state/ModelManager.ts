import { makeAutoObservable, runInAction } from "mobx";
import type { ModelPreset, PlacedModel } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN = import.meta.env.VITE_API_TOKEN;
const DEFAULT_MODEL_SIZE_X = 6;
const DEFAULT_MODEL_SIZE_Z = 6;
const FIRST_MODEL_CLEARANCE = 0.2;
const CENTER_BLOCK_EPSILON = 0.001;

type ModuleApiItem = {
  id: string | number;
  name?: string;
  moduleType?: { name?: string };
  moduleImage?: string;
  glbFile?: string;
  price?: number;
  noOfBathrooms?: number;
  noOfBedrooms?: number;
};

export class ModelManager {
  models: ModelPreset[] = [];
  selectedModelIds: string[] = [];
  placedModels: PlacedModel[] = [];
  selectedPlacedModelId: string | null = null;
  firstModelID: string | null = null;
  isLoading = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async loadModels() {
    if (this.models.length > 0) return;

    this.isLoading = true;

    try {
      const res = await fetch(`${BASE_URL}/modules`, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });

      const data = (await res.json()) as ModuleApiItem[];

      runInAction(() => {
        this.models = data.map((item) => ({
          id: String(item.id),
          name: item.name ?? "Unnamed Module",
          category: item.moduleType?.name ?? "General",
          thumbnailPath: item.moduleImage ?? "",
          modelPath: item.glbFile ?? "",
          price: item.price ?? 0,
          noOfBathrooms: item.noOfBathrooms ?? 0,
          noOfBedrooms: item.noOfBedrooms ?? 0,
        }));
      });
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  get selectedModels(): ModelPreset[] {
    return this.models.filter((m) => this.selectedModelIds.includes(m.id));
  }

  clearSelection() {
    this.selectedPlacedModelId = null;
  }

  private sanitizeSizeX(sizeX: number) {
    if (!Number.isFinite(sizeX) || sizeX <= 0) {
      return DEFAULT_MODEL_SIZE_X;
    }

    return Math.max(sizeX, 0.5);
  }

  private syncFirstModelState() {
    this.placedModels.forEach((model, index) => {
      const isFirst = index === 0;
      model.lockToCenter = isFirst;
      model.selectable = !isFirst;

      if (isFirst) {
        model.position = [0, model.position[1], 0];
        model.draggedPosition = [0, model.position[1], 0];
      }
    });

    this.firstModelID = this.placedModels[0]?.id ?? null;

    if (this.selectedPlacedModelId === this.firstModelID) {
      this.selectedPlacedModelId = null;
    }
  }

  private getRandomNearCenter(): [number, number, number] {
    const radius = 9;
    const angle = Math.random() * Math.PI * 2;

    let centerX = 0;
    let centerZ = 0;

    if (this.placedModels.length > 0) {
      const first = this.placedModels[0];
      centerX = first.position[0];
      centerZ = first.position[2];
    }

    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;

    return [x, 0, z];
  }

  private getNonOverlappingPositionFromFirstModel(
    position: [number, number, number],
    candidateSizeX: number,
    candidateSizeZ: number,
  ): [number, number, number] {
    const firstModel = this.placedModels[0];
    if (!firstModel) return position;

    const [x, y, z] = position;
    const [firstX, , firstZ] = firstModel.position;

    const halfSumX = (firstModel.boundsSizeX + candidateSizeX) * 0.5;
    const halfSumZ = (firstModel.boundsSizeZ + candidateSizeZ) * 0.5;

    const dx = x - firstX;
    const dz = z - firstZ;
    const overlapX = halfSumX - Math.abs(dx);
    const overlapZ = halfSumZ - Math.abs(dz);

    if (overlapX <= 0 || overlapZ <= 0) {
      return position;
    }

    // Push only enough to clear the first model's footprint plus a small gap.
    if (overlapX <= overlapZ) {
      const directionX = Math.sign(dx) || 1;
      return [x + directionX * (overlapX + FIRST_MODEL_CLEARANCE), y, z];
    }

    const directionZ = Math.sign(dz) || 1;
    return [x, y, z + directionZ * (overlapZ + FIRST_MODEL_CLEARANCE)];
  }

  private isAtCenter(position: [number, number, number]) {
    return (
      Math.abs(position[0]) <= CENTER_BLOCK_EPSILON &&
      Math.abs(position[2]) <= CENTER_BLOCK_EPSILON
    );
  }

  addModel(model: ModelPreset, initialDropPosition?: [number, number, number]) {
    const id = crypto.randomUUID();
    const initialSizeX = DEFAULT_MODEL_SIZE_X;

    const isFirst = this.placedModels.length === 0;
    const placedFromDrop = !isFirst && Boolean(initialDropPosition);

    const desiredPosition: [number, number, number] = isFirst
      ? [0, 0, 0]
      : initialDropPosition ?? this.getRandomNearCenter();

    if (!isFirst && this.isAtCenter(desiredPosition)) {
      if (typeof window !== "undefined") {
        window.alert("Only the first module can be placed at the center.");
      }
      console.warn("[DnD] Blocked placement at center for non-first module", {
        sourceModelId: model.id,
        sourceModelName: model.name,
        desiredPosition,
      });
      return;
    }

    const initialPosition: [number, number, number] = isFirst
      ? [0, 0, 0]
      : this.getNonOverlappingPositionFromFirstModel(
          desiredPosition,
          initialSizeX,
          DEFAULT_MODEL_SIZE_Z,
        );

    if (!isFirst && this.isAtCenter(initialPosition)) {
      if (typeof window !== "undefined") {
        window.alert("Only the first module can be placed at the center.");
      }
      console.warn("[DnD] Blocked computed center placement for non-first module", {
        sourceModelId: model.id,
        sourceModelName: model.name,
        desiredPosition,
        initialPosition,
      });
      return;
    }

    this.placedModels.push({
      id,
      modelPath: model.modelPath,
      position: initialPosition,
      rotationY: 0,
      draggedPosition: initialPosition,
      boundsSizeX: initialSizeX,
      boundsSizeZ: DEFAULT_MODEL_SIZE_Z,
      lockToCenter: isFirst,
      selectable: !isFirst,
    });

    if (isFirst) {
      this.firstModelID = id;
      this.selectedPlacedModelId = null;
    } else {
      this.selectedPlacedModelId = id;
    }

    console.log("[DnD] Model placed", {
      placedModelId: id,
      sourceModelId: model.id,
      sourceModelName: model.name,
      isFirstModel: isFirst,
      placementMode: isFirst
        ? "first-model-centered"
        : placedFromDrop
          ? "drop-world-position"
          : "random-near-center",
      desiredPosition,
      position: initialPosition,
    });
  }

  setModelBounds(id: string, sizeX: number, sizeZ: number) {
    const targetModel = this.placedModels.find(
      (placedModel) => placedModel.id === id,
    );

    if (!targetModel) return;

    const safeSizeX = this.sanitizeSizeX(sizeX);
    const safeSizeZ = this.sanitizeSizeX(sizeZ);

    if (
      targetModel.boundsSizeX === safeSizeX &&
      targetModel.boundsSizeZ === safeSizeZ
    ) {
      return;
    }

    targetModel.boundsSizeX = safeSizeX;
    targetModel.boundsSizeZ = safeSizeZ;
  }

  setModelSizeX(id: string, sizeX: number) {
    const targetModel = this.placedModels.find(
      (placedModel) => placedModel.id === id,
    );
    if (!targetModel) return;
    this.setModelBounds(id, sizeX, targetModel.boundsSizeZ);
  }

  selectPlacedModel(id: string) {
    if (id === this.firstModelID) return;
    const targetModel = this.placedModels.find((placedModel) => placedModel.id === id);
    if (!targetModel?.selectable) return;
    this.selectedPlacedModelId = id;
  }

  moveModel(id: string, position: [number, number, number]) {
    if (id === this.firstModelID) return;

    const move = this.placedModels.find((p) => p.id === id);
    if (!move) return;

    move.position = position;
    move.draggedPosition = position;
  }

  rotateModel(
    id: string,
    position: [number, number, number],
    rotationY: number,
  ) {
    const targetModel = this.placedModels.find((p) => p.id === id);
    if (!targetModel) return;

    if (targetModel.lockToCenter) {
      targetModel.position = [0, targetModel.position[1], 0];
      targetModel.draggedPosition = [0, targetModel.position[1], 0];
      return;
    }

    targetModel.rotationY = rotationY;
    targetModel.position = position;
    targetModel.draggedPosition = position;
  }

  removeModel(id: string) {
    this.placedModels = this.placedModels.filter((m) => m.id !== id);

    if (this.selectedPlacedModelId === id) {
      this.selectedPlacedModelId = null;
    }

    this.syncFirstModelState();
  }
}
