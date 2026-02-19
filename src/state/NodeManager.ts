import { makeAutoObservable } from "mobx";

export type NodeState = "free" | "occupied";

export type NodeRegistrationInput = {
  key: string;
  name: string;
  localPosition: [number, number, number];
  worldPosition: [number, number, number];
};

export type NodeRecord = {
  id: string;
  modelId: string;
  key: string;
  name: string;
  localPosition: [number, number, number];
  worldPosition: [number, number, number];
  state: NodeState;
  occupiedByNodeId: string | null;
};

export class NodeManager {
  nodes = new Map<string, NodeRecord>();
  modelNodeIds = new Map<string, string[]>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  makeNodeId(modelId: string, nodeKey: string) {
    return `${modelId}:${nodeKey}`;
  }

  registerModelNodes(modelId: string, nodeInputs: NodeRegistrationInput[]) {
    const isFirstRegistrationForModel = !this.modelNodeIds.has(modelId);
    const nextNodeIds: string[] = [];
    const incomingNodeIds = new Set<string>();

    nodeInputs.forEach((node) => {
      const nodeId = this.makeNodeId(modelId, node.key);
      incomingNodeIds.add(nodeId);
      nextNodeIds.push(nodeId);

      const existing = this.nodes.get(nodeId);
      this.nodes.set(nodeId, {
        id: nodeId,
        modelId,
        key: node.key,
        name: node.name,
        localPosition: node.localPosition,
        worldPosition: node.worldPosition,
        state: existing?.state ?? "free",
        occupiedByNodeId: existing?.occupiedByNodeId ?? null,
      });
    });

    const previousNodeIds = this.modelNodeIds.get(modelId) ?? [];
    previousNodeIds.forEach((nodeId) => {
      if (!incomingNodeIds.has(nodeId)) {
        this.nodes.delete(nodeId);
      }
    });

    this.modelNodeIds.set(modelId, nextNodeIds);

    if (isFirstRegistrationForModel) {
      console.log("[NodeManager] Model added with scene nodes", {
        modelId,
        nodeCount: nodeInputs.length,
        nodes: nodeInputs,
      });
    }
  }

  unregisterModelNodes(modelId: string) {
    const nodeIds = this.modelNodeIds.get(modelId) ?? [];
    nodeIds.forEach((nodeId) => {
      this.nodes.delete(nodeId);
    });
    this.modelNodeIds.delete(modelId);
  }

  setNodeState(nodeId: string, state: NodeState, occupiedByNodeId: string | null = null) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.state = state;
    node.occupiedByNodeId = state === "occupied" ? occupiedByNodeId : null;
  }

  setNodesOccupied(nodeAId: string, nodeBId: string) {
    this.setNodeState(nodeAId, "occupied", nodeBId);
    this.setNodeState(nodeBId, "occupied", nodeAId);
  }

  setNodesFree(nodeAId: string, nodeBId: string) {
    this.setNodeState(nodeAId, "free", null);
    this.setNodeState(nodeBId, "free", null);
  }

  getNode(nodeId: string) {
    return this.nodes.get(nodeId) ?? null;
  }

  getNodesByModel(modelId: string) {
    const nodeIds = this.modelNodeIds.get(modelId) ?? [];
    return nodeIds
      .map((nodeId) => this.nodes.get(nodeId))
      .filter((node): node is NodeRecord => Boolean(node));
  }

  get freeNodes() {
    return Array.from(this.nodes.values()).filter((node) => node.state === "free");
  }

  get occupiedNodes() {
    return Array.from(this.nodes.values()).filter((node) => node.state === "occupied");
  }
}
