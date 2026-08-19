/**
 * Restrict user-supplied hrefs to safe schemes so a stored `javascript:` or
 * `data:` URL cannot become an XSS vector when rendered as an <a href>.
 */
const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);

export function sanitizeHref(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  // Protocol-relative URLs are treated as https.
  if (value.startsWith('//')) {
    return sanitizeHref(`https:${value}`);
  }

  // Bare emails / phones without a scheme.
  if (/^[^/\s@:]+@[^/\s@]+\.[^/\s@]+$/.test(value)) {
    return `mailto:${value}`;
  }
  if (/^[+\d][\d\s().-]{6,}$/.test(value) && !value.includes('://')) {
    return `tel:${value.replace(/[^\d+]/g, '')}`;
  }

  // Relative paths (in-app) are allowed.
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('./') || value.startsWith('../')) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    // Scheme-less hostnames such as "sevenpathsmanor.com".
    if (/^[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(value)) {
      return sanitizeHref(`https://${value}`);
    }
    return '';
  }
}

export function isSafeHref(raw: string | null | undefined): boolean {
  return sanitizeHref(raw).length > 0;
}
