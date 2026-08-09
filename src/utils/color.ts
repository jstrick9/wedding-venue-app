/**
 * Small color helpers used by the branding editor to derive consistent
 * shade variants (dark/light) from a single brand color.
 */

function normalizeHex(hex: string): string {
  let value = (hex || '').trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#4A1942';
  return `#${value.toLowerCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const to2 = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;
  const max = Math.max(rs, gs, bs);
  const min = Math.min(rs, gs, bs);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rs) h = ((gs - bs) / delta) % 6;
    else if (max === gs) h = (bs - rs) / delta + 2;
    else h = (rs - gs) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export interface DerivedShades {
  dark: string;
  light: string;
}

/**
 * Derive a darker and lighter variant of a base color while preserving hue.
 * `darkAmount`/`lightAmount` are fractional moves along the lightness axis.
 */
export function deriveShades(
  hex: string,
  darkAmount = 0.14,
  lightAmount = 0.12,
): DerivedShades {
  const { h, s, l } = hexToHsl(hex);
  const dark = hslToHex(h, s, Math.max(0, l - darkAmount * 100));
  const light = hslToHex(h, s, Math.min(100, l + lightAmount * 100));
  return { dark, light };
}

export function getLuminance(hexColor: string): number {
  const { r, g, b } = hexToRgb(hexColor);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}
