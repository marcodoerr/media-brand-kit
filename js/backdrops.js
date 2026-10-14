/* ==========================================================================
   backdrops.js — painters for every kind of backdrop, plus the upload list.

   The set of built-ins comes from the active brand; everything here works
   the same whichever brand that is.

   Kinds:
     tile   — a seamless tile cut at the artwork's true repeat, so the pattern
              bleeds to every edge at any canvas size instead of being cropped
     art    — a composition with a portrait and a landscape master; the canvas
              picks whichever orientation fits, then cover-fits with pan/zoom
     solid  — a flat brand colour, so it scales infinitely for free
   ========================================================================== */

import { C, img, tilePattern, activeBrand, density } from './assets.js';
import { imageFor, sizeOf } from './store.js';

/** Design reference: the Figma frames are 1074 across. */
const U = 1074;

/* zoom ≥ 1 scales past cover; fx/fy choose the crop inside what overhangs;
   ox/oy move the picture further, in canvas widths/heights (the ground shows). */
export const DEFAULT_ADJUST = { zoom: 1, fx: 0.5, fy: 0.5, ox: 0, oy: 0 };
const clamp01 = (v) => Math.max(0, Math.min(1, v == null ? 0.5 : v));

/* --- video placeholder ----------------------------------------------------
   A clip has no frame to draw until it has decoded one. Colour bars say
   "video, loading" far better than an empty rectangle does.
   ------------------------------------------------------------------------ */

const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
const BARS_SUB = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];

export function drawColourBars(ctx, x, y, w, h) {
  const n = BARS.length;
  const bw = w / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = BARS[i];
    // overdraw a pixel so rounding never leaves a seam between bars
    ctx.fillRect(x + i * bw, y, bw + 1, h * 0.72);
  }
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = BARS_SUB[i];
    ctx.fillRect(x + i * bw, y + h * 0.72, bw + 1, h * 0.10);
  }
  ctx.fillStyle = '#131313';
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  ctx.restore();
}

/** A clip that exists but has not decoded a frame yet. */
export function awaitingFrame(el) {
  return !!el && el.tagName === 'VIDEO' && el.readyState < 2;
}

/* --- painters ------------------------------------------------------------ */

function coverFit(ctx, image, W, H, adjust) {
  const a = adjust || DEFAULT_ADJUST;
  const { w: iw, h: ih } = sizeOf(image);
  if (!iw || !ih) return;
  const scale = Math.max(W / iw, H / ih) * Math.max(1, a.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (W - dw) * clamp01(a.fx) + (a.ox || 0) * W, (H - dh) * clamp01(a.fy) + (a.oy || 0) * H, dw, dh);
}

/* An upload used as a pattern: the picture repeated edge to edge. `tile` is its
   width as a share of the frame's short side (the same unit as the type and
   badge, so a reel and a 16:9 read alike); `mirror` flips every other tile so
   the edges meet — seamless with any picture. Dragging moves it (ox/oy, and
   fx/fy, which a drag also nudges). */
export const PATTERN_TILE = { min: 0.05, max: 1, initial: 0.3 };
/* Space between tiles, as a share of the tile's own width (gx) / height (gy). 0 = edge to edge;
   the gap shows the background colour behind the picture. */
export const PATTERN_GAP = { min: 0, max: 2 };
const GAP_FLOOR = -0.5;   // v3.10: a brand motif may overlap its neighbours (T4R Confetti is drawn at −11%)
/* v3.1: alternate rows shift sideways by a share of one step (tile + gap). */
export const ROW_SHIFT = { min: 0, max: 1 };
const rowShiftOf = (v) => Math.max(ROW_SHIFT.min, Math.min(ROW_SHIFT.max, typeof v === 'number' ? v : 0));
const gapOf = (v) => Math.max(GAP_FLOOR, Math.min(PATTERN_GAP.max, typeof v === 'number' ? v : 0));
function patternFill(ctx, image, W, H, a) {
  const { w: iw, h: ih } = sizeOf(image);
  if (!iw || !ih) return;
  const t = Math.max(0.01, Math.min(PATTERN_TILE.max, typeof a.tile === 'number' ? a.tile : PATTERN_TILE.initial));
  const tw = Math.max(4, Math.min(W / U, H / (U * 1.25)) * U * t);
  const th = tw * ih / iw;
  // one step = a tile plus its gap
  const sx = tw * (1 + gapOf(a.gx)), sy = th * (1 + gapOf(a.gy));
  const offX = (a.ox || 0) * W + (clamp01(a.fx) - 0.5) * sx;
  const offY = (a.oy || 0) * H + (clamp01(a.fy) - 0.5) * sy;
  const kx = Math.floor(offX / sx), ky = Math.floor(offY / sy);
  const x0 = offX - kx * sx - sx, y0 = offY - ky * sy - sy;
  const seam = gapOf(a.gx) || gapOf(a.gy) ? 0 : 0.5;   // overdraw only when tiles touch
  ctx.save();
  // v3.1: every other row shifted by a share of one step (0 = aligned, 0.5 = brick)
  const shift = rowShiftOf(a.row) * sx;
  for (let r = 0, y = y0; y < H; r++, y += sy) {
    const odd = (r - ky) & 1;
    for (let c = 0, x = x0 - (odd && shift ? sx : 0) + (odd ? shift : 0); x < W; c++, x += sx) {
      // parity follows the tile, not the screen, so dragging never flips a tile
      const fx = a.mirror && ((c - kx) & 1), fy = a.mirror && a.mirrorY !== false && ((r - ky) & 1);   // a face is only ever turned sideways
      if (fx || fy) {
        ctx.save();
        ctx.translate(x + (fx ? tw : 0), y + (fy ? th : 0));
        ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
        ctx.drawImage(image, 0, 0, tw + seam, th + seam);
        ctx.restore();
      } else ctx.drawImage(image, x, y, tw + seam, th + seam);   // overdraw half a pixel: no seams
    }
  }
  ctx.restore();
}

/* --- v3.1 · Cogents --------------------------------------------------------------
   A cogent background (brands.js `kind: 'cogent'`): the portrait (round, or its grunge
   sticker) cut from its badge file, optionally as a SPEECH BUBBLE — the lower-left corner
   square, the shape filled with a colour picked from the portrait's rim, the sticker whole
   inside it — and with a HALO outline. Laid out as a PATTERN (tile size, spacing, offset
   rows, like an upload used as a pattern) or as one large SINGLE image (scale, dragged
   into place) on a brand colour. Settings live in the background's adjust (per section,
   saved, in templates; its colour is `cground`); `setAdjustLookup` lets the painter read them for any section. */
export const COGENT_DEFAULTS = { layout: 'pattern', tile: 0.22, gx: 0.35, gy: 0.35, row: 0.5, bubble: false, halo: null, zoom: 1, mirror: false };
let adjustLookup = () => null;
export function setAdjustLookup(fn) { adjustLookup = typeof fn === 'function' ? fn : () => null; }
const cogentAdjust = (bd) => ({ ...COGENT_DEFAULTS, ...(adjustLookup(bd.id) || bd.adjust || {}) });
const BUBBLE_INSET = 0.8;   // = render.js BUBBLE_INSET (kept here: render.js imports this file)
const artCache = new Map();
const boxCache = new WeakMap();
let artImgId = 0;
/** The opaque box of a sticker under its pill (computed once per image). */
function stickerBox(image, top) {
  if (boxCache.has(image)) return boxCache.get(image);
  const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const y0 = Math.round(H * top);
  let x0 = W, x1 = -1, ya = H, yb = -1;
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < ya) ya = y; yb = y; }
  const box = x1 < 0 ? { x: 0, y: y0, w: W, h: H - y0 } : { x: x0, y: ya, w: x1 - x0 + 1, h: yb - ya + 1 };
  boxCache.set(image, box);
  return box;
}
/** The colour the bubble continues: the commonest colour on the lower-left of the rim. */
function rimColour(src, ks = [0.9, 0.94]) {
  const W = src.width, H = src.height, g = src.getContext('2d', { willReadFrequently: true });
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2;
  const counts = new Map();
  for (let a = 10; a <= 80; a += 2) for (const k of ks) {
    const t = (a * Math.PI) / 180;
    const x = Math.round(cx - r * k * Math.cos(t)), y = Math.round(cy + r * k * Math.sin(t));
    const d = g.getImageData(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)), 1, 1).data;
    if (d[3] < 200) continue;
    const key = `#${[d[0], d[1], d[2]].map((v) => Math.min(255, Math.round(v / 12) * 12).toString(16).padStart(2, '0')).join('')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = '#000000', n = -1;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  return best;
}
/** The cogent as drawn: cut from its file, round or a bubble, with or without a halo. */
export function cogentArt(bd, a = cogentAdjust(bd)) {
  const image = img(bd.asset);
  if (!image || !(image.naturalWidth || image.width)) return null;
  if (!image.__cid) image.__cid = ++artImgId;
  const halo = a.halo && a.halo.on ? (a.halo.color || '#2b6a83') : '';
  const sig = [image.__cid, image.naturalWidth, bd.sticker ? 's' : 'r', a.bubble ? 'b' : 'c', halo].join('|');
  if (artCache.has(sig)) return artCache.get(sig);
  const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
  // the art alone, in a square
  let box;
  if (bd.sticker) box = stickerBox(image, bd.top || 0);
  else { const m = W * 0.0097, d = W - m * 2; box = { x: m, y: H * (bd.top || 0), w: d, h: Math.min(d, H - H * (bd.top || 0)) }; }
  const aside = Math.ceil(Math.max(box.w, box.h));
  const art = document.createElement('canvas'); art.width = aside; art.height = aside;
  const ag = art.getContext('2d', { willReadFrequently: true });
  ag.imageSmoothingQuality = 'high';
  ag.drawImage(image, box.x, box.y, box.w, box.h, (aside - box.w) / 2, (aside - box.h) / 2, box.w, box.h);
  const shaped = !bd.sticker || a.bubble;   // a sticker's rough edge has no outline to follow unless it sits in a bubble
  if (!a.bubble && !(halo && shaped)) { artCache.set(sig, art); return art; }
  // v3.5: in a bubble the cogent sits smaller (BUBBLE_INSET of the bubble), the bubble's color around it
  const side = a.bubble ? Math.ceil(aside / BUBBLE_INSET) : aside;
  const out = document.createElement('canvas'); out.width = side; out.height = side;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  const r = side / 2;
  const path = () => {
    g.beginPath();
    if (a.bubble && g.roundRect) g.roundRect(0, 0, side, side, [r, r, r, 0]);
    else if (a.bubble) { g.moveTo(0, r); g.arcTo(0, 0, r, 0, r); g.arcTo(side, 0, side, r, r); g.arcTo(side, side, r, side, r); g.lineTo(0, side); g.closePath(); }
    else g.arc(r, r, r, 0, Math.PI * 2);
  };
  // a sticker: the portrait's own ground inside the grunge frame, not the frame's black
  if (a.bubble) { path(); g.fillStyle = a.fill || rimColour(art, bd.sticker ? [0.70, 0.76] : [0.9, 0.94]); g.fill(); }
  g.drawImage(art, (side - aside) / 2, (side - aside) / 2);
  if (halo && shaped) { g.save(); path(); g.clip(); path(); g.lineWidth = side * 0.052; g.strokeStyle = halo; g.stroke(); g.restore(); }
  if (artCache.size > 48) artCache.delete(artCache.keys().next().value);
  artCache.set(sig, out);
  return out;
}

/* --- v3.10 · Brand patterns from single motifs --------------------------------------
   Each brand pattern is the Figma pattern fill it was designed as: one whole motif (a
   logo, a skull, a T4R mark — exported from Figma › Brand assets › Pattern motifs),
   repeated at the Figma size, spacing and row offset on its ground color, with the
   wash Figma lays over it. Size scales the motif (adjust.zoom, 100% = as designed),
   Spacing and Offset rows are the same controls a cogent pattern has, and Mirror turns
   every other motif sideways — always a whole motif, never a cut tile. */
export function motifDefaults(bd) {
  const m = bd && bd.motif;
  return m ? { gx: m.gx, gy: m.gy, row: m.row } : null;
}
function motifImage(bd) {
  const el = img(bd.motif.asset);
  return el && (el.naturalWidth || el.width) ? el : null;
}
function motifPattern(ctx, W, H, bd) {
  const m = bd.motif, a = bd.adjust || {};
  ctx.fillStyle = m.ground || bd.base;
  ctx.fillRect(0, 0, W, H);
  patternFill(ctx, motifImage(bd), W, H, {
    tile: m.tile * tileScale(bd),
    gx: typeof a.gx === 'number' ? a.gx : m.gx,
    gy: typeof a.gy === 'number' ? a.gy : m.gy,
    row: typeof a.row === 'number' ? a.row : m.row,
    fx: 0.5, fy: 0.5, ox: 0, oy: 0,
    mirror: !!a.mirror, mirrorY: false,
  });
  if (m.over) { ctx.save(); ctx.globalAlpha = m.over[1]; ctx.fillStyle = m.over[0]; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

/* v3.23 · Stripes: vertical bars, one per colour, repeating across the frame. A bar is `w` of the
   frame's short side at Size 100 % (Size scales it, like a pattern's motif), so a reel and a 16:9
   show bars of the same build. Drawn from the left edge, the first colour first. */
function stripesFill(ctx, W, H, bd) {
  const cols = (bd.stripes.colors || []).length ? bd.stripes.colors : [bd.base];
  const bw = Math.max(2, Math.min(W, H) * (bd.stripes.w || 1 / 7) * tileScale(bd));
  for (let k = 0, x = 0; x < W; k++, x += bw) {
    ctx.fillStyle = cols[k % cols.length];
    ctx.fillRect(Math.floor(x), 0, Math.ceil(bw) + 1, H);   // overdraw a pixel: no seams
  }
}

const PAINTERS = {
  cogent(ctx, W, H, bd) {
    const a = cogentAdjust(bd);
    ctx.fillStyle = a.cground || bd.base;   // not `ground`: that key was the retired Surface and is cleared on load
    ctx.fillRect(0, 0, W, H);
    const art = cogentArt(bd, a);
    if (!art) return;
    if (a.layout === 'single') {
      const w = Math.min(W, H) * 0.62 * Math.max(0.1, a.zoom || 1);
      const h = w * art.height / art.width;
      const cx = W / 2 + (a.ox || 0) * W, cy = H / 2 + (a.oy || 0) * H;
      ctx.drawImage(art, cx - w / 2, cy - h / 2, w, h);
      return;
    }
    // v3.3: Mirror turns every other cogent to face the other way (never upside down)
    patternFill(ctx, art, W, H, { ...a, mirror: !!a.mirror, mirrorY: false });
  },

  solid(ctx, W, H, bd) {
    ctx.fillStyle = bd.base;
    ctx.fillRect(0, 0, W, H);
  },

  /* At scale 1 the motif is the size it is in the source frame, relative to
     the short edge — so a reel and a desktop banner read identically. */
  tile(ctx, W, H, bd) {
    // v3.23: stripes — vertical bars of colour, no artwork needed
    if (bd.stripes) { stripesFill(ctx, W, H, bd); return; }
    // v3.10: a brand pattern is built from its single motif, laid out like a cogent pattern
    if (bd.motif && motifImage(bd)) { motifPattern(ctx, W, H, bd); return; }
    ctx.fillStyle = bd.base;
    ctx.fillRect(0, 0, W, H);
    const pat = tilePattern(ctx, bd.asset);
    if (!pat) return;
    // a @3x master holds 3 source pixels per design pixel, so draw it 3× smaller
    // same unit as the type and badge, so a square or 16:9 keeps the reel's proportions
    const s = Math.min(W / U, H / (U * 1.25)) * tileScale(bd) / density(bd.asset);
    const image = img(bd.asset);
    if (bd.adjust && bd.adjust.mirror && image) {
      // v3.8 · Mirror: every other tile turned sideways (never upside down). A repeating tile's
      // left and right edges match, so a turned neighbour still meets it without a seam.
      const { w: iw, h: ih } = sizeOf(image);
      const tw = iw * s, th = ih * s;
      if (tw >= 2 && th >= 2) {
        for (let r = 0, y = 0; y < H; r++, y += th) {
          for (let c = 0, x = 0; x < W; c++, x += tw) {
            if (c & 1) { ctx.save(); ctx.translate(x + tw, y); ctx.scale(-1, 1); ctx.drawImage(image, 0, 0, tw + 0.5, th + 0.5); ctx.restore(); }
            else ctx.drawImage(image, x, y, tw + 0.5, th + 0.5);
          }
        }
        return;
      }
    }
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W / s, H / s);
    ctx.restore();
  },

  /* v3.1: a brand-safe gradient — two brand colours, one of four directions (see gradientBd) */
  gradient(ctx, W, H, bd) {
    const [x0, y0, x1, y1] = {
      s: [0, 0, 0, H], e: [0, 0, W, 0], se: [0, 0, W, H], ne: [0, H, W, 0],
    }[bd.dir] || [0, 0, 0, H];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, bd.from);
    g.addColorStop(1, bd.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },

  art(ctx, W, H, bd) {
    // the surface around a moved or shrunk picture: its own colour unless one was picked
    ctx.fillStyle = (bd.adjust && bd.adjust.ground) || bd.base;
    ctx.fillRect(0, 0, W, H);
    const key = `${bd.asset}-${W > H ? 'landscape' : 'portrait'}`;
    const image = img(key);
    if (image) coverFit(ctx, image, W, H, bd.adjust);
  },

  /* An uploaded still or clip. Canvas draws a <video> exactly like an
     <img>, so one painter covers both. */
  image(ctx, W, H, bd) {
    ctx.fillStyle = (bd.adjust && bd.adjust.ground) || C.plum;
    ctx.fillRect(0, 0, W, H);
    const el = imageFor(bd.id);
    if (awaitingFrame(el)) { drawColourBars(ctx, 0, 0, W, H); return; }
    if (el && bd.adjust && bd.adjust.pattern) { patternFill(ctx, el, W, H, bd.adjust); return; }
    if (el) coverFit(ctx, el, W, H, bd.adjust);
  },
};

/* v3.5 · Speed: a still background is painted once into a layer and reused, so a frame
   (a drag, a slider, a playing video elsewhere on the design) draws one image instead of
   hundreds of pattern tiles. The layer is keyed on everything the painter reads — the
   background, its settings, the size, and which picture it was drawn from (so the sharp
   file arriving, or a picture finishing loading, paints it again). Videos and plain colors
   are painted directly. */
const layerCache = new Map();
let lastKey = '';
const srcIds = new WeakMap();
let srcSeq = 0;
const srcKey = (el) => {
  if (!el) return 'none';
  if (typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement) return null;   // moving: never cached
  if (el instanceof HTMLImageElement && !(el.complete && el.naturalWidth)) return null;        // still loading
  if (!srcIds.has(el)) srcIds.set(el, ++srcSeq);
  return `${srcIds.get(el)}:${el.naturalWidth || el.width}`;
};
function layerKey(bd, W, H) {
  let src;
  if (bd.kind === 'solid' || bd.kind === 'gradient') return null;   // one fill: nothing to save
  if (bd.kind === 'art') src = srcKey(img(`${bd.asset}-${W > H ? 'landscape' : 'portrait'}`));
  else if (bd.kind === 'image') src = srcKey(imageFor(bd.id));
  else if (bd.kind === 'tile' && bd.motif && motifImage(bd)) src = 'm' + srcKey(motifImage(bd));
  else src = srcKey(bd.asset ? img(bd.asset) : null);
  if (src === null) return null;
  let adj;
  try { adj = JSON.stringify([bd.adjust || null, adjustLookup(bd.id) || null]); } catch (_) { return null; }
  return `${bd.id}|${bd.kind}|${W}x${H}|${src}|${bd.base || ''}|${adj}`;
}
export function paintBackdrop(ctx, W, H, bd) {
  const key = W * H <= 4096 * 4096 ? layerKey(bd, W, H) : null;
  if (!key || typeof document === 'undefined') { PAINTERS[bd.kind](ctx, W, H, bd); return; }
  let layer = layerCache.get(key);
  // a setting being dragged changes the key every frame: paint those directly, and keep a
  // layer only once the same background is drawn a second time (a still frame, a playing video)
  if (!layer && lastKey !== key) { lastKey = key; PAINTERS[bd.kind](ctx, W, H, bd); return; }
  lastKey = key;
  if (!layer) {
    layer = document.createElement('canvas'); layer.width = W; layer.height = H;
    PAINTERS[bd.kind](layer.getContext('2d'), W, H, bd);
    layerCache.set(key, layer);
    while (layerCache.size > 3) layerCache.delete(layerCache.keys().next().value);   // the preview, an export, a thumb
  } else { layerCache.delete(key); layerCache.set(key, layer); }                      // most recent last
  ctx.drawImage(layer, 0, 0);
}

/** Which asset a croppable backdrop is currently showing (null if none). */
export function activeImage(bd, W, H) {
  if (bd.kind === 'art') return img(`${bd.asset}-${W > H ? 'landscape' : 'portrait'}`);
  if (bd.kind === 'image') return imageFor(bd.id);
  return null;
}

export const croppable = (bd) => bd.kind === 'art' || bd.kind === 'image' || bd.kind === 'cogent';   // a cogent is dragged into place too

/* Pattern scale lives in the same `adjust.zoom` slot the crop zoom uses.
   Scaling down is free — it is a downsample. Scaling up resamples a 547px
   tile, and a 2× export doubles that again, so the ceiling is where the
   guilloché inside the mark still holds together. */
export const TILE_SCALE = { min: 0.25, max: 2 };
export function tileScale(bd) {
  const z = bd.adjust && bd.adjust.zoom;
  return Math.max(TILE_SCALE.min, Math.min(TILE_SCALE.max, typeof z === 'number' ? z : 1));
}

/* --- legibility wash ----------------------------------------------------- */

/* Dim is the only wash now. 'brand' and 'fade' from older saved designs and
   templates draw as Dim (see overlayStyle), so nothing saved breaks. */
export const OVERLAYS = {
  none:  { label: 'Off' },
  dim:   { label: 'On' },
};
export const overlayStyle = (style) => (style === 'none' ? 'none' : 'dim');

const rgba = (hex, a) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
};

export function paintOverlay(ctx, W, H, style, strength) {
  const k = Math.max(0, Math.min(1, strength));
  if (overlayStyle(style) === 'none' || !k) return;
  ctx.save();
  ctx.fillStyle = rgba(C.ink, k * 0.8);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* --- badge ---------------------------------------------------------------
   Both lockups are exported artwork including the "Powered by" pill, so
   nothing here is redrawn — only placed and scaled.
   ------------------------------------------------------------------------ */

export const badges = () => activeBrand().badges || {};
export const hasBadges = () => Object.keys(badges()).length > 0;

/* --- text treatments ----------------------------------------------------- */

/* Read through functions, not captured at module load, so switching brand
   swaps the palette without a reload. */
export const cardStyles = () => ({
  none:  null,
  plum:  { bg: C.plum,  h1: C.blush, body: C.bodyOnDark },
  ink:   { bg: C.ink,   h1: C.blush, body: C.bodyOnDark },
  mauve: { bg: C.mauve, h1: C.cream, body: C.lilac      },
  cream: { bg: C.cream, h1: C.ink,   body: C.bodyOnLight },
});

export const bareStyles = () => ({
  onDark:  { h1: C.blush, body: C.bodyOnDark },
  onLight: { h1: C.ink,   body: C.bodyOnLight },
});

export const builtIns = () => activeBrand().backdrops;

/* --- uploads -------------------------------------------------------------- */

const uploads = [];

export function registerUpload(meta, adjust) {
  const bd = {
    id: meta.id,
    name: meta.name,
    kind: 'image',
    upload: true,
    base: C.plum,
    badge: hasBadges() ? 'cream' : 'none',
    card: 'none',
    tone: 'dark',
    adjust: adjust || { ...DEFAULT_ADJUST },
  };
  uploads.push(bd);
  return bd;
}

export function unregisterUpload(id) {
  const i = uploads.findIndex((b) => b.id === id);
  if (i >= 0) uploads.splice(i, 1);
}

export const allBackdrops = () => [...uploads, ...builtIns()];

/* Your own solid colours: `solid-custom-rrggbb` is a plain colour backdrop like
   the brand's, made on the fly — it exports, saves and travels in templates.
   Its tone (and so the badge and text it pairs with) follows its lightness. */
const customSolids = new Map();
function customSolid(id) {
  const m = /^solid-custom-([0-9a-f]{6})$/i.exec(String(id || ''));
  if (!m) return null;
  if (customSolids.has(id)) return customSolids.get(id);
  const hex = `#${m[1].toLowerCase()}`;
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  const tone = lum > 0.35 ? 'light' : 'dark';
  const twin = builtIns().find((b) => b.kind === 'solid' && b.tone === tone) || builtIns().find((b) => b.kind === 'solid') || builtIns()[0];
  const bd = { id, name: `Color ${hex}`, kind: 'solid', base: hex, tone, badge: twin.badge, card: 'none', custom: true, listed: false };
  customSolids.set(id, bd);
  return bd;
}

/* v3.1 · Gradient: `grad-rrggbb-rrggbb-dir` is made on the fly like a custom colour, so it
   saves, travels in templates, follows a section and exports with no extra plumbing.
   dir: s (top → bottom), se (diagonal down), e (left → right), ne (diagonal up). */
export const GRAD_DIRS = ['s', 'se', 'e', 'ne'];
export const gradId = (from, to, dir = 's') => `grad-${from.replace('#', '').toLowerCase()}-${to.replace('#', '').toLowerCase()}-${GRAD_DIRS.includes(dir) ? dir : 's'}`;
const luminance = (hex) => {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const mixHex = (a, b) => `#${[1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('')}`;
const gradients = new Map();
export function gradientBd(id) {
  const m = /^grad-([0-9a-f]{6})-([0-9a-f]{6})-(s|se|e|ne)$/i.exec(String(id || ''));
  if (!m) return null;
  if (gradients.has(id)) return gradients.get(id);
  const from = `#${m[1].toLowerCase()}`, to = `#${m[2].toLowerCase()}`;
  const base = mixHex(from, to);            // the middle colour: contrast checks and thumbnails
  const tone = luminance(base) > 0.35 ? 'light' : 'dark';
  const twin = builtIns().find((b) => b.kind === 'solid' && b.tone === tone) || builtIns().find((b) => b.kind === 'solid') || builtIns()[0];
  const bd = { id, name: 'Gradient', kind: 'gradient', base, from, to, dir: m[3], tone, badge: twin.badge, card: 'none', listed: false };
  gradients.set(id, bd);
  return bd;
}
export const colourLuminance = luminance;

export const byId = (id) =>
  uploads.find((b) => b.id === id) || builtIns().find((b) => b.id === id) || customSolid(id) || gradientBd(id) || builtIns()[0];

export { C };
