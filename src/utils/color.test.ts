import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, deriveShades, hexToRgb } from './color';

describe('color utilities', () => {
  it('converts a known hex to HSL', () => {
    // #4A1942 is a deep plum
    const { h, s, l } = hexToHsl('#4A1942');
    expect(h).toBeGreaterThanOrEqual(310);
    expect(h).toBeLessThanOrEqual(320);
    expect(s).toBeGreaterThan(45);
    expect(l).toBeGreaterThan(15);
    expect(l).toBeLessThan(25);
  });

  it('round-trips hex -> HSL -> hex approximately (channel tolerance for rounding)', () => {
    const original = hexToRgb('#4A1942');
    const { h, s, l } = hexToHsl('#4A1942');
    const roundTripped = hexToRgb(hslToHex(h, s, l));
    // Allow a couple of points of rounding drift per channel.
    expect(Math.abs(roundTripped.r - original.r)).toBeLessThanOrEqual(3);
    expect(Math.abs(roundTripped.g - original.g)).toBeLessThanOrEqual(3);
    expect(Math.abs(roundTripped.b - original.b)).toBeLessThanOrEqual(3);
  });

  it('derives a lighter and a darker shade', () => {
    const { dark, light } = deriveShades('#4A1942');
    expect(light).not.toBe(dark);
    // Light variant is lighter, dark variant is darker.
    expect(hexToHsl(light).l).toBeGreaterThan(hexToHsl('#4A1942').l);
    expect(hexToHsl(dark).l).toBeLessThan(hexToHsl('#4A1942').l);
  });

  it('clamps and never returns an invalid hex', () => {
    const { dark, light } = deriveShades('#000000');
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(light).toMatch(/^#[0-9a-f]{6}$/);
  });
});
