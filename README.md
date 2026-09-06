# MRC Miracle

Mobile-first emergency preparedness tools for King County households.

North Creek High School HOSA, in partnership with the Public Health Reserve Corps of
Seattle & King County, MRC Unit 503.

**Live site:** https://mrcmiracle.github.io *(after you complete `docs/DEPLOY.md`)*

Traffic arrives by QR code from posters in King County Library System branches, so the
site is built to load fast on library wifi and older phones. The landing page is about
20KB compressed; the heaviest page is about 24KB.

---

## What it does

| Feature | Notes |
|---|---|
| **"Right now" mode** | Two buttons at the top of the landing page — "There's smoke today" and "There was just an earthquake". Immediate action steps only. Built into the page HTML, so opening one costs no network request. |
| **Household kit calculator** | Four questions produce a checklist sized to that household, with water calculated at 1 gallon per person per day for 14 days. Printable and shareable. |
| **Save and return** | Generates a short code like `KC-7F3M`. No account, no email. |
| **Clean air finder** | Zip code or city lookup with address, hours, transit, pet policy, and accessibility. Optional map. |
| **Reference content** | Earthquake and wildfire smoke, behavior-focused and collapsible. |
| **One question, at the end** | After the checklist: "Which of these will you do this week?", as a multi-select of the user's own items. Never shown before the tool. |
| **English and Spanish** | Full translation structure. Spanish is **not yet reviewed** — see below. |

## Stack

Plain HTML, CSS, and JavaScript. No framework, no build step, no dependencies to
install. Edit a file, commit, it is live. The only external code is Leaflet, loaded
from a CDN and **only** when someone taps "Show map".

---

## Layout

```
index.html  kit.html  clean-air.html  earthquake.html  smoke.html
css/styles.css
js/
  i18n.js         language switching
  track.js        anonymous event collection   ← put your endpoint here
  app.js          shared boot, analytics loader ← put your GoatCounter code here
  savecode.js     save-code encode/decode
  calculator.js   checklist logic
  cleanair.js     zip lookup, distance sort, lazy map
data/
  clean-air-sites.json   ← the partner unit's list goes here
  kit-rules.json         ← checklist items live here, not in code
  zips.json              86 King County zips (US Census)
i18n/
  en.json   es.json      ← all display text
apps-script/Code.gs      paste into Google Apps Script
docs/
  DEPLOY.md              click-by-click deployment
  UPDATING-SITES.md      editing content without touching code
  PORTFOLIO-METRICS.md   turning site data into HOSA portfolio numbers
```

Nothing in `js/` needs editing to change content. Everything visible lives in `data/`
and `i18n/`.

The header and footer are duplicated across all five HTML pages, which is the cost of
having no build step. If you change one, change all five.

---

## Data collected

Anonymously, into a Google Sheet: calculator inputs, zip codes searched, save-code
returns, end-question selections, and engagement (time on page, scroll depth, which
sections were opened, where people dropped off).

**Never collected:** names, emails, addresses, phone numbers, precise location, IP
addresses. No accounts. No advertising trackers. No cookies — a random id in the
browser's own storage distinguishes repeat visits and contains nothing about the
person.

Some users are minors, which is why the site collects nothing that identifies anyone.

---

## Before this goes on a printed poster

Three things are deliberately unfinished, and each is marked in the code:

1. **The clean air locations are fake.** All eight are labelled `PLACEHOLDER — NOT A
   REAL LOCATION` on screen and a banner says so. Replace them with the verified list
   from Unit 503 and set `"verified": true`. Until then the warnings stay visible on
   purpose.

2. **The Spanish is unreviewed.** `i18n/es.json` has `"reviewed": false`. It was
   drafted, not professionally translated. A fluent speaker must read it before
   launch — mistranslated emergency instructions are worse than no Spanish at all.

3. **The emergency guidance needs partner sign-off.** The earthquake and smoke content
   follows standard public health practice (Drop, Cover, Hold On; clean room, keep
   outside air out). It contains no invented statistics and cites no sources that were
   not checked. But it carries a public health agency's name, so someone at Unit 503
   should read it before it prints.

Also placeholder: the wound care link in `index.html`, and the footer logo slot.

The full pre-launch checklist is at the end of `docs/DEPLOY.md`.

---

## Running it locally

```bash
cd mrc-miracle && python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the HTML files directly with `file://` will
not work, because the browser blocks loading the JSON files that way.

---

## Credits

Zip code and city coordinates are from the US Census Bureau 2023 Gazetteer files
(public domain). Map tiles © OpenStreetMap contributors. Map library: Leaflet (BSD).

This site is a student project. It is educational and is not a substitute for official
emergency instructions.
