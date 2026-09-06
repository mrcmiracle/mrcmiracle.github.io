# Turning site data into portfolio numbers

Written against the 2026–2027 MRC Partnership guidelines. Rubric references are to
the page numbers in that PDF.

## What the rubric actually asks for

| Where | What it wants | Where your number comes from |
|---|---|---|
| p2 | "# of hours contributed to the activity and # of people impacted" | Hours: **your own log, not this site.** People: unique visitors (below). |
| p6 | "Total hours volunteered with the MRC" | Your own log. The site cannot know this. |
| p9 item 6 | Quality, scope, and value of activities | Narrative, supported by the numbers below. |
| p10 item 3 (10 pts) | "Strong evidence (4+ examples)" of community impact | Each subsection below is one example. |
| p10 item 4 (10 pts) | Impact on the HOSA chapter | Your own reflection. Not from the site. |

Two things this site **cannot** measure, so track them yourself from day one:
volunteer hours, and impact on your chapter. Both are worth real points.

---

## The headline number: people impacted

Two independent sources. Use them together — if they roughly agree, the number is
trustworthy.

1. **GoatCounter → unique visitors** for your date range. This is your cleanest
   defensible figure.
2. **The spreadsheet**, counting distinct visitor ids:

   ```
   =COUNTA(UNIQUE(FILTER(F2:F, F2:F<>"")))
   ```
   (column F is `visitor`)

**Say what it actually means.** "Unique visitors" counts browsers, not humans. One
person on a phone and a laptop counts twice; a shared library computer counts several
people as one. Write it as *"approximately N unique visitors"* and you are being
accurate. Judges notice the difference between a student who understands their data
and one who read a number off a dashboard.

---

## Example 1 — Households that made a concrete plan

Not a traffic number. Someone answered four questions and received a checklist.

```
=COUNTIF(C2:C, "kit_complete")
```

People covered by those plans — the sum of household sizes:

```
=SUMIF(C2:C, "kit_complete", L2:L)
```
(column L is `people`)

This is a stronger sentence than visitor counts: *"142 households built a preparedness
plan covering 389 people."*

Household mix, useful for a chart:

```
=QUERY(A:AI, "select O, count(O) where C='kit_complete' group by O", 1)
```
(column O is `housing` — apartment vs house)

---

## Example 2 — Behavior change, your strongest evidence

The end question asks which items people will actually do this week. This is an
*outcome* measure, and the rubric weights impact far more heavily than reach.

Commitment rate:

```
=COUNTIF(C2:C,"plan_selected") / (COUNTIF(C2:C,"plan_selected")+COUNTIF(C2:C,"plan_skipped"))
```

Average number of actions committed to:

```
=AVERAGEIF(C2:C, "plan_selected", AB2:AB)
```
(column AB is `selection_count`)

Which actions won: the `selections` column holds ids separated by `|`. Split them into
their own tab with **Data → Split text to columns** using `|`, then count. The most
chosen item is a genuinely interesting finding, and if it surprises you, say so in the
presentation — that reads as real research.

---

## Example 3 — Reach across King County

Every zip searched in the clean air finder:

```
=QUERY(A:AI, "select S, count(S) where C='cleanair_lookup' group by S order by count(S) desc", 1)
```
(column S is `zip`)

Paste that into a map tool for a King County coverage figure. It also tells your MRC
partner something operationally useful: *which* communities are looking for clean air.
That is a finding you can hand back to Unit 503, which is exactly the kind of two-way
partnership p10 item 1 is scoring.

---

## Example 4 — Emergency-moment use

```
=COUNTIF(C2:C, "rightnow_open")
```

Split by type using the `mode` column (`smoke` or `quake`). Then plot those dates
against actual King County smoke days or a real earthquake. If usage spikes on bad air
days, you have direct evidence the tool was used when it mattered — the single most
compelling chart available to you.

---

## Example 5 — Depth of engagement

The `page_exit` event carries `seconds` and `scroll_pct`.

Median time on the checklist page:

```
=MEDIAN(FILTER(AF2:AF, C2:C="page_exit", D2:D="kit.html"))
```
(AF is `seconds`, D is `page`)

Which reference sections people opened:

```
=QUERY(A:AI, "select AD, count(AD) where C='section_open' group by AD order by count(AD) desc", 1)
```

Funnel drop-off, which is worth stating even when unflattering:

```
started calculator  → COUNTIF(C2:C,"page_view") where page = kit.html
finished            → COUNTIF(C2:C,"kit_complete")
saved a code        → COUNTIF(C2:C,"code_generated")
answered the question → COUNTIF(C2:C,"plan_selected")
```

Reporting an honest drop-off and what you would change reads far better than a
suspiciously perfect funnel.

---

## Example 6 — Return visits

```
=COUNTIF(C2:C, "code_restore")
```

Someone typing their save code back in weeks later is a deliberate act, not a stray
click. Also compare `returning=1` against `returning=0` on `page_view` rows.

---

## Bilingual reach

```
=QUERY(A:AI, "select E, count(E) where C='page_view' group by E", 1)
```
(column E is `lang`)

Spanish-language usage is direct evidence for the p2 impact category **"serve a
vulnerable population"** — but only claim it if the Spanish is properly reviewed. An
unreviewed machine translation on a public health site is a liability, not an
accomplishment.

---

## Rules for reporting these honestly

1. **Never report a number you cannot reproduce.** Write the formula next to it in
   your working notes.
2. **State your date range.** "1,204 visitors" means nothing without "between
   September 2026 and April 2027."
3. **Do not add GoatCounter visitors to spreadsheet rows.** They count different
   things and the total would be meaningless.
4. **Say "approximately"** for anything derived from browser counting.
5. **Do not present a projection as a result.** If you got 300 visitors, the number is
   300 — not "1,000 with more posters."
6. **A small honest number beats an inflated one.** p5 says explicitly: *"quality over
   quantity."* A judge who catches one shaky number distrusts every other number you
   present.
