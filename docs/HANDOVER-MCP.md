# Handover — tasks that need the Supabase / Vercel MCP connectors

Written 2026-09-07. **Updated later that day: the backend is finished. Tasks 1-5
are all done and verified live. Task 6 stays premature until real traffic.**

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

## Task 3 — The Google Sheets mirror — **FIXED**

Working since 2026-09-07. `/api/track` reports `{"ok":true,"supabase":"ok","sheets":"ok"}`.

**Two separate faults were stacked, which is why three sessions of "fix the access
setting" never worked.** The original deployment refused anonymous callers, and
editing an existing deployment never applied the change. A genuinely *new*
deployment fixed the access — and immediately exposed the second fault
underneath: the script editor was **empty**, so there was no `doPost` to receive
anything. `Version 3` fixed access, `Version 4` (after pasting `Code.gs` and
saving) fixed the code.

Diagnosis that cracked it: reading the response *body*, not just the status.
`Script function not found: doPost` is unmissable; `HTTP 401` alone is not.

The earlier Workspace-admin theory in this document was **wrong**. It was never
a school-account restriction.

Verified: `GET /exec` returns `{"ok":true,"message":"MRC Miracle collector is
running.","rows":N}` and the row count climbs on every POST.

**If it ever breaks again**, check the body before assuming permissions:

```bash
curl -s -L '<exec-url>'          # expect the JSON above
```

Anything else — a Drive "Page Not Found" page, a sign-in redirect, a "Script
function not found" — tells you which of the two faults you have. And always
deploy a **new deployment**, never an edit to an existing one.

Note the Apps Script column list still says `returning`; the database column is
`is_returning`. The sheet is a flat mirror of the raw payload so this does not
matter, but do not "fix" one to match the other without checking both.

## Task 4 — Optional sign-in — **DONE**

Live. `/api/config` returns `ok:true` with `providers:["google"]`, and the key it
serves decodes to `role: anon` for project `fsbrpozjfsioxhsqznxw`.

**The failure worth remembering.** `SUPABASE_ANON_KEY` was set three times to the
value the Supabase dashboard *displays* — the real first 8 characters followed by
200 U+2022 bullets. Vercel masks the value too, so editing the variable in place
re-saved the mask. It only took after **deleting** the variable and adding it
fresh from a clipboard loaded outside both dashboards.

`/api/config` now validates key *shape*, not just presence, and reports what it
observed (length, leading characters, bullet count, dot count). Before that it
answered `ok:true` for a key that could never work.

Sign-in renders one button per enabled provider, so switching a provider on in
Supabase makes its button appear with no code change. **Apple was considered and
declined**: it needs a paid Apple Developer account and forces the signing secret
to be regenerated every 6 months or logins break — a recurring landmine for a
club whose officers graduate.

**Still unverified:** a real sign-in round trip on two devices, confirming
progress merges as a union so ticking on device A never un-ticks device B. That
needs two real Google logins.

## Task 5 — Partner-editable clean air locations — **DONE (interim admin)**

`public.sites` mirrors the JSON entry shape plus `active`, `activated_at` and an
internal `note`. `GET /api/sites` returns only activated rows, read with
service_role; the table has RLS on with no policies and no anon grant, like
`events`. Verified: anon gets 401 on read and on write, and `note` is never in
the response.

`js/cleanair.js` merges the two lists. An activated row sharing an id with a
library **replaces** it, so a branch can be switched on in place. Activated
sites sort ahead of the baseline and carry an amber badge reading "Open now for
smoke" — the hazard colour is never the only signal.

**Any failure of the `/api/sites` fetch resolves to an empty list**, so the 344
libraries still render on their own. The JSON file remains the offline fallback
and nothing about this feature can break the page.

Verified end to end on production with a temporary activated row: it appeared
first, badged, above Bothell Library at the same distance, with the map links
working. The row was then deleted; the table is empty.

**The admin page is now built** at `/admin.html` (`js/admin.js`,
`api/admin-sites.js`). It needs **`ADMIN_EMAILS`** set in Vercel - a
comma-separated list of coordinator addresses - and working sign-in.

The security is entirely server-side. `/api/admin-sites` verifies the caller's
access token by asking Supabase who it belongs to (never decoding it locally)
and checks that verified address against `ADMIN_EMAILS`; the browser's claim
about who it is is ignored. Only known columns are written. With `ADMIN_EMAILS`
unset the endpoint refuses everything, which was verified live: no token, a
forged token, and a forged write all returned 503 and nothing was written.
`admin.html` carries a noindex meta, is disallowed in robots.txt inside the
User-agent group, and is absent from the sitemap.

**Verified live with `ADMIN_EMAILS` set:** no token, a forged token, a forged
write and a forged delete all return 401 and nothing is written. The 403 path for
a signed-in non-coordinator still needs a second real Google account to confirm.

Superseded note: Coordinators use the Supabase
table editor for now — click-by-click in `docs/UPDATING-SITES.md`. Build the
page once sign-in works: gate it on Supabase Auth with an allow-list of
coordinator emails, and have it write through a service_role API route rather
than granting the browser any access to the table.

The `/api/sites` cache window is deliberately short (30s). This is the
fastest-moving data on the site — when a coordinator withdraws a site people
must stop being sent there quickly. Do not lengthen it for performance.

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
