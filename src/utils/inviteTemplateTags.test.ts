import { describe, expect, it } from 'vitest';
import { VENUE_ADMIN_INVITE_TAGS, insertTextAtCursor } from './inviteTemplateTags';

describe('inviteTemplateTags', () => {
  it('inserts a merge tag at the caret without losing surrounding text', () => {
    expect(insertTextAtCursor('Hello ,', '{contactName}', 6, 6)).toBe('Hello {contactName},');
    expect(insertTextAtCursor('Hello there', '{venueName}', 6, 11)).toBe('Hello {venueName}');
    expect(VENUE_ADMIN_INVITE_TAGS.map((item) => item.tag)).toContain('{contactFirstName}');
    expect(VENUE_ADMIN_INVITE_TAGS.some((item) => item.tag === '{inviteUrl}')).toBe(false);
  });
});
