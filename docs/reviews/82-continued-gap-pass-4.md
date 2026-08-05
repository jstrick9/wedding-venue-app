# Review 82 — Continued gap pass round 4

Autonomous bug-hunt and UI/UX improvement pass. Six findings fixed, each
CI-validated and committed to `main`.

## 1. Read-only question viewers couldn't browse groups
In `EventQuestionsWizard` readOnly mode the group step-tabs were disabled, so a
vendor (view-only) couldn't navigate between groups to review all answers. Step
tabs are now clickable in read-only; only inputs and the save button stay
disabled.

## 2. Couple Venue Spaces show indoor/outdoor + rain-backup warnings
Cards only showed size/capacity and a rain-backup note if one existed. Now cards
show an indoor/outdoor environment badge, and an outdoor space selected without a
venue-configured rain backup shows a clear warning so the couple can ask the
venue for a contingency.

## 3. Guest/collaborator email validation
Adding/editing a guest or inviting a collaborator only required a name (and email
for invites), so a typo'd email silently produced an invite that could never be
delivered. Added a basic email-format check when an email is provided, with clear
inline/toast messaging.

## 4. "Portal personalized" progress step reflects real customizations
The checklist marked "Portal personalized" as done whenever the (auto-seeded)
welcome message existed, so it always showed complete. Now done only when the
couple actually set a hero image, changed the welcome/meal options, or set an RSVP
deadline beyond the venue defaults.

## 5. Couple Design tab shows venue rules
Couples designed layouts without knowing the venue's rules (noise limits, decor
restrictions, load-in times, etc.), risking rejected layouts. Added a "Venue rules
to keep in mind" section to the Design & Approval tab whenever the venue has
configured rules.

## 6. Push shared Guest Portal settings to all couples (approved via clarifying question)
Couples are seeded from the venue's shared config once and keep their own
snapshot, so later venue updates never reached them. Added
`pushSharedConfigToCouples(venueConfig)` + a "📤 Push Shared Settings to All
Couples" button in the venue's Guest Portal admin that:
- updates venue-owned fields (welcome/RSVP message, access grace period, tab
  visibility, meal options, schedule),
- merges meal options and schedule items so each couple's added options/items are
  preserved, and
- never touches each couple's hero image, deadline, dates, or password.

## CI
All commits green: `npm run typecheck`, `npm run lint:events`, `npx vitest run`,
`npm run build`. Full suite: **392 passing / 11 skipped**.
