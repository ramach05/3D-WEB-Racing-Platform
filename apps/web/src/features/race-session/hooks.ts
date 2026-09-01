import { useSyncExternalStore } from 'react';
import { getRaceHudSnapshot, subscribeRaceHud } from './store';

/** HUD читает симуляцию без Redux, чтобы канвас не ре-рендерился */
export const useRaceHud = () => {
  return useSyncExternalStore(subscribeRaceHud, getRaceHudSnapshot, getRaceHudSnapshot);
};
