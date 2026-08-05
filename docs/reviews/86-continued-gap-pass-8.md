# Review 86 — Continued gap pass round 8

Autonomous bug-hunt and UI/UX improvement pass. Five findings fixed, each
CI-validated and committed to `main`.

## 1. Clearer layout approval status + resubmit guidance for the couple
The Design & Approval tab was ambiguous in non-pending states: the submit button
stayed enabled after approval, and rejected/changes-requested layouts gave no
guidance. Now:
- approved layouts show a green hint and disable the submit button (labeled
  "Approved ✓"),
- changes-requested/rejected layouts show a blue guidance note and relabel the
  button to "Resubmit for approval".

## 2. Guest schedule day-picker shows each day's date
The multi-day schedule picker only showed "Day 1 / Day 2 / …". Now each tab shows
the weekday + date (e.g. "Fri · Aug 7").

## 3. RSVP attending-day checkboxes show each day's date
The "Which days will you attend?" checkboxes only showed "Day 1/2/3". Now each
shows its date alongside (e.g. "Day 2 · Sat Aug 8"). Updated the attending-days
test to match by checkbox role count.

## 4. A venue-completed couple event is now read-only for planning
The couple could keep editing spaces/design/guests/portal/collaborators after the
venue marked the event complete. Now all planning edits are gated off once
completed (view-only + chat still work), with a clear "event is complete" notice.
The venue can still reopen it.

## 5. Venue couple-card RSVP summary ignores stale RSVPs
The venue's per-couple summary counted all RSVP submissions, so stale RSVPs from
removed guests could inflate attending and drive "no reply" down. Now it only
counts RSVPs for current guests, consistent with the couple-side summary.

## 6. Couple portal polls for new guest RSVPs
A guest RSVPing from another device wasn't reflected in the couple's guest list
until an action/reload. Added a light 10s poll.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **394 passing / 11 skipped**.
