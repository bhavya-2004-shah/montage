import { makeAutoObservable } from "mobx";

const createEdgeKey = (nodeAId: string, nodeBId: string) => {
  return nodeAId < nodeBId
    ? `${nodeAId}|${nodeBId}`
    : `${nodeBId}|${nodeAId}`;
};

export class ConnectionGraphManager {
  adjacency = new Map<string, Set<string>>();
  snappedNodeIds = new Set<string>();
  snappedEdgeKeys = new Set<string>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  connectNodes(nodeAId: string, nodeBId: string) {
    if (!nodeAId || !nodeBId || nodeAId === nodeBId) return;

    if (!this.adjacency.has(nodeAId)) {
      this.adjacency.set(nodeAId, new Set<string>());
    }
    if (!this.adjacency.has(nodeBId)) {
      this.adjacency.set(nodeBId, new Set<string>());
    }

    this.adjacency.get(nodeAId)?.add(nodeBId);
    this.adjacency.get(nodeBId)?.add(nodeAId);

    this.snappedNodeIds.add(nodeAId);
    this.snappedNodeIds.add(nodeBId);
    this.snappedEdgeKeys.add(createEdgeKey(nodeAId, nodeBId));
  }

  disconnectNodes(nodeAId: string, nodeBId: string) {
    if (!nodeAId || !nodeBId || nodeAId === nodeBId) return;

    this.adjacency.get(nodeAId)?.delete(nodeBId);
    this.adjacency.get(nodeBId)?.delete(nodeAId);
    this.snappedEdgeKeys.delete(createEdgeKey(nodeAId, nodeBId));

    this.cleanupNode(nodeAId);
    this.cleanupNode(nodeBId);
  }

  removeNode(nodeId: string) {
    const neighbors = Array.from(this.adjacency.get(nodeId) ?? []);
    neighbors.forEach((neighborId) => {
      this.adjacency.get(neighborId)?.delete(nodeId);
      this.snappedEdgeKeys.delete(createEdgeKey(nodeId, neighborId));
      this.cleanupNode(neighborId);
    });

    this.adjacency.delete(nodeId);
    this.cleanupNode(nodeId);
  }

  removeModelNodes(nodeIds: string[]) {
    nodeIds.forEach((nodeId) => {
      this.removeNode(nodeId);
    });
  }

  getConnections(nodeId: string) {
    return Array.from(this.adjacency.get(nodeId) ?? []);
  }

  get snappedNodes() {
    return Array.from(this.snappedNodeIds);
  }

  get snappedEdges() {
    return Array.from(this.snappedEdgeKeys);
  }

  private cleanupNode(nodeId: string) {
    const hasNeighbors = (this.adjacency.get(nodeId)?.size ?? 0) > 0;
    if (!hasNeighbors) {
      this.adjacency.delete(nodeId);
      this.snappedNodeIds.delete(nodeId);
    }
  }
}
