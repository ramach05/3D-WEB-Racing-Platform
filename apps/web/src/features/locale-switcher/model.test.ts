import { beforeEach, describe, expect, it } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/shared/config';
import { persistLocale, readStoredLocale, toggleLocale } from './model';

describe('locale model', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to ru when unset', () => {
    expect(readStoredLocale()).toBe('ru');
  });

  it('reads a stored locale', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

    expect(readStoredLocale()).toBe('en');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de');

    expect(readStoredLocale()).toBe('ru');
  });

  it('persists locale to storage', () => {
    persistLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('toggles between ru and en', () => {
    expect(toggleLocale('ru')).toBe('en');
    expect(toggleLocale('en')).toBe('ru');
  });
});
