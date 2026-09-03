import { useSyncExternalStore } from 'react';
import { getRacePerfSnapshot, subscribeRacePerf } from './store';

/** HUD читает FPS без Redux, чтобы канвас не ре-рендерился */
export const useRacePerf = () => {
  return useSyncExternalStore(subscribeRacePerf, getRacePerfSnapshot, getRacePerfSnapshot);
};
