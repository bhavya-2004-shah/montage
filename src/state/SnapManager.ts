import { makeAutoObservable } from "mobx";
import * as THREE from "three";
import type { ModelManager } from "./ModelManager";
import type { NodeManager, NodeRecord } from "./NodeManager";
import type { ConnectionGraphManager } from "./ConnectionGraphManager";

type SnapResult = {
  snappedPosition: [number, number, number];
  movingNodeId: string;
  staticNodeId: string;
};

export class SnapManager {
  private readonly snapThreshold = 0.3;
  private lastSnapEdgeByModel = new Map<string, string>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  resolveSnapForMove(
    movingModelId: string,
    desiredPosition: [number, number, number],
    modelManager: ModelManager,
    nodeManager: NodeManager,
  ): SnapResult | null {
    const movingModel = modelManager.placedModels.find(
      (placedModel) => placedModel.id === movingModelId,
    );
    if (!movingModel) return null;

    const movingFreeNodes = nodeManager
      .getNodesByModel(movingModelId)
      .filter((node) => node.state === "free");
    if (movingFreeNodes.length === 0) return null;

    const staticFreeNodes = Array.from(nodeManager.nodes.values()).filter(
      (node) => node.modelId !== movingModelId && node.state === "free",
    );
    if (staticFreeNodes.length === 0) return null;

    let best: {
      movingNode: NodeRecord;
      staticNode: NodeRecord;
      movingWorld: THREE.Vector3;
      staticWorld: THREE.Vector3;
      distance: number;
    } | null = null;

    for (const movingNode of movingFreeNodes) {
      const movingWorld = this.getWorldFromLocal(
        movingNode.localPosition,
        movingModel.rotationY,
        desiredPosition,
      );

      for (const staticNode of staticFreeNodes) {
        const staticModel = modelManager.placedModels.find(
          (placedModel) => placedModel.id === staticNode.modelId,
        );
        if (!staticModel) continue;

        const staticWorld = this.getWorldFromLocal(
          staticNode.localPosition,
          staticModel.rotationY,
          staticModel.position,
        );

        const distance = movingWorld.distanceTo(staticWorld);
        if (distance > this.snapThreshold) continue;

        if (!best || distance < best.distance) {
          best = {
            movingNode,
            staticNode,
            movingWorld,
            staticWorld,
            distance,
          };
        }
      }
    }

    if (!best) return null;

    const delta = best.staticWorld.clone().sub(best.movingWorld);
    const snappedPosition: [number, number, number] = [
      desiredPosition[0] + delta.x,
      desiredPosition[1] + delta.y,
      desiredPosition[2] + delta.z,
    ];

    return {
      snappedPosition,
      movingNodeId: best.movingNode.id,
      staticNodeId: best.staticNode.id,
    };
  }

  isAlreadySnapped(
    nodeAId: string,
    nodeBId: string,
    connectionGraphManager: ConnectionGraphManager,
  ) {
    return connectionGraphManager.getConnections(nodeAId).includes(nodeBId);
  }

  shouldAlertForSnap(modelId: string, nodeAId: string, nodeBId: string) {
    const edgeKey = this.createEdgeKey(nodeAId, nodeBId);
    const previousEdgeKey = this.lastSnapEdgeByModel.get(modelId);
    this.lastSnapEdgeByModel.set(modelId, edgeKey);
    return previousEdgeKey !== edgeKey;
  }

  clearLastSnap(modelId: string) {
    this.lastSnapEdgeByModel.delete(modelId);
  }

  private getWorldFromLocal(
    localPosition: [number, number, number],
    rotationY: number,
    modelPosition: [number, number, number],
  ) {
    return new THREE.Vector3(...localPosition)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
      .add(new THREE.Vector3(...modelPosition));
  }

  private createEdgeKey(nodeAId: string, nodeBId: string) {
    return nodeAId < nodeBId ? `${nodeAId}|${nodeBId}` : `${nodeBId}|${nodeAId}`;
  }
}
