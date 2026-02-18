import { observer } from "mobx-react-lite";
import { useMainContext } from "../../hooks/useMainContext";

export const Model2DViewer = observer(() => {
  const stateManager = useMainContext();

  const placedModels =
    stateManager.designManager.modelManager.placedModels || [];

  const activeModel = placedModels[0];

  if (!activeModel) {
    return (
      <div className="grid h-full w-full place-items-center text-sm text-[#4a515a]">
        Select a model from the left panel
      </div>
    );
  }

  return (
    <div className="grid h-full w-full place-items-center text-sm text-[#4a515a]">
      2D mode for
      <span className="ml-1 font-medium text-[#1f2328]">
        {activeModel.id}
      </span>
      is rendered in Canvas3D.
    </div>
  );
});
