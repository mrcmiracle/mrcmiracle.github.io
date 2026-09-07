# Handover — MRC Miracle

Written 2026-09-06 for a fresh session picking this up cold.
Updated 2026-09-07 (third session): redesigned, progress saving added, backend code
written. **Supabase and Vercel still need the user to create the accounts.**
Task 2 is wired up in code but blocked on one Apps Script setting — read it first.

**Project:** `/Users/vihaa/Downloads/mrc-miracle`
**Owner:** North Creek High School HOSA · MRC Unit 503 partnership
**Contact:** northcreek.mrc@gmail.com · Instagram @mrc.miracle.nchs
**Live URL:** https://mrcmiracle.github.io (deployed 2026-09-06)

---

## What this is

A mobile-first static site (plain HTML/CSS/JS, no build step, no dependencies)
reached by QR code from posters in King County Library System branches. It must load
fast on library wifi and old phones. Landing page is ~20KB gzipped.

Read `README.md` first, then `docs/DEPLOY.md`. Those are current and accurate.

## State: built, tested, pushed and live. Six commits on `main`, working tree clean.

`main` is in sync with `origin/main`. 26 tracked files.

Re-verified end to end in a real browser in the second session, at 375px width, serving
from the scratchpad copy. Every result below was observed, not assumed:

- All 5 pages load with **no console errors, no missing translation keys, no
  horizontal overflow**
- Calculator water maths exact: 4 people → 56 gal, 5 → 70, 3 → 42, 1 → 14
  (`people x 1 gal x 14 days`). Item count tracks the pets/meds/housing toggles, not
  headcount — 28 items for apartment/no pets/no meds, 37 with pets + meds + house.
  (The first draft of this doc read "4 people → 37 items"; that run simply had the pet
  and medication toggles on. Item count does not vary with people, by design.)
- Save codes: all **96 possible households round-trip** in Node, and the round trip was
  re-confirmed through the actual UI — `KC-1WHV` restored 3 people / pets / meds / house.
  Typo tolerant (`kc-1whv`, `KC1WHV`, and padded spaces all restore correctly); all five
  garbage inputs tried (`ZZ-9999`, `hello`, empty, `KC-IIII`, `12345678`) left the form
  untouched. The code is shown in `#kit-save`, a separate section from `#kit-result`.
- Clean air finder returns correct real libraries for Bothell (98011 → Bothell Library,
  0.5 mi), Seattle (98101 → Central Library), Spokane (99201), Bellingham (98225) and
  Vancouver (98660); Oregon 97201 is refused with "Washington zips start with 98 or 99"
- Spanish switches everything including JavaScript-built text, and persists across pages
- Map is genuinely lazy: `window.L` is undefined until "Ver mapa"/"View map" is tapped,
  then the Leaflet CSS and JS tags are injected from cdnjs and the container initialises
  to 343x320 with tiles requested. **Measure it after it settles** — a `getBoundingClientRect()`
  taken too early reports ~52px tall and zero tiles, which looks like a bug and is not one.
- Footer logo, email, and Instagram present on all 5 pages

---

## Where things stand (third session, 2026-09-07)

**Done this session:** full visual redesign, per-device checklist progress, and
the Vercel + Supabase backend code. All pushed.

### Backend is LIVE and verified (2026-09-07)

Deployed at **https://mrcmiracle.vercel.app** (a rename to `mrcmiracle.vercel.app`
was recommended and is available — check which is actually in use).

Measured, not assumed:

```
GET  /                → 200
POST /api/track       → {"ok":true,"supabase":"ok","sheets":"HTTP 401"}
GET  /api/stats       → {"ok":true,"kits":0,"people":0,"lookups":1,"commits":0}
```

Supabase schema ran successfully. Writes are landing. Real usage has begun —
`lookups: 1` is a genuine `cleanair_lookup` from a visitor, not a test.

**One synthetic row to delete:** a `page_view` with `visitor = "verifyabc1"`,
`page = "verify.html"`. Written during verification. Remove it before pulling
any numbers for the portfolio.

### Remaining — needs the user

1. **Sheets mirror still 401.** Apps Script → Deploy → Manage deployments →
   pencil → Version: New version → Who has access: **Anyone** → Deploy.
   The URL is now server-side only (Vercel env var), so "Anyone" no longer
   exposes it publicly the way it did when it lived in js/track.js.
2. **Turn off GitHub Pages** (repo Settings → Pages → Source: None). The old
   copy at mrcmiracle.github.io still serves but its /api/track returns 405, so
   visitors there are silently uncounted.
3. **Decide the final domain before printing posters.**

### Remaining — needs MCP

Moved to **`docs/HANDOVER-MCP.md`**, which is the current list.
Live air quality, the privacy policy, sign-in code, the impact counter and the
full redesign are all done and deployed.

### Hosting decision changed this session

The user is moving to **Vercel** for hosting (was GitHub Pages). Reason given:
they thought GitHub Pages could not do a backend. That premise is wrong — the
site is static and Supabase works fine from a static host — but Vercel is still
the right call here, because the Google Sheets mirror and the Supabase
service_role key both need somewhere server-side to live.

**No posters are printed yet**, confirmed by the user, so the URL is still free
to change. GitHub Pages remains live at mrcmiracle.github.io.

## Decisions already made — do not undo these without asking

**The save code contains the checklist; it is not a lookup key.** Four answers fit in
9 bits, encoded into the code itself (Crockford base32, `KC-XXXX`). No backend, cannot
expire, works cross-device. See `js/savecode.js`.

**Data collection is anonymous by deliberate design.** The user originally asked for
cookies to build a "portfolio of people impacted" for WAHOSA 2027. That was pushed back
on and they agreed to: a random local id (not a cookie), plus full event
instrumentation. Reasons: minors use the site, cookies would force a consent banner,
and the HOSA rubric wants *counts and examples*, which anonymous data supplies. **Never
collect names, emails, precise location, or IP.** `docs/PORTFOLIO-METRICS.md` maps the
data to specific rubric lines with spreadsheet formulas.

**No "pending review" or "placeholder" markers appear anywhere in the UI.** The user
explicitly asked for these to be removed and said they would handle review themselves.
The Spanish `"reviewed": false` flag lives in `i18n/es.json` metadata only. Do not
re-add visible review badges.

**Washington has no fixed list of clean air locations — this is a real research
finding, not an omission.** Cleaner air sites are *activated per smoke event* by local
health jurisdictions. Public Health — Seattle & King County says it will "consider
activation and opening of cleaner air sites" at AQI thresholds and points people to
libraries and shopping centres. So `clean-air.html` leads with **live** sources (WA 211:
dial 2-1-1, text zip to 898211, Spanish 844-975-1882; King County smoke page; state AQI
map) and lists real libraries underneath as year-round public indoor spaces.

**`hours` and `transit` are blank on purpose.** The IMLS dataset does not contain them
and they were not invented. Each card shows the branch phone plus "Hours vary by
location. Call before you go." Fill them in only as they are actually verified.

**`pets` is `service_only` for every library** as an ADA-based legal baseline, flagged
in the data file's `pets_note`. Confirm per branch.

---

**The save code cannot be used as a private key.** It encodes only the four
answers, so there are exactly 96 possible codes — every 4-person household with
pets, meds and a house gets `KC-1WWT`. Checklist progress is therefore stored
per device only. Do not key anything private or server-side to this code.

**Chrome does not sync localStorage or cookies across devices.** The user asked
for cross-device continuity "like Google accounts do"; that only exists via real
sign-in. This was explained and they chose optional Google sign-in.

**The design system is derived from the seal.** `--brand: #4f2b92` is sampled
from `assets/logo.png`, not chosen. If the logo ever changes, resample it.
Fonts are self-hosted in `assets/fonts/` with their OFL licences; do not swap
them for a Google Fonts link, which would add a third-party request to a site
that currently makes none.

**The user relaxed the bandwidth constraint** (KCLS wifi is strong). Fonts and
graphics are fine to spend on. Still keep the two "Right now" panels inline with
zero requests — old phones and cellular users outside the library are the real
remaining constraint, not library wifi.

## Data provenance (all public domain, all fetched and verified this session)

| File | Source |
|---|---|
| `data/clean-air-sites.json` | IMLS Public Libraries Survey FY2023 outlet file — 344 WA library outlets, 39 counties, 76 in King County, bookmobiles excluded. Burien Library spot-verified against KCLS. |
| `data/zips.json` | US Census 2023 Gazetteer + 2020 ZCTA-to-county relationship file — 605 WA ZCTAs with centroids. |
| `assets/logo.png` | The team's own seal, supplied by the user. Cropped to a transparent circle, 176px, 22KB, lazy-loaded. |

---

## How to run and test it locally

The sandbox **cannot serve from `~/Downloads`** — the preview server 404s on every
path. Copy the site to the scratchpad and serve from there:

```bash
mkdir -p "$SCRATCH/serve" && cp *.html "$SCRATCH/serve/" && cp -R css js data i18n assets "$SCRATCH/serve/"
```

Then point `.claude/launch.json` at `$SCRATCH/serve` and use `preview_start`.
**Re-copy after every edit** — you are testing a copy.

The browser pane is often hidden, so screenshots come back blank and `computer` clicks
time out. Drive the page with `javascript_tool` and verify with `read_page` /
`get_page_text` instead. A blank screenshot is a repaint artifact, not a layout bug —
confirm with `getBoundingClientRect()` before chasing it.

### Useful checks

```bash
# translation key parity
cd /Users/vihaa/Downloads/mrc-miracle && python3 -c "import json;a=set(json.load(open('i18n/en.json')));b=set(json.load(open('i18n/es.json')));print('only en:',sorted(a-b));print('only es:',sorted(b-a))"
```

```bash
# save-code round trip across all 96 households
cd /Users/vihaa/Downloads/mrc-miracle && node -e "const S=require('./js/savecode.js');let n=0;for(let p=1;p<=12;p++)for(const a of[0,1])for(const m of[0,1])for(const h of['apartment','house']){const s={people:p,pets:!!a,meds:!!m,housing:h};const b=S.decode(S.encode(s));if(!b||b.people!==p||b.pets!==!!a||b.meds!==!!m||b.housing!==h)throw new Error('FAIL');n++}console.log(n+'/96 OK')"
```

## User preferences that matter

- Learning the technical side — explain in plain English, define jargon once.
- Wants pushback when wrong, not agreement. They were wrong twice this session
  (cookies, and thinking the HOSA rules required personal data); both corrections were
  accepted once evidence was shown.
- Never invent a citation, statistic, address, or dataset. Verify or say so.
- Strip invisible Unicode / AI provenance marks before shipping text. The tree was
  scanned clean this session; re-scan after bulk edits.
