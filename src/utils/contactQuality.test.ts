import { describe, expect, it } from 'vitest';
import {
  formatUsPhoneDisplay,
  isValidEmail,
  normalizeEmail,
  normalizeUsPhone,
  normalizeUsPostalCode,
  normalizeUsState,
  normalizeWebsite,
} from './contactQuality';

describe('contactQuality', () => {
  it('normalizes and lowercases a valid email, including plus-addressing', () => {
    expect(normalizeEmail('  Ada+Ops@SevenPathsManor.COM ').value).toBe('ada+ops@sevenpathsmanor.com');
    expect(isValidEmail('weddings@sevenpathsmanor.com')).toBe(true);
  });

  it('rejects incomplete emails and empty required emails', () => {
    expect(normalizeEmail('not-an-email').ok).toBe(false);
    expect(normalizeEmail('', { required: true }).error).toMatch(/required/i);
    expect(normalizeEmail('').ok).toBe(true);
  });

  it('stores US phones as E.164 and displays NANP', () => {
    const result = normalizeUsPhone('(704) 555-0100');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('+17045550100');
    expect(result.display).toBe('(704) 555-0100');
    expect(normalizeUsPhone('1-704-555-0100').value).toBe('+17045550100');
    expect(formatUsPhoneDisplay('7045550100')).toBe('(704) 555-0100');
  });

  it('rejects short, international, and invalid-exchange phones', () => {
    expect(normalizeUsPhone('555-0100').ok).toBe(false);
    expect(normalizeUsPhone('+44 20 7946 0958').ok).toBe(false);
    expect(normalizeUsPhone('004-555-0100').ok).toBe(false);
    expect(normalizeUsPhone('704-055-0100').ok).toBe(false);
  });

  it('requires http(s) websites and rejects javascript / mailto', () => {
    expect(normalizeWebsite('sevenpathsmanor.com').value).toMatch(/^https:\/\/sevenpathsmanor\.com\/?$/);
    expect(normalizeWebsite('javascript:alert(1)').ok).toBe(false);
    expect(normalizeWebsite('mailto:hello@example.com').ok).toBe(false);
    expect(normalizeWebsite('').ok).toBe(true);
  });

  it('accepts ZIP+4 and maps state names to USPS codes', () => {
    expect(normalizeUsPostalCode('28202-1234').value).toBe('28202-1234');
    expect(normalizeUsPostalCode('2820').ok).toBe(false);
    expect(normalizeUsState('North Carolina').value).toBe('NC');
    expect(normalizeUsState('nc').value).toBe('NC');
    expect(normalizeUsState('XX').ok).toBe(false);
  });
});
