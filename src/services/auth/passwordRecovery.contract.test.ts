import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('branded password recovery deployment contract', () => {
  it('uses a public, server-controlled recovery endpoint instead of the hosted mail dispatcher', () => {
    const edge = source('supabase/functions/request-password-reset/index.ts');
    const authBackend = source('src/services/backend/AuthBackend.ts');
    const requestService = source('src/services/auth/passwordRecoveryService.ts');

    expect(edge).toContain("type: 'recovery'");
    expect(edge).toContain('properties?.hashed_token');
    expect(edge).toContain("admin.rpc('get_password_reset_account_context'");
    expect(edge).toContain("admin.rpc('begin_password_reset_request'");
    expect(edge).toContain('readBoundedJson(request)');
    expect(edge).toContain("Deno.env.get('PASSWORD_RESET_APP_URL')");
    expect(edge).toContain("Deno.env.get('PASSWORD_RESET_FROM_EMAIL')");
    expect(edge).not.toContain('wedding-vip@outlook.com');
    expect(edge).toContain('isLocalDevelopmentRedirect(requestedRedirectTo)');
    expect(edge).toContain('requestOriginAllowed(request, configuredAppUrl)');
    expect(edge).not.toContain("request.headers.get('Origin') || '*'");
    expect(edge).toContain('edgeRuntime.waitUntil(backgroundTask)');
    expect(edge).toContain('DELIVERY_TIMEOUT_MS');
    expect(edge).toContain("proof.set('token_hash'");
    expect(edge).toContain('target.hash = proof.toString()');
    expect(edge).not.toContain("target.searchParams.set('token_hash'");
    expect(edge).not.toContain('resetPasswordForEmail');
    expect(edge).not.toContain('options: { redirectTo: requestedRedirectTo }');
    const acceptedFlow = edge.slice(
      edge.indexOf('acceptedRequest = true'),
      edge.indexOf("console.error('password reset request failed'"),
    );
    expect(acceptedFlow).not.toContain("finish({ error:");
    expect(acceptedFlow).toContain("finish({ ok: true }, 202)");
    expect(authBackend).not.toContain('resetPasswordForEmail');
    expect(requestService).toContain("PASSWORD_RESET_REQUEST_FUNCTION = 'request-password-reset'");
  });

  it('pins service-only account lookup and rate-limit grants', () => {
    const migration = source('supabase/migrations/0022_password_recovery_delivery_and_throttle.sql');

    expect(migration).toMatch(/alter table public\.password_reset_requests enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.password_reset_requests from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke execute on function public\.begin_password_reset_request[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/revoke execute on function public\.get_password_reset_account_context[\s\S]*from public, anon, authenticated/i);
    expect(migration).toContain("pm.status = 'active'");
    expect(migration).toContain("om.status = 'active'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('password-reset:global'))");
    expect(migration).toContain("'password-reset:requester:' || p_requester_hash");
    expect(migration).toContain("'password-reset:email:' || p_email_hash");
  });

  it('deploys the unauthenticated request door explicitly while retaining server-side controls', () => {
    const config = source('supabase/config.toml');
    const workflow = source('.github/workflows/deploy-edge-functions.yml');

    expect(config).toMatch(/\[functions\.request-password-reset\]\s+verify_jwt = false/);
    expect(workflow).toContain('Deploy request-password-reset');
    expect(workflow).toContain('functions deploy request-password-reset --use-api --no-verify-jwt');
  });

  it('prevents recovery proof from leaking through browser referrers', () => {
    const html = source('index.html');
    const deployment = JSON.parse(source('vercel.json')) as {
      headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }>;
    };
    expect(html).toContain('<meta name="referrer" content="no-referrer"');
    const headers = deployment.headers?.flatMap((rule) => rule.headers || []) || [];
    expect(headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
  });
});
