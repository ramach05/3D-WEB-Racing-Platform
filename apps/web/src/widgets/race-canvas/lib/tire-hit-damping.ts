/** Target speed multiplier after hitting a tire (1 = no penalty) */
let tireHitDamping = 1;

const HIT_RECOVERY_PER_SEC = 3;

/** Record a speed penalty (takes the minimum with the current one) */
export const registerTireHit = (factor: number) => {
  tireHitDamping = Math.min(tireHitDamping, Math.max(0, factor));
};

/** Smoothly returns damping toward 1; returns the current multiplier */
export const tickTireHitDamping = (dt: number): number => {
  const current = tireHitDamping;
  tireHitDamping = Math.min(1, tireHitDamping + HIT_RECOVERY_PER_SEC * dt);
  return current;
};

/** Resets the speed penalty after hitting a tire */
export const resetTireHitDamping = () => {
  tireHitDamping = 1;
};
