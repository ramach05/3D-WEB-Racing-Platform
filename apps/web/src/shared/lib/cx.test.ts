import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins non-empty class names', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy and empty parts', () => {
    expect(cx('btn', false, null, '', 'active')).toBe('btn active');
  });

  it('returns empty string for no parts', () => {
    expect(cx()).toBe('');
  });
});
