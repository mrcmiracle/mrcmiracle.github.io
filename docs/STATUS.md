# Current status — one source of truth

**Updated 2026-10-03.** This file supersedes the handoff notes listed at the bottom.
Where this file and an older document disagree, this file wins, and the deployed
code wins over both.

## What is deployed right now

| | Project | Production deployment | Source of that deploy |
|---|---|---|---|
| Website | `vihaannrsingh-cmyk/mrc-miracle` | see release note below (2026-10-03) | Git auto-deploy from `main` |
| Classifier | `vihaannrsingh-cmyk/wound-analyzer-vercel` | `wound-analyzer-vercel-9o38jv884` + card redeploy (2026-10-03) | Vercel CLI from `~/Downloads/wound-analyzer-vercel` |

Website repo: `github.com/mrcmiracle/mrcmiracle.github.io` (despite the name, it is
served by Vercel, not GitHub Pages). Local checkout `~/Downloads/mrc-miracle` is level
with `origin/main` at `8c57e87`.

**Two deploy routes exist for the website** — Git auto-deploy *and* `npx vercel --prod`.
Fetch before deploying; a CLI deploy from a stale checkout silently overwrites newer
merged work. Prefer pushing to `main`.

The classifier directory is **not a git repo**. `npx vercel ls wound-analyzer-vercel --prod`
is the only authority on what is serving.

### Rollback references

- Website: previous production `mrc-miracle-fqg5jzkri`; previous commit `8c57e87`.
- Classifier, newest first: `g0fyqeygp` (current) → `p88tya367` (same code, old card) →
  **`i3d03qut5` (the pre-2026-10-03 release — roll back here)** → `axnmf5u04` → `jop7ssu2o` (crop retry
  still on) → `imjnkbxko` (one gate, 0.60) → `qpgrxqjqx` (pre-burn-merge, seven classes).
- A Vercel rollback does **not** reverse Supabase. See the Supabase note below.

## Verified backend configuration

The live `api/predict.py` is **byte-identical** to the branch snapshot
`experiments/v4/production_two_gates_075_nocrop/predict.py`
(sha256 `f5dd429a656b98b5aabc489ce8cef2530dcbd7bc321a18b0f9efef94360a35bd`), and the three
`.tflite` files match that snapshot's checksums.

- `CONFIDENCE_THRESHOLD = 0.75` — the site's `CONFIDENCE_THRESHOLD_PCT = 75` agrees.
- `GATE_THRESHOLD = 0.5`, two gates, vetoing on the **higher** out-of-scope probability.
- **`CROP_RETRY = False`.** `_classify()` iterates `_views(img)[:1]`, so only the frame as
  sent is scored. `CENTER_CROP = 0.70` and `CROP_MIN_CONFIDENCE = 0.80` are still defined
  but unreachable. *The "crop stays at 0.80" statement in older handoffs is obsolete.*
  The `_classify` docstring still claims it looks at a crop — stale, see Known defects.
- Reported classes: `abrasion`, `bruise`, `possible_burn`, `cut`, `out_of_scope`. The three
  burn degrees are **summed** into `possible_burn` by `merge_burns()`.

## Supabase

No Supabase schema change was made during the model-improvement work: `supabase/*.sql` was
last touched `b474017` (2026-09-07). Inference does **not** run on Supabase.

**Drift to be aware of:** the site calls five RPCs, but only `impact_stats` is defined in
the repo. `prep_impact`, `qr_report`, `wound_impact` and `section_use` exist **only in the
live database** with no migration file. The repo is therefore not a complete description of
the backend. These functions are additive, so a frontend rollback is safe without touching
them.

Secret **names** only (never values): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAILS`,
`GOOGLE_AQ_KEY`, `GOOGLE_MAPS_KEY`, `WOUND_API_URL`.

## Open defect: healthy skin labelled "possible burn"

Reproduced 2026-10-03 on held-out photos that never entered training, by importing the live
`api/predict.py` directly:

| Population | n | Labelled as an injury | of which `possible_burn` |
|---|---|---|---|
| Healthy faces (`oily_dry_skin_types`, held out) | 146 | 21 (14.4%) | 20 |
| Normal skin (`skindisease_unknown_normal`, held out) | 248 | 15 (6.0%) | 15 |
| Normal skin (`ghost_normal_skin`, held out) | 7 | 3 | 3 |

**38 of the 39 false alarms are `possible_burn`.** Two distinct causes:

1. **Score aggregation.** `merge_burns()` sums the three burn probabilities. Diffuse
   uncertainty crosses the 0.75 bar that no single class reaches — e.g. 25.9 / 42.2 / 7.7
   sums to 75.8%. Scoring the same photos without summing (same bar, same gates), **22 of
   the 39 false alarms disappear**.
2. **Model limitation.** The other 17 are confidently wrong on a single class — up to 96.4%
   `burn_1st_degree` on a healthy face. The classifier's `out_of_scope` training set
   contains **no faces at all**: it is clinical dermatology, chronic wounds, bites, and
   feet/arms. Faces reached only the healthy *gate*, not the classifier.

The merge also inflates displayed confidence, so these appear as "fairly sure" (≥85%).

## Known defects, not yet fixed

- Stray file named `-w` committed at the repo root (`26be345`), 7,760 bytes, deployed.
- `_classify()` docstring describes crop-retry behaviour that no longer runs.
- `isPossibleSevereBurn()` in `js/wound.js` is dead code: it tests for `burn_3rd_degree`,
  which the backend never returns. Its "call 911" banner is unreachable. Escalation now
  lives only in `wound.tips.possible_burn.4`.

## Backup

`v3-2026-09-27.zip` is in Drive folder `1iIPvvztKoUDE3YM9fUS02F28n9sleU9s` at
282,675,592 bytes — matching the reported size — with its `.sha256` sidecar.
The **local** archive is checksum-verified (`shasum -c` → OK,
`2f3218dd041fc7c4866a8e73a99fe54cf0333c4e922c4fc10bc54b9ae3913cb7`).
The **Drive copy is size-verified only**; confirming its bytes would require downloading
282 MB and hashing it.

## Branch reality (corrects earlier notes)

- There is **no `claude/wound-v4` branch.** The v4 work is on `claude/roboflow-compare`,
  which is open PR #3 on `krishshah120/Wound-Analyzer`.
- Open PRs: #1 `claude/silly-wilson-17d01a`, #2 `claude/wound-v2`, #3 `claude/roboflow-compare`.
- Experiment data and the project venv live in the worktree
  `Wound-Analyzer/.claude/worktrees/silly-wilson-17d01a`, not in the main checkout.

## Historical — superseded, keep for detail only

`HANDOVER-MCP.md`, `BACKEND.md`, `DEPLOY.md`, `UPDATING-SITES.md`,
`PORTFOLIO-METRICS.md`, `DESIGN.md`. Treat any deployment ID, threshold or crop statement
in these as historical.

## v5 model-session findings (2026-10-03) — verified, nothing deployed

The model session reproduced the defect at larger scale and its rate agrees with the
independent measurement above (faces 126/864 = 14.6% there, 21/146 = 14.4% here, different
photos). Full report: `Wound-Analyzer/.claude/worktrees/silly-wilson-17d01a/experiments/v5/RESULT.md`
(local branch `claude/v5-face-fix`, commit `c72c205`, **not pushed**).

Checked here rather than taken on trust:

- **Label contamination, confirmed — and already known.** The offending photo is line 249 of
  `experiments/v2/flagged_for_review.csv`, flagged on similarity 0.845 against a *normal skin*
  photo, split "test". That file holds 319 flagged photos, 38 of them likely label conflicts
  (3 in the test split). The detection worked over a week ago; nothing was done with it. The
  labels are deliberately NOT being changed — the repo's practice is to flag for qualified
  review and test exclusion instead, which is the right call for medical labels.
- **The effect on the published figures is now measured, and it is small.** The v6 round
  flagged 32 no-visible-injury photos under a written criterion (`experiments/v6/flags.csv`),
  9 of them in the test split; 5 were already in the v2 file, 27 are new. Excluding the 9 moves
  "right when it names one" from 153/164 = 93.3% to 151/162 = 93.2% — **0.1 points**, verified
  here independently. The model card's "93%" therefore stands and needs no correction. An
  earlier line in this file called the optimism "unmeasured"; it is now measured, and negligible.
  Spot-checked two flags by eye and both are correct: a pair of hands on an unmarked abdomen
  labelled "first-degree burn", and a blurred stock watermark labelled "cut".
- **Label contamination, confirmed.** `data/test/burn_1st_degree/burn_1st_degree_kg2_693.jpg`
  is a stock photo of a woman touching an uninjured face, labelled "first-degree burn" **in
  the test split**. First-degree-burn training photos include many faces; the "not a wound"
  class has none. So the test set partly *rewards* calling a healthy face a burn. The size of that effect is
  measured below and comes to about 0.1 points.
- **Candidate code, confirmed.** `experiments/v5/production_mean_070/api/predict.py` differs
  from live in exactly three places: threshold 0.75 → 0.70; the classifier is averaged with
  the healthy-skin model; that model's output is reused for the gate.
- The live service also labels food, a giraffe, a fish and a clothes shop as wounds.
- Crop retry, when it was on, made this worse: 343 false labels instead of 220.

### The candidate, measured on untouched photos

| | Live | Candidate | Paired 95% CI |
|---|---|---|---|
| Correct wound names | 208 | 206 | −13..+9 (flat) |
| False alarms | 507 | **392** | **−191..−60** |
| Wrong injury names | 19 | **12** | −13..−2 |
| Faces labelled (of 864) | 126 | **70** | |

**Fails the pre-declared bar** (correct answers do not rise), so it was not deployed. The
trade it does offer: materially fewer false alarms and fewer wrong names, for no measurable
loss of correct answers. That is Vihaan's decision, not a session's.

### Roboflow — closed

`wound-ebsdw-4atst` is ruled out, now including on faces, where it is **worse** (82 vs 61
labelled of 531). At 0.40 it gets 39 wound names right vs live's 79; at 0.82 it answers
almost nothing. No further Roboflow work is warranted.


## Release 2026-10-03 — averaged classifier at 0.70

Deployed after Vihaan chose it over holding for a retrain. Backend `g0fyqeygp`, site
`98oq5pvba` (commit `74657ee`). Rollback: classifier to `i3d03qut5`, site to `fqg5jzkri`;
the backend file it replaced is kept at
`wound-analyzer-artifacts/predict.py.live-i3d03qut5-backup`. No Supabase change, so a
rollback of either side is complete on its own.

Three lines differ from the previous backend: threshold 0.75 → 0.70; the classifier is
averaged with the healthy-skin model; that model's output is reused for the gate.

**Verified end to end after deploy**, through the site's own `/api/wound` proxy:
healthy face → `unknown` (was `possible_burn` 90.9); `cut_kg1_116` → `cut` 85.7;
`burn_2nd_degree_kg2_1023` → `possible_burn` 91.8; `{}` → `{"ok":false,"error":"no image"}`;
GET → `{"ok":false,"error":"POST only"}`. Spanish has every `possible_burn` and
confidence-wording key — no gaps. Site and server both report 70.

### Public figures were re-measured, not carried over

Browser-encoded test split, this server's own `_classify()`:

| | Before | Now |
|---|---|---|
| Close-ups named | 172/331 (52%) | 164/331 (50%) |
| Right when named | 154/172 (89%) | 153/164 (93%) |
| Non-wounds called a wound | 48/450 (11%) | 44/450 (10%) |
| Arm's length named | 60/331 (18%) | **47/331 (14%)** |

The arm's-length figure got **worse** and the model card says so. Reconstructing the original
padding (blurred self-copy, non-wounds padded too) reproduced the recorded 2.7% non-wound
rate as 2.9%, which is what validates the reconstruction; `experiments/data_frame50` must not
be quoted beside these numbers because it leaves non-wound photos unpadded.

An independent run on raw 224 px files suggested the release also *raised* correct answers
(161 vs 153). Browser-encoding removed that difference entirely, so **no claim is made that
correct answers rose** — they are flat, and only the false-alarm side improved.


## v6 round (2026-10-03) — no candidate beats live, nothing deployed

Retraining with the flagged photos excluded, plus 1,609 healthy-skin and 821 extra face photos
added to "not a wound", produced a best candidate — mean of the new model, the deployed model
and the healthy model at 0.70 — that **fails the bar**:

| | Live | v6 best |
|---|---|---|
| Correct wound names | 204 | 202 |
| False alarms | 392 | 368 (CI −69..+12, not significant) |
| Arm's length named | 47 | **39 (worse again)** |
| Faces labelled (of 864) | 70 | **48** |

**The conclusion matters more than the numbers:** adding non-wound data keeps improving the
false-alarm side and never improves the number of wounds correctly named. Two independent
rounds have now failed the same half of the objective. More negatives cannot fix it — that half
needs more and better-labelled *wound* photos, which is the EBIS access that is still pending.

Production stays on `g0fyqeygp` / `98oq5pvba`.


## Release 2026-10-03 (third) — the middle ground, threshold 0.65

Vihaan asked for one configuration balanced for distribution at KCLS libraries and to PHRC
volunteers. The averaging was already live, so **only the threshold moved: 0.70 → 0.65.**

Chosen by sweeping averaging weight (0 … 0.5) against threshold (0.55 … 0.75) on `data/val`
only, then reporting the shortlist once on the untouched test split, the held-out healthy
photos and the arm's-length reconstruction:

| | 0.75 no avg | 0.70 avg | **0.65 avg (now)** | 0.60 avg |
|---|---|---|---|---|
| Wounds named | 172 | 164 | **189** | 210 |
| Right when named | 154 (89.5%) | 153 (93.3%) | **173 (91.5%)** | 188 (89.5%) |
| Wrong names | 18 | 11 | 16 | 22 |
| Non-wounds labelled | 48 (10.7%) | 44 (9.8%) | 58 (12.9%) | 82 (18.2%) |
| Healthy faces labelled | 18 (12.3%) | 10 (6.8%) | **14 (9.6%)** | 18 (12.3%) |
| Arm's length answered | 42 (12.7%) | 47 (14.2%) | **68 (20.5%)** | 84 (25.4%) |

0.60 was rejected outright: it returns face false alarms to 12.3%, the level that started this
work. 0.65 names **more wounds than either predecessor**, answers half again as many
arm's-length photos, and keeps most of the face fix. The cost is 12.9% of non-wound photos
labelled instead of 9.8%.

### Front-end work shipped with it

- Site threshold synced to 65.
- **Dead code removed.** `isPossibleSevereBurn()` tested for `burn_3rd_degree`, which the
  backend can no longer return. While removing it, a surviving call in the wound-history
  renderer was found that would have thrown a `ReferenceError`; `node --check` does not catch
  that, a grep did.
- The stray `-w` file committed in `26be345` is deleted; it was being served from the site root.
- Service worker `v19` → `v20`, so returning visitors get the new code rather than a cached copy.

### Pre-distribution checks

- `node --check` clean on every file in `js/`, `sw.js` and `api/`.
- All 33 service-worker precached paths exist on disk (an offline visitor gets a complete site).
- 205 referenced translation keys, **none missing in either language**; en.json and es.json hold
  582 keys each with no key present in one and absent from the other.

### Verified on the live site after deploy

- Every page returns 200 (`/`, wound, clean-air, emergencies, privacy, impact, `/logo`, 404);
  the deleted `-w` file now returns 404.
- The real upload path was exercised in a browser, not just unit-checked: a synthetic photo
  through the actual file input renders the unsure result, the "we can't tell" line, the
  12-item care box, 14 source links and 4 guidance steps, with no confidence number — correct.
- Spanish verified end to end on the rendered result: heading, label, care-box heading and
  guidance all translate; 375 px layout correct.
- `/api/wound` end to end: `cut` 85.7, `possible_burn` 91.8, healthy face `unknown`;
  `{}` → `{"ok":false,"error":"no image"}`, GET → `{"ok":false,"error":"POST only"}`.
- `robots.txt` still disallows `/admin.html` and `/logo`, both of which carry
  `noindex, nofollow`. The poster QR path `/q/kcls-bothell` still 302s to `/?src=kcls-bothell`,
  so printed library posters keep working and keep counting.

### Known cosmetic issue, deliberately not patched

Navigating between pages logs `Uncaught (in promise) AbortError: Transition was skipped` to the
browser console. It comes from the declarative cross-document view-transition feature
(`@view-transition { navigation: auto; }` in `css/styles.css`) when a transition is skipped —
there is no site-code promise to attach a `catch` to. It has no functional effect.

It could be silenced with a global `unhandledrejection` handler, but that would also hide real
errors, which conflicts with the standing instruction to raise errors rather than swallow them.
Removing `@view-transition` would clear it at the cost of the page transition. Left visible and
recorded here instead; say which trade you prefer.

## Supabase auto-pause, and the keep-warm cron (2026-10-11/12)

The project paused and was resumed manually. The site itself never went down — pages, the
wound tool and air quality do not touch Supabase — which is exactly what makes this dangerous:
nothing looked broken.

**What actually breaks while it is paused**, measured during the outage rather than assumed:

- `/api/impact` → 502 (`section_use HTTP 521`).
- `/q/<slug>` still returns 302 and still sends people to the site — `api/q.js` fails open by
  design, so a printed poster never shows an error — **but the code lookup fails, so the
  redirect drops `?src=` and the scan is never counted.** Posters keep drawing people in and
  nothing records that they came.
- Sign-in and all visit tracking fail.

**Cause.** The organisation is on the Supabase **free plan**, which auto-pauses on inactivity.
Note the evidence does not fit the plain seven-day story: real visits landed on Oct 5, 6 and 8,
the last about four days before the pause. Storage is ruled out — 12 MB against a 500 MB limit,
1,952 event rows, 936 kB of tables. Supabase does not expose the pause reason over the API; the
project page in its dashboard normally states it.

**Mitigation shipped.** `vercel.json` now runs a daily cron at `0 11 * * *` against
`/api/impact`, which already reads the database through five RPCs.

A dedicated `/api/keepwarm` was written first and **could not ship**: the Vercel **Hobby plan
allows 12 Serverless Functions per deployment and this project already has exactly 12**, so the
deploy was rejected. Production was unaffected — Vercel keeps the last good deployment serving.
Reusing `/api/impact` needs no new function. Its cache cannot absorb the request either:
`s-maxage=30, stale-while-revalidate=120` are both long expired a day later, so the CDN must
revalidate at the origin.

Verified, not assumed: `vercel crons ls` lists the job, and triggering it at `04:43:10.893Z`
produced **six Supabase requests at `04:43:11.3`** — the five RPCs plus overhead.

**If a 13th API function is ever needed, something must be removed or the plan upgraded.**

## Domain move to mrcmiraclehealthcorps.org (2026-10-17)

Primary address is now **https://www.mrcmiraclehealthcorps.org**; the apex 308-redirects to
it. Canonical, `og:url`, sitemap, robots and the QR generator in `js/admin-qr.js` all point
there, so posters printed from here on carry the new address.

### The trap: adding the custom domain silently dropped `mrcmiracle.vercel.app`

For a period after the custom domain was attached, **every path on `mrcmiracle.vercel.app`
returned 404** — including `/q/<slug>`. That domain is encoded in the QR codes already
printed and hanging in KCLS libraries, so every one of those posters was dead.

Restored with `npx vercel alias set <deployment> mrcmiracle.vercel.app`, which registered it
as a verified project domain. Confirmed it now **tracks production**, not a pinned
deployment, by deploying again and checking the old host serves the new CSS.

Two rules follow:

1. **After ANY domain change, immediately `curl` an old `/q/<slug>` path.** A poster in a
   library has no way to tell anyone it stopped working.
2. **`mrcmiracle.vercel.app` must never be given a `redirect` to the new domain.** It has to
   serve the app directly, because `/q/<slug>` is counted by a function — a redirect would
   bounce the scan before the function ran and scans would silently stop being recorded.

### Open: sign-in on the new origin

`js/auth.js` builds its callback from `location.origin`, so it adapts automatically, but
**Supabase must allow the new origin or Google sign-in will bounce users back to the old
domain.** Add to the Supabase dashboard → Authentication → URL Configuration:

- Site URL: `https://www.mrcmiraclehealthcorps.org`
- Redirect URLs: `https://www.mrcmiraclehealthcorps.org/**` (keep
  `https://mrcmiracle.vercel.app/**` as well, since posters still land there)

No MCP tool exposes Supabase auth config, so this is a dashboard change.

### Open: the Google Maps key has no referrer restriction

Tested by requesting the Maps JS API with three different `Referer` headers, including
`https://example.invalid/` — all three returned an identical 176,584-byte response. The key
is served publicly by `/api/config` (it has to be), so with no restriction **anyone can take
it and bill Google to this account**. Restrict it in Google Cloud Console → Credentials →
HTTP referrers to `www.mrcmiraclehealthcorps.org/*`, `mrcmiraclehealthcorps.org/*` and
`mrcmiracle.vercel.app/*`. Maps will keep working on the new domain either way — this is a
billing exposure, not a breakage.

## Layout now adapts to the device (2026-10-17)

`--maxw` was `42rem` at every width. Measured at 1440px that gave a 672px column with 384px
of dead margin each side — **47% of the screen in use**. The container now steps up with the
viewport (46 / 58 / 68 / 76rem) and the same laptop uses **76%**; 1920px uses 1216px.

Prose deliberately does not follow it: paragraphs directly in the container keep a 46rem
measure, because a text line spanning a wide monitor is harder to read. Cards, the survey and
the dashboard take the extra room instead.

Widening the container exposed a bug it had been hiding: `.btn-block` is `width: 100%`, which
rendered the wound page's primary button **990px wide**. Block buttons now stop at 24rem once
there is room. The longer wordmark also broke onto three ragged lines on a phone and cost
19px of header height; `text-wrap: balance` puts it on two, restoring the original 108px.

Verified at 375 / 768 / 1440 / 1920 in both languages, no horizontal overflow at any width.

### Theming was done within DESIGN.md, not against it

The request was a "health corps theme". `docs/DESIGN.md` forbids decorative iconography and
any fifth accent colour, so the identity is carried by naming and typographic weight — no
crosses, no stripes, no new colour. The HOSA tagline is untouched and still sits directly
under the wordmark, where PHRC asked for it.

## Post-migration incident and fixes (2026-10-17/18)

**Root cause of the dead posters AND the broken Google sign-in: `vercel alias set`.**

Restoring `mrcmiracle.vercel.app` with `npx vercel alias set <deployment> <domain>` creates a
**deployment alias**, not a project domain. Deployment aliases inherit Deployment Protection,
which on this project is `all_except_custom_domains` — so the old host first 404'd, and then,
once aliased, served a Vercel Authentication wall (`302 → vercel.com/sso-api`). Printed library
posters hit that wall, and Google sign-in died with it because Supabase's Site URL points there.

**The correct fix is `add_project_domain`** (Vercel API) — a project domain is treated as a
custom domain for protection and tracks production automatically. Verified afterwards: both
hosts return 200 publicly, serve the current build, and `/q/<slug>` 302s with `?src=` intact.

Never use `vercel alias set` to restore a public host on this project.

### Sign-in (resolved 2026-10-18)

The new origin is now in Supabase → Authentication → URL Configuration, so the token comes back
to the host the person signed in on. The temporary forward in `js/auth.js` has been **removed**.

Note for anyone re-testing this: **it is not verifiable from outside.** This Supabase version
does not validate `redirect_to` on `/authorize` or `/recover` — a bogus domain passes through
both identically — so only a real sign-in proves the allowlist. If sign-in ever bounces to the
old host again, that is the setting to check first, and reverting the removal commit restores
the forward.

### Maps key restricted

The key is `Maps Platform Demo API Key` in project **`gmp-demo-project-467634042`** — not
`mrc-miracle`, which is why a search of the obvious project found nothing. It now carries
HTTP-referrer restrictions for the three site hosts (it already had API-target restrictions to
seven Maps services).

Correction to the earlier entry in this file: the claim "no referrer restriction" was reached by
curling the Maps JS bootstrap with different `Referer` headers. **That test is invalid** — the
bootstrap is always served and enforcement happens when the API initialises in the browser. The
key did lack referrer restrictions, but `gcloud services api-keys describe` is the authority,
not a curl probe.

### Layout faults fixed

Primary and secondary buttons on the wound page now share the card's centre (all at 756px at a
1512px viewport); previously the primary sat at 261–645 while the secondary was centred at
611–901. The heading gap above "Check a photo" is 25px, matching the card's 24px padding, where
it had been 73px.

**Unverified:** the Google *map* element stays hidden in the ZIP-search flow (results render as
a list), so the referrer restriction could not be positively confirmed against a rendered map.
Clean-air itself works end to end — air quality and the location list both load.


## Google Cloud OAuth — what the domain move does and does not affect

Verified from the live authorize response, not assumed:

- `redirect_uri=https://fsbrpozjfsioxhsqznxw.supabase.co/auth/v1/callback` — Google redirects to
  **Supabase**, never to this site. **Authorized redirect URIs need no change** for a domain move.
- `scope=email profile` — non-sensitive only, so publishing the consent screen does **not**
  require Google verification.
- The site uses no Google JS SDK (`js/auth.js` is a plain redirect), so **Authorized JavaScript
  origins are unused**.

What does need updating, all on the OAuth consent screen (project `mrc-miracle`, client
`183130978535-…`):

1. **Authorized domains** → add `mrcmiraclehealthcorps.org` (registrable domain only — no `www`,
   no `https://`). Google requires this before it will accept links on that domain.
2. **Application home page** → `https://www.mrcmiraclehealthcorps.org`
3. **Privacy policy link** → `https://www.mrcmiraclehealthcorps.org/privacy.html`
4. **Publishing status** — if it is still **Testing**, only explicitly listed test users can sign
   in at all and their sessions expire after 7 days. For a site being handed to librarians and
   volunteers this is the setting most likely to bite. Because the scopes are non-sensitive,
   "Publish app" moves it to Production immediately with no verification review.
