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
  private unsnapHoldPositionByModel = new Map<string, [number, number, number]>();
  private readonly unsnapReleaseDistance = 0.45;

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

  selectModelForEditing(id: string) {
    const targetModel = this.modelManager.placedModels.find(
      (placedModel) => placedModel.id === id,
    );
    if (!targetModel || targetModel.lockToCenter) return;

    if (!targetModel.selectable) {
      const modelNodeIds = this.nodeManager
        .getNodesByModel(id)
        .map((node) => node.id);
      const edgeKeys = new Set<string>();
      const releasedEdges: Array<{ nodeId: string; connectedNodeId: string }> = [];

      modelNodeIds.forEach((nodeId) => {
        const connectedNodeIds = this.connectionGraphManager.getConnections(nodeId);
        connectedNodeIds.forEach((connectedNodeId) => {
          const edgeKey =
            nodeId < connectedNodeId
              ? `${nodeId}|${connectedNodeId}`
              : `${connectedNodeId}|${nodeId}`;
          if (edgeKeys.has(edgeKey)) return;
          edgeKeys.add(edgeKey);
          releasedEdges.push({ nodeId, connectedNodeId });
        });
      });

      this.releaseModelSnaps(id);
      this.snapManager.clearLastSnap(id);
      targetModel.selectable = true;
      this.unsnapHoldPositionByModel.set(id, [...targetModel.position]);

      console.log("[SnapManager] Module unsnapped on selection", {
        modelId: id,
        releasedEdgeCount: releasedEdges.length,
        releasedEdges,
        unsnapReleaseDistance: this.unsnapReleaseDistance,
      });
    }

    this.modelManager.selectPlacedModel(id);
  }

  moveModelWithSnap(id: string, desiredPosition: [number, number, number]) {
    const movingModel = this.modelManager.placedModels.find(
      (placedModel) => placedModel.id === id,
    );
    if (!movingModel || !movingModel.selectable) return false;

    const unsnapHoldPosition = this.unsnapHoldPositionByModel.get(id);
    if (unsnapHoldPosition) {
      const deltaX = desiredPosition[0] - unsnapHoldPosition[0];
      const deltaZ = desiredPosition[2] - unsnapHoldPosition[2];
      const distanceFromUnsnapAnchor = Math.hypot(deltaX, deltaZ);

      if (distanceFromUnsnapAnchor < this.unsnapReleaseDistance) {
        this.modelManager.moveModel(id, desiredPosition);
        this.snapManager.clearLastSnap(id);
        return false;
      }

      this.unsnapHoldPositionByModel.delete(id);
      console.log("[SnapManager] Unsnap hold released; snapping re-enabled", {
        modelId: id,
        distanceFromUnsnapAnchor,
      });
    }

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
    this.unsnapHoldPositionByModel.delete(id);
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
