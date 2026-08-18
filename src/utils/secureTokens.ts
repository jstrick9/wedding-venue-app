/**
 * Cryptographically strong opaque identifiers used in local-mode invite links.
 *
 * LocalStorage is not a server-side security boundary, but predictable bearer
 * tokens still create accidental cross-couple access during vetting. Keep token
 * generation centralized so every portal link uses Web Crypto consistently.
 */
const TOKEN_BYTES = 24;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createOpaqueToken(prefix: string): string {
  const normalizedPrefix = prefix.trim().replace(/[^a-z0-9_-]/gi, '') || 'token';
  const bytes = new Uint8Array(TOKEN_BYTES);

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto API is required to generate portal tokens.');
  }

  globalThis.crypto.getRandomValues(bytes);
  return `${normalizedPrefix}-${bytesToHex(bytes)}`;
}
