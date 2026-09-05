/**
 * Floor-plan layout export: renders the on-canvas SVG to a high-res PNG and to
 * a single-page PDF (dependency-free — the PDF embeds a JPEG of the plan).
 *
 * The FloorPlanCanvas is an <svg>; we clone it, normalize it for export, draw
 * it to an offscreen canvas, and produce:
 *  - PNG  via canvas.toBlob('image/png')
 *  - PDF  via a minimal PDF generator that embeds the JPEG as a DCTDecode image
 *
 * Images: data URLs pass through. Blob, signed-storage, and remote image URLs
 * are fetched and embedded before rasterization. Export fails explicitly when an
 * image cannot be embedded, rather than silently producing an incomplete map.
 */

export interface ExportOptions {
  /** Multiplier on the SVG's intrinsic pixel size (default 2 for crisp output). */
  scale?: number;
  /** White padding around the plan, in export pixels (default 24). */
  padding?: number;
}

const ENCODED_HEADER = '%PDF-1.4\n';

export function cloneAndNormalizeSvg(
  svg: SVGSVGElement,
  widthPx: number,
  heightPx: number,
  fallbackViewBox: string,
): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Export from the SVG's authored coordinate system, not from CSS pan/zoom.
  // Pixel dimensions control raster resolution; preserving the original viewBox
  // keeps map coordinates and aspect ratio correct.
  clone.removeAttribute('style');
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  clone.setAttribute('viewBox', svg.getAttribute('viewBox') || fallbackViewBox);
  clone.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return clone;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not encode an image for export.'));
    reader.onerror = () => reject(new Error('Could not encode an image for export.'));
    reader.readAsDataURL(blob);
  });
}

export async function inlineSvgImages(svg: SVGSVGElement): Promise<void> {
  const images = Array.from(svg.querySelectorAll('image'));
  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute('href') || image.getAttribute('xlink:href') || '';
    if (!href || href.startsWith('data:')) return;

    let response: Response;
    try {
      response = await fetch(href, { credentials: 'same-origin' });
    } catch {
      throw new Error('The map image could not be loaded for export. Upload it to the venue map instead of using a blocked external URL.');
    }
    if (!response.ok) {
      throw new Error(`The map image could not be loaded for export (HTTP ${response.status}).`);
    }
    const blob = await response.blob();
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(blob.type)) {
      throw new Error('The map image has an unsupported file type for export. Use PNG, JPEG, WebP, or GIF.');
    }
    if (blob.size > 12 * 1024 * 1024) {
      throw new Error('The map image is too large to embed in an export.');
    }
    const dataUrl = await blobToDataUrl(blob);
    image.setAttribute('href', dataUrl);
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
  }));
}

function svgToXmlString(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Render the given SVG (normalized) to an offscreen canvas and return it.
 */
export async function renderSvgToCanvas(
  svg: SVGSVGElement,
  options: ExportOptions = {},
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const scale = options.scale ?? 2;
  const padding = options.padding ?? 24;

  // Intrinsic plan size in SVG user units (the venue canvas dimensions).
  const rawW = Math.max(1, svg.viewBox.baseVal?.width || svg.clientWidth || 480);
  const rawH = Math.max(1, svg.viewBox.baseVal?.height || svg.clientHeight || 320);

  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Export scale must be greater than zero.');
  if (!Number.isFinite(padding) || padding < 0) throw new Error('Export padding cannot be negative.');

  const contentWidth = Math.max(1, Math.round(rawW * scale));
  const contentHeight = Math.max(1, Math.round(rawH * scale));
  const width = contentWidth + padding * 2;
  const height = contentHeight + padding * 2;

  const clone = cloneAndNormalizeSvg(svg, contentWidth, contentHeight, `0 0 ${rawW} ${rawH}`);
  await inlineSvgImages(clone);
  const xml = svgToXmlString(clone);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  // White background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, width - padding * 2, height - padding * 2);
      resolve({ canvas, width, height });
    };
    img.onerror = () => reject(new Error('Could not render the layout image.'));
    img.src = svgDataUrl;
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the layout as a PNG file. */
export async function downloadLayoutPng(
  svg: SVGSVGElement,
  filename: string,
  options: ExportOptions = {},
): Promise<void> {
  const { canvas } = await renderSvgToCanvas(svg, options);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png');
  });
  triggerDownload(blob, `${filename}.png`);
}

// ── Minimal PDF generator (single page, embedded JPEG) ──────────────────────

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Build a minimal single-page PDF embedding a JPEG image.
 * Only used for floor-plan export; not a general-purpose writer.
 */
export function buildPdfFromJpeg(jpegBytes: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    pos += bytes.length;
  };
  const objStart = () => {
    offsets.push(pos);
  };

  push(ascii(ENCODED_HEADER));

  // Object 1 — Catalog
  objStart();
  push(ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  // Object 2 — Pages
  objStart();
  push(ascii('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  // Object 3 — Page
  objStart();
  push(
    ascii(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${imgW} ${imgH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    ),
  );
  // Object 4 — Image XObject (JPEG)
  objStart();
  push(
    ascii(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    ),
  );
  push(jpegBytes);
  push(ascii('\nendstream\nendobj\n'));
  // Object 5 — Content stream
  objStart();
  const content = `q ${imgW} 0 0 ${imgH} 0 0 cm /Im0 Do Q`;
  push(
    ascii(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`),
  );

  const xrefPos = pos;
  const xrefEntries = offsets.map(
    (offset) => `${String(offset).padStart(10, '0')} 00000 n `,
  );
  push(
    ascii(
      `xref\n0 6\n0000000000 65535 f \n${xrefEntries.join('\n')}\n` +
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
    ),
  );

  return concat(chunks);
}

/** Export the layout as a PDF file. */
export async function downloadLayoutPdf(
  svg: SVGSVGElement,
  filename: string,
  options: ExportOptions = {},
): Promise<void> {
  const { canvas } = await renderSvgToCanvas(svg, options);

  // JPEG for PDF embedding (DCTDecode).
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = jpegDataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const pdf = buildPdfFromJpeg(bytes, canvas.width, canvas.height);
  const blob = new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' });
  triggerDownload(blob, `${filename}.pdf`);
}
