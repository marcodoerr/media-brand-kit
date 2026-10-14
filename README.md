# Media Brand Kit (formerly Backdrop Studio)

Pick a backdrop, set an H1 and body, drag the pieces where you want them, export a PNG.
No build step, no dependencies — plain HTML, CSS and ES modules.

## What's new in v3.25 (2026-10-10)

- **Desktop stage buttons reordered:** the panel button (hide / show the edit column) is now on top,
  next to the panel it controls; light / dark preview moved to the bottom. Full screen stays in the
  middle. Same order with the panel hidden (at the window's right edge). Phone unchanged.

## What's new in v3.24 (2026-10-10)

- **Fixed: overlays didn't show while dragging the playhead.** Dragging along the ruler only redrew the
  preview when it crossed into another section — and then at that section's start — so an overlay
  clip in the middle of a section never appeared, and one could stay up after its time. Each step of
  the drag now shows the frame at the playhead: every overlay comes and goes exactly in its time,
  across all sections (drawings too).

## What's new in v3.23 (2026-10-09)

- **Stripes backgrounds, in every brand** (Background → Pattern):
  - **Stripes Classic** — the TV colour bars (grey, yellow, cyan, green, magenta, red, blue);
  - **Stripes Brand** — the same bars in the brand's own colours (Ask Ruth: Blush, Pink, Orchid,
    Magenta, Plum, Cream · MoshPit: Paper, Turquoise, Teal, Pink, Charcoal, Sand · T4R: Mist, Cyan,
    Pink, Violet, Navy, White).
  - **Width** (25–200 %, seven bars across a reel at 100 %) and **Tone down**, like the other patterns;
    Spacing, Offset rows and Mirror don't apply to bars and stay hidden. Like any pattern, text on it
    gets its box. Saved with the project, exported like every background.

## What's new in v3.22 (2026-10-09)

- **More than three overlay rows: now you can actually get to them.** v3.20 scrolled the extra rows
  inside the overlay track, but nothing showed it: the track's own scrollbar sat at the far end of the
  film (off screen), new clips all read "Your words here", and on a phone a swipe on a clip moved the
  clip. Now, past three rows:
  - a small **▲ ▼** control sits at the timeline's right edge, level with the rows, with a thumb showing
    where you are (▲ / ▼ step one row; the end you're at is greyed out);
  - the mouse wheel over the rows scrolls them; on a phone a vertical swipe on the rows scrolls them
    (sideways still drags a clip); rows snap into place;
  - the bottom edge fades while there are rows below, and a selected or new clip scrolls into view.
- **Drawing overlay clips draw themselves on too** (v3.21 did it for drawings on a section): the line is
  drawn as if by hand from the clip's start, over 40 % of the clip (0.5–1.4 s). The clip's panel has
  **Draw on: Draw it on · Show at once**; In / Out transitions still apply on top.

## What's new in v3.21 (2026-10-09)

- **Fixed: a video background showed in every section.** A video picked as the Hook's background
  became the shared background, so Value (and any section without its own) played it too. A video
  now belongs to the section it was added to; the other sections keep the still background they had.
  Stills picked on the Hook are still shared as before. Older projects heal on open.
- **New project** moved: on a phone it is at the bottom of **+** (it left ☰); on a desktop it is a
  round button before the heart in the top bar. Either way it opens a new project in the brand that
  is open (a carousel if you are making one), and the project you were on stays in ☰ Recent projects.
- **Drawings draw themselves on in a video**, stroke by stroke in the order they were drawn, right
  after the section comes in (about a third of the section, 0.5–1.4 s). On by default; the drawing's
  panel has **Draw it on in the video** to switch it off (turning it on plays it once). Stills,
  carousels and the editor show the whole drawing.
- **Done** sits in the top-right corner of every phone sheet and stays there while the sheet scrolls.
  It keeps what you set and closes the sheet (as a tap outside or a swipe down does).
- **Panel hidden (desktop):** the round buttons (background, full screen, panel) move out to the
  window's right edge, in line with Export, instead of sitting mid-screen on wide windows.
- **Full screen's view menu** no longer has *Exit full screen* — the × in the bar closes it.
- **Preview (the eye)** tones the page behind the design down a little, on desktop and phone, so it
  reads as a different mode.
- The dashed *Tap anything to edit it* box at the top of the panel is gone.

## What's new in v3.20 (2026-10-09)

- **Overlay clips have transitions.** Each clip picks how it comes **In** and goes **Out**: Cut, Fade,
  Slide or Zoom, with one **Transition** length (0.1–1.5 s). A full-frame video or picture slides
  across the whole frame; a window, text, badge, cogent or drawing rises in (and on, out) as it fades.
  Zoom grows in and shrinks out. Picking one plays it once on the preview. Older clips with a fade
  keep fading both ways. It plays in the preview, the export and the saved project.
- **Cogent overlays:** the Look choice reads **Round · Rough edges** (was Round · Sticker).
- **Stage buttons on the other preview background** (all brands): the round buttons by the preview
  are solid discs in the opposite tone, like the background toggle, so the icons stay readable.
  T4R's pressed panel button was almost invisible on its dark page (1.03:1); it now shows a white disc
  with a ring. Every one of them measures 3:1 or better in all brands, light and dark, desktop and phone.
- **Preview shows its progress.** In Preview (the eye), a thin bar along the bottom of the canvas
  fills as the video plays; a carousel shows one segment per slide.
- **Undo sits on the top bar.** The "… added · Undo" note now shows over the top bar instead of at the
  bottom, so it no longer covers the panels, the timeline or the design.
- **Overlay rows: three at most.** With more than three clips at the same time, the overlay track
  shows three rows and scrolls up and down inside itself (the bottom edge fades while there is more).
  The + stays on the top visible row, and a selected or new clip scrolls into view.

## What's new in v3.19 (2026-10-09)

- **Add music or sound** shows a **+** (was a music note), like **+ Overlay clip** above it.
- **Ask Ruth with the light preview background:** the edit panel is solid plum again. It was 55 %
  see-through, so on the light page it turned a washed-out mauve and its light type was hard to
  read (slider labels at 2:1 contrast; now 7.6:1, headings 15:1).

## What's new in v3.18 (2026-10-09)

- The overlay row's add button shows a **+** and **Overlay clip** (it had a video icon, which read
  as "add a video" only); once there are clips it is just the **+** after the last one.

## What's new in v3.17 (2026-10-09)

- **Several overlay clips at the same time.** Clips that overlap in time each get their own row
  under the sections (the row closes up again when they're apart), so none hides another and each
  can be tapped. The sound row moves down under them.
- A new text, badge or cogent clip lands clear of the other clips showing at that moment.

## What's new in v3.16 (2026-10-09)

- **Add an overlay clip** on the overlay row (and the small + after the last clip) opens the same
  choice as + → Overlay clip — Video or picture, Text, Badge, Cogent, Drawing — instead of going
  straight to the file picker.

## What's new in v3.15 (2026-10-09)

- **Overlay clips of every kind.** + Add → **Overlay clip** → Video or picture, **Text**, **Badge**,
  **Cogent** (the brand's cast, Round or Rough edges) or **Drawing** (draw it; Done makes it a clip).
  Text, badges, cogents and drawings show over everything for their time and fade in and out;
  videos and pictures still sit under the section's items.
- **Edited like any item.** Tap an overlay clip on the preview (or on its row): its controls open
  in the panel on desktop and in the sheet on a phone — words, badge, who, Size, position,
  Starts at, Length, Fade, Opacity — with the **✕** on the preview to remove it (Undo brings it
  back). Drag it on the preview to move it.
- **Pinch to zoom the preview** (1×–4×, around the pinch, pan with two fingers); on a computer,
  ctrl / ⌘ + scroll or a trackpad pinch. A **“2.5× · 1:1”** chip puts it back (or tap twice with
  two fingers). Only the view zooms — taps and drags still land where they look, exports don't change.

## What's new in v3.14 (2026-10-09)

- The **✕** on sheets (Start from a template, Export, Show all, the pickers, the camera) sits
  exactly in the middle of its circle; it was 4–5 px high on every sheet.
- A full end-to-end check of exports and flows (`s212`) — see the handoff.

## What's new in v3.13 (2026-10-09)

- **Transitions between sections:** tap the small round mark on the line between two clips on
  the timeline and pick **Cut**, **Fade**, **Slide** or **Zoom**, with a length of 0.2–1 s, or
  **Use on every cut**. Picking one plays that cut once. A transition happens at the start of
  the section it leads into, so the film keeps its length. It plays when you press Play and in
  the video export; while editing you always see the section itself.
- **Overlay track:** a second row under the sections. **Add an overlay clip** (on that row, or
  + Add → **Overlay clip**) puts a video or picture at the playhead; it plays over the sections
  at its own time, across cuts. Drag it to move it, drag its right edge for its length, tap it
  for **Full frame / Window** (size and position), **Fade** in and out, **Opacity** and Remove.
  It sits over the background and under media, text, buttons and badges. Its sound is off.
  On a phone the row appears once there is a clip.
- **Value sections can run up to 3 minutes** (Hook and CTA stay at 30 s). The video export
  records in real time, so a 3-minute Value takes 3 minutes to export.
- **Desktop:** clicking a text on the preview opens it for typing at once; the ✕ to remove it
  now shows there too (it only showed on phones).

## What's new in v3.12 (2026-10-09)

- **Style: Brand · Custom** on every button and every lower badge (the main one and each extra
  badge's), like the text Style row. **Brand** shows only the words and Scale; **Custom** opens the
  colors, stroke and corners (and Reset to default). A button or lower badge with its own look opens
  on Custom. Going back to **Brand** puts the brand's look back (Undo brings yours back); the text,
  scale and position stay.
- **Roomier sheets on phones:** 12 px between color dots (was 5–8), 16 px between edit rows.
- The Upper and Lower badge settings now use the sheet's full width (they sat in the left column).

## What's new in v3.11 (2026-10-09)

- **Text style names follow the look.** **Light** is dark type on a light box; **Dark** is light
  type on a dark box (the brand panel). They used to be named after the type colour, which read
  backwards. Order and behaviour are unchanged: the buttons still read Light · Dark · Custom, and
  saved designs keep their look (`textTone` values are the same; only the labels swapped).
- **Phone bar:** the section name stays on the left; **+**, **Preview** and **Light/Dark preview
  background** sit together on the right, aligned with the heart and share buttons above. There is
  more space between Preview and Light/Dark (16 px) than between + and Preview (10 px).

## What's new in v3.10 (2026-10-06)

- **Brand patterns are built from single motifs**, exactly like a cogent pattern. Each one is the
  Figma pattern fill it was designed as: one whole logo, skull or T4R mark, repeated at the
  Figma size, spacing and row offset, on its ground color, with Figma's wash on top. The old
  tiles were pre-composed blocks with motifs cut at their edges, so Mirror and Scale broke the
  motifs apart; now every control acts on whole motifs.
- The Pattern tab panel has the cogent controls: **Size** (100% = as designed), **Spacing**,
  **Offset rows** and **Mirror**. Spacing and Offset rows start at each pattern's Figma values.
- The motifs live in `assets/motifs/` and in Figma (Brand assets › *Pattern motifs (app)*).

## What's new in v3.9 (2026-10-06)

- The **format button** shows the name only (Reel, Portrait…); the ratio stays in the list.
- **Mirror tiles in the pattern library** (Show all on the Pattern tab), for the pattern in use.
  It's the same setting as the switch under Scale in the panel and the phone sheet.

## What's new in v3.8 (2026-10-06)

- **Mirror tiles on the brand patterns** (Pattern tab, under Scale): every other tile faces the
  other way, never upside down. Letter marks in a turned tile read backwards (the R in Ask Ruth's
  pattern), so it suits picture motifs best.
- **Video export on phones.** A video records for as long as it plays. By the time it is ready,
  the tap that started it has expired, and iPhone Safari silently drops the download. On phones
  and in Safari the finished file now waits in a **Save** bar at the bottom ("Your video and
  cover are ready"). One tap opens the share sheet (Save Video puts it in Photos), or downloads
  where sharing files isn't offered. Desktop Chrome and Firefox still download straight away.

## What's new in v3.7 (2026-10-06)

- **Coming back always starts on Home.** A reload does too. The design is saved and first
  under Recent (this replaces the v3.1 "reload returns to the editor").
- **Delete projects.** A ✕ in the corner of every card on Home and in the Show all modal, and on
  every recent project in ☰. Recent or saved, the open one included (its brand starts again from
  its template). A note offers Undo.
- **Export from the list.** In ☰ and in the Show all modal each project has Export next to ✕. It
  opens that project and the export sheet.
- **☰ shows the 3 latest projects** and a **Show all** link that opens the projects modal on the
  Recent tab. The separate "All projects" item is gone.
- Later: a print export (high-res images / seamless tile).

## What's new in v3.6 (2026-10-06)

- **Phone sheet, two heights.** A sheet opens docked under the preview, as before. Pull the
  handle up for a tall sheet (just under the top bar) with more room for long content; pull
  down to dock it again; from docked, pull down to close. A tap on the handle switches the
  two heights. The next sheet always opens docked.

## What's new in v3.5 (2026-10-06)

- **Cogents in a speech bubble sit smaller inside it** (80 % of the bubble), so the bubble's
  own color shows around them. The same goes for round badges set to Bubble.
- **Faster:**
  - A still background (pattern, artwork, cogent, picture) is now drawn once and reused while
    you drag, type or play, instead of redrawing every tile on every frame.
  - While a video plays, the panel only updates when you do something (or 4× a second), not 60×.
  - Measured in Chrome: dragging text 130 → 93 ms of work, Tone down 182 → 85 ms, idle with a
    playing video 2.9 → 1.6 s per 3 s.

## What's new in v3.4 (2026-10-06, fourth round)

- **Cogents: Round · Rough edges.** A control in the cogent settings switches the cogent between
  its round portrait and its rough-edged sticker. Its settings come along. (Both are still in
  the gallery too.)
- **Cogents: Mirror** (pattern only): every other cogent faces the other way, never upside down.
- **Show all, per tab.** Cogents: nothing to add. Pattern: Upload only. Image: Upload + Record.
  Color: your own colors.
- **"Color" everywhere** in the UI (US spelling). Code names keep `colour`.
- **Renamed: Media Brand Kit** (page title, home-screen name, Home heading).
- More room between the Color · Pattern · Image · Cogents bar and the gallery.
- **Phone top bar:** Export is an outlined icon like the heart; **+** is the filled, prominent one.

## What's new in v3.3 (2026-10-06, third round)

- **A CTA's words can have a box.** Before, a CTA section's words always sat straight on the
  background, so Style and Custom did nothing there. Now tapping them shows "No background
  colour" ticked (it is true). Untick it for the brand box; Light / Dark pick which box;
  Custom → Background picks its colour. (`ctaBox`, per section.)
- **Custom = the box's background only.** The Text and Border rows are gone from Custom; they
  live in each field's palette (the icon in the input).
- **No trash icons on item cards** (text boxes, buttons, media; badges already). Tap the item
  in the preview, then ✕.
- **No Record for patterns:** not on the Pattern tab, not in its full picker.
- **Start from a template.** The sheet is called that. Every brand's templates start clean: the
  Hook is the logo, the Value the background, the CTA one button (Shuffle too). Text comes in with
  + Add. The brand's own one is called **Signature** (it was "Ask Ruth template" and so on). A
  first visit and ☰ → New project still open the full brand template, with copy.

## What's new in v3.2 (2026-10-06, second phone round)

- **Heart = save.** A heart sits next to Export. Tap it, name the project (the header fills
  in), Save. It lands under ☰ → All projects → Saved. The saved list and the name field
  are gone from the menu (the same save as Saved designs, `#tpl-save`).
- **Menu (☰) order.** New project · Start from a template · All projects · Recent projects ·
  View settings (Safe area, Grid, Safe area for…) · Home at the bottom. View settings are
  in the menu on desktop too; the desktop full-screen button now goes straight to full screen
  (in full screen, the view button still has the settings).
- **All projects returns you to where you were.** From the editor it opens over the editor,
  and × / Esc / a tap outside takes you back to it. From Home it returns to Home.
- **Loop / Mute only with a video.** Under the background when the background is a video;
  under Media when only the media is one; never under a pattern or colour.
- **Upload a pattern.** On the Pattern tab the upload reads "Upload a pattern · Your picture,
  repeated", takes pictures only and has no Record button. On the Image tab it is Upload image
  or video + Record as before.
- **Cogents.** The tab is called Cogents. Ask Ruth shows Ruth, Clara and Ada (no Jimmy Jazz);
  MoshPit and T4R Labs keep all four.
- **Safari bars.** Unchanged from v3.1 (solid brand top bar and page). The iPhone screenshot
  of this round still showed v3.0's translucent top bar (#1b1a17 under a #262624 status bar),
  so check again once v3.1+ is deployed.

## What's new in v3.1 (2026-10-06)

**Work is hard to lose (P0).**
- A reload in the same tab (pull-to-refresh, ⌘R, a phone dropping the tab) reopens the
  editor on your design, never the start screen. A new visit still opens Home, with the open
  design first under Recent. (`sessionStorage` *in-editor*: this tab only.)
- The page is exactly one screen on a phone and stops overscroll (`overscroll-behavior: none`
  on html / body), so a drag can't pull the page and refresh it.
- Each section keeps its own copy of its text. That copy used to lag behind the live
  fields, and loading it at startup threw away whatever was typed since. The open section is
  now synced at startup and on every paint, and the design is written when the tab is hidden,
  frozen or closed (`persistNow`). A deliberate clear of site data is respected.
- **Home** is in the ☰ menu.

**Background is an inspector.** Under Tone down (still first, for every kind):
**Colour · Pattern · Image**. Opening Background, or tapping empty canvas, opens the tab
of the background in use; the gallery shows that kind only, and only that kind's
controls show.
- *Colour*: the brand colours (+ yours). **Gradient** turns the colour into a brand-safe
  gradient: the second colour starts as the brand's own partner (`gradients` in brands.js),
  else the nearest brand colour that still shows. **To** changes it; **Direction** has four
  arrows (↓ ↘ → ↗) and **⇄** swaps the two. A gradient is just another backdrop id,
  `grad-<from>-<to>-<dir>`, made on the fly like your own colours (backdrops.js
  `gradientBd`), so it saves, travels in templates, follows its section and exports.
- *Pattern*: the brand patterns and **Scale**. They have no Spacing or Offset: each brand
  tile is a pre-composed, already staggered block of motifs, and spacing the tiles leaves
  blocky gaps instead of spacing the motifs.
- *Image*: brand artwork and your uploads, Upload / Record, **Scale** up front, **Position**
  folded (dragging the picture is the quick way). An upload used as a **Pattern** has
  **Tile size**, one **Spacing** (both directions; `adjust.gx = gy`), **Offset rows** (every
  other row shifted by a share of a step, `adjust.row`; 50 % = brick) and **Mirror tiles**.
- On a phone the order is the same as on desktop.

**Safe Space is advice.** Text, text boxes and buttons used to be held inside the safe area
by the renderer. One you drag yourself is marked `free` and stays where you put it (inside
the frame). Untouched items render as before; the edge magnet stays as the hint.

**✕ on the selection.** A selected item shows a small ✕ at the upper-right corner of its
outline (28 px, a 44 px target on touch), in every mode. It removes the item at once, with
Undo in the toast; badge parts hide. **Delete / Backspace** does the same for one item.
The full-screen "Remove" bar is gone.

**Redo.** Undo now offers **Redo** in the toast; ⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y redo.

**Desktop panel: resizable, collapsible.**
- Drag its left edge to resize it, between 300 and 560 px, never leaving the preview under
  420 px. Double-click resets it, the arrow keys nudge it, and the width is remembered on
  this browser.
- The round button under ◐ / ⤢ hides the panel, and the preview takes the width.
- While it is hidden, tapping something floats its controls in at the right. The stage makes
  room, so the canvas stays in full view. Done, Esc or a tap on the empty stage puts it
  away again.
- The preview only rescales: a 1080 × 1920 Reel stays 1080 × 1920.
- The panel's content follows the panel's width (container queries): more thumbnails and
  wider labels when it is wide, stacked rows when it is narrow.

**Home.** **Create new** is first: one button per brand, and a tap opens a **Video · Reel**
straight away (there is no Video / Carousel choice; change the format in the editor). ☰ →
*New project* does the same for the brand you're in.

**Formats.** Short names, because the group says Video or Carousel: **Reel 9:16, Tall 3:4
(new: 1080 × 1440, Instagram's grid-native portrait), Portrait 4:5, Square 1:1,
Landscape 16:9**. The top bar reads [icon] Reel 9:16: the icon is the content type (video
camera / carousel) and the word is the format.

**Safe area per platform (9:16).** The canvas is the format, and where you post it decides
what covers it.
- ⤢ view menu (☰ on a phone) → **Safe area for**: All platforms (default) · Instagram &
  Facebook · TikTok · YouTube Shorts.
- All platforms is the union of their covered areas: top 15 %, bottom 35 %, sides 18 %.
  The platforms' own left / right margins differ (the right-hand action rail), so layout
  uses the larger side on both sides and centred designs stay centred.
- TikTok's rail notch (lower right) is drawn as a dotted guide.
- 4:5 and 1:1 show where Instagram's 3:4 profile grid crops them.
- The bottom margin went from 28 % to 35 %: every source puts the platform UI there.
- Sources and the official / practical split are in the dev kit's `FORMATS.md`.

**Brand area.** The mark, "Brand", the name and the caret are one control that opens the
brand switcher. A long name ends in "…" on a phone. Home moved to ☰.

**Export button.** Icon + Export on desktop; the icon alone (44 px, labelled) on a phone.

**Carousel Play.** A carousel plays like a video: the same Play / Pause and the Space key,
3 s per slide, with the live slide outlined. Editing pauses it on the slide shown.

**Badge: [ Upper ] [ Lower ]** side by side as two compact switches; each part's settings
open under them.

**Drawing** (+ Add → Drawing).
- Draw mode puts a layer over the canvas and one small bar with: pen, highlighter, line,
  arrow, circle · the brand's colours + white / black · three line weights · undo stroke ·
  Done.
- Mouse, pen or finger. The page never scrolls under it, and strokes cross the safe area
  freely.
- Everything drawn until Done is **one drawing**, so a stick figure is one object. Esc,
  Enter or a click outside also finish, and nothing drawn means nothing is added.
- Afterwards a drawing is an ordinary item: tap one of its lines to select it, drag to move,
  ✕ / Delete to remove, and Undo works throughout.
- Its controls: one **Colour** for the whole drawing, **Line**, **Opacity**, **Size**,
  **Draw more** (adds strokes to it), **Duplicate**, **Remove**.
- Per section (`drawings` in SCENE_STYLE), saved, in templates, in every export and in
  Items as PNGs.
- Points are stored in thousandths of the frame's short side around the drawing's centre,
  so it keeps its shape in every format (render.js `drawDrawing`).

**Round portrait badges: Shape + Halo.** The clean round portraits (Ada, Clara, Jimmy,
the R mark; `round: true` in brands.js) have two options under the badge image:
- **Shape**: *Round* (as drawn) or *Bubble*, a speech bubble with the lower-left corner square.
  The added corner is filled with the portrait's own edge colour.
- **Halo**: a thin outline (2.6 % of the badge) in a brand colour. It starts in each brand's
  `haloColour` (T4R teal `#2b6a83`, MoshPit teal `#046e83`), and the row offers the brand
  swatches.
- The grunge stickers keep their organic shapes and get neither option.
- Like the text badge, the result is a generated image the size of the artwork, pill
  included (render.js `shapedBadgeImage`), so badge parts, scale, PNG and every export work
  unchanged.
- Per section (`badgeShape`, `badgeHalo`), saved and in templates. Extra badges carry
  `shape` / `halo` too, though their cards have no controls for it yet.

**Sliders: type the exact value.** The value beside a slider is also its precise input.
- **Opening it**: tap or click the value, or focus it and press Enter. A small number field
  opens over it, with a numeric keyboard on phones (16 px, so iOS doesn't zoom).
- **Keys**: Enter or leaving the field sets the value, Esc cancels, ↑ / ↓ step by 1 (Shift:
  10). Letters are refused.
- **Range**: out-of-range values clamp, with one soft flash.
- **Units**: percent sliders take percent (type 65 for 65 %), and the rest take their own
  unit.
- **One source of truth**: the typed value goes through the slider's own input and change
  events, so state, autosave, Undo, formats and exports are exactly as when dragging. It is
  set exactly: the step steps aside for that one set.
- **Where**: all 20 measurable sliders (scales, Tone down, tile size, spacing, offset rows,
  opacity, line, size, stroke). Picture position stays visual (`PRECISE_SKIP`).
- **Hint**: the value has a quiet dotted underline, so it reads as editable without hovering.
- There is no element locking: placement stays direct, with Undo.

**Phone round (Marco's iPhone tests).**
- **Browser bars in the brand colour.** Safari 26 on iPhone ignores `theme-color`. It tints
  its bars from a solid full-width bar at the top edge, else from the page background, and
  our top bar was 88 % see-through, so Safari used its light default. Now the top bar, the
  page and the area past its edges are the brand's solid studio colour in every brand.
  `theme-color` is still set, and replaced as a new tag on a brand switch, for Chrome and
  Android.
- **Upload in the Pattern tab.** Upload / Record show under Pattern too. A picture uploaded
  there arrives as a pattern, and uploads used as patterns are listed under Pattern, not
  Image.
- **Text background: Custom only.**
  - Style is **Light · Dark · Custom** plus a **No background colour** checkbox, which
    combines with any of them.
  - The box's Background colour is chosen in **Custom**. A field's palette is its Text
    and Border.
  - "None" is the checkbox now, not a swatch. Text boxes have the same checkbox.
- **On a pattern, text gets its box.** Picking a pattern (brand, upload or cogent pattern)
  for a section whose text has no background switches the Light / Dark box on, with a note
  and Undo; the checkbox turns it off again. Changing section or brand never does this, and
  templates on patterns start with the box.
- **Badge cards have no trash icon**: a badge is removed from the preview (✕).
- **The "Restored your last design" note** goes at the first touch anywhere else, and when
  the colours open. It sat over the bottom of a phone's colour sheet, so a tap meant for a
  swatch hit the note.

**Cogents as backgrounds.** Background → **Cogent**, in every brand. The cogents are
**Ada, Clara, Jimmy and Ruth (the R)**, each as the round portrait and as one grunge sticker.
- **Pattern** repeats the cogent, with **Size**, **Spacing** and **Offset rows** (they start
  in a half-step brick). **Single** shows one large cogent, with **Scale**; drag on the
  preview to place it. Both sit on a **Ground** colour chosen from the brand's colours.
- **Speech bubble** squares the lower-left corner of the circle. The shape is filled with a
  colour picked from the image: the round portrait's rim, or for a sticker the portrait's
  own ground inside the grunge frame. The sticker sits whole inside the bubble, rough
  edges and all.
- **Halo** adds an outline in a brand colour. A sticker gets it only inside a bubble, since
  its rough edge has no line to follow.
- The library: the cogents are cut from the badge files (`COGENT_ASSETS`, `cogentBackdrops`
  in brands.js; `cogentArt` + the `cogent` painter in backdrops.js).
- Settings are the background's adjust: `layout`, `bubble`, `halo`, `cground` (not
  `ground`, which is the retired Surface key and is cleared on load), `tile`, `gx` / `gy`,
  `row`, `zoom`, `ox` / `oy`. So they're per section and per cogent, saved, in templates
  and in every export, and the Large 2× export uses the @2x masters.
- Shuffle in Start new keeps to the brand's own backgrounds; cogents are picked by hand.

**One way to remove, one way to bring back.**
- *See it → tap it → edit it. Don't want it → ✕.* The ✕ removes the selected item: text,
  button, media, drawing, badge, or one badge part.
- *Optional parts come back from the section.* **Upper**, **Badge image** and **Lower** keep
  their switches, because once hidden there is nothing to tap. ✕ on a part flips that same
  switch (one state, no separate "visible" flag), and the badge's controls stay open, so
  the part shows *off*, ready to bring back.
- *Something new → + Add*, which also brings back a removed Text, Badge or Media.
- The whole-item switches in the **Text**, **Badge** and **Media** panel heads only repeated
  ✕ / + Add, so they're gone. Their inputs stay in the DOM as the single state both flip.
- Undo / Redo cover every removal.
- It works the same from a template or a blank project. Everything stays with a section
  when it's reordered, survives a reload, and the export matches the preview (`s197`).
- No locking.

**Panel copy** is shorter: *Tap anything to edit it · + Add puts something new on this
section*.

## The editor in v3.0: + Add, tap to edit

The panel no longer has element tabs. **+ Add** (top of the panel; *Add* in the
full-screen bar) adds a Background change, Text, a Button, Media, a Badge or a
Section. **Tapping something in the preview edits it**: the panel shows only that
item's controls, toned so the selected card stands out, with **Done** (or Esc) to go
back. With nothing selected the panel is minimal: a hint and **Tidy up**. Tapping
empty canvas opens **Background**, where **Tone down** (a darkening wash, 0 = Off)
sits at the top for every kind of background.

- Overlapping items: tap the same spot again to select the one underneath.
- Small items (under 44 px on screen) get a 12 px tap margin.
- **View settings** (Guides, Grid, Full screen): on a phone in the ☰ burger menu; on
  desktop in the view button in the preview. They aren't repeated anywhere else.
- **☰ Burger menu:** Save design, Start new, Recent and Saved projects, All projects.
- **Blank** in Start new is the brand's plain colour with nothing on (Ask Ruth plum,
  MoshPit charcoal, T4R navy).
- *Show on* (one item across sections) was removed: every item belongs to its section.
  Designs that used it are unlinked on load; each copy stays where it was.
- The edit panel and timeline never use pure white: T4R's light surfaces are a soft
  cool off-white.

Where older sections below mention the tabs, the ⋯ menu, Darken or Show on, read
+ Add / tap to edit, the burger menu, Tone down, and (for Show on) removed.

## Opening the studio

**The studio reopens what you were working on.** A note says *Restored your last
design* with **Start new**; Start new keeps that design under **Saved designs** as
**Last session · <brand>** and starts clean. The very first launch (or a design you
never touched) starts clean, in Ask Ruth.AI: the brand's first pattern, nothing
switched on, format *Video · Reel / Story*.

## Names and conventions

- **Section** — one part of the sequence: **Hook**, **Value**, **CTA** (numbered once
  there is more than one of a kind: Value 1, Value 2). In a carousel each is a slide.
- **Section buttons** — Background · Text · Buttons · Media · Badge, in the order a
  design is usually built. Each opens its controls for the section being edited.
- **Format** sits in the top bar beside **Brand**: it is set once per project, so it
  is not among the section buttons. Tapping it opens the list of formats.
- **Text boxes** (more header + body on a section), **Media** (a photo or video in
  a rounded frame), **Darken** (the wash over a background), **Guides** (the safe
  area, never exported), **Reset to brand** (a button's look).
- **Style** — one control for how text looks: **Light** or **Dark** (the brand's
  sets, type with its panel; named for the look since v3.11 — Light = dark type on a light
  box, Dark = light type on the dark panel) or **Custom** (your own colours: text, background —
  None for no panel — and border, in the palette in each field). Light or Dark
  goes back to the brand's set. Every text box has its own Style.
- **Section colours** in the editor (timeline, selection outline): Hook amber, Value
  blue, CTA violet — colours no brand uses, so they never read as a brand colour.
- The timeline menu (right-click or long-press a clip, or tap its label) holds what
  is about the section as a whole: Add section, Duplicate, Sound, Duration, Save as
  cover, Remove. Background and Media are under the section buttons.

## More than one media

A section can show several photos and videos. The first is added with the Media
tile (its own switch, scale and corners); after that **Add more media** adds
another — or several at once — each with its own card under Media: a small
preview, **Scale**, **Corners** and remove. Drag each on the preview. They belong to
the section, like its text boxes and buttons, and their videos play muted (only
the first media's sound is used). In full screen, tap the background → **Media** to
add one; tap one for its controls and Remove. Stored per section as
`media: [{ id, src, x, y, scale, radius }]`.

## Undo

Removing a section, a button, a text box, text or media can be undone: a note at the
bottom says what went, with **Undo** — and ⌘Z / Ctrl+Z does the same (outside a text
field, where it undoes typing). A removed media file is kept until the removal can
no longer be undone.

## Your colours in a row

Your own colours follow the brand's in every colour row. A row stays on one line:
as many of yours as fit are shown (the one in use always among them), the rest are
behind **+N**.

## Brands

The header is a **brand dropdown**, with the active brand's mark beside it — its logo,
or a monogram until one exists. **Ask Ruth.AI** is pre-selected and holds your Figma
artwork — 11 backdrops, both badge lockups and the full palette. **MoshPit** and
**T4R Labs** follow, and run every one of the same tools.

**Each brand is its own design.** Switching brand keeps what you made for the brand
you leave — copy, screens and their times, background, badge, text style, Dim, photo
card, sound — and brings back what you made for the brand you switch to. The first
time you open a brand it starts clean (see *A clean start*); the brand's `starter` in
`js/brands.js` holds the copy, badge and text style that switching elements on brings in:

| | Background | Badge | Text | Hook → Value → CTA |
|---|---|---|---|---|
| Ask Ruth | Pattern Pink | plum lockup | light type on the plum panel | "Design as the limit of truth" → "Ask Ruth anything" → **Ask Ruth** (button) |
| MoshPit | Skulls pattern, Dim 35 % | skull sticker | light type, no panel | "Enter the pit" → "Meet your cogents" → **Enter the pit** · moshpit.dev (button) |
| T4R Labs | Jimmy portrait | R sticker | dark type on the light panel | "Fresh out of the lab" → "What we're testing" → **Follow the lab** (bold text) |

Only the format travels between brands. The starter copy is placeholder wording —
change it in `js/brands.js`.

Switching brand swaps the artwork, the palette and the backdrop set. Everything that
belongs to the *design* — your copy, uploads, the photo / video card, positions, crops, the
format — stays exactly as it was, so you can try the same layout under any brand.
The choice is remembered, and a saved template carries its brand with it.

**MoshPit** and **T4R Labs** follow, and run every one of the same tools.

**Each brand is its own design.** Switching brand keeps what you made for the brand
you leave — copy, screens and their times, background, badge, text style, Dim, photo
card, sound — and brings back what you made for the brand you switch to. The first
time you open a brand it starts clean (see *A clean start*); the brand's `starter` in
`js/brands.js` holds the copy, badge and text style that switching elements on brings in:

| | Background | Badge | Text | Hook → Value → CTA |
|---|---|---|---|---|
| Ask Ruth | Pattern Pink | plum lockup | light type on the plum panel | "Design as the limit of truth" → "Ask Ruth anything" → **Ask Ruth** (button) |
| MoshPit | Skulls pattern, Dim 35 % | skull sticker | light type, no panel | "Enter the pit" → "Meet your cogents" → **Enter the pit** · moshpit.dev (button) |
| T4R Labs | Jimmy portrait | R sticker | dark type on the light panel | "Fresh out of the lab" → "What we're testing" → **Follow the lab** (bold text) |

Only the format travels between brands. The starter copy is placeholder wording —
change it in `js/brands.js`.

Switching brand swaps the artwork, the palette and the backdrop set. Everything that
belongs to the *design* — your copy, uploads, the photo / video card, positions, crops, the
format — stays exactly as it was, so you can try the same layout under any brand.
The choice is remembered, and a saved template carries its brand with it.

**MoshPit**'s colours come from the `Color` variables in the moshpit.dev — UI Figma file
(both its Light and Dark modes, all offered together); `js/brands.js` notes which token each value is. The header shows the
round MoshPit badge (`assets/brand-moshpit.png`). Its export badges are the two
moshpit.dev lockups (Dark, Light), two skull stickers (`assets/moshpit/badge-sticker.png`,
`badge-sticker-pink.png` — dark and pink "Powered by" pill) and the shared portrait badges.

**T4R Labs**' header shows its round badge (`assets/brand-t4r.svg`, vector). Its export
badge (`assets/t4r/badge-dark.png`, `badge-light.png`) is built like Ask Ruth's — the
"Powered by" label above a logo plate (`logoTop` 0.2952 dark, 0.2894 light) — from the vector T4R lockups,
so the Badge controls (Light/Dark, "Powered by" switch, Scale) work the same way. Its
backgrounds are 3 patterns, 8 T4R artworks and the 6 Ada / Clara / Jimmy portraits
(full and circle — the same files MoshPit uses, from `assets/moshpit/`).

**Dim instead of pre-dimmed copies.** The "Soft" / "Ghost" backgrounds (MoshPit: Skull
Badge Soft, Skull Badge Night Soft, Skull Ghost Light/Dark, Clara/Ada/Jimmy Soft; T4R
Labs: Labs/Mark/Circle Soft and Soft Dark, Clara/Ada/Jimmy Soft) were faded copies of
other backgrounds, so they were removed (52 files). **Dim is on by default for every
picture background** — artwork, photos, clips: picking one switches Dim on at 30 %;
going back to a pattern or colour switches it off again, unless you set Dim yourself.
A saved design that used a retired background opens on the original with Dim on
(`RETIRED` in `js/brands.js`).

### The editor takes on each brand

The studio's own interface is themed per brand, so you always know which one you're in:

| | Editor | Buttons (Export, Save) | Active states (switches, selected pills, chosen backdrop, sliders, dropdown carets) |
|---|---|---|---|
| Ask Ruth.AI | dark plum | pink | pink |
| MoshPit | dark, moshpit.dev tokens | turquoise, like the toggles | turquoise `#0bb8d9` with a dark knob/label (5.6:1 on the panel, 7.4:1 label) |
| T4R Labs | **light** — pale blue-grey page, white panel, navy ink | dark grey `#3a3a44`, like the + | deep blue `#123a63` with white (11.6:1) |

The colours are CSS variables in `styles.css`: `:root` holds Ask Ruth's, and a
`:root[data-brand="…"]` block per brand re-maps them. `--accent` is the call to action;
`--active`/`--on-active` are the selected states, and `--add`/`--on-add` colour the
"+" on the upload and photo / video card tiles (pink · turquoise · dark grey `#3a3a44`).
T4R's dividers and panel edges use `#e4e1d4`. A brand marked `ui: 'light'` in
`js/brands.js` gets a **dark** second preview background instead of a white one.

## Light preview background

The half-circle button in the preview's top-right corner flips the whole viewport
background (on a phone, the sticky preview strip too) between the studio and a contrasting screen — blush (`#ffdafe`) for Ask Ruth,
Paper (`#f1eee5`) for MoshPit, warm near-black (`#23221c`) behind T4R's light editor — to
check how the piece reads in the other feed theme. While that screen is on, the button
becomes a solid disc of the opposite tone, so it stays visible on either background. It is a viewing aid only: never drawn into an export, never saved in a
template. The choice is remembered on this browser.

In full screen the bar's text follows that background too: the section name, the
hint and the round buttons switch to the dark-on-light (or, for T4R, light-on-dark)
colours of the second background, so nothing disappears into it.

## The control panel

The background gallery opens with four picks per brand — **a pattern, an image, a
solid colour, and one more** (`featured` in `js/brands.js`). Your newest upload takes
the fourth place, so it is always in the first row; **Show all** has the rest. A
background picked or uploaded on the Hook becomes the shared one and is kept on reload. The full colour range stays in the Colour
row.


Controls run from the biggest decision to the smallest — **Format → Background →
Badge → Header → Body → Text style → Photo / Video Card** — and each element's settings sit
inside its own group, so a Scale slider always scales the thing it is under.

- The gallery shows **backgrounds only** — no badge, no text — so the one worked example
  is the preview itself.
- **Header**, **Body**, **Badge** and **Photo / Video Card** each have a show/hide switch (a hidden photo / video card keeps its file, size and position). The photo / video card starts switched off; adding an image or video switches it on. Switching one off hides
  it on the canvas *and* hides its controls; its text and settings are kept, so switching
  it back on restores them. Header and Body are on by default.
- **Badge** has a **“Powered by” label** switch. Off draws the logo on its own — the same
  lockup file, drawn from `logoTop` down (set per badge in `js/brands.js` as a share of
  the file's height — 163/565 for Ask Ruth, about 0.29 for the T4R and MoshPit lockups,
  0.172 for the portraits, 0.13–0.17 for the stickers), and the logo stays exactly where
  it was. Re-export the badges at a different layout and those numbers need updating.

  The T4R and MoshPit badge files follow the Figma badge components: the plate hugs the
  logo, and portraits and stickers carry a 172 × 48 pill with the art inset 4 px at 337 wide
  (stickers sit 12 px below the pill). It is saved with the design and
  in templates; older templates show the label.
- **Header** and **Body** scale independently. Designs and templates saved before that
  had one shared text size; both scales start from it, so they look unchanged.
- **Text style** (colour, text panel) only appears while some text is showing.
- The **background gallery** and the **badge** choices show **four at a time**; the one
  in use is always among them. All of them sit in **one row that scrolls sideways**, like a carousel
  (a little over four in view, so the next one peeks in; the one in use scrolls into
  view). **Show all N** opens the whole set in a modal. The **Backgrounds** modal also has
  **Add your own**: the **Colour** row first — the brand's colours, your own, and **+** for
  a new one — then *Image or video* (an upload, like Upload your own) and *Record with camera*.
- **Badges** are chosen by their artwork. Ask Ruth and MoshPit ship a Dark and a Light
  lockup; T4R Labs has Dark and Light lockups plus four round portrait badges (Ada,
  Clara, Jimmy, R mark) and eight grunge stickers — Ada, Clara, Jimmy and R, each
  black-edged and outlined (Blush, Gold, Orange, Magenta; the "Powered by" pill takes the
  outline colour), cut out from the supplied JPGs (`assets/t4r/badge-*-sticker*.png`) — and MoshPit adds two skull stickers (Sticker, Sticker Pink) and shares the three
  portrait ones (Ada, Clara, Jimmy). Each badge in `js/brands.js` can set its own `size` (width as
  a share of the canvas's short edge — the lockups use 0.612, the round ones 0.24) and
  `logoTop` (where the logo starts, for the "Powered by" switch).
- Switching brand opens on the brand's `defaultBackdrop` — Ask Ruth Pattern Pink,
  MoshPit Pattern Pink, T4R Pattern Confetti — with the badge, header and body as set.
- Backdrop settings — pattern **Scale**, artwork **Scale** and crop, **Dim** (any background),
  video playback — appear under the gallery only for the kind of backdrop selected.
- **Pattern Scale** (25–200%) resizes the motif at its true repeat, so it never stretches.
  **Artwork / upload Scale** runs 100–800%: push it past the edges, then drag the artwork
  to pick the crop. The aspect ratio is always kept; the canvas is the crop frame.

### Background colour

**Your own colours as backgrounds.** After the brand's colours the Colour row offers your own
colours (the same ones as in the text colour popup) and **+** for a new one, from the
system picker. A colour of your own is a plain background like the brand's —
`solid-custom-rrggbb` — so it exports, saves and travels in templates; its lightness
decides the badge and text it pairs with.


Under the gallery, **Colour** offers seven brand colours as a plain background — the
alternative to a pattern or artwork. They are each brand's solid backdrops in
`js/brands.js` (the gallery shows only patterns, artwork and uploads), so a colour
exports, saves and goes into templates like any backdrop, and switching brand swaps the
seven:

- **Ask Ruth** — Cream, Blush, Pink, Orchid, Magenta, Plum, Ink
- **MoshPit** — Paper, Sand, Teal, Turquoise, Charcoal, Night, Pink (moshpit.dev tokens)
- **T4R Labs** — Mist, White, Cyan, Pink, Navy, Violet, Logo black (site and logo)

With the text panel off, picking a colour the current text would not read on (under 3:1)
switches the text to the other colour (Light/Dark). Designs saved on the old grey T4R
placeholders, or on MoshPit Sand, still open as they were.

## Deploy to Netlify

**Drag and drop:** zip this folder (or drag the folder itself) onto
[app.netlify.com/drop](https://app.netlify.com/drop). Done.

**From Git:** connect the repo. `netlify.toml` already sets `publish = "."`
and an empty build command, so Netlify serves the files as they are.

Local preview: `python3 -m http.server 8000` then open `http://localhost:8000`.
(ES modules need a server — opening `index.html` from the filesystem won't work.)

## How it works

Every Ask Ruth backdrop is **your Figma artwork**, exported and handled in whichever way
keeps it sharp at any canvas size:

- `tile` — the three `BG_Pattern` artworks, cut into **seamless tiles at the pattern's
  true repeat** (547×110, 464×247, 547×110). The repeat is fractional, so the tiles are
  resampled at subpixel precision — seam error is under 1/255. Tiled, they bleed to
  every edge at any format instead of being cropped, and **Pattern scale** (25–200%)
  resizes the motif without ever breaking the tiling. 100% is the motif at the size it
  is in your Figma frame; the 200% ceiling is where resampling a 547px tile still holds
  together, since a 2× export doubles the upscale again.
- `art` — the six `BG_Image` compositions, shipped as a **portrait and a landscape
  master**. The canvas picks the orientation that fits, cover-fits it, and you control
  the crop by dragging and zooming. Switching to Desktop uses the real landscape
  artwork, not a crop of the portrait one.
- `solid` — `BG_Solid_1` (`#3b003a`) and `BG_Solid_2` (`#ffdafe`) as flat colour, so
  they scale infinitely for free.

The **Powered by Ask Ruth.AI** badge is the exported lockup (both the plum and cream
variants), placed and scaled — the wordmark is outlined vector art in your file, so it
is never re-set in a font.

The preview and the exported file come from the same `render()` call, so what you
see is what you get.

### Files

```
index.html          markup + control panel
styles.css          the studio UI
js/brands.js        the brand registry — palette, artwork, badges, backdrops
js/assets.js        loads the active brand's artwork and serves it to the painters
js/backdrops.js     the painters, uploads, overlays, the video placeholder
js/store.js         uploaded images and video (IndexedDB), plus the audio tap
js/render.js        layout, text wrapping, the single render() entry point
js/colours.js       contrast check for the background colour picker
js/app.js           state, controls, dragging, templates, export
netlify.toml        static-site config
```

## Your own images and video

Click **Upload your own**, or drop files anywhere on the page. Images *and* video both
work — a clip becomes the backdrop and plays live in the preview, marked with a ▶ in
the picker. Everything else behaves the same: H1, body, the badge and every control.

Uploads are **cover-fitted**, so a landscape photo or clip still bleeds to all four
edges of a 9:16 canvas. What falls outside is yours to place:

- **drag the image** on the canvas to move the crop
- **Zoom** (1–3×) to push in
- the crop is remembered per image, so switching format doesn't lose it

**Dim** sits under the background controls and works on every background — patterns,
artwork, brand colours and uploads. It lays a flat wash of the brand's ink between the
background and the text (never over the text). Off by default; when on, **Strength**
0–100 % (30 % to start). Designs saved with the retired Brand wash or Fade open with Dim on.

**Badge** has a **Light / Dark** switch (the cream and the plum lockup) and can be
switched off; **Text style → Colour** is Light or Dark. Both are set by hand — picking a
backdrop doesn't change them. The badge off plus Header and Body off gives you the bare
backdrop. Saves and templates from before kept an "Auto" setting; it is converted once,
to whatever it was showing, so they open looking the same.

Images are stored in **IndexedDB** on your machine — they survive a reload, they are
never uploaded anywhere, and they don't sync between browsers. On import anything
over 3000px on its long edge is re-encoded down to that, which keeps a 2× export
sharp without hoarding memory. The **×** on an upload's thumbnail deletes it.

## Photo / Video Card

**Add image or video** under Photo / Video Card puts an upload on the backdrop in a rounded
frame — a still or a clip, and a clip plays. The frame takes the media's own aspect
ratio, so nothing is cropped: **Size** scales the whole card, **Corners** runs from
square to fully rounded, and you drag the card on the canvas to place it.

It is added below the text, so a text panel never ends up hidden behind it, and on the
first upload it is auto-placed clear of whatever text is showing — in every format, not
just the one you happen to be looking at.

**Each screen has its own card.** A card added (or recorded with the camera, *Use as photo /
video card*) while the Value screen is selected shows on Value only — the Hook and the CTA
keep theirs, or none. The section says so: *On Value only — each screen has its own card.*
A new screen starts without one; *Add value section* on a Value copies its card along with
it. In an export each screen shows its own card and, for a clip, plays its sound. (Designs
saved before this had one card for every screen; they open with it on every screen.)

The card image is stored alongside the background uploads in IndexedDB but tagged
separately, so it never appears in the backdrop picker. Replacing or removing a card
deletes its file — unless another screen still shows it, then it only comes off this one.

## Screens: hook, value, final CTA — the timeline

Under the preview is a **timeline**, laid out like a video editor: play/pause and the
time on top, a **time ruler**, the **video track** (one clip per screen — Hook → Value… →
Final CTA — each as long as its time on screen, its thumbnail tiled along it), the
**sound track**, and a white **playhead** across all of it. There are no Camera or Sound
buttons any more: everything for a section is in its clip's menu.

- **Play** (or the space bar) runs the screens on the preview in order, with the
  sound — exactly what the video export records. **Pause** stops the playhead and
  opens the screen under it for editing. Press or drag on the ruler to scrub.
- **Tap a clip** to select that section (the preview and the panel show it). **Tap its
  label** (*Hook 3.0s*, *Value*, *CTA* …) **or hold the clip** (long-press; right-click or
  Enter on a computer) and its menu opens above it — tap the scrim or press Esc to close it. Items with **›** open a second menu in place:
  - **Add section ›** — a new **Hook**, **Value** or **Call to action**, right after this
    one. A video starts as Hook → Value → Final CTA, and in between you can add any kind,
    any number of times — two hooks to test, a CTA mid-way, whatever the post needs.
    With more than one of a kind they are numbered (*Hook 1*, *Hook 2*, *CTA 1* …).
  - **Duplicate section** — an exact copy (kind, text, background, card, sound) right after it.
  - **Background ›** — *Choose a background* (opens the Background section), *Image or
    video file* (this section's own; on the Hook it replaces the shared one), *Record with
    the camera*, and *Use the Hook's background* on a section with its own.
  - **Photo / video card ›** — *Image or video file*, *Record with the camera*, and with a
    card: *Size and corners*, *Remove from this section*.
  - **Add sound to this section ›** — *Audio file* or *Sound from a video*; with one:
    *Replace* / *Remove this section's sound*. See **Section sounds** below.
  - **Duration · X s ›** — type the time (to a tenth of a second, 1–30 s; out-of-range
    numbers are clamped) and **Set** or Enter, or *Use recommended X s*.
  - **Save as cover image** — that screen as a JPG, for the video's cover.
  - **Remove this section** / **Remove hook** / **Remove call to action**.
  Long menus scroll and always stay on screen.
- Clip thumbnails follow the screen: a new background or video clip, Dim, text, the
  badge or the photo / video card redraw them, and a video shows its frame as soon as it loads.
- Take the Hook out and an **+ Add hook** slot holds its place at the start; take the
  CTA out and **+ Add CTA** waits at the end.
- **Drag a clip's left edge** to move the cut before it: this section gets longer as the
  one before gets shorter (and the other way round); everything else stays where it is.
  Double-tap it: this section back to its recommended time.
- **Drag a clip's right edge** (the white trim handle) to make it longer or shorter
  (0.5 s steps, 1–30 s; arrow keys work on the handle too). The clips after it slide
  along as you drag, and a small **Rec. X s** mark shows the recommended length (it
  turns the brand colour when you land on it). **Double-tap the handle** to snap back
  to the recommendation. There is no separate time control — the timeline is it.
- **Recommended times follow the text on each screen** — reading time at ~15
  characters a second (subtitle guides cap adults near 17) plus a beat to notice the
  cut, held to each role's job:
  | | Range | Why |
  |---|---|---|
  | Hook | 1.5–3 s | viewers decide within ~2 s — a headline that lands at once |
  | Value | 2.5–7 s | time to read it; past ~7 s split it into two value sections |
  | Final CTA | 2.5–4 s | read the action, a moment to act |
  The starter copy lands at about 9–10 s in total; 9–15 s is the range that performs
  best in Reels / TikTok feeds. **A single screen on its own** gets at least **6 s**
  (read and loop), or — over a background/photo / video card video — **the clip's own length**
  (up to 30 s). Clips you haven't trimmed re-time as you type and as you add or
  remove sections; drag to make them longer.
- Under the timeline a short bar appears only when there is something to set: the
  CTA's **Button / Bold text** style, or *Own background* + **Match Hook** on a screen
  whose background differs from the Hook's.
- Whatever is in the timeline is what gets exported: one screen = one image, as before;
  more = slides or a video. New designs start with Hook, Value and CTA.
- Clips never get squeezed below a comfortable width (~84 px on a phone, ~96 px on
  desktop): once the film is longer than fits, the timeline **scrolls sideways**, and
  a newly added or selected section is scrolled into view.
- The timeline follows the editor's theme: dark for Ask Ruth and MoshPit, **light for
  T4R Labs** (white panel, ink ruler and playhead, deep-blue selection, light menus).
- On a phone the clips show short names (Hook, V1, V2, CTA) and times, and the tools
  show icons only. The light/dark toggle there lights only the preview strip at the
  top; the controls below stay dark (on desktop the whole viewport changes).

### Sound and music

- **Add music or sound** on the sound track adds the **soundtrack** — one sound under the
  whole video. It opens a small menu with two
  choices: **Audio file** (MP3, M4A, WAV, AAC, OGG, FLAC) or **Sound from a video** (MP4,
  MOV — the app uses the video's audio). They are two pickers on purpose: the audio one
  lists file extensions only, so a phone opens its Files app instead of the camera /
  photo-library sheet; the video one lists video types, so the phone does offer its
  library (and, being iOS, *Take Video* — the system decides that sheet). You can also
  drop an audio file on the timeline. The waveform shows on the sound track; tap it for
  **Replace sound** / **Remove sound**.
- **Timing follows the sound, like a reel** — two switches under the timeline, both on
  when a sound is added:
  - **Fit to sound** — Hook, Value and CTA share the sound's length, in proportion to
    their recommended times (1–30 s per screen; a longer song stops where the video
    ends, shown greyed on the waveform).
  - **Cut on the beat · N BPM** — the app finds the beat (dots along the bottom of the
    waveform) and moves every cut between screens onto the nearest one. Trims click
    onto beats too. Shown only when a steady beat is found.
  Trimming a clip by hand switches *Fit to sound* off (the times stay as they are);
  tap it again to refit.
- **Pick the part of the song** — drag the sound clip sideways (or arrow keys on it) to
  choose where the video starts in the song; the start clicks onto a beat. The fit and
  the cuts follow. *Play from the start of the song* in its menu resets it.
- Also under the timeline: **Volume** and **Fade out** (last 1.5 s).
- The video export mixes the soundtrack in, from the chosen start. A background or
  photo / video card clip's own sound is mixed under it unless **Mute audio** is on.
- The file is kept in the browser (IndexedDB), like uploads, and comes back on reload.
  A saved design keeps its sound, start point and timing too.

### Section sounds

Besides the soundtrack, **any section can have its own sound** (a voice-over, an effect, a
sting): *Add sound to this section* in its clip's menu. It plays from its start while that
section is on and is cut at the section's end (with a tiny fade, no click) — in the
preview and in the export, mixed with the soundtrack and the clips' own sound. A section
with a sound shows a note ♪ on its clip. The file is kept with the soundtrack files in this
browser; saved designs keep it too. (Checked by exporting: a Value with its own sound and
its own video plays both during Value only.)

### Camera

*Record with the camera* in a clip's **Background ›** or **Photo / video card ›** menu —
and *or record with your camera* under **Upload your own** — opens a recorder. The browser asks for the camera and
microphone (it only can on an `https` page, which Netlify is). The viewfinder is framed
like the current format; **Flip camera** switches front/back on a phone. Record up to
60 s, then **Retake**, **Use as background** or **Use as photo / video card** — the take is
then an upload like any other (it shows in Your uploads and can be cropped, looped,
muted). If access is blocked, the sheet says how to allow it in the address bar.

- **Hook** — the header field is labelled *Hook*; the Body section stays available, so the
  hook can carry a short supporting line (it starts empty — a hook usually lands best with
  the headline alone, and the reading-time length grows if you add a body).
- **Value** — header and body, as many screens as you need.
- **Final CTA** — the header field is the action, the body field an optional
  *supporting line*. Two styles, both in the brand's own colours and type
  (`cta` in `js/brands.js`):
  | | Button | Bold text |
  |---|---|---|
  | Ask Ruth | pink pill, plum Poppins Bold (plum pill + pink type on light-pink grounds) | Bitter Bold |
  | MoshPit | turquoise pill, near-black Roboto Black (swaps on grey grounds) | Roboto Black |
  | T4R Labs | logo-cyan pill, navy Poppins Bold (swaps on low-contrast grounds) | Bitter Bold |
  The button swaps fill and type automatically when the background is too close in
  colour; the supporting line sits on a small cream / dark chip so it reads on any
  pattern. CTA type follows the background (dark type on light grounds, light on dark
  or dimmed ones), not the Text colour switch. The CTA is edited in the panel.
- **Backgrounds** — every screen uses the Hook's background and Dim unless you give it
  its own: pick a background or switch Dim while editing a screen and it applies to
  that screen only (the bar under the timeline says *Own background*; **Match Hook** goes
  back). Changing the Hook's background changes it for every screen that shares it.
  The **Final CTA starts dimmed** (Dim 45 %) so the action stands out.
- **Timing** — each screen has its own time (drag the clip's edge, 1–30 s in 0.5 s
  steps). Defaults follow short-form practice: **Hook 2.5 s** (land it before the first
  swipe), **Value 3.5 s** each (time to read two short lines), **CTA 3 s**. A video's
  length is the sum of the screens in the timeline; the export sheet lists the timeline.
- **Export with 2+ screens in the timeline** — PNG / JPG save one numbered slide per screen;
  **Video** steps through the screens on their timings.
- Screens, their times and CTA style are saved with the design and in Saved designs.

## Text fields grow with their text

Header, body and text-box fields in the panel are as tall as what's in them. They are
never shorter than their rows, and never taller than about 40 % of the screen; past
that they scroll. They refit when you type, when the app fills them (switching section,
Undo, a template, a saved design), and when they appear or the panel changes width.
The canvas editor (typing on the canvas) sizes itself, as before. Code: `wireAutoFit()` /
`fitField()` in `js/app.js`. Tested by `s188`.

## A layout per format: fitted automatically, editable on its own

Every format fits itself automatically, and you can edit any format on its own.

- **Follows until you edit it.** Move something in a format (drag, Tidy up, Align, Space,
  Tidy up selection) and that section's layout in that format is yours
  (`sc.edited[format]`). A format you haven't edited follows the latest one you did. When you
  switch to it, it takes that layout (the same relative spots) and is **fitted**: everything
  is moved inside the safe area, and where things now overlap they are re-spaced top to bottom
  in the same order. Items side by side stay side by side, and each keeps its left-right spot.
- **Edited formats stay as you left them.** Switching back brings that layout back exactly.
- **Nothing edited yet** (a fresh template): each format keeps the spots the template gave it.
  A new item in a format it has no spot for starts from where it is and is nudged clear.
- It's per section: editing the CTA on 16:9 doesn't touch the Hook.
- **Where it's kept.** Header, body, badge and card already had a spot per format
  (`state.pos[format]`). Buttons, text boxes, media and extra badges keep theirs in
  `at[format]`; their `x / y` are always the spots for the format on screen.
- **Code:** `switchLayout(from, to)` from the format dropdown, `followLayout()`,
  `fitLayout()` and `markEdited()`. Tested by `s187`.

There is no "Copy layout from…" any more. Tidy up re-fits a format by hand.

## Pattern spacing

*(v3.1: one **Spacing** sets both, plus **Offset rows**; see What's new.)* An upload used as a **Pattern** has **Horizontal spacing** and **Vertical spacing** (0–200 %
of the tile) under Tile size. The gaps show the background colour. They are saved with the
section's framing (`adjust.gx / gy`), and Reset clears them. The background gallery tile
shows the pattern (with its spacing) instead of the full picture; `drawBgThumb()` /
`refreshBgThumb()`.

## Several items: Multi select

Right-click an item (long-press on a phone) → **Multi select**, or Shift / ⌘-click. The
selection bar offers:
- **Tidy up selection:** one centred column, in the order they're in, evenly spaced (2–5 %),
  kept in the safe area;
- **Align centre**, **Space evenly** (three or more) and **Remove**;
- **Done**.

Every change has **Undo**. On a phone the labels are short (Tidy up · Align · Space) and the
bar wraps to a second row instead of running off the screen. A selection belongs to its
design and section: it's dropped when you switch section, brand or template, open a design
from the start screen, or undo.

## Sizing across formats

**Header and Body hug their text.** The text panel is as wide as its longest line and
never wider than the safe area (body copy also keeps a readable measure of ~26 em on
wide formats). Wherever it is dragged, the text block stays inside the safe area; the
CTA does the same.

Every block is sized from one unit, `unitOf(W, H) = min(W / 1074, H / 1342.5)`:
Reel and 4:5 keep the design size; Square and 16:9 (only 1080 tall) bring the badge,
type, text panel, photo / video card and patterns down to ~80 % together, so the composition
keeps its proportions when you switch format. Nothing is ever larger than 92 % of the
frame — at big Scale values type is set smaller until the block fits — and every block
is kept inside the frame wherever it was dragged.

## The badge: upper badge, image, lower badge

The badge is three parts, each with its own switch under Badge — **Upper badge**
(the "Powered by" pill from the lockup file), **Badge image** (the file from
`logoTop` down; its choice of badge and Scale sit with it) and **Lower badge**, a
text box drawn under it. Any combination shows; hidden parts take no room and the
rest close up (the image never moves; without the image the lower badge lines up
with the pill). Hiding keeps everything — the lower badge's text, colours and
stroke come back as they were.

The lower badge has its text (empty = the brand's name), **Text**, **Background**
(None / transparent or a brand colour), **Stroke** on/off with colour and width
(1–12 px at 1080, drawn outward), **Scale**, and Reset to default. Colours are the
brand's five; each one is independent — picking one never changes the other two.
Its size follows the pill of the badge in use (measured from the file's pixels).

Tap a part on the preview and Badge opens with that part marked (a bar in the
category colour, and an outline on the preview — editor only, never exported);
tapping the lower badge puts the cursor in its text. In full screen the small bar
over a tapped part offers *Hide upper badge / badge image / lower badge*.
All of it is per section (`badgeImage`, `badgeLower`, `badgeUpper` in `SCENE_STYLE`), saved and
in templates. Drawn by `badgeComposition` / `drawBadge` in `render.js`.

**Upper badge text.** Under the Upper badge switch is its text, *Powered by* by
default. With the default (or an empty field) the pill is the artwork itself,
pixel for pixel. With your own words the pill is set again in code: its fill and
text colour, the type size (from the height of the artwork's "Powered by"), the
left edge and the padding are all measured from the badge file's pixels
(`pillOf`), so the new pill matches the artwork and grows or shrinks with the text
(Poppins Medium). Tapping the pill on the preview puts the cursor in its text.
(The MoshPit sticker pills have a faint outer ring in the artwork that the drawn
pill doesn't repeat.)

**More badges.** Under the badge's controls, **Add a badge** places another badge
on the section, in the first free spot. Each extra badge has its own choice of
badge, Scale, Upper badge switch and text, ↓ PNG and remove (with Undo). Drag it on
the preview, and tap it to open its row. On a phone, *Badge* in the canvas's add
menu adds another once the first is on, and the small bar over an extra badge
offers Remove. Extra badges are per section (`badges` in `SCENE_STYLE`), saved
and in templates, exported in videos and carousels, and listed separately under
Export → Items. The section button shows the count (*3 badges*). Each extra badge
has its own **Lower badge** too, with the same controls as the first: text (empty =
the brand's name), Text and Background colours, Stroke (colour, 1–12 px), Scale and
Reset to default. Tapping an extra badge's upper or lower part on the preview puts
the cursor in that part's text.

## Text and background colours

Every colour swatch applies when tapped. (Before, a colour judged low-contrast was
disabled — taps on it did nothing, and which ones were disabled shifted as you
picked.) A low-contrast pair is now only marked with a small amber slash. Text
colour and background are independent: picking a background while the text is on
its default colour keeps the colour the text shows as its own, so the text never
changes by itself.

## Text badge: all three parts are words

Every brand has a **Text** badge at the end of its badge set. Its three parts are all text:

- **Upper badge:** the pill ("Powered by" by default), edited as on every badge.
- **Middle:** a plate with your words. The brand name is the default. The image part is
  labelled **Middle text** while the Text badge is chosen, and it has a text field plus
  **Text** and **Background** colours from the brand swatches.
- **Lower badge:** the text box under it, as on every badge.

Defaults per brand are set in `textBadge` in `js/brands.js`:

| Brand | Plate | Type |
|---|---|---|
| Ask Ruth.AI | plum | pink |
| MoshPit | night | turquoise, Roboto Black |
| T4R Labs | navy | cyan |

The type is the brand's button font.

- **Width:** the plate hugs its words, so longer words make a wider badge at the same type
  size, up to the safe area's width. Past that, the type sets smaller.
- **How it's drawn:** the pill and the plate are drawn into an image shaped like the
  artwork badges (`textBadgeImage()` in `js/render.js`, cached per text and colours, drawn
  at a 420 px plate so 2× exports stay sharp). Because of that, the upper text, the lower
  badge, parts on / off, Scale, Show on, extra badges (each with its own words) and ↓ PNG
  all work unchanged.
- **Where it's stored:**
  - the section's badge: `badgeMiddle` (`{ text, ink, fill }`, per section);
  - an extra badge: `middle` on the badge item.
- Tapping the middle of a text badge on the preview puts the cursor in its words.

## Badge scale

The badge's **Scale** runs from 25 % up to where the badge would fill the frame
(92 % of its width or height). That limit depends on the badge and the format —
a wide lockup tops out around 150 % on a reel, a round portrait or sticker
around 350–380 % (more on 16:9) — and the slider's end follows it
(`badgeScaleMax` in `render.js`).

## Text back to default

Under the text **Style** there is **Reset to default**, and every text box has its
own. It puts back the brand's text style for this section (its Light / Dark and
panel, from the brand's `starter`), clears your own colours and the border, and
sets the sizes to 100 %. The words and the position stay. Undo (toast or ⌘Z)
brings the previous look back. Every **button** card has the same **Reset to
default**: the brand's button colours, no stroke, the brand's corners, 100 % —
its text and position stay, with Undo.

## A section button switches its item on

Opening **Text**, **Buttons**, **Media** or **Badge** while that item is off on the
section switches it on, so the tap shows it straight away: Text comes on (an
empty header gets the brand's copy for the section's role), Buttons adds a first
button, Media shows hidden media again (with no media yet, the upload tiles
open — a file has to be picked), Badge comes on. Closing a section never
switches anything off; the switches inside still do.

## Clear a section

**Clear section** is in a section's menu on the timeline (tap its Hook / Value /
CTA label, right-click or long-press) and in full screen's tap-empty-space menu.
It empties that section — text and text boxes, buttons, media, badge — and keeps
its background, Darken, sound and duration; the section stays in the timeline
(an untimed section then follows its recommended time). It only shows when the
section has something on it. Undo (toast or ⌘Z) brings everything back.

## On a phone: the full-screen creator is the editor

On a phone (≤ 820 px wide) the app opens straight into full-screen edit and stays
there — there is no other editor to close to. The screen is:

- the **top bar** — brand, **Format** (Video or Carousel × Reel / Story, 4:5,
  Square, Desktop) and Export;
- the **full-screen bar** — the section (Hook 1 / 3), **+ Section**, **Preview**,
  the **light / dark** preview background and **More** (Guides, saved designs);
- the **canvas**, as large as the screen allows — any format is scaled to fit,
  never cropped (a 16:9 design shows whole, across the width);
- the **timeline** under it — the only thing that stays there.

Everything else opens from the canvas: tap an element and its controls open in the
sheet (the canvas shrinks above it while it is open and comes back when you tap the
space around it); tap empty space to add **Text** (one box with a header and a body; once it shows, Text adds
another box), a badge, button, media or section, or to change the background (its current settings first, *Change
background* under them); long-press an element for Edit / Hide / Remove. Preview
hides the timeline and every editor mark — a video plays, a carousel swipes (‹ ›
too) — and the eye goes back to Edit on the same section and format. Same project
state as desktop; a wider window goes back to the desktop editor.

## Phones: fields never zoom the page

On touch screens and narrow windows every text field, number field and dropdown
is 16 px. iOS Safari zooms the page in when a smaller field is tapped and leaves
it zoomed, which made the editing sheet look wider than the screen.

## Text centred in its box

Text in a panel or border, buttons and the CTA's supporting-line chip are
centred optically: the space above the capitals of the first line equals the
space under the baseline of the last line (`h1Dy` / `bodyDy` in `measureText`,
`capCentre` for buttons, in `render.js`). Box sizes are unchanged — only the
text moves, by a few pixels; bare text (no panel) is not moved. Descenders (g, y,
p) hang into the bottom space, as in Figma's "cap height to baseline" trim.

## Sharp PNGs

Every drawing (preview, export, item PNGs) resamples with `imageSmoothingQuality
= 'high'` (`smooth()` in `render.js`), so a scaled badge, photo or pattern is
never stair-stepped. Item PNGs (the ↓ PNG buttons and Export → Items) first wait
for the section's full-resolution masters (`hires.js`), like the main export.
Ada, Clara and Jimmy portrait badges have @2x files built from the high-res
portrait art (1440 wide). Still 1× only: the R-mark portrait (720 wide) and the
MoshPit lockups (1369 wide) — they stay smooth but get soft when scaled far past
100 % on a 2× export.

## Save one item as a PNG

Every section's settings have a small **↓ PNG** button: in the head of
Background, Text, Media and Badge, and on each text box, button and media card.
It saves that item alone — transparent, cut to its edges, at 2× (2160 wide for a
reel) — for the section being edited. Export → *Items as separate PNGs* does the
same for a whole section (or all of them) at once, with a full-frame option.

## An uploaded background as a pattern

Under Background, an uploaded picture or clip has **Use the picture as: Full
picture · Pattern**. Pattern repeats it edge to edge: **Tile size** (5–100 % of
the frame's short side), **Mirror tiles** (every other tile flipped so the edges
meet — seamless with any picture) and drag on the preview to shift it. It is
kept with the background's framing (per section, saved, in templates) and
exports like any background. Drawn by `patternFill` in `backdrops.js`.

## Exporting

**Items as separate PNGs** (at the bottom of the Export sheet): every item of a
section — Background (with its Darken), each media, the text and each text box, each
button, the badge — as its own transparent PNG. Tap one to save it, or **Save … as
.zip** for all of them; the chips pick the section, or **All** (one folder per section
in the zip). Each file is cut to its item; **Full frame** keeps the full size with the
item where it sits, for layering in another tool. The Size above (Standard / 2×)
applies. Drawn by `renderItem` in `render.js` — the same drawing as the export, which
itself is unchanged. A video item is saved as its current frame.

**Video or Carousel is decided once, in the Format dropdown** — it is grouped
**Video** (Reel / Story 9:16, Portrait post 4:5, Square 1:1, Desktop 16:9) and
**Carousel** (Reel / Story 9:16, 4:5, 1:1, 16:9), so one choice sets what
you make and its shape, e.g. *Carousel · Portrait post · 1080 × 1350*. Video is the
default, and the choice is remembered with the design. Export doesn't ask again:

- The sheet opens on a **summary** of what will come out: thumbnails of the screens
  (with their times for a video, numbers for a carousel), a **Video** / **Carousel**
  label and the facts it already knows — format, size, length or slide count, MP4/WebM,
  the sound.
- Then only what is left to decide: **Video** → Size, *Mute audio* (when a clip has
  sound) and *Also save a cover image*; **Carousel** → **File type** (PNG / JPG) and
  Size. One button says what happens — *Export 9.0s video*, *Download 3 PNGs*.

**Carousel mode** uses the same editor and the same timeline card, with slides instead
of timed clips: Hook → Value… → Final CTA as numbered still images (each thumbnail in
the post's own shape), no ruler, playhead or sound lane, and no Camera/Sound tools.
Adding, duplicating and removing sections works the same, from the clip's menu.
A design saved as a 9:16 carousel opens as 4:5. Slides download as numbered files
(`…-01-hook-1080x1350.png`).

The sheet closes by itself once the file is saved (it stays open only to show a
recording error). For video with sound there is a **Mute audio** switch — the same
setting as the panel's. The sheet starts fresh each time it opens. If a full-size master is still loading the
button reads "Preparing…" for a moment and then saves.

### Video

The length is the timeline's. Background or photo / video card clips shorter than that loop.

**Cover image.** *Also save a cover image* (on by default) saves the Hook as a JPG next
to the video — a designed title frame to upload as the Reel/TikTok cover. Any screen's
menu on the timeline has **Save as cover image** too. It is the video's size; a clip in
the background is caught at the frame on screen. (Instagram shows Reel covers in the
profile grid cropped to the middle 3:4, so keep the title inside the safe area.)

It records with **MediaRecorder on a canvas stream**, which is the only route that needs
no dependencies and no build step. Two consequences worth knowing:

- **It records in real time.** A 10 second clip takes 10 seconds. The button reports
  progress while it runs.
- **Frames are pushed, not sampled.** The canvas stream is opened at 0 fps and a frame
  is handed over explicitly after each paint, on a fixed 30 fps timer. Letting the
  browser sample the canvas on its own produced empty recordings whenever the page lost
  focus, and `requestAnimationFrame` stalls for the same reason. An export that comes
  back with no data reports it instead of saving a broken file.
- **The container depends on the browser.** MP4 is preferred and is what Chrome 126+
  and Safari produce. Older browsers only offer WebM, which most social uploaders
  reject — the app tells you which one you got, and the sheet says so before you start.

**Loop** (on by default) fills the whole export length and keeps the preview running;
with it off a clip plays once and holds its last frame, so a 10 second export of a
4 second clip gives you 4 seconds of motion and 6 of freeze. **Mute audio** drops the
audio track entirely.

**Uploaded videos keep their sound.** In the export, each screen plays the sound of the
clip it shows — the Hook's clip during the Hook, the Value screen's own clip during Value,
and so on — mixed with the music if you added one. A screen whose clip differs from the one
before starts that clip from the top, picture and sound together; a background shared by
several screens just keeps running. (Checked by exporting a 440 Hz clip on the Hook and a
1500 Hz clip on Value: the film's audio switches exactly at the cut.) If both the backdrop
and the card are clips, the backdrop's audio is the one used.

On the page, clips loop **silently** — browsers only autoplay muted video, and a looping
soundtrack while you edit would be noise. Press **Play** on the timeline to hear the clip
on screen (and the music). Exporting itself stays silent: the sound goes into the
recorder, not your speakers. **Mute audio** turns the clips' sound off everywhere.

PNG and JPG still work with a clip loaded — they capture the frame showing at that
moment.

## Where your footage is kept

Uploads, camera recordings and sounds are stored **in this browser, on this device**
(IndexedDB) — nothing is uploaded anywhere, and Netlify only serves the app.

- **How much:** the app takes clips up to 200 MB each (over 120 MB, or above 1080p, it shows a heads-up that playback and export may stutter on phones). Beyond that the limit is the
  browser's share of the disk — up to ~60 % of the disk in Chrome, Edge and Safari,
  10 % (max 10 GiB) in Firefox until storage is made persistent — so in practice
  dozens of clips. The note
  under **Upload your own** shows how much is in use.
- **Kept, not exported:** you do not need to export a clip to keep it. It stays until
  you remove it (×) or clear the site's data. The first upload asks the browser for
  *persistent* storage, so it is not cleared on its own when space runs low; where
  the browser declines, the note says so. **Safari is the exception:** it deletes
  script-stored data for a site that hasn't been used in 7 days of browsing (Home
  Screen web apps are spared), so on Safari, export anything you need to keep.
- **Saved designs keep their media:** a saved design references its background clip,
  photo / video card clip and sound by id, so opening it brings them back — on the same
  browser. Designs don't travel to another device or browser with their media; export
  the video (or keep the original files) for that. If a clip a design uses was
  removed, the design falls back to a built-in background.

## Saved designs (templates)

**More than four?** A **Show all N** link appears under the row and opens every saved design
in the same modal as Backgrounds and Badges — open one (the modal closes) or delete the ones
you no longer need (it stays open).


Name a design and tap **Save** in the **Saved designs** section at the bottom of the
panel. Saved designs appear newest first in its carousel; tap a card to open it, × to
delete it. (The header bookmark was removed — this section does the same job.) Same storage as before (`askruth.backdrop-studio.templates.v1`).

### Templates

**Templates** at the bottom of the controls saves the whole design — brand, backdrop,
copy, layout, every slider and toggle, across all four formats — under a name, with a
thumbnail. Click one to restore it; the × deletes it. A template saved under one brand
switches back to that brand when you apply it.

Templates live in `localStorage` on that browser, so they do not sync between machines
or between the hosted version and your Netlify deploy. Media is referenced by upload
id: a template whose photo or clip has since been deleted falls back to a built-in
backdrop rather than rendering nothing. If the browser runs out of storage the oldest
thumbnails are dropped before any template is, and if it still will not fit you are
told rather than silently losing the save.

## On a phone

The layout reorders to **preview → backdrop picker → controls**, and two things
change to keep the scrolling short:

- **The preview sticks** under the top bar and stays there while you scroll the
  controls, so a slider and its result are on screen together. It gives up height for
  that — 36% of the viewport instead of 52%. In landscape, where there is no vertical
  room to spare, it scrolls away with everything else instead.
- **The backdrop picker is one swipeable row** rather than a grid that pushes every
  control below the fold. It bleeds to the panel edges so it reads as continuing, and
  the selected swatch scrolls itself into view after a reload or a brand switch.

The sticky offset is the top bar's **measured** height, not a magic number — it moves
with the webfont, a longer brand name and the phone's own text-size setting.

## Menus and sheets sit on a scrim

What opens on top of the page sits on a scrim: a tap on it closes what is open, and it
fades out instead of vanishing, so that tap can't land on a button underneath.

- **Menus and dialogs** (the clip and sound menus, Export, Camera) use the brand's full
  `--scrim`, which tones the page and the preview down.
- **Editing** happens where the preview stays readable: the phone's section sheet has only a light tint
  over the preview, and the colour popup leaves the preview clear (on a phone it sits
  below the preview), so what you pick is judged on the design.

## More text: several headers per screen

Any screen (video section or carousel slide) can carry **more than one header with its
body** — *Add header & body* under **More text** in the Text section. Each extra block is
set exactly like the first (type, size, colours, Header or Header + body — adding one
switches the text on as Header + body) and placed on its own: it starts under the existing text, and you drag it
on the preview. Tap it on the preview to edit it in the panel; long-press it for *Edit* /
*Remove this text block*; the bin in its panel row removes it too. Each screen has its own
blocks, and they are in every export.

**Each block has its own style.** In its panel row: **Style** Light / Dark and **Panel**
on/off, and a palette button in each of its fields for its own text colour, background
and border (the same popup as the first text, titled *Text 2 · Header colours* …). A new
block starts with the first text's style, copied when it is made; after that they are
independent — changing **Text style** changes the first header and body only (the group
says so once there are more). Blocks from designs saved before this follow the first text
until their style is first changed.


Each extra text has its own Style (Light / Dark and panel) at the top of its card,
and its own Scale for its header and its body (as well as its own
colours, borders, Light / Dark and panel), so every header on a screen can be
sized on its own. In full screen, tapping an extra text opens its own controls.

## The timeline is a card

The timeline takes the panel's own colour and hairline in every brand — plum in Ask Ruth,
graphite in MoshPit, white in T4R Labs — so it reads as one family with the controls
below it. The **sound track** takes a deep colour from each brand's own swatches (Ask Ruth
Magenta, MoshPit Teal, T4R Labs Violet), dark enough for the white waveform.

## Desktop layout

On a wide screen the editor fits the window like a video editor. The **panel** on the
right runs the **full height** of the window under the top bar and scrolls on its own. The
**preview** and the **timeline** (with its section and sound bars) share the column to its
left: the timeline sits under the preview and ends where the panel starts, for video and
carousel alike. On a phone the full-screen creator is the editor (see above).

## Section buttons, selection and colours

Switching sections on the timeline (Hook, Value, CTA) scrolls the panel back to
the top, so the section buttons are in view after every switch.


**Format** is the one button that is a dropdown: tapping it opens the list of
formats straight away (an invisible select over the button, mirroring the Format
select), with no section to open.


**Section buttons** — five buttons at the top of the controls, three above two: **Format ·
Background · Badge** / **Text · Photo/Video** — each with its current value underneath
(*Video · 9:16*, *Pattern Pink*, the header's first words, *Off* …).

**Text** is one section for all the words on a screen: a **Text** switch, then the header
(named *Hook* / *Call to action* on those screens), the body, **More text** and **Text style**.
There is no Header / Header + body choice: leave the body empty and there is no body.

With nothing open the panel only
shows the buttons, **Safe-area guides** and **Saved designs**. A button opens its section:

- **Desktop** — right under the buttons, above Safe-area guides, in a quiet box; the
  open button gets an accent ring. One section at a time: another button switches,
  the same button (or Esc) closes it.
- **Phone** — in a **sheet docked under the preview**: from just under the preview to the bottom of the screen (over the timeline),
  never over the preview, which stays visible (toned down by the scrim). A tap outside it (on the scrim), a swipe down on the handle or Esc closes it — there is
  no Done button.

**A section's options are always there.** Badge, Text and Photo / Video Card show all their
options as soon as you open the section, even with the element switched off (faded a
little). Using any of them — a tap, a pick, typing, a slider — switches it on first.

The open section holds the very same controls (they are moved in while it is open and put
back when it closes), so there is still only one copy of every control and its state.

**See it → tap it → edit it.** Tapping something on the preview selects it and opens its
section; dragging it only selects it (on desktop, an open section follows). Foreground
first: the badge, the header, the body and the photo / video card are picked before
the background, which is selected only where nothing else is. The selected element
gets a thin white outline on the preview — **never in an export** (verified
pixel-for-pixel); Esc clears it.

**Long-press (or right-click) on the preview** opens a menu for what is under your finger:

- **Header / Body** — *Edit*, *Header only* (on the body: hides the body on every screen),
  *Hide text* (the Text switch, on every screen — it brings it back) and *Remove from
  <screen>* (clears this screen's text only).
- **Photo / Video Card** — *Edit*, *Hide* (keeps it) and *Remove from <screen>*.
- **Badge** — *Edit*, *Hide*.
- **Background** — *Edit*, and *Use the Hook's background* on a screen with its own.

A long-press doesn't move or open what you pressed, and the phone's own callout is
suppressed on the preview.

**Header and Body colours — the palette button in the field.** A small palette button sits
inside the Header and the Body field (its dot shows the text colour in effect). It opens
one popup for that part — on desktop centred in the adjustments panel, with only the panel
toned down so the colours are in focus and the preview stays clear; on a phone a sheet below
the preview:

- **Text** — the text colour (Header and Body each have their own).
- **Background** — the card behind the **whole text box** (Header and Body together), or **None** (text straight on the composition). It's the same from either popup; picking one keeps both text colours as they are.
- **Border** — a line around the text box, drawn **outside** it (the text keeps all its room): **width** 0–16 px (at 1080 px wide; 0 is off)
  and its own **colour** (until you pick one it follows the text colour; picking a colour
  with the width at 0 turns it on at 4 px). Without a card the border still frames the
  text, with the card's padding. The border goes round the **whole text box**: Header and
  Body are always one box, so setting it from either popup sets it for both.

Header and Body are always **one text box**: one background, one border, one position.
Text colour and size stay separate per part. Each extra text box works the same way.

Every row offers **five colours from the brand's palette** (`swatches` in `js/brands.js`),
then **your own colours**: **+** opens the system colour picker, applies the colour as you
move it, and keeps it. **Tap one of your colours again once it's in use to change it** (a small
dot marks it as editable; the change replaces it in your colours), and its **×** removes it
from your colours (designs that use it keep it) (up to 8, newest first, on this browser, for every brand —
`askruth.backdrop-studio.colors.v1`). There is no Auto chip: until you pick a swatch the row shows the colour
in effect (set by Text style — Light/Dark and Text panel — exactly as before):

| | Swatches |
|---|---|
| Ask Ruth | Cream · Blush · Pink · Magenta · Plum |
| MoshPit | Paper · Turquoise · Pink · Teal · Night (moshpit.dev Color variables) |
| T4R Labs | White · Cyan · Pink · Violet · Navy |

A card colour picked by hand brings a readable text colour with it (unless you picked
one); text colours that would be hard to read on what they sit on (contrast under
2.5:1) are greyed out, and so are card colours that would swallow a text colour you
chose. When Header and Body end up on different surfaces they get a card each, each
hugging its own text. Colours are saved with the design, per brand.

**Picture backgrounds: scale → position → crop.** Under Background, artwork and your
own photos/clips have **Scale** (up to 800 %), **Left · Right** and **Up · Down** (the
same continuous position the preview drag sets — 0 is centred) and **Reset framing**
(scale and position back). Around a moved picture shows the artwork's own colour. Scaling keeps the
position; nothing else resets the framing. Patterns keep their own **Scale**.

## Each section keeps its own look

Hook, Value and CTA sections are each fully their own: background (with its crop
and pattern scale) and Dim, badge (on/off, style, “Powered by”, scale), text
(on/off, Header + body, sizes, where things sit), Header and Body colours (text
and box), borders, Text style (Light / Dark, Text panel), buttons, photo / video
card and extra text. Switching
sections or modes never resets them; a new section starts from the one you were
on, and Duplicate copies them. The brand stays project-wide. (They live on each
entry of `state.scenes` — `textColors`, `cardColors`, `borders`, `textTone`,
`card`, `buttons`, `badge`, `badgeLast`, `badgeScale`, `badgePowered`,
`visibility`, `textMode`, `h1Scale`, `bodyScale`, `pos`, and `adj[backgroundId]` — mirrored into the top-level state
while a section is edited, exactly like its card and extra text.)

## Section colours (editor only)

Hook is amber, Value sky blue, CTA pink: on the timeline clips, on the
"Editing …" line above the section buttons, and as the outline around the
element you selected on the preview. Exports never draw it.

## Buttons

Buttons are their own elements, under their own section button — **Buttons**,
next to Text — and that is the only place a button is made: text is always
text. Any section (Hook, Value or CTA) can have one or more. **Add button** puts
one on the section you are editing; each has its text, its place (drag it on the
preview) and its own look: text colour, button colour, stroke colour and width
(0–16 px, drawn outward), corners (Square → Pill; the brand's default is a pill —
`cta.button.radius` in brands.js) and scale. The colours are the brand's five
plus your own. Left on the brand's colours, a button swaps them on a ground it
would vanish into (Ask Ruth's pink pill on a pink pattern becomes plum); a colour
you pick stays as picked. *Back to the brand's button* resets the look. In full
screen, tap the background → **Button** to add one, or tap a button for its
controls (and Remove).

A CTA section's header and body are text, set big like a call to action. Older
designs whose CTA was in Button style open with that header turned into a button
(same text and look), the supporting line left as text. Buttons live on each
section as `buttons: [{ id, text, x, y, look }]`.

## Full-screen edit and Preview

On desktop, tapping an item in full screen opens its controls in the panel on the
right (the editor's full-height panel goes back to normal flow in full screen, so
the side panel shows above the stage), and the canvas shrinks to fit beside the
open panel, whatever the format.


The ⤢ button beside the preview opens **Full-Screen Edit**: the canvas large,
‹ › to step through sections, and nothing else in the way. Drag things as
usual. Tap the background to change it (this section only — or go back to the
first section's), or to add Text (header and body in one box), a Badge, Button, Section (after
this one) or Photo / video card; tap an element and its controls open straight away — beside the canvas on a
wide screen, under it on a phone — with a small Remove button over the element
(this section only).

A tap on the empty space around the canvas closes the open section.

**+ Section** (next to ‹ ›) adds a Hook, Value or CTA right after the section
shown and opens it; the toast offers Undo. It is hidden in Preview.

On a wide screen the full-screen bar also has **Export** (the same export as the
top bar; its sheet opens over full screen).

**Preview** shows the design exactly as it exports — no guides or outlines. A
video plays on the normal playback engine (tap the canvas or ⏯ to pause); a
carousel swipes, or use ‹ › and the arrow keys. Esc or × goes back one step:
Preview → Full-Screen Edit → the editor. All three share the same state.

## Background sheet on a phone

The current background's settings (scale / crop, Dim, video) come first; the
gallery, colours and upload follow under **Change background**.

## Editing on the canvas

**Tap anything on the preview to jump to its settings.** The panel scrolls to that
section and outlines it for a moment: the badge → **Badge**, the header → **Header**
(or *Hook* / *Call to action*), the body → **Body**, the photo / video card → **Photo / Video Card**,
anywhere else → **Background**. On a phone the section stops just below the sticky
preview, so you see both.

**Move a picture background in any direction.** On artwork and your own photos and
clips, drag the picture on the preview left, right, up or down. Within what the fill
crops off it just changes the crop; past that the picture itself moves and the
background colour shows around it (up to half the frame). It clicks back into place
when you bring it within ~1.5 % of filling the frame, and a **double-tap** on it centres
it again. The **Scale** slider still zooms in for a closer crop.

**Tap the header or the body** on the preview to edit it right there. The editor sits
exactly over the text, in its own face, size and colour; it types into the same fields
as the panel, so the two always match. **Esc** puts the text back; clicking anywhere
else (or **⌘/Ctrl + Enter**) keeps it. **Enter** makes a new line, as in the panel.

Tapping and dragging share the same gesture, so a press only becomes a drag once it has
moved **6 screen pixels**. Short of that it is a tap: the editor opens and nothing moves —
a tap can no longer nudge the layout by accident. On a phone, where the preview type is
too small to edit at, the editor grows to 16 px (smaller and iOS zooms the page into it)
and floats over the text as a card.

## Positioning

Positions for the badge, the text and the photo / video card are stored as fractions of the
canvas, **per format**, so each format remembers its own layout and nothing jumps when you resize. They persist in
`localStorage`.

While dragging, blocks snap to the horizontal centre and to the safe-area edges.
**Safe-area guides** (on by default) draws the box that platform chrome won't cover —
tighter for 9:16 (top 14 %, bottom 28 %, sides 12 %) than for the other formats, which just
use a 6 % margin. The 9:16 box allows for what Reels, TikTok and Shorts lay over the frame:
labels at the top, the account / caption / sound lines at the bottom, and the right-hand
action rail (TikTok's takes ~12 % of the width). The sides are even, so centred layouts
stay on the frame's centre line, at the cost of 12 % on the left that only the rail needs
on the right. Text on 9:16 wraps to this width, so 9:16 type sets a little narrower than
before (2026-10-05). It is a thin dashed line, about 1 screen pixel wide whatever the preview size,
and it is **only ever drawn on the preview** — images, slides and videos never include it.

## Re-exporting artwork from Figma

Drop replacements into `assets/` under the same filenames and nothing else changes.

**Patterns.** If you re-export a `BG_Pattern`, the tile has to be re-cut at the
artwork's repeat — a straight frame export is a crop, not a tile, and will show seams.
`tools/make-tiles.py` finds the repeat to subpixel precision and writes the tile.

**Compositions.** Export each `BG_Image` twice, portrait and landscape, as
`assets/bg-<name>-portrait.jpg` and `-landscape.jpg`.

**Badge.** Export the two lockup frames as `assets/badge-plum.png` and
`badge-cream.png`, trimmed to the artwork with transparency. The app reads their
natural aspect ratio, so the proportions follow the file.

## High-resolution masters

Every asset ships at a light 1× size so the studio opens fast. Next to most of them
sits a sharper master with the same name plus `@2x` (compositions, lockups, stickers)
or `@3x` (pattern tiles) — e.g. `t4r/labs-navy-portrait@2x.webp`, `pattern-pink@3x.png`.
`js/hires.js` maps each 1× file to its master. The app fetches the master only for the backdrop and badge
in use and swaps it in when it arrives; an export started before that waits for it
(the button reads "Preparing…"), so a 2× (2160 px) export is drawn from the master.

- Compositions: 2136 × 4656 portrait, 3840 wide landscape (WebP, to keep the deploy
  small), rendered from the Figma frames at 2×.
- Pattern tiles: cut at the true repeat from 3× Figma renders — they stay crisp up to
  the pattern scale's 200 %. `density()` in `assets.js` measures the master against
  the 1× tile, so the motif is drawn at the same size either way.
- Lockups and stickers: 2× (Ask Ruth from the vector badge, T4R from the vector
  logo, stickers from the full-size originals).
- Still at 1× because the source art is no bigger: the MoshPit lockups (1236 px logo
  file), the round portrait badges and the full Ada / Clara / Jimmy portraits
  (1200 px illustrations). The portraits and round badges are sharp at every size; the
  MoshPit lockups soften slightly only in a 2× export with the badge scaled past 100 %.

When you add an asset, add its master beside it and a line to `js/hires.js` (`'1× path': 'master path'`) — or
leave it out, and that asset simply stays at 1×.

## Video placeholder

A clip has no frame to draw until the browser has decoded one — as a backdrop or in the
photo / video card. Rather than a blank rectangle in that gap, the canvas shows **SMPTE colour
bars**, which read as "video, loading" at a glance. They come from `drawColourBars()` in
`js/backdrops.js` and go through the same `render()` as everything else, so the preview
and a still exported at that instant agree.

## Adding a brand

Drop the files under `assets/<brand>/` and add an entry to `BRANDS` in `js/brands.js`:

```js
moshpit: {
  id: 'moshpit',
  name: 'moshpit.dev',
  palette: { ink, plum, magenta, mauve, orchid, pink, blush, lilac, cream,
             bodyOnDark, bodyOnLight },   // same 11 slots as Ask Ruth
  assets:  { 'pattern-grit': 'assets/moshpit/pattern-grit.png', … },
  badges:  { dark: { asset: 'badge-dark', label: 'Dark' } },   // {} for none
  backdrops: [ … ],                        // same shape as below
}
```

Give it `proposals` for Start new: the first is the brand template, e.g.
`{ id: 'template', name: 'moshpit.dev template', bg: 'pattern-grit', badge: 'dark', card: true, tone: 'light', dim: 0.3, ctaBg: 'solid-night' }`
(`tone` is the text colour, `card` the panel, `dim` the Darken, `ctaBg` the CTA's own
background). Add `button` to the starter's `cta` copy for the template button's words.

Give it an `icon` (a square image path) or, until there is a logo, a short `mono` monogram. It appears in the header dropdown; nothing else needs touching. Drop `provisional`
and `note` once the artwork is real — they are what draws the placeholder warning.

## Adding a backdrop

Append an entry to that brand's `backdrops` array in `js/brands.js`:

```js
{ id: 'new-one', name: 'New One',
  kind: 'art',            // tile | art | solid
  asset: 'new-one',       // assets/bg-new-one-{portrait,landscape}.jpg
  base: '#4a0649',        // shows while the image loads
  badge: 'cream',         // cream | plum
  card:  'none',          // none | plum | ink | mauve | cream
  tone:  'dark' }         // dark ground → light type
```

The thumbnail, the picker and the export all pick it up automatically.

## Fonts

- **H1** — Bitter SemiBold, matching your `Heading/H1/Serif/Semi-bold` style.
- **Body** — Poppins SemiBold. Sans, to match the wordmark rather than the heading.
- **Studio UI** — Poppins.

Per brand (set with `type` in `js/brands.js`; anything left out uses the above):

| Brand | Header | Body |
|---|---|---|
| Ask Ruth.AI | Bitter SemiBold | Poppins SemiBold |
| T4R Labs | Bitter SemiBold (same as Ask Ruth) | Poppins SemiBold |
| MoshPit | Roboto Black, 68 px / 1.16 — no serifs | Poppins SemiBold |

Roboto runs wider than Bitter, so MoshPit's header sets a touch smaller (68 vs 72)
to keep the same line breaks. The Figma text style is `Backdrop/H1 MoshPit`.

All load from Google Fonts. The badge needs no font — the wordmark is artwork.

Semibold sans sets denser than the serif body did, so the body line height is 1.42
rather than 1.55, and the bullet dot is both larger and higher: Poppins carries more
weight and a taller x-height, and a dot tuned for Bitter reads as a full stop beside
it. Those live as `lh`, `bullet` and `bulletY` per font in `js/render.js`, so swapping
a face is one line plus its three numbers.

Canvas measures text, so the first paint waits for both faces to be resident —
otherwise line breaks would be computed against a fallback and then shift.

## Icons in popups and sheets

Popups and sheets use chunky icons so they read at a glance on a phone: menu icons (clip
menu, add menu, long-press, Remove) sit in 30 px circles at 17 px with a 2.5 px stroke;
the close buttons on the Export, Camera and Show-all sheets (and the desktop full-screen
panel) draw a bold × instead of a text glyph; the PNG, colour, delete and record icons in
the editing sheets carry heavier strokes. The phone's section sheet still closes from its
handle, with no ×.

## Template copy

Each brand's Hook / Value / CTA words come from `starter` in `js/brands.js`.
Draft copy went in on 2026-10-05 for Marco to edit:

| Brand | Hook | Value | CTA (headline · button) |
|---|---|---|---|
| Ask Ruth.AI | Stuck on a design call? | Ask Ruth · Honest feedback in seconds / Grounded in design principles | Get a second opinion · Ask Ruth now |
| MoshPit | Your AI crew is waiting | Meet your cogents · Jimmy starts every project / Ada, Clara and Ruth join in | Enter the pit · moshpit.dev |
| T4R Labs | Fresh out of the lab | What we're building · Small ideas, shipped fast / Shared while they're raw | Follow the experiments · Follow the lab |

## Placeholder text

Switching text on (the Text switch, the Text section button, or **Text** in the canvas's
add menu) fills an empty header or body with placeholder copy (the brand's starter
copy for that section, or *Your header* / *A short line to go with it*), so the box
shows straight away with both parts and you edit from there. This applies on every section,
the Hook included. A part you clear yourself while the text is on stays empty. New
buttons start as *Learn more*, and new text boxes as *Another header / And a line to
go with it*.

## Start screen: continue or create

Opening the studio lands on a minimal start screen. It answers two questions:
*what do you want to continue?* and *what do you want to create?* The brand mark (top
left in the editor) brings it back.

- **Recent** (first, largest): the design open now (*Open now*), each other brand's
  working design, and the designs you had before. Each tile shows the design's own
  artwork, its name (its first headline), Video / Carousel, the brand mark and how long
  ago. Tapping a tile opens that project straight in the editor (brand, type, format,
  sections, text, styling, media, everything). The design you leave moves into Recent,
  so the two swap places and nothing is duplicated.
- **Saved** (smaller): designs saved by name (*Saved designs* in the panel).
- **Create new:** one card per brand (Ask Ruth.AI, MoshPit, T4R Labs) with **Video** and
  **Carousel**. A tap opens that brand's template in the editor as a video or a
  carousel, both starting as a Reel (9:16). Nothing is asked again. Format (Reel / Square / Desktop) is changed in
  the editor as before.
- **Show all** (when there is more than the screen shows): every recent and saved design
  in a modal, or a bottom sheet on a phone, with **All | Recent | Saved**.
- **First visit:** nothing to continue, so only *What do you want to create?* with the
  brand cards. No empty Recent or Saved sections. They appear as you work.
- **Phone:** one column; project rows scroll sideways; Show all is a near-full-screen sheet.

**No second store.** The screen reads what the studio already keeps:

- the open design (the main saved state);
- `state.designs` (one working design per brand, now with a still, the time, the type and
  the format when you leave it);
- the saved-designs list. Its automatic entries (`lastSession`, named *Recent · …*) used to
  be one per brand; now the newest 8 are kept, each with a still, and they never push out
  designs saved by name.

An untouched start (`pristine`) isn't kept.

**Stills.** Only one brand's artwork is ever loaded, so a still can only be drawn for the
brand that is open. Designs from before stills were kept get theirs when their brand is
open: tiles of the open brand draw one on the spot, and opening a brand fills in its
designs' missing stills (`fillBrandStills()`). Until then a tile shows the brand mark; it
never shows another brand's artwork.

**Brand marks.** MoshPit and T4R Labs are round badges and show in a circle. Ask Ruth's mark
is a speech bubble, so the start screen shows it whole on transparent, with no circle and
no backing (`mark` in `js/brands.js` → `assets/brand-askruth-mark.png`, cut from the
badge artwork).

**Code:** *start screen* in `js/app.js`:

- `homeItems()`, `openHomeItem()`, `createProject()` and `keepLastSession()`;
- `pushRecent()` and `archiveBrandDesign()`;
- `renderHome()`, `openHome()` and `openHomeAll()`.

**Tests:** `?debug` opens the editor directly (as the older scripts expect);
`?debug&home` shows the start screen (`s186`). `s187` covers a layout per format; `s188` growing text fields and where the template badge goes; `s189` the whole Ask Ruth mark and stills for older designs; `s190` Reel defaults, pattern spacing, Multi select and Tidy up selection.

## Start new: designs from the brand's own pieces

**Start new** (in the panel under Tidy up; on a phone under ⋯; and in the "Restored
your last design" note) opens a sheet of starting designs. Each card shows that
design's Hook, Value and CTA in the format you're in.

- **The brand template** comes first. A first launch opens on it, and so does a
  brand's first open after a switch.
- **Curated proposals** follow: four more per brand (`proposals` in `js/brands.js`),
  each a different pairing of the brand's background, badge, text style (Light / Dark,
  panel or not), Darken and a CTA background.
- **Shuffle** keeps the template and draws four new ones from the same pieces, only in
  pairings that read:
  - With the panel, the panel contrasts with its ground: cream on dark grounds, dark on light ones.
  - Without the panel, the text takes whichever of light or dark has the higher contrast with the ground.
  - Bare text on a pattern or artwork always gets at least a 0.55 Darken. This applies to curated proposals too.
  - The plain lockups (Dark / Light) come in the colour the ground asks for. Stickers and portraits go anywhere except on their own face.
  - The CTA goes on a solid colour of the other tone, so its line and button stand out.
- **Blank** is the empty start (everything off; the brand's copy is ready underneath).

Picking one keeps what you had under Saved designs as *Last session · brand* (unless
it was an untouched start) and says *Started from …* with **Undo**. The brand and the
format stay as they are.

**What's on each section** (by role):

| Section | Pieces | Sizes |
|---|---|---|
| Hook | logo alone (no upper / lower badge) on top, headline | headline 120 %, logo 120 % (as wide as the 9:16 safe area allows) |
| Value | headline + body | 115 % |
| CTA | headline, *Powered by* badge with lower badge, button | headline 115 %, badge 80 %, button 130 % |

**Where the badge goes** (`columnOrder()`): a **logo on its own** (upper and lower badge
both off) leads the column, at the top, and is set larger. A badge that says
**Powered by …** (or has a lower badge) is an endorsement, so it sits **between the text
and the button**.

**Placement.** Every section is placed for **every format** when the design is made:
one centred column inside the safe area, in that order, with even gaps of 2–5 %
of the frame height. The Hook's column sits a little above the middle of the free
height (40 %); Value and CTA are centred.

A template button keeps the template's spot for each format (`tpl` on the button). Since
v2.6 every item keeps its own spot per format anyway (*A layout per format*); `tpl` is what
a format you haven't arranged yet starts from, as long as the button still sits where the
template put it.

The code is in `js/app.js` under *start from…*: `proposalData()` builds and places a
design, `arrangeColumn()` places one section, `shuffledRecipes()`, `designFrames()`
(sheet thumbnails), `openStartSheet()` and `chooseStart()`.

**Tests:** `?debug` alone keeps the old empty start, so the regression scripts written
for it still hold. `?debug&template` gives what everyone else sees.

## Grid

**Grid** sits next to Guides (on a phone: ⋯) and is editor only; it's never exported.
It draws:

- **centre lines:** amber, dashed;
- **thirds** of the frame: white, dotted;
- **a column grid** inside the safe area: 4 columns on 9:16, 6 on 4:5 and 1:1, and 12 on
  16:9, with gutters (`GRID_COLS` and `gridLines()` in `js/render.js`).

While it's on, dragging snaps an item's centre, left or right edge to the vertical lines,
and its top, middle or bottom to the horizontal ones, within about 7 screen pixels. The
line it snapped to lights up pink. The existing snaps (centre, safe-area top and bottom)
still apply with the grid off. Lines are drawn with a faint dark twin so they read on
any background. The setting is `state.grid` and is kept with the design.

## Show on: one item on some or every section (removed in v3.0)

*Removed in v3.0; kept here for the history of older designs.*

Every button, text box, media item and extra badge has a **Show on** row in its card,
and so do the section's own badge (top of Badge) and media (top of Media):
`Show on  [Hook] [Value] [CTA] [All]`. It only shows when there is more than one section.

- Tap a section to put the item there or take it off. **All** puts it on every
  section, and sections added later get it too. Tap **All** again to go back to this
  section only.
- The section you're editing is always on. It's outlined and can't be tapped; the
  card's trash button takes the item off this section only.
- **Linked:** copies share the item's id (`linked: true` on each copy, `share: 'all'`
  when it's on every section). An edit on one section (text, colours, size, stroke,
  badge choice, upper / lower badge) reaches every section it's on, via `propagateLinked()`
  after each edit.
- **Position stays per section.** Sections have different layouts, so moving a shared
  item moves it on this section only. When it's put on a section, it keeps its spot if
  that's free there, or moves to the nearest free spot inside the safe area
  (`placeClear()`, in the format on screen).
- The section's own badge and media are linked with `badgeLinked` / `insetLinked` on
  the section (`'all'` for every section).
- On the preview, a selected shared item has a small tag on its outline: *On 2 sections*
  or *On every section*. It's editor only.
- The main header / body is each section's own message, so it has no Show on row.
  Use a text box for a line that repeats.
- Undo covers every change.

## Order of the sections

- **Desktop:** drag a clip along the timeline. It lifts, follows the pointer (the
  timeline scrolls at its edges), and a line shows where it will land.
- **Phone / touch:** hold a clip (its menu opens), then drag it. A plain swipe still
  scrolls the timeline.
- **Everywhere:** **Move earlier** / **Move later** in the clip's menu.
- Each section keeps the background, Darken and framing it shows. The new first section's
  background becomes the shared one that sections without their own use. Sounds fitted
  to the sections are re-timed. **Undo** puts the order back. The code is `moveScene()`
  plus `startClipDrag()` / `moveClipDrag()` / `endClipDrag()`.

## Tidy up

**Tidy up** puts the section on screen in order, in the format you're looking at.
It's under Guides in the panel (on a phone: ⋯), in a section's clip menu, and in
the canvas's add menu (tap empty space).

- Everything goes into one **centred column** inside the safe area, keeping the
  order it already has from top to bottom.
- Gaps are **even**: up to 4.5 % of the frame height when there is room, down to
  1.2 % when it's full.
- Badges, buttons and media that follow each other in that order **share a row
  side by side** when they fit across the safe area, spread evenly and centred.
  Text and text boxes always have a row of their own.
- Nothing is resized unless the column can't fit even with tight gaps. Then
  everything is made a little smaller until it fits, and the note says *Tidied —
  made smaller to fit*. Sizes belong to the section rather than to one format,
  so that also makes them smaller in the other formats.
- Positions are per format, so tidying 9:16 leaves 1:1 and 16:9 as they were.
- **Undo** puts everything back (sizes too).

## Browser colour

The browser's own colour (Safari's tab bar, the phone's address bar, the area past
the page's edges) is the brand's studio background: Ask Ruth.AI plum `#2a0129`,
MoshPit charcoal `#262624`, T4R Labs light `#eff3f8`. It's set before the first
paint from the saved brand (a small script in `index.html` reads `--ui-bg`) and
follows every brand switch. Before, the page started with Ask Ruth's purple in its
`theme-color`, and browsers that read it on load kept it.

## Selecting on the preview

**The selected item, in view.** Tapping an item on the preview opens its section
and scrolls the panel (the editor's panel, the full-screen panel or the phone's
sheet) until the item's own controls are in view: an extra badge's row, a
button's, a text box's, a media item's. Every strip of thumbnails in it slides
to the one in use (an extra badge's style, the badge choice, the background).

**Several at once.**
- Desktop: **Shift-click** (or ⌘ / Ctrl-click) adds an item to the selection or
  takes it out. Phone: long-press an item → **Select more**, then tap others.
- Every selected item gets an outline, and a small bar offers **Align centre**
  (each centred across the frame), **Space evenly** (three or more: even gaps
  between the top and bottom ones), **Remove N** and **Done**.
- Dragging any selected item moves them all together.
- **Delete** / Backspace removes them, **Esc** clears the selection, and a plain
  click on another item goes back to one at a time.
- Remove takes extra badges, buttons, media and text boxes away. The section's
  own text, badge and first media are hidden instead (their switches bring them
  back). Undo covers all of it.

Tidy up, Align centre and Space evenly measure again after moving and correct
until every box lands exactly where it was meant to. An item that started
outside the frame is drawn pushed back inside it, so moving it by the difference
alone could leave it short.

