# Updating content without touching code

Everything a non-programmer needs to change lives in two folders: `data/` and `i18n/`.
You never need to open anything in `js/`.

These are **JSON** files. JSON is picky about punctuation:

- Every piece of text goes in `"double quotes"`.
- Items are separated by commas — but the **last** item in a list gets **no** comma.
- If you break it, the page shows an error instead of loading. Paste the file into
  <https://jsonlint.com> to find the exact line before you commit.

---

## Adding real clean air locations

Open `data/clean-air-sites.json`.

At the top, once the real list is in:

```json
"version": "2027-01-15",
"verified": true,
"source": "Supplied by MRC Unit 503, verified 15 Jan 2027",
```

Setting `verified` to `true` hides the yellow "Demonstration data" banner. **Leave it
`false` until the list is genuinely verified** — that banner is what stops someone
driving to a location that does not exist.

Each location looks like this. Delete all eight `ph-` placeholder entries once you have
real ones.

```json
{
  "id": "kcls-burien",
  "name": "Burien Library",
  "city": "Burien",
  "address": "400 SW 152nd St, Burien, WA 98166",
  "lat": 47.470,
  "lon": -122.339,
  "hours": "Mon-Thu 10am-8pm, Fri-Sat 10am-6pm, Sun 1pm-5pm",
  "hours_es": "",
  "transit": "RapidRide F Line, Route 121",
  "transit_es": "",
  "pets": "service_only",
  "access": ["wheelchair", "accessible_restroom", "elevator"],
  "access_notes": "Ramp entrance on the north side",
  "access_notes_es": "",
  "phone": "206-555-0100",
  "updated": "2027-01-15"
}
```

### Field rules

| Field | What to put |
|---|---|
| `id` | Any short unique label. Lowercase, no spaces. Used in your analytics data. |
| `name` | Shown as the heading. |
| `city` | Must be spelled identically across entries — the city dropdown is built from this field, so "Federal Way" and "federal way" would appear as two cities. |
| `address` | Shown as written. Include the zip. |
| `lat` / `lon` | **Required.** Distance sorting and the map both depend on these. See below. |
| `hours` | Free text. Whatever the site actually posts. |
| `pets` | Exactly one of: `yes`, `no`, `service_only`, `unknown`. Anything else shows as "unknown". |
| `access` | Any of: `wheelchair`, `accessible_restroom`, `elevator`, `seating`, `quiet_room`. Use `[]` for none. |
| `phone` | Leave as `""` if there isn't one. |
| `updated` | The date you last confirmed this entry is correct. |
| `placeholder` | Omit it. Only the fake seed entries have it. |

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
