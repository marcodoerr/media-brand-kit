/* ==========================================================================
   app.js — state, UI wiring, dragging, export.
   ========================================================================== */

import { wireAppearance } from './v4/appearance.js';
import { prepareStoryboard, sentencesOf, bodyOf, sepBetween, sourceWords, STORYBOARD_LIMITS } from './v4/storyboard.js';
import { loadPptxGen, buildPptx, writePptx, fontOf, TEXT_SLACK } from './v4/pptx.js';
import {
  builtIns, byId, allBackdrops, registerUpload, unregisterUpload,
  OVERLAYS, overlayStyle, DEFAULT_ADJUST, croppable, activeImage, tileScale, motifDefaults, hasBadges, badges, bareStyles, PATTERN_TILE,
  gradId, GRAD_DIRS, colourLuminance, COGENT_DEFAULTS, setAdjustLookup,
} from './backdrops.js';
import { buttonPaint, baseTypeSizes, unitOf, ctaInk } from './render.js';
import { render, renderHooks, layout, safeArea, gridLines, FORMATS, SAFE_TARGETS, setSafeTarget, paintStroke, drawingPoint, strokeWidth, h1ScaleOf, bodyScaleOf, textLook, itemsOf, renderItem, badgeScaleMax, LOWER_DEFAULT, LOWER_STROKE_MAX, lowerColours, UPPER_DEFAULT_TEXT, BADGE_ITEM, MIDDLE_DEFAULT, middleColours, textBadgeImage } from './render.js';
import { loadAssets, activeBrand, requestHi, onHiRes, hiReady, whenHiReady, C, img as assetImg } from './assets.js';
import { BRANDS, DEFAULT_BRAND, RETIRED } from './brands.js';
import { contrast } from './colours.js';
import {
  addUpload, loadUploads, removeUpload, sizeOf, isVideo, mediaFor, audioTrackFor,
  setPlayback,
} from './store.js';
import { installImportGuard, installDecoderBudget, reportUnplayable } from './v4/importer.js';
import { watchPersistence, installFaultGuard, persistence, onPersistence } from './v4/guard.js';
import { CAPTION_STYLES, CAPTION_POS, captionDefaults, parseCues, cuesFromScript, toSrt, cueAt, drawCaption } from './v4/captions.js';
import { plan as adaptPlan, isPureAuto } from './v4/adapt.js';
import { pdfOf } from './v4/pdf.js';
import { describe as describeProject, scopedChange } from './v4/model.js';
import { isAvailable as backendReady } from './v4/backend.js';

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = 'askruth.backdrop-studio.v2';
/* v4.4 · feature flags — all off by default. Turn one on for a visit with ?ff=presentation (or
   ?ff=presentation,… ), or for this browser with
   localStorage['askruth.backdrop-studio.flags'] = 'presentation'; ?ff=none switches them all off.
   aiStoryboard has no implementation in this release and cannot be turned on. */
const FLAGS = (() => {
  const on = new Set();
  try { for (const f of String(localStorage.getItem('askruth.backdrop-studio.flags') || '').split(/[\s,]+/)) if (f) on.add(f); } catch (_) {}
  try { const q = new URLSearchParams(location.search).get('ff'); if (q === 'none') on.clear(); else if (q) for (const f of q.split(',')) on.add(f.trim()); } catch (_) {}
  return Object.freeze({ presentation: on.has('presentation'), aiStoryboard: false });
})();
watchPersistence(STORAGE_KEY);   // v4: the save status reports what the browser really wrote
/* v4 · uploads load from IndexedDB in boot(), after the saved design is read. Until then an
   upload id looks unknown, and the start-up healing used to replace it: every reload dropped
   the Hook's video and the open section's video (reproduced on v3.25). Until the uploads are
   in, an upload id is taken on trust; boot() heals whatever is really gone. */
let uploadsLoaded = false;
const pendingUpload = (id) => !uploadsLoaded && typeof id === 'string' && /^up_/.test(id);

/* --- state --------------------------------------------------------------- */

const DEFAULT_POS = {
  '9x16': { watermark: { x: 0.5, y: 0.207 }, text: { x: 0.5, y: 0.387 }, inset: { x: 0.5, y: 0.600 } },
  '3x4':  { watermark: { x: 0.5, y: 0.100 }, text: { x: 0.5, y: 0.320 }, inset: { x: 0.5, y: 0.570 } },
  '4x5':  { watermark: { x: 0.5, y: 0.095 }, text: { x: 0.5, y: 0.300 }, inset: { x: 0.5, y: 0.560 } },
  '1x1':  { watermark: { x: 0.5, y: 0.095 }, text: { x: 0.5, y: 0.330 }, inset: { x: 0.5, y: 0.580 } },
  '16x9': { watermark: { x: 0.5, y: 0.090 }, text: { x: 0.5, y: 0.410 }, inset: { x: 0.5, y: 0.620 } },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

const state = {
  brand: DEFAULT_BRAND,
  backdrop: 'pattern-pink',
  format: '9x16',
  h1: 'Design as the limit of truth',
  body: 'Explore clean portrait backdrops. Set your typography size, toggles, and brand assets before exporting.',
  scale: 1,              // legacy shared text scale — read only as a fallback
  h1Scale: 1,
  bodyScale: 1,
  visibility: 'both',    // both | h1 | body | none — driven by the Header/Body switches
  textTone: 'light',     // light | dark — set by hand; light type on the plum panel by default
  badge: 'plum',         // plum (dark) | cream (light) | none
  badgeLast: 'plum',     // the style to restore when the badge is switched back on
  badgeScale: 1,
  badgePowered: true,    // false = the logo alone, without the "Powered by" label (the upper badge)
  badgeImage: true,      // the badge image itself — the upper and lower badge can show without it
  badgeUpper: null,      // the upper badge's words (null / empty = the artwork's own "Powered by")
  ctaBox: false,         // v3.2: a CTA section's words in a box (Style / No background colour)
  badgeShape: 'round',   // v3.1: a round portrait badge as a circle or a speech bubble (lower-left corner square)
  badgeHalo: null,       // v3.1: its outline { on, color } (render.js HALO_DEFAULT)
  badgeMiddle: null,     // a text badge's middle: its words (null = the brand name) and colours (render.js MIDDLE_DEFAULT)
  badgeLower: LOWER_DEFAULT(),   // a text box under the badge: on, text (null = brand name), ink, fill ('none'), stroke, strokeOn, strokeW, scale
  previewSurface: 'studio',   // what the preview sits on — studio | light; never exported
  card: true,
  guides: true,          // preview-only; never drawn into an export
  grid: false,           // centre lines, thirds and columns, with snapping — preview-only
  overlay: { style: 'none', strength: 0.3 },   // Dim, off until switched on
  adjust: {},            // per-upload crop, keyed by upload id
  inset: { id: null, scale: 1, radius: 0.14, hidden: true },   // off until a card is added
  media: [],             // more photos / videos on the screen being edited (the first is `inset`)
  badges: [],            // more badges on the screen being edited (the first is `badge`)
  buttons: [],           // buttons on the screen being edited (each screen has its own) — made under Buttons only
  drawings: [],          // v3.1: drawings on the screen being edited (each screen has its own)
  safeFor: 'all',        // v3.1: where a 9:16 will be posted — its safe area (render.js SAFE_TARGETS)
  // v4.1 / v4.4: keys a design saved before them doesn't have. They must exist (null) so a saved
  // design restores — snapshot() copies every design key, and an undefined one can't be copied.
  captions: null,
  deck: null,
  blocks: [],            // more header + body blocks on the screen being edited (each screen has its own)
  textMode: 'both',      // Header or Header + body — remembered while the text is switched off
  borders: { h1: { w: 0, c: null }, body: { w: 0, c: null } },   // a line around the text box: width (px at 1080) and colour (null = the text's)
  video: { loop: true, muted: false },
  pos: clone(DEFAULT_POS),
  contentType: 'video',                   // video | carousel — chosen on the timeline, used through export
  textColors: { h1: null, body: null },   // null = follow Text style
  cardColors: { h1: null, body: null },   // null = follow the Text panel switch, 'none' = no card
};

let selected = null;      // the element being edited: background | watermark | h1 | body | inset
let activeTab = 'all';

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    // Heal anything an older build may not have written.
    state.pos = clone(DEFAULT_POS);
    for (const [fmt, blocks] of Object.entries(saved.pos || {})) {
      if (state.pos[fmt]) Object.assign(state.pos[fmt], blocks);
    }
    state.overlay = Object.assign({ style: 'none', strength: 0.3 }, saved.overlay || {});
    state.overlay.style = overlayStyle(state.overlay.style);   // retired 'brand' / 'fade' read as Dim
    state.adjust = saved.adjust || {};
    state.badge = saved.badge || 'auto';
    state.badgeScale = saved.badgeScale || 1;
    state.badgePowered = saved.badgePowered !== false;
    state.badgeImage = saved.badgeImage !== false;
    state.badgeLower = { ...LOWER_DEFAULT(), ...(saved.badgeLower || {}) };
    state.badgeUpper = typeof saved.badgeUpper === 'string' ? saved.badgeUpper : null;
    delete state.scratchColour;   // "Start from scratch" was removed
    if (state.previewSurface !== 'light') state.previewSurface = 'studio';
    state.inset = Object.assign({ id: null, scale: 1, radius: 0.14 }, saved.inset || {});
    // older saves have no switch: a card that exists shows, an empty slot starts off
    if (typeof state.inset.hidden !== 'boolean') state.inset.hidden = !state.inset.id;
    state.video = Object.assign({ loop: true, muted: false }, saved.video || {});
    state.brand = BRANDS[saved.brand] ? saved.brand : DEFAULT_BRAND;
    // Header and Body scale used to be one slider; both start from it.
    state.h1Scale = h1ScaleOf(saved);
    state.bodyScale = bodyScaleOf(saved);
    state.badgeLast = saved.badgeLast || (saved.badge && saved.badge !== 'none' ? saved.badge : 'auto');
    delete state.mode;   // the Light/Dark picker filter was removed
    for (const k of ['h1Colour', 'bodyColour', 'panelColour']) delete state[k];   // text colour pickers were removed
    // The badge toggle became a "None" badge style.
    if (saved.watermark === false) state.badge = 'none';
    delete state.watermark;
  } catch (_) {}
}

/** Built-in art backdrops get the same live crop object uploads do. */
function bindAdjusts() {
  for (const bd of builtIns()) {
    if (bd.kind === 'art' || bd.kind === 'tile') bd.adjust = adjustFor(bd.id);
  }
}

/* --- brands ---------------------------------------------------------------
   Switching brand swaps the palette, the artwork and the backdrop set.
   Uploads, text, the photo card and every position stay exactly as they are —
   they belong to the design, not to the brand.
   ------------------------------------------------------------------------ */

/* The brand dropdown, built from the registry — adding a brand to brands.js
   adds it here with no other change. The mark beside it is the active
   brand's icon, or its monogram until a logo exists. */
function buildBrandSelect() {
  const sel = $('#brand-select');
  if (!sel) return;
  sel.innerHTML = '';
  for (const b of Object.values(BRANDS)) {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    sel.append(opt);
  }
  sel.value = state.brand;
  sel.addEventListener('change', () => switchBrand(sel.value));
  const lab = $('#tb-brand-label');
  if (lab) lab.textContent = (BRANDS[state.brand] || {}).name || '';
}

function syncBrandMark() {
  const sel = $('#brand-select');
  if (sel) sel.value = state.brand;
  const lab = $('#tb-brand-label');
  if (lab) lab.textContent = activeBrand().name;
  const mark = $('#brand-mark');
  if (!mark) return;
  const b = activeBrand();
  mark.innerHTML = '';
  mark.classList.toggle('is-mono', !b.icon);
  if (b.icon) {
    const im = document.createElement('img');
    im.src = b.icon;
    im.alt = '';
    mark.append(im);
  } else {
    mark.textContent = b.mono || b.name.slice(0, 2);
  }
}

/* Each brand is its own design: switching away keeps this brand's copy,
   screens, background, badge, text style, Dim, photo card and sound; switching
   to a brand brings back what you made there — or, the first time, that
   brand's own starter. Only the format travels with you. */
const BRAND_KEYS = () => DESIGN_KEYS.filter((k) => k !== 'brand' && k !== 'format' && k !== 'contentType');

function brandSnapshot() {
  const out = {};
  for (const k of BRAND_KEYS()) out[k] = clone(state[k] === undefined ? null : state[k]);
  return out;
}

/* A clean start: the brand's first pattern, nothing switched on — no badge,
   no header or body, no photo / video card, no Dim, no sound. The brand's
   copy, badge and text style are ready underneath, so switching an element
   on brings it in looking right. */
function starterDesign(id) {
  const b = BRANDS[id];
  const st = b.starter || {};
  const copy = (role) => ({ ...SCENE_COPY[role], ...(st[role] || {}) });
  // v4.1: the brand's calm default (a plain colour) first; a pattern only if a brand has none
  const pattern = (b.defaultBackdrop && b.backdrops.find((bd) => bd.id === b.defaultBackdrop))
    || (b.featured || []).map((x) => b.backdrops.find((bd) => bd.id === x)).find((bd) => bd && bd.kind === 'tile')
    || b.backdrops.find((bd) => bd.kind === 'tile') || b.backdrops[0];
  const tone = pattern.tone === 'dark' ? 'light' : (st.textTone || 'dark');
  return {
    backdrop: pattern.id,
    h1: copy('hook').h1, body: '',
    scale: 1, h1Scale: 1, bodyScale: 1, visibility: 'none',
    textTone: tone,
    badge: 'none', badgeLast: st.badge || 'auto', badgeScale: 1, badgePowered: true,
    card: st.card !== false,
    overlay: { style: 'none', strength: 0.3 },
    adjust: clone(state.adjust || {}),
    inset: { id: null, scale: 1, radius: 0.14, hidden: true },
    blocks: [],
    buttons: [],
    drawings: [],
    media: [],
    badges: [],
    textMode: 'both',
    borders: { h1: { w: 0, c: null }, body: { w: 0, c: null } },
    video: clone(state.video),
    pos: clone(DEFAULT_POS),
    music: null,
    textColors: { h1: null, body: null },
    cardColors: { h1: null, body: null },
    scenes: [
      { id: 'hook', role: 'hook', on: true, h1: copy('hook').h1, body: '' },
      { id: 'v1', role: 'value', on: true, h1: copy('value').h1, body: copy('value').body },
      { id: 'cta', role: 'cta', on: true, h1: copy('cta').h1, body: copy('cta').body, ctaStyle: st.ctaStyle || 'button' },
    ],
    scene: 0, sharedBg: null, sharedStill: null, sharedOverlay: null,
    captions: null,
    deck: null,          // v4.4: slides made from text — the source text, so they can be laid out again
  };
}

async function switchBrand(id) {
  dropMulti();   // a selection belongs to the design and section it was made on
  if (!BRANDS[id] || id === state.brand) return;
  stopPlayback();
  if (editor) closeEditor(true);
  commitScene();
  state.designs = state.designs || {};
  const leaving = brandSnapshot();
  // for the start screen: a still of it (its artwork is still loaded), when, and as what
  leaving.thumb = designThumb(snapshot());
  leaving.touched = Date.now();
  leaving.contentType = state.contentType;
  leaving.fmt = state.format;
  state.designs[state.brand] = leaving;

  state.brand = id;
  await loadAssets(id);

  const first = !state.designs[id];
  const tpl = first && !BLANK_START && templateRecipe(BRANDS[id]);
  const d = state.designs[id] || (tpl ? proposalData(tpl) : starterDesign(id));
  for (const k of BRAND_KEYS()) if (d[k] !== undefined) state[k] = clone(d[k]);
  if (tpl) state.scene = 0;

  // heal anything that no longer exists (a removed upload, an old id)
  if (byId(state.backdrop).id !== state.backdrop) state.backdrop = BRANDS[id].defaultBackdrop || builtIns()[0].id;
  if (state.inset.id && !mediaFor(state.inset.id)) state.inset.id = null;
  state.pos = Object.assign(clone(DEFAULT_POS), state.pos || {});
  if (!state.sharedBg || byId(state.sharedBg).id !== state.sharedBg) state.sharedBg = state.backdrop;
  for (const sc of state.scenes || []) if (sc.bg && byId(sc.bg).id !== sc.bg) sc.bg = null;
  resolveAuto();

  bindAdjusts();
  setPlayback(state.video);
  save();
  syncBrandUi();
  buildThumbs();
  syncAllControls();
  syncInsetToggle();
  draw();
  restoreMusic();   // this brand's sound, if it has one
  restoreSceneSounds();
  setTimeout(fillBrandStills, 900);   // this brand's artwork is in: draw stills its designs never got
}

/** Badge controls and the provisional note follow whichever brand is active. */
function syncBrandUi() {
  const brand = activeBrand();
  resolveAuto();
  save();                      // a converted Auto is written back straight away
  syncSegments('#seg-tone', 't', 'textTone');
  syncBrandMark();
  document.documentElement.dataset.brand = brand.id;
  labelSurfaceToggle();
  // the phone's browser chrome matches the editor
  // (a fresh element: some browsers only read theme-color when the tag itself changes)
  const tc = document.querySelector('meta[name="theme-color"]');
  const col = getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim();
  if (tc && col && tc.content !== col) { const m = tc.cloneNode(); m.content = col; tc.replaceWith(m); }

  const note = $('#brand-note');
  if (note) {
    note.textContent = brand.note || '';
    note.hidden = !brand.note;
  }

  const on = hasBadges();
  const field = $('#badge-field');
  if (field) field.hidden = !on;
  if (!on) return;

  // Only offer the badges this brand actually ships.
  buildBadgeThumbs();
  syncBadgeControls();
  if (typeof renderBadgeItems === 'function') renderBadgeItems();
}

/* --- uploads ------------------------------------------------------------- */

const activeBd = () => byId(state.backdrop);
const isImage = () => croppable(activeBd());

/* Mutated in place, never replaced — the registered backdrop holds this exact
   object, so slider and drag updates reach the renderer without a re-register. */
function adjustFor(id) {
  let a = state.adjust[id];
  if (!a) { a = state.adjust[id] = { ...DEFAULT_ADJUST }; return a; }
  for (const k of Object.keys(DEFAULT_ADJUST)) {
    if (typeof a[k] !== 'number') a[k] = DEFAULT_ADJUST[k];
  }
  return a;
}

/** Keep the registered backdrop object pointing at the live adjust values. */
function syncAdjust(id) {
  const bd = byId(id);
  if (bd && (bd.upload || bd.kind === 'art' || bd.kind === 'tile')) bd.adjust = adjustFor(id);
}

async function importFiles(files) {
  const err = $('#upload-error');
  const problems = [];
  let last = null;

  for (const file of files) {
    try {
      const meta = await addUpload(file);
      registerUpload(meta, adjustFor(meta.id));
      redrawThumbWhenReady(meta);
      last = meta.id;
    } catch (e) {
      problems.push(e.message || String(e));
    }
  }

  if (problems.length) {
    err.textContent = problems.join(' · ');
    err.hidden = false;
  } else {
    err.hidden = true;
  }

  if (last) {
    state.backdrop = last;
    save();
    buildThumbs();
    syncImageControls();
    draw();
  }
}

async function dropUpload(id) {
  await removeUpload(id);
  unregisterUpload(id);
  delete state.adjust[id];
  if (state.backdrop === id) state.backdrop = builtIns()[0].id;
  save();
  buildThumbs();
  syncImageControls();
  draw();
}

/** A clip's swatch is blank until it has decoded a frame — redraw it then. */
function redrawThumbWhenReady(meta) {
  if (!meta || meta.media !== 'video') return;
  const m = mediaFor(meta.id);
  if (!m) return;
  if (m.el.readyState >= 2) { buildThumbs(); return; }
  m.el.addEventListener('loadeddata', () => buildThumbs(), { once: true });
}

/* --- canvas -------------------------------------------------------------- */

const canvas = $('#preview');
const ctx = canvas.getContext('2d');

function sizeCanvas() {
  const f = FORMATS[state.format];
  if (canvas.width !== f.w || canvas.height !== f.h) {
    canvas.width = f.w;
    canvas.height = f.h;
  }
}

/** True when something on the canvas animates and needs a running loop. */
function hasMotion() {
  const bd = activeBd();
  return (bd.kind === 'image' && isVideo(bd.id)) || (!!state.inset.id && isVideo(state.inset.id));
}

let raf = 0;
let looping = false;

/** The card of the selected item stands out; the other items' cards step back. */
let focusSig = '';
function syncFocusRows() {
  const s = String(selected || '');
  const id = s.startsWith('eb:') ? `eb-${s.slice(3)}` : s.startsWith('bt:') ? `btn-${s.slice(3)}` : s.startsWith('md:') ? `md-${s.slice(3)}` : s.startsWith('xb:') ? `blk-${s.split(':')[1]}` : '';
  const row = id && document.getElementById(id);
  if (row && row.classList.contains('is-focus') && document.querySelectorAll('.block-item.is-focus').length === 1) return;
  if (!row && !document.querySelector('.has-focus-item, .block-item.is-focus')) return;
  void focusSig;
  for (const el of document.querySelectorAll('.has-focus-item')) el.classList.remove('has-focus-item');
  for (const el of document.querySelectorAll('.block-item.is-focus')) el.classList.remove('is-focus');
  if (!row) return;
  row.classList.add('is-focus');
  const box = row.closest('.group');
  if (box) box.classList.add('has-focus-item');
}

/* v3.5 · Speed: while a video plays the preview repaints every frame, but the panel only
   needs updating when something changed (draw() marks it) — or a few times a second, so a
   section change during playback still shows. */
const LOOP_FRAME = Symbol('loop-frame');
let uiDirty = true, lastUiSync = 0;
// anything the person does may change what the panel shows: the next frame updates it
for (const t of ['input', 'change', 'click', 'pointerup', 'keydown']) document.addEventListener(t, () => { uiDirty = true; }, true);
function paint(arg) {
  const fromLoop = arg === LOOP_FRAME || (arg === undefined && looping);
  const now = performance.now();
  const syncUi = !fromLoop || uiDirty || now - lastUiSync > 250;
  if (syncUi) { uiDirty = false; lastUiSync = now; }
  setSafeTarget(state.safeFor);   // v3.1: the 9:16 safe area of the platform it is for
  if (syncUi) syncFocusRows();
  sizeCanvas();
  // the stage keeps a lane for its round buttons on wide formats (styles.css)
  if (document.documentElement.dataset.format !== state.format) document.documentElement.dataset.format = state.format;
  if (syncUi) { syncBadgeScaleRange(); syncBadgeParts(); }
  // Preview (full screen) shows the design as it exports: no guides, outlines or handles
  const clean = fsMode === 'preview';
  lastLayout = render(ctx, canvas.width, canvas.height, state, {
    // guides are drawn in screen pixels: canvas pixels per CSS pixel on screen
    guides: state.guides && !clean ? canvas.width / (canvas.clientWidth || canvas.width) : false,
    grid: state.grid && !clean ? canvas.width / (canvas.clientWidth || canvas.width) : false,
    snapLines: dragging && dragging.moved ? gridHits : null,
    px: canvas.width / (canvas.clientWidth || canvas.width),
    selected: editor || clean ? null : selected,
    multi: editor || clean || multiSel.length < 2 ? [] : multiSel,
    badgePart: selected === 'watermark' ? badgePart : null,
    accent: categoryOf(),              // the section's category colour — editor only
    note: editor || clean ? null : selectionNote(),   // "On 3 sections" for a shared item
    handles: !clean && ((dragging && dragging.moved) || (hovering && !editor)),
    dragNow: !!(dragging && dragging.moved),
    hoverRect: !clean && hovering && !editor && !dragging && hoverHit && hoverHit.sig !== selected ? hoverHit.r : null,
    editing: editor && editor.key,
  });
  if (editor) placeEditor();
  if (!syncUi) { requestHi(hiKeys()); return; }
  keepSceneCard();
  syncColorRows();
  syncSectionValues();
  syncFav();
  syncColourRow();
  syncBgInspector();   // v3.1: after the colour row (a gradient marks its first colour there)
  syncSelDelete();
  syncBadgeShape();
  syncCogent();
  placeVideoControls();
  syncUploadLabel();
  layoutStrip('#thumbs', '#bg-show-all', state.backdrop, 'id');
  requestHi(hiKeys());
  syncSingleTime();
  refreshFilms();
  syncDimDefault();
  syncFraming();
  syncColorRows();
  syncSceneBgNote();
  if ($('#tg-inset').checked === !!state.inset.hidden) syncInsetToggle();
}

/* --- high-resolution masters -------------------------------------------------
   Only the backdrop and badge in use get their full-size file; it swaps in when
   it arrives. An export started before that waits for it, so a 2× file is never
   drawn from the light preview copy. */
function hiKeys() {
  const keys = [];
  const bd = byId(state.backdrop);
  if (bd && bd.kind === 'tile' && (bd.motif || bd.stripes)) { /* v3.10: drawn from its motif (stripes: from colours), no tile master needed */ }
  else if (bd && (bd.kind === 'tile' || bd.kind === 'cogent')) keys.push(bd.asset);   // a cogent drawn large wants its master
  if (bd && bd.kind === 'art') {
    const f = FORMATS[state.format] || FORMATS['9x16'];
    keys.push(`${bd.asset}-${f.w > f.h ? 'landscape' : 'portrait'}`);
  }
  const set = badges();
  if (state.badge !== 'none' && set[state.badge]) keys.push(set[state.badge].asset);
  return keys;
}

/* --- screens (hook → value → final CTA) --------------------------------------
   One design, several screens. Every screen shares the background, badge,
   format and layout; each has its own header and body. Tick the screens to
   include and Export saves them as slides (one image each) or as one video
   that steps through them. Hook is screen one, Final CTA the last; any number
   of Value screens go between. state.h1 / state.body always hold the screen
   being edited, so everything that reads them keeps working unchanged.
   ------------------------------------------------------------------------ */

const SCENE_COPY = {
  hook:  { h1: 'Stop scrolling — this is for you', body: '' },
  value: { h1: 'Here’s what you get', body: '- One clear benefit\n- Shown, not told' },
  cta:   { h1: 'Try it free', body: 'Link in bio' },
};

/* Short-form defaults: the hook has to land before the first swipe (~2–3 s),
   a value screen needs time to read two short lines, the CTA a beat to act on. */
const SCENE_SECS = { hook: 2.5, value: 3.5, cta: 3 };
const SECS_MIN = 1, SECS_MAX = 30;
/* v3.13: a Value section can run up to 3 minutes (a longer clip or talk); Hook and CTA stay at 30 s */
const VALUE_SECS_MAX = 180;
const secsMax = (sc) => (sc && sc.role === 'value' ? VALUE_SECS_MAX : SECS_MAX);
const CTA_DIM = 0.45;
/* Recommended times come from what is on the screen, not one number per role.
   On-screen text is read at roughly 15 characters a second (subtitle guides
   cap adults near 17; a styled card on a busy ground reads a little slower),
   plus a beat to notice the cut. Then each role is held to its job:
   - Hook: 1.5–3 s — short-form viewers decide within ~2 s, so a hook is a
     headline that lands at once, not a paragraph.
   - Value: 2.5–7 s — enough to read it; past ~7 s a single card drags
     (shorten the text or split it into two value sections instead).
   - CTA: 2.5–4 s — read the action, then a moment to act on it.
   The whole sequence lands around 9–15 s with the starter copy, the range
   that performs best in Reels and TikTok feeds.
   One screen on its own is a different post: ~6 s, long enough to read and
   loop — or, over a video clip, the whole clip. */
const SINGLE_SECS = 6;
const READ_CPS = 15;
const ROLE_RANGE = { hook: [1.5, 3], value: [2.5, 7], cta: [2.5, 4] };

function readingSecs(sc) {
  const i = state.scenes.indexOf(sc);
  const live = i === state.scene && !sequencing;
  const h1 = String((live ? state.h1 : sc.h1) || '');
  const body = String((live ? state.body : sc.body) || '');
  const chars = `${h1} ${body}`.replace(/^[ \t]*[-•*][ \t]+/gm, '').replace(/\s+/g, ' ').trim().length;
  return chars / READ_CPS;
}

function recommendedSecs(sc) {
  const half = (v) => Math.round(v * 2) / 2;
  if (state.scenes.length === 1) {
    const src = sourceDuration();
    if (src) return Math.max(SECS_MIN, Math.min(secsMax(sc), half(src)));
    return Math.max(SINGLE_SECS, Math.min(SECS_MAX, half(1 + readingSecs(sc))));
  }
  const [lo, hi] = ROLE_RANGE[sc.role] || [2.5, 7];
  return Math.max(lo, Math.min(hi, half(1 + readingSecs(sc))));
}

/** Screens nobody has timed by hand follow the recommendation as the timeline changes. */
function autoTimes() {
  if (musicFits()) return false;
  let changed = false;
  for (const sc of state.scenes) {
    if (sc.manual) continue;
    const r = recommendedSecs(sc);
    if (Math.abs(sc.secs - r) > 1e-6) { sc.secs = r; changed = true; }
  }
  return changed;
}

function ensureScenes() {
  if (!Array.isArray(state.scenes) || !state.scenes.length) {
    // a new design starts as the full sequence; × takes a part out
    state.scenes = [
      { id: 'hook', role: 'hook', on: true, h1: state.h1, body: state.body },
      { id: 'v1', role: 'value', on: true, ...SCENE_COPY.value },
      { id: 'cta', role: 'cta', on: true, ...SCENE_COPY.cta },
    ];
    state.scene = 0;
  }
  // the strip used to have tick boxes: an unticked screen is simply not in it any more
  if (state.scenes.some((x) => x.on === false) && state.scenes.some((x) => x.on !== false)) {
    const keep = state.scenes[state.scene];
    state.scenes = state.scenes.filter((x) => x.on !== false);
    state.scene = Math.max(0, state.scenes.indexOf(keep));
  }
  for (const sc of state.scenes) sc.on = true;
  for (const sc of state.scenes) {
    if (!(sc.secs >= SECS_MIN)) sc.secs = SCENE_SECS[sc.role] || 3;
    // a time that differs from the default was set by hand (older saves had no flag)
    if (sc.manual === undefined) sc.manual = Math.abs(sc.secs - (SCENE_SECS[sc.role] || 3)) > 1e-6;
    // a CTA's text is text: buttons are their own elements now (see migrateCtaButton)
    if (sc.bg === undefined) sc.bg = null;
    // older saves had one card for every screen: keep showing it where it was
    if (sc.inset === undefined) sc.inset = clone(state.inset);
    if (!Array.isArray(sc.blocks)) sc.blocks = [];
    // older saves had one set of colours for every screen: every screen starts from it
    for (const k of SCENE_STYLE) if (sc[k] === undefined) sc[k] = k === 'buttons' || k === 'media' || k === 'badges' ? [] : clone(state[k] === undefined ? null : state[k]);
    if (!Array.isArray(sc.media)) sc.media = [];
    if (!Array.isArray(sc.badges)) sc.badges = [];
    if (!Array.isArray(sc.buttons)) sc.buttons = [];
    migrateCtaButton(sc);
    // the CTA starts on the shared background, dimmed, so the action stands out
    if (sc.overlay === undefined) sc.overlay = sc.role === 'cta' ? { style: 'dim', strength: CTA_DIM } : null;
  }
  // the Hook's background and Dim are the shared ones every other screen starts from
  if (!state.sharedBg || (!pendingUpload(state.sharedBg) && byId(state.sharedBg).id !== state.sharedBg)) state.sharedBg = state.backdrop;
  if (!state.sharedOverlay) state.sharedOverlay = clone(state.overlay);
  if (state.sharedStill === undefined) state.sharedStill = null;
  if (!(state.scene >= 0 && state.scene < state.scenes.length)) state.scene = 0;
}

/* The roles only shape a screen inside a sequence: on its own, the first
   screen is simply the design (header and body), as it always was. A CTA is
   always a CTA. */
const inSequence = () => state.scenes.length > 1;
function roleFor(sc) {
  if (sc.role === 'cta') return 'cta';
  if (sc.role === 'hook' && inSequence()) return 'hook';
  return '';
}

/* Any number of each kind, anywhere: numbered once there is more than one. */
const sceneName = (sc, i) => {
  const base = sc.role === 'hook' ? 'Hook' : sc.role === 'cta' ? 'CTA' : 'Value';
  const all = state.scenes.filter((x) => x.role === sc.role).length;
  const n = state.scenes.slice(0, i + 1).filter((x) => x.role === sc.role).length;
  if (all > 1) return `${base} ${n}`;
  return base;
};

/* Backgrounds: every screen shows the shared background (the Hook's) unless
   it has its own. Picking a background or Dim while editing a screen sets it
   for that screen only; on the Hook it changes the shared one. */
/* Each section has its own text colours, text boxes, borders and CTA look
   (the brand stays project-wide). These are mirrored into top-level state
   while a section is edited, exactly like its card and extra blocks. */
const SCENE_STYLE = ['textTone', 'card', 'textColors', 'cardColors', 'borders', 'buttons', 'media', 'badges', 'drawings',
  // …and its own badge, text switch, text sizes and layout: every section is fully its own
  'badge', 'badgeLast', 'badgeScale', 'badgePowered', 'badgeImage', 'badgeLower', 'badgeUpper', 'badgeMiddle', 'badgeShape', 'badgeHalo', 'visibility', 'textMode', 'h1Scale', 'bodyScale', 'pos', 'ctaBox'];
const CTA_LOOK = () => ({ ink: null, fill: null, stroke: null, strokeW: 0, radius: null, scale: 1 });

/* Buttons used to be the CTA's header drawn as a pill. They are their own
   elements now: an older CTA in Button style becomes a button with that text
   (and its look), and its header becomes empty — the supporting line stays. */
function migrateCtaButton(sc) {
  if (sc.btnMigrated) return;
  sc.btnMigrated = true;
  if (sc.role !== 'cta') return;
  const wasButton = sc.ctaStyle !== 'bold';
  sc.ctaStyle = 'bold';
  const live = state.scenes && state.scenes[state.scene] === sc;
  const text = String((live ? state.h1 : sc.h1) || '').trim();
  if (!wasButton || !text) return;
  const look = Object.assign(CTA_LOOK(), sc.ctaLook || {});
  const fmt = state.format;
  const ty = ((sc.pos && sc.pos[fmt] && sc.pos[fmt].text) || (state.pos && state.pos[fmt] && state.pos[fmt].text) || { y: 0.55 }).y;
  sc.buttons = [...(sc.buttons || []), { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text, x: 0.5, y: Math.min(0.8, ty + 0.1), look }];
  sc.h1 = '';
  delete sc.ctaLook;
  if (live) {
    state.h1 = '';
    state.buttons = clone(sc.buttons);
    const f = document.getElementById('in-h1');
    if (f) f.value = '';
  }
}

/** The background crop / pattern scale this section uses for its background. */
function sceneAdjust(sc, id) {
  return (sc && sc.adj && sc.adj[id]) || (state.scenes && state.scenes[0] && state.scenes[0].adj && state.scenes[0].adj[id]) || null;
}
function keepSceneAdjust(sc) {
  const id = state.backdrop;
  if (!id || !state.adjust[id]) return false;
  sc.adj = sc.adj || {};
  const now = JSON.stringify(state.adjust[id]);
  if (JSON.stringify(sc.adj[id]) === now) return false;
  sc.adj[id] = JSON.parse(now);
  return true;
}

/** A screen without a card. */
const NO_CARD = () => ({ id: null, scale: 1, radius: 0.14, hidden: true });

/** Keep the screen's own card in step with the one being edited (the card's
    controls write to state.inset and save straight away). */
function keepSceneCard() {
  if (sequencing || playing || !Array.isArray(state.scenes)) return;
  const sc = state.scenes[state.scene];
  if (!sc) return;
  const now = JSON.stringify(state.inset);
  if (JSON.stringify(sc.inset) !== now) { sc.inset = JSON.parse(now); save(); }
  // v3.1 · P0: the header and body too, so the section's own copy is never behind what you typed
  if (sc.h1 !== state.h1 || sc.body !== state.body) { sc.h1 = state.h1; sc.body = state.body; save(); }
  const bl = JSON.stringify(state.blocks || []);
  if (JSON.stringify(sc.blocks || []) !== bl) { sc.blocks = JSON.parse(bl); save(); }
  let ch = false;
  for (const k of SCENE_STYLE) {
    const v = JSON.stringify(state[k] === undefined ? null : state[k]);
    if (JSON.stringify(sc[k] === undefined ? null : sc[k]) !== v) { sc[k] = JSON.parse(v); ch = true; }
  }
  if (keepSceneAdjust(sc)) ch = true;
  if (propagateLinked()) ch = true;
  if (ch) save();
}

/** The card's controls follow the screen being edited. */
function syncSceneCard() {
  syncInsetToggle();
  syncInsetControls();
  syncCardScope();
  renderBlocks();
  // …and its own colours, text style, borders and CTA look
  $('#tg-card').checked = state.card;
  syncSegments('#seg-tone', 't', 'textTone');
  // badge, text switch and sizes are the section's own too
  syncScaleOutputs();
  $('#badge-scale').value = state.badgeScale;
  $('#badge-scale-out').textContent = `${Math.round(state.badgeScale * 100)}%`;
  $('#tg-powered').checked = state.badgePowered;
  syncTextControls();
  syncBadgeControls();
  syncSectionValues(true);
  syncColorRows(true);
  syncBorderControls();
  if (typeof renderButtons === 'function') renderButtons();
  if (typeof renderMediaItems === 'function') renderMediaItems();
  if (typeof renderBadgeItems === 'function') renderBadgeItems();
  if (typeof syncCategory === 'function') syncCategory();
  syncOwnShowOn();
}

/** In a sequence, say whose card this is. */
function syncCardScope() {
  const p = $('#inset-scope');
  const sc = state.scenes && state.scenes[state.scene];
  p.hidden = !(sc && state.scenes.length > 1);
  if (sc) p.textContent = `On ${sceneName(sc, state.scene)} only — each section has its own media.`;
}

const sameOverlay = (a, b) => a && b && a.style === b.style && Math.abs(a.strength - b.strength) < 1e-6;
const isBase = (i) => i === 0;

/* While an export steps through the screens, the canvas shows screens other
   than the one being edited — nothing may be written back then. */
let sequencing = false;

/* v3.21 · a video background belongs to its own section. The Hook's background is the one other
   sections share — but a video picked there plays on the Hook only; the sections that shared the
   Hook's background keep the still one it had before (state.sharedStill). */
const isVideoBg = (id) => { const m = id && mediaFor(id); return !!(m && m.media === 'video'); };
function sharedStillBg() {
  const ok = (id) => id && byId(id).id === id && !isVideoBg(id);
  if (ok(state.sharedStill)) return state.sharedStill;
  const b = BRANDS[state.brand];
  return (b && ok(b.defaultBackdrop) && b.defaultBackdrop) || builtIns()[0].id;
}
/** The background a section without its own shows. */
const sharedFor = () => (isVideoBg(state.sharedBg) ? sharedStillBg() : state.sharedBg);
/** Is this the background the section would show anyway (so it needs no own one)? */
const isSharedBg = (id) => id === sharedFor();

/** Copy what is being edited back into its screen. */
function commitScene() {
  ensureScenes();
  if (sequencing) return;
  const sc = state.scenes[state.scene];
  sc.h1 = state.h1;
  sc.body = state.body;
  sc.inset = clone(state.inset);          // each screen has its own photo / video card
  sc.blocks = clone(state.blocks || []);  // …and its own extra text blocks
  for (const k of SCENE_STYLE) sc[k] = clone(state[k] === undefined ? null : state[k]);   // …and its own colours
  keepSceneAdjust(sc);                    // …and its own crop / pattern scale
  if (isBase(state.scene)) {
    if (!isVideoBg(state.sharedBg) && state.sharedBg) state.sharedStill = state.sharedBg;
    state.sharedBg = state.backdrop;
    if (!isVideoBg(state.backdrop)) state.sharedStill = state.backdrop;
    state.sharedOverlay = clone(state.overlay);
  } else {
    sc.bg = isSharedBg(state.backdrop) ? null : state.backdrop;
    sc.overlay = sameOverlay(state.overlay, state.sharedOverlay) ? null : clone(state.overlay);
  }
  propagateLinked();                      // items shown on several sections: the same edit there
}

/** Put a screen on the canvas (no UI side effects — export uses it too). */
function loadScene(i) {
  const sc = state.scenes[i];
  shownScene = i;
  if (!sequencing) lastBgSeen = null;   // a screen change is not a background pick (see syncDimDefault)
  state.h1 = sc.h1;
  state.body = sc.body;
  state.sceneRole = roleFor(sc);
  state.ctaStyle = sc.ctaStyle;
  if (sc.inset) state.inset = clone(sc.inset);
  state.blocks = clone(sc.blocks || []);
  const bg = isBase(i) ? state.sharedBg : (sc.bg && byId(sc.bg).id === sc.bg ? sc.bg : sharedFor());
  state.backdrop = bg || state.backdrop;
  state.overlay = clone((!isBase(i) && sc.overlay) || state.sharedOverlay || state.overlay);
  for (const k of SCENE_STYLE) if (sc[k] !== undefined && sc[k] !== null) state[k] = clone(sc[k]);
  // sections saved before the badge had parts: the image on, no lower badge
  if (sc.badgeImage == null) state.badgeImage = true;
  if (sc.badgeLower == null) state.badgeLower = LOWER_DEFAULT();
  if (sc.badgeUpper == null) state.badgeUpper = null;
  if (sc.badgeMiddle == null) state.badgeMiddle = null;
  if (sc.badgeShape == null) state.badgeShape = 'round';
  if (typeof sc.ctaBox !== 'boolean') state.ctaBox = false;
  if (sc.badgeHalo === undefined) state.badgeHalo = null;
  if (!Array.isArray(state.buttons)) state.buttons = [];
  if (!Array.isArray(sc.drawings)) state.drawings = [];   // v3.1: a section without drawings has none (not the last one's)
  if (!Array.isArray(state.media)) state.media = [];
  if (!Array.isArray(state.badges)) state.badges = [];
  const a = sceneAdjust(sc, state.backdrop);
  if (a) { Object.assign(adjustFor(state.backdrop), a); syncAdjust(state.backdrop); }
}

/** After a brand switch the old brand's backgrounds mean nothing: start over from the shared one. */
function rebaseSceneBackgrounds() {
  if (!Array.isArray(state.scenes)) return;
  for (const sc of state.scenes) if (sc.bg && byId(sc.bg).id !== sc.bg) sc.bg = null;
  if (state.scene !== 0) {
    // keep the screen being edited as it is; the shared one becomes this brand's default
    state.sharedBg = state.backdrop;
  } else state.sharedBg = state.backdrop;
}

/** Keep the "own / same background" note honest as backgrounds are picked. */
function syncSceneBgNote() {
  if (sequencing || playing || !Array.isArray(state.scenes)) return;
  const sc = state.scenes[state.scene];
  if (!sc) return;
  // the Hook: a background picked or uploaded there becomes the shared one
  // (otherwise a reload would bring the old one back)
  if (isBase(state.scene)) {
    if (state.sharedBg !== state.backdrop || !sameOverlay(state.sharedOverlay, state.overlay)) {
      commitScene();
      save();
    }
    return;
  }
  const before = `${sc.bg}|${JSON.stringify(sc.overlay)}`;
  commitScene();
  if (before !== `${sc.bg}|${JSON.stringify(sc.overlay)}`) { save(); renderSceneBar(); }
}

/** Back to the shared background and Dim. */
function matchHook() {
  const sc = state.scenes[state.scene];
  sc.bg = null;
  sc.overlay = null;
  loadScene(state.scene);
  afterSceneBackground();
}

function afterSceneBackground() {
  save();
  syncThumbs();
  syncImageControls();
  renderSceneBar();
  draw();
}

/* Switching sections brings the section buttons back into view: the panel
   (and the phone's open sheet) go back to the top. */
function panelToTop() {
  const p = $('.panel-controls');
  if (p && !isPhone()) p.scrollTop = 0;
  const sb = $('#section-sheet-body');
  if (sb) sb.scrollTop = 0;
}

function selectScene(i) {
  dropMulti();   // a selection belongs to the design and section it was made on
  if (editor) closeEditor(true);
  commitScene();
  state.scene = i;
  // the playhead follows the clip being edited
  if (!playing && sceneAt(playT) !== i) playT = sceneStart(i);
  loadScene(i);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  save();
  renderScenes();
  syncThumbs();
  syncImageControls();
  syncSceneCard();
  if (fsMode) { showScope(i); syncCategory(); }
  draw();
  panelToTop();
}

/* v4 · the export sheet's "What to export": null = every section; otherwise the ids it picked.
   Set only while the sheet is open, so the timeline and playback always see every section. */
let exportPick = null;
const enabledScenes = () => {
  ensureScenes();
  const all = state.scenes.map((sc, i) => ({ sc, i }));
  if (!exportPick) return all;
  const some = all.filter(({ sc }) => exportPick.has(sc.id));
  return some.length ? some : all;
};

/* --- the timeline ------------------------------------------------------------
   Laid out like a video editor: a time ruler, the video track (one clip per
   screen — Hook, Value…, Final CTA — each as long as its time on screen), a
   sound track and a playhead. Tap a clip to edit it, × to take it out, drag
   its right edge to trim it. Where the Hook or the CTA was taken out an "Add"
   slot holds its place; "+" at the end of the Values adds another.
   ------------------------------------------------------------------------ */
const SNAP = 0.5;
const SLOT_W = 78;                       // width of an "Add hook" / "Add CTA" slot
let pps = 40;                            // pixels per second, set by renderScenes
let leftPad = 0;                         // room for "Add hook" before 0 s
/* v3.1 · Carousel Play: the same playback as a video, each slide on screen for this long
   (a carousel has no timing of its own; ~3 s is a comfortable swipe rhythm) */
const CAROUSEL_SLIDE_SECS = 3;
const playSecs = (sc) => (state.contentType === 'carousel' ? CAROUSEL_SLIDE_SECS : sc.secs);
const timelineSecs = () => (Array.isArray(state.scenes) ? state.scenes.reduce((t, sc) => t + playSecs(sc), 0) : 0);
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const lineOf = (sc, i) => {
  const t = (i === state.scene ? state.h1 : sc.h1) || (i === state.scene ? state.body : sc.body) || '—';
  return String(t).split('\n')[0].replace(/^[-*•]\s*/, '');
};

function renderScenes() {
  ensureScenes();
  if (autoTimes()) save();
  closeClipMenu();
  const host = $('#scenes');
  host.innerHTML = '';
  const has = (r) => state.scenes.some((x) => x.role === r);
  const total = timelineSecs();
  const music = musicSecs();
  const span = Math.max(total, music);
  leftPad = has('hook') ? 0 : SLOT_W + 6;
  const rightPad = has('cta') ? 0 : SLOT_W + 8;
  const room = Math.max(220, ($('#tl-scroll').clientWidth || 600) - leftPad - rightPad - 16);
  // fit the whole film when it is short; scroll once it is long
  // fit the film while every clip stays wide enough to read and grab;
  // past that the timeline scrolls sideways instead of squeezing the clips
  const shortest = Math.min(...state.scenes.map((x) => x.secs));
  const minClip = window.innerWidth <= 820 ? 84 : 96;
  pps = Math.max(minClip / Math.max(SECS_MIN, shortest), 24, Math.min(140, room / Math.max(6, span)));
  pps = Math.min(pps, 160);
  if (playT > total) playT = 0;
  // a carousel is the same sequence as still images: equal slides, no time
  const carousel = state.contentType === 'carousel';
  $('#timeline').classList.toggle('is-carousel', carousel);
  // a slide is a thumbnail of the post, in its own shape
  const fmt = FORMATS[state.format];
  const slideW = Math.max(72, Math.round((window.innerWidth <= 820 ? 86 : 96) * fmt.w / fmt.h)), slideGap = 8;
  const at = (k, t) => (carousel ? leftPad + k * (slideW + slideGap) : leftPad + t * pps);

  if (!has('hook')) host.append(slot('hook', 'Add hook', 0, 0));

  let t = 0;
  state.scenes.forEach((sc, i) => {
    const clip = document.createElement('div');
    clip.className = `frame clip role-${sc.role}` + (i === state.scene ? ' is-active' : '');
    clip.setAttribute('role', 'listitem');
    clip.style.left = `${at(i, t)}px`;
    clip.style.width = carousel ? `${slideW}px` : `${Math.max(8, sc.secs * pps - 3)}px`;

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'frame-pick';
    pick.title = `Edit ${sceneName(sc, i)}`;
    const label = document.createElement('span');
    label.className = 'clip-label';
    const name = document.createElement('span');
    name.className = 'frame-name';
    name.textContent = sceneName(sc, i);
    const short = document.createElement('span');
    short.className = 'frame-short';
    short.textContent = sceneName(sc, i).replace('Final CTA', 'CTA').replace('Value ', 'V').replace('Hook ', 'H').replace('CTA ', 'C');
    if (carousel) {
      const num = document.createElement('span');
      num.className = 'frame-num';
      num.textContent = String(i + 1);
      label.append(num);
    }
    const secs = document.createElement('span');
    secs.className = 'frame-secs';
    secs.textContent = `${sc.secs.toFixed(1)}s`;
    label.append(name, short);
    if (sc.sound && !carousel) {
      const snd = document.createElement('i');
      snd.className = 'frame-snd';
      snd.title = `Sound: ${sc.sound.name}`;
      snd.innerHTML = MENU_ICONS.note;
      label.append(snd);
    }
    label.append(secs);
    const line = document.createElement('span');
    line.className = 'frame-line';
    line.textContent = lineOf(sc, i);
    pick.append(label, line);
    pick.setAttribute('aria-haspopup', 'menu');
    pick.title = `${sceneName(sc, i)} — tap to edit, hold for options`;
    /* tap: edit this section. Hold (or right-click, or Enter on the keyboard):
       its options. The edges trim its time. */
    let hold = 0, held = false, at0 = null, dragged = false, down = null;
    pick.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      held = false;
      dragged = false;
      at0 = { x: e.clientX, y: e.clientY };
      down = { x: e.clientX, y: e.clientY, type: e.pointerType };
      clearTimeout(hold);
      hold = setTimeout(() => {
        held = true;
        stopPlayback();
        if (i !== state.scene) selectScene(i);
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
        openClipMenu(i);
      }, LONG_PRESS_MS);
    });
    /* followed on the window, not the clip: the pointer soon leaves it (over a trim
       handle, another clip) while the gesture is still this clip's */
    const track = (e) => {
      if (clipDrag && clipDrag.clip === clip) { moveClipDrag(e); return; }
      if (at0 && Math.hypot(e.clientX - at0.x, e.clientY - at0.y) > 8) { clearTimeout(hold); at0 = null; }
      // reorder: a mouse drags straight away; touch and pen after a hold (a plain swipe scrolls)
      if (!down || state.scenes.length < 2) return;
      const dx = Math.abs(e.clientX - down.x), dy = Math.abs(e.clientY - down.y);
      if ((down.type === 'mouse' ? dx > 8 : held && dx > 10) && dx > dy) {
        clearTimeout(hold);
        dragged = true;
        down = null;
        startClipDrag(i, clip, e, pick);
        moveClipDrag(e);
      }
    };
    const finish = (e) => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      clearTimeout(hold); at0 = null; down = null;
      if (clipDrag && clipDrag.clip === clip) endClipDrag(e.type === 'pointerup');
      if (dragged) setTimeout(() => { dragged = false; }, 0);   // after the click this release makes
    };
    pick.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      window.addEventListener('pointermove', track);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    });
    // while a held clip is dragged, the finger moves it instead of scrolling the timeline
    pick.addEventListener('touchmove', (e) => { if (held || (clipDrag && clipDrag.clip === clip)) e.preventDefault(); }, { passive: false });
    pick.addEventListener('pointerleave', () => { if (!down && !clipDrag) { clearTimeout(hold); at0 = null; } });
    pick.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (held) return;
      stopPlayback();
      if (i !== state.scene) selectScene(i);
      openClipMenu(i);
    });
    pick.addEventListener('click', (e) => {
      if (dragged) { dragged = false; held = false; return; }   // it was moved, not tapped
      if (held) { held = false; return; }             // the hold already opened the menu
      stopPlayback();
      const onLabel = !!(e.target.closest && e.target.closest('.clip-label'));
      if (i !== state.scene) selectScene(i);
      else if (!onLabel && !$('#clip-menu').hidden) closeClipMenu();
      // the Hook / Value / CTA label, or the keyboard (Enter / Space): the options
      if (onLabel || e.detail === 0) openClipMenu(i);
    });
    clip.append(pick);
    if (!carousel) {
      clip.append(trimHandle(clip, sc, i, secs));
      if (i > 0) clip.append(leftTrimHandle(clip, sc, i, secs));
    }
    host.append(clip);
    paintClipFilm(clip, i);
    t += sc.secs;
  });

  if (!has('cta')) host.append(slot('cta', 'Add CTA', state.scenes.length, carousel ? at(state.scenes.length, 0) : leftPad + total * pps + 6));

  const width = carousel
    ? leftPad + state.scenes.length * (slideW + slideGap) + rightPad + 12
    : leftPad + span * pps + rightPad + 12;
  $('#tl-inner').style.width = `${width}px`;
  renderRuler(span);
  renderAudioLane();
  renderCutMarks(at);
  renderOverlayLane();
  movePlayhead(playT);
  $('#tl-time').textContent = `${fmtTime(playT)} / ${fmtTime(total)}`;
  renderSceneBar();
  syncScenePanel();
  revealClip(state.scene);
  refreshShowOn();
  syncOwnShowOn();
}

/** Scroll the timeline so this clip is in view (after adding one, for instance). */
function revealClip(i) {
  const sc = $('#tl-scroll');
  const clip = document.querySelectorAll('#scenes .clip')[i];
  if (!sc || !clip || playing) return;
  const l = clip.offsetLeft, r = l + clip.offsetWidth;
  const to = l < sc.scrollLeft + 8 ? Math.max(0, l - 24)
    : r > sc.scrollLeft + sc.clientWidth - 8 ? r - sc.clientWidth + 24 : null;
  if (to === null) return;
  quietScrollUntil = performance.now() + 400;   // our own scroll doesn't close the menu
  sc.scrollLeft = to;
}
let quietScrollUntil = 0;

const lastGripTap = { i: -1, t: 0 };

/* Dim is on by default for picture backgrounds (artwork, photos, clips) —
   that is what the retired "soft" copies did. Picking a picture turns Dim on
   (if it was off); going back to a pattern or colour turns off a Dim that was
   switched on this way. Changing screens, brands or designs isn't a pick. */
const DIM_DEFAULT = 0.3;
let lastBgSeen = null;
function syncDimDefault() {
  if (sequencing || playing) return;
  if (lastBgSeen === null) { lastBgSeen = state.backdrop; return; }
  if (state.backdrop === lastBgSeen) return;
  const pic = croppable(byId(state.backdrop));
  const wasPic = croppable(byId(lastBgSeen));
  lastBgSeen = state.backdrop;
  if (pic && !wasPic && state.overlay.style === 'none') {
    state.overlay = { style: 'dim', strength: state.overlay.strength || DIM_DEFAULT, auto: true };
  } else if (!pic && wasPic && state.overlay.auto) {
    state.overlay = { style: 'none', strength: state.overlay.strength };
  } else return;
  syncImageControls();
  save();
  draw();
}

/* Every launch starts clean (starterDesign) in the brand you were using.
   Whatever you had open is not thrown away: it is kept under Saved designs
   as "Last session · <brand>" (one per brand, replaced each time). */
function hasContent(d) {
  if (!d) return false;
  return (d.visibility && d.visibility !== 'none') || (d.badge && d.badge !== 'none')
    || (d.inset && d.inset.id && !d.inset.hidden) || !!d.music
    || (d.scenes || []).some((sc) => sc.inset && sc.inset.id && !sc.inset.hidden)
    || (d.overlay && d.overlay.style && d.overlay.style !== 'none')
    || (d.blocks || []).length > 0 || (d.buttons || []).length > 0 || (d.media || []).length > 0
    // every section is its own now: anything on any of them counts
    || (d.scenes || []).some((sc) => (sc.visibility && sc.visibility !== 'none') || (sc.badge && sc.badge !== 'none')
      || (sc.blocks || []).length || (sc.buttons || []).length || (sc.media || []).length || !!sc.bg || !!sc.sound);
}

function startClean() {
  try {
    let list = loadTemplates();
    const keep = (brand, data) => {
      list = list.filter((t) => !(t.lastSession && t.data && t.data.brand === brand));
      list.unshift({
        id: `tpl_last_${brand}`, lastSession: true,
        name: `Last session · ${BRANDS[brand] ? BRANDS[brand].name : brand}`,
        format: data.format || '9x16', created: Date.now(), thumb: null, data,
      });
    };
    const current = snapshot();
    // nothing saved yet (a first launch) or an untouched start: nothing to keep
    const saved = !!localStorage.getItem(STORAGE_KEY);
    if (saved && !state.pristine && hasContent(current)) keep(state.brand, current);
    for (const [brand, d] of Object.entries(state.designs || {})) {
      if (brand !== state.brand && BRANDS[brand] && hasContent(d)) keep(brand, { ...clone(d), brand, format: state.format, contentType: state.contentType });
    }
    while (list.length > MAX_TEMPLATES) list.pop();
    writeTemplates(list);
  } catch (_) { /* never block the start on this */ }
  // a clean start stays in the brand you were working in (the very first launch: Ask Ruth.AI)
  const brand = BRANDS[state.brand] ? state.brand : DEFAULT_BRAND;
  Object.assign(state, starterDesign(brand)); state.overlays = [];
  state.brand = brand;
  state.format = '9x16';
  state.contentType = 'video';
  state.designs = {};
  state.scene = 0;
  state.pristine = true;            // nothing done yet: a reload starts clean again
  ensureColors();
  save();
}

/** Point a design that used a retired pre-dimmed background at the original, with Dim on. */
function retireIds(d) {
  if (!d) return;
  const dim = () => ({ style: 'dim', strength: DIM_DEFAULT, auto: true });
  const off = (o) => !o || o.style === 'none';
  if (RETIRED[d.backdrop]) { d.backdrop = RETIRED[d.backdrop]; if (off(d.overlay)) d.overlay = dim(); }
  if (RETIRED[d.sharedBg]) { d.sharedBg = RETIRED[d.sharedBg]; if (off(d.sharedOverlay)) d.sharedOverlay = dim(); }
  for (const sc of d.scenes || []) {
    if (RETIRED[sc.bg]) { sc.bg = RETIRED[sc.bg]; if (off(sc.overlay)) sc.overlay = dim(); }
  }
}

/* One screen over a clip runs as long as the clip — the clip's length is only
   known once it loads, so the preview loop checks (cheaply) and re-lays out. */
function syncSingleTime() {
  if (sequencing || playing || !Array.isArray(state.scenes) || state.scenes.length !== 1) return;
  const sc = state.scenes[0];
  if (sc.manual || musicFits()) return;
  if (Math.abs(sc.secs - recommendedSecs(sc)) > 0.01) renderScenes();
}

/** Drag the clip's right edge to trim it. */
function trimHandle(clip, sc, i, secsEl) {
  const grip = document.createElement('span');
  grip.className = 'frame-grip';
  grip.setAttribute('role', 'slider');
  grip.setAttribute('aria-label', `${sceneName(sc, i)} duration`);
  grip.setAttribute('aria-valuemin', String(SECS_MIN));
  grip.setAttribute('aria-valuemax', String(secsMax(sc)));
  grip.setAttribute('aria-valuenow', String(sc.secs));
  grip.tabIndex = 0;
  const best = recommendedSecs(sc);
  grip.title = `Drag to change the time · recommended ${best.toFixed(1)}s (double-click to use it)`;
  grip.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? SNAP : e.key === 'ArrowLeft' ? -SNAP : 0;
    if (d) {
      e.preventDefault();
      setSecs(i, sc.secs + d);
      // the timeline was redrawn: keep the keyboard on this handle
      const again = document.querySelectorAll('#scenes .clip')[i];
      if (again) again.querySelector('.frame-grip').focus();
    }
  });
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopPlayback();
    // double-tap the handle: back to the recommended time
    const now = performance.now();
    if (lastGripTap.i === i && now - lastGripTap.t < 400) {
      lastGripTap.i = -1;
      useRecommended(i);
      return;
    }
    lastGripTap.i = i;
    lastGripTap.t = now;
    grip.setPointerCapture(e.pointerId);
    const x0 = e.clientX, s0 = sc.secs, p0 = pps;
    clip.classList.add('is-resizing');
    // while dragging, a faint mark shows the recommended length
    const mark = document.createElement('span');
    mark.className = 'clip-rec';
    mark.style.left = `${best * p0 - 1}px`;
    mark.dataset.label = `${best.toFixed(1)}s`;
    clip.append(mark);
    // everything after this clip slides along as it grows or shrinks
    const edge = parseFloat(clip.style.left) + s0 * p0 - 2;
    const after = [...clip.parentElement.querySelectorAll('.clip, .frame-add')]
      .filter((el) => el !== clip && parseFloat(el.style.left) >= edge);
    const startT = sceneStart(i);
    const beats = beatSync() ? songBeats() : [];
    const move = (ev) => {
      const raw = s0 + (ev.clientX - x0) / p0;
      // with "cut on the beat", the edge clicks onto a nearby beat; otherwise half seconds
      const near = beats.length ? beats.reduce((b, x) => (Math.abs(x - startT - raw) < Math.abs(b - startT - raw) ? x : b), beats[0]) : null;
      const onBeat = near !== null && Math.abs(near - startT - raw) < 0.3;
      let v = onBeat ? Math.round((near - startT) * 100) / 100 : Math.round(raw / SNAP) * SNAP;
      v = Math.max(SECS_MIN, Math.min(secsMax(sc), v));
      clip.classList.toggle('on-beat', onBeat);
      if (v !== sc.secs) {
        sc.secs = v;
        clip.style.width = `${Math.max(8, v * p0 - 3)}px`;
        for (const el of after) el.style.translate = `${(v - s0) * p0}px 0`;
        secsEl.textContent = `${v.toFixed(1)}s`;
        grip.setAttribute('aria-valuenow', String(v));
        clip.classList.toggle('at-rec', v === best);
      }
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      clip.classList.remove('is-resizing');
      mark.remove();
      clip.classList.remove('at-rec');
      clip.classList.remove('on-beat');
      if (sc.secs !== s0) {
        sc.manual = true;
        if (state.music && state.music.fit) {
          state.music.fit = false;                  // a hand trim wins over "fit to sound"
          for (const x of state.scenes) x.manual = true;   // …and the fitted times stay
        }
      }
      save();
      renderScenes();
      renderMusicBar();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  return grip;
}

/* The left edge: the cut between this section and the one before it. Drag it
   and this section gets longer as the one before gets shorter (and the other
   way round) — the rest of the video stays where it is. Double-tap: this
   section back to its recommended time. */
function leftTrimHandle(clip, sc, i, secsEl) {
  const grip = document.createElement('span');
  grip.className = 'frame-grip is-left';
  grip.setAttribute('role', 'slider');
  grip.setAttribute('aria-label', `${sceneName(sc, i)} start (the cut before it)`);
  grip.setAttribute('aria-valuenow', String(sc.secs));
  grip.tabIndex = 0;
  grip.title = 'Drag to move the cut before this section';
  const prev = state.scenes[i - 1];
  const roll = (d) => {
    const p = Math.max(SECS_MIN, Math.min(secsMax(prev), prev.secs + d));
    const c = Math.max(SECS_MIN, Math.min(secsMax(sc), sc.secs - (p - prev.secs)));
    const moved = sc.secs - c;           // what the cut actually moved by
    prev.secs = Math.round((prev.secs + moved) * 100) / 100;
    sc.secs = c;
  };
  const commit = () => {
    prev.manual = true;
    sc.manual = true;
    if (state.music && state.music.fit) {
      state.music.fit = false;
      for (const x of state.scenes) x.manual = true;
    }
    save();
    renderScenes();
    renderMusicBar();
  };
  grip.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? SNAP : e.key === 'ArrowLeft' ? -SNAP : 0;
    if (!d) return;
    e.preventDefault();
    roll(d);
    commit();
    const again = document.querySelectorAll('#scenes .clip')[i];
    if (again) again.querySelector('.frame-grip.is-left').focus();
  });
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopPlayback();
    const now = performance.now();
    if (lastGripTap.i === -100 - i && now - lastGripTap.t < 400) { lastGripTap.i = -1; useRecommended(i); return; }
    lastGripTap.i = -100 - i;
    lastGripTap.t = now;
    grip.setPointerCapture(e.pointerId);
    const x0 = e.clientX, p0 = pps, prevS0 = prev.secs, curS0 = sc.secs;
    const prevClip = clip.previousElementSibling && clip.previousElementSibling.classList.contains('clip') ? clip.previousElementSibling : document.querySelectorAll('#scenes .clip')[i - 1];
    const left0 = parseFloat(clip.style.left);
    clip.classList.add('is-resizing');
    const move = (ev) => {
      prev.secs = prevS0; sc.secs = curS0;
      const raw = (ev.clientX - x0) / p0;
      roll(Math.round(raw / SNAP) * SNAP);
      const d = prev.secs - prevS0;
      clip.style.left = `${left0 + d * p0}px`;
      clip.style.width = `${Math.max(8, sc.secs * p0 - 3)}px`;
      if (prevClip) prevClip.style.width = `${Math.max(8, prev.secs * p0 - 3)}px`;
      secsEl.textContent = `${sc.secs.toFixed(1)}s`;
      grip.setAttribute('aria-valuenow', String(sc.secs));
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      clip.classList.remove('is-resizing');
      if (prev.secs !== prevS0) commit();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  return grip;
}

function renderRuler(span) {
  const r = $('#tl-ruler');
  r.innerHTML = '';
  r.style.left = `${leftPad}px`;
  r.style.width = `${span * pps}px`;
  const every = pps >= 44 ? 1 : pps >= 26 ? 2 : 5;
  for (let s2 = 0; s2 <= Math.ceil(span); s2++) {
    const tick = document.createElement('span');
    tick.className = 'tl-tick' + (s2 % every ? ' is-minor' : '');
    tick.style.left = `${s2 * pps}px`;
    if (!(s2 % every)) tick.textContent = `${s2}s`;
    r.append(tick);
  }
}

/** An "add" slot: Add hook / + (Value) / Add CTA. */
function slot(role, label, at, left) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `frame-add add-${role}` + (role === 'value' ? ' is-plus' : '');
  b.style.left = `${left}px`;
  b.innerHTML = role === 'value' ? '<span aria-hidden="true">+</span>'
    : `<span aria-hidden="true">+</span><span class="frame-add-label">${label}</span>`;
  const what = role === 'value' ? 'Add a value section' : role === 'hook' ? 'Add a hook' : 'Add a call to action';
  b.title = what;
  b.setAttribute('aria-label', what);
  b.addEventListener('click', () => { stopPlayback(); addScene(role, at); });
  return b;
}

function addScene(role, at) {
  commitScene();
  const id = `${role[0]}${Date.now().toString(36)}`;
  const sc = { id, role, on: true, ...SCENE_COPY[role], secs: SCENE_SECS[role], bg: null,
               overlay: role === 'cta' ? { style: 'dim', strength: CTA_DIM } : null, inset: NO_CARD(), blocks: [] };
  if (role === 'cta') { sc.ctaStyle = 'bold'; sc.btnMigrated = true; }
  // a new section starts with the colours of the one being edited
  for (const k of SCENE_STYLE) sc[k] = clone(state[k] === undefined ? null : state[k]);
  sc.buttons = [];                 // buttons are added under Buttons, never carried over
  sc.drawings = [];                // …and drawings are drawn on their own section
  sc.media = [];
  if (at === 0 && state.scenes.length) {
    // the new first screen takes over the shared background
    sc.bg = null;
  }
  state.scenes.splice(at, 0, sc);
  carryShared(sc);                 // what is on every section (marked All) comes along
  if (musicFits() || beatSync()) applySoundTiming();
  state.scene = at;               // nothing to commit: it was just made
  loadScene(at);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  save();
  renderScenes();
  syncThumbs();
  syncImageControls();
  syncSceneCard();
  draw();
}

function setSecs(i, v) {
  state.scenes[i].secs = Math.max(SECS_MIN, Math.min(secsMax(state.scenes[i]), Math.round(v / SNAP) * SNAP));
  state.scenes[i].manual = true;
  if (state.music && state.music.fit) {
    state.music.fit = false;
    for (const x of state.scenes) x.manual = true;
  }
  save();
  renderScenes();
  renderMusicBar();
}

/** Back to the recommended time; the screen follows it from now on. */
function useRecommended(i) {
  const sc = state.scenes[i];
  if (state.music && state.music.fit) {
    state.music.fit = false;
    for (const x of state.scenes) x.manual = true;
  }
  sc.manual = false;
  sc.secs = recommendedSecs(sc);
  save();
  renderScenes();
  renderMusicBar();
}

/** A new value section starts as a copy of this one, right after it. */
function duplicateScene(i) {
  commitScene();
  const src = state.scenes[i];
  const sc = clone(src);
  sc.id = `v${Date.now().toString(36)}`;
  sc.role = 'value';
  if (src.role !== 'value') {
    // from the Hook or the CTA: a fresh value screen, on the shared background
    Object.assign(sc, SCENE_COPY.value, { bg: null, overlay: null, manual: false, secs: SCENE_SECS.value, inset: NO_CARD(), blocks: [] });
    delete sc.ctaStyle;
    sc.buttons = [];
    sc.drawings = [];
    sc.media = [];
  }
  const at = src.role === 'hook' || src.role === 'value' ? i + 1 : i;
  state.scenes.splice(at, 0, sc);
  state.scene = at;
  loadScene(at);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  if (musicFits() || beatSync()) applySoundTiming();
  save();
  renderScenes();
  renderMusicBar();
  syncThumbs();
  syncImageControls();
  syncSceneCard();
  draw();
}

/** Duplicate a section, whatever it is, right after it. */
function duplicateSection(i) {
  commitScene();
  const sc = clone(state.scenes[i]);
  sc.id = `${sc.role[0]}${Date.now().toString(36)}`;
  state.scenes.splice(i + 1, 0, sc);
  state.scene = i + 1;
  loadScene(i + 1);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  if (musicFits() || beatSync()) applySoundTiming();
  save();
  renderScenes();
  renderMusicBar();
  syncThumbs();
  syncImageControls();
  syncSceneCard();
  draw();
}

/* --- the clip menu ------------------------------------------------------------
   Tapping a clip opens a small menu above it: add a value section (a copy of
   this one), go back to the recommended time, remove. No × on the clips, so
   nothing small sits on top of the trim handles. */
let clipMenuFor = -1;

const MENU_ICONS = {
  captions: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 4.5h11l3.5 3.5v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5z"/><path d="M8 4.5v5h7v-5M8 20.5v-6h8v6"/></svg>',
  add: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 20 9l-9.5 9.5H6L3.8 16.3a1.6 1.6 0 0 1 0-2.3z"/><path d="M9 18.5h11M11 9l4.5 4.5"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m4 16 5-5 4 4 2-2 5 5"/></svg>',
  remove: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><circle cx="8.2" cy="15.8" r="3.2"/><path d="M11.4 15.8V4.8c1.6 1.9 3.9 3 6.4 3.3"/></svg>',
  note: '<svg viewBox="0 0 24 24"><circle cx="8.2" cy="15.8" r="3.2"/><path d="M11.4 15.8V4.8c1.6 1.9 3.9 3 6.4 3.3"/></svg>',
  film: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="12" height="12" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><rect x="8" y="9" width="8" height="7" rx="1.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3z"/></svg>',
  cover: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="m5 16 4-4 3 3 2-2 5 5"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2-.8 2-1.8 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.9-1.6h2.1a3.6 3.6 0 0 0 3.6-3.6C20.5 6.9 16.7 3.5 12 3.5z"/><circle cx="7.6" cy="11" r="1.1"/><circle cx="10.2" cy="7.4" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/></svg>',
  hide: '<svg viewBox="0 0 24 24"><path d="M3.5 12s3-5.5 8.5-5.5S20.5 12 20.5 12s-3 5.5-8.5 5.5S3.5 12 3.5 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M4.5 4.5l15 15"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18l-4 1z"/></svg>',
  rewind: '<svg viewBox="0 0 24 24"><path d="M11 7 5 12l6 5V7zM19 7l-6 5 6 5V7z"/></svg>',
  space: '<svg viewBox="0 0 24 24"><path d="M4 3h16M4 21h16"/><rect x="7" y="7" width="10" height="3" rx="1"/><rect x="7" y="14" width="10" height="3" rx="1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  blank: '<svg viewBox="0 0 24 24"></svg>',
  draw: '<svg viewBox="0 0 24 24"><path d="M4 20c3-1 4.5-2.5 6-4.5L18.5 7a2.1 2.1 0 0 0-3-3L7 12.5C5 14 4 16.5 4 20z"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shrink: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  safe: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><rect x="7.5" y="6.5" width="9" height="11" rx="1" stroke-dasharray="2 2"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/></svg>',
  button: '<svg viewBox="0 0 24 24"><rect x="3.5" y="7.5" width="17" height="9" rx="4.5"/><path d="M9 12h6"/></svg>',
  badge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="11" r="6.5"/><path d="M8.5 16.5 7 21l5-2.2L17 21l-1.5-4.5"/></svg>',
  section: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="7" height="14" rx="1.6"/><rect x="13.5" y="5" width="7" height="14" rx="1.6"/><path d="M17 10v4M15 12h4"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.5 9.5V19.5h11V9.5"/><path d="M10 19.5v-5h4v5"/></svg>',
  tidy: '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><rect x="6" y="5" width="12" height="4" rx="1.2"/><rect x="8" y="11" width="8" height="3" rx="1.2"/><rect x="5" y="16" width="14" height="4" rx="1.2"/></svg>',
};

function closeClipMenu() {
  const m = $('#clip-menu');
  if (!m || m.hidden) return;
  m.hidden = true;
  clipMenuFor = -1;
  hideScrim('menu');
}

/* --- the scrim -----------------------------------------------------------------
   Anything that opens on top of the page — the clip and sound menus, the phone's
   section sheets — sits on one semi-transparent layer that tones the page down
   (the modal sheets have their own). A tap on it closes what is open. It fades
   out rather than vanishing at once, so the tap that closed it can't land on
   whatever is underneath. */
let scrimTimer = 0;
function showScrim(kind) {
  const s = $('#ui-scrim');
  clearTimeout(scrimTimer);
  s.dataset.for = kind;
  s.hidden = false;
  s.classList.remove('is-leaving');
  void s.offsetWidth;
  s.classList.add('is-on');
}

function hideScrim(kind) {
  const s = $('#ui-scrim');
  if (s.hidden || s.dataset.for !== kind) return;
  s.classList.remove('is-on');
  s.classList.add('is-leaving');
  clearTimeout(scrimTimer);
  scrimTimer = setTimeout(() => { s.hidden = true; s.classList.remove('is-leaving'); s.dataset.for = ''; }, 260);
}

function wireScrim() {
  const s = $('#ui-scrim');
  s.addEventListener('click', () => {
    if (s.classList.contains('is-leaving')) return;
    if (s.dataset.for === 'sheet') closeSectionSheet();
    else closeClipMenu();
  });
}

function openMenuAt(anchor, items, label, extra) {
  const m = $('#clip-menu');
  m.innerHTML = '';
  m.classList.remove('is-quick', 'is-multi');
  m.setAttribute('aria-label', label);
  for (const it of items) {
    if (it.sep) { const hr = document.createElement('div'); hr.className = 'clip-menu-sep'; hr.setAttribute('role', 'separator'); m.append(hr); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.className = 'clip-menu-item' + (it.danger ? ' is-danger' : '') + (it.icon === 'add' ? ' is-add' : '') + (it.more ? ' has-more' : '');
    if (it.more) b.setAttribute('aria-haspopup', 'menu');
    b.innerHTML = (it.icon ? `<i class="clip-menu-icon" aria-hidden="true">${MENU_ICONS[it.icon]}</i>` : '')
      + `<span>${it.label}</span>` + (it.sub ? `<small>${it.sub}</small>` : '')
      + (it.more ? '<b class="clip-menu-more" aria-hidden="true">›</b>' : '');
    b.addEventListener('click', (e) => { e.stopPropagation(); closeClipMenu(); it.run(); });
    m.append(b);
  }
  if (extra) m.append(extra);
  m.hidden = false;
  showScrim('menu');
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + Math.min(r.width, 220) / 2 - w / 2));
  const above = r.top - h - 8;
  const below = window.innerHeight - r.bottom - h - 8;
  const top = above > 8 ? above : below > 8 ? r.bottom + 8 : Math.max(8, window.innerHeight - h - 8);
  m.style.left = `${left}px`;
  m.style.top = `${top}px`;
  m.classList.toggle('is-below', above <= 8 && below > 8);
  m.classList.toggle('is-floating', above <= 8 && below <= 8);
  const first = m.querySelector('input, button');
  if (first) { first.focus({ preventScroll: true }); if (first.select) first.select(); }
}

/* Tapping a clip opens everything for that section: add a section, its
   background, its photo / video card, its own sound, timing, cover, remove.
   Background, card and sound open a second menu in place. */
function openClipMenu(i) {
  const clip = document.querySelectorAll('#scenes .clip')[i];
  const sc = state.scenes[i];
  if (!clip || !sc) return;
  if (clipMenuFor === i) { closeClipMenu(); return; }     // tap again to close
  const values = state.scenes.filter((x) => x.role === 'value').length;
  const carousel = state.contentType === 'carousel';
  const has = (role) => state.scenes.some((x) => x.role === role);
  const items = [];
  items.push({ icon: 'add', label: 'Add section', sub: 'Hook, value or CTA — after this one', more: true, run: () => openAddSectionMenu(i) });
  items.push({ icon: 'copy', label: 'Duplicate section', sub: 'Everything on it, right after it', run: () => duplicateSection(i) });
  if (i > 0) items.push({ icon: 'left', label: 'Move earlier', sub: 'Or drag the clip along the timeline', run: () => moveScene(i, i - 1) });
  if (i < state.scenes.length - 1) items.push({ icon: 'right', label: 'Move later', sub: i > 0 ? undefined : 'Or drag the clip along the timeline', run: () => moveScene(i, i + 1) });
  // background and media are set under the section buttons (they follow the selected section)
  items.push({ sep: true });
  if (!carousel) {
    items.push({ icon: 'note', label: sc.sound ? `Sound · ${sc.sound.name}` : 'Add sound to this section', sub: sc.sound ? 'Plays while this section is on' : undefined, more: true, run: () => openSceneSoundMenu(i) });
  }
  items.push({ sep: true });
  const best = recommendedSecs(sc);
  if (!carousel) {
    items.push({ icon: 'time', label: `Duration · ${sc.secs.toFixed(1)}s`, sub: Math.abs(sc.secs - best) > 0.01 ? `Recommended ${best.toFixed(1)}s` : 'The recommended time', more: true, run: () => openDurationMenu(i) });
  }
  if (!carousel) items.push({ icon: 'cover', label: 'Save as cover image', run: () => exportCover(i, 1) });
  if (sectionHasContent(i)) items.push({ icon: 'tidy', label: 'Tidy up', sub: 'Centred, evenly spaced — in this format', run: () => { if (i !== state.scene) selectScene(i); tidySection(); } });
  if (sectionHasContent(i)) items.push({ icon: 'clear', label: 'Clear section', sub: 'Text, buttons, media, badge — the background stays', run: () => clearSection(i) });
  // v4 · a locked section keeps its layout and its text: Tidy up and Adapt layout leave it alone
  items.push({ icon: sc.locked ? 'edit' : 'safe', label: sc.locked ? 'Unlock layout' : 'Lock layout', sub: sc.locked ? 'Tidy up and Adapt layout can change it again' : 'Tidy up and Adapt layout leave this section as it is',
    run: () => { commitScene(); sc.locked = !sc.locked; save(); renderScenes(); showToast(sc.locked ? `${sceneName(sc, i)} locked` : `${sceneName(sc, i)} unlocked`); } });
  if (sc.auto && isPureAuto(sc)) items.push({ icon: 'note', label: 'Made by Adapt layout', sub: 'Holds the rest of the section before it · it merges back when there is room', run: () => {} });
  if (state.scenes.length > 1) {
    items.push({ icon: 'remove', label: 'Remove this section', danger: true, run: () => { stopPlayback(); removeScene(i); } });
  }
  while (items.length && items[items.length - 1].sep) items.pop();
  openMenuAt(clip, items, `${sceneName(sc, i)} options`);
  clipMenuFor = i;
}

function clipEl(i) { return document.querySelectorAll('#scenes .clip')[i]; }

/** Type a section's time: seconds, to a tenth, 1–30 s (Value: up to 180 s). */
function openDurationMenu(i) {
  const sc = state.scenes[i];
  const best = recommendedSecs(sc);
  const form = document.createElement('form');
  form.className = 'clip-dur';
  form.noValidate = true;            // out-of-range numbers are clamped, not refused
  form.innerHTML = `<label class="clip-dur-lbl" for="clip-dur-in">${sceneName(sc, i)} duration</label>
    <div class="clip-dur-row">
      <input id="clip-dur-in" type="number" inputmode="decimal" min="${SECS_MIN}" max="${secsMax(sc)}" step="0.1" value="${sc.secs.toFixed(1)}">
      <span class="clip-dur-unit">s</span>
      <button type="submit" class="clip-dur-set">Set</button>
    </div>
    <button type="button" class="clip-dur-rec">Use recommended ${best.toFixed(1)}s</button>
    <p class="clip-dur-note">${SECS_MIN}–${secsMax(sc)} s${sc.role === 'value' ? ' (up to 3 min)' : ''}</p>`;
  const input = form.querySelector('input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Number(String(input.value).replace(',', '.'));
    if (!isFinite(v)) { input.focus(); return; }
    closeClipMenu();
    setSecsExact(i, v);
  });
  form.querySelector('.clip-dur-rec').addEventListener('click', (e) => { e.stopPropagation(); closeClipMenu(); useRecommended(i); });
  form.addEventListener('pointerdown', (e) => e.stopPropagation());
  openMenuAt(clipEl(i), [], 'Duration', form);
  clipMenuFor = -9;
}

/** A typed time: kept to a tenth of a second (a drag snaps to halves). */
function setSecsExact(i, v) {
  const sc = state.scenes[i];
  sc.secs = Math.max(SECS_MIN, Math.min(secsMax(sc), Math.round(v * 10) / 10));
  sc.manual = true;
  if (state.music && state.music.fit) {
    state.music.fit = false;
    for (const x of state.scenes) x.manual = true;
  }
  save();
  renderScenes();
  renderMusicBar();
}

/** Full screen: a new section after the one shown — Hook, Value or CTA. */
function fsAddSection() {
  const at = state.scene + 1;
  const add = (role) => () => {
    if (playing) stopPlayback(true);
    commitScene();
    pushUndo('Section added');          // snapshot first: Undo takes it out again
    addScene(role, at);
    syncCategory();
    showScope(state.scene);
    showToast(`${sceneName(state.scenes[state.scene], state.scene)} added`, 'Undo', undoLast);
  };
  const anchor = addAnchor && addAnchor.isConnected && addAnchor.offsetParent ? addAnchor : $('#fs-add-section');
  openMenuAt(anchor, [
    { icon: 'add', label: 'Hook', sub: 'An opener that stops the scroll', run: add('hook') },
    { icon: 'add', label: 'Value', sub: 'A point, a step, a reason', run: add('value') },
    { icon: 'add', label: 'Call to action', sub: 'What to do next', run: add('cta') },
  ], 'Add section');
}

function openAddSectionMenu(i) {
  const add = (role) => () => addScene(role, i + 1);
  openMenuAt(clipEl(i), [
    { icon: 'add', label: 'Hook', sub: 'An opener that stops the scroll', run: add('hook') },
    { icon: 'add', label: 'Value', sub: 'A point, a step, a reason', run: add('value') },
    { icon: 'add', label: 'Call to action', sub: 'What to do next', run: add('cta') },
  ], 'Add section');
  clipMenuFor = -8;
}

function openBgMenu(i) {
  const sc = state.scenes[i];
  const items = [
    { icon: 'image', label: 'Choose a background', sub: 'Patterns, pictures, colors', run: () => selectElement('background') },
    { icon: 'film', label: 'Image or video file', sub: isBase(i) ? 'Replaces the shared background' : 'For this section', run: () => $('#file-input').click() },
    { icon: 'camera', label: 'Record with the camera', run: () => openCamera('background') },
  ];
  if (!isBase(i) && sc.bg) items.push({ icon: 'rewind', label: 'Use the first section’s background', run: matchHook });
  openMenuAt(clipEl(i), items, 'Background');
  clipMenuFor = -5;
}

function openCardMenu(i) {
  const card = state.inset && state.inset.id;
  const items = [
    { icon: 'film', label: card ? 'Replace with a file' : 'Image or video file', run: () => $('#inset-input').click() },
    { icon: 'camera', label: 'Record with the camera', run: () => openCamera('card') },
  ];
  if (card) {
    items.push({ icon: 'edit', label: 'Size and corners', run: () => selectElement('inset') });
    items.push({ icon: 'remove', label: 'Remove from this section', danger: true, run: removeSceneCard });
  }
  openMenuAt(clipEl(i), items, 'Photo / video card');
  clipMenuFor = -6;
}

function openSceneSoundMenu(i) {
  const sc = state.scenes[i];
  const pick = (sel) => () => { soundTarget = i; $(sel).click(); };
  const items = [
    { icon: 'note', label: sc.sound ? 'Replace with an audio file' : 'Audio file', sub: 'MP3, M4A, WAV, AAC …', run: pick('#music-input') },
    { icon: 'film', label: 'Sound from a video', sub: 'MP4 or MOV — uses its audio', run: pick('#music-video-input') },
  ];
  if (sc.sound) items.push({ icon: 'remove', label: 'Remove this section’s sound', danger: true, run: () => removeSceneSound(i) });
  openMenuAt(clipEl(i), items, 'Section sound');
  clipMenuFor = -7;
}

/* --- a sound per section ------------------------------------------------------
   Besides the one soundtrack under the whole video, any section can carry its
   own sound — a voice-over, an effect, a sting. It plays from its start while
   that section is on (cut at the section's end), in the preview and the
   export, mixed with the soundtrack and the clips' own sound. The file is kept
   with the soundtrack files, in this browser. */
const sceneBufs = new Map();          // sound id → AudioBuffer
let soundTarget = null;               // the section the next picked sound is for (null: the soundtrack)
let sceneVoice = null;                // { src, gain } while playing
let shownScene = 0;                   // the section on the canvas (set by loadScene)

async function addSceneSound(i, file) {
  const sc = state.scenes[i];
  if (!sc) return;
  let buf;
  try {
    buf = await ac().decodeAudioData(await file.arrayBuffer());
  } catch (_) {
    musicError(`Couldn't read the sound in ${file.name} — try an MP3, M4A, WAV, MP4 or MOV.`);
    return;
  }
  const old = sc.sound && sc.sound.id;
  const id = `ssnd_${Date.now().toString(36)}`;
  try { await musicStore('readwrite', (st) => st.put(file, id)); } catch (_) { /* this session only */ }
  sceneBufs.set(id, buf);
  sc.sound = { id, name: file.name.replace(/\.[^.]+$/, ''), secs: buf.duration };
  if (old) dropSceneSoundFile(old);
  keepStorage();
  save();
  renderScenes();
}

function removeSceneSound(i) {
  const sc = state.scenes[i];
  if (!sc || !sc.sound) return;
  const id = sc.sound.id;
  sc.sound = null;
  dropSceneSoundFile(id);
  save();
  renderScenes();
}

/** Delete a section sound's file unless another section or a saved design still uses it. */
function dropSceneSoundFile(id) {
  const used = state.scenes.some((x) => x.sound && x.sound.id === id)
    || loadTemplates().some((t) => t.data && (t.data.scenes || []).some((x) => x.sound && x.sound.id === id));
  if (used) return;
  sceneBufs.delete(id);
  musicStore('readwrite', (st) => st.delete(id)).catch(() => {});
}

/** Decode the section sounds this design uses (after a reload, a template, a brand switch). */
async function restoreSceneSounds() {
  for (const sc of state.scenes || []) {
    if (!sc.sound || sceneBufs.has(sc.sound.id)) continue;
    try {
      const file = await musicStore('readonly', (st) => st.get(sc.sound.id));
      if (!file) throw new Error('gone');
      sceneBufs.set(sc.sound.id, await ac().decodeAudioData(await file.arrayBuffer()));
    } catch (_) { sc.sound = null; }
  }
  renderScenes();
}

const sceneSoundBuf = (sc) => sc && sc.sound && sceneBufs.get(sc.sound.id);

function startSceneVoice(i, offset = 0) {
  stopSceneVoice();
  const sc = state.scenes[i];
  const buf = sceneSoundBuf(sc);
  if (!buf || state.contentType === 'carousel') return;
  const dur = Math.min(buf.duration, sc.secs) - offset;
  if (dur <= 0.02) return;
  const ctx2 = ac();
  if (ctx2.state === 'suspended') ctx2.resume().catch(() => {});
  const src = ctx2.createBufferSource();
  src.buffer = buf;
  const gain = ctx2.createGain();
  src.connect(gain).connect(ctx2.destination);
  const now = ctx2.currentTime;
  gain.gain.setValueAtTime(1, now + Math.max(0, dur - 0.08));
  gain.gain.linearRampToValueAtTime(0.0001, now + dur);   // no click at the cut
  src.start(now, offset, dur);
  sceneVoice = { src, gain };
}

function stopSceneVoice() {
  if (!sceneVoice) return;
  try { sceneVoice.src.stop(); } catch (_) {}
  try { sceneVoice.gain.disconnect(); } catch (_) {}
  sceneVoice = null;
}

/* Each clip shows its screen as film frames, tiled along its length. */
function frameImage(i, h = 48) {
  const f = FORMATS[state.format];
  const w = Math.max(20, Math.round(h * f.w / f.h));
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * 2;
  const keep = { h1: state.h1, body: state.body, sceneRole: state.sceneRole, ctaStyle: state.ctaStyle,
                 backdrop: state.backdrop, overlay: state.overlay, inset: state.inset, blocks: state.blocks };
  for (const k of SCENE_STYLE) keep[k] = state[k];
  const adjKeep = JSON.parse(JSON.stringify(state.adjust || {}));
  const was = sequencing;
  sequencing = true;
  try {
    if (i !== state.scene) loadScene(i);
    render(cv.getContext('2d'), cv.width, cv.height, state, {});
  } catch (_) { /* artwork still loading */ }
  Object.assign(state, keep);
  for (const [k, v] of Object.entries(adjKeep)) if (state.adjust[k]) Object.assign(state.adjust[k], v);
  sequencing = was;
  return { url: cv.toDataURL('image/jpeg', 0.7), w };
}

/* What a clip's thumbnail depends on — when any of it changes (a new
   background or clip, Dim, text, badge, a video's first frame arriving), the
   thumbnail is redrawn. Checked from the paint loop, at most twice a second. */
function filmSig(i) {
  const sc = state.scenes[i];
  const live = i === state.scene;
  const bg = live ? state.backdrop : isBase(i) ? state.sharedBg : (sc.bg || sharedFor());
  const ov = live ? state.overlay : (!isBase(i) && sc.overlay) || state.sharedOverlay;
  const ins = (live ? state.inset : sc.inset) || state.inset;
  const blocks = (live ? state.blocks : sc.blocks) || [];
  const ready = (id) => { const m = id && mediaFor(id); return m && m.media === 'video' ? (m.el.readyState >= 2 ? 1 : 0) : ''; };
  return JSON.stringify([bg, ready(bg), ov, live ? state.h1 : sc.h1, live ? state.body : sc.body, sc.role, sc.ctaStyle,
    state.format, state.card, state.textTone, state.badge, state.badgeScale, state.badgePowered, state.visibility,
    state.h1Scale, state.bodyScale, state.pos[state.format], ins.id, ins.hidden, ready(ins.id),
    ins.scale, ins.radius, blocks, state.brand, state.scenes.length, state.contentType,
    SCENE_STYLE.map((k) => (live ? state[k] : sc[k])), live ? state.adjust[bg] : sceneAdjust(sc, bg)]);
}

let filmCheck = 0;
function refreshFilms(force) {
  const now = performance.now();
  if (!force && (sequencing || playing || now - filmCheck < 500)) return;
  filmCheck = now;
  const clips = document.querySelectorAll('#scenes .clip');
  clips.forEach((clip, i) => {
    if (!state.scenes[i]) return;
    const sig = filmSig(i);
    if (clip.dataset.sig !== sig) paintClipFilm(clip, i);
  });
}

function paintClipFilm(clip, i) {
  clip.dataset.sig = filmSig(i);
  const carousel = state.contentType === 'carousel';
  // a video clip shows its frames along its length; a carousel slide is one image
  const { url, w } = frameImage(i, carousel ? 104 : 48);
  clip.style.backgroundImage = `url(${url})`;
  clip.style.backgroundSize = carousel ? 'auto 100%' : `${w}px 100%`;
  clip.style.backgroundRepeat = carousel ? 'no-repeat' : 'repeat-x';
  clip.style.backgroundPosition = carousel ? 'center' : 'left center';
}

/* Under the timeline, only when there is something to set: the CTA's style,
   and a screen's own background (with Match Hook to undo it). Time is set by
   dragging the clip's edge, so there is no time control here. */
function renderSceneBar() {
  const bar = $('#scene-bar');
  const sc = state.scenes[state.scene];
  bar.innerHTML = '';

  // (a CTA's button is made under Buttons now — no style switch here)

  // a screen with its own background says so, and can go back to the shared one
  if (!isBase(state.scene)) {
    commitScene();
    // the CTA starts dimmed on purpose — that isn't worth a note
    const ctaDefault = sc.role === 'cta' && !sc.bg && sc.overlay && sc.overlay.style === 'dim'
      && Math.abs(sc.overlay.strength - CTA_DIM) < 1e-6;
    if ((sc.bg || sc.overlay) && !ctaDefault) {
      const bgNote = document.createElement('span');
      bgNote.className = 'scene-bgnote';
      bgNote.textContent = sc.bg ? 'Own background' : 'Own Dim';
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'scene-match';
      m.textContent = 'Match first section';
      m.addEventListener('click', matchHook);
      bar.append(bgNote, m);
    }
  }
  bar.hidden = !bar.children.length;
}

/* The panel names its fields after the screen being edited. */
function syncScenePanel() {
  const sc = state.scenes[state.scene];
  const role = roleFor(sc);
  const h1Label = $('#group-h1 .group-title label');
  const bodyLabel = $('#group-body .group-title label');
  h1Label.textContent = role === 'cta' ? 'Call to action' : role === 'hook' ? 'Hook' : 'Header';
  bodyLabel.textContent = role === 'cta' ? 'Supporting line' : 'Body';
  syncCardScope();
  // every screen, the hook included, can carry a body line
  syncTextMode();
  syncCategory();
}

function removeScene(i) {
  commitScene();
  pushUndo(`${sceneName(state.scenes[i], i)} removed`);
  state.scenes.splice(i, 1);
  if (musicFits() || beatSync()) applySoundTiming();
  const next = Math.min(i, state.scenes.length - 1);
  state.scene = next;
  // removing the first screen hands the shared background to the next one
  loadScene(next);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  save();
  renderScenes();
  syncThumbs();
  syncImageControls();
  draw();
}

function wireScenes() {
  ensureScenes();
  loadScene(state.scene);
  // typing in the panel or on the canvas updates the screen's label as you go
  const live = () => {
    commitScene();
    renderScenesLabels();
    // recommended times follow the text — untouched clips re-time as you type
    clearTimeout(live.t);
    live.t = setTimeout(() => {
      if (state.scenes.some((x) => !x.manual)) {
        const before = state.scenes.map((x) => x.secs).join();
        autoTimes();
        if (state.scenes.map((x) => x.secs).join() !== before) { save(); renderScenes(); }
      }
    }, 500);
  };
  $('#in-h1').addEventListener('input', live);
  $('#in-body').addEventListener('input', live);
  renderScenes();
}

function renderScenesLabels() {
  const clip = document.querySelectorAll('#scenes .clip')[state.scene];
  if (!clip) return;
  clip.querySelector('.frame-line').textContent = lineOf(state.scenes[state.scene], state.scene);
  clearTimeout(renderScenesLabels.t);
  renderScenesLabels.t = setTimeout(() => paintClipFilm(clip, state.scene), 200);
}

/* Slides: one image per included screen, numbered in order. */
async function exportSlides(type, scale, collect) {
  commitScene();
  sequencing = true;
  try { await slides(type, scale, collect); } finally { sequencing = false; loadScene(state.scene); draw(); }
}

async function slides(type, scale, collect) {
  const list = enabledScenes();
  const f = FORMATS[state.format];
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const kebab = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (let n = 0; n < list.length; n++) {
    const { sc, i } = list[n];
    loadScene(i);
    const cv = document.createElement('canvas');
    cv.width = f.w * scale;
    cv.height = f.h * scale;
    const g = cv.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
    render(g, cv.width, cv.height, state, {});
    const name = `${exportSlug()}-${String(n + 1).padStart(2, '0')}-${kebab(sceneName(sc, i))}-${cv.width}x${cv.height}.${ext}`;
    const blob = await new Promise((r) => cv.toBlob(r, type, type === 'image/jpeg' ? 0.92 : undefined));
    // v4: collected for a .zip or a PDF, or downloaded one by one as before
    if (collect) { collect.push({ name, data: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height }); await new Promise((r) => setTimeout(r, 0)); continue; }
    downloadBlob(blob, name);
    // browsers drop downloads fired in the same instant
    await new Promise((r) => setTimeout(r, 350));
  }
}

/* Video of several screens: the recorder draws `state` every frame, so the
   screens are swapped in on a clock that starts when recording does. */
async function exportScenesVideo(seconds, scale) {
  commitScene();
  const list = enabledScenes();
  if (list.length < 2) {
    // one section: still keep a clock, so overlay clips play at their times
    let t1 = 0;
    const base = list[0] ? sceneStart(list[0].i) : 0;   // v4: one section of several starts at its own time
    const tk = setInterval(() => { if (!recording) return; if (!t1) t1 = performance.now(); seqClock = base + (performance.now() - t1) / 1000; }, 15);
    try { return await exportVideo(seconds, scale); } finally { clearInterval(tk); seqClock = null; }
  }
  // each screen for its own time; the total is the recording length
  const ends = [];
  let acc = 0;
  for (const { sc } of list) { acc += sc.secs * 1000; ends.push(acc); }
  sequencing = true;
  let t0 = 0;
  let shown = list[0].i;
  loadScene(shown);
  const clock = setInterval(() => {
    if (!recording) return;
    if (!t0) t0 = performance.now();
    const el = performance.now() - t0;
    let k = ends.findIndex((e) => el < e);
    if (k < 0) k = list.length - 1;
    const want = list[k].i;
    const sc = state.scenes[want];
    // v4: overlay clips and transitions run on the film's clock — the same as el for the whole
    // film; for some sections, each one's own place on the timeline
    seqClock = list.length === state.scenes.length ? el / 1000 : sceneStart(want) + (el - (k ? ends[k - 1] : 0)) / 1000;
    if (want !== shown) { snapPrev(shown); shown = want; loadScene(want); }
  }, 15);
  try {
    await exportVideo(acc / 1000, scale);
  } finally {
    clearInterval(clock);
    sequencing = false;
    seqClock = null;
    transPrev = null;
    loadScene(state.scene);
    draw();
  }
}

const sequenceSecs = () => enabledScenes().reduce((t, { sc }) => t + sc.secs, 0);

/* A cover (title image) for the video: one screen as a still — the Hook by
   default, or any screen from its menu. Same size as the video; a clip in
   the background is caught at the frame on screen. */
const coverIndex = () => Math.max(0, state.scenes.findIndex((x) => x.role === 'hook'));

async function exportCover(i, scale = 1) {
  commitScene();
  await whenHiReady();
  const f = FORMATS[state.format];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale;
  cv.height = f.h * scale;
  const g = cv.getContext('2d');
  const was = sequencing;
  sequencing = true;
  try {
    loadScene(i);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cv.width, cv.height);
    render(g, cv.width, cv.height, state, {});
  } finally {
    sequencing = was;
    loadScene(state.scene);
    draw();
  }
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
  downloadBlob(blob, `${exportSlug()}-cover-${cv.width}x${cv.height}.jpg`);
}

/* --- playback ----------------------------------------------------------------
   Play runs the screens on the preview in order, each for its time, with the
   sound under it — what the video export will record. Pause leaves the
   playhead where it is and opens that screen for editing.
   ------------------------------------------------------------------------ */
let playT = 0;          // playhead, seconds from the start of the timeline
let playing = false;
let playRaf = 0;
let playFrom = 0;       // performance.now() at playT = playStart
let playStart = 0;
let playShown = -1;
let playVoice = null;   // the sound's buffer source while playing

function sceneStart(i) {
  let t = 0;
  for (let k = 0; k < i && k < state.scenes.length; k++) t += playSecs(state.scenes[k]);
  return t;
}

function sceneAt(t) {
  let acc = 0;
  for (let k = 0; k < state.scenes.length; k++) {
    acc += playSecs(state.scenes[k]);
    if (t < acc - 1e-6) return k;
  }
  return state.scenes.length - 1;
}

function movePlayhead(t) {
  const head = $('#tl-playhead');
  if (!head) return;
  head.style.transform = `translateX(${leftPad + t * pps}px)`;
  $('#tl-time').textContent = `${fmtTime(t)} / ${fmtTime(timelineSecs())}`;
  syncPreviewProgress(t);
}

/* v3.20 · Preview shows how far the film (or the slideshow) has got: a thin bar along the
   canvas's bottom edge — one bar for a video, one segment per slide for a carousel. */
function syncPreviewProgress(t = playT) {
  const wrap = $('#canvas-wrap');
  let on = false;
  try { on = fsMode === 'preview'; } catch (_) { return; }     // called before the preview state exists
  if (!wrap || (!on && !$('#pv-progress'))) return;
  let bar = $('#pv-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pv-progress';
    bar.className = 'pv-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Preview progress');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.hidden = true;
    wrap.append(bar);
  }
  bar.hidden = !on;
  if (!on) return;
  const carousel = state.contentType === 'carousel';
  const n = carousel ? state.scenes.length : 1;
  if (bar.childElementCount !== n) {
    bar.innerHTML = '';
    for (let k = 0; k < n; k++) { const seg = document.createElement('span'); seg.append(document.createElement('i')); bar.append(seg); }
  }
  const total = Math.max(0.001, timelineSecs());
  const segs = bar.children;
  if (carousel) {
    for (let k = 0; k < n; k++) {
      const a = sceneStart(k), d = Math.max(0.001, playSecs(state.scenes[k]));
      const f = playing ? Math.max(0, Math.min(1, (t - a) / d)) : (k <= state.scene ? 1 : 0);
      segs[k].firstChild.style.transform = `scaleX(${f})`;
    }
  } else segs[0].firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, t / total))})`;
  bar.setAttribute('aria-valuenow', String(Math.round((carousel && !playing ? (state.scene + 1) / n : t / total) * 100)));
  bar.classList.toggle('is-playing', playing);
  // laid along the canvas's own bottom edge, inside it
  bar.style.left = `${canvas.offsetLeft + 14}px`;
  bar.style.width = `${Math.max(20, canvas.offsetWidth - 28)}px`;
  bar.style.top = `${canvas.offsetTop + canvas.offsetHeight - 16}px`;
}

/** Keep the playhead in view while it runs past the edge. */
function followPlayhead(t) {
  const sc = $('#tl-scroll');
  if (state.contentType === 'carousel') {
    // slides, not time: keep the live slide in view
    const live = document.querySelector('#scenes .clip.is-live');
    if (live && (live.offsetLeft < sc.scrollLeft || live.offsetLeft + live.offsetWidth > sc.scrollLeft + sc.clientWidth)) sc.scrollLeft = Math.max(0, live.offsetLeft - 20);
    return;
  }
  const x = leftPad + t * pps;
  if (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 40) {
    sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.3);
  }
}

function showPlayState() {
  $('#tl-play').classList.toggle('is-playing', playing);
  $('#tl-play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('#timeline').classList.toggle('is-playing', playing);
  syncFsPlay();
}

function startPlayback() {
  if (playing) return;
  if (!(clipMenuFor <= -13)) closeClipMenu();     // v3.13: a transition menu stays open while its cut plays
  commitScene();
  const total = timelineSecs();
  if (playT >= total - 0.05) playT = 0;
  playing = true;
  sequencing = true;
  playStart = playT;
  playFrom = performance.now();
  playShown = -1;
  startVoice(playT, total);
  showPlayState();
  const step = () => {
    if (!playing) return;
    const t = playStart + (performance.now() - playFrom) / 1000;
    if (t >= total) { playT = 0; stopPlayback(true); return; }
    playT = t;
    const k = sceneAt(t);
    if (k !== playShown) {
      if (playShown >= 0) snapPrev(playShown); else transPrev = null;
      playShown = k;
      loadScene(k);
      if (fsMode) showScope(k);
      // a screen with a new clip plays that clip's own sound, from the top of the screen
      const vid = state.video.muted ? null : primaryVideoId();
      if (vid !== (clipVoice && clipVoice.id)) startClipVoice(vid, t - sceneStart(k));
      startSceneVoice(k, t - sceneStart(k));
      draw();
      document.querySelectorAll('#scenes .clip').forEach((c, n) => c.classList.toggle('is-live', n === k));
    }
    movePlayhead(t);
    followPlayhead(t);
    if (motionAt(t)) draw();          // v3.13: a transition or an overlay clip moves every frame
    playRaf = requestAnimationFrame(step);
  };
  playRaf = requestAnimationFrame(step);
}

/** Stop playing. Paused mid-way, the screen under the playhead opens for editing. */
function stopPlayback(atEnd = false) {
  if (!playing) return;
  playing = false;
  cancelAnimationFrame(playRaf);
  stopVoice();
  stopClipVoice();
  stopSceneVoice();
  sequencing = false;
  loadScene(state.scene);
  document.querySelectorAll('#scenes .clip.is-live').forEach((c) => c.classList.remove('is-live'));
  showPlayState();
  const k = sceneAt(playT);
  if (!atEnd && k !== state.scene) selectScene(k);
  else { draw(); movePlayhead(playT); }
}

function seek(t) {
  const total = timelineSecs();
  playT = Math.max(0, Math.min(total, t));
  if (playing) {
    stopVoice();
    stopClipVoice();
    stopSceneVoice();
    playShown = -1;                  // the next frame reloads the screen and its clip
    transPrev = null;
    playStart = playT;
    playFrom = performance.now();
    startVoice(playT, total);
    movePlayhead(playT);
    return;
  }
  const k = sceneAt(playT);
  if (k !== state.scene) {
    const keep = playT;
    selectScene(k);
    playT = keep;
  }
  movePlayhead(playT);
  // v3.24 · scrubbing shows the frame at the playhead: overlay clips come and go as it passes them
  // (it only redrew on a section change, and then at the section's start, so overlays never showed)
  if ((state.overlays || []).length || (state.drawings || []).length) draw();
}

function wireTimeline() {
  document.addEventListener('pointerdown', (e) => {
    const m = $('#clip-menu');
    if (m.hidden || m.contains(e.target) || e.target.closest('.frame-pick, .audio-clip')) return;
    closeClipMenu();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeClipMenu(); });
  $('#tl-scroll').addEventListener('scroll', () => { if (performance.now() > quietScrollUntil) closeClipMenu(); }, { passive: true });
  window.addEventListener('resize', closeClipMenu);
  $('#tl-play').addEventListener('click', () => (playing ? stopPlayback() : startPlayback()));
  // space bar plays / pauses, unless typing
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag) || e.target.isContentEditable) return;
    if (!$('#sheet').hidden || !$('#camera').hidden) return;
    e.preventDefault();
    if (playing) stopPlayback(); else startPlayback();
  });
  // editing anything stops playback first, so the edit lands on the right screen
  const halt = () => { closeClipMenu(); if (playing) stopPlayback(); };
  $('.panel-controls').addEventListener('pointerdown', halt, true);
  $('.panel-controls').addEventListener('input', halt, true);
  canvas.addEventListener('pointerdown', halt, true);
  $('#btn-export').addEventListener('click', halt, true);
  // the ruler scrubs: press and drag
  const r = $('#tl-ruler');
  r.addEventListener('pointerdown', (e) => {
    r.setPointerCapture(e.pointerId);
    const at = (ev) => {
      const box = r.getBoundingClientRect();
      seek((ev.clientX - box.left) / pps);
    };
    const move = (ev) => at(ev);
    at(e);
    r.addEventListener('pointermove', move);
    r.addEventListener('pointerup', () => r.removeEventListener('pointermove', move), { once: true });
  });
  // a narrower timeline needs a new scale
  let w = $('#tl-scroll').clientWidth;
  new ResizeObserver(() => {
    const now = $('#tl-scroll').clientWidth;
    if (Math.abs(now - w) > 4) { w = now; renderScenes(); }
  }).observe($('#tl-scroll'));
}

/* --- sound --------------------------------------------------------------------
   One soundtrack under the whole video. Adding it fits the screens' times to
   its length (proportionally, each screen keeping its share); trimming a clip
   by hand turns the fit off. The file stays in the browser like uploads do.
   ------------------------------------------------------------------------ */
const MUSIC_DB = 'backdrop-studio-sound';
const FADE_SECS = 1.5;
let musicCtx = null;
let musicBuf = null;     // decoded AudioBuffer
let musicPeaks = null;   // Float32Array of loudness, 100 per second

const ac = () => (musicCtx = musicCtx || new (window.AudioContext || window.webkitAudioContext)());

function musicDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(MUSIC_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('sound');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function musicStore(mode, fn) {
  const db = await musicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sound', mode);
    const req = fn(tx.objectStore('sound'));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Where in the song the video starts (seconds) — drag the sound clip to choose. */
const songStart = () => (state.music && musicBuf ? Math.max(0, Math.min(musicBuf.duration - SECS_MIN, state.music.start || 0)) : 0);
/** Length of the soundtrack from that point (0 without one). */
const musicSecs = () => (state.music && musicBuf ? Math.max(0, musicBuf.duration - songStart()) : 0);
/** True when cuts snap to the sound's beat. */
const beatSync = () => !!(state.music && musicBuf && state.music.beat && musicBeats.length);
/** The beats, in timeline time (after the chosen start). */
const songBeats = () => { const o = songStart(); return musicBeats.map((b) => b - o).filter((b) => b > 0.05); };

let musicBeats = [];     // beat times in the song, seconds
let musicBpm = 0;

/* A small beat tracker: onset strength from the rise in loudness, the tempo
   from its autocorrelation (60–180 BPM, leaning to ~120), then a beat grid
   laid on the strongest phase and nudged onto the nearest onset. Good enough
   to put cuts on the beat, which is all it is for. */
function detectBeats(buf) {
  const sr = buf.sampleRate, hop = 512, win = 1024;
  const a = buf.getChannelData(0);
  const b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const frames = Math.floor((buf.length - win) / hop);
  if (frames < 40) return { beats: [], bpm: 0 };
  const le = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const o = f * hop;
    for (let j = 0; j < win; j += 2) { const v = b ? (a[o + j] + b[o + j]) * 0.5 : a[o + j]; e += v * v; }
    le[f] = Math.log(1e-9 + e);
  }
  const fps = sr / hop;
  const on = new Float32Array(frames);
  for (let f = 1; f < frames; f++) on[f] = Math.max(0, le[f] - le[f - 1]);
  // take away the local average so steady loudness doesn't count
  const half = Math.round(fps * 0.25);
  const flux = new Float32Array(frames);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += on[f];
    if (f - 2 * half - 1 >= 0) acc -= on[f - 2 * half - 1];
    const c = f - half;
    if (c >= 0) flux[c] = Math.max(0, on[c] - acc / (2 * half + 1));
  }
  // tempo
  let bestLag = 0, bestScore = 0;
  const lo = Math.floor(fps * 60 / 180), hi = Math.ceil(fps * 60 / 60);
  for (let lag = lo; lag <= hi; lag++) {
    let sum = 0;
    for (let f = lag; f < frames; f++) sum += flux[f] * flux[f - lag];
    const bpm = 60 * fps / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    if (sum * w > bestScore) { bestScore = sum * w; bestLag = lag; }
  }
  if (!bestLag || !bestScore) return { beats: [], bpm: 0 };
  // phase
  let bestPhase = 0, bestSum = -1;
  for (let ph = 0; ph < bestLag; ph++) {
    let sum = 0;
    for (let f = ph; f < frames; f += bestLag) sum += flux[f];
    if (sum > bestSum) { bestSum = sum; bestPhase = ph; }
  }
  const beats = [];
  const reach = Math.max(1, Math.round(bestLag * 0.12));
  for (let f = bestPhase; f < frames; f += bestLag) {
    let m = f;
    for (let k = Math.max(0, f - reach); k <= Math.min(frames - 1, f + reach); k++) if (flux[k] > flux[m]) m = k;
    beats.push(Math.round((m * hop / sr) * 1000) / 1000);
  }
  return { beats, bpm: Math.round(60 * fps / bestLag) };
}

function decodeSound(buf) {
  musicBuf = buf;
  musicPeaks = peaksOf(buf);
  const d = detectBeats(buf);
  musicBeats = d.beats;
  musicBpm = d.bpm;
}

/** Put the cuts between screens on the beat. keepEnd: the last cut stays at the end of the sound. */
function snapCutsToBeats(keepEnd) {
  const beats = songBeats();
  const sc = state.scenes;
  const n = sc.length;
  if (!beats.length || !n) return;
  const ends = [];
  let acc = 0;
  for (const x of sc) { acc += x.secs; ends.push(acc); }
  const total = ends[n - 1];
  let prev = 0;
  for (let k = 0; k < n; k++) {
    let e = ends[k];
    if (!(k === n - 1 && keepEnd)) {
      const lo = prev + SECS_MIN, hi = Math.min(prev + secsMax(sc[k]), keepEnd ? total - (n - 1 - k) * SECS_MIN : Infinity);
      let best = null;
      for (const bt of beats) {
        if (bt < lo || bt > hi) continue;
        if (best === null || Math.abs(bt - e) < Math.abs(best - e)) best = bt;
      }
      if (best !== null && Math.abs(best - e) <= 1.5) e = best;
    }
    sc[k].secs = Math.max(SECS_MIN, Math.round((e - prev) * 100) / 100);
    prev += sc[k].secs;
  }
}

/** Time the screens to the sound: fit the length, then cut on the beat. */
function applySoundTiming() {
  if (!state.music || !musicBuf) return;
  if (state.music.fit) {
    // start from the recommended shares so a fit is always a fresh, sensible split
    for (const x of state.scenes) if (!x.manual) x.secs = recommendedSecs(x);
    fitTimelineToMusic(musicSecs());
  }
  if (state.music.beat && musicBeats.length) snapCutsToBeats(state.music.fit);
  for (const x of state.scenes) x.manual = true;
}
/** True when the screens are fitted to the sound. */
const musicFits = () => !!(state.music && musicBuf && state.music.fit);

function peaksOf(buf) {
  const per = Math.max(1, Math.floor(buf.sampleRate / 100));
  const n = Math.ceil(buf.length / per);
  const out = new Float32Array(n);
  const chans = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c));
  let top = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = i * per, b = Math.min(buf.length, a + per);
    for (const d of chans) for (let j = a; j < b; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; }
    out[i] = m;
    if (m > top) top = m;
  }
  if (top > 0) for (let i = 0; i < n; i++) out[i] /= top;
  return out;
}

/** Spread the length T over the screens, each keeping its share. */
function fitTimelineToMusic(T) {
  const sc = state.scenes;
  const n = sc.length;
  const maxSum = sc.reduce((t, x) => t + secsMax(x), 0);
  const target = Math.max(n * SECS_MIN, Math.min(maxSum, T));
  let sum = sc.reduce((t, x) => t + x.secs, 0) || n;
  // proportional, clamped; repeat so clamped screens hand their excess on
  let want = sc.map((x) => (x.secs / sum) * target);
  for (let pass = 0; pass < 4; pass++) {
    want = want.map((v, i) => Math.max(SECS_MIN, Math.min(secsMax(sc[i]), v)));
    const got = want.reduce((a, b) => a + b, 0);
    const free = want.map((v, i) => v > SECS_MIN && v < secsMax(sc[i]));
    const room = want.reduce((a, v, i) => a + (free[i] ? v : 0), 0);
    if (Math.abs(got - target) < 0.01 || !room) break;
    want = want.map((v, i) => (free[i] ? v * (1 + (target - got) / room) : v));
  }
  want = want.map((v) => Math.round(v * 10) / 10);
  // land exactly on the sound's length
  const diff = Math.round((target - want.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (diff) {
    const k = want.findIndex((v, i) => v + diff >= SECS_MIN && v + diff <= secsMax(sc[i]));
    if (k >= 0) want[k] = Math.round((want[k] + diff) * 10) / 10;
  }
  sc.forEach((x, i) => { x.secs = want[i]; });
}

async function addMusic(file) {
  if (soundTarget !== null) { const i = soundTarget; soundTarget = null; return addSceneSound(i, file); }
  const bar = $('#music-bar');
  const fromVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v)$/i.test(file.name);
  if (!fromVideo && !/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(file.name)) {
    musicError(`${file.name} is not a sound or video file`);
    return;
  }
  stopPlayback();
  let buf;
  try {
    buf = await ac().decodeAudioData(await file.arrayBuffer());
  } catch (_) {
    musicError(fromVideo
      ? `Couldn't find sound in ${file.name} — the video may be silent, or try an MP4 or MOV.`
      : `Couldn't read ${file.name} — try an MP3, M4A or WAV.`);
    return;
  }
  decodeSound(buf);
  const id = `snd_${Date.now().toString(36)}`;
  // like a reel: the screens fit the sound and cut on its beat, from the top of the song
  state.music = { id, name: file.name.replace(/\.[^.]+$/, ''), vol: 0.9, fit: true, beat: true, fade: true, start: 0 };
  for (const x of state.scenes) x.manual = false;
  try { await musicStore('readwrite', (st) => st.put(file, id)); } catch (_) { /* this session only */ }
  keepStorage();
  applySoundTiming();
  bar.dataset.error = '';
  save();
  renderScenes();
  renderMusicBar();
}

function musicError(msg) {
  const bar = $('#music-bar');
  bar.hidden = false;
  bar.innerHTML = '';
  const p = document.createElement('span');
  p.className = 'upload-error';
  p.textContent = msg;
  bar.append(p);
}

async function removeMusic() {
  stopPlayback();
  const id = state.music && (state.music.id || 'current');
  state.music = null;
  musicBuf = null;
  musicPeaks = null;
  musicBeats = [];
  // a saved design may still use this sound — keep the file for it
  const used = loadTemplates().some((t) => t.data && t.data.music && (t.data.music.id || 'current') === id);
  if (id && !used) { try { await musicStore('readwrite', (st) => st.delete(id)); } catch (_) {} }
  save();
  renderScenes();
  renderMusicBar();
}

async function restoreMusic() {
  musicBuf = null;
  musicPeaks = null;
  musicBeats = [];
  if (!state.music) { renderScenes(); renderMusicBar(); return; }
  try {
    const file = await musicStore('readonly', (st) => st.get(state.music.id || 'current'));
    if (!file) throw new Error('gone');
    decodeSound(await ac().decodeAudioData(await file.arrayBuffer()));
  } catch (_) {
    state.music = null;
    save();
  }
  renderScenes();
  renderMusicBar();
}

/** The sound track lane: the waveform (drag it to choose the part that plays), or a slot to add one. */
function renderAudioLane() {
  const lane = $('#tl-audio');
  if (!lane) return;
  lane.innerHTML = '';
  lane.style.clipPath = `inset(0 0 0 ${leftPad}px)`;
  if (!state.music || !musicBuf) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'audio-add';
    add.style.left = `${leftPad}px`;
    // v3.19: a plus, like + Overlay clip next to it (was a music note)
    add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add music or sound</span>';
    add.addEventListener('click', (e) => { e.stopPropagation(); clipMenuFor === -3 ? closeClipMenu() : openAddSoundMenu(add); });
    lane.append(add);
    return;
  }
  const total = timelineSecs();
  const dur = musicBuf.duration;
  const start = songStart();
  const clip = document.createElement('div');
  clip.className = 'audio-clip';
  clip.tabIndex = 0;
  clip.setAttribute('role', 'slider');
  clip.setAttribute('aria-label', 'Part of the sound that plays — drag, or use the arrow keys');
  clip.setAttribute('aria-valuetext', `Starts at ${fmtTime(start)}`);
  const place = (st) => { clip.style.left = `${leftPad - st * pps}px`; };
  place(start);
  const w = Math.max(10, dur * pps - 3);
  clip.style.width = `${w}px`;
  const cv = document.createElement('canvas');
  const H = 30, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.min(8000, Math.round(w));
  cv.width = Math.round(cw * dpr);
  cv.height = H * dpr;
  cv.style.width = `${w}px`;
  cv.style.height = `${H}px`;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const sx = w / cw;
  const paintWave = (st) => {
    g.clearRect(0, 0, cw, H);
    const from = st * pps, to = (st + total) * pps;   // the part that plays
    for (let x = 0; x < cw; x += 3) {
      const i0 = Math.floor((x / cw) * musicPeaks.length);
      const i1 = Math.max(i0 + 1, Math.floor(((x + 3) / cw) * musicPeaks.length));
      let m = 0;
      for (let i = i0; i < i1 && i < musicPeaks.length; i++) m = Math.max(m, musicPeaks[i]);
      const h = Math.max(1.5, m * (H - 8));
      const px = x * sx;
      g.fillStyle = px >= from - 1 && px < to ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)';
      g.fillRect(x, (H - h) / 2 - 1, 2, h);
    }
    // beats: small dots along the bottom
    if (state.music.beat) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (const bt of musicBeats) g.fillRect(bt * pps / sx - 1, H - 3, 2, 2);
    }
  };
  paintWave(start);
  clip.append(cv);
  const label = document.createElement('span');
  label.className = 'audio-label';
  const labelText = () => `♪ ${state.music.name}` + (songStart() > 0.05 ? ` · from ${fmtTime(songStart())}` : '');
  label.textContent = labelText();
  label.style.left = `${start * pps + 6}px`;
  clip.append(label);
  if (dur - start > total + 0.05) {
    const end = document.createElement('span');
    end.className = 'audio-cut';
    end.style.left = `${(start + total) * pps}px`;
    end.title = 'The video ends here — the rest of the sound is not used';
    clip.append(end);
  }
  lane.append(clip);

  // drag sideways to choose which part of the song plays; a tap opens the sound's menu
  const maxStart = Math.max(0, dur - SECS_MIN);
  const commit = () => {
    if (state.music.fit || state.music.beat) applySoundTiming();
    save();
    renderScenes();
    renderMusicBar();
  };
  clip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    stopPlayback();
    closeClipMenu();
    clip.setPointerCapture(e.pointerId);
    const x0 = e.clientX, s0 = songStart();
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - x0) < 5) return;
      moved = true;
      clip.classList.add('is-sliding');
      let st = Math.max(0, Math.min(maxStart, s0 - (ev.clientX - x0) / pps));
      // the start clicks onto a beat when one is close
      if (state.music.beat) {
        const near = musicBeats.find((b) => Math.abs(b - st) < 0.12);
        if (near !== undefined) st = near;
      }
      state.music.start = Math.round(st * 100) / 100;
      place(state.music.start);
      paintWave(state.music.start);
      label.textContent = `♪ Starts at ${fmtTime(state.music.start)}`;
      label.style.left = `${state.music.start * pps + 6}px`;
    };
    const up = () => {
      clip.removeEventListener('pointermove', move);
      clip.classList.remove('is-sliding');
      if (moved) commit();
      else openSoundMenu(clip);
    };
    clip.addEventListener('pointermove', move);
    clip.addEventListener('pointerup', up, { once: true });
    clip.addEventListener('pointercancel', up, { once: true });
  });
  clip.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 0.5 : e.key === 'ArrowLeft' ? -0.5 : 0;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSoundMenu(clip); return; }
    if (!d) return;
    e.preventDefault();
    state.music.start = Math.max(0, Math.min(maxStart, songStart() + d));
    commit();
    const again = document.querySelector('#tl-audio .audio-clip');
    if (again) again.focus();
  });
}

/* Adding a sound: an audio file, or the sound of a video. Two pickers rather
   than one, because a phone shows its camera / photo library sheet for anything
   that lists video — fine for "sound from a video", confusing for a song. */
function openAddSoundMenu(anchor) {
  soundTarget = null;
  openMenuAt(anchor, [
    { icon: 'note', label: 'Audio file', sub: 'MP3, M4A, WAV, AAC …', run: () => $('#music-input').click() },
    { icon: 'film', label: 'Sound from a video', sub: 'MP4 or MOV — uses its audio', run: () => $('#music-video-input').click() },
  ], 'Add sound');
  clipMenuFor = -3;
}

function openSoundMenu(anchor) {
  const items = [
    { icon: 'swap', label: 'Replace sound', run: () => openAddSoundMenu(anchor) },
  ];
  if (songStart() > 0.05) items.push({ icon: 'rewind', label: 'Play from the start of the song', run: () => { state.music.start = 0; if (state.music.fit || state.music.beat) applySoundTiming(); save(); renderScenes(); renderMusicBar(); } });
  items.push({ icon: 'remove', label: 'Remove sound', danger: true, run: removeMusic });
  openMenuAt(anchor, items, 'Sound options');
  clipMenuFor = -2;
}

/** Under the timeline: how the screens follow the sound, volume, fade out. */
function renderMusicBar() {
  const bar = $('#music-bar');
  if (!state.music || !musicBuf) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = '';
  const m = state.music;
  const retime = () => { applySoundTiming(); save(); renderScenes(); renderMusicBar(); };

  // timing: like reels — fit the length to the sound, cut on its beat
  const seg = document.createElement('div');
  seg.className = 'music-timing';
  const chip = (label, key, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'music-chip';
    b.setAttribute('aria-pressed', String(!!m[key]));
    b.title = title;
    b.innerHTML = `<span class="music-chip-dot" aria-hidden="true"></span>${label}`;
    b.addEventListener('click', () => {
      m[key] = !m[key];
      if (m[key]) retime(); else { save(); renderScenes(); renderMusicBar(); }
    });
    return b;
  };
  seg.append(chip('Fit to sound', 'fit', 'Hook, Value and CTA share the length of the sound, in proportion'));
  if (musicBeats.length) seg.append(chip(`Cut on the beat${musicBpm ? ` · ${musicBpm} BPM` : ''}`, 'beat', 'Each cut between screens lands on a beat; trims click onto beats too'));
  bar.append(seg);

  const vol = document.createElement('label');
  vol.className = 'music-vol';
  vol.innerHTML = '<span>Volume</span>';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '1';
  range.step = '0.05';
  range.value = String(m.vol);
  range.setAttribute('aria-label', 'Sound volume');
  range.addEventListener('input', () => {
    m.vol = Number(range.value);
    if (playVoice) playVoice.gain.gain.value = m.vol;
    save();
  });
  vol.append(range);
  bar.append(vol);

  const l = document.createElement('label');
  l.className = 'music-check';
  l.title = 'Fade the sound out over the last 1.5 seconds';
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = !!m.fade;
  c.addEventListener('change', () => { m.fade = c.checked; save(); });
  l.append(c, document.createTextNode(' Fade out'));
  bar.append(l);

  const total = timelineSecs();
  const avail = musicSecs();
  const note = document.createElement('span');
  note.className = 'scene-rec';
  const n = state.scenes.length;
  if (m.fit && avail > state.scenes.reduce((t, x) => t + secsMax(x), 0) + 0.05) note.textContent = `Longer than ${n} screens can run — add a value section, or it stops at ${fmtTime(total)}`;
  else if (Math.abs(avail - total) > 0.05) note.textContent = avail > total ? `Uses ${fmtTime(total)} of the sound — drag it to pick the part` : 'Sound ends before the video';
  else note.textContent = 'Video matches the sound';
  bar.append(note);
}

/* --- the clips' own sound -----------------------------------------------------
   Uploaded videos keep their sound. On the page they loop silently (browsers
   only autoplay muted video); pressing Play routes the sound of the clip on
   screen to the speakers, and a video export mixes in the sound of whichever
   screen's clip is showing — with the music, if there is any. Mute audio turns
   the clips' sound off everywhere. */
let clipVoice = null;                    // { id, src, gain } while playing

function startClipVoice(id, offset = 0) {
  stopClipVoice();
  if (!id) return;
  const m = mediaFor(id);
  if (!m || m.media !== 'video') return;
  const track = audioTrackFor(id);
  if (!track) return;
  const ctx2 = ac();
  if (ctx2.state === 'suspended') ctx2.resume().catch(() => {});
  const src = ctx2.createMediaStreamSource(new MediaStream([track]));
  const gain = ctx2.createGain();
  src.connect(gain).connect(ctx2.destination);
  try {
    const d = m.el.duration;
    m.el.currentTime = isFinite(d) && d > 0 ? Math.max(0, offset) % d : 0;
    m.el.play().catch(() => {});
  } catch (_) {}
  clipVoice = { id, src, gain };
}

function stopClipVoice() {
  if (!clipVoice) return;
  try { clipVoice.src.disconnect(); clipVoice.gain.disconnect(); } catch (_) {}
  clipVoice = null;
}

/** Every video the film shows: the shared background, each screen's own, the photo / video card. */
function sceneVideoIds() {
  const ids = new Set([state.backdrop, state.sharedBg, state.inset && state.inset.id]);
  for (const sc of state.scenes || []) ids.add(sc.bg);
  return [...ids].filter((id) => id && isVideo(id) && mediaFor(id));
}

function startVoice(from, total) {
  if (!musicBuf || !state.music || from >= musicSecs()) return;
  const off = songStart();
  const ctx2 = ac();
  if (ctx2.state === 'suspended') ctx2.resume().catch(() => {});
  const src = ctx2.createBufferSource();
  src.buffer = musicBuf;
  const gain = ctx2.createGain();
  gain.gain.value = state.music.vol;
  src.connect(gain).connect(ctx2.destination);
  const now = ctx2.currentTime;
  const end = Math.min(total, musicSecs());
  if (state.music.fade && end - from > FADE_SECS) {
    gain.gain.setValueAtTime(state.music.vol, now + (end - from - FADE_SECS));
    gain.gain.linearRampToValueAtTime(0.0001, now + (end - from));
  }
  src.start(now, off + from, end - from);
  playVoice = { src, gain };
}

function stopVoice() {
  if (!playVoice) return;
  try { playVoice.src.stop(); } catch (_) {}
  playVoice.gain.disconnect();
  playVoice = null;
}

/** Run a video export with the sound mixed in: the music (if any) and the
    sound of each screen's clip while that screen is showing (unless muted). */
async function withSoundtrack(seconds, run) {
  const music = !!(musicBuf && state.music);
  const clipIds = state.video.muted ? [] : sceneVideoIds();
  const sectionSounds = state.contentType !== 'carousel' && state.scenes.some((sc) => sceneSoundBuf(sc));
  if (!music && !clipIds.length && !sectionSounds) return run();
  const ctx2 = ac();
  await ctx2.resume().catch(() => {});
  const dest = ctx2.createMediaStreamDestination();
  let gain = null;
  if (music) {
    gain = ctx2.createGain();
    gain.gain.value = state.music.vol;
    gain.connect(dest);
  }
  // one tap per clip, each behind its own gate that opens while its screen shows
  const taps = new Map();
  for (const id of clipIds) {
    const track = audioTrackFor(id);
    if (!track) continue;
    const src = ctx2.createMediaStreamSource(new MediaStream([track]));
    const gate = ctx2.createGain();
    gate.gain.value = 0;
    src.connect(gate).connect(dest);
    taps.set(id, { src, gate });
  }
  if (!music && !taps.size && !sectionSounds) return run();
  const mixed = dest.stream.getAudioTracks()[0];
  // each section's own sound starts with its section
  shownScene = state.scene;
  let liveScene = -1;
  let sceneSrc = null;
  const followSection = () => {
    if (shownScene === liveScene) return;
    liveScene = shownScene;
    if (sceneSrc) { try { sceneSrc.stop(); } catch (_) {} sceneSrc = null; }
    const sc = state.scenes[liveScene];
    const buf = sceneSoundBuf(sc);
    if (!buf) return;
    const dur = Math.min(buf.duration, sc.secs);
    const g = ctx2.createGain();
    g.connect(dest);
    const now = ctx2.currentTime;
    g.gain.setValueAtTime(1, now + Math.max(0, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, now + dur);
    sceneSrc = ctx2.createBufferSource();
    sceneSrc.buffer = buf;
    sceneSrc.connect(g);
    sceneSrc.start(now, 0, dur);
  };
  // exportVideo adds the clip's track itself; the mix already has it
  const wasMuted = state.video.muted;
  setPlayback({ ...state.video, muted: true });
  const proto = HTMLCanvasElement.prototype;
  const capture = proto.captureStream;
  proto.captureStream = function (...a) {
    const st = capture.apply(this, a);
    st.addTrack(mixed.clone());
    return st;
  };
  // the sound starts with the recording; the gates follow the screen on show
  let src = null;
  let live;                               // undefined until the recording starts
  const follow = () => {
    const id = primaryVideoId();
    if (id === live) return;
    const first = live === undefined;
    live = id;
    for (const [k, { gate }] of taps) gate.gain.setTargetAtTime(k === id ? 1 : 0, ctx2.currentTime, 0.008);
    // a new screen's clip starts from its top, picture and sound together
    const m = !first && id && mediaFor(id);
    if (m && m.media === 'video') { try { m.el.currentTime = 0; m.el.play().catch(() => {}); } catch (_) {} }
  };
  const wait = setInterval(() => {
    if (!recording) return;
    follow();
    if (sectionSounds) followSection();
    if (src || !music) return;
    src = ctx2.createBufferSource();
    src.buffer = musicBuf;
    src.connect(gain);
    const now = ctx2.currentTime;
    const end = Math.min(seconds, musicSecs());
    if (state.music.fade && end > FADE_SECS) {
      gain.gain.setValueAtTime(state.music.vol, now + end - FADE_SECS);
      gain.gain.linearRampToValueAtTime(0.0001, now + end);
    }
    src.start(now, songStart(), end);
  }, 4);
  try {
    return await run();
  } finally {
    clearInterval(wait);
    proto.captureStream = capture;
    try { src && src.stop(); } catch (_) {}
    if (gain) gain.disconnect();
    for (const { src: s2, gate } of taps.values()) { try { s2.disconnect(); gate.disconnect(); } catch (_) {} }
    if (sceneSrc) { try { sceneSrc.stop(); } catch (_) {} }
    mixed.stop();
    setPlayback({ ...state.video, muted: wasMuted });
  }
}

function wireMusic() {
  const input = $('#music-input');
  if ($('#tl-music')) $('#tl-music').addEventListener('click', (e) => {
    e.stopPropagation();
    if (clipMenuFor === -3) { closeClipMenu(); return; }
    // with a sound in place the button offers its options, as tapping the sound does
    if (state.music && musicBuf) { const clip = $('.audio-clip'); openSoundMenu(clip || $('#tl-music')); return; }
    openAddSoundMenu($('#tl-music'));
  });
  for (const el of [input, $('#music-video-input')]) {
    el.addEventListener('change', () => {
      const f = el.files[0];
      el.value = '';
      if (f) addMusic(f);
    });
  }
  // drop a sound file on the timeline
  const tl = $('#timeline');
  tl.addEventListener('dragover', (e) => { e.preventDefault(); tl.classList.add('is-drop'); });
  tl.addEventListener('dragleave', () => tl.classList.remove('is-drop'));
  tl.addEventListener('drop', (e) => {
    e.preventDefault();
    tl.classList.remove('is-drop');
    const f = [...(e.dataTransfer.files || [])].find((x) => /^audio\//.test(x.type) || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i.test(x.name));
    if (f) { soundTarget = null; addMusic(f); }
  });
  restoreMusic();
  restoreSceneSounds();
}

/* --- edit tabs and selection ------------------------------------------------
   The tabs are a filter over the panel's sections — the same controls and
   the same state, never a second copy. Selecting something on the preview,
   or picking a tab, sets one `selected` element; the tab, the visible
   sections and the quiet outline on the preview all follow it.
   ------------------------------------------------------------------------ */
const TAB_OF = { background: 'background', watermark: 'badge', h1: 'text', body: 'text', inset: 'card' };
const ELEMENT_OF = { all: null, format: null, background: 'background', badge: 'watermark', text: 'h1', card: 'inset' };
const tabOf = (el) => (String(el).startsWith('ov:') ? 'overlay' : String(el).startsWith('dr:') ? 'draw' : String(el).startsWith('eb:') ? 'badge' : String(el).startsWith('xb:') ? 'text' : String(el).startsWith('bt:') ? 'buttons' : String(el).startsWith('md:') ? 'card' : TAB_OF[el]);
const groupOf = (el) => (String(el).startsWith('ov:') ? '#group-overlay' : String(el).startsWith('dr:') ? '#group-draw' : String(el).startsWith('eb:') ? '#badge-field' : String(el).startsWith('xb:') ? '#group-blocks' : String(el).startsWith('bt:') ? '#group-buttons' : String(el).startsWith('md:') ? '#group-inset' : GROUP_OF[el]);
const GROUP_OF = { background: '#group-background', watermark: '#badge-field', h1: '#group-h1', body: '#group-body', inset: '#group-inset' };

function setTab(t) {
  activeTab = t;
  $('.panel-controls').dataset.tab = t;
}

/** Select an element (from the preview or a section button): its section opens and the outline follows. */
function selectElement(el, { reveal = true } = {}) {
  selected = el;
  // a tap opens the element's section; a drag only selects (or follows an open section)
  if (el && (reveal || (sheetTab && !isPhone()))) openSectionSheet(tabOf(el));
  else if (!el && sheetTab) { closeSectionSheet(); return; }
  if (reveal && el && groupOf(el)) revealGroup(groupOf(el));
  if (reveal && el) revealInPanel(el);
  syncColorRows(true);
  draw();
}

/* Video or Carousel — the project's content type, picked once in the Format
   dropdown (Video · Reel / Story … or Carousel · Portrait post …). A carousel
   is the same sequence as numbered images: the timeline shows slides instead
   of timed clips, sound and the camera step aside, and Export offers image
   files instead of a video. */
function setContentType(t) {
  if (t === state.contentType) return;
  stopPlayback();
  closeClipMenu();
  state.contentType = t;
  syncContentType();
  save();
  renderScenes();
  renderMusicBar();
  draw();
}

function syncContentType() {
  if (state.contentType !== 'carousel') state.contentType = 'video';
  document.documentElement.dataset.content = state.contentType;
}

function wireContentType() {
  // Video is the default; the Format dropdown is where a carousel is chosen
  syncContentType();
}

function wireEditTabs() {
  const bar = $('#edit-tabs');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    // the open section's button closes it again
    if (sheetTab === b.dataset.tab) { closeSectionSheet(); return; }
    selected = ELEMENT_OF[b.dataset.tab] || null;
    openSectionSheet(b.dataset.tab);
    syncColorRows(true);
    draw();
  });
  // Esc closes the open section, then clears the selection
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || editor || !$('#clip-menu').hidden || !$('#sheet').hidden || !$('#picker').hidden || !$('#camera').hidden) return;
    if (sheetTab) { closeSectionSheet(); return; }
    if (selected) { selected = null; draw(); }
  });
  setTab('all');
  wireSectionSheet();
  wireScrim();
  guardCardRemove();
  wireBlocks();
  wireTextMode();
  wireAutoOn();
  wireColorPop();
  wireTimelineRow();
}

/* --- section buttons and the open section ----------------------------------
   The controls are a grid of section buttons — Format, Background, Badge,
   Header, Body, Photo/Video — each with its current value underneath. A
   button (or a tap on that element in the preview) opens its section: on a
   wide screen right under the buttons, above Safe-area guides and Saved
   designs; on a phone in a sheet docked under the preview, on the scrim.
   One section is open at a time; its button, Done or Esc closes it. The
   section holds the very same groups (moved in while it is open, put back
   when it closes), so the controls, their listeners and the state are never
   duplicated. */
const phoneMQ = matchMedia('(max-width: 820px)');
const isPhone = () => phoneMQ.matches;
let sheetTab = null;
const sheetHomes = new Map();          // group → the placeholder it goes back to

function tabButton(t) { return $(`#edit-tabs [data-tab="${t}"]`); }

function openSectionSheet(t) {
  const sheet = $('#section-sheet');
  const body = $('#section-sheet-body');
  const phone = isPhone();
  if (sheetTab !== t) {
    restoreSheetGroups();
    for (const g of document.querySelectorAll('.panel-controls .group[data-tabs]')) {
      if (!g.dataset.tabs.split(' ').includes(t)) continue;
      const home = document.createComment(`home:${g.id}`);
      g.before(home);
      sheetHomes.set(g, home);
      body.append(g);
    }
    body.scrollTop = 0;
  }
  const opening = sheet.hidden || sheetTab !== t;
  sheetTab = t;
  syncPanelTop();
  document.documentElement.classList.add('has-open-section');
  setTab(t);
  const name = tabButton(t);
  sheet.setAttribute('role', phone ? 'dialog' : 'region');
  sheet.setAttribute('aria-label', name ? (name.querySelector('.tn-long') || name.querySelector('.tab-name')).textContent : 'Edit');
  sheet.hidden = false;
  sheet.style.transform = '';
  for (const b of $('#edit-tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-expanded', String(b.dataset.tab === t));
  if (phone) {
    document.documentElement.classList.add('has-section-sheet');   // first: full screen shrinks the canvas for it
    placeSectionSheet();
    showScrim('sheet');
  } else if (opening) {
    // the section opens right under the buttons: bring the two into view together
    const panel = $('.panel-controls');
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (getComputedStyle(panel).overflowY === 'auto') panel.scrollTo({ top: 0, behavior });
  }
  if (opening) {
    sheet.classList.remove('is-in');
    void sheet.offsetWidth;
    sheet.classList.add('is-in');
    // colour rows fit your colours to their width: rebuild them now they can be measured
    requestAnimationFrame(() => {
      if (sheetTab !== t) return;
      if (t === 'background') buildColourRow();
      if (t === 'buttons') renderButtons();
      syncColorRows(true);
    });
  }
}

function restoreSheetGroups() {
  for (const [g, home] of sheetHomes) home.replaceWith(g);
  sheetHomes.clear();
}

function closeSectionSheet({ focus = true } = {}) {
  if (!sheetTab) return;
  for (const h of document.querySelectorAll('.is-expanded')) h.classList.remove('is-expanded');
  const t = sheetTab;
  const sheet = $('#section-sheet');
  const hadFocus = sheet.contains(document.activeElement);
  if (hadFocus) document.activeElement.blur();
  restoreSheetGroups();
  sheetTab = null;
  sheet.hidden = true;
  sheet.style.transform = '';
  setSheetExpanded(false);     // the next sheet opens docked, under the preview
  document.documentElement.classList.remove('has-section-sheet', 'has-open-section');
  hideScrim('sheet');
  for (const b of $('#edit-tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-expanded', 'false');
  selected = null;
  setTab('all');
  syncPanelTop();
  syncSectionValues(true);
  syncColorRows(true);
  draw();
  if (focus && (isPhone() || hadFocus)) { const b = tabButton(t); if (b) b.focus({ preventScroll: true }); }
}

/** Dock the phone's sheet just under the preview: as tall as the room below it allows. */
let sheetExpanded = false, dockedTop = 0;
function dockedSheetTop() {
  if (sheetExpanded && dockedTop) return dockedTop;   // the preview is covered: keep the last docked height
  const vh = window.innerHeight;
  const r = $('#canvas-wrap').getBoundingClientRect();
  // never over the preview: from just under it to the bottom of the screen (over the timeline)
  dockedTop = Math.round(Math.min(Math.max(r.bottom + 6, 80), vh - 160));
  return dockedTop;
}
/** v3.6 · pulled up: just under the top bar, for long content (the preview is covered). */
function expandedSheetTop() {
  const tb = document.querySelector('.topbar');
  const b = tb ? tb.getBoundingClientRect().bottom : 0;
  return Math.round(Math.max(b + 8, 56));
}
function placeSectionSheet() {
  const sheet = $('#section-sheet');
  const docked = dockedSheetTop();
  sheet.style.setProperty('--sheet-top', `${sheetExpanded ? Math.min(expandedSheetTop(), docked) : docked}px`);
}
function setSheetExpanded(on) {
  sheetExpanded = !!on && isPhone();
  const sheet = $('#section-sheet');
  sheet.classList.toggle('is-tall', sheetExpanded);
  document.documentElement.classList.toggle('has-tall-sheet', sheetExpanded);
  const h = $('#section-sheet-head');
  if (h) { h.setAttribute('aria-label', sheetExpanded ? 'Make the sheet smaller (shows the preview)' : 'Pull up for more room'); h.title = h.getAttribute('aria-label'); }
  placeSectionSheet();
}

/** The value under each section button: what that section is set to now. */
let sectionSig = '';
function syncSectionValues(force) {
  const ma = $('#media-add');
  if (ma) { const off = !(state.inset.id || (state.media || []).length); if (ma.hidden !== off) ma.hidden = off; }
  const fmt = $('#format-select');
  const opt = fmt && fmt.selectedOptions[0];
  const parts = opt ? opt.textContent.split(' · ') : [];
  const bd = activeBd();
  const snip = (txt) => { const t = String(txt || '').replace(/\s+/g, ' ').trim(); return t || 'On'; };
  const vals = {
    format: parts.length ? `${parts[0]} · ${(fmt.value.split(':')[1] || '').replace('x', ':')}` : '',
    background: (bd && (bd.name || bd.label)) || '',
    badge: (() => { const n = (state.badge && state.badge !== 'none' ? 1 : 0) + (state.badges || []).length; return n > 1 ? `${n} badges` : n ? 'On' : 'Off'; })(),
    text: state.visibility === 'none' ? 'Off' : snip(showsH1() ? state.h1 : state.body),
    card: (() => { const n = (state.inset.id && !state.inset.hidden ? 1 : 0) + (state.media || []).length; return n > 1 ? `${n} items` : n ? 'On' : 'Off'; })(),
    buttons: (state.buttons || []).length ? (state.buttons.length === 1 ? (String(state.buttons[0].text || '').trim() || '1 button') : `${state.buttons.length} buttons`) : 'Off',
  };
  const sig = JSON.stringify(vals);
  if (!force && sig === sectionSig) return;
  sectionSig = sig;
  for (const [t, v] of Object.entries(vals)) {
    const b = tabButton(t);
    if (!b) continue;
    b.querySelector('.tab-val').textContent = v;
    b.classList.toggle('is-off', v === 'Off');
  }
}

function wireSectionSheet() {
  const sheet = $('#section-sheet');
  // no Done: a tap outside (on the scrim), a swipe down or Esc closes it
  // drag the handle down to dismiss
  /* v3.6 · two heights on a phone: docked under the preview (the preview stays in view), or
     pulled up to just under the top bar for long content. Drag the handle up to expand, down
     to dock again; from docked, down closes. A tap on the handle switches between the two. */
  const head = $('#section-sheet-head');
  // v3.21 · Done: keeps what you set (edits are live) and closes the sheet
  const done = $('#section-sheet-done');
  if (done) done.addEventListener('click', (e) => { e.stopPropagation(); closeSectionSheet(); });
  let drag = null;
  const topOf = () => parseFloat(getComputedStyle(sheet).top) || 0;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { y: e.clientY, dy: 0, top: topOf(), expanded: sheetExpanded };
    head.setPointerCapture(e.pointerId);
    sheet.classList.add('is-dragging');
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = e.clientY - drag.y;
    const docked = dockedSheetTop(), high = expandedSheetTop();
    const t = drag.top + drag.dy;
    if (t >= docked) {
      // past the docked height: the sheet slides down out of the way (to close)
      sheet.style.setProperty('--sheet-top', `${docked}px`);
      sheet.style.transform = `translateY(${t - docked}px)`;
    } else {
      sheet.style.transform = '';
      sheet.style.setProperty('--sheet-top', `${Math.max(high, t)}px`);
    }
  });
  const end = () => {
    if (!drag) return;
    const { dy, expanded } = drag;
    const moved = Math.abs(dy) > 6;
    const docked = dockedSheetTop();
    const past = drag.top + dy - docked;           // how far below the docked height it was let go
    drag = null;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    if (!moved) { setSheetExpanded(!expanded); return; }   // a tap on the handle
    if (past > 70) { closeSectionSheet(); return; }
    if (!expanded && dy < -50) setSheetExpanded(true);
    else if (expanded && dy > 50) setSheetExpanded(false);
    else setSheetExpanded(expanded);
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => { if (sheetTab && isPhone()) placeSectionSheet(); });
  // a phone's sheet and a wide screen's inline section are different places: close on the switch
  phoneMQ.addEventListener('change', () => { closeSectionSheet({ focus: false }); syncSectionValues(true); });
  syncSectionValues(true);
}

/* --- header and body colours -------------------------------------------------
   Five colours from the brand's own palette (`swatches` in brands.js) for
   text and for the card behind it, plus Default (follow Text style) and,
   for the card, None. Swatches that would be hard to read against what the
   text sits on are offered greyed out. */
const MIN_CONTRAST = 2.5;
const brandSwatches = () => (activeBrand().swatches || []).slice(0, 5);

function ensureColors() {
  state.textColors = Object.assign({ h1: null, body: null }, state.textColors || {});
  state.cardColors = Object.assign({ h1: null, body: null }, state.cardColors || {});
  const b = state.borders || {};
  state.borders = {
    h1: Object.assign({ w: 0, c: null }, b.h1 || {}),
    body: Object.assign({ w: 0, c: null }, b.body || {}),
  };
}

/* Your own colours: added with + in any colour row, offered in every row
   after the brand's, newest first. Kept on this browser, for every brand. */
const CUSTOM_KEY = 'askruth.backdrop-studio.colors.v1';
const MAX_CUSTOM = 8;
let customColors = [];
function loadCustomColors() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY));
    customColors = Array.isArray(list) ? list.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_CUSTOM) : [];
  } catch (_) { customColors = []; }
}
/* While a system colour picker is open its swatch must stay put: rebuilding the
   row would take the input (and the picker) away. Rows rebuild once it closes. */
let colorPicking = false;
function watchPicker(input) {
  input.addEventListener('click', () => { colorPicking = true; });
  const end = () => { colorPicking = false; };
  input.addEventListener('change', end);
  input.addEventListener('blur', end);
}

function removeCustomColor(hex) {
  hex = String(hex).toLowerCase();
  customColors = customColors.filter((c) => c !== hex);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customColors)); } catch (_) {}
}
/** Change one of your colours in place (same spot in the list). */
function replaceCustomColor(from, to) {
  from = String(from).toLowerCase(); to = String(to).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(to)) return;
  const i = customColors.indexOf(from);
  if (i < 0) { addCustomColor(to); return; }
  customColors[i] = to;
  customColors = customColors.filter((c, k) => c !== to || k === customColors.indexOf(to));
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customColors)); } catch (_) {}
}

/* One of your colours as a swatch. Tap it to use it; once it's in use, tap it
   again to change it (the swatch is then the colour control itself, so the
   system picker opens) — or × to take it out of your colours. */
function customSwatch(hex, selected, cls, { pick, live, done, remove }) {
  if (!selected) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `${cls} sw-custom`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.setAttribute('aria-label', `Your color ${hex}`);
    b.title = `Your color ${hex}`;
    b.style.setProperty('--sw', hex);
    b.addEventListener('click', (e) => { e.stopPropagation(); pick(hex); });
    return b;
  }
  const wrap = document.createElement('span');
  wrap.className = 'sw-custom-wrap';
  const lab = document.createElement('label');
  lab.className = `${cls} sw-custom color-add is-editable`;
  lab.setAttribute('role', 'radio');
  lab.setAttribute('aria-checked', 'true');
  lab.title = 'Tap to change this color';
  lab.style.setProperty('--sw', hex);
  const input = document.createElement('input');
  input.type = 'color';
  input.value = hex;
  input.setAttribute('aria-label', `Change your color ${hex}`);
  watchPicker(input);
  input.addEventListener('input', () => live(input.value.toLowerCase()));
  input.addEventListener('change', () => { colorPicking = false; done(hex, input.value.toLowerCase()); });
  lab.addEventListener('click', (e) => e.stopPropagation());
  lab.append(input);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'sw-remove';
  x.setAttribute('aria-label', `Remove ${hex} from your colors`);
  x.title = 'Remove from your colors';
  x.textContent = '×';
  x.addEventListener('click', (e) => { e.stopPropagation(); remove(hex); });
  wrap.append(lab, x);
  return wrap;
}

/* Your own colours: three show in a row (the one in use always among them); the
   rest sit behind "+N", so a row never wraps into a second line. */
let showAllCustom = false;
function capCustom(host) {
  const mine = [...host.children].filter((el) => el.matches('.sw-custom, .sw-custom-wrap'));
  if (!mine.length) return;
  const sel = mine.find((el) => el.matches('.sw-custom-wrap'));
  const order = sel ? [sel, ...mine.filter((el) => el !== sel)] : mine;
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'sw-more';
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    showAllCustom = !showAllCustom;
    for (const h of document.querySelectorAll('.swatches')) {
      h.classList.toggle('show-more', showAllCustom);
      const m = h.querySelector('.sw-more');
      if (m) { const n = h.querySelectorAll('.is-more').length; m.textContent = showAllCustom ? 'Less' : `+${n}`; }
    }
  });
  const apply = (cap) => {
    for (const el of mine) el.classList.toggle('is-more', !order.slice(0, cap).includes(el));
    const hidden = mine.length - Math.min(cap, mine.length);
    more.hidden = hidden === 0 && !showAllCustom;
    more.textContent = showAllCustom ? 'Less' : `+${hidden}`;
    more.setAttribute('aria-label', showAllCustom ? 'Show fewer of your colors' : `Show ${hidden} more of your colors`);
  };
  host.classList.toggle('show-more', false);
  mine[mine.length - 1].after(more);
  // as many of your colours as keep the row on one line (three when it can't be measured yet)
  const one = () => { const k = [...host.children].filter((el) => el.offsetParent !== null); return !k.length || k[k.length - 1].offsetTop === k[0].offsetTop; };
  if (!host.offsetParent) { apply(3); host.classList.toggle('show-more', showAllCustom); return; }
  let cap = mine.length;
  apply(cap);
  while (cap > 0 && !one()) apply(--cap);
  host.classList.toggle('show-more', showAllCustom);
}

function addCustomColor(hex) {
  hex = String(hex).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return;
  const brand = brandSwatches().some((x) => x.hex.toLowerCase() === hex);
  if (brand) return;
  customColors = [hex, ...customColors.filter((c) => c !== hex)].slice(0, MAX_CUSTOM);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customColors)); } catch (_) {}
}

/** What a part's text sits on: its card, or (no card) the background's own colour. */
function groundOf(part, look) {
  if (look[part].bg) return look[part].bg;
  const bd = activeBd();
  const a = state.adjust[bd.id];
  const base = (a && a.ground) || bd.base;
  if (!/^#[0-9a-f]{6}$/i.test(base || '')) return null;
  // a Dim wash darkens the ground
  return state.overlay.style !== 'none' && state.overlay.strength >= 0.35 ? '#1a1a1a' : base;
}

let colorSig = '';
function syncColorRows(force) {
  ensureColors();
  syncToneCustom();
  syncFieldDots(textLook(state, activeBd()));
  if (colorPicking && !force) return;
  const store = colorStore();
  const look = textLook(colorLookState(), activeBd());
  const sig = JSON.stringify([state.brand, colorBlockId, store.textColors, store.cardColors, store.borders, store.textTone, store.card, customColors, look.h1, look.body, state.backdrop, state.overlay, state.adjust[state.backdrop] && state.adjust[state.backdrop].ground]);
  if (!force && sig === colorSig) return;
  colorSig = sig;
  for (const line of document.querySelectorAll('.swatch-line[data-part]')) {
    const part = line.dataset.part, kind = line.dataset.kind;
    const host = line.querySelector('.swatches');
    host.innerHTML = '';
    const current = kind === 'text' ? store.textColors[part] : kind === 'card' ? store.cardColors[part] : store.borders[part].c;
    // the row shows what is in effect (the Text style default until a swatch is picked)
    const effective = (current || (kind === 'text' ? look[part].text : kind === 'card' ? (look[part].bg || 'none') : look[part].text) || '').toLowerCase();
    const set = (value, { live = false } = {}) => {
      /* Text colour and background are independent: while the text is on its
         default colour, a new background would bring its own readable default
         with it — so the colour showing now is kept as the text's own. */
      if (kind === 'card') for (const p of ['h1', 'body']) {         // the box's background is shared: keep both texts' colours
        // v3.4: …only while it still reads on the new background (Custom is the background alone,
        // so a pick must never hide the words — an unreadable one is left to the readable default)
        const now = (look[p].text || '').toLowerCase();
        const reads = !/^#[0-9a-f]{6}$/i.test(value || '') || !/^#[0-9a-f]{6}$/i.test(now) || contrast(now, value) >= 3;
        if (store.textColors[p] == null && reads) store.textColors[p] = now || null;
      }
      if (kind === 'text') store.textColors[part] = value;
      // header and body are one box: its background and border are shared
      else if (kind === 'card') { store.cardColors.h1 = value; store.cardColors.body = value; }
      else {
        const w = store.borders[part].w || 4;      // picking a colour shows the border
        for (const p of ['h1', 'body']) { store.borders[p].c = value; store.borders[p].w = w; }
      }
      syncBorderControls();
      draw();
      if (live) return;           // while the picker is open its row must stay put
      save();
      syncColorRows(true);
    };
    const chip = (value, label, cls, title, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sw ${cls}`;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(String(value).toLowerCase() === effective));
      b.setAttribute('aria-label', label);
      b.title = title || label;
      if (cls.includes('sw-colour')) b.style.setProperty('--sw', value);
      // every swatch applies when tapped — a low-contrast pair is only flagged, never blocked
      if (disabled) { b.classList.add('is-low'); b.title = `${label} — low contrast here`; }
      b.addEventListener('click', () => set(value));
      host.append(b);
    };
    if (kind === 'card') chip('none', 'None (transparent)', 'sw-none', 'None — the text sits straight on the background');
    const offFor = (hex) => {
      let off = false;
      if (kind === 'text') {
        const g = groundOf(part, look);
        off = !!g && contrast(hex, g) < MIN_CONTRAST;
      } else if (kind === 'card' && store.textColors[part]) {
        off = contrast(hex, store.textColors[part]) < MIN_CONTRAST;
      }
      // never grey out what is already chosen
      return off && String(hex).toLowerCase() !== effective;
    };
    for (const { name, hex } of brandSwatches()) chip(hex, name, 'sw-colour', name, offFor(hex));
    for (const hex of customColors) {
      host.append(customSwatch(hex, hex === effective, 'sw sw-colour', {
        pick: (h) => set(h),
        live: (h) => set(h, { live: true }),
        done: (from, to) => { replaceCustomColor(from, to); set(to); buildColourRow(); },
        remove: (h) => { removeCustomColor(h); syncColorRows(true); buildColourRow(); },
      }));
    }
    // + your own colour: the system picker, applied as you move it
    host.append(colorAddChip('sw sw-add', effective,
      (hex) => set(hex, { live: true }),
      (hex) => { addCustomColor(hex); set(hex); }));
    capCustom(host);
  }
}

/** The small dot on each field's colour button shows the text colour in effect. */
function syncFieldDots(look) {
  for (const b of document.querySelectorAll('.field-color')) {
    const part = b.dataset.part;
    const dot = b.querySelector('.field-color-dot');
    if (!dot) continue;
    const blk = b.dataset.block && blockById(b.dataset.block);
    if (blk) {
      const st = { ...state, ...(blk.style || {}) };
      dot.style.background = (st.textColors && st.textColors[part]) || textLook(st, activeBd())[part].text || 'transparent';
    } else dot.style.background = state.textColors[part] || look[part].text || 'transparent';
  }
}

/* A "+" chip that IS a colour input: the tap lands on the real control, so the
   system picker opens everywhere (a hidden input clicked from script doesn't on
   Safari, nor when it sits in a closed popup). onLive follows the picker as it
   moves; onDone runs once a colour is chosen. */
function colorAddChip(cls, start, onLive, onDone) {
  const label = document.createElement('label');
  label.className = `${cls} color-add`;
  label.title = 'Add your own color';
  const plus = document.createElement('span');
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', 'Add your own color');
  input.value = /^#[0-9a-f]{6}$/i.test(start || '') ? start : '#ff8eff';
  watchPicker(input);
  input.addEventListener('input', () => onLive(input.value.toLowerCase()));
  input.addEventListener('change', () => { colorPicking = false; onDone(input.value.toLowerCase()); });
  label.append(plus, input);
  return label;
}

/* --- the timeline row (desktop) ---------------------------------------------------
   On a wide screen the timeline, with its section and sound bars, spans the
   whole width under the preview and the panel, like a video editor: the
   preview and the panel share the room above it, and the panel scrolls on its
   own. On a phone it stays under the preview, in the sticky stage. */
function placeTimeline() {
  const row = $('#tl-row');
  const parts = ['#timeline', '#scene-bar', '#music-bar'].map((q) => $(q));
  if (!isPhone()) {
    if (parts[0].parentElement !== row) row.append(...parts);
  } else if (parts[0].parentElement === row) {
    $('#stage-hint').after(...parts);
  }
  sizeEditorRows();
}

/** Desktop: the room above the timeline row is what the preview and the panel get. */
function sizeEditorRows() {
  const root = document.documentElement;
  if (isPhone()) { root.style.removeProperty('--row1-h'); return; }
  const top = $('.topbar') ? $('.topbar').getBoundingClientRect().height : 64;
  const tl = $('#tl-row').getBoundingClientRect().height;
  // the panel takes the full height under the top bar; the preview gets
  // what is left above the timeline beside it
  const panel = Math.max(420 + tl + 18, Math.round(window.innerHeight - top - 18 - 18));
  const h = panel - tl - 18;
  root.style.setProperty('--row1-h', `${h}px`);
  root.style.setProperty('--panel-h', `${panel}px`);
  root.style.setProperty('--topbar-h', `${Math.round(top)}px`);
}

function wireTimelineRow() {
  placeTimeline();
  phoneMQ.addEventListener('change', placeTimeline);
  window.addEventListener('resize', sizeEditorRows);
  new ResizeObserver(sizeEditorRows).observe($('#tl-row'));
}

/* --- the colour popup ----------------------------------------------------------
   The palette button inside the Header and Body fields opens one popup for
   that part: its text colour, its background (the card), and a border —
   width, and a colour of its own (Auto follows the text). Brand colours
   first, then your own; + adds one with the system picker. */
let colorPart = null;
let colorBlockId = null;                  // null: the first text; else an extra block's id
const colorBlock = () => (colorBlockId ? blockById(colorBlockId) : null);
/** Where the colours being edited live: the first text (state) or a block's own style. */
const colorStore = () => { const b = colorBlock(); return b ? ensureBlockStyle(b) : state; };
const colorLookState = () => { const b = colorBlock(); return b ? { ...state, ...ensureBlockStyle(b) } : state; };
function openColorPop(part, btn, blockId = null, custom = false) {
  // v3.1: the box's background belongs to Custom; a field's palette is its text and border
  $('#color-pop').classList.toggle('is-custom', !!custom);
  hideToast();                       // a note at the bottom must never sit on the sheet's swatches
  colorPart = part;
  colorBlockId = blockId;
  const b = colorBlock();
  const k = b ? state.blocks.indexOf(b) : -1;
  // v3.2: Custom is the box's background only (text and border colours live in the fields' palettes)
  $(`#cp-title-${part}`).textContent = `${b ? `Text box ${k + 1} · ` : ''}${custom ? 'Background color' : `${part === 'h1' ? 'Header' : 'Body'} colors`}`;
  syncColorRows(true);
  syncBorderControls();
  const pop = $('#color-pop');
  for (const p of pop.querySelectorAll('.cp-part')) p.hidden = p.dataset.part !== part;
  $('#cp-card').setAttribute('aria-labelledby', `cp-title-${part}`);
  pop.hidden = false;
  syncColorRows(true);               // again, now the rows can be measured
  const card = $('#cp-card');
  placeColorPop();
  const first = card.querySelector('.cp-part:not([hidden]) .sw');
  if (first) first.focus({ preventScroll: true });
}

/* Desktop: the popup sits in the middle of the adjustments panel, and only the
   panel is toned down behind it — the colour edit is in focus while the
   preview stays clear to judge it. Phone: a sheet below the preview. */
function placeColorPop() {
  const pop = $('#color-pop');
  if (pop.hidden) return;
  const card = $('#cp-card'), scrim = $('#cp-scrim');
  if (isPhone()) {
    card.style.left = card.style.top = '';
    scrim.removeAttribute('style');
    scrim.classList.remove('is-panel');
    return;
  }
  // full screen: the controls are the side panel
  const p = (fsMode && sheetTab ? $('#section-sheet') : $('.panel-controls')).getBoundingClientRect();
  Object.assign(scrim.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
  scrim.classList.add('is-panel');
  const w = card.offsetWidth, h = card.offsetHeight;
  card.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, p.left + (p.width - w) / 2)))}px`;
  card.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - h - 8, p.top + (p.height - h) / 2)))}px`;
}

function closeColorPop() {
  const pop = $('#color-pop');
  if (pop.hidden) return;
  pop.hidden = true;
  const btn = colorPart && document.querySelector(colorBlockId ? `.field-color[data-part="${colorPart}"][data-block="${colorBlockId}"]` : `.field-color[data-part="${colorPart}"]:not([data-block])`);
  const wasBlock = !!colorBlockId;
  colorPart = null;
  colorBlockId = null;
  syncColorRows(true);
  if (wasBlock) renderBlocks();
  if (btn) btn.focus({ preventScroll: true });
}

function syncBorderControls() {
  const store = colorStore();
  for (const r of document.querySelectorAll('.cp-border-w')) {
    const b = store.borders[r.dataset.part];
    if (document.activeElement !== r) r.value = b.w;
    const out = document.querySelector(`.cp-border-out[data-part="${r.dataset.part}"]`);
    out.textContent = b.w ? `${b.w} px` : 'Off';
  }
}

function wireColorPop() {
  window.addEventListener('resize', placeColorPop);
  loadCustomColors();
  ensureColors();
  for (const b of document.querySelectorAll('.field-color:not([data-block])')) {
    b.addEventListener('click', (e) => { e.preventDefault(); openColorPop(b.dataset.part, b); });
  }
  $('#cp-scrim').addEventListener('click', closeColorPop);
  // a click anywhere outside the card (the preview side included) closes it too
  $('#color-pop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeColorPop(); });
  $('#cp-done').addEventListener('click', closeColorPop);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#color-pop').hidden) { e.stopImmediatePropagation(); closeColorPop(); } }, true);
  for (const r of document.querySelectorAll('.cp-border-w')) {
    r.addEventListener('input', () => {
      const bs = colorStore().borders;             // one border round the whole box
      bs.h1.w = Number(r.value); bs.body.w = Number(r.value);
      if (bs[r.dataset.part].c) bs[r.dataset.part === 'h1' ? 'body' : 'h1'].c = bs[r.dataset.part].c;
      syncBorderControls();
      draw();
    });
    r.addEventListener('change', () => { save(); syncColorRows(true); });
  }
  syncBorderControls();
}

/* --- picture framing ----------------------------------------------------------
   Scale → position → crop. The Left·Right / Up·Down sliders are the same
   position the preview drag sets (the crop inside the overhang, then the
   picture itself); 0 is centred. Reset framing puts scale and position back. */
function framingAxis(over, f, off, size) {
  const travel = over / 2 + size / 2;
  const c = -over * f + off * size + over / 2;   // centre offset, px
  return travel ? Math.max(-1, Math.min(1, c / travel)) : 0;
}

function setFramingAxis(v, over, size) {
  const travel = over / 2 + size / 2;
  const target = v * travel - over / 2;
  const f = over > 1 ? clamp01(-target / over) : 0.5;
  let off = (target + over * f) / size;
  off = Math.max(-0.5, Math.min(0.5, off));
  if (Math.abs(off) < 0.004) off = 0;
  return [f, off];
}

let framingSig = '';
function syncFraming() {
  if (!isImage()) return;
  const a = adjustFor(state.backdrop);
  const W = canvas.width, H = canvas.height;
  const sig = `${state.backdrop}|${a.zoom}|${a.fx}|${a.fy}|${a.ox}|${a.oy}|${W}x${H}|${a.ground}`;
  if (sig === framingSig) return;
  framingSig = sig;
  const over = overhang(W, H);
  const x = framingAxis(over.x, a.fx, a.ox || 0, W);
  const y = framingAxis(over.y, a.fy, a.oy || 0, H);
  if (document.activeElement !== $('#img-x')) $('#img-x').value = x;
  if (document.activeElement !== $('#img-y')) $('#img-y').value = y;
  const pct = (v) => (Math.abs(v) < 0.005 ? '0' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}`);
  $('#img-x-out').textContent = pct(x);
  $('#img-y-out').textContent = pct(y);
  // surface swatches
  const host = $('#img-ground .swatches');
  host.innerHTML = '';
  const bd = activeBd();
  const own = bd.kind === 'art' ? bd.base : C.plum;
  const opts = [{ name: 'Default', hex: null }, ...brandSwatches()];
  for (const { name, hex } of opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.className = hex ? 'sw sw-colour' : 'sw sw-default';
    if (hex) b.style.setProperty('--sw', hex);
    else { b.textContent = 'Auto'; b.style.setProperty('--sw', own); }
    b.setAttribute('aria-label', hex ? name : 'Default surface');
    b.title = hex ? name : 'Default — the artwork’s own color';
    b.setAttribute('aria-checked', String((a.ground || null) === hex));
    b.addEventListener('click', () => {
      if (hex) a.ground = hex; else delete a.ground;
      syncAdjust(state.backdrop);
      save();
      framingSig = '';
      draw();
    });
    host.append(b);
  }
}

function wireFraming() {
  const apply = () => {
    if (!isImage()) return;
    const a = adjustFor(state.backdrop);
    const W = canvas.width, H = canvas.height;
    const over = overhang(W, H);
    [a.fx, a.ox] = setFramingAxis(Number($('#img-x').value), over.x, W);
    [a.fy, a.oy] = setFramingAxis(Number($('#img-y').value), over.y, H);
    syncAdjust(state.backdrop);
    framingSig = '';
    draw();
  };
  for (const id of ['#img-x', '#img-y']) {
    $(id).addEventListener('input', apply);
    $(id).addEventListener('change', () => save());
  }
  $('#img-reset').addEventListener('click', () => {
    if (!isImage()) return;
    const a = adjustFor(state.backdrop);
    a.zoom = 1; a.fx = 0.5; a.fy = 0.5; a.ox = 0; a.oy = 0;
    syncAdjust(state.backdrop);
    save();
    framingSig = '';
    syncImageControls();
    draw();
  });
}

/* --- storage -------------------------------------------------------------------
   Uploads, recordings and sounds live in this browser (IndexedDB) — nothing
   is sent anywhere. Asking for persistent storage stops the browser from
   clearing them on its own when the disk gets tight; the note under the
   uploads says how much is kept.
   ------------------------------------------------------------------------ */
async function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (_) { /* not offered here */ }
  showStorage();
}

async function showStorage() {
  const note = $('#storage-note');
  if (!note) return;
  const mine = allBackdrops().some((b) => b.upload) || !!state.inset.id || !!state.music;
  if (!mine || !navigator.storage || !navigator.storage.estimate) { note.hidden = true; return; }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const mb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);
    note.textContent = `Uploads, recordings and sounds are saved in this browser only · ${mb(usage)} used`
      + (persisted ? '' : ' · may be cleared if the device runs low on space');
    note.title = `About ${mb(quota)} available to this site on this device`;
    note.hidden = false;
  } catch (_) { note.hidden = true; }
}

/* --- camera ------------------------------------------------------------------
   Record a clip right here: the browser asks for the camera and microphone,
   and the take becomes the background or the photo card like an upload.
   ------------------------------------------------------------------------ */
const CAMERA_MAX = 60;
let camStream = null;
let camFacing = 'user';
let camRec = null;
let camBlob = null;
let camTimer = 0;
let camTarget = 'background';

const CAMERA_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const cameraMime = () => (typeof MediaRecorder === 'undefined' ? null
  : CAMERA_MIMES.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; } }) || '');

function cameraError(msg) {
  const e = $('#camera-error');
  e.textContent = msg;
  e.hidden = !msg;
}

function cameraStage(stage) {
  // 'ready' (live view) · 'recording' · 'done' (playback of the take)
  const sheet = $('#camera');
  sheet.dataset.stage = stage;
  $('#camera-live').hidden = stage === 'done';
  $('#camera-take').hidden = stage !== 'done';
  $('#camera-ready').hidden = stage === 'done';
  $('#camera-done').hidden = stage !== 'done';
  $('#camera-rec').hidden = stage !== 'recording';
  const go = $('#camera-go');
  go.textContent = stage === 'recording' ? 'Stop' : 'Start recording';
  go.classList.toggle('is-recording', stage === 'recording');
  $('#camera-flip').disabled = stage === 'recording';
  $('#camera-bg').classList.toggle('btn-primary', camTarget === 'background');
  $('#camera-bg').classList.toggle('btn-outline', camTarget !== 'background');
  $('#camera-card').classList.toggle('btn-primary', camTarget === 'card');
  $('#camera-card').classList.toggle('btn-outline', camTarget !== 'card');
}

function stopCamera() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  $('#camera-live').srcObject = null;
}

async function startCamera() {
  stopCamera();
  cameraError('');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraError('This browser can’t use the camera here. Camera access needs a secure (https) page.');
    $('#camera-go').disabled = true;
    return;
  }
  const f = FORMATS[state.format];
  const portrait = f.h >= f.w;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: camFacing, width: { ideal: portrait ? 1080 : 1920 }, height: { ideal: portrait ? 1920 : 1080 } },
      audio: true,
    });
  } catch (e) {
    try {
      // no microphone (or it was refused): film without sound
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing }, audio: false });
    } catch (e2) {
      const denied = /NotAllowed|Permission|Security/i.test(`${e2.name} ${e2.message}`);
      cameraError(denied
        ? 'Camera access was blocked. Allow the camera for this site in your browser’s address bar, then try again.'
        : 'No camera was found.');
      $('#camera-go').disabled = true;
      return;
    }
  }
  $('#camera-go').disabled = false;
  const live = $('#camera-live');
  live.srcObject = camStream;
  live.classList.toggle('is-mirrored', camFacing === 'user');
  live.play().catch(() => {});
}

function openCamera(target) {
  stopPlayback();
  camTarget = target || 'background';
  camBlob = null;
  const f = FORMATS[state.format];
  $('.camera-view').style.setProperty('--ar', String(f.w / f.h));   // frame the shot like the format
  $('#camera').hidden = false;
  cameraStage('ready');
  startCamera();
}

function closeCamera() {
  if (camRec && camRec.state === 'recording') { camRec.onstop = null; camRec.stop(); }
  clearInterval(camTimer);
  stopCamera();
  const take = $('#camera-take');
  if (take.src) { URL.revokeObjectURL(take.src); take.removeAttribute('src'); take.load(); }
  $('#camera').hidden = true;
}

function recordCamera() {
  if (!camStream) return;
  const mime = cameraMime();
  if (mime === null) { cameraError('This browser cannot record video.'); return; }
  const chunks = [];
  try {
    camRec = new MediaRecorder(camStream, mime ? { mimeType: mime } : undefined);
  } catch (_) {
    cameraError('This browser cannot record video.');
    return;
  }
  camRec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  camRec.onstop = () => {
    clearInterval(camTimer);
    const type = (camRec.mimeType || mime || 'video/webm').split(';')[0];
    camBlob = new Blob(chunks, { type });
    const take = $('#camera-take');
    if (take.src) URL.revokeObjectURL(take.src);
    take.src = URL.createObjectURL(camBlob);
    stopCamera();
    cameraStage('done');
  };
  const t0 = performance.now();
  camRec.start(250);
  cameraStage('recording');
  $('#camera-clock').textContent = '0:00';
  camTimer = setInterval(() => {
    const s = Math.floor((performance.now() - t0) / 1000);
    $('#camera-clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= CAMERA_MAX && camRec.state === 'recording') camRec.stop();
  }, 200);
}

function cameraFile() {
  const ext = camBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return new File([camBlob], `camera-${stamp}.${ext}`, { type: camBlob.type });
}

function wireCamera() {
  // the camera opens from a clip's menu (Record background / Record a card)
  for (const b of document.querySelectorAll('[data-camera]')) {
    b.addEventListener('click', () => openCamera(b.dataset.camera));
  }
  $('#camera-close').addEventListener('click', closeCamera);
  $('#camera').addEventListener('click', (e) => { if (e.target === $('#camera')) closeCamera(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#camera').hidden) closeCamera(); });
  $('#camera-flip').addEventListener('click', () => {
    camFacing = camFacing === 'user' ? 'environment' : 'user';
    startCamera();
  });
  $('#camera-go').addEventListener('click', () => {
    if (camRec && camRec.state === 'recording') camRec.stop();
    else recordCamera();
  });
  $('#camera-retake').addEventListener('click', () => {
    camBlob = null;
    cameraStage('ready');
    startCamera();
  });
  $('#camera-bg').addEventListener('click', async () => {
    if (!camBlob) return;
    const file = cameraFile();
    closeCamera();
    await importFiles([file]);
    keepStorage();
  });
  $('#camera-card').addEventListener('click', () => {
    if (!camBlob) return;
    const file = cameraFile();
    closeCamera();
    // through the photo card's own upload path, so it behaves exactly like a picked file
    const input = $('#inset-input');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    keepStorage();
  });
  // any upload: keep it, and say how much is kept
  $('#file-input').addEventListener('change', () => setTimeout(keepStorage, 800));
  $('#inset-input').addEventListener('change', () => setTimeout(keepStorage, 800));
  showStorage();
}

/* --- photo card show / hide ---------------------------------------------
   Like Badge, Header and Body: switching it off keeps the card and its
   settings, it just leaves the canvas and the export. Adding a new card
   switches it back on. */
function syncInsetToggle() {
  const on = !state.inset.hidden;
  $('#tg-inset').checked = on;
  $('#inset-body').hidden = false;
  $('#inset-body').classList.toggle('is-off', !on);
}

function wireInsetToggle() {
  $('#tg-inset').addEventListener('change', (e) => {
    state.inset.hidden = !e.target.checked;
    syncInsetToggle();
    syncImageControls();
    save();
    draw();
  });
  // a fresh upload always shows
  $('#inset-input').addEventListener('change', () => {
    if (state.inset.hidden) { state.inset.hidden = false; syncInsetToggle(); }
  }, true);
  syncInsetToggle();
}

function wireHiRes() {
  onHiRes(() => { draw(); });
  for (const id of ['#save-go']) {
    const btn = $(id);
    btn.addEventListener('click', (e) => {
      if (hiReady()) return;
      // hold this click until the full-size artwork is in, then replay it
      e.stopImmediatePropagation();
      e.preventDefault();
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Preparing…';
      whenHiReady().then(() => {
        btn.textContent = label;
        btn.disabled = false;
        btn.click();
      });
    }, true);
  }
}

function tick() {
  paint();
  raf = requestAnimationFrame(tick);
}

function draw() {
  const wantLoop = hasMotion();
  if (wantLoop !== looping) {
    cancelAnimationFrame(raf);
    looping = wantLoop;
    if (wantLoop) { tick(); return; }
  }
  if (looping) return;              // the loop is already painting every frame
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(paint);
}

/* --- template thumbnails ------------------------------------------------- */

function galleryOrder() {
  const featured = (activeBrand().featured || []).map((id) => builtIns().find((b) => b.id === id)).filter(Boolean);
  const seen = new Set(featured.map((b) => b.id));
  const rest = allBackdrops().filter((b) => !seen.has(b.id) && b.kind !== 'solid' && b.listed !== false);
  // a pattern, an image, a colour — then your uploads (newest first), so the
  // latest one always sits in the first row — then everything else
  const ups = rest.filter((b) => b.upload).reverse();
  return [...featured.slice(0, 3), ...ups, ...featured.slice(3), ...rest.filter((b) => !b.upload)];
}

/** One background in the gallery: the background alone (an upload set as a pattern shows the pattern). */
function drawBgThumb(cv, id) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  render(g, cv.width, cv.height, {
    ...state,
    backdrop: id,
    h1: '', body: '',
    visibility: 'none',
    badge: 'none',          // the gallery shows backgrounds only; the preview shows the example
    badges: [], buttons: [], blocks: [], media: [], drawings: [],
    inset: { id: null, scale: 1, radius: 0.14 },
    overlay: { style: 'none', strength: 0 },   // the gallery shows the artwork itself, unwashed
    card: false,
    guides: false,
    pos: { [state.format]: { watermark: { x: 0.5, y: 0.18 }, text: { x: 0.5, y: 0.5 } } },
    format: state.format,
  }, {});
}
/** The open background's gallery tile, drawn again (pattern on / off, tile size, spacing). */
function refreshBgThumb(id = state.backdrop) {
  for (const cv of document.querySelectorAll(`.thumb[data-id="${CSS.escape(id)}"] canvas`)) {
    try { drawBgThumb(cv, id); } catch (_) { /* artwork still loading */ }
  }
}

function buildThumbs() {
  const host = $('#thumbs');
  host.innerHTML = '';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = Math.round(96 * dpr * 1.5);
  const H = Math.round(W * 16 / 9);

  // Solid colours live in the Colour row underneath — except the brand's
  // featured one, so the first row always offers a pattern, an image and a
  // colour. Featured first, then your uploads, then the rest.
  for (const bd of galleryOrder()) {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';
    wrap.dataset.k = bgKindOf(bd);   // v3.1: the Background tabs filter the gallery by it

    const btn = document.createElement('button');
    btn.className = 'thumb';
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.dataset.id = bd.id;
    // the artwork is the label; the name stays for screen readers and on hover
    btn.title = bd.name;
    btn.setAttribute('aria-label', bd.name);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    drawBgThumb(cv, bd.id);

    btn.append(cv);
    const check = document.createElement('span');
    check.className = 'thumb-check';
    check.setAttribute('aria-hidden', 'true');
    btn.append(check);
    if (bd.upload && isVideo(bd.id)) btn.classList.add('is-video');
    btn.addEventListener('click', () => {
      state.backdrop = bd.id;
      syncThumbs();
      syncImageControls();
      save();
      draw();
    });
    wrap.append(btn);

    if (bd.upload) {
      const x = document.createElement('button');
      x.className = 'thumb-remove';
      x.type = 'button';
      x.textContent = '×';
      x.title = `Remove ${bd.name}`;
      x.setAttribute('aria-label', `Remove ${bd.name}`);
      x.addEventListener('click', (e) => { e.stopPropagation(); dropUpload(bd.id); });
      wrap.append(x);
    }

    host.append(wrap);
  }
  host.hidden = !host.children.length;   // a brand with colours only
  delete host.dataset.sig;
  buildColourRow();
  syncThumbs();
}

/* --- preview surface ------------------------------------------------------
   What the preview sits on: the dark studio, or a white screen to judge the
   piece the way a light-mode feed shows it. One toggle in the corner. Purely a viewing aid: it is never drawn into
   an export and is not part of a saved design or template.
   ------------------------------------------------------------------------ */

function setSurface(s) {
  state.previewSurface = s === 'light' ? 'light' : 'studio';
  const light = state.previewSurface === 'light';
  document.querySelector('.stage').dataset.surface = state.previewSurface;
  // the whole viewport takes the second background, not just a panel behind the preview
  document.documentElement.dataset.surface = state.previewSurface;
  labelSurfaceToggle();
  save();
}

/* The second background is whichever the studio is not: white behind the
   dark editors, deep navy behind a brand with a light editor (T4R). */
function labelSurfaceToggle() {
  const btn = $('#surface-toggle');
  if (!btn) return;
  const alt = state.previewSurface === 'light';
  const lightUi = activeBrand().ui === 'light';
  btn.setAttribute('aria-pressed', String(alt));
  const label = alt
    ? `Preview on the ${lightUi ? 'light' : 'dark'} studio background`
    : `Preview on a ${lightUi ? 'dark' : 'light'} background`;
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function syncThumbs() {
  let active = null;
  for (const el of document.querySelectorAll('.thumb')) {
    const on = el.dataset.id === state.backdrop;
    el.setAttribute('aria-checked', String(on));
    if (on) active = el;
  }
  revealThumb(active);
}

/* On a phone the picker is one horizontal row, so the selected swatch can sit
   off the end of it after a reload or a brand switch. Nudge it into view —
   and only ever the row itself, never the page. */
function revealThumb(el) {
  const strip = $('#thumbs');
  if (!el || !strip || strip.scrollWidth <= strip.clientWidth + 1) return;
  const r = el.parentElement.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const pad = 14;
  const by = r.left < s.left + pad ? r.left - s.left - pad
    : r.right > s.right - pad ? r.right - s.right + pad
    : 0;
  if (by) strip.scrollBy({ left: by, behavior: 'smooth' });
}

/* --- formats --------------------------------------------------------------
   A native <select>, so a phone gets its own picker and the keyboard works
   for free. The ratio icon and pixel size beside it follow the choice.
   ------------------------------------------------------------------------ */

/* One dropdown sets what you are making and its shape: a Video in any format,
   or a Carousel in the feed formats (feed carousels don't take 9:16). */
const CONTENT_FORMATS = {
  video: ['9x16', '3x4', '4x5', '1x1', '16x9'],
  carousel: ['9x16', '3x4', '4x5', '1x1', '16x9'],   // a carousel can be made at any size — Reel / Story included
};

function buildFormats() {
  const sel = $('#format-select');
  sel.innerHTML = '';
  for (const [type, label] of [['video', 'Video'], ['carousel', 'Carousel']]) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const key of CONTENT_FORMATS[type]) {
      const f = FORMATS[key];
      const opt = document.createElement('option');
      opt.value = `${type}:${key}`;
      opt.textContent = `${f.label} · ${key.replace('x', ':')}`;   // v3.1: the group says Video / Carousel
      group.append(opt);
    }
    sel.append(group);
  }
  sel.addEventListener('change', () => {
    const [type, key] = sel.value.split(':');
    if (!FORMATS[key]) return;
    switchLayout(state.format, key);
    state.format = key;
    setContentType(type);
    syncFormats();
    save();
    draw();
  });
  syncFormats();
}

function syncFormats() {
  // a carousel can't be 9:16 (an older design might say so) — it opens as 4:5
  if (state.contentType === 'carousel' && !CONTENT_FORMATS.carousel.includes(state.format)) state.format = '4x5';
  const f = FORMATS[state.format];
  $('#format-select').value = `${state.contentType === 'carousel' ? 'carousel' : 'video'}:${state.format}`;
  const icon = $('#format-ratio');
  const long = 22;
  const ratio = f.w / f.h;
  icon.style.width = `${Math.round(ratio >= 1 ? long : long * ratio)}px`;
  icon.style.height = `${Math.round(ratio >= 1 ? long / ratio : long)}px`;
  syncFormatTab();
}

/* The Format button IS the dropdown: an invisible select laid over it, so a tap
   opens the system list straight away (on every platform — a select can't be
   opened from script on iOS). It mirrors the Format select and hands its
   choice to it, so there is still one control that owns the format. */
/* v3.1: the collapsed selector reads [icon] Reel 9:16 — the icon is the content type
   (Video / Carousel), the word is the format; nothing said twice. */
const KIND_ICONS = {
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5 21 8v8l-5-2.5z"/></svg>',
  carousel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="11" height="14" rx="2"/><path d="M3 8v8M21 8v8"/></svg>',
};
/* v4 · Size names say what the shape is; Reel / Carousel is its own control (syncContentTabs). */
const SIZE_NAMES = { '9x16': 'Vertical', '3x4': 'Tall', '4x5': 'Portrait', '1x1': 'Square', '16x9': 'Landscape' };
function syncFormatTab() {
  const src = $('#format-select'), dst = $('#tab-format-select');
  if (!src || !dst) return;
  const [type, key] = (src.value || 'video:9x16').split(':');
  const f = FORMATS[key] || FORMATS['9x16'];
  const kind = type === 'carousel' ? 'Carousel' : 'Reel';
  const optSig = `${type}`;
  if (dst.dataset.sig !== optSig) {
    dst.dataset.sig = optSig;
    dst.innerHTML = '';
    // the open content type's sizes; the other type's are kept (hidden) so a saved or scripted
    // "carousel:1x1" still selects — picking one switches the content type too
    for (const t of [type, type === 'carousel' ? 'video' : 'carousel']) {
      for (const k of CONTENT_FORMATS[t] || CONTENT_FORMATS.video) {
        const o = document.createElement('option');
        o.value = `${t}:${k}`;
        o.textContent = `${sizeNameOf(k, t)} · ${k.replace('x', ':')} · ${FORMATS[k].sub}${t === type ? '' : t === 'carousel' ? ' · as a Carousel' : ' · as a Reel'}`;
        if (t !== type) o.hidden = true;
        dst.append(o);
      }
    }
  }
  dst.value = src.value;
  const lab = $('#tb-format-label');
  const sig = `${type}|${key}`;
  if (lab.dataset.sig !== sig) {
    lab.dataset.sig = sig;
    lab.innerHTML = '';
    const name = document.createElement('span'); name.className = 'fmt-name'; name.textContent = sizeNameOf(key, type) || f.label;
    const ratio = document.createElement('span'); ratio.className = 'fmt-ratio'; ratio.textContent = key.replace('x', ':');
    lab.append(name, ratio);
  }
  dst.setAttribute('aria-label', `Size: ${sizeNameOf(key, type)} ${key.replace('x', ':')}, ${f.sub} — change`);
  const wrap = lab.closest('.topbar-format');
  if (wrap) { wrap.dataset.kind = kind; wrap.title = `Size: ${sizeNameOf(key, type)} ${key.replace('x', ':')} · ${f.sub} · ${f.hint}`; }
  syncContentTabs(type);
}
function syncContentTabs(type = state.contentType) {
  document.documentElement.dataset.content = type === 'carousel' ? 'carousel' : 'video';
  for (const b of document.querySelectorAll('.tb-content-btn')) b.setAttribute('aria-checked', String(b.dataset.type === (type === 'carousel' ? 'carousel' : 'video')));
}
/** Reel ⇄ Carousel on the open project: the same sections, the same size. */
function switchContent(type) {
  const src = $('#format-select');
  if (!src) return;
  const key = state.format;
  const want = `${type}:${key}`;
  if (src.value === want) return;
  src.value = want;
  src.dispatchEvent(new Event('change'));
  showToast(type === 'carousel' ? `Now a Carousel · ${state.scenes.length} slides, one per section` : `Now a Reel · ${state.scenes.length} sections on the timeline`, 'Undo', () => switchContent(type === 'carousel' ? 'video' : 'carousel'), 5000);
}

/* The format is a project setting, made once: it sits in the top bar with the
   brand. The control there IS the dropdown — an invisible select over the
   label, so a tap opens the system list everywhere — and hands its choice to
   the Format select, which still owns the format. */
function wireFormatTab() {
  const sel = $('#tab-format-select');
  syncFormatTab();
  sel.addEventListener('change', () => {
    const src = $('#format-select');
    src.value = sel.value;
    src.dispatchEvent(new Event('change', { bubbles: true }));
    syncFormatTab();
    syncSectionValues(true);
  });
  // v4 · Reel / Carousel
  for (const b of document.querySelectorAll('.tb-content-btn')) b.addEventListener('click', () => { switchContent(b.dataset.type); syncSectionValues(true); });
}

/* --- segmented controls -------------------------------------------------- */

function wireSegments(sel, attr, key) {
  const host = $(sel);
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    state[key] = btn.dataset[attr];
    syncSegments(sel, attr, key);
    syncImageControls();      // the stage hint names whatever is on the canvas
    save();
    draw();
  });
  syncSegments(sel, attr, key);
}

function syncSegments(sel, attr, key) {
  for (const el of document.querySelectorAll(`${sel} button`)) {
    el.setAttribute('aria-checked', String(el.dataset[attr] === state[key]));
  }
}

/* --- dragging ------------------------------------------------------------
   A press only becomes a drag once it has travelled TAP_SLOP screen pixels.
   Short of that it is a tap — on the header or body that opens the editor
   in place, and nothing moves, so a tap can never nudge the layout.
   ------------------------------------------------------------------------ */

const TAP_SLOP = 6;       // screen px — a finger wobbles more than a mouse, still well under a drag

let dragging = null;
let hovering = false;
let hoverHit = null;   // v4 · what the pointer is over: { r (canvas px), sig (as `selected` names it) }
let lastLayout = null;

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function hit(p) {
  // a second tap on the same spot reaches what lies underneath (see wireHitCycle)
  if (hitOverride && performance.now() < hitOverride.until && Math.abs(p.x - hitOverride.x) < 1 && Math.abs(p.y - hitOverride.y) < 1) return { ...hitOverride.h, L: layout(ctx, state, canvas.width, canvas.height) };
  const L = layout(ctx, state, canvas.width, canvas.height);
  const inside = (r, h) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + h;
  for (const b of [...(L.buttons || [])].reverse()) {
    if (inside(b.rect, b.rect.h)) return { key: 'button', id: b.id, L };
  }
  for (const m of [...(L.media || [])].reverse()) {
    if (inside(m.insRect, m.ins.h)) return { key: 'media', id: m.id, L };
  }
  for (const b of [...(L.xbadges || [])].reverse()) {
    if (inside(b.rect, b.rect.h)) return { key: 'xbadge', id: b.id, L };
  }
  if (L.wm.image && inside(L.wmRect, L.wmRect.h)) return { key: 'watermark', L };
  if (!L.tx.empty && inside(L.txRect, L.tx.h)) return { key: 'text', L, part: partAt(L, p) };
  for (const x of [...(L.extras || [])].reverse()) {
    if (inside(x.txRect, x.tx.h)) return { key: 'xblock', id: x.id, L, part: partAt(x, p) };
  }
  if (L.ins.image && inside(L.insRect, L.ins.h)) return { key: 'inset', L };
  return null;
}

/* --- overlapping and small elements -----------------------------------------------
   Everything under a point, top first (the same order as hit()). Tapping the same
   spot again selects the next one down, so a badge on a text box, or a button under
   a badge, can always be reached. A tap just beside a very small element (under
   ~44 px on screen) still selects it. */
let hitOverride = null;
let lastTapHit = null;
const hitKey = (h) => (h ? `${h.key}:${h.id || ''}` : '');
function hitAll(p, pad = 0) {
  const L = layout(ctx, state, canvas.width, canvas.height);
  const inside = (r, h) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + h + pad;
  const out = [];
  for (const b of [...(L.buttons || [])].reverse()) if (inside(b.rect, b.rect.h)) out.push({ key: 'button', id: b.id, r: b.rect });
  for (const m of [...(L.media || [])].reverse()) if (inside(m.insRect, m.ins.h)) out.push({ key: 'media', id: m.id, r: { ...m.insRect, h: m.ins.h } });
  for (const b of [...(L.xbadges || [])].reverse()) if (inside(b.rect, b.rect.h)) out.push({ key: 'xbadge', id: b.id, r: b.rect });
  if (L.wm.image && inside(L.wmRect, L.wmRect.h)) out.push({ key: 'watermark', r: L.wmRect });
  if (!L.tx.empty && inside(L.txRect, L.tx.h)) out.push({ key: 'text', part: partAt(L, p), r: { ...L.txRect, h: L.tx.h } });
  for (const x of [...(L.extras || [])].reverse()) if (inside(x.txRect, x.tx.h)) out.push({ key: 'xblock', id: x.id, part: partAt(x, p), r: { ...x.txRect, h: x.tx.h } });
  if (L.ins.image && inside(L.insRect, L.ins.h)) out.push({ key: 'inset', r: { ...L.insRect, h: L.ins.h } });
  return out;
}
function wireHitCycle() {
  $('#canvas-wrap').addEventListener('pointerdown', (e) => {
    hitOverride = null;
    if (e.target !== canvas || e.button > 0 || editor || fsMode === 'preview' || e.shiftKey || e.metaKey || e.ctrlKey) return;
    const p = toCanvas(e);
    const k = canvas.width / (canvas.getBoundingClientRect().width || canvas.width);   // canvas px per screen px
    let all = hitAll(p);
    // nothing right there: a very small element close by still counts
    if (!all.length) {
      all = hitAll(p, 12 * k).filter((h) => Math.min(h.r.w, h.r.h) / k < 44);
      if (all.length) hitOverride = { x: p.x, y: p.y, h: all[0], until: performance.now() + 400 };
    }
    const now = performance.now();
    const again = lastTapHit && now - lastTapHit.t < 1500 && Math.hypot(e.clientX - lastTapHit.sx, e.clientY - lastTapHit.sy) < 10;
    if (again && all.length > 1) {
      const i = all.findIndex((h) => hitKey(h) === lastTapHit.key);
      const next = all[(i + 1) % all.length];
      hitOverride = { x: p.x, y: p.y, h: next, until: now + 400 };
      lastTapHit = { sx: e.clientX, sy: e.clientY, t: now, key: hitKey(next) };
      return;
    }
    lastTapHit = all.length ? { sx: e.clientX, sy: e.clientY, t: now, key: hitKey(hitOverride ? hitOverride.h : all[0]) } : null;
  }, true);
}

/** Header or body, whichever is nearer — so a tap on the panel padding or
    the gap between them still lands on something editable. */
function partAt(L, p) {
  const { h1, body } = L.parts;
  if (!h1) return body ? 'body' : null;
  if (!body) return 'h1';
  return p.y < (h1.y + h1.h + body.y) / 2 ? 'h1' : 'body';
}

/* With the grid on, a dragged item's centre, left or right edge snaps to the grid's
   vertical lines, and its top, middle or bottom to the horizontal ones (x is the
   item's centre, y its top). The lines it snapped to light up. */
let gridHits = { x: [], y: [] };
function snapToGrid(x, y, w, h, W, H, tol) {
  const g = gridLines(state.format, W, H);
  const near = (lines, v) => lines.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), Infinity);
  const pick = (lines, refs) => {
    let best = null;
    for (const [v, toPos] of refs) {
      const l = near(lines, v);
      if (Math.abs(l - v) < tol && (!best || Math.abs(l - v) < best.d)) best = { d: Math.abs(l - v), line: l, pos: toPos(l) };
    }
    return best;
  };
  const bx = pick(g.v, [[x, (l) => l], [x - w / 2, (l) => l + w / 2], [x + w / 2, (l) => l - w / 2]]);
  const by = pick(g.h, [[y, (l) => l], [y + h / 2, (l) => l - h / 2], [y + h, (l) => l - h]]);
  gridHits = { x: bx ? [bx.line] : [], y: by ? [by.line] : [] };
  return [bx ? bx.pos : x, by ? by.pos : y];
}

function snap(value, target, tol) {
  return Math.abs(value - target) < tol ? target : value;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How much of the cover-fitted image falls outside the canvas, per axis. */
function overhang(W, H) {
  const bd = activeBd();
  const img = activeImage(bd, W, H);
  if (!img) return { x: 0, y: 0 };
  const a = adjustFor(bd.id);
  const { w: iw, h: ih } = sizeOf(img);
  if (!iw || !ih) return { x: 0, y: 0 };
  const s = Math.max(W / iw, H / ih) * Math.max(1, a.zoom);
  return { x: Math.max(0, iw * s - W), y: Math.max(0, ih * s - H) };
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;              // right/middle click is not a drag
  const p = toCanvas(e);
  const h = hit(p);
  const start = { sx: e.clientX, sy: e.clientY, moved: false };

  // Empty ground on a photo backdrop pans the crop instead.
  if (!h) {
    canvas.setPointerCapture(e.pointerId);
    if (!isImage()) { dragging = { key: 'ground', ...start }; return; }   // a tap opens Background
    const a = adjustFor(state.backdrop);
    dragging = { key: 'image', ox: p.x, oy: p.y, fx: a.fx, fy: a.fy, offX: a.ox || 0, offY: a.oy || 0, ...start };
    return;
  }

  canvas.setPointerCapture(e.pointerId);
  if (h.key === 'media') {
    const m = mediaItemById(h.id);
    dragging = { key: 'media', id: h.id, dx: p.x - m.x * canvas.width, dy: p.y - m.y * canvas.height, ...start };
    return;
  }
  if (h.key === 'xbadge') {
    const b = badgeItemById(h.id);
    dragging = { key: 'xbadge', id: h.id, dx: p.x - b.x * canvas.width, dy: p.y - b.y * canvas.height, ...start };
    return;
  }
  if (h.key === 'button') {
    const b = buttonById(h.id);
    dragging = { key: 'button', id: h.id, dx: p.x - b.x * canvas.width, dy: p.y - b.y * canvas.height, ...start };
    return;
  }
  if (h.key === 'xblock') {
    const b = state.blocks.find((x) => x.id === h.id);
    dragging = { key: 'xblock', id: h.id, part: h.part, dx: p.x - b.x * canvas.width, dy: p.y - b.y * canvas.height, ...start };
    return;
  }
  const pos = state.pos[state.format][h.key];
  dragging = {
    key: h.key,
    part: h.part,
    dx: p.x - pos.x * canvas.width,
    dy: p.y - pos.y * canvas.height,
    ...start,
  };
});

canvas.addEventListener('pointermove', (e) => {
  const p = toCanvas(e);

  if (!dragging) {
    const h = hit(p);
    const over = !!h;
    if (over !== hovering) { hovering = over; draw(); }
    canvas.style.cursor = h && h.key === 'text' ? 'pointer'
      : over ? 'grab' : (isImage() ? 'move' : 'default');
    return;
  }

  // Not a drag until it has travelled far enough to not be a tap.
  if (!dragging.moved) {
    if (Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) < TAP_SLOP) return;
    dragging.moved = true;
    canvas.classList.add('dragging');
    if (editor) closeEditor(true);
  }

  if (dragging.key === 'ground') return;

  if (dragging.key === 'image') {
    /* The picture follows the pointer in every direction. Inside what the
       cover fit pushes off-canvas it just changes the crop; past that it
       moves the picture itself and the ground shows (up to half a frame).
       It clicks back into place within ~1.5 % of filling the frame. */
    const a = adjustFor(state.backdrop);
    const W = canvas.width, H = canvas.height;
    const over = overhang(W, H);
    const axis = (d, o, f0, off0, size) => {
      const target = -o * f0 + off0 * size + d;          // where the picture's edge goes
      const f = o > 1 ? clamp01(-target / o) : f0;
      let off = (target + o * f) / size;
      off = Math.max(-0.5, Math.min(0.5, off));
      if (Math.abs(off) < 0.015) off = 0;
      return [f, off];
    };
    [a.fx, a.ox] = axis(p.x - dragging.ox, over.x, dragging.fx, dragging.offX, W);
    [a.fy, a.oy] = axis(p.y - dragging.oy, over.y, dragging.fy, dragging.offY, H);
    syncAdjust(state.backdrop);
    draw();
    return;
  }

  const W = canvas.width, H = canvas.height;
  const sa = safeArea(state.format, W, H);
  const tol = W * 0.012;

  let x = p.x - dragging.dx;
  let y = p.y - dragging.dy;

  const L = layout(ctx, state, W, H);
  // The badge is stored by the top of its full lockup; with the "Powered by"
  // label off the visible logo starts lower, and that is what should snap.
  const xg = dragging.key === 'xbadge' ? (L.xbadges || []).find((x) => x.id === dragging.id) : null;
  const off = dragging.key === 'watermark' ? L.wm.offY : xg ? xg.badge.offY : 0;

  x = snap(x, W / 2, tol);
  y = snap(y + off, sa.y, tol) - off;

  const xb = dragging.key === 'xblock' ? (L.extras || []).find((x) => x.id === dragging.id) : null;
  const bt = dragging.key === 'button' ? (L.buttons || []).find((x) => x.id === dragging.id) : null;
  const md = dragging.key === 'media' ? (L.media || []).find((x) => x.id === dragging.id) : null;
  const blockH = xg ? xg.rect.h : md ? md.ins.h : bt ? bt.rect.h : dragging.key === 'watermark' ? L.wmRect.h
    : dragging.key === 'inset' ? L.ins.h
    : xb ? xb.tx.h
    : L.tx.h;
  y = snap(y + off + blockH, sa.y + sa.h, tol) - off - blockH;
  if (state.grid) {
    const blockW = xg ? xg.rect.w : md ? md.ins.w : bt ? bt.rect.w : dragging.key === 'watermark' ? L.wmRect.w
      : dragging.key === 'inset' ? L.ins.w : xb ? xb.txRect.w : L.txRect.w;
    // ~7 screen pixels, whatever the preview size
    [x, y] = snapToGrid(x, y + off, blockW, blockH, W, H, Math.max(tol, 7 * W / (canvas.clientWidth || W)));
    y -= off;
  } else gridHits = { x: [], y: [] };

  // keep the block reachable
  x = Math.max(W * 0.04, Math.min(W * 0.96, x));
  y = Math.max(-blockH * 0.5, Math.min(H - blockH * 0.5, y));

  // moving anything on the section makes this format's layout the user's own
  if (!dragging.marked) { dragging.marked = true; markEdited(); }
  if (dragging.key === 'media') {
    const m = mediaItemById(dragging.id);
    if (m) { m.x = x / W; m.y = y / H; }
  } else if (dragging.key === 'xbadge') {
    const b = badgeItemById(dragging.id);
    if (b) { b.x = x / W; b.y = y / H; }
  } else if (dragging.key === 'button') {
    const b = buttonById(dragging.id);
    if (b) { b.x = x / W; b.y = y / H; }
  } else if (dragging.key === 'xblock') {
    const b = state.blocks.find((v) => v.id === dragging.id);
    if (b) { b.x = x / W; b.y = y / H; }
  } else state.pos[state.format][dragging.key] = { x: x / W, y: y / H };
  draw();
});

function endDrag(e) {
  if (!dragging) return;
  const d = dragging;
  dragging = null;
  canvas.classList.remove('dragging');
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

  const tap = e.type === 'pointerup' && !d.moved;
  /* See it → tap it → edit it. A tap selects the element, switches to its
     tab and brings its controls into view; a drag selects it too (without
     moving the panel). Foreground first: hit() only falls through to the
     background where nothing else is. */
  const el = d.key === 'watermark' ? 'watermark' : d.key === 'inset' ? 'inset'
    : d.key === 'xblock' ? `xb:${d.id}:${d.part === 'body' ? 'body' : 'h1'}`
    : d.key === 'text' ? (d.part === 'body' ? 'body' : 'h1') : 'background';
  if (tap) selectElement(el);
  // a tap on an extra block edits it in the panel, field and all
  if (tap && d.key === 'xblock') focusBlockField(d.id, d.part === 'body' ? 'body' : 'h1');
  else if (d.moved) selectElement(el, { reveal: false });
  // …and a double tap on the picture puts it back in the middle
  if (tap && d.key === 'image') {
    const now = performance.now();
    if (now - lastGroundTap < 350) {
      const a = adjustFor(state.backdrop);
      a.fx = 0.5; a.fy = 0.5; a.ox = 0; a.oy = 0;
      syncAdjust(state.backdrop);
      save();
    }
    lastGroundTap = now;
  }
  // A tap on the header or body edits it, right where it is.
  if (tap && d.key === 'text' && d.part) {
    openEditor(d.part, e.pointerType);
    return;
  }
  if (d.moved) save();
  draw();
}
let lastGroundTap = 0;

/* --- more text: extra header + body blocks ------------------------------------
   Any screen can carry more than one header with its body — a list of points,
   a quote and its source, a label by the card. Each extra block is set exactly
   like the main one (type, size, colours and the Header / Body switches) and
   is placed on its own: drag it on the preview. They are edited in the
   Header section under "More text"; each screen has its own. */
/* Each extra text block has its own style — Light / Dark, the panel, and its
   colours and border (the palette buttons in its fields). A block starts with
   the first text's style, copied when it is made; after that the two are
   independent. (A block saved before this follows the first text until its
   style is first changed.) */
const STYLE_KEYS = ['textTone', 'card', 'textColors', 'cardColors', 'borders', 'h1Scale', 'bodyScale'];   // each extra text has its own sizes too
const styleOf = (src) => { const o = {}; for (const k of STYLE_KEYS) o[k] = clone(src[k]); return o; };
function ensureBlockStyle(b) {
  if (!b.style) b.style = styleOf(state);
  const st = b.style;
  st.textColors = Object.assign({ h1: null, body: null }, st.textColors || {});
  st.cardColors = Object.assign({ h1: null, body: null }, st.cardColors || {});
  const bd = st.borders || {};
  st.borders = { h1: Object.assign({ w: 0, c: null }, bd.h1 || {}), body: Object.assign({ w: 0, c: null }, bd.body || {}) };
  if (st.textTone !== 'dark') st.textTone = 'light';
  st.card = st.card !== false;
  if (!(st.h1Scale > 0)) st.h1Scale = h1ScaleOf(state);
  if (!(st.bodyScale > 0)) st.bodyScale = bodyScaleOf(state);
  return st;
}
const blockById = (id) => (state.blocks || []).find((b) => b.id === id);

/* Style: Light / Dark / Custom — one control for how text looks. Light and Dark
   are the brand's sets (type colour with its panel); picking one clears any own
   colours. Custom is "your own colors": it opens the colour popup (text,
   background — None for no panel — and border). */
function isCustomLook(st) {
  const c = (o) => o && ((o.h1 != null && o.h1 !== 'none') || (o.body != null && o.body !== 'none'));
  return c(st.textColors) || c(st.cardColors);
}
/** v3.1: "No background colour" — the text sits straight on the background (any style). */
/* v3.2: a CTA section's words (bold, no button) have no box until one is asked for:
   unticking "No background color", or a background colour picked under Custom. */
const boldCta = (st) => st === state && state.sceneRole === 'cta' && state.ctaStyle === 'bold';
const ownCard = (st) => !!(st.cardColors && st.cardColors.h1 && st.cardColors.h1 !== 'none');
const noBg = (st) => st.card === false || !!(st.cardColors && st.cardColors.h1 === 'none' && st.cardColors.body === 'none')
  || (boldCta(st) && !st.ctaBox && !ownCard(st));
function setNoBg(st, on) {
  st.card = true;
  st.cardColors = on ? { h1: 'none', body: 'none' } : { h1: null, body: null };
  if (st === state) st.ctaBox = !on;
}
function resetLook(st) {
  const bare = noBg(st);              // Light / Dark keep "No background color" as it is
  st.textColors = { h1: null, body: null };
  st.cardColors = bare ? { h1: 'none', body: 'none' } : { h1: null, body: null };
  st.card = true;
  if (st === state && !bare) st.ctaBox = true;
}
function syncToneCustom() {
  const custom = isCustomLook(state);
  for (const b of document.querySelectorAll('#seg-tone [data-t]')) {
    const on = b.dataset.t === 'custom' ? custom : !custom && b.dataset.t === (state.textTone === 'dark' ? 'dark' : 'light');
    b.setAttribute('aria-checked', String(on));
  }
  const n = $('#tone-note');
  if (n) n.hidden = !custom;
  const nb = $('#tg-nobg');
  if (nb) nb.checked = noBg(state);
}
function wireToneCustom() {
  $('#seg-tone').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'custom') {
      e.stopImmediatePropagation();
      openColorPop('h1', b, null, true);
      return;
    }
    resetLook(state);                 // the brand's set, as it was
    $('#tg-card').checked = true;
    commitScene();
    save();
    requestAnimationFrame(() => { syncToneCustom(); syncColorRows(true); });
  }, true);
  $('#tg-nobg').addEventListener('change', (e) => {
    setNoBg(state, e.target.checked);
    $('#tg-card').checked = true;
    commitScene(); save(); syncColorRows(true); draw();
  });
  syncToneCustom();
}

function renderBlocks() {
  const host = $('#blocks');
  if (!host) return;
  host.innerHTML = '';
  (state.blocks || []).forEach((b, k) => {
    const row = document.createElement('div');
    row.className = 'block-item';
    row.id = `blk-${b.id}`;
    const head = document.createElement('div');
    head.className = 'block-head';
    const t = document.createElement('span');
    t.className = 'block-title';
    t.textContent = `Text box ${k + 1}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'block-del';
    del.setAttribute('aria-label', `Remove text box ${k + 1}`);
    del.innerHTML = MENU_ICONS.remove;
    del.addEventListener('click', () => removeBlock(b.id));
    head.append(t, pngButton(`xb:${b.id}`, `text box ${k + 1}`), del);
    const mk = (part, rows, ph) => {
      const wrap = document.createElement('div');
      wrap.className = 'field-fav';
      const ta = document.createElement('textarea');
      ta.rows = rows;
      ta.spellcheck = true;
      ta.className = `block-${part}`;
      ta.placeholder = ph;
      ta.value = b[part] || '';
      ta.setAttribute('aria-label', `Text box ${k + 1} ${part === 'h1' ? 'header' : 'body'}`);
      ta.addEventListener('input', () => { b[part] = ta.value; save(); draw(); });
      ta.addEventListener('focus', () => { selected = `xb:${b.id}:${part}`; draw(); });
      // its own colours, background and border
      const cb = document.createElement('button');
      cb.type = 'button';
      cb.className = 'field-color';
      cb.dataset.part = part;
      cb.dataset.block = b.id;
      const what = `Text box ${k + 1} ${part === 'h1' ? 'header' : 'body'}`;
      cb.setAttribute('aria-label', `${what} colors`);
      cb.title = `${what} colors`;
      cb.innerHTML = `<i class="field-color-dot" aria-hidden="true"></i>${MENU_ICONS.palette}`;
      cb.addEventListener('click', (e) => { e.preventDefault(); openColorPop(part, cb, b.id); });
      wrap.append(ta, cb);
      return wrap;
    };
    // its own Light / Dark and panel
    const st = b.style || state;
    const style = document.createElement('div');
    style.className = 'block-style';
    const lbl = document.createElement('span');
    lbl.className = 'block-style-lbl';
    lbl.textContent = 'Style';
    const seg = document.createElement('div');
    seg.className = 'segments segments-sm';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', `Text box ${k + 1} color`);
    const custom = isCustomLook(st);
    for (const [t, name] of [['dark', 'Light'], ['light', 'Dark'], ['custom', 'Custom']]) {   // named for the look: dark type = Light
      const sb = document.createElement('button');
      sb.type = 'button';
      sb.setAttribute('role', 'radio');
      sb.setAttribute('aria-checked', String(t === 'custom' ? custom : !custom && (st.textTone === 'dark' ? 'dark' : 'light') === t));
      sb.textContent = name;
      sb.addEventListener('click', () => {
        if (t === 'custom') { openColorPop('h1', sb, b.id, true); return; }
        const own = ensureBlockStyle(b);
        own.textTone = t;
        resetLook(own);
        save(); renderBlocks(); syncColorRows(true); draw();
      });
      seg.append(sb);
    }
    style.append(lbl, seg);
    const nb = document.createElement('label');
    nb.className = 'nobg-check block-nobg';
    nb.innerHTML = `<input type="checkbox" ${noBg(st) ? 'checked' : ''}><span>No background color</span>`;
    nb.querySelector('input').addEventListener('change', (e) => { setNoBg(ensureBlockStyle(b), e.target.checked); save(); renderBlocks(); syncColorRows(true); draw(); });
    style.append(nb);
    // its own sizes: this header and body scale on their own
    const size = (key, label) => {
      const r = document.createElement('label');
      r.className = 'slider-row block-size';
      const v = ensureBlockStyle(b)[key];
      r.innerHTML = `<span>${label}</span><input type="range" min="0.6" max="1.8" step="0.02" value="${v}" aria-label="Text box ${k + 1} ${key === 'h1Scale' ? 'header' : 'body'} scale"><output>${Math.round(v * 100)}%</output>`;
      const inp = r.querySelector('input'), out = r.querySelector('output');
      inp.addEventListener('input', () => { ensureBlockStyle(b)[key] = Number(inp.value); out.textContent = `${Math.round(inp.value * 100)}%`; draw(); });
      inp.addEventListener('change', () => save());
      inp.addEventListener('focus', () => { selected = `xb:${b.id}:${key === 'h1Scale' ? 'h1' : 'body'}`; draw(); });
      return r;
    };
    // its Light / Dark and panel first: each text has its own style
    row.append(head, showOnRow(`xb:${b.id}`), style, mk('h1', 2, 'Header'), size('h1Scale', 'Scale'), mk('body', 2, 'Body (optional)'), size('bodyScale', 'Scale'));
    const rst = document.createElement('button');
    rst.type = 'button';
    rst.className = 'link-btn text-reset';
    rst.textContent = 'Reset to default';
    rst.title = 'The brand’s style, colors, border and size for this text box — its words and position stay';
    rst.addEventListener('click', () => resetBlockToDefault(b.id));
    row.append(rst);
    host.append(row);
  });
  $('#blocks-empty').hidden = !!(state.blocks && state.blocks.length);
  // the Text style group styles the first text only once there are more
  const note = $('#text-style-note');
  if (note) note.hidden = !(state.blocks && state.blocks.length);
  syncColorRows(true);
}

function addBlock() {
  state.blocks = state.blocks || [];
  // the switches decide what shows: make sure a new header + body can be seen
  if (!showsH1() || !showsBody()) { state.textMode = 'both'; setVisibility(true, true); }
  const L = layout(ctx, state, canvas.width, canvas.height);
  const H = canvas.height;
  const bottoms = [L.tx.empty ? 0 : L.txRect.y + L.tx.h, ...(L.extras || []).map((x) => x.txRect.y + x.tx.h)];
  let y = Math.max(...bottoms) / H + 0.03;
  if (y > 0.78) y = 0.12;
  const id = Date.now().toString(36);
  state.blocks.push({ id, h1: 'Another header', body: 'And a line to go with it', x: 0.5, y, style: styleOf(state) });
  save();
  renderBlocks();
  selected = `xb:${id}:h1`;
  draw();
  focusBlockField(id, 'h1');
}

function removeBlock(id) {
  pushUndo('Text box removed');
  state.blocks = (state.blocks || []).filter((b) => b.id !== id);
  if (String(selected).startsWith(`xb:${id}:`)) selected = null;
  save();
  renderBlocks();
  draw();
}

function focusBlockField(id, part) {
  renderBlocks();
  const ta = document.querySelector(`#blk-${id} .block-${part}`);
  if (!ta) return;
  requestAnimationFrame(() => { ta.focus({ preventScroll: false }); ta.select(); });
}

function wireBlocks() {
  $('#blocks-add').addEventListener('click', addBlock);
  renderBlocks();
}

/* --- long-press on the preview ---------------------------------------------------
   Hold a finger on something in the preview (or right-click it) for a menu
   to hide it or take it off this screen, without hunting for its switch.
   Hide = the section's own switch (it comes back with its content); Remove =
   this screen only (its text, or its card). */
const LONG_PRESS_MS = 480;
let pressTimer = 0;
let pressAt = null;

function cancelLongPress() { clearTimeout(pressTimer); pressTimer = 0; pressAt = null; }

function canvasElementAt(e) {
  const h = hit(toCanvas(e));
  if (!h) return 'background';
  if (h.key === 'xblock') return `xb:${h.id}:${h.part === 'body' ? 'body' : 'h1'}`;
  if (h.key === 'button') return `bt:${h.id}`;
  if (h.key === 'media') return `md:${h.id}`;
  if (h.key === 'xbadge') return `eb:${h.id}`;
  return h.key === 'watermark' ? 'watermark' : h.key === 'inset' ? 'inset'
    : h.key === 'text' ? (h.part === 'body' ? 'body' : 'h1') : 'background';
}

function itemMenuFor(el) {
  const items = itemMenuBase(el);
  if (el && el !== 'background' && fsMode !== 'preview') {
    items.push({ icon: 'add', label: 'Multi select', sub: 'Tap other items to add them', run: () => startMultiMode(el) });
  }
  return items;
}

function itemMenuBase(el) {
  const sc = state.scenes[state.scene];
  if (String(el).startsWith('eb:')) {
    const id = el.slice(3);
    return [
      { icon: 'edit', label: 'Edit badge', run: () => { selectElement(el); revealBadgeItem(id); } },
      { icon: 'remove', label: 'Remove badge', danger: true, run: () => removeBadgeItem(id) },
    ];
  }
  if (String(el).startsWith('md:')) {
    const id = el.slice(3);
    return [
      { icon: 'edit', label: 'Edit media', run: () => { selectElement(el); revealMediaItem(id); } },
      { icon: 'remove', label: 'Remove media', danger: true, run: () => removeMediaItem(id) },
    ];
  }
  if (String(el).startsWith('bt:')) {
    const id = el.slice(3);
    return [
      { icon: 'edit', label: 'Edit button', run: () => { selectElement(el); revealButton(id, true); } },
      { icon: 'remove', label: 'Remove button', danger: true, run: () => removeButton(id) },
    ];
  }
  if (String(el).startsWith('xb:')) {
    const id = el.split(':')[1];
    return [
      { icon: 'edit', label: 'Edit this text', run: () => { selectElement(el); focusBlockField(id, el.split(':')[2]); } },
      { icon: 'remove', label: 'Remove this text block', danger: true, run: () => removeBlock(id) },
    ];
  }
  const where = state.scenes.length > 1 ? sceneName(sc, state.scene) : 'this section';
  const hide = (sel) => () => { const t = $(sel); if (t.checked) t.click(); selected = null; draw(); };
  const edit = (label) => ({ icon: 'edit', label, run: () => selectElement(el) });
  if (el === 'h1' || el === 'body') {
    const name = el === 'h1' ? (roleFor(sc) === 'cta' ? 'call to action' : roleFor(sc) === 'hook' ? 'hook' : 'header') : 'body';
    const items = [edit(`Edit ${name}`)];
    items.push({ icon: 'hide', label: 'Hide text', sub: 'On this section — the Text switch brings it back', run: () => { setVisibility(false, false); selected = null; draw(); } });
    items.push({ icon: 'remove', label: `Remove from ${where}`, sub: `Clears this section’s ${name} text`, danger: true, run: () => clearText(el) });
    return items;
  }
  if (el === 'watermark') {
    return [edit('Edit badge'), { icon: 'hide', label: 'Hide badge', sub: 'On this section — its switch brings it back', run: hide('#tg-badge') }];
  }
  if (el === 'inset') {
    return [
      edit('Edit media'),
      { icon: 'hide', label: 'Hide media', sub: 'Keeps it — its switch brings it back', run: hide('#tg-inset') },
      { icon: 'remove', label: `Remove from ${where}`, danger: true, run: removeSceneCard },
    ];
  }
  const items = [edit('Edit background')];
  if (!isBase(state.scene) && sc.bg) items.push({ icon: 'rewind', label: 'Use the first section’s background', run: matchHook });
  return items;
}

function clearText(el) {
  pushUndo(el === 'h1' ? 'Header removed' : 'Body removed');
  if (el === 'h1') { state.h1 = ''; $('#in-h1').value = ''; }
  else { state.body = ''; $('#in-body').value = ''; }
  commitScene();
  selected = null;
  save();
  renderScenes();
  draw();
}

/** Take the card off this screen; the file is deleted only when nothing else shows it. */
async function removeSceneCard() {
  pushUndo('Media removed');
  const id = state.inset.id;
  state.inset.id = null;
  state.inset.hidden = true;
  commitScene();
  // the file goes once the removal can no longer be undone
  if (id && !cardInUse(id)) setTimeout(() => { if (!cardInUse(id) && !undoStack.some((u) => JSON.stringify(u.data).includes(id))) removeUpload(id); }, 9000);
  selected = null;
  save();
  syncSceneCard();
  syncImageControls();
  draw();
}

const cardInUse = (id) => (state.scenes || []).some((sc, i) => i !== state.scene && sc.inset && sc.inset.id === id)
  || (state.media || []).some((m) => m.src === id) || (state.scenes || []).some((sc, i) => i !== state.scene && (sc.media || []).some((m) => m.src === id))
  || state.backdrop === id || state.sharedBg === id || (state.scenes || []).some((sc) => sc.bg === id);

function openItemMenu(el, x, y) {
  selected = el;
  draw();
  const anchor = { getBoundingClientRect: () => ({ left: x - 1, right: x + 1, top: y - 6, bottom: y + 6, width: 2, height: 12 }) };
  openMenuAt(anchor, itemMenuFor(el), 'Item options');
  clipMenuFor = -4;
}

canvas.addEventListener('pointerdown', (e) => {
  cancelLongPress();
  if (e.button > 0 || editor) return;
  pressAt = { x: e.clientX, y: e.clientY, el: canvasElementAt(e) };
  pressTimer = setTimeout(() => {
    if (!pressAt || (dragging && dragging.moved)) return;
    const { x, y, el } = pressAt;
    cancelLongPress();
    // the press becomes the menu, not a tap or a drag
    dragging = null;
    canvas.classList.remove('dragging');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
    openItemMenu(el, x, y);
  }, LONG_PRESS_MS);
});
canvas.addEventListener('pointermove', (e) => {
  if (pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 8) cancelLongPress();
});
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(t, cancelLongPress);
// right-click is the desktop's long-press; and no system callout on a phone
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) return;
  if (editor) return;
  openItemMenu(canvasElementAt(e), e.clientX, e.clientY);
});

/* Bring a panel section into view and flash it, so a tap on the preview
   always lands you on the controls for what you tapped. On a phone the
   sticky preview covers the top of the page, so the section stops below it. */
function revealGroup(sel) {
  const g = $(sel);
  if (!g || g.hidden || g.offsetParent === null) return;
  const inSheet = g.closest('#section-sheet-body');
  if (inSheet && !isPhone()) return;     // the open section sits right under the buttons, already in view
  if (inSheet) {
    // in the phone's sheet: scroll the sheet, not the page
    const top = g.getBoundingClientRect().top - inSheet.getBoundingClientRect().top + inSheet.scrollTop - 4;
    if (Math.abs(inSheet.scrollTop - top) > 4 && top > 4) inSheet.scrollTo({ top, behavior: 'smooth' });
    return;
  }
  const stage = document.querySelector('.stage');
  const sticky = stage && getComputedStyle(stage).position === 'sticky';
  const bar = $('#edit-tabs');
  const barSticky = bar && getComputedStyle(bar).position === 'sticky';
  const top = (sticky ? stage.getBoundingClientRect().bottom : 0) + (barSticky ? bar.offsetHeight : 0) + 12;
  document.documentElement.style.setProperty('--reveal-top', `${Math.round(top)}px`);
  // with a tab chosen and the bar scrolling with the page, show the bar with its section under it
  const target = !barSticky && activeTab !== 'all' && bar ? bar : g;
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (sticky) {
    // the page scrolls (phone): put the target just under the sticky preview
    window.scrollBy({ top: target.getBoundingClientRect().top - top, behavior });
  } else target.scrollIntoView({ behavior, block: 'start' });
  document.querySelectorAll('.group.is-revealed').forEach((x) => x.classList.remove('is-revealed'));
  void g.offsetWidth;                 // restart the flash
  g.classList.add('is-revealed');
  clearTimeout(revealGroup.t);
  revealGroup.t = setTimeout(() => g.classList.remove('is-revealed'), 1400);
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { if (!dragging && hovering) { hovering = false; draw(); } });

/* --- editing text in place ------------------------------------------------
   A textarea laid exactly over the tapped block, in the same face, size and
   colour, while the canvas leaves that block out. It writes to the same
   state as the panel fields, so the two always agree. Enter makes a new
   line, as in the panel; Esc puts the text back; anything else that takes
   focus away — a click elsewhere, Tab, a drag — keeps the edit.
   ------------------------------------------------------------------------ */

let editor = null;   // { key, el, original }

const FIELD = { h1: '#in-h1', body: '#in-body' };

function openEditor(key, pointerType) {
  if (editor) closeEditor(true);
  const el = document.createElement('textarea');
  el.className = 'canvas-editor';
  el.rows = 1;
  el.spellcheck = true;
  el.setAttribute('aria-label', key === 'h1' ? 'Header text' : 'Body text');
  el.value = state[key];
  editor = { key, el, original: state[key], touch: pointerType === 'touch' };
  $('.stage-inner').append(el);

  el.addEventListener('input', () => {
    state[key] = el.value;
    $(FIELD[key]).value = el.value;
    save();
    draw();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEditor(false); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); closeEditor(true); }
  });
  el.addEventListener('blur', () => { if (editor && editor.el === el) closeEditor(true); });

  paint();                       // hide the block on canvas and place the editor
  selDelSig = ''; syncSelDelete();
  el.focus({ preventScroll: true });
  const toEnd = () => el.setSelectionRange(el.value.length, el.value.length);
  toEnd();
  // A finger tap ends in a click on whatever is now under it — the editor —
  // which would drop the caret wherever the finger was. When the editor has
  // grown it no longer lines up with that spot, so keep the caret at the end.
  if (editor.touch) {
    el.addEventListener('click', toEnd, { once: true });
    setTimeout(() => el.removeEventListener('click', toEnd), 400);
  }
}

function closeEditor(keep) {
  const ed = editor;
  if (!ed) return;
  editor = null;
  if (!keep) {
    state[ed.key] = ed.original;
    $(FIELD[ed.key]).value = ed.original;
  }
  ed.el.remove();
  save();
  syncImageControls();
  draw();
}

function placeEditor() {
  const L = lastLayout;
  const r = L && L.parts[editor.key];
  if (!r) { closeEditor(true); return; }   // emptied out of existence
  const f = L.tx.f[editor.key];
  const cr = canvas.getBoundingClientRect();
  const hr = $('.stage-inner').getBoundingClientRect();
  const k = cr.width / canvas.width;

  // On a phone the preview is small; under 16px iOS zooms the whole page
  // into the field, so the editor grows to 16px and simply runs taller.
  let size = f.size * k;
  const min = editor.touch || matchMedia('(pointer: coarse)').matches ? 16 : 0;
  const boost = size < min ? min / size : 1;
  size *= boost;

  const s = editor.el.style;
  const floating = boost > 1;
  editor.el.classList.toggle('is-floating', floating);
  // Enlarged for a phone it no longer fits the block it covers, so it floats
  // as a solid card at least as wide as the text, kept on screen.
  const hostW = hr.width;
  const w = floating ? Math.min(Math.max(r.w * k, 240), hostW - 16) : r.w * k;
  let left = cr.left - hr.left + r.x * k;
  if (floating) left = Math.max(8, Math.min(left - (w - r.w * k) / 2, hostW - w - 8 - 20));
  s.left = `${left}px`;
  s.top = `${cr.top - hr.top + r.y * k}px`;
  s.width = `${w}px`;
  s.font = f.css(size);
  s.lineHeight = `${f.size * f.lh * k * boost}px`;
  s.color = floating ? '' : L.colors[editor.key];
  s.height = 'auto';
  s.height = `${floating ? editor.el.scrollHeight + 2 : Math.max(editor.el.scrollHeight, r.h * k)}px`;
}

window.addEventListener('resize', () => { if (editor) placeEditor(); });

/* --- export -------------------------------------------------------------- */

function exportImage(type, scale) {
  const f = FORMATS[state.format];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale;
  cv.height = f.h * scale;
  const g = cv.getContext('2d');

  if (type === 'image/jpeg') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cv.width, cv.height);
  }
  render(g, cv.width, cv.height, state, {});

  const ext = type === 'image/png' ? 'png' : 'jpg';
  const name = `${exportSlug()}-${f.w * scale}x${f.h * scale}.${ext}`;
  cv.toBlob((blob) => downloadBlob(blob, name), type, type === 'image/jpeg' ? 0.92 : undefined);
}

/* The badge Scale slider runs from 25 % up to where the badge would fill the
   frame — further for a small round portrait than for a wide lockup, and per
   format. Checked from the paint loop; only touches the slider when it changes. */
let badgeMaxSig = '';
function syncBadgeScaleRange() {
  const el = $('#badge-scale');
  if (!el || state.badge === 'none') return;
  const f = FORMATS[state.format];
  const sig = `${state.badge}|${state.backdrop}|${state.format}|${state.brand}`;
  if (sig === badgeMaxSig) return;
  let max;
  try { max = badgeScaleMax(state, f.w, f.h); } catch (_) { return; }
  if (!max) return;
  badgeMaxSig = sig;
  max = Math.floor(max * 50) / 50;          // on the slider's 2 % steps
  el.min = '0.25';
  el.max = String(max);
  if (state.badgeScale > max + 1e-6) {
    state.badgeScale = max;
    save();
  }
  el.value = state.badgeScale;
  $('#badge-scale-out').textContent = `${Math.round(state.badgeScale * 100)}%`;
}

/* A heads-up for heavy clips: over 120 MB or above 1080p, the browser decodes
   every frame live while drawing the design and recording, which can stutter on
   phones. The upload still goes ahead (the limit is 200 MB, in store.js). */
function wireBigClipNote() {
  const check = (file) => {
    if (!file || !/^video\//.test(file.type)) return;
    const big = file.size > 120 * 1024 * 1024;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (hi) => {
      URL.revokeObjectURL(url);
      if (!big && !hi) return;
      const why = big && hi ? 'Large, high-resolution clip' : big ? 'Large clip' : 'High-resolution clip';
      showToast(`${why} — playback and export may stutter on phones; 1080p works best`, null, null, 8000);
    };
    v.onloadedmetadata = () => done(Math.min(v.videoWidth, v.videoHeight) > 1080);
    v.onerror = () => done(false);
    v.src = url;
  };
  for (const id of ['#file-input', '#inset-input', '#media-more-input']) {
    const el = $(id);
    if (el) el.addEventListener('change', () => { for (const f of el.files || []) check(f); }, true);
  }
}

/* --- text back to default --------------------------------------------------------
   "Reset to default" under the text Style, and on every text box: the brand's
   text style for this section (its Light / Dark and panel), no own colours, no
   border, 100 % sizes. The words and where the text sits are kept. Undo
   brings the previous look back. */
function textDefaults() {
  const st = (activeBrand() && activeBrand().starter) || {};
  return {
    textTone: st.textTone === 'dark' ? 'dark' : 'light',
    card: st.card !== false,
    textColors: { h1: null, body: null },
    cardColors: { h1: null, body: null },
    borders: { h1: { w: 0, c: null }, body: { w: 0, c: null } },
    h1Scale: 1,
    bodyScale: 1,
  };
}

function resetTextToDefault() {
  commitScene();
  pushUndo('Text back to default');
  Object.assign(state, clone(textDefaults()));
  delete state.scale;                       // the old shared size, if a design still has one
  $('#tg-card').checked = state.card;
  syncSegments('#seg-tone', 't', 'textTone');
  syncScaleOutputs();
  commitScene();
  save();
  syncToneCustom();
  syncColorRows(true);
  renderBlocks();
  draw();
}

function resetBlockToDefault(id) {
  const b = blockById(id);
  if (!b) return;
  commitScene();
  pushUndo('Text box back to default');
  b.style = clone(textDefaults());
  commitScene();
  save();
  renderBlocks();
  syncColorRows(true);
  draw();
}

function wireTextReset() {
  const btn = $('#text-reset');
  if (btn) btn.addEventListener('click', resetTextToDefault);
}

/* --- clear a section ------------------------------------------------------------
   Empties one section: its text (and text boxes), buttons, media and badge go;
   its background, Darken, sound and duration stay. The section itself stays in
   the timeline. Undo (toast or ⌘Z) brings everything back. */
function sectionHasContent(i) {
  const sc = state.scenes && state.scenes[i];
  if (!sc) return false;
  if (i === state.scene) commitScene();
  const txt = sc.visibility !== 'none' && (String(sc.h1 || '').trim() || String(sc.body || '').trim());
  return !!(txt || (sc.blocks && sc.blocks.length) || (sc.buttons && sc.buttons.length)
    || (sc.media && sc.media.length) || (sc.badges && sc.badges.length) || (sc.inset && sc.inset.id && !sc.inset.hidden)
    || (sc.badge && sc.badge !== 'none'));
}

/* --- tidy up ----------------------------------------------------------------------
   One tap puts the section in order, for the format on screen: everything in one
   centred column inside the safe area, in the order it already has from top to
   bottom, with even gaps. Badges, buttons and media that sit next to each other
   in that order share a row when they fit side by side (spread evenly, centred);
   text always has a row of its own. Nothing is resized. Undo puts it back. */
function tidySectionRaw() {
  const W = canvas.width, H = canvas.height;
  const sa = safeArea(state.format, W, H);
  const pos = state.pos[state.format];
  if (!pos.inset) pos.inset = { x: 0.5, y: 0.5 };
  const hgap = W * 0.03, gapMin = H * 0.012, gapMax = H * 0.045;
  const sc = (v, k, lo, hi) => Math.max(lo, Math.min(hi, Math.round((Number(v) || 1) * k * 100) / 100));
  // what is on the section: its box now, where its position lives, and how to make it smaller
  const collect = () => {
    const L = layout(ctx, state, W, H);
    const items = [];
    const add = (kind, r, target, shrink) => { if (r && r.w > 0 && r.h > 0 && target) items.push({ kind, r: { x: r.x, y: r.y, w: r.w, h: r.h }, target, shrink }); };
    if (L.wm.image) add('badge', L.wmRect, pos.watermark, (k) => { state.badgeScale = sc(state.badgeScale, k, 0.25, 4); });
    for (const b of L.xbadges || []) { const t = badgeItemById(b.id); add('badge', b.rect, t, (k) => { t.scale = sc(t.scale, k, 0.25, 4); }); }
    if (!L.tx.empty) add('text', { ...L.txRect, h: L.tx.h }, pos.text, (k) => { state.h1Scale = clampScale(state.h1Scale * k); state.bodyScale = clampScale(state.bodyScale * k); });
    for (const x of L.extras || []) {
      const t = (state.blocks || []).find((b) => b.id === x.id);
      add('text', { ...x.txRect, h: x.tx.h }, t, (k) => { const st = ensureBlockStyle(t); st.h1Scale = clampScale((st.h1Scale || 1) * k); st.bodyScale = clampScale((st.bodyScale || 1) * k); });
    }
    if (L.ins.image) add('media', { ...L.insRect, h: L.ins.h }, pos.inset, (k) => { state.inset.scale = sc(state.inset.scale, k, 0.2, 1.6); });
    for (const m of L.media || []) { const t = mediaItemById(m.id); add('media', { ...m.insRect, h: m.ins.h }, t, (k) => { t.scale = sc(t.scale, k, 0.2, 1.6); }); }
    for (const b of L.buttons || []) { const t = buttonById(b.id); add('button', b.rect, t, (k) => { t.look = t.look || CTA_LOOK(); t.look.scale = sc(t.look.scale, k, 0.5, 2); }); }
    // the order it has now, top to bottom (left to right on a tie)
    items.sort((a, b) => (a.r.y + a.r.h / 2) - (b.r.y + b.r.h / 2) || a.r.x - b.r.x);
    return items;
  };
  // rows: text on its own; neighbours of the same kind side by side while they fit
  const rowsOf = (items) => {
    const rows = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row && row.kind === it.kind && it.kind !== 'text' && row.w + hgap + it.r.w <= sa.w) {
        row.items.push(it); row.w += hgap + it.r.w; row.h = Math.max(row.h, it.r.h);
      } else rows.push({ kind: it.kind, items: [it], w: it.r.w, h: it.r.h });
    }
    return rows;
  };

  let items = collect();
  if (!items.length) { showToast('Nothing to tidy on this section'); return false; }
  pushUndo('Section tidied');
  // too much for the safe area, even with tight gaps: make it all a little smaller and measure again
  let shrunk = false;
  for (let pass = 0; pass < 5; pass++) {
    const rows = rowsOf(items);
    const need = rows.reduce((t, r) => t + r.h, 0) + gapMin * (rows.length - 1);
    if (need <= sa.h) break;
    const k = Math.max(0.6, (sa.h - gapMin * (rows.length - 1)) / (need - gapMin * (rows.length - 1))) * 0.98;
    for (const it of items) it.shrink(k);
    shrunk = true;
    items = collect();
  }
  const rows = rowsOf(items);
  const total = rows.reduce((t, r) => t + r.h, 0);
  const n = rows.length;
  // even gaps: generous when there is room, tighter when it is full
  const gap = n > 1 ? Math.max(gapMin, Math.min(gapMax, (sa.h - total) / (n - 1))) : 0;
  const stack = total + gap * (n - 1);
  let top = sa.y + Math.max(0, (sa.h - stack) / 2);
  const goals = new Map();          // where each item's box goes
  for (const row of rows) {
    let x = sa.x + (sa.w - row.w) / 2;
    for (const it of row.items) {
      goals.set(it.target, { x, y: top + (row.h - it.r.h) / 2 });
      x += it.r.w + hgap;
    }
    top += row.h + gap;
  }
  settle(goals, () => collect().map((it) => [it.target, it.r]));
  markEdited();
  commitScene();
  save();
  syncScaleOutputs();
  renderBlocks(); renderButtons(); renderMediaItems(); renderBadgeItems();
  syncBadgeControls();
  syncInsetControls();
  syncSectionValues(true);
  draw();
  if (shrunk) showToast('Tidied — made smaller to fit', 'Undo', undoLast);
  return true;
}

/** Moves each item's box to its goal ({x, y} in canvas pixels, by position target).
    A box is drawn kept inside the frame, so an item that started outside it isn't
    where its position says: move, measure again, and correct until it lands. */
function settle(goals, measure) {
  const W = canvas.width, H = canvas.height;
  for (let pass = 0; pass < 4; pass++) {
    let off = 0;
    for (const [t, r] of measure()) {
      const g = goals.get(t);
      if (!g || !r) continue;
      const dx = g.x - r.x, dy = g.y - r.y;
      off = Math.max(off, Math.abs(dx), Math.abs(dy));
      t.x += dx / W;
      t.y += dy / H;
    }
    if (off < 0.5) break;
  }
}

/* --- show on several sections -------------------------------------------------------
   Every button, text box, media item and badge (the section's own badge and media
   too) has a "Show on" row of section chips in its card: tap a section to put the
   item there or take it off, All for every section (and the ones added later).
   Copies of one item share its id and stay linked: an edit on any section reaches
   every section it is on, except where it sits: each section keeps its own position
   (layouts differ from section to section). Put on a section, an item keeps its spot
   when that is free there, or moves to the nearest free one. The section being
   edited is always on; its trash button takes the item off this section only. */
const LINK_LISTS = { bt: 'buttons', xb: 'blocks', md: 'media', eb: 'badges' };
const OWN_LINKS = {
  watermark: {
    keys: ['badge', 'badgeLast', 'badgeScale', 'badgePowered', 'badgeImage', 'badgeLower', 'badgeUpper', 'badgeMiddle', 'badgeShape', 'badgeHalo'],
    pos: 'watermark', flag: 'badgeLinked',
    off: (sc) => { if (sc.badge && sc.badge !== 'none') sc.badgeLast = sc.badge; sc.badge = 'none'; },
  },
  inset: {
    keys: ['inset'], pos: 'inset', flag: 'insetLinked',
    off: (sc) => { sc.inset = { ...(sc.inset || NO_CARD()), hidden: true }; },
  },
};
const linkKind = (key) => (OWN_LINKS[key] ? key : LINK_LISTS[String(key).slice(0, 2)] ? String(key).slice(0, 2) : null);

/** Which sections an item is on (indexes). The section being edited always counts. */
function showOnSections(key) {
  const i = state.scene;
  if (OWN_LINKS[key]) {
    const L = OWN_LINKS[key];
    const here = state.scenes[i];
    if (!here || !here[L.flag]) return [i];
    return state.scenes.map((sc, j) => (j === i || sc[L.flag] ? j : -1)).filter((j) => j >= 0);
  }
  const list = LINK_LISTS[key.slice(0, 2)], id = key.slice(3);
  const it = (state[list] || []).find((x) => x.id === id);
  if (!it || !it.linked) return [i];
  return state.scenes.map((sc, j) => (j === i || (sc[list] || []).some((x) => x.id === id && x.linked) ? j : -1)).filter((j) => j >= 0);
}

/** Put an item on section j or take it off ('all': every section, or back to this one). */
function toggleShowOn(key, j) {
  commitScene();
  const i = state.scene;
  const n = state.scenes.length;
  const on = new Set(showOnSections(key));
  let want;
  if (j === 'all') want = on.size === n ? new Set([i]) : new Set(state.scenes.map((_, k) => k));
  else {
    if (j === i) return;                          // the section being edited is always on
    want = new Set(on);
    if (want.has(j)) want.delete(j); else want.add(j);
  }
  const everywhere = want.size === n;
  const name = (k) => sceneName(state.scenes[k], k);
  const added = [...want].filter((k) => !on.has(k)), removed = [...on].filter((k) => !want.has(k));
  pushUndo(added.length === 1 && !removed.length ? `Shown on ${name(added[0])}`
    : removed.length === 1 && !added.length ? `Taken off ${name(removed[0])}`
    : everywhere ? 'Shown on every section' : 'Only on this section');
  const here = state.scenes[i];
  const linked = want.size > 1;
  if (OWN_LINKS[key]) {
    const L = OWN_LINKS[key];
    state.scenes.forEach((sc, k) => {
      if (k === i) return;
      if (want.has(k) && on.has(k)) sc[L.flag] = everywhere ? 'all' : true;
      else if (want.has(k)) {
        for (const p of L.keys) sc[p] = clone(here[p] === undefined ? null : here[p]);
        sc.pos = sc.pos || clone(DEFAULT_POS);
        for (const [fmt, ps] of Object.entries(here.pos || {})) if (ps && ps[L.pos]) { sc.pos[fmt] = sc.pos[fmt] || {}; sc.pos[fmt][L.pos] = clone(ps[L.pos]); }
        sc[L.flag] = everywhere ? 'all' : true;
      } else if (on.has(k)) { delete sc[L.flag]; L.off(sc); }
    });
    if (linked) here[L.flag] = everywhere ? 'all' : true; else delete here[L.flag];
  } else {
    const list = LINK_LISTS[key.slice(0, 2)], id = key.slice(3);
    const src = (state[list] || []).find((x) => x.id === id);
    if (!src) return;
    if (linked) { src.linked = true; if (everywhere) src.share = 'all'; else delete src.share; }
    else { delete src.linked; delete src.share; }
    state.scenes.forEach((sc, k) => {
      if (k === i) return;
      const arr = sc[list] = sc[list] || [];
      const at = arr.findIndex((x) => x.id === id);
      if (want.has(k) && !on.has(k)) { const copy = clone(src); delete copy.tpl; if (at >= 0) arr[at] = copy; else arr.push(copy); }
      else if (want.has(k) && at >= 0) { arr[at].linked = true; if (everywhere) arr[at].share = 'all'; else delete arr[at].share; }
      else if (at >= 0 && on.has(k)) arr.splice(at, 1);
    });
    commitScene();
  }
  for (const k of added) if (k !== i) placeClear(k, key);
  save();
  refreshShowOn();
  draw();
}

/** On section k, moves the item to the nearest free spot (this format) if it lands on something. */
function placeClear(k, key) {
  inSandbox(() => {
    state.scene = k;
    loadScene(k);
    const { w: W, h: H } = FORMATS[state.format];
    const L = layout(ctx, state, W, H);
    const r = multiRect(key, L), t = multiTarget(key);
    if (!r || !t) return;
    const others = ['watermark', 'text', 'inset',
      ...(L.xbadges || []).map((b) => `eb:${b.id}`), ...(L.buttons || []).map((b) => `bt:${b.id}`),
      ...(L.media || []).map((m) => `md:${m.id}`), ...(L.extras || []).map((x) => `xb:${x.id}`)]
      .filter((o) => o !== key).map((o) => multiRect(o, L)).filter(Boolean);
    const gap = H * 0.012;
    const hits = (y) => others.some((o) => y < o.y + o.h + gap && y + r.h > o.y - gap && r.x < o.x + o.w && r.x + r.w > o.x);
    if (!hits(r.y)) return;
    const sa = safeArea(state.format, W, H);
    const spots = [];
    for (let y = sa.y; y + r.h <= sa.y + sa.h; y += H * 0.01) spots.push(y);
    spots.sort((a, b) => Math.abs(a - r.y) - Math.abs(b - r.y));
    const y = spots.find((v) => !hits(v));
    if (y == null) return;                       // nowhere free: it stays, to be moved by hand
    t.y += (y - r.y) / H;
    // write it into the section itself (the sandbox is thrown away)
    const sc = state.scenes[k];
    if (OWN_LINKS[key]) { sc.pos = clone(state.pos); return; }
    const list = LINK_LISTS[key.slice(0, 2)];
    const own = (sc[list] || []).find((x) => x.id === key.slice(3));
    if (own) own.y = t.y;
  });
}

/** After an edit on this section: the same edit on every section a linked item is on. */
function propagateLinked() {
  return false;                 // "Show on" was removed: every section's item is its own again
  /* eslint-disable no-unreachable */
  if (sequencing || !Array.isArray(state.scenes)) return false;
  const i = state.scene, here = state.scenes[i];
  if (!here) return false;
  let changed = false;
  for (const list of Object.values(LINK_LISTS)) {
    for (const it of here[list] || []) {
      if (!it.linked) continue;
      state.scenes.forEach((sc, k) => {
        if (k === i) return;
        const arr = sc[list] || [];
        const at = arr.findIndex((x) => x.id === it.id && x.linked);
        if (at < 0) return;
        const next = { ...clone(it), x: arr[at].x, y: arr[at].y };
        if (arr[at].tpl) next.tpl = arr[at].tpl; else delete next.tpl;
        if (arr[at].at) next.at = arr[at].at; else delete next.at;
        if (JSON.stringify(arr[at]) !== JSON.stringify(next)) { arr[at] = next; changed = true; }
      });
    }
  }
  for (const L of Object.values(OWN_LINKS)) {
    if (!here[L.flag]) continue;
    state.scenes.forEach((sc, k) => {
      if (k === i || !sc[L.flag]) return;
      for (const p of L.keys) {
        const v = JSON.stringify(here[p] === undefined ? null : here[p]);
        if (JSON.stringify(sc[p] === undefined ? null : sc[p]) !== v) { sc[p] = JSON.parse(v); changed = true; }
      }
    });
  }
  return changed;
}

/** A new section gets what is on every section and marked for all. */
function carryShared(sc) {
  return;                       // nothing is shared across sections any more
  /* eslint-disable no-unreachable */
  const others = state.scenes.filter((x) => x !== sc);
  if (!others.length) return;
  for (const list of Object.values(LINK_LISTS)) {
    for (const it of others[0][list] || []) {
      if (!it.linked || it.share !== 'all') continue;
      if (!others.every((o) => (o[list] || []).some((x) => x.id === it.id && x.linked))) continue;
      sc[list] = sc[list] || [];
      if (!sc[list].some((x) => x.id === it.id)) sc[list].push(clone(it));
    }
  }
  for (const L of Object.values(OWN_LINKS)) {
    const src = others.find((o) => o[L.flag] === 'all');
    if (!src || !others.every((o) => o[L.flag])) continue;
    for (const p of L.keys) sc[p] = clone(src[p] === undefined ? null : src[p]);
    sc.pos = sc.pos || clone(DEFAULT_POS);
    for (const [fmt, ps] of Object.entries(src.pos || {})) if (ps && ps[L.pos]) { sc.pos[fmt] = sc.pos[fmt] || {}; sc.pos[fmt][L.pos] = clone(ps[L.pos]); }
    sc[L.flag] = 'all';
  }
}

/** Show on is gone: drop every link, so an edit stays on its own section.
    Linked copies become ordinary items, each where it already sits. */
function unlinkAll(st = state) {
  const lists = Object.values(LINK_LISTS);
  const strip = (o) => {
    if (!o) return;
    for (const list of lists) for (const it of o[list] || []) { delete it.linked; delete it.share; }
    for (const L of Object.values(OWN_LINKS)) delete o[L.flag];
  };
  strip(st);
  for (const sc of st.scenes || []) strip(sc);
  for (const d of Object.values(st.designs || {})) { strip(d); for (const sc of (d && d.scenes) || []) strip(sc); }
}

/** The "Show on" row for an item's card (nothing while there is one section). */
function showOnRow(key) {
  // "Show on" was removed (Marco found it confusing); cards keep their layout without it
  const row = document.createElement('div');
  row.className = 'show-on';
  row.hidden = true;
  return row;
}
function fillShowOn(row) {
  const key = row.dataset.key;
  row.innerHTML = '';
  const n = (state.scenes || []).length;
  row.hidden = n < 2;
  if (n < 2) return;
  const on = new Set(showOnSections(key));
  const lbl = document.createElement('span');
  lbl.className = 'show-on-lbl';
  lbl.textContent = on.size > 1 ? `Show on · ${on.size} of ${n}` : 'Show on';
  const chips = document.createElement('div');
  chips.className = 'show-on-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Sections this is shown on');
  const chip = (label, pressed, run, here) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'show-chip' + (here ? ' is-here' : '');
    b.textContent = label;
    b.setAttribute('aria-pressed', String(pressed));
    if (here) { b.title = 'The section you are editing'; b.setAttribute('aria-disabled', 'true'); }
    b.addEventListener('click', (e) => { e.stopPropagation(); run(); });
    chips.append(b);
  };
  state.scenes.forEach((sc, j) => chip(sceneName(sc, j), on.has(j), () => toggleShowOn(key, j), j === state.scene));
  chip('All', on.size === n, () => toggleShowOn(key, 'all'), false);
  chips.lastChild.classList.add('is-all');
  row.append(lbl, chips);
}
function refreshShowOn() {
  for (const row of document.querySelectorAll('.show-on[data-key]')) fillShowOn(row);
}
/** The section's own badge and media: their rows live in the Badge and Media groups. */
function syncOwnShowOn() {
  for (const h of ['#badge-showon', '#inset-showon']) if ($(h)) $(h).innerHTML = '';
  return;
  /* eslint-disable no-unreachable */
  for (const [host, key] of [['#badge-showon', 'watermark'], ['#inset-showon', 'inset']]) {
    const h = $(host);
    if (!h) continue;
    if (!h.firstChild) h.append(showOnRow(key)); else fillShowOn(h.firstChild);
  }
}
/** "On 3 sections" under the selection on the preview, for a shared item. */
function selectionNote() {
  return null;
  /* eslint-disable no-unreachable */
  if (!selected || selected === 'background' || !Array.isArray(state.scenes) || state.scenes.length < 2) return null;
  const k = String(selected).startsWith('xb:') ? `xb:${String(selected).split(':')[1]}` : selected;
  if (!linkKind(k)) return null;
  const n = showOnSections(k).length;
  return n > 1 ? (n === state.scenes.length ? 'On every section' : `On ${n} sections`) : null;
}

/* --- the order of the sections ---------------------------------------------------
   Drag a clip along the timeline (on touch: hold it first, then drag) or use
   Move earlier / later in its menu. Backgrounds stay with their section; the first
   section's background is the one new sections share. Undo puts it back. */
function moveScene(from, to) {
  const n = state.scenes.length;
  if (to === from || to < 0 || to >= n || from < 0 || from >= n) return;
  stopPlayback();
  if (editor) closeEditor(true);
  commitScene();
  pushUndo(`${sceneName(state.scenes[from], from)} moved`);
  const current = state.scenes[state.scene];
  // what each section shows now, written into the section itself
  const eff = state.scenes.map((sc, i) => {
    const bg = isBase(i) ? state.sharedBg : (sc.bg && byId(sc.bg).id === sc.bg ? sc.bg : sharedFor());
    const ov = clone((!isBase(i) && sc.overlay) || state.sharedOverlay || { style: 'none', strength: 0.3 });
    const a = sceneAdjust(sc, bg);
    if (a) { sc.adj = sc.adj || {}; sc.adj[bg] = clone(a); }
    return { sc, bg, ov };
  });
  const [moved] = eff.splice(from, 1);
  eff.splice(to, 0, moved);
  state.scenes = eff.map((e) => e.sc);
  const still = sharedStillBg();
  state.sharedBg = eff[0].bg;
  state.sharedStill = isVideoBg(eff[0].bg) ? still : eff[0].bg;
  state.sharedOverlay = clone(eff[0].ov);
  eff.forEach((e, i) => {
    if (i === 0) { e.sc.bg = null; e.sc.overlay = null; return; }
    e.sc.bg = isSharedBg(e.bg) ? null : e.bg;
    e.sc.overlay = sameOverlay(e.ov, state.sharedOverlay) ? null : clone(e.ov);
  });
  state.scene = state.scenes.indexOf(current);
  loadScene(state.scene);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  if (musicFits() || beatSync()) applySoundTiming();
  save();
  renderScenes();
  renderMusicBar();
  syncThumbs();
  syncImageControls();
  syncSceneCard();
  draw();
}

/* Dragging a clip: it lifts and follows the pointer; a line shows where it lands. */
let clipDrag = null;
function startClipDrag(i, clip, e, pick) {
  closeClipMenu();
  const host = $('#scenes');
  const clips = [...host.querySelectorAll('.clip')];
  clipDrag = {
    i, clip, x0: e.clientX, target: i, pointerId: e.pointerId, scroll0: $('#tl-scroll').scrollLeft,
    mids: clips.map((c) => c.offsetLeft + c.offsetWidth / 2), lefts: clips.map((c) => c.offsetLeft),
    rights: clips.map((c) => c.offsetLeft + c.offsetWidth), w: clip.offsetWidth, left: clip.offsetLeft,
  };
  try { pick.setPointerCapture(e.pointerId); } catch (_) {}
  clip.classList.add('is-lifting');
  document.documentElement.classList.add('is-clip-drag');
  let mark = $('#tl-drop');
  if (!mark) { mark = document.createElement('div'); mark.id = 'tl-drop'; mark.className = 'tl-drop'; host.append(mark); }
  mark.hidden = true;
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
}
function moveClipDrag(e) {
  const d = clipDrag;
  if (!d) return;
  const sc = $('#tl-scroll');
  // near an edge, the timeline scrolls along
  const box = sc.getBoundingClientRect();
  if (e.clientX < box.left + 36) sc.scrollLeft -= 10;
  else if (e.clientX > box.right - 36) sc.scrollLeft += 10;
  const dx = e.clientX - d.x0 + (sc.scrollLeft - d.scroll0);
  d.clip.style.transform = `translateX(${dx}px)`;
  const mid = d.left + d.w / 2 + dx;
  let t = 0;
  d.mids.forEach((m, k) => { if (k !== d.i && m < mid) t++; });
  d.target = t;
  const mark = $('#tl-drop');
  if (!mark) return;
  mark.hidden = t === d.i;
  // the line sits in the gap the clip would drop into
  const others = d.mids.map((_, k) => k).filter((k) => k !== d.i);
  const x = t === 0 ? d.lefts[others[0]] - 4 : d.rights[others[t - 1]] + 1;
  mark.style.left = `${x}px`;
}
function endClipDrag(commit) {
  const d = clipDrag;
  clipDrag = null;
  document.documentElement.classList.remove('is-clip-drag');
  if (!d) return;
  const mark = $('#tl-drop');
  if (mark) mark.remove();
  d.clip.classList.remove('is-lifting');
  d.clip.style.transform = '';
  if (commit && d.target !== d.i) moveScene(d.i, d.target);
}

/* --- start screen ------------------------------------------------------------------
   Opening the studio lands here: CONTINUE what you were making, or CREATE something
   new. It is a view onto what the studio already keeps, never a second store:
     Recent — the design open now, your other brands' working designs (state.designs),
              and the designs you had before (the newest HOME_RECENT_MAX "recent"
              entries in the saved-designs list, each with its thumbnail)
     Saved  — the designs you saved by name (the saved-designs list)
     Create — a brand + Video or Carousel opens the brand template in the editor
   A first visit has nothing to continue: only Create shows. Format (Reel, Square,
   Desktop) stays in the editor. The brand mark (top left) brings the screen back. */
const HOME_RECENT_MAX = 8;
const SHOW_HOME = (() => { try { const q = new URLSearchParams(location.search); return !q.has('debug') || q.has('home'); } catch (_) { return true; } })();
const HOME_FORMAT = { video: '9x16', carousel: '9x16' };   // a new project starts as a Reel (9:16) either way; the format is changed in the editor

const titleOf = (d) => {
  const sc = (d && d.scenes && d.scenes[0]) || d || {};
  const t = String(sc.h1 || d.h1 || '').replace(/\s+/g, ' ').trim();
  return t ? (t.length > 38 ? `${t.slice(0, 36)}…` : t) : 'Untitled';
};
function ago(t) {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'Yesterday' : d < 7 ? `${d} days ago` : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/** A still of a design's first section (only for the brand whose artwork is loaded). */
function designThumb(data) {
  try { const f = designFrames(data, 220)[0]; return f ? f.url : null; } catch (_) { return null; }
}

/** Everything the start screen lists, from the studio's own state and saved designs. */
function homeItems() {
  const list = loadTemplates();
  const recent = [];
  const cur = snapshot();
  if (!state.pristine && hasContent(cur)) {
    recent.push({ kind: 'current', key: 'current', name: titleOf(cur), brand: state.brand, type: state.contentType, format: state.format, time: Date.now(), data: cur });
  }
  for (const [b, d] of Object.entries(state.designs || {})) {
    if (b === state.brand || !BRANDS[b] || !d || !hasContent(d)) continue;
    recent.push({ kind: 'brand', key: `brand:${b}`, name: titleOf(d), brand: b, type: d.contentType || 'video', format: d.fmt || '9x16', time: d.touched || 0, thumb: d.thumb || null });
  }
  for (const t of list) {
    if (!t.lastSession || !t.data) continue;
    recent.push({ kind: 'auto', key: t.id, name: titleOf(t.data), brand: t.data.brand, type: t.data.contentType || 'video', format: t.data.format || t.format, time: t.created || 0, thumb: t.thumb || null, entry: t });
  }
  const [first, ...rest] = recent[0] && recent[0].kind === 'current' ? recent : [null, ...recent];
  rest.sort((a, b) => (b.time || 0) - (a.time || 0));
  const saved = list.filter((t) => !t.lastSession && t.data).map((t) => ({
    kind: 'saved', key: t.id, name: t.name || titleOf(t.data), brand: t.data.brand, type: t.data.contentType || 'video', format: t.data.format || t.format, time: t.created || 0, thumb: t.thumb || null, entry: t,
  }));
  return { recent: first ? [first, ...rest] : rest, saved };
}

/** Keeps the design that is open now among the recent ones (unless nothing was done to it). */
function keepLastSession() {
  if (state.pristine) return;
  try {
    const current = snapshot();
    if (!hasContent(current)) return;
    pushRecent(current, designThumb(current), Date.now());
  } catch (_) { /* never block on this */ }
}
function pushRecent(data, thumb, time) {
  let list = loadTemplates();
  list.unshift({
    id: `tpl_last_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, lastSession: true,
    name: `Recent · ${titleOf(data)}`, format: data.format || state.format, created: time || Date.now(), thumb, data,
  });
  // the newest few earlier designs; saved designs are never pushed out by them
  let n = 0;
  list = list.filter((t) => !t.lastSession || ++n <= HOME_RECENT_MAX);
  while (list.length > MAX_TEMPLATES) {
    const i = list.map((t) => !!t.lastSession).lastIndexOf(true);
    list.splice(i >= 0 ? i : list.length - 1, 1);
  }
  let ok = writeTemplates(list);
  for (let i = list.length - 1; !ok && i >= 0; i--) { if (list[i].thumb) { delete list[i].thumb; ok = writeTemplates(list); } }
  renderTemplates();
}
/** Another brand's working design moves to Recent before that brand gets a new project. */
function archiveBrandDesign(b) {
  const d = state.designs && state.designs[b];
  if (!d) return;
  delete state.designs[b];
  if (!hasContent(d)) return;
  const data = { ...clone(d), brand: b, format: d.fmt || '9x16', contentType: d.contentType || 'video' };
  delete data.thumb; delete data.touched; delete data.fmt;
  pushRecent(data, d.thumb || null, d.touched || Date.now());
}

async function afterOpen() {
  save();
  renderButtons(); renderBlocks(); renderBadgeItems(); renderMediaItems();
  renderScenes();
  syncContentType(); syncFormats();
  draw();
}

/** Opens a project from the start screen, straight into the editor. */
async function openHomeItem(it) {
  dropMulti();   // a selection belongs to the design and section it was made on
  if (!it) return;
  if (it.kind === 'current') { closeHome(); return; }
  stopPlayback();
  if (it.kind === 'brand') { await switchBrand(it.brand); closeHome(); return; }
  const data = clone(it.entry.data);
  keepLastSession();
  if (it.kind === 'auto') writeTemplates(loadTemplates().filter((t) => t.id !== it.entry.id));   // it is the open design now
  if (data.brand && data.brand !== state.brand) archiveBrandDesign(data.brand);
  selected = null;
  await applyTemplate({ data });
  state.pristine = false;
  renderTemplates();
  await afterOpen();
  closeHome();
}

/** Brand + Video or Carousel → that brand's template, in the editor. Nothing more is asked. */
async function createProject(brandId, type) {
  dropMulti();   // a selection belongs to the design and section it was made on
  if (!BRANDS[brandId]) return;
  stopPlayback();
  keepLastSession();
  if (state.designs && state.designs[brandId]) archiveBrandDesign(brandId);
  if (activeBrand().id !== brandId) await loadAssets(brandId);
  const fmt = HOME_FORMAT[type] || '9x16';
  const r = templateRecipe(BRANDS[brandId]);
  let data = r ? proposalData(r, { format: fmt, contentType: type }) : null;
  if (!data) data = { ...blankData(), brand: brandId };
  data.brand = brandId; data.contentType = type; data.format = fmt;
  selected = null;
  await applyTemplate({ data });
  state.pristine = true;           // untouched until you change something
  await afterOpen();
  closeHome();
}

/* the screen itself */
function brandMark(b) {
  const el = document.createElement('span');
  el.className = 'home-brand-mark';
  const br = BRANDS[b];
  // a brand with a free-standing mark shows it whole (no circle, no backing); others keep their round badge
  if (br && br.mark) { el.classList.add('is-free'); const im = document.createElement('img'); im.src = br.mark; im.alt = ''; el.append(im); }
  else if (br && br.icon) { const im = document.createElement('img'); im.src = br.icon; im.alt = ''; el.append(im); }
  else el.textContent = (br && br.mono) || '·';
  return el;
}
/** The design behind a start-screen item, whatever kind it is. */
function homeDataOf(it) {
  if (it.data) return it.data;
  if (it.entry && it.entry.data) return it.entry.data;
  const d = it.kind === 'brand' && state.designs ? state.designs[it.brand] : null;
  return d ? { ...d, brand: d.brand || it.brand, format: d.format || d.fmt || it.format } : null;
}
/** Designs of the loaded brand that have no still (made before stills were kept) get one. */
function fillBrandStills() {
  try {
    const id = activeBrand().id;
    const list = loadTemplates();
    let n = 0;
    for (const t of list) {
      if (t.thumb || !t.data || t.data.brand !== id || n >= 12) continue;
      const url = designThumb(t.data);
      if (url) { t.thumb = url; n++; }
    }
    if (n) writeTemplates(list);
  } catch (_) { /* a still is a nicety */ }
}
/** Another brand's artwork may still be loading: draw the still again shortly, then keep it. */
function fillThumbLater(im, it, data) {
  const again = (left) => setTimeout(() => {
    const url = designThumb(data);
    if (url && im.isConnected) im.src = url;
    if (left) { again(left - 1); return; }
    if (!url) return;
    try {
      if (it.kind === 'brand' && state.designs && state.designs[it.brand]) { state.designs[it.brand].thumb = url; save(); }
      else if (it.entry) {
        const list = loadTemplates();
        const e = list.find((x) => x.id === it.entry.id);
        if (e) { e.thumb = url; writeTemplates(list); }
      }
    } catch (_) { /* a still is a nicety */ }
  }, left ? 450 : 1400);
  again(1);
}
function homeTile(it, size = 'lg') {
  const t = document.createElement('button');
  t.type = 'button';
  t.className = `home-tile is-${size}`;
  t.dataset.key = it.key;
  const f = FORMATS[it.format] || FORMATS['9x16'];
  const pic = document.createElement('span');
  pic.className = 'home-thumb';
  // a fresh still for the brand whose artwork is loaded (sharp, no guides); a kept one otherwise
  const live = it.data || (it.entry && it.entry.data && it.entry.data.brand === activeBrand().id ? it.entry.data : null);
  let src = (live && designThumb(live)) || it.thumb || null;
  // no still kept (a design from before stills were kept, or one whose still failed): draw one
  // now when its brand's artwork is the one loaded (only one brand's artwork is ever in memory);
  // the others get theirs the next time their brand is open
  const lazy = !src && it.brand === activeBrand().id ? homeDataOf(it) : null;
  if (lazy) src = designThumb(lazy);
  if (src) {
    const im = document.createElement('img'); im.src = src; im.alt = ''; im.style.aspectRatio = `${f.w} / ${f.h}`; pic.append(im);
    if (lazy) fillThumbLater(im, it, lazy);
  } else { pic.classList.add('is-empty'); pic.append(brandMark(it.brand)); }
  if (it.kind === 'current') { const live = document.createElement('span'); live.className = 'home-live'; live.textContent = 'Open now'; pic.append(live); }
  const name = document.createElement('span');
  name.className = 'home-name';
  name.textContent = it.name;
  const meta = document.createElement('span');
  meta.className = 'home-meta';
  const kind = document.createElement('span');
  kind.className = 'home-kind';
  kind.textContent = it.type === 'carousel' ? 'Carousel' : 'Video';
  const when = document.createElement('span');
  when.className = 'home-when';
  when.textContent = it.kind === 'current' ? (BRANDS[it.brand] ? BRANDS[it.brand].name : '') : ago(it.time);
  meta.append(brandMark(it.brand), kind, when);
  t.append(pic, name, meta);
  t.setAttribute('aria-label', `${it.name}, ${kind.textContent}, ${BRANDS[it.brand] ? BRANDS[it.brand].name : ''}${it.kind === 'current' ? ', open now' : ''}`);
  t.addEventListener('click', () => openHomeItem(it));
  // v3.7 · a card carries its quick actions: Export (recent) and ✕ (delete)
  const card = document.createElement('div');
  card.className = `home-card is-${size}`;
  card.setAttribute('role', 'listitem');
  card.append(t, projectActions(it, { exportable: size === 'md' }));   // Home: ✕ only; Show all: Export + ✕
  return card;
}

/* --- v3.7 · project quick actions: Export and Delete (with Undo) ------------------------ */
const ICON_EXPORT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
function projectActions(it, { exportable = true } = {}) {
  const box = document.createElement('span');
  box.className = 'proj-acts';
  const btn = (cls, icon, label, run) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `proj-act ${cls}`; b.innerHTML = icon;
    b.setAttribute('aria-label', `${label} “${it.name}”`); b.title = label;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); run(); });
    box.append(b); return b;
  };
  if (exportable) btn('is-export', ICON_EXPORT, 'Export', () => exportProject(it));
  btn('is-del', ICON_X, 'Delete', () => deleteProject(it));
  return box;
}
/** Export a project from a list: open it (the open one stays), then the export sheet. */
async function exportProject(it) {
  closeBurger();
  closeHomeAll();
  if (it.kind !== 'current') await openHomeItem(it);
  else if (!$('#home').hidden) closeHome();
  setTimeout(() => $('#btn-export').click(), 60);
}
/** Delete a project from Recent or Saved — the note offers Undo. */
async function deleteProject(it) {
  const name = it.name || 'Untitled';
  let undo = null;
  if (it.kind === 'saved' || it.kind === 'auto') {
    const list = loadTemplates();
    const i = list.findIndex((t) => t.id === it.entry.id);
    if (i < 0) return;
    const [gone] = list.splice(i, 1);
    writeTemplates(list); renderTemplates();
    undo = () => { const l = loadTemplates(); l.splice(Math.min(i, l.length), 0, gone); writeTemplates(l); renderTemplates(); };
  } else if (it.kind === 'brand') {
    const d = state.designs && state.designs[it.brand];
    if (!d) return;
    delete state.designs[it.brand]; save();
    undo = () => { state.designs[it.brand] = d; save(); };
  } else if (it.kind === 'current') {
    // the open design: it goes, and this brand starts again from its template (not kept in Recent)
    const keep = snapshot();
    const r = templateRecipe();
    let data = r ? proposalData(r, { format: state.format, contentType: state.contentType }) : null;
    if (!data) data = { ...blankData(), brand: state.brand };
    selected = null;
    await applyTemplate({ data });
    state.pristine = true; save();
    renderButtons(); renderBlocks(); renderBadgeItems(); renderMediaItems(); renderScenes(); draw();
    undo = async () => { await applyTemplate({ data: keep }); state.pristine = false; save(); renderButtons(); renderBlocks(); renderBadgeItems(); renderMediaItems(); renderScenes(); draw(); refreshLists(); };
  }
  refreshLists();
  showToast(`Deleted “${name}”`, 'Undo', async () => { hideToast(); if (undo) await undo(); refreshLists(); }, 7000);
}
/** Home, its Show all modal and the ☰ menu list the same projects: redraw whichever is open. */
function refreshLists() {
  if (!$('#home').hidden) renderHome();
  if (!$('#home-all').hidden) renderHomeAll();
  if (!$('#burger-menu').hidden) renderBurger();
}
function renderHome() {
  const { recent, saved } = homeItems();
  const first = !recent.length && !saved.length;
  const home = $('#home');
  home.classList.toggle('is-first', first);
  // Recent
  const rs = $('#home-recent'), rg = $('#home-recent-list');
  rs.hidden = !recent.length;
  rg.innerHTML = '';
  for (const it of recent.slice(0, 6)) rg.append(homeTile(it, 'lg'));
  // Saved
  const ss = $('#home-saved'), sg = $('#home-saved-list');
  ss.hidden = !saved.length;
  sg.innerHTML = '';
  for (const it of saved.slice(0, 4)) sg.append(homeTile(it, 'sm'));
  const more = recent.length > 6 || saved.length > 4 || recent.length + saved.length > 6;
  $('#home-show-all').hidden = !(recent.length + saved.length > 1 && more);
  $('#home-saved-all').hidden = !(saved.length > 4);
  // Create new
  const cg = $('#home-create-list');
  cg.innerHTML = '';
  // v4 · one card per brand: the card makes a Reel, and Reel / Carousel are right there (switchable later)
  for (const b of Object.values(BRANDS)) {
    const card = document.createElement('div');
    card.className = 'home-brand-card';
    card.dataset.brand = b.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'home-brand home-new';
    btn.dataset.brand = b.id;
    btn.dataset.type = 'video';
    const nm = document.createElement('span');
    nm.className = 'home-brand-name';
    nm.textContent = b.name;
    btn.append(brandMark(b.id), nm);
    btn.setAttribute('aria-label', `${b.name}: new Reel`);
    btn.addEventListener('click', () => createProject(b.id, 'video'));
    const kinds = document.createElement('div');
    kinds.className = 'home-kinds';
    for (const [type, label] of [['video', 'Reel'], ['carousel', 'Carousel']]) {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'home-kind';
      k.dataset.type = type;
      k.innerHTML = `${KIND_ICONS[type]}<span>${label}</span>`;
      k.setAttribute('aria-label', `${b.name}: new ${label}`);
      k.addEventListener('click', () => createProject(b.id, type));
      kinds.append(k);
    }
    card.append(btn, kinds);
    cg.append(card);
  }
  $('#home-create-title').textContent = 'Choose your brand';
  const sub = $('#home-create-sub'); if (sub) sub.textContent = 'Then a Reel or a Carousel. You can switch either, and the size, at any time.';
}
/* v3.1 · P0: which screen this tab is on survives a reload (sessionStorage: this tab only,
   so a new visit still opens on the start screen with the design first in Recent). */
const IN_EDITOR_KEY = 'askruth.backdrop-studio.in-editor';
function wasInEditor() { try { return sessionStorage.getItem(IN_EDITOR_KEY) === '1'; } catch (_) { return false; } }
function markInEditor(on) { try { if (on) sessionStorage.setItem(IN_EDITOR_KEY, '1'); else sessionStorage.removeItem(IN_EDITOR_KEY); } catch (_) { /* private mode */ } }
/** Everything the open design holds, written now (the section's own copy included). */
function persistNow() {
  if (typeof sequencing !== 'undefined' && sequencing) return;   // an export is stepping through sections
  // site data cleared on purpose (the browser's settings, a test): don't bring the design back
  try { if (localStorage.getItem(STORAGE_KEY) === null) return; } catch (_) { return; }
  try { commitScene(); } catch (_) { /* keep going: the live state still saves */ }
  save();
}
// leaving, hiding or freezing the tab writes the design first (a phone may drop a background tab)
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); });
document.addEventListener('freeze', persistNow);

function openHome() {
  markInEditor(false);
  dropMulti();   // a selection belongs to the design and section it was made on
  if (editor) closeEditor(true);
  stopPlayback();
  closeClipMenu();
  commitScene();
  renderHome();
  $('#home').hidden = false;
  document.documentElement.classList.add('is-home');
  hideToast();
  const first = $('#home .home-tile, #home .home-new');
  if (first) first.focus({ preventScroll: true });
}
function closeHome() {
  markInEditor(true);
  $('#home').hidden = true;
  document.documentElement.classList.remove('is-home');
  closeHomeAll();
  draw();
}

/* Show all: every recent and saved design, in a modal (a near-full-screen sheet on a phone) */
let homeFilter = 'all';
function renderHomeAll() {
  const { recent, saved } = homeItems();
  const items = homeFilter === 'recent' ? recent : homeFilter === 'saved' ? saved : [...recent, ...saved];
  const g = $('#home-all-list');
  g.innerHTML = '';
  for (const it of items) g.append(homeTile(it, 'md'));
  $('#home-all-empty').hidden = items.length > 0;
  for (const b of document.querySelectorAll('#home-all-filter [data-f]')) b.setAttribute('aria-checked', String(b.dataset.f === homeFilter));
}
function openHomeAll(f = 'all') {
  homeFilter = f;
  renderHomeAll();
  $('#home-all').hidden = false;
}
function closeHomeAll() { const s = $('#home-all'); if (s) s.hidden = true; }

/* --- text fields grow with their text --------------------------------------
   Header, body and text-box fields in the panel are as tall as what is in them
   (never shorter than their rows, never taller than ~40 % of the screen, then
   they scroll). They refit when typed in, when the app fills them (switching
   section, Undo, a template), and when they appear or change width. */
const FIT_SKIP = (ta) => ta.classList.contains('canvas-editor');
function fitField(ta) {
  if (!ta || FIT_SKIP(ta) || !ta.isConnected || !ta.offsetParent) return;
  const box = ta.closest('.panel-controls, .section-sheet-body, .sheet') || document.scrollingElement;
  const keep = box ? box.scrollTop : 0;
  const max = Math.max(160, Math.round(window.innerHeight * 0.4));
  const edge = ta.offsetHeight - ta.clientHeight;          // borders
  ta.style.height = 'auto';                                // back to its rows, to measure
  const want = ta.scrollHeight + edge;
  ta.style.height = `${Math.min(want, max)}px`;
  ta.style.overflowY = want > max ? 'auto' : 'hidden';
  if (box && box.scrollTop !== keep) box.scrollTop = keep;
}
const fitQueue = new Set();
function queueFit(ta) {
  if (FIT_SKIP(ta)) return;
  if (!fitQueue.size) requestAnimationFrame(() => { for (const t of fitQueue) fitField(t); fitQueue.clear(); });
  fitQueue.add(ta);
}
function wireAutoFit() {
  // the app sets values in many places: catch them all at the setter
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (desc && desc.set && !HTMLTextAreaElement.prototype.__fit) {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      configurable: true, enumerable: desc.enumerable,
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); queueFit(this); },
    });
    HTMLTextAreaElement.prototype.__fit = true;
  }
  document.addEventListener('input', (e) => { if (e.target instanceof HTMLTextAreaElement) fitField(e.target); }, true);
  // shown, moved into the phone sheet, or the panel changes width
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((list) => {
    for (const en of list) { const t = en.target; if (t.__fitW !== Math.round(en.contentRect.width)) { t.__fitW = Math.round(en.contentRect.width); queueFit(t); } }
  }) : null;
  const watch = (root) => { for (const t of root.querySelectorAll ? root.querySelectorAll('textarea') : []) if (!FIT_SKIP(t) && !t.__fitWatched) { t.__fitWatched = true; ro && ro.observe(t); queueFit(t); } };
  watch(document);
  new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'TEXTAREA') watch(n.parentNode || document); else watch(n); } })
    .observe(document.body, { childList: true, subtree: true });
}

function wireHome() {
  const mark = null;   // v3.1: the mark belongs to the brand switcher; Home lives in the menu (☰)
  if (mark) {
    mark.setAttribute('role', 'button');
    mark.tabIndex = 0;
    mark.title = 'Home — your designs';
    mark.setAttribute('aria-label', 'Home — your designs');
    mark.removeAttribute('aria-hidden');
    mark.addEventListener('click', openHome);
    mark.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHome(); } });
  }
  $('#home-show-all').addEventListener('click', () => openHomeAll('all'));
  $('#home-saved-all').addEventListener('click', () => openHomeAll('saved'));
  $('#home-all-close').addEventListener('click', closeHomeAll);
  $('#home-all').addEventListener('click', (e) => { if (e.target.id === 'home-all') closeHomeAll(); });
  $('#home-all-filter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { homeFilter = b.dataset.f; renderHomeAll(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || $('#home').hidden) return;
    if (!$('#home-all').hidden) { closeHomeAll(); return; }
    if (!state.pristine || homeItems().recent.length) closeHome();
  });
}

/* --- start from… ------------------------------------------------------------------
   Start new offers designs made from what the brand already has: its backgrounds,
   badges, Light / Dark text with or without the panel, its button colours and copy.
   The first is the brand template (a first launch opens on it); the others are the
   brand's curated `proposals`; Shuffle draws more from the same pieces, only in
   pairings that read (contrast decides the text style and the badge colour); Blank
   is the empty start. Every proposal is a full Hook → Value → CTA with its pieces
   placed by role, in one centred column inside the safe area of every format. */

/* Tests open the app with ?debug and expect the empty start; ?debug&template
   shows what everyone else sees. */
const BLANK_START = (() => {
  try { const q = new URLSearchParams(location.search); return q.has('debug') && !q.has('template'); } catch (_) { return false; }
})();

/* What goes on each section, top to bottom, and where the column sits in the free
   height of the safe area (0 top, 0.5 centred): the Hook lands a little above the
   middle, where the eye goes first and clear of the platform's caption. */
const ROLE_LAYOUT = {
  hook: { anchor: 0.4 },
  value: { anchor: 0.5 },
  cta: { anchor: 0.5 },
};
/* Where the badge goes in the column. A logo on its own (no upper or lower badge)
   leads, at the top; a badge that says "Powered by …" (or has a lower badge) is an
   endorsement and sits between the text and the button. */
const badgeIsLogo = (st = state) => !st.badgePowered && !(st.badgeLower && st.badgeLower.on);
const columnOrder = (st = state) => (badgeIsLogo(st) ? ['badge', 'text', 'button'] : ['text', 'badge', 'button']);

/** Places what is on the loaded section in one centred column, for state.format at W × H. */
function arrangeColumn(W, H, role) {
  const sa = safeArea(state.format, W, H);
  const pos = state.pos[state.format];
  const spec = { ...(ROLE_LAYOUT[role] || ROLE_LAYOUT.value), order: columnOrder() };
  const collect = () => {
    const L = layout(ctx, state, W, H);
    const items = [];
    if (L.wm.image) items.push({ kind: 'badge', r: L.wmRect, t: pos.watermark });
    if (!L.tx.empty) items.push({ kind: 'text', r: { ...L.txRect, h: L.tx.h }, t: pos.text });
    for (const b of L.buttons || []) {
      const t = (state.buttons || []).find((x) => x.id === b.id);
      if (t) items.push({ kind: 'button', r: b.rect, t });
    }
    return items.sort((a, b) => spec.order.indexOf(a.kind) - spec.order.indexOf(b.kind));
  };
  let items = collect();
  if (!items.length) return;
  const gapMin = H * 0.02, gapMax = H * 0.05;
  const total = items.reduce((t, it) => t + it.r.h, 0);
  const n = items.length;
  const gap = n > 1 ? Math.max(gapMin, Math.min(gapMax, (sa.h - total) / (n - 1))) : 0;
  let top = sa.y + Math.max(0, sa.h - total - gap * (n - 1)) * spec.anchor;
  const goals = new Map();
  for (const it of items) {
    goals.set(it.t, { x: sa.x + (sa.w - it.r.w) / 2, y: top });
    top += it.r.h + gap;
  }
  // a box is drawn kept inside the frame: move, measure again, correct
  for (let pass = 0; pass < 4; pass++) {
    let off = 0;
    for (const it of items) {
      const g = goals.get(it.t);
      const dx = g.x - it.r.x, dy = g.y - it.r.y;
      off = Math.max(off, Math.abs(dx), Math.abs(dy));
      it.t.x += dx / W;
      it.t.y += dy / H;
    }
    if (off < 0.5) break;
    items = collect();
  }
}

/** Runs fn on a scratch copy of the app state; the real one is put back afterwards. */
function inSandbox(fn) {
  const keep = { ...state };
  const adjKeep = JSON.parse(JSON.stringify(state.adjust || {}));   // loadScene writes framing in place
  const keepShown = shownScene;
  const was = sequencing;
  sequencing = true;
  try { return fn(); } finally {
    for (const k of Object.keys(state)) if (!(k in keep)) delete state[k];
    Object.assign(state, keep);
    for (const [k, v] of Object.entries(adjKeep)) if (state.adjust && state.adjust[k]) Object.assign(state.adjust[k], v);
    shownScene = keepShown;
    sequencing = was;
  }
}

const recipesOf = (b = activeBrand()) => (b.proposals || []).filter((r) => b.backdrops.some((x) => x.id === r.bg));
const templateRecipe = (b = activeBrand()) => recipesOf(b)[0] || null;

/** A design (snapshot shape) for a recipe, placed for every format. */
function proposalData(recipe, opts = {}) {
  const b = activeBrand();
  return inSandbox(() => {
    const target = FORMATS[opts.format] ? opts.format : FORMATS[state.format] ? state.format : '9x16';
    const contentType = opts.contentType || state.contentType;
    Object.assign(state, starterDesign(b.id)); state.overlays = [];
    const st = b.starter || {};
    const copy = (role) => ({ ...SCENE_COPY[role], ...(st[role] || {}) });
    const badge = b.badges[recipe.badge] ? recipe.badge : Object.keys(b.badges)[0];
    // bare type on a pattern or artwork needs the ground calmed down to read
    const ground = b.backdrops.find((x) => x.id === recipe.bg);
    const dim = opts.clean ? 0 : !recipe.card && ground && ground.kind !== 'solid' ? Math.max(recipe.dim || 0, 0.55) : (recipe.dim || 0);   // clean: nothing to read over it
    const overlay = dim ? { style: 'dim', strength: dim } : { style: 'none', strength: 0.3 };
    state.backdrop = state.sharedBg = recipe.bg;
    state.overlay = clone(overlay);
    state.sharedOverlay = clone(overlay);
    const look = {
      textTone: recipe.tone === 'dark' ? 'dark' : 'light', card: !!recipe.card || !!(ground && ground.kind === 'tile'),   // v3.1: on a pattern, text always has its box
      textColors: { h1: null, body: null }, cardColors: { h1: null, body: null },
      borders: { h1: { w: 0, c: null }, body: { w: 0, c: null } },
    };
    const badgeOn = (scale, lower, powered = true) => ({
      badge, badgeLast: badge, badgeScale: scale, badgePowered: powered, badgeImage: true,
      badgeLower: { ...LOWER_DEFAULT(), on: !!lower }, badgeUpper: null,
    });
    const badgeOff = { ...badgeOn(1, false), badge: 'none' };
    const section = (id, role, extra) => ({
      id, role, on: true, ...clone(look), inset: NO_CARD(), blocks: [], buttons: [], media: [], badges: [], drawings: [],
      h1Scale: 1, bodyScale: 1, pos: clone(DEFAULT_POS), bg: null, overlay: null, ...extra,
    });
    const ctaBg = recipe.ctaBg && b.backdrops.some((x) => x.id === recipe.ctaBg) ? recipe.ctaBg : null;
    const cta = copy('cta');
    /* v3.2 · Start from a template: a cleaner start the same for every brand — the Hook is
       the logo, the Value the background, the CTA one button. Text comes in with + Add. */
    if (opts.clean) {
      const bare = { h1: '', body: '', visibility: 'none', textMode: 'both' };
      state.scenes = [
        section('hook', 'hook', { ...bare, ...badgeOn(1.4, false, false) }),
        section('v1', 'value', { ...bare, ...badgeOff }),
        section('cta', 'cta', {
          ...bare, ctaStyle: 'bold', btnMigrated: true, ...badgeOff,
          buttons: [{ id: `b${Math.random().toString(36).slice(2, 8)}`, text: cta.button || BTN_TEXT, x: 0.5, y: 0.5, look: { ...CTA_LOOK(), scale: 1.3 }, tpl: {} }],
          ...(ctaBg ? { bg: ctaBg, overlay: { style: 'none', strength: 0.3 } } : {}),
        }),
      ];
    } else state.scenes = [
      // Hook: the logo alone, larger, on top — and one headline that lands at once
      section('hook', 'hook', { h1: copy('hook').h1, body: '', visibility: 'both', textMode: 'both', h1Scale: 1.2, ...badgeOn(1.2, false, false) }),
      // Value: the header and its supporting lines
      section('v1', 'value', { h1: copy('value').h1, body: copy('value').body, visibility: 'both', textMode: 'both', h1Scale: 1.15, bodyScale: 1.15, ...badgeOff }),
      // CTA: the action, who it comes from (Powered by badge + lower badge), then the button
      section('cta', 'cta', {
        h1: cta.h1, body: '', visibility: 'both', textMode: 'both', h1Scale: 1.15, ctaStyle: 'bold', btnMigrated: true,
        buttons: [{ id: `b${Math.random().toString(36).slice(2, 8)}`, text: cta.button || BTN_TEXT, x: 0.5, y: 0.6, look: { ...CTA_LOOK(), scale: 1.3 }, tpl: {} }],
        ...badgeOn(0.8, true),
        ...(ctaBg ? { bg: ctaBg, overlay: { style: 'none', strength: 0.3 } } : {}),
      }),
    ];
    // every format gets its own placement; buttons keep one per format in `tpl`
    for (const fmt of [...Object.keys(FORMATS).filter((f) => f !== target), target]) {
      state.format = fmt;
      const { w: W, h: H } = FORMATS[fmt];
      state.scenes.forEach((sc, i) => {
        state.scene = i;
        loadScene(i);
        arrangeColumn(W, H, sc.role);
        sc.pos = clone(state.pos);
        for (const live of state.buttons || []) {
          const own = (sc.buttons || []).find((x) => x.id === live.id);
          if (!own) continue;
          own.tpl = own.tpl || {};
          own.tpl[fmt] = { x: live.x, y: live.y };
          if (fmt === target) { own.x = live.x; own.y = live.y; }
        }
      });
    }
    state.format = target;
    state.contentType = contentType;
    state.scene = 0;
    loadScene(0);
    const out = snapshot();
    out.brand = b.id;
    out.proposal = recipe.id;
    return out;
  });
}


/* --- a layout per format ---------------------------------------------------
   Every format fits itself automatically, and any format can be edited on its own.
   Header, body, badge and card keep a spot per format (`pos`); buttons, text boxes,
   media and extra badges keep theirs in `at[format]` (x / y are always the spots for
   the format on screen).
   - Editing a section's layout in a format (drag, Tidy up, align, space) marks that
     format as edited for that section (`sc.edited[format] = time`). Its layout is
     then its own: switching back brings it back exactly.
   - A format nobody edited follows the latest edited one: on switching to it, that
     layout is carried over (same relative spots) and fitted — kept inside the safe
     area and, where things now overlap, re-spaced in the same order.
   - With nothing edited yet (a fresh template), each format keeps the spots the
     template gave it. */
const LAYOUT_LISTS = { buttons: 'bt', blocks: 'xb', media: 'md', badges: 'eb' };
const OWN_POS = ['watermark', 'text', 'inset'];
const nearPt = (p, b) => p && Math.abs((p.x ?? -1) - (b.x ?? -1)) < 1e-4 && Math.abs((p.y ?? -1) - (b.y ?? -1)) < 1e-4;

/** This section's layout in this format is now the user's own. */
/* v3.1 · Safe Space is advice, not a wall: text, text boxes and buttons used to be held
   inside the safe area by the renderer. One you drag yourself is marked free and stays
   where you put it (inside the frame); untouched items render exactly as before. */
function markFree(d) {
  if (!d) return;
  if (d.key === 'button') { const b = buttonById(d.id); if (b) b.free = true; }
  else if (d.key === 'xblock') { const b = (state.blocks || []).find((x) => x.id === d.id); if (b) b.free = true; }
  else if (d.key === 'text') { const p = state.pos[state.format] && state.pos[state.format].text; if (p) p.free = true; }
}

// after the drag handler has written the new spot (it replaces the text's position object)
canvas.addEventListener('pointermove', () => { if (dragging && dragging.moved) markFree(dragging); });

function markEdited() {
  if (sequencing || !Array.isArray(state.scenes)) return;
  const sc = state.scenes[state.scene];
  if (!sc) return;
  sc.edited = sc.edited || {};
  sc.edited[state.format] = Date.now();
}
const editedIn = (sc, fmt) => !!(sc && sc.edited && sc.edited[fmt]);
/** The format whose layout an unedited one follows: the latest edited (not `but`). */
function leadFormat(sc, but) {
  let best = null, t = -1;
  for (const [f, at] of Object.entries((sc && sc.edited) || {})) if (f !== but && FORMATS[f] && at > t) { best = f; t = at; }
  return best;
}

function switchLayout(from, to) {
  if (!from || !to || from === to || !FORMATS[to]) return;
  state.format = from;
  commitScene();
  state.format = to;
  const fresh = [], follow = [];
  state.scenes.forEach((sc, k) => {
    for (const list of Object.keys(LAYOUT_LISTS)) for (const it of sc[list] || []) { it.at = it.at || {}; it.at[from] = { x: it.x, y: it.y }; }
    const lead = editedIn(sc, to) ? null : leadFormat(sc, to);
    if (lead) { follow.push([k, lead]); return; }
    for (const [list, pre] of Object.entries(LAYOUT_LISTS)) {
      for (const it of sc[list] || []) {
        const tplHere = it.tpl && it.tpl[to] && Object.values(it.tpl).some((p) => nearPt(p, it));
        if (it.at[to]) { it.x = it.at[to].x; it.y = it.at[to].y; }
        else if (tplHere) { it.x = it.tpl[to].x; it.y = it.tpl[to].y; }
        else fresh.push([k, `${pre}:${it.id}`]);
      }
    }
  });
  loadScene(state.scene);
  for (const [k, lead] of follow) followLayout(k, lead, to);
  for (const [k, key] of fresh) placeClear(k, key);
  loadScene(state.scene);
}

/** Section k in format `to` takes the layout of format `src` (same relative spots), fitted. */
function followLayout(k, src, to) {
  inSandbox(() => {
    state.format = to;
    state.scene = k;
    loadScene(k);
    const sc = state.scenes[k];
    const sp = (sc.pos && sc.pos[src]) || {};
    state.pos[to] = state.pos[to] || clone(DEFAULT_POS[to] || DEFAULT_POS['9x16']);
    for (const key of OWN_POS) if (sp[key]) state.pos[to][key] = clone(sp[key]);
    for (const list of Object.keys(LAYOUT_LISTS)) {
      for (const it of state[list] || []) { const p = it.at && it.at[src]; if (p) { it.x = p.x; it.y = p.y; } }
    }
    const { w: W, h: H } = FORMATS[to];
    fitLayout(W, H);
    // write it into the section itself (the sandbox is thrown away)
    sc.pos = sc.pos || {};
    sc.pos[to] = clone(state.pos[to]);
    for (const list of Object.keys(LAYOUT_LISTS)) {
      for (const it of state[list] || []) {
        const own = (sc[list] || []).find((x) => x.id === it.id);
        if (own) { own.x = it.x; own.y = it.y; own.at = own.at || {}; own.at[to] = { x: it.x, y: it.y }; }
      }
    }
  });
}

/** Fit what is on the loaded section into the safe area of W × H: everything inside it,
    and where things overlap, re-spaced top to bottom in the order they are in
    (side by side stays side by side; each keeps its left-right spot). */
function fitLayoutRaw(W, H) {
  const sa = safeArea(state.format, W, H);
  const keys = () => {
    const L = layout(ctx, state, W, H);
    const ks = [...OWN_POS,
      ...(L.xbadges || []).map((b) => `eb:${b.id}`), ...(L.buttons || []).map((b) => `bt:${b.id}`),
      ...(L.media || []).map((m) => `md:${m.id}`), ...(L.extras || []).map((x) => `xb:${x.id}`)];
    return ks.map((key) => ({ key, r: multiRect(key, L), t: multiTarget(key) })).filter((x) => x.r && x.t && x.r.w > 0 && x.r.h > 0);
  };
  let items = keys();
  if (!items.length) return;
  const into = (v, lo, len, span) => (len >= span ? lo + (span - len) / 2 : Math.max(lo, Math.min(lo + span - len, v)));
  const goals = new Map();
  for (const it of items) goals.set(it.t, { x: into(it.r.x, sa.x, it.r.w, sa.w), y: into(it.r.y, sa.y, it.r.h, sa.h) });
  const gapMin = H * 0.012;
  const box = (it) => ({ ...it.r, ...goals.get(it.t) });
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h + gapMin && b.y < a.y + a.h + gapMin;
  let overlap = false;
  for (let i = 0; i < items.length && !overlap; i++) for (let j = i + 1; j < items.length; j++) if (hits(box(items[i]), box(items[j]))) { overlap = true; break; }
  if (overlap) {
    // rows: items side by side (their heights overlap, their widths don't) share a row
    const sorted = [...items].sort((a, b) => (box(a).y + box(a).h / 2) - (box(b).y + box(b).h / 2));
    const rows = [];
    for (const it of sorted) {
      const b = box(it), row = rows[rows.length - 1];
      const beside = row && b.y < row.y + row.h && row.y < b.y + b.h && row.items.every((o) => { const ob = box(o); return b.x >= ob.x + ob.w || ob.x >= b.x + b.w; });
      if (beside) { row.items.push(it); row.y = Math.min(row.y, b.y); row.h = Math.max(row.h, b.h); }
      else rows.push({ items: [it], y: b.y, h: b.h });
    }
    const total = rows.reduce((t, r) => t + r.h, 0), n = rows.length;
    const gap = n > 1 ? Math.max(gapMin, Math.min(H * 0.045, (sa.h - total) / (n - 1))) : 0;
    const stack = total + gap * (n - 1);
    const mid = (Math.min(...rows.map((r) => r.y)) + Math.max(...rows.map((r) => r.y + r.h))) / 2;
    let top = Math.max(sa.y, Math.min(sa.y + Math.max(0, sa.h - stack), mid - stack / 2));
    for (const row of rows) {
      for (const it of row.items) goals.get(it.t).y = top + (row.h - box(it).h) / 2;
      top += row.h + gap;
    }
  }
  // a box is drawn kept inside the frame: move, measure again, correct
  for (let pass = 0; pass < 4; pass++) {
    let off = 0;
    for (const it of items) {
      const g = goals.get(it.t);
      if (!g) continue;
      const dx = g.x - it.r.x, dy = g.y - it.r.y;
      off = Math.max(off, Math.abs(dx), Math.abs(dy));
      it.t.x += dx / W;
      it.t.y += dy / H;
    }
    if (off < 0.5) break;
    items = keys();
  }
}

/** More proposals from the brand's pieces, in pairings that read. */
function shuffledRecipes(n, avoid = []) {
  const b = activeBrand();
  const bgs = b.backdrops.filter((x) => x.listed !== false && x.kind !== 'cogent');   // v3.1: Shuffle keeps to the brand's own backgrounds (cogents are chosen by hand)
  const keys = Object.keys(b.badges);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const seen = new Set(avoid);
  const out = [];
  for (let tries = 0; out.length < n && tries < 400; tries++) {
    const bg = pick(bgs);
    const base = /^#[0-9a-f]{6}$/i.test(bg.base || '') ? bg.base : (bg.tone === 'dark' ? '#222222' : '#eeeeee');
    // a panel stands out from its ground (cream on dark, dark on light); bare type
    // takes whichever of light / dark reads better, and art gets Darken under it
    const card = bg.kind === 'solid' ? Math.random() < 0.35 : Math.random() < 0.8;
    let tone, dim = 0;
    if (card) tone = bg.tone === 'dark' ? 'dark' : 'light';
    else {
      const lightReads = contrast(base, '#ffffff'), darkReads = contrast(base, '#1a1915');
      tone = lightReads >= darkReads ? 'light' : 'dark';
      if (bg.kind !== 'solid') { tone = 'light'; dim = 0.55; }
    }
    // the plain lockups come in the colour the ground asks for; stickers and portraits
    // go anywhere, except a face that is already the background
    let badge = pick(keys);
    if ((badge === 'plum' || badge === 'cream') && b.badges[bg.badge]) badge = bg.badge;
    const face = String(bg.name || '').split(' ')[0].toLowerCase();
    if (bg.id.includes('portrait') && badge.toLowerCase().startsWith(face)) continue;
    // the CTA on a solid of the other tone, so its line and button stand out
    const solids = bgs.filter((x) => x.kind === 'solid' && x.tone !== bg.tone && x.id !== bg.id);
    const ctaBg = solids.length ? pick(solids).id : null;
    const sig = `${bg.id}|${badge}|${card}|${tone}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `mix-${out.length}-${Date.now().toString(36)}`, name: badge === 'plum' || badge === 'cream' ? `${bg.name} · lockup` : `${bg.name} · ${b.badges[badge].label}`, bg: bg.id, badge, card, tone, dim, ctaBg, mixed: true });
  }
  return out;
}
const recipeSig = (r) => `${r.bg}|${r.badge}|${!!r.card}|${r.tone}`;

/** Small stills of a design's sections (current format). */
const thumbCanvas = document.createElement('canvas');
function designFrames(data, h = 150) {
  const f = FORMATS[data.format] || FORMATS['9x16'];
  const w = Math.max(20, Math.round(h * f.w / f.h));
  thumbCanvas.width = w * 2;
  thumbCanvas.height = h * 2;
  const g = thumbCanvas.getContext('2d');
  return inSandbox(() => {
    for (const k of DESIGN_KEYS) if (data[k] !== undefined) state[k] = clone(data[k]); if (data.overlays === undefined) state.overlays = [];   // v3.13: a design from before overlay clips has none
    return state.scenes.map((sc, i) => {
      loadScene(i);
      try { render(g, thumbCanvas.width, thumbCanvas.height, state, {}); } catch (_) { /* artwork still loading */ }
      return { role: sc.role, url: thumbCanvas.toDataURL('image/jpeg', 0.82) };
    });
  });
}

/** The Hook / Value / CTA a blank start has: the brand's copy underneath, nothing on. */
/** Blank starts on a plain colour of the brand's own (not its pattern), with nothing on. */
const PLAIN_OF = { askruth: 'solid-plum', moshpit: 'mp-charcoal', t4r: 't4r-navy' };
function plainBackdrop(brandId = state.brand) {
  const b = BRANDS[brandId];
  if (!b) return null;
  const want = b.backdrops.find((x) => x.id === PLAIN_OF[brandId]);
  return want || b.backdrops.find((x) => x.kind === 'solid' && x.tone === 'dark' && x.listed !== false)
    || b.backdrops.find((x) => x.kind === 'solid') || null;
}
function blankData() {
  return inSandbox(() => {
    const target = state.format, type = state.contentType, brand = state.brand;
    Object.assign(state, starterDesign(brand)); state.overlays = [];
    state.format = target; state.contentType = type; state.brand = brand;
    const plain = plainBackdrop(brand);
    if (plain) { state.backdrop = plain.id; state.sharedBg = plain.id; }
    for (const sc of state.scenes) {
      sc.bg = null; sc.buttons = []; sc.blocks = []; sc.media = []; sc.badges = []; sc.drawings = [];
      sc.visibility = 'none'; sc.badge = 'none';
      sc.btnMigrated = true; if (sc.role === 'cta') sc.ctaStyle = 'bold';   // no button made from the CTA's words
    }
    state.textTone = plain && plain.tone === 'dark' ? 'light' : state.textTone;
    state.scene = 0;
    loadScene(0);
    state.buttons = []; state.blocks = []; state.media = []; state.badges = []; state.drawings = [];
    return snapshot();
  });
}

let startList = [];
function renderStartSheet() {
  const grid = $('#start-grid');
  grid.innerHTML = '';
  for (const r of startList) {
    const data = r.blank ? null : (r.data = r.data || proposalData(r, { clean: true }));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'start-card' + (r.blank ? ' is-blank' : '');
    card.dataset.id = r.id;
    const frames = document.createElement('span');
    frames.className = 'start-frames';
    if (data) {
      for (const fr of designFrames(data)) {
        const im = document.createElement('img');
        im.alt = '';
        im.src = fr.url;
        im.dataset.role = fr.role;
        frames.append(im);
      }
    } else {
      const f = FORMATS[state.format];
      const plain = plainBackdrop();
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('i');
        s.style.aspectRatio = `${f.w} / ${f.h}`;
        if (plain) s.style.background = plain.base;
        frames.append(s);
      }
    }
    const label = document.createElement('span');
    label.className = 'start-name';
    label.textContent = r.name;
    const sub = document.createElement('small');
    sub.textContent = r.blank ? `A plain ${plainBackdrop() ? plainBackdrop().name.toLowerCase() : 'color'} background · nothing on` : r.id === 'template' ? 'The brand’s signature look · Logo → Background → Button' : 'Logo → Background → Button';
    label.append(sub);
    card.append(frames, label);
    card.addEventListener('click', () => chooseStart(r));
    grid.append(card);
  }
}

function openStartSheet() {
  const b = activeBrand();
  if (playing) stopPlayback(true);
  if (editor) closeEditor(true);
  closeClipMenu();
  commitScene();
  startList = [...recipesOf(b).map((r) => ({ ...r })), { id: 'blank', name: 'Blank', blank: true }];
  $('#start-sub').textContent = `Made from ${b.name}${/s$/i.test(b.name) ? '’' : '’s'} own backgrounds, badges, type and buttons. Pick one; everything stays editable.`;
  renderStartSheet();
  $('#start-sheet').hidden = false;
  const first = $('#start-grid .start-card');
  if (first) first.focus();
}
function closeStartSheet() { $('#start-sheet').hidden = true; }

function shuffleStart() {
  const keepFirst = startList.filter((r) => r.id === 'template');
  const avoid = startList.filter((r) => !r.blank).map(recipeSig);
  const fresh = shuffledRecipes(Math.max(4, recipesOf().length - 1), avoid);
  startList = [...keepFirst, ...fresh, { id: 'blank', name: 'Blank', blank: true }];
  renderStartSheet();
}

/** On a clean start: the brand template, placed for the format in use. */
function openTemplateDesign() {
  const r = templateRecipe();
  if (!r) return;
  try {
    const d = proposalData(r);
    for (const k of DESIGN_KEYS) if (d[k] !== undefined) state[k] = clone(d[k]); if (d.overlays === undefined) state.overlays = [];   // v3.13: a design from before overlay clips has none
  if (d.captions === undefined) state.captions = null;   // v4.1: nor captions
  if (d.deck === undefined) state.deck = null;           // v4.4: nor slides from text
    state.pristine = true;
    save();
  } catch (e) { console.warn('template', e); }
}

async function chooseStart(r) {
  dropMulti();   // a selection belongs to the design and section it was made on
  const data = r.blank ? blankData() : (r.data || proposalData(r, { clean: true }));
  closeStartSheet();
  keepLastSession();
  pushUndo(r.blank ? 'Started blank' : `Started from ${r.name}`);
  selected = null;
  await applyTemplate({ data });
  state.pristine = true;
  save();
  renderButtons(); renderBlocks(); renderBadgeItems(); renderMediaItems();
  renderScenes();
  draw();
}

function wireStartFrom() {
  $('#start-new').addEventListener('click', openStartSheet);
  $('#start-close').addEventListener('click', closeStartSheet);
  $('#start-shuffle').addEventListener('click', shuffleStart);
  const sheet = $('#start-sheet');
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeStartSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeStartSheet(); });
  // a template's button moves with the format until it is moved by hand
  // (after the format's own handler has set the new format)
  $('#format-select').addEventListener('change', () => setTimeout(() => { renderButtons(); draw(); }, 0));   // positions: switchLayout()
}

function clearSection(i) {
  const sc = state.scenes[i];
  if (!sc) return;
  if (playing) stopPlayback(true);
  if (editor) closeEditor(true);
  commitScene();
  pushUndo(`${sceneName(sc, i)} cleared`);
  sc.h1 = '';
  sc.body = '';
  sc.visibility = 'none';
  sc.blocks = [];
  sc.buttons = [];
  sc.drawings = [];
  sc.media = [];
  sc.badges = [];
  sc.inset = NO_CARD();
  if (sc.badge && sc.badge !== 'none') sc.badgeLast = sc.badge;
  sc.badge = 'none';
  selected = null;
  state.scene = i;
  loadScene(i);
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  save();
  renderScenes();
  renderBlocks();
  renderButtons();
  renderMediaItems();
  renderBadgeItems();
  syncInsetControls();
  syncImageControls();
  syncSceneCard();
  syncSectionValues(true);
  if (fsMode) { if (sheetTab) closeSectionSheet({ focus: false }); showScope(i); }
  draw();
}

/* --- a section button turns its item on ----------------------------------------
   Opening Text, Buttons, Media or Badge while that item is off switches it on
   for this section, so the tap shows it straight away:
     Text    — switched on; an empty header gets the brand's copy for this role
     Buttons — a first button is added
     Media   — hidden media is shown again (with none yet, the upload tiles open)
     Badge   — switched on
   Closing a section never switches anything off. */
function starterCopy(role) {
  const st = (activeBrand() && activeBrand().starter) || {};
  return { ...(SCENE_COPY[role] || SCENE_COPY.value), ...((st.copy || st)[role] || {}) };
}

/** Text switched on: an empty header or body gets placeholder copy (the brand's
    for this role), so the box shows straight away — header and body together. */
const PLACEHOLDER = { h1: 'Your header', body: 'A short line to go with it' };
function fillTextPlaceholders() {
  const c = starterCopy(state.sceneRole || 'value');
  let changed = false;
  for (const part of ['h1', 'body']) {
    if (String(state[part] || '').trim()) continue;
    state[part] = String(c[part] || '').trim() || PLACEHOLDER[part];
    $(part === 'h1' ? '#in-h1' : '#in-body').value = state[part];
    changed = true;
  }
  if (changed) { commitScene(); save(); renderScenes(); }
  return changed;
}

function activateTab(tab) {
  if (tab === 'badge') {
    const t = $('#tg-badge');
    if (t && !t.checked && !$('#badge-field').hidden) t.click();
  } else if (tab === 'text') {
    const t = $('#tg-text');
    if (t && !t.checked) {
      t.click();                        // switching on fills an empty header / body with placeholder copy
      commitScene(); save(); renderScenes();
    }
  } else if (tab === 'buttons') {
    if (!(state.buttons && state.buttons.length)) addButton();
  } else if (tab === 'card') {
    const t = $('#tg-inset');
    if (t && !t.checked && state.inset && state.inset.id) t.click();
  }
}

function wireTabActivates() {
  const bar = $('#edit-tabs');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || sheetTab === b.dataset.tab) return;      // closing: leave things as they are
    const tab = b.dataset.tab;
    setTimeout(() => { activateTab(tab); syncSectionValues(true); draw(); }, 0);
  }, true);
}

/* --- the badge's three parts in the panel ----------------------------------------
   Upper badge ("Powered by"), badge image and lower badge each have their own
   switch; a part's controls show only while it is on, and hiding a part keeps
   everything about it (text, colours, stroke) for when it comes back. Tapping
   a part on the preview opens Badge with that part's controls marked active;
   the lower badge's text field takes the focus, ready to type. Per section,
   like the rest of the badge. */
let badgePart = null;            // 'upper' | 'image' | 'lower' — the part being edited

const lowerState = () => (state.badgeLower = { ...LOWER_DEFAULT(), ...(state.badgeLower || {}) });

function setLower(patch, { rebuild = true } = {}) {
  Object.assign(lowerState(), patch);
  commitScene();
  save();
  if (rebuild) syncBadgeParts();
  draw();
}

function lowerRow(kind) {
  const host = document.querySelector(`.lower-row[data-lower="${kind}"] .swatches`);
  if (!host) return;
  const lo = lowerState();
  const now = lowerColours(lo);
  const current = String(kind === 'ink' ? now.ink : kind === 'fill' ? now.fill : now.stroke).toLowerCase();
  host.innerHTML = '';
  const chip = (value, label, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sw ${cls}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(String(value).toLowerCase() === current));
    b.setAttribute('aria-label', label);
    b.title = label;
    if (cls.includes('sw-colour')) b.style.setProperty('--sw', value);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      badgePart = 'lower';
      selected = 'watermark';
      // the other two colours keep what they show now: one colour never moves another
      const fix = { ink: now.ink, fill: now.fill, stroke: now.stroke };
      setLower({ ...fix, [kind]: value });
    });
    host.append(b);
  };
  if (kind === 'fill') chip('none', 'None (transparent)', 'sw-none');
  for (const { name, hex } of brandSwatches()) chip(hex, name, 'sw-colour');
}

let badgePartsSig = '';
function syncBadgeParts(force) {
  if (mainLowerGate) mainLowerGate.sync();
  const lo = lowerState();
  const sig = JSON.stringify([state.brand, state.scene, state.badge, state.badgePowered, state.badgeImage, state.badgeUpper, state.badgeMiddle, lo, badgePart, selected === 'watermark']);
  if (!force && sig === badgePartsSig) return;
  badgePartsSig = sig;
  const set = badges();
  const key = state.badge === 'auto' ? (activeBd().badge) : state.badge;
  const hasUpper = !!(set[key] && set[key].logoTop) || !set[key];
  $('#bp-upper').hidden = !hasUpper;
  $('#tg-powered').checked = state.badgePowered !== false;
  $('#bp-upper-body').hidden = state.badgePowered === false;
  const up = $('#upper-text');
  if (document.activeElement !== up) up.value = state.badgeUpper == null ? UPPER_DEFAULT_TEXT : state.badgeUpper;
  $('#tg-badge-image').checked = state.badgeImage !== false;
  // the text badge: its middle is words — the image part becomes "Middle text"
  const textKind = !!(set[key] && set[key].kind === 'text');
  const lblImg = $('#bp-image-label'); if (lblImg) lblImg.textContent = textKind ? 'Middle text' : 'Badge image';
  const mid = $('#bp-middle');
  if (mid) {
    mid.hidden = !textKind;
    if (textKind) {
      const k2 = `${state.brand}|${state.scene}`;
      if (!mid.firstChild || mid.dataset.k !== k2) {
        mid.innerHTML = '';
        mid.dataset.k = k2;
        mid.append(middleControls(() => ({ ...MIDDLE_DEFAULT(), ...(state.badgeMiddle || {}) }),
          (patch) => { state.badgeMiddle = { ...MIDDLE_DEFAULT(), ...(state.badgeMiddle || {}), ...patch }; },
          'Badge', () => { selected = 'watermark'; badgePart = 'image'; draw(); }, () => { commitScene(); save(); }));
      } else if (mid.firstChild.refresh) mid.firstChild.refresh();
    }
  }
  // the badge choice and its scale belong to the image, and also style the upper pill
  $('#bp-image-body').hidden = state.badgeImage === false && state.badgePowered === false;
  $('#tg-badge-lower').checked = !!lo.on;
  $('#bp-lower-body').hidden = !lo.on;
  const field = $('#lower-text');
  if (document.activeElement !== field) field.value = lo.text == null ? ((activeBrand() && activeBrand().name) || '') : lo.text;
  field.placeholder = (activeBrand() && activeBrand().name) || 'Text under the badge';
  $('#tg-lower-stroke').checked = !!lo.strokeOn;
  $('#lower-stroke-body').hidden = !lo.strokeOn;
  const sw = Math.max(1, Math.min(LOWER_STROKE_MAX, Number(lo.strokeW) || 3));
  $('#lower-stroke-w').value = sw;
  $('#lower-stroke-w-out').textContent = `${sw} px`;
  const k = Number(lo.scale) || 1;
  $('#lower-scale').value = k;
  $('#lower-scale-out').textContent = `${Math.round(k * 100)}%`;
  if (lo.on) for (const kind of ['ink', 'fill', 'stroke']) lowerRow(kind);
  for (const el of document.querySelectorAll('.badge-part')) el.classList.toggle('is-active', selected === 'watermark' && el.dataset.bpart === badgePart);
}

let mainLowerGate = null;
function wireBadgeParts() {
  {
    // v3.12: the lower badge's colors and stroke sit behind Style: Brand · Custom
    mainLowerGate = styleGate('main-lower', 'Lower badge', () => lowerIsCustom(lowerState()), () => {
      commitScene();
      pushUndo('Lower badge back to the brand style');
      const lo = lowerState();
      state.badgeLower = { ...LOWER_DEFAULT(), on: lo.on, text: lo.text, scale: lo.scale };
      commitScene(); save(); syncBadgeParts(true); draw();
    });
    const body = $('#bp-lower-body'), text = $('#lower-text');
    const moving = [...body.querySelectorAll(':scope > .lower-row'), $('#tg-lower-stroke').closest('label'), $('#lower-stroke-body'), $('#lower-reset')];
    mainLowerGate.box.append(...moving);
    text.after(mainLowerGate.row, mainLowerGate.box);
  }
  // ?debug: the last layout, for tests (never set otherwise)
  if (new URLSearchParams(location.search).has('debug')) window.__studio = { layout: () => lastLayout, state: () => state, draw: () => draw(), hit: (x, y) => { const h = hit({ x, y }); return h && h.key; }, now: () => { const L = layout(ctx, state, canvas.width, canvas.height); return { img: !!L.wm.image, r: L.wmRect, W: canvas.width, H: canvas.height, badge: state.badge }; }, motion: () => motionStats, ovRect: (id) => { const o = overlayById(id); return o ? overlayCanvasRect(o, canvas.width, canvas.height) : null; }, ovLayout: (id) => { const o = overlayById(id); const L = layout(ctx, ovMini(o), canvas.width, canvas.height); return { extras: (L.extras || []).length, xb: (L.xbadges || []).length, dr: (L.drawings || []).length }; }, ovMotion: (id, local, full) => ovMotion(overlayById(id), local, 0, canvas.width, canvas.height, !!full) };
  $('#tg-powered').addEventListener('change', (e) => { state.badgePowered = e.target.checked; badgePart = 'upper'; selected = 'watermark'; commitScene(); save(); syncBadgeParts(true); draw(); });
  $('#tg-badge-image').addEventListener('change', (e) => {
    state.badgeImage = e.target.checked;
    badgePart = 'image'; selected = 'watermark';
    commitScene(); save(); syncBadgeParts(true); draw();
  });
  $('#tg-badge-lower').addEventListener('change', (e) => {
    badgePart = 'lower'; selected = 'watermark';
    setLower({ on: e.target.checked });
    if (e.target.checked && !isPhone()) setTimeout(() => $('#lower-text').focus({ preventScroll: true }), 0);
  });
  $('#upper-text').addEventListener('input', (e) => {
    badgePart = 'upper'; selected = 'watermark';
    state.badgeUpper = e.target.value;
    commitScene(); save(); draw();
  });
  $('#lower-text').addEventListener('input', (e) => { badgePart = 'lower'; selected = 'watermark'; setLower({ text: e.target.value }, { rebuild: false }); });
  $('#tg-lower-stroke').addEventListener('change', (e) => { badgePart = 'lower'; setLower({ strokeOn: e.target.checked }); });
  $('#lower-stroke-w').addEventListener('input', (e) => {
    const v = Math.round(Number(e.target.value));
    $('#lower-stroke-w-out').textContent = `${v} px`;
    setLower({ strokeW: v, strokeOn: true }, { rebuild: false });
  });
  $('#lower-scale').addEventListener('input', (e) => {
    const v = Math.round(Number(e.target.value) * 100) / 100;
    $('#lower-scale-out').textContent = `${Math.round(v * 100)}%`;
    setLower({ scale: v }, { rebuild: false });
  });
  $('#lower-reset').addEventListener('click', () => {
    commitScene();
    pushUndo('Lower badge back to default');
    const on = lowerState().on;
    state.badgeLower = { ...LOWER_DEFAULT(), on, text: lowerState().text };
    commitScene(); save(); syncBadgeParts(true); draw();
  });
  // working in a part's controls marks that part on the preview
  for (const el of document.querySelectorAll('.badge-part')) {
    el.addEventListener('focusin', () => { if (badgePart !== el.dataset.bpart) { badgePart = el.dataset.bpart; selected = 'watermark'; syncBadgeParts(true); draw(); } });
    el.addEventListener('pointerdown', () => { if (badgePart !== el.dataset.bpart) { badgePart = el.dataset.bpart; selected = 'watermark'; syncBadgeParts(true); draw(); } });
  }
  // a tap on the preview: which part of the badge it landed on
  let down = null;
  document.addEventListener('pointerdown', (e) => {
    down = null;
    if (e.target !== canvas) return;
    const L = layout(ctx, state, canvas.width, canvas.height);
    if (!L.badge || !L.badge.rect) return;
    const p = toCanvas(e);
    const pad = canvas.width * 0.01;
    const inR = (r) => r && p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
    const order = ['lower', 'upper', 'image'];
    const part = order.find((k) => inR(L.badge.parts[k]));
    if (!part) return;
    down = { part, x: e.clientX, y: e.clientY };
    badgePart = part;
  }, true);
  document.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    // after the tap has opened Badge: mark the part, and put the cursor in the lower badge's text
    setTimeout(() => {
      syncBadgeParts(true);
      const el = document.querySelector(`.badge-part[data-bpart="${d.part}"]`);
      if (el && el.offsetParent) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const field = d.part === 'lower' ? $('#lower-text') : d.part === 'upper' ? $('#upper-text')
        : d.part === 'image' && isTextBadge(state.badge) ? $('#bp-middle .middle-text') : null;
      if (field && field.offsetParent) { field.focus({ preventScroll: true }); const n = field.value.length; field.setSelectionRange(n, n); }
      draw();
    }, 60);
  }, true);
}

/* --- phones: the full-screen creator is the editor ----------------------------------
   On a phone the canvas is the interface: the top bar (brand, format, Export),
   the full-screen bar (section, + Section, light/dark, Preview, More), the
   canvas as large as the screen allows — any format, scaled to fit, never
   cropped — and the timeline under it. Everything else opens from the canvas:
   tap an element for its controls, tap empty space to add (or change the
   background); More holds Guides and saved designs. Same state as desktop —
   only the layout differs; a wider window goes back to the desktop editor. */
let phoneFs = false;
function sizePhoneCreator() {
  const root = document.documentElement;
  if (!(isPhone() && fsMode)) { root.style.removeProperty('--cv-max'); return; }
  const tb = $('.topbar');
  root.style.setProperty('--tb-h', `${tb ? Math.round(tb.getBoundingClientRect().height) : 60}px`);
  const inner = $('.stage-inner').getBoundingClientRect().height;
  const bar = $('#fs-bar').offsetHeight;
  const tl = fsMode === 'preview' ? 0 : ($('#timeline').offsetHeight + ($('#music-bar').hidden ? 0 : $('#music-bar').offsetHeight + 8));
  root.style.setProperty('--cv-max', `${Math.max(160, Math.floor(inner - bar - tl - 8 * 3))}px`);
}

function wirePhoneCreator() {
  const apply = () => {
    if (isPhone()) {
      if (!fsMode) { phoneFs = true; setFsMode('edit'); }
    } else if (phoneFs && fsMode) { phoneFs = false; setFsMode(null); }
    requestAnimationFrame(sizePhoneCreator);
  };
  phoneMQ.addEventListener('change', apply);
  window.addEventListener('resize', () => requestAnimationFrame(sizePhoneCreator));
  const ro = new ResizeObserver(() => sizePhoneCreator());
  for (const id of ['#timeline', '#music-bar', '#fs-bar']) { const el = $(id); if (el) ro.observe(el); }
  $('#fs-surface').addEventListener('click', () => { $('#surface-toggle').click(); syncFsSurface(); });
  $('#fs-more').addEventListener('click', () => {
    if (sheetTab === 'all') { closeSectionSheet({ focus: false }); return; }
    openSectionSheet('all');
  });
  apply();
  syncFsSurface();
}
function syncFsSurface() {
  const b = $('#fs-surface');
  if (b) b.setAttribute('aria-pressed', String(state.previewSurface === 'light'));
}

/* --- an uploaded background as a pattern ---------------------------------------
   Any uploaded picture (or clip) can be the full background or a pattern: the
   picture repeated edge to edge, at a tile size, optionally mirrored so the
   edges meet. Stored with the background's framing (state.adjust), so it is per
   section, saved, and travels in templates. */
const isPatternUpload = () => { const bd = activeBd(); return !!(bd && bd.upload && bd.adjust && bd.adjust.pattern); };

function syncUploadFit() {
  const bd = activeBd();
  const up = !!(bd && bd.upload);
  $('#upload-fit').hidden = !up;
  if (!up) return;
  const a = adjustFor(state.backdrop);
  const pat = !!a.pattern;
  for (const b of document.querySelectorAll('#seg-upload-fit button')) b.setAttribute('aria-checked', String((b.dataset.f === 'pattern') === pat));
  $('#pattern-controls').hidden = !pat;
  const t = typeof a.tile === 'number' ? a.tile : PATTERN_TILE.initial;
  $('#pat-size').value = t;
  $('#pat-size-out').textContent = `${Math.round(t * 100)}%`;
  $('#pat-mirror').checked = !!a.mirror;
  for (const k of ['gx', 'gy']) {
    const v = typeof a[k] === 'number' ? a[k] : 0;
    $(`#pat-${k}`).value = v;
    $(`#pat-${k}-out`).textContent = `${Math.round(v * 100)}%`;
  }
  refreshBgThumb();   // the gallery tile shows this section's pattern (or the full picture)
}

function wireUploadFit() {
  const edit = (fn) => {
    const bd = activeBd();
    if (!bd || !bd.upload) return;
    const a = adjustFor(state.backdrop);
    fn(a);
    syncAdjust(state.backdrop);
    save();
    syncImageControls();
    draw();
    refreshBgThumb();
  };
  for (const b of document.querySelectorAll('#seg-upload-fit button')) {
    b.addEventListener('click', () => edit((a) => {
      a.pattern = b.dataset.f === 'pattern';
      if (a.pattern && typeof a.tile !== 'number') a.tile = PATTERN_TILE.initial;
      // a fresh start for the framing either way: crop values mean nothing to a pattern
      a.zoom = 1; a.fx = 0.5; a.fy = 0.5; a.ox = 0; a.oy = 0;
    }));
  }
  $('#pat-size').addEventListener('input', (e) => {
    const a = adjustFor(state.backdrop);
    a.tile = Number(e.target.value);
    $('#pat-size-out').textContent = `${Math.round(a.tile * 100)}%`;
    syncAdjust(state.backdrop);
    draw();
  });
  $('#pat-size').addEventListener('change', () => { save(); refreshBgThumb(); });
  for (const k of ['gx', 'gy']) {
    $(`#pat-${k}`).addEventListener('input', (e) => {
      const a = adjustFor(state.backdrop);
      a[k] = Number(e.target.value);
      $(`#pat-${k}-out`).textContent = `${Math.round(a[k] * 100)}%`;
      syncAdjust(state.backdrop);
      draw();
    });
    $(`#pat-${k}`).addEventListener('change', () => { save(); refreshBgThumb(); });
  }
  $('#pat-mirror').addEventListener('change', (e) => edit((a) => { a.mirror = e.target.checked; }));
  $('#pat-reset').addEventListener('click', () => edit((a) => {
    a.tile = PATTERN_TILE.initial; a.mirror = false; a.gx = 0; a.gy = 0; a.zoom = 1; a.fx = 0.5; a.fy = 0.5; a.ox = 0; a.oy = 0;
  }));
}

/* --- save one item as a PNG, straight from its settings ----------------------
   A small "PNG" button in the head of Background, Text, Media and Badge, and on
   every text box, button and media card: that item alone, on a transparent PNG
   cut to its edges, at 2× (2160 wide for a reel) — the same drawing as Export →
   Items as separate PNGs. */
const PNG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>';

function pngButton(id, what) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'png-btn';
  b.innerHTML = `${PNG_ICON}<span>PNG</span>`;
  b.title = `Save ${what} as a PNG`;
  b.setAttribute('aria-label', `Save ${what} as a PNG`);
  b.dataset.png = id;
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); savePanelItem(id, what); });
  return b;
}

async function savePanelItem(id, what) {
  commitScene();
  const it = sectionItems(state.scene).find((x) => x.id === id);
  if (it) await masters(state.scene);
  const cv = it && itemCanvas(state.scene, id, 2, false);
  if (!cv) { showToast(`Nothing to save — ${what} isn’t showing on this section`); return; }
  downloadBlob(await toPng(cv), itemFileName(state.scene, it, cv));
  showToast(`${it.label} saved as PNG · ${cv.width} × ${cv.height}`);
}

function wirePanelPng() {
  const put = (groupSel, id, what) => {
    const head = document.querySelector(`${groupSel} > .group-head`);
    if (!head || head.querySelector('.png-btn')) return;
    const sw = head.querySelector('.switch');
    head.insertBefore(pngButton(id, what), sw || null);
  };
  put('#group-background', 'background', 'the background');
  put('#group-text', 'text', 'the text');
  put('#group-inset', 'inset', 'the media');
  put('#badge-field', 'badge', 'the badge');
}

/* --- items, one PNG each ------------------------------------------------------
   Export → "Items as separate PNGs": the background, each text box, button,
   media and the badge of a section, each on its own transparent PNG — cut to
   the item, or (Full frame) at the full size, where it sits, for layering in
   another editor. Drawn by render.js's renderItem, the same drawing as the
   export; exportImage and the rest of the export are untouched. */

/** Runs fn with section i loaded into `state`, then puts the open section back. */
function withSection(i, fn) {
  commitScene();
  const was = sequencing;
  sequencing = true;
  try {
    if (i !== state.scene) loadScene(i);
    return fn();
  } finally {
    sequencing = was;
    if (i !== state.scene) loadScene(state.scene);
  }
}

/** The smallest box around everything drawn (alpha > 0); null when empty. */
function inkBox(cv) {
  const { width: W, height: H } = cv;
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (d[row + x * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** One item of section i as a canvas: full frame, or cut to the item. */
function itemCanvas(i, id, scale, full) {
  const f = FORMATS[state.format];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale;
  cv.height = f.h * scale;
  withSection(i, () => renderItem(cv.getContext('2d'), cv.width, cv.height, state, id));
  if (full || id === 'background') return cv;
  const b = inkBox(cv);
  if (!b) return null;
  const out = document.createElement('canvas');
  out.width = b.w;
  out.height = b.h;
  out.getContext('2d').drawImage(cv, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return out;
}

const kebabOf = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

function sectionItems(i) {
  const f = FORMATS[state.format];
  const g = document.createElement('canvas').getContext('2d');
  return withSection(i, () => itemsOf(g, state, f.w, f.h));
}

const toPng = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));

/* Before any PNG of section i: its full-resolution artwork (the @2x/@3x masters of
   its background and badge) has to be in, or the file would be drawn from the
   small preview files and look soft or pixelated. */
async function masters(i) {
  withSection(i, () => requestHi(hiKeys()));
  await whenHiReady();
}
const mastersBack = () => requestHi(hiKeys());   // back to what the open section needs

/* A plain .zip (stored, not compressed — PNGs are compressed already). */
let crcTable = null;
function crc32(u8) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let k = 0; k < u8.length; k++) c = crcTable[(c ^ u8[k]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipOf(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
    head.setUint16(8, 0, true); head.setUint16(10, time, true); head.setUint16(12, date, true);
    head.setUint32(14, crc, true); head.setUint32(18, f.data.length, true); head.setUint32(22, f.data.length, true);
    head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
    parts.push(head, name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true); cd.setUint16(12, time, true); cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(cd, name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, x) => n + x.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

let itemsSection = 0;      // which section the list shows; -1 = all of them

function itemScale() {
  const b = document.querySelector('#seg-size button[aria-checked="true"]');
  return Number(b && b.dataset.scale) || 1;
}

function itemFileName(i, it, cv) {
  const sc = state.scenes[i];
  const where = state.scenes.length > 1 ? `-${String(i + 1).padStart(2, '0')}-${kebabOf(sceneName(sc, i))}` : '';
  return `${exportSlug()}${where}-${kebabOf(it.label)}-${cv.width}x${cv.height}.png`;
}

async function saveItem(i, it) {
  await masters(i);
  const cv = itemCanvas(i, it.id, itemScale(), $('#items-full').checked);
  mastersBack();
  if (!cv) { showExportNote(`${it.label} has nothing to draw yet.`); return; }
  downloadBlob(await toPng(cv), itemFileName(i, it, cv));
}

async function saveAllItems() {
  const btn = $('#items-all');
  const which = itemsSection < 0 ? state.scenes.map((_, i) => i) : [itemsSection];
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const files = [];
    for (const i of which) {
      await masters(i);
      for (const it of sectionItems(i)) {
        const cv = itemCanvas(i, it.id, itemScale(), $('#items-full').checked);
        if (!cv) continue;
        const blob = await toPng(cv);
        const name = itemFileName(i, it, cv);
        const dir = which.length > 1 ? `${String(i + 1).padStart(2, '0')}-${kebabOf(sceneName(state.scenes[i], i))}/` : '';
        files.push({ name: dir + name, data: new Uint8Array(await blob.arrayBuffer()) });
        await new Promise((r) => setTimeout(r, 0));     // keep the page responsive
      }
    }
    const tag = which.length > 1 ? 'all-sections' : kebabOf(sceneName(state.scenes[which[0]], which[0]));
    downloadBlob(zipOf(files), `${exportSlug()}-${tag}-items.zip`);
  } finally {
    mastersBack();
    btn.disabled = false;
    syncItemsAll();
  }
}

function syncItemsAll() {
  const n = itemsSection < 0 ? 'every section' : (state.scenes.length > 1 ? sceneName(state.scenes[itemsSection], itemsSection) : 'all items');
  $('#items-all').textContent = `Save ${n === 'all items' ? 'all items' : n} as .zip`;
}

/** The list: a chip per section (and All), then a row per item with a preview. */
function renderItemsList() {
  const host = $('#items-list');
  if (!host) return;
  const chips = $('#items-scenes');
  chips.innerHTML = '';
  chips.hidden = state.scenes.length < 2;
  if (state.scenes.length > 1) {
    const chip = (i, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(itemsSection === i));
      b.textContent = label;
      b.addEventListener('click', () => { itemsSection = i; renderItemsList(); });
      chips.append(b);
    };
    state.scenes.forEach((sc, i) => chip(i, sceneName(sc, i)));
    chip(-1, 'All');
  }
  host.innerHTML = '';
  const show = itemsSection < 0 ? state.scenes.map((_, i) => i) : [itemsSection];
  for (const i of show) {
    if (show.length > 1) {
      const h = document.createElement('p');
      h.className = 'items-head';
      h.textContent = sceneName(state.scenes[i], i);
      host.append(h);
    }
    for (const it of sectionItems(i)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'item-row';
      const prev = document.createElement('span');
      prev.className = 'item-thumb' + (it.id === 'background' ? ' is-bg' : '');
      const cv = itemCanvas(i, it.id, 0.12, false);
      if (cv) prev.style.setProperty('--img', `url(${cv.toDataURL('image/png')})`);
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = it.label;
      const tag = document.createElement('span');
      tag.className = 'item-get';
      tag.textContent = 'PNG';
      b.append(prev, name, tag);
      b.setAttribute('aria-label', `Save ${it.label} as PNG`);
      b.addEventListener('click', () => saveItem(i, it));
      host.append(b);
    }
  }
  syncItemsAll();
}

function wireItemExport() {
  const box = $('#sheet-items');
  if (!box) return;
  // the list follows the section being edited each time the sheet opens
  $('#btn-export').addEventListener('click', () => {
    itemsSection = Math.max(0, Math.min(state.scenes.length - 1, state.scene));
    if (box.open) renderItemsList();
  });
  box.addEventListener('toggle', () => { if (box.open) renderItemsList(); });
  $('#items-all').addEventListener('click', saveAllItems);
}

/* --- templates ------------------------------------------------------------
   A template is the whole design — backdrop, copy, layout, every setting —
   plus a small thumbnail so the list is readable. Media is referenced by
   upload id, so a template whose clip or photo was deleted falls back to a
   built-in backdrop rather than rendering nothing.
   ------------------------------------------------------------------------ */

const TEMPLATE_KEY = 'askruth.backdrop-studio.templates.v1';
const MAX_TEMPLATES = 40;

const DESIGN_KEYS = [
  'brand', 'backdrop', 'format', 'h1', 'body', 'scale', 'h1Scale', 'bodyScale', 'scenes', 'scene', 'sharedBg', 'sharedStill', 'sharedOverlay',
  'visibility', 'textTone', 'badge', 'badgeLast', 'badgeScale', 'badgePowered', 'badgeImage', 'badgeLower', 'badgeUpper', 'badgeMiddle', 'card', 'overlay',
  'adjust', 'inset', 'video', 'pos', 'music', 'textColors', 'cardColors', 'contentType', 'blocks', 'textMode', 'borders', 'buttons', 'media', 'badges',
  'drawings', 'safeFor', 'badgeShape', 'badgeHalo', 'ctaBox', 'overlays', 'captions', 'deck',
];

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; } catch (_) { return []; }
}

function writeTemplates(list) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
    return true;
  } catch (_) {
    return false;   // quota — almost always the thumbnails
  }
}

function snapshot() {
  const out = {};
  for (const k of DESIGN_KEYS) out[k] = clone(state[k]);
  return out;
}

/** A small still of the current canvas, for the template list. */
function thumbDataUrl() {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = Math.round(96 * (canvas.height / canvas.width));
  const g = cv.getContext('2d');
  g.drawImage(canvas, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.6);
}

function saveTemplate(name) {
  const list = loadTemplates();
  const entry = {
    id: `tpl_${Date.now().toString(36)}`,
    name: name.trim().slice(0, 40) || 'Untitled',
    format: state.format,
    created: Date.now(),
    thumb: thumbDataUrl(),
    data: snapshot(),
  };
  list.unshift(entry);
  while (list.length > MAX_TEMPLATES) list.pop();

  // if the thumbnails have filled the quota, drop them oldest-first
  let ok = writeTemplates(list);
  for (let i = list.length - 1; !ok && i >= 0; i--) {
    if (!list[i].thumb) continue;
    delete list[i].thumb;
    ok = writeTemplates(list);
  }
  return ok;
}

async function applyTemplate(entry) {
  dropMulti();   // a selection belongs to the design and section it was made on
  const d = clone(entry.data || {});
  retireIds(d);
  unlinkAll(d);                 // Show on is gone: designs saved with links come in unlinked
  for (const k of DESIGN_KEYS) if (d[k] !== undefined) state[k] = clone(d[k]); if (d.overlays === undefined) state.overlays = [];   // v3.13: a design from before overlay clips has none
  if (d.captions === undefined) state.captions = null;   // v4.1: nor captions
  if (d.deck === undefined) state.deck = null;           // v4.4: nor slides from text
  // templates saved before Header and Body scaled separately carry one `scale`
  state.h1Scale = h1ScaleOf(d);
  state.bodyScale = bodyScaleOf(d);
  if (d.badgePowered === undefined) state.badgePowered = true;
  delete state.scratchColour;
  if (d.badgeLast === undefined) state.badgeLast = d.badge && d.badge !== 'none' ? d.badge : 'auto';

  // a template saved under another brand brings that brand's artwork back with it
  if (!BRANDS[state.brand]) state.brand = DEFAULT_BRAND;
  if (activeBrand().id !== state.brand) await loadAssets(state.brand);

  // heal anything the template references that no longer exists
  state.pos = Object.assign(clone(DEFAULT_POS), state.pos || {});
  if (byId(state.backdrop).id !== state.backdrop) state.backdrop = builtIns()[0].id;
  delete state.mode;
  if (state.inset.id && !mediaFor(state.inset.id)) state.inset.id = null;
  resolveAuto();
  if (!FORMATS[state.format]) state.format = '9x16';

  bindAdjusts();
  setPlayback(state.video);
  save();
  syncBrandUi();
  syncAllControls();
  buildThumbs();
  draw();
  stopPlayback();
  restoreMusic();   // the design's sound, if it has one
  restoreSceneSounds();
}

function deleteTemplate(id) {
  writeTemplates(loadTemplates().filter((t) => t.id !== id));
  renderTemplates();
}

function renderTemplates() {
  const host = $('#templates');
  const list = loadTemplates();
  host.innerHTML = '';
  $('#tpl-empty').hidden = list.length > 0;

  for (const t of list) {
    const row = document.createElement('div');
    row.className = 'tpl';

    const img = document.createElement('img');
    img.alt = '';
    if (t.thumb) img.src = t.thumb;

    const open = document.createElement('button');
    open.className = 'tpl-open';
    open.type = 'button';
    open.dataset.id = t.id;
    open.innerHTML = `<span></span><small>${FORMATS[t.format] ? FORMATS[t.format].sub : ''}</small>`;
    open.firstChild.textContent = t.name;
    open.addEventListener('click', () => applyTemplate(t));

    const del = document.createElement('button');
    del.className = 'tpl-del';
    del.type = 'button';
    del.textContent = '×';
    del.title = `Delete ${t.name}`;
    del.setAttribute('aria-label', `Delete ${t.name}`);
    del.addEventListener('click', () => deleteTemplate(t.id));

    row.append(img, open, del);
    host.append(row);
  }
}

/** Push the whole of `state` back into the controls — used after a template. */
function syncAllControls() {
  ensureScenes();
  // the design's card is the one on the screen it was saved on
  if (state.scenes[state.scene]) {
    state.scenes[state.scene].inset = clone(state.inset);
    if (Array.isArray(state.blocks)) state.scenes[state.scene].blocks = clone(state.blocks);
    for (const k of SCENE_STYLE) if (state[k] !== undefined) state.scenes[state.scene][k] = clone(state[k]);
  }
  loadScene(state.scene);
  renderScenes();
  $('#in-h1').value = state.h1;
  $('#in-body').value = state.body;
  $('#tg-card').checked = state.card;
  $('#tg-guides').checked = state.guides;
  if ($('#tg-grid')) $('#tg-grid').checked = !!state.grid;
  $('#tg-loop').checked = state.video.loop;
  $('#tg-mute').checked = state.video.muted;

  syncScaleOutputs();
  $('#badge-scale').value = state.badgeScale;
  $('#badge-scale-out').textContent = `${Math.round(state.badgeScale * 100)}%`;
  $('#tg-powered').checked = state.badgePowered;
  $('#inset-scale').value = state.inset.scale;
  $('#inset-scale-out').textContent = `${Math.round(state.inset.scale * 100)}%`;
  $('#inset-radius').value = state.inset.radius;
  $('#inset-radius-out').textContent = `${Math.round(state.inset.radius * 100)}%`;

  syncSegments('#seg-tone', 't', 'textTone');
  syncTextControls();
  syncBadgeControls();
  syncFormats();
  syncThumbs();
  syncImageControls();
  syncInsetControls();
}

/* --- video export ---------------------------------------------------------
   MediaRecorder on a canvas stream. It records in real time — a 10 second
   clip takes 10 seconds — but it needs no dependencies and no build step.
   MP4 is preferred where the browser can mux it, because WebM is rejected by
   most social uploaders; otherwise WebM is what you get.
   ------------------------------------------------------------------------ */

const VIDEO_MIMES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_MIMES.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; }
  }) || null;
}

/** The clip whose audio (if any) rides along with the export. */
function primaryVideoId() {
  const bd = activeBd();
  if (bd.kind === 'image' && isVideo(bd.id)) return bd.id;
  if (state.inset.id && isVideo(state.inset.id)) return state.inset.id;
  return null;
}

/** Longest source clip, so the default duration shows the whole thing. */
function sourceDuration() {
  let d = 0;
  for (const id of [activeBd().id, state.inset.id]) {
    const m = id && mediaFor(id);
    if (m && m.media === 'video' && isFinite(m.duration)) d = Math.max(d, m.duration);
  }
  return d;
}

let recording = false;

async function exportVideo(seconds, scale) {
  if (recording) return;
  const mime = pickVideoMime();
  if (!mime) { showExportNote('This browser cannot record video.'); return; }

  const f = FORMATS[state.format];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale;
  cv.height = f.h * scale;
  const g = cv.getContext('2d');

  /* captureStream's automatic frame grabbing is unreliable for an offscreen
     canvas — it can sit there emitting nothing. Asking for 0 fps and calling
     requestFrame() after each paint gives exactly one captured frame per
     rendered frame, which is what an export wants anyway. Browsers without
     requestFrame fall back to the timed version. */
  let stream = cv.captureStream(0);
  let videoTrack = stream.getVideoTracks()[0];
  const manual = !!(videoTrack && typeof videoTrack.requestFrame === 'function');
  if (!manual) {
    stream.getTracks().forEach((t) => t.stop());
    stream = cv.captureStream(30);
    videoTrack = stream.getVideoTracks()[0];
  }

  const audio = primaryVideoId() && audioTrackFor(primaryVideoId());
  if (audio) stream.addTrack(audio);

  let rec;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  } catch (_) {
    showExportNote('This browser cannot record video.');
    return;
  }

  // Start every clip from the top so the export begins where the footage does.
  for (const id of [activeBd().id, state.inset.id]) {
    const m = id && mediaFor(id);
    if (m && m.media === 'video') { try { m.el.currentTime = 0; await m.el.play(); } catch (_) {} }
  }

  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const done = new Promise((resolve) => { rec.onstop = resolve; });
  recording = true;
  rec.start(250);

  /* A fixed timer rather than requestAnimationFrame: rAF stalls whenever the
     page loses focus, which silently produced empty recordings. A timer keeps
     a steady cadence and pairs exactly with requestFrame(). */
  const FPS = 30;
  const t0 = performance.now();
  const total = seconds * 1000;
  let lastNote = '';
  let frames = 0;

  await new Promise((resolve) => {
    const step = () => {
      const elapsed = performance.now() - t0;
      render(g, cv.width, cv.height, state, {});
      if (manual) videoTrack.requestFrame();
      frames++;

      const shown = Math.min(seconds, elapsed / 1000).toFixed(1);
      if (shown !== lastNote) {
        lastNote = shown;
        showExportNote(`Recording… ${shown}s of ${seconds}s`);
      }
      if (elapsed < total) setTimeout(step, 1000 / FPS);
      else resolve();
    };
    step();
  });

  rec.stop();
  await done;
  recording = false;

  stream.getTracks().forEach((t) => { if (t.kind === 'video') t.stop(); });

  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime.split(';')[0] });

  // never hand over a file that turned out empty
  if (!blob.size) {
    showExportNote(`Recording produced no data (${frames} frames drawn) — try another browser.`);
    return;
  }

  downloadBlob(blob, `${exportSlug()}-${cv.width}x${cv.height}.${ext}`);
  showExportNote(ext === 'webm'
    ? 'Saved as WebM — this browser cannot record MP4. Chrome 126+ or Safari will give you MP4.'
    : '');
}

/* --- v3.8 · finished files on phones -------------------------------------------------------
   A browser only saves a file when the person has just tapped something. A video records for
   as long as it plays, so by the time it is ready that tap has expired — iPhone Safari then
   silently drops the download (the export "did nothing"). On a phone or in Safari, a file
   finished long after the tap waits in a bar with a Save button instead: one tap, and the
   phone's share sheet opens (Save Video puts it in Photos), or it downloads where sharing
   files isn't offered. Desktop Chrome and Firefox keep downloading straight away.
   (downloadBlob's own body is unchanged; the binding is wrapped here.) */
const directDownload = downloadBlob;
const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent || '');
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };
let readyFiles = [];
let readyTimer = 0;
// the last real tap / click / key: a browser's "just tapped" window is ~1 s in Safari, ~5 s in Chrome
let lastGesture = 0;
for (const t of ['pointerup', 'click', 'keydown', 'touchend']) document.addEventListener(t, (e) => { if (e.isTrusted) lastGesture = performance.now(); }, true);
// eslint-disable-next-line no-func-assign
downloadBlob = function deliverBlob(blob, name) {
  const windowMs = isSafari ? 1000 : 4500;
  const fresh = performance.now() - lastGesture < windowMs && (!navigator.userActivation || navigator.userActivation.isActive);
  if (fresh || !(coarse() || isSafari)) { directDownload(blob, name); return; }
  readyFiles.push({ blob, name });
  clearTimeout(readyTimer);
  readyTimer = setTimeout(showReadyBar, 900);   // a cover image follows the video: offer them together
};
function readyLabel(files) {
  const v = files.filter((f) => /\.(mp4|webm|mov)$/i.test(f.name)).length;
  const im = files.length - v;
  if (v && im) return 'Your video and cover are ready';
  if (v) return 'Your video is ready';
  return im > 1 ? `Your ${im} images are ready` : 'Your image is ready';
}
function showReadyBar() {
  let bar = $('#ready-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ready-bar';
    bar.className = 'ready-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="ready-txt"></span><button type="button" class="ready-save">Save</button><button type="button" class="ready-x" aria-label="Dismiss">×</button>';
    document.body.append(bar);
    bar.querySelector('.ready-x').addEventListener('click', () => { bar.hidden = true; readyFiles = []; });
    bar.querySelector('.ready-save').addEventListener('click', saveReadyFiles);
  }
  if (!readyFiles.length) return;
  bar.querySelector('.ready-txt').textContent = readyLabel(readyFiles);
  bar.hidden = false;
}
async function saveReadyFiles() {
  const bar = $('#ready-bar');
  const list = readyFiles;
  if (!list.length) { if (bar) bar.hidden = true; return; }
  const files = list.map(({ blob, name }) => new File([blob], name, { type: blob.type || 'application/octet-stream' }));
  let shared = false;
  try {
    if (navigator.canShare && navigator.share && navigator.canShare({ files })) {
      await navigator.share({ files, title: readyLabel(list).replace(/^Your /, '').replace(/ (is|are) ready$/, '') });
      shared = true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // closed the share sheet: the files stay offered
  }
  if (!shared) for (const { blob, name } of list) { directDownload(blob, name); await new Promise((r) => setTimeout(r, 350)); }
  readyFiles = [];
  if (bar) bar.hidden = true;
}

function exportSlug() {
  const kebab = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = kebab(byId(state.backdrop).name) || 'backdrop';
  return `${kebab(activeBrand().id) || 'backdrop'}-${slug}`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function showExportNote(text) {
  const el = $('#export-note');
  el.textContent = text || '';
  el.hidden = !text;
}

/* --- wiring -------------------------------------------------------------- */

function bindText(id, key) {
  const el = $(id);
  el.value = state[key];
  el.addEventListener('input', () => {
    state[key] = el.value;
    save();
    draw();
  });
}

function bindToggle(id, key) {
  const el = $(id);
  el.checked = state[key];
  el.addEventListener('change', () => {
    state[key] = el.checked;
    save();
    draw();
  });
}

/* --- image + overlay controls -------------------------------------------- */

function buildOverlaySegments() {
  const host = $('#seg-overlay');
  host.innerHTML = '';
  for (const [key, o] of Object.entries(OVERLAYS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.o = key;
    b.textContent = o.label;
    b.addEventListener('click', () => {
      state.overlay.style = key;
      syncImageControls();
      save();
      draw();
    });
    host.append(b);
  }
}

function syncImageControls() {
  const bd = activeBd();
  const on = isImage();
  const isTile = bd.kind === 'tile';

  $('#image-controls').hidden = !on || isPatternUpload();
  syncUploadFit();
  $('#tile-controls').hidden = !isTile;
  // v3.23 · stripes: Size is the bar width; Spacing, Offset rows and Mirror mean nothing for bars
  $('#tile-controls').classList.toggle('is-stripes', !!(isTile && bd.stripes));
  const sl = $('#tile-scale') && $('#tile-scale').closest('.slider-row');
  if (sl) sl.querySelector('span').textContent = isTile && bd.stripes ? 'Width' : 'Size';
  $('#video-controls').hidden = !hasMotion();
  // only name the blocks that are actually on the canvas right now
  const parts = [];
  if (hasBadges() && state.badge !== 'none') parts.push('the badge');
  if (state.visibility !== 'none') parts.push('the text');
  if (state.inset.id && !state.inset.hidden) parts.push('the photo / video card');
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
    : parts[0];

  const hint = $('#stage-hint');
  const moves = list ? `Drag ${list} to reposition` : '';
  const crop = on ? 'drag the picture to move it' : '';
  const edit = 'tap anything to jump to its settings';
  const first = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  void moves; void crop; void edit; void first;
  hint.textContent = 'Drag to move · tap to edit';
  hint.hidden = !hint.textContent;

  if (isTile) {
    const t = tileScale(bd);
    $('#tile-scale').value = t;
    $('#tile-scale-out').textContent = `${Math.round(t * 100)}%`;
    $('#tg-tile-mirror').checked = !!(state.adjust[bd.id] && state.adjust[bd.id].mirror);
  }
  // Dim applies to every background, so it syncs before the image-only part
  // Tone down: one slider, always there; 0 is off
  const tone = state.overlay.style === 'none' ? 0 : state.overlay.strength;
  $('#ov-strength').value = tone;
  $('#ov-strength-out').textContent = tone ? `${Math.round(tone * 100)}%` : 'Off';
  // a template saved with a retired wash ('brand' / 'fade') shows as Dim
  if (OVERLAYS[state.overlay.style] === undefined) state.overlay.style = overlayStyle(state.overlay.style);
  for (const el of document.querySelectorAll('#seg-overlay button')) {
    el.setAttribute('aria-checked', String(el.dataset.o === state.overlay.style));
  }
  $('#wash-controls').querySelector('.slider-row').hidden = false;

  if (!on) return;

  const a = adjustFor(state.backdrop);
  $('#img-zoom').value = a.zoom;
  $('#img-zoom-out').textContent = `${Math.round(a.zoom * 100)}%`;
}

/** Drop a newly added card below whatever text is showing, in every format,
    so it never lands hidden behind the text panel. */
function placeInsetClearOfText() {
  for (const [fmt, f] of Object.entries(FORMATS)) {
    const probe = { ...state, format: fmt };
    const L = layout(ctx, probe, f.w, f.h);
    if (!L.ins.image) return;
    const gap = Math.min(f.w, f.h) * 0.04;
    const below = L.tx.empty ? L.wmRect.y + L.wmRect.h : L.txRect.y + L.tx.h;
    const y = Math.max(0, Math.min(below + gap, f.h - L.ins.h - gap));
    state.pos[fmt].inset = { x: 0.5, y: y / f.h };
  }
}

function syncInsetControls() {
  const on = !!(state.inset.id);
  $('#inset-controls').hidden = !on;
  $('#inset-label').innerHTML = on
    ? 'Replace<small>Sits on the backdrop in a rounded frame</small>'
    : 'Add image or video<small>Sits on the backdrop in a rounded frame</small>';
  $('#inset-scale').value = state.inset.scale;
  $('#inset-scale-out').textContent = `${Math.round(state.inset.scale * 100)}%`;
  $('#inset-radius').value = state.inset.radius;
  $('#inset-radius-out').textContent = `${Math.round(state.inset.radius * 100)}%`;
}

function wireInset() {
  const input = $('#inset-input');
  const err = $('#inset-error');

  $('#btn-inset').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const previous = state.inset.id;
      const meta = await addUpload(file, 'inset');
      state.inset.id = meta.id;
      // one card at a time — don't leave the old file taking up space
      if (previous && previous !== meta.id) await removeUpload(previous);
      if (!previous) placeInsetClearOfText();
      err.hidden = true;
    } catch (e) {
      err.textContent = e.message || String(e);
      err.hidden = false;
      return;
    }
    save();
    syncInsetControls();
    syncImageControls();
    draw();
  });

  $('#inset-scale').addEventListener('input', (e) => {
    state.inset.scale = Number(e.target.value);
    $('#inset-scale-out').textContent = `${Math.round(state.inset.scale * 100)}%`;
    save();
    draw();
  });

  $('#inset-radius').addEventListener('input', (e) => {
    state.inset.radius = Number(e.target.value);
    $('#inset-radius-out').textContent = `${Math.round(state.inset.radius * 100)}%`;
    save();
    draw();
  });

  $('#inset-remove').addEventListener('click', async () => {
    const id = state.inset.id;
    state.inset.id = null;
    if (id) await removeUpload(id);
    save();
    syncInsetControls();
    syncImageControls();
    draw();
  });
}

/* The panel's Remove button deletes the card's file; with a card per screen
   that file may still be on another screen, so then it only comes off this one. */
function guardCardRemove() {
  $('#inset-remove').addEventListener('click', (e) => {
    const id = state.inset.id;
    if (!id || !cardInUse(id)) return;          // the usual path deletes it
    e.stopImmediatePropagation();
    removeSceneCard();
  }, true);
  // replacing a card deletes the old file — not while another screen still shows it
  $('#inset-input').addEventListener('change', (e) => {
    const id = state.inset.id;
    if (e.target.files.length && id && cardInUse(id)) state.inset.id = null;
  }, true);
}

function wireUploads() {
  const input = $('#file-input');
  $('#btn-upload').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length) importFiles([...input.files]);
    input.value = '';
  });

  // Drop anywhere on the page.
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (++depth === 1) document.body.classList.add('dropping');
  });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    if (--depth <= 0) { depth = 0; document.body.classList.remove('dropping'); }
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dropping');
    const files = [...e.dataTransfer.files].filter((f) => /^(image|video)\//.test(f.type));
    if (files.length) importFiles(files);
  });

  $('#img-zoom').addEventListener('input', (e) => {
    const a = adjustFor(state.backdrop);
    a.zoom = Number(e.target.value);
    syncAdjust(state.backdrop);
    $('#img-zoom-out').textContent = `${Math.round(a.zoom * 100)}%`;
    save();
    draw();
  });

  $('#tile-scale').addEventListener('input', (e) => {
    const a = adjustFor(state.backdrop);
    a.zoom = Number(e.target.value);
    syncAdjust(state.backdrop);
    $('#tile-scale-out').textContent = `${Math.round(a.zoom * 100)}%`;
    save();
    draw();
  });

  $('#badge-scale').addEventListener('input', (e) => {
    state.badgeScale = Number(e.target.value);
    $('#badge-scale-out').textContent = `${Math.round(state.badgeScale * 100)}%`;
    save();
    draw();
  });

  $('#ov-strength').addEventListener('input', (e) => {
    state.overlay.strength = Number(e.target.value);
    $('#ov-strength-out').textContent = `${Math.round(state.overlay.strength * 100)}%`;
    save();
    draw();
  });
}

/* The preview sticks below the top bar on a phone, so the offset has to be the
   bar's real height — it changes with the webfont, a long brand name and the
   phone's own text-size setting, so it is measured rather than guessed. */
function trackTopbar() {
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  const set = () => document.documentElement.style.setProperty(
    '--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(bar);
  else window.addEventListener('resize', set);
  document.fonts.ready.then(set).catch(() => {});
}

/* --- no more "auto" ---------------------------------------------------------
   Text colour and badge style used to have an Auto setting that followed the
   backdrop. They are now set by hand. A save or template from before keeps
   its look: Auto is resolved once, to exactly what it was showing.
   ------------------------------------------------------------------------ */

function resolveAuto() {
  const bd = byId(state.backdrop);
  if (state.textTone !== 'light' && state.textTone !== 'dark') {
    // what Auto showed: with the text panel on, a backdrop's own panel colour
    // set the type; otherwise the ground did
    state.textTone = state.card && bd.card && bd.card !== 'none'
      ? (bd.card === 'cream' ? 'dark' : 'light')
      : (bd.tone === 'dark' ? 'light' : 'dark');
  }
  const set = badges();
  const fallback = Object.keys(set)[0] || 'plum';
  const pick = (v) => (set[v] ? v : (set[bd.badge] ? bd.badge : fallback));
  if (state.badge !== 'none') state.badge = pick(state.badge === 'auto' ? bd.badge : state.badge);
  state.badgeLast = pick(state.badgeLast === 'auto' || !state.badgeLast ? bd.badge : state.badgeLast);
}

/* --- elements: show/hide and their own controls ---------------------------
   Header and Body each have a switch. Under the hood they still write the one
   `visibility` value the renderer, thumbnails and saved templates already use,
   so nothing downstream had to change. Hiding an element keeps its text and
   scale; switching it back on brings both back.
   ------------------------------------------------------------------------ */

const showsH1 = () => state.visibility === 'both' || state.visibility === 'h1';
const showsBody = () => state.visibility === 'both' || state.visibility === 'body';

function setVisibility(h1, body) {
  state.visibility = h1 && body ? 'both' : h1 ? 'h1' : body ? 'body' : 'none';
  syncTextControls();
  syncImageControls();      // the stage hint names whatever is on the canvas
  save();
  draw();
}

/** Show only the controls that apply to what is on the canvas. */
function syncTextControls() {
  const h1 = showsH1();
  const body = showsBody();
  $('#tg-h1').checked = h1;
  $('#tg-body').checked = body;
  $('#h1-controls').hidden = !h1;
  $('#body-controls').hidden = !body;
  // colour and panel style the text, so they go when there is none
  $('#group-text-style').hidden = !h1 && !body;
  syncTextMode();
}

/* One Text section: a switch for the text, then Header or Header + body.
   (A body without its header isn't offered; an older design that had one
   opens as Header + body.) The last choice is remembered while text is off. */
function syncTextMode() {
  // a design saved with the header or the body alone shows both now (an empty part draws nothing)
  if (state.visibility === 'h1' || state.visibility === 'body') state.visibility = 'both';
  const on = state.visibility !== 'none';
  if (state.visibility === 'h1' || state.visibility === 'both') state.textMode = state.visibility;
  const mode = state.visibility === 'h1' ? 'h1' : state.visibility === 'none' ? (state.textMode || 'both') : 'both';
  $('#tg-text').checked = on;
  $('#seg-textmode').hidden = true;     // no Header / Header + body choice: an empty body simply shows nothing
  // the options are there whether or not the text is on; using one switches it on
  $('#h1-controls').hidden = false;
  $('#body-controls').hidden = false;
  $('#group-h1').hidden = false;
  $('#group-blocks').hidden = false;
  $('#group-body').hidden = false;
  $('#group-text-style').hidden = false;
  for (const g of ['#group-h1', '#group-blocks', '#group-body', '#group-text-style']) $(g).classList.toggle('is-off', !on);
}

/* A section's options show even while its switch is off (faded); using any of
   them — a tap, a pick, typing, a slider — switches the element on first. */
function wireAutoOn() {
  const turnOn = (el) => {
    const off = el && el.closest('.is-off[data-turns-on]');
    if (!off) return;
    const what = off.dataset.turnsOn;
    if (what === 'badge' && !$('#tg-badge').checked) $('#tg-badge').click();
    else if (what === 'card' && !$('#tg-inset').checked) $('#tg-inset').click();
    else if (what === 'text' && state.visibility === 'none') setVisibility(true, true);
  };
  for (const t of ['click', 'focusin', 'input']) document.addEventListener(t, (e) => turnOn(e.target), true);
}

function wireTextMode() {
  $('#tg-text').addEventListener('change', (e) => {
    if (e.target.checked) { fillTextPlaceholders(); setVisibility(true, true); }
    else setVisibility(false, false);
  });
  for (const b of document.querySelectorAll('#seg-textmode [data-m]')) {
    b.addEventListener('click', () => { state.textMode = b.dataset.m; setVisibility(true, b.dataset.m === 'both'); });
  }
  // one switch now: older designs with the header or the body alone show both (an empty part draws nothing)
  if (state.visibility === 'body' || state.visibility === 'h1') setVisibility(true, true);
  syncTextMode();
}

const clampScale = (v) => Math.round(Math.max(0.6, Math.min(1.8, v)) * 100) / 100;

function syncScaleOutputs() {
  for (const [key, id] of [['h1Scale', 'h1-scale'], ['bodyScale', 'body-scale']]) {
    $(`#${id}`).value = state[key];
    $(`#${id}-out`).textContent = `${Math.round(state[key] * 100)}%`;
  }
}

function setElementScale(key, next) {
  state[key] = clampScale(next);
  syncScaleOutputs();
  save();
  draw();
}

/* The badge used to be switched off by picking the "None" style. It is now a
   switch like Header and Body; "none" is still what gets stored, so existing
   templates and the renderer read it unchanged. */
function syncBadgeControls() {
  const on = state.badge !== 'none';
  $('#tg-badge').checked = on;
  $('#badge-controls').hidden = false;
  $('#badge-controls').classList.toggle('is-off', !on);
  syncBadgeThumbs();
}

function setBadgeVisible(on) {
  if (on) state.badge = state.badgeLast || Object.keys(badges())[0];
  else {
    if (state.badge !== 'none') state.badgeLast = state.badge;
    state.badge = 'none';
  }
  syncBadgeControls();
  syncImageControls();
  save();
  draw();
}

/* --- badge thumbnails -------------------------------------------------------
   The brand's badges as small pictures of the artwork itself — a brand can
   ship more than Light and Dark (T4R has round portrait badges too). */

/** A badge's thumbnail: its artwork, or for the text badge the brand's own text badge. */
function badgeThumbSrc(b) {
  if (b && b.kind === 'text') { try { return textBadgeImage({ badgeMiddle: null }).toDataURL('image/png'); } catch (_) { return ''; } }
  return activeBrand().assets[b.asset];
}
const isTextBadge = (key) => { const v = badges()[key]; return !!(v && v.kind === 'text'); };

/* The text badge's middle: its words and its text / background colours (the
   brand's five), for the section's badge and for each extra badge. */
function middleControls(getMid, setMid, label, pick, done) {
  const brandName = (activeBrand() && activeBrand().name) || '';
  const wrap = document.createElement('div');
  wrap.className = 'badge-middle';
  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'lower-text middle-text';
  text.maxLength = 40;
  text.placeholder = brandName || 'Badge text';
  text.value = getMid().text == null ? brandName : getMid().text;
  text.setAttribute('aria-label', `${label} middle text`);
  text.spellcheck = true;
  text.dataset.bpart = 'image';
  text.addEventListener('input', () => { setMid({ text: text.value }); draw(); });
  text.addEventListener('change', done);
  text.addEventListener('focus', pick);
  const rows = {};
  const row = (kind, name) => {
    const line = document.createElement('div');
    line.className = 'swatch-line lower-row';
    line.setAttribute('role', 'radiogroup');
    line.setAttribute('aria-label', `${label} middle ${name.toLowerCase()}`);
    line.innerHTML = `<span class="swatch-lbl">${name}</span><span class="swatches"></span>`;
    rows[kind] = line.querySelector('.swatches');
    return line;
  };
  // built once; later only the ticks move (a rebuild under the pointer would eat the click)
  const paint = () => {
    const now = middleColours(getMid());
    for (const kind of ['ink', 'fill']) {
      const host = rows[kind];
      if (host.children.length) {
        for (const c of host.children) c.setAttribute('aria-checked', String(c.dataset.hex === String(now[kind]).toLowerCase()));
        continue;
      }
      for (const { name, hex } of brandSwatches()) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'sw sw-colour';
        c.setAttribute('role', 'radio');
        c.setAttribute('aria-checked', String(hex.toLowerCase() === String(now[kind]).toLowerCase()));
        c.setAttribute('aria-label', name);
        c.title = name;
        c.style.setProperty('--sw', hex);
        c.dataset.hex = hex.toLowerCase();
        c.addEventListener('click', (e) => { e.stopPropagation(); const fix = middleColours(getMid()); setMid({ ink: fix.ink, fill: fix.fill, [kind]: hex }); pick(); done(); paint(); draw(); });
        host.append(c);
      }
    }
  };
  wrap.append(text, row('ink', 'Text'), row('fill', 'Background'));
  paint();
  wrap.refresh = () => { if (document.activeElement !== text) text.value = getMid().text == null ? brandName : getMid().text; paint(); };
  return wrap;
}

function buildBadgeThumbs() {
  const host = $('#badge-thumbs');
  host.innerHTML = '';
  delete host.dataset.sig;
  const brand = activeBrand();
  for (const [key, b] of Object.entries(badges())) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'badge-thumb';
    btn.setAttribute('role', 'radio');
    btn.dataset.b = key;
    btn.setAttribute('aria-label', b.label || key);
    btn.title = b.label || key;
    const im = document.createElement('img');
    im.src = badgeThumbSrc(b);
    im.alt = '';
    im.decoding = 'async';
    const check = document.createElement('span');
    check.className = 'thumb-check';
    check.setAttribute('aria-hidden', 'true');
    btn.append(im, check);
    host.append(btn);
  }
  syncBadgeThumbs();
}

function syncBadgeThumbs() {
  for (const el of document.querySelectorAll('#badge-thumbs .badge-thumb')) {
    el.setAttribute('aria-checked', String(el.dataset.b === state.badge));
  }
  layoutStrip('#badge-thumbs', '#badge-show-all', state.badge, 'b');
}

/* --- four to a row, "Show all" for the rest -------------------------------
   The background gallery and the badge set show four items; the chosen one
   is always among them. "Show all" opens the whole set in a modal — the very
   same buttons are moved in, so picking works exactly as in the panel. */

function layoutStrip(hostSel, btnSel, selected, attr) {
  const host = $(hostSel);
  const btn = $(btnSel);
  if (!host || !btn) return;
  const items = [...host.children].filter((el) => !host.dataset.k || !el.dataset.k || el.dataset.k === host.dataset.k);
  const open = host.classList.contains('is-expanded');
  const sig = `${selected}|${items.length}|${host.parentElement.id}|${open}|${host.dataset.k || ''}`;
  if (host.dataset.sig === sig) return;          // paint runs every frame during video
  host.dataset.sig = sig;
  const idOf = (el) => (attr === 'id' ? (el.querySelector('.thumb') || el).dataset.id : el.dataset[attr]);
  const idx = items.findIndex((el) => idOf(el) === selected);
  // all of them in one row that scrolls sideways (a carousel); Show all opens the full set
  for (const el of items) el.classList.remove('is-extra');
  btn.hidden = items.length <= 4 || host.parentElement.id === 'picker-body';
  btn.textContent = `Show all ${items.length}`;
  if (idx >= 0 && host.parentElement.id !== 'picker-body') {
    const el = items[idx];
    requestAnimationFrame(() => {
      const l = el.offsetLeft - host.offsetLeft, r = l + el.offsetWidth;
      if (l < host.scrollLeft || r > host.scrollLeft + host.clientWidth) host.scrollTo({ left: Math.max(0, l - 8), behavior: 'smooth' });
    });
  }
}

const picker = { host: null, home: null, opener: null };

function openPicker(hostSel, title, opener) {
  const host = $(hostSel);
  picker.host = host;
  picker.home = document.createComment('picker-home');
  host.before(picker.home);
  picker.opener = opener;
  $('#picker-title').textContent = title;
  $('#picker-sub').textContent = hostSel === '#templates' ? 'Open one — or delete the ones you no longer need.' : 'Pick one — it replaces the current choice.';
  $('#picker').classList.toggle('is-templates', hostSel === '#templates');
  $('#picker-body').append(host);
  const bgs = hostSel === '#thumbs';
  $('#picker-add').hidden = !bgs;
  if (bgs) {
    // the colour row comes along (moved, not copied), under the add buttons
    const row = $('#bg-colours');
    picker.rowHome = document.createComment('colours-home');
    row.before(picker.rowHome);
    $('#picker-colours').append(row);
  }
  $('#picker').hidden = false;
  const chosen = host.querySelector('[aria-checked="true"]') || host.querySelector('button');
  if (chosen) chosen.focus();
}

function closePicker() {
  if (!picker.host) return;
  picker.home.replaceWith(picker.host);
  picker.host = null;
  if (picker.rowHome) { picker.rowHome.replaceWith($('#bg-colours')); picker.rowHome = null; }
  $('#picker').hidden = true;
  layoutStrip('#thumbs', '#bg-show-all', state.backdrop, 'id');
  layoutStrip('#badge-thumbs', '#badge-show-all', state.badge, 'b');
  const tb = $('#tpl-show-all'); const n = $('#templates').querySelectorAll('.tpl').length;
  tb.hidden = n <= 4; tb.textContent = `Show all ${n}`;
  if (picker.opener) picker.opener.focus();
}

function wirePicker() {
  $('#bg-show-all').addEventListener('click', (e) => openPicker('#thumbs', 'Backgrounds', e.currentTarget));
  $('#badge-show-all').addEventListener('click', (e) => openPicker('#badge-thumbs', 'Badges', e.currentTarget));
  // saved designs: more than four → Show all N, the same modal
  $('#tpl-show-all').addEventListener('click', (e) => openPicker('#templates', 'Saved designs', e.currentTarget));
  const syncTplShowAll = () => {
    const host = $('#templates');
    const n = host.querySelectorAll('.tpl').length;
    const btn = $('#tpl-show-all');
    btn.hidden = n <= 4 || host.parentElement.id === 'picker-body';
    btn.textContent = `Show all ${n}`;
  };
  new MutationObserver(syncTplShowAll).observe($('#templates'), { childList: true });
  syncTplShowAll();
  // in the Backgrounds modal: add your own — a file, the camera, a colour
  $('#picker-upload').addEventListener('click', () => $('#file-input').click());
  $('#picker-camera').addEventListener('click', () => { closePicker(); openCamera('background'); });
  $('#picker-close').addEventListener('click', closePicker);
  $('#picker').addEventListener('click', (e) => { if (e.target === e.currentTarget) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#picker').hidden) closePicker(); });
  // a pick in the modal is the answer — close once the item's own handler has run
  $('#picker-body').addEventListener('click', (e) => {
    if (e.target.closest('.thumb-remove')) return;
    if (e.target.closest('.tpl-del')) return;
    if (e.target.closest('.thumb, .badge-thumb, .tpl-open')) setTimeout(closePicker, 0);
  });
}

/* --- background colour ----------------------------------------------------
   A brand colour as the whole background — the alternative to a pattern or
   artwork. The seven swatches are the brand's solid backdrops (brands.js), so
   a colour is an ordinary backdrop: it exports, saves and travels in
   templates exactly like the rest, and switching brand swaps the seven. */

const solidColours = () => builtIns().filter((b) => b.kind === 'solid' && b.listed !== false).slice(0, 7);

function buildColourRow() {
  const row = $('#bg-colours');
  const box = row.querySelector('.swatches');
  box.innerHTML = '';
  const list = solidColours();
  loadCustomColors();
  row.hidden = false;
  for (const bd of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', bd.name);
    b.title = bd.name;
    b.style.setProperty('--sw', bd.base);
    b.dataset.id = bd.id;
    box.append(b);
  }
  // your own colours as backgrounds, then + for a new one
  const idOf = (hex) => `solid-custom-${hex.slice(1)}`;
  for (const hex of customColors) {
    const el = customSwatch(hex, state.backdrop === idOf(hex), 'swatch', {
      pick: (h) => pickColour(idOf(h)),
      live: (h) => { colourRowFor = idOf(h); pickColour(idOf(h)); },
      done: (from, to) => { replaceCustomColor(from, to); pickColour(idOf(to)); buildColourRow(); syncColorRows(true); },
      remove: (h) => { removeCustomColor(h); buildColourRow(); syncColorRows(true); },
    });
    // the row's own click handler picks by data-id: give it the id too
    const sw = el.classList.contains('swatch') ? el : el.querySelector('.swatch');
    sw.dataset.id = idOf(hex);
    box.append(el);
  }
  colourRowFor = state.backdrop;
  const cur = activeBd();
  const add = colorAddChip('swatch swatch-add', cur.kind === 'solid' ? cur.base : '#ff8eff',
    (hex) => { colourRowFor = `solid-custom-${hex.slice(1)}`; pickColour(`solid-custom-${hex.slice(1)}`); },
    (hex) => { addCustomColor(hex); pickColour(`solid-custom-${hex.slice(1)}`); setTimeout(() => { buildColourRow(); syncColorRows(true); }, 0); });
  add.addEventListener('click', (e) => e.stopPropagation());
  box.append(add);
  capCustom(box);
  syncColourRow();
}

let colourRowFor = null;
function syncColourRow() {
  // a custom colour that becomes (or stops being) the background swaps its swatch for the editable one
  if (colourRowFor !== state.backdrop && (/^solid-custom-/.test(state.backdrop) || /^solid-custom-/.test(colourRowFor || ''))) {
    colourRowFor = state.backdrop;
    buildColourRow();
    return;
  }
  colourRowFor = state.backdrop;
  const all = [...document.querySelectorAll('#bg-colours .swatch[data-id]')];
  const any = all.some((b) => b.dataset.id === state.backdrop);
  for (const [i, b] of all.entries()) {
    const on = b.dataset.id === state.backdrop;
    if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
    b.tabIndex = on || (!any && i === 0) ? 0 : -1;
  }
}

/* Light/Dark is respected: with no text panel, type that would not read on the
   new colour (under 3:1) flips to the other text colour. */
function pickColour(id) {
  state.backdrop = id;
  const bd = byId(id);
  if (!state.card && state.visibility !== 'none') {
    const bare = bareStyles();
    const now = state.textTone === 'dark' ? bare.onLight : bare.onDark;
    if (contrast(now.h1, bd.base) < 3) {
      state.textTone = state.textTone === 'dark' ? 'light' : 'dark';
      syncSegments('#seg-tone', 't', 'textTone');
    }
  }
  syncThumbs();
  syncColourRow();
  syncImageControls();
  save();
  draw();
}

/* --- v3.1 · Background inspector ---------------------------------------------------
   Pick a kind (Colour · Pattern · Image) and only that kind's choices and controls
   show. Opening Background (tapping the empty canvas included) opens the tab of the
   background in use; picking another background follows it. Tone down stays on top,
   for every kind. A colour can become a brand-safe Gradient (backdrops.js: gradientBd).
   Patterns — the brand's and an upload used as one — get Scale, Spacing and Offset rows. */
const bgKindOf = (bd) => (!bd ? 'pattern' : bd.kind === 'solid' || bd.kind === 'gradient' || bd.stripes ? 'colour'   /* v4.1: striped bands are colours */ : bd.kind === 'tile' ? 'pattern' : bd.kind === 'cogent' ? 'cogent'
  : bd.upload && state.adjust[bd.id] && state.adjust[bd.id].pattern ? 'pattern' : 'image');   // v3.1: an upload used as a pattern is listed under Pattern
let bgKind = null;          // the tab open in Background
let bgKindFor = null;       // …and the background it was opened for (a new pick resets it)
let bgSig = '';
let bgWhere = '';
let bgCurKind = null;

/** A background that repeats: a brand pattern, an upload used as one, a cogent pattern. */
function isPatternBg(bd) {
  if (!bd) return false;
  const a = state.adjust[bd.id] || {};
  return bd.kind === 'tile' || (bd.upload && a.pattern) || (bd.kind === 'cogent' && (a.layout || 'pattern') === 'pattern');
}
/** v3.1: text on a pattern never starts bare — it gets its Light / Dark box (switch it off again if you like). */
function boxTextOnPattern() {
  let changed = false;
  if (noBg(state)) { setNoBg(state, false); changed = true; }
  for (const b of state.blocks || []) if (b.style && noBg(b.style)) { setNoBg(b.style, false); changed = true; }
  if (!changed) return;
  $('#tg-card').checked = true;
  commitScene(); save(); renderBlocks(); syncColorRows(true);
  showToast('Text box on, to read on the pattern', 'Undo', () => { setNoBg(state, true); commitScene(); save(); syncColorRows(true); draw(); });
}
function bgKindsAvailable() {
  const ks = new Set(['colour', 'image']);
  if (builtIns().some((b) => b.kind === 'tile' && !b.stripes && b.listed !== false)) ks.add('pattern');
  if (builtIns().some((b) => b.kind === 'cogent')) ks.add('cogent');
  return ks;
}
function setBgKind(k) { bgKind = k; bgKindFor = state.backdrop; bgSig = ''; syncBgInspector(); }

/** The second colour a gradient starts with: the brand's own partner, else the nearest brand colour that still shows. */
function gradPartner(fromHex, fromId) {
  const br = activeBrand();
  const want = br.gradients && fromId && br.gradients[fromId];
  if (want) { const bd = builtIns().find((b) => b.id === want); if (bd && bd.base.toLowerCase() !== fromHex.toLowerCase()) return bd.base; }
  const L = colourLuminance(fromHex);
  const opts = solidColours().filter((b) => b.base.toLowerCase() !== fromHex.toLowerCase())
    .map((b) => ({ hex: b.base, d: Math.abs(colourLuminance(b.base) - L) }))
    .sort((a, b) => (a.d < 0.03) - (b.d < 0.03) || a.d - b.d);   // close, but never so close it reads as flat
  return opts.length ? opts[0].hex : fromHex;
}
/** The solid backdrop for a colour: the brand's own if it has it, else one of your colours. */
function solidIdFor(hex) {
  const h = hex.toLowerCase();
  const own = builtIns().find((b) => b.kind === 'solid' && b.base.toLowerCase() === h);
  return own ? own.id : `solid-custom-${h.slice(1)}`;
}
function setGradient(on) {
  const cur = activeBd();
  if (on) {
    if (cur.kind === 'gradient') return;
    let from = cur.kind === 'solid' ? cur : null;
    if (!from) from = solidColours().find((b) => (activeBrand().featured || []).includes(b.id)) || solidColours()[0];
    if (!from) return;
    pickColour(gradId(from.base, gradPartner(from.base, from.id), 's'));
  } else if (cur.kind === 'gradient') pickColour(solidIdFor(cur.from));
}

function buildGradTo() {
  const box = $('#grad-to .swatches');
  box.innerHTML = '';
  const hexes = [...solidColours().map((b) => [b.base, b.name]), ...customColors.map((h) => [h, h])];
  const seen = new Set();
  for (const [hex, name] of hexes) {
    if (seen.has(hex.toLowerCase())) continue;
    seen.add(hex.toLowerCase());
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `To ${name}`); b.title = name;
    b.style.setProperty('--sw', hex);
    b.dataset.hex = hex.toLowerCase();
    box.append(b);
  }
}

let uploadAsPattern = false;   // v3.1: an upload started from the Pattern tab arrives as a pattern
function syncBgInspector() {
  const g = $('#group-background');
  if (!g) return;
  try { syncUploadLabel(); } catch (_) { /* first paint: the tab isn't set yet */ }
  const cur = activeBd();
  if (uploadAsPattern && cur && cur.upload && bgKindFor && bgKindFor !== state.backdrop) {
    uploadAsPattern = false;
    const a = adjustFor(cur.id);
    if (!a.pattern) {
      a.pattern = true; a.tile = PATTERN_TILE.initial; a.zoom = 1; a.fx = 0.5; a.fy = 0.5; a.ox = 0; a.oy = 0;
      syncAdjust(cur.id); commitScene(); save(); syncImageControls(); refreshBgThumb(cur.id);
    }
  }
  const a = state.adjust[state.backdrop] || {};
  if (cur.kind === 'gradient') {
    // the colour row shows the gradient's first colour as the one picked (syncColourRow knows ids only)
    for (const b of document.querySelectorAll('#bg-colours .swatch[data-id]')) {
      const bd = byId(b.dataset.id);
      const on = String(!!bd && bd.base.toLowerCase() === cur.from);
      if (b.getAttribute('aria-checked') !== on) b.setAttribute('aria-checked', on);
    }
  }
  // an upload can turn into a pattern (or back): its gallery tile moves tab with it
  for (const w of document.querySelectorAll('#thumbs > .thumb-wrap')) {
    const t = w.querySelector('.thumb');
    const bd = t && byId(t.dataset.id);
    if (bd && bd.upload) { const k = bgKindOf(bd); if (w.dataset.k !== k) { w.dataset.k = k; bgSig = ''; } }
  }
  const sig = [state.backdrop, bgKind, bgKindFor, a.gx, a.row, a.pattern, activeBrand().id, customColors.length, $('#thumbs').children.length].join('|');
  if (sig === bgSig) return;
  bgSig = sig;
  // the tab follows the background whenever a different one is picked
  const ks = bgKindsAvailable();
  // the background in use changed kind (an upload turned into a pattern): its tab follows
  const curKind = bgKindOf(cur);
  if (bgKindFor === state.backdrop && bgCurKind && curKind !== bgCurKind) bgKindFor = null;
  bgCurKind = curKind;
  if (bgKindFor !== state.backdrop || !bgKind || !ks.has(bgKind)) {
    // a pattern picked here (not a section or brand change bringing its own) boxes the text
    const where = `${state.brand}|${state.scene}`;
    if (bgKindFor && bgKindFor !== state.backdrop && bgWhere === where && isPatternBg(cur)) boxTextOnPattern();
    bgWhere = where;
    bgKind = bgKindOf(cur); bgKindFor = state.backdrop;
  }
  if (!ks.has(bgKind)) bgKind = 'colour';
  g.dataset.k = bgKind;
  $('#thumbs').dataset.k = bgKind;
  $('#picker').dataset.k = bgKind;
  for (const b of document.querySelectorAll('#bg-kinds [data-k]')) {
    b.hidden = !ks.has(b.dataset.k);
    b.setAttribute('aria-selected', String(b.dataset.k === bgKind));
    b.tabIndex = b.dataset.k === bgKind ? 0 : -1;
  }
  // the controls of the background in use show on its own tab only
  g.classList.toggle('k-match', bgKindOf(cur) === bgKind);
  // gradient
  const grad = cur.kind === 'gradient';
  $('#grad-controls').hidden = !!cur.stripes;   // v4.1: a gradient is for a plain colour, not the bands
  $('#tg-grad').checked = grad;
  $('#grad-body').hidden = !grad;
  if (!$('#grad-to .swatches').children.length || $('#grad-to').dataset.brand !== activeBrand().id || $('#grad-to').dataset.n !== String(customColors.length)) {
    buildGradTo();
    $('#grad-to').dataset.brand = activeBrand().id;
    $('#grad-to').dataset.n = String(customColors.length);
  }
  for (const b of document.querySelectorAll('#grad-to .swatch')) b.setAttribute('aria-checked', String(grad && b.dataset.hex === cur.to));
  for (const b of document.querySelectorAll('#grad-dirs [data-dir]')) b.setAttribute('aria-checked', String(grad && b.dataset.dir === cur.dir));
  // spacing / offset rows (brand patterns and uploads used as a pattern share them)
  const md = motifDefaults(cur) || { gx: 0, row: 0 };   // v3.10: a brand pattern starts at its Figma spacing
  const gap = typeof a.gx === 'number' ? a.gx : md.gx, row = typeof a.row === 'number' ? a.row : md.row;
  for (const el of document.querySelectorAll('.adj-gap')) { el.value = gap; el.nextElementSibling.textContent = `${Math.round(gap * 100)}%`; }
  for (const el of document.querySelectorAll('.adj-row')) { el.value = row; el.nextElementSibling.textContent = row ? `${Math.round(row * 100)}%` : 'Off'; }
}

/* v3.2 · Loop and Mute belong to the video they play: under the background when the
   background is a video, under Media when only the media is (never under a pattern). */
let videoHome = null;
function placeVideoControls() {
  const v = $('#video-controls');
  if (!v) return;
  if (!videoHome) videoHome = { parent: v.parentNode, next: v.nextSibling };
  const bd = activeBd();
  const bgVideo = !!bd && bd.kind === 'image' && isVideo(bd.id);
  const mediaVideo = !!state.inset.id && isVideo(state.inset.id);
  const host = !bgVideo && mediaVideo ? $('#inset-body') : videoHome.parent;
  if (v.parentNode !== host) {
    if (host === videoHome.parent) host.insertBefore(v, videoHome.next && videoHome.next.parentNode === host ? videoHome.next : null);
    else host.append(v);
  }
  v.classList.toggle('in-media', host !== videoHome.parent);
}
/* v3.2 · Upload on the Pattern tab says what it makes: your picture, repeated (pictures only) */
let uploadLabelFor = '';
function syncPickerMirror() {
  const t = $('#tg-picker-mirror');
  if (!t) return;
  const bd = activeBd();
  const ok = !!bd && ((bd.kind === 'tile' && !bd.stripes) || (bd.upload && state.adjust[bd.id] && state.adjust[bd.id].pattern));
  $('#picker-mirror').classList.toggle('is-off', !ok);
  const on = ok && !!(state.adjust[bd.id] && state.adjust[bd.id].mirror);
  if (t.checked !== on) t.checked = on;
}
function syncUploadLabel() {
  syncPickerMirror();
  const k = bgKind === 'pattern' ? 'pattern' : 'image';
  if (k === uploadLabelFor) return;
  uploadLabelFor = k;
  const t = $('#btn-upload span:not(.upload-plus)');
  if (t) t.innerHTML = k === 'pattern' ? 'Upload a pattern<small>Your picture, repeated</small>' : 'Upload<small>Image or video</small>';
  $('#btn-upload').setAttribute('aria-label', k === 'pattern' ? 'Upload a picture to repeat as a pattern' : 'Upload an image or video');
  const pu = $('#picker-upload');
  if (pu) pu.textContent = k === 'pattern' ? 'Upload a pattern' : 'Image or video';
}

/* v3.2 · the heart: name the open project and save it (the Saved designs save, as before) */
function openSavePop() {
  closeBurger();
  closeClipMenu();
  const pop = $('#save-pop');
  const inp = $('#save-pop-name');
  let name = '';
  try { name = titleOf(state) || ''; } catch (_) { /* a blank design has no title */ }
  inp.value = name.slice(0, 40);
  $('#save-pop-error').hidden = true;
  pop.hidden = false;
  $('#save-scrim').hidden = false;
  $('#btn-save-proj').setAttribute('aria-expanded', 'true');
  hideToast();
  inp.focus({ preventScroll: true });
  inp.select();
}
function closeSavePop() {
  if ($('#save-pop').hidden) return;
  $('#save-pop').hidden = true;
  $('#save-scrim').hidden = true;
  $('#btn-save-proj').setAttribute('aria-expanded', 'false');
}
function saveFromPop() {
  const name = $('#save-pop-name').value.trim();
  if (!name) { const e = $('#save-pop-error'); e.textContent = 'Give it a name first.'; e.hidden = false; $('#save-pop-name').focus(); return; }
  commitScene();
  $('#tpl-name').value = name;
  $('#tpl-save').click();
  if (!$('#tpl-error').hidden) { const e = $('#save-pop-error'); e.textContent = $('#tpl-error').textContent; e.hidden = false; return; }
  closeSavePop();
  const b = $('#btn-save-proj');
  b.classList.add('is-saved');
  setTimeout(() => b.classList.remove('is-saved'), 1600);
  showToast(`Saved as “${name}”`, 'See all', () => { hideToast(); openHomeAll('saved'); }, 4000);
}
function wireSaveProject() {
  const np = $('#btn-new-proj');
  if (np) np.addEventListener('click', () => { closeSavePop(); newProjectHere(); });
  $('#btn-save-proj').addEventListener('click', () => ($('#save-pop').hidden ? openSavePop() : closeSavePop()));
  $('#save-scrim').addEventListener('click', closeSavePop);
  $('#save-pop-go').addEventListener('click', saveFromPop);
  $('#save-pop-all').addEventListener('click', () => { closeSavePop(); openHomeAll('saved'); });
  $('#save-pop-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveFromPop(); }
  });
  // on the window, ahead of the editor's own Esc handling (a phone's sheet takes Esc first otherwise)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#save-pop').hidden) { e.stopImmediatePropagation(); closeSavePop(); return; }
    // All projects opened over the editor: Esc takes you back to it
    if ($('#home').hidden && !$('#home-all').hidden) { e.stopImmediatePropagation(); closeHomeAll(); }
  }, true);
  // the Pattern tab's upload takes pictures only (a video can't repeat)
  $('#btn-upload').addEventListener('click', () => { $('#file-input').accept = bgKind === 'pattern' ? 'image/*' : 'image/*,video/*'; }, true);
}

function wireBgInspector() {
  for (const b of document.querySelectorAll('#bg-kinds [data-k]')) b.addEventListener('click', () => { uploadAsPattern = false; setBgKind(b.dataset.k); });
  // Upload from the Pattern tab: the picture arrives as a pattern
  for (const id of ['#btn-upload', '#picker-upload']) $(id).addEventListener('click', () => { uploadAsPattern = bgKind === 'pattern'; $('#file-input').accept = uploadAsPattern ? 'image/*' : 'image/*,video/*'; }, true);
  $('#bg-kinds').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const all = [...document.querySelectorAll('#bg-kinds [data-k]:not([hidden])')];
    const i = all.findIndex((b) => b.dataset.k === bgKind);
    const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    e.preventDefault(); setBgKind(n.dataset.k); n.focus();
  });
  // opening Background (a tap on the empty canvas, + Add → Background) opens the tab of the background in use
  new MutationObserver(() => {
    if ($('.panel-controls').dataset.tab === 'background') { bgKindFor = null; bgSig = ''; syncBgInspector(); }
  }).observe($('.panel-controls'), { attributes: true, attributeFilter: ['data-tab'] });
  $('#tg-grad').addEventListener('change', (e) => setGradient(e.target.checked));
  // with a gradient on, a colour in the row is its first colour (the second stays, or pairs anew)
  $('#bg-colours').addEventListener('click', (e) => {
    const cur = activeBd();
    if (cur.kind !== 'gradient') return;
    const sw = e.target.closest('.swatch[data-id]');
    if (!sw || sw.classList.contains('swatch-add')) return;
    const bd = byId(sw.dataset.id);
    if (!bd || bd.kind !== 'solid') return;
    e.stopImmediatePropagation();
    const from = bd.base.toLowerCase();
    const to = cur.to === from ? gradPartner(from, bd.id) : cur.to;
    pickColour(gradId(from, to, cur.dir));
  }, true);
  $('#grad-to').addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch[data-hex]');
    const cur = activeBd();
    if (!sw || cur.kind !== 'gradient') return;
    pickColour(gradId(cur.from, sw.dataset.hex, cur.dir));
  });
  $('#grad-dirs').addEventListener('click', (e) => {
    const cur = activeBd();
    if (cur.kind !== 'gradient') return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'grad-swap') pickColour(gradId(cur.to, cur.from, cur.dir));
    else if (GRAD_DIRS.includes(b.dataset.dir)) pickColour(gradId(cur.from, cur.to, b.dataset.dir));
  });
  // Spacing and Offset rows: one value each, for the brand's patterns and an upload used as a pattern
  const adj = (fn) => {
    const a = adjustFor(state.backdrop);
    fn(a);
    syncAdjust(state.backdrop);
    bgSig = '';
    syncBgInspector();
    draw();
  };
  for (const el of document.querySelectorAll('.adj-gap')) {
    el.addEventListener('input', () => adj((a) => { a.gx = Number(el.value); a.gy = Number(el.value); }));
    el.addEventListener('change', () => { commitScene(); save(); refreshBgThumb(); });
  }
  for (const el of document.querySelectorAll('.adj-row')) {
    el.addEventListener('input', () => adj((a) => { a.row = Number(el.value); }));
    el.addEventListener('change', () => { commitScene(); save(); refreshBgThumb(); });
  }
  $('#pat-reset').addEventListener('click', () => { const a = adjustFor(state.backdrop); a.row = 0; bgSig = ''; syncBgInspector(); });
}

function wireColourRow() {
  const row = $('#bg-colours');
  row.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b && b.dataset.id) pickColour(b.dataset.id);
  });
  row.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const all = [...row.querySelectorAll('.swatch[data-id]')];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
    next.focus();
    pickColour(next.dataset.id);
  });
}

/* --- saved headers ---------------------------------------------------------
   A heart beside the Header field keeps the current wording; saved headers
   sit in a small carousel underneath. Tap one to use it, tap its heart to let
   it go. They are kept on this browser, apart from templates, and are not
   tied to a brand — the words travel. */

const HEADERS_KEY = 'askruth.backdrop-studio.headers.v1';
const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
let savedHeaders = [];

function loadHeaders() {
  try {
    const list = JSON.parse(localStorage.getItem(HEADERS_KEY));
    savedHeaders = Array.isArray(list) ? list.filter((h) => h && typeof h.text === 'string') : [];
  } catch (_) { savedHeaders = []; }
}

function writeHeaders() {
  try { localStorage.setItem(HEADERS_KEY, JSON.stringify(savedHeaders)); } catch (_) {}
}

const headerKey = (t) => String(t || '').trim().replace(/\s+/g, ' ');
const isSavedHeader = (t) => !!headerKey(t) && savedHeaders.some((h) => headerKey(h.text) === headerKey(t));

function syncFav() {
  const btn = $('#h1-fav');
  if (!btn) return;
  const has = !!headerKey(state.h1);
  const on = isSavedHeader(state.h1);
  for (const b of document.querySelectorAll('.hdr-use')) {
    const cur = String(headerKey(b.textContent) === headerKey(state.h1));
    if (b.getAttribute('aria-current') !== cur) b.setAttribute('aria-current', cur);
  }
  if (btn.getAttribute('aria-pressed') === String(on) && btn.disabled === !has) return;
  btn.setAttribute('aria-pressed', String(on));
  btn.disabled = !has;
  const label = on ? 'Remove this header from saved' : 'Save this header';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function toggleSavedHeader(text) {
  const k = headerKey(text);
  if (!k) return;
  if (isSavedHeader(text)) savedHeaders = savedHeaders.filter((h) => headerKey(h.text) !== k);
  else savedHeaders.unshift({ text: String(text).trim(), at: Date.now() });
  writeHeaders();
  renderHeaderCarousel();
  syncFav();
}

function useHeader(text) {
  state.h1 = text;
  $('#in-h1').value = text;
  save();
  draw();
  renderHeaderCarousel();
}

function renderHeaderCarousel() {
  const host = $('#hdr-carousel');
  if (!host) return;
  host.innerHTML = '';
  host.hidden = !savedHeaders.length;
  const current = headerKey(state.h1);
  for (const h of savedHeaders) {
    const item = document.createElement('div');
    item.className = 'hdr-chip';
    item.setAttribute('role', 'listitem');
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'hdr-use';
    use.textContent = h.text;
    use.title = `Use “${h.text}”`;
    use.setAttribute('aria-current', String(headerKey(h.text) === current));
    use.addEventListener('click', () => useHeader(h.text));
    const un = document.createElement('button');
    un.type = 'button';
    un.className = 'fav-btn fav-sm';
    un.setAttribute('aria-pressed', 'true');
    un.setAttribute('aria-label', `Remove “${h.text}” from saved`);
    un.title = 'Remove from saved';
    un.innerHTML = HEART_SVG;
    un.addEventListener('click', () => toggleSavedHeader(h.text));
    item.append(use, un);
    host.append(item);
  }
}

function wireHeaders() {
  // saving single headers is gone — whole designs are saved under Saved designs

}

function wireElements() {
  $('#tg-h1').addEventListener('change', (e) => setVisibility(e.target.checked, showsBody()));
  $('#tg-body').addEventListener('change', (e) => setVisibility(showsH1(), e.target.checked));
  $('#h1-scale').addEventListener('input', (e) => setElementScale('h1Scale', Number(e.target.value)));
  $('#body-scale').addEventListener('input', (e) => setElementScale('bodyScale', Number(e.target.value)));
  $('#tg-badge').addEventListener('change', (e) => setBadgeVisible(e.target.checked));
  $('#tg-powered').checked = state.badgePowered;
  $('#tg-powered').addEventListener('change', (e) => {
    state.badgePowered = e.target.checked;
    save();
    draw();
  });

  $('#badge-thumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('.badge-thumb');
    if (!btn) return;
    state.badge = state.badgeLast = btn.dataset.b;
    syncBadgeControls();
    save();
    draw();
  });
  wirePicker();


  wireColourRow();
  wireBgInspector();
  wireSelDelete();
  wirePanelSize();
  wireDrawing();
  wireBadgeShape();
  wirePrecise();
  wireCogent();
  wireSaveProject();
  wireHeaders();

  syncScaleOutputs();
  syncTextControls();
  syncBadgeControls();
}

async function boot() {
  // Uploads first — a restored selection may point at one of them.
  try {
    const stored = await loadUploads();
    for (const meta of stored) {
      if (meta.use !== 'background') continue;
      registerUpload(meta, adjustFor(meta.id));
      redrawThumbWhenReady(meta);
    }
    // a photo card whose file is gone shouldn't leave a dangling reference
    if (state.inset.id && !stored.some((m) => m.id === state.inset.id)) state.inset.id = null;
  } catch (_) {}
  uploadsLoaded = true;   // v4: from here on an unknown upload id really is gone

  // Only now can a saved id be checked — uploads exist from here on.
  if (byId(state.backdrop).id !== state.backdrop) state.backdrop = builtIns()[0].id;

  bindText('#in-h1', 'h1');
  bindText('#in-body', 'body');
  bindToggle('#tg-card', 'card');
  bindToggle('#tg-guides', 'guides');
  bindToggle('#tg-grid', 'grid');
  bindAdjusts();

  for (const [sel, key] of [['#tg-loop', 'loop'], ['#tg-mute', 'muted']]) {
    const el = $(sel);
    el.checked = state.video[key];
    el.addEventListener('change', () => {
      state.video[key] = el.checked;
      setPlayback(state.video);
      save();
      draw();
    });
  }
  setPlayback(state.video);

  $('#tpl-save').addEventListener('click', () => {
    const input = $('#tpl-name');
    const err = $('#tpl-error');
    if (saveTemplate(input.value)) {
      input.value = '';
      err.hidden = true;
      renderTemplates();
    } else {
      err.textContent = 'No room left to save — delete a template and try again.';
      err.hidden = false;
    }
  });
  wireHiRes();
  wireInsetToggle();
  wireScenes();
  wireTimeline();
  wireContentType();
  wireEditTabs();
  wireButtons();
  wireToneCustom();
  wireMediaItems();
  wireBadgeItems();
  wireMultiSelect();
  wireSimpleEditor();
  wirePhoneBarGroup();
  wireMotion();
  wireHitCycle();
  wireStartFrom();
  wireHome();
  wireAutoFit();
  $('#tidy-btn').addEventListener('click', () => tidySection());
  wireFullScreen();
  wireItemExport();
  wireUploadFit();
  // v4: the heads-up for heavy clips now comes from the import check (v4/importer.js),
  // which reads the clip once instead of a third time
  wireTextReset();
  wireTabActivates();
  wireBadgeParts();
  wirePhoneCreator();
  wirePanelPng();
  wireFormatTab();
  wireFraming();
  // a Dim you set yourself is yours: a later pattern pick won't switch it off
  const mine = () => { if (state.overlay) delete state.overlay.auto; };
  $('#seg-overlay').addEventListener('click', mine, true);
  $('#ov-strength').addEventListener('input', mine, true);
  // Tone down: moving the slider off 0 turns the wash on, back to 0 turns it off
  $('#ov-strength').addEventListener('input', (e) => {
    state.overlay.style = Number(e.target.value) > 0 ? 'dim' : 'none';
  }, true);
  $('#ov-strength').addEventListener('input', (e) => {
    if (!(Number(e.target.value) > 0)) setTimeout(() => { $('#ov-strength-out').textContent = 'Off'; }, 0);   // after the slider's own label
  });
  wireMusic();
  wireCamera();
  $('#tpl-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#tpl-save').click(); }
  });

  wireSegments('#seg-tone', 't', 'textTone');
  wireElements();
  $('#surface-toggle').addEventListener('click', () =>
    setSurface(state.previewSurface === 'light' ? 'studio' : 'light'));
  setSurface(state.previewSurface);

  buildOverlaySegments();
  wireUploads();
  wireInset();

  $('#badge-scale').value = state.badgeScale;
  $('#badge-scale-out').textContent = `${Math.round(state.badgeScale * 100)}%`;


  /* --- export sheet -----------------------------------------------------
     Progressive: first the file type, then only that type's options and one
     button that says exactly what will happen. */
  const sheet = $('#sheet');
  let scope = 'all';         // v4 · 'all' | 'pick' | 'current' | 'elements'
  const picked = new Set();  // section ids, for 'pick'
  let kind = null;           // 'png' | 'jpg' | 'video' | 'pdf' (v4)
  let imageKind = 'png';     // a carousel's file type, remembered between exports
  let scale = 1;
  const videoHint = () => {
    const mime = pickVideoMime();
    const secs = sequenceSecs();
    if (!mime) return 'This browser cannot record video.';
    return `Records in real time, so this takes ${secs.toFixed(1)} seconds. `
      + (mime.startsWith('video/mp4') ? 'Saves as MP4.' : 'This browser saves WebM only.')
      + (musicSecs() ? ` Includes “${state.music.name}”${sceneVideoIds().length && !state.video.muted ? ' and the clips’ own sound' : ''}.`
        : sceneVideoIds().length && !state.video.muted ? ' Includes the clips’ own sound.' : '')
      + (sceneVideoIds().length && state.video.muted ? ' Clip sound is muted.' : '');
  };
  const syncGo = () => {
    const go = $('#save-go');
    const list = enabledScenes();
    const n = list.length;
    const total = sequenceSecs();
    const zip = n > 1 && $('#sheet-zip').checked;
    go.textContent = kind === 'video'
      ? `Export ${total.toFixed(1)}s video`
      : kind === 'pdf' ? `Download PDF · ${n} ${n === 1 ? 'page' : 'pages'}`
      : kind === 'pptx' ? `Download PowerPoint · ${n} ${n === 1 ? 'slide' : 'slides'}`
      : n > 1 ? `Download ${n} ${kind === 'jpg' ? 'JPGs' : 'PNGs'}${zip ? ' as .zip' : ''}` : `Download ${kind === 'jpg' ? 'JPG' : 'PNG'}`;
    $('#sheet-zip-row').hidden = !(n > 1 && (kind === 'png' || kind === 'jpg'));
    $('#pdf-hint').hidden = kind !== 'pdf';
    const ph = $('#pptx-hint'); if (ph) ph.hidden = kind !== 'pptx';
    go.disabled = kind === 'video' && !pickVideoMime();
    $('#video-hint').textContent = kind === 'video' ? videoHint() : '';
    // the summary above already says what comes out; only the order is spelled out
    const note = $('#scenes-note');
    note.textContent = n > 1 ? list.map(({ sc, i }) => sceneName(sc, i)).join(' → ')
      + (kind === 'video' ? '' : ' — one numbered file each') : '';
    note.hidden = n < 2;
  };
  const pickKind = (k) => {
    kind = k;
    if (k !== 'video') imageKind = k;
    for (const b of document.querySelectorAll('#seg-filetype button')) {
      b.setAttribute('aria-checked', String(b.dataset.kind === k));
    }
    // v4 · one row for every file type: Video only for a Reel; PNG, JPG and PDF for both
    $('#sheet-filetype-row').hidden = false;
    const vb = document.querySelector('#seg-filetype [data-kind="video"]');
    if (vb) vb.hidden = state.contentType === 'carousel';
    // v4.4 · PowerPoint for a Presentation (flag); anything else falls back to PNG
    const pb = document.querySelector('#seg-filetype [data-kind="pptx"]');
    if (pb) pb.hidden = !isPresentation();
    if (k === 'pptx' && !isPresentation()) { pickKind('png'); return; }
    const vm = pickVideoMime();
    const vs = $('#kind-video-sub'); if (vs) vs.textContent = !vm ? 'Not in this browser' : vm.startsWith('video/mp4') ? 'MP4' : 'WebM';
    $('#sheet-video').hidden = k !== 'video';
    const sr = $('#server-render-note'); if (sr) { sr.hidden = k !== 'video'; sr.textContent = backendReady() ? '' : 'Server rendering (full quality, any length, no waiting) is not set up yet. Videos record here, in this browser, in real time.'; }
    $('#sheet-mute-row').hidden = !primaryVideoId();
    $('#sheet-mute').checked = state.video.muted;
    const ci = coverIndex();
    $('#sheet-cover-sub').textContent = `${state.scenes[ci] ? sceneName(state.scenes[ci], ci) : 'This section'}, as JPG — any section’s menu can save one too`;
    syncGo();
  };
  const pickScale = (n) => {
    scale = n;
    for (const b of document.querySelectorAll('#seg-size button')) {
      b.setAttribute('aria-checked', String(Number(b.dataset.scale) === n));
    }
  };
  /* The sheet already knows what this is (Video or Carousel — chosen on the
     timeline), the format, the brand and the screens: it shows them and asks
     only what is left to decide at export time. */
  const summarise = () => {
    const f = FORMATS[state.format];
    const list = enabledScenes();
    const video = state.contentType !== 'carousel';
    $('#sheet-title').textContent = 'Export';
    $('#sheet-type').textContent = video ? 'Video' : 'Carousel';
    const facts = [isPresentation() ? 'Presentation' : f.label, `${f.w} × ${f.h}`];   // v4.4: a Carousel at 16:9 is a Presentation
    if (video) {
      facts.push(`${sequenceSecs().toFixed(1)}s`);
      const mime = pickVideoMime();
      if (mime) facts.push(mime.startsWith('video/mp4') ? 'MP4' : 'WebM');
      if (musicSecs()) facts.push(`♪ ${state.music.name}`);
    } else facts.push(list.length === 1 ? '1 slide' : `${list.length} slides`);
    $('#sheet-facts').textContent = facts.join(' · ');
    // the screens, as they will come out
    const host = $('#sheet-thumbs');
    host.innerHTML = '';
    // v4 · Choose: every section shows; tap to include or leave out
    const shown = scope === 'pick' ? state.scenes.map((sc, i) => ({ sc, i })) : list;
    host.setAttribute('aria-hidden', String(scope !== 'pick'));
    host.classList.toggle('is-pick', scope === 'pick');
    for (const { sc, i } of shown) {
      const { url } = frameImage(i, 84);
      const fig = document.createElement(scope === 'pick' ? 'button' : 'figure');
      const im = document.createElement('img');
      im.src = url;
      im.alt = '';
      const cap = document.createElement('figcaption');
      cap.textContent = video ? `${sc.secs.toFixed(1)}s` : String(list.findIndex((x) => x.i === i) + 1);
      fig.append(im, cap);
      if (scope === 'pick') {
        const on = picked.has(sc.id);
        fig.type = 'button';
        fig.className = 'sheet-pick' + (on ? ' is-on' : '');
        fig.setAttribute('aria-pressed', String(on));
        fig.setAttribute('aria-label', `${sceneName(sc, i)}: ${on ? 'included' : 'left out'}`);
        cap.textContent = sceneName(sc, i);
        fig.addEventListener('click', () => {
          if (on && picked.size === 1) { showExportNote('Keep at least one section in the export.'); return; }
          if (on) picked.delete(sc.id); else picked.add(sc.id);
          exportPick = new Set(picked);
          showExportNote('');
          summarise(); syncGo();
        });
      }
      host.append(fig);
    }
    const subs = { all: `${state.scenes.length} ${video ? 'sections' : 'slides'}`, pick: scope === 'pick' ? `${picked.size} of ${state.scenes.length}` : 'Tap to include', current: sceneName(state.scenes[state.scene], state.scene), elements: (() => { const n = selectedElementIds().length; return n ? `${n} selected` : 'Pick on the canvas'; })() };
    for (const [k, v] of Object.entries(subs)) { const el = $(`#scope-${k === 'current' ? 'cur' : k === 'elements' ? 'el' : k}-sub`); if (el) el.textContent = v; }
  };
  const open = () => {
    const f = FORMATS[state.format];
    $('#size-1').textContent = `${f.w} × ${f.h}`;
    $('#size-2').textContent = `${f.w * 2} × ${f.h * 2}`;
    commitScene();
    picked.clear(); for (const sc of state.scenes) picked.add(sc.id);
    pickScope(selectedElementIds().length > 1 ? 'elements' : 'all', true);
    pickScale(scale);
    pickKind(state.contentType === 'carousel' ? (imageKind === 'video' ? 'png' : imageKind) : 'video');
    showExportNote('');
    sheet.hidden = false;
  };
  const close = () => { sheet.hidden = true; exportPick = null; };
  /* v4 · What to export */
  function pickScope(sc, quiet) {
    scope = sc;
    for (const b of document.querySelectorAll('#seg-scope button')) b.setAttribute('aria-checked', String(b.dataset.scope === sc));
    exportPick = sc === 'all' || sc === 'elements' ? null : sc === 'current' ? new Set([state.scenes[state.scene].id]) : new Set(picked);
    const el = sc === 'elements';
    $('#sheet-options').hidden = el;
    $('#sheet-items').hidden = el;
    $('#sheet-summary').hidden = el;
    $('#sheet-sel').hidden = !el;
    if (el) renderSelList();
    summarise();
    if (!quiet) syncGo();
  }
  for (const b of document.querySelectorAll('#seg-scope button')) b.addEventListener('click', () => { pickScope(b.dataset.scope); if (scope !== 'elements') pickKind(kind); });
  $('#sheet-zip').addEventListener('change', syncGo);
  // Elements: what's selected on the canvas, ticked; anything else on this section can be ticked too
  const selChosen = new Set();
  function renderSelList() {
    const host = $('#sel-list');
    host.innerHTML = '';
    const i = state.scene;
    const items = sectionItems(i);
    selChosen.clear(); for (const id of selectedElementIds()) selChosen.add(id);
    $('#sel-sum').textContent = selChosen.size
      ? `${selChosen.size} selected on ${sceneName(state.scenes[i], i)}. Tick more, or untick.`
      : `Nothing selected on the canvas. Tick what to export from ${sceneName(state.scenes[i], i)} (or Shift-click items on the canvas first).`;
    for (const it of items) {
      const l = document.createElement('label');
      l.className = 'item-row sel-row';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = selChosen.has(it.id);
      cb.addEventListener('change', () => { if (cb.checked) selChosen.add(it.id); else selChosen.delete(it.id); syncSelGo(); });
      const prev = document.createElement('span');
      prev.className = 'item-thumb' + (it.id === 'background' ? ' is-bg' : '');
      const cv = itemCanvas(i, it.id, 0.12, false);
      if (cv) prev.style.setProperty('--img', `url(${cv.toDataURL('image/png')})`);
      const name = document.createElement('span'); name.className = 'item-name'; name.textContent = it.label;
      l.append(cb, prev, name);
      host.append(l);
    }
    syncSelGo();
  }
  function syncSelGo() {
    const n = selChosen.size, go = $('#sel-go');
    go.disabled = !n;
    go.textContent = !n ? 'Tick an element first' : n === 1 ? 'Download PNG' : `Download ${n} PNGs as .zip`;
  }
  $('#sel-go').addEventListener('click', async () => {
    const i = state.scene, go = $('#sel-go');
    const items = sectionItems(i).filter((it) => selChosen.has(it.id));
    if (!items.length) return;
    go.disabled = true; go.textContent = 'Saving…';
    try {
      await masters(i);
      const full = $('#sel-full').checked;
      const files = [];
      for (const it of items) {
        const cv = itemCanvas(i, it.id, scale, full);
        if (!cv) continue;
        const blob = await toPng(cv);
        if (items.length === 1) { downloadBlob(blob, itemFileName(i, it, cv)); continue; }
        files.push({ name: itemFileName(i, it, cv), data: new Uint8Array(await blob.arrayBuffer()) });
      }
      if (files.length) downloadBlob(zipOf(files), `${exportSlug()}-${kebabOf(sceneName(state.scenes[i], i))}-elements.zip`);
      close();
    } finally { mastersBack(); go.disabled = false; syncSelGo(); }
  });
  $('#btn-export').addEventListener('click', open);
  $('#sheet-close').addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  for (const b of document.querySelectorAll('#seg-filetype button')) {
    b.addEventListener('click', () => pickKind(b.dataset.kind));
  }
  for (const b of document.querySelectorAll('#seg-size button')) {
    b.addEventListener('click', () => pickScale(Number(b.dataset.scale)));
  }

  $('#sheet-mute').addEventListener('change', (e) => {
    state.video.muted = e.target.checked;
    $('#tg-mute').checked = state.video.muted;   // same setting as the panel's Mute audio
    setPlayback(state.video);
    save();
    syncGo();
  });

  $('#save-go').addEventListener('click', async () => {
    const btn = $('#save-go');
    if (kind === 'pptx') {
      btn.disabled = true;
      btn.textContent = 'Making the PowerPoint…';
      let ok = false;
      try { await exportPptx(enabledScenes()); ok = true; }
      catch (e) { console.error('[pptx]', e); showExportNote('The PowerPoint couldn’t be made in this browser. PNG and PDF still work.'); }
      finally { btn.disabled = false; syncGo(); }
      if (ok) close();
      return;
    }
    if (kind === 'pdf') {
      btn.disabled = true;
      btn.textContent = 'Making the PDF…';
      try {
        const pages = [];
        for (const { i } of enabledScenes()) await masters(i);
        await exportSlides('image/jpeg', scale, pages);
        mastersBack();
        downloadBlob(pdfOf(pages.map((p) => ({ jpeg: p.data, w: p.w, h: p.h })), { title: titleOf(state), author: activeBrand().name }), `${exportSlug()}-${pages.length}-pages.pdf`);
      } finally { btn.disabled = false; syncGo(); }
      close();
      return;
    }
    if (kind === 'png' || kind === 'jpg') {
      const type = kind === 'png' ? 'image/png' : 'image/jpeg';
      const list = enabledScenes();
      if (list.length > 1 && $('#sheet-zip').checked) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          const files = [];
          await exportSlides(type, scale, files);
          downloadBlob(zipOf(files), `${exportSlug()}-${files.length}-${state.contentType === 'carousel' ? 'slides' : 'sections'}.zip`);
        } finally { btn.disabled = false; syncGo(); }
      } else if (list.length > 1 || (list[0] && list[0].i !== state.scene)) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try { await exportSlides(type, scale); } finally { btn.disabled = false; }
      } else {
        exportImage(type, scale);
      }
      close();
      return;
    }
    if (kind !== 'video') return;
    btn.disabled = true;
    btn.textContent = 'Recording…';
    try {
      const secs = sequenceSecs();
      await withSoundtrack(secs, () => exportScenesVideo(secs, scale));
      if ($('#sheet-cover').checked && !/cannot|no data/i.test($('#export-note').textContent)) {
        await new Promise((r) => setTimeout(r, 400));   // browsers drop downloads fired together
        await exportCover(coverIndex(), scale);
      }
    } finally {
      btn.disabled = false;
      syncGo();
    }
    // done: close, unless the recorder reported a problem worth reading
    const note = $('#export-note').textContent;
    if (!/cannot|no data/i.test(note)) close();
  });

  trackTopbar();
  buildBrandSelect();
  buildFormats();
  syncBrandUi();
  buildThumbs();
  renderTemplates();
  syncImageControls();
  syncInsetControls();
  draw();
}

/* Fonts must be resident before the first paint or canvas silently
   substitutes a fallback and every measurement is wrong. */
const NEEDED = [
  '600 72px Bitter',
  '600 44px Poppins',
  '500 44px Poppins',     // the upper badge with your own words
  '900 68px Roboto',      // MoshPit headlines
];

/* --- section categories --------------------------------------------------------
   Hook, Value and CTA each have a colour of their own in the editor: the
   timeline clips, the "Editing …" line above the section buttons, and the
   outline around the selected element on the preview. Editor only — exports
   never pass `accent`, so it is never drawn into a file. */
const CATEGORY = { hook: '#ffb547', value: '#5cc8ff', cta: '#a78bfa' };   // no brand uses these
const categoryOf = (i = state.scene) => {
  const sc = state.scenes && state.scenes[i];
  return CATEGORY[(sc && sc.role) || 'hook'] || CATEGORY.hook;
};

function syncCategory() {
  const sc = state.scenes && state.scenes[state.scene];
  if (!sc) return;
  showScope(state.scene);
}

/** The section name and colour on show (in Preview: the one playing). */
function showScope(i) {
  const sc = state.scenes && state.scenes[i];
  if (!sc) return;
  document.documentElement.style.setProperty('--cat', categoryOf(i));
  $('#fs-scope-name').textContent = sceneName(sc, i);
  $('#fs-count').textContent = state.scenes.length > 1 ? `${i + 1} / ${state.scenes.length}` : '';
  $('#fs-prev').disabled = i <= 0;
  $('#fs-next').disabled = i >= state.scenes.length - 1;
}

/* --- buttons ----------------------------------------------------------------------
   Buttons are their own elements, made only under Buttons (never from the
   text): any section — Hook, Value or CTA — can have one or more. Each has its
   text, its place (drag it on the preview) and its own look: text colour,
   button colour, stroke (colour and width, drawn outward), corners (square →
   pill; the brand's default is a pill) and scale. null = the brand's own. They
   belong to the section, like its card and extra text. */
const BTN_TEXT = 'Learn more';

function btnBrand() {
  const b = (activeBrand().cta && activeBrand().cta.button) || {};
  return { fill: b.bg || '#ff8eff', ink: b.ink || '#4a0649', radius: typeof b.radius === 'number' ? b.radius : 1 };
}
const buttonById = (id) => (state.buttons || []).find((b) => b.id === id);

function addButton() {
  state.buttons = state.buttons || [];
  const L = layout(ctx, state, canvas.width, canvas.height);
  const H = canvas.height;
  const bottoms = [L.tx.empty ? 0 : L.txRect.y + L.tx.h, ...(L.extras || []).map((x) => x.txRect.y + x.tx.h), ...(L.buttons || []).map((b) => b.rect.y + b.rect.h)];
  const below = Math.max(...bottoms);
  let y = below > 0 ? below / H + 0.03 : 0.62;     // under what is there, or low in the frame
  if (y > 0.8) y = 0.7;
  const id = `b${Date.now().toString(36)}`;
  state.buttons.push({ id, text: BTN_TEXT, x: 0.5, y, look: CTA_LOOK() });
  commitScene();
  save();
  renderButtons();
  selected = `bt:${id}`;
  syncSectionValues(true);
  draw();
  revealButton(id, true);
}

function removeButton(id) {
  pushUndo('Button removed');
  state.buttons = (state.buttons || []).filter((b) => b.id !== id);
  if (selected === `bt:${id}`) selected = null;
  commitScene();
  save();
  renderButtons();
  syncSectionValues(true);
  draw();
}

/** A button's own controls: scrolled into view (and its text field focused when asked). */
function revealButton(id, focus) {
  requestAnimationFrame(() => {
    const row = document.getElementById(`btn-${id}`);
    if (!row) return;
    revealInPanel(`bt:${id}`);
    row.classList.remove('is-revealed');
    void row.offsetWidth;
    row.classList.add('is-revealed');
    setTimeout(() => row.classList.remove('is-revealed'), 1400);
    if (focus && !isPhone()) { const f = row.querySelector('.btn-text'); if (f) { f.focus({ preventScroll: true }); f.select(); } }
  });
}

function buttonColourRow(b, key, label, k) {
  const brand = { ...btnBrand() };
  const lk = b.look || (b.look = CTA_LOOK());
  // show what the preview draws: the brand's colours swap on a ground they'd vanish into
  const base = activeBd().base;
  if (!lk.fill && !lk.ink && /^#[0-9a-f]{6}$/i.test(base || '') && contrast(brand.fill, base) < 1.7) [brand.fill, brand.ink] = [brand.ink, brand.fill];
  const line = document.createElement('div');
  line.className = 'swatch-line cta-line';
  line.setAttribute('role', 'radiogroup');
  line.setAttribute('aria-label', `Button ${k + 1} ${label.toLowerCase()} color`);
  line.innerHTML = `<span class="swatch-lbl">${label}</span><span class="swatches"></span>`;
  const host = line.querySelector('.swatches');
  const effective = String(lk[key] || (key === 'stroke' ? 'none' : brand[key])).toLowerCase();
  const set = (value, { live = false } = {}) => {
    const v = value === 'none' ? null : value;
    // the brand's own colour is stored as "not set", so a brand switch follows it
    lk[key] = v && key !== 'stroke' && v.toLowerCase() === String(brand[key]).toLowerCase() ? null : v;
    if (key === 'stroke' && v && !lk.strokeW) lk.strokeW = 4;     // picking a colour shows the stroke
    if (key === 'stroke' && !v) lk.strokeW = 0;
    draw();
    if (live) return;
    commitScene();
    save();
    renderButtons();
  };
  const chip = (value, name, cls) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = `sw ${cls}`;
    c.setAttribute('role', 'radio');
    c.setAttribute('aria-checked', String(String(value).toLowerCase() === effective));
    c.setAttribute('aria-label', name);
    c.title = name;
    if (cls.includes('sw-colour')) c.style.setProperty('--sw', value);
    c.addEventListener('click', () => set(value));
    host.append(c);
  };
  if (key === 'stroke') chip('none', 'No stroke', 'sw-none');
  for (const { name, hex } of brandSwatches()) chip(hex, name, 'sw-colour');
  for (const hex of customColors) {
    host.append(customSwatch(hex, hex === effective, 'sw sw-colour', {
      pick: (h) => set(h),
      live: (h) => set(h, { live: true }),
      done: (from, to) => { replaceCustomColor(from, to); set(to); buildColourRow(); },
      remove: (h) => { removeCustomColor(h); renderButtons(); syncColorRows(true); buildColourRow(); },
    }));
  }
  host.append(colorAddChip('sw sw-add', effective === 'none' ? '' : effective,
    (hex) => set(hex, { live: true }),
    (hex) => { addCustomColor(hex); set(hex); syncColorRows(true); }));
  capCustom(host);
  return line;
}

/* v3.12 · "Style: Brand · Custom" for a button or a lower badge, like the text Style row.
   Brand = the brand's look, nothing to set; Custom opens the color, stroke and corner
   controls (they stay open while the item has its own look). Going back to Brand puts
   the brand's look back, with Undo. Which items are open is kept for the session only. */
const customOpen = new Set();
function styleGate(id, label, isCustom, toBrand) {
  const row = document.createElement('div');
  row.className = 'style-gate';
  const lbl = document.createElement('span');
  lbl.className = 'block-style-lbl';
  lbl.textContent = 'Style';
  const seg = document.createElement('div');
  seg.className = 'segments segments-sm';
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', `${label} style`);
  const box = document.createElement('div');
  box.className = 'custom-box';
  const open = () => isCustom() || customOpen.has(id);
  const sync = () => {
    box.hidden = !open();
    for (const b of seg.children) b.setAttribute('aria-checked', String((b.dataset.v === 'custom') === open()));
  };
  for (const [v, name] of [['brand', 'Brand'], ['custom', 'Custom']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.v = v;
    b.textContent = name;
    b.addEventListener('click', () => {
      if (v === 'custom') { customOpen.add(id); sync(); return; }
      customOpen.delete(id);
      if (isCustom()) toBrand(); else sync();
    });
    seg.append(b);
  }
  row.append(lbl, seg);
  sync();
  return { row, box, sync };
}
const btnIsCustom = (lk) => !!(lk.ink || lk.fill || lk.stroke || lk.strokeW || (typeof lk.radius === 'number'));
const LOWER_LOOK_KEYS = ['ink', 'fill', 'stroke', 'strokeOn', 'strokeW'];
const lowerIsCustom = (lo) => { const d = LOWER_DEFAULT(); return LOWER_LOOK_KEYS.some((k) => (lo[k] ?? null) !== (d[k] ?? null)); };

function renderButtons() {
  const host = $('#buttons');
  if (!host) return;
  if (colorPicking) return;          // a system colour picker is open in a row: keep it
  host.innerHTML = '';
  const brand = btnBrand();
  (state.buttons || []).forEach((b, k) => {
    const lk = b.look || (b.look = CTA_LOOK());
    const row = document.createElement('div');
    row.className = 'block-item btn-item';
    row.id = `btn-${b.id}`;
    const head = document.createElement('div');
    head.className = 'block-head';
    head.innerHTML = `<span class="block-title">Button ${k + 1}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'block-del';
    del.setAttribute('aria-label', `Remove button ${k + 1}`);
    del.innerHTML = MENU_ICONS.remove;
    del.addEventListener('click', () => removeButton(b.id));
    head.append(pngButton(`bt:${b.id}`, `button ${k + 1}`), del);
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'btn-text';
    field.value = b.text || '';
    field.placeholder = 'Button text';
    field.setAttribute('aria-label', `Button ${k + 1} text`);
    field.addEventListener('input', () => { b.text = field.value; commitScene(); save(); draw(); });
    field.addEventListener('focus', () => { selected = `bt:${b.id}`; draw(); });
    const slider = (key, label, min, max, step, value, fmt) => {
      const r = document.createElement('label');
      r.className = 'slider-row';
      r.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="Button ${k + 1} ${label.toLowerCase()}"><output>${fmt(value)}</output>`;
      const inp = r.querySelector('input'), out = r.querySelector('output');
      inp.addEventListener('input', () => {
        lk[key] = Number(inp.value);
        // a stroke width with no stroke colour borrows a colour that shows
        if (key === 'strokeW' && lk.strokeW && !lk.stroke) {
          const ink = lk.ink || brand.ink;
          lk.stroke = String(ink).toLowerCase() === String(lk.fill || '').toLowerCase() ? brand.fill : ink;
        }
        out.textContent = fmt(lk[key]);
        draw();
      });
      inp.addEventListener('change', () => { commitScene(); save(); renderButtons(); });
      inp.addEventListener('focus', () => { selected = `bt:${b.id}`; draw(); });
      return r;
    };
    const r = typeof lk.radius === 'number' ? lk.radius : brand.radius;
    const looks = document.createElement('div');
    looks.className = 'btn-looks';
    const gate = styleGate(`bt:${b.id}`, `Button ${k + 1}`, () => btnIsCustom(b.look || {}), () => {
      commitScene();
      pushUndo('Button back to the brand style');
      b.look = { ...CTA_LOOK(), scale: (b.look && b.look.scale) || 1 };
      commitScene(); save(); renderButtons(); draw();
    });
    gate.box.append(
      buttonColourRow(b, 'ink', 'Text', k),
      buttonColourRow(b, 'fill', 'Button', k),
      buttonColourRow(b, 'stroke', 'Stroke', k),
      slider('strokeW', 'Stroke', 0, 16, 1, lk.strokeW || 0, (v) => (v ? `${v} px` : 'Off')),
      slider('radius', 'Corners', 0, 1, 0.01, r, (v) => (v >= 0.995 ? 'Pill' : v <= 0.005 ? 'Square' : `${Math.round(v * 100)}%`)),
    );
    // v4.1 · Style: the brand's standard button, or its Luxury version (light / dark ground picked automatically)
    const styleRow = document.createElement('div');
    styleRow.className = 'btn-style-row';
    styleRow.innerHTML = `<span class="lbl lbl-sub">Style</span><div class="segments segments-sm btn-style" role="radiogroup" aria-label="Button ${k + 1} style">
      <button type="button" role="radio" data-st="standard" aria-checked="${lk.style !== 'luxury'}">Standard</button>
      <button type="button" role="radio" data-st="luxury" aria-checked="${lk.style === 'luxury'}">Luxury</button></div>`;
    for (const sb of styleRow.querySelectorAll('[data-st]')) sb.addEventListener('click', () => {
      if ((lk.style === 'luxury') === (sb.dataset.st === 'luxury')) return;
      lk.style = sb.dataset.st === 'luxury' ? 'luxury' : 'standard';
      selected = `bt:${b.id}`;
      commitScene(); save(); renderButtons(); draw();
    });
    looks.append(styleRow, gate.row, gate.box, slider('scale', 'Scale', 0.6, 1.6, 0.02, lk.scale || 1, (v) => `${Math.round(v * 100)}%`));
    row.append(head, showOnRow(`bt:${b.id}`), field, looks);
    {
      /* back to default: the brand's button colours, no stroke, its corners, 100 % —
         the button's text and position stay; Undo brings the previous look back */
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'link-btn link-inline btn-reset text-reset';
      reset.textContent = 'Reset to default';
      reset.title = 'The brand’s colors, corners and size for this button — its text and position stay';
      reset.addEventListener('click', () => {
        commitScene();
        pushUndo('Button back to default');
        b.look = CTA_LOOK();
        commitScene(); save(); renderButtons(); draw();
      });
      gate.box.append(reset);
    }
    host.append(row);
  });
  $('#buttons-empty').hidden = !!(state.buttons && state.buttons.length);
}

/* --- more media -------------------------------------------------------------------
   A section can carry more than one photo / video: the first is the Media
   card above (its own switch, scale and corners); more come from "Add more
   media", each placed (drag it) and sized on its own. They belong to the
   section, like its text boxes and buttons. Their videos play muted. */
const mediaItemById = (id) => (state.media || []).find((m) => m.id === id);

async function addMediaFiles(files) {
  const err = $('#media-more-error');
  const L = layout(ctx, state, canvas.width, canvas.height);
  let y = 0.2, k = (state.media || []).length;
  const bottoms = (L.media || []).map((m) => (m.insRect.y + m.ins.h) / canvas.height);
  if (bottoms.length) y = Math.min(0.7, Math.max(...bottoms) + 0.03);
  let last = null;
  for (const file of files) {
    try {
      const meta = await addUpload(file, 'inset');
      const id = `m${Date.now().toString(36)}${k++}`;
      state.media.push({ id, src: meta.id, x: 0.5 + ((k % 3) - 1) * 0.08, y, scale: 0.55, radius: 0.14 });
      y = Math.min(0.7, y + 0.08);
      last = id;
      err.hidden = true;
    } catch (e) {
      err.textContent = e.message || String(e);
      err.hidden = false;
    }
  }
  if (!last) return;
  commitScene();
  save();
  renderMediaItems();
  selected = `md:${last}`;
  syncSectionValues(true);
  draw();
  revealMediaItem(last);
}

function removeMediaItem(id) {
  const m = mediaItemById(id);
  if (!m) return;
  pushUndo('Media removed');
  state.media = state.media.filter((x) => x.id !== id);
  if (selected === `md:${id}`) selected = null;
  commitScene();
  save();
  // the file goes once the removal can no longer be undone and nothing else shows it
  setTimeout(() => {
    if (!cardInUse(m.src) && state.inset.id !== m.src && !undoStack.some((u) => JSON.stringify(u.data).includes(m.src))) removeUpload(m.src);
  }, 9000);
  renderMediaItems();
  syncSectionValues(true);
  draw();
}

function revealMediaItem(id) {
  requestAnimationFrame(() => {
    const row = document.getElementById(`md-${id}`);
    if (!row) return;
    revealInPanel(`md:${id}`);
    row.classList.remove('is-revealed');
    void row.offsetWidth;
    row.classList.add('is-revealed');
    setTimeout(() => row.classList.remove('is-revealed'), 1400);
  });
}

function renderMediaItems() {
  const host = $('#media-more');
  if (!host) return;
  host.innerHTML = '';
  const first = state.inset.id ? 1 : 0;
  (state.media || []).forEach((m, k) => {
    const row = document.createElement('div');
    row.className = 'block-item media-item';
    row.id = `md-${m.id}`;
    const head = document.createElement('div');
    head.className = 'block-head';
    const thumb = document.createElement('span');
    thumb.className = 'media-thumb';
    const el = mediaFor(m.src) && mediaFor(m.src).el;
    if (el) {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      try {
        const g = cv.getContext('2d');
        const iw = el.videoWidth || el.naturalWidth || 64, ih = el.videoHeight || el.naturalHeight || 64;
        const s2 = Math.max(64 / iw, 64 / ih);
        g.drawImage(el, (64 - iw * s2) / 2, (64 - ih * s2) / 2, iw * s2, ih * s2);
      } catch (_) {}
      thumb.append(cv);
    }
    const t = document.createElement('span');
    t.className = 'block-title';
    t.textContent = `Media ${k + 1 + first}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'block-del';
    del.setAttribute('aria-label', `Remove media ${k + 1 + first}`);
    del.innerHTML = MENU_ICONS.remove;
    del.addEventListener('click', () => removeMediaItem(m.id));
    head.append(thumb, t, pngButton(`md:${m.id}`, `media ${k + 1 + first}`), del);
    const slider = (key, label, min, max, step, fmt) => {
      const r = document.createElement('label');
      r.className = 'slider-row';
      const v = m[key];
      r.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="Media ${k + 1 + first} ${label.toLowerCase()}"><output>${fmt(v)}</output>`;
      const inp = r.querySelector('input'), out = r.querySelector('output');
      inp.addEventListener('input', () => { m[key] = Number(inp.value); out.textContent = fmt(m[key]); draw(); });
      inp.addEventListener('change', () => { commitScene(); save(); });
      inp.addEventListener('focus', () => { selected = `md:${m.id}`; draw(); });
      return r;
    };
    row.append(head, showOnRow(`md:${m.id}`),
      slider('scale', 'Scale', 0.2, 1.6, 0.01, (v) => `${Math.round(v * 100)}%`),
      slider('radius', 'Corners', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`));
    host.append(row);
  });
  // the first media is added with the tile above; more media once there is one
  $('#media-add').hidden = !(state.inset.id || (state.media || []).length);
}

/* While a section shows a video among its media, the preview keeps painting
   (the main loop only knows the background and the first card). */
function mediaTick() {
  const moving = (state.media || []).some((m) => isVideo(m.src));
  if (moving && !looping && !document.hidden) paint(LOOP_FRAME);   // v3.5: the canvas only; the panel follows draw()
  requestAnimationFrame(mediaTick);
}

function wireMediaItems() {
  const input = $('#media-more-input');
  $('#media-add').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    if (files.length) await addMediaFiles(files);
  });
  /* A media item on the preview: a tap selects it and opens Media; a drag moves it. */
  $('#canvas-wrap').addEventListener('pointerup', (e) => {
    if (!dragging || dragging.key !== 'media') return;
    if (fsMode === 'edit' && !dragging.moved) return;      // full screen has its own tap menu
    const d = dragging;
    dragging = null;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    e.stopPropagation();
    cancelLongPress();
    if (d.moved) { commitScene(); save(); selectElement(`md:${d.id}`, { reveal: false }); return; }
    selectElement(`md:${d.id}`);
    revealMediaItem(d.id);
  }, true);
  renderMediaItems();
  requestAnimationFrame(mediaTick);
}

/* --- more badges ------------------------------------------------------------------
   Besides its badge, a section can carry more: "Add a badge" places another,
   each with its own choice, scale and upper label ("Powered by" or your own
   words), dragged and removed on its own — like the extra media. */
const badgeItemById = (id) => (state.badges || []).find((b) => b.id === id);

function addBadgeItem() {
  const set = badges();
  const keys = Object.keys(set);
  if (!keys.length) return;
  state.badges = state.badges || [];
  const L = layout(ctx, state, canvas.width, canvas.height);
  const H = canvas.height, W = canvas.width;
  // the first free spot, top to bottom, clear of what is already on the section
  const taken = [
    L.wm.image ? L.wmRect : null, ...(L.xbadges || []).map((b) => b.rect),
    L.tx.empty ? null : { ...L.txRect, h: L.tx.h }, ...(L.buttons || []).map((b) => b.rect),
    ...(L.extras || []).map((x) => ({ ...x.txRect, h: x.tx.h })),
  ].filter(Boolean);
  const h = taken.length ? Math.max(...[L.wm.image ? L.wmRect.h : 0, ...(L.xbadges || []).map((b) => b.rect.h)], H * 0.06) : H * 0.1;
  const sa = safeArea(state.format, W, H);
  let y = null;
  for (let t = sa.y; t + h <= sa.y + sa.h && y == null; t += H * 0.02) {
    if (!taken.some((r) => t < r.y + r.h + H * 0.01 && t + h > r.y - H * 0.01)) y = t / H;
  }
  let x = 0.5;
  if (y == null) {
    // no free row: try every spot (across and down) and take the one that covers the least
    const k = (BADGE_ITEM().scale || 0.8) / (Number(state.badgeScale) || 1);
    const w = L.wm.image ? L.wmRect.w * k : W * 0.3, hh = L.wm.image ? L.wmRect.h * k : h;
    let best = null;
    for (let t = sa.y; t + hh <= sa.y + sa.h; t += H * 0.02) {
      for (let cx = sa.x + w / 2; cx <= sa.x + sa.w - w / 2 + 0.5; cx += W * 0.04) {
        const r = { x: cx - w / 2, y: t, w, h: hh };
        const cover = taken.reduce((a, o) => a + Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)), 0);
        const score = cover + Math.abs(cx - W / 2) * 0.01;
        if (!best || score < best.score) best = { score, x: cx / W, y: t / H };
      }
    }
    if (best) { x = best.x; y = best.y; } else y = sa.y / H;
  }
  const main = state.badge === 'auto' ? activeBd().badge : state.badge;
  const key = set[main] ? main : set[state.badgeLast] ? state.badgeLast : keys[0];
  const id = `g${Date.now().toString(36)}`;
  state.badges.push({ ...BADGE_ITEM(), id, badge: key, x, y });
  commitScene();
  save();
  renderBadgeItems();
  selected = `eb:${id}`;
  syncSectionValues(true);
  draw();
  revealBadgeItem(id);
}

function removeBadgeItem(id) {
  if (!badgeItemById(id)) return;
  pushUndo('Badge removed');
  state.badges = state.badges.filter((b) => b.id !== id);
  if (selected === `eb:${id}`) selected = null;
  commitScene();
  save();
  renderBadgeItems();
  syncSectionValues(true);
  draw();
}

/** A tap on an extra badge's upper or lower part puts the cursor in that part's text. */
function focusBadgeItemPart(id, e) {
  const L = layout(ctx, state, canvas.width, canvas.height);
  const xb = (L.xbadges || []).find((x) => x.id === id);
  if (!xb) return;
  const p = toCanvas(e);
  const inR = (r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const part = ['lower', 'upper'].find((k) => inR(xb.badge.parts[k]));
  if (!part) return;
  setTimeout(() => {
    const f = document.querySelector(`#eb-${id} input[data-bpart="${part}"]`);
    if (f && f.offsetParent) { f.focus({ preventScroll: true }); const n = f.value.length; f.setSelectionRange(n, n); }
  }, 80);
}

function revealBadgeItem(id) {
  requestAnimationFrame(() => {
    const row = document.getElementById(`eb-${id}`);
    if (!row) return;
    revealInPanel(`eb:${id}`);
    row.classList.remove('is-revealed');
    void row.offsetWidth;
    row.classList.add('is-revealed');
    setTimeout(() => row.classList.remove('is-revealed'), 1400);
  });
}

let badgeItemsSig = '';
function renderBadgeItems(force = true) {
  const host = $('#badge-more');
  if (!host) return;
  const sig = JSON.stringify([state.brand, state.scene, (state.badges || []).map((b) => [b.id, b.badge])]);
  if (!force && sig === badgeItemsSig) return;
  badgeItemsSig = sig;
  host.innerHTML = '';
  const set = badges();
  const brand = activeBrand();
  (state.badges || []).forEach((b, k) => {
    const n = k + 2;
    const pick = () => { selected = `eb:${b.id}`; draw(); };
    const done = () => { commitScene(); save(); };
    const row = document.createElement('div');
    row.className = 'block-item badge-item';
    row.id = `eb-${b.id}`;
    row.addEventListener('focusin', pick);
    const head = document.createElement('div');
    head.className = 'block-head';
    const key = set[b.badge] ? b.badge : Object.keys(set)[0];
    const t = document.createElement('span');
    t.className = 'block-title';
    t.textContent = `Badge ${n}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'block-del';
    del.setAttribute('aria-label', `Remove badge ${n}`);
    del.innerHTML = MENU_ICONS.remove;
    del.addEventListener('click', () => removeBadgeItem(b.id));
    head.append(t, pngButton(`eb:${b.id}`, `badge ${n}`), del);
    // which badge
    const choice = document.createElement('div');
    choice.className = 'thumbs badge-thumbs badge-item-choice';
    choice.setAttribute('role', 'radiogroup');
    choice.setAttribute('aria-label', `Badge ${n} style`);
    for (const [kk, v] of Object.entries(set)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'badge-thumb';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(kk === key));
      btn.setAttribute('aria-label', v.label || kk);
      btn.title = v.label || kk;
      const im = document.createElement('img');
      im.src = badgeThumbSrc(v);
      im.alt = '';
      im.decoding = 'async';
      const check = document.createElement('span');
      check.className = 'thumb-check';
      check.setAttribute('aria-hidden', 'true');
      btn.append(im, check);
      btn.addEventListener('click', () => { b.badge = kk; pick(); done(); renderBadgeItems(); draw(); revealBadgeItem(b.id); });
      choice.append(btn);
    }
    // its size
    const scale = document.createElement('label');
    scale.className = 'slider-row';
    scale.innerHTML = `<span>Scale</span><input type="range" min="0.25" max="1.4" step="0.02" value="${Number(b.scale) || 1}" aria-label="Badge ${n} scale"><output>${Math.round((Number(b.scale) || 1) * 100)}%</output>`;
    const si = scale.querySelector('input'), so = scale.querySelector('output');
    si.addEventListener('input', () => { b.scale = Number(si.value); so.textContent = `${Math.round(b.scale * 100)}%`; draw(); });
    si.addEventListener('change', done);
    // its upper label
    const up = document.createElement('label');
    up.className = 'switch switch-row';
    up.innerHTML = `<input type="checkbox" ${b.powered !== false ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span>Upper badge</span>`;
    const upIn = up.querySelector('input');
    const txt = document.createElement('input');
    txt.type = 'text';
    txt.className = 'lower-text';
    txt.maxLength = 40;
    txt.placeholder = UPPER_DEFAULT_TEXT;
    txt.value = b.upper == null ? UPPER_DEFAULT_TEXT : b.upper;
    txt.setAttribute('aria-label', `Badge ${n} upper text`);
    txt.hidden = b.powered === false;
    upIn.addEventListener('change', () => { b.powered = upIn.checked; txt.hidden = !upIn.checked; done(); draw(); });
    txt.addEventListener('input', () => { b.upper = txt.value; draw(); });
    txt.addEventListener('change', done);
    txt.dataset.bpart = 'upper';
    const parts = [head, showOnRow(`eb:${b.id}`), choice];
    if (isTextBadge(key)) parts.push(middleControls(() => ({ ...MIDDLE_DEFAULT(), ...(b.middle || {}) }), (patch) => { b.middle = { ...MIDDLE_DEFAULT(), ...(b.middle || {}), ...patch }; }, `Badge ${n}`, pick, done));
    row.append(...parts, scale, up, txt, lowerControls(b, n, pick, done));
    host.append(row);
  });
}

/** An extra badge's lower badge: the same controls as the first badge's. */
function lowerControls(b, n, pick, done) {
  const lo = () => (b.lower = { ...LOWER_DEFAULT(), ...(b.lower || {}) });
  const brandName = (activeBrand() && activeBrand().name) || '';
  const wrap = document.createElement('div');
  wrap.className = 'badge-item-lower';
  const sw = document.createElement('label');
  sw.className = 'switch switch-row';
  sw.innerHTML = `<input type="checkbox" ${lo().on ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span>Lower badge <small class="switch-sub">A text box under the badge</small></span>`;
  const on = sw.querySelector('input');
  const body = document.createElement('div');
  body.className = 'bp-body';
  body.hidden = !lo().on;
  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'lower-text';
  text.maxLength = 60;
  text.placeholder = brandName || 'Text under the badge';
  text.value = lo().text == null ? brandName : lo().text;
  text.setAttribute('aria-label', `Badge ${n} lower badge text`);
  text.dataset.bpart = 'lower';
  text.addEventListener('input', () => { lo().text = text.value; draw(); });
  text.addEventListener('change', done);
  // colours: the brand's five; one colour never moves another
  const rows = {};
  const colourRow = (kind, label) => {
    const line = document.createElement('div');
    line.className = 'swatch-line lower-row';
    line.setAttribute('role', 'radiogroup');
    line.setAttribute('aria-label', `Badge ${n} lower badge ${label.toLowerCase()}`);
    line.innerHTML = `<span class="swatch-lbl">${label}</span><span class="swatches"></span>`;
    rows[kind] = line.querySelector('.swatches');
    return line;
  };
  const paint = () => {
    const now = lowerColours(lo());
    for (const kind of ['ink', 'fill', 'stroke']) {
      const host = rows[kind];
      host.innerHTML = '';
      const current = String(kind === 'ink' ? now.ink : kind === 'fill' ? now.fill : now.stroke).toLowerCase();
      const chip = (value, label, cls) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = `sw ${cls}`;
        c.setAttribute('role', 'radio');
        c.setAttribute('aria-checked', String(String(value).toLowerCase() === current));
        c.setAttribute('aria-label', label);
        c.title = label;
        if (cls.includes('sw-colour')) c.style.setProperty('--sw', value);
        c.addEventListener('click', (e) => {
          e.stopPropagation();
          const fix = lowerColours(lo());
          Object.assign(lo(), { ink: fix.ink, fill: fix.fill, stroke: fix.stroke, [kind]: value });
          pick(); done(); paint(); draw();
        });
        host.append(c);
      };
      if (kind === 'fill') chip('none', 'None (transparent)', 'sw-none');
      for (const { name, hex } of brandSwatches()) chip(hex, name, 'sw-colour');
    }
  };
  const strokeSw = document.createElement('label');
  strokeSw.className = 'switch switch-row';
  strokeSw.innerHTML = `<input type="checkbox" ${lo().strokeOn ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span>Stroke</span>`;
  const strokeOn = strokeSw.querySelector('input');
  const strokeBody = document.createElement('div');
  strokeBody.hidden = !lo().strokeOn;
  const slider = (label, min, max, step, get, set, fmt) => {
    const r = document.createElement('label');
    r.className = 'slider-row';
    r.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${get()}" aria-label="Badge ${n} lower badge ${label.toLowerCase()}"><output>${fmt(get())}</output>`;
    const i = r.querySelector('input'), o = r.querySelector('output');
    i.addEventListener('input', () => { set(Number(i.value)); o.textContent = fmt(Number(i.value)); draw(); });
    i.addEventListener('change', done);
    return r;
  };
  const width = slider('Width', 1, LOWER_STROKE_MAX, 1, () => Math.max(1, Math.min(LOWER_STROKE_MAX, Number(lo().strokeW) || 3)), (v) => { lo().strokeW = Math.round(v); lo().strokeOn = true; }, (v) => `${Math.round(v)} px`);
  strokeBody.append(colourRow('stroke', 'Color'), width);
  strokeOn.addEventListener('change', () => { lo().strokeOn = strokeOn.checked; strokeBody.hidden = !strokeOn.checked; pick(); done(); draw(); });
  const scale = slider('Scale', 0.6, 1.6, 0.02, () => Number(lo().scale) || 1, (v) => { lo().scale = Math.round(v * 100) / 100; }, (v) => `${Math.round(v * 100)}%`);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'link-btn text-reset';
  reset.textContent = 'Reset to default';
  reset.addEventListener('click', () => {
    commitScene();
    pushUndo(`Badge ${n} lower badge back to default`);
    b.lower = { ...LOWER_DEFAULT(), on: lo().on, text: lo().text };
    done(); renderBadgeItems(); draw(); revealBadgeItem(b.id);
  });
  const gate = styleGate(`xb-lower:${b.id}`, `Badge ${n} lower badge`, () => lowerIsCustom(lo()), () => {
    commitScene();
    pushUndo(`Badge ${n} lower badge back to the brand style`);
    b.lower = { ...LOWER_DEFAULT(), on: lo().on, text: lo().text, scale: lo().scale };
    done(); renderBadgeItems(); draw(); revealBadgeItem(b.id);
  });
  gate.box.append(colourRow('ink', 'Text'), colourRow('fill', 'Background'), strokeSw, strokeBody, reset);
  body.append(text, gate.row, gate.box, scale);
  paint();
  on.addEventListener('change', () => {
    lo().on = on.checked;
    body.hidden = !on.checked;
    pick(); done(); draw();
    if (on.checked && !isPhone()) setTimeout(() => text.focus({ preventScroll: true }), 0);
  });
  wrap.append(sw, body);
  return wrap;
}

/* --- the selected item, in view in the panel ----------------------------------------
   A tap on the preview opens the item's section and scrolls the panel (or the
   full-screen panel, or the phone's sheet) so the item's own controls are in view —
   an extra badge's row, a button's, a text box's — and every strip of thumbnails in
   it slides to the one in use. */
function panelNodeFor(el) {
  const s = String(el || '');
  if (s.startsWith('eb:')) return document.getElementById(`eb-${s.slice(3)}`);
  if (s.startsWith('bt:')) return document.getElementById(`btn-${s.slice(3)}`);
  if (s.startsWith('md:')) return document.getElementById(`md-${s.slice(3)}`);
  if (s.startsWith('xb:')) return document.getElementById(`blk-${s.split(':')[1]}`);
  if (s === 'watermark') return (badgePart && document.querySelector(`.badge-part[data-bpart="${badgePart}"]`)) || $('#badge-field');
  if (s === 'h1' || s === 'text') return $('#group-h1');
  if (s === 'body') return $('#group-body');
  if (s === 'inset') return $('#group-inset');
  if (s === 'background') return $('#group-background');
  return null;
}
function scrollerOf(n) {
  for (let p = n && n.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p;
  }
  return null;
}
const motion = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
function centreThumbs(root) {
  if (!root) return;
  for (const strip of root.querySelectorAll('.thumbs')) {
    const on = strip.querySelector('[aria-checked="true"], .is-active');
    if (!on || strip.scrollWidth <= strip.clientWidth + 2) continue;
    strip.scrollTo({ left: Math.max(0, on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2), behavior: motion() });
  }
}
function revealInPanel(el) {
  clearTimeout(revealInPanel.t);
  // after the section has opened and its rows are built
  revealInPanel.t = setTimeout(() => requestAnimationFrame(() => {
    const node = panelNodeFor(el);
    if (!node || node.offsetParent === null) return;
    const box = scrollerOf(node);
    if (box) {
      const nb = node.getBoundingClientRect(), bb = box.getBoundingClientRect();
      const inView = nb.top >= bb.top + 4 && nb.bottom <= bb.bottom - 4;
      if (!inView) box.scrollTo({ top: Math.max(0, box.scrollTop + nb.top - bb.top - 8), behavior: motion() });
    }
    centreThumbs(node);
    if (el === 'watermark') centreThumbs($('#bp-image-body'));
  }), 90);
}

/* --- several items at once ------------------------------------------------------
   Shift-click (or ⌘ / Ctrl-click) on the preview adds an item to the selection or
   takes it out; on a phone, long-press → Multi select, then tap. Dragging any of
   them moves them all; a small bar offers Align centre, Space evenly, Remove (Hide
   for the section's own text, badge and media) and Done. Delete removes, Esc
   clears. Undo covers it all. */
let multiSel = [];
let multiMode = false;           // touch: taps add and take out
let groupDrag = null;

const multiKey = (el) => {
  const s = String(el || '');
  if (s === 'h1' || s === 'body') return 'text';
  if (s.startsWith('xb:')) return `xb:${s.split(':')[1]}`;
  return s;
};
function multiTarget(k) {
  const pos = state.pos[state.format];
  if (k === 'watermark') return pos.watermark;
  if (k === 'text') return pos.text;
  if (k === 'inset') return pos.inset || (pos.inset = { x: 0.5, y: 0.5 });
  if (k.startsWith('eb:')) return badgeItemById(k.slice(3));
  if (k.startsWith('bt:')) return buttonById(k.slice(3));
  if (k.startsWith('md:')) return mediaItemById(k.slice(3));
  if (k.startsWith('xb:')) return (state.blocks || []).find((b) => b.id === k.slice(3));
  return null;
}
function multiRect(k, L) {
  if (k === 'watermark') return L.wm.image ? { ...L.wmRect } : null;
  if (k === 'text') return L.tx.empty ? null : { ...L.txRect, h: L.tx.h };
  if (k === 'inset') return L.ins.image ? { ...L.insRect, h: L.ins.h } : null;
  const id = k.slice(3);
  if (k.startsWith('eb:')) { const b = (L.xbadges || []).find((x) => x.id === id); return b ? { ...b.rect } : null; }
  if (k.startsWith('bt:')) { const b = (L.buttons || []).find((x) => x.id === id); return b ? { ...b.rect } : null; }
  if (k.startsWith('md:')) { const m = (L.media || []).find((x) => x.id === id); return m ? { ...m.insRect, h: m.ins.h } : null; }
  if (k.startsWith('xb:')) { const x = (L.extras || []).find((e) => e.id === id); return x ? { ...x.txRect, h: x.tx.h } : null; }
  return null;
}
/** Forget the selection without drawing (a new design, section or template is coming). */
function dropMulti() {
  if (!multiSel.length && !multiMode) return;
  multiSel = [];
  multiMode = false;
  groupDrag = null;
  if (clipMenuFor === -5) closeClipMenu();
}
function clearMulti() {
  if (!multiSel.length && !multiMode) return;
  multiSel = [];
  multiMode = false;
  if (clipMenuFor === -5) closeClipMenu();
  draw();
}
function toggleMulti(el) {
  const k = multiKey(el);
  if (!k || k === 'background') return;
  if (!multiSel.length && selected && selected !== 'background' && multiKey(selected) !== k) multiSel = [multiKey(selected)];
  const i = multiSel.indexOf(k);
  if (i >= 0) multiSel.splice(i, 1); else multiSel.push(k);
  selected = multiSel.length ? (multiSel[multiSel.length - 1] === 'text' ? 'h1' : multiSel[multiSel.length - 1]) : null;
  draw();
  showMultiBar();
}
function startMultiMode(el) {
  multiMode = true;
  multiSel = [multiKey(el)];
  selected = el;
  draw();
  showMultiBar();
}
function showMultiBar() {
  if (!multiSel.length || (multiSel.length < 2 && !multiMode)) { if (clipMenuFor === -5) closeClipMenu(); return; }
  requestAnimationFrame(() => {
    const L = layout(ctx, state, canvas.width, canvas.height);
    const rs = multiSel.map((k) => multiRect(k, L)).filter(Boolean);
    if (!rs.length) return;
    const c = canvas.getBoundingClientRect();
    const k = c.width / canvas.width;
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
    const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
    const r = { left: c.left + x0 * k, top: c.top + y0 * k, width: (x1 - x0) * k, height: (y1 - y0) * k, right: c.left + x1 * k, bottom: c.top + y1 * k };
    const n = multiSel.length;
    const items = [];
    const narrow = window.innerWidth < 600;   // a phone: short words, so the bar fits in two rows
    if (n > 1) {
      items.push({ icon: 'tidy', label: narrow ? 'Tidy up' : 'Tidy up selection', run: () => multiTidy() });
      items.push({ icon: 'tidy', label: narrow ? 'Align' : 'Align centre', run: () => multiAlign() });
      if (n > 2) items.push({ icon: 'space', label: narrow ? 'Space' : 'Space evenly', run: () => multiSpace() });
      items.push({ icon: 'remove', label: `Remove ${n}`, danger: true, run: () => multiRemove() });
    }
    items.push({ icon: 'check', label: n > 1 ? 'Done' : 'Tap items to add', run: () => clearMulti() });
    const keep = { getBoundingClientRect: () => ({ ...r, left: r.left + r.width / 2 - 110, width: 220 }) };
    openMenuAt(keep, items, `${n} selected`);
    const m = $('#clip-menu');
    m.classList.add('is-quick', 'is-multi');
    hideScrim('menu');
    // re-place: the bar measures differently from the menu (and wraps to two rows on a phone)
    const w = m.offsetWidth, h = m.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.top - h - 10 > 8 ? r.top - h - 10 : Math.min(r.bottom + 10, window.innerHeight - h - 8);
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
    clipMenuFor = -5;
  });
}
function multiAlign() {
  const W = canvas.width, H = canvas.height;
  const L = layout(ctx, state, W, H);
  pushUndo(`${multiSel.length} items centred`);
  const goals = new Map();
  for (const k of multiSel) {
    const r = multiRect(k, L), t = multiTarget(k);
    if (r && t) goals.set(t, { x: W / 2 - r.w / 2, y: r.y });
  }
  settle(goals, () => { const L2 = layout(ctx, state, W, H); return multiSel.map((k) => [multiTarget(k), multiRect(k, L2)]); });
  markEdited();
  commitScene(); save(); draw(); showMultiBar();
}
/** Tidy up the selection: one centred column, in the order they are in, evenly spaced. */
function multiTidy() {
  const W = canvas.width, H = canvas.height;
  const L = layout(ctx, state, W, H);
  const list = multiSel.map((k) => ({ k, r: multiRect(k, L), t: multiTarget(k) })).filter((x) => x.r && x.t)
    .sort((a, b) => (a.r.y + a.r.h / 2) - (b.r.y + b.r.h / 2));
  if (list.length < 2) return;
  pushUndo(`${list.length} items tidied up`);
  const top = list[0].r.y, bottom = list[list.length - 1].r.y + list[list.length - 1].r.h;
  const total = list.reduce((t, x) => t + x.r.h, 0);
  const sa = safeArea(state.format, W, H);
  // as they stand, evenly; never tighter than 2 % or looser than 5 % of the frame
  const gap = Math.max(H * 0.02, Math.min(H * 0.05, (bottom - top - total) / (list.length - 1)));
  const height = total + gap * (list.length - 1);
  const mid = (top + bottom) / 2;
  let y = Math.max(sa.y, Math.min(sa.y + sa.h - height, mid - height / 2));
  const goals = new Map();
  for (const x of list) { goals.set(x.t, { x: W / 2 - x.r.w / 2, y }); y += x.r.h + gap; }
  settle(goals, () => { const L2 = layout(ctx, state, W, H); return multiSel.map((k) => [multiTarget(k), multiRect(k, L2)]); });
  markEdited();
  commitScene(); save(); draw(); showMultiBar();
}
function multiSpace() {
  const W = canvas.width, H = canvas.height;
  const L = layout(ctx, state, W, H);
  const list = multiSel.map((k) => ({ k, r: multiRect(k, L), t: multiTarget(k) })).filter((x) => x.r && x.t)
    .sort((a, b) => (a.r.y + a.r.h / 2) - (b.r.y + b.r.h / 2));
  if (list.length < 3) return;
  pushUndo(`${list.length} items spaced`);
  const top = list[0].r.y, bottom = list[list.length - 1].r.y + list[list.length - 1].r.h;
  const total = list.reduce((t, x) => t + x.r.h, 0);
  const gap = Math.max(H * 0.012, (bottom - top - total) / (list.length - 1));
  let y = top;
  const goals = new Map();
  for (const x of list) { goals.set(x.t, { x: x.r.x, y }); y += x.r.h + gap; }
  settle(goals, () => { const L2 = layout(ctx, state, W, H); return multiSel.map((k) => [multiTarget(k), multiRect(k, L2)]); });
  markEdited();
  commitScene(); save(); draw(); showMultiBar();
}
function multiRemove() {
  const list = [...multiSel];
  pushUndo(`${list.length} items removed`);
  const ids = (p) => list.filter((k) => k.startsWith(p)).map((k) => k.slice(3));
  const eb = ids('eb:'), bt = ids('bt:'), md = ids('md:'), xb = ids('xb:');
  if (eb.length) state.badges = (state.badges || []).filter((b) => !eb.includes(b.id));
  if (bt.length) state.buttons = (state.buttons || []).filter((b) => !bt.includes(b.id));
  if (md.length) state.media = (state.media || []).filter((m) => !md.includes(m.id));
  if (xb.length) state.blocks = (state.blocks || []).filter((b) => !xb.includes(b.id));
  // the section's own text, badge and media: hidden (their switches bring them back)
  if (list.includes('text')) setVisibility(false, false);
  if (list.includes('watermark') && $('#tg-badge').checked) $('#tg-badge').click();
  if (list.includes('inset') && $('#tg-inset').checked) $('#tg-inset').click();
  multiSel = []; multiMode = false; selected = null;
  closeClipMenu();
  commitScene(); save();
  renderBlocks(); renderButtons(); renderMediaItems(); renderBadgeItems();
  syncSectionValues(true);
  draw();
}

function wireMultiSelect() {
  const wrap = $('#canvas-wrap');
  // before the canvas's own handlers: a modifier tap, a tap in select mode, or a drag of the selection
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || e.button > 0 || editor || fsMode === 'preview') return;
    const el = canvasElementAt(e);
    const k = multiKey(el);
    const mod = e.shiftKey || e.metaKey || e.ctrlKey;
    if (mod || multiMode) {
      if (el === 'background') { if (multiMode) e.stopPropagation(); return; }
      e.stopPropagation(); e.preventDefault();
      cancelLongPress();
      // a drag of a selected item moves them all; a tap adds it or takes it out
      groupDrag = { sx: e.clientX, sy: e.clientY, moved: false, tap: el, starts: null };
      if (multiSel.includes(k) && multiSel.length > 1) groupDrag.starts = multiSel.map((m) => multiTarget(m)).filter(Boolean).map((t) => ({ t, x: t.x, y: t.y }));
      return;
    }
    if (multiSel.length > 1 && multiSel.includes(k)) {
      e.stopPropagation(); e.preventDefault();
      cancelLongPress();
      groupDrag = { sx: e.clientX, sy: e.clientY, moved: false, tap: null, plainTap: el, starts: multiSel.map((m) => multiTarget(m)).filter(Boolean).map((t) => ({ t, x: t.x, y: t.y })) };
      return;
    }
    if (multiSel.length) clearMulti();          // a plain tap elsewhere: back to one at a time
  }, true);
  window.addEventListener('pointermove', (e) => {
    const g = groupDrag;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < TAP_SLOP) return;
    if (!g.starts) return;
    if (!g.moved) { g.moved = true; closeClipMenu(); }
    const r = canvas.getBoundingClientRect();
    const dx = (e.clientX - g.sx) / r.width, dy = (e.clientY - g.sy) / r.height;
    for (const s0 of g.starts) { s0.t.x = s0.x + dx; s0.t.y = s0.y + dy; }
    draw();
  });
  window.addEventListener('pointerup', () => {
    const g = groupDrag;
    groupDrag = null;
    if (!g) return;
    if (g.moved) { markEdited(); commitScene(); save(); showMultiBar(); return; }
    if (g.tap) toggleMulti(g.tap);
    else if (g.plainTap) {
      // a plain tap on one of them: just that one
      clearMulti();
      if (fsMode === 'edit') fsSelect(g.plainTap); else selectElement(g.plainTap);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (multiSel.length < 2 && !multiMode) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.isContentEditable);
    if (e.key === 'Escape') { e.stopImmediatePropagation(); clearMulti(); return; }
    if (!typing && multiSel.length > 1 && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); multiRemove(); }
  }, true);
}

/* --- add, edit, view ------------------------------------------------------------
   Add → +: one menu for everything new (Background, Text, Button, Media, Badge,
   and a Section). Edit → select it on the preview: its controls open on their own,
   nothing else. View → the preview's own controls: Safe area and Grid sit with Full
   screen on desktop, in the menu (☰) on a phone. The section tabs are gone. */
let addAnchor = null;
const TAB_TITLE = { background: 'Background', text: 'Text', buttons: 'Buttons', card: 'Media', badge: 'Badge' };

function addItems(pointerType) {
  const sc = state.scenes[state.scene];
  const open = (tab, el) => { fsOpenSection(tab, el); revealInPanel(el || ELEMENT_OF[tab] || tab); };
  const items = [];
  items.push({ icon: 'image', label: 'Background', sub: 'Colors, patterns, pictures · Tone down', run: () => open('background', 'background') });
  if (!isBase(state.scene) && sc.bg) items.push({ icon: 'rewind', label: 'Use the first section’s background', run: matchHook });
  const textShowing = state.visibility !== 'none' && String(state.h1 || '').trim() && String(state.body || '').trim();
  items.push({ icon: 'text', label: 'Text', sub: textShowing ? 'Another text box — header and body' : 'Header and body, in one box', run: () => {
    if (!textShowing) {
      fillTextPlaceholders();
      state.textMode = 'both';
      setVisibility(true, true);
      commitScene(); save(); renderScenes();
      fsEditText('h1', pointerType);
    } else { addBlock(); fsOpenSection('text', selected); }
  } });
  items.push({ icon: 'button', label: 'Button', sub: 'On this section', run: () => { fsOpenSection('buttons'); addButton(); } });
  const hasCard = !!state.inset.id && !state.inset.hidden;
  items.push({ icon: 'film', label: 'Media', sub: hasCard ? 'Another photo or video' : 'A photo or video', run: () => {
    fsOpenSection('card', hasCard ? 'inset' : undefined);
    if (hasCard) $('#media-add').click(); else $('#btn-inset').click();
  } });
  if (!$('#badge-field').hidden) {
    const badgeOn = $('#tg-badge').checked;
    items.push({ icon: 'badge', label: 'Badge', sub: badgeOn ? 'Another badge' : 'The brand badge', run: () => {
      if (!badgeOn) { $('#tg-badge').click(); fsOpenSection('badge', 'watermark'); revealInPanel('watermark'); return; }
      fsOpenSection('badge');
      addBadgeItem();
    } });
  }
  items.push({ icon: 'draw', label: 'Drawing', sub: 'Draw on the canvas — lines, arrows, circles', run: () => setTimeout(() => enterDraw(null), 0) });
  if (state.contentType !== 'carousel') items.push({ icon: 'captions', label: 'Captions', sub: state.captions && state.captions.cues && state.captions.cues.length ? `${state.captions.cues.length} lines · style, size, position` : 'Words on screen for the whole reel', run: () => setTimeout(openCaptions, 0) });
  if (state.contentType !== 'carousel') items.push({ icon: 'film', label: 'Overlay clip', sub: 'Media, text, a badge, a cogent or a drawing — for a moment of the film', more: true, run: () => setTimeout(() => openOverlayAddMenu(addAnchor && addAnchor.isConnected ? addAnchor : $('#fs-add-section')), 0) });
  // v4 · sections / slides are added with their own button (the timeline's Add section), not here —
  // except in desktop full screen, where the timeline is out of sight: then last, after a line
  const tlVisible = !!($('#tl-add-section') && $('#tl-add-section').offsetParent);
  if (!tlVisible) {
    items.push({ sep: true });
    const slide = state.contentType === 'carousel';
    items.push({ icon: 'section', label: slide ? 'New slide' : 'New section', sub: 'Hook, Value or CTA — after this one', run: () => setTimeout(fsAddSection, 0) });
  }
  // v3.21 · a phone starts a new project from + (it left ☰); a desktop has the button by the heart
  if (isPhone()) {
    items.push({ sep: true });
    items.push({ icon: 'add', label: 'New project', sub: newProjectSub(), run: () => setTimeout(newProjectHere, 0) });
  }
  return items;
}
const newProjectType = () => (state.contentType === 'carousel' ? 'carousel' : 'video');
const newProjectSub = () => `A new ${activeBrand().name} ${newProjectType() === 'carousel' ? 'carousel' : 'Reel'} · this one stays in Recent`;
/** A new project in the brand that is open (a Reel, or a carousel if that is what you are making). */
async function newProjectHere() {
  if (editor) closeEditor(true);
  closeClipMenu();
  await createProject(activeBrand().id, newProjectType());
  showToast(`New ${activeBrand().name} project — the last one is in ☰ Recent projects`);
}
function openAddMenu(anchor, pointerType) {
  if (editor) closeEditor(true);
  addAnchor = anchor;
  openMenuAt(anchor, addItems(pointerType), 'Add');
  clipMenuFor = -4;
}

/** The panel's top row: + Add, what is being edited, and Done. */
function syncPanelTop() {
  const t = sheetTab && sheetTab !== 'all' ? sheetTab : null;
  const title = $('#panel-top-title'), done = $('#panel-done');
  if (!title || !done) return;
  title.textContent = '';                 // the open section's own heading names it; the row keeps + Add and Done
  title.dataset.tab = t || '';
  done.hidden = !t;
}

/** View settings: Safe area and Grid, with Full screen (desktop) — the same switches everywhere. */
function viewToggle(id, on) {
  const el = $(id);
  if (!el || el.checked === on) return;
  el.checked = on;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function viewItems() {
  const guides = !!state.guides, grid = !!state.grid;
  return [
    // v3.21: in full screen the × in the bar closes it — no Exit full screen here
    ...(fsMode ? [] : [{ icon: 'expand', label: 'Full screen', sub: 'The canvas large, the same editing', run: () => setFsMode('edit') }, { sep: true }]),
    { icon: 'safe', label: `Safe area · ${guides ? 'On' : 'Off'}`, sub: 'Where platform buttons and captions stay clear', run: () => { viewToggle('#tg-guides', !guides); reopenView(); } },
    { icon: 'grid', label: `Grid · ${grid ? 'On' : 'Off'}`, sub: 'Centre lines, thirds, columns — dragging snaps', run: () => { viewToggle('#tg-grid', !grid); reopenView(); } },
    ...(state.format === '9x16' ? [{ icon: 'safe', label: `Safe area for · ${SAFE_TARGETS[state.safeFor || 'all'].label}`, sub: 'Where it will be posted', more: true, run: () => openSafeForMenu(viewAnchor) }] : []),
  ];
}
/* v3.1 · where a 9:16 will be posted decides what covers it (render.js SAFE_TARGETS) */
function setSafeFor(t) {
  if (!SAFE_TARGETS[t]) return;
  state.safeFor = t;
  setSafeTarget(t);
  if (!state.guides) viewToggle('#tg-guides', true);   // you asked where it's safe: show it
  save();
  draw();
}
function openSafeForMenu(anchor) {
  const cur = state.safeFor || 'all';
  const items = Object.entries(SAFE_TARGETS).map(([k, t]) => ({
    icon: k === cur ? 'check' : 'blank', label: t.label,
    sub: k === 'all' ? 'Clear of every platform — the default' : null,
    run: () => setSafeFor(k),
  }));
  openMenuAt(anchor && anchor.isConnected ? anchor : $('#fs-open'), items, 'Safe area for');
  clipMenuFor = -7;
}
let viewAnchor = null;
function openViewMenu(anchor) {
  viewAnchor = anchor;
  openMenuAt(anchor, viewItems(), 'View');
  $('#clip-menu').classList.add('is-view');
  clipMenuFor = -6;
}
function reopenView() { if (viewAnchor && viewAnchor.isConnected) setTimeout(() => openViewMenu(viewAnchor), 0); }

/* --- the menu (☰): your projects, and the view on a phone ----------------------- */
function burgerRow(it) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'burger-row';
  const pic = document.createElement('span');
  pic.className = 'burger-thumb';
  let src = null;
  try { src = (it.data && designThumb(it.data)) || it.thumb || null; } catch (_) { src = it.thumb || null; }
  if (src) { const im = document.createElement('img'); im.src = src; im.alt = ''; pic.append(im); } else pic.append(brandMark(it.brand));
  const txt = document.createElement('span');
  txt.className = 'burger-txt';
  const nm = document.createElement('span'); nm.className = 'burger-name'; nm.textContent = it.name;
  const meta = document.createElement('span'); meta.className = 'burger-meta';
  meta.textContent = `${it.type === 'carousel' ? 'Carousel' : 'Video'} · ${BRANDS[it.brand] ? BRANDS[it.brand].name : ''}${it.kind === 'current' ? ' · open now' : it.time ? ` · ${ago(it.time)}` : ''}`;
  txt.append(nm, meta);
  b.append(pic, txt);
  if (it.kind === 'current') b.classList.add('is-current');
  b.addEventListener('click', () => { closeBurger(); openHomeItem(it); });
  // v3.7 · Export and ✕ on the right of each recent project
  const wrap = document.createElement('div');
  wrap.className = 'burger-item';
  wrap.append(b, projectActions(it));
  return wrap;
}
function renderBurger() {
  const m = $('#burger-menu');
  m.innerHTML = '';
  const { recent, saved } = homeItems();
  const sec = (title) => { const h = document.createElement('div'); h.className = 'burger-sec'; h.textContent = title; m.append(h); };
  const action = (icon, label, sub, run) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'burger-act';
    b.innerHTML = `<i class="clip-menu-icon" aria-hidden="true">${MENU_ICONS[icon]}</i><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>`;
    b.addEventListener('click', () => { closeBurger(); run(); });
    m.append(b);
  };
  // v4 · Projects only: new, templates, a named copy, recent, all. View settings have their own
  // button (the grid icon by the preview, and View in the full-screen bar).
  sec('Projects');
  action('add', 'New project', `A new ${activeBrand().name} design · this one stays in Recent`, () => newProjectHere());
  action('copy', 'Templates', 'Start from this brand’s designs, or Blank · Undo goes back', () => $('#start-new').click());
  action('save', 'Save a named copy…', 'The open design also saves itself as you work', () => openSavePop());
  m.append(document.createElement('hr'));
  // v3.7 · the three latest; Show all opens every project (Recent tab first)
  const head = document.createElement('div'); head.className = 'burger-sec burger-sec-row';
  head.append(document.createTextNode('Recent projects'));
  if (recent.length + saved.length) {
    const all = document.createElement('button'); all.type = 'button'; all.className = 'burger-all'; all.textContent = 'Show all';
    all.addEventListener('click', () => { closeBurger(); openHomeAll('recent'); });
    head.append(all);
  }
  m.append(head);
  if (recent.length) for (const it of recent.slice(0, 3)) m.append(burgerRow(it));
  else { const p = document.createElement('p'); p.className = 'burger-empty'; p.textContent = 'Designs you open show up here.'; m.append(p); }
  m.append(document.createElement('hr'));
  action('film', 'All projects', `${recent.length + saved.length} in this browser · Recent and Saved`, () => openAllProjects());
  action('home', 'Home', 'The start screen · Create new', () => openHome());
}
/* v3.2 · All projects opens over the screen you are on; closing it takes you back there
   (the editor stays the editor, Home stays Home). */
function openAllProjects() { openHomeAll('all'); }
function openBurger() {
  closeClipMenu();
  if (editor) closeEditor(true);
  commitScene();
  renderBurger();
  $('#burger-menu').hidden = false;
  $('#burger-scrim').hidden = false;
  $('#burger').setAttribute('aria-expanded', 'true');
  // focus the menu itself: never a text field (a phone would pop its keyboard up)
  const m = $('#burger-menu');
  m.tabIndex = -1;
  const f = m.querySelector('.burger-row, .burger-act');
  (f || m).focus({ preventScroll: true });
}
function closeBurger() {
  if ($('#burger-menu').hidden) return;
  $('#burger-menu').hidden = true;
  $('#burger-scrim').hidden = true;
  $('#burger').setAttribute('aria-expanded', 'false');
}

/* ===== v3.13 · transitions between sections, and the overlay track ==========================
   Transitions: each cut can be Cut (none), Fade, Slide or Zoom, 0.2–1 s, stored on the section
   it leads into (`sc.trans = { type, secs }`). It plays at the start of that section, so the
   film keeps its length. While it runs, the section before is drawn live from a copy of its
   state taken at the cut (`transPrev`), and the two are blended. Only the preview while playing
   and the video export draw transitions; editing always shows the section itself.
   Overlay track: `state.overlays` = [{ id, src, name, start, dur, in, mode: 'full' | 'window',
   x, y, w, fade, opacity }] on the film's own clock, across sections. They are drawn over the
   background and its wash, under media, text, buttons and badges. Their sound stays off. */
const TRANS_TYPES = [['cut', 'Cut'], ['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom']];
const TRANS_SECS = 0.5;
let seqClock = null;      // seconds on the film while a video export records
let transPrev = null;     // { k, st } — the section on screen before this one, as it was
const transBufs = [];
const motionStats = { trans: 0, lastP: null, kinds: {}, overlays: 0 };   // read by tests (?debug)

function snapPrev(k) {
  try { transPrev = { k, st: JSON.parse(JSON.stringify(state)) }; } catch (_) { transPrev = null; }
}
/** The film's clock now: the export's, the playhead's while playing, else null (editing). */
const filmClock = () => (recording && seqClock != null ? seqClock : playing ? playT : null);
const transOf = (sc) => (sc && sc.trans && sc.trans.type && sc.trans.type !== 'cut' ? sc.trans : null);
function transBuf(n, W, H) {
  let c = transBufs[n];
  if (!c) c = transBufs[n] = document.createElement('canvas');
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  return c;
}
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
/** Is something moving at film time t — a transition, or an overlay clip on screen? */
/* v3.21 · drawings draw themselves on in a video: after the section's way in (its transition),
   over about a third of the section (0.5–1.4 s). A drawing with anim === false shows at once. */
function drawOnWindow(k) {
  const sc = state.scenes[k];
  const tr = k > 0 ? transOf(sc) : null;
  const start = (tr ? tr.secs : 0) + 0.15;
  const dur = Math.max(0.5, Math.min(1.4, playSecs(sc) * 0.35));
  return { start, dur, end: start + dur };
}
function drawingProgress(ctx, d, st) {
  if (st !== state || !d || d.anim === false || state.contentType === 'carousel') return 1;
  if (!(recording || ctx.canvas === canvas)) return 1;
  const t = filmClock();
  if (t == null) return 1;
  const k = shownScene;
  const w = drawOnWindow(k);
  const p = Math.max(0, Math.min(1, (t - sceneStart(k) - w.start) / w.dur));
  return p < 1 ? 0.5 - Math.cos(Math.PI * p) / 2 : 1;    // eased: starts and lands gently
}
function motionAt(t) {
  if (state.contentType === 'carousel') return false;
  const k = sceneAt(t), tr = transOf(state.scenes[k]);
  if (tr && k > 0 && t - sceneStart(k) < tr.secs + 0.05) return true;
  if ((state.drawings || []).some((d) => d.anim !== false) && t - sceneStart(k) < drawOnWindow(k).end + 0.05) return true;
  return (state.overlays || []).some((o) => t >= o.start - 0.05 && t < o.start + o.dur + 0.05);
}
function transitionFrame(ctx, W, H, st, opts, core) {
  if (st !== state || state.contentType === 'carousel' || !transPrev) return null;
  if (!(recording || ctx.canvas === canvas)) return null;
  const t = filmClock();
  if (t == null) return null;
  const k = shownScene, tr = transOf(state.scenes[k]);
  if (!tr || transPrev.k === k) return null;
  const d = Math.max(0.1, tr.secs || TRANS_SECS);
  const p = (t - sceneStart(k)) / d;
  if (!(p >= 0 && p < 1)) return null;
  const e = ease(p);
  motionStats.trans++; motionStats.lastP = p; motionStats.kinds[tr.type] = (motionStats.kinds[tr.type] || 0) + 1;
  const a = transBuf(0, W, H), b = transBuf(1, W, H);
  const L = core(b.getContext('2d'), W, H, st, opts);           // the section coming in
  core(a.getContext('2d'), W, H, transPrev.st, {});              // the one going out
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (tr.type === 'slide') {
    ctx.drawImage(a, -e * W, 0);
    ctx.drawImage(b, (1 - e) * W, 0);
  } else if (tr.type === 'zoom') {
    ctx.drawImage(b, 0, 0);
    ctx.globalAlpha = 1 - e;
    const z = 1 + 0.2 * e;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.drawImage(a, -W / 2, -H / 2);
  } else {
    ctx.drawImage(b, 0, 0);
    ctx.globalAlpha = 1 - e;
    ctx.drawImage(a, 0, 0);
  }
  ctx.restore();
  return L;
}

/* --- overlay clips ------------------------------------------------------------------------ */
const OV_MIN = 0.5;
const overlayById = (id) => (state.overlays || []).find((o) => o.id === id);
function overlayRect(o, rec, W, H) {
  const iw = rec.w || 16, ih = rec.h || 9;
  if (o.mode !== 'window') return { x: 0, y: 0, w: W, h: H, cover: true };
  const w = Math.max(0.15, Math.min(1, o.w || 0.45)) * W;
  const h = w * ih / iw;
  return { x: (o.x ?? 0.5) * W - w / 2, y: (o.y ?? 0.5) * H - h / 2, w, h, cover: false };
}
/* v3.20 · overlay transitions: each clip comes in and goes out its own way — Cut, Fade, Slide or Zoom —
   over its transition length (o.fade, kept for older projects: a clip with a length and no type fades). */
const OV_TRANS = [['cut', 'Cut'], ['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom']];
const ovTin = (o) => o.tin || ((o.fade || 0) > 0 ? 'fade' : 'cut');
const ovTout = (o) => o.tout || ((o.fade || 0) > 0 ? 'fade' : 'cut');
/** How the clip looks at this moment: alpha, offset (canvas px) and scale. Editing shows it at rest. */
function ovMotion(o, local, clock, W, H, full) {
  const m = { a: 1, dx: 0, dy: 0, s: 1 };
  const f = Math.max(0, o.fade || 0);
  if (clock == null || !f) return m;
  const ease = (e) => 1 - Math.pow(1 - e, 3);
  const phase = (type, e, dir) => {
    if (e >= 1 || type === 'cut') return;
    const q = ease(Math.max(0, e));
    if (type === 'fade') m.a *= q;
    else if (type === 'slide') {
      // a full-frame clip slides across the whole frame; anything smaller rises in (and on, out) and fades
      if (full) m.dx += dir * (1 - q) * W;
      else { m.dy += dir * (1 - q) * H * 0.12; m.a *= q; }
    } else if (type === 'zoom') {
      m.s *= full ? 1 + 0.18 * (1 - q) : 0.55 + 0.45 * q;
      m.a *= q;
    }
  };
  phase(ovTin(o), local / f, 1);
  phase(ovTout(o), (o.dur - local) / f, -1);
  return m;
}
function drawOverlays(ctx, W, H) {
  const list = state.overlays;
  if (!list || !list.length || state.contentType === 'carousel') return;
  if (!(recording || ctx.canvas === canvas)) return;   // not on stills, thumbnails or the cover
  const clock = filmClock();
  const t = clock == null ? playT : clock;
  for (const o of list) {
    if (ovKind(o) !== 'media') continue;
    const local = t - o.start;
    if (local < 0 || local >= o.dur) continue;
    const rec = mediaFor(o.src);
    if (!rec || !rec.el) continue;
    if (rec.media === 'video') syncOverlayVideo(o, rec, local, clock != null);
    // transitions play over time; while editing, the clip shows at full strength so it can be placed
    const r = overlayRect(o, rec, W, H);
    const m = ovMotion(o, local, clock, W, H, r.cover);
    if (m.a <= 0) continue;
    motionStats.overlays++;
    ctx.save();
    ctx.globalAlpha = m.a * (o.opacity ?? 1);
    if (m.dx || m.dy || m.s !== 1) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.translate(cx + m.dx, cy + m.dy);
      ctx.scale(m.s, m.s);
      ctx.translate(-cx, -cy);
    }
    const iw = rec.w || r.w, ih = rec.h || r.h;
    if (r.cover) {
      const k = Math.max(W / iw, H / ih), sw = W / k, sh = H / k;
      ctx.drawImage(rec.el, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H);
    } else {
      const rad = Math.min(r.w, r.h) * 0.06;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, rad); else ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(rec.el, r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }
}
function syncOverlayVideo(o, rec, local, running) {
  const el = rec.el;
  if (!running) return;                                  // editing: the clip loops on its own
  const want = (o.in || 0) + local;
  const dur = el.duration || 0;
  const target = dur ? want % dur : want;
  if (Math.abs((el.currentTime || 0) - target) > 0.3) { try { el.currentTime = target; } catch (_) {} }
  if (el.paused) el.play().catch(() => {});
}

let ovFileInput = null;
function pickOverlayFile() {
  if (!ovFileInput) {
    ovFileInput = document.createElement('input');
    ovFileInput.type = 'file';
    ovFileInput.accept = 'video/*,image/*';
    ovFileInput.hidden = true;
    ovFileInput.addEventListener('change', () => {
      const f = ovFileInput.files && ovFileInput.files[0];
      ovFileInput.value = '';
      if (f) addOverlayFile(f);
    });
    document.body.append(ovFileInput);
  }
  ovFileInput.click();
}
async function addOverlayFile(file, at) {
  let meta;
  try { meta = await addUpload(file, 'inset'); } catch (e) { showToast(e.message || String(e)); return null; }
  const total = Math.max(1, timelineSecs());
  let start = Math.max(0, Math.min(total - OV_MIN, at != null ? at : playT));
  if (start > total - 1) start = Math.max(0, total - 3);
  const src = meta.media === 'video' && meta.duration ? meta.duration : 3;
  const o = {
    id: `ov${Date.now().toString(36)}`, kind: 'media', src: meta.id, name: meta.name, start: Math.round(start * 10) / 10,
    dur: Math.round(Math.max(OV_MIN, Math.min(src, total - start)) * 10) / 10, in: 0,
    mode: 'full', x: 0.5, y: 0.5, w: 0.5, fade: 0.3, opacity: 1,
  };
  pushUndo('Overlay clip added');
  state.overlays = [...(state.overlays || []), o];
  save();
  renderScenes();
  selectOverlay(o.id);
  return o;
}
function removeOverlay(id) {
  const o = overlayById(id);
  if (!o) return;
  pushUndo('Overlay clip removed');
  state.overlays = state.overlays.filter((x) => x.id !== id);
  save();
  if (selected === `ov:${id}`) { selected = null; if (sheetTab === 'overlay') closeSectionSheet({ focus: false }); }
  if (o.src) setTimeout(() => {
    const used = (state.overlays || []).some((x) => x.src === o.src) || cardInUse(o.src) || state.inset.id === o.src;
    if (!used && !undoStack.some((u) => JSON.stringify(u.data).includes(o.src))) removeUpload(o.src);
  }, 9000);
  renderScenes();
  draw();
}

const OV_ROW_H = 30, OV_ROW_GAP = 4, OV_ROWS_MAX = 3;
/** Rows for the overlay track: each clip goes on the first row that is free at its start. */
function overlayLanes(list) {
  const ends = [], lanes = new Map();
  for (const o of [...list].sort((a, b) => a.start - b.start || list.indexOf(a) - list.indexOf(b))) {
    let k = ends.findIndex((end) => end <= o.start + 1e-6);
    if (k < 0) { k = ends.length; ends.push(0); }
    ends[k] = o.start + o.dur;
    lanes.set(o.id, k);
  }
  return { lanes, rows: Math.max(1, ends.length) };
}
/** The overlay row on the timeline, under the sections and over the sound. */
function renderOverlayLane() {
  const lane = $('#tl-overlay');
  if (!lane) return;
  const carousel = state.contentType === 'carousel';
  const list = carousel ? [] : (state.overlays || []);
  $('#timeline').classList.toggle('has-overlays', !!list.length);
  lane.innerHTML = '';
  if ($('#ov-rows')) $('#ov-rows').hidden = true;
  if (carousel) return;
  lane.style.clipPath = `inset(0 0 0 ${leftPad}px)`;
  // v3.17: clips that overlap in time each get their own row, so none hides another
  const { lanes, rows } = overlayLanes(list);
  const tl = $('#timeline');
  // v3.20: at most three rows show; more scroll up and down inside the row, the + stays put
  const shown = Math.min(OV_ROWS_MAX, rows);
  if (tl) tl.style.setProperty('--ov-stack', `${shown * OV_ROW_H + (shown - 1) * OV_ROW_GAP}px`);
  lane.classList.toggle('is-scrolling', rows > OV_ROWS_MAX);
  const keepTop = lane.scrollTop;
  const spacer = document.createElement('div');
  spacer.className = 'ov-spacer';
  spacer.style.height = `${rows * OV_ROW_H + (rows - 1) * OV_ROW_GAP}px`;
  lane.append(spacer);
  for (const o of list) { const el = overlayClipEl(o); el.style.top = `${lanes.get(o.id) * (OV_ROW_H + OV_ROW_GAP)}px`; lane.append(el); }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'audio-add ov-add' + (list.length ? ' is-small' : '');
  const end = list.length ? Math.max(...list.map((o) => o.start + o.dur)) : 0;
  add.style.left = `${leftPad + (list.length ? end * pps + 6 : 0)}px`;
  // v3.18: a plus, not a video icon (an overlay can be text, a badge, a cogent or a drawing too)
  add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
    + (list.length ? '<span class="sr-only">Add an overlay clip</span>' : '<span>Overlay clip</span>');
  add.title = 'Add an overlay clip: media, text, a badge, a cogent or a drawing';
  add.setAttribute('aria-haspopup', 'menu');
  // v3.16: the same choice as + → Overlay clip (not straight to the file picker)
  add.addEventListener('click', (e) => { e.stopPropagation(); clipMenuFor === -14 ? closeClipMenu() : openOverlayAddMenu(add); });
  lane.append(add);
  // the + rides along with the scroll, so it is always on the visible top row
  // v3.21 · rows past three: a visible up / down control at the timeline's right edge (the row's own
  // scrollbar sat at the far end of the whole film, off screen, and clips all look alike)
  let ctl = $('#ov-rows');
  if (!ctl && tl) {
    ctl = document.createElement('div');
    ctl.id = 'ov-rows';
    ctl.className = 'ov-rows';
    ctl.innerHTML = '<button type="button" class="ov-rows-btn" data-d="-1" aria-label="Show the overlay rows above"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>'
      + '<span class="ov-rows-track" aria-hidden="true"><i></i></span><span class="ov-rows-n" aria-live="polite"></span>'
      + '<button type="button" class="ov-rows-btn" data-d="1" aria-label="Show the overlay rows below"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>';
    ctl.addEventListener('click', (e) => {
      const b = e.target.closest('.ov-rows-btn');
      const l = $('#tl-overlay');
      if (!b || !l) return;
      e.stopPropagation();
      l.scrollBy({ top: Number(b.dataset.d) * (OV_ROW_H + OV_ROW_GAP), behavior: 'smooth' });
    });
    ctl.addEventListener('pointerdown', (e) => e.stopPropagation());
    tl.append(ctl);
  }
  const pin = () => {
    add.style.top = `${lane.scrollTop}px`;
    const above = lane.scrollTop > 2, below = lane.scrollTop + lane.clientHeight < lane.scrollHeight - 2;
    lane.classList.toggle('more-above', above);
    lane.classList.toggle('more-below', below);
    if (!ctl) return;
    ctl.hidden = !(rows > OV_ROWS_MAX);
    if (ctl.hidden) return;
    const tr = tl.getBoundingClientRect(), lr = lane.getBoundingClientRect();
    ctl.style.top = `${Math.round(lr.top - tr.top)}px`;
    ctl.style.height = `${Math.round(lane.clientHeight)}px`;
    const [up, down] = ctl.querySelectorAll('.ov-rows-btn');
    up.disabled = !above; down.disabled = !below;
    const first = Math.round(lane.scrollTop / (OV_ROW_H + OV_ROW_GAP)) + 1;
    ctl.querySelector('.ov-rows-n').textContent = `${first}–${Math.min(rows, first + OV_ROWS_MAX - 1)} of ${rows}`;
    ctl.title = `Overlay rows ${first}–${Math.min(rows, first + OV_ROWS_MAX - 1)} of ${rows}`;
    const thumb = ctl.querySelector('.ov-rows-track i');
    const k = lane.clientHeight / Math.max(1, lane.scrollHeight);
    thumb.style.height = `${Math.round(k * 100)}%`;
    thumb.style.top = `${Math.round((lane.scrollTop / Math.max(1, lane.scrollHeight)) * 100)}%`;
  };
  lane.onscroll = pin;
  lane.scrollTop = keepTop;
  // a selected (or just added) clip on a hidden row scrolls into view
  const sel = typeof selected === 'string' && selected.startsWith('ov:') ? lanes.get(selected.slice(3)) : undefined;
  if (sel != null) {
    const y = sel * (OV_ROW_H + OV_ROW_GAP), h = lane.clientHeight || shown * (OV_ROW_H + OV_ROW_GAP);
    if (y < lane.scrollTop) lane.scrollTop = y;
    else if (y + OV_ROW_H > lane.scrollTop + h) lane.scrollTop = y + OV_ROW_H - h;
  }
  pin();
}
function overlayClipEl(o) {
  const el = document.createElement('div');
  el.className = 'ov-clip' + (o.mode === 'window' ? ' is-window' : '') + ` is-${ovKind(o)}` + (selected === `ov:${o.id}` ? ' is-selected' : '');
  el.dataset.id = o.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Overlay ${ovName(o)} — from ${fmtTime(o.start)} for ${o.dur.toFixed(1)}s. Drag to move; tap for options`);
  const place = () => { el.style.left = `${leftPad + o.start * pps}px`; el.style.width = `${Math.max(14, o.dur * pps - 2)}px`; };
  place();
  const lbl = document.createElement('span');
  lbl.className = 'ov-label';
  lbl.textContent = ovLabel(o);
  const grip = document.createElement('span');
  grip.className = 'ov-grip';
  grip.title = 'Drag to change how long it plays';
  el.append(lbl, grip);
  const rec = o.src ? mediaFor(o.src) : null;
  if (rec && rec.el) {
    try {
      const c = document.createElement('canvas');
      c.width = 60; c.height = 34;
      const g = c.getContext('2d');
      const iw = rec.w || 60, ih = rec.h || 34, k = Math.max(60 / iw, 34 / ih);
      g.drawImage(rec.el, (iw - 60 / k) / 2, (ih - 34 / k) / 2, 60 / k, 34 / k, 0, 0, 60, 34);
      el.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.7)})`;
    } catch (_) {}
  }
  const total = () => Math.max(OV_MIN, timelineSecs());
  const srcMax = () => { const r = o.src ? mediaFor(o.src) : null; return r && r.media === 'video' && r.duration ? r.duration - (o.in || 0) : 600; };
  let down = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.stopPropagation();
    down = { x: e.clientX, start: o.start, dur: o.dur, trim: e.target === grip, moved: false, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.abs(dx) < 6) return;
    if (!down.moved) { down.moved = true; pushUndo(down.trim ? 'Overlay clip length' : 'Overlay clip moved'); }
    const dt = Math.round((dx / pps) * 10) / 10;
    if (down.trim) o.dur = Math.max(OV_MIN, Math.min(srcMax(), total() - o.start, down.dur + dt));
    else o.start = Math.max(0, Math.min(total() - Math.min(o.dur, OV_MIN), down.start + dt));
    place();
    lbl.textContent = ovLabel(o);
    if (!playing) { playT = Math.max(0, Math.min(timelineSecs(), o.start + (down.trim ? o.dur - 0.05 : 0))); movePlayhead(playT); }
    draw();
  });
  const up = (e) => {
    if (!down) return;
    const moved = down.moved;
    down = null;
    if (moved) { save(); renderOverlayLane(); draw(); return; }
    if (e.type === 'pointerup') selectOverlay(o.id);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOverlay(o.id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeOverlay(o.id); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      o.start = Math.max(0, Math.min(total() - OV_MIN, o.start + (e.key === 'ArrowLeft' ? -0.1 : 0.1)));
      save(); place(); draw();
    }
  });
  return el;
}
/* ===== v3.15 · overlay clips of every kind, edited like any item ============================
   An overlay clip is a media file (`kind: 'media'`, drawn under the section's items) or an item
   drawn over everything for its stretch of the film: `text` (h1, body, style), `badge` (badge,
   powered), `cogent` (who, sticker) or `drawing` (d: a drawing). All share start, dur, fade,
   opacity and x, y, scale (media: mode, x, y, w). Text, badges and drawings are drawn by
   render.js's own renderItem() from a small state that holds only that item, into a buffer,
   then blended in with the fade. A tap on the preview selects one (its controls open in the
   panel or the phone sheet, with the ✕), a drag moves it. */
const ovKind = (o) => o.kind || 'media';
const OV_KIND_NAME = { media: 'Media', text: 'Text', badge: 'Badge', cogent: 'Cogent', drawing: 'Drawing' };
const OV_ICON = { media: '▶', text: 'T', badge: '◆', cogent: '●', drawing: '✎' };
function ovName(o) {
  const k = ovKind(o);
  if (k === 'media') return o.name || 'Media';
  if (k === 'text') return (o.h1 || o.body || 'Text').split('\n')[0].slice(0, 24);
  if (k === 'cogent') { const c = cogentCast().find((x) => x.id === o.who); return c ? c.name : 'Cogent'; }
  if (k === 'badge') { const b = badges()[o.badge]; return `Badge${b && b.label ? ` · ${b.label}` : ''}`; }
  return OV_KIND_NAME[k];
}
const ovLabel = (o) => `${ovKind(o) === 'media' ? (o.mode === 'window' ? '▣' : '▶') : OV_ICON[ovKind(o)]} ${ovName(o)} · ${o.dur.toFixed(1)}s`;
/** The brand's cogents, as round portraits (and their stickers). */
function cogentCast() {
  const b = BRANDS[state.brand] || BRANDS[DEFAULT_BRAND];
  return (b.backdrops || []).filter((x) => x.kind === 'cogent' && !x.sticker)
    .map((x) => ({ id: x.id.replace(/^cog-/, ''), name: x.name, asset: x.asset }));
}
/** On screen at the playhead (or the film clock)? */
function overlayShowing(o) {
  const c = filmClock();
  const t = c == null ? playT : c;
  return t >= o.start && t < o.start + o.dur;
}
/** A state that holds only this item, for layout() and renderItem(). */
/** v3.21 · a drawing overlay draws itself on from the clip's start, over 40 % of it (0.5–1.4 s). */
function ovDrawProg(o, local, clock) {
  if (clock == null || o.anim === false) return 1;
  const dur = Math.max(0.5, Math.min(1.4, o.dur * 0.4));
  const p = Math.max(0, Math.min(1, local / dur));
  return p < 1 ? 0.5 - Math.cos(Math.PI * p) / 2 : 1;
}
function ovMini(o, prog = 1) {
  const st = { ...state, blocks: [], badges: [], drawings: [], media: [], buttons: [], visibility: 'none', badge: 'none', inset: { ...(state.inset || {}), id: null, hidden: true } };
  const k = ovKind(o), sc = o.scale || 1;
  if (k === 'text') {
    const style = { ...(o.style || {}) };
    style.h1Scale = (style.h1Scale || 1) * sc;
    style.bodyScale = (style.bodyScale || 1) * sc;
    style.visibility = o.body ? (o.h1 ? 'both' : 'body') : 'h1';   // the section's own text stays off in this state; the clip's shows
    st.blocks = [{ id: 'ov', h1: o.h1 || '', body: o.body || '', x: o.x, y: o.y, style }];
  } else if (k === 'badge') {
    st.badges = [{ ...BADGE_ITEM(), id: 'ov', badge: o.badge, scale: sc, x: o.x, y: o.y, powered: o.powered !== false }];
  } else if (k === 'drawing' && o.d) {
    st.drawings = [{ ...o.d, id: 'ov', x: o.x, y: o.y, s: sc, prog }];
  }
  return st;
}
const OV_ITEM_ID = { text: 'xb:ov', badge: 'eb:ov', drawing: 'dr:ov' };
/** Where the clip sits on the canvas (canvas pixels). */
function overlayCanvasRect(o, W, H) {
  const k = ovKind(o);
  if (k === 'media') {
    const rec = o.src ? mediaFor(o.src) : null;
    if (!rec) return null;
    const r = overlayRect(o, rec, W, H);
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  if (k === 'cogent') {
    const w = (o.scale || 1) * 0.36 * Math.min(W, H);
    const im = assetImg(cogentAssetOf(o));
    const h = im && im.naturalWidth ? w * im.naturalHeight / im.naturalWidth : w;
    return { x: o.x * W - w / 2, y: o.y * H - h / 2, w, h };
  }
  const L = layout(ctx, ovMini(o), W, H);
  if (k === 'text') { const x = (L.extras || [])[0]; return x ? { ...x.txRect, h: x.tx.h } : null; }
  if (k === 'badge') { const b = (L.xbadges || [])[0]; return b ? { ...b.rect } : null; }
  if (k === 'drawing') { const d = (L.drawings || [])[0]; return d ? { ...d.rect } : null; }
  return null;
}
const cogentAssetOf = (o) => { const c = cogentCast().find((x) => x.id === o.who) || cogentCast()[0]; return c ? `${c.asset}${o.sticker ? '-sticker' : ''}` : null; };
function ovAlpha(o, t, clock) {
  const local = t - o.start;
  if (local < 0 || local >= o.dur) return 0;
  return ovMotion(o, local, clock, 1, 1, false).a * (o.opacity ?? 1);
}
/** Text, badges, cogents and drawings: over everything; plus the outline of a selected clip. */
function drawItemOverlays(ctx, W, H) {
  const list = state.overlays;
  if (!list || !list.length || state.contentType === 'carousel') return;
  if (!(recording || ctx.canvas === canvas)) return;
  const clock = filmClock();
  const t = clock == null ? playT : clock;
  for (const o of list) {
    const k = ovKind(o);
    if (k === 'media') continue;
    const a = ovAlpha(o, t, clock);
    if (a <= 0) continue;
    motionStats.overlays++;
    ctx.save();
    ctx.globalAlpha = a;
    const m = ovMotion(o, t - o.start, clock, W, H, false);
    if (m.dx || m.dy || m.s !== 1) {
      const r0 = overlayCanvasRect(o, W, H);
      const cx = r0 ? r0.x + r0.w / 2 : W / 2, cy = r0 ? r0.y + r0.h / 2 : H / 2;
      ctx.translate(cx + m.dx, cy + m.dy);
      ctx.scale(m.s, m.s);
      ctx.translate(-cx, -cy);
    }
    if (k === 'cogent') {
      const im = assetImg(cogentAssetOf(o));
      const r = overlayCanvasRect(o, W, H);
      if (im && r) ctx.drawImage(im, r.x, r.y, r.w, r.h);
    } else {
      const buf = transBuf(2, W, H);
      renderItem(buf.getContext('2d'), W, H, ovMini(o, k === 'drawing' ? ovDrawProg(o, t - o.start, clock) : 1), OV_ITEM_ID[k]);
      ctx.drawImage(buf, 0, 0);
    }
    ctx.restore();
  }
  // the selected clip's outline (editing only)
  const sel = String(selected || '');
  if (clock == null && sel.startsWith('ov:') && ctx.canvas === canvas) {
    const o = overlayById(sel.slice(3));
    const r = o && overlayShowing(o) && overlayCanvasRect(o, W, H);
    if (r) {
      ctx.save();
      ctx.setLineDash([W / 90, W / 120]);
      ctx.lineWidth = Math.max(2, W / 360);
      ctx.strokeStyle = '#5eead4';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }
}

/* --- adding ---------------------------------------------------------------------------------- */
function openOverlayAddMenu(anchor) {
  const items = [
    { icon: 'film', label: 'Video or picture', sub: 'Full frame or a window', run: () => pickOverlayFile() },
    { icon: 'text', label: 'Text', sub: 'A header and a line, in the brand style', run: () => addItemOverlay('text') },
  ];
  if (Object.keys(badges()).length) items.push({ icon: 'badge', label: 'Badge', sub: 'The brand badge, for a moment', run: () => addItemOverlay('badge') });
  if (cogentCast().length) items.push({ icon: 'image', label: 'Cogent', sub: cogentCast().map((c) => c.name).join(' · '), run: () => addItemOverlay('cogent') });
  items.push({ icon: 'draw', label: 'Drawing', sub: 'Draw it, then it plays as a clip', run: () => addItemOverlay('drawing') });
  openMenuAt(anchor || $('#add-btn'), items, 'Overlay clip');
  clipMenuFor = -14;
}
function newOverlayBase(kind) {
  const total = Math.max(1, timelineSecs());
  let start = Math.max(0, Math.min(total - OV_MIN, playT));
  const dur = Math.max(OV_MIN, Math.min(2, total - start));
  return { id: `ov${Date.now().toString(36)}`, kind, start: Math.round(start * 10) / 10, dur: Math.round(dur * 10) / 10, fade: 0.3, opacity: 1, x: 0.5, y: 0.5, scale: 1 };
}
/** v3.17: a new item doesn't land on top of another clip that shows at the same time. */
function placeClearOfOverlays(o) {
  const W = canvas.width, H = canvas.height;
  const others = (state.overlays || []).filter((x) => ovKind(x) !== 'media' && x.start < o.start + o.dur && o.start < x.start + x.dur);
  if (!others.length) return;
  const boxes = others.map((x) => overlayCanvasRect(x, W, H)).filter(Boolean);
  const hits = (r) => boxes.some((b) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h);
  const y0 = o.y;
  for (const dy of [0, 0.14, -0.14, 0.28, -0.28, 0.21, -0.21, 0.35]) {
    o.y = Math.max(0.08, Math.min(0.9, y0 + dy));
    const r = overlayCanvasRect(o, W, H);
    if (!r || !hits(r)) return;
  }
  o.y = y0;
}
let ovDrawWaiting = false;
function addItemOverlay(kind) {
  if (kind === 'drawing') { ovDrawWaiting = true; setTimeout(() => enterDraw(null), 0); return; }
  const o = newOverlayBase(kind);
  if (kind === 'text') Object.assign(o, { h1: 'Your words here', body: '', style: styleOf(state), y: 0.45 });
  if (kind === 'badge') { const keys = Object.keys(badges()); Object.assign(o, { badge: keys.includes(state.badge) ? state.badge : keys[0], powered: true, y: 0.3 }); }
  if (kind === 'cogent') Object.assign(o, { who: cogentCast()[0].id, sticker: false, y: 0.62 });
  placeClearOfOverlays(o);
  pushUndo(`${OV_KIND_NAME[kind]} overlay added`);
  state.overlays = [...(state.overlays || []), o];
  save();
  renderScenes();
  selectOverlay(o.id);
}
/** A drawing made for the overlay track leaves the section and becomes a clip. */
function drawingToOverlay(d) {
  state.drawings = (state.drawings || []).filter((x) => x.id !== d.id);
  const o = newOverlayBase('drawing');
  const { x, y, ...rest } = d;
  Object.assign(o, { d: { ...rest, s: 1 }, x, y, scale: d.s || 1 });
  state.overlays = [...(state.overlays || []), o];
  commitScene();
  save();
  renderScenes();
  selectOverlay(o.id);
}

/* --- selecting and editing --------------------------------------------------------------------- */
function selectOverlay(id) {
  const o = overlayById(id);
  if (!o) return;
  stopPlayback();
  if (!overlayShowing(o)) { playT = Math.min(timelineSecs(), o.start + Math.min(0.5, o.dur / 2)); seek(playT); }
  closeClipMenu();
  selectElement(`ov:${id}`);
  renderOverlayGroup();
  renderOverlayLane();
  selDelSig = ''; syncSelDelete();
}
/** Choosing a transition plays it once: the clip's first (or last) moments, from the timeline. */
function previewOverlayTrans(o, key) {
  if (playing || recording || ovKind(o) == null) return;
  const f = Math.max(0.1, o.fade || 0.4);
  playT = key === 'tout' ? Math.max(o.start, o.start + o.dur - f - 0.3) : Math.max(0, o.start - 0.05);
  const stopAt = key === 'tout' ? o.start + o.dur + 0.05 : o.start + f + 0.4;
  startPlayback();
  const watch = () => {
    if (!playing) return;
    if (playT >= stopAt) { stopPlayback(true); playT = Math.min(timelineSecs(), o.start + Math.min(o.dur / 2, f + 0.2)); movePlayhead(playT); draw(); return; }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}
function renderOverlayGroup() {
  const body = $('#ov-body');
  if (!body) return;
  const sel = String(selected || '');
  const oid = sel.startsWith('ov:') ? sel.slice(3) : null;
  body.innerHTML = '';
  if (!oid || !overlayById(oid)) return;
  // Undo / Redo put a fresh copy of the clip in the state: the panel's controls always read and
  // write the clip as it is NOW (by id), never the copy this panel was built from (an edit after
  // an Undo used to land on the old copy and was lost)
  const o = new Proxy({}, {
    get: (_, key) => { const c = overlayById(oid); return c ? c[key] : undefined; },
    set: (_, key, v) => { const c = overlayById(oid); if (c) c[key] = v; return true; },
    deleteProperty: (_, key) => { const c = overlayById(oid); if (c) delete c[key]; return true; },
    has: (_, key) => { const c = overlayById(oid); return !!c && key in c; },
  });
  const k = ovKind(o);
  $('#ov-title').textContent = `Overlay · ${OV_KIND_NAME[k]}`;
  let pushed = false;
  const change = (live) => { if (!pushed) { pushUndo('Overlay clip changed'); pushed = true; } draw(); if (!live) { pushed = false; save(); renderOverlayLane(); selDelSig = ''; syncSelDelete(); } };
  const row = (label, el) => { const r = document.createElement('div'); r.className = 'ov-row'; r.innerHTML = `<span class="ov-lbl">${label}</span>`; r.append(el); return r; };
  const seg = (label, opts, get, set) => {
    const sg = document.createElement('div');
    sg.className = 'segments segments-sm';
    sg.setAttribute('role', 'radiogroup');
    sg.setAttribute('aria-label', label);
    for (const [v, name] of opts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.textContent = name;
      b.setAttribute('aria-checked', String(get() === v));
      b.addEventListener('click', () => { pushUndo('Overlay clip changed'); set(v); save(); renderOverlayGroup(); renderOverlayLane(); draw(); selDelSig = ''; syncSelDelete(); });
      sg.append(b);
    }
    return row(label, sg);
  };
  const slider = (label, min, max, step, get, set, fmt) => {
    const r = document.createElement('label');
    r.className = 'slider-row';
    r.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${get()}"><output>${fmt(get())}</output>`;
    const i = r.querySelector('input'), out = r.querySelector('output');
    i.addEventListener('input', () => { set(Number(i.value)); out.textContent = fmt(Number(i.value)); change(true); });
    i.addEventListener('change', () => change(false));
    return r;
  };
  const text = (label, get, set, multi) => {
    const t = document.createElement(multi ? 'textarea' : 'input');
    t.className = 'lower-text ov-text';
    if (!multi) t.type = 'text';
    if (multi) t.rows = 2;
    t.value = get() || '';
    t.placeholder = label;
    t.setAttribute('aria-label', label);
    t.addEventListener('input', () => { set(t.value); change(true); });
    t.addEventListener('change', () => change(false));
    return t;
  };
  const pct = (v) => `${Math.round(v * 100)}%`;
  const total = Math.max(OV_MIN, timelineSecs());
  if (k === 'media') {
    body.append(seg('Shows', [['full', 'Full frame'], ['window', 'Window']], () => o.mode, (v) => { o.mode = v; }));
    if (o.mode === 'window') body.append(
      slider('Size', 0.15, 1, 0.01, () => o.w || 0.5, (v) => { o.w = v; }, pct),
    );
  }
  if (k === 'text') {
    body.append(text('Header', () => o.h1, (v) => { o.h1 = v; }), text('Body', () => o.body, (v) => { o.body = v; }, true));
  }
  if (k === 'badge') {
    const set = badges();
    body.append(seg('Badge', Object.entries(set).map(([key, b]) => [key, b.label || key]), () => o.badge, (v) => { o.badge = v; }));
  }
  if (k === 'cogent') {
    body.append(seg('Who', cogentCast().map((c) => [c.id, c.name]), () => o.who, (v) => { o.who = v; }));
    body.append(seg('Look', [[false, 'Round'], [true, 'Rough edges']], () => !!o.sticker, (v) => { o.sticker = v; }));
  }
  if (k === 'drawing') body.append(seg('Draw on', [[true, 'Draw it on'], [false, 'Show at once']], () => o.anim !== false, (v) => { if (v) delete o.anim; else o.anim = false; }));
  if (k !== 'media') body.append(slider('Size', 0.3, 2, 0.05, () => o.scale || 1, (v) => { o.scale = v; }, pct));
  if (k !== 'media' || o.mode === 'window') body.append(
    slider('Left · Right', 0, 1, 0.01, () => o.x ?? 0.5, (v) => { o.x = v; }, pct),
    slider('Up · Down', 0, 1, 0.01, () => o.y ?? 0.5, (v) => { o.y = v; }, pct),
  );
  body.append(
    slider('Starts at', 0, Math.max(0, total - OV_MIN), 0.1, () => o.start, (v) => { o.start = v; playT = Math.min(timelineSecs(), v + 0.05); movePlayhead(playT); }, (v) => `${v.toFixed(1)}s`),
    slider('Length', OV_MIN, Math.max(OV_MIN, total), 0.1, () => o.dur, (v) => { o.dur = Math.min(v, total - o.start); }, (v) => `${v.toFixed(1)}s`),
  );
  // v3.20: in and out, each its own way; one length for both
  const setT = (key) => (v) => {
    o.tin = ovTin(o); o.tout = ovTout(o);
    o[key] = v;
    if (v !== 'cut' && !(o.fade > 0)) o.fade = 0.4;
    previewOverlayTrans(o, key);
  };
  body.append(
    seg('In', OV_TRANS, () => ovTin(o), setT('tin')),
    seg('Out', OV_TRANS, () => ovTout(o), setT('tout')),
  );
  if (ovTin(o) !== 'cut' || ovTout(o) !== 'cut') body.append(
    slider('Transition', 0.1, 1.5, 0.1, () => o.fade || 0.4, (v) => { o.fade = v; }, (v) => `${v.toFixed(1)}s`),
  );
  body.append(
    slider('Opacity', 0.1, 1, 0.05, () => o.opacity ?? 1, (v) => { o.opacity = v; }, pct),
  );
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'link-btn ov-del';
  del.textContent = 'Remove overlay clip';
  del.addEventListener('click', () => removeOverlay(o.id));
  const note = document.createElement('p');
  note.className = 'micro';
  note.textContent = k === 'media' ? 'Plays over the background, under the section’s text and items. Its sound stays off.' : 'Shows over everything for its time on the overlay row. Drag it on the preview to move it.';
  body.append(del, note);
}

/* --- on the preview: tap selects, drag moves ------------------------------------------------------ */
function overlayAt(p) {
  const list = (state.overlays || []).filter(overlayShowing);
  const W = canvas.width, H = canvas.height;
  const inside = (r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  // items over everything first (the last added on top)
  for (const o of [...list].reverse()) if (ovKind(o) !== 'media' && inside(overlayCanvasRect(o, W, H))) return o;
  // media sit under the section's items: only where no item is
  if (hit(p) || drawingAt(p.x, p.y)) return null;
  for (const o of [...list].reverse()) if (ovKind(o) === 'media' && o.mode === 'window' && inside(overlayCanvasRect(o, W, H))) return o;
  for (const o of [...list].reverse()) if (ovKind(o) === 'media' && o.mode !== 'window' && inside(overlayCanvasRect(o, W, H))) return o;
  return null;
}
let swallowClickUntil = 0;
function wireOverlayCanvas() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || drawMode || playing || recording || fsMode === 'preview' || pinch.active || pinch.pts.size > 1 || e.shiftKey || e.metaKey || e.ctrlKey) return;
    if (!(state.overlays || []).length || state.contentType === 'carousel') return;
    const p = toCanvas(e);
    const o = overlayAt(p);
    if (!o) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (editor) closeEditor(true);
    const movable = ovKind(o) !== 'media' || o.mode === 'window';
    drag = { id: o.id, x0: p.x, y0: p.y, ox: o.x ?? 0.5, oy: o.y ?? 0.5, moved: false, pid: e.pointerId, movable };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (pinch.active) { drag = null; return; }
    e.stopImmediatePropagation();
    const p = toCanvas(e);
    const dx = p.x - drag.x0, dy = p.y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 6 * (canvas.width / canvas.getBoundingClientRect().width)) return;
    if (!drag.movable) return;
    const o = overlayById(drag.id);
    if (!o) return;
    if (!drag.moved) { drag.moved = true; pushUndo('Overlay clip moved'); }
    o.x = Math.max(0, Math.min(1, drag.ox + dx / canvas.width));
    o.y = Math.max(0, Math.min(1, drag.oy + dy / canvas.height));
    selDelSig = ''; syncSelDelete();
    draw();
  }, true);
  const up = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    e.stopImmediatePropagation();
    const d = drag;
    drag = null;
    if (d.moved) save();
    swallowClickUntil = performance.now() + 450;   // the click this release makes is ours, not the canvas's
    selectOverlay(d.id);
  };
  window.addEventListener('click', (e) => {
    if (performance.now() < swallowClickUntil && (e.target === canvas || canvas.contains(e.target) || e.target.closest && e.target.closest('#canvas-wrap'))) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pid) drag = null; }, true);
}

/* --- pinch to zoom the preview -------------------------------------------------------------------
   Two fingers on the preview zoom it (1×–4×) around the pinch and pan it; ctrl / ⌘ + wheel (a
   trackpad pinch) does the same on a computer. The canvas is only scaled on screen (CSS), so
   taps and drags still land where they look — toCanvas() reads the scaled box. A "1:1" chip
   puts it back; so does a double-tap with two fingers. Exports are never affected. */
const pinch = { active: false, s: 1, tx: 0, ty: 0, pts: new Map(), start: null };
function applyZoom() {
  const z = pinch.s > 1.001;
  if (!z) { pinch.s = 1; pinch.tx = 0; pinch.ty = 0; }
  canvas.style.transform = z ? `translate(${pinch.tx}px, ${pinch.ty}px) scale(${pinch.s})` : '';
  canvas.style.transformOrigin = 'center center';
  document.documentElement.classList.toggle('is-zoomed', z);
  const chip = $('#zoom-reset');
  if (chip) { chip.hidden = !z; chip.textContent = `${pinch.s.toFixed(1).replace(/\.0$/, '')}× · 1:1`; }
  selDelSig = ''; syncSelDelete();
  if (editor) placeEditor();
}
function zoomAt(cx, cy, s) {
  // keep the content under (cx, cy) where it is while the scale changes
  const r = canvas.getBoundingClientRect();
  const C0x = r.left + r.width / 2 - pinch.tx, C0y = r.top + r.height / 2 - pinch.ty;   // the unzoomed centre
  const ux = (cx - C0x - pinch.tx) / pinch.s, uy = (cy - C0y - pinch.ty) / pinch.s;
  pinch.s = Math.max(1, Math.min(4, s));
  pinch.tx = cx - C0x - ux * pinch.s;
  pinch.ty = cy - C0y - uy * pinch.s;
  clampZoom(r.width / (pinch.s || 1), r.height / (pinch.s || 1));
  applyZoom();
}
function clampZoom(w0, h0) {
  // never pan the picture fully out of view
  const w = w0 || canvas.offsetWidth, h = h0 || canvas.offsetHeight;
  const mx = (w * (pinch.s - 1)) / 2, my = (h * (pinch.s - 1)) / 2;
  pinch.tx = Math.max(-mx, Math.min(mx, pinch.tx));
  pinch.ty = Math.max(-my, Math.min(my, pinch.ty));
}
function resetZoom() { pinch.s = 1; applyZoom(); }
function wirePinchZoom() {
  const wrap = $('#canvas-wrap');
  if (!wrap) return;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.id = 'zoom-reset';
  chip.className = 'zoom-reset';
  chip.hidden = true;
  chip.title = 'Back to the whole picture';
  chip.addEventListener('pointerdown', (e) => e.stopPropagation());
  chip.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });
  wrap.append(chip);
  let lastTwo = 0;
  const onDown = (e) => {
    if (e.pointerType !== 'touch' || drawMode) return;
    pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.pts.size === 2) {
      const [a, b] = [...pinch.pts.values()];
      const now = performance.now();
      if (now - lastTwo < 320) { resetZoom(); lastTwo = 0; } else lastTwo = now;
      pinch.active = true;
      pinch.start = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: pinch.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: pinch.tx, ty: pinch.ty };
      // the first finger had started a tap or a drag: call it off
      for (const id of pinch.pts.keys()) if (id !== e.pointerId) {
        const ev = new PointerEvent('pointercancel', { pointerId: id, pointerType: 'touch', bubbles: true });
        canvas.dispatchEvent(ev);
        window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, pointerType: 'touch' }));
      }
      if (editor) closeEditor(true);
      e.stopImmediatePropagation();
      e.preventDefault();
    } else if (pinch.active) { e.stopImmediatePropagation(); e.preventDefault(); }
  };
  const onMove = (e) => {
    if (!pinch.pts.has(e.pointerId)) return;
    pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch.active || pinch.pts.size < 2) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const [a, b] = [...pinch.pts.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const st = pinch.start;
    // scale around the first midpoint, then follow the fingers
    pinch.tx = st.tx; pinch.ty = st.ty; pinch.s = st.s;
    zoomAt(st.mx, st.my, st.s * d / st.d);
    pinch.tx += mx - st.mx; pinch.ty += my - st.my;
    clampZoom(canvas.offsetWidth, canvas.offsetHeight);
    applyZoom();
  };
  const onUp = (e) => {
    if (!pinch.pts.has(e.pointerId)) return;
    pinch.pts.delete(e.pointerId);
    if (pinch.active) {
      e.stopImmediatePropagation();
      if (pinch.pts.size === 0) { swallowClickUntil = performance.now() + 450; setTimeout(() => { pinch.active = false; }, 0); }
    }
  };
  canvas.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', (e) => { if (e.isTrusted) onUp(e); }, true);
  // no page zoom or scroll from a pinch on the preview
  canvas.style.touchAction = 'none';
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, pinch.s * Math.exp(-e.deltaY / 200));
  }, { passive: false });
  // a new format, a resize or the full screen: start from the whole picture
  window.addEventListener('resize', () => { if (pinch.s > 1) resetZoom(); });
}


/* --- the cut marks: one per cut, on the line between two sections ----------------------- */
const TRANS_ICON = {
  cut: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12"/></svg>',
  fade: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 13 14 3"/><path d="M2 3h5M9 13h5" opacity=".5"/></svg>',
  slide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M10 5l3 3-3 3"/></svg>',
  zoom: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1"/><path d="M2 2l2.5 2.5M14 2l-2.5 2.5M2 14l2.5-2.5M14 14l-2.5-2.5"/></svg>',
};
function renderCutMarks(at) {
  const host = $('#scenes');
  if (!host || state.contentType === 'carousel') return;
  let t = 0;
  state.scenes.forEach((sc, i) => {
    if (i > 0) {
      const tr = sc.trans && sc.trans.type ? sc.trans.type : 'cut';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cut-mark' + (tr !== 'cut' ? ' has-trans' : '');
      b.style.left = `${at(i, t) - 2}px`;
      b.innerHTML = TRANS_ICON[tr] || TRANS_ICON.cut;
      const name = (TRANS_TYPES.find(([v]) => v === tr) || TRANS_TYPES[0])[1];
      b.title = `Transition into ${sceneName(sc, i)}: ${name}${tr !== 'cut' ? ` · ${(sc.trans.secs || TRANS_SECS).toFixed(1)}s` : ''}`;
      b.setAttribute('aria-label', b.title);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); openTransitionMenu(i, b); });
      host.append(b);
    }
    t += sc.secs;
  });
}
function openTransitionMenu(i, anchor) {
  const sc = state.scenes[i];
  if (!sc || i < 1) return;
  if (clipMenuFor === -13 - i) { closeClipMenu(); return; }
  stopPlayback();
  const cur = () => (sc.trans && sc.trans.type) || 'cut';
  const form = document.createElement('div');
  form.className = 'ov-form trans-form';
  const row = document.createElement('div');
  row.className = 'trans-types';
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', 'Transition');
  const len = document.createElement('label');
  len.className = 'slider-row';
  const secs = () => (sc.trans && sc.trans.secs) || TRANS_SECS;
  len.innerHTML = `<span>Length</span><input type="range" min="0.2" max="1" step="0.1" value="${secs()}"><output>${secs().toFixed(1)}s</output>`;
  const li = len.querySelector('input'), lo = len.querySelector('output');
  const sync = () => {
    for (const b of row.children) b.setAttribute('aria-checked', String(b.dataset.v === cur()));
    len.hidden = cur() === 'cut';
  };
  for (const [v, name] of TRANS_TYPES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.v = v;
    b.className = 'trans-type';
    b.innerHTML = `${TRANS_ICON[v]}<span>${name}</span>`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      pushUndo(`Transition · ${name}`);
      sc.trans = v === 'cut' ? null : { type: v, secs: secs() };
      save(); sync(); renderScenesKeepMenu();
      previewTransition(i);
    });
    row.append(b);
  }
  let pushed = false;
  li.addEventListener('input', () => {
    if (!sc.trans) return;
    if (!pushed) { pushUndo('Transition length'); pushed = true; }
    sc.trans.secs = Number(li.value);
    lo.textContent = `${sc.trans.secs.toFixed(1)}s`;
  });
  li.addEventListener('change', () => { pushed = false; save(); renderScenesKeepMenu(); previewTransition(i); });
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'link-btn trans-all';
  all.textContent = 'Use on every cut';
  all.addEventListener('click', (e) => {
    e.stopPropagation();
    pushUndo('Transition on every cut');
    state.scenes.forEach((x, k) => { if (k > 0) x.trans = sc.trans ? { ...sc.trans } : null; });
    save(); closeClipMenu(); renderScenes();
  });
  const note = document.createElement('p');
  note.className = 'micro trans-note';
  note.textContent = `Into ${sceneName(sc, i)}. Plays when you press Play and in the video export.`;
  form.append(row, len, all, note);
  form.addEventListener('pointerdown', (e) => e.stopPropagation());
  sync();
  openMenuAt(anchor, [], 'Transition', form);
  clipMenuFor = -13 - i;
}
/** Redraw the timeline under an open transition menu without closing it. */
function renderScenesKeepMenu() {
  const m = $('#clip-menu'), keep = clipMenuFor;
  const saveHidden = m.hidden;
  m.hidden = true;                 // renderScenes closes an open menu; this one stays
  const was = clipMenuFor; clipMenuFor = -1;
  renderScenes();
  m.hidden = saveHidden;
  clipMenuFor = keep === was ? keep : was;
  if (!saveHidden) showScrim('menu');
}
/** Play the cut once, from a moment before it. */
function previewTransition(i) {
  const tr = transOf(state.scenes[i]);
  if (!tr) return;
  const back = Math.min(0.6, state.scenes[i - 1].secs * 0.5);
  playT = Math.max(0, sceneStart(i) - back);
  const stopAt = sceneStart(i) + tr.secs + 0.4;
  startPlayback();
  const w = () => { if (!playing) return; if (playT >= stopAt) { stopPlayback(true); playT = sceneStart(i); movePlayhead(playT); return; } requestAnimationFrame(w); };
  requestAnimationFrame(w);
}

/** While editing, an overlay video under the playhead keeps playing on the preview: repaint it
    (the main loop only runs for a video background or card). */
function overlayLive() {
  if (playing || recording || looping || state.contentType === 'carousel' || document.hidden) return false;
  return (state.overlays || []).some((o) => {
    if (playT < o.start || playT >= o.start + o.dur) return false;
    const r = mediaFor(o.src);
    return !!(r && r.media === 'video');
  });
}
function wireMotion() {
  if (!Array.isArray(state.overlays)) state.overlays = [];
  renderHooks.frame = transitionFrame;
  renderHooks.afterBackground = (ctx, W, H) => drawOverlays(ctx, W, H);
  renderHooks.afterAll = (ctx, W, H) => drawItemOverlays(ctx, W, H);
  renderHooks.drawingProgress = drawingProgress;
  renderOverlayLane();
  wirePinchZoom();       // first: it must see every finger, even one that lands on an overlay
  wireOverlayCanvas();
  let last = 0;
  const loop = (ts) => {
    if (overlayLive() && ts - last > 32) { last = ts; draw(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}


/* v3.11 · phone bar: + Add joins Preview and Light/Dark as one group at the right
   edge (the section name stays on the left). On desktop it goes back beside the
   section arrows. Only the button's place in the DOM changes; its listeners stay. */
function placePhoneAdd() {
  const add = $('#fs-add-section'), nav = $('.fs-nav'), acts = $('.fs-actions'), prev = $('#fs-preview');
  if (!add || !nav || !acts || !prev) return;
  if (phoneMQ.matches) { if (add.parentElement !== acts) acts.insertBefore(add, prev); }
  else if (add.parentElement !== nav) nav.append(add);
}
function wirePhoneBarGroup() {
  placePhoneAdd();
  phoneMQ.addEventListener('change', placePhoneAdd);
}

function wireSimpleEditor() {
  $('#add-btn').addEventListener('click', (e) => openAddMenu(e.currentTarget, e.pointerType));
  $('#panel-done').addEventListener('click', () => closeSectionSheet());
  // v3.2: the full-screen button goes straight to full screen; the view settings live in the menu (☰)
  $('#fs-view').addEventListener('click', (e) => { e.stopPropagation(); openViewMenu(e.currentTarget); });
  $('#burger').addEventListener('click', () => ($('#burger-menu').hidden ? openBurger() : closeBurger()));
  $('#burger-scrim').addEventListener('click', closeBurger);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#burger-menu').hidden) { e.stopImmediatePropagation(); closeBurger(); } }, true);
  syncPanelTop();
}

function wireBadgeItems() {
  $('#badge-add').addEventListener('click', addBadgeItem);
  /* An extra badge on the preview: a tap selects it and opens Badge; a drag moves it. */
  $('#canvas-wrap').addEventListener('pointerup', (e) => {
    if (!dragging || dragging.key !== 'xbadge') return;
    if (fsMode === 'edit' && !dragging.moved) return;      // full screen has its own tap menu
    const d = dragging;
    dragging = null;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    e.stopPropagation();
    cancelLongPress();
    if (d.moved) { commitScene(); save(); selectElement(`eb:${d.id}`, { reveal: false }); return; }
    selectElement(`eb:${d.id}`);
    revealBadgeItem(d.id);
    focusBadgeItemPart(d.id, e);
  }, true);
  renderBadgeItems();
}

function wireButtons() {
  $('#buttons-add').addEventListener('click', addButton);
  renderButtons();
  /* A button on the preview: a tap selects it and opens Buttons; a drag moves
     it (the move itself is the shared drag code). Taken here, before the
     canvas's own handler, which knows nothing about buttons. */
  $('#canvas-wrap').addEventListener('pointerup', (e) => {
    if (!dragging || dragging.key !== 'button') return;
    if (fsMode === 'edit' && !dragging.moved) return;      // full screen has its own tap menu
    const d = dragging;
    dragging = null;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    e.stopPropagation();
    cancelLongPress();
    if (d.moved) { commitScene(); save(); selectElement(`bt:${d.id}`, { reveal: false }); return; }
    selectElement(`bt:${d.id}`);
    revealButton(d.id);
  }, true);
}

/* --- full-screen edit and preview ------------------------------------------------
   Three views of one state: the normal editor, Full-Screen Edit (the canvas
   large, almost no chrome) and Preview (no outlines or guides — the video
   plays on the usual engine, a carousel swipes). In Full-Screen Edit a tap on
   an empty spot offers what can be added; a tap on an element offers Edit,
   Duplicate and Remove (this section only). Drags move things as usual. The
   section controls open beside (desktop) or under (phone) the canvas.
   Esc / × go back one step: Preview → Full-Screen Edit → the editor. */
let fsMode = null;               // null | 'edit' | 'preview'

function setFsMode(mode) {
  // a phone has no other editor: full screen is where it creates and edits (closing returns to Edit)
  if (!mode && isPhone()) mode = 'edit';
  const root = document.documentElement;
  const was = fsMode;
  if (mode && !was) {
    if (sheetTab) closeSectionSheet({ focus: false });
    closeClipMenu();
  }
  if (was === 'preview' && mode !== 'preview') stopPlayback(true);
  if (editor && mode !== 'edit') closeEditor(true);
  fsMode = mode;
  root.classList.toggle('is-fs', !!mode);
  root.classList.toggle('is-fs-preview', mode === 'preview');
  $('#fs-bar').hidden = !mode;
  $('#fs-open').setAttribute('aria-pressed', String(!!mode));
  const pv = $('#fs-preview');
  pv.setAttribute('aria-pressed', String(mode === 'preview'));
  $('#fs-preview-label').textContent = mode === 'preview' ? 'Edit' : 'Preview';
  pv.setAttribute('aria-label', mode === 'preview' ? 'Back to editing' : 'Preview');
  pv.title = mode === 'preview' ? 'Back to editing (Esc)' : 'Preview: exactly as it exports';
  const tp = $('#btn-present'); if (tp) tp.setAttribute('aria-pressed', String(mode === 'preview'));
  $('#fs-play').hidden = mode !== 'preview';
  $('#fs-add-section').hidden = mode !== 'edit';
  $('#fs-hint').textContent = mode === 'preview'
    ? (state.contentType === 'carousel' ? 'Preview · play, swipe or use the arrows · Esc to edit' : 'Preview · exactly as it exports · Esc to edit')
    : 'Tap empty space to add · tap an item to edit';
  if (mode === 'preview') {
    if (sheetTab) closeSectionSheet({ focus: false });
    selected = null;
    if (state.contentType !== 'carousel') { playT = 0; startPlayback(); }
  }
  syncFsPlay();
  syncCategory();
  draw();
  requestAnimationFrame(sizePhoneCreator);
  requestAnimationFrame(() => requestAnimationFrame(() => syncPreviewProgress()));
  if (!mode && was) $('#fs-open').focus({ preventScroll: true });
}

function syncFsPlay() {
  const b = $('#fs-play');
  if (!b) return;
  b.classList.toggle('is-playing', playing);
  b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (!playing && fsMode) showScope(state.scene);
}

/** Previous / next section (a slide, in a carousel). */
function fsStep(d) {
  const n = state.scenes.length;
  const i = Math.max(0, Math.min(n - 1, state.scene + d));
  if (i === state.scene) return;
  const wasPlaying = playing;
  if (playing) stopPlayback(true);
  selectScene(i);
  if (wasPlaying && fsMode === 'preview') { playT = sceneStart(i); startPlayback(); }
  syncFsPlay();
  syncPreviewProgress();
}

const fsAnchor = (x, y) => ({ getBoundingClientRect: () => ({ left: x - 1, right: x + 1, top: y - 6, bottom: y + 6, width: 2, height: 12 }) });

/** Open a text section field in the full-screen side panel. */
function fsOpenSection(tab, el) {
  if (el) selected = el;
  openSectionSheet(tab);
  if (el && groupOf(el)) revealGroup(groupOf(el));
  syncColorRows(true);
  draw();
}

/** Edit text right on the canvas, once the layout has it. */
function fsEditText(part, pointerType) {
  selected = part;
  draw();
  requestAnimationFrame(() => openEditor(part, pointerType));
}

/** A tap on an empty spot: what can go on this section. */
function fsAddItems(pointerType) {
  const sc = state.scenes[state.scene];
  const items = [];
  // the spot tapped is the background itself: change it first
  items.push({ icon: 'image', label: 'Change background', sub: isBase(state.scene) ? 'Shared by sections without their own' : 'For this section only', run: () => fsOpenSection('background', 'background') });
  if (!isBase(state.scene) && sc.bg) items.push({ icon: 'rewind', label: 'Use the first section’s background', run: matchHook });
  items.push({ sep: true });
  // Text: one box with a header and a body. While this section's text isn't
  // showing (or a part is empty) it comes on with placeholder copy; after that,
  // Text adds another box.
  const textShowing = state.visibility !== 'none' && String(state.h1 || '').trim() && String(state.body || '').trim();
  items.push({ icon: 'add', label: 'Text', sub: textShowing ? 'Another text box — header and body' : 'Header and body, in one box', run: () => {
    if (!textShowing) {
      fillTextPlaceholders();
      state.textMode = 'both';
      setVisibility(true, true);
      commitScene(); save(); renderScenes();
      fsEditText('h1', pointerType);
    } else { addBlock(); fsOpenSection('text', selected); }
  } });
  const badgeOn = $('#tg-badge').checked;
  if (!$('#badge-field').hidden) {
    items.push({ icon: 'add', label: 'Badge', sub: badgeOn ? 'Another badge, on this section' : 'The brand badge, on this section', run: () => {
      if (!badgeOn) { $('#tg-badge').click(); fsOpenSection('badge', 'watermark'); return; }
      fsOpenSection('badge');
      addBadgeItem();
    } });
  }
  items.push({ icon: 'add', label: 'Button', sub: 'On this section — style it under Buttons', run: () => {
    fsOpenSection('buttons');
    addButton();
  } });
  items.push({ icon: 'add', label: 'Section', sub: 'Hook, Value or CTA — after this one', run: () => setTimeout(fsAddSection, 0) });
  const hasCard = !!state.inset.id && !state.inset.hidden;
  items.push({ icon: 'add', label: 'Media', sub: hasCard ? 'Another photo or video, on this section' : 'A photo or video, on this section only', run: () => {
    fsOpenSection('card', hasCard ? 'inset' : undefined);
    if (hasCard) $('#media-add').click();             // another one
    else $('#btn-inset').click();
  } });
  if (sectionHasContent(state.scene)) {
    items.push({ sep: true });
    items.push({ icon: 'tidy', label: 'Tidy up', sub: 'Centred, evenly spaced — in this format', run: () => tidySection() });
    items.push({ icon: 'clear', label: 'Clear section', sub: 'Everything but the background', run: () => clearSection(state.scene) });
  }
  return items;
}

/** A tap on an element: its controls open straight away (beside the canvas on
    a wide screen, under it on a phone), and a small bar over the element
    offers Remove (this section only). */
function fsQuickItems(el) {
  const sc = state.scenes[state.scene];
  if (String(el).startsWith('ov:')) return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeOverlay(el.slice(3)) }];
  if (String(el).startsWith('bt:')) return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeButton(el.slice(3)) }];
  if (String(el).startsWith('md:')) return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeMediaItem(el.slice(3)) }];
  if (String(el).startsWith('eb:')) return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeBadgeItem(el.slice(3)) }];
  if (String(el).startsWith('dr:')) return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeDrawing(el.slice(3)) }];
  const where = state.scenes.length > 1 ? sceneName(sc, state.scene) : 'this section';
  if (String(el).startsWith('xb:')) {
    const id = el.split(':')[1];
    return [{ icon: 'remove', label: 'Remove', danger: true, run: () => removeBlock(id) }];
  }
  if (el === 'h1' || el === 'body') {
    return [{ icon: 'remove', label: 'Remove', danger: true, run: () => clearText(el) }];
  }
  if (el === 'watermark') {
    // a part of the badge tapped: hide just that part (it keeps its settings)
    const hide = { upper: ['#tg-powered', 'Hide upper badge'], image: ['#tg-badge-image', 'Hide badge image'], lower: ['#tg-badge-lower', 'Hide lower badge'] }[badgePart];
    if (hide) return [{ icon: 'hide', label: hide[1], run: () => { const t = $(hide[0]); if (t.checked) t.click(); draw(); } }];
    return [{ icon: 'remove', label: 'Remove', danger: true, run: () => { if ($('#tg-badge').checked) $('#tg-badge').click(); selected = null; draw(); } }];
  }
  if (el === 'inset') return [{ icon: 'remove', label: 'Remove', danger: true, run: removeSceneCard }];
  return [];
}

/** An extra text's own controls: scrolled into view and flashed. */
function revealBlock(id) {
  requestAnimationFrame(() => {
    const row = document.getElementById(`blk-${id}`);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    row.classList.remove('is-revealed');
    void row.offsetWidth;
    row.classList.add('is-revealed');
    setTimeout(() => row.classList.remove('is-revealed'), 1400);
  });
}

/** Where an element sits on screen, from the last layout. */
function fsElementRect(el) {
  const L = lastLayout;
  if (!L) return null;
  let r = null;
  if (String(el).startsWith('ov:')) {
    const o = overlayById(el.slice(3));
    r = o && overlayShowing(o) ? overlayCanvasRect(o, canvas.width, canvas.height) : null;
  } else if (String(el).startsWith('md:')) {
    const m = (L.media || []).find((x) => x.id === el.slice(3));
    r = m ? { ...m.insRect, h: m.ins.h } : null;
  } else if (String(el).startsWith('eb:')) {
    const b = (L.xbadges || []).find((x) => x.id === el.slice(3));
    r = b ? { ...b.rect } : null;
  } else if (String(el).startsWith('bt:')) {
    const b = (L.buttons || []).find((x) => x.id === el.slice(3));
    r = b ? { ...b.rect } : null;
  } else if (String(el).startsWith('dr:')) {
    const d = (L.drawings || []).find((x) => x.id === el.slice(3));
    r = d ? { ...d.rect } : null;
  } else if (String(el).startsWith('xb:')) {
    const [, id, part] = el.split(':');
    const x = (L.extras || []).find((e) => e.id === id);
    const p = x && x.parts && x.parts[part];
    r = p ? { x: p.x, y: p.y, w: p.w, h: p.h } : x ? { ...x.txRect, h: x.tx.h } : null;
  } else if (el === 'watermark' && L.wm.image) r = { ...L.wmRect };
  else if (el === 'inset' && L.ins.image) r = { ...L.insRect, h: L.ins.h };
  else if ((el === 'h1' || el === 'body') && L.parts && L.parts[el]) { const p = L.parts[el]; r = { x: p.x, y: p.y, w: p.w, h: p.h }; }
  else if ((el === 'h1' || el === 'body') && !L.tx.empty) r = { ...L.txRect, h: L.tx.h };
  if (!r) return null;
  const c = canvas.getBoundingClientRect();
  const k = c.width / canvas.width;
  return { left: c.left + r.x * k, top: c.top + r.y * k, width: r.w * k, height: r.h * k, right: c.left + (r.x + r.w) * k, bottom: c.top + (r.y + r.h) * k };
}

function fsSelect(el) {
  closeClipMenu();
  selected = el;
  // the edit options, right away
  fsOpenSection(tabOf(el), el);
  if (String(el).startsWith('xb:')) revealBlock(el.split(':')[1]);
  if (String(el).startsWith('bt:')) revealButton(el.slice(3));
  if (String(el).startsWith('md:')) revealMediaItem(el.slice(3));
  if (String(el).startsWith('eb:')) revealBadgeItem(el.slice(3));
  revealInPanel(el);
  // v3.1: Remove is the ✕ on the selection's corner (syncSelDelete), the same in every mode
}

/* --- v3.1 · Cogent backgrounds (backdrops.js `cogent`) --------------------------------
   Their settings are the background's adjust (per section, saved, in templates): layout,
   bubble, halo, cground, tile, gx / gy, row, zoom, ox / oy (dragging moves them). A cogent
   picked for the first time gets the defaults written in, so the controls and the
   painter read the same values. */
setAdjustLookup((id) => state.adjust && state.adjust[id]);
function cogentAdj() {
  const bd = activeBd();
  if (!bd || bd.kind !== 'cogent') return null;
  const a = adjustFor(bd.id);
  for (const [k, v] of Object.entries(COGENT_DEFAULTS)) if (a[k] === undefined) a[k] = v && typeof v === 'object' ? clone(v) : v;
  if (!a.cground) a.cground = bd.base;
  return a;
}
let cogSig = '';
function syncCogent() {
  const bd = activeBd();
  const host = $('#cogent-controls');
  if (!host) return;
  const a = cogentAdj();
  host.hidden = !a;
  if (!a) { cogSig = ''; return; }
  const sig = JSON.stringify([bd.id, a.layout, a.bubble, a.halo, a.cground, a.tile, a.zoom, a.mirror, activeBrand().id]);
  if (sig === cogSig) return;
  cogSig = sig;
  host.dataset.layout = a.layout;
  for (const b of host.querySelectorAll('#seg-cog-layout [data-l]')) b.setAttribute('aria-checked', String(b.dataset.l === a.layout));
  $('#tg-cog-bubble').checked = !!a.bubble;
  $('#tg-cog-mirror').checked = !!a.mirror;
  for (const b of host.querySelectorAll('#seg-cog-edge [data-e]')) b.setAttribute('aria-checked', String((b.dataset.e === 'rough') === !!bd.sticker));
  const haloOk = !bd.sticker || a.bubble;      // a sticker's rough edge gets a halo only inside a bubble
  $('#cog-halo-row').hidden = !haloOk;
  $('#tg-cog-halo').checked = !!(a.halo && a.halo.on);
  $('#cog-halo-colours').hidden = !(haloOk && a.halo && a.halo.on);
  const rows = [['#cog-ground', [...solidColours().map((b) => b.base), bd.base], a.cground],
    ['#cog-halo-colours', haloColours(), (a.halo && a.halo.color) || activeBrand().haloColour || '#2b6a83']];
  for (const [sel, list0, cur] of rows) {
    const list = [...new Set(list0.filter(Boolean).map((h) => h.toLowerCase()))];
    const box = $(`${sel} .swatches`);
    if (box.dataset.sig !== list.join()) {
      box.dataset.sig = list.join();
      box.innerHTML = '';
      for (const h of list) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
        b.style.setProperty('--sw', h); b.dataset.hex = h; b.setAttribute('aria-label', h); b.title = h;
        box.append(b);
      }
    }
    for (const b of box.querySelectorAll('.swatch')) b.setAttribute('aria-checked', String(b.dataset.hex === String(cur || '').toLowerCase()));
  }
  $('#cog-tile').value = a.tile; $('#cog-tile-out').textContent = `${Math.round(a.tile * 100)}%`;
  $('#cog-scale').value = a.zoom; $('#cog-scale-out').textContent = `${Math.round(a.zoom * 100)}%`;
}
function wireCogent() {
  const edit = (fn, keep = true) => {
    const a = cogentAdj();
    if (!a) return;
    fn(a);
    cogSig = ''; bgSig = '';
    syncCogent();
    if (keep) { commitScene(); save(); refreshBgThumb(); }
    draw();
  };
  $('#seg-cog-layout').addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (b) edit((a) => { a.layout = b.dataset.l; a.ox = 0; a.oy = 0; });
  });
  $('#tg-cog-bubble').addEventListener('change', (e) => edit((a) => { a.bubble = e.target.checked; }));
  $('#tg-cog-mirror').addEventListener('change', (e) => edit((a) => { a.mirror = e.target.checked; }));
  // v3.9 · …and in the pattern library (Show all on the Pattern tab), for the pattern in use
  $('#tg-picker-mirror').addEventListener('change', (e) => {
    const a = adjustFor(state.backdrop);
    a.mirror = e.target.checked;
    syncAdjust(state.backdrop);
    $('#tg-tile-mirror').checked = a.mirror; if ($('#pat-mirror')) $('#pat-mirror').checked = a.mirror;
    commitScene(); save(); refreshBgThumb(); draw();
  });
  // v3.8 · Mirror on the brand's own patterns too (Pattern tab)
  $('#tg-tile-mirror').addEventListener('change', (e) => {
    const a = adjustFor(state.backdrop);
    a.mirror = e.target.checked;
    syncAdjust(state.backdrop);
    commitScene(); save(); refreshBgThumb(); draw();
  });
  // v3.3 · Round / Rough edges: the same cogent's other file, with the settings carried over
  $('#seg-cog-edge').addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    const bd = activeBd();
    if (!b || !bd || bd.kind !== 'cogent' || (b.dataset.e === 'rough') === !!bd.sticker) return;
    const to = bd.sticker ? bd.id.replace(/-sticker$/, '') : `${bd.id}-sticker`;
    const thumb = document.querySelector(`#thumbs .thumb[data-id="${to}"]`);
    if (!byId(to) || !thumb) return;
    const from = cogentAdj();
    const dst = adjustFor(to);
    for (const k of [...Object.keys(COGENT_DEFAULTS), 'cground', 'ox', 'oy']) if (from[k] !== undefined) dst[k] = clone(from[k]);
    thumb.click();
  });
  $('#tg-cog-halo').addEventListener('change', (e) => edit((a) => { a.halo = { ...(a.halo || {}), on: e.target.checked }; }));
  $('#cog-halo-colours').addEventListener('click', (e) => { const b = e.target.closest('.swatch[data-hex]'); if (b) edit((a) => { a.halo = { ...(a.halo || {}), on: true, color: b.dataset.hex }; }); });
  $('#cog-ground').addEventListener('click', (e) => { const b = e.target.closest('.swatch[data-hex]'); if (b) edit((a) => { a.cground = b.dataset.hex; }); });
  for (const [id, key] of [['#cog-tile', 'tile'], ['#cog-scale', 'zoom']]) {
    $(id).addEventListener('input', (e) => edit((a) => { a[key] = Number(e.target.value); }, false));
    $(id).addEventListener('change', () => { commitScene(); save(); refreshBgThumb(); });
  }
}

/* --- v3.1 · Sliders: drag to explore, type to be exact ----------------------------------
   The value beside a slider is also its precise input: tap or click it (or focus it and
   press Enter) and it becomes a small number field in place — no popover, no Apply. Enter
   or leaving the field sets it, Esc cancels, ↑ / ↓ step by 1 (Shift: 10). What you type
   goes through the slider itself (its own input + change events), so the slider stays the
   single source of truth: state, autosave, Undo, every format and export behave as when
   dragging. Out-of-range values clamp, with a brief flash. Percent sliders take percent
   (type 65 for 65 %); px and plain values take themselves. Positions stay visual only. */
const PRECISE_SKIP = new Set(['img-x', 'img-y']);
function preciseRange(out) {
  const row = out.closest('.slider-row');
  const r = row && row.querySelector('input[type="range"]');
  return r && !PRECISE_SKIP.has(r.id) && !r.disabled ? r : null;
}
/** How the shown value relates to the slider's: percent (×100) or as is, and the unit shown. */
function preciseScale(out, r) {
  const t = out.textContent.trim();
  if (/%$/.test(t) || (/^off$/i.test(t) && Number(r.max) <= 2)) return { f: 100, unit: '%' };
  const m = /([a-z]+)$/i.exec(t);
  return { f: 1, unit: m && !/^off$/i.test(t) ? ` ${m[1]}` : '' };
}
function decoratePrecise(root = document) {
  for (const out of root.querySelectorAll('.slider-row output')) {
    if (out.dataset.precise) continue;
    const r = preciseRange(out);
    if (!r) { out.dataset.precise = 'off'; continue; }
    out.dataset.precise = '1';
    out.tabIndex = 0;
    out.setAttribute('role', 'button');
    const name = (r.getAttribute('aria-label') || out.closest('.slider-row').querySelector('span')?.textContent || 'value').trim();
    out.setAttribute('aria-label', `${name}: edit the exact value`);
    out.title = 'Type an exact value';
  }
}
function editPrecise(out) {
  const r = preciseRange(out);
  if (!r || out.classList.contains('is-editing')) return;
  const { f, unit } = preciseScale(out, r);
  const min = Number(r.min) * f, max = Number(r.max) * f;
  const step = Math.max(Number(r.step) * f || 1, 0.01);
  const dec = step < 1 ? Math.min(2, String(step).split('.')[1]?.length || 1) : 0;
  const shown = Number(r.value) * f;
  const row = out.closest('.slider-row');
  const field = document.createElement('input');
  field.type = 'text';
  field.inputMode = dec ? 'decimal' : 'numeric';
  field.className = 'precise-input';
  field.value = String(Math.round(shown * 10 ** dec) / 10 ** dec);
  field.setAttribute('aria-label', `${out.getAttribute('aria-label').replace(': edit the exact value', '')}${unit.trim() ? ` (${unit.trim()})` : ''}`);
  // laid over the value (the value itself may be rewritten by the panel meanwhile)
  const wrap = document.createElement('span');
  wrap.className = 'precise-wrap';
  wrap.append(field);
  if (unit.trim()) { const u = document.createElement('span'); u.className = 'precise-unit'; u.textContent = unit.trim(); wrap.append(u); }
  row.append(wrap);
  out.classList.add('is-editing');
  field.focus({ preventScroll: true });
  field.select();
  const apply = (v) => {
    const n = Math.max(min, Math.min(max, v));
    if (Math.abs(n - v) > 1e-9) { out.classList.remove('is-clamped'); void out.offsetWidth; out.classList.add('is-clamped'); }
    // exactly what was typed (65, not the nearest slider step): the step steps aside for this set
    const st = r.getAttribute('step');
    r.setAttribute('step', 'any');
    r.value = String(n / f);
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
    if (st != null) r.setAttribute('step', st); else r.removeAttribute('step');
  };
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const v = parseFloat(String(field.value).replace(',', '.'));
    out.classList.remove('is-editing');
    wrap.remove();
    if (commit && Number.isFinite(v) && Math.abs(v - shown) > 1e-9) apply(v);
    else if (commit && Number.isFinite(v) && (v < min || v > max)) apply(v);
    out.focus({ preventScroll: true });
  };
  field.addEventListener('input', () => { field.value = field.value.replace(/[^0-9.,-]/g, ''); });
  field.addEventListener('keydown', (e) => {
    e.stopPropagation();   // Delete / ⌘Z / Space stay in the field
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const cur = parseFloat(String(field.value).replace(',', '.'));
      const by = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      const n = Math.max(min, Math.min(max, (Number.isFinite(cur) ? cur : shown) + by));
      field.value = String(Math.round(n * 10 ** dec) / 10 ** dec);
    }
  });
  field.addEventListener('blur', () => finish(true));
  for (const t of ['click', 'pointerdown']) field.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'click') e.preventDefault(); });
}
function wirePrecise() {
  decoratePrecise();
  new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) decoratePrecise(n.matches && n.matches('.slider-row') ? n.parentNode || n : n); })
    .observe(document.body, { childList: true, subtree: true });
  // a click on the value inside a <label> would otherwise just focus the slider
  document.addEventListener('click', (e) => {
    const out = e.target.closest && e.target.closest('.slider-row output[data-precise="1"]');
    if (!out || e.target.closest('.precise-input')) return;
    e.preventDefault();
    editPrecise(out);
  }, true);
  document.addEventListener('keydown', (e) => {
    const out = e.target.closest && e.target.closest('.slider-row output[data-precise="1"]');
    if (!out || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    e.stopPropagation();
    editPrecise(out);
  }, true);
}

/* --- v3.1 · Round portrait badges: Shape (Round / Bubble) and Halo ----------------------
   Only for badges marked `round` in brands.js (Ada, Clara, Jimmy, R mark) — the grunge
   stickers keep their own organic shapes. Per section, saved, in templates and exports. */
const roundBadge = () => { const set = badges(); const def = set[state.badge]; return def && def.round ? def : null; };
function haloColours() {
  const out = [];
  for (const h of [activeBrand().haloColour, ...(activeBrand().swatches || []).map((x) => x.hex), '#ffffff', '#111111']) if (h && !out.includes(h.toLowerCase())) out.push(h.toLowerCase());
  return out;
}
let shapeSig = '';
function syncBadgeShape() {
  const host = $('#bp-shape');
  if (!host) return;
  const def = roundBadge();
  const halo = state.badgeHalo || {};
  const sig = [state.brand, state.badge, !!def, state.badgeShape, halo.on, halo.color].join('|');
  if (sig === shapeSig) return;
  shapeSig = sig;
  host.hidden = !def;
  if (!def) return;
  for (const b of document.querySelectorAll('#seg-badge-shape [data-shape]')) b.setAttribute('aria-checked', String(b.dataset.shape === (state.badgeShape === 'bubble' ? 'bubble' : 'round')));
  $('#tg-halo').checked = !!halo.on;
  const row = $('#halo-colours');
  row.hidden = !halo.on;
  const box = row.querySelector('.swatches');
  const list = haloColours();
  if (box.dataset.sig !== list.join()) {
    box.dataset.sig = list.join();
    box.innerHTML = '';
    for (const h of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
      b.style.setProperty('--sw', h); b.dataset.hex = h; b.setAttribute('aria-label', `Halo ${h}`); b.title = h;
      box.append(b);
    }
  }
  const cur = (halo.color || activeBrand().haloColour || '#2b6a83').toLowerCase();
  for (const b of box.querySelectorAll('.swatch')) b.setAttribute('aria-checked', String(b.dataset.hex === cur));
}
function wireBadgeShape() {
  const done = () => { shapeSig = ''; commitScene(); save(); syncBadgeShape(); draw(); };
  $('#seg-badge-shape').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shape]');
    if (!b) return;
    state.badgeShape = b.dataset.shape === 'bubble' ? 'bubble' : 'round';
    done();
  });
  $('#tg-halo').addEventListener('change', (e) => { state.badgeHalo = { ...(state.badgeHalo || {}), on: e.target.checked }; done(); });
  $('#halo-colours').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch[data-hex]');
    if (!b) return;
    state.badgeHalo = { ...(state.badgeHalo || {}), on: true, color: b.dataset.hex };
    done();
  });
}

/* --- v3.1 · Drawing ----------------------------------------------------------------
   + Add → Drawing opens Draw mode: a small bar (pen, highlighter, line, arrow, circle ·
   brand colours · three line weights · undo · Done) and a layer over the canvas that
   takes the pointer (mouse, pen or finger; the page never scrolls under it). Every stroke
   until Done becomes ONE drawing — a stick figure is one object, not eight. Afterwards
   it is an ordinary item: tap to select (its controls open), drag to move, ✕ / Delete
   to remove, Undo throughout; "Draw more" adds strokes to it. Strokes cross the safe
   area freely; only the frame's edge limits what exports. */
const DRAW_PREFS_KEY = 'askruth.backdrop-studio.draw.v1';
const drawPrefs = { tool: 'pen', width: 12, color: null };
try { Object.assign(drawPrefs, JSON.parse(localStorage.getItem(DRAW_PREFS_KEY)) || {}); } catch (_) { /* defaults */ }
const keepDrawPrefs = () => { try { localStorage.setItem(DRAW_PREFS_KEY, JSON.stringify(drawPrefs)); } catch (_) { /* nicety */ } };
let drawMode = null;     // { target, strokes: [], cur, layer }
const drawingById = (id) => (state.drawings || []).find((d) => d.id === id);
const drawUnit = () => Math.min(canvas.width, canvas.height) / 1000;

/** The brand's colours for drawing (and white / black for annotation on anything). */
function drawColours() {
  const out = [];
  for (const h of [...(activeBrand().swatches || []).map((x) => x.hex), '#ffffff', '#111111']) if (!out.includes(h.toLowerCase())) out.push(h.toLowerCase());
  return out;
}
/** First pick: the brand colour that reads best on this background. */
function defaultDrawColour() {
  const list = drawColours();
  if (drawPrefs.color && list.includes(drawPrefs.color)) return drawPrefs.color;
  const base = activeBd().base || '#000000';
  return list.slice().sort((a, b) => contrast(b, base) - contrast(a, base))[0];
}

function placeDrawLayer() {
  if (!drawMode) return;
  const L = drawMode.layer, wrap = $('#canvas-wrap');
  const r = canvas.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  Object.assign(L.style, { left: `${r.left - w.left}px`, top: `${r.top - w.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  if (L.width !== canvas.width || L.height !== canvas.height) { L.width = canvas.width; L.height = canvas.height; }
  // the bar: over the canvas's top edge on a wide screen; a phone keeps it at the bottom (CSS)
  const bar = $('#draw-bar');
  if (!isPhone()) {
    const bw = bar.offsetWidth;
    bar.style.left = `${Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2))}px`;
    bar.style.top = `${Math.max(8, r.top - bar.offsetHeight - 10)}px`;
  } else { bar.style.left = ''; bar.style.top = ''; }
  paintDrawLayer();
}
function paintDrawLayer() {
  if (!drawMode) return;
  const g = drawMode.layer.getContext('2d');
  g.clearRect(0, 0, drawMode.layer.width, drawMode.layer.height);
  const u = drawUnit();
  for (const st of [...drawMode.strokes, ...(drawMode.cur ? [drawMode.cur] : [])]) {
    paintStroke(g, st, st.p, { color: st.c, opacity: 1, lw: Math.max(0.5, st.w * u * (st.t === 'hl' ? 3.2 : 1)) });
  }
}
function syncDrawBar() {
  for (const b of document.querySelectorAll('#draw-bar [data-tool]')) b.setAttribute('aria-checked', String(b.dataset.tool === drawPrefs.tool));
  for (const b of document.querySelectorAll('#draw-bar [data-w]')) b.setAttribute('aria-checked', String(Number(b.dataset.w) === drawPrefs.width));
  const host = $('#draw-bar-colours');
  const list = drawColours();
  if (host.dataset.sig !== list.join()) {
    host.dataset.sig = list.join();
    host.innerHTML = '';
    for (const h of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
      b.style.setProperty('--sw', h); b.dataset.hex = h; b.setAttribute('aria-label', h); b.title = h;
      host.append(b);
    }
  }
  const cur = drawMode ? drawMode.color : defaultDrawColour();
  for (const b of host.querySelectorAll('.swatch')) b.setAttribute('aria-checked', String(b.dataset.hex === cur));
  $('#draw-undo').disabled = !(drawMode && drawMode.strokes.length);
}

function enterDraw(target) {
  if (drawMode) return;
  dropMulti();
  stopPlayback();
  if (editor) closeEditor(true);
  closeClipMenu();
  if (sheetTab) closeSectionSheet({ focus: false });
  selected = null;
  const layer = document.createElement('canvas');
  layer.className = 'draw-layer';
  layer.setAttribute('aria-label', 'Drawing area — draw with the mouse, a pen or a finger');
  $('#canvas-wrap').append(layer);
  const d = target && drawingById(target);
  drawMode = { target: d ? d.id : null, strokes: [], cur: null, layer, color: d ? (d.color || defaultDrawColour()) : defaultDrawColour() };
  document.documentElement.classList.add('is-drawing');
  $('#draw-bar').hidden = false;
  syncDrawBar();
  draw();
  requestAnimationFrame(placeDrawLayer);
  // the pointer: one stroke per press
  layer.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    const t = drawPrefs.tool;
    drawMode.cur = { t, p: [[p.x, p.y]], c: drawMode.color, w: drawPrefs.width };
    if (t !== 'pen' && t !== 'hl') drawMode.cur.p.push([p.x, p.y]);
    paintDrawLayer();
  });
  layer.addEventListener('pointermove', (e) => {
    if (!drawMode || !drawMode.cur) return;
    const st = drawMode.cur;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = toCanvas(ev);
      if (st.t === 'pen' || st.t === 'hl') {
        const last = st.p[st.p.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) >= 1.5 * drawUnit()) st.p.push([p.x, p.y]);
      } else st.p[1] = [p.x, p.y];
    }
    paintDrawLayer();
  });
  const end = () => {
    if (!drawMode || !drawMode.cur) return;
    const st = drawMode.cur;
    drawMode.cur = null;
    const a = st.p[0], b = st.p[st.p.length - 1];
    // a shape needs some size; a pen tap is a dot
    if (st.t === 'pen' || st.t === 'hl' || Math.hypot(b[0] - a[0], b[1] - a[1]) > 6 * drawUnit()) drawMode.strokes.push(st);
    paintDrawLayer();
    syncDrawBar();
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);
}

/** Done: the strokes become one drawing (or join the one being added to). */
function finishDraw() {
  if (!drawMode) return;
  const { strokes, target, layer } = drawMode;
  drawMode = null;
  layer.remove();
  $('#draw-bar').hidden = true;
  document.documentElement.classList.remove('is-drawing');
  if (!strokes.length) { ovDrawWaiting = false; draw(); return; }
  const W = canvas.width, H = canvas.height, u = drawUnit();
  const old = target && drawingById(target);
  // everything in canvas pixels first: the existing strokes (when adding) and the new ones
  const all = [];
  if (old) {
    for (const st of old.strokes) all.push({ ...st, p: st.p.map((pt) => drawingPoint(old, pt, W, H)), c: st.c || old.color, w: (st.w || old.width || 10) * (old.s || 1) });
  }
  all.push(...strokes);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of all) for (const [x, y] of st.p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const norm = all.map((st) => ({ t: st.t, c: st.c, w: Math.round(st.w * 10) / 10, p: st.p.map(([x, y]) => [Math.round(((x - cx) / u) * 10) / 10, Math.round(((y - cy) / u) * 10) / 10]) }));
  pushUndo(old ? 'Drawing changed' : 'Drawing added');
  const d = old || { id: `d${Date.now().toString(36)}`, opacity: 1 };
  Object.assign(d, { x: cx / W, y: cy / H, s: 1, color: strokes[strokes.length - 1].c, width: strokes[strokes.length - 1].w, strokes: norm });
  if (!old) state.drawings = [...(state.drawings || []), d];
  if (!old && ovDrawWaiting) { ovDrawWaiting = false; drawingToOverlay(d); return; }
  markEdited();
  commitScene();
  save();
  selectElement(`dr:${d.id}`);
  syncDrawGroup();
  draw();
}

/** The topmost drawing under a canvas point (on its lines, not just inside its box). */
function drawingAt(x, y) {
  const W = canvas.width, H = canvas.height;
  const k = canvas.width / (canvas.getBoundingClientRect().width || canvas.width);
  const segDist = (px, py, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  };
  const list = state.drawings || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    for (const st of d.strokes || []) {
      let pts = (st.p || []).map((pt) => drawingPoint(d, pt, W, H));
      if (st.t === 'ellipse' && pts.length > 1) {
        const [a, b] = [pts[0], pts[pts.length - 1]], ex = (a[0] + b[0]) / 2, ey = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
        pts = Array.from({ length: 49 }, (_, n) => [ex + rx * Math.cos((n / 48) * Math.PI * 2), ey + ry * Math.sin((n / 48) * Math.PI * 2)]);
      } else if ((st.t === 'line' || st.t === 'arrow') && pts.length > 1) pts = [pts[0], pts[pts.length - 1]];
      const tol = strokeWidth(d, st, W, H) / 2 + 12 * k;
      if (pts.length === 1 && Math.hypot(x - pts[0][0], y - pts[0][1]) <= tol) return d;
      for (let n = 1; n < pts.length; n++) if (segDist(x, y, pts[n - 1], pts[n]) <= tol) return d;
    }
  }
  return null;
}

function removeDrawing(id) {
  pushUndo('Drawing removed');
  state.drawings = (state.drawings || []).filter((d) => d.id !== id);
  if (selected === `dr:${id}`) { selected = null; if (sheetTab === 'draw') closeSectionSheet({ focus: false }); }
  commitScene(); save(); draw();
}
function duplicateDrawing(id) {
  const d = drawingById(id);
  if (!d) return;
  const copy = clone(d);
  copy.id = `d${Date.now().toString(36)}`;
  copy.x = Math.min(0.95, d.x + 0.04); copy.y = d.y + 0.06 > 0.95 ? Math.max(0.05, d.y - 0.06) : d.y + 0.06;
  state.drawings = [...state.drawings, copy];
  commitScene(); save();
  selectElement(`dr:${copy.id}`);
  syncDrawGroup();
}

/** The Drawing group: its colour (one for the whole drawing), line, opacity, size. */
function syncDrawGroup() {
  const id = String(selected || '').startsWith('dr:') ? selected.slice(3) : null;
  const d = id && drawingById(id);
  if (!d) return;
  const host = $('#draw-colours .swatches');
  const list = drawColours();
  if (host.dataset.sig !== list.join()) {
    host.dataset.sig = list.join();
    host.innerHTML = '';
    for (const h of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
      b.style.setProperty('--sw', h); b.dataset.hex = h; b.setAttribute('aria-label', h); b.title = h;
      host.append(b);
    }
  }
  const one = (d.strokes || []).every((st) => !st.c || st.c === d.color) ? d.color : null;
  for (const b of host.querySelectorAll('.swatch')) b.setAttribute('aria-checked', String(b.dataset.hex === one));
  const w = d.width || 10;
  $('#draw-width').value = w; $('#draw-width-out').textContent = String(Math.round(w));
  const o = d.opacity ?? 1;
  $('#draw-opacity').value = o; $('#draw-opacity-out').textContent = `${Math.round(o * 100)}%`;
  const sc = d.s || 1;
  $('#draw-scale').value = sc; $('#draw-scale-out').textContent = `${Math.round(sc * 100)}%`;
  $('#draw-anim').checked = d.anim !== false;
  $('#draw-anim-row').hidden = state.contentType === 'carousel';
}

function wireDrawing() {
  // the bar
  $('#draw-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tool) { drawPrefs.tool = b.dataset.tool; keepDrawPrefs(); }
    else if (b.dataset.w) { drawPrefs.width = Number(b.dataset.w); keepDrawPrefs(); }
    else if (b.dataset.hex) { drawMode && (drawMode.color = b.dataset.hex); drawPrefs.color = b.dataset.hex; keepDrawPrefs(); }
    else if (b.id === 'draw-undo' && drawMode) { drawMode.strokes.pop(); paintDrawLayer(); }
    else if (b.id === 'draw-done') { finishDraw(); return; }
    syncDrawBar();
  });
  // while drawing: Esc / Enter finish, ⌘Z takes back the last stroke; a press anywhere else finishes
  document.addEventListener('keydown', (e) => {
    if (!drawMode) return;
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); finishDraw(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); drawMode.strokes.pop(); paintDrawLayer(); syncDrawBar(); }
  }, true);
  document.addEventListener('pointerdown', (e) => {
    if (!drawMode) return;
    if (e.target.closest('#draw-bar, .draw-layer')) return;
    finishDraw();
  }, true);
  window.addEventListener('resize', () => { if (drawMode) requestAnimationFrame(placeDrawLayer); });
  // the canvas itself can change size under the layer (a phone's sheet closing, the panel)
  new ResizeObserver(() => { if (drawMode) requestAnimationFrame(placeDrawLayer); }).observe(canvas);
  // select and move a drawing (before the canvas's own handlers: a drawing is on top)
  $('#canvas-wrap').addEventListener('pointerdown', (e) => {
    if (drawMode || e.target !== canvas || e.button > 0 || editor || fsMode === 'preview') return;
    if (e.shiftKey || e.metaKey || e.ctrlKey || multiMode) return;
    const p = toCanvas(e);
    const d = drawingAt(p.x, p.y);
    if (!d) return;
    e.stopPropagation();
    e.preventDefault();
    if (playing) stopPlayback();
    const W = canvas.width, H = canvas.height;
    const st = { sx: e.clientX, sy: e.clientY, px: p.x, py: p.y, x: d.x, y: d.y, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    const move = (ev) => {
      if (!st.moved && Math.hypot(ev.clientX - st.sx, ev.clientY - st.sy) < 4) return;
      st.moved = true;
      const q = toCanvas(ev);
      d.x = Math.max(0, Math.min(1, st.x + (q.x - st.px) / W));
      d.y = Math.max(0, Math.min(1, st.y + (q.y - st.py) / H));
      selected = `dr:${d.id}`;
      draw();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (st.moved) { markEdited(); commitScene(); save(); }
      selectElement(`dr:${d.id}`, { reveal: !st.moved || !!sheetTab });
      syncDrawGroup();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, true);
  // the Drawing group
  const edit = (fn, keep = false) => {
    const d = String(selected || '').startsWith('dr:') && drawingById(selected.slice(3));
    if (!d) return;
    fn(d);
    if (keep) { commitScene(); save(); }
    syncDrawGroup();
    draw();
  };
  $('#draw-colours').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch[data-hex]');
    if (b) edit((d) => { d.color = b.dataset.hex; for (const st of d.strokes) delete st.c; }, true);
  });
  $('#draw-width').addEventListener('input', (e) => edit((d) => { d.width = Number(e.target.value); for (const st of d.strokes) delete st.w; }));
  $('#draw-opacity').addEventListener('input', (e) => edit((d) => { d.opacity = Number(e.target.value); }));
  $('#draw-scale').addEventListener('input', (e) => edit((d) => { d.s = Number(e.target.value); }));
  // v3.21 · draw it on in the video (the default); turning it on plays the section's start once
  $('#draw-anim').addEventListener('change', (e) => {
    pushUndo(e.target.checked ? 'Drawing draws on' : 'Drawing shows at once');
    edit((d) => { if (e.target.checked) delete d.anim; else d.anim = false; }, true);
    if (e.target.checked && state.contentType !== 'carousel' && !playing) {
      const k = state.scene, d = String(selected || '').startsWith('dr:') ? selected.slice(3) : null;
      playT = sceneStart(k);
      startPlayback();
      const until = sceneStart(k) + drawOnWindow(k).end + 0.3;
      const watch = () => { if (!playing) return; if (playT >= until) { stopPlayback(true); if (d) selectElement(`dr:${d}`, { reveal: false }); draw(); return; } requestAnimationFrame(watch); };
      requestAnimationFrame(watch);
    }
  });
  for (const id of ['#draw-width', '#draw-opacity', '#draw-scale']) $(id).addEventListener('change', () => { commitScene(); save(); });
  $('#draw-more').addEventListener('click', () => { const id = String(selected || '').startsWith('dr:') ? selected.slice(3) : null; if (id) enterDraw(id); });
  $('#draw-dup').addEventListener('click', () => { if (String(selected || '').startsWith('dr:')) duplicateDrawing(selected.slice(3)); });
  $('#draw-remove').addEventListener('click', () => { if (String(selected || '').startsWith('dr:')) removeDrawing(selected.slice(3)); });
  new MutationObserver(() => { if ($('.panel-controls').dataset.tab === 'draw') syncDrawGroup(); })
    .observe($('.panel-controls'), { attributes: true, attributeFilter: ['data-tab'] });
}

/* --- v3.1 · the desktop panel: resizable, collapsible ------------------------------
   Drag its left edge (300–560 px, never squeezing the preview under 420 px; double-click
   resets) — remembered on this browser. The round button under ◐ / ⤢ hides it for more
   canvas. Hidden, a tap on something still opens its controls: the panel floats in over
   the stage while that item is selected (Done / Esc / a tap on the empty stage put it
   away) and the canvas never jumps. The preview only rescales; the export size never
   changes. Phones keep their sheet. */
const PANEL_W_KEY = 'askruth.backdrop-studio.panel-w';
const PANEL_HIDE_KEY = 'askruth.backdrop-studio.panel-hidden';
const PANEL_W = { min: 300, def: 380, max: 560 };
const MIN_PREVIEW = 420;
const panelMaxW = () => Math.max(PANEL_W.min, Math.min(PANEL_W.max, window.innerWidth - MIN_PREVIEW - 80));
let panelW = null;
function relayoutStage() { window.dispatchEvent(new Event('resize')); }
function applyPanelW() {
  const shell = $('.shell');
  if (!shell) return;
  if (panelW == null) { shell.style.removeProperty('--panel-w'); shell.classList.remove('has-panel-w'); return; }
  const w = Math.round(Math.max(PANEL_W.min, Math.min(panelMaxW(), panelW)));
  shell.style.setProperty('--panel-w', `${w}px`);
  shell.classList.add('has-panel-w');
}
function setPanelW(w, keep = true) {
  panelW = w == null ? null : Math.max(PANEL_W.min, Math.min(panelMaxW(), w));   // kept as shown
  applyPanelW();
  if (keep) { try { if (panelW == null) localStorage.removeItem(PANEL_W_KEY); else localStorage.setItem(PANEL_W_KEY, String(Math.round(panelW))); } catch (_) { /* per-browser nicety */ } }
  relayoutStage();
}
const panelHidden = () => document.documentElement.classList.contains('panel-collapsed');
function setPanelHidden(on, keep = true) {
  const html = document.documentElement;
  html.classList.toggle('panel-collapsed', !!on);
  if (!on) html.classList.remove('panel-peek');
  const b = $('#panel-toggle');
  b.setAttribute('aria-pressed', String(!!on));
  const label = on ? 'Show the panel' : 'Hide the panel';
  b.setAttribute('aria-label', label); b.title = label;
  if (keep) { try { if (on) localStorage.setItem(PANEL_HIDE_KEY, '1'); else localStorage.removeItem(PANEL_HIDE_KEY); } catch (_) { /* nicety */ } }
  syncPanelPeek();
  relayoutStage();
}
/** Hidden panel + something selected → the panel floats in with its controls. */
function syncPanelPeek() {
  const html = document.documentElement;
  const tab = $('.panel-controls').dataset.tab;
  const peek = panelHidden() && !isPhone() && !fsMode && !!tab && tab !== 'all';
  if (html.classList.contains('panel-peek') !== peek) {
    // v4.1 · the panel floats OVER the stage: the canvas keeps its size and place (no relayout).
    // It opens at the right, or at the left when the tap was where the right-hand panel would cover it.
    if (peek) {
      const w = Math.min(360, window.innerWidth * 0.4);
      html.classList.toggle('peek-left', peekTapX != null && peekTapX > window.innerWidth - w - 40);
    } else html.classList.remove('peek-left');
    html.classList.toggle('panel-peek', peek); selDelSig = '';
  }
}
/* where the last tap on the canvas was (screen x) — picks the floating panel's side */
let peekTapX = null;
window.addEventListener('pointerdown', (e) => { peekTapX = e.target.closest && e.target.closest('#canvas-wrap, .canvas-editor') ? e.clientX : null; }, true);
/* full screen: the open item's controls (380 px at the right) take the side away from the tap */
{
  let wasOpen = false;
  new MutationObserver(() => {
    const html = document.documentElement;
    const open = html.classList.contains('has-open-section') && html.classList.contains('is-fs') && !isPhone();
    if (open === wasOpen) return;
    wasOpen = open;
    if (open) html.classList.toggle('peek-left', peekTapX != null && peekTapX > window.innerWidth - 380 - 16 - 24);
    else if (!html.classList.contains('panel-peek')) html.classList.remove('peek-left');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}
function wirePanelSize() {
  try {
    const w = Number(localStorage.getItem(PANEL_W_KEY));
    if (w >= PANEL_W.min) panelW = w;
    if (localStorage.getItem(PANEL_HIDE_KEY) === '1') setPanelHidden(true, false);
  } catch (_) { /* nicety */ }
  applyPanelW();
  const grip = document.createElement('div');
  grip.className = 'panel-grip';
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', 'Panel width — drag, or use the arrow keys');
  grip.tabIndex = 0;
  grip.title = 'Drag to resize · double-click to reset';
  $('.panel-controls').before(grip);
  let drag = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, w: $('.panel-controls').getBoundingClientRect().width };
    document.documentElement.classList.add('is-resizing-panel');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    panelW = drag.w + (drag.x - e.clientX);
    applyPanelW();
    relayoutStage();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    document.documentElement.classList.remove('is-resizing-panel');
    setPanelW(panelW);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => setPanelW(null));
  grip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = $('.panel-controls').getBoundingClientRect().width;
    setPanelW(cur + (e.key === 'ArrowLeft' ? 20 : -20));
  });
  $('#panel-toggle').addEventListener('click', () => setPanelHidden(!panelHidden()));
  new MutationObserver(syncPanelPeek).observe($('.panel-controls'), { attributes: true, attributeFilter: ['data-tab'] });
  // a tap on the empty stage around the canvas puts the floating panel away
  $('.stage').addEventListener('click', (e) => {
    if (!document.documentElement.classList.contains('panel-peek')) return;
    if (e.target.closest('#canvas-wrap, button, input, select, textarea, .canvas-editor, .panel-controls')) return;
    closeSectionSheet({ focus: false });
  });
  window.addEventListener('resize', () => { if (panelW != null) applyPanelW(); });
}

/* --- v3.1 · Remove from the canvas ------------------------------------------------
   A selected item shows one small ✕ at the upper-right corner of its outline: tap it and
   the item goes, with Undo in the toast (no confirmation). Delete / Backspace does the
   same. Badge parts hide instead (the switch brings them back). Nothing selected, a
   drag, typing on the canvas, Preview, several selected → no ✕. */
function selDeleteAction() {
  // v3.13: also while a text is being typed on the canvas (a desktop click opens the editor at once)
  if (!selected || selected === 'background' || dragging || fsMode === 'preview' || multiSel.length > 1 || playing) return null;
  const items = fsQuickItems(selected);
  return items.length ? items[0] : null;
}
function runSelDelete() {
  if (editor) closeEditor(true);
  const it = selDeleteAction();
  if (!it) return;
  // the badge (and its parts) only switch off: give them an Undo too
  const part = selected === 'watermark' && it.label !== 'Remove';
  if (selected === 'watermark') pushUndo(it.label === 'Remove' ? 'Badge removed' : `${it.label.replace(/^Hide /, '')} hidden`);
  it.run();
  if (part) {
    // one part of the badge went: its controls stay open, so [Upper] [Lower] show it off — and bring it back
    badgePart = null;
    selected = 'watermark';
    if (!sheetTab) openSectionSheet('badge');
  } else {
    // the item is gone: so are its controls
    selected = null;
    if (sheetTab) closeSectionSheet({ focus: false });
  }
  syncSelDelete();
  draw();
}
let selDelSig = '';
function syncSelDelete() {
  const b = $('#sel-del');
  if (!b) return;
  const it = selDeleteAction();
  const r = it && fsElementRect(selected);
  if (!r || !$('#home').hidden) { if (!b.hidden) b.hidden = true; selDelSig = ''; return; }
  const size = 28;
  // the corner, kept on screen (and off the canvas's own round buttons on the far right)
  const x = Math.max(size / 2 + 4, Math.min(window.innerWidth - size / 2 - 4, r.right));
  const y = Math.max(size / 2 + 4, Math.min(window.innerHeight - size / 2 - 4, r.top));
  const sig = `${Math.round(x)}|${Math.round(y)}|${it.label}`;
  if (sig === selDelSig && !b.hidden) return;
  selDelSig = sig;
  b.style.left = `${x - size / 2}px`;
  b.style.top = `${y - size / 2}px`;
  b.setAttribute('aria-label', it.label === 'Remove' ? 'Remove this item' : it.label);
  b.title = b.getAttribute('aria-label');
  b.hidden = false;
}
function wireSelDelete() {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'sel-del';
  b.className = 'sel-del';
  b.hidden = true;
  b.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>';
  // pointerdown is the canvas's: keep this tap from becoming a drag or a deselect
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); runSelDelete(); });
  document.body.append(b);
  window.addEventListener('resize', () => { selDelSig = ''; syncSelDelete(); });
  document.addEventListener('scroll', () => { selDelSig = ''; syncSelDelete(); }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const a = document.activeElement;
    if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
    if (multiSel.length > 1 || !selDeleteAction()) return;
    e.preventDefault();
    runSelDelete();
  });
}

/** The first header or body as an extra text block of its own. */
function duplicateMainText(part) {
  const L = lastLayout;
  const p = L && L.parts && L.parts[part];
  const H = canvas.height;
  let y = p ? (p.y + p.h) / H + 0.03 : 0.6;
  if (y > 0.85) y = Math.max(0.08, (p ? p.y / H : 0.5) - 0.12);
  const id = Date.now().toString(36);
  state.blocks = state.blocks || [];
  state.blocks.push({ id, h1: part === 'h1' ? state.h1 : '', body: part === 'body' ? state.body : '', x: 0.5, y, style: styleOf(state) });
  commitScene();
  save();
  renderBlocks();
  selected = `xb:${id}:${part}`;
  draw();
}

function duplicateBlock(id) {
  const b = blockById(id);
  if (!b) return;
  const copy = clone(b);
  copy.id = Date.now().toString(36);
  copy.y = b.y + 0.08 > 0.88 ? Math.max(0.06, b.y - 0.08) : b.y + 0.08;
  state.blocks.push(copy);
  commitScene();
  save();
  renderBlocks();
  selected = `xb:${copy.id}:h1`;
  draw();
}

function wireFullScreen() {
  const wrap = $('#canvas-wrap');
  $('#fs-open').addEventListener('click', () => setFsMode(fsMode ? null : 'edit'));
  $('#fs-close').addEventListener('click', () => setFsMode(null));
  // the same Export as the top bar — its sheet opens over full screen
  $('#fs-add-section').addEventListener('click', (e) => { e.stopPropagation(); openAddMenu(e.currentTarget, e.pointerType); });
  $('#fs-export').addEventListener('click', () => { if (playing) stopPlayback(true); $('#btn-export').click(); });
  $('#fs-preview').addEventListener('click', () => setFsMode(fsMode === 'preview' ? 'edit' : 'preview'));
  $('#fs-prev').addEventListener('click', () => fsStep(-1));
  $('#fs-next').addEventListener('click', () => fsStep(1));
  $('#fs-sheet-close').addEventListener('click', () => closeSectionSheet());
  // a tap on the empty space around the canvas closes the open section
  $('.stage').addEventListener('click', (e) => {
    if (!fsMode || !sheetTab) return;
    if (e.target.closest('#canvas-wrap, .fs-bar, button, input, select, textarea, .canvas-editor')) return;
    closeSectionSheet({ focus: false });
  });
  $('#fs-play').addEventListener('click', () => {
    if (playing) stopPlayback(true);
    else startPlayback();
    syncFsPlay();
  });

  /* Preview: the canvas is for looking (and swiping), not editing. */
  let swipe = null;
  wrap.addEventListener('pointerdown', (e) => {
    if (fsMode !== 'preview') return;
    e.stopPropagation();
    e.preventDefault();
    swipe = { x: e.clientX, y: e.clientY };
  }, true);
  wrap.addEventListener('pointerup', (e) => {
    if (fsMode === 'preview') {
      e.stopPropagation();
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) fsStep(dx < 0 ? 1 : -1);
      else { if (playing) stopPlayback(true); else startPlayback(); syncFsPlay(); }   // v3.1: carousels play too
      return;
    }
    /* Full-Screen Edit: a tap opens a menu here instead of the panel. Drags
       still move things (they reach the canvas as always). */
    if (fsMode !== 'edit' || !dragging || dragging.moved || e.button > 0 || editor) return;
    const d = dragging;
    dragging = null;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    cancelLongPress();
    e.stopPropagation();
    const el = d.key === 'watermark' ? 'watermark' : d.key === 'inset' ? 'inset'
      : d.key === 'button' ? `bt:${d.id}` : d.key === 'media' ? `md:${d.id}` : d.key === 'xbadge' ? `eb:${d.id}`
      : d.key === 'xblock' ? `xb:${d.id}:${d.part === 'body' ? 'body' : 'h1'}`
      : d.key === 'text' ? (d.part === 'body' ? 'body' : 'h1') : 'background';
    const pt = e.pointerType;
    if (el === 'background') {
      // see it → select it → edit it: empty canvas is the background (+ adds things)
      void pt;
      fsSelect('background');
      return;
    } else {
      fsSelect(el);
      return;
    }
    clipMenuFor = -4;
  }, true);
  for (const t of ['pointermove', 'contextmenu']) {
    wrap.addEventListener(t, (e) => { if (fsMode === 'preview') e.stopPropagation(); }, true);
  }

  // Esc goes back one step — after anything open on top has had its turn
  window.addEventListener('keydown', (e) => {
    if (!fsMode) return;
    const open = editor || sheetTab || !$('#clip-menu').hidden || !$('#color-pop').hidden || !$('#picker').hidden
      || !$('#sheet').hidden || !$('#camera').hidden || !$('#home-all').hidden || !$('#save-pop').hidden;
    if (e.key === 'Escape' && !open) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setFsMode(fsMode === 'preview' ? 'edit' : null);
    } else if (!open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault();
      fsStep(e.key === 'ArrowRight' ? 1 : -1);
    }
  }, true);
}

/* --- undo -------------------------------------------------------------------------
   Removing a section, a button, a text box, text or media is one tap, so every
   removal can be undone: a note says what went and offers Undo (and ⌘Z / Ctrl+Z
   does the same). The whole design is kept as it was, like a saved design. */
const undoStack = [];
let toastTimer = 0;
/* v3.1 · Redo: what Undo took back can be put back (⌘⇧Z / Ctrl+Y, or Redo in the toast);
   a new change clears it, as everywhere. */
const redoStack = [];
function pushUndo(what) {
  try {
    undoStack.push({ what, data: snapshot() });
    if (undoStack.length > HIST_MAX) undoStack.shift();
    redoStack.length = 0;
  } catch (_) {}
  syncUndoButtons();
  showToast(`${what}`, 'Undo', undoLast);
}
async function redoLast() {
  const r = redoStack.pop();
  if (!r) { syncUndoButtons(); return; }
  histApplying = true;
  dropMulti();
  try { undoStack.push({ what: r.what, data: snapshot() }); } catch (_) {}
  stopPlayback();
  if (editor) closeEditor(true);
  closeClipMenu();
  await applyTemplate({ data: r.data });
  renderButtons(); renderBlocks(); renderBadgeItems();
  draw();
  showToast(`${r.what} again`, 'Undo', undoLast);
  syncUndoButtons();
  histSettle();
}
async function undoLast() {
  dropMulti();   // a selection belongs to the design and section it was made on
  if (!histApplying) { clearTimeout(histTimer); histRecord(); }   // v4.1: an edit not yet saved is the step to undo first
  const u = undoStack.pop();
  hideToast();
  if (!u) { syncUndoButtons(); return; }
  histApplying = true;
  try { redoStack.push({ what: u.what, data: snapshot() }); if (redoStack.length > 20) redoStack.shift(); } catch (_) {}
  stopPlayback();
  if (editor) closeEditor(true);
  closeClipMenu();
  await applyTemplate({ data: u.data });
  renderButtons();
  renderBlocks();
  renderBadgeItems();
  draw();
  showToast(`Undone · ${u.what}`, 'Redo', redoLast);
  syncUndoButtons();
  histSettle();
}
function showToast(text, action, run, ms = 6000) {
  let t = $('#undo-toast');
  if (!t) {
    t = document.createElement('p');
    t.id = 'undo-toast';
    t.className = 'save-toast undo-toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.innerHTML = '';
  t.append(document.createTextNode(text));
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action;
    b.addEventListener('click', run);
    t.append(b);
  }
  t.hidden = false;
  // v3.20 · laid over the top bar, centred on it: it no longer covers the panels, the timeline or the design
  const tb = $('.topbar');
  if (tb) { const r = tb.getBoundingClientRect(); t.style.top = `${Math.max(4, Math.round(r.top + (r.height - t.offsetHeight) / 2))}px`; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { const t = $('#undo-toast'); if (t) t.hidden = true; }
// focus rings for the keyboard only (a select keeps "focus-visible" after a click in some browsers)
document.addEventListener('keydown', (e) => { if (e.key === 'Tab') document.documentElement.classList.add('kb'); }, true);
document.addEventListener('pointerdown', () => document.documentElement.classList.remove('kb'), true);
// the first real edit makes this design worth reopening
for (const t of ['input', 'change', 'pointerup']) {
  document.addEventListener(t, (e) => {
    if (!state.pristine || !e.target.closest || !e.target.closest('.shell, .fs-bar, .clip-menu, .color-pop')) return;
    state.pristine = false;
    save();
  }, true);
}
document.addEventListener('keydown', (e) => {
  // v3.1: ⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y redo
  const redo = (e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.metaKey && e.key.toLowerCase() === 'y'));
  if (!redo) return;
  const a = document.activeElement;
  if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
  e.preventDefault();   // v4.1: always ours — with nothing to redo, the browser must not act on it
  if (!redoStack.length) { showToast('Nothing to redo', null, null, 1600); return; }
  redoLast();
});
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
  const a = document.activeElement;
  if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;   // their own undo
  e.preventDefault();   // v4.1: always ours — otherwise Safari's ⌘Z reopens a closed tab ("Undo Close Tab")
  if (!histApplying) { clearTimeout(histTimer); histRecord(); }   // an edit not yet saved counts
  if (!undoStack.length) { showToast('Nothing to undo', null, null, 1600); return; }
  undoLast();
});

/* The saved state names the brand, so it has to be read before the artwork
   is fetched — otherwise the wrong brand's files load and are thrown away. */
load();
// v3.1 keys an older save doesn't have (snapshot() copies every design key)
if (!Array.isArray(state.drawings)) state.drawings = [];
if (state.badgeShape !== 'bubble') state.badgeShape = 'round';
if (typeof state.ctaBox !== 'boolean') state.ctaBox = false;
if (state.badgeHalo === undefined) state.badgeHalo = null;
if (!SAFE_TARGETS[state.safeFor]) state.safeFor = 'all';
setSafeTarget(state.safeFor);
ensureColors();
/* "Surface" (a colour around a moved picture) was removed — the background gallery
   and its colours already pick the background; drop any surface set before. */
for (const a of Object.values(state.adjust || {})) if (a) delete a.ground;
for (const sc of state.scenes || []) for (const a of Object.values(sc.adj || {})) if (a) delete a.ground;
retireIds(state);
unlinkAll(state);
for (const d of Object.values(state.designs || {})) retireIds(d);
/* v3.1 · P0: the live fields are the newest truth for the open section. Typing in a
   panel field saves them, but the section's own copy is only written on commitScene();
   loading that stale copy on boot threw the last edits away (a header typed and then
   reloaded came back as it was). Sync the open section first. */
try {
  if (Array.isArray(state.scenes) && state.scenes[state.scene]) {
    // v4: the backgrounds stay exactly as saved — whether an upload is a video isn't known yet
    const sc0 = state.scenes[state.scene];
    const keep = { sharedBg: state.sharedBg, sharedStill: state.sharedStill, bg: sc0.bg, backdrop: state.backdrop };
    commitScene();
    if (pendingUpload(keep.sharedBg) || pendingUpload(keep.backdrop) || pendingUpload(keep.bg)) {
      state.sharedBg = keep.sharedBg; state.sharedStill = keep.sharedStill; sc0.bg = keep.bg; state.backdrop = keep.backdrop;
    }
  }
} catch (_) { /* never block the launch */ }
/* Reopen what you were working on. "Start new" (in the note that says so)
   keeps the old design under Saved designs and starts clean, as before. */
let restoredOnLoad = false;
let launchedClean = false;
try {
  const fresh = sessionStorage.getItem('askruth.backdrop-studio.start-new');
  sessionStorage.removeItem('askruth.backdrop-studio.start-new');
  if (fresh || state.pristine || !hasContent(snapshot())) { startClean(); launchedClean = true; }
  else restoredOnLoad = true;
} catch (e) { try { if (localStorage.getItem(STORAGE_KEY)) console.warn("[load] the saved design could not be restored:", e && e.message); } catch (_) {} startClean(); launchedClean = true; }
// safe-area guides are on by default now; switch them on once for older saves
try {
  if (!localStorage.getItem('askruth.backdrop-studio.guides-on')) {
    state.guides = true;
    localStorage.setItem('askruth.backdrop-studio.guides-on', '1');
    save();
  }
} catch (_) {}
// paint the studio in the saved brand's colours before anything is drawn
document.documentElement.dataset.brand = state.brand;

Promise.all([
  ...NEEDED.map((f) => document.fonts.load(f).catch(() => {})),
  loadAssets(state.brand),
])
  .then(() => document.fonts.ready)
  .catch(() => {})
  .finally(async () => {
    // a clean start opens on the brand template (placed now: fonts and artwork are in)
    if (launchedClean && !BLANK_START) openTemplateDesign();
    await boot();
    wireV4();
    // the start screen: continue or create (tests open ?debug and go straight to the editor)
    setTimeout(fillBrandStills, 1500);   // the loaded brand's designs that never got a still
    // v3.7: coming back to the app always starts on Home (the design is saved and first under Recent)
    if (SHOW_HOME) openHome();
    else if (restoredOnLoad) {
      showToast('Restored your last design', 'Start new', openStartSheet, 9000);
      // …and steps aside at the first touch anywhere else (it sat over a phone's sheets)
      const away = (e) => { if (!e.target.closest || !e.target.closest('#undo-toast')) { hideToast(); document.removeEventListener('pointerdown', away, true); } };
      document.addEventListener('pointerdown', away, true);
    }
    // One more pass once late webfont bytes land.
    document.fonts.ready.then(() => { buildThumbs(); draw(); });
  });


/* ===== v4 · video import you can trust, and a design that never goes blank =====================
   See v4/media.js for the diagnosis. Nothing here edits a protected function: the import check
   sits in front of the file inputs (capture listeners), the decoder budget pauses clips the open
   design doesn't use, and the guard reports faults instead of failing silently. */
function v4Api() {
  return {
    STORAGE_KEY,
    state: () => state,
    showToast,
    draw,
    persistNow,
    canvas,
    busy: () => !!(recording || sequencing),
    afterImport: () => { try { showStorage(); } catch (_) {} },
  };
}
/* ===== v4.1 · Undo for every change, and Undo / Redo buttons =====================================
   Only some actions recorded an undo step before (about 40, mostly removals and moves). Now every
   change the design saves is one step: whenever the app writes the design, the state from before
   the change goes on the undo stack — quietly, no toast, and a slider drag counts once (the writes
   are settled for 450 ms). Moving between sections is not a step. Undo / Redo are buttons in the
   top bar and the full-screen bar, as well as ⌘Z / ⇧⌘Z. */
const HIST_MAX = 40;
const DEBUG_HIST = /[?&]debug\b/.test(location.search);
let histBase = null;          // the design as last settled (JSON)
let histApplying = false;     // an undo / redo is being applied: its own save is not a new step
let histTimer = 0;
const histJson = () => { try { return JSON.stringify(snapshot()); } catch (_) { return null; } };
// what counts as a change: everything but derived caches (sharedStill is a still the app keeps for itself)
const histCmp = (json) => { try { const o = JSON.parse(json); delete o.sharedStill; return JSON.stringify(o); } catch (_) { return json; } };
// after an undo / redo the app still tidies up for a moment (healing, thumbnails): wait until its saves go quiet
function histSettle() { clearTimeout(histTimer); histTimer = setTimeout(() => { histBase = histJson(); histApplying = false; syncUndoButtons(); }, 700); }
function histRecord() {
  if (histApplying) return;
  const cur = histJson();
  if (!cur || cur === histBase) return;
  if (histBase && histCmp(cur) === histCmp(histBase)) { histBase = cur; return; }   // only a cache moved
  if (histBase) {
    let prev = null; try { prev = JSON.parse(histBase); } catch (_) {}
    const sameSection = prev && prev.scene === state.scene;
    const top = undoStack[undoStack.length - 1];
    const already = top && histCmp(JSON.stringify(top.data)) === histCmp(histBase);   // pushUndo already kept this one
    if (prev && sameSection && !already) {
      if (DEBUG_HIST) { try { const c = JSON.parse(cur); (window.__histDiffs = window.__histDiffs || []).push(Object.keys(c).filter((k) => JSON.stringify(c[k]) !== JSON.stringify(prev[k]))); } catch (_) {} }
      undoStack.push({ what: 'Last change', data: prev });
      if (undoStack.length > HIST_MAX) undoStack.shift();
      redoStack.length = 0;
    }
  }
  histBase = cur;
  syncUndoButtons();
}
function syncUndoButtons() {
  for (const b of document.querySelectorAll('[data-hist="undo"]')) b.disabled = !undoStack.length;
  for (const b of document.querySelectorAll('[data-hist="redo"]')) b.disabled = !redoStack.length;
}
function wireHistory() {
  histBase = histJson();
  // your own next touch ends the settling after an undo / redo: what you do now is a new step
  const endSettle = (e) => {
    if (!histApplying) return;
    if (e.target && e.target.closest && e.target.closest('[data-hist], #undo-toast')) return;
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey)) return;
    clearTimeout(histTimer); histBase = histJson(); histApplying = false; syncUndoButtons();
  };
  for (const t of ['pointerdown', 'keydown']) document.addEventListener(t, endSettle, true);
  onPersistence((p) => { if (p.state !== 'saved') return; if (histApplying) { histSettle(); return; } clearTimeout(histTimer); histTimer = setTimeout(histRecord, 450); });
  const ICON_UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const ICON_REDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const make = (kind, cls) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.dataset.hist = kind;
    const label = kind === 'undo' ? 'Undo' : 'Redo';
    const keys = kind === 'undo' ? (mac ? '⌘Z' : 'Ctrl+Z') : (mac ? '⇧⌘Z' : 'Ctrl+Shift+Z');
    b.setAttribute('aria-label', label); b.title = `${label} (${keys})`;
    b.innerHTML = kind === 'undo' ? ICON_UNDO : ICON_REDO;
    b.addEventListener('click', () => (kind === 'undo' ? undoLast() : redoLast()));
    return b;
  };
  // top bar: first in the right-hand group (the toast sits over the middle of the bar), before New project
  const first = $('#btn-new-proj') || $('#btn-save-proj');
  if (first) {
    const g = document.createElement('div'); g.className = 'hist-btns'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Undo and redo');
    g.append(make('undo', 'hist-btn'), make('redo', 'hist-btn'));
    first.before(g);
  }
  // full-screen bar (desktop full screen and the phone editor): after Add
  const add = $('#fs-add-section');
  if (add) { const u = make('undo', 'fs-btn hist-fs'), r = make('redo', 'fs-btn hist-fs'); add.after(u, r); }
  syncUndoButtons();
}

/* ===== v4.1 · Captions (reels) ==================================================================
   One caption track for the whole reel, timed on the film clock: type lines (one at the playhead),
   paste a script (spread by word count), or import an .srt / .vtt. Four brand styles, a size and a
   position. Drawn after everything else on the live canvas, so the preview and the exported video
   match; still exports and thumbnails leave them out. Automatic captions from the audio are Release 2. */
function capBrand() {
  const b = activeBrand();
  const plate = b.textBadge || { fill: '#1a1915', ink: '#ffffff' };
  const btn = (b.cta && b.cta.button) || { bg: '#ffffff', ink: '#000000' };
  const head = (b.type && b.type.h1) || (b.cta && b.cta.bold) || { family: 'Poppins, sans-serif', weight: 700 };
  return { headFamily: head.family, headWeight: head.weight || 800, bodyFamily: 'Poppins, system-ui, sans-serif',
    plateFill: plate.fill, plateInk: plate.ink, btnBg: btn.bg, btnInk: btn.ink };
}
const capState = () => state.captions || null;
function drawCaptions(ctx, W, H) {
  const c = capState();
  if (!c || !c.on || !c.cues || !c.cues.length || state.contentType === 'carousel') return;
  if (!(recording || ctx.canvas === canvas)) return;
  const clock = filmClock();
  const cue = cueAt(c.cues, clock == null ? playT : clock);
  if (cue) drawCaption(ctx, W, H, cue.text, c, capBrand());
}
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
function capEdit(fn, live = false) {
  if (!state.captions) state.captions = captionDefaults();
  fn(state.captions);
  state.captions.cues.sort((a, b) => a.start - b.start);
  if (!live) save();
  draw();
  if (!live) renderCaptions();
}
function capPop() {
  let p = $('#cap-pop');
  if (p) return p;
  p = document.createElement('section');
  p.id = 'cap-pop'; p.className = 'cap-pop'; p.hidden = true;
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Captions');
  p.innerHTML = `
    <div class="cap-head"><h2>Captions</h2>
      <label class="switch cap-on"><input type="checkbox" id="cap-on"><span class="track" aria-hidden="true"></span><span class="sr-only">Show captions</span></label>
      <button type="button" class="cap-close" id="cap-close" aria-label="Close">×</button></div>
    <span class="lbl lbl-sub">Style</span>
    <div class="segments cap-styles" id="cap-styles" role="radiogroup" aria-label="Caption style">${CAPTION_STYLES.map((x) => `<button type="button" role="radio" data-s="${x.id}" aria-checked="false"><i class="cap-sw cap-sw-${x.id}" aria-hidden="true">Aa</i>${x.name}</button>`).join('')}</div>
    <div class="cap-row"><span class="lbl lbl-sub">Size</span><input type="range" id="cap-size" min="0.6" max="1.8" step="0.05"><output id="cap-size-out"></output></div>
    <span class="lbl lbl-sub">Position</span>
    <div class="segments segments-sm cap-pos" id="cap-pos" role="radiogroup" aria-label="Caption position">${CAPTION_POS.map((x) => `<button type="button" role="radio" data-p="${x.id}" aria-checked="false">${x.name}</button>`).join('')}</div>
    <div class="cap-lines-head"><span class="lbl lbl-sub">Lines</span><span class="micro" id="cap-count"></span></div>
    <ol class="cap-lines" id="cap-lines"></ol>
    <div class="cap-acts">
      <button type="button" class="btn btn-ghost" id="cap-add">+ Line at the playhead</button>
      <button type="button" class="btn btn-ghost" id="cap-script">Paste a script</button>
      <button type="button" class="btn btn-ghost" id="cap-import">Import .srt / .vtt</button>
      <button type="button" class="btn btn-ghost" id="cap-download">Download .srt</button>
      <input type="file" id="cap-file" accept=".srt,.vtt,text/vtt,application/x-subrip" hidden>
    </div>
    <div class="cap-script" id="cap-script-box" hidden>
      <textarea id="cap-script-text" rows="5" placeholder="Paste or type the words. Each sentence or line becomes a caption, spread over the reel by length."></textarea>
      <div class="cap-acts"><button type="button" class="btn btn-ghost" id="cap-script-cancel">Cancel</button><button type="button" class="btn btn-primary" id="cap-script-go">Make captions</button></div>
    </div>
    <p class="micro">Automatic captions from the video’s sound come with Release 2.</p>`;
  document.body.append(p);
  const close = () => { p.hidden = true; };
  $('#cap-close').addEventListener('click', close);
  p.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $('#cap-on').addEventListener('change', (e) => capEdit((c) => { c.on = e.target.checked; }));
  for (const b of p.querySelectorAll('#cap-styles button')) b.addEventListener('click', () => capEdit((c) => { c.style = b.dataset.s; }));
  for (const b of p.querySelectorAll('#cap-pos button')) b.addEventListener('click', () => capEdit((c) => { c.pos = b.dataset.p; }));
  $('#cap-size').addEventListener('input', (e) => { capEdit((c) => { c.scale = Number(e.target.value); }, true); $('#cap-size-out').textContent = `${Math.round(Number(e.target.value) * 100)}%`; });
  $('#cap-size').addEventListener('change', () => { save(); });
  $('#cap-add').addEventListener('click', () => {
    const total = timelineSecs();
    const t0 = Math.min(Math.max(0, playT), Math.max(0, total - 0.5));
    const id = Date.now().toString(36);
    capEdit((c) => { c.on = true; c.cues.push({ id, start: Math.round(t0 * 10) / 10, end: Math.round(Math.min(total, t0 + 2) * 10) / 10, text: '' }); });
    const inp = p.querySelector(`.cap-line[data-id="${id}"] .cap-text`); if (inp) inp.focus();
  });
  $('#cap-script').addEventListener('click', () => { $('#cap-script-box').hidden = false; $('#cap-script-text').focus(); });
  $('#cap-script-cancel').addEventListener('click', () => { $('#cap-script-box').hidden = true; });
  $('#cap-script-go').addEventListener('click', () => {
    const cues = cuesFromScript($('#cap-script-text').value, timelineSecs());
    if (!cues.length) { showToast('Nothing to turn into captions', null, null, 2000); return; }
    capEdit((c) => { c.on = true; c.cues = cues.map((x, i) => ({ id: `${Date.now().toString(36)}${i}`, ...x })); });
    $('#cap-script-box').hidden = true; $('#cap-script-text').value = '';
    showToast(`${cues.length} captions made from the script`, null, null, 2600);
  });
  $('#cap-import').addEventListener('click', () => $('#cap-file').click());
  $('#cap-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    let cues = [];
    try { cues = parseCues(await f.text()); } catch (_) {}
    if (!cues.length) { showToast('No captions found in that file — it needs .srt or .vtt timings', null, null, 3500); return; }
    const total = timelineSecs();
    const late = cues.filter((x) => x.start >= total).length;
    capEdit((c) => { c.on = true; c.cues = cues.map((x, i) => ({ id: `${Date.now().toString(36)}${i}`, ...x })); });
    showToast(late ? `${cues.length} captions imported · ${late} start after the reel ends (${fmtT(total)})` : `${cues.length} captions imported`, null, null, 3500);
  });
  $('#cap-download').addEventListener('click', () => {
    const c = capState();
    if (!c || !c.cues.length) { showToast('No captions yet', null, null, 1800); return; }
    const url = URL.createObjectURL(new Blob([toSrt(c.cues)], { type: 'application/x-subrip' }));
    const a = document.createElement('a'); a.href = url; a.download = 'captions.srt'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  // the line list: edit in place, tap a time to jump there
  const list = $('#cap-lines');
  list.addEventListener('input', (e) => {
    const row = e.target.closest('.cap-line'); if (!row) return;
    const cue = capState().cues.find((x) => x.id === row.dataset.id); if (!cue) return;
    if (e.target.classList.contains('cap-text')) { cue.text = e.target.value; draw(); }
  });
  list.addEventListener('change', (e) => {
    const row = e.target.closest('.cap-line'); if (!row) return;
    capEdit((c) => {
      const cue = c.cues.find((x) => x.id === row.dataset.id); if (!cue) return;
      if (e.target.classList.contains('cap-start')) cue.start = Math.max(0, Number(e.target.value) || 0);
      if (e.target.classList.contains('cap-end')) cue.end = Math.max(cue.start + 0.2, Number(e.target.value) || 0);
      if (cue.end <= cue.start) cue.end = Math.round((cue.start + 1) * 10) / 10;
    });
  });
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.cap-line'); if (!row) return;
    if (e.target.closest('.cap-del')) { capEdit((c) => { c.cues = c.cues.filter((x) => x.id !== row.dataset.id); }); return; }
    if (e.target.closest('.cap-jump')) { const cue = capState().cues.find((x) => x.id === row.dataset.id); if (cue) { seek(cue.start + 0.01); draw(); } }
  });
  return p;
}
function renderCaptions() {
  const p = $('#cap-pop'); if (!p || p.hidden) return;
  const c = capState() || captionDefaults();
  const cb = capBrand();
  p.style.setProperty('--plate-fill', cb.plateFill); p.style.setProperty('--plate-ink', cb.plateInk);
  p.style.setProperty('--cap-btn-bg', cb.btnBg); p.style.setProperty('--cap-btn-ink', cb.btnInk); p.style.setProperty('--cap-head', cb.headFamily);
  $('#cap-on').checked = !!(state.captions && c.on);
  for (const b of p.querySelectorAll('#cap-styles button')) b.setAttribute('aria-checked', String(b.dataset.s === c.style));
  for (const b of p.querySelectorAll('#cap-pos button')) b.setAttribute('aria-checked', String(b.dataset.p === c.pos));
  $('#cap-size').value = c.scale; $('#cap-size-out').textContent = `${Math.round(c.scale * 100)}%`;
  $('#cap-count').textContent = c.cues.length ? `${c.cues.length} · reel ${fmtT(timelineSecs())}` : '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const focusId = document.activeElement && document.activeElement.closest && document.activeElement.closest('.cap-line') ? document.activeElement.closest('.cap-line').dataset.id : null;
  $('#cap-lines').innerHTML = c.cues.length ? c.cues.map((x) => `<li class="cap-line" data-id="${x.id}">
      <button type="button" class="cap-jump" aria-label="Jump to ${fmtT(x.start)}" title="Show this moment">▶</button>
      <input class="cap-start" type="number" step="0.1" min="0" value="${x.start}" aria-label="Starts at (seconds)">
      <span class="cap-dash" aria-hidden="true">–</span>
      <input class="cap-end" type="number" step="0.1" min="0" value="${x.end}" aria-label="Ends at (seconds)">
      <input class="cap-text" type="text" value="${esc(x.text)}" placeholder="Type the caption" aria-label="Caption text">
      <button type="button" class="cap-del" aria-label="Remove this line">×</button></li>`).join('')
    : '<li class="cap-empty micro">No lines yet. Add one at the playhead, paste a script, or import a file.</li>';
  if (focusId) { const el = p.querySelector(`.cap-line[data-id="${focusId}"] .cap-text`); if (el) el.focus(); }
}
function openCaptions() {
  if (state.contentType === 'carousel') return;
  if (!state.captions) { state.captions = captionDefaults(); }
  const p = capPop();
  p.hidden = false;
  renderCaptions();
  $('#cap-close').focus();
}
function wireCaptions() {
  const prev = renderHooks.afterAll;
  renderHooks.afterAll = (ctx, W, H, st, opts) => { if (prev) prev(ctx, W, H, st, opts); drawCaptions(ctx, W, H); };
  onPersistence(() => { if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#cap-pop')) renderCaptions(); });
}

/* v4.1 · Header tips: the top bar is icons only; each says what it does on hover / keyboard focus.
   The native title tooltip is removed so there is only one, quicker, styled label. */
const HEADER_TIPS = {
  '#burger': 'Projects', '#btn-new-proj': 'New project', '#btn-save-proj': 'Save a named copy', '#btn-present': 'Preview',
  '.tb-content-btn[data-type="video"]': 'Reel', '.tb-content-btn[data-type="carousel"]': 'Carousel',
  '.brand-area': 'Switch brand', '.topbar-format': 'Size', '#btn-export': 'Export',
};
function wireHeaderTips() {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  for (const [sel, tip] of Object.entries(HEADER_TIPS)) for (const el of document.querySelectorAll(`.topbar ${sel}`)) { el.dataset.tip = tip; el.removeAttribute('title'); }
  for (const el of document.querySelectorAll('.topbar [data-hist]')) {
    el.dataset.tip = el.dataset.hist === 'undo' ? `Undo  ${mac ? '⌘Z' : 'Ctrl+Z'}` : `Redo  ${mac ? '⇧⌘Z' : 'Ctrl+Shift+Z'}`;
    el.removeAttribute('title');
  }
  const ex = $('#btn-export'); if (ex) delete ex.dataset.tip;   // it has its word
}

/* ===== v4.4 · Presentation (16:9), Slides from text, PowerPoint ==================================
   Behind FLAGS.presentation (off by default; ?ff=presentation turns it on for a visit, see FLAGS).
   - Presentation is a LAYOUT format: a Carousel at 16:9 (1920 × 1080), the same workspace, slides,
     editor, Undo and saving. PowerPoint (.pptx) is an EXPORT format, offered for it in Export.
   - Slides from text: the user's own text → a deterministic storyboard (v4/storyboard.js, no AI)
     → brand slides laid out by the app's own layout engine → checked → previewed → applied as one
     Undo step (added after the slides, or replacing them). Nothing is applied automatically.
   - Fit order: wrap in the region → another template with more room → continuation slides at a
     paragraph, then a sentence → smaller type, never below DECK.minPx → a clear failure.
   Geometry is never typed in here: positions come from the brand template and the app's column
   layout (arrangeColumn / fitLayout) for the canvas size and its safe area. */

/** Layout-specific settings that are NOT brand values (those come from brands.js and the brand
    template). Inferred defaults, documented here in one place. */
const DECK = {
  // starting type scale per slide kind (1 = the brand's own size)
  scale: { title: { h1: 1.25, body: 1.05 }, point: { h1: 1.1, body: 1.05 }, list: { h1: 1.05, body: 1 }, image: { h1: 1, body: 0.95 }, cta: { h1: 1.15, body: 1 } },
  // presentation type is read from across a room: it starts larger (the fit steps it down if needed)
  boost: { '16x9': 1.35 },
  // which brand template slide each kind starts from (hook = logo + headline, value, cta = button)
  proto: { title: 'hook', point: 'value', list: 'value', image: 'value', cta: 'cta' },
  // when a kind doesn't fit: the template with more room it tries next
  fallback: { title: ['point'], point: [], list: [], image: ['point'], cta: [] },
  // smallest readable type, as a share of the canvas's short side (1080 → 45 px header, 28 px body)
  minPx: { h1: 0.042, body: 0.026 },
  // the most body lines one slide carries before it continues on the next (readability, not room)
  maxLines: { '16x9': 9, default: 12 },
  step: 0.06,               // type steps down 6 % at a time
  logoClear: 0.02,          // clear space round a logo or badge, share of the short side
  maxSlides: STORYBOARD_LIMITS.maxSlides,
};

// function declarations (hoisted): the size label is drawn while a saved design loads, long
// before this part of the file has run
function isPresentation(st = state) { return FLAGS.presentation && st.contentType === 'carousel' && st.format === '16x9'; }
function sizeNameOf(k, type) { return FLAGS.presentation && type === 'carousel' && k === '16x9' ? 'Presentation' : SIZE_NAMES[k]; }

const deckId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const slideId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/** What a generated slide holds — when it changes, the slide counts as edited and is kept. */
const genSig = (sc) => JSON.stringify([sc.h1 || '', sc.body || '', (sc.buttons || []).map((b) => b.text), (sc.media || []).length, (sc.blocks || []).length, sc.h1Scale, sc.bodyScale]);

/** The brand template's three slides (hook, value, cta), as plain scene objects. */
function deckProtos(fmt) {
  const recipe = templateRecipe();
  if (!recipe) return null;
  const d = proposalData(recipe, { format: fmt, contentType: 'carousel' });
  const by = {};
  for (const sc of d.scenes || []) if (!by[sc.role]) by[sc.role] = sc;
  return by.hook && by.value && by.cta ? by : null;
}

/** A slide from a storyboard piece, on the brand template for its kind. */
function deckSlide(protos, kind, piece, sc0) {
  const proto = protos[DECK.proto[kind]] || protos.value;
  const sc = clone(proto);
  sc.id = slideId();
  sc.on = true;
  sc.h1 = piece.heading || '';
  sc.body = piece.body || '';
  sc.visibility = 'both';
  sc.textMode = 'both';
  sc.h1Scale = sc0.h1;
  sc.bodyScale = sc0.body;
  sc.blocks = []; sc.media = []; sc.badges = []; sc.drawings = [];
  sc.manual = false; sc.locked = false;
  delete sc.locks; delete sc.edited; delete sc.auto; delete sc.trans;
  if (kind === 'cta') {
    const b = (proto.buttons || [])[0];
    sc.buttons = b && piece.button ? [{ ...clone(b), id: `b${Math.random().toString(36).slice(2, 8)}`, text: piece.button }] : [];
  } else sc.buttons = [];
  if (kind === 'image' && piece.image && piece.image.ref && mediaFor(piece.image.ref)) {
    sc.inset = { id: piece.image.ref, scale: 1, radius: 0.14, hidden: false };
  } else sc.inset = NO_CARD();
  sc.bg = null; sc.overlay = null;   // the project's own background, like any new slide
  return sc;
}

/** Place slide sc at fmt (the app's column layout), then check it. Runs in a sandbox. */
function deckPlace(sc, fmt) {
  return inSandbox(() => {
    state.scenes = [...clone(state.scenes), sc];
    const k = state.scenes.length - 1;
    state.format = fmt;
    state.scene = k;
    state.contentType = 'carousel';
    loadScene(k);
    const { w: W, h: H } = FORMATS[fmt];
    state.pos[fmt] = clone((sc.pos && sc.pos[fmt]) || DEFAULT_POS[fmt] || DEFAULT_POS['9x16']);
    arrangeColumn(W, H, sc.role);
    fitLayoutRaw(W, H);
    sc.pos = sc.pos || {};
    sc.pos[fmt] = clone(state.pos[fmt]);
    for (const live of state.buttons || []) {
      const own = (sc.buttons || []).find((x) => x.id === live.id);
      if (own) { own.x = live.x; own.y = live.y; own.tpl = own.tpl || {}; own.tpl[fmt] = { x: live.x, y: live.y }; own.at = own.at || {}; own.at[fmt] = { x: live.x, y: live.y }; }
    }
    return deckCheck(layout(ctx, state, W, H), W, H, fmt);
  });
}

/** The checks every generated slide has to pass (calculated geometry; tests also check pixels). */
function deckCheck(L, W, H, fmt) {
  const sa = safeArea(fmt, W, H);
  const short = Math.min(W, H);
  const issues = [];
  const tol = 2;
  const fg = [];
  const add = (k, r, what) => { if (r && r.w > 0 && r.h > 0) fg.push({ k, r, what }); };
  add('text', multiRect('text', L), 'Text');
  for (const x of L.extras || []) add(`xb:${x.id}`, multiRect(`xb:${x.id}`, L), 'Text box');
  for (const b of L.buttons || []) add(`bt:${b.id}`, { ...b.rect }, 'Button');
  add('inset', multiRect('inset', L), 'Picture');
  for (const m of L.media || []) add(`md:${m.id}`, multiRect(`md:${m.id}`, L), 'Picture');
  add('watermark', multiRect('watermark', L), 'Logo');
  for (const b of L.xbadges || []) add(`eb:${b.id}`, { ...b.rect }, 'Badge');
  // inside the safe area
  for (const o of fg) {
    if (o.r.x < sa.x - tol || o.r.y < sa.y - tol || o.r.x + o.r.w > sa.x + sa.w + tol || o.r.y + o.r.h > sa.y + sa.h + tol) issues.push({ code: 'bounds', what: o.what });
  }
  // no foreground overlaps (a logo also keeps its clear space)
  const clear = short * DECK.logoClear;
  for (let a = 0; a < fg.length; a++) for (let b = a + 1; b < fg.length; b++) {
    const A = fg[a].r, B = fg[b].r;
    const logo = fg[a].k === 'watermark' || fg[b].k === 'watermark' || fg[a].k.startsWith('eb:') || fg[b].k.startsWith('eb:');
    const m = logo ? clear : 0;
    if (A.x < B.x + B.w + m - tol && B.x < A.x + A.w + m - tol && A.y < B.y + B.h + m - tol && B.y < A.y + A.h + m - tol) issues.push({ code: logo ? 'logo-clear' : 'overlap', what: `${fg[a].what} / ${fg[b].what}` });
  }
  // every line fits its column (a long link or compound word can't wrap)
  const tx = L.tx;
  if (tx && !tx.empty && !tx.cta) {
    const inner = L.txRect.w - (tx.pad || 0) * 2 + tol;
    for (const [lines, f, hang] of [[tx.h1Lines, tx.f.h1, tx.h1Hang], [tx.bodyLines, tx.f.body, tx.bodyHang]]) {
      ctx.font = f.css(f.size);
      for (const l of lines || []) if (ctx.measureText(l.text).width + (l.hang ? hang : 0) > inner) { issues.push({ code: 'line-too-long', what: l.text.split(/\s+/).sort((x, y) => y.length - x.length)[0] }); break; }
    }
    const maxL = DECK.maxLines[fmt] || DECK.maxLines.default;
    const bodyN = (tx.bodyLines || []).filter((l) => l.text).length;
    if (bodyN > maxL) issues.push({ code: 'dense', what: `${bodyN} lines`, soft: true });
    if (tx.h1Lines.length && tx.f.h1.size < short * DECK.minPx.h1 - 0.5) issues.push({ code: 'min-size', what: 'Header' });
    if (tx.bodyLines.length && tx.f.body.size < short * DECK.minPx.body - 0.5) issues.push({ code: 'min-size', what: 'Body' });
  }
  // ok: passes every check · hard: passes every check that is a rule (density is a preference:
  // it asks for a continuation slide, but smaller type never has to meet it)
  return { ok: !issues.length, hard: !issues.some((x) => !x.soft), issues, rects: fg.map((o) => ({ k: o.k, ...o.r })), sa };
}

/** Lowest type scale allowed for this format (so the header/body stay ≥ DECK.minPx). */
function deckMinScale(fmt) {
  const { w: W, h: H } = FORMATS[fmt];
  const S = unitOf(W, H);
  const f = baseTypeSizes();
  const short = Math.min(W, H);
  return { h1: (short * DECK.minPx.h1) / (f.h1 * S), body: (short * DECK.minPx.body) / (f.body * S) };
}

/** Storyboard → slides that pass every check at fmt, or a clear failure. */
function planDeck(input, opts = {}) {
  const fmt = opts.format || state.format;
  const maxSlides = Math.max(1, Math.min(DECK.maxSlides, opts.maxSlides || DECK.maxSlides));
  const sb = prepareStoryboard(input, { maxSlides });
  if (!sb.ok) return { ok: false, error: sb.error, notes: sb.notes, slides: [], reports: [] };
  commitScene();
  const protos = deckProtos(fmt);
  if (!protos) return { ok: false, error: { code: 'no-template', message: 'This brand has no slide template to lay text out on.' }, notes: sb.notes, slides: [], reports: [] };
  const min = deckMinScale(fmt);
  const notes = [...sb.notes];
  const slides = [], reports = [];
  const boost = DECK.boost[fmt] || 1;
  const startOf = (kind) => { const s = DECK.scale[kind] || DECK.scale.point; return { h1: s.h1 * boost, body: s.body * boost }; };
  const tryOne = (kind, piece) => {
    const s0 = startOf(kind);
    const sc = deckSlide(protos, kind, piece, s0);
    return { sc, r: deckPlace(sc, fmt) };
  };
  const shrink = (kind, piece) => {
    const s0 = startOf(kind);
    for (let k = 1 - DECK.step; ; k -= DECK.step) {
      const sc0 = { h1: Math.max(min.h1, s0.h1 * k), body: Math.max(min.body, s0.body * k) };
      const sc = deckSlide(protos, kind, piece, sc0);
      const r = deckPlace(sc, fmt);
      if (r.hard) return { sc, r, scale: sc0 };
      if (sc0.h1 <= min.h1 && sc0.body <= min.body) return { sc, r, fail: true };
    }
  };
  const fits = (kind, piece) => {
    for (const kd of [kind, ...(DECK.fallback[kind] || [])]) { const t = tryOne(kd, piece); if (t.r.ok) return { ...t, kind: kd }; }
    return null;
  };
  for (const it of sb.items) {
    const paras = it.paragraphs.slice();
    const whole = { heading: it.heading, body: bodyOf(paras), button: it.button, image: it.image };
    // 1 · wrap · 2 · another template
    let got = fits(it.kind, whole);
    if (got) { slides.push(markGen(got.sc, it, 0)); reports.push({ src: it.id, kind: got.kind, ...got.r }); continue; }
    // 3 · continuation slides at paragraphs, then sentences (the heading stays on the first, the button on the last)
    const units = paras.length > 1 ? paras.map((t, j) => ({ t, sep: j ? sepBetween(paras[j - 1], t) : '' })) : paras.flatMap((p) => sentencesOf(p).map((t, j) => ({ t, sep: j ? ' ' : '' })));
    const chunks = [];
    let cur = [];
    // a continuation slide repeats its heading (the user's own words) so it reads on its own
    const pieceOf = (us, first, last) => ({ heading: it.heading, body: us.map((u, j) => (j ? u.sep : '') + u.t).join(''), button: last ? it.button : null, image: first ? it.image : null });
    const kindFor = (first, last) => (last && it.button ? 'cta' : first ? it.kind === 'cta' ? 'point' : it.kind : (it.kind === 'list' ? 'list' : 'point'));
    let split = units.length > 1;
    for (let u = 0; split && u < units.length; u++) {
      const test = [...cur, units[u]];
      const first = !chunks.length;
      if (fits(kindFor(first, false), pieceOf(test, first, false))) { cur = test; continue; }
      if (!cur.length) { split = false; break; }      // one unit alone doesn't fit: smaller type instead
      chunks.push(cur); cur = [units[u]];
    }
    if (split && cur.length) chunks.push(cur);
    if (split && chunks.length > 1) {
      // the last chunk carries the button: re-check it with the button, moving units back if needed
      let okAll = true;
      const made = [];
      chunks.forEach((c, j) => {
        const first = j === 0, last = j === chunks.length - 1;
        const kd = kindFor(first, last);
        const g = fits(kd, pieceOf(c, first, last)) || shrink(kd, pieceOf(c, first, last));
        if (!g || g.fail) okAll = false;
        made.push({ g, kd, j });
      });
      if (okAll) {
        for (const { g, kd, j } of made) { slides.push(markGen(g.sc, it, j)); reports.push({ src: it.id, kind: g.kind || kd, cont: j > 0, ...g.r }); }
        notes.push(`“${(it.heading || paras[0] || '').slice(0, 40)}” continues over ${chunks.length} slides.`);
        continue;
      }
    }
    // 4 · smaller type, within the readable minimum
    const sh = shrink(it.kind, whole);
    if (!sh.fail) { slides.push(markGen(sh.sc, it, 0)); reports.push({ src: it.id, kind: it.kind, shrunk: sh.scale, ...sh.r }); continue; }
    // 5 · it can't be done: say what and where, change nothing
    const long = sh.r.issues.find((x) => x.code === 'line-too-long');
    return {
      ok: false, notes, slides: [], reports,
      error: { code: long ? 'line-too-long' : 'no-fit', slide: slides.length + 1, message: long
        ? `Slide ${slides.length + 1}: “${long.what.slice(0, 48)}” is too long for one line at the smallest readable size. Shorten it, or break it with a space.`
        : `Slide ${slides.length + 1} doesn’t fit even at the smallest readable size. Split its text with a blank line or ---.` },
    };
  }
  if (slides.length > maxSlides) return { ok: false, notes, slides: [], reports, error: { code: 'max-slides', message: `That makes ${slides.length} slides; the limit is ${maxSlides}. Shorten the text or raise the limit in Advanced.` } };
  // nothing lost: every word of the source, in order
  const shown = slides.flatMap((sc) => [sc.gen && sc.gen.part > 0 ? '' : sc.h1, sc.body, ...(sc.buttons || []).map((b) => b.text)].map((t) => String(t || '').replace(/^- /gm, '')).join(' ').split(/\s+/).filter(Boolean));
  const want = sourceWords(sb.items);
  if (shown.join(' ') !== want.join(' ')) return { ok: false, notes, slides: [], reports, error: { code: 'content', message: 'Some text would have been lost laying this out, so nothing was changed.' } };
  // every other carousel size gets its own placement too (the slides follow a size change)
  for (const sc of slides) for (const f of CONTENT_FORMATS.carousel) if (f !== fmt) deckPlace(sc, f);
  for (const sc of slides) deckPlace(sc, fmt);
  for (const sc of slides) sc.gen.sig = genSig(sc);
  return { ok: true, format: fmt, slides, reports, notes, storyboard: sb.items, input: typeof input === 'string' ? input : JSON.stringify(input) };
}
function markGen(sc, it, part) { sc.gen = { src: it.id, part, kind: it.kind }; return sc; }

/** Apply a plan as ONE Undo step: added after the slides, or replacing them (Undo brings them back). */
function applyDeck(plan, mode = 'add') {
  if (!plan || !plan.ok || !plan.slides.length) return false;
  stopPlayback();
  if (editor) closeEditor(true);
  dropMulti();
  commitScene();
  pushUndo('Slides from text');
  const id = deckId();
  const slides = plan.slides.map((sc) => { const c = clone(sc); c.gen = { ...c.gen, deck: id }; return c; });
  let at;
  if (mode === 'replace') {
    // the first slide becomes the base: the project's shared background stays the background
    state.scenes = slides;
    at = 0;
  } else if (mode === 'regen') {
    // the slides made from text before, unless edited since, are replaced in place
    const keep = state.scenes.filter((sc) => !(sc.gen && sc.gen.deck === (state.deck && state.deck.id) && sc.gen.sig === genSig(sc)));
    at = Math.max(0, state.scenes.findIndex((sc) => sc.gen && sc.gen.deck === (state.deck && state.deck.id)));
    const before = keep.slice(0, Math.min(at, keep.length));
    state.scenes = [...before, ...slides, ...keep.slice(before.length)];
  } else {
    at = state.scenes.length;
    state.scenes = [...state.scenes, ...slides];
  }
  state.deck = { v: 1, id, input: plan.input, format: plan.format, made: Date.now(), count: slides.length };
  if (state.contentType !== 'carousel') setContentType('carousel');
  state.scene = Math.min(at, state.scenes.length - 1);
  loadScene(state.scene);
  try { autoTimes(); } catch (_) {}
  save();
  renderScenes();
  syncSectionValues(true);
  draw();
  showToast(`${slides.length} ${slides.length === 1 ? 'slide' : 'slides'} from your text`, 'Undo', undoLast, 8000);
  return true;
}

/** Small previews of planned slides, drawn by the app's renderer (in a sandbox). */
function deckThumbs(plan, w = 160) {
  const { w: W, h: H } = FORMATS[plan.format];
  const h = Math.round((w * H) / W);
  return inSandbox(() => {
    const base = clone(state.scenes);
    state.format = plan.format;
    return plan.slides.map((sc) => {
      state.scenes = [...base, clone(sc)];
      const k = state.scenes.length - 1;
      state.scene = k;
      loadScene(k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      render(cv.getContext('2d'), w, h, state, {});
      return cv.toDataURL('image/png');
    });
  });
}

/* --- the dialog: one action, content first, defaults, Advanced folded away --------------------- */
let deckPop = null, deckPlan = null;
function openDeck() {
  if (!FLAGS.presentation) return;
  if (!deckPop) {
    deckPop = document.createElement('div');
    deckPop.className = 'save-pop deck-pop';
    deckPop.id = 'deck-pop';
    deckPop.setAttribute('role', 'dialog');
    deckPop.setAttribute('aria-modal', 'true');
    deckPop.setAttribute('aria-labelledby', 'deck-title');
    deckPop.hidden = true;
    deckPop.innerHTML = `
      <h2 class="save-pop-title" id="deck-title">Slides from text</h2>
      <p class="save-pop-sub" id="deck-sub"></p>
      <label class="deck-label" for="deck-text">Your text</label>
      <textarea id="deck-text" rows="9" spellcheck="true" placeholder="# A heading starts a slide&#10;A paragraph under it.&#10;&#10;---&#10;## Next slide&#10;- A list item&#10;- Another&#10;&#10;## Get in touch&#10;Button: Book a call"></textarea>
      <details class="deck-adv" id="deck-adv"><summary>Advanced</summary>
        <label class="deck-row">Most slides <input type="number" id="deck-max" min="1" max="${DECK.maxSlides}" value="${DECK.maxSlides}"></label>
        <p class="micro">Headings (#), lines of --- and “Button: …” shape the slides. Your words are kept exactly; nothing is written for you.</p>
      </details>
      <div class="deck-preview" id="deck-preview" aria-live="polite"></div>
      <p class="upload-error" id="deck-error" hidden></p>
      <ul class="deck-notes" id="deck-notes"></ul>
      <div class="deck-mode" id="deck-mode" role="radiogroup" aria-label="Where the slides go"></div>
      <div class="save-pop-actions">
        <button class="link-btn" id="deck-cancel" type="button">Cancel</button>
        <span class="deck-acts"><button class="btn" id="deck-go-preview" type="button">Preview</button>
        <button class="btn btn-primary" id="deck-apply" type="button" disabled>Add slides</button></span>
      </div>`;
    const scrim = document.createElement('div');
    scrim.className = 'burger-scrim'; scrim.id = 'deck-scrim'; scrim.hidden = true;
    document.body.append(scrim, deckPop);
    scrim.addEventListener('click', closeDeck);
    deckPop.querySelector('#deck-cancel').addEventListener('click', closeDeck);
    deckPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDeck(); } });
    deckPop.querySelector('#deck-go-preview').addEventListener('click', previewDeck);
    deckPop.querySelector('#deck-text').addEventListener('input', () => { deckPlan = null; syncDeck(); });
    deckPop.querySelector('#deck-apply').addEventListener('click', () => {
      if (!deckPlan || !deckPlan.ok) return;
      const mode = (deckPop.querySelector('#deck-mode input:checked') || {}).value || 'add';
      const plan = deckPlan;
      closeDeck();
      applyDeck(plan, mode);
    });
  }
  const ta = deckPop.querySelector('#deck-text');
  if (!ta.value && state.deck && state.deck.input) ta.value = state.deck.input;
  deckPlan = null;
  syncDeck();
  deckPop.hidden = false;
  $('#deck-scrim').hidden = false;
  ta.focus({ preventScroll: true });
}
function closeDeck() {
  if (!deckPop || deckPop.hidden) return;
  deckPop.hidden = true;
  $('#deck-scrim').hidden = true;
}
function syncDeck() {
  const fmt = state.format;
  const name = `${sizeNameOf(fmt, 'carousel')} ${fmt.replace('x', ':')}`;
  deckPop.querySelector('#deck-sub').textContent = `${activeBrand().name} · ${name} · ${FORMATS[fmt].sub}. You see the slides before anything changes.`;
  const prev = deckPop.querySelector('#deck-preview');
  const err = deckPop.querySelector('#deck-error');
  const notes = deckPop.querySelector('#deck-notes');
  const apply = deckPop.querySelector('#deck-apply');
  const modes = deckPop.querySelector('#deck-mode');
  if (!deckPlan) { prev.innerHTML = ''; err.hidden = true; notes.innerHTML = ''; modes.innerHTML = ''; apply.disabled = true; apply.textContent = 'Add slides'; return; }
  if (!deckPlan.ok) {
    prev.innerHTML = '';
    err.textContent = deckPlan.error.message; err.hidden = false;
    modes.innerHTML = ''; apply.disabled = true;
  } else {
    err.hidden = true;
    prev.innerHTML = `<p class="deck-count">${deckPlan.slides.length} ${deckPlan.slides.length === 1 ? 'slide' : 'slides'}</p>`;
    const strip = document.createElement('div'); strip.className = 'deck-strip';
    deckThumbs(deckPlan).forEach((url, k) => { const f = document.createElement('figure'); f.innerHTML = `<img alt="Slide ${k + 1}" src="${url}"><figcaption>${k + 1}</figcaption>`; strip.append(f); });
    prev.append(strip);
    const regenN = state.deck ? state.scenes.filter((sc) => sc.gen && sc.gen.deck === state.deck.id).length : 0;
    const opts = [['add', `Add after the ${state.scenes.length} ${state.scenes.length === 1 ? 'slide' : 'slides'} there`]];
    if (regenN) opts.push(['regen', `Replace the ${regenN} made from text before (edited ones stay)`]);
    opts.push(['replace', 'Replace all slides (Undo brings them back)']);
    modes.innerHTML = '';
    opts.forEach(([v, label], k) => { const l = document.createElement('label'); l.className = 'deck-opt'; l.innerHTML = `<input type="radio" name="deck-mode" value="${v}"${k === 0 ? ' checked' : ''}> <span>${label}</span>`; modes.append(l); });
    apply.disabled = false;
    apply.textContent = `Add ${deckPlan.slides.length} ${deckPlan.slides.length === 1 ? 'slide' : 'slides'}`;
  }
  notes.innerHTML = '';
  for (const n of deckPlan.notes || []) { const li = document.createElement('li'); li.textContent = n; notes.append(li); }
}
function previewDeck() {
  const ta = deckPop.querySelector('#deck-text');
  const max = Number(deckPop.querySelector('#deck-max').value) || DECK.maxSlides;
  try { deckPlan = planDeck(ta.value, { maxSlides: max }); }
  catch (e) { console.error('[deck]', e); deckPlan = { ok: false, error: { code: 'internal', message: 'These slides couldn’t be laid out. Nothing was changed.' }, notes: [] }; }
  syncDeck();
}

/* --- PowerPoint: the slides' resolved layout → editable .pptx (v4/pptx.js) --------------------- */
function rasterItem(i, id, W, H, type = 'image/png') {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  withSection(i, () => renderItem(cv.getContext('2d'), W, H, state, id));
  if (id === 'background') return { x: 0, y: 0, w: W, h: H, data: cv.toDataURL('image/jpeg', 0.92) };
  const b = inkBox(cv);
  if (!b) return null;
  const out = document.createElement('canvas');
  out.width = b.w; out.height = b.h;
  out.getContext('2d').drawImage(cv, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return { ...b, data: out.toDataURL(type) };
}
/** Canvas lines → PowerPoint paragraphs: a bullet starts one; wrapped lines are soft breaks. */
function parasOf(lines) {
  const out = [];
  for (const l of lines) {
    if (!out.length || l.bullet || (!l.hang && out[out.length - 1].bullet)) out.push({ lines: [], bullet: !!l.bullet });
    out[out.length - 1].lines.push(l.text);
  }
  return out;
}
function textItems(tx, R, colours, S, name) {
  const out = [];
  const look = tx.look;
  const brd = tx.brd || { h1: { w: 0 }, body: { w: 0 } };
  const lead = tx.h1Lines.length ? 'h1' : 'body';
  const card = look[lead] && look[lead].bg;
  const border = brd[lead] && brd[lead].w > 0 ? brd[lead] : null;
  if (card || border) {
    const i = border ? border.w / 2 : 0;
    out.push({ type: 'shape', name: `${name} card`, x: R.x - i, y: R.y - i, w: R.w + i * 2, h: tx.h + i * 2, radius: 36 * S + i, fill: card || null, line: border ? { colour: border.c, w: border.w } : null });
  }
  const part = (lines, f, top, dy, pad, colour, hang, w, h, nm) => {
    if (!lines.length) return;
    const { face, bold } = fontOf(f.css(f.size));
    out.push({ type: 'text', name: nm, x: R.x + pad, y: R.y + top + (dy || 0), w: Math.min(R.w - pad, w * TEXT_SLACK + hang), h, paras: parasOf(lines).map((p) => ({ ...p, indent: hang })),
      size: f.size, face, bold, colour, lineHeight: f.lh, lineSpacingPx: f.size * f.lh });
  };
  part(tx.h1Lines, tx.f.h1, tx.h1Top, tx.h1Dy, tx.padH1, colours.h1, tx.h1Lines.some((l) => l.hang) ? tx.h1Hang : 0, tx.h1W, tx.h1H, `${name} header`);
  part(tx.bodyLines, tx.f.body, tx.bodyTop, tx.bodyDy, tx.padBody, colours.body, tx.bodyLines.some((l) => l.hang) ? tx.bodyHang : 0, tx.bodyW, tx.bodyH, `${name} body`);
  return out;
}
/** A bold CTA (big action line, then its supporting line): native text, its box a shape. */
function ctaItems(tx, R, colours) {
  const out = [];
  const p = tx.pad || 0;
  const ink = tx.boxBg ? tx.boxInk : colours;
  if (tx.boxBg) out.push({ type: 'shape', name: 'CTA box', x: R.x, y: R.y, w: R.w, h: tx.h, radius: 36 * (p / 32), fill: tx.boxBg });
  const one = (lines, f, y, colour, nm) => {
    if (!lines.length) return;
    const { face, bold } = fontOf(f.css(f.size));
    const w = Math.max(...lines.map((l) => { ctx.font = f.css(f.size); return ctx.measureText(l.text).width; }));
    out.push({ type: 'text', name: nm, x: R.x + p, y, w: Math.min(R.w - p, w * TEXT_SLACK), h: lines.length * f.size * f.lh, paras: [{ lines: lines.map((l) => l.text), bullet: false }],
      size: f.size, face, bold, colour, lineSpacingPx: f.size * f.lh });
  };
  one(tx.big, tx.f, R.y + p, ink.h1, 'CTA action');
  if (tx.lines.length) one(tx.lines, tx.body, R.y + p + tx.bigH + (tx.bigH ? tx.gap : 0), ink.body, 'CTA line');
  return out;
}
/** The deck description for v4/pptx.js: per slide, its items in drawing order, in canvas px. */
async function pptxDeckOf(list = enabledScenes()) {
  commitScene();
  const f = FORMATS[state.format];
  const W = f.w, H = f.h;
  const slides = [];
  const rasters = [];
  for (const { i } of list) await masters(i);
  try { await document.fonts.ready; } catch (_) {}
  for (const { sc, i } of list) {
    const items = [];
    const R = (id, name) => { const r = rasterItem(i, id, W, H); if (r) { items.push({ type: 'image', name, ...r }); rasters.push(name); } };
    R('background', 'Background');
    const L = withSection(i, () => layout(ctx, state, W, H));
    const bd = withSection(i, () => ({ base: (state.adjust && state.adjust[state.backdrop] && state.adjust[state.backdrop].ground) || byId(state.backdrop).base, look: textLook(state, byId(state.backdrop)) }));
    if (L.ins.image) R('inset', 'Picture');
    for (const m of L.media || []) R(`md:${m.id}`, 'Picture');
    if (!L.tx.empty) {
      if (L.tx.cta === 'bold') items.push(...ctaItems(L.tx, L.txRect, withSection(i, () => ctaInk(state))));
      else if (L.tx.cta) R('text', 'CTA lettering');
      else items.push(...textItems(L.tx, L.txRect, { h1: (L.tx.look || bd.look).h1.text, body: (L.tx.look || bd.look).body.text }, L.S, 'Text'));
    }
    (L.extras || []).forEach((x, k) => {
      const look = x.tx.look || L.tx.look || bd.look;
      items.push(...textItems(x.tx, x.txRect, { h1: look.h1.text, body: look.body.text }, L.S, `Text box ${k + 2}`));
    });
    for (const b of L.buttons || []) {
      if (b.m.lux) { R(`bt:${b.id}`, `Button · ${b.m.text}`); continue; }
      const p = buttonPaint(b, bd.base);
      if (p.stroke && p.sw) items.push({ type: 'shape', name: `Button edge · ${b.m.text}`, x: b.rect.x - p.sw, y: b.rect.y - p.sw, w: b.m.bw + p.sw * 2, h: b.m.bh + p.sw * 2, radius: p.rad ? p.rad + p.sw : 0, fill: p.stroke });
      items.push({ type: 'shape', name: `Button · ${b.m.text}`, x: b.rect.x, y: b.rect.y, w: b.m.bw, h: b.m.bh, radius: p.rad, fill: p.fill });
      const { face, bold } = fontOf(b.m.css(b.m.fs));
      items.push({ type: 'text', name: `Button label · ${b.m.text}`, x: b.rect.x, y: b.rect.y, w: b.m.bw, h: b.m.bh, paras: [{ lines: [b.m.text], bullet: false }], size: b.m.fs, face, bold, colour: p.ink, lineHeight: 1.1, lineSpacingPx: b.m.fs * 1.1, align: 'center', valign: 'middle' });
    }
    if (L.wm.image) R('badge', 'Logo');
    (L.xbadges || []).forEach((b, k) => R(`eb:${b.id}`, `Badge ${k + 2}`));
    (L.drawings || []).forEach((d, k) => R(`dr:${d.id}`, `Drawing ${k + 1}`));
    slides.push({ items, name: sceneName(sc, i) });
  }
  mastersBack();
  return { W, H, title: titleOf(state), author: activeBrand().name, slides, rasters };
}
async function exportPptx(list = enabledScenes()) {
  const deck = await pptxDeckOf(list);
  const Pptx = await loadPptxGen();
  const pptx = await buildPptx(Pptx, deck);
  const blob = await writePptx(pptx, 'blob');
  const name = `${exportSlug()}-${deck.slides.length}-slides.pptx`;
  downloadBlob(blob, name);
  return { name, slides: deck.slides.length, bytes: blob.size };
}


const u8ToB64 = (u8) => { let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); return btoa(s); };
function wireDeck() {
  if (!FLAGS.presentation) return;
  document.documentElement.dataset.ff = 'presentation';
  const after = $('#adapt-btn') || $('#tidy-btn');
  if (after && !$('#deck-btn')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tidy-btn deck-btn'; b.id = 'deck-btn';
    b.innerHTML = '<span class="tidy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 9h7M7 12.5h10M9 20h6"/></svg></span><span>Slides from text<small>Paste your text · see the slides before anything changes</small></span>';
    after.after(b);
    b.addEventListener('click', () => openDeck());
  }
  if (new URLSearchParams(location.search).has('debug')) window.__deck = { flags: FLAGS, plan: (t, o) => planDeck(t, o), apply: (p, m) => applyDeck(p, m), open: openDeck, deckOf: () => pptxDeckOf(), exportPptx: () => exportPptx(), storyboard: (t) => prepareStoryboard(t), config: DECK,
    // for tools/deck (the command-line renderer): numbered PNGs, the .pptx and the resolved geometry
    pngs: async (scale = 1) => { const files = []; for (const { i } of enabledScenes()) await masters(i); await exportSlides('image/png', scale, files); mastersBack(); return files.map((f) => ({ name: f.name, w: f.w, h: f.h, b64: u8ToB64(f.data) })); },
    pptx: async () => { const d = await pptxDeckOf(); const P = await loadPptxGen(); const p = await buildPptx(P, d); return { b64: await writePptx(p, 'base64'), slides: d.slides.length, rasters: d.rasters }; },
    geometry: async () => { const d = await pptxDeckOf(); return { ...d, slides: d.slides.map((sl) => ({ ...sl, items: sl.items.map(({ data, ...it }) => it) })) }; },
    ink: (i, id) => { const cv = itemCanvas(i, id, 1, true); return cv ? inkBox(cv) : null; },
    check: () => { const f = FORMATS[state.format]; return deckCheck(layout(ctx, state, f.w, f.h), f.w, f.h, state.format); } };
}

let v4Wired = false;
function wireV4() {
  if (v4Wired) return;
  v4Wired = true;
  const api = v4Api();
  installFaultGuard(api);
  installImportGuard(api);
  installDecoderBudget(api, mediaFor);
  setTimeout(() => reportUnplayable(api, mediaFor), 1500);
  wireV4Nav();
  wireHistory();
  wireAppearance(document.querySelector('.topbar .hist-btns') || $('#btn-new-proj'));
  wireHeaderTips();
  wireCaptions();
  wireV4Adapt();
  wireDeck();
  if (new URLSearchParams(location.search).has('debug')) window.__v4 = { mediaFor, persistence, model: () => describeProject(state), scoped: (scope, label, fn) => scopedChange({ state: () => state, pushUndo, commitScene, save, draw, renderScenes }, scope, label, fn), plan: (f) => planAdapt(f), apply: (f) => applyAdapt(planAdapt(f), f || state.format) };
  // a background that can't be painted: the base colour stands in (render.js) and we say so once
  let told = 0;
  renderHooks.fault = (err, where) => {
    if (Date.now() - told < 20000) return;
    told = Date.now();
    showToast('This background couldn\u2019t be drawn, so its base colour is showing. Pick it again or choose another.', null, null, 9000);
  };
  // preview only: a clip whose picture this browser can't decode says so on the canvas
  const prevAfterBg = renderHooks.afterBackground;
  renderHooks.afterBackground = (g, W, H, st, opts) => {
    if (prevAfterBg) prevAfterBg(g, W, H, st, opts);
    if (g.canvas !== canvas) return;
    const m = st.backdrop && mediaFor(st.backdrop);
    if (!m || m.media !== 'video' || (m.w && m.h)) return;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = `600 ${Math.round(W * 0.034)}px Poppins, sans-serif`;
    g.textAlign = 'center';
    g.fillText('This video can\u2019t be shown in this browser', W / 2, H / 2 - W * 0.03);
    g.font = `400 ${Math.round(W * 0.026)}px Poppins, sans-serif`;
    g.fillText('Replace it with an MP4 (H.264) copy', W / 2, H / 2 + W * 0.03);
    g.restore();
  };
}

/* ===== v4 · navigation: Present, View, and a save status that tells the truth ================= */
function wireV4Nav() {
  // ---- hover: the item under the pointer gets its own outline ----------------------------
  const sigOf = (h) => (!h ? null : h.key === 'button' ? `bt:${h.id}` : h.key === 'media' ? `md:${h.id}` : h.key === 'xbadge' ? `eb:${h.id}`
    : h.key === 'xblock' ? `xb:${h.id}:${h.part === 'body' ? 'body' : 'h1'}` : h.key === 'text' ? (h.part === 'body' ? 'body' : 'h1') : h.key);
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || dragging || fsMode === 'preview') return;
    const h = hitAll(toCanvas(e))[0] || null;
    const sig = sigOf(h);
    if ((hoverHit && hoverHit.sig) === sig) return;
    hoverHit = h ? { r: h.r, sig } : null;
    draw();
  });
  canvas.addEventListener('pointerleave', () => { if (hoverHit) { hoverHit = null; draw(); } });

  // ---- Add section / Add slide: its own button, its own words -------------------------------
  const tas = $('#tl-add-section');
  const syncAddLabel = () => {
    const slide = state.contentType === 'carousel';
    const t = slide ? 'Add slide' : 'Add section';
    if ($('#tl-add-label').textContent !== t) $('#tl-add-label').textContent = t;
    tas.title = slide ? 'Add a slide after the one you are on' : 'Add a section after the one you are on';
    const c = document.querySelector('.v4-chip[data-v4="section"]'); if (c && c.textContent !== t) c.textContent = t;
  };
  if (tas) {
    tas.addEventListener('click', (e) => { e.stopPropagation(); addAnchor = tas; fsAddSection(); });
    setInterval(syncAddLabel, 500); syncAddLabel();
  }
  // ---- the hint when nothing is selected ---------------------------------------------------
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    for (const k of document.querySelectorAll('.v4-keys kbd')) if (k.textContent === '⌘') k.textContent = 'Ctrl';
  }
  for (const b of document.querySelectorAll('.v4-chip')) b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.dataset.v4 === 'add') $('#add-btn').click();
    else if (b.dataset.v4 === 'section') { addAnchor = b; fsAddSection(); }
    else if (b.dataset.v4 === 'background') selectElement('background');
  });

  // Present (top bar): full screen, exactly as it exports
  const pb = $('#btn-present');
  if (pb) pb.addEventListener('click', () => { if (fsMode === 'preview') setFsMode(isPhone() ? 'edit' : null); else setFsMode('preview'); });
  // View (by the preview): safe area and grid — canvas settings, apart from Projects
  const vb = $('#view-btn');
  if (vb) vb.addEventListener('click', (e) => { e.stopPropagation(); if (clipMenuFor === -6) { closeClipMenu(); return; } openViewMenu(vb); });
  // the full-screen View button on a phone too
  const fv = $('#fs-view');
  if (fv && !fv.__v4) { fv.__v4 = true; }

  // ---- project name + save status ----------------------------------------------------------
  let dirtyAt = 0;
  let saveTimer = 0;
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const paintStatus = () => {
    const nm = $('#ps-name'), el = $('#ps-state'), tx = $('#ps-text');
    if (!nm || !el) return;
    let name = 'Untitled';
    try { name = titleOf(state); } catch (_) {}
    if (nm.textContent !== name) nm.textContent = name;
    const p = persistence;
    let s = 'idle', text = 'Not saved yet';
    if (p.state === 'error') { s = 'error'; text = `Not saved · ${p.error}`; }
    else if (dirtyAt && (!p.at || p.at < dirtyAt)) { s = 'saving'; text = 'Saving…'; }
    else if (p.state === 'saved') { s = 'saved'; text = p.at ? `Saved in this browser · ${fmtTime(p.at)}` : 'Saved in this browser'; }
    el.dataset.s = s;
    document.documentElement.classList.toggle('save-error', s === 'error');
    if (tx.textContent !== text) tx.textContent = text;
    $('#proj-status').title = s === 'error'
      ? `${p.error}. Your last changes are only in this tab. Free some space (☰ Projects › delete old ones) or leave private browsing.`
      : 'Designs are saved automatically in this browser only. Other people and other devices can\u2019t see them.';
  };
  onPersistence(paintStatus);
  // any edit: mark it, and write it soon (the app saves on most edits itself; this catches the rest)
  const touched = (e) => {
    if (!e.target || !e.target.closest || !e.target.closest('.shell, .fs-bar, .clip-menu, .color-pop, .sheet, #section-sheet, .topbar')) return;
    if (e.target.closest('#btn-export, #burger, #btn-present')) return;
    dirtyAt = Date.now();
    paintStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { persistNow(); } catch (_) {} paintStatus(); }, 700);
  };
  for (const t of ['input', 'change', 'pointerup']) document.addEventListener(t, touched, true);
  document.addEventListener('keydown', (e) => {
    // ⌘S / Ctrl+S: write now (and say so) instead of the browser's "Save page"
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      dirtyAt = Date.now();
      try { persistNow(); } catch (_) {}
      paintStatus();
      showToast(persistence.state === 'saved' ? 'Saved in this browser' : `Not saved · ${persistence.error}`, persistence.state === 'saved' ? 'Save a named copy' : null, () => { hideToast(); openSavePop(); }, 3000);
    }
  });
  setInterval(paintStatus, 15000);
  // the save popup says how saving works
  const sub = document.querySelector('#save-pop .save-pop-sub');
  if (sub) sub.textContent = 'The open design already saves itself in this browser. A named copy keeps this version under Saved, in All projects.';
  paintStatus();
}

/* ===== v4 · locks: an item or a section you've placed stays put ===============================
   sc.locks = { '<element>': true } on the section ('watermark', 'text', 'inset', 'bt:id', 'md:id',
   'eb:id', 'xb:id'); sc.locked = true keeps a whole section out of Tidy up and Adapt layout. */
const lockKey = (el) => (el === 'h1' || el === 'body' ? 'text' : String(el || '').replace(/^(xb:[^:]+):.*$/, '$1'));
function sceneLocks(sc = state.scenes && state.scenes[state.scene]) { return (sc && sc.locks) || {}; }
function isLocked(el, sc) { return !!sceneLocks(sc)[lockKey(el)]; }
function setLocked(el, on) {
  const sc = state.scenes[state.scene];
  if (!sc) return;
  sc.locks = { ...(sc.locks || {}) };
  if (on) sc.locks[lockKey(el)] = true; else delete sc.locks[lockKey(el)];
  save();
  draw();
  showToast(on ? 'Locked: it won’t move when you drag, tidy up or adapt the layout' : 'Unlocked', 'Undo', () => setLocked(el, !on), 4000);
}
const LIST_OF = { bt: 'buttons', xb: 'blocks', md: 'media', eb: 'badges' };
function lockedSnapshot() {
  const out = [];
  const locks = sceneLocks();
  const pos = state.pos && state.pos[state.format];
  for (const k of Object.keys(locks)) {
    if (OWN_POS.includes(k)) { if (pos && pos[k]) out.push({ k, v: clone(pos[k]) }); continue; }
    const [pre, id] = k.split(':');
    const it = (state[LIST_OF[pre]] || []).find((x) => x.id === id);
    if (it) out.push({ k, it, v: { x: it.x, y: it.y } });
  }
  return out;
}
function restoreLocked(snap) {
  const pos = state.pos && state.pos[state.format];
  for (const s of snap) {
    if (s.it) { s.it.x = s.v.x; s.it.y = s.v.y; if (s.it.at) s.it.at[state.format] = { ...s.v }; }
    else if (pos) pos[s.k] = clone(s.v);
  }
}
function tidySection() {
  const sc = state.scenes && state.scenes[state.scene];
  if (sc && sc.locked) { showToast('This section’s layout is locked · unlock it from its menu on the timeline'); return false; }
  const keep = lockedSnapshot();
  const r = tidySectionRaw();
  if (keep.length) { restoreLocked(keep); commitScene(); save(); draw(); }
  return r;
}
function fitLayout(W, H) {
  const sc = state.scenes && state.scenes[state.scene];
  if (sc && sc.locked) return;
  const keep = lockedSnapshot();
  fitLayoutRaw(W, H);
  if (keep.length) restoreLocked(keep);
}

/* ===== v4 · Adapt layout: spread or gather text when the size changes =========================
   See v4/adapt.js for the rules. Planned against the target size, shown first ("3 sections → 5"),
   applied as one Undo. Runs only when the format changes or you ask — never on a window resize. */
const unitWord = (n) => (state.contentType === 'carousel' ? (n === 1 ? 'slide' : 'slides') : (n === 1 ? 'section' : 'sections'));
function contFrom(parent, text, sep) {
  const c = clone(parent);
  c.id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  c.role = 'value';
  c.h1 = '';
  c.body = text;
  c.buttons = []; c.media = []; c.badges = []; c.blocks = []; c.drawings = [];
  c.inset = NO_CARD();
  c.badge = 'none';
  c.visibility = 'both';
  c.auto = { from: parent.id, sep: sep || '\n' };
  c.manual = false;
  c.locked = false;
  delete c.locks; delete c.edited; delete c.sound;
  return c;
}
/** How much height a section needs at `fmt`, against what the safe area gives. */
function adaptMeasure(fmt) {
  const { w: W, h: H } = FORMATS[fmt];
  const memo = new Map();
  return (kind, k, text) => {
    const key = `${kind}|${k}|${text}`;
    if (memo.has(key)) return memo.get(key);
    const r = inSandbox(() => {
      state.scenes = clone(state.scenes);
      state.format = fmt;
      let idx = k;
      if (kind === 'cont') { state.scenes.splice(k + 1, 0, contFrom(state.scenes[k], text, '\n')); idx = k + 1; }
      else state.scenes[k].body = text;
      state.scene = idx;
      loadScene(idx);
      state.pos[fmt] = state.pos[fmt] || clone(DEFAULT_POS[fmt] || DEFAULT_POS['9x16']);
      const L = layout(ctx, state, W, H);
      const sa = safeArea(fmt, W, H);
      const keys = [...OWN_POS, ...(L.xbadges || []).map((b) => `eb:${b.id}`), ...(L.buttons || []).map((b) => `bt:${b.id}`),
        ...(L.media || []).map((m) => `md:${m.id}`), ...(L.extras || []).map((x) => `xb:${x.id}`)];
      const rects = keys.map((kk) => multiRect(kk, L)).filter((x) => x && x.w > 0 && x.h > 0).sort((a, b) => a.y - b.y);
      // items side by side share a row (as Tidy up and fitting treat them)
      const rows = [];
      for (const b of rects) {
        const row = rows[rows.length - 1];
        if (row && b.y < row.y + row.h && row.items.every((o) => b.x >= o.x + o.w || o.x >= b.x + b.w)) { row.items.push(b); row.h = Math.max(row.h, b.y + b.h - row.y); }
        else rows.push({ y: b.y, h: b.h, items: [b] });
      }
      const gap = H * 0.012;
      const need = rows.reduce((t, x) => t + x.h, 0) + gap * Math.max(0, rows.length - 1);
      return { need, avail: sa.h };
    });
    memo.set(key, r);
    return r;
  };
}
function planAdapt(fmt = state.format) {
  commitScene();
  return adaptPlan(state.scenes, adaptMeasure(fmt));
}
/** Fit section k at fmt into its safe area, written into the section (like followLayout). */
function fitSectionAt(k, fmt) {
  inSandbox(() => {
    state.format = fmt;
    state.scene = k;
    loadScene(k);
    const sc = state.scenes[k];
    state.pos[fmt] = state.pos[fmt] || clone(DEFAULT_POS[fmt] || DEFAULT_POS['9x16']);
    const { w: W, h: H } = FORMATS[fmt];
    fitLayout(W, H);
    sc.pos = sc.pos || {};
    sc.pos[fmt] = clone(state.pos[fmt]);
    for (const list of Object.keys(LAYOUT_LISTS)) {
      for (const it of state[list] || []) {
        const own = (sc[list] || []).find((x) => x.id === it.id);
        if (own) { own.x = it.x; own.y = it.y; own.at = own.at || {}; own.at[fmt] = { x: it.x, y: it.y }; }
      }
    }
  });
}
function applyAdapt(p, fmt = state.format) {
  if (!p || !p.ops.length) return false;
  stopPlayback();
  if (editor) closeEditor(true);
  dropMulti();
  commitScene();
  const openId = state.scenes[state.scene] && state.scenes[state.scene].id;
  pushUndo('Adapt layout');
  const touched = new Set();
  for (const op of [...p.ops].sort((a, b) => b.at - a.at)) {
    state.scenes = state.scenes.filter((x) => !op.kids.includes(x.id));
    const k = state.scenes.findIndex((x) => x.id === op.head);
    if (k < 0) continue;
    const head = state.scenes[k];
    head.body = op.chunks[0].text;
    const conts = op.chunks.slice(1).map((c) => contFrom(head, c.text, c.sep));
    state.scenes.splice(k + 1, 0, ...conts);
    touched.add(head.id); for (const c of conts) touched.add(c.id);
  }
  let open = state.scenes.findIndex((x) => x.id === openId);
  if (open < 0) open = Math.min(state.scene, state.scenes.length - 1);
  state.scene = open;
  state.scenes.forEach((sc, k) => { if (touched.has(sc.id)) fitSectionAt(k, fmt); });
  loadScene(state.scene);
  try { autoTimes(); } catch (_) {}
  save();
  renderScenes();
  syncSectionValues(true);
  draw();
  showToast(`Adapted for ${SIZE_NAMES[fmt]} ${fmt.replace('x', ':')}: ${p.before} → ${state.scenes.length} ${unitWord(state.scenes.length)}`, 'Undo', undoLast, 8000);
  return true;
}

let adaptPop = null;
function openAdapt(p = planAdapt()) {
  const fmt = state.format;
  if (!p.ops.length) {
    const locked = state.scenes.filter((x) => x.locked).length;
    const why = p.notes.length ? ` (${p.notes.length} ${unitWord(p.notes.length)} can’t be split: one paragraph, a Hook, a CTA or locked)`
      : locked ? ` (${locked} locked ${unitWord(locked)} left as ${locked > 1 ? 'they are' : 'it is'})` : '';
    showToast(`Everything already fits ${SIZE_NAMES[fmt]} ${fmt.replace('x', ':')} at its size${why}. Nothing to change.`, null, null, 6000);
    return;
  }
  if (!adaptPop) {
    adaptPop = document.createElement('div');
    adaptPop.id = 'adapt-pop';
    adaptPop.className = 'save-pop adapt-pop';
    adaptPop.setAttribute('role', 'dialog');
    adaptPop.setAttribute('aria-modal', 'true');
    adaptPop.setAttribute('aria-labelledby', 'adapt-title');
    adaptPop.innerHTML = '<h2 class="save-pop-title" id="adapt-title"></h2><p class="adapt-sum" id="adapt-sum"></p><ul class="adapt-list" id="adapt-list"></ul>'
      + '<p class="save-pop-sub adapt-rule">Text moves only between paragraphs or list items. Nothing is rewritten, shortened or removed; Hook, CTA, locked sections and your own sections stay as they are. Undo puts it all back in one step.</p>'
      + '<div class="save-pop-row adapt-acts"><button type="button" class="btn" id="adapt-cancel">Not now</button><button type="button" class="btn btn-primary" id="adapt-apply">Adapt layout</button></div>';
    document.body.append(adaptPop);
    const scrim = document.createElement('div'); scrim.className = 'burger-scrim adapt-scrim'; scrim.id = 'adapt-scrim'; scrim.hidden = true;
    document.body.append(scrim);
    scrim.addEventListener('click', closeAdapt);
    adaptPop.querySelector('#adapt-cancel').addEventListener('click', closeAdapt);
    adaptPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeAdapt(); } });
  }
  adaptPop.querySelector('#adapt-title').textContent = `Adapt layout to ${SIZE_NAMES[fmt]} ${fmt.replace('x', ':')}`;
  adaptPop.querySelector('#adapt-sum').innerHTML = `<b>${p.before} ${unitWord(p.before)}</b> <span aria-hidden="true">→</span><span class="sr-only"> become </span> <b>${p.after} ${unitWord(p.after)}</b>`;
  const ul = adaptPop.querySelector('#adapt-list');
  ul.innerHTML = '';
  for (const op of p.ops) {
    const sc = state.scenes[op.at];
    const li = document.createElement('li');
    const name = `${sceneName(sc, op.at)}${sc.h1 ? ` “${String(sc.h1).slice(0, 32)}${String(sc.h1).length > 32 ? '…' : ''}”` : ''}`;
    li.textContent = op.to > op.from ? `${name}: spread over ${op.to} ${unitWord(op.to)}, split between paragraphs`
      : op.to < op.from ? `${name}: ${op.from} ${unitWord(op.from)} gathered back into ${op.to}` : `${name}: text re-spread over ${op.to} ${unitWord(op.to)}`;
    ul.append(li);
  }
  for (const n of p.notes) {
    const li = document.createElement('li'); li.className = 'is-note';
    li.textContent = `${sceneName(state.scenes[n.at], n.at)} ${n.msg} — left as it is (edit it, or make the text smaller)`;
    ul.append(li);
  }
  const apply = adaptPop.querySelector('#adapt-apply');
  apply.onclick = () => { closeAdapt(); applyAdapt(p, fmt); };
  adaptPop.hidden = false;
  document.querySelector('#adapt-scrim').hidden = false;
  apply.focus({ preventScroll: true });
}
function closeAdapt() {
  if (!adaptPop || adaptPop.hidden) return;
  adaptPop.hidden = true;
  document.querySelector('#adapt-scrim').hidden = true;
}

function wireV4Adapt() {
  // explicit: Adapt layout, under Tidy up
  const tidy = $('#tidy-btn');
  if (tidy && !$('#adapt-btn')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tidy-btn'; b.id = 'adapt-btn';
    b.innerHTML = '<span class="tidy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="8" height="12" rx="1.6"/><rect x="13.5" y="8" width="7" height="7" rx="1.4"/><path d="M11.5 10h2M8 19h8"/></svg></span><span>Adapt layout<small>Spread or gather text for this size · preview first</small></span>';
    tidy.after(b);
    b.addEventListener('click', () => openAdapt());
  }
  // a real size change (never a window resize): offer it when it would change something
  const sel = $('#format-select');
  if (sel) sel.addEventListener('change', () => setTimeout(() => {
    let p;
    try { p = planAdapt(); } catch (_) { return; }
    if (!p.ops.length) return;
    const fmt = state.format;
    const more = p.after > p.before;
    showToast(more ? `Some text doesn’t fit ${SIZE_NAMES[fmt]} at its size · ${p.before} → ${p.after} ${unitWord(p.after)}`
      : `There’s room to bring split ${unitWord(2)} back together · ${p.before} → ${p.after}`, 'Review', () => { hideToast(); openAdapt(planAdapt()); }, 10000);
  }, 60));
  // locks: in the item menu (right-click / long-press) and the section menu
  const baseItemMenu = itemMenuFor;
  itemMenuFor = (el) => {
    const items = baseItemMenu(el);
    if (el && el !== 'background' && fsMode !== 'preview') {
      const on = isLocked(el);
      items.push({ icon: on ? 'edit' : 'safe', label: on ? 'Unlock position' : 'Lock position', sub: on ? 'Drag, Tidy up and Adapt layout can move it again' : 'Stays put when you drag, tidy up or adapt the layout', run: () => setLocked(el, !on) });
    }
    return items;
  };
  // a locked item can be selected (and long-pressed for its menu), not dragged
  const sigOfDrag = (d) => (!d ? null : d.key === 'button' ? `bt:${d.id}` : d.key === 'media' ? `md:${d.id}` : d.key === 'xbadge' ? `eb:${d.id}`
    : d.key === 'xblock' ? `xb:${d.id}` : d.key);
  let toldLock = 0;
  $('#canvas-wrap').addEventListener('pointermove', (e) => {
    if (!dragging || dragging.key === 'ground' || dragging.key === 'image') return;
    if (!isLocked(sigOfDrag(dragging))) return;
    e.stopImmediatePropagation();
    if (Date.now() - toldLock > 4000 && Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) > TAP_SLOP) {
      toldLock = Date.now();
      showToast('Locked in place · right-click or long-press it to unlock', null, null, 3500);
    }
  }, true);
}

/* v4 · the elements selected on the canvas, as Export names them (itemsOf ids). Pressing Export
   ends a multi-selection (a tap outside the canvas), so it is read as Export is pressed. */
let selAtExport = null;
window.addEventListener('pointerdown', (e) => {   // window, capture: before the tap-outside that ends a selection
  if (!e.target.closest || !e.target.closest('#btn-export, #fs-export')) return;
  selAtExport = { t: Date.now(), sigs: multiSel.length > 1 ? [...multiSel] : selected && selected !== 'background' ? [selected] : [] };
}, true);
function selectedElementIds() {
  const fresh = selAtExport && Date.now() - selAtExport.t < 4000;
  const sigs = fresh ? selAtExport.sigs : multiSel.length > 1 ? multiSel : selected && selected !== 'background' ? [selected] : [];
  const out = [];
  for (const sg of sigs) {
    const id = sg === 'watermark' ? 'badge' : sg === 'h1' || sg === 'body' ? 'text' : String(sg).replace(/^(xb:[^:]+):.*$/, '$1');
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
