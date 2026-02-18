
import { observer } from "mobx-react-lite";
import { useMainContext } from "../../hooks/useMainContext";
import { Canvas3D } from "./Canvas3D/Canvas3D";

export const Viewer3D = observer(() => {
  const stateManager = useMainContext();
  const is2D = stateManager.viewMode === "2d";

  return (
    <section className="h-full w-full bg-[#eef0f3] p-4">
      <div className="mb-3 inline-flex rounded-md border border-[#d8dbe2] bg-white p-1">
        <button
          type="button"
          onClick={() => stateManager.setViewMode("2d")}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            is2D ? "bg-[#1f2328] text-white" : "text-[#4a515a]"
          }`}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => stateManager.setViewMode("3d")}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            !is2D ? "bg-[#1f2328] text-white" : "text-[#4a515a]"
          }`}
        >
          3D
        </button>
      </div>

      <div className="h-[calc(100%-52px)] w-full overflow-hidden rounded-lg border border-[#d8dbe2] bg-white">
        <Canvas3D />
      </div>
    </section>
  );
});
