# Review 119 — Guard "guest access closes" field from NaN/0

## What
In the couple's **Portal Settings**, the "Guest access closes" field controls
`accessGracePeriodHours` (how long the portal stays open after the event). Clearing
the input produced `Number('') === 0`, which would close the portal at the very end
of the event day instead of the default 36-hour buffer; non-numeric input produced
`NaN`, which would break the grace-period math downstream.

## Change
The field now treats empty as the default `36`, ignores negative/NaN values, and
only stores a valid non-negative number.

## Verified as non-issues this round
- Couple portal's `event!` non-null assertions are all inside event handlers guarded
  by the early return when no session/event exists — safe.
- Guest portal sign-in gate handles unconfigured / closed / password-gated states
  with clear messages.
- EventQuestionsWizard validates required fields + dropdown options.
- Couple Portal Settings meal-option add dedupes by value; schedule-item add is
  validated.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
