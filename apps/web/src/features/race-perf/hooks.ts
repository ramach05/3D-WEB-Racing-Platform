import { useSyncExternalStore } from 'react';
import { getRacePerfSnapshot, subscribeRacePerf } from './store';

/** HUD reads FPS without Redux so the canvas does not re-render */
export const useRacePerf = () => {
  return useSyncExternalStore(subscribeRacePerf, getRacePerfSnapshot, getRacePerfSnapshot);
};
