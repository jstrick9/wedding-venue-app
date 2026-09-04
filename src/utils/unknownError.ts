const INTERNAL_DETAIL_RE = /supabase|vercel|brevo|resend|postgrest|postgres|firebase|cloudflare|netlify|railway|render\.com|amazon web services|\baws\b|\bazure\b|\bprovider\b|\bdatabase\b|\bbackend\b|\bdeployment\b|\bconfiguration\b|\bcredentials?\b|\bsecret\b|sql editor|migration(?:\s+\d+)?|edge function|serverless function|schema cache|row-level security|service[_ -]?role|api key|smtp|storage bucket|object storage|localstorage|browser storage|server proxy|geoapify|openmaptiles|openstreetmap|\bcloud\b|\brpc\b|\btable\b|\brelation\b|\bcolumn\b|\bconstraint\b|duplicate key|foreign key|not-null|\b(?:jwt|pgrst\d*)\b|\b(?:22|23|40|42)[0-9a-z]{3}\b|cloud mode|local mode|https?:\/\//i;

function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message.trim() : '';
  }
  return '';
}

/**
 * Keeps operational details useful in logs while ensuring rendered errors never
 * name infrastructure, credentials, database policy, or deployment mechanics.
 */
export function describeUnknownError(error: unknown, fallback: string): string {
  const message = messageFrom(error);
  const code = error && typeof error === 'object'
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    return 'You do not have permission to complete this action.';
  }
  if (/invalid input syntax for type uuid/i.test(message)) {
    return 'Select a valid item and try again.';
  }
  if (code === '42P01' || /does not exist|schema cache/i.test(message)) {
    return fallback;
  }
  if (!message || INTERNAL_DETAIL_RE.test(message)) return fallback;
  return message;
}

export function containsInternalServiceDetail(value: string): boolean {
  return INTERNAL_DETAIL_RE.test(value);
}
