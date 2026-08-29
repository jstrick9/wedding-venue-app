import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Staff login hang guards', () => {
  it('times out sign-in, forgot-password send, and recovery save', () => {
    const login = readFileSync(join(process.cwd(), 'src/components/LoginScreen.tsx'), 'utf8');
    expect(login).toContain('Sign-in timed out');
    const submit = login.slice(login.indexOf('const handleSubmit'), login.indexOf('const handleGuestAccess'));
    expect(submit).toContain('withTimeout');
    expect(submit).toContain('finally');
    expect(submit).toContain('setIsLoading(false)');

    const signup = login.slice(login.indexOf('const handleSignUpSubmit'), login.indexOf('relative min-h-screen'));
    expect(signup).toContain('Creating the account timed out');
    expect(signup).toContain('withTimeout');
    expect(signup).toContain('finally');
    expect(signup).toContain('setIsSigningUp(false)');

    const reset = readFileSync(join(process.cwd(), 'src/components/PasswordReset.tsx'), 'utf8');
    expect(reset).toContain('Sending the reset email timed out');
    expect(reset).toContain('requestSupabasePasswordReset');
    expect(reset).toContain('withTimeout');

    const recovery = readFileSync(join(process.cwd(), 'src/components/PasswordRecoveryScreen.tsx'), 'utf8');
    expect(recovery).toContain('Saving the new password timed out');
    expect(recovery).toContain('completeSupabasePasswordRecovery');
    expect(recovery).toContain('withTimeout');
  });
});
