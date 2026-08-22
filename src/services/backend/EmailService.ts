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

function errorFromUnknown(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'error' in value) {
    const nested = (value as { error?: unknown }).error;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

async function describeFunctionError(error: unknown, data: unknown): Promise<string> {
  const fromData = errorFromUnknown(data);
  if (fromData) return fromData;
  if (error && typeof error === 'object' && error !== null) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx && typeof (ctx as { json: unknown }).json === 'function') {
      try {
        const body = await (ctx as { json: () => Promise<unknown> }).json();
        const fromBody = errorFromUnknown(body);
        if (fromBody) return fromBody;
      } catch {
        // ignore unreadable function error bodies
      }
    }
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      const message = (error as { message: string }).message.trim();
      if (message) return message;
    }
  }
  return 'Email delivery failed.';
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Email delivery requires Supabase Edge Functions configuration.');
  }

  const { data, error } = await getSupabaseClient().functions.invoke('send-email', {
    body: params,
  });

  if (error) throw new Error(await describeFunctionError(error, data));
  const payloadError = errorFromUnknown(data);
  if (payloadError && !(data && typeof data === 'object' && 'ok' in data && (data as { ok?: unknown }).ok === true)) {
    throw new Error(payloadError);
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
