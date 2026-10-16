# Presentation 16:9, Slides from text, PowerPoint — and Interface color

Release 1 · v4.4 · branch `feature/r1-ui-precision`. Deterministic only: no AI service, no network
calls, no API keys, nothing paid. Not deployed to production.

## Turn it on (feature flag, off by default)

| Where | How |
|---|---|
| One visit | add `?ff=presentation` to the URL (e.g. the Netlify preview link) |
| This browser | DevTools console: `localStorage.setItem('askruth.backdrop-studio.flags', 'presentation')`, then reload |
| Switch off | `?ff=none`, or `localStorage.removeItem('askruth.backdrop-studio.flags')` |

`FLAGS.aiStoryboard` exists and is hard-wired `false`: there is no AI implementation and no AI UI.

With the flag off the app behaves exactly as before: 16:9 is "Landscape", no new button, no
PowerPoint option. The **Interface color** slider (Appearance) is not behind the flag.

## What it does

**Presentation is a layout format, PowerPoint is an export format.**

- *Presentation 16:9* is the Carousel at 16:9 (1920 × 1080) — the same workspace, slides, editor,
  brand controls, Undo/Redo and saving. In the Size list a Carousel's 16:9 reads "Presentation";
  a Reel's 16:9 is still "Landscape". Stored as `contentType: 'carousel'` + `format: '16x9'`;
  `describe()` (v4/model.js) reports `layout: 'presentation'` and its `exports`.
- *PowerPoint (.pptx)* appears in Export → File type only for a Presentation. PNG, JPG and PDF
  stay available. Switching Carousel ⇄ Presentation keeps every word (the existing per-size
  layouts and **Adapt layout** split or merge slides — previewed, one Undo — never silently).

**Slides from text** — one action, under Tidy up / Adapt layout (carousels only):

1. Paste your text. Headings (`#`), lines of `---`, lists (`-`, `1.`) and `Button: …` shape it;
   JSON `{ "slides": [{ "heading", "body", "bullets", "button", "image" }] }` works too.
2. Preview: the slides, drawn by the app, and how many. Advanced (folded): most slides.
3. Apply — **Add after the slides there**, **Replace the ones made from text before** (edited
   ones stay), or **Replace all**. Always one Undo step. Cancel changes nothing.

The text is kept with the project (`state.deck.input`), so it can be laid out again later.
Words are never written, shortened or reordered; a topic alone ("Q3 review") is refused with a
request for the actual text.

## How the layout is resolved

- `js/v4/storyboard.js` (pure, Node + browser) — the deterministic storyboard: slides, headings,
  paragraphs, lists, CTA. `StoryboardProvider` is the interface a later AI provider implements;
  `deterministicProvider` is the only one.
- `app.js` `planDeck` — each storyboard item goes onto the **brand's own template slide**
  (hook / value / cta from `brands.js` recipes), placed by the app's column layout
  (`arrangeColumn` + `fitLayout`) for the canvas size and its safe area. No coordinates are typed in.
- Fit order: wrap in the region → a template with more room → continuation slides (at a
  paragraph, then a sentence; the heading repeats) → smaller type down to the minimum → a clear,
  structured failure that changes nothing.
- Checks on every slide (`deckCheck`): inside the safe area, no foreground overlaps, logo clear
  space, every line fits its column (long links / compound words), minimum type size, at most
  N body lines (a readability preference), and every word of the source on the slides in order.

Layout settings that are **not** brand values live in one place, `DECK` in app.js:

| Setting | Value | Status |
|---|---|---|
| start scale per kind | title 1.25 / point 1.1 / list 1.05 / cta 1.15 (header) | inferred default |
| Presentation boost | × 1.35 at 16:9 | inferred default |
| minimum type | header 4.2 %, body 2.6 % of the short side (45 / 28 px at 1080) | inferred default |
| body lines per slide | 9 at 16:9, 12 otherwise | inferred default |
| logo clear space | 2 % of the short side | inferred default |
| most slides | 30 | inferred default |
| colours, fonts, weights, radii, buttons, logos, backgrounds | from `brands.js` / the brand template | verified brand values |

## PowerPoint fidelity

Editable: headers, body text, extra text boxes, bold CTA lettering (text boxes in the brand
font, size, colour, line spacing), text cards and borders (rounded rectangles), standard buttons
(shape + label). Pictures, placed exactly: the background (with its Dim), logos and badges,
media, drawings, Luxury buttons.

Limits, stated plainly:

- Fonts are **named, not embedded** ("Bitter SemiBold", "Poppins SemiBold", "Roboto Black"). With
  the free Google Fonts installed the slides match the canvas; without them PowerPoint substitutes.
- Lines break where the canvas breaks them and wrapping is off, so a substitute font can't re-flow
  text into the next box. A longer edit in PowerPoint needs its own line break (Shift+Enter).
- PptxGenJS 4.0.1 writes an extra `<a:pPr>` after soft line breaks; `writePptx` removes it so the
  file follows the schema. Checked with python-pptx and LibreOffice; **not yet opened in
  Microsoft PowerPoint or Keynote** — please check one file there.
- A picture link in the text (`![](https://…)`) is never fetched; the note says to add it by hand.

## Command-line renderer (`tools/deck`, not served by Netlify)

```
cd tools/deck && npm install          # playwright-core 1.56.0 (Apache-2.0)
npx playwright-core install chromium  # or pass --chromium /path/to/chrome
node mbk-deck.mjs validate   samples/ask-ruth.md
node mbk-deck.mjs storyboard samples/ask-ruth.md -o storyboard.json
node mbk-deck.mjs layout     samples/ask-ruth.md -o layout.json --brand t4r
node mbk-deck.mjs render     samples/ask-ruth.md -o out/ --scale 2
node mbk-deck.mjs pptx       samples/ask-ruth.md -o deck.pptx
node mbk-deck.mjs all        samples/ask-ruth.md -o out/ --fonts-dir <@fontsource dir>
```

It serves this repo on 127.0.0.1 and runs the real app headless, so the PNGs and the .pptx come
from the same engine as the browser. Exit codes: 0 ok, 1 usage, 2 invalid input, 3 doesn't fit,
4 render failed, 5 timeout. One job per process; the output folder must be empty (or `--force`,
which replaces only this tool's own files). Input is capped at 20,000 characters; logs show counts,
never the text. The brand fonts come from Google Fonts unless `--fonts-dir` serves them offline.
Running it costs compute where it runs; it is not a hosted service and Netlify can't run it.

## Interface color (Appearance)

Header → ◐ → Interface color, Neutral ↔ Full brand color (default Full). Editor chrome only:
derived in OKLCH from the brand's original tokens (lightness kept, chroma scaled), recomputed from
the originals on every change, contrast re-checked per text/background pair. At Full there are no
overrides. Never changed: the canvas, thumbnails, swatches, exports, focus rings, errors, the
light/dark preview ground, and the selection ✕ / active-section outline (`--ov-*` tokens). Grid,
safe-area and selection lines are drawn on the canvas with fixed dual strokes and are unaffected.
Stored per browser (`askruth.backdrop-studio.ui-colour`), never in the project or Undo.

## Files

`js/v4/storyboard.js`, `js/v4/pptx.js`, `js/v4/appearance.js`, `js/vendor/pptxgen-4.0.1.bundle.js`
(+ licence), `tools/deck/*`; changes in `js/app.js` (v4.4 section, flags, export sheet, size
names), `js/render.js` (`buttonPaint`, `ctaInk`, `baseTypeSizes` — drawing unchanged),
`js/v4/model.js`, `index.html` (PowerPoint option), `styles.css`, `netlify.toml` (`/tools` → 404).
Tests: s234–s238 (and s235 Home cards).

## Rollback

Flag off is the switch for Presentation / Slides from text / PowerPoint (nothing else changes).
Code: revert the v4.4 commits on the branch. Data: projects keep two optional keys — `deck`
(project) and `gen` (slide). Older builds ignore both; removing them needs no migration.
