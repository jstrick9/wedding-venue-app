#!/usr/bin/env node
/**
 * Authenticated-path E2E: the venue-admin invite claim, live (Review #248).
 *
 * Closes the gap left by Reviews #246/#247: everything verified so far was
 * anon-key reachable. This script walks the REAL claim flow against a REAL
 * pending invite and asserts the whole 0017 chain:
 *
 *   1. POST claim-venue-admin with the invite token  → ok + claimed:true
 *   2. Sign in with the password just set            → session + user id
 *   3. Authenticated RLS scope: the new admin sees the org, IS its owner,
 *      has an active membership, and CANNOT read platform-managed tables
 *      (venue_admin_invites) with a venue session.
 *   4. The unchanged client fallback still works: accept_venue_admin_invite
 *      as the signed-in user returns ok + already_accepted:true (idempotent).
 *   5. The invite token is DEAD after the claim: a second claim attempt
 *      400s with not_found (the original P2-G bug: reusable password-reset
 *      token) — and this last probe deliberately burns one throttle failure.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… INVITE_TOKEN=… \
 *     node scripts/e2e-claim-flow.mjs [password] [fullName]
 *
 * The invite should be created from the platform admin console for a throwaway
 * email address you control (or a venue you are willing to reassign). The
 * script never prints the password when one is generated.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const INVITE_TOKEN = process.env.INVITE_TOKEN || '';

const args = process.argv.slice(2);
const PASSWORD = args[0] || `E2e-${Date.now().toString(36)}!claim`;
const FULL_NAME = args[1] || 'E2E Claim Probe';

let failures = 0;
function check(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function anonHeaders() {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function sessionHeaders(accessToken) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function jsonFetch(url, headers, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

async function restGet(url, headers) {
  const response = await fetch(url, { method: 'GET', headers });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !INVITE_TOKEN) {
    console.error(
      'Need SUPABASE_URL, SUPABASE_ANON_KEY and INVITE_TOKEN in the environment.\n' +
        'Create a pending venue-admin invite (platform console → invite) for a\n' +
        'throwaway email, then pass its setup-link token as INVITE_TOKEN.',
    );
    process.exit(2);
  }

  // ---- Step 1: claim via the Edge Function -------------------------------
  console.log(`\n— Step 1: claim invite (${FULL_NAME})`);
  const claim = await jsonFetch(`${SUPABASE_URL}/functions/v1/claim-venue-admin`, anonHeaders(), {
    token: INVITE_TOKEN,
    password: PASSWORD,
    fullName: FULL_NAME,
  });
  const claimBody = claim.body || {};
  check('claim-venue-admin returned HTTP 200', claim.status === 200, `got ${claim.status} ${JSON.stringify(claim.body).slice(0, 140)}`);
  check('claim reports ok', claimBody.ok === true);
  check('claim reports claimed:true (0017 atomic claim ran)', claimBody.claimed === true, `claimed=${JSON.stringify(claimBody.claimed)}`);
  const email = String(claimBody.email || '').toLowerCase();
  const organizationId = String(claimBody.organizationId || claimBody.organization_id || '');
  check('claim returned the invited email + organization', Boolean(email && organizationId), `email=${email || '?'} org=${organizationId || '?'}`);

  if (!email) {
    console.error('\nCannot continue without the invited email — aborting.');
    process.exit(1);
  }

  // ---- Step 2: sign in with the password the claim just set --------------
  console.log('\n— Step 2: sign in with the new password');
  const signIn = await jsonFetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    anonHeaders(),
    { email, password: PASSWORD },
  );
  const user = signIn.body?.user || null;
  const accessToken = signIn.body?.access_token || '';
  check('password sign-in succeeded', signIn.status === 200 && Boolean(accessToken), `got ${signIn.status}`);
  const userId = user?.id || '';
  check('sign-in returned a user id', Boolean(userId));

  if (!accessToken) {
    console.error('\nCannot continue without a session — aborting.');
    process.exit(1);
  }

  // ---- Step 3: authenticated RLS scope ------------------------------------
  console.log('\n— Step 3: authenticated RLS scope for the new venue admin');
  const org = await restGet(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}&select=id,name,owner_id,status`,
    sessionHeaders(accessToken),
  );
  const orgRows = Array.isArray(org.body) ? org.body : [];
  check('can read own organization (venue-member RLS)', org.status === 200 && orgRows.length === 1, `HTTP ${org.status}, rows=${orgRows.length}`);
  const ownerMatches = orgRows.length === 1 && String(orgRows[0].owner_id || '') === userId;
  check('organization owner_id IS the claiming user (atomic ownership transfer)', ownerMatches,
    `owner_id=${orgRows[0] ? String(orgRows[0].owner_id) : '?'} user=${userId}`);

  const allOrgs = await restGet(
    `${SUPABASE_URL}/rest/v1/organizations?select=id`,
    sessionHeaders(accessToken),
  );
  const allOrgRows = Array.isArray(allOrgs.body) ? allOrgs.body : [];
  check('organization list is scoped (own org present)', allOrgRows.some((row) => String(row.id) === organizationId),
    `visible orgs=${allOrgRows.length}${allOrgRows.length > 1 ? ' (warn: expected 1 for a fresh venue admin)' : ''}`);

  const memberships = await restGet(
    `${SUPABASE_URL}/rest/v1/platform_memberships?organization_id=eq.${organizationId}&select=user_id,role,status`,
    sessionHeaders(accessToken),
  );
  const membershipRows = Array.isArray(memberships.body) ? memberships.body : [];
  const ownMembership = membershipRows.find((row) => String(row.user_id) === userId && row.status !== 'revoked');
  check('active platform_memberships row for the claimant', Boolean(ownMembership), `rows=${membershipRows.length}`);
  if (ownMembership) {
    check('membership role is owner (from the invite)', String(ownMembership.role) === 'owner', `role=${ownMembership.role}`);
  }

  const invitesRead = await restGet(
    `${SUPABASE_URL}/rest/v1/venue_admin_invites?organization_id=eq.${organizationId}&select=id`,
    sessionHeaders(accessToken),
  );
  const invitesDenied =
    (invitesRead.status === 401 || invitesRead.status === 403) ||
    (invitesRead.status === 200 && Array.isArray(invitesRead.body) && invitesRead.body.length === 0);
  check('venue session CANNOT list platform-managed invites', invitesDenied, `HTTP ${invitesRead.status}`);

  // ---- Step 4: unchanged client fallback (idempotent accept) -------------
  console.log('\n— Step 4: client-side accept RPC after an Edge-side claim');
  const accept = await jsonFetch(`${SUPABASE_URL}/rest/v1/rpc/accept_venue_admin_invite`, sessionHeaders(accessToken), {
    p_token: INVITE_TOKEN,
  });
  const acceptBody = accept.body || {};
  check('accept_venue_admin_invite still succeeds', accept.status === 200 && acceptBody.ok === true,
    `HTTP ${accept.status} ${JSON.stringify(accept.body).slice(0, 140)}`);
  check('accept reports already_accepted:true (idempotent branch)', acceptBody.already_accepted === true,
    `already_accepted=${JSON.stringify(acceptBody.already_accepted)}`);

  // ---- Step 5: the token is dead ------------------------------------------
  console.log('\n— Step 5: invite token is unusable after the claim (P2-G fix)');
  const reClaim = await jsonFetch(`${SUPABASE_URL}/functions/v1/claim-venue-admin`, anonHeaders(), {
    token: INVITE_TOKEN,
    password: `${PASSWORD}-x`,
    fullName: FULL_NAME,
  });
  check('second claim attempt rejected', reClaim.status === 400, `got ${reClaim.status}`);
  check('second claim reports not_found (invite consumed)', String(reClaim.body?.error || '') === 'not_found',
    `error=${JSON.stringify(reClaim.body?.error)}`);

  // ---- Summary -------------------------------------------------------------
  console.log(`\n${'='.repeat(64)}`);
  if (failures === 0) {
    console.log('E2E CLAIM FLOW: ALL CHECKS PASSED');
    console.log(`(Signed in as ${email} — org ${organizationId}. You can sign out and)`);
    console.log('(delete the test venue/membership from the platform console.)    ');
    process.exit(0);
  }
  console.error(`E2E CLAIM FLOW: ${failures} CHECK(S) FAILED`);
  process.exit(1);
}

main().catch((error) => {
  console.error('E2E script crashed:', error);
  process.exit(1);
});
