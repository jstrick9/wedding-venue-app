# Review 92 — Package integration & polish (round 14)

Follow-up to the wedding-package system: deepened package integration across the
venue and couple sides. All CI-validated and committed.

## 1. Venue-side package & add-ons summary per couple
The venue Couples & Events card gains a "🎁 Package" expandable showing the
assigned package (season pricing, guest/overnight limits, lodging-included,
included-item count) and the add-ons the couple added.

## 2. Package guest limit drives couple warnings
When a package is assigned, its included guest limit drives:
- the couple's "invited guests exceed limit" warning,
- the per-space capacity warning,
- the Overview "Expected guests" stat.
Falls back to the event's guest count when no package.

## 3. Lodging add-ons can link to a lodging property
The add-on admin lets a lodging add-on be tied to a specific lodging venue
(property); the couple's add-on list shows the property name — supporting the
venue offering different lodging properties at different prices as add-ons.

## 4. Add-ons auto-suggest venue setup tasks
Beyond lodging, adding an activity or ceremony/reception add-on auto-suggests a
venue setup task (guided-activity setup, ceremony add-on setup) so the venue
plans the corresponding prep. All suggested tasks remain editable by the venue.

## 5. Couple Overview package card + venue setup progress
- The couple's Overview shows a tappable package summary card that jumps to the
  Package tab.
- The venue couple card shows a compact "🛠️ done/total setup" badge.

## CI
`npm run typecheck`, `npm run lint:events`, `npx vitest run`, `npm run build`
all green. Full suite: **421 passing / 11 skipped**. Unused-locals scan clean.
