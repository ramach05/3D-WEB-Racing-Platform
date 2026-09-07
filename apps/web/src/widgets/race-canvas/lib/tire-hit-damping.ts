/** Множитель целевой скорости после удара о шину (1 = без штрафа) */
let tireHitDamping = 1;

const HIT_RECOVERY_PER_SEC = 1.5;

/** Зафиксировать штраф скорости (берётся минимум с текущим) */
export const registerTireHit = (factor: number) => {
  tireHitDamping = Math.min(tireHitDamping, Math.max(0, factor));
};

/** Плавно вернуть damping к 1; возвращает текущий множитель */
export const tickTireHitDamping = (dt: number): number => {
  const current = tireHitDamping;
  tireHitDamping = Math.min(1, tireHitDamping + HIT_RECOVERY_PER_SEC * dt);
  return current;
};

export const resetTireHitDamping = () => {
  tireHitDamping = 1;
};
