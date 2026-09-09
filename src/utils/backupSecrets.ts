/**
 * Backup secrets redaction.
 *
 * The backup bundle is a full snapshot of every persistent domain, which
 * includes security material: PBKDF2 password hashes/salts, guest/couple portal
 * tokens, collaborator invite tokens, and portal password fields. That material
 * must never be exported to a shareable file in cleartext.
 *
 * Design:
 *  - `buildBackupBundle()` continues to produce the FULL, un-redacted payload and
 *    checksum. It is used internally for the same-device rollback snapshot, where
 *    secrets must be preserved so a restore can actually restore local accounts.
 *  - `buildRedactedExportBundle()` (used by `downloadBackupBundle`) deep-clones the
 *    payload, replaces every sensitive field with `REDACTION_MARKER`, and recomputes
 *    the checksum over the redacted payload so the exported file is self-consistent.
 *  - Import detects the marker: `applyBackupPayload()` skips any domain whose value
 *    contains a redaction marker so a redacted export can never overwrite live
 *    secrets on the device that produced it (and obviously can't on another device).
 */

/** Marker used in exported files in place of real secret values. */
export const REDACTION_MARKER = '[REDACTED]';

/**
 * Sensitive field names, matched (case-insensitive) against object keys. Broad
 * enough to cover the current model (see src/types.ts) and future additions
 * without needing a per-type allowlist.
 */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwordhash',
  'passwordsalt',
  'portalpassword',
  'portalpasswordhash',
  'portalpasswordsalt',
  'token',
  'tokenhash',
  'tokensalt',
  'invitetoken',
  'invitetokenhash',
  'coupletoken',
  'coupletokenhash',
  'collaboratortoken',
  'collaboratortokenhash',
  'guesttoken',
  'guesttokenhash',
  'bearertoken',
  'portal_token',
  'portal_token_hash',
  'couple_token_hash',
  'collaborator_token_hash',
  'access_token',
  'refreshtoken',
  'refresh_token',
]);

/** Normalize a key for membership checks. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const NORMALIZED_SENSITIVE = new Set(
  Array.from(SENSITIVE_KEYS).map((key) => normalizeKey(key)),
);

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return NORMALIZED_SENSITIVE.has(normalized)
    || normalized.endsWith('password')
    || normalized.endsWith('passwordhash')
    || normalized.endsWith('passwordsalt')
    || normalized.endsWith('token')
    || normalized.endsWith('tokenhash')
    || normalized.endsWith('tokensalt')
    || normalized.endsWith('secret')
    || normalized.endsWith('secretkey')
    || normalized.endsWith('apikey')
    || normalized.endsWith('privatekey')
    || normalized.endsWith('authorization');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively redact sensitive fields in a deep clone. */
export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        next[key] = REDACTION_MARKER;
      } else {
        next[key] = redactValue(child);
      }
    }
    return next;
  }
  return value;
}

/**
 * Recovery JSON must remain importable as one fingerprinted document. Omit
 * secret-bearing properties instead of inserting a marker that would make the
 * entire recovery domain intentionally non-restorable.
 */
export function redactValueByOmittingSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValueByOmittingSecrets(item));
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isSensitiveKey(key)) continue;
      next[key] = redactValueByOmittingSecrets(child);
    }
    return next;
  }
  return value;
}

/**
 * Deep-search whether a value (or any nested value) equals the redaction marker.
 * Used by import to skip domains that were exported redacted.
 */
export function containsRedaction(value: unknown): boolean {
  if (value === REDACTION_MARKER) return true;
  if (Array.isArray(value)) return value.some((item) => containsRedaction(item));
  if (isPlainObject(value)) return Object.values(value).some((child) => containsRedaction(child));
  return false;
}

/**
 * Count how many sensitive fields were redacted in a value. Used for the import
 * report so the user knows which domains carried redacted security material.
 */
export function countRedactedFields(value: unknown): number {
  if (value === REDACTION_MARKER) return 1;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countRedactedFields(item), 0);
  }
  if (isPlainObject(value)) {
    return Object.values(value).reduce<number>(
      (sum, child) => sum + countRedactedFields(child),
      0,
    );
  }
  return 0;
}
