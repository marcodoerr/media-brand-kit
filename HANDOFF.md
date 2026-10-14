# Media Brand Kit (formerly Backdrop Studio): version handoff

**Version:** v4.0, 2026-10-13 (on top of v3.25; see §49). Earlier: §48, §47, §46, §45, §44, §43, §42, §41, §40, §39, §38, §37, §36, §35, §34; v3.1 changes: §21; the spec audit: §22.
**Files:** GitHub `marcodoerr/media-brand-kit` (branch `feature/v4-navigation-adapt-export`, PR #1; `main` = v3.25 as live). Static site, deploys to Netlify as-is. Rollback: `ROLLBACK.md`. Backend design: `BACKEND.md`.
**Figma:** file `0amKYViLpkdmw2ZL93G7FN`, section *"Backdrop Studio v2 — from code (desktop + mobile)"*
**Brands:** Ask Ruth.AI · MoshPit · T4R Labs
**Owner:** Marco Doerr

This file is the single summary of this version: what the app does, how it is built, the rules that keep it safe to change, its limits, the Figma file, and what is still open. `README.md` in the same folder has the long-form detail for each feature. This file links to it rather than repeating it.

---

## 1. What it is

A browser-only studio for making branded social posts, as **videos or image carousels**, for three brands. You pick a format and build a sequence of **sections** (Hook → Value… → CTA), each with its own background, text, buttons, media and badge. You then export an MP4/WebM video, PNG/JPG slides, or single items as transparent PNGs.

- **No server, no accounts.** Everything runs in the browser. Uploads, recordings and sounds stay in that browser (IndexedDB), and nothing is sent anywhere.
- **What you see is what you export.** The preview and every export come from the same `render()` call.
- **Desktop and phone.** On desktop the right panel runs the full height of the window, and the preview and the timeline share the column to its left. On a phone the full-screen creator *is* the editor: top bar, full-screen bar, the canvas (any format, scaled to fit) and the timeline. Everything else opens from the canvas in a bottom sheet.

---

## 2. Feature map (this version)

### Format and project
- **Format** sits in the top bar and opens the dropdown directly; it reads [icon] Reel 9:16 (v3.1). *Video* and *Carousel* each: Reel 9:16, Tall 3:4 (new), Portrait 4:5, Square 1:1, Landscape 16:9.
- **Brand dropdown.** Each brand keeps its own design, and only the format carries over when you switch.
- **Start screen** on opening: **Recent** (open design first, artwork tiles, open directly), **Saved** (smaller), **Create new** (brand × Video / Carousel → editor). Show all in a modal or phone sheet; first visit shows Create only. The brand mark brings it back (README → *Start screen*).
- **A layout per format, fitted automatically:** a format you haven't edited follows the latest one you did (same relative spots, fitted into the safe area, overlaps re-spaced); a format you edit keeps its own layout, per section (README → *A layout per format*).
- **Pattern spacing** for uploads used as a pattern (horizontal / vertical); the gallery tile shows the pattern.
- **Multi select** (right-click / long-press) with **Tidy up selection**, Align centre, Space evenly and Remove, each with Undo; the phone bar wraps to two rows.
- **Text fields grow** with their text in the panel (header, body, text boxes), up to ~40 % of the screen, then scroll.
- **Templates place the badge by what it is:** a logo alone leads, larger, at the top (the Hook); a *Powered by* badge sits between the text and the button (the CTA).
- **Text badge** (every brand): upper badge, middle and lower badge are all editable text. The middle has its own colours, the plate hugs its words up to the safe area, and it works for extra badges too (README → *Text badge*).
- **Guides and Grid are view settings** (v3.0): phone → burger menu; desktop → the view button (⤢) in the preview, next to Full screen. One place per platform, never in the edit panel.
- **Grid**: centre lines, thirds, and a column grid inside the safe area (4 / 6 / 6 / 12 columns). Dragging snaps to it while it's on; the line you snap to lights up. Editor only.
- **Show on was removed in v3.0** (Marco found it confusing). Every item belongs to one section; old linked copies are unlinked on load and keep their place.
- **Reorder sections.** Drag clips on the timeline (touch: hold, then drag), or **Move earlier / later** in the clip menu. Backgrounds stay with their section; Undo.
- **Restore on load.** The last design reopens. A first launch opens on the **brand template**.
- **Burger menu** (v3.0, ☰ at the left of the top bar): Save design, Start new, Recent and Saved projects (open with a tap), All projects, and on phones the Guides / Grid switches.
- **Start new** (burger menu · the restore note) opens a sheet of starting designs made from the brand's own pieces: the brand template, four curated proposals, **Shuffle** for more, and **Blank** (v3.0: the brand's plain colour, nothing on: Ask Ruth plum, MoshPit charcoal, T4R navy). Each card shows Hook, Value and CTA; picking one keeps the old design as *Last session* and offers Undo.
- **Undo.** Removals show a toast with Undo, and ⌘Z / Ctrl+Z also undoes.
- **Saved designs** (templates): up to 40, kept in this browser.

### Sections (Hook / Value / CTA)
- The timeline shows the sections on a time ruler. Each section runs **1–30 s**, with recommended times based on reading length.
- **Category colours** (editor only): Hook `#ffb547`, Value `#5cc8ff`, CTA `#a78bfa`.
- **Each section is fully its own.** Background, text style and colours, cards, borders, buttons, media, badge (on/off, choice, scale, "Powered by"), visibility, text mode, scales, positions and background framing.
- Sections can be added from the timeline, the clip menu and **full screen (+ Section)**, and removed from the clip menu.
- **Clear section** (clip menu and full-screen tap menu) empties a section's text, text boxes, buttons, media and badge. The background, sound and duration stay, and Undo works.

### Edit panel (v3.0: **+ Add** and a contextual panel)
- **+ Add** (panel top on desktop, *Add* in the full-screen bar): Background, Text, Button, Media, Badge, Section. **+ adds; tapping in the preview edits.** Nothing selected → a minimal panel (hint + Tidy up); something selected → only its controls, with **Done** to go back.
- Tapping empty canvas opens **Background**. Overlapping items: tap the same spot again to select the one underneath. Items smaller than 44 px get a 12 px tap margin.
- Unselected cards, thumbnails, segments and timeline clips are toned down; the selected one stays full strength.
- **Opening an element whose item is off switches it on whose item is off switches it on:** Text comes on (with the brand's copy if empty), Buttons adds a first button, Media shows hidden media, Badge comes on. Closing never switches anything off.
- **Background.** Patterns, artwork, colours (+ your own colours, collapsed behind "+N"), uploads, and recording with the camera. Also **Tone down** (v3.0: always shown at the top of Background for every kind of background, 0 = Off), pattern scale, and framing (Scale, Left·Right, Up·Down, surface colour).
  - **Uploaded picture as a pattern:** *Full picture / Pattern* choice, **Tile size** 5–100 %, **Mirror tiles** (seamless), and drag on the preview to shift.
- **Text.** Header + body. **Style: Light / Dark / Custom** (v3.11: named for the look — Light = dark type, Dark = light type on the panel). Header and Body are **one text box**: one background and one border round both, set from either part's popup; text colour and size per part. Switching text on fills an empty header or body with placeholder copy (every section, the Hook included). Extra **text boxes**, each with its own style and scale.
  - **Reset to default**, for the main text and on each text box: the brand's style, no own colours or border, 100 % sizes. The words and position stay, and Undo works.
- **Buttons.** Buttons are their own elements, made only here, and any section can have them. Each has text, colours, stroke, corners and scale, plus **Reset to default** (with Undo).
- **Media.** Several photos or videos per section, each placed and sized on its own.
- **Tidy up.** One tap arranges the section (this format): centred column, even gaps, small items side by side when they fit; Undo.
- **Badge.** On/off, and three parts, each with its own switch:
  - **Upper badge**: the pill with editable text ("Powered by" by default = the artwork; your own words are set in a pill matched to the artwork's colours, size and padding).
  - **Badge image**, with the choice of badge and **Scale from 25 % up to "fills the frame"** (the limit depends on the badge and the format).
  - **Lower badge:** a text box with text, text colour, background (or none), optional stroke (colour, 1–12 px), scale and Reset to default.
  - Hidden parts keep their settings; the visible ones close up.
  - Tapping a part on the preview opens its controls; the upper and lower badge's text get the cursor.
  - **More badges:** *Add a badge* places extra badges on the section, each with its own badge, scale, upper switch and text, **lower badge** (text, colours, stroke, scale, reset), PNG and remove; drag to place. Phone: *Badge* in the add menu adds another.
- **↓ PNG button** in the head of Background, Text, Media and Badge, and on every text box, button and media card. It saves that item alone as a transparent PNG at 2×.

### Canvas editing
- Drag to move. Tap to edit (the panel opens right away). Type headers and body directly on the canvas.
- Optional safe-area **Guides**.
- **Text is optically centred** in its panel, border, button and CTA chip (capitals to baseline).

### Full-screen Edit and Preview
- ‹ › moves between sections. **+ Section** adds a Hook, Value or CTA after the current one, with Undo.
- Tapping empty space adds an element or changes the background. Tapping an element opens its controls, with a small Remove over the element.
- Tapping the stage around the canvas closes the panel. Export is in the bar on desktop.
- **Preview** shows exactly what exports: videos play, carousels swipe.
- **Light/dark preview background** (the half-circle button). It is a viewing aid only and never exported. In full screen the bar's text and buttons switch colour to stay legible.
- On wide formats the canvas keeps a lane for the round buttons, so they never sit on the picture.

### Sound
- Add music or a sound (mp3, m4a, aac, wav, ogg, flac, opus, or the audio from a video).
- **Fit to sound**, **Cut on the beat**, Volume, Fade out. Sections can also have their own sounds.

### Export
- **Video:** MP4 where the browser supports it, otherwise WebM. Records in real time. Optional mute, and an optional **cover image** (JPG).
- **Carousel:** one numbered PNG or JPG per section.
- **Sizes:** Standard (1080 wide; 1920 × 1080 for 16:9) or **Large 2×**.
- **Items as separate PNGs** (bottom of the Export sheet):
  - Every item of a section, or of **All** sections, as transparent PNGs.
  - Each file is cut to its item by default. **Full frame** keeps the full size with the item in place, for layering.
  - **Save … as .zip** downloads them all; with All, there is one folder per section.
- **Sharpness:** high-quality resampling everywhere, and every PNG waits for the full-resolution artwork first.

---

## 3. Limits

| What | Limit |
|---|---|
| Uploaded video file | **200 MB** per clip. Above 120 MB or 1080p, a heads-up warns that playback may stutter on phones (the upload still goes ahead). |
| Uploaded video length | No limit; it loops behind the section. |
| Uploaded image | Scaled down to **3000 px** on its longest side. |
| Camera recording | **60 s** per clip. |
| Section length | **1–30 s** each. The total is the sum of sections, with no hard cap. |
| Single-section video | Follows the clip's length, capped at 30 s. |
| Safe area | 9:16 (v3.1), by *Safe area for*: All platforms (default) top 15 %, bottom 35 %, sides 18 % · Instagram & Facebook 14 / 35 / 6 · TikTok 12.5 / 34.4 / 11.1 (+ rail notch) · YouTube Shorts 15 / 35 / 17.8. Layout uses the larger side on both sides. Other formats: 6 % all round; 4:5 and 1:1 show the 3:4 grid crop. Advice only: items you drag can go past it. |
| Badge scale | 25 % up to where the badge fills 92 % of the frame. That's about 150 % for wide lockups and 350–380 % for round portraits and stickers on 9:16. |
| Pattern tile (uploads) | 5–100 % of the frame's short side. |
| Brand pattern scale | 25–200 %. |
| Saved designs | 40 per browser. |
| Desktop panel width | 300–560 px, the preview never under 420 px. |
| Carousel Play | 3 s per slide. |
| Your own colours | 8, collapsed to one row behind "+N". |
| Storage | Browser IndexedDB only. iOS Safari is tightest and may clear data for sites not opened for a while. |

---

## 4. Code map

```
index.html        markup + control panel
styles.css        studio UI, themed per brand via :root[data-brand="…"]
js/brands.js      brand registry: palette, artwork, badges (incl. logoTop/size), backdrops, starters
js/hires.js       1× asset → @2x/@3x master map
js/assets.js      loads the active brand's artwork; hi-res masters on demand
js/backdrops.js   painters (tile, art, solid, image + patternFill), uploads, Darken
js/render.js      layout, text, buttons, badge; render(), renderItem(), itemsOf(), badgeScaleMax()
js/store.js       uploads in IndexedDB (MAX_VIDEO_BYTES = 200 MB), audio tap
js/colours.js     contrast check
js/app.js         state, panel, sections/timeline, full screen, export, templates
netlify.toml      static config (publish ".", long cache on /assets)
README.md         long-form documentation per feature
HANDOFF.md        this file
```

**Storage keys** (localStorage/sessionStorage):
- `askruth.backdrop-studio.v2`: the current design.
- `.templates.v1`: saved designs.
- `.colors.v1`: your own colours.
- `.headers.v1`: saved headers.
- `.guides-on`: the Guides setting.
- `.start-new` (session): the Start new flag.
- `.in-editor` (session, v3.1): this tab was in the editor, so a reload goes back there.
- `.panel-w`, `.panel-hidden` (v3.1): the desktop panel's width and hidden state.
- `.draw.v1` (v3.1): the last drawing tool, colour and line.

**Per-section state** lives in `SCENE_STYLE` (app.js). It is mirrored by `commitScene` / `loadScene`, and background framing goes through `sc.adj[bgId]`.

**Element ids:**
- `bt:<id>` button
- `md:<id>` media item
- `xb:<id>[:part]` text box
- `inset` first media
- `dr:<id>` drawing (v3.1)
- `text`, `badge`, `background`

---

## 5. Rules that keep it safe to change

1. **Export and save logic must not be overwritten.** These 39 functions in `js/app.js` must stay byte-identical to the original:
   `exportImage exportVideo pickVideoMime primaryVideoId sourceDuration downloadBlob showExportNote exportSlug save loadTemplates writeTemplates snapshot thumbDataUrl saveTemplate deleteTemplate renderTemplates importFiles dropUpload redrawThumbWhenReady adjustFor syncAdjust bindAdjusts sizeCanvas hasMotion tick draw wireUploads wireInset syncInsetControls placeInsetClearOfText buildOverlaySegments bindText bindToggle trackTopbar overhang snap toCanvas revealThumb syncThumbs`
   The check (`protect.py`) compares them against `orig/js/app.js`. It passes 39/39 in this version.
2. **`js/store.js` is unchanged**, except one approved line: `MAX_VIDEO_BYTES` (120 → 200 MB in v2, → **300 MB in v4**). protect.py allows exactly that line.
3. **New behaviour is added around the protected code, never inside it.** It goes in new functions, capture listeners and new render entry points (`renderItem`, `itemsOf`, `badgeScaleMax`, `patternFill`).
4. **After every change:** run the browser tests, run the protection check, update `README.md`, rezip (excluding `orig/`), and sync the Figma screens.
5. **Keep `orig/` out of the shipped zip.** It's only the reference copy for the protection check.

---

## 6. Assets

- Each brand's artwork is in `assets/` (Ask Ruth), `assets/moshpit/` and `assets/t4r/`. The masters (`@2x.webp/png`, `@3x` pattern tiles) are listed in `js/hires.js`.
- **Badges** follow the Figma badge components as of 2026-10-04:
  - The T4R and MoshPit plates hug the logo.
  - Portraits and stickers have a 172 × 48 "Powered by" pill, with the art inset 4 px at 337 wide; stickers sit 12 px below the pill.
  - `logoTop` per badge in `brands.js` is where the "Powered by" label is cut off when it's switched off.
- **@2x portrait badges** (Ada, Clara, Jimmy) were rebuilt at 1440 wide from the high-res portrait art.
- **Still 1× only, so soft when scaled far up on a 2× export:**
  - The **R-mark portrait** (720 wide).
  - The **MoshPit lockups** (1369 wide).
  - Fix: export them from Figma at 1440 and 2740 wide and add them to `hires.js`.
- **Fonts:** Bitter, Poppins and Roboto 900 come from Google Fonts. They must load before the first paint, and the app waits for them.

---

## 7. Figma file

The section *Backdrop Studio v2 — from code (desktop + mobile)* holds:
- Brand screens for desktop and mobile, light preview background, show-all pickers.
- States: canvas editing, background sheet, sound menu, long-press, clip menu.
- Full-screen edit, preview, + Section menu, light-background bar.
- Buttons: the CTA and Value sections, the empty and filled Buttons sheet, tap-a-button, Undo toast.
- Several media on one section.
- **Export, camera, sound, colours and formats:** Export video, Export carousel with items, Record a clip, Sound added, Section duration, Header colours, artwork framing, 16:9 with the button lane, and uploaded picture as a pattern.
- **Components**, including the full-screen bar (Edit/Preview variants), Add menu, PNG button, media item, button card, text boxes, export sheet summary, timeline, badges and backdrop thumbnails.

**Removed on 2026-10-04:**
- The v1 "Backdrop Creator" section.
- The old "Save backdrop" export screens.
- 9 obsolete components: Edit tabs, Screen bar, CTA button, Badge tile, Group head, Save row, Saved design card, old Export sheet, and the Section sheet placeholder.

**Added on 2026-10-05 (last row of the section, *Start new · Show on · Reorder · Grid · 9:16 safe area*):**
- Screens:
  - Desktop · Start new (sheet open)
  - Desktop · Show on · button on every section (card chips + the *On every section* tag on the canvas)
  - Desktop · Reorder sections · drag a clip (lifted clip + drop line)
  - Desktop · Clip menu · Move earlier / later
  - Desktop · Grid on · snapping while dragging
  - Mobile · Phone creator (the current phone editor)
  - Mobile · More (⋯)
  - Mobile · Start new
  - Mobile · CTA · Buttons sheet · Show on
- Components (Components frame, new group at the bottom):
  - **Show chip** (Off / On / Here)
  - **Show on**
  - **Panel action** (Tidy up, Start new)
  - **Start card** (Design / Blank; its Hook · Value · CTA frames are mini canvases built from Backdrop, Badge and Mini text panel)
  - **Mini text panel** (the Text panel at card scale)
  - **Start new sheet**
  - **Full-screen bar** gains a **Mode=Phone** variant (section · + · 👁 · ◐ · ⋯)
- Changed in place, so every screen using them updates:
  - **Button card**, **Media item** and **More text** now include **Show on**.
  - **Clip menu** has **Move earlier / Move later**.
  - All 50 **Safe-area guides** on 9:16 canvases now use the new margins (top 14 %, bottom 28 %, sides 12 %).
- **Text badge** (v2.4): component set *Text badge* (Brand = Ask Ruth / MoshPit / T4R Labs) with Upper text, Middle text and Lower text layers, plus the screen *Mobile · Ask Ruth · Text badge · upper, middle, lower are text*.
- **Start screen** (v2.5), a new row at y 33000 under its own label:
  - Desktop · Start screen · first visit (Create only)
  - Desktop · Start screen · returning (Recent, Saved, Create new)
  - Desktop · Start screen · Show all (modal, All | Recent | Saved)
  - Mobile · Start screen · returning
  - Mobile · Start screen · Show all (bottom sheet)
  - New components: **Project tile** (State = Default / Open now × Size = Large / Small; the thumbnail is a Backdrop plus a Mini text panel) and **Create card** (Brand = Ask Ruth.AI / MoshPit / T4R Labs, with Video and Carousel buttons).
  - Every tile in these screens uses the same Ask Ruth artwork; only the name, type and brand mark change.
- **A layout per format** (v2.6, v2.9): the *Copy layout from…* rows and their screen were added in v2.6 and removed in v2.9 (the app now fits every format automatically).
- A note at the top of the section says the older Mobile rows show the pre-creator phone layout.
- The Grid switch and the Tidy up / Start new rows are only on the new screens' panels; the older desktop screens still show Guides alone.
- The Start card thumbnails are built from library components (Backdrop / Text panel / Badge), not screenshots. The image upload endpoint isn't reachable from the build workspace.

**v3.0 (2026-10-06), new last row *v3.0 · Simpler editor* at y 34400:**
- Screens: Desktop · Neutral (nothing selected) · + Add menu · Background (tap empty canvas: Tone down on top, smaller toned-down thumbs, Done) · View menu (⤢) · Burger menu; Mobile · Phone creator (☰ instead of the brand mark, no ⋯) · Burger menu (with Safe area / Grid) · + Add.
- New components: **Panel top** (State = Neutral / Editing), **Neutral hint**, **Burger button**, **View menu**, **Burger menu** (Platform = Desktop / Phone).
- Changed in place: *Full-screen · Add menu* is now **Add menu** (Background, Text, Button, Media, Badge, Section, with the app's neutral glyphs); *Dim control* is now **Tone down** (a slider, 0 = Off, no Off / On); *Full-screen bar* Edit mode says *Add* and has a view button, Phone mode lost ⋯; *Start card* Blank frames are plain Plum; **Button card**, **Media item** and **More text** lost Show on.
- Removed: the Show on screens, and the *Show chip* / *Show on* components. *Section buttons* (the old tabs) is kept for the older screens and marked obsolete.
- Variables: the T4R Labs mode of *Backdrop Studio / UI* uses the cool off-whites (`#f6f8fb` / `#fafbfc`) instead of pure white for panel, panel-solid, field-strong, ink-2, plum, topbar-glass and surface-toggle-bg.

**Kept, though no screen uses them:** *Show all modal* and *Editing scope*.

**Not in Figma yet:** the optical text centring. Applying Figma's "cap height to baseline" trim would shrink the boxes unless their padding is adjusted.

---

## 8. Testing

- Browser tests: Playwright scripts with a local server.
- The real Bitter and Poppins fonts are served to the test browser, so measurements match production.
- Coverage:
  - Sections and full screen.
  - Buttons and media.
  - Item export (single, .zip, All, full frame, 2×).
  - Upload pattern mode (save, reload, drag).
  - The canvas staying clear of the round buttons in every format and viewport.
  - Text/button centring, measured to the pixel.
  - The high-resolution clip notice.
- Video export is checked by decoding frames of the exported file.
- Opening the app with `?debug` exposes `window.__studio` (`layout()`, `state()`, `draw()`, `hit(x, y)`, `now()`) for tests; nothing is exposed without it.
- **Dev kit** (`backdrop-studio-devkit.zip`, delivered with this version): the test
  harness (`harness.py`, Playwright + a local server on port 8766), the regression
  scripts (`s131`–`s182`), `protect.py` (checks the 39 protected functions in `js/app.js`
  and `store.js` against `orig/`), and the `orig/` reference copies. Unzip it next to
  the site folder. The fonts the harness serves come from `@fontsource` (Bitter,
  Poppins, Roboto): run `npm i @fontsource/bitter @fontsource/poppins @fontsource/roboto`
  in a `fontpkg/` folder beside `harness.py`. The paths at the top of `harness.py`
  and the tests point at `/home/claude/site` and the scratchpad, so adjust them to
  where things sit.
- Regression set (v3.0 adds `s191 s192`; v3.1 adds `s193 s194 s195 s196 s197 s198 s199`): `s131 s132 s136 s143 s147 s149 s151 s152 s158 s160 s161 s163 s170 s173 s175 s178 s181 s182 s191 s192 s193 s194 s195 s196 s197 s198 s199` (+ `s183`–`s190` from the v2.9 dev kit, not re-run since v3.0).
- `s186` covers the start screen, per the brief's acceptance criteria.
- `s190` covers Reel defaults, pattern spacing and the gallery tile, Multi select wording, Tidy up selection with Undo, and the selection being dropped on a new template. `s182` also checks that the phone selection bar fits the screen.
- `s189` covers the whole Ask Ruth mark on the start screen and stills for older designs.
- `s188` covers growing text fields and the template badge rule.
- `s187` covers a layout per format (and `s183` now expects a hand-moved button to start from its own spot in a new format, nudged clear).
- `s185` covers the Text badge: the three parts, colours, middle on / off, per section, PNG, reload, extra badges, MoshPit / T4R, and phone tap.
- `s184` covers Show on (chips, some / All, linked edits, per-section position and placing clear, new sections carrying All, the section badge, Undo) and reordering (menu, mouse drag, touch hold-and-drag through CDP touch events, swipe doesn't reorder, backgrounds stay, Undo).
- **`?debug` alone keeps the empty start** the older scripts were written for; `?debug&template` gives the template start everyone else sees. All scripts now open `?debug` (some used the bare URL).
- `s183` covers Start new: template on first launch and on a brand's first open, pieces by role, placement inside the safe area / centred / no overlap for 3 brands × 4 formats × 3 sections, the sheet, Shuffle, Blank, Undo, the template button following the format, and the phone sheet.
- **Known flakes:** `s182`'s desktop shift-click checks fail about one run in three (they also failed before this version's changes). The script shift-clicks back to back; with a short pause it passes every time. `s170` failed once in five runs (phone "Text again"). `s175` stays in the set.

---

## 9. Open items / next steps

### Agreed for the next chat (start here)

0. **Done in v2.1:** per-brand starter templates, built as *Start new* with proposals (see §10).
   Still open around it:
   - Draft copy is in (v2.3, table in README → *Template copy*); Marco to edit.
   - Decide whether the left-hand 12 % of the 9:16 safe area is worth it. The alternative is an asymmetric box (left 6.5 %, right 15 %); it's exact to the rail but pushes centred layouts off the frame centre.
   - **Done in v2.6:** buttons, extra badges, text boxes and media have a position per format (`at[format]`, see §16). It's done around the protected code: no drag-code or protected-function changes.

1. *(was: Per-brand starter templates. Kept for the notes.)* Every brand opens on a full template: Hook,
   Value and CTA with all pieces in place (badge, headline, body, button, lower
   badge where it fits), positioned by best practice inside the safe area for each
   format. Users switch off what they don't need or move it. Notes so far:
   - Build it on what exists: the brand `starter` in `js/brands.js`, `starterDesign()`,
     `startClean()`, per-format `pos`, and Tidy up's column logic for placing pieces
     in every format.
   - Decide with Marco: should Start new offer *Template* (default) or *Blank*? And does
     the template also replace the first-launch design?
   - Reels / TikTok / Shorts put their own UI on the frame (bottom caption, right-hand
     icons). Check whether the 9:16 safe area allows for that before placing pieces.
2. *(Done in v2.3.)* **Grid toggle** next to Guides: centre lines, thirds and a column grid inside the
   safe area (editor only, never exported), with snapping to the lines while it's on.
   Dragging already snaps to the centre and the safe-area edges.
3. **Figma: bring the file fully up to date.** *(Mostly done 2026-10-05; see §7.)* Was:
   - The phone full-screen creator (the only phone editor now): top bar, full-screen
     bar with ◐ and ⋯, canvas, timeline, bottom sheet. The existing mobile screens
     show the old phone layout and are out of date.
   - The bold × on sheet close buttons, and the heavier icon strokes in sheets.
   - The Tidy up button in the panel (it's already in the menus).
   - The **Start new** sheet (desktop + phone), the brand templates (Hook / Value / CTA per brand) and the Start new button in the panel.
   - The 9:16 safe area at its new size (top 14 %, bottom 28 %, sides 12 %).
   - **Show on** chips in the cards (button, text box, media, badge and the Badge / Media groups), the *On 2 sections* tag on the canvas, and the timeline drag (lifted clip + drop line) with Move earlier / later in the clip menu.
   - The grid, once built.
4. **Known flake:** Tidy up once showed a text box over a button in a random stress
   run before the re-measure fix. It hasn't reproduced since (six runs clean), but
   keep `s175` in the regression set.

### Still open after the Figma sync
- Add Grid and the Tidy up / Start new rows to the panels of the older desktop screens (they're on the new screens only).
- Retire or rebuild the old Mobile rows (a note marks them as outdated).
- Start new sheets for MoshPit and T4R Labs in Figma (only Ask Ruth's is drawn; their cards would be the same component with other Backdrop / Badge variants).

### Older open items

- Add a Figma export of the R-mark portrait (1440 wide) and the MoshPit lockups (2740 wide) for full sharpness at large scales.
- Optionally apply the cap-height text trim to the Figma text panel and button components.
- Optionally raise the 30 s per-section cap if longer single clips are needed.
- Replace the placeholder starter copy per brand in `js/brands.js`.

---

## 10. Changes in this version (2026-10-04 session)

- Badge assets synced to the updated Figma badge dimensions and spacing; `logoTop` recalculated.
- Full screen: **+ Section**. The bar stays legible on the light preview background.
- **Items as separate PNGs** in Export (per section / All, cut or full frame, .zip).
- **↓ PNG** on every edit section and card (2×, transparent).
- The full-screen panel's × has its own row with a divider.
- **Uploaded background as a pattern** (tile size, mirror, drag to shift).
- Canvas keeps clear of the light/dark and full-screen buttons on wide formats.
- **Badge scale** goes up to "fills the frame", per badge and format.
- **Sharp PNGs:** high-quality resampling, waiting for full-resolution artwork, @2x portrait badges.
- **Text optically centred** in panels, buttons and the CTA chip.
- **Reset to default** for text, each text box and each button.
- **Clear section** with Undo.
- Section buttons switch their item on when it's off.
- **Colour fix:** every swatch applies (low-contrast ones were silently disabled), and a background change no longer changes the text colour.
- **Phones use the full-screen creator only** (canvas + timeline; controls open from the canvas; More holds Guides and saved designs). Carousels can now be Reel / Story 9:16 too.
- **Badge in three parts:** upper badge, badge image, lower badge (text box with colours and stroke), each shown or hidden on its own, selectable on the preview.
- Phones: every field is 16 px, so iOS Safari no longer zooms the editing sheet.
- **Video uploads up to 200 MB**, with a heads-up for clips over 120 MB or above 1080p.
- Figma: missing screens added, outdated ones and unused components removed, PNG button component added.
- **Desktop: the right panel runs the full height**; the timeline sits under the preview only (video and carousel).
- Figma: all 22 desktop editor screens moved to the full-height panel layout (preview + timeline in the left column).
- **Upper badge text is editable** (default "Powered by").
- **More than one badge per section** (Add a badge), each with its own upper and lower badge.
- **Start new stays in the current brand** (it used to jump to Ask Ruth.AI).
- **Tapping an item scrolls the panel to its own controls**, and its thumbnail strips slide to the one in use (editor, full screen, phone).
- **Multi-select on the preview:** Shift / ⌘ / Ctrl-click (phone: long-press → Select more), group drag, Align centre, Space evenly, Remove N / Delete, Esc / Done; Undo.
- Figma: new component *Full-screen · Multi-select bar* (Align centre, Space evenly, Remove N, Done).
- **Fix: Tidy up could land items short** when they started outside the frame (drawn clamped). Placement now re-measures and corrects.
- **Fix: full screen on desktop — tapping an item opens its controls again.** The full-height panel (sticky) held the full-screen side panel underneath the stage, so only Remove showed; the canvas also got cut off instead of shrinking beside the open panel. Both fixed and tested at 1000–1920 px, 16:9 / 9:16 / 1:1, badge, extra badge, text and button.
- **Browser colour follows the brand** (theme-color and the page's root background are set before first paint; it used to start as Ask Ruth's purple for every brand).
- **Tidy up** (panel, clip menu, canvas add menu): one centred column in the safe area, current order kept, even gaps, badges / buttons / media side by side when they fit; shrinks to fit only when it must; per format; Undo. Figma: Tidy up added to the clip menu and the full-screen Add menu.
- Figma: new screen *Desktop · Ask Ruth · Badge · own upper text + more badges*.
- Figma: the full-screen Add menu has one **Text** item (Header and Body merged).
- **Header and Body are one text box** (one background, one border round both; colours and sizes per part). Switching text on fills empty parts with placeholder copy, Hook included. The canvas add menu has one **Text** item instead of Header and Body.
- **Chunkier icons in popups and sheets:** menu icon chips 30 px with 17 px icons at a 2.5 stroke; sheet close buttons draw a bold ×; heavier strokes on the PNG, colour, delete and record icons. Figma menu components updated to match.

## 11. Changes in v2.1 (2026-10-05 session)

- **Start new with proposals.** A sheet of starting designs made from the brand's own
  backgrounds, badges, text styles, Darken, button colours and copy: the brand template, four curated
  proposals per brand, Shuffle (only pairings that read; contrast decides text tone,
  lockup colour, and Darken under bare text on busy grounds), and Blank. Undo.
- **Brand template on first launch** and on a brand's first open. Hook: badge + headline.
  Value: headline + body. CTA: headline + button + badge with lower badge, usually on
  a solid CTA background.
- **Placed for every format** in one centred column inside the safe area (Hook a
  little above the middle). The template button keeps a spot per format and follows
  format changes until it is moved by hand.
- **9:16 safe area tightened** to top 14 %, bottom 28 %, sides 12 % for the platforms'
  own UI. Guides, text wrapping, Tidy up and clamping all follow, so 9:16 text sets
  narrower than before.
- **Fix:** a first launch no longer saves an empty "Last session" under Saved designs,
  and an untouched start isn't kept as one either.
- Brand data: `proposals` per brand and `button` words in each starter's `cta`.
- Protected functions: 39/39 unchanged. `store.js` unchanged (bar the 200 MB line).

## 12. Changes in v2.2 (2026-10-05, later)

- **Show on.** A row of section chips in each element's card (buttons, text boxes,
  media items, extra badges, and the section's own badge and media): some sections or All.
  Linked copies share edits but keep each section's own position. When put on a
  section, an item moves to the nearest free spot if its own is taken. New sections
  get items marked All. The canvas tags a selected shared item *On N sections*.
- **Reorder sections.** Timeline drag (mouse straight away; touch after a hold, so a
  swipe still scrolls), plus Move earlier / later in the clip menu. Backgrounds, Darken
  and framing stay with their section. The first section's background becomes the
  shared one. Undo.
- Sandbox helper (`inSandbox`) also restores background framing, which `loadScene` writes in place.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 13. Changes in v2.3 (2026-10-05, later)

- **Grid toggle** next to Guides: centre lines, thirds, and columns inside the safe area. Dragging snaps an item's
  centre / edges / middle to it; the snapped line lights up. Drawn with dark twins so
  it reads on light patterns. Editor only, saved with the design (`state.grid`).
- **Draft template copy** for all three brands (`starter` in `brands.js`; see README).
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 14. Changes in v2.4 (2026-10-05, later)

- **Text badge** for every brand: upper, middle and lower parts are all editable text. The
  middle plate (`badgeMiddle` / `middle` on extra badges) has text and background colours
  from the brand swatches. It hugs its words, capped at the safe-area width. Rendered via
  `textBadgeImage()`, so all badge features and exports work unchanged.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 15. Changes in v2.5 (2026-10-05, later)

- **Start screen** (continue or create).
  - It's a view onto existing state: the open design, `state.designs` (now with
    thumb / touched / contentType / fmt), and the saved-designs list. Automatic entries are
    now the newest 8 *Recent · …* with stills, not one *Last session* per brand.
  - Create new → `createProject(brand, type)` → the brand template, video 9:16 or carousel 4:5.
  - Opening a recent design swaps it with the open one.
  - The brand mark is the way back.
  - `?debug` skips it; `?debug&home` shows it.
- Figma: start screen row (desktop first visit, returning, Show all modal; phone returning,
  Show all sheet) plus the *Project tile* and *Create card* components (§7).
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 16. Changes in v2.6 (2026-10-05, later)

- **A layout per format.** Marco moved items on 9:16 and found his 16:9 layout had changed:
  buttons, text boxes, media and extra badges shared one position across formats.
  - Each of those items now keeps `at[format] = {x, y}`. `x / y` stay the live spots for the
    format on screen, so render, drag, Tidy up and every protected function are unchanged.
  - `switchLayout(from, to)` runs from the format dropdown's change handler (`buildFormats`).
    It stores the spots for the old format and loads the new one's. A format the item hasn't
    been arranged in gets the current spot, or the untouched template spot (`tpl`). It is then
    nudged clear with `placeClear`. This replaces `followTemplateButtons()`.
  - **Copy layout from…** (`#layout-btn` under Tidy up, which is also on a phone through ⋯)
    → `copyLayoutFrom(fmt)`. It copies `pos[fmt]` and each item's `at[fmt]` on every section,
    with Undo.
  - `propagateLinked` keeps each section's own `at`, as it already did for x / y.
- Figma: a *Copy layout from…* Panel action row under Tidy up on the three screens that show those rows (desktop Start new, desktop Show on, phone More). There is also a new desktop screen with the menu open.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 17. Changes in v2.7 (2026-10-05, later)

- **Text fields grow with their text.** Marco found the panel fields stayed small with several lines.
  - `wireAutoFit()` wraps the textarea `value` setter, so every place the app fills a field refits it. It also listens to input, and a ResizeObserver plus MutationObserver catch fields that appear, move into the phone sheet or change width.
  - `fitField()` sizes a field to `scrollHeight`: its rows at the least, ~40 % of the viewport at most, then it scrolls. It keeps the panel's scroll position.
  - The canvas editor textarea is left alone.
- **Template badge placement** (Marco's rule).
  - `columnOrder()`: a logo alone (no upper, no lower) goes first in the column; a *Powered by* or lower-badge lockup goes between the text and the button.
  - The Hook now uses the logo alone at 120 % (the widest the 9:16 safe area allows); the CTA keeps *Powered by* plus the lower badge, now placed above the button.
  - This applies to new templates and proposals. Designs already made keep their layout, and Tidy up still keeps the order you have.
- Figma: the *Start card* component's Hook frame now shows the logo alone and larger, and its CTA frame has the badge above the button. Every Start new sheet and screen that uses it updates.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 18. Changes in v2.8 (2026-10-05, later)

- **Ask Ruth's mark on the start screen is the whole speech bubble**: no circle crop, no backing. It was cropped to a circle, which also cut off the bubble's corner.
  - `assets/brand-askruth-mark.png` is a new 256 px transparent cut from `badge-plum@2x.png`.
  - Brands can now have a `mark` beside their `icon`; `brandMark()` shows a `mark` whole (`.home-brand-mark.is-free`). MoshPit and T4R stay round.
  - The top-bar mark in the editor is unchanged (`icon`).
- **Blank tiles in Recent.** Marco's screenshot showed tiles with only a brand mark. Those were designs from before stills were kept.
  - Tiles of the open brand now draw their still on the spot.
  - `fillBrandStills()` runs when a brand's artwork has loaded (at launch and after a brand switch). It gives that brand's saved and recent designs the still they lack, up to 12 at a time, and keeps them.
  - Other brands' tiles show the brand mark until then. A still can't be drawn for a brand whose artwork isn't loaded; trying gives the open brand's artwork, so it isn't done.
- `s182`'s flaky multi-select step now measures the preview again after the first tap (opening a badge's controls can move it). It passed 4/4.
- Figma: the *Create card* · Ask Ruth.AI mark is the bubble shape (pink bubble, sharp lower-left corner, plum ring, R) instead of a circle.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 19. Changes in v2.9 (2026-10-05, later)

- **New projects start as a Reel.** `HOME_FORMAT` is 9:16 for both Video and Carousel (Carousel was 4:5). I couldn't reproduce Video opening as Square: it opened 9:16 on desktop and phone. If it happens again, note which brand and screen.
- **A layout per format, fitted automatically.** This replaces *Copy layout from…*, which Marco found confusing (the button and its menu are gone).
  - `markEdited()` sets `sc.edited[format] = time` when a section's layout changes in a format: the first movement of a drag (in the shared pointermove, since items end their drags in separate handlers), a group drag, Tidy up, Align, Space and Tidy up selection.
  - In `switchLayout()`, a section's format that isn't edited follows the latest edited format (`leadFormat()`): `followLayout()` copies `pos[src]` and each item's `at[src]`, then `fitLayout()` keeps every box in the safe area. If any overlap, it groups side-by-side items into rows and re-spaces the rows evenly (gaps 1.2–4.5 % of the height), keeping order and x.
  - Sections with nothing edited keep their own per-format spots (templates), with the `tpl` button rule and a nudge clear for items without a spot.
- **Pattern spacing.** `adjust.gx / gy` (0–2 × the tile) are used in `patternFill()` (backdrops.js), which now steps tile plus gap. The half-pixel overdraw only applies when tiles touch. Two sliders sit in `#pattern-controls`, and Reset clears them.
  - The gallery tile is drawn by `drawBgThumb()`. It also leaves out buttons, text boxes, media and extra badges, so the gallery shows backgrounds only. `refreshBgThumb()` redraws it when the fit, size, spacing or section changes.
- **Multi select.**
  - The item menu says *Multi select* (was *Select more*).
  - New `multiTidy()` (*Tidy up selection*): a centred column in order, even 2–5 % gaps, kept in the safe area, with Undo.
  - The selection bar gets `is-multi`: it wraps (max 460 px or the screen width), is re-placed after it measures, and uses short labels under 600 px.
  - `dropMulti()` clears a selection quietly on section select, brand switch, template apply, Start new, opening a design from the start screen, opening the start screen, Undo and Create new.
- Figma: the *Copy layout from…* rows and screen are removed. *Full-screen · Multi-select bar* gains *Tidy up selection* and wraps. The *Uploaded picture as a pattern* screen gets Horizontal and Vertical spacing sliders.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 20. Changes in v3.0 (2026-10-06)

Marco's list plus spec sections 10–15 (simpler editor). All functionality is kept.

- **+ Add replaces the element tabs.** `#edit-tabs` is hidden; `#panel-top` holds `#add-btn` (+ Add), an empty title and `#panel-done`.
  - `addItems()` / `openAddMenu()`: Background, Text (fills the placeholders, or adds a text box when the text is on), Button, Media, Badge (switches it on, or adds another, placed on the least-covered spot), then Section.
  - Full screen: `#fs-add-section` is now *Add* and opens the same menu.
- **Contextual panel.** Neutral = `#group-view` with `#neutral-hint` and Tidy up. Selecting an item shows only its group (CSS: `.panel-controls:not([data-tab="all"]) > .group[data-tabs~="all"]` is hidden). Done / Esc returns to neutral. Empty canvas tap → Background (full screen included: `fsSelect('background')`).
- **View settings (spec 14).** Phone: Guides and Grid in the burger menu. Desktop: `#fs-open` opens a view popover (Full screen, Guides, Grid); in full screen `#fs-view` opens it too. `viewToggle()` drives the protected `bindToggle` switches. The old `.view-toggles` rows are hidden. Not in every kebab menu: the spec asks for one place per platform.
- **Burger menu** (`#burger`, `renderBurger()`): Save, Start new, Recent, Saved, All projects, phone toggles. `#start-new` and `#group-templates` are hidden from the panel; the phone ⋯ (`#fs-more`) is gone.
- **Tone down** (`#wash-controls` at the top of Background): always shown; slider 0 = Off sets `overlay.style = 'none'`, above 0 = `'dim'`. Works for patterns, artwork, colours and uploads.
- **Show on removed.** `propagateLinked`, `carryShared`, `showOnRow`, `syncOwnShowOn`, `selectionNote` are stubbed; `unlinkAll()` clears linked / share flags at boot and on templates.
- **Blank start** uses `PLAIN_OF` (askruth `solid-plum`, moshpit `mp-charcoal`, t4r `t4r-navy`): plain colour, no buttons, text, media or badge. The start card draws it in that colour.
- **Toned down unselected items** (`syncFocusRows()` in `paint()`): `.is-focus` / `.has-focus-item`; unchecked thumbs and segments at 50 %, timeline clips at 55 %.
- **Smaller background thumbnails**: about 6.4 per row instead of 4.
- **No full white:** Ask Ruth and MoshPit had no pure white UI. T4R's `--ui-*` whites are a soft cool off-white (`#f6f8fb` / `#fafbfc`), kept within its own cool palette rather than beige (agreed with Marco).
- **Phone top bar:** the brand mark is hidden to make room for the burger. Brand and format no longer run into each other: below 430 px both are 13 px with tighter gaps; below 400 px the kind moves into the small label (*FORMAT · CAROUSEL* over *16:9*), so the longest format fits next to *Ask Ruth.AI* and Export down to 360 px (checked for every brand × format at 360 / 390 px). `syncFormatTab()` now writes the kind in its own `.fmt-kind` span.
- Tests: new `s191` (109 checks across desktop / full screen / phone and all formats: add each element, select, edit, background, Tone down on 8 backgrounds + colour + upload, delete / duplicate / reorder via clip menu, view settings, Full screen, burger, overlaps, small items, deselect, no sideways scroll) and `s192` (shift-click multi select). Older suites were patched for the new controls (copies of the old ones in `pre_v30/`).
  - `s182`'s desktop shift-click part fails 3 checks, identically on the untouched v2.9; `s192` covers the same feature and passes.
  - `s183`–`s190` came with the v2.9 dev kit from the other chat and weren't in this session, so they weren't re-run; run them from the dev kit next time (they may need the same tab / ⋯ / Show on patches as the older suites).
  - Esc doesn't reach the page in the phone emulation of the test browser; phone tests close the burger by tapping outside. Esc works on desktop.
- Protected functions 39/39 unchanged; `store.js` unchanged.


## 21. Changes in v3.1 (2026-10-06)

Marco's Principal-Designer spec ("Less UI → more canvas → direct manipulation"), worked in its priority order on top of v3.0. README → *What's new in v3.1* has the detail per feature.

**P0 — no lost work**
- Root causes found and fixed:
  1. Startup restored the open section from its own copy, which lagged behind the live fields, so a header typed and then reloaded came back old. Now `commitScene()` runs at startup, `keepSceneCard()` keeps h1 / body in step on every paint, and `persistNow()` runs on pagehide, hidden and freeze.
  2. Every load opened the start screen, so the design looked gone. Now a reload in the same tab returns to the editor (`IN_EDITOR_KEY`).
  3. On phones the page was 32 px taller than the screen, with no overscroll stop, which is what let pull-to-refresh fire. Now html / body have `overscroll-behavior: none`, and the phone creator has no bottom padding at full height.
- Home is in ☰. `s193` covers reload, typing then leaving, Home and back, a new visit, a non-first section, wheel, overscroll and page height.

**P1 — core interaction**
- Background inspector: Colour · Pattern · Image, with controls by type (`bgKindOf`, `syncBgInspector`, `#bg-kinds`; CSS filters the gallery by `data-k`).
- Gradient as a virtual backdrop id (`gradientBd`, `gradId`; `gradients` partners per brand).
- One Spacing and Offset rows for uploads used as a pattern (`patternFill` row shift).
- Safe Space is advice: render.js skips the safe-area clamp for `free` items. `markFree()` sets the flag after a drag (its own pointermove listener, after the drag handler).
- ✕ on the selection (`syncSelDelete`, `#sel-del`, Delete / Backspace) replaces the full-screen quick bar.
- Resizable and collapsible desktop panel (`wirePanelSize`, `.panel-grip`, `#panel-toggle`, peek = `html.panel-peek`), with container queries on `.panel-controls`.
- Formats: 3:4 added, short names, a platform safe area (`SAFE_TARGETS`, `setSafeTarget`, `state.safeFor`), and the TikTok rail and 3:4 grid-crop guides. Research: dev kit `FORMATS.md`.

**P2 — creation**
- Drawing (render.js `drawDrawing` / `drawingBounds` / `paintStroke`; app.js `enterDraw` / `finishDraw` / `drawingAt` / `wireDrawing`; `#draw-bar`, `#group-draw`).
- Carousel Play (`playSecs`: 3 s a slide; the transport shows for carousels; slides 96 px tall so the timeline keeps its height).
- Home: Create new first, one button per brand, straight to a Video Reel.
- Brand area is one control (`.brand-area`, `#tb-brand-label`).
- Redo (`redoStack`, `redoLast`, ⌘⇧Z / Ctrl+Y).

**Later the same day: brand + precision**
- *Round portrait badges*:
  - **Shape** (Round / Bubble, the lower-left corner square) and **Halo** (an outline in a brand colour), for `round: true` badges only (Ada, Clara, Jimmy, R mark).
  - The grunge stickers are excluded.
  - Built as `shapedBadgeImage()` in render.js; brands gain `haloColour`. The UI is `#bp-shape` in the badge image part.
  - Per section: `badgeShape`, `badgeHalo` (SCENE_STYLE + DESIGN_KEYS).
- *Precise slider values*:
  - Every `.slider-row output` is editable in place (`wirePrecise`, `editPrecise`).
  - The typed value is set through the range's own events, so there is no second slider system or state.
  - `PRECISE_SKIP` keeps picture position visual.
- Test `s196`.

**Later still: removal and optional items**
- The Text, Badge and Media head switches are hidden; ✕ and + Add cover them. The inputs remain as the single state.
- Upper, Badge image and Lower keep their switches.
- ✕ on a badge part keeps the badge controls open (`runSelDelete`), and ✕ on anything else closes them.
- Test `s197` follows the spec's end-to-end scenario from a template and from a blank project: remove, restore, edit, remove text, + Add, reorder, reload, export.
- The export is compared pixel for pixel with Preview: mean difference 0.

**Cogent backgrounds**
- Ada, Clara, Jimmy and Ruth (R), each round and as one sticker, in every brand.
- Pattern or Single; Speech bubble (lower-left corner square, filled from the image); Halo; Ground.
- brands.js `COGENT_ASSETS` / `cogentBackdrops`; backdrops.js `cogentArt`, the `cogent` painter, `setAdjustLookup`; app.js `syncCogent` / `wireCogent`; `#cogent-controls`, the fourth Background tab.
- Test `s198`: all brands, desk and phone, export = preview.
- Figma library: one *Cogent* component set, *Who* (Ada / Clara / Jimmy / Ruth) × *Style* (Round / Sticker) × *Shape* (Round / Bubble) × *Halo* (Off / On). The bubble is a radius on three corners, 0 lower-left, with the fill sampled from the art. Then *Background · Cogent pattern* and *Background · Cogent single* built from it.

**Phone round**
- Solid brand top bar and page edges, so Safari 26 tints its bars in the brand colour.
- Upload in the Pattern tab (`uploadAsPattern`; `bgKindOf` lists uploads used as patterns under Pattern).
- Text background in Custom only, plus **No background colour** (`noBg` / `setNoBg`; `#tg-nobg`; `.is-custom` on the colour pop).
- A pattern picked for a section boxes bare text (`boxTextOnPattern`, with Undo; not on a section or brand change).
- No trash icon on badge cards.
- The restore note is dismissed at the first touch elsewhere.
- Test `s199`.
- **Not verifiable here**: Safari's own bar tint. Check on the iPhone.

**P3 — polish**
- Badge [Upper][Lower] row (CSS `display: contents` on the parts; markup unchanged, so `s152` still clicks the same heads).
- Export icon-only on phones.
- Icon-centring audit: every round control's icon is within 0.6 px of centre, and every glyph within 0.75 units of its viewBox centre. The Play triangle's +1.5 is the deliberate optical offset.
- Shorter panel copy.

**Rules**
- Protected functions 39/39 unchanged; `store.js` unchanged (bar the 200 MB line).
- No protected function was edited. New behaviour sits in new functions, extra listeners, and render.js / backdrops.js.

**Tests**
- New: `s193` (P0), `s194` (Background, gradient, upload pattern, safe space, ✕, panel), `s195` (Home, formats, safe area for, brand area, Export, carousel Play, badge row, Redo, Drawing).
- Patched for v3.1 controls: `s151` (the colour is under the Colour tab), `s161` (the tabs replace "Change background"), `s191` (two "Safe area…" items in the view menu).
- New suites reset storage from a blank page on the same origin (`__blank__`), not with clear-then-reload on the running studio, which can now write its state back while unloading.

## 22. The spec audit: keep / refine / change / remove

**Kept** (v3.0 already met the spec):
- + Add instead of tabs; tap to edit; a minimal neutral panel; tapping empty canvas opens Background.
- Tone down on every kind of background, staying at the top so it never moves between types.
- Show on removed (spec 19), Hook / Value / CTA kept.
- Guides and Grid as view settings in one place per platform (spec 22).
- Unselected items toned down (spec 5); smaller background thumbnails (spec 6).
- Blank = the plain brand colour (spec 17).
- Recent and Saved in ☰ (spec 49).
- Undo toasts with no confirmations.
- No pure white: T4R's cool off-white stays, as agreed in v3.0. The spec's "warm beige" would fight T4R's cool palette. Ask Ruth and MoshPit are already warm or dark, and the canvas itself is never tinted.

**Refined**:
- Background now selects by type, Solid first (spec 6–8, 12–15).
- One Spacing control (spec 13).
- Microcopy (spec 60).
- The Export button (spec 42).
- The brand area as one hit target (spec 51).
- The format selector: short names, an icon for Video / Carousel (spec 35–36).

**Changed**:
- Safe area: clamped → advice (spec 23).
- Home: Video / Carousel choice → one tap per brand to a Reel (spec 32–34).
- The full-screen Remove bar → a ✕ on the selection (spec 24).
- The brand mark: Home → part of the brand switcher, with Home moved to ☰ (spec 50–51).
- The 9:16 safe box: 14 / 28 / 12 → 15 / 35 / 18 by default, per platform (spec 38–40).

**Removed**:
- The phone's "Change background" heading, which the tabs replace.
- The full-screen quick bar.
- The Horizontal / Vertical spacing sliders. They stay in the DOM, hidden, for older code paths.

**Judgement calls against the letter of the spec (decide with Marco):**
1. **Brand patterns: Scale only.** Spacing and Offset rows apply to your own picture used as a pattern. A brand tile is a pre-composed, staggered block of motifs, so tile spacing breaks it. The alternative is per-tile motif metadata in brands.js, so motifs themselves can be re-spaced.
2. **Tone down stays first**, not last, in each type's list (v3.0 request, and a fixed position).
3. **Gradient is a switch under Colour**, not its own type (as the spec suggests). It has four directions plus swap, with no angles.
4. **The collapsed panel floats in on selection** and the stage makes room. The canvas re-centres once, but is never covered.
5. **Studio surface**: no change (see Kept).
6. **9:16 safe box: symmetric 18 % sides** for layout, so centred designs stay centred. The left 11 % / right 18 % asymmetric box is more exact for the rail, but pushes centred layouts about 38 px left.
7. **Drawing has no rotation yet**: Size, move, colour, line and opacity only.

**Not done / next:**
- Contrast advice when a gradient makes bare text hard to read. Today `pickColour` flips the Light / Dark text tone under 3:1 for bare text, as for any colour. A visible suggestion (spec 18) is still open.
- Per-format positions (`at[format]`) for drawings. A drawing keeps its relative spot across formats.
- Drawings in Multi select and Tidy up.
- Brand switching with gradients: a gradient made in one brand stays as it is in another. It isn't rebased, as custom colours aren't either.
- Carousel rules from the research: one ratio per carousel (already true), the per-platform slide caps (20 IG, 35 TikTok, 4 X / Bluesky) as an Export hint, and JPG for TikTok photo mode.

## 23. Figma track for v3.1 (done in v3.4, see §27)

Update **shared components first**, then add one row *v3.1 · Inspector, drawing, panel* (at y ≈ 35800).

Components:
- **Background group**: Tone down → Colour · Pattern · Image segmented → per type:
  - Colour: swatches + Gradient switch; when on, To + Direction (4 arrows + swap).
  - Pattern: thumbs + Scale.
  - Image: thumbs + Upload / Record + Scale + "Position ›".
  - Upload pattern: Tile size, Spacing, Offset rows, Mirror.
- **Selection ✕** (28 px, `--active` fill, 2 px panel ring) on the outline's upper-right; replaces *Full-screen · quick bar*.
- **Panel grip** (4 × 44 px bar in the gap, active on hover) and **Panel toggle** (round, third under ◐ / ⤢), plus the **Floating panel** (360 px, shadow) state.
- **Draw bar** (tools · swatches · S / M / L · undo · Done; desktop over the canvas top, phone docked at the bottom) and the **Drawing group** (Colour, Line, Opacity, Size, Draw more / Duplicate / Remove).
- **Format pill**: [video | carousel icon] Name Ratio. **Brand area**: one hover plate round mark + label + name + caret.
- **Export**: Desktop = icon + word; Phone = 44 px round icon.
- **Badge part toggles**: [Upper] [Lower] as two 44 px switch chips.
- **Round badge**: Shape segmented (Round · Bubble, with mini shape icons), Halo switch + colour row. Badge components for Ada / Clara / Jimmy / R mark: variants *Shape = Round / Bubble* × *Halo = Off / On* (the bubble = radius on three corners, 0 lower-left; the halo = an inside stroke in `haloColour`).
- **Slider value**: Default (dotted underline) / Editing (a small field with an active border + unit) / Clamped (flash) on the shared slider-row component.
- **Home create button** per brand (mark · name · + in a filled circle). Home order: Create new, Recent, Saved.
- **Safe-area guides**: 9:16 box 15 / 35 / 18 with the TikTok notch (dotted); 4:5 and 1:1 3:4-crop lines.
- **Carousel timeline**: transport visible, slides 96 px.

Screens:
- Desktop · Background Colour + Gradient on · Pattern · Image
- Desktop · Panel wide (560) / narrow (300) · Panel hidden · Hidden + floating Background
- Desktop · Drawing mode · Drawing selected
- Desktop · View menu with *Safe area for* + its submenu
- Mobile · Background tabs · Draw mode (bar docked) · Home (Create new first) · Top bar at 360 px (icon-only Export)

Keep the v3.0 rows and add a note that v3.1 supersedes their Background panel and quick bar.

## 24. Changes in v3.2 (2026-10-06, second phone round)

All outside the 39 protected functions (`protect.py` 39/39). Test: `s200` (heart, menu order, All projects return, Loop/Mute placement, Upload a pattern, Cogents per brand).
- `placeVideoControls()` (paint): moves `#video-controls` between its home in the background group and `#inset-body`. `syncImageControls` still decides `hidden` via `hasMotion()`.
- `syncUploadLabel()` (start of `syncBgInspector`): label per tab. A capture click on `#btn-upload` sets `#file-input.accept` to `image/*` on the Pattern tab.
- `cogentBackdrops(ground, only)` in brands.js. Ask Ruth passes `['ruth','clara','ada']`. A saved Ask Ruth design on `cog-jimmy` falls back like any missing backdrop.
- Heart: `#btn-save-proj`, `#save-pop`, `#save-scrim`; `openSavePop` / `closeSavePop` / `saveFromPop` / `wireSaveProject`. It saves through `#tpl-name` + `#tpl-save`, so the storage and quota handling are unchanged.
- Menu: `renderBurger()` rewritten in the new order; `openAllProjects()` = `openHomeAll('all')` without `openHome()`. The capture on `#fs-open` that opened the view menu on desktop is removed. `#group-view .view-toggles` is hidden (the switches stay as the state the menu drives).
- Esc: the window capture in `wireSaveProject` closes the popup / All projects first. The full-screen Esc handler counts `#home-all` and `#save-pop` as "open on top".
- Tests patched: s191 and s195 (view settings now in ☰). Every "Full screen" menu click after `#fs-open` became a no-op wait, because the button goes straight to full screen.

## 25. Changes in v3.3 (2026-10-06, third round)

Test: `s201`.
- **CTA box.** `render.js measureCta` (bold branch) computes `boxBg` when `state.ctaBox`, or when a picked `cardColors.h1` exists and `textLook` gives a background. It pads the text by 32·S, and `drawCta` fills a rounded box behind it, with the look's text colours.
- **`ctaBox` state.** It is in state, `SCENE_STYLE` and `DESIGN_KEYS`; `loadScene` and boot default it to false. In app.js, `noBg()` also counts a bold CTA without `ctaBox` or its own colour as "no background". `setNoBg()` sets `ctaBox`, and `resetLook()` keeps it.
- **Known overlap.** The box adds 64 px of height at the same text position, so it can touch the "Powered by" badge under it. Tidy up re-spaces the section.
- **Custom popup.** CSS `#color-pop.is-custom` hides the Text and Border rows, and the title reads "Background colour".
- **Hidden controls.** `.block-item .block-del` is hidden. Record is hidden for patterns, including `#picker-camera` when `#picker[data-k=pattern]`. `#picker-upload` reads "Upload a pattern" and accepts images only there.
- **Clean starts.** `proposalData(recipe, { clean: true })` builds Hook = badge as logo (1.4), Value = nothing, CTA = one button, with no dim; the start sheet uses it for every card. `openTemplateDesign`, `createProject` and the first brand visit still use the full template. Proposal `template` is named "Signature" in brands.js, and the sheet title is "Start from a template".

## 26. Changes in v3.4 (2026-10-06, fourth round)

Test: `s202`.
- **Mirror.** `backdrops.js patternFill` honours `mirrorY: false` (sideways flips only). The cogent painter passes `{ mirror: a.mirror, mirrorY: false }`, and `COGENT_DEFAULTS.mirror = false`. The switch is `#tg-cog-mirror` in `.cog-pattern`.
- **Edges.** `#seg-cog-edge` (Round / Rough edges) copies the cogent adjust keys (plus `cground`, `ox`, `oy`) to the other id, then clicks its gallery thumb, so the protected pick path runs.
- **Picker.** CSS hides `#picker-add` on cogent, the upload row on colour, camera and colours on pattern, and colours on image.
- **Spelling.** A script changed "colour" → "color" in user-facing string literals and HTML text/attributes only. Ids, classes, keys and data-k values (`colour`) are unchanged.
- **Name.** The app is called Media Brand Kit (title, home-screen name, Home heading).
- **Phone.** `#btn-export` is transparent with a line border; `.fs-add-section` is filled with `--active` and a soft glow.

## 27. Figma (2026-10-06): the "Backdrop Creator" file is up to date

File: figma.com/design/0amKYViLpkdmw2ZL93G7FN. Nothing was deleted.
- **Pages:**
  - **App · Media Brand Kit**: the screens section. It gains a v3.1 – v3.4 row at y ≈ 36000, and the v3.0 row is marked as superseded where it differs.
  - **Components**: the library (moved out of the section) plus the frame *v3.1 – v3.4 · additions*.
  - **Brand assets**: 237 artwork and export frames — backgrounds, Powered-by badges, logos, cogent images.
  - **Archive — review, then delete**: 13 old explorations (v1 mockup, screenshots, loose groups). Delete it once you have checked it.
- **Variables:**
  - *Media Brand Kit / UI* (54; modes Default / MoshPit / T4R Labs). It matches styles.css; added `browser-bar`, `accent*`, `active-tint`, `popover`, `menu`, `sheet-*`, `scrim`, `outline`, `focus`, `heading`, `placeholder`, `error`, `halo`. T4R panels are white.
  - *Media Brand Kit / Brand colors* (28): every brand solid plus the cogent grounds.
  - *Media Brand Kit / Size* (9): radii, pad, the 14 px tabs-to-gallery gap, touch sizes.
- **New components:**
  - Background tabs (4)
  - Cogent settings
  - Cogent (Who × Edge, 8, from the brand-asset images)
  - Save heart (4)
  - Export (2)
  - + Add (2)
  - Selection ✕
  - Save project popup
  - ☰ Menu v3.2
  - Upload tile · Pattern
  - Template card · clean
  - Phone top bar (with MoshPit and T4R mode instances)
  - Background color popup (Custom)
- **Screens (editable instances, one variable mode per brand):**
  - Desktop: Cogents (MoshPit, Rough edges + Mirror), Pattern tab + Upload a pattern, ☰ menu, Save project, Start from a template, CTA box + Custom background.
  - Phone: Pattern sheet, Cogents sheet, top bar × 3 brands.

## 28. Changes in v3.5 (2026-10-06): bubble inset + speed

- **Bubble inset.** `BUBBLE_INSET = 0.8` (render.js export, mirrored in backdrops.js).
  - `cogentArt`: the art canvas is the art's own size, and the bubble canvas is `aside / 0.8` with the art centred. A sticker's rim samples moved to [0.70, 0.76] to match the old points.
  - `shapedBadgeImage`: the portrait square is drawn at 0.8 around the bubble centre.
- **Layer cache.** `backdrops.js paintBackdrop` keeps up to 3 layers, keyed on id, kind, W×H, source image identity and width (WeakMap ids), base and adjust (`bd.adjust` + `adjustLookup`).
  - Not cached: solid, gradient, video, images still loading, sizes over 4096².
  - A layer is built only on the second paint with the same key, so slider drags (a new key every frame) paint directly.
- **Panel throttle.** `paint(arg)`: frames from the loop (`tick` calls `paint()` while `looping`, and `mediaTick` passes `LOOP_FRAME`) skip the DOM syncs unless `uiDirty` (set by a capture listener on input, change, click, pointerup and keydown) or 250 ms have passed. `draw()` → rAF → `paint(timestamp)` always syncs. Protected `tick`, `draw` and `sizeCanvas` are untouched.
- **Next big lever (not done).** The preview canvas renders at full export size (1080×1920) every frame. Rendering it at screen size would cut its pixels 3–5×. That touches the protected `sizeCanvas` and every hit test, so it needs its own pass.

## 29. Changes in v3.6 (2026-10-06): two-height phone sheet

`wireSectionSheet` drag logic. The functions are `dockedSheetTop()`, which caches the docked top while the sheet is tall because the preview is covered then, `expandedSheetTop()`, `placeSectionSheet()` and `setSheetExpanded(on)`. The classes are `.is-tall` on the sheet and `html.has-tall-sheet`; `top` animates via CSS. `closeSectionSheet` resets the sheet to docked. Test: `s203`.

**Print note** (Marco asked about socks): the background PNG saves at 2× the format, so a Reel is 2160 × 3840. That is 7.2 × 12.8 in at 300 dpi, or 14.4 × 25.6 in at 150 dpi. Brand pattern art is drawn from @3x tiles and cogents from 1440 px files. A dedicated "print / seamless tile" export would be the right next step.

## 30. Changes in v3.7 (2026-10-06): projects

- **Boot.** `if (SHOW_HOME) openHome();`. `IN_EDITOR_KEY` is still written but no longer read at boot.
- **Cards.** `homeTile` returns `div.home-card[role=listitem]` with the tile button plus `projectActions(it, {exportable})`. Home cards get ✕ only; the Show all cards (size md) get Export + ✕.
- **Menu rows.** `burgerRow` returns `div.burger-item` with the row button and the actions. The menu shows `recent.slice(0, 3)`; the `.burger-all` link calls `openHomeAll('recent')`.
- **`deleteProject(it)`**, per kind, each with Undo in the toast:
  - saved / auto: splice from the templates list.
  - brand: `delete state.designs[b]`.
  - current: snapshot, then apply the brand template (pristine, not pushed to Recent).
- **`exportProject(it)`**: opens the project (`openHomeItem`) unless it is the current one, then clicks `#btn-export`.
- **`refreshLists()`** redraws Home, Show all and ☰ when they are open.
- **Tests.** New `s204`. s193 now expects Home after a reload; s200 has the new menu order and uses `.burger-all`.
- **Later.** Print export (high-res tile / custom size).

## 31. Changes in v3.8 (2026-10-06): brand-pattern Mirror, phone export delivery

- **Mirror.** In backdrops.js, `tile` painter + `adjust.mirror` draws the tile image manually, column by column, flipping odd columns horizontally. The switch is `#tg-tile-mirror` in `#tile-controls`, wired in `wireCogent` and synced in `syncImageControls`. The layer cache key includes `adjust`.
- **Delivery.**
  - `downloadBlob`'s binding is wrapped by `deliverBlob`; the body is unchanged and protect.py passes.
  - "Fresh" means a trusted pointerup / click / keydown / touchend less than 1 s ago in Safari or 4.5 s elsewhere, and `navigator.userActivation.isActive` where it exists.
  - When the file isn't fresh, on a coarse pointer or in Safari, the files queue (0.9 s, so the cover joins the video) into `#ready-bar`.
  - Save calls `navigator.share({files})` when `canShare`, otherwise downloads each. AbortError keeps the files offered.
- **Checked in Chromium (phone emulation).** The reel records, with its clip moving, at full length. The real iPhone path (Safari MediaRecorder MP4, share sheet) needs a check on a device.
- **Test.** `s205`.

## 32. Changes in v3.9 (2026-10-06)

- **Format button.** `#tb-format-label .fmt-ratio { display: none }`; the options still read "Reel · 9:16".
- **Library mirror.** `#picker-mirror` / `#tg-picker-mirror` in the picker shows only on `#picker[data-k=pattern]` when the background in use is a brand tile or an upload used as a pattern. `syncPickerMirror()` runs at the start of `syncUploadLabel()`. It writes the same `adjust.mirror` as the panel switches.
- **Test.** `s206`.

## 33. Changes in v3.10 (2026-10-06): brand patterns from single motifs

- **Why.** The brand tile PNGs (`assets/pattern-*.png`, `assets/moshpit/pattern-*`, `assets/t4r/pattern-*`) are pre-composed repeat blocks with motifs cut at the tile edges. Mirroring or scaling a block halves motifs (e.g. doubled half-skulls), so the Pattern tab did not behave like the Cogents tab.
- **Motifs.** Exported from the Figma pattern-fill sources into `assets/motifs/*.png` (1024 px on the long side, transparent): Ask Ruth `askruth-logo-plum` (1:2), `askruth-logo-pink` (1:47), `askruth-logo-cluster` (1:98, the 2×2 two-colorway block Lilac is designed from); MoshPit `moshpit-skull` (72:17162), `moshpit-logo` (72:17171); T4R `t4r-confetti` (26:958, the designed 4-mark cluster), `t4r-logo-light` (26:1003), `t4r-logo-dark` (26:1015). Copies sit in Figma › Brand assets › *Pattern motifs (app)*.
- **Spec.** Each tile backdrop in `brands.js` has `motif: { asset, tile, gx, gy, row, ground, over }`, taken from the Figma PATTERN paint: `tile = sourceWidth × scalingFactor / 1074`, `gx/gy = spacing` (a share of the tile, same unit as `patternFill`), `row = 0.5` for HORIZONTAL_HEXAGONAL and `0` for RECTANGULAR, `ground` = the frame's base fill, `over = [color, opacity]` = the solid fill Figma lays on top. Verified by autocorrelation of the Figma renders: periods match within 2 px.
- **Painter.** `backdrops.js` `motifPattern()` (called from the `tile` painter once the motif image is loaded; the old tile PNG is the fallback while it loads): ground, then `patternFill(motif, {tile: motif.tile × tileScale(bd), gx/gy/row from adjust or the motif, mirror, mirrorY:false})`, then the wash. `gapOf` now floors at −0.5 (Confetti overlaps at −11%); `patternFill` accepts tiles down to 0.01. `layerKey` keys a motif pattern on the motif image. `motifDefaults(bd)` is exported for the panel.
- **Panel.** `#tile-controls`: Size (`#tile-scale`, `adjust.zoom`), Spacing (`.adj-gap`, min −0.3) and Offset rows (`.adj-row`) using the shared handlers, Mirror (`#tg-tile-mirror`). `syncBgInspector` shows the motif defaults until a value is set. `hiKeys` no longer fetches the @3x tile master for a motif pattern.
- **Saved designs.** Old `adjust.zoom` and `adjust.mirror` keep working (zoom scales the motif).
- **Test.** `s207`.

## 34. Changes in v3.11 (2026-10-09)

- **Text style labels.** `#seg-tone` buttons are now `data-t="dark"` → "Light" and `data-t="light"` → "Dark" (then Custom), so the names describe the look rather than the type colour. The per-text-box segments in `renderBlocks` use the same mapping. `textTone` values, defaults and saved designs are unchanged; `syncSegments('#seg-tone', 't', 'textTone')` still selects by `data-t`.
- **Phone bar grouping.** New `placePhoneAdd()` / `wirePhoneBarGroup()` (called after `wireSimpleEditor()`): on `phoneMQ` the `#fs-add-section` node moves into `.fs-actions` before `#fs-preview`; on desktop it goes back to the end of `.fs-nav`. Listeners stay on the node. CSS (v3.11 block at the end of styles.css): `.fs-actions { margin-left: auto; gap: 8px }`, `#fs-surface { margin-left: 8px }` → 10 px between + and Preview, 16 px between Preview and Light/Dark; the group's right edge lines up with the top bar's share button.
- **Test.** New `s208` (12 checks): order and right alignment at 390 px, section name left, spacing, same row, the Add menu opens on screen, + hidden in Preview and back after, no sideways scroll, + back in `.fs-nav` on desktop, the three labels, and Light → `textTone: dark` / Dark → `textTone: light` with the right button selected. `s191`, `s173` and `s181` give the same results as on v3.10. The v3.1+ scripts (`s193`–`s207`) weren't in this session; run them from that chat's dev kit.
- **Figma.** *Phone top bar* and *Full-screen bar · Mode=Phone*: + moved next to Preview, spacer before the group, a 6 px gap before Light / dark. Text style selection swapped wherever a Light / Dark / Custom segment row shows (the *More text* component and 44 screens on *App · Media Brand Kit*), so a light-type screen now shows **Dark** selected.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 35. Changes in v3.12 (2026-10-09)

- **`styleGate(id, label, isCustom, toBrand)`** (before `renderButtons`) builds a "Style: Brand · Custom" row and a `.custom-box`. The box is open while the item has its own look (`isCustom()`) or the user picked Custom this session (`customOpen` Set, not saved). Brand on a custom item calls `toBrand()`, which does `pushUndo` and resets the look.
  - Buttons: `btnIsCustom(look)` (any of ink, fill, stroke, strokeW, radius set). The box holds the Text / Button / Stroke rows, the Stroke and Corners sliders and Reset; Scale stays outside. Brand keeps `scale`.
  - Main lower badge: `wireBadgeParts` moves the `.lower-row`s, the Stroke switch, `#lower-stroke-body` and `#lower-reset` into the box under `#lower-text`; `syncBadgeParts` re-syncs it (`mainLowerGate`). Extra badges' lower parts get the same in `renderBadgeItems`. `lowerIsCustom()` compares ink, fill, stroke, strokeOn and strokeW with `LOWER_DEFAULT()`. Brand keeps on, text and scale.
- **Spacing (phone, styles.css v3.12 block):** swatch gap 12 px, label-to-dots 14 px, 16 px between rows, sliders, switches and Reset.
- **Badge layout fix:** `#bp-upper > .bp-body, #bp-lower > .bp-body { grid-column: 1 / -1 }`. The two-column switch row made the bodies sit in column 1.
- **Test:** new `s209` (15 checks). `s208` 12/12; `s191` and `s173` match v3.10 (s191's one failure, the desktop view menu, fails the same way on v3.10 since v3.2 moved it to ☰).
- **Figma:** *Button card* is now a set, Style = Brand / Custom (existing instances are Custom); rows 16 px apart, dots 12 px. The *Badge in three parts* screen has the Style row with the lower badge's colors grouped under Custom.
- Protected functions 39/39 unchanged; `store.js` unchanged.
- **Dev kit:** `media-brand-kit-devkit.zip` (README inside): harness, `s131`–`s192`, `s208`, `s209`, `protect.py` and `orig/`. Paths are relative now (site in `site/` beside `tests/`, or `SITE=`). `s183`–`s190` and `s193`–`s207` aren't in it; add them from the earlier kits.

## 36. Changes in v3.13 (2026-10-09)

- **✕ while typing (desktop).** `selDeleteAction()` no longer bails out while `editor` is open; `runSelDelete()` closes the editor (keeping the text) first; `openEditor()` re-places the ✕.
- **Value up to 3 min.** `VALUE_SECS_MAX = 180`, `secsMax(sc)` (Value 180, others `SECS_MAX` 30). Used by the trim and roll handles, `setSecs`, `setSecsExact`, the Duration menu (its note says "up to 3 min"), fit-to-sound (`fitTimelineToMusic`, the beat snap) and the "longer than the screens" note. A single-section film still caps at 30 s unless that section is a Value.
- **Render hooks (render.js).** `export const renderHooks = { frame, afterBackground }`. `render()` asks `renderHooks.frame(ctx, W, H, state, opts, renderFrame)` first; a non-null return is the layout. The old body is `renderFrame()`, which calls `renderHooks.afterBackground` right after the Dim wash. Nothing protected changed: `exportVideo` still calls `render(g, …)`.
- **Transitions (app.js, v3.13 block).** `sc.trans = { type: 'fade' | 'slide' | 'zoom', secs }` on the section a cut leads into (null = Cut). `transitionFrame()` runs only for the preview canvas or while `recording`, when `filmClock()` (the export's `seqClock`, or `playT` while playing) is inside `[sceneStart(k), + secs)`. The outgoing section is a JSON copy of `state` taken at the switch (`snapPrev()`, called in the playback step and in `exportScenesVideo`'s clock); both sections are drawn live into two buffers and blended (ease in-out): Fade = alpha, Slide = push left, Zoom = the old one grows 20 % and fades. `startPlayback` keeps a transition menu open; the playback step calls `draw()` each frame while `motionAt(t)`.
  - Known limit: if the outgoing and incoming sections use the same background with different framing, the outgoing one is drawn with the incoming framing for those frames (the framing store is shared).
- **Overlay track.** `state.overlays` (in `DESIGN_KEYS`; designs without it get `[]` when opened, and starter designs reset it). `drawOverlays()` (afterBackground hook): only on the preview canvas or while recording, at `filmClock()` or `playT`; Full frame = cover crop, Window = rounded rect at `x, y` (centre, share of the frame), `w` (share of the width); fade in/out when the clock runs (full strength while editing), `opacity`. `syncOverlayVideo()` seeks the element to `in + local` when it drifts > 0.3 s while playing / recording. A rAF loop in `wireMotion()` repaints while an overlay video is under the playhead and nothing else loops. Uploads go through `addUpload(file, 'inset')`; removing waits 9 s, then deletes the file if nothing else (overlay, card, Undo) uses it.
  - UI: `#tl-overlay` row (`renderOverlayLane`, `overlayClipEl` with pointer-capture drag / right-edge trim, arrows ±0.1 s, Delete), `openOverlayMenu` (clip menu code −12), + Add → *Overlay clip* (`pickOverlayFile`). Cut marks: `renderCutMarks(at)` in `renderScenes`, `openTransitionMenu` (code −13 − i). CSS v3.13 block: `--ov-h` 30 px; on phones the row collapses until there is a clip (`.timeline.has-overlays`); carousels hide it.
  - Single-section exports also run a clock (`seqClock`) so overlays play at their times.
- **Tests.** New `s210` (22: overlay row, cut marks, Value 180 s / Hook 30 s, + Add → Overlay clip, drawn on the preview, drag + Undo, menu → Window, reload, Cut · Fade · Slide · Zoom, blended frames drawn, Use on every cut, editing never blends) and `s211` (exports a 6 s film and decodes frames with ffmpeg: mid-Fade colour between Hook and Value, mid-Slide split, overlay window in Hook and CTA). `s152`, `s154`, `s178` now open Custom before picking lower-badge colours (the v3.12 change); their results match v3.10. `s191`, `s173`, `s170`, `s182`, `s208`, `s209` unchanged.
- **Figma.** Components page: frame *v3.11 – v3.13 · additions* with **Cut mark** (Type = Cut / Fade / Slide / Zoom), **Transition menu**, **Overlay clip** (Mode = Full frame / Window), **Overlay add**, **Overlay menu**. App page: new row at y 37500, *Desktop · v3.13 · Transitions + overlay track*.
- **Not done / next.** Overlay clips' own sound (the export records only the main clip's audio — protected `exportVideo`); overlay clips on carousels; transitions in the cover image; a video that isn't long enough for its overlay length loops.
- Protected functions 39/39 unchanged; `store.js` unchanged.

## 37. Changes in v3.14 (2026-10-09)

- **Sheet ✕ centred.** `.sheet-close` was `display: inline-grid`; the "×" text (font-size 0) still took a second grid row, so the drawn cross (`::before`) sat 4–5 px above centre on every sheet. Now `inline-flex`, centred. Measured: offset 0 / 0 px at 390 and 1440 wide (was 0 / −4 to −5).
- **End-to-end test `s212` (41 checks, all pass):**
  - Video project export: length matches the timeline, 1080 × 1920, Hook and CTA frames differ; the cover JPG is 1080 × 1920 and not blank.
  - Carousel: PNG, JPG and Large 2× (2160 × 3840) — one file per slide, none blank.
  - Every brand × every format (4:5, 1:1, 16:9, 9:16): one PNG per section at the right size.
  - Items as separate PNGs: the .zip holds transparent (RGBA) PNGs.
  - One film with a video background, a sound, an overlay window and Fade / Slide transitions: exports at the right length, with an audio track, and the background moves.
  - Save project → reload → listed under ☰ → Show all → Saved; overlay and transitions kept.
  - Phone (390 px): the video reaches the user (download or the Save bar) at the right length.
- **Regression on this build:** `s208` 12/12, `s209` 15/15, `s210` 22/22, `s211` 4/4, `s191` 84 (its one FAIL, the desktop view menu, has failed since v3.2 moved it to ☰), `s192`, `s173`, `s170`, `s178`, `s152` as on v3.10. Protected functions 39/39; `store.js` unchanged.
- **Still only checkable on a device:** iPhone Safari's MP4 recording and share sheet, and two videos decoding at once (background + overlay) on a phone.

## 38. Changes in v3.15 (2026-10-09)

- **render.js:** `renderHooks.afterAll` runs after drawings, before the selection outline.
- **Overlay kinds** (`ovKind(o)`: `media` default, `text`, `badge`, `cogent`, `drawing`). Shared: `start, dur, fade, opacity, x, y, scale`. Text: `h1, body, style` (`styleOf(state)` when made); badge: `badge, powered`; cogent: `who, sticker` (cast from the brand's cogent backdrops, `cogentCast()`; image via assets.js `img`, imported as `assetImg`); drawing: `d` (the drawing minus x/y).
  - `ovMini(o)`: `state` with only that item (blocks / badges / drawings), `visibility: 'none'` and no badge or card, the block's own style switching its text on. `drawItemOverlays()` (afterAll) draws text / badge / drawing with `renderItem(buf, …, 'xb:ov' | 'eb:ov' | 'dr:ov')` into `transBuf(2)` and blends it; cogents are drawn directly. Media stay in `drawOverlays()` (afterBackground).
  - `overlayCanvasRect(o)` (layout of the mini state, or the media / cogent box), `overlayAt(p)`: items first, media only where `hit()` and `drawingAt()` find nothing.
  - Adding: `openOverlayAddMenu()` (clip menu −14), `addItemOverlay(kind)`, `newOverlayBase()` (at the playhead, 2 s). Drawing: `ovDrawWaiting` → `finishDraw()` hands the new drawing to `drawingToOverlay()` (it leaves `state.drawings`).
- **Selecting / editing:** `selected = 'ov:<id>'`; `tabOf` → `overlay`, `groupOf` → `#group-overlay` (new group in index.html). `selectOverlay(id)` moves the playhead into the clip if needed and opens the group; `renderOverlayGroup()` builds its controls per kind. `fsQuickItems` / `fsElementRect` know `ov:` → the ✕ and Delete remove it (`removeOverlay`, Undo). The old popup editor (`openOverlayMenu`) is gone; the timeline row and the preview open the group.
- **On the preview:** `wireOverlayCanvas()`, a capture `pointerdown` on the canvas (before the protected handlers; `stopImmediatePropagation`), drag moves `x / y` (window media too), a release selects; the click after it is swallowed (`swallowClickUntil`).
- **Pinch zoom:** `wirePinchZoom()` (registered before the overlay handler so it sees every finger). Two touch pointers → `pinch {s, tx, ty}` → CSS `transform` on `#preview`; the first finger's gesture gets a synthetic `pointercancel`; `toCanvas()` (protected) reads the transformed box, so hit tests stay right. ctrl / ⌘ + wheel zooms around the pointer. `#zoom-reset` chip; two-finger double tap or a resize resets. `html.is-zoomed #canvas-wrap { overflow: hidden }`.
- **Tests:** new `s213` (30): the five kinds, the panel, ✕ + Undo, drag + Undo, timeline select, badge choice, Round / Sticker, drawing → clip, reload, an export where a text clip shows only in its time, the phone sheet + ✕ from a tap, pinch (CDP touch) incl. one starting on a clip, 1:1, ctrl + wheel. `s210`, `s211`, `s212` now pick *Overlay clip → Video or picture* and edit in the panel (old copies in `pre_v30/*_pre315.py`). All pass; `s191` 84 + its known FAIL; `s173`, `s178`, `s152` as before. Protected 39/39; `store.js` unchanged.
- **Figma:** Components › *v3.11 – v3.15 · additions*: **Overlay clip · kinds** menu, **Zoom chip**, **Overlay clip** gains Mode = Item (violet), *Overlay menu* is now **Overlay panel** (Starts at, Length). App page: *Mobile · v3.15 · Overlay text clip tapped — sheet + ✕*.
- **Limits:** a text clip's words are edited in its panel, not on the canvas; overlay items can't be multi-selected or tidied; very long single words at Size > 1.6 can run past the text box (like the section's own text).

## 39. Changes in v3.16 (2026-10-09)

- The overlay row's add button (`.ov-add`, both the empty-row label and the small + after the last clip) now calls `openOverlayAddMenu(add)` (clip menu −14; tapping it again closes it) instead of `pickOverlayFile()`. Video or picture in that menu still opens the file picker.
- Test: new `s214` (6). `s210` 22/22, `s213` 30/30. Protected 39/39.
- Figma: *Overlay add* component description updated (opens *Overlay clip · kinds*).

## 40. Changes in v3.17 (2026-10-09)

- Several overlay clips were already possible, but on one row a clip at the same time covered the other. `overlayLanes(list)` packs clips into rows (each on the first row free at its start); `renderOverlayLane()` sets each clip's `top` and `--ov-stack` on `#timeline` (rows × 30 px + 4 px gaps). CSS: `.tl-inner` height, `.tl-audio` top and `.tl-overlay` height use `var(--ov-stack, var(--ov-h))`. Rows are worked out on every render, not stored.
- `placeClearOfOverlays(o)` (in `addItemOverlay`): a new text / badge / cogent tries y offsets (±0.14, ±0.28, …) until it doesn't touch another item clip showing at the same time.
- Drawing order is still the order clips were added (the last on top).
- Test: new `s215` (18, desktop + phone): three clips at once on three rows, each tappable, all drawn, clear of each other on the preview, the sound row below, no sideways scroll, rows close up when dragged apart, the phone preview keeps its size. `s210`, `s212`, `s213`, `s214` pass. Protected 39/39.

## 41. Changes in v3.18 (2026-10-09)

- `renderOverlayLane()`: the add button's icon is a plus (was a video camera) and its label reads *Overlay clip*; with clips it stays the icon-only + after the last clip. CSS: `.tl-overlay .ov-add svg` stroke 2.2, round caps.
- Figma: the *Overlay add* component has the plus and the new label.
- Started, then set aside on Marco's word (not in this build, kept in the work folder): the add buttons in a bar under the tracks, new clips placed after the last one, and a picker window for Badge / Cogent / Text / Drawing with thumbnails.
- Tests: `s210`, `s213`, `s214`, `s215` pass. Protected 39/39.

## 42. Changes in v3.19 (2026-10-09)

- `renderAudioLane()`: *Add music or sound* uses the plus icon (`.tl-audio .audio-add svg` stroke 2.2).
- `html[data-surface="light"] .panel { background: var(--ui-panel-solid) }`. Ask Ruth's `--ui-panel` is `rgba(59, 0, 58, .55)`; over the light page (`--surface-alt`) it composited to about `#936292`, and the panel's light text dropped to 2.1:1 (slider labels) / 4:1 (headings). Solid `#330132`: 7.6:1 / 15:1. MoshPit (solid `#30302e`) and T4R (off-white) were already fine; measured the same in dark and light. The phone sheet was already solid.
- Figma: *Desktop · Ask Ruth · Solid Blush · light preview background* — the panel fill is solid plum.
- Tests: `s213`, `s215` pass; `s191` 84 + its known FAIL. Protected 39/39.

## 43. Changes in v3.20 (2026-10-09)

- **Overlay transitions.** New clip fields `tin` / `tout`: `cut | fade | slide | zoom`. The length is still `o.fade`. `ovTin()` / `ovTout()` read a clip saved without the fields as `fade` when `fade > 0`, else `cut`, so older projects look the same. `ovMotion(o, local, clock, W, H, full)` returns `{a, dx, dy, s}`, eased with a cubic ease-out:
  - Slide: a full-frame media clip moves across the whole width. Anything smaller moves 12 % of the height and fades.
  - Zoom: full frame goes from 1.18 to 1. Anything else goes from 0.55 to 1, fading.
  - While editing (no clock), the clip is at rest.
  - `drawOverlays` (media) and `drawItemOverlays` (items) translate and scale around the clip's own rect. `ovAlpha()` now goes through `ovMotion`.
  - Panel (`renderOverlayGroup`): segments *In* and *Out* (`OV_TRANS`), plus a *Transition* slider (hidden when both are Cut). It replaces the old *Fade* slider.
  - `previewOverlayTrans()` plays the clip's first or last moments once after a choice.
  - Debug: `__studio.ovMotion(id, local, full)`.
- **Cogent overlay Look:** the labels are *Round · Rough edges*. The value is still `o.sticker`, so the asset is still `…-sticker`.
- **Stage icon contrast.**
  - `html[data-surface="light"] .surface-toggle`: every round stage button (background toggle, full screen, panel) is a solid `--surface-toggle-bg` disc with a `--surface-ink` icon, stroke 2.2.
  - The pressed panel toggle adds a 2 px gap and a ring in the disc colour. The brand accent ring was used first, but T4R's navy accent vanished on its dark page.
  - Measured with the icon-contrast script for 3 brands × dark/light × 1440/390. Every icon is ≥ 3:1; the worst before was T4R's pressed panel toggle at 1.03:1.
  - The earlier low readings for T4R's heart and Export were the script sampling mid-transition after a brand switch. They measure fine.
- **Preview progress.** `syncPreviewProgress(t)` is called from `movePlayhead`, `setFsMode` and `fsStep`.
  - It creates `#pv-progress` inside `#canvas-wrap`, placed from `canvas.offset*` along the canvas's bottom edge.
  - A video gets one segment (`playT / timelineSecs()`). A carousel gets one segment per slide: playing, each fills over its `playSecs`; paused, slides up to the current one are full.
  - Only in `fsMode === 'preview'`.
  - CSS `.pv-progress`: 4 px, dark translucent track, white fill, drop shadow, so it reads on light and dark designs.
- **Undo toast on top.** `showToast()` centres `#undo-toast` vertically on `.topbar` (`style.top` from the bar's rect). CSS: `.undo-toast { bottom: auto; max-width: calc(100vw - 24px); white-space: normal }`.
- **Overlay rows capped at 3.** `OV_ROWS_MAX = 3`.
  - `--ov-stack` covers at most 3 rows (98 px). `.tl-overlay.is-scrolling` scrolls vertically, with an `.ov-spacer` for the full height.
  - The + is pinned to `scrollTop` on scroll. `.more-below` fades the bottom edge.
  - `scrollTop` is kept across re-renders, and a selected `ov:` clip on a hidden row scrolls into view.
- **Figma (Components page, frame *v3.11 – v3.15*):** the *Overlay panel* now has *In* / *Out* segment rows and a *Transition* slider (*Fade* is gone). *Overlay clip · kinds* reads *Rough edges*. There is a new component set *Preview progress* (Kind = Video / Carousel), and a v3.20 note covering the toast position, the three-row cap and the stage discs.
- **Tests:** new `s216` passes 26/26. `s213` was patched for the label.
  - Also passing: `s208`–`s215`, and `s191` at 84 plus its known FAIL.
  - `s173` stops at "Remove badge 3" in both v3.19 and v3.20, so the test is stale, not a regression.
  - Protected 39/39.

## 44. Changes in v3.21 (2026-10-09)

- **Bug: a Hook video in every section.** The cause was in `commitScene()`. On the Hook it writes `state.sharedBg = state.backdrop`, and every section with `sc.bg == null` shows `sharedBg`. A video picked on the Hook therefore played in Value too.
  - New state key `sharedStill` (in `DESIGN_KEYS` and the defaults) holds the last still shared background.
  - New helpers: `isVideoBg(id)` (via `mediaFor(id).media`), `sharedStillBg()` (falls back to the brand's `defaultBackdrop`), `sharedFor()` (the still when `sharedBg` is a video) and `isSharedBg()`.
  - `loadScene`, `filmSig`, `moveScene` and the non-base branch of `commitScene` resolve through `sharedFor()`.
  - A video picked on a non-base section is stored as that section's own `sc.bg`. Stills are shared exactly as before.
- **New project.**
  - `newProjectHere()` calls `createProject(activeBrand().id, video|carousel)`, then shows a toast pointing to ☰ Recent.
  - Phone: the last item in `addItems()` (after a separator), only when `isPhone()`.
  - Desktop: `#btn-new-proj` (class `save-heart new-proj`, a page-with-plus icon) before the heart. It is hidden at ≤ 820 px.
  - Removed from `renderBurger()`.
- **Draw-on.**
  - `render.js`: `drawDrawing(ctx, d, W, H, prog = 1)` draws `prog` of the drawing's total ink, stroke by stroke (`strokeLen`, `partStroke`).
    - Pen and highlighter strokes are cut along their path.
    - Lines and arrows grow from their start, with the head at the tip.
    - Ellipses sweep from 12 o'clock.
  - A new hook, `renderHooks.drawingProgress(ctx, d, state)`, is used only in `renderFrame` for section drawings. Item PNGs and overlay drawings are not affected.
  - `app.js` `drawingProgress()` applies only to the live state on the preview canvas or while recording, with a film clock running.
  - `drawOnWindow(k)` sets the timing: start = the section's transition length + 0.15 s; duration = 35 % of the section, clamped to 0.5–1.4 s; cosine-eased.
  - `motionAt()` keeps repainting during that window.
  - The drawing's `anim === false` turns it off. The switch `#draw-anim` sits in `#group-draw` and is hidden for carousels; turning it on plays the section's start once.
- **Phone sheet Done.** `#section-sheet-done` sits in `#section-sheet-head`. The head doesn't scroll, so the button stays put. On phones the head is 50 px tall.
- **Panel hidden.** At ≥ 821 px with `html.panel-collapsed:not(.is-fs)`, the three `.surface-toggle` buttons are `position: fixed; right: 20px` (Export's edge), 22 / 66 / 110 px under `--topbar-h`. With `.panel-peek` they sit left of the floating panel.
- **View menu.** `viewItems()` drops *Exit full screen* and its separator in full screen.
- **Preview dim.** `html.is-fs-preview .stage { box-shadow: inset 0 0 0 100vmax rgba(0,0,0,.3) }` paints over the stage background and under the canvas.
- **Removed.** `#neutral-hint { display: none }`. The element stays for now.
- **Tests.**
  - New `s217` passes 29/29.
  - `s191` now treats "neutral" as the View group showing with the hint hidden; it gets 84 plus its known FAIL. The old copy is `pre_v30/s191_pre321.py`.
  - `s152` 21, `s178` 18, and `s208`–`s216` all pass.
  - Protected 39/39.
- **Figma (Components page):** a new frame, *v3.20 – v3.21 · additions*, holds the *Top bar · New project* button, the *Phone sheet head · Done* and *Drawing · Draw it on in the video* components, and the v3.21 notes.
- **Overlay transitions:** asked again in this round. They shipped in v3.20 (§43), so nothing changed.

## 45. Changes in v3.22 (2026-10-09)

- **Overlay rows past three.** Marco couldn't reach the extra rows.
  - The scrolling worked, but nothing showed it. `.tl-overlay` is as wide as the whole film, so its scrollbar sat off screen. The default clips are identical. On touch, `.ov-clip { touch-action: none }` meant a swipe moved the clip.
  - Fix in `renderOverlayLane()`: an `#ov-rows` control in `#timeline` (now `position: relative`), at the right edge, placed in `pin()` from the lane's rect. It has ▲ / ▼ buttons (`scrollBy` one row, smooth, disabled at the ends), a track with a thumb, and an sr-only label reading "rows x–y of n". It is hidden at ≤ 3 rows and for carousels.
  - `.tl-overlay.is-scrolling .ov-clip { touch-action: pan-y }`: a vertical swipe scrolls natively; sideways still drags.
  - `scroll-snap-type: y proximity` with the clips as snap points.
  - The wheel already worked.
- **Drawing overlay draw-on.** `ovDrawProg(o, local, clock)` draws on from the clip's start, over 40 % of the clip (0.5–1.4 s), cosine-eased; it is 1 while editing.
  - `ovMini(o, prog)` passes `prog` on the mini drawing.
  - `render.js` `renderItem` ('dr') calls `drawDrawing(..., d.d.prog ?? 1)`.
  - Panel: *Draw on* segments (`o.anim === false` = Show at once).
- **Figma:** the *Overlay rows · ▲ ▼* component and a note sit in the *v3.20 – v3.21 · additions* frame.
- **Tests:**
  - New `s219` passes 17/17: rows control on desktop and phone, ▲ / ▼, wheel, CDP touch swipe (no clip moved), and drawing-overlay draw-on while playing.
  - `s210`, `s212`–`s218` pass.
  - Protected 39/39.

## 46. Changes in v3.23 (2026-10-09)

- **Stripes backgrounds.**
  - `brands.js`: `STRIPES_CLASSIC` and `stripeBackdrops(prefix, colours)` add `{prefix}stripes-classic` and `{prefix}stripes-brand` to each brand. Ids: `stripes-*`, `mp-stripes-*`, `t4r-stripes-*`. They use kind `tile` (so they are listed under Pattern and get the tile adjust) with `stripes: { colors, w: 1/7 }`. Tone is light and the badge is plum.
  - `backdrops.js`: the `tile` painter calls `stripesFill()` first. Vertical bars from the left edge, each `w` × the short side × `tileScale(bd)` (`adjust.zoom`, 0.25–2), with a 1 px overdraw. They are cached like any still background.
  - `app.js`:
    - `hiKeys()` treats stripes like a motif (no master to fetch).
    - `syncImageControls()` adds `.is-stripes` to `#tile-controls`; CSS hides Spacing, Offset rows and Mirror for it, and the Size label reads *Width*.
    - `syncPickerMirror()` excludes stripes.
  - Tone down is the usual overlay. A brand may start a background already toned down (MoshPit 55 %, T4R 30 %), as with its other patterns.
- **Figma:** the *Background · Stripes* component set (Kind = Classic / Brand) sits in the *v3.20 – v3.21 · additions* frame.
- **Tests:**
  - New `s220` passes 38/38: 3 brands × desktop and phone. Both are listed; Classic paints 7 bars; Width shows and Spacing / Offset / Mirror don't; 200 % halves the bars; Tone down; Brand colours; kept after reload.
  - `s212`, `s213`, `s216`, `s217` and `s219` pass.
  - `s191` has only its known FAIL.
  - Protected 39/39.

## 47. Changes in v3.24 (2026-10-10)

- **Bug: overlays didn't show while scrubbing.** When not playing, `seek(t)` only moved the playhead. The preview was redrawn only through `selectScene(k)` on a section change, and that ran before `playT` was restored, so it drew at the section's start.
  - Text, badge, cogent and drawing overlays (no running video, so no repaint loop) never appeared mid-section, and a clip could stay drawn after its window.
  - Fix: `seek()` ends with `draw()` when the design has overlay clips or drawings.
- **Tests:**
  - New `s221` passes 9/9: three badge overlays (1–3 s across Hook→Value, 4–6 s inside Value, 8.5–10 s in the CTA), checked by pixels at each clip's spot while the ruler is dragged, on desktop and phone.
  - The same test against v3.23 fails 4 checks: the clip inside Value never shows and the CTA clip stays on.
  - `s210`, `s212`, `s213`, `s215`–`s217`, `s219` and `s220` pass.
  - Protected 39/39.

## 48. Changes in v3.25 (2026-10-10)

- **Desktop stage buttons.** `#panel-toggle` and `#surface-toggle` swapped places at ≥ 821 px.
  - The panel toggle is at `top: 0`, full screen stays at 44, and the surface toggle is at 88.
  - With the panel collapsed (fixed at the right edge): +22 / +66 / +110 px under `--topbar-h`.
  - In `index.html` the buttons now come in visual order (panel, full screen, surface), so keyboard focus follows the screen.
  - Phone is unchanged.
- **Tests:** the icon-contrast script now targets `#surface-toggle` by id (it took the first `.surface-toggle`) and is still ≥ 3:1 everywhere. `s216` and `s217` pass; `s191` has only its known FAIL.
- **Figma:** a note sits in the *v3.20 – v3.21 · additions* frame.


## 49. v4.0 (2026-10-13): navigation, Adapt layout, export scopes, video import

Built from Marco's v4 brief, on top of v3.25.
- **Preserved first:**
  - git tag `baseline/v3.25-2026-10-13` (local only), and branch `backup/v3.25-2026-10-13` on GitHub
  - the Figma original page renamed *…v3.25 ORIGINAL (frozen 2026-10-13)*, with all work on the duplicate *…v4 (working, from v3.25)*
  - the Netlify deploy id in `ROLLBACK.md`
- **Rules held:** the 39 protected functions are byte-identical (protect.py 39/39). The only change to store.js is the 300 MB line.

**New modules (`js/v4/`):**
| File | What |
|---|---|
| `media.js` | Limits (`LIMITS`), `kindOf` / `withType` (typeless .mov / .mkv), `precheck`, `inspectVideo` (metadata, then one seeked frame and a thumbnail, with timeouts; all resources released), `storedSizes` (read-only IndexedDB), `idsInDesign` (exact references, not `adjust`). |
| `importer.js` | `installImportGuard`: a capture `change` on document plus a capture `drop` on window; checks the file, then hands it back to the protected input handler (`input.__v4pass`); a status tray; a journal (`…v4.importing` / `…v4.before-import`) for recovery. `installDecoderBudget`: pauses clips the open design doesn't use. `reportUnplayable`. `notice()`. |
| `guard.js` | `watchPersistence` (wraps `Storage.prototype.setItem` for STORAGE_KEY only, so the save status is true), `installFaultGuard` (own-code errors only → banner; canvas `contextlost`). |
| `adapt.js` | The pure planner: `unitsOf` / `joinUnits` (lossless), `chainsOf`, `plan(scenes, measure)`. |
| `pdf.js` | A JPEG-page PDF writer (`pdfOf`). |
| `model.js` | `describe(state)` (stable ids `section/key`, locked, generated, group) and `scopedChange` (one Undo, refuses locked targets), for a future design agent. |
| `backend.js` | The client for the not-yet-provisioned backend. `BACKEND` is null unless `<meta name="mbk-backend">` is set, and every call throws `BackendUnavailable`. |

**In app.js (v4 blocks at the end, plus small edits outside protected code):**
- `uploadsLoaded` / `pendingUpload()` and the guarded startup `commitScene`: the reload data-loss fix.
- `wireV4`, `wireV4Nav`: Present, the View button, hover (`hoverHit`), Add section, the hint, the save status and ⌘S.
- `syncFormatTab` (Size), `syncContentTabs`, `switchContent`, `SIZE_NAMES`.
- `renderBurger` (Projects only).
- `addItems`: no Section, except in desktop full screen.
- Locks: `sc.locks`, `sc.locked`, `isLocked`, `setLocked`, `lockedSnapshot` / `restoreLocked`; `tidySection` and `fitLayout` are wrappers around `…Raw`; drag is blocked through a capture pointermove; `itemMenuFor` is extended.
- Adapt: `contFrom`, `adaptMeasure` (sandboxed `layout()` per size), `planAdapt`, `fitSectionAt`, `applyAdapt`, `openAdapt`, `wireV4Adapt`.
- Export:
  - `exportPick` filters `enabledScenes()` while the sheet is open.
  - Scopes, the PDF, the .zip and Elements live in the sheet code.
  - `slides(type, scale, collect)` can collect files instead of downloading them.
  - `exportScenesVideo` maps `seqClock` to the film's time for subsets.
  - `selectedElementIds` / `selAtExport` remember the selection as Export is pressed.

**render.js:**
- `paintBackdrop` is in a try/catch; on failure it fills the base colour and calls `renderHooks.fault`.
- `opts.dragNow` and `opts.hoverRect` added.
- The selection stays visible while hovering.

**Diagnosis of "the app went blank on video import"** (reproduced in Chromium; the coworker's file wasn't available):
1. HEVC/ProRes/10-bit clips: sound played but there was no picture (videoWidth 0). They were accepted silently, the background was empty, and it stayed empty after a reload.
2. Every stored clip decoded and played at once, including clips from other designs. This is GPU/decoder pressure, so the canvas can go blank.
3. No time-out or feedback.
4. Separately, a real data-loss bug on reload (above).

Size alone wasn't the cause: three 185 MB clips imported fine.

**Tests (dev kit):**
| Script | Result | Covers |
|---|---|---|
| `s222` | 46/46 | import: codecs, sound-only, garbage, 5K, 461 MB, 3×185 MB sections, pause budget, Media / More media / typeless / drop, Cancel, journal |
| `s223` | 10/10 | reload keeps section videos (fails 6 checks on v3.25) |
| `s224` | 24/24 | Adapt: split / gather lossless, Undo, Hook/CTA untouched, locks, resize-safe, reload |
| `s225` | 31/31 | Export: scopes, video subset, This one, Carousel .zip / separate, PDF (pdfinfo, qpdf, render), Elements cut / in position, items .zip, phone |

Regression:
- `s208`–`s210` and `s213` pass, as do `s216` (patched: Add section button), `s217` (patched: Projects lists New project), `s220` and `s221`.
- `s212` passes 41/42. Its "frames differ" check is flaky in headless recording, and passed on reruns.
- `s191` passes 84 and has its known FAIL plus the same time-out as v3.25.
- Pre-v4 copies of the patched scripts are in `tests/pre_v4/`.

**Figma:**
- Components › *v4 · additions (2026-10-13)*: Content toggle, Size dropdown, Save status (Saved / Saving / Not saved), Top action (Projects / Save copy / Present), Add section (Section / Slide), Brand card (3 brands), Neutral hint v4, Import item (Processing / Saving / Added / Error / Timeout / Notice), Export scope (4), File type (Reel / Carousel), Adapt layout dialog, Canvas states (Hover / Selected / Locked).
- Working page, row at y 38880: Desktop · Editor (nothing selected), Start · Choose your brand, Video import, Export (Entire / Elements), Adapt layout preview, Hover and selected; Mobile · Editor, Video import, Export.
- Existing components were not edited.

**Open / next:**
- Backend (BACKEND.md §6): nothing provisioned.
- A deterministic frame-stepped render is phase 2.
- Group drag for `item.group` (the data model is ready; there's no UI to group yet).
- The 3:4 / 4:5 / 1:1 Adapt rules use the 6 % safe margin.
- Safari / Firefox / iOS are not tested here: only Chromium was available.
- The multi-select right after closing a clip menu with Esc didn't register in one test (it also happens on v3.25).
- PPTX is not offered.

## 50. Releases (Marco, 2026-10-13)

- **Release 1 = v4.0 (this branch, PR #1).** This release covers making the existing editor reliable and polished, including video reliability and the Release 1 backend work. It adds no AI services, Design Cogents, Smart Templates or AI dependencies. `js/v4/model.js` is plain data (stable ids, locks, scoped Undo), and nothing calls a model.
- **To publish:** a verified Netlify Deploy Preview, then Marco's explicit approval, then the merge to `main`. The rollback point is in ROLLBACK.md.
- **Video status for Release 1:** works in the browser within the stated limits (300 MB per clip, 4096 px, 10 min, 1.2 GB per design), tested in Chromium only. There is no backend yet (BACKEND.md), so there is no shared media and no server render. Don't call video editing production-ready on Safari or iPhone until it is checked on those devices.
- **Coordination:** the developer's own video-crash and backend work goes through GitHub too. Branch from `feature/v4-navigation-adapt-export`, or review PR #1 first; §49 lists every file it touches.
- **Release 2 (Smart Templates, Design Cogent, AI analysis)** starts only after Release 1 is approved:
  - a new branch from the approved production commit
  - its own Deploy Preview
  - features behind flags
  - an audit of brand assets and agent infrastructure, and a check of AI API access and costs, before any integration
