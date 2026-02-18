export type ModelPreset = {
  id: string;
  name: string;
  category: string;
  thumbnailPath: string;
  modelPath: string;
  price: number;
  noOfBathrooms: number;
  noOfBedrooms: number;
};

export type PlacedModel = {
  id: string;
  modelPath: string;
  position: [number, number, number];
  draggedPosition: [number, number, number];
  rotationY: number;
  boundsSizeX: number;
  lockToCenter: boolean;
  selectable: boolean;
};
