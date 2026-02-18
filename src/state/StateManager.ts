import { makeAutoObservable } from "mobx";
import { DesignManager } from "./DesignManager";
import { Design3DManager } from "./Design3DManager";

export type ViewMode = "2d" | "3d";

export class StateManager {
  designManager: DesignManager;
  design3DManager: Design3DManager;
  viewMode: ViewMode = "2d";

  constructor() {
    this.designManager = new DesignManager(this);
    this.design3DManager = new Design3DManager(this);

    makeAutoObservable(this, {}, { autoBind: true });
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  get is2DView() {
    return this.viewMode === "2d";
  }
}
