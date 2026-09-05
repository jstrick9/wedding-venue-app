import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPdfFromJpeg, cloneAndNormalizeSvg, inlineSvgImages } from './layoutExport';

/** Minimal JPEG-ish byte blob (content doesn't matter for structure tests). */
function jpegBytes(len: number): Uint8Array {
  const b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = (i * 7) % 256;
  return b;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SVG export preparation', () => {
  it('preserves authored map coordinates while changing raster dimensions', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 80');
    svg.setAttribute('style', 'transform: scale(2)');
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    point.setAttribute('cx', '50');
    point.setAttribute('cy', '40');
    svg.appendChild(point);

    const clone = cloneAndNormalizeSvg(svg, 300, 240, '0 0 100 80');
    expect(clone.getAttribute('viewBox')).toBe('0 0 100 80');
    expect(clone.getAttribute('width')).toBe('300');
    expect(clone.getAttribute('height')).toBe('240');
    expect(clone.getAttribute('style')).toBeNull();
    expect(clone.querySelector('circle')).toHaveAttribute('cx', '50');
  });

  it('embeds a remote raster image instead of silently deleting it', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', 'https://cdn.example.test/property.png');
    svg.appendChild(image);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    } as Response));

    await inlineSvgImages(svg);
    expect(svg.querySelector('image')).not.toBeNull();
    expect(image.getAttribute('href')).toMatch(/^data:image\/png;base64,/);
  });

  it('fails explicitly when a remote image cannot be embedded', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', 'https://blocked.example.test/property.png');
    svg.appendChild(image);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));

    await expect(inlineSvgImages(svg)).rejects.toThrow(/could not be loaded for export/i);
    expect(svg.querySelector('image')).not.toBeNull();
  });
});

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

    const xrefBlock = text.slice(startxref, text.indexOf('trailer', startxref));
    const lines = xrefBlock.trimEnd().split('\n');
    expect(lines[0]).toBe('xref');
    expect(lines[1]).toBe('0 6');
    expect(lines).toHaveLength(8); // header + range + one free entry + five objects
    expect(lines[2]).toBe('0000000000 65535 f ');
    for (let objectNumber = 1; objectNumber <= 5; objectNumber += 1) {
      const offset = Number(lines[objectNumber + 2].slice(0, 10));
      expect(text.slice(offset, offset + `${objectNumber} 0 obj`.length)).toBe(`${objectNumber} 0 obj`);
    }
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
