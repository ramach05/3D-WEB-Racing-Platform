import { describe, expect, it } from 'vitest';
import { enMessages, ruMessages } from './messages';

type TMessageTree = string | readonly string[] | { readonly [key: string]: TMessageTree };

const collectKeys = (value: TMessageTree, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
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
