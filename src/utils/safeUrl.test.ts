import { describe, expect, it } from 'vitest';
import { isSafeHref, sanitizeHref } from './safeUrl';

describe('sanitizeHref', () => {
  it('allows https, http, mailto, and tel', () => {
    expect(sanitizeHref('https://sevenpathsmanor.com')).toBe('https://sevenpathsmanor.com/');
    expect(sanitizeHref('http://example.com/path')).toBe('http://example.com/path');
    expect(sanitizeHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(sanitizeHref('tel:+17045551212')).toBe('tel:+17045551212');
  });

  it('rejects javascript, data, and unknown schemes', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('');
    expect(sanitizeHref('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(sanitizeHref('vbscript:msgbox(1)')).toBe('');
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
  });

  it('promotes bare hostnames and emails', () => {
    expect(sanitizeHref('sevenpathsmanor.com')).toBe('https://sevenpathsmanor.com/');
    expect(sanitizeHref('hello@example.com')).toBe('mailto:hello@example.com');
  });

  it('allows in-app relative and hash paths', () => {
    expect(sanitizeHref('#/dashboard')).toBe('#/dashboard');
    expect(sanitizeHref('/venue-login/seven-paths-manor')).toBe('/venue-login/seven-paths-manor');
  });

  it('returns empty for blank or garbage input', () => {
    expect(sanitizeHref('')).toBe('');
    expect(sanitizeHref('   ')).toBe('');
    expect(sanitizeHref('not a url')).toBe('');
  });
});
