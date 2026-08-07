# Review 118 — Let couples change a collaborator's role

## What
The couple could invite collaborators (planner / family / vendor) but could **not**
change a collaborator's role after inviting — e.g. promote a "vendor" to "planner",
or fix a mis-invited role — without removing and re-inviting them.

## Change
Added a role `<select>` to each collaborator row in the Couples Portal's **People**
tab (hidden for the couple's own entry). Changing it updates the collaborator's role
via `updateCoupleEvent`, with a toast confirmation. Tiered permissions
(couple > planner > family > vendor) then re-apply on next render.

## Tests / CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`
(**482 passing / 11 skipped / 124 files**), `npm run build` all green.
