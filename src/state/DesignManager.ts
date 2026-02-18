import { makeAutoObservable } from "mobx";
import { StateManager } from "./StateManager";
import { ModelManager } from "./ModelManager";

export class DesignManager {
  stateManager: StateManager;
  modelManager: ModelManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.modelManager = new ModelManager();

    makeAutoObservable(this, {}, { autoBind: true });
  }

  get selectedModel() {
    return this.modelManager.selectedModels;

  }
}
