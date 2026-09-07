# Backend setup — Vercel + Supabase + Google Sheets mirror

The site is static files plus two small serverless functions. Data flows:

```
  page  ──POST /api/track──►  Vercel function  ──►  Supabase  (primary)
                                              └──►  Google Sheet  (mirror)
```

The page never talks to Supabase or Google directly, so **no keys appear in
your page source**. Both live in Vercel's environment variables.

You have to create the accounts yourself — I can't sign up on your behalf.
Everything else is already written and committed.

---

## Step 1 — Supabase

1. Sign up at <https://supabase.com> (free tier, GitHub login is fine).
2. **New project.** Name it `mrc-miracle`. Choose region **West US (Oregon)** —
   it is the closest to King County, which keeps writes fast.
3. Save the database password somewhere safe. You will rarely need it.
4. When the project finishes building, go to **SQL Editor → New query**, paste the
   whole of `supabase/schema.sql` from this repo, and press **Run**.
   It should say "Success. No rows returned."
5. Go to **Project Settings → API** and copy two values:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role** key (under Project API keys, click reveal) → this is
     `SUPABASE_SERVICE_ROLE_KEY`

> **The project already exists.** Ref `fsbrpozjfsioxhsqznxw`, so:
> `SUPABASE_URL=https://fsbrpozjfsioxhsqznxw.supabase.co`
> Verified live — its REST endpoint answers `401` (correct: it wants a key).
> Only the service_role key still needs copying, and it goes straight into
> Vercel, not into this repo.

> **The service_role key bypasses all security rules.** It goes in Vercel only.
> Never paste it into a page, a chat, a screenshot, or this repository. If it
> ever leaks, rotate it immediately in Project Settings → API.

### What the schema does

- `events` — one row per event, with **no** ip, user agent, name, email or
  precise-location column. Those columns don't exist, so a future change can't
  quietly start storing them.
- Row level security is **on with no policies**, which means the public key can
  do nothing at all — it cannot read or write. Only the Vercel function, using
  the service_role key, can insert.
- `impact_stats()` — a security-definer function returning aggregate totals only.
  This is how the live counter reads numbers without the table being readable.
- `progress` — saved checklist ticks for people who choose to sign in. Policies
  restrict every row to its own user.

---

## Step 2 — Vercel

1. Sign up at <https://vercel.com> with your **GitHub** account.
2. **Add New → Project**, and import `mrcmiracle/mrcmiracle.github.io`.
3. Framework preset: **Other**. Leave the build and output settings empty —
   this is a static site, there is nothing to build.
4. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from step 1 |
   | `SHEETS_WEBHOOK_URL` | your Apps Script `/exec` URL (optional) |

5. **Deploy.** You'll get a URL like `mrcmiracle.vercel.app`.
6. Under **Settings → Domains** you can change the subdomain. Pick the final
   one now and write it down — this is what goes on the posters.

### Status: verified working 2026-09-07

```
POST /api/track  →  {"ok":true,"supabase":"ok","sheets":"HTTP 401"}
GET  /api/stats  →  {"ok":true,"kits":0,"people":0,"lookups":1,"commits":0}
```

Supabase is receiving events. The Sheets mirror is still returning 401 until
step 3 below is done — note the primary write succeeded anyway, which is the
whole point of the mirror being secondary.

### Checking it works

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://mrcmiracle.vercel.app/api/track' -H 'Content-Type: text/plain' -d '{"event":"page_view","page":"test.html"}'
```

`200` means the row was written. Then check Supabase → **Table Editor → events**.

Anything else, read the response body — the function reports which of the two
writes failed:

```bash
curl -s -X POST 'https://mrcmiracle.vercel.app/api/track' -H 'Content-Type: text/plain' -d '{"event":"page_view"}'
```

An `unknown event` error is the allow-list doing its job: only the event names
listed at the top of `api/track.js` are accepted.

---

## Step 3 — the Google Sheets mirror

The mirror reuses the Apps Script collector that already exists. It is currently
returning **401**, so fix that first or leave `SHEETS_WEBHOOK_URL` blank.

**Deploy → Manage deployments →** pencil icon → Version: **New version** →
**Who has access: Anyone** → **Deploy**.

Verify:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://script.google.com/macros/s/AKfycbzcdC7ASSdjWLYF3zTWKMfxFcXv5n2M7KUvQRpbXQkBGdMj4eZFX7LRg_x246rnUUgs/exec' -H 'Content-Type: text/plain;charset=UTF-8' -d '{"event":"test"}'
```

`200` = working. Delete the test row afterwards.

Note the mirror is now **server-to-server**: the browser no longer calls Apps
Script, so the previous "Anyone" requirement is about Vercel reaching it, not
about library visitors.

---

## Step 4 — optional Google sign-in

Sign-in is **optional** and exists only to carry checklist progress between a
person's own devices. Every tool works without it. Until this is finished,
`/api/config` returns `sign-in not configured` and the sign-in block hides
itself — the site is fully functional in that state.

### 4a. One more Vercel variable

Supabase → **Project Settings → API** → copy the **anon / public** key.

| Name | Value |
|---|---|
| `SUPABASE_ANON_KEY` | the anon (public) key |

**This one is safe in the browser** — it is what every Supabase web app ships.
It can do nothing on its own here: `events` has row level security on with no
policies, and `progress` restricts every row to its own signed-in user. Do not
confuse it with `service_role`, which must stay server-side only.

### 4b. Google OAuth credentials

1. <https://console.cloud.google.com> → create a project (or reuse one).
2. **APIs & Services → OAuth consent screen**: External, app name
   `MRC Miracle`, support email `northcreek.mrc@gmail.com`. Add the same as
   developer contact. Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → Application type **Web application**.
4. Under **Authorised redirect URIs** add exactly:

   ```
   https://fsbrpozjfsioxhsqznxw.supabase.co/auth/v1/callback
   ```

5. Create, then copy the **Client ID** and **Client secret**.

### 4c. Turn the provider on in Supabase

1. Supabase → **Authentication → Providers → Google** → enable.
2. Paste the Client ID and Client secret. Save.
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://mrcmiracle.vercel.app`
   - **Redirect URLs**: add `https://mrcmiracle.vercel.app/**`

   Without the redirect URL entry, Google will send people back and Supabase
   will refuse the hand-off.

### 4d. Check it

Open `https://mrcmiracle.vercel.app/api/config` — it should now return
`{"ok":true,...}`. Then build a checklist, press **Continue with Google**,
confirm the 13+ prompt, and sign in. Tick a few items, open the same page on
another device signed into the same account, and the ticks should appear.

Progress merges as a **union**: ticking something on your phone never un-ticks
it on your laptop.

### The 13+ check is not optional

COPPA governs collecting personal information from children under 13, and an
email address is personal information. Partner approval does not waive federal
law. Anonymous use of every tool remains open to all ages and collects nothing
personal, which is why it is the default.

---

## Free-tier gotcha worth knowing

Supabase pauses free projects after about a week with no activity. A site that
goes quiet between smoke events could get paused, and the first visitor after
that would hit a cold project.

`.github/workflows/keepalive.yml` pings `/api/stats` on a schedule to prevent
this. It costs nothing. If you ever delete it, set a calendar reminder to open
the Supabase dashboard weekly instead.

---

## What is deliberately NOT collected

No names, no email addresses (unless someone explicitly signs in), no phone
numbers, no street addresses, no precise location, no IP addresses, no user
agents, no advertising identifiers, no third-party trackers.

`api/track.js` has a comment marking where IP and user agent would go, saying
not to add them. The privacy notice on the site is a promise — keep it true.
