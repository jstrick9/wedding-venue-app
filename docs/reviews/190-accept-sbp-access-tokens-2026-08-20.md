# Review #190 — Account tokens are `sbp_`, not project keys

The deploy Action rejected `sbp_…` as a project API key. That prefix is the
official Supabase Account Access Token format. Only `eyJ…`, `sb_publishable_…`,
and `sb_secret_…` are rejected now.

Operator: keep the current GitHub secret and re-run **Deploy Edge Functions**.

---

*End of Review #190.*
