import { makeAutoObservable, reaction } from "mobx";
import { StateManager } from "./StateManager";
import { ModelManager } from "./ModelManager";
import { NodeManager } from "./NodeManager";
import { ConnectionGraphManager } from "./ConnectionGraphManager";
import { SnapManager } from "./SnapManager";

export class DesignManager {
  stateManager: StateManager;
  modelManager: ModelManager;
  nodeManager: NodeManager;
  connectionGraphManager: ConnectionGraphManager;
  snapManager: SnapManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.modelManager = new ModelManager();
    this.nodeManager = new NodeManager();
    this.connectionGraphManager = new ConnectionGraphManager();
    this.snapManager = new SnapManager();

    makeAutoObservable(this, {}, { autoBind: true });

    reaction(
      () => this.modelManager.placedModels.map((model) => model.id),
      (modelIds, previousModelIds = []) => {
        const currentSet = new Set(modelIds);

        previousModelIds.forEach((modelId) => {
          if (currentSet.has(modelId)) return;

          const nodeIds = this.nodeManager
            .getNodesByModel(modelId)
            .map((node) => node.id);

          this.connectionGraphManager.removeModelNodes(nodeIds);
          this.nodeManager.unregisterModelNodes(modelId);
        });
      },
      { fireImmediately: true },
    );
  }

  get selectedModel() {
    return this.modelManager.selectedModels;
  }

  setNodesSnapped(nodeAId: string, nodeBId: string) {
    this.connectionGraphManager.connectNodes(nodeAId, nodeBId);
    this.nodeManager.setNodesOccupied(nodeAId, nodeBId);
  }

  setNodesUnsnapped(nodeAId: string, nodeBId: string) {
    this.connectionGraphManager.disconnectNodes(nodeAId, nodeBId);
    this.nodeManager.setNodesFree(nodeAId, nodeBId);
  }

  private enforceSnappedTransform(
    movingModelId: string,
    movingNodeId: string,
    staticNodeId: string,
  ) {
    const alignedPosition = this.snapManager.getAlignedPositionForNodePair(
      movingModelId,
      movingNodeId,
      staticNodeId,
      this.modelManager,
      this.nodeManager,
    );
    if (!alignedPosition) return;

    this.modelManager.moveModel(movingModelId, alignedPosition);
  }

  private releaseModelSnaps(modelId: string) {
    const modelNodeIds = this.nodeManager
      .getNodesByModel(modelId)
      .map((node) => node.id);

    modelNodeIds.forEach((nodeId) => {
      const connectedNodeIds = this.connectionGraphManager.getConnections(nodeId);
      connectedNodeIds.forEach((connectedNodeId) => {
        this.setNodesUnsnapped(nodeId, connectedNodeId);
      });
    });
  }

  moveModelWithSnap(id: string, desiredPosition: [number, number, number]) {
    const movingModel = this.modelManager.placedModels.find(
      (placedModel) => placedModel.id === id,
    );
    if (!movingModel || !movingModel.selectable) return false;

    // Recompute snapping continuously while dragging by clearing existing
    // links for the moving module before finding the current best target.
    this.releaseModelSnaps(id);

    const snap = this.snapManager.resolveSnapForMove(
      id,
      desiredPosition,
      this.modelManager,
      this.nodeManager,
    );

    if (!snap) {
      this.modelManager.moveModel(id, desiredPosition);
      this.snapManager.clearLastSnap(id);
      return false;
    }

    this.modelManager.moveModel(id, snap.snappedPosition);
    this.setNodesSnapped(snap.movingNodeId, snap.staticNodeId);
    this.enforceSnappedTransform(id, snap.movingNodeId, snap.staticNodeId);
    console.log("[SnapManager] Module snapped", {
      movingModelId: id,
      movingNodeId: snap.movingNodeId,
      staticNodeId: snap.staticNodeId,
      snappedPosition: snap.snappedPosition,
    });
    movingModel.selectable = false;
    this.modelManager.clearSelection();

    this.snapManager.shouldAlertForSnap(
      id,
      snap.movingNodeId,
      snap.staticNodeId,
    );
    return true;
  }
}
