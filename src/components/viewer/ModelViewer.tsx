import { useMemo, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useMainContext } from "../../hooks/useMainContext";

export const ModelViewer = observer(() => {
  const stateManager = useMainContext();
  const modelManager = stateManager.designManager.modelManager;

  const placedModels = modelManager.placedModels;
  const [searchValue, setSearchValue] = useState("");

  // Load models once
  useEffect(() => {
    modelManager.loadModels();
  }, [modelManager]);

  const filteredModels = useMemo(() => {
    const lowerSearch = searchValue.trim().toLowerCase();

    return modelManager.models.filter((model) => {
      return (
        lowerSearch.length === 0 ||
        model.name.toLowerCase().includes(lowerSearch)
      );
    });
  }, [modelManager.models, searchValue]);

  return (
    <aside className="h-full w-full bg-[#f3f3f6] p-5 text-[#1f2328]">
      {/* Header */}
      <div className="border-b border-[#d8dbe2] pb-3">
        <h2 className="text-[38px] font-semibold leading-none tracking-[-0.5px]">
          Modules
        </h2>
      </div>

      {/* Search */}
      <div className="mt-3 flex items-center gap-2 rounded-md border border-[#d8dbe2] bg-white px-3 py-2">
        <input
          type="text"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search Modules"
          className="w-full border-none bg-transparent text-sm outline-none placeholder:text-[#8e939b]"
        />
      </div>

      {/* Loading state */}
      {modelManager.isLoading && (
        <div className="mt-6 text-center text-sm text-[#6b7280]">
          Loading modules...
        </div>
      )}

      {/* Model list */}
      <div
        className="mt-3 space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: "calc(100% - 120px)" }}
      >
        {filteredModels.map((model) => {
          // check if any instance of this model exists in canvas
          const isPlaced = placedModels.some(
            (p) => p.modelPath === model.modelPath
          );

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => modelManager.addModel(model)}
              className={`w-full rounded-lg border bg-[#f7f8fa] p-3 text-left transition ${
                isPlaced
                  ? "border-[#7ebde6] shadow-[0_0_0_1px_rgba(126,189,230,0.5)]"
                  : "border-[#d8dbe2]"
              }`}
            >
              {/* Thumbnail */}
              {model.thumbnailPath && (
                <div className="grid place-items-center rounded-md border border-[#d8dbe2] bg-white p-2">
                  <img
                    src={model.thumbnailPath}
                    alt={model.name}
                    className="h-44 w-full object-contain"
                  />
                </div>
              )}

              {/* Name */}
              <p className="mt-2 text-xl font-semibold">
                {model.name}
              </p>

              {/* Price */}
              <p className="mt-1 text-sm text-[#3d434b]">
                ${model.price.toLocaleString()}
              </p>

              {/* Optional fields (safe render) */}
              {model.noOfBathrooms !== undefined && (
                <p className="mt-1 text-sm text-[#3d434b]">
                  {model.noOfBathrooms} : Bathroom
                </p>
              )}

              {model.noOfBedrooms !== undefined && (
                <p className="mt-1 text-sm text-[#3d434b]">
                  {model.noOfBedrooms} : Bedroom
                </p>
              )}
            </button>
          );
        })}

        {!modelManager.isLoading &&
          filteredModels.length === 0 && (
            <div className="text-center text-sm text-[#6b7280]">
              No modules found
            </div>
          )}
      </div>
    </aside>
  );
});
