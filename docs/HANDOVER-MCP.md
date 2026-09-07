# Handover — tasks that need the Supabase / Vercel MCP connectors

Written 2026-09-07. Everything that could be done **without** database or
deployment introspection is finished and live. What remains genuinely benefits
from being able to query the database and read deploy logs directly.

Start a fresh session with the Supabase and Vercel MCP connectors enabled, then
work through this in order.

**Live site:** https://mrcmiracle.vercel.app
**Supabase project ref:** `fsbrpozjfsioxhsqznxw`
**Repo:** https://github.com/mrcmiracle/mrcmiracle.github.io

---

## Current state, measured not assumed

```
/                 200      /api/stats   200   {"ok":true,...}
/privacy.html     200      /api/config  200   {"ok":false,"reason":"sign-in not configured"}
/kit.html         200      /api/aqi     200   44 Washington areas, ~9KB
/clean-air.html   200      /api/track   200   {"ok":true,"supabase":"ok","sheets":"HTTP 401"}
```

All 6 pages: no console errors, no missing translation keys, no horizontal
overflow at 375px, in English and Spanish.

---

## Task 1 — Prove row level security actually blocks the anon key

**Do this first. The entire privacy design rests on it, and it has never been
tested — only reasoned about from the schema.**

With the **anon** key (not service_role), all of these must fail or return nothing:

```bash
ANON="<anon key from Supabase → Project Settings → API>"
BASE="https://fsbrpozjfsioxhsqznxw.supabase.co/rest/v1"

# must NOT return rows
curl -s "$BASE/events?select=*&limit=5" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

# must NOT insert
curl -s -X POST "$BASE/events" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"event":"rls_probe"}'

# must NOT execute (revoked in 002_security.sql)
curl -s -X POST "$BASE/rpc/impact_stats" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{}'

# must NOT read other people's saved progress
curl -s "$BASE/progress?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

If any of those succeeds, that is a live privacy hole on a site used by minors.
Fix it before anything else. If `002_security.sql` has not been run yet, run it.

## Task 2 — Delete the verification rows

Synthetic rows written while testing. Remove them before pulling any numbers
for the portfolio:

```sql
delete from public.events where visitor in ('verifyabc1','mirrorchk1','sheetchk1');
delete from public.events where page in ('verify.html','mirror-verify.html','sheetcheck.html','probe');
delete from public.events where event in ('mirror_probe','orientation_probe','rls_probe');
select event, page, visitor, received_at from public.events order by received_at desc limit 20;
```

## Task 3 — The Google Sheets mirror is still failing

`sheets: "HTTP 401"` on every write. The user redeployed as Version 2 but the
**"Who has access"** dropdown is still restricted — that is a separate control
from the version number.

Fix: Apps Script → Deploy → Manage deployments → pencil → **Who has access:
Anyone** → Deploy. Then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
 'https://script.google.com/macros/s/AKfycbzcdC7ASSdjWLYF3zTWKMfxFcXv5n2M7KUvQRpbXQkBGdMj4eZFX7LRg_x246rnUUgs/exec' \
 -H 'Content-Type: text/plain;charset=UTF-8' -d '{"event":"test"}'
```

**If it still 401s after that**, the script is probably owned by a Google
Workspace (school) account whose admin blocks sharing outside the domain. In
that case stop fighting it: Supabase is the primary and works. Either move the
script to the `northcreek.mrc@gmail.com` account, or drop the mirror entirely
and export CSV from Supabase, which is what the portfolio actually needs.

Note the Apps Script column list still says `returning`; the database column is
`is_returning`. The sheet is a flat mirror of the raw payload so this does not
matter, but do not "fix" one to match the other without checking both.

## Task 4 — Finish optional Google sign-in

Code is written and deployed; it is dark until three things are configured.
Full steps in `docs/BACKEND.md` step 4. Summary:

1. Add `SUPABASE_ANON_KEY` to Vercel env (safe in the browser, unlike service_role).
2. Google Cloud Console → OAuth client → authorised redirect URI exactly
   `https://fsbrpozjfsioxhsqznxw.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google (paste client id/secret), and
   URL Configuration → Site URL `https://mrcmiracle.vercel.app` plus redirect
   URL `https://mrcmiracle.vercel.app/**`. **Missing that last entry is the
   usual cause of a failed hand-off.**

Then verify `/api/config` returns `{"ok":true,...}` and test a real sign-in on
two devices. Progress merges as a union — confirm that ticking on device A
never un-ticks on device B.

**The 13+ gate is not negotiable.** COPPA governs collecting personal data from
under-13s; an email address is personal data. MRC's written approval covers the
partnership, not federal law. Do not remove it.

## Task 5 — Partner-editable clean air locations

The one remaining feature from the original brief. Today `data/clean-air-sites.json`
holds 344 real libraries from the IMLS federal dataset, but cleaner air sites are
**activated per smoke event** — so Unit 503 needs to add and activate sites live.

Suggested shape:
- `sites` table in Supabase mirroring the JSON fields, plus `active boolean`
  and `activated_at`.
- A small admin page behind Supabase Auth, restricted to a list of allowed
  emails, where a coordinator can add a site and flip `active`.
- `js/cleanair.js` merges: activated sites first and badged, libraries after.
- Keep the JSON file as the offline fallback if the database is unreachable.

## Task 6 — Check indexes once there is real traffic

`supabase-postgres-best-practices` is installed in `.agents/skills/`. Use it.
Run `explain analyze` on the `impact_stats()` counts once the table has real
volume; the counts are unindexed aggregates and will slow down eventually.

---

## Things that must not be undone

- **`events` has RLS on with no policies deliberately.** That is the strongest
  setting, not a bug. Supabase's linter flags it; a table comment explains why.
  Adding a policy would weaken it.
- **`impact_stats()` EXECUTE is revoked from anon and authenticated.** The
  Vercel function calls it with service_role. The original grant was unnecessary.
- **No `ip`, `user_agent`, name, email or precise-location column exists** in
  `events`, so a future change cannot quietly start collecting them. The privacy
  policy is a public promise — keep it true.
- **The site makes zero third-party runtime requests.** Fonts are self-hosted,
  auth is plain fetch rather than the Supabase library, and the map only loads
  when someone taps it. Do not add a CDN script or a Google Fonts link.
- **The two "Right now" panels are inline HTML** and open with no network
  request. Air quality loads afterwards and must never gate them.
