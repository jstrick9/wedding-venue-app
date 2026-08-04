# Review 65 — Admin Panel UX improvements

Focused pass on the Admin Panel for end-user/admin usability.

## 1. Venue search (VenueManagement)
The Venue Management section listed every venue in one long, unscannable scroll with no
way to find a specific venue. Added a "Search venues…" input (in the action bar) that
filters the list by name in real time, with a "No venues match" empty state when
nothing matches. Non-matching venues stay out of the list while typing.

## 2. Remember last-visited admin section
The Admin Panel always reopened on the "Venues" tab. Added persistence of the active
tab via a new `STORAGE_KEYS.ADMIN_LAST_TAB` so reopening the panel returns the admin to
the section they were last working in.

## 3. Fix non-functional user search / role / status filters (UserManagement)
The User Management section rendered a search input and two filter dropdowns, but they
were **dead** — the search `onChange` was empty and the selects had no value/onChange
binding, so nothing filtered. Implemented live filtering (by name/username/email, by
role, by active status) with a "Showing X of Y users" indicator, a "Clear filters" link,
and a "No users match" empty state distinct from the true "No Users Yet" onboarding.

## 4. Auto-scroll the active admin tab into view
With 15+ sections, the horizontal tab bar could leave the active section's tab scrolled
out of view (especially after a Quick-find jump or reopening on the last-visited tab).
Added refs + an effect that gently scrolls the active tab into view whenever the active
tab or the search query changes.

## 5. Fixture search (FixtureManagement)
The largest admin section lists fixtures in three big collapsible groups (venue,
lodging, exterior) with no way to find one. Added a live "Search fixtures by name…"
box (matches name/id/description) that filters all three groups simultaneously, with a
"Showing N of M fixtures" counter.

## Validation
- `npm run typecheck` clean; build green (~1.34 MB / ~304 KB gzip).
- `npx vitest run`: 325 passed / 11 skipped (storage-keys uniqueness test still green).
