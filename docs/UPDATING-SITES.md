# Updating content without touching code

Everything a non-programmer needs to change lives in two folders: `data/` and `i18n/`.
You never need to open anything in `js/`.

These are **JSON** files. JSON is picky about punctuation:

- Every piece of text goes in `"double quotes"`.
- Items are separated by commas — but the **last** item in a list gets **no** comma.
- If you break it, the page shows an error instead of loading. Paste the file into
  <https://jsonlint.com> to find the exact line before you commit.

---

## The clean air locations list

Open `data/clean-air-sites.json`.

It already holds **344 real Washington public libraries across all 39 counties** — 76 of
them in King County. They come from the federal **IMLS Public Libraries Survey FY2023**
outlet file, which is public domain. The names, addresses, ZIPs, phone numbers, and
coordinates are the real published values. Bookmobiles were removed. Burien Library was
spot-checked by hand against the KCLS website.

**There is nothing fake in this file to delete.** An earlier draft of this project had
eight `ph-` placeholder entries and a yellow "Demonstration data" banner. Both are gone —
that banner no longer exists anywhere in the code.

### Why libraries, and not an official clean-air-site list

Washington does not publish a fixed list of cleaner air sites. Local health jurisdictions
activate them per smoke event, and Public Health — Seattle & King County points people to
libraries and shopping centres when it does. So `clean-air.html` leads with the **live**
sources (WA 211, the King County smoke page, the state AQI map) and lists these libraries
underneath as year-round public indoor spaces. That is a deliberate design decision, not a
dataset someone forgot to finish.

### The header block

Above `sites` there is a block like this:

```json
"version": "2026-09-06",
"verified": true,
"source": "US Institute of Museum and Library Services, Public Libraries Survey FY2023, outlet file (pls_fy23_outlet_pud23i.csv). Retrieved 2026-09-06 from imls.gov. Bookmobiles excluded.",
"source_url": "https://www.imls.gov/research-evaluation/surveys/public-libraries-survey-pls",
```

This is a **written record for the next person, not a switch.** No code reads any of it,
and `verified` no longer turns a banner on or off. Update `version` and `source` whenever
you change the list, so whoever inherits this project knows where the data came from and
when it was last touched.

### What one entry looks like

```json
{
  "id": "WA0061-013",
  "name": "Othello Branch Library",
  "kind": "library",
  "city": "Othello",
  "county": "Adams",
  "address": "101 E. Main Street, Othello, WA 99344",
  "zip": "99344",
  "lat": 46.82619,
  "lon": -119.17376,
  "phone": "(509) 488-9683",
  "hours": "",
  "hours_es": "",
  "transit": "",
  "transit_es": "",
  "pets": "service_only",
  "access": [],
  "access_notes": "",
  "access_notes_es": ""
}
```

### Field rules

| Field | What to put |
|---|---|
| `id` | Must be unique. The imported entries use their real IMLS outlet id (`WA0061-013`). Anything you add yourself can use any short unique lowercase label. This shows up in your analytics data. |
| `name` | Shown as the heading on the card. |
| `kind` | What sort of place it is. **Every entry is `"library"`, and `library` is the only value the site has wording for.** Any other value prints a raw `air.kind.…` label on the page. To add, say, a community centre, first add an `"air.kind.communitycenter"` line to **both** `i18n/en.json` and `i18n/es.json`. |
| `city` | Must be spelled identically across entries — the city dropdown is built from this field, so "Federal Way" and "federal way" would show up as two separate cities. |
| `county` | County name with no "County" on the end: `"King"`, not `"King County"`. Shown as a row on the card. |
| `address` | Shown exactly as written. Include the ZIP. |
| `zip` | Reference only. When a visitor types a ZIP, it is matched against `data/zips.json` — **not** against this field — so a wrong value here changes nothing on screen. Keep it correct anyway; the next person will assume it is. |
| `lat` / `lon` | **Required.** Distance sorting and the map both depend on these. See below. |
| `phone` | Leave as `""` if there isn't one. |
| `hours` | **Deliberately blank on every entry.** The IMLS dataset does not contain opening hours and they were not invented. While it is empty the card shows "Hours vary by location. Call before you go." Fill one in only once you have actually checked it. |
| `transit` | Blank for the same reason. Fill in as verified. |
| `pets` | Exactly one of `yes`, `no`, `service_only`, `unknown`. Anything else displays as "unknown". Every entry is currently `service_only` as a legal baseline — the ADA requires public buildings to admit service animals — which is recorded in `pets_note` at the top of the file. Confirm branch by branch and correct as you learn. |
| `access` | Any of `wheelchair`, `accessible_restroom`, `elevator`, `seating`, `quiet_room`. Currently `[]` everywhere, because the source dataset carries no accessibility detail. |

There is no `updated` field and no `placeholder` field in this dataset. If you see either
mentioned somewhere, that instruction is out of date.

### Getting latitude and longitude

1. Open <https://www.openstreetmap.org>.
2. Search the address.
3. Right-click the exact spot → **Show address**. The numbers appear in the sidebar.

Latitude is about `47.x` for King County; longitude is about `-122.x` and **must keep
its minus sign**. A dropped minus sign puts the location in China.

### The Spanish fields

`hours_es`, `transit_es`, and `access_notes_es` are optional. Leave them as `""` and the
English text is shown instead. Fill them in when you have translations.

---

## Changing the kit checklist

Two files, both must be edited together.

**1. `data/kit-rules.json`** — the rule:

```json
{ "id": "whistle", "cat": "comfort", "when": ["always"], "qty": "perPerson", "n": 1 }
```

- `cat` must be one from the `categories` list at the top of the file.
- `when` decides who sees it. Use `["always"]`, `["pets"]`, `["meds"]`,
  `["apartment"]`, or `["house"]`. Listing two means **both** must be true.
- `qty` options:
  - `"none"` — no number shown
  - `"fixed"` with `"n": 2` — always shows 2
  - `"perPerson"` with `"n": 3` — multiplied by household size
  - add `"unit": "days"` to say "6 days" instead of "6 each"
  - `"water"`, `"petwater"`, `"meddays"` — the calculated ones, don't reuse these
- Add `"review": true` to show the orange "Check this item with a professional" badge.

**2. `i18n/en.json` and `i18n/es.json`** — the words. For an item with id `whistle`,
add to **both** files:

```json
"item.whistle.name": "Emergency whistle",
"item.whistle.note": "Carries much further than shouting, and does not wear your voice out.",
```

If you add the rule but forget the text, the checklist shows `item.whistle.name`
instead of a name. That is the symptom to look for.

### Changing the water calculation

Top of `data/kit-rules.json`:

```json
"water": { "gallons_per_person_per_day": 1, "days": 14, "pet_gallons_per_day": 1 },
"medication_buffer_days": 14
```

Change `days` to 3 and everything recalculates — the total, the shown arithmetic, and
the two-week wording in the item notes will need updating in the `i18n` files too.

---

## Translations

`i18n/en.json` is the master. `i18n/es.json` must contain **exactly the same keys**.

To check they match after editing, run this in Terminal:

```bash
cd ~/Downloads/mrc-miracle && python3 -c "import json;a=set(json.load(open('i18n/en.json')));b=set(json.load(open('i18n/es.json')));print('only in en:',sorted(a-b));print('only in es:',sorted(b-a))"
```

Both lists should be empty.

When a fluent speaker has reviewed the Spanish, change the top of `es.json`:

```json
"reviewed": true
```

and delete the `_WARNING` line.

### Adding a third language (Chinese)

1. Copy `i18n/en.json` to `i18n/zh.json` and translate the values.
2. In `js/i18n.js`, change `var SUPPORTED = ['en', 'es'];` to
   `['en', 'es', 'zh']`.
3. In each of the five `.html` files, add a button next to the EN/ES pair:
   ```html
   <button type="button" data-lang="zh" aria-pressed="false">中文</button>
   ```

---

## After any edit

1. Commit the change on GitHub.
2. Wait about a minute.
3. Load the live site and confirm your change is there.

If the page breaks, the cause is almost always a JSON punctuation error. Check
<https://jsonlint.com>, or revert the commit from the repository's **Commits** list.

---

## Activating a cleaner air site during a smoke event

The 344 libraries in `data/clean-air-sites.json` are the year-round baseline and
never change during an event. When Public Health opens actual cleaner air sites,
those go in the **`sites` table in Supabase**, and appear on `clean-air.html`
above the libraries with an amber **"Open now for smoke"** badge.

Until the admin page is built, you do this from Supabase directly.

### To add and switch on a site

1. Go to <https://supabase.com/dashboard> → the project → **Table Editor** → **sites**.
2. **Insert → Insert row.** The only fields you must fill in are:

   | Field | What to put |
   |---|---|
   | `id` | Any short unique label, e.g. `kent-commons-2026-09` |
   | `name` | Shown as the heading |
   | `city` | Spelled exactly as in other entries — the city dropdown is built from it |
   | `lat` / `lon` | **Required.** Distance sorting and the map depend on them. Get them from <https://www.openstreetmap.org> — right-click the spot → Show address. Longitude keeps its minus sign; dropping it puts the site in China |
   | `active` | Tick it |

   Everything else has a sensible default. `hours` is worth filling in during an
   event — that is exactly the thing people need and the libraries cannot give.
   `note` is internal, for your team; it is never sent to the page.

3. Save. It is live within about a minute.

`activated_at` stamps itself. Do not set it by hand.

### To withdraw a site

Set `active` to false. Do **not** delete the row — keeping it means you can
switch the same place on again next time without retyping it, and it preserves
the record of what you opened and when, which is exactly the evidence a
portfolio needs.

A withdrawal reaches visitors in about a minute.

### If a library itself is activated

Give the row the **same `id` as the library** in `clean-air-sites.json` (for
example `WA0061-013`). The activated row then replaces that library in the list
rather than appearing twice, and it carries the badge and your event hours.

### If the database is unreachable

The page silently falls back to the 344 libraries on their own. Nothing breaks,
and no error is shown, because a library is still a real public indoor space.
