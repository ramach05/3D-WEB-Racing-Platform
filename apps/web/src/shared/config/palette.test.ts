import { describe, expect, it } from 'vitest';
import {
  billboardPalette,
  kerbPalette,
  scenePalette,
  startLightPalette,
  streetLampPalette,
  trackPalettes,
  uiPalette,
} from './palette';

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
    expect(scenePalette.skidMark).toBe('#1c1c1e');
  });

  it('has start-light gantry structure colors', () => {
    expect(startLightPalette.steel).toBeTruthy();
    expect(startLightPalette.steelDark).toBeTruthy();
    expect(startLightPalette.housing).toBeTruthy();
    expect(startLightPalette.bezel).toBeTruthy();
    expect(startLightPalette.red).toBeTruthy();
    expect(startLightPalette.floodLight).toBeTruthy();
    // Smoked glass, не slate-blue
    expect(startLightPalette.idle).toBe('#14080a');
    expect(startLightPalette.steel).toBe('#1a1c20');
  });

  it('has warm street-lamp colors', () => {
    expect(streetLampPalette.pole).toBeTruthy();
    expect(streetLampPalette.arm).toBeTruthy();
    expect(streetLampPalette.housing).toBeTruthy();
    expect(streetLampPalette.lens).toBeTruthy();
    expect(streetLampPalette.light).toBeTruthy();
  });

  it('has red/white kerb colors', () => {
    expect(kerbPalette.red).toBeTruthy();
    expect(kerbPalette.white).toBeTruthy();
  });

  it('has billboard structure and ad colors', () => {
    expect(billboardPalette.pole).toBeTruthy();
    expect(billboardPalette.frame).toBeTruthy();
    expect(billboardPalette.panelBack).toBeTruthy();
    expect(billboardPalette.floodArm).toBeTruthy();
    expect(billboardPalette.floodHousing).toBeTruthy();
    expect(billboardPalette.floodBulbOn).toBeTruthy();
    expect(billboardPalette.floodLight).toBeTruthy();
    expect(billboardPalette.ads['torque-cola'].background).toBeTruthy();
    expect(billboardPalette.ads['for-rent'].foreground).toBeTruthy();
  });
});
