import { describe, expect, it } from 'vitest';
import { parseGuestCsv } from './guestCsv';

describe('parseGuestCsv', () => {
  it('parses name/group/email/phone/dietary/accessibility columns', () => {
    const csv = [
      'Name,Group,Email,Phone,Dietary Restrictions,Accessibility',
      'Jane Smith,Smith Party,jane@example.com,555-0100,Vegan,Yes',
      'John Smith,Smith Party,,,Gluten-free,no',
      'Bob,Thomas Party,bob@example.com,555-0102,,',
    ].join('\n');

    const result = parseGuestCsv(csv);

    expect(result.ok).toBe(true);
    expect(result.added).toBe(3);
    expect(result.guests?.[0]).toMatchObject({
      name: 'Jane Smith',
      group: 'Smith Party',
      email: 'jane@example.com',
      phone: '555-0100',
      dietaryRestrictions: 'Vegan',
      accessibility: true,
      rsvpStatus: 'pending',
    });
    expect(result.guests?.[1].accessibility).toBe(false);
    expect(result.guests?.[2].email).toBe('bob@example.com');
    expect(result.guests?.[2].accessibility).toBeUndefined();
  });

  it('returns an error result when there is no name column', () => {
    const csv = ['Guest Email', 'jane@example.com'].join('\n');
    const result = parseGuestCsv(csv);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('name');
  });

  it('deduplicates against existing guests by name + group', () => {
    const csv = ['Name,Group', 'Jane Smith,Smith Party', 'Jane Smith,Smith Party', 'Jane Smith,Other Group'].join('\n');
    const existing = [{ id: 'g1', name: 'Jane Smith', group: 'Smith Party' }];

    const result = parseGuestCsv(csv, existing as any);

    // First row matches existing (skip), second is duplicate within file (skip),
    // third has a different group so it is added.
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(2);
    expect(result.added).toBe(1);
    expect(result.guests?.[0].group).toBe('Other Group');
  });

  it('returns zero counts for header-only or empty input', () => {
    expect(parseGuestCsv('Name,Group')).toMatchObject({ ok: true, added: 0, skipped: 0 });
    expect(parseGuestCsv('')).toMatchObject({ ok: true, added: 0, skipped: 0 });
  });

  it('ignores blank name rows', () => {
    const csv = ['Name', '', 'Jane', '   '].join('\n');
    const result = parseGuestCsv(csv);
    expect(result.added).toBe(1);
    expect(result.guests?.[0].name).toBe('Jane');
  });
});
