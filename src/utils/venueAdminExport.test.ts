import { beforeEach, describe, expect, it } from 'vitest';
import { buildPdfFromJpeg } from './layoutExport';
import { buildBackupBundle } from './backupExport';
import { applyBackupPayload, preflightBackupImport } from './backupImport';
import { setVenues, getVenues, resetToDefaults } from '../hooks/useLayoutState';
import type { Venue } from '../types';

/**
 * Venue-admin persona: Print/export — exporting a floor plan to PDF, and backing
 * up / restoring the venue's data so it survives a restore.
 */
describe('venue admin print/export', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('produces a valid single-page PDF from a JPEG floor-plan image', () => {
    // A tiny 2x2 JPEG (valid DCT header is not required for structure test; the
    // generator embeds bytes verbatim). Use a minimal valid JPEG SOI/EOI.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
    const pdf = buildPdfFromJpeg(jpeg, 800, 600);
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/MediaBox [0 0 800 600]');
    expect(text).toContain('/Filter /DCTDecode');
    // xref + trailer present for a well-formed PDF.
    const startxrefMatch = /startxref\n(\d+)\n%%EOF/.exec(text);
    expect(startxrefMatch).toBeTruthy();
    const startxref = Number(startxrefMatch![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
  });

  it('backup bundle captures venue data and restore round-trips it', async () => {
    // Seed a consistent catalog (venues + table specs + templates) so built-in
    // template references resolve during preflight validation.
    resetToDefaults();
    // Add a custom venue on top of the seeded defaults (which include pavilion etc.
    // referenced by the built-in templates).
    const existing = getVenues();
    setVenues([...existing, { id: 'ballroom', name: 'Grand Ballroom', width: 80, height: 60, capacity: 250, category: 'reception', color: '#fff' }] as Venue[]);

    const bundle = await buildBackupBundle({ id: 'u-admin', name: 'Admin' });
    expect(bundle.manifest.app).toContain('layout-planner');
    expect(bundle.checksums.payloadHash).toBeTruthy();

    // Wipe and restore.
    localStorage.clear();
    const preflight = await preflightBackupImport(bundle);
    expect(preflight.valid).toBe(true);
    applyBackupPayload(bundle.payload, 'replace');
    const restored = getVenues();
    expect(restored.find((v) => v.id === 'ballroom')?.capacity).toBe(250);
  });
});
