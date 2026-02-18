import { makeAutoObservable } from "mobx";
import type { ModelPreset } from "./types";
import { StateManager } from "./StateManager";

export class MeshManager {
  stateManager: StateManager;
  selectedModel: ModelPreset | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSelectedModel(model: ModelPreset | null) {
    this.selectedModel = model;
    console.log(this.selectedModel)
  }
}
