import { describe, expect, it } from 'vitest';
import { enMessages, ruMessages } from './messages';

const collectKeys = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object') {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('messages', () => {
  it('keeps ru and en key parity', () => {
    const ruKeys = collectKeys(ruMessages).sort();
    const enKeys = collectKeys(enMessages).sort();

    expect(enKeys).toEqual(ruKeys);
  });
});
