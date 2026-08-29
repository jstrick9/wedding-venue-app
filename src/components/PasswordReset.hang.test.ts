import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PasswordReset local hang guards', () => {
  it('always clears Sending Code and Updating on local send, resend, and reset', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/PasswordReset.tsx'), 'utf8');
    const request = source.slice(source.indexOf('const handleRequestCode'), source.indexOf('const handleResendCode'));
    expect(request).toContain('try');
    expect(request).toContain('catch');
    expect(request).toContain('finally');
    expect(request).toContain('setLoading(false)');
    expect(request).toContain('createSecretRecord');
    expect(request).toContain('Sending the reset email timed out');
    expect(request).toContain('withTimeout');

    const resend = source.slice(source.indexOf('const handleResendCode'), source.indexOf('const handleVerifyCode'));
    expect(resend).toContain('try');
    expect(resend).toContain('catch');
    expect(resend).toContain('finally');
    expect(resend).toContain('setLoading(false)');
    expect(resend).toContain('createSecretRecord');

    const reset = source.slice(source.indexOf('const handleResetPassword'), source.indexOf('fixed inset-0 z-[100]'));
    expect(reset).toContain('try');
    expect(reset).toContain('catch');
    expect(reset).toContain('finally');
    expect(reset).toContain('setLoading(false)');
    expect(reset).toContain('createPasswordRecord');
  });
});
