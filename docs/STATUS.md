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
