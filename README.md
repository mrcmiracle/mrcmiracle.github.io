# MRC Miracle

Mobile-first emergency preparedness tools for King County households.

North Creek High School HOSA, in partnership with the Public Health Reserve Corps of
Seattle & King County, MRC Unit 503.

**Live site:** https://mrcmiracle.github.io

**Contact:** northcreek.mrc@gmail.com · Instagram [@mrc.miracle.nchs](https://www.instagram.com/mrc.miracle.nchs/)

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
| **Clean air finder** | Zip or city lookup across all of Washington: 344 real public libraries with address, county, phone, and directions, plus live links to WA 211 and the state air quality map. Optional map. |
| **Reference content** | Earthquake and wildfire smoke, behavior-focused and collapsible. |
| **One question, at the end** | After the checklist: "Which of these will you do this week?", as a multi-select of the user's own items. Never shown before the tool. |
| **English and Spanish** | 278 strings each, key sets verified identical. |

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
  clean-air-sites.json   344 WA public libraries (IMLS FY2023)
  kit-rules.json         ← checklist items live here, not in code
  zips.json              605 WA zips with centroids (US Census)
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
returns, end-question selections, outbound link clicks, and engagement (time on page,
scroll depth, which sections were opened, where people dropped off).

**Never collected:** names, emails, addresses, phone numbers, precise location, IP
addresses. No accounts. No advertising trackers. No cookies — a random id in the
browser's own storage distinguishes repeat visits and contains nothing about the
person.

Some users are minors, which is why the site collects nothing that identifies anyone.

---

## Where the location data comes from

`data/clean-air-sites.json` holds **344 real public library outlets in Washington
State**, taken from the federal **IMLS Public Libraries Survey FY2023** outlet file
(public domain). Real names, street addresses, phone numbers, counties, and geocoded
coordinates. Bookmobiles are excluded. All 39 counties are represented; 76 are in King
County.

`data/zips.json` holds **605 Washington ZCTAs** with centroids from the **US Census
2023 Gazetteer**, filtered using the Census ZCTA-to-county relationship file.

### An important honesty point about "clean air locations"

Washington does **not** publish a fixed, permanent list of clean air locations.
Cleaner air sites are *activated during smoke events* by county and local health
jurisdictions, and the list changes every event. Public Health — Seattle & King County
says it will "consider activation and opening of cleaner air sites" based on AQI
thresholds, and points people to libraries, shopping centres, and other locations.

So the finder does two things instead of pretending a fixed list exists:

1. It shows **real public libraries** — free indoor public spaces that exist year-round
   and are the buildings most commonly used during smoke events.
2. It puts the **live sources at the top of the page**: WA 211 (dial 2-1-1, text your
   zip to 898211, Spanish line 844-975-1882), King County wildfire smoke information,
   and the state air quality map.

Two fields are intentionally blank because the federal dataset does not contain them:
`hours` and `transit`. Rather than invent them, each card shows the branch phone number
and "Hours vary by location. Call before you go." Fill them in as you verify sites.

`pets` is set to `service_only` for every library. That is a legal baseline — the ADA
requires public buildings to admit service animals, and public libraries generally do
not admit other pets. Confirm per branch.

## Running it locally

```bash
cd mrc-miracle && python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the HTML files directly with `file://` will
not work, because the browser blocks loading the JSON files that way.

---

## Credits

Zip code centroids: US Census Bureau 2023 Gazetteer and 2020 ZCTA-to-county
relationship files (public domain). Library locations: IMLS Public Libraries Survey
FY2023 outlet file (public domain). Map tiles © OpenStreetMap contributors. Map
library: Leaflet (BSD).

This site is a student project. It is educational and is not a substitute for official
emergency instructions.
