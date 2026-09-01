import { describe, expect, it } from 'vitest';
import { isValidNickname, isValidPassword } from './validation';

describe('auth validation', () => {
  it('accepts valid nicknames', () => {
    expect(isValidNickname('test_user')).toBe(true);
    expect(isValidNickname('abc')).toBe(true);
    expect(isValidNickname('a'.repeat(20))).toBe(true);
  });

  it('rejects invalid nicknames', () => {
    expect(isValidNickname('ab')).toBe(false);
    expect(isValidNickname('a'.repeat(21))).toBe(false);
    expect(isValidNickname('bad-nick')).toBe(false);
    expect(isValidNickname('кириллица')).toBe(false);
  });

  it('validates password length', () => {
    expect(isValidPassword('1234')).toBe(true);
    expect(isValidPassword('123')).toBe(false);
  });
});
