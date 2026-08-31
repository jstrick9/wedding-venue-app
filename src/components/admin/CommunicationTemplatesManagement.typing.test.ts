import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #256 (campaign units 1.18 + 1.19): pins the defects found when
 * SecurityAuditManagement and CommunicationTemplatesManagement left
 * `@ts-nocheck`.
 *
 * F-256-1 (P3 UX bug — fixed, same family as F-255-1): both panels
 * destructured `onShowSuccess` from AdminCommonProps, but the prop is named
 * `showSuccess` (passed via commonProps). Always undefined → 5 toasts each
 * never fired since creation. Security: save settings, clear cache (×2),
 * export CSV, export JSON. Templates: create, remove, reset, save wording,
 * copy merge tag. Both test fixtures had mocked the phantom name and were
 * upgraded alongside.
 *
 * F-256-2 (P3 UX bug — fixed): CommunicationTemplates' "Save Wording
 * Defaults" button toasted success but persisted NOTHING — email
 * subject/body were hardcoded-initial local state, so every edit was lost
 * on reload. The save now writes localStorage (STORAGE_KEYS.
 * EMAIL_WORDING_DEFAULTS) and emits data-changed; state initializes from
 * storage via loadEmailWording().
 */
describe('Review #256 typing fixes', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  const security = read('src/components/admin/SecurityAuditManagement.tsx');
  const templates = read('src/components/admin/CommunicationTemplatesManagement.tsx');

  it('SecurityAuditManagement calls the real showSuccess prop (F-256-1)', () => {
    expect(security.match(/showSuccess[(]/g)?.length).toBe(5);
    expect(security).not.toMatch(/onShowSuccess/);
    expect(security).toMatch(/^ {2}const \{ config, showSuccess \} = props;$/m);
  });

  it('CommunicationTemplatesManagement calls the real showSuccess prop (F-256-1)', () => {
    expect(templates.match(/showSuccess[(]/g)?.length).toBe(5);
    expect(templates).not.toMatch(/onShowSuccess/);
    expect(templates).toMatch(/^ {2}const \{ config, showSuccess \} = props;$/m);
  });

  it('Save Wording Defaults persists and reloads (F-256-2)', () => {
    // the save handler writes storage before toasting…
    expect(templates).toMatch(/STORAGE_KEYS\.EMAIL_WORDING_DEFAULTS/);
    expect(templates).toMatch(/emitDataChanged\('all'\);/);
    // …and the editors initialize from storage, not hardcoded literals
    expect(templates).toMatch(/useState\(\(\) => loadEmailWording\(\)\.subject\)/);
    expect(templates).toMatch(/useState\(\(\) => loadEmailWording\(\)\.body\)/);
    expect(templates).toMatch(/export function loadEmailWording\(\)/);
  });
});
