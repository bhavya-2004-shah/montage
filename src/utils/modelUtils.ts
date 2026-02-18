export function getSelectedModel(modelManager: any) {
  const { placedModels, selectedModelId } = modelManager;

  if (!placedModels || placedModels.length === 0) return null;

  return (
    placedModels.find((m: any) => m.id === selectedModelId) ||
    placedModels[0]
  );
}
