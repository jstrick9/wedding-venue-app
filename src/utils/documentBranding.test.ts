import { afterEach, describe, expect, it } from 'vitest';
import {
  applyDocumentBranding,
  formatDocumentTitle,
  letterFaviconHref,
  safeHexColor,
  safeLogoHref,
} from './documentBranding';

describe('document branding', () => {
  afterEach(() => {
    document.title = '';
  });

  it('formats a branding name with an optional portal suffix', () => {
    expect(formatDocumentTitle('Hilltop Barn')).toBe('Hilltop Barn');
    expect(formatDocumentTitle('Hilltop Barn', 'Couples Portal')).toBe('Hilltop Barn | Couples Portal');
    expect(formatDocumentTitle('Hilltop Barn', 'Hilltop Barn')).toBe('Hilltop Barn');
    expect(formatDocumentTitle('', '')).toBe('Wedding Venue Intelligence Platform');
  });

  it('accepts only image logos and hex colors', () => {
    expect(safeLogoHref('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
    expect(safeLogoHref('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(safeLogoHref('javascript:alert(1)')).toBeNull();
    expect(safeHexColor('#26354A')).toBe('#26354A');
    expect(safeHexColor('red')).toBe('#26354A');
  });

  it('builds a letter favicon from the branding name and color', () => {
    const href = letterFaviconHref('Acme Chapel', '#111827');
    expect(href.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(href.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('>A<');
    expect(svg).toContain('#111827');
    expect(svg).not.toContain('#4A1942');
  });

  it('applies the tab title, favicon, and theme color from branding', () => {
    applyDocumentBranding({
      name: 'Platform Console',
      logoUrl: 'https://cdn.example/platform.png',
      primaryColor: '#26354A',
    });
    expect(document.title).toBe('Platform Console');
    const icon = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    expect(icon?.href).toContain('platform.png');
    const theme = document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    expect(theme?.content).toBe('#26354A');
  });
});
