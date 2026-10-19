import { useSyncExternalStore } from 'react';
import { getRaceHudSnapshot, subscribeRaceHud } from './store';
import type { TRaceHudSnapshot } from './store.types';

/** The primitive is needed for Object.is comparison in useSyncExternalStore: an object would always rerender */
type TSelectorResult = string | number | boolean | null;

/** HUD reads the simulation without Redux so the canvas does not rerender */
export const useRaceHud = () => {
  return useSyncExternalStore(subscribeRaceHud, getRaceHudSnapshot, getRaceHudSnapshot);
};

/**
 * Subscription to a single snapshot field: rerender only when it changes.
 * Needed where only the status matters — otherwise each countdown step repaints the page with the 3D scene.
 */
export const useRaceHudSelector = <T extends TSelectorResult>(
  selector: (snapshot: TRaceHudSnapshot) => T,
): T =>
  useSyncExternalStore(
    subscribeRaceHud,
    () => selector(getRaceHudSnapshot()),
    () => selector(getRaceHudSnapshot()),
  );
