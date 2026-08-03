# Re-Review — 11: Guest Portal (fresh pass) — Portal Guests provisioning

## Finding

### GAP (non-functional feature) — No way to provision portal guests/tokens in the UI
`setPortalGuests` was exported by `guestPortal.ts` but **never called** anywhere.
`getPortalGuests` either returns explicitly-stored portal guests or falls back
to deriving guests from saved layouts (which carry no portal token). The
`GuestPortalManagement` admin tab configured the portal *settings* but had no
guest list editor.

Consequence: there was **no way to give a guest a portal token / grant portal &
lodging access**, so the token-based, server-verified guest identity (Feature F)
couldn't actually be provisioned from the app — a real incomplete feature.

**Fix:** Added a **Portal Guests** section to the Guest Portal admin tab:
- Add a guest (name, email, optional portal token) with portal + lodging access
  toggles; persists via `setPortalGuests`.
- List existing portal guests with access toggles and remove.
- Guests now carry `eventKey`, `token`, `allowPortalAccess`, `allowLodgingAccess`
  so the sign-in + RSVP + lodging gating all work end-to-end.

## Cross-module impact
- Completes the guest-portal identity workflow: admins provision guests → guests
  sign in by token/email/name → RSVP + lodging access enforced.

## Validation
- Typecheck clean; guest portal tests pass; full suite green; build succeeds.
