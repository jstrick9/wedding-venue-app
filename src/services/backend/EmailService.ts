import type { AuthSurface } from '../../utils/authSurface';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type EmailPurpose =
  | 'invitation'
  | 'venue_admin_invite'
  | 'password_reset'
  | 'rsvp_confirmation'
  | 'staff_notification';

export interface SendTransactionalEmailParams {
  to: string;
  purpose: EmailPurpose;
  organizationId: string;
  eventId?: string;
  templateData?: Record<string, unknown>;
}

const SEND_EMAIL_TIMEOUT_MS = 25000;

function errorFromUnknown(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'error' in value) {
    const nested = (value as { error?: unknown }).error;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

export function describeEmailDeliveryFailure(error: unknown, data?: unknown): string {
  const message = `${errorFromUnknown(data)} ${
    error && typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''
  }`.trim();
  if (/unauthorized|forbidden|permission/i.test(message)) {
    return 'Your session no longer has permission to send this email. Sign in again and retry.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many emails were requested. Wait a few minutes and try again.';
  }
  if (/timed out|timeout/i.test(message)) {
    return 'Email delivery timed out. Check your connection and try again.';
  }
  return 'Email delivery is temporarily unavailable. Try again later or copy the invitation link instead.';
}

async function describeFunctionError(error: unknown, data: unknown): Promise<string> {
  if (error && typeof error === 'object' && error !== null) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx && typeof (ctx as { json: unknown }).json === 'function') {
      try {
        const body = await (ctx as { json: () => Promise<unknown> }).json();
        if (errorFromUnknown(body)) return describeEmailDeliveryFailure(error, body);
      } catch {
        // ignore unreadable function error bodies
      }
    }
  }
  return describeEmailDeliveryFailure(error, data);
}

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
  surface?: AuthSurface,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Email delivery is temporarily unavailable. Try again later or copy the invitation link instead.');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const clientSurface = surface || (params.purpose === 'venue_admin_invite' ? 'platform' : undefined);
    const invoked = getSupabaseClient(clientSurface).functions.invoke('send-email', { body: params });
    const { data, error } = await Promise.race([
      invoked,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Email delivery timed out. Check your connection and try again.'));
        }, SEND_EMAIL_TIMEOUT_MS);
      }),
    ]);

    if (error) throw new Error(await describeFunctionError(error, data));
    const payloadError = errorFromUnknown(data);
    if (payloadError && !(data && typeof data === 'object' && 'ok' in data && (data as { ok?: unknown }).ok === true)) {
      throw new Error(describeEmailDeliveryFailure(undefined, data));
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function buildInvitationTemplateData(params: {
  recipientName: string;
  organizationName: string;
  inviteUrl: string;
}): SendTransactionalEmailParams['templateData'] {
  return {
    recipientName: params.recipientName,
    organizationName: params.organizationName,
    inviteUrl: params.inviteUrl,
  };
}
