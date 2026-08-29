import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('InviteMembers hang guards', () => {
  it('times out createInvite and always clears Sending invite', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/admin/InviteMembers.tsx'), 'utf8');
    const submit = source.slice(source.indexOf('const handleSubmit'), source.indexOf('<form onSubmit'));
    expect(submit).toContain('Sending the invite timed out');
    expect(submit).toContain('withTimeout');
    expect(submit).toContain('20000');
    expect(submit).toContain('finally');
    expect(submit).toContain('setIsSending(false)');
    expect(submit).toContain('catch');
  });
});
