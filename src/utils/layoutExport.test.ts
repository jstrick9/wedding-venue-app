import { describe, expect, it } from 'vitest';
import { buildPdfFromJpeg } from './layoutExport';

/** Minimal JPEG-ish byte blob (content doesn't matter for structure tests). */
function jpegBytes(len: number): Uint8Array {
  const b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = (i * 7) % 256;
  return b;
}

describe('buildPdfFromJpeg', () => {
  it('produces a structurally valid single-page PDF with correct xref offsets', () => {
    const jpeg = jpegBytes(100);
    const pdf = buildPdfFromJpeg(jpeg, 800, 600);
    const text = new TextDecoder().decode(pdf);

    // Header / trailer / EOF
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.includes('%%EOF')).toBe(true);
    expect(text.includes('/Type /Page')).toBe(true);
    expect(text.includes('/Width 800')).toBe(true);
    expect(text.includes('/Height 600')).toBe(true);
    expect(text.includes('/Filter /DCTDecode')).toBe(true);

    // xref points must be numeric and within range; startxref should point at
    // the xref table.
    const startxrefMatch = /startxref\n(\d+)\n%%EOF/.exec(text);
    expect(startxrefMatch).toBeTruthy();
    const startxref = Number(startxrefMatch![1]);
    expect(startxref).toBeGreaterThan(0);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
  });

  it('embeds the full jpeg bytes in the image stream', () => {
    const jpeg = jpegBytes(256);
    const pdf = buildPdfFromJpeg(jpeg, 200, 100);
    // Find the jpeg bytes inside the pdf (they appear between stream and
    // endstream of the image object).
    const bytes = Array.from(pdf);
    const start = bytes.indexOf(jpeg[0]);
    expect(start).toBeGreaterThan(0);
    // The jpeg sequence should be present.
    expect(pdf.slice(start, start + jpeg.length)).toEqual(jpeg);
  });
});
