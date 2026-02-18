import type { ReactNode } from 'react';

import { StateManager } from '../state/StateManager';
import { MainContext } from './MainContext';

export const MainContextProvider = ({ children }: { children: ReactNode }) => {
  return (
    <MainContext.Provider value={new StateManager()}>
      {children}
    </MainContext.Provider>
  );
};
