#!/usr/bin/env node
/**
 * Authenticated-path E2E: concurrent guest RSVP submissions, live (Review #248).
 *
 * Proves the Review #245 P1-C fix (re-declared in 0016) under real concurrency:
 * `submit_guest_couple_rsvp` locks the couple snapshot row `for update`, so two
 * guests of the same couple submitting at the same moment must BOTH persist.
 * Before the fix, the second writer's read-modify-write silently dropped the
 * first submission.
 *
 * Both RPCs and the snapshot reader are anon-callable by design (guest portal),
 * so this probe needs no sign-in — just two real guest tokens for the same
 * couple. Get them from two guest portal links (or the venue console).
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… COUPLE_ID=… \
 *     GUEST_TOKEN_A=… GUEST_TOKEN_B=… \
 *     node scripts/e2e-rsvp-concurrency.mjs [--sequential]
 *
 * With --sequential it submits one after the other (write-path sanity check);
 * without it, both submissions fire simultaneously (the actual race probe).
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const COUPLE_ID = process.env.COUPLE_ID || '';
const TOKEN_A = process.env.GUEST_TOKEN_A || '';
const TOKEN_B = process.env.GUEST_TOKEN_B || process.env.GUEST_TOKEN_A || '';

const SEQUENTIAL = process.argv.includes('--sequential');

let failures = 0;
function check(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
}

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: HEADERS,
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

function submission(stamp) {
  return {
    attending: true,
    mealChoice: 'vegetarian',
    note: `e2e-concurrency-${stamp}`,
  };
}

async function submitRsvp(token, stamp) {
  return rpc('submit_guest_couple_rsvp', {
    p_couple_id: COUPLE_ID,
    p_guest_token: token,
    p_submission: submission(stamp),
  });
}

async function readSnapshot(token) {
  const result = await rpc('get_guest_couple_portal_snapshot', {
    p_couple_id: COUPLE_ID,
    p_token: token,
  });
  return result;
}

function countOurSubmissions(payload, stamps) {
  const submissions = Array.isArray(payload?.coupleSubmissions) ? payload.coupleSubmissions : [];
  return stamps.filter((stamp) =>
    submissions.some((entry) => String(entry?.note || '').includes(stamp)),
  );
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !COUPLE_ID || !TOKEN_A || !TOKEN_B) {
    console.error(
      'Need SUPABASE_URL, SUPABASE_ANON_KEY, COUPLE_ID, GUEST_TOKEN_A and GUEST_TOKEN_B.\n' +
        'Use two guest-portal tokens for the SAME couple so both submissions land\n' +
        'on the same snapshot row (that is the race).',
    );
    process.exit(2);
  }
  const twoDistinctTokens = TOKEN_A !== TOKEN_B;
  if (!twoDistinctTokens) {
    console.log(
      'NOTE: GUEST_TOKEN_A == GUEST_TOKEN_B — the second submission replaces the\n' +
        'first BY DESIGN (same guest). The race needs two distinct guest tokens.\n',
    );
  }

  const stampA = `a${Date.now().toString(36)}`;
  const stampB = `b${Date.now().toString(36)}`;

  // Baseline read (also proves the anon guest portal read works).
  const baseline = await readSnapshot(TOKEN_A);
  check('guest portal snapshot read works', baseline.status === 200, `HTTP ${baseline.status}`);
  const baselinePayload = baseline.body?.payload || baseline.body;
  const baselineCount = Array.isArray(baselinePayload?.coupleSubmissions)
    ? baselinePayload.coupleSubmissions.length
    : null;
  console.log(`  baseline coupleSubmissions: ${baselineCount ?? 'unreadable'}`);

  // Fire the two submissions.
  console.log(`\n— Submitting two guest RSVPs ${SEQUENTIAL ? 'sequentially' : 'CONCURRENTLY (same couple)'}`);
  let resultA;
  let resultB;
  if (SEQUENTIAL) {
    resultA = await submitRsvp(TOKEN_A, stampA);
    resultB = await submitRsvp(TOKEN_B, stampB);
  } else {
    [resultA, resultB] = await Promise.all([submitRsvp(TOKEN_A, stampA), submitRsvp(TOKEN_B, stampB)]);
  }
  check('guest A submission ok', resultA.status === 200 && resultA.body?.ok === true,
    `HTTP ${resultA.status} ${JSON.stringify(resultA.body).slice(0, 100)}`);
  check('guest B submission ok', resultB.status === 200 && resultB.body?.ok === true,
    `HTTP ${resultB.status} ${JSON.stringify(resultB.body).slice(0, 100)}`);

  // Read back and assert both survived.
  const after = await readSnapshot(TOKEN_A);
  const afterPayload = after.body?.payload || after.body;
  const survived = countOurSubmissions(afterPayload, [stampA, stampB]);
  check(
    SEQUENTIAL ? 'both submissions persisted (sequential sanity)' : 'BOTH submissions persisted (no lost update)',
    survived.length === 2,
    `survived=${survived.length}/2${twoDistinctTokens ? '' : ' (same guest — replacement is expected)'}`,
  );

  if (survived.length === 1 && twoDistinctTokens && !SEQUENTIAL) {
    console.error(
      '\nLOST UPDATE REPRODUCED: one submission was dropped by a concurrent writer.\n' +
        'The for-update row lock from migration 0016 is not in effect for this path.',
    );
  }

  console.log(`\n${'='.repeat(64)}`);
  if (failures === 0) {
    console.log('RSVP CONCURRENCY PROBE: ALL CHECKS PASSED');
    process.exit(0);
  }
  console.error(`RSVP CONCURRENCY PROBE: ${failures} CHECK(S) FAILED`);
  process.exit(1);
}

main().catch((error) => {
  console.error('E2E script crashed:', error);
  process.exit(1);
});
