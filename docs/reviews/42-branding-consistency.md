# Re-Review — Branding consistency (improvement)

## Finding
The app hardcodes the brand color `#4A1942` in 278 places, but only 19
components use the admin-configurable `config.primaryColor`. The CSS already
mapped `bg-[#4A1942]` and `text-[#4A1942]` to `var(--primary-color)`, but
`border-[#4A1942]`, `ring-[#4A1942]`, gradient stops, and inline styles were
**not** mapped — so custom branding only partially applied.

## Improvement
- `src/index.css`: added CSS mappings so `border-[#4A1942]`, `ring-[#4A1942]`,
  `from-[#4A1942]`, `to-[#4A1942]`, and `divide-[#4A1942]` all resolve to
  `var(--primary-color)`. This makes the configured brand color apply across the
  whole UI (borders, focus rings, gradients) without touching 278 call sites.
- `AppErrorBoundary`: now uses `config.primaryColor`/`primaryDark` for its
  inline gradient and button, so the error/recovery screen follows the theme.

## Validation
- Verified the compiled CSS contains `border-color: var(--primary-color)`.
- Typecheck clean; full suite **301 / 11 skipped**; build succeeds.
