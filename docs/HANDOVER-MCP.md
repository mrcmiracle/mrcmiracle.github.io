# Handover — tasks that need the Supabase / Vercel MCP connectors

Written 2026-09-07. **Updated later that day: Tasks 1 and 2 are done, Task 3 is a
dead end and should be dropped. Tasks 4-6 remain.**

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

## Task 1 — Prove row level security blocks the anon key — **DONE, and it found a gap**

Run with the live anon key. Three of four probes passed; the third failed:

| Probe | Before | After |
|---|---|---|
| read `events` | 401 permission denied | 401 |
| insert `events` | 401 permission denied | 401 |
| execute `impact_stats` | **200, returned data** | **401** |
| read others' `progress` | `[]` | `[]` |

**Why the earlier fix missed it.** The function ACL was
`=X/postgres | anon=X/postgres | authenticated=X/postgres`. That leading `=X/`
is an implicit grant to **PUBLIC**. Revoking from `anon` and `authenticated`
does nothing while PUBLIC still holds EXECUTE. Migration
`revoke_impact_stats_from_public` revokes from all three and leaves a comment on
the function saying not to re-grant. Both `impact_stats` advisor warnings are
now gone; the remaining `rls_enabled_no_policy` INFO on `events` is deliberate.

**Severity, stated honestly:** this was not a personal-data leak. `impact_stats()`
returns four aggregate counts that are already public on the landing page via
`/api/stats`. It was defence-in-depth and a mismatch with the documented design.

`progress` was already correct — three policies, all `auth.uid() = user_id`, so
`auth.uid()` being NULL for anon yields no rows.

To re-run the probes later, get the anon key from
`get_publishable_keys` (it is a publishable key, safe to use, not a secret).

## Task 2 — Delete the verification rows — **DONE**

3 rows removed (`verifyabc1`, `mirrorchk1`, `sheetchk1` — all `page_view` on
pages that do not exist). 92 rows remain.

**Read this before quoting any number to a judge.** Every one of those 92 rows
is developer testing: 5 visitor ids, all from 2026-09-07, and `kits`, `people`
and `commits` are all still `0`. There is no member of the public in this table
yet. The numbers only start meaning something once the posters are up.

## Task 3 — The Google Sheets mirror — **STOP; recommend dropping it**

Still failing after the redeploy. Measured again:

```
POST /exec  -> 401
GET  /exec  -> 302 to accounts.google.com/ServiceLogin
```

That is the third session in a row this has failed, across two separate
redeploys by the user. Per this document's own guidance, the remaining
explanation is that the script is owned by a Workspace (school) account whose
admin blocks sharing outside the domain — which the user cannot override.

**Recommendation: drop the mirror.** Supabase is the primary store and works.
The portfolio needs CSV, which Supabase exports directly. Continuing to chase
this spends the user's time on a redundant path. If they want it anyway, the
only remaining move is to recreate the script under `northcreek.mrc@gmail.com`.

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

## Task 6 — Check indexes once there is real traffic — **premature, do not start**

There are 92 rows, all from one day of developer testing. `explain analyze` on a
table this size measures nothing. Revisit after the posters have been up long
enough to produce real volume. Original note follows.

### Original note

`supabase-postgres-best-practices` is installed in `.agents/skills/`. Use it.
Run `explain analyze` on the `impact_stats()` counts once the table has real
volume; the counts are unindexed aggregates and will slow down eventually.

---

## "This Connection Is Not Private" in Safari — not a site problem

Reported 2026-09-07. The server was healthy at the time, measured from outside:

```
cert    CN=*.vercel.app, Google Trust Services, valid 29 Aug - 27 Nov 2026
curl    HTTP 200, ssl_verify_result=0
DNS     64.29.17.67 / 216.198.79.67  (Vercel)
```

The site also loaded fine in a different browser in the same session, so the
fault was local to that Mac.

**The address bar in the screenshot read `mrcmiracle.vercel.app.` with a
trailing dot.** A trailing dot makes it a fully-qualified root-anchored name,
and Safari matches that strictly against the certificate: `*.vercel.app` does
not match `mrcmiracle.vercel.app.`, so it reports impersonation. curl is lenient
here and accepts it, which is why the two disagreed. Retyping the URL without
the trailing dot is the fix.

**If it happens again and there is no trailing dot,** press *Show Details* and
read who issued the certificate. `Google Trust Services` means the connection is
genuine and it is a browser-side quirk. **Any other issuer** - a school or
district appliance, Fortinet, Zscaler, a "security" proxy - means the network is
intercepting TLS, which is common on school wifi and is not something this
project can fix.

## Things that must not be undone

- **Read `docs/DESIGN.md` before changing anything visual.** It carries the
  aesthetic direction and seven enforceable rules. The most important: hazard
  colour is a strict semantic channel — amber only ever means smoke, red only
  ever means earthquake — and nothing critical may sit behind an animation.
- **Every page carries a `<noscript>` block that neutralises `.reveal`.**
  Without it a script failure leaves the landing page's five tool entries
  permanently invisible, because `.reveal` starts at `opacity: 0` and only
  JavaScript adds `.is-in`. Do not remove it, and extend it if you add another
  JS-gated reveal.

- **`events` has RLS on with no policies deliberately.** That is the strongest
  setting, not a bug. Supabase's linter flags it; a table comment explains why.
  Adding a policy would weaken it.
- **`impact_stats()` EXECUTE is revoked from anon and authenticated.** The
  Vercel function calls it with service_role. The original grant was unnecessary.
- **No `ip`, `user_agent`, name, email or precise-location column exists** in
  `events`, so a future change cannot quietly start collecting them. The privacy
  policy is a public promise — keep it true.
- **Directions offer Apple Maps, Google Maps and OpenStreetMap** on every clean
  air result. Only the destination's coordinates and name go in the URL; the
  page never has the visitor's location. `priv.s7.b` in both language files
  describes this exactly - if you change what a directions tap sends, change
  that text in the same commit. The privacy policy is a public promise.
- **The site makes zero third-party runtime requests.** Fonts are self-hosted,
  auth is plain fetch rather than the Supabase library, and the map only loads
  when someone taps it. Do not add a CDN script or a Google Fonts link.
- **The two "Right now" panels are inline HTML** and open with no network
  request. Air quality loads afterwards and must never gate them.
