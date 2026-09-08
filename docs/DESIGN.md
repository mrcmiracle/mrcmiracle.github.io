# Design direction — MRC Miracle

The aesthetic prompt and the enforceable rules behind it. Read this before changing
anything visual, and paste the prompt in **Aesthetic prompt** into any AI tool you ask
for UI work so it does not hand you back generic output.

---

## First, what this site is

Someone scans a QR code on a poster in a King County library. Sometimes they are
browsing. Sometimes there is smoke outside, or the ground just moved.

Build for capable, modern devices. Do not water anything down for imagined slow
hardware or slow connections - that is not a constraint on this project, and treating
it as one has cost real design decisions.

That reader decides everything below. This is **civic infrastructure**, not a product
landing page. It sits closer to a transit sign, a public health notice, or a field
almanac than to a SaaS dashboard or a shop.

---

## Aesthetic prompt

> Design a bilingual emergency-preparedness interface in the register of **civic almanac**:
> the visual language of public works — transit signage, public health notices, field
> guides — where being read correctly under stress matters more than being admired.
>
> **Typography.** A variable serif with real optical sizing (Fraunces) is reserved for
> display moments only - the single page title, the wordmark, and the large numbers -
> its `opsz` axis tuned per size. Everything else, including every section heading, runs
> in Atkinson Hyperlegible, a face drawn by the Braille Institute to disambiguate
> letterforms for low vision, so a page reads as one voice rather than alternating
> between two. The serif supplies warmth at the top of a page; the sans supplies
> legibility that is not negotiable.
>
> **Colour is meaning, never decoration.** A single institutional violet, taken from the
> unit's own seal, marks the organisation and the primary path. Two hazard channels exist —
> amber means wildfire smoke and nothing else, red means earthquake and nothing else. A
> colour never appears because a section looked plain. If a reader learns amber means smoke
> on one screen, that must hold on every screen.
>
> **Density inverts with urgency.** Emergency content is enormous, terse, and reachable in
> one tap with no network request. Planning content may be dense, quiet and generous. The
> quieter the stakes, the more the layout is allowed to breathe.
>
> **Structure over ornament.** Rules, generous whitespace and typographic weight do the
> work that borders, gradients and drop shadows would do elsewhere. No decorative
> iconography — an emergency page with cute icons reads as unserious. Numbers and words.
>
> **Nothing essential may depend on JavaScript, a web font, a network call, or an
> animation completing.** Motion is a courtesy for people who already have the content,
> never the mechanism that delivers it.

---

## Design rules

These are enforceable. A change that breaks one is wrong even if it looks better.

### 1. Hazard colour is a strict semantic channel

| Token | Means | May be used for |
|---|---|---|
| `--brand` (violet) | the organisation, the primary path | nav, primary buttons, links |
| `--smoke-*` (amber) | wildfire smoke | **only** smoke content |
| `--quake-*` (red) | earthquake | **only** earthquake content |
| `--ok` (green) | done, prepared | ticked items, a completed kit, "you are already prepared" |

Green is a channel like the others, not decoration: it appears when something is
genuinely finished and never to brighten a section up. A ticked item is also struck
through, so colour is never the only signal. Never introduce a fifth accent for visual
interest. Never use amber or red because a
card looked plain. This is the single rule most likely to be broken by an AI tool, and
the one that costs the most when broken.

### 2. Nothing critical behind an animation

`.reveal` starts at `opacity: 0` and only JavaScript adds `.is-in`. Every page therefore
carries:

```html
<noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript>
```

If you add another JS-gated reveal, extend that rule. Content that JavaScript hides and
JavaScript must un-hide is a single point of failure on a site people open in emergencies.
`prefers-reduced-motion: reduce` is already honoured and must stay honoured.

### 3. Fluid type and a fixed spacing scale — already in place, keep using them

Use the existing tokens. Never write a raw pixel margin or a one-off font size.

```
--step--1 … --step-4     type, the top two already clamp()-based and fluid
--s1 … --s8              spacing, a 4px-derived scale
--r-sm --r --r-lg --r-pill   radii
```

If a value you need is not on the scale, the layout is wrong — do not add `margin: 13px`.

### 4. Semantic tokens only

Never write a hex code outside the `:root` blocks in `css/styles.css`. Every colour is
referenced through its semantic name (`--ink-2`, `--paper-3`, `--line`), so dark mode
keeps working. Dark mode is a full token re-map, not an inversion filter.

### 5. Optical sizing is a real tool here

Fraunces is variable. Headings already set `font-variation-settings: 'opsz'` per context
(24 / 30 / 40 / 100). Large display text wants a high `opsz`; small text wants a low one.
Do not collapse these to one value.

### 6. Empty, loading and failure states are designed, not assumed

Air quality and the map already show explicit loading text. Every new async surface needs
three designed states: loading, empty, and failed. "Failed" must never be a blank space —
on this site a blank space reads as "there is nothing near you", which could be false.

### 7. Every tap target is at least 24px

Verified across all eight pages at 375px. The checklist checkboxes, the card
call-to-action links and the live-source links on the clean air page have all
been under this at some point. When a control looks too small, measure it:

```js
[...document.querySelectorAll('a,button,input,select')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 24; })
```

### 8. Dynamic results are announced, not just rendered

Building a checklist or searching for clean air changes the page without a
navigation. Both move focus to the new heading, and the kit calculator also
sets a short `role="status"` line carrying the numbers, because focusing a
heading announces only the heading. Keep that status element **outside** the
results region, or a screen reader reads it twice.

### 9. Location never leaves the browser

"Use my location" sorts the list client-side. The analytics call carries no
coordinates, no zip and no city — only the result count and the nearest
distance. `priv.s2.b` promises this in both languages. If you change what that
call sends, change the policy in the same commit.

### 10. The backdrop is fixed, faint, and cheap

`body::before` is a fixed wash behind everything: `html` carries the base colour,
`body` is transparent. It animates **only `transform`**, so it stays on the
compositor and costs no layout or paint, and it is switched off
entirely under `prefers-reduced-motion` and in print. Its tokens (`--veil-1`,
`--veil-2`) are capped low enough that all text still clears WCAG AA over it -
measured at 4.61 for secondary text and 15.7 for headings. If you strengthen
them, re-measure.

### 11. Rounded, not sharp

Every visible container uses a radius token. Nothing is square-cornered.

### 12. Zero third-party runtime requests

Fonts are self-hosted. Auth is plain `fetch`. The map loads only when tapped. **Do not add
a Google Fonts link, a CDN script, or an icon font.** This is a privacy promise made in
`privacy.html`. It is a privacy commitment, not a performance one.

---

## On the Gemini advice

It was written without seeing the project. Scored against what is actually here:

| Advice | Verdict |
|---|---|
| Fluid typography via `clamp()` | **Already done** — `--step-3`, `--step-4` |
| Strict 4px/8px spacing scale | **Already done** — `--s1`–`--s8` |
| Semantic colour tokens, no scattered hex | **Already done** — full token set + dark map |
| Design empty and loading states | **Partly done** — worth extending, see rule 6 |
| Bento-grid palette `#0F172A` / `#7C3AED` | **Rejected** — you said keep the palette, and the violet is taken from the unit's actual seal |
| Neobrutalist cream / sage / terracotta | **Rejected** — same reason |
| Inter, Plus Jakarta Sans, Playfair, Space Mono | **Rejected** — all need Google Fonts, which rule 12 forbids; and Atkinson Hyperlegible is a *better* choice here because it was drawn for low vision |
| Thick 2px black borders, hard offset shadows | **Rejected** — a shop aesthetic; wrong register for a hazard notice |
| Shift elements on hover to mimic a button press | **Use with care** — fine for planning content, never on the two emergency panels |

So the four "design skills" were largely already implemented, and the two aesthetic
directions were both retail/product aesthetics aimed at a different reader. The prompt
above is the replacement: the same rigour, pointed at this audience.
