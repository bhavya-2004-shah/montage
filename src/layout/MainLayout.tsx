import { observer } from "mobx-react-lite";
import { Viewer } from "../components/viewer/Viewer";
import { Viewer3D } from "../components/viewer3d/Viewer3D";

export const MainLayout = observer(() => {
  return (
    <div className="h-screen w-screen grid grid-cols-1 grid-rows-[45%_55%] md:grid-cols-[30%_70%] md:grid-rows-1">
      <div className="h-full min-h-0 border-r border-[#d8dbe2]">
        <Viewer />
      </div>

      <div className="h-full min-h-0">
        <Viewer3D />
      </div>
    </div>
  );
});

export default MainLayout;
