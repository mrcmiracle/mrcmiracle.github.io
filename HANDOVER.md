# Handover — MRC Miracle

Written 2026-09-06 for a fresh session picking this up cold.

**Project:** `/Users/vihaa/Downloads/mrc-miracle`
**Owner:** North Creek High School HOSA · MRC Unit 503 partnership
**Contact:** northcreek.mrc@gmail.com · Instagram @mrc.miracle.nchs
**Target URL:** https://mrcmiracle.github.io (not live yet — see Task 1)

---

## What this is

A mobile-first static site (plain HTML/CSS/JS, no build step, no dependencies)
reached by QR code from posters in King County Library System branches. It must load
fast on library wifi and old phones. Landing page is ~20KB gzipped.

Read `README.md` first, then `docs/DEPLOY.md`. Those are current and accurate.

## State: everything is built and tested. Two commits on `main`, working tree clean.

Verified working in a real browser this session, at 375px width:

- All 5 pages load with **no console errors, no missing translation keys, no
  horizontal overflow**
- Calculator: 4 people → 56 gal / 37 items; 5 people → 70 gal; 1 person → 14 gal /
  28 items with pets section correctly absent
- Save codes: all **96 possible households round-trip**, 96 unique codes, typo
  tolerant (lowercase / no dash / spaces all work), all 8 garbage inputs rejected
- Clean air finder returns correct real libraries for Bothell (98011), Seattle,
  Spokane, Bellingham, Vancouver; an Oregon zip is correctly refused
- Spanish switches everything including JavaScript-built text, and persists across pages
- Map is genuinely lazy (Leaflet absent until the button is tapped)
- Footer logo, email, and Instagram present on all 5 pages

---

## The four remaining tasks

### Task 1 — Push to GitHub (BLOCKED, needs the user)

The org `https://github.com/mrcmiracle` **exists**. The repo does **not**.
The remote is already configured:

```
origin  https://github.com/mrcmiracle/mrcmiracle.github.io.git
```

A push was attempted and failed:

```
remote: Invalid username or token. Password authentication is not supported
fatal: Authentication failed
```

Two separate blockers:

1. **The repo does not exist.** The user must create it at
   <https://github.com/organizations/mrcmiracle/repositories/new> — named exactly
   `mrcmiracle.github.io`, **Public**, with **no** README/gitignore/licence.
   The exact name is what produces a URL with no folder path after it.
2. **Auth.** The macOS keychain holds a github.com entry for `vihaannrsingh-cmyk`
   but it is rejected — almost certainly an old password rather than a token.

**Do not ask the user to paste a token into the chat, and do not read the token out
of their keychain.** Let them authenticate themselves. Easiest options:

- **GitHub CLI** (no Homebrew on this machine — use the `.pkg` from
  <https://github.com/cli/cli/releases>), then `gh auth login` (browser flow), then
  `gh repo create mrcmiracle/mrcmiracle.github.io --public --source=. --push`
- **Or** create the repo in the browser, then `git push -u origin main` and let git
  prompt them for a Personal Access Token in *their* terminal
- **Or** create the repo in the browser and drag the folder *contents* (not the
  folder) into GitHub's web uploader

Once it exists: Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

### Task 2 — Wire up data collection

`js/track.js` line ~14: `var ENDPOINT = '';`
Until this is filled in, events log to the browser console instead of being sent.
`apps-script/Code.gs` is ready to paste into a Google Sheet's Apps Script editor.
Click-by-click instructions: `docs/DEPLOY.md` step 4.

### Task 3 — Wire up analytics

`js/app.js` line ~9: `var GOATCOUNTER_CODE = '';`
Sign up at goatcounter.com, put the site code here. `docs/DEPLOY.md` step 5.

### Task 4 — Two docs are stale

`README.md` is **current**. But `docs/UPDATING-SITES.md` and `docs/DEPLOY.md` still
describe the old placeholder dataset (they talk about eight `ph-` entries and setting
`"verified": true`). Those placeholders are gone. Update both to describe the real
IMLS library dataset and the `kind`/`county` fields.

---

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
