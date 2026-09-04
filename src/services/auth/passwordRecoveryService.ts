import type { PasswordResetSurface } from '../../utils/passwordResetRoute';
import { buildPasswordResetRedirectUrl } from '../../utils/passwordResetRoute';
import { isSupabaseConfigured } from '../backend/supabaseClient';

export const PASSWORD_RESET_REQUEST_FUNCTION = 'request-password-reset';
export const PASSWORD_RESET_UNAVAILABLE_MESSAGE =
  'Password reset is temporarily unavailable. Please try again later or contact support.';

export interface RequestPasswordResetParams {
  email: string;
  surface: PasswordResetSurface;
  organizationId?: string;
}

function functionUrl(name: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/functions/v1/${name}`;
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidPasswordResetEmail(value: string): boolean {
  const email = normalizedEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Requests a branded reset email without exposing account existence or raw
 * service errors to the browser UI. The public endpoint derives membership and
 * venue context server-side.
 */
export async function requestPasswordReset({
  email,
  surface,
  organizationId,
}: RequestPasswordResetParams): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
  const normalized = normalizedEmail(email);
  if (!isValidPasswordResetEmail(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  if (surface === 'venue' && !organizationId) {
    throw new Error(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
  }

  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  let response: Response;
  try {
    response = await fetch(functionUrl(PASSWORD_RESET_REQUEST_FUNCTION), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalized,
        surface,
        organizationId: surface === 'venue' ? organizationId : undefined,
        redirectTo: buildPasswordResetRedirectUrl(surface),
      }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) throw new Error(PASSWORD_RESET_UNAVAILABLE_MESSAGE);

  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) {
    throw new Error(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
  }
}

export function describePasswordResetRequestError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Enter a valid email address.') return error.message;
    if (error.message === PASSWORD_RESET_UNAVAILABLE_MESSAGE) return error.message;
    if (/timed out/i.test(error.message)) {
      return 'The request timed out. Check your connection and try again.';
    }
  }
  return PASSWORD_RESET_UNAVAILABLE_MESSAGE;
}
