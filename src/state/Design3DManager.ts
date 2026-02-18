import { makeAutoObservable } from "mobx";
import { StateManager } from "./StateManager";


export class Design3DManager {
  stateManager: StateManager;
 

  constructor(stateManager: StateManager) {
   
    this.stateManager = stateManager;
    
  

    makeAutoObservable(this);

   
  }
}
