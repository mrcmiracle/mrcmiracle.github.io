# Handover — MRC Miracle

Written 2026-09-06 for a fresh session picking this up cold.
Updated 2026-09-06 (second session): **Tasks 1 and 4 are done. The site is LIVE.**
Only Tasks 2 and 3 remain, and both need the user.

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

## The four remaining tasks

### Task 1 — Push to GitHub — **DONE**

The site went live on 2026-09-06 at <https://mrcmiracle.github.io>.

```
origin  https://github.com/mrcmiracle/mrcmiracle.github.io.git
```

Public, owned by the `mrcmiracle` organization, Pages serving `main` / `/ (root)`.

**The repository name is load-bearing.** `<owner>.github.io` is the only name GitHub Pages
serves at the bare org URL with no folder path after it. This repo was briefly named
`Emergency-Preparedness-Website`, which would have served at
`mrcmiracle.github.io/Emergency-Preparedness-Website/` and broken every printed poster.
**Do not let anyone rename it back.**

Verified against the live site, not a local copy: all 5 pages plus every JS, CSS, JSON and
image asset return 200; the clean air lookup fetches its data over HTTPS and returns 6 real
branches for 98011 (Bothell Library, 0.5 mi); the calculator returns 56 gallons for a
4-person household and issues a save code; Spanish switches the whole page including
generated text; Leaflet is still absent until the map button is tapped; console is clean.

Pushing again needs nothing special — the token is saved in the macOS keychain, so
`git push` just works:

```bash
cd ~/Downloads/mrc-miracle && git push origin main
```

If it ever asks for a password again the token has expired. Make a new classic token at
<https://github.com/settings/tokens> with the `repo` box ticked. **Never ask the user to
paste a token into the chat and never read one out of their keychain.**

**Do not push with the GitHub MCP `push_files` tool.** It flattens history into an
unrelated root commit, and its `content` field is a string, so `assets/logo.png` would be
corrupted. (That MCP connection was also returning `Bad credentials` at the end of the
second session; plain `git` over HTTPS is the reliable path.)

### Task 2 — Wire up data collection

`js/track.js` line ~14: `var ENDPOINT = '';`
Until this is filled in, events log to the browser console instead of being sent.
`apps-script/Code.gs` is ready to paste into a Google Sheet's Apps Script editor.
Click-by-click instructions: `docs/DEPLOY.md` step 4.

### Task 3 — Wire up analytics

`js/app.js` line ~9: `var GOATCOUNTER_CODE = '';`
Sign up at goatcounter.com, put the site code here. `docs/DEPLOY.md` step 5.

### Task 4 — Two docs were stale — **DONE**

Completed in the second session (commits `a523f53` and `0078f91`).
`docs/UPDATING-SITES.md` and `docs/DEPLOY.md` now describe the real IMLS dataset.

Three things were found to be wrong in the code-facing docs while fixing them, and are
now documented correctly — worth knowing before editing anything:

- **`"verified": true` is not a switch.** No code reads it. There is no "Demonstration
  data" banner anywhere any more. It is a provenance note for humans only.
- **`kind` is a translation key** (`air.kind.<kind>`), and `library` is the only value
  either `i18n` file carries wording for. Any other value renders a raw `air.kind.…`
  string on the page. Add the key to both `en.json` and `es.json` first.
- **A site's own `zip` field is never matched against.** Visitor lookups compare the
  typed zip to `data/zips.json` centroids, so a wrong `zip` on a site changes nothing
  on screen. Keep it correct anyway; the next person will assume it is load-bearing.

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
