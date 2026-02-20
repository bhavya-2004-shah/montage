import { makeAutoObservable } from "mobx";
import * as THREE from "three";
import type { ModelManager } from "./ModelManager";
import type { NodeManager, NodeRecord } from "./NodeManager";
import type { ConnectionGraphManager } from "./ConnectionGraphManager";
import type { PlacedModel } from "./types";

type SnapResult = {
  snappedPosition: [number, number, number];
  movingNodeId: string;
  staticNodeId: string;
};

export class SnapManager {
  private readonly snapThreshold = 0.3;
  private readonly connectedNodeGap = 0;
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

    const nodeAlignedPosition = this.getSnappedModelPosition(
      best.movingWorld,
      best.staticWorld,
      desiredPosition,
    );
    const staticModel = this.getModelById(best.staticNode.modelId, modelManager);
    if (!staticModel) return null;

    const snappedPosition = this.getConnectedPosition(
      movingModel,
      staticModel,
      nodeAlignedPosition,
      desiredPosition,
    );

    return {
      snappedPosition,
      movingNodeId: best.movingNode.id,
      staticNodeId: best.staticNode.id,
    };
  }

  getAlignedPositionForNodePair(
    movingModelId: string,
    movingNodeId: string,
    staticNodeId: string,
    modelManager: ModelManager,
    nodeManager: NodeManager,
  ): [number, number, number] | null {
    const movingModel = modelManager.placedModels.find(
      (placedModel) => placedModel.id === movingModelId,
    );
    const movingNode = nodeManager.getNode(movingNodeId);
    const staticNode = nodeManager.getNode(staticNodeId);

    if (!movingModel || !movingNode || !staticNode) return null;

    const staticModel = modelManager.placedModels.find(
      (placedModel) => placedModel.id === staticNode.modelId,
    );
    if (!staticModel) return null;

    const movingWorld = this.getWorldFromLocal(
      movingNode.localPosition,
      movingModel.rotationY,
      movingModel.position,
    );
    const staticWorld = this.getWorldFromLocal(
      staticNode.localPosition,
      staticModel.rotationY,
      staticModel.position,
    );

    const nodeAlignedPosition = this.getSnappedModelPosition(
      movingWorld,
      staticWorld,
      movingModel.position,
    );
    return this.getConnectedPosition(
      movingModel,
      staticModel,
      nodeAlignedPosition,
      movingModel.position,
    );
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

  private getSnappedModelPosition(
    movingNodeWorld: THREE.Vector3,
    staticNodeWorld: THREE.Vector3,
    baseModelPosition: [number, number, number],
  ): [number, number, number] {
    const delta = staticNodeWorld.clone().sub(movingNodeWorld);
    return [
      baseModelPosition[0] + delta.x,
      baseModelPosition[1] + delta.y,
      baseModelPosition[2] + delta.z,
    ];
  }

  private getModelById(modelId: string, modelManager: ModelManager) {
    return modelManager.placedModels.find((placedModel) => placedModel.id === modelId) ?? null;
  }

  private getConnectedPosition(
    movingModel: PlacedModel,
    staticModel: PlacedModel,
    nodeAlignedPosition: [number, number, number],
    referenceMovingPosition: [number, number, number],
  ): [number, number, number] {
    const axis = this.getConnectionAxis(referenceMovingPosition, staticModel.position);
    const shiftedPosition: [number, number, number] = [
      nodeAlignedPosition[0] + axis.x * this.connectedNodeGap,
      nodeAlignedPosition[1],
      nodeAlignedPosition[2] + axis.z * this.connectedNodeGap,
    ];

    const direction = axis.clone().normalize();
    const movingCenter = new THREE.Vector3(...shiftedPosition);
    const staticCenter = new THREE.Vector3(...staticModel.position);
    const centerDelta = movingCenter.clone().sub(staticCenter);
    const signedDistance = centerDelta.dot(direction);
    const movingExtent = this.getExtentAlongAxis(movingModel, direction);
    const staticExtent = this.getExtentAlongAxis(staticModel, direction);
    const minDistance = movingExtent + staticExtent;

    if (Math.abs(signedDistance) >= minDistance) {
      return shiftedPosition;
    }

    const requiredPush = minDistance - Math.abs(signedDistance);
    const side = Math.sign(signedDistance) || 1;
    return [
      shiftedPosition[0] + direction.x * requiredPush * side,
      shiftedPosition[1],
      shiftedPosition[2] + direction.z * requiredPush * side,
    ];
  }

  private getConnectionAxis(
    movingPosition: [number, number, number],
    staticPosition: [number, number, number],
  ) {
    const deltaX = movingPosition[0] - staticPosition[0];
    const deltaZ = movingPosition[2] - staticPosition[2];

    if (Math.abs(deltaX) >= Math.abs(deltaZ)) {
      return new THREE.Vector3(Math.sign(deltaX) || 1, 0, 0);
    }
    return new THREE.Vector3(0, 0, Math.sign(deltaZ) || 1);
  }

  private getExtentAlongAxis(model: PlacedModel, axis: THREE.Vector3) {
    const halfX = model.boundsSizeX * 0.5;
    const halfZ = model.boundsSizeZ * 0.5;

    const cos = Math.cos(model.rotationY);
    const sin = Math.sin(model.rotationY);
    const modelLocalXWorld = new THREE.Vector3(cos, 0, sin);
    const modelLocalZWorld = new THREE.Vector3(-sin, 0, cos);

    return (
      Math.abs(axis.dot(modelLocalXWorld)) * halfX +
      Math.abs(axis.dot(modelLocalZWorld)) * halfZ
    );
  }
}
