import { describe, expect, it } from 'vitest';
import { isLampLit, litCountForHud, START_LAMP_COUNT } from './start-light-gantry';

describe('litCountForHud', () => {
  it('maps countdown steps to progressive edge lamps', () => {
    expect(litCountForHud('countdown', 3)).toBe(2);
    expect(litCountForHud('countdown', 2)).toBe(4);
    expect(litCountForHud('countdown', 1)).toBe(5);
    expect(litCountForHud('countdown', 0)).toBe(0);
  });

  it('keeps lamps off outside countdown', () => {
    expect(litCountForHud('ready', 3)).toBe(0);
    expect(litCountForHud('racing', null)).toBe(0);
    expect(litCountForHud('finished', null)).toBe(0);
    expect(litCountForHud('paused', null)).toBe(0);
  });

  it('treats null countdown step as off', () => {
    expect(litCountForHud('countdown', null)).toBe(0);
  });
});

describe('isLampLit', () => {
  it('lights outer pairs first', () => {
    expect([0, 1, 2, 3, 4].map((i) => isLampLit(i, 2))).toEqual([true, false, false, false, true]);
    expect([0, 1, 2, 3, 4].map((i) => isLampLit(i, 4))).toEqual([true, true, false, true, true]);
  });

  it('lights all lamps when litCount covers the row', () => {
    expect([0, 1, 2, 3, 4].every((i) => isLampLit(i, START_LAMP_COUNT))).toBe(true);
  });

  it('lights none when litCount is zero', () => {
    expect([0, 1, 2, 3, 4].some((i) => isLampLit(i, 0))).toBe(false);
  });
});
