/**
 * Троттлинг отклика на удар препятствия: при churn'е решателя одна пара «шина <->
 * машина» многократно входит в контакт подряд. Без окна этого модуля штраф скорости,
 * звук и тряска перезапускались на каждый collisionEnter и держались все время
 * контакта. Импульс «схода с бампера» при троттлинге сохраняется.
 */

/** Окно, в котором повторный удар того же тела не дает штрафа/звука/тряски, мс */
export const HIT_THROTTLE_MS = 400;

const lastHitAtByHandle = new Map<number, number>();

/** true — отклик пропустить (окно открыто); false — первый удар, окно начинается заново */
export const isObstacleHitThrottled = (handle: number, nowMs: number): boolean => {
  const last = lastHitAtByHandle.get(handle);
  if (last !== undefined && nowMs - last < HIT_THROTTLE_MS) {
    return true;
  }
  lastHitAtByHandle.set(handle, nowMs);
  return false;
};

/** Забыть все окна (старта гонки/рестарт: handles тел пересоздаются) */
export const resetObstacleHitThrottle = (): void => {
  lastHitAtByHandle.clear();
};
