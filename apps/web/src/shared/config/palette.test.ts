import { describe, expect, it } from 'vitest';
import { scenePalette, trackPalettes, uiPalette } from './palette';

describe('palette', () => {
  it('has light and dark ui tokens', () => {
    expect(uiPalette.light.bg).toBeTruthy();
    expect(uiPalette.dark.bg).toBeTruthy();
    expect(uiPalette.light.fg).toBeTruthy();
    expect(uiPalette.dark.fg).toBeTruthy();
  });

  it('has coastal and night track palettes', () => {
    expect(trackPalettes.coastal.minimapBg).toBeTruthy();
    expect(trackPalettes.night.minimapBg).toBeTruthy();
  });

  it('has scene neutrals', () => {
    expect(scenePalette.white).toBe('#ffffff');
    expect(scenePalette.black).toBe('#000000');
  });
});
