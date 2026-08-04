# Re-Review — Sidebar empty states (UX improvement)

## Finding
The sidebar's empty states always said "No tables... match this search" /
"No venue fixtures match this search", even when there was **no search** and the
catalog was simply empty (e.g., a fresh deployment). A first-run admin would see
a confusing "no match" message instead of guidance to add items.

## Improvement
Distinguish two cases:
- **Catalog truly empty** → guide admins to add items in the Admin Panel, and
  tell non-admins to check back later.
- **Search/category filtered out** → keep the "no match" message.

## Validation
- Typecheck clean; sidebar tests pass; full suite **302 / 11 skipped**; build
  succeeds.
