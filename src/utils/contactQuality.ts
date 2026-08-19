/**
 * Shared contact-field quality helpers.
 *
 * Rules (Review #185, user-selected us_nanp_syntax):
 * - Email: RFC-style syntax, trim + lowercase. No live mailbox/MX check.
 * - Phone: 10-digit US NANP. Display (555) 123-4567. Store +15551234567.
 * - Website: must sanitize to http(s). Reject mailto/tel/javascript in website fields.
 * - ZIP: 12345 or 12345-6789.
 * - State: 2-letter USPS code (full names accepted as input).
 */
import { sanitizeHref } from './safeUrl';

export interface FieldResult {
  ok: boolean;
  value: string;
  display: string;
  error?: string;
}

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+'’-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

export const US_STATE_BY_NAME: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

export const US_STATE_CODES = new Set(Object.values(US_STATE_BY_NAME));

function emptyResult(required: boolean, requiredMessage: string): FieldResult {
  if (required) return { ok: false, value: '', display: '', error: requiredMessage };
  return { ok: true, value: '', display: '' };
}

export function normalizeEmail(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): FieldResult {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return emptyResult(!!options.required, 'Email is required.');
  if (value.length > 254 || !EMAIL_RE.test(value)) {
    return { ok: false, value, display: value, error: 'Enter a valid email address.' };
  }
  return { ok: true, value, display: value };
}

export function isValidEmail(raw: string | null | undefined): boolean {
  return normalizeEmail(raw).ok && Boolean(String(raw ?? '').trim());
}

function nanpDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function formatUsPhoneDisplay(digits: string): string {
  const ten = nanpDigits(digits);
  if (ten.length !== 10) return digits;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function normalizeUsPhone(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): FieldResult {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyResult(!!options.required, 'Phone number is required.');
  const digits = nanpDigits(trimmed);
  if (digits.length !== 10) {
    return {
      ok: false,
      value: trimmed,
      display: trimmed,
      error: 'Enter a 10-digit US phone number.',
    };
  }
  if (digits[0] === '0' || digits[0] === '1' || digits[3] === '0' || digits[3] === '1') {
    return {
      ok: false,
      value: trimmed,
      display: trimmed,
      error: 'Enter a valid US area code and exchange.',
    };
  }
  const e164 = `+1${digits}`;
  return { ok: true, value: e164, display: formatUsPhoneDisplay(digits) };
}

export function normalizeWebsite(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): FieldResult {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyResult(!!options.required, 'Website is required.');
  const sanitized = sanitizeHref(trimmed);
  if (!sanitized) {
    return { ok: false, value: trimmed, display: trimmed, error: 'Website must be an http or https URL.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(sanitized);
  } catch {
    return { ok: false, value: trimmed, display: trimmed, error: 'Website must be an http or https URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, value: trimmed, display: trimmed, error: 'Website must be an http or https URL.' };
  }
  return { ok: true, value: parsed.toString(), display: parsed.toString() };
}

export function normalizeUsPostalCode(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): FieldResult {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyResult(!!options.required, 'ZIP code is required.');
  const compact = trimmed.replace(/\s+/g, '');
  if (!/^\d{5}(-\d{4})?$/.test(compact)) {
    return { ok: false, value: trimmed, display: trimmed, error: 'Enter a US ZIP code (12345 or 12345-6789).' };
  }
  return { ok: true, value: compact, display: compact };
}

export function normalizeUsState(
  raw: string | null | undefined,
  options: { required?: boolean } = {},
): FieldResult {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyResult(!!options.required, 'State is required.');
  const upper = trimmed.toUpperCase();
  if (US_STATE_CODES.has(upper)) return { ok: true, value: upper, display: upper };
  const mapped = US_STATE_BY_NAME[trimmed.toLowerCase()];
  if (mapped) return { ok: true, value: mapped, display: mapped };
  return { ok: false, value: trimmed, display: trimmed, error: 'Enter a valid US state (e.g. NC).' };
}

export function firstFieldError(...fields: FieldResult[]): string | undefined {
  return fields.find((field) => !field.ok)?.error;
}
