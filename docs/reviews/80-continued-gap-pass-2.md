# Review 80 — Continued gap pass round 2 (chat read-tracking, cascade delete, chat auto-scroll)

Continued the autonomous bug-hunt and UI/UX improvement pass. Three findings
fixed, each CI-validated and committed to `main`.

## 1. Chat read-tracking (unread badges now actually clear)

**Bug/gap:** The venue's unread-chat badge counted every couple message that had
ever been sent and **never cleared**, even after the venue opened and read the
thread. The couple side had no unread indicator at all.

**Fix:** Added per-event, per-side read markers stored under a new
`spm_couple_chat_read` key:
- `markCoupleChatRead(eventId, 'venue'|'couple')` records the last-read time.
- `getUnreadCoupleMessageCounts(ids, side)` is now side-aware and
  backward-compatible: a message from the other side sent after that side's
  read marker is unread; with no marker yet, all incoming messages count.
- Venue marks its side read when the chat pane is opened (and keeps it clear
  while open); the couple marks its side read while the Chat tab is open.
- The couple's Chat nav tab now shows a red badge for unread venue messages.
- `coupleChatService.test.ts` covers clear-on-read, re-bump on new message, and
  side independence.

## 2. Cascade-delete a couple event's related data

**Bug/gap:** Deleting a couple event only removed the event row, leaving orphaned
guests, portal configs, RSVP submissions, chat messages, and answers in storage
(which also leaked into backups/exports).

**Fix:** Added `remove*` batch functions (`removeCoupleGuestsAndConfig`,
`removeCoupleRsvps`, `removeCoupleMessages`, `removeCoupleAnswers`) and wired
them into `deleteCoupleEvent`. Added a cascade-delete unit test.

## 3. Chat auto-scroll to newest message

**Bug/gap:** The venue→couple chat panes (venue side in `CoupleManagement`,
couple side in `CouplesPortal`) used fixed-height scroll areas but never scrolled
to the bottom, so new messages were invisible until the user scrolled manually.

**Fix:** Both panes now auto-scroll to the newest message on open and on each
refresh tick (via a stable ref + effect keyed on the tick / open id).

## 4. Couple meal-count summary surfaces unselected meals

**Gap:** The couple's Meal-counts summary only listed meals with a chosen count,
so attending guests who hadn't selected a meal were invisible to the couple
planning catering.

**Fix:** Added a "No meal selected" bucket for attending guests without a meal
choice, and a footer showing `X attending · Y total meal(s) for catering`.
Still 388 tests green.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **388 passing / 11 skipped**. Unused-locals scan clean.
