import { observer } from "mobx-react-lite";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { MainContextProvider } from "./context/MainContextProvider";
import MainLayout from "./layout/MainLayout";

export const App = observer(() => {
  return (
    <BrowserRouter>
      <MainContextProvider>
        <Routes>
          <Route path="/" element={<MainLayout />} />
        </Routes>
      </MainContextProvider>
    </BrowserRouter>
  );
});
