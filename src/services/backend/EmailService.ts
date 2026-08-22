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
  const fromData = errorFromUnknown(data);
  if (fromData) return fromData;
  if (error && typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    const message = (error as { message: string }).message.trim();
    if (/failed to send a request to the edge function/i.test(message)) {
      return 'The send-email function did not respond. Connect Outlook in Platform Console → Email (SMTP ports are blocked on Supabase Edge).';
    }
    if (message) return message;
  }
  return 'Email delivery failed.';
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
  }
  return describeEmailDeliveryFailure(error, data);
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Email delivery requires Supabase Edge Functions configuration.');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const invoked = getSupabaseClient().functions.invoke('send-email', { body: params });
    const { data, error } = await Promise.race([
      invoked,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('The send-email function timed out after 25 seconds. Check send-email logs.'));
        }, SEND_EMAIL_TIMEOUT_MS);
      }),
    ]);

    if (error) throw new Error(await describeFunctionError(error, data));
    const payloadError = errorFromUnknown(data);
    if (payloadError && !(data && typeof data === 'object' && 'ok' in data && (data as { ok?: unknown }).ok === true)) {
      throw new Error(payloadError);
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
