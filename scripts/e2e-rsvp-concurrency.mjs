#!/usr/bin/env node
/**
 * Personal-account E2E: concurrent guest RSVP submissions, live (Review #276).
 *
 * Proves both the migration-0021 account boundary and the row lock protecting
 * two guest submissions on the same couple snapshot:
 *   1. Resolve two distinct email-backed guest invitations.
 *   2. Prove anonymous read/write calls stop at `account_required`.
 *   3. Create or accept each guest's personal account and sign in separately.
 *   4. Prove guest A's JWT cannot use guest B's token (and vice versa).
 *   5. Submit both RSVPs concurrently under their own JWTs.
 *   6. Read each privacy-projected guest snapshot and prove its own RSVP
 *      survived. The guest RPC intentionally never exposes the full RSVP list.
 *
 * Required environment (keep tokens/passwords in a mode-0600 temporary env
 * file; never pass them as command arguments or commit them):
 *   SUPABASE_URL=…
 *   SUPABASE_ANON_KEY=…
 *   COUPLE_ID=…
 *   GUEST_TOKEN_A=…
 *   GUEST_TOKEN_B=…
 *   GUEST_PASSWORD_A=…       # omitted only with --preflight
 *   GUEST_PASSWORD_B=…       # omitted only with --preflight
 *
 * Optional:
 *   GUEST_FULL_NAME_A=…
 *   GUEST_FULL_NAME_B=…
 *
 * Usage:
 *   node scripts/e2e-rsvp-concurrency.mjs --preflight   # no live mutation
 *   node scripts/e2e-rsvp-concurrency.mjs --sequential # write sanity check
 *   node scripts/e2e-rsvp-concurrency.mjs              # actual race probe
 *
 * Live mutations in the full probe: up to two throwaway Auth users/account
 * bindings (only when not already claimed) and one RSVP per supplied guest.
 */

import { pathToFileURL } from 'node:url';

const REQUEST_TIMEOUT_MS = 15_000;
const PREFLIGHT = process.argv.includes('--preflight');
const SEQUENTIAL = process.argv.includes('--sequential');

const config = {
  url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  coupleId: process.env.COUPLE_ID || '',
  guests: [
    {
      label: 'A',
      token: process.env.GUEST_TOKEN_A || '',
      password: process.env.GUEST_PASSWORD_A || '',
      fullName: process.env.GUEST_FULL_NAME_A || '',
    },
    {
      label: 'B',
      token: process.env.GUEST_TOKEN_B || '',
      password: process.env.GUEST_PASSWORD_B || '',
      fullName: process.env.GUEST_FULL_NAME_B || '',
    },
  ],
};

let failures = 0;
const mutationLedger = [];

export function summarizeMutationLedger(entries) {
  const confirmed = entries
    .filter((entry) => entry.status === 'confirmed')
    .flatMap((entry) => entry.effects || []);
  const count = (effect) => confirmed.filter((value) => value === effect).length;
  return {
    attempts: entries.length,
    authUserCreations: count('auth-user-creation'),
    portalBindingWrites: count('portal-binding-write'),
    rsvpWrites: count('rsvp-write'),
    indeterminate: entries.filter((entry) => entry.status === 'pending').length,
  };
}

function beginMutationAttempt(guest, operation, possibleEffects) {
  const entry = {
    guest: guest.label,
    operation,
    possibleEffects,
    effects: [],
    status: 'pending',
  };
  mutationLedger.push(entry);
  console.log(
    `[MUTATION ATTEMPT] guest ${guest.label}: ${operation}; possible effects=${possibleEffects.join(', ')}`,
  );
  return entry;
}

function confirmMutation(entry, effects) {
  entry.status = 'confirmed';
  entry.effects = [...effects];
  console.log(
    `[MUTATION CONFIRMED] guest ${entry.guest}: ${effects.join(', ')}`,
  );
}

function confirmNoMutation(entry, reason) {
  entry.status = 'no-change';
  console.log(`[MUTATION RESULT] guest ${entry.guest}: no persistent mutation (${reason})`);
}

function printMutationLedger() {
  const summary = summarizeMutationLedger(mutationLedger);
  console.log(
    `MUTATION LEDGER: attempts=${summary.attempts}; `
      + `confirmed Auth-user creations=${summary.authUserCreations}; `
      + `confirmed portal-binding writes=${summary.portalBindingWrites}; `
      + `confirmed RSVP writes=${summary.rsvpWrites}; `
      + `indeterminate attempts=${summary.indeterminate}.`,
  );
  if (summary.indeterminate > 0) {
    console.log(
      'MUTATION LEDGER WARNING: an interrupted request may have committed; operator reconciliation is required.',
    );
  }
}

function check(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function requireCheck(label, ok, detail = '') {
  if (!check(label, ok, detail)) throw new Error(`Required check failed: ${label}`);
}

function validPassword(value) {
  return value.length >= 8
    && value.length <= 128
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9\s]/.test(value);
}

function safeErrorCode(body) {
  const value = String(body?.error || '');
  return /^[a-z0-9_-]{1,64}$/i.test(value) ? value : 'unexpected';
}

function resultDetail(result) {
  return `HTTP ${result.status} error=${safeErrorCode(result.body)}`;
}

export function isAccountRequiredDenial(result) {
  return result?.status === 200
    && result?.body?.ok === false
    && result?.body?.error === 'account_required';
}

export function projectedRsvpHasStamp(body, stamp) {
  return Boolean(body?.ok && body.rsvp && JSON.stringify(body.rsvp).includes(stamp));
}

export function validateProbeConfig(value, preflight = false) {
  const errors = [];
  if (!value.url || !value.anonKey || !value.coupleId) {
    errors.push('SUPABASE_URL, SUPABASE_ANON_KEY and COUPLE_ID are required.');
  }
  if (!Array.isArray(value.guests) || value.guests.length !== 2 || value.guests.some((guest) => !guest.token)) {
    errors.push('GUEST_TOKEN_A and GUEST_TOKEN_B are required.');
  }
  if (value.guests?.[0]?.token && value.guests[0].token === value.guests[1]?.token) {
    errors.push('Two distinct guest tokens are required.');
  }
  if (!preflight && (!Array.isArray(value.guests) || value.guests.some((guest) => !validPassword(guest.password)))) {
    errors.push('Each guest password must satisfy the shared 8–128 character policy.');
  }
  return errors;
}

async function jsonFetch(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function headers(bearer = config.anonKey) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
  };
}

function rpc(name, body, bearer = config.anonKey) {
  return jsonFetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(bearer),
    body: JSON.stringify(body),
  });
}

function contextArgs(guest) {
  return {
    p_kind: 'guest',
    p_token: guest.token,
    p_couple_id: config.coupleId,
    p_venue_slug: null,
  };
}

function snapshotArgs(guest) {
  return {
    p_couple_id: config.coupleId,
    p_guest_token: guest.token,
  };
}

async function lookupContext(guest, bearer = config.anonKey) {
  return rpc('get_portal_invite_context', contextArgs(guest), bearer);
}

async function readSnapshot(guest, bearer = config.anonKey) {
  return rpc('get_guest_couple_portal_snapshot', snapshotArgs(guest), bearer);
}

async function safeDeniedWrite(guest, bearer = config.anonKey) {
  return rpc('submit_guest_couple_rsvp', {
    ...snapshotArgs(guest),
    // If the account gate regresses, the implementation rejects this payload
    // as oversized before its update. This tests denial without risking a write.
    p_submission: { notes: 'x'.repeat(20_100) },
  }, bearer);
}

async function claimAccount(guest, context) {
  if (context.account_claimed === true) return 'already-claimed';
  const attempt = beginMutationAttempt(guest, 'personal-account claim', [
    'auth-user-creation',
    'portal-binding-write',
  ]);
  const result = await jsonFetch(`${config.url}/functions/v1/claim-portal-invite`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      kind: 'guest',
      token: guest.token,
      coupleId: config.coupleId,
      venueSlug: null,
      password: guest.password,
      fullName: guest.fullName || context.full_name || `E2E Guest ${guest.label}`,
    }),
  });
  const created = result.status === 200 && result.body?.ok === true;
  const existing = result.status === 409 && result.body?.error === 'account_exists';
  if (created) {
    confirmMutation(attempt, ['auth-user-creation', 'portal-binding-write']);
  } else if (existing) {
    confirmNoMutation(attempt, 'the Auth account already exists');
  }
  requireCheck(
    `guest ${guest.label} account creation/existing-account handoff`,
    created || existing,
    resultDetail(result),
  );
  return created ? 'created-and-bound' : 'existing-auth-account';
}

async function signIn(guest, context) {
  const result = await jsonFetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: context.email,
      password: guest.password,
    }),
  });
  requireCheck(
    `guest ${guest.label} personal-account sign-in`,
    result.status === 200 && Boolean(result.body?.access_token && result.body?.user?.id),
    `HTTP ${result.status}`,
  );
  return {
    accessToken: result.body.access_token,
    userId: result.body.user.id,
  };
}

async function acceptInvite(guest, context, session) {
  const attempt = beginMutationAttempt(guest, 'existing-account invitation acceptance', [
    'portal-binding-write',
  ]);
  const result = await rpc('accept_portal_invite', {
    p_kind: 'guest',
    p_token: guest.token,
    p_couple_id: config.coupleId,
    p_full_name: guest.fullName || context.full_name || `E2E Guest ${guest.label}`,
  }, session.accessToken);
  const accepted = result.status === 200
    && result.body?.ok === true
    && result.body?.authenticated === true
    && result.body?.participant_id === context.participant_id;
  if (accepted) confirmMutation(attempt, ['portal-binding-write']);
  requireCheck(
    `guest ${guest.label} invitation is bound to its signed-in account`,
    accepted,
    resultDetail(result),
  );
}

async function submitRsvp(guest, session, stamp) {
  const attempt = beginMutationAttempt(guest, 'RSVP submission', ['rsvp-write']);
  const result = await rpc('submit_guest_couple_rsvp', {
    ...snapshotArgs(guest),
    p_submission: {
      attending: true,
      mealChoice: 'vegetarian',
      notes: `e2e-concurrency-${stamp}`,
    },
  }, session.accessToken);
  if (result.status === 200 && result.body?.ok === true) {
    confirmMutation(attempt, ['rsvp-write']);
  }
  return result;
}

async function logout(accessToken) {
  try {
    await jsonFetch(`${config.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: headers(accessToken),
    });
  } catch {
    // The process retains no session storage or token after exit.
  }
}

async function preflightGuest(guest) {
  const contextResult = await lookupContext(guest);
  requireCheck(
    `guest ${guest.label} invite context resolves`,
    contextResult.status === 200
      && contextResult.body?.ok === true
      && contextResult.body?.kind === 'guest'
      && contextResult.body?.participant_type === 'guest'
      && contextResult.body?.couple_id === config.coupleId,
    resultDetail(contextResult),
  );
  const context = contextResult.body;
  requireCheck(
    `guest ${guest.label} requires a personal account`,
    context.account_required === true && Boolean(context.email && context.participant_id),
  );

  const anonymousRead = await readSnapshot(guest);
  requireCheck(
    `guest ${guest.label} anonymous snapshot read is denied`,
    isAccountRequiredDenial(anonymousRead),
    resultDetail(anonymousRead),
  );
  const anonymousWrite = await safeDeniedWrite(guest);
  requireCheck(
    `guest ${guest.label} anonymous RSVP write is denied before mutation`,
    isAccountRequiredDenial(anonymousWrite),
    resultDetail(anonymousWrite),
  );
  return context;
}

export async function main() {
  const errors = validateProbeConfig(config, PREFLIGHT);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 2;
    return;
  }

  const sessions = [];
  try {
    console.log('— Personal-account guest preflight (no writes)');
    const contexts = [];
    for (const guest of config.guests) contexts.push(await preflightGuest(guest));
    requireCheck(
      'guest invitations identify two distinct participants',
      contexts[0].participant_id !== contexts[1].participant_id
        && contexts[0].email !== contexts[1].email,
    );

    if (PREFLIGHT) {
      console.log('\nRSVP PERSONAL-ACCOUNT PREFLIGHT: ALL CHECKS PASSED (NO LIVE MUTATION)');
      return;
    }

    console.log('\n— Claim/sign in two independent personal accounts');
    for (let index = 0; index < config.guests.length; index += 1) {
      const guest = config.guests[index];
      const context = contexts[index];
      const claimOutcome = await claimAccount(guest, context);
      const session = await signIn(guest, context);
      sessions.push(session);
      // The claim Function already binds a newly created user, and an already-
      // claimed mapping is already active. Re-accept only when the email belongs
      // to a pre-existing Auth user that still needs this invitation bound.
      if (claimOutcome === 'existing-auth-account') {
        await acceptInvite(guest, context, session);
      }
      const authenticatedContext = await lookupContext(guest, session.accessToken);
      requireCheck(
        `guest ${guest.label} context recognizes only its signed-in account`,
        authenticatedContext.status === 200
          && authenticatedContext.body?.ok === true
          && authenticatedContext.body?.authenticated === true
          && authenticatedContext.body?.account_claimed === true,
        resultDetail(authenticatedContext),
      );
    }

    requireCheck(
      'guest invitations are bound to two distinct Auth users',
      sessions[0].userId !== sessions[1].userId,
    );

    const crossPairs = [
      { actor: 'A', target: 'B', session: sessions[0], guest: config.guests[1] },
      { actor: 'B', target: 'A', session: sessions[1], guest: config.guests[0] },
    ];
    for (const pair of crossPairs) {
      const crossRead = await readSnapshot(pair.guest, pair.session.accessToken);
      requireCheck(
        `guest ${pair.actor} session cannot read guest ${pair.target} token`,
        isAccountRequiredDenial(crossRead),
        resultDetail(crossRead),
      );
      const crossWrite = await safeDeniedWrite(pair.guest, pair.session.accessToken);
      requireCheck(
        `guest ${pair.actor} session cannot write with guest ${pair.target} token`,
        isAccountRequiredDenial(crossWrite),
        resultDetail(crossWrite),
      );
    }

    for (let index = 0; index < config.guests.length; index += 1) {
      const ownRead = await readSnapshot(config.guests[index], sessions[index].accessToken);
      requireCheck(
        `guest ${config.guests[index].label} authenticated snapshot read works`,
        ownRead.status === 200
          && ownRead.body?.ok === true
          && ownRead.body?.guest?.id === contexts[index].participant_id,
        resultDetail(ownRead),
      );
    }

    const stampA = `a${Date.now().toString(36)}`;
    const stampB = `b${Date.now().toString(36)}`;
    console.log(`\n— Submitting two RSVPs ${SEQUENTIAL ? 'sequentially' : 'CONCURRENTLY'} on one couple snapshot`);
    let settled;
    if (SEQUENTIAL) {
      settled = [];
      for (const [guest, session, stamp] of [
        [config.guests[0], sessions[0], stampA],
        [config.guests[1], sessions[1], stampB],
      ]) {
        try {
          settled.push({ status: 'fulfilled', value: await submitRsvp(guest, session, stamp) });
        } catch {
          settled.push({ status: 'rejected' });
        }
      }
    } else {
      // Wait for both requests even if one rejects so the final ledger never
      // omits a concurrent request that may still have committed.
      settled = await Promise.allSettled([
        submitRsvp(config.guests[0], sessions[0], stampA),
        submitRsvp(config.guests[1], sessions[1], stampB),
      ]);
    }
    const resultA = settled[0].status === 'fulfilled' ? settled[0].value : null;
    const resultB = settled[1].status === 'fulfilled' ? settled[1].value : null;
    const successA = Boolean(resultA?.status === 200 && resultA.body?.ok === true);
    const successB = Boolean(resultB?.status === 200 && resultB.body?.ok === true);
    check('guest A submission succeeds', successA, resultA ? resultDetail(resultA) : 'request outcome indeterminate');
    check('guest B submission succeeds', successB, resultB ? resultDetail(resultB) : 'request outcome indeterminate');
    if (!successA || !successB) {
      throw new Error('One or more RSVP writes could not be confirmed.');
    }

    const [afterA, afterB] = await Promise.all([
      readSnapshot(config.guests[0], sessions[0].accessToken),
      readSnapshot(config.guests[1], sessions[1].accessToken),
    ]);
    check(
      'guest A projected RSVP survived',
      projectedRsvpHasStamp(afterA.body, stampA),
      resultDetail(afterA),
    );
    check(
      'guest B projected RSVP survived',
      projectedRsvpHasStamp(afterB.body, stampB),
      resultDetail(afterB),
    );

    if (failures) {
      throw new Error(
        SEQUENTIAL
          ? 'Sequential RSVP persistence check failed.'
          : 'Concurrent RSVP persistence/account-isolation check failed.',
      );
    }

    console.log(`\nRSVP ${SEQUENTIAL ? 'SEQUENTIAL' : 'CONCURRENCY'} PROBE: ALL CHECKS PASSED`);
  } catch (error) {
    if (!failures) failures += 1;
    console.error(`PROBE STOPPED: ${error instanceof Error ? error.message : 'unexpected failure'}`);
  } finally {
    await Promise.allSettled(sessions.map((session) => logout(session.accessToken)));
    printMutationLedger();
  }

  if (failures) process.exitCode = 1;
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch(() => {
    console.error('PROBE STOPPED: unexpected top-level failure');
    process.exitCode = 1;
  });
}
