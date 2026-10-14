import { useSyncExternalStore } from 'react';
import { getRaceHudSnapshot, subscribeRaceHud } from './store';
import type { TRaceHudSnapshot } from './store.types';

/** Примитив нужен ради Object.is-сравнения в useSyncExternalStore: объект всегда дал бы ререндер */
type TSelectorResult = string | number | boolean | null;

/** HUD читает симуляцию без Redux, чтобы канвас не ре-рендерился */
export const useRaceHud = () => {
  return useSyncExternalStore(subscribeRaceHud, getRaceHudSnapshot, getRaceHudSnapshot);
};

/**
 * Подписка на одно поле снимка: ререндер только при его смене.
 * Нужен там, где важен только статус, — иначе шаг обратного отсчета перерисовывает страницу с 3D-сценой.
 */
export const useRaceHudSelector = <T extends TSelectorResult>(
  selector: (snapshot: TRaceHudSnapshot) => T,
): T =>
  useSyncExternalStore(
    subscribeRaceHud,
    () => selector(getRaceHudSnapshot()),
    () => selector(getRaceHudSnapshot()),
  );
