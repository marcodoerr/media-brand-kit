/* ==========================================================================
   render.js — one draw function for both the live preview and the export.
   ========================================================================== */

import { C, img, activeBrand } from './assets.js';
import { contrast } from './colours.js';
import { imageFor, sizeOf } from './store.js';
import {
  paintBackdrop, paintOverlay, byId, croppable,
  badges, cardStyles, bareStyles, drawColourBars, awaitingFrame,
} from './backdrops.js';

/** Design reference: the Figma frames are 1074 across. */
const U = 1074;

/* One size unit for every format. A reel and a 4:5 post are as wide as the
   1074 design, so they keep it exactly; a square or a 16:9 frame is only 1080
   tall, so everything — badge, type, text panel, photo card, pattern — comes
   down to ~80 % and the composition keeps its proportions instead of the type
   swallowing the frame. */
export const unitOf = (W, H) => Math.min(W / U, H / (U * 1.25));

/** Nothing may be bigger than this share of the frame, whatever the sliders say. */
const FIT = 0.92;
export { FIT };
const fitScale = (w, h, W, H) => Math.min(1, (W * FIT) / w, (H * FIT) / h);
const clampRect = (r, W, H) => {
  r.x = Math.max(0, Math.min(W - r.w, r.x));
  r.y = Math.max(0, Math.min(H - r.h, r.y));
  return r;
};

/* v3.1: short names — the Video / Carousel group already says what it is (see
   FORMATS.md in the dev kit for the platform specs behind these sizes, 2026-10-06).
   3:4 is Instagram's grid-native portrait (the profile grid shows 3:4 since 2025). */
export const FORMATS = {
  '9x16': { w: 1080, h: 1920, label: 'Reel',      sub: '1080 × 1920', hint: 'Reels, Stories, TikTok, Shorts' },
  '3x4':  { w: 1080, h: 1440, label: 'Tall',      sub: '1080 × 1440', hint: 'Instagram feed — fills the grid tile' },
  '4x5':  { w: 1080, h: 1350, label: 'Portrait',  sub: '1080 × 1350', hint: 'Feed posts and ads' },
  '1x1':  { w: 1080, h: 1080, label: 'Square',    sub: '1080 × 1080', hint: 'Feed, ads' },
  '16x9': { w: 1920, h: 1080, label: 'Landscape', sub: '1920 × 1080', hint: 'YouTube, X, Bluesky, LinkedIn' },
};

/* v3.1 · Safe area: the canvas is the format; WHERE it is posted decides what covers it.
   9:16 is one canvas for Reels, Stories, TikTok and Shorts, whose UI lands in different
   places, so the box follows the target (state.safeFor). "All platforms" is the union of
   their covered areas — the default, since one export is usually posted everywhere.
   OFFICIAL = Meta (14 % top, 35 % bottom, 6 % sides; Reels and Stories since 2026).
   PRACTICAL = TikTok (its downloadable template, transcribed) and YouTube Shorts (agency
   guides; YouTube publishes no numbers). Details and sources: FORMATS.md. Other formats
   have no overlay: 6 % all round is a print-style margin. */
export const SAFE_TARGETS = {
  all:     { label: 'All platforms',        top: 0.150, bottom: 0.350, left: 0.110, right: 0.180, rail: true },
  meta:    { label: 'Instagram & Facebook', top: 0.140, bottom: 0.350, left: 0.060, right: 0.060 },
  tiktok:  { label: 'TikTok',               top: 0.125, bottom: 0.344, left: 0.111, right: 0.111, rail: true },
  youtube: { label: 'YouTube Shorts',       top: 0.150, bottom: 0.350, left: 0.044, right: 0.178 },
};
let safeFor = 'all';
/** Which platform's 9:16 safe area the layout and the guides use. */
export function setSafeTarget(t) { safeFor = SAFE_TARGETS[t] ? t : 'all'; }
export const safeTarget = () => safeFor;
/* The box layout, Tidy up, snapping and the guides use: the larger side margin on BOTH
   sides, so a centred composition stays on the frame's centre line and still clears the
   right-hand action rail (left / right above are the platforms' own, kept for reference). */
export function safeMargins(fmt) {
  if (fmt !== '9x16') return { top: 0.060, bottom: 0.060, left: 0.060, right: 0.060 };
  const t = SAFE_TARGETS[safeFor];
  const side = Math.max(t.left, t.right);
  return { ...t, left: side, right: side };
}
export function safeArea(fmt, W, H) {
  const m = safeMargins(fmt);
  return { x: W * m.left, y: H * m.top, w: W * (1 - m.left - m.right), h: H * (1 - m.top - m.bottom) };
}

/* --- text ---------------------------------------------------------------- */

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split(/\n/)) {
    if (!para.trim()) { out.push({ text: '', bullet: false }); continue; }
    const bullet = /^\s*[-•*]\s+/.test(para);
    const body = para.replace(/^\s*[-•*]\s+/, '');
    let line = '', first = true;
    for (const word of body.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push({ text: line, bullet: bullet && first, hang: bullet });
        line = word; first = false;
      } else line = test;
    }
    out.push({ text: line, bullet: bullet && first, hang: bullet });
  }
  return out;
}

/* Figma text styles: H1 Bitter SemiBold 72/90, body Poppins SemiBold 44/62.
   Semibold sans sets denser than the serif did, so the body line height comes
   in from 1.55 — at 1.55 a sans this heavy reads as a loose, airy list.
   `baseline` is where the baseline sits inside the line box. */
const BASE_TYPE = {
  h1:   { size: 72, weight: 600, family: 'Bitter, Georgia, serif',
          lh: 1.25, baseline: 0.26, bullet: 0.095, bulletY: 0.25 },
  // Poppins is a heavier colour with a taller x-height than Bitter, so the dot
  // grows and rides higher to stay optically centred on the lowercase.
  body: { size: 44, weight: 600, family: 'Poppins, system-ui, sans-serif',
          lh: 1.42, baseline: 0.30, bullet: 0.105, bulletY: 0.29 },
};

/* A brand can swap the type (`type` in brands.js); whatever it leaves out
   falls back to the Ask Ruth styles above. */
const fonts = (S, h1Scale, bodyScale) => {
  const own = (activeBrand() && activeBrand().type) || {};
  const style = (key, scale) => {
    const t = { ...BASE_TYPE[key], ...(own[key] || {}) };
    return { ...t, size: t.size * S * scale, css: (s) => `${t.weight} ${s}px ${t.family}` };
  };
  return { h1: style('h1', h1Scale), body: style('body', bodyScale) };
};

/** The active brand's base header / body sizes (px at a 1080 unit), before scale. */
export const baseTypeSizes = () => {
  const own = (activeBrand() && activeBrand().type) || {};
  return { h1: (own.h1 && own.h1.size) || BASE_TYPE.h1.size, body: (own.body && own.body.size) || BASE_TYPE.body.size };
};

/* Header and Body scale independently. Designs saved before that had one
   shared `scale`, so either one falls back to it and old templates render
   exactly as they did. */
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
export const h1ScaleOf = (state) => num(state.h1Scale) ?? num(state.scale) ?? 1;
export const bodyScaleOf = (state) => num(state.bodyScale) ?? num(state.scale) ?? 1;

/** Bullets hang outside the text column, so a bulleted block needs the room. */
const HANG = 0.55;
const hasBullet = (t) => /^[ \t]*[-•*][ \t]+/m.test(String(t));

const columnWidth = (W, H) => (W >= H ? W * 0.52 : W * 0.744);

/* --- text colours and cards ------------------------------------------------
   Header and Body each have a text colour and a card (the surface behind
   them). Left on Default, both follow the Text style switches exactly as
   before (Light/Dark + Text panel). A card colour picked by hand brings a
   readable default text colour with it; a text colour picked by hand wins.
   When Header and Body end up on different surfaces they get a card each. */
const DARK_PANELS = ['plum', 'ink', 'mauve'];

export function textLook(state, bd = byId(state.backdrop)) {
  const tone = state.textTone === 'auto' ? (bd.tone === 'dark' ? 'light' : 'dark') : state.textTone;
  const CARD = cardStyles();
  const BARE = bareStyles();
  const cardKey = state.card ? (tone === 'light' ? (DARK_PANELS.includes(bd.card) ? bd.card : 'plum') : 'cream') : 'none';
  const cardStyle = state.card ? CARD[cardKey] : null;
  const bare = tone === 'light' ? BARE.onDark : BARE.onLight;
  const onto = (bg) => (contrast(bg, '#ffffff') >= contrast(bg, '#000000') ? BARE.onDark : BARE.onLight);
  // no card by choice: the type reads against the background itself (a strong Dim darkens it)
  const dimmed = state.overlay && state.overlay.style !== 'none' && state.overlay.strength >= 0.35;
  const onGround = dimmed || bd.tone === 'dark' ? BARE.onDark : BARE.onLight;
  const part = (p) => {
    const pick = state.cardColors && state.cardColors[p];
    const bg = pick == null ? (cardStyle ? cardStyle.bg : null) : (pick === 'none' ? null : pick);
    const auto = pick == null ? (cardStyle ? cardStyle[p] : bare[p]) : (bg ? onto(bg)[p] : onGround[p]);
    const text = (state.textColors && state.textColors[p]) || auto;
    return { bg, text };
  };
  return { h1: part('h1'), body: part('body'), tone, cardStyle };
}

/* The text block hugs its text: as wide as its longest line, never wider
   than the safe area. Body copy keeps a readable measure (~26 em) even
   where the safe area is very wide (desktop). */
const maxTextWidth = (state, W, H) => safeArea(state.format, W, H).w;
const lineWidth = (ctx, lines, hang) => lines.reduce((m, l) => Math.max(m, ctx.measureText(l.text).width + (l.hang ? hang : 0)), 0);

/** A part's border: width in frame pixels (0 = none) and colour (default: its text colour). */
function borderOf(state, part, look, S) {
  const b = state.borders && state.borders[part];
  const w = b && Number(b.w) > 0 ? Number(b.w) * S : 0;
  return { w, c: (b && b.c) || look[part].text };
}

export function measureText(ctx, state, W, H, S) {
  const f = fonts(S, h1ScaleOf(state), bodyScaleOf(state));
  const maxW = maxTextWidth(state, W, H);
  const look = textLook(state);
  const PAD = 32 * S;
  const brd = { h1: borderOf(state, 'h1', look, S), body: borderOf(state, 'body', look, S) };
  // provisional: which parts sit on a card or in a border (decided for real once we know what shows)
  let padH1 = look.h1.bg || brd.h1.w ? PAD : 0, padBody = look.body.bg || brd.body.w ? PAD : 0;
  const pad = Math.max(padH1, padBody);
  const inner = maxW - pad * 2;

  const showH1 = state.visibility === 'both' || state.visibility === 'h1';
  // a Hook screen is the headline alone
  const showBody = state.visibility === 'both' || state.visibility === 'body';

  const h1Hang = f.h1.size * HANG;
  const bodyHang = f.body.size * HANG;

  let h1Lines = [], bodyLines = [];
  let h1W = 0, bodyW = 0;
  if (showH1 && state.h1.trim()) {
    ctx.font = f.h1.css(f.h1.size);
    h1Lines = wrap(ctx, state.h1, inner - (hasBullet(state.h1) ? h1Hang : 0));
    h1W = Math.ceil(lineWidth(ctx, h1Lines, h1Hang) + 2 * S);
  }
  if (showBody && state.body.trim()) {
    ctx.font = f.body.css(f.body.size);
    const measure = Math.min(inner, f.body.size * 26);
    bodyLines = wrap(ctx, state.body, measure - (hasBullet(state.body) ? bodyHang : 0));
    bodyW = Math.ceil(lineWidth(ctx, bodyLines, bodyHang) + 2 * S);
  }
  // Header and body are one text box: one card and one border round both
  // (the header's, or the body's when there is no header)
  const split = false;
  if (!split) {
    const lead = h1Lines.length ? 'h1' : 'body';
    padH1 = padBody = look[lead].bg || brd[lead].w ? PAD : 0;
  }
  const sharedPad = split ? 0 : padH1;
  // hug the text (a little room so the last glyph never touches the edge)
  const colW = Math.min(maxW, split
    ? Math.max(h1W + padH1 * 2, bodyW + padBody * 2)
    : Math.max(h1W, bodyW) + sharedPad * 2);

  const h1H = h1Lines.length * f.h1.size * f.h1.lh;
  const bodyH = bodyLines.length * f.body.size * f.body.lh;
  const both = h1Lines.length && bodyLines.length;
  const gap = both ? (split ? 18 * S : 24 * S) : 0;
  // where each part's text starts, from the top of the block
  let h1Top, bodyTop, h;
  if (split) {
    h1Top = padH1;
    bodyTop = padH1 * 2 + h1H + gap + padBody;
    h = bodyTop + bodyH + padBody;
  } else {
    h1Top = sharedPad;
    bodyTop = sharedPad + h1H + gap;
    h = h1H + gap + bodyH + sharedPad * 2;
  }

  /* Optical centring in the card / border: the space above the capitals of the
     first line equals the space under the baseline of the last line. (Line
     boxes carry the font's ascender room at the top and descender room at the
     bottom, so centring the boxes leaves the text sitting high.) Bare text
     isn't moved — only text inside a box. */
  const capOf = (ff) => { ctx.font = ff.css(ff.size); return ctx.measureText('H').actualBoundingBoxAscent || ff.size * 0.7; };
  const inkTop = (top, ff) => top + ff.size * ff.lh * (1 - ff.baseline) - capOf(ff);
  const inkBase = (top, n, ff) => top + n * ff.size * ff.lh - ff.size * ff.lh * ff.baseline;
  const centre = (boxTop, boxBot, t, b) => ((boxBot - b) - (t - boxTop)) / 2;
  let h1Dy = 0, bodyDy = 0;
  const boxed = (part) => !!(look[part].bg || brd[part].w);
  if (split) {
    if (h1Lines.length && boxed('h1')) h1Dy = centre(h1Top - padH1, h1Top + h1H + padH1, inkTop(h1Top, f.h1), inkBase(h1Top, h1Lines.length, f.h1));
    if (bodyLines.length && boxed('body')) bodyDy = centre(bodyTop - padBody, bodyTop + bodyH + padBody, inkTop(bodyTop, f.body), inkBase(bodyTop, bodyLines.length, f.body));
  } else if ((h1Lines.length || bodyLines.length) && sharedPad) {
    const t = h1Lines.length ? inkTop(h1Top, f.h1) : inkTop(bodyTop, f.body);
    const bt = bodyLines.length ? inkBase(bodyTop, bodyLines.length, f.body) : inkBase(h1Top, h1Lines.length, f.h1);
    h1Dy = bodyDy = centre(0, h, t, bt);
  }

  return { colW, pad: sharedPad, split, padH1, padBody, h1W, bodyW, h1Top, bodyTop, h1Dy, bodyDy, look, brd,
           f, h1Lines, bodyLines, gap, h1Hang, bodyHang, h1H, bodyH, h,
           empty: !h1Lines.length && !bodyLines.length };
}

/* --- badge ----------------------------------------------------------------
   The exported lockup sits at 657 / 1074 of the frame in the source design.
   ------------------------------------------------------------------------ */

/* --- the text badge ---------------------------------------------------------
   A badge whose three parts are all words: the upper pill ("Powered by"), a
   middle plate with your text (the brand's name by default), and the lower badge.
   The pill and the plate are set into an image shaped like the artwork badges,
   so everything else (upper text, lower badge, parts on / off, scale, extra
   badges, PNG export) treats it like any other badge. The plate hugs its text:
   longer words make a wider badge at the same type size. */
export const MIDDLE_DEFAULT = () => ({ text: null, ink: null, fill: null });
const TB = { P: 420, pill: 0.30, gap: 0.09 };              // plate height (px) and the pill / gap as shares of it
export const TEXT_BADGE_TOP = (TB.pill + TB.gap) / (1 + TB.pill + TB.gap);   // its logoTop
const tbCache = new Map();
export function middleColours(mid) {
  const tb = (activeBrand() && activeBrand().textBadge) || {};
  return { fill: mid.fill || tb.fill || '#4a0649', ink: mid.ink || tb.ink || '#ff8eff' };
}
export function middleText(mid) {
  const t = mid && mid.text != null ? String(mid.text) : '';
  return t.trim() || (activeBrand() && activeBrand().name) || 'Badge';
}
export function textBadgeImage(state) {
  const brand = activeBrand() || {};
  const mid = { ...MIDDLE_DEFAULT(), ...(state.badgeMiddle || {}) };
  const text = middleText(mid);
  const { fill, ink } = middleColours(mid);
  const tb = brand.textBadge || {};
  const fam = tb.family || (brand.cta && brand.cta.button && brand.cta.button.family) || 'Poppins, sans-serif';
  const wt = tb.weight || (brand.cta && brand.cta.button && brand.cta.button.weight) || 700;
  const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.status : '';
  const sig = [brand.id, text, fill, ink, fonts].join('|');
  if (tbCache.has(sig)) return tbCache.get(sig);
  const P = TB.P, pillH = P * TB.pill, gap = P * TB.gap;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const fs = P * 0.44;
  const font = `${wt} ${fs}px ${fam}`;
  g.font = font;
  const padX = P * 0.34;
  const tw = g.measureText(text).width;
  const pfs = pillH * 0.44, pfont = `500 ${pfs}px Poppins, sans-serif`;
  g.font = pfont;
  const pw = g.measureText('Powered by').width + pillH * 0.62;
  const plateW = Math.max(tw + padX * 2, P * 1.5, pw);
  c.width = Math.ceil(plateW); c.height = Math.ceil(pillH + gap + P);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  // the pill, in the plate's colour with light type, like the artwork's
  roundRect(x, 0, 0, pw, pillH, pillH * 0.27);
  x.fillStyle = fill; x.fill();
  x.font = pfont; x.fillStyle = tb.pillInk || '#ffffff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillText('Powered by', pillH * 0.31, capCentre(x, pillH / 2, pfs));
  // the plate and its words
  roundRect(x, 0, pillH + gap, c.width, P, P * 0.22);
  x.fillStyle = fill; x.fill();
  x.font = font; x.fillStyle = ink; x.textAlign = 'center';
  x.fillText(text, c.width / 2, capCentre(x, pillH + gap + P / 2, fs));
  c.naturalWidth = c.width; c.naturalHeight = c.height; c.plateH = P;
  if (tbCache.size > 60) tbCache.delete(tbCache.keys().next().value);
  tbCache.set(sig, c);
  return c;
}

/* v3.1 · Round portrait badges (brands.js `round: true` — Ada, Clara, Jimmy, R mark; never the
   grunge stickers) can be a speech BUBBLE (the lower-left corner square) and wear a HALO (a thin
   outline in a brand colour). Like the text badge, the result is a generated image the size of the
   artwork, pill included, so parts, scale, PNG and every export treat it as any badge.
   The portrait sits in a circle the full width of the file under the pill (`logoTop`); the corner
   the bubble adds is filled with the portrait's own edge colour. */
export const HALO_DEFAULT = () => ({ on: false, color: null });
const shapeCache = new Map();
let shapeImgId = 0;
const edgeColourCache = new WeakMap();
function edgeColour(image, cx, cy, r) {
  if (edgeColourCache.has(image)) return edgeColourCache.get(image);
  const c = document.createElement('canvas');
  c.width = image.naturalWidth || image.width; c.height = image.naturalHeight || image.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0);
  const counts = new Map();
  // the lower-left quarter of the rim, just inside the edge: the colour the corner continues
  for (let a = 10; a <= 80; a += 2) {
    const t = (a * Math.PI) / 180, k = 0.955;
    const x = Math.round(cx - r * k * Math.cos(t)), y = Math.round(cy + r * k * Math.sin(t));
    const d = g.getImageData(Math.max(0, Math.min(c.width - 1, x)), Math.max(0, Math.min(c.height - 1, y)), 1, 1).data;
    if (d[3] < 200) continue;
    const key = `#${[d[0], d[1], d[2]].map((v) => Math.min(255, Math.round(v / 12) * 12).toString(16).padStart(2, '0').slice(-2)).join('')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = '#000000', n = -1;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  edgeColourCache.set(image, best);
  return best;
}
/** How large a portrait sits inside its speech bubble (the rest is the bubble's own color). */
export const BUBBLE_INSET = 0.8;
export function shapedBadgeImage(image, def, state) {
  const shape = state.badgeShape === 'bubble' ? 'bubble' : 'round';
  const halo = { ...HALO_DEFAULT(), ...(state.badgeHalo || {}) };
  if (!image || !def || !def.round || (shape === 'round' && !halo.on)) return image;
  if (!image.__sid) image.__sid = ++shapeImgId;
  const haloColour = halo.color || (activeBrand() && activeBrand().haloColour) || '#2b6a83';
  const sig = [image.__sid, image.naturalWidth, shape, halo.on, haloColour].join('|');
  if (shapeCache.has(sig)) return shapeCache.get(sig);
  const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
  const top = Math.round(H * (def.logoTop || 0));
  // the portrait circle: the full width (less the file's ~1 % margin), from the pill down
  const m = W * 0.0097, d = W - m * 2, x0 = m, y0 = top, r = d / 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, W, top, 0, 0, W, top);       // the "Powered by" pill, as it is
  const path = () => {
    g.beginPath();
    if (shape === 'bubble' && g.roundRect) g.roundRect(x0, y0, d, d, [r, r, r, 0]);
    else if (shape === 'bubble') {
      g.moveTo(x0, y0 + r); g.arcTo(x0, y0, x0 + r, y0, r); g.arcTo(x0 + d, y0, x0 + d, y0 + r, r);
      g.arcTo(x0 + d, y0 + d, x0 + r, y0 + d, r); g.lineTo(x0, y0 + d); g.closePath();
    } else g.arc(x0 + r, y0 + r, r, 0, Math.PI * 2);
  };
  if (shape === 'bubble') {
    path();
    g.fillStyle = edgeColour(image, x0 + r, y0 + r, r);
    g.fill();
  }
  if (shape === 'bubble') {
    // v3.5: the portrait sits smaller inside the bubble, so the bubble shows around it
    const k = BUBBLE_INSET, dd = d * k, cx = x0 + r, cy = y0 + r;
    g.drawImage(image, x0, y0, d, Math.min(d, H - y0), cx - dd / 2, cy - dd / 2, dd, Math.min(d, H - y0) * k);
  } else g.drawImage(image, 0, top, W, H - top, 0, top, W, H - top);
  if (halo.on) {
    const lw = d * 0.026;
    g.save();
    path();
    g.clip();                                     // inside the edge, so the badge keeps its size
    path();
    g.lineWidth = lw * 2;
    g.strokeStyle = haloColour;
    g.stroke();
    g.restore();
  }
  c.naturalWidth = W; c.naturalHeight = H;
  if (shapeCache.size > 40) shapeCache.delete(shapeCache.keys().next().value);
  shapeCache.set(sig, c);
  return c;
}

export function measureBadge(state, W, H) {
  const set = badges();
  const fallback = Object.keys(set)[0];
  if (state.badge === 'none' || !fallback) return { key: 'none', image: null, w: 0, h: 0, offY: 0, crop: null };
  const key = set[state.badge] ? state.badge : fallback;
  const isText = set[key].kind === 'text';
  const image = isText ? textBadgeImage(state) : shapedBadgeImage(img(set[key].asset), set[key], state);
  const ratio = image ? (image.naturalWidth / image.naturalHeight) : 2.41;
  // `size` lets a tall badge (a round portrait) sit at a sensible width; a text
  // badge keeps its type size and grows with its words
  let w = isText
    ? unitOf(W, H) * U * 0.17 * (image.naturalWidth / image.plateH) * (state.badgeScale || 1)
    : unitOf(W, H) * U * (set[key].size || 0.612) * (state.badgeScale || 1);
  // long words: the text badge stays within the safe area's width (its type sets smaller)
  if (isText && state.format) w = Math.min(w, safeArea(state.format, W, H).w);
  // never wider or taller than the frame
  w *= fitScale(w, w / ratio, W, H);
  const fullH = w / ratio;

  /* Logo only: the lockup files carry the "Powered by" pill above the logo,
     so leave it out by drawing the file from `logoTop` down. The logo stays
     exactly where it was — only the label goes. */
  const top = state.badgePowered === false ? (set[key].logoTop || 0) : 0;
  if (!top || !image) return { key, image, w, h: fullH, offY: 0, crop: null };
  return {
    key, image, w,
    h: fullH * (1 - top),
    offY: fullH * top,
    crop: { sy: image.naturalHeight * top, sh: image.naturalHeight * (1 - top) },
  };
}

/* --- photo card -----------------------------------------------------------
   An uploaded image in a rounded container, sitting on the backdrop. The
   container takes the image's own aspect ratio, so nothing is cropped — the
   scale slider sizes the whole card.
   ------------------------------------------------------------------------ */

export function measureInset(state, W, H) {
  // hidden keeps the card (file, size, position) but takes it off the canvas and the export
  const id = state.inset && !state.inset.hidden && state.inset.id;
  const image = id ? imageFor(id) : null;
  if (!image) return { image: null, w: 0, h: 0, radius: 0 };

  const { w: iw, h: ih } = sizeOf(image);
  const pending = awaitingFrame(image);
  // a clip has no dimensions until it has metadata; hold a 16:9 card meanwhile
  if ((!iw || !ih) && !pending) return { image: null, w: 0, h: 0, radius: 0 };
  const ar = iw && ih ? ih / iw : 9 / 16;
  let w = unitOf(W, H) * U * 0.62 * (state.inset.scale || 1);
  w *= fitScale(w, w * ar, W, H);
  const h = w * ar;
  // radius runs 0 → square, 1 → fully rounded on the short side
  const r = Math.max(0, Math.min(1, state.inset.radius ?? 0.14));
  return { image, w, h, radius: (Math.min(w, h) / 2) * r, pending };
}


/* --- call to action --------------------------------------------------------
   The last screen of a sequence. Two treatments, both in the brand's own
   colours and type (`cta` in brands.js):
     button — an optional supporting line above a pill button with the action
     bold   — the action set big and heavy straight on the background, with the
              supporting line under it
   The header field holds the action, the body field the supporting line. */
const CTA_DEFAULT = {
  // radius: 0 = square corners … 1 = a pill (the brand default)
  button: { bg: '#ff8eff', ink: '#4a0649', family: 'Poppins, system-ui, sans-serif', weight: 700, upper: false, radius: 1 },
  bold:   { family: 'Bitter, Georgia, serif', weight: 700, upper: false },
};
const ctaOf = () => {
  const b = (activeBrand() && activeBrand().cta) || {};
  return { button: { ...CTA_DEFAULT.button, ...(b.button || {}) }, bold: { ...CTA_DEFAULT.bold, ...(b.bold || {}) } };
};

function measureCta(ctx, state, W, H, S) {
  const st = state.ctaStyle === 'bold' ? 'bold' : 'button';
  const brand = ctaOf()[st];
  const h1k = h1ScaleOf(state), bk = bodyScaleOf(state);
  const colW = Math.min(columnWidth(W, H) * 1.17, maxTextWidth(state, W, H));
  const showH1 = state.visibility === 'both' || state.visibility === 'h1';
  const showBody = state.visibility === 'both' || state.visibility === 'body';
  const action = showH1 ? String(state.h1 || '').trim() : '';
  const lineTxt = showBody ? String(state.body || '').trim() : '';
  const body = { size: 40 * S * bk, lh: 1.35, baseline: 0.3, bullet: 0.1, bulletY: 0.29,
                 css: (s) => `600 ${s}px Poppins, system-ui, sans-serif` };
  ctx.font = body.css(body.size);
  const lines = lineTxt ? wrap(ctx, lineTxt, colW) : [];
  const lineH = lines.length * body.size * body.lh;
  const text = brand.upper ? action.toUpperCase() : action;
  const gap = 28 * S;

  if (st === 'button') {
    /* the section's own button look (null = the brand's): colours, stroke,
       corners and scale. Stroke width is px at 1080 and is drawn outward. */
    const lk = state.ctaLook || {};
    const k = Math.max(0.5, Math.min(2, Number(lk.scale) || 1));
    const size = 50 * S * h1k * k;
    const css = (s) => `${brand.weight} ${s}px ${brand.family}`;
    ctx.font = css(size);
    const padX = 64 * S * k, padY = 34 * S * k;
    let bw = text ? ctx.measureText(text).width + padX * 2 : 0;
    let fs = size;
    if (bw > colW) { fs = size * (colW - padX * 2) / (bw - padX * 2); bw = colW; }
    const bh = text ? fs * 1.1 + padY * 2 : 0;
    const w = Math.max(bw, lines.length ? Math.min(colW, Math.max(...lines.map((l) => (ctx.font = body.css(body.size), ctx.measureText(l.text).width)))) : 0);
    const sw = Math.max(0, Number(lk.strokeW) || 0) * S;
    const btn = { fill: lk.fill || null, ink: lk.ink || null, stroke: lk.stroke && sw ? lk.stroke : null, sw,
                   radius: typeof lk.radius === 'number' ? Math.max(0, Math.min(1, lk.radius)) : brand.radius };
    return { cta: 'button', brand, btn, colW: w, pad: 0, body, lines, lineH, text, fs, css, bw, bh, gap,
             h: lineH + (lineH && bh ? gap : 0) + bh, empty: !text && !lines.length, h1Lines: [], bodyLines: [] };
  }
  const size = 112 * S * h1k;
  const f = { size, lh: 1.04, baseline: 0.22, bullet: 0.1, bulletY: 0.27, css: (s) => `${brand.weight} ${s}px ${brand.family}` };
  ctx.font = f.css(size);
  const big = text ? wrap(ctx, text, colW) : [];
  const bigH = big.length * size * f.lh;
  let hugW = lineWidth(ctx, big, 0);
  ctx.font = body.css(body.size);
  hugW = Math.min(colW, Math.ceil(Math.max(hugW, lineWidth(ctx, lines, 0)) + 2 * S));
  /* v3.2 · the words can sit in a box like any text: Style (Light / Dark / Custom) and
     "No background color" decide it. A CTA has no box until one is asked for (ctaBox),
     or a background colour is picked under Custom. */
  const own = state.cardColors && state.cardColors.h1;
  const look = textLook(state);
  const boxBg = (state.ctaBox || (own && own !== 'none')) && look.h1.bg ? look.h1.bg : null;
  const bpad = boxBg ? 32 * S : 0;
  return { cta: 'bold', brand, colW: (hugW || colW) + bpad * 2, pad: bpad, body, lines, lineH, big, f, bigH, gap,
           boxBg, boxInk: boxBg ? { h1: look.h1.text, body: look.body.text } : null,
           h: bigH + (bigH && lineH ? gap : 0) + lineH + bpad * 2, empty: !big.length && !lines.length, h1Lines: [], bodyLines: [] };
}

function drawCta(ctx, L, colors) {
  const { tx, txRect } = L;
  if (tx.empty) return;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if (tx.cta === 'button') {
    let y = txRect.y;
    ctx.textAlign = 'center';
    const cx = txRect.x + txRect.w / 2;
    if (tx.lines.length) {
      /* the supporting line rides on a small chip so it reads on any pattern —
         cream with dark type on light grounds, the brand's dark panel on dark */
      ctx.font = tx.body.css(tx.body.size);
      const lh = tx.body.size * tx.body.lh;
      const chipW = Math.max(...tx.lines.map((l) => ctx.measureText(l.text).width)) + tx.body.size * 1.2;
      const chipH = tx.lineH + tx.body.size * 0.5;
      roundRect(ctx, cx - chipW / 2, y - tx.body.size * 0.25, chipW, chipH, Math.min(chipH / 2, tx.body.size));
      ctx.fillStyle = tx.ground === 'dark' ? C.plum : C.cream;
      ctx.fill();
      ctx.fillStyle = tx.ground === 'dark' ? C.bodyOnDark : C.bodyOnLight;
      // the lines' ink (capitals to last baseline) centred in the chip
      const chipTop = y - tx.body.size * 0.25;
      const capH = ctx.measureText('H').actualBoundingBoxAscent || tx.body.size * 0.7;
      const firstBase = y + lh - lh * tx.body.baseline;
      const lastBase = firstBase + (tx.lines.length - 1) * lh;
      const dy = ((chipTop + chipH - lastBase) - (firstBase - capH - chipTop)) / 2;
      for (const line of tx.lines) {
        y += lh;
        ctx.fillText(line.text, cx, y - lh * tx.body.baseline + dy);
      }
      if (tx.bh) y += tx.gap;
    }
    if (tx.bh) {
      const x = cx - tx.bw / 2;
      const lk = tx.btn || {};
      const rad = (tx.bh / 2) * (typeof lk.radius === 'number' ? lk.radius : 1);
      if (lk.stroke) {
        // outward: a larger shape behind the button
        roundRect(ctx, x - lk.sw, y - lk.sw, tx.bw + lk.sw * 2, tx.bh + lk.sw * 2, rad ? rad + lk.sw : 0);
        ctx.fillStyle = lk.stroke;
        ctx.fill();
      }
      roundRect(ctx, x, y, tx.bw, tx.bh, rad);
      ctx.fillStyle = lk.fill || tx.brand.bg;
      ctx.fill();
      ctx.font = tx.css(tx.fs);
      // a picked button colour with no type colour of its own: the brand type that reads on it
      let ink = lk.ink || tx.brand.ink;
      if (!lk.ink && lk.fill && contrast(lk.fill, ink) < 3) {
        const opts = [tx.brand.ink, tx.brand.bg, '#ffffff', '#111111'];
        ink = opts.find((c) => contrast(lk.fill, c) >= 3) || '#ffffff';
      }
      ctx.fillStyle = ink;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(tx.text, cx, capCentre(ctx, y + tx.bh / 2, tx.fs));
    }
  } else {
    ctx.textAlign = 'left';
    const p = tx.pad || 0;
    const ink = tx.boxBg ? tx.boxInk : colors;
    if (tx.boxBg) {
      roundRect(ctx, txRect.x, txRect.y, txRect.w, tx.h, 36 * (p / 32));
      ctx.fillStyle = tx.boxBg;
      ctx.fill();
    }
    let y = drawLines(ctx, tx.big, tx.f, txRect.x + p, txRect.y + p, ink.h1, 0);
    if (tx.lines.length) {
      y += tx.gap;
      drawLines(ctx, tx.lines, tx.body, txRect.x + p, y, ink.body, 0);
    }
  }
  ctx.restore();
}

/* v4.1 · Luxury buttons — brand colours only (gradients between a brand's own colours), one
   version for light grounds and one for dark, every label ≥ 6 : 1 on every gradient stop.
   A fine ring 4 px outside, a soft tinted shadow (never black), a top highlight and an arrow chip. */
export const LUX = {
  askruth: { font: 'Bitter, Georgia, serif', weight: 700, upper: false, track: 0.01,
    light: { top: '#8c008f', bottom: '#4a0649', ink: '#ffdafe', ring: '#4a0649', ringA: 0.35, shadow: '#4a0649', shadowA: 0.35, hi: 0.22, chip: '#ff8eff', arrow: '#4a0649' },
    dark: { top: '#ffdafe', bottom: '#ff8eff', ink: '#4a0649', ring: '#ff8eff', ringA: 0.5, shadow: '#ff8eff', shadowA: 0.35, hi: 0.6, chip: '#4a0649', arrow: '#ff8eff' } },
  moshpit: { font: "Roboto, 'Arial Black', system-ui, sans-serif", weight: 900, upper: true, track: 0.08,
    light: { top: '#262624', bottom: '#1a1915', ink: '#0bb8d9', ring: '#1a1915', ringA: 0.4, shadow: '#1a1915', shadowA: 0.4, hi: 0.12, chip: '#0bb8d9', arrow: '#1a1915' },
    dark: { top: '#0bb8d9', bottom: '#09a6c4', ink: '#1a1915', ring: '#0bb8d9', ringA: 0.55, shadow: '#0bb8d9', shadowA: 0.3, hi: 0.45, chip: '#1a1915', arrow: '#0bb8d9' } },
  t4r: { font: 'Poppins, system-ui, sans-serif', weight: 600, upper: false, track: 0.02,
    light: { top: '#2d2d6b', bottom: '#0e253f', ink: '#ffffff', ring: '#0e253f', ringA: 0.3, shadow: '#0e253f', shadowA: 0.3, hi: 0.18, chip: '#03d5ff', arrow: '#0e253f' },
    dark: { top: '#03d5ff', bottom: '#03d5ff', ink: '#0e253f', ring: '#03d5ff', ringA: 0.5, shadow: '#03d5ff', shadowA: 0.35, hi: 0.55, chip: '#0e253f', arrow: '#03d5ff' } },
};
const luxOf = () => LUX[(activeBrand() && activeBrand().id) || 'askruth'] || LUX.askruth;
const rgba = (hex, a) => { const n = hex.replace('#', ''); return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}, ${a})`; };
const lumOf = (hex) => { const n = String(hex || '').replace('#', ''); if (n.length < 6) return 0; const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
/** Light or dark ground under a button: from the background's base colour. */
const groundOf = (base) => (/^#[0-9a-f]{6}$/i.test(base || '') && lumOf(base) > 0.35 ? 'light' : 'dark');
function paintLux(ctx, x, y, w, h, m, base) {
  const L = luxOf(), P = L[groundOf(base)];
  const S = m.S || 1;
  const top = m.fill || P.top, bottom = m.fill || P.bottom, ink = m.ink || P.ink;
  const r = h / 2 * (typeof m.radius === 'number' ? m.radius : 1);
  ctx.save();
  // ring, 4 px outside
  const o = 4 * S * m.k;
  roundRect(ctx, x - o, y - o, w + o * 2, h + o * 2, r ? r + o : 0);
  ctx.lineWidth = Math.max(1, 1.4 * S); ctx.strokeStyle = rgba(P.ring, P.ringA); ctx.stroke();
  // body with a soft tinted shadow
  ctx.shadowColor = rgba(P.shadow, P.shadowA); ctx.shadowBlur = 26 * S * m.k; ctx.shadowOffsetY = 10 * S * m.k;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bottom);
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  // top highlight
  ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = `rgba(255, 255, 255, ${P.hi})`; ctx.fillRect(x, y, w, Math.max(1, 1.6 * S));
  ctx.restore();
  // label
  ctx.font = m.css(m.fs); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(L.track * m.fs).toFixed(2)}px`;
  ctx.fillText(m.text, x + m.padL, capCentre(ctx, y + h / 2, m.fs));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // arrow chip
  const d = m.chip, cx = x + w - m.padR - d / 2, cy = y + h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fillStyle = P.chip; ctx.fill();
  ctx.strokeStyle = P.arrow; ctx.lineWidth = Math.max(1.5, d * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const a = d * 0.24;
  ctx.beginPath(); ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy); ctx.moveTo(cx + a * 0.2, cy - a * 0.8); ctx.lineTo(cx + a, cy); ctx.lineTo(cx + a * 0.2, cy + a * 0.8); ctx.stroke();
  ctx.restore();
}

/** One button: the brand's button type and colours unless the button has its own. */
function measureButton(ctx, b, W, H, S, sa) {
  const text = String(b.text || '').trim();
  if (!text) return null;
  const brand = ctaOf().button;
  const lk = b.look || {};
  const k = Math.max(0.5, Math.min(2, Number(lk.scale) || 1));
  const size = 50 * S * k;
  const css = (s) => `${brand.weight} ${s}px ${brand.family}`;
  ctx.font = css(size);
  const padX = 64 * S * k, padY = 34 * S * k;
  const t = brand.upper ? text.toUpperCase() : text;
  let bw = ctx.measureText(t).width + padX * 2;
  let fs = size;
  const max = sa.w;
  if (bw > max) { fs = size * (max - padX * 2) / (bw - padX * 2); bw = max; }
  const bh = fs * 1.1 + padY * 2;
  const sw = Math.max(0, Number(lk.strokeW) || 0) * S;
  if (lk.style === 'luxury') {
    const L = luxOf();
    const lt = L.upper ? text.toUpperCase() : text;
    const lsize = size * (L.upper ? 0.86 : 1.02);
    const lcss = (s2) => `${L.weight} ${s2}px ${L.font}`;
    ctx.font = lcss(lsize);
    const tw = ctx.measureText(lt).width * (1 + L.track);
    const padL = 60 * S * k, padR = 14 * S * k, gap = 22 * S * k;
    let lfs = lsize;
    const chip0 = lsize * 1.9;
    let lbw = padL + tw + gap + chip0 + padR;
    if (lbw > max) { const kk = (max - padL - gap - padR - chip0) / tw; lfs = lsize * Math.max(0.5, kk); lbw = max; }
    const chip = Math.min(chip0, lfs * 1.9);
    const lbh = Math.max(lfs * 1.1 + padY * 1.6, chip + padR * 2);
    return { lux: true, text: lt, fs: lfs, css: lcss, bw: lbw, bh: lbh, brand, padL, padR, chip, S, k,
      fill: lk.fill || null, ink: lk.ink || null, stroke: null, sw: 0,
      radius: typeof lk.radius === 'number' ? Math.max(0, Math.min(1, lk.radius)) : 1 };
  }
  return {
    text: t, fs, css, bw, bh, brand,
    fill: lk.fill || null, ink: lk.ink || null, stroke: lk.stroke && sw ? lk.stroke : null, sw,
    radius: typeof lk.radius === 'number' ? Math.max(0, Math.min(1, lk.radius)) : brand.radius,
  };
}

/** The baseline that puts a line's capitals in the vertical middle of `mid` —
    optical centring for buttons ('middle' centres the font's em box, which
    leaves capitals sitting high). Uses the font already set on ctx. */
function capCentre(ctx, mid, fs) {
  const cap = ctx.measureText('H').actualBoundingBoxAscent || fs * 0.7;
  return mid + cap / 2;
}

/** A standard button's colours and corner radius as drawn on `base` (shared by drawButton and
    the PowerPoint export, so both use the same colours). Luxury buttons are painted, not filled. */
export function buttonPaint(btn, base) {
  const { m } = btn;
  let fill = m.fill || m.brand.bg, ink = m.ink || m.brand.ink;
  // the brand's own colours swap when the button would vanish into its background
  if (!m.fill && !m.ink && base && /^#[0-9a-f]{6}$/i.test(base) && contrast(m.brand.bg, base) < 1.7) {
    fill = m.brand.ink; ink = m.brand.bg;
  }
  // a picked fill with no type colour of its own: a type colour that reads on it
  if (m.fill && !m.ink && contrast(fill, ink) < 3) {
    ink = [m.brand.ink, m.brand.bg, '#ffffff', '#111111'].find((c) => contrast(fill, c) >= 3) || '#ffffff';
  }
  const rad = (m.bh / 2) * (typeof m.radius === 'number' ? m.radius : 1);
  return { fill, ink, rad, stroke: m.stroke, sw: m.sw };
}

function drawButton(ctx, btn, base) {
  const { m, rect } = btn;
  if (m.lux) { paintLux(ctx, rect.x, rect.y, m.bw, m.bh, m, base); return; }
  const { fill, ink, rad } = buttonPaint(btn, base);
  ctx.save();
  if (m.stroke) {
    roundRect(ctx, rect.x - m.sw, rect.y - m.sw, m.bw + m.sw * 2, m.bh + m.sw * 2, rad ? rad + m.sw : 0);
    ctx.fillStyle = m.stroke;
    ctx.fill();
  }
  roundRect(ctx, rect.x, rect.y, m.bw, m.bh, rad);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.font = m.css(m.fs);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(m.text, rect.x + m.bw / 2, capCentre(ctx, rect.y + m.bh / 2, m.fs));
  ctx.restore();
}

/* --- the badge as three parts --------------------------------------------
   Upper badge (the "Powered by" pill, from the lockup file above `logoTop`),
   badge image (the file from `logoTop` down) and lower badge (a text box
   drawn here). Each shows or hides on its own; hidden parts take no room, so
   the visible ones close up. The image stays where it always was: the stack is
   anchored at the top of the lockup (pos.watermark). */
export const LOWER_DEFAULT = () => ({ on: false, text: null, ink: null, fill: null, stroke: null, strokeOn: false, strokeW: 3, scale: 1 });
export const LOWER_STROKE_MAX = 12;   // px at 1080 — thicker starts to swallow the box

/** The lower badge's colours in effect: its own, or the brand's button colours. */
export function lowerColours(lo) {
  const brand = ctaOf().button;
  const fill = lo.fill == null ? brand.bg : lo.fill;              // 'none' = no background
  const ink = lo.ink || (fill === 'none' ? brand.bg : brand.ink);
  const stroke = lo.stroke || (fill === 'none' ? brand.bg : brand.ink);
  return { fill, ink, stroke };
}

/* Where the "Powered by" pill sits in a badge file (as fractions of the file):
   read once from its pixels — the first opaque run of rows from the top, and its
   left / right edge — so the lower badge can match its size and line up with it. */
const pillCache = new WeakMap();
function pillOf(image, lt) {
  if (!image || !lt) return null;
  if (pillCache.has(image)) return pillCache.get(image);
  let out = null;
  try {
    const w = Math.min(800, image.naturalWidth);
    const h = Math.max(1, Math.round(image.naturalHeight * w / image.naturalWidth * lt));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * lt, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let y0 = -1, y1 = -1, x0 = w, x1 = -1;
    for (let y = 0; y < h; y++) {
      let any = false;
      for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      if (any && y0 < 0) y0 = y;
      if (any) y1 = y;
      else if (y0 >= 0) break;          // the gap under the pill
    }
    if (y0 >= 0) {
      const fullH = image.naturalHeight * w / image.naturalWidth;
      out = { y: y0 / fullH, h: (y1 - y0 + 1) / fullH, x: x0 / w, w: (x1 - x0 + 1) / w };
      /* Its colours and its text: the most common solid colour is the pill, the
         pixels well away from it are the "Powered by" — their box tells where the
         text sits and how big it is, so a different label can be set the same way. */
      const hist = new Map();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 220) continue;
        const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
        const e = hist.get(k) || [0, 0, 0, 0];
        e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2];
        hist.set(k, e);
      }
      const top = [...hist.values()].sort((a, b) => b[0] - a[0])[0];
      if (top) {
        const fill = [top[1] / top[0], top[2] / top[0], top[3] / top[0]];
        let ix0 = w, ix1 = -1, iy0 = h, iy1 = -1, n = 0;
        const sum = [0, 0, 0];
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] < 220) continue;
          const dist = Math.hypot(d[i] - fill[0], d[i + 1] - fill[1], d[i + 2] - fill[2]);
          if (dist < 70) continue;
          if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
          if (dist > 140) { n++; sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
        }
        const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
        out.fill = hex(fill);
        if (ix1 >= ix0 && n) {
          out.ink = hex(sum.map((v) => v / n));
          out.text = { x: ix0 / w, w: (ix1 - ix0 + 1) / w, y: iy0 / fullH, h: (iy1 - iy0 + 1) / fullH };
        }
      }
    }
  } catch (_) { out = null; }
  pillCache.set(image, out);
  return out;
}

function measureLower(ctx, state, full, lt, W, S) {
  const lo = { ...LOWER_DEFAULT(), ...(state.badgeLower || {}) };
  const text = lo.text == null ? ((activeBrand() && activeBrand().name) || '') : String(lo.text);
  if (!lo.on || !text.trim()) return null;
  const brand = ctaOf().button;
  const k = Math.max(0.5, Math.min(2, Number(lo.scale) || 1));
  // sized like the "Powered by" pill of the badge in use (a lockup without one: from its width)
  const pill = pillOf(full.image, lt);
  const pillH = pill ? full.h * pill.h : lt > 0 ? full.h * lt * 0.62 : full.w * 0.11;
  let fs = pillH * 0.48 * k;
  const css = (z) => `${brand.weight} ${z}px ${brand.family}`;
  ctx.font = css(fs);
  const padX = pillH * 0.42 * k, padY = pillH * 0.26 * k;
  let tw = ctx.measureText(text.trim()).width;
  const max = W * 0.9 - padX * 2;
  if (tw > max) { fs *= max / tw; tw = max; ctx.font = css(fs); }
  const sw = lo.strokeOn ? Math.max(0, Math.min(LOWER_STROKE_MAX, Number(lo.strokeW) || 0)) * S : 0;
  const c = lowerColours(lo);
  return {
    text: text.trim(), fs, css, w: tw + padX * 2, h: fs * 1.12 + padY * 2,
    r: pillH * 0.27 * k, sw, ...c,
  };
}

/* The upper badge with your own words: the artwork's "Powered by" pill, set
   again — same height, colours, type size, left edge and padding — around the
   new text. The default label (empty, or "Powered by") is the artwork itself. */
export const UPPER_DEFAULT_TEXT = 'Powered by';
const UPPER_FONT = (z) => `500 ${z}px Poppins, sans-serif`;
function measureUpper(ctx, state, full, lt) {
  const text = String(state.badgeUpper || '').trim();
  if (!text || text === UPPER_DEFAULT_TEXT) return null;
  const pill = pillOf(full.image, lt);
  if (!pill || !pill.text || !pill.ink) return null;
  const ph = full.h * pill.h, pw = full.w * pill.w;
  const inkTop = full.h * (pill.text.y - pill.y), inkH = full.h * pill.text.h;
  // the type size that gives the artwork's "Powered by" its ink height (cap top to descender)
  ctx.font = UPPER_FONT(100);
  const m = ctx.measureText(UPPER_DEFAULT_TEXT);
  const unit = ((m.actualBoundingBoxAscent || 72) + (m.actualBoundingBoxDescent || 22)) / 100;
  const fs = inkH / unit;
  ctx.font = UPPER_FONT(fs);
  const padL = full.w * (pill.text.x - pill.x);
  const padR = Math.max(0, pw - padL - full.w * pill.text.w);
  const asc = ctx.measureText(UPPER_DEFAULT_TEXT).actualBoundingBoxAscent || fs * 0.72;
  const tw = ctx.measureText(text).width;
  return { text, fs, font: UPPER_FONT(fs), w: padL + tw + padR, h: ph, padL, base: inkTop + asc, r: ph * 0.27, fill: pill.fill, ink: pill.ink };
}

/* More badges: a section can carry extra badges besides its own, each with its
   own choice, scale and upper label, placed on its own (x = centre, y = the top
   of its lockup, like the first). They are drawn like the first badge. */
export const BADGE_ITEM = () => ({ id: '', badge: null, scale: 0.8, powered: true, upper: null, lower: null, x: 0.5, y: 0.3 });
export function badgeStateOf(state, b) {
  return {
    ...state, badge: b.badge, badgeScale: Number(b.scale) || 1, badgePowered: b.powered !== false,
    badgeImage: true, badgeUpper: b.upper == null ? null : b.upper,
    badgeLower: { ...LOWER_DEFAULT(), ...(b.lower || {}) },
    badgeMiddle: b.middle || null,
    badgeShape: b.shape === 'bubble' ? 'bubble' : 'round', badgeHalo: b.halo || null,   // v3.1: each badge its own
  };
}

function badgeComposition(ctx, state, wm, wmPos, W, H, S) {
  if (!wm.image) return null;
  const key = wm.key;
  const set = badges();
  const lt = (set[key] && set[key].logoTop) || 0;
  const full = measureBadge({ ...state, badge: key, badgePowered: true }, W, H);
  const showUpper = state.badgePowered !== false && lt > 0;
  const showImage = state.badgeImage !== false;
  const low = measureLower(ctx, state, full, lt, W, S);
  const X0 = wmPos.x * W - full.w / 2, Y0 = wmPos.y * H;
  const topH = full.h * lt;
  const pill = pillOf(full.image, lt);
  const pillH = pill ? full.h * (pill.y + pill.h) : topH * 0.66;   // the pill itself; the rest of topH is its gap
  const parts = {};
  const up = showUpper ? measureUpper(ctx, state, full, lt) : null;
  if (showUpper) parts.upper = pill
    ? { x: X0 + full.w * pill.x, y: Y0 + full.h * pill.y, w: up ? up.w : full.w * pill.w, h: full.h * pill.h }
    : { x: X0, y: Y0, w: full.w, h: pillH };
  if (showImage) parts.image = { x: X0, y: Y0 + topH, w: full.w, h: full.h - topH };
  if (low) {
    const gap = Math.max(topH - pillH, full.w * 0.03);
    const y = showImage ? Y0 + full.h + gap : Y0 + topH;
    // under the image: centred on it; without the image: lined up with the pill
    const x = !showImage && pill ? X0 + full.w * pill.x : X0 + full.w / 2 - low.w / 2;
    parts.lower = { x, y, w: low.w, h: low.h };
  }
  const list = Object.values(parts);
  if (!list.length) return { full, lt, low, up, parts, rect: null, offY: 0 };
  const x0 = Math.min(...list.map((r) => r.x)), y0 = Math.min(...list.map((r) => r.y));
  const x1 = Math.max(...list.map((r) => r.x + r.w)), y1 = Math.max(...list.map((r) => r.y + r.h));
  const rect = clampRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, W, H);
  const dx = rect.x - x0, dy = rect.y - y0;
  for (const r of list) { r.x += dx; r.y += dy; }
  // where the image (the full lockup's frame) sits after the clamp, for drawing
  return { full, lt, low, up, parts, rect, offY: y0 - Y0, frame: { x: X0 + dx, y: Y0 + dy } };
}

function drawBadge(ctx, L) {
  const b = L.badge;
  if (!b || !b.rect) return;
  const { full, lt, parts, low, up, frame } = b;
  const img = full.image;
  if (parts.upper && up) {
    // your own words, set in the artwork's pill
    const r = parts.upper;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, up.r);
    ctx.fillStyle = up.fill;
    ctx.fill();
    ctx.font = up.font;
    ctx.fillStyle = up.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(up.text, r.x + up.padL, r.y + up.base);
    ctx.restore();
  }
  if (img) {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (parts.upper && !up) ctx.drawImage(img, 0, 0, nw, nh * lt, frame.x, frame.y, full.w, full.h * lt);
    if (parts.image) ctx.drawImage(img, 0, nh * lt, nw, nh * (1 - lt), frame.x, frame.y + full.h * lt, full.w, full.h * (1 - lt));
  }
  if (parts.lower && low) {
    const r = parts.lower;
    ctx.save();
    if (low.fill !== 'none') {
      roundRect(ctx, r.x, r.y, r.w, r.h, low.r);
      ctx.fillStyle = low.fill;
      ctx.fill();
    }
    if (low.sw > 0) {
      // drawn outward, like the buttons' stroke: the box keeps its size
      const i = low.sw / 2;
      roundRect(ctx, r.x - i, r.y - i, r.w + low.sw, r.h + low.sw, low.r + i);
      ctx.lineWidth = low.sw;
      ctx.strokeStyle = low.stroke;
      ctx.stroke();
    }
    ctx.font = low.css(low.fs);
    ctx.fillStyle = low.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(low.text, r.x + r.w / 2, capCentre(ctx, r.y + r.h / 2, low.fs));
    ctx.restore();
  }
}

/* --- layout -------------------------------------------------------------- */

export function layout(ctx, state, W, H) {
  const S = unitOf(W, H);
  const bd = byId(state.backdrop);
  const badgeKey = state.badge === 'auto' ? bd.badge : state.badge;
  const wm = measureBadge({ ...state, badge: badgeKey }, W, H);
  // Big type in a short frame: set it smaller until the block fits the frame.
  const measure = state.sceneRole === 'cta' ? measureCta : measureText;
  let tx = measure(ctx, state, W, H, S);
  for (let k = S, i = 0; tx.h > H * FIT && i < 8; i++) {
    k *= Math.max(0.5, (H * FIT) / tx.h) * 0.99;
    tx = measure(ctx, state, W, H, k);
  }

  const ins = measureInset(state, W, H);

  const pos = state.pos[state.format];
  const wmPos = pos.watermark;
  const txPos = pos.text;
  const inPos = pos.inset || { x: 0.5, y: 0.5 };

  // every block stays inside the frame, wherever it was dragged in another format
  // the text block stays inside the safe area (inside the frame if it is taller than that)
  const sa = safeArea(state.format, W, H);
  const txRect = clampRect({ x: txPos.x * W - tx.colW / 2, y: txPos.y * H, w: tx.colW, h: tx.h }, W, H);
  // v3.1: …unless you dragged it there yourself (`free`): the safe area is advice, the frame is the limit
  if (!txPos.free) {
    txRect.x = Math.max(sa.x, Math.min(sa.x + sa.w - txRect.w, txRect.x));
    if (txRect.h <= sa.h) txRect.y = Math.max(sa.y, Math.min(sa.y + sa.h - txRect.h, txRect.y));
  }

  /* Where the header and the body each sit inside the text block — used to
     tell which one was tapped, and where to put the editor over it. */
  const parts = tx.cta ? { h1: null, body: null } : {   // a CTA is edited in the panel
    h1: tx.h1Lines.length
      ? { x: txRect.x + tx.padH1, y: txRect.y + tx.h1Top + (tx.h1Dy || 0), w: tx.colW - tx.padH1 * 2, h: tx.h1H } : null,
    body: tx.bodyLines.length
      ? { x: txRect.x + tx.padBody, y: txRect.y + tx.bodyTop + (tx.bodyDy || 0), w: tx.colW - tx.padBody * 2, h: tx.bodyH } : null,
  };

  /* More text: any extra header-and-body blocks on this screen, each set like
     the main one (same type, colours, switches), each placed on its own. */
  const extras = (Array.isArray(state.blocks) ? state.blocks : []).map((b) => {
    // a block's own style (Light / Dark, panel, colours, border) — or the first text's
    const own = b.style ? { ...state, ...b.style } : state;
    const t = measureText(ctx, { ...own, h1: String(b.h1 || ''), body: String(b.body || '') }, W, H, S);
    if (t.empty) return null;
    const r = clampRect({ x: (b.x ?? 0.5) * W - t.colW / 2, y: (b.y ?? 0.7) * H, w: t.colW, h: t.h }, W, H);
    if (!b.free) {
      r.x = Math.max(sa.x, Math.min(sa.x + sa.w - r.w, r.x));
      if (r.h <= sa.h) r.y = Math.max(sa.y, Math.min(sa.y + sa.h - r.h, r.y));
    }
    return {
      id: b.id, tx: t, txRect: r,
      parts: {
        h1: t.h1Lines.length ? { x: r.x + t.padH1, y: r.y + t.h1Top + (t.h1Dy || 0), w: t.colW - t.padH1 * 2, h: t.h1H } : null,
        body: t.bodyLines.length ? { x: r.x + t.padBody, y: r.y + t.bodyTop + (t.bodyDy || 0), w: t.colW - t.padBody * 2, h: t.bodyH } : null,
      },
    };
  }).filter(Boolean);

  /* Buttons: their own elements (made under Buttons, never from the text), each
     placed on its own — x is the centre, y the top, like the extra text. */
  const buttons = (Array.isArray(state.buttons) ? state.buttons : []).map((b) => {
    const m = measureButton(ctx, b, W, H, S, sa);
    if (!m) return null;
    const r = clampRect({ x: (b.x ?? 0.5) * W - m.bw / 2, y: (b.y ?? 0.75) * H, w: m.bw, h: m.bh }, W, H);
    if (!b.free) {
      r.x = Math.max(sa.x, Math.min(sa.x + sa.w - r.w, r.x));
      if (r.h <= sa.h) r.y = Math.max(sa.y, Math.min(sa.y + sa.h - r.h, r.y));
    }
    return { id: b.id, m, rect: r };
  }).filter(Boolean);

  /* More media: further photos / videos on this section, each placed and sized on
     its own (x is the centre, y the top), drawn like the first one. */
  const media = (Array.isArray(state.media) ? state.media : []).map((m) => {
    const ms = measureInset({ inset: { id: m.src, scale: m.scale ?? 0.6, radius: m.radius ?? 0.14, hidden: false } }, W, H);
    if (!ms.image) return null;
    const rect = clampRect({ x: (m.x ?? 0.5) * W - ms.w / 2, y: (m.y ?? 0.3) * H, w: ms.w, h: ms.h }, W, H);
    return { id: m.id, ins: ms, insRect: rect };
  }).filter(Boolean);

  const xbadges = (Array.isArray(state.badges) ? state.badges : []).map((b) => {
    const set = badges();
    const key = set[b.badge] ? b.badge : Object.keys(set)[0];
    if (!key) return null;
    const bs = badgeStateOf(state, { ...b, badge: key });
    const wmB = measureBadge(bs, W, H);
    const comp = badgeComposition(ctx, bs, wmB, { x: b.x ?? 0.5, y: b.y ?? 0.3 }, W, H, S);
    return comp && comp.rect ? { id: b.id, badge: comp, rect: comp.rect } : null;
  }).filter(Boolean);

  // the badge as up to three parts; wm / wmRect describe what is visible of it,
  // so selecting, dragging and snapping work on the visible stack
  const badge = badgeComposition(ctx, state, wm, wmPos, W, H, S);
  let wmL = wm, wmRect = clampRect({ x: wmPos.x * W - wm.w / 2, y: wmPos.y * H + wm.offY, w: wm.w, h: wm.h }, W, H);
  if (badge) {
    if (badge.rect) { wmL = { ...wm, offY: badge.offY, w: badge.rect.w, h: badge.rect.h }; wmRect = { ...badge.rect }; }
    else wmL = { ...wm, image: null, w: 0, h: 0 };
  }

  // v3.1 · drawings: each a group of strokes, centred at x / y, in short-side units
  const drawings = (Array.isArray(state.drawings) ? state.drawings : []).map((d) => {
    const b = drawingBounds(d, W, H);
    return b ? { id: d.id, d, rect: b } : null;
  }).filter(Boolean);

  return {
    S, wm: wmL, badge, tx, ins, parts, extras, buttons, media, xbadges, drawings,
    wmRect,
    txRect,
    insRect: clampRect({ x: inPos.x * W - ins.w / 2, y: inPos.y * H, w: ins.w, h: ins.h }, W, H),
  };
}

/* --- drawing ------------------------------------------------------------- */

/* v3.1 · Drawing: quick human marks — pen, highlighter, line, arrow, ellipse.
   A drawing is { id, x, y (its centre, as a share of the frame), s (scale), color, width,
   opacity, strokes: [{ t, p: [[x, y], …], c?, w? }] } (a stroke's own colour / width while drawn;
   the panel sets them for the whole drawing) with points in thousandths of the frame's
   short side around the centre, so it keeps its shape in every format. Width is in the
   same unit. The highlighter is wider and see-through; shapes keep their geometry, a pen
   line keeps its wobble (only smoothed between samples). */
export const DRAW_TOOLS = ['pen', 'hl', 'line', 'arrow', 'ellipse'];
const drawUnitOf = (W, H) => Math.min(W, H) / 1000;
export function drawingPoint(d, pt, W, H) {
  const k = drawUnitOf(W, H) * (d.s || 1);
  return [d.x * W + pt[0] * k, d.y * H + pt[1] * k];
}
export function strokeWidth(d, st, W, H) {
  return Math.max(0.5, (st.w || d.width || 10) * drawUnitOf(W, H) * (d.s || 1) * (st.t === 'hl' ? 3.2 : 1));
}
export function drawingBounds(d, W, H) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pad = 0;
  for (const st of d.strokes || []) {
    pad = Math.max(pad, strokeWidth(d, st, W, H) / 2 + (st.t === 'arrow' ? strokeWidth(d, st, W, H) * 2.2 : 0));
    for (const p of st.p || []) {
      const [x, y] = drawingPoint(d, p, W, H);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (!isFinite(x0)) return null;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}
/** One stroke, in canvas pixels already (`pts`), with the drawing's look. */
export function paintStroke(ctx, st, pts, look) {
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, look.opacity ?? 1)) * (st.t === 'hl' ? 0.38 : 1);
  ctx.strokeStyle = look.color || '#ffffff';
  ctx.fillStyle = look.color || '#ffffff';
  ctx.lineWidth = look.lw;
  ctx.lineCap = st.t === 'hl' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const a = pts[0], b = pts[pts.length - 1];
  if (st.t === 'ellipse' && pts.length > 1) {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    ctx.ellipse(cx, cy, Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if ((st.t === 'line' || st.t === 'arrow') && pts.length > 1) {
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    if (st.t === 'arrow') {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const len = Math.max(look.lw * 3.2, 10);
      ctx.beginPath();
      ctx.moveTo(b[0] - len * Math.cos(ang - 0.5), b[1] - len * Math.sin(ang - 0.5));
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0] - len * Math.cos(ang + 0.5), b[1] - len * Math.sin(ang + 0.5));
      ctx.stroke();
    }
  } else if (pts.length === 1) {
    ctx.arc(a[0], a[1], look.lw / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // pen / highlighter: through the midpoints, so samples join without corners
    ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}
/* v3.21 · a drawing can draw itself on: `prog` (0–1) is how much of its ink is down, stroke by stroke
   in the order they were drawn — a pen stroke grows along its path, a line or arrow from its start
   (the head rides the tip), a circle sweeps round. */
const segLen = (pts) => { let n = 0; for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return n; };
function strokeLen(st, pts) {
  if (pts.length < 2) return 1;
  const a = pts[0], b = pts[pts.length - 1];
  if (st.t === 'ellipse') { const rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2; return Math.max(1, Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))); }
  if (st.t === 'line' || st.t === 'arrow') return Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
  return Math.max(1, segLen(pts));
}
function partStroke(ctx, st, pts, look, f) {
  if (f >= 1) { paintStroke(ctx, st, pts, look); return; }
  if (f <= 0 || !pts.length) return;
  const a = pts[0], b = pts[pts.length - 1];
  if (st.t === 'ellipse' && pts.length > 1) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, look.opacity ?? 1));
    ctx.strokeStyle = look.color || '#ffffff'; ctx.lineWidth = look.lw; ctx.lineCap = 'round';
    ctx.beginPath();
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    ctx.ellipse(cx, cy, Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if ((st.t === 'line' || st.t === 'arrow') && pts.length > 1) {
    paintStroke(ctx, st, [a, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]], look);
    return;
  }
  // pen / highlighter: the points up to this length, the last one cut where the ink stops
  const want = segLen(pts) * f, out = [pts[0]];
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run + l >= want) { const k = l ? (want - run) / l : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]); break; }
    run += l;
    out.push(pts[i]);
  }
  paintStroke(ctx, st, out, look);
}
export function drawDrawing(ctx, d, W, H, prog = 1) {
  const strokes = (d.strokes || []).map((st) => ({ st, pts: (st.p || []).map((p) => drawingPoint(d, p, W, H)) }));
  if (prog >= 1) {
    for (const { st, pts } of strokes) paintStroke(ctx, st, pts, { color: st.c || d.color, opacity: d.opacity, lw: strokeWidth(d, st, W, H) });
    return;
  }
  if (prog <= 0) return;
  const lens = strokes.map(({ st, pts }) => strokeLen(st, pts));
  let left = lens.reduce((a, b) => a + b, 0) * prog;
  strokes.forEach(({ st, pts }, i) => {
    if (left <= 0) return;
    const f = Math.min(1, left / lens[i]);
    left -= lens[i];
    partStroke(ctx, st, pts, { color: st.c || d.color, opacity: d.opacity, lw: strokeWidth(d, st, W, H) }, f);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

/** One routine for both blocks, so bullets behave identically in each. */
function drawLines(ctx, lines, f, left, startY, colour, hang) {
  ctx.font = f.css(f.size);
  ctx.fillStyle = colour;
  const lh = f.size * f.lh;
  let y = startY;
  for (const line of lines) {
    y += lh;
    const baseline = y - lh * f.baseline;
    if (line.bullet) {
      ctx.beginPath();
      ctx.arc(left + hang * 0.35, baseline - f.size * (f.bulletY || 0.25), f.size * f.bullet, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillText(line.text, line.hang ? left + hang : left, baseline);
  }
  return y;
}

/** `editing` names a part being edited in place — it is left out here so the
    editor laid over it is the only copy on screen. Layout is unaffected. */
function drawTextBlock(ctx, L, colors, editing) {
  const { tx, txRect, S } = L;
  if (tx.empty) return;
  const look = tx.look;

  // a card (fill) and/or a border (stroke, outside the box) for one box
  const box = (x, y, w, h, r, bg, brd) => {
    if (bg) {
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = bg;
      ctx.fill();
    }
    if (brd && brd.w > 0) {
      // the border grows outwards from the box, so the text keeps all its room
      const i = brd.w / 2;
      roundRect(ctx, x - i, y - i, w + brd.w, h + brd.w, r + i);
      ctx.lineWidth = brd.w;
      ctx.strokeStyle = brd.c;
      ctx.stroke();
    }
  };
  const brd = tx.brd || { h1: { w: 0 }, body: { w: 0 } };
  ctx.save();
  if (!tx.split) {
    const lead = tx.h1Lines.length ? 'h1' : 'body';
    box(txRect.x, txRect.y, txRect.w, tx.h, 36 * S, look[lead].bg, brd[lead]);
  } else {
    // a card each, each hugging its own text
    if (tx.h1Lines.length) box(txRect.x, txRect.y + tx.h1Top - tx.padH1, Math.min(txRect.w, tx.h1W + tx.padH1 * 2), tx.h1H + tx.padH1 * 2, 30 * S, look.h1.bg, brd.h1);
    if (tx.bodyLines.length) box(txRect.x, txRect.y + tx.bodyTop - tx.padBody, Math.min(txRect.w, tx.bodyW + tx.padBody * 2), tx.bodyH + tx.padBody * 2, 30 * S, look.body.bg, brd.body);
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (tx.h1Lines.length && editing !== 'h1') {
    drawLines(ctx, tx.h1Lines, tx.f.h1, txRect.x + tx.padH1, txRect.y + tx.h1Top + (tx.h1Dy || 0), colors.h1, tx.h1Hang);
  }
  if (tx.bodyLines.length && editing !== 'body') {
    drawLines(ctx, tx.bodyLines, tx.f.body, txRect.x + tx.padBody, txRect.y + tx.bodyTop + (tx.bodyDy || 0), colors.body, tx.bodyHang);
  }
  ctx.restore();
}

/* The element being edited gets a quiet outline on the preview — never in
   an export (exports don't pass `selected`). */
function drawSelection(ctx, L, sel, px, accent, note) {
  if (!sel) return;
  const u = typeof px === 'number' && px > 0 ? px : 1;
  let r = null;
  if (typeof sel === 'string' && sel.startsWith('md:')) {
    const m = (L.media || []).find((e) => e.id === sel.slice(3));
    if (m) r = { ...m.insRect, h: m.ins.h };
  } else if (typeof sel === 'string' && sel.startsWith('bt:')) {
    const b = (L.buttons || []).find((e) => e.id === sel.slice(3));
    if (b) r = { ...b.rect };
  } else if (typeof sel === 'string' && sel.startsWith('xb:')) {
    const [, id, part] = sel.split(':');
    const x = (L.extras || []).find((e) => e.id === id);
    const p = x && (x.parts[part] || null);
    if (p) r = { x: p.x, y: p.y, w: p.w, h: p.h };
    else if (x) r = { ...x.txRect, h: x.tx.h };
  } else if (typeof sel === 'string' && sel.startsWith('eb:')) {
    const b = (L.xbadges || []).find((e) => e.id === sel.slice(3));
    if (b) r = { ...b.rect };
  } else if (typeof sel === 'string' && sel.startsWith('dr:')) {
    const d = (L.drawings || []).find((e) => e.id === sel.slice(3));
    if (d) r = { ...d.rect };
  } else if (sel === 'watermark' && L.wm.image) {
    const part = L.badgePart && L.badge && L.badge.parts[L.badgePart];
    r = part ? { ...part } : { ...L.wmRect, h: L.wmRect.h };
  }
  else if (sel === 'inset' && L.ins.image) r = { ...L.insRect, h: L.ins.h };
  else if ((sel === 'h1' || sel === 'body') && L.parts && L.parts[sel]) {
    const p = L.parts[sel];
    r = { x: p.x, y: p.y, w: p.w, h: p.h };
  } else if ((sel === 'h1' || sel === 'body' || sel === 'text') && !L.tx.empty) r = { ...L.txRect, h: L.tx.h };
  if (!r) return;
  const o = 6 * u;
  ctx.save();
  ctx.lineWidth = 1.5 * u;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, r.x - o + u, r.y - o + u, r.w + o * 2, r.h + o * 2, 10 * u);
  ctx.stroke();
  // the section's category colour (Hook / Value / CTA) when given — editor only
  ctx.strokeStyle = accent || 'rgba(255,255,255,0.9)';
  if (accent) ctx.lineWidth = 2.5 * u;
  roundRect(ctx, r.x - o, r.y - o, r.w + o * 2, r.h + o * 2, 10 * u);
  ctx.stroke();
  /* an item shown on several sections says so, in a small tag (editor only) */
  if (note) {
    const fs = 12 * u, padX = 8 * u, h = fs + 8 * u;
    ctx.font = `600 ${fs}px Poppins, system-ui, sans-serif`;
    const w = ctx.measureText(note).width + padX * 2;
    const W = ctx.canvas.width, Hc = ctx.canvas.height;
    // on the selection's top edge, at its right end: it labels the box without hiding what is in it
    let x = r.x + r.w + o - w - 10 * u, y = r.y - o - h / 2;
    x = Math.max(2 * u, Math.min(W - w - 2 * u, x));
    y = Math.max(2 * u, Math.min(Hc - h - 2 * u, y));
    ctx.fillStyle = accent || 'rgba(255,255,255,0.95)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#16151a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note, x + w / 2, y + h / 2 + 0.5 * u);
  }
  ctx.restore();
}

function drawInset(ctx, L) {
  const { ins, insRect } = L;
  if (!ins.image) return;
  ctx.save();
  roundRect(ctx, insRect.x, insRect.y, ins.w, ins.h, ins.radius);
  ctx.clip();
  if (ins.pending) drawColourBars(ctx, insRect.x, insRect.y, ins.w, ins.h);
  else ctx.drawImage(ins.image, insRect.x, insRect.y, ins.w, ins.h);
  ctx.restore();
}

function drawGuides(ctx, state, W, H, px = 1) {
  // quiet: a thin dashed line, light with a faint dark twin so it reads on any ground
  const sa = safeArea(state.format, W, H);
  const lw = 1.25 * (typeof px === 'number' && px > 0 ? px : Math.max(1, W / 900));   // ~1.25 screen px
  ctx.save();
  ctx.setLineDash([lw * 4, lw * 4]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.strokeRect(sa.x + lw, sa.y + lw, sa.w, sa.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeRect(sa.x, sa.y, sa.w, sa.h);
  // v3.1: TikTok's action rail reaches further in on the lower right (840 px down on 1920)
  const m = safeMargins(state.format);
  const lines = [];
  if (state.format === '9x16' && m.rail) {
    const rx = W * (1 - 0.278), ry = H * (840 / 1920), by = sa.y + sa.h;
    if (rx < sa.x + sa.w && ry < by) lines.push([[sa.x + sa.w, ry], [rx, ry], [rx, by]]);
  }
  // v3.1: the Instagram profile grid shows a 3:4 crop of feed posts: where 4:5 and 1:1 get cut
  if (state.format === '4x5' || state.format === '1x1') {
    const cw = H * 3 / 4, cx = (W - cw) / 2;
    if (cx > lw) { lines.push([[cx, 0], [cx, H]]); lines.push([[cx + cw, 0], [cx + cw, H]]); }
  }
  ctx.setLineDash([lw * 1.5, lw * 3]);
  for (const [dx, col] of [[lw, 'rgba(0,0,0,0.22)'], [0, 'rgba(255,255,255,0.6)']]) {
    ctx.strokeStyle = col;
    for (const pts of lines) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dx) : ctx.moveTo(x + dx, y + dx)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* --- grid (editor only) ---------------------------------------------------
   Centre lines, thirds of the frame, and a column grid inside the safe area:
   4 columns on 9:16, 6 on 4:5 and 1:1, 12 on 16:9, with gutters. Dragging snaps
   to these lines while the grid is on. Never drawn into an export. */
export const GRID_COLS = { '9x16': 4, '3x4': 6, '4x5': 6, '1x1': 6, '16x9': 12 };
export function gridLines(fmt, W, H) {
  const sa = safeArea(fmt, W, H);
  const n = GRID_COLS[fmt] || 6;
  const gut = sa.w * (n > 6 ? 0.018 : 0.035);
  const colW = (sa.w - gut * (n - 1)) / n;
  const cols = [];
  for (let k = 0; k < n; k++) cols.push({ x: sa.x + k * (colW + gut), w: colW });
  const v = new Set([W / 2, W / 3, (W * 2) / 3, sa.x, sa.x + sa.w]);
  for (const c of cols) { v.add(c.x); v.add(c.x + c.w); }
  const h = new Set([H / 2, H / 3, (H * 2) / 3, sa.y, sa.y + sa.h]);
  const sort = (set) => [...set].map((a) => Math.round(a * 10) / 10).sort((a, b) => a - b);
  return { sa, cols, v: sort(v), h: sort(h), centre: { x: W / 2, y: H / 2 }, thirds: { x: [W / 3, (W * 2) / 3], y: [H / 3, (H * 2) / 3] } };
}
function drawGrid(ctx, state, W, H, px = 1, hits = null) {
  const g = gridLines(state.format, W, H);
  const u = typeof px === 'number' && px > 0 ? px : Math.max(1, W / 900);
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  // every line drawn twice — a faint dark twin under a light one — so it reads on any ground
  const twin = (light, dark, dash, draw) => {
    ctx.setLineDash(dash);
    ctx.strokeStyle = dark; ctx.save(); ctx.translate(u, u); draw(); ctx.restore();
    ctx.strokeStyle = light; draw();
  };
  ctx.save();
  ctx.lineWidth = u;
  // the columns: tinted bands inside the safe area, edged
  ctx.fillStyle = 'rgba(92, 200, 255, 0.12)';
  for (const c of g.cols) ctx.fillRect(c.x, g.sa.y, c.w, g.sa.h);
  twin('rgba(92, 200, 255, 0.85)', 'rgba(0, 0, 0, 0.25)', [], () => {
    for (const c of g.cols) { line(c.x, g.sa.y, c.x, g.sa.y + g.sa.h); line(c.x + c.w, g.sa.y, c.x + c.w, g.sa.y + g.sa.h); }
  });
  // thirds: dotted, across the whole frame
  twin('rgba(255, 255, 255, 0.9)', 'rgba(0, 0, 0, 0.35)', [u * 2, u * 4], () => {
    for (const x of g.thirds.x) line(x, 0, x, H);
    for (const y of g.thirds.y) line(0, y, W, y);
  });
  // centre lines: dashed, amber
  ctx.lineWidth = 1.5 * u;
  twin('rgba(255, 181, 71, 0.95)', 'rgba(0, 0, 0, 0.35)', [u * 6, u * 4], () => {
    line(g.centre.x, 0, g.centre.x, H);
    line(0, g.centre.y, W, g.centre.y);
  });
  // the line(s) a drag has just snapped to
  if (hits && (hits.x.length || hits.y.length)) {
    ctx.lineWidth = 2 * u;
    twin('rgba(255, 70, 200, 1)', 'rgba(0, 0, 0, 0.4)', [], () => {
      for (const x of hits.x) line(x, 0, x, H);
      for (const y of hits.y) line(0, y, W, y);
    });
  }
  ctx.restore();
}

/* --- entry point --------------------------------------------------------- */

/* Resampling: 'high' quality wherever a picture is drawn larger or smaller than
   its file — the default ('low') is what makes a scaled badge or photo look
   pixelated in a PNG. */
function smooth(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

/* v3.13 · hooks the app sets: `frame` may draw a whole frame itself (a transition between
   two sections) by calling back into renderFrame; `afterBackground` draws over the
   background and its wash, under media, text and badges (the overlay track). */
export const renderHooks = { frame: null, afterBackground: null, afterAll: null, drawingProgress: null, fault: null };
export function render(ctx, W, H, state, opts = {}) {
  if (renderHooks.frame) {
    const L = renderHooks.frame(ctx, W, H, state, opts, renderFrame);
    if (L) return L;
  }
  return renderFrame(ctx, W, H, state, opts);
}
export function renderFrame(ctx, W, H, state, opts = {}) {
  smooth(ctx);
  const bd = byId(state.backdrop);
  const L = layout(ctx, state, W, H);

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  // v4 · a background that fails to paint (a broken clip, a picture still loading) never
  // takes the frame down with it: the brand's base colour stands in and the app is told.
  try { paintBackdrop(ctx, W, H, bd); }
  catch (e) {
    ctx.fillStyle = (bd && bd.base) || '#3b003a';
    ctx.fillRect(0, 0, W, H);
    if (renderHooks.fault) renderHooks.fault(e, 'background');
  }
  ctx.restore();

  // the Dim wash works on every background — pattern, artwork, colour or upload
  paintOverlay(ctx, W, H, state.overlay.style, state.overlay.strength);
  if (renderHooks.afterBackground) renderHooks.afterBackground(ctx, W, H, state, opts);
  if (opts.guides) drawGuides(ctx, state, W, H, opts.guides);
  if (opts.grid) drawGrid(ctx, state, W, H, opts.grid, opts.snapLines);

  /* Text colour decides the panel: light type sits on a dark panel, dark type
     on the cream one (see textLook); Header and Body can each override it. */
  const BARE = bareStyles();
  const look = L.tx.look || textLook(state, bd);
  const colors = { h1: look.h1.text, body: look.body.text };

  drawInset(ctx, L);
  for (const m of L.media || []) drawInset(ctx, m);
  if (L.tx.cta) {
    /* A CTA sits straight on the background (no panel), so its type follows the
       background, not the Text colour switch: dark type on light grounds, light on
       dark — and light once the Dim wash has darkened the ground. */
    const dimmed = state.overlay && state.overlay.style !== 'none' && state.overlay.strength >= 0.35;
    const ground = dimmed ? 'dark' : (bd.tone || 'dark');
    // a button that would vanish into its background swaps fill and type (Ask Ruth's
    // pink pill on a pink pattern becomes the plum pill with pink type, like the badge)
    // (only for the brand's own colours — a colour picked for the button stays as picked)
    if (L.tx.cta === 'button' && !(L.tx.btn && (L.tx.btn.fill || L.tx.btn.ink))
        && /^#[0-9a-f]{6}$/i.test(bd.base || '') && contrast(L.tx.brand.bg, bd.base) < 1.7) {
      L.tx.brand = { ...L.tx.brand, bg: L.tx.brand.ink, ink: L.tx.brand.bg };
    }
    L.tx.ground = ground;
    drawCta(ctx, L, ground === 'dark' ? BARE.onDark : BARE.onLight);
  }
  else drawTextBlock(ctx, L, colors, opts.editing);
  for (const x of L.extras || []) drawTextBlock(ctx, { tx: x.tx, txRect: x.txRect, S: L.S }, x.tx.look ? { h1: x.tx.look.h1.text, body: x.tx.look.body.text } : colors);
  for (const b of L.buttons || []) drawButton(ctx, b, (state.adjust && state.adjust[bd.id] && state.adjust[bd.id].ground) || bd.base);
  L.colors = colors;

  drawBadge(ctx, L);
  for (const b of L.xbadges || []) drawBadge(ctx, b);
  // v3.1: drawings on top — they are marks made over the design
  for (const d of L.drawings || []) drawDrawing(ctx, d.d, W, H, renderHooks.drawingProgress ? renderHooks.drawingProgress(ctx, d.d, state) : 1);
  // v3.15: timed items over the whole frame (text, badges, cogents, drawings on the overlay track)
  if (renderHooks.afterAll) renderHooks.afterAll(ctx, W, H, state, opts);

  L.badgePart = opts.badgePart || null;
  // v4 · the selection stays visible while hovering; only a drag in progress hides it
  const hideSel = !!opts.dragNow || (opts.handles && opts.dragNow === undefined);
  if (opts.selected && !hideSel) drawSelection(ctx, L, opts.selected, opts.px, opts.accent, opts.note);
  if (!hideSel) for (const m of opts.multi || []) if (m !== opts.selected) drawSelection(ctx, L, m, opts.px, opts.accent);

  if (opts.handles) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    const lw = Math.max(2, W / 600);
    // v4 · a dark twin under the pink, so the outlines read on light patterns too
    const all = (stroke) => {
      if (L.ins.image) stroke(L.insRect.x, L.insRect.y, L.ins.w, L.ins.h);
      if (L.wm.image) stroke(L.wmRect.x, L.wmRect.y, L.wmRect.w, L.wmRect.h);
      if (!L.tx.empty) stroke(L.txRect.x, L.txRect.y, L.txRect.w, L.tx.h);
      for (const x of L.extras || []) stroke(x.txRect.x, x.txRect.y, x.txRect.w, x.tx.h);
      for (const b of L.buttons || []) stroke(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
      for (const m of L.media || []) stroke(m.insRect.x, m.insRect.y, m.ins.w, m.ins.h);
      for (const b of L.xbadges || []) stroke(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
    };
    ctx.lineWidth = lw * 2; ctx.strokeStyle = 'rgba(20,0,20,0.35)'; all((x, y, w, h) => ctx.strokeRect(x, y, w, h));
    ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,142,255,0.9)'; all((x, y, w, h) => ctx.strokeRect(x, y, w, h));
    ctx.restore();
  }
  // v4 · the item under the pointer: a solid, clearly brighter outline (editor only)
  if (opts.hoverRect && !opts.dragNow) {
    const r = opts.hoverRect, u = opts.px || 1, o = 4 * u;
    ctx.save();
    ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(20,0,20,0.45)';
    roundRect(ctx, r.x - o, r.y - o, r.w + o * 2, r.h + o * 2, 8 * u); ctx.stroke();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = '#ffffff';   // white: the selection keeps the section's colour
    roundRect(ctx, r.x - o, r.y - o, r.w + o * 2, r.h + o * 2, 8 * u); ctx.stroke();
    ctx.restore();
  }

  return L;
}

/* --- one item on its own -------------------------------------------------
   For saving the parts of a section separately (Export → Items): the same
   layout and drawing as render(), but only the one item, on a transparent
   frame. render() above is untouched. */

/** What a section has that can be saved on its own, in drawing order. */
export function itemsOf(ctx, state, W, H) {
  const L = layout(ctx, state, W, H);
  const out = [{ id: 'background', kind: 'background', label: 'Background' }];
  let n = 0;
  if (L.ins.image) out.push({ id: 'inset', kind: 'media', label: `Media ${++n}` });
  for (const m of L.media || []) out.push({ id: `md:${m.id}`, kind: 'media', label: `Media ${++n}` });
  if (!L.tx.empty) out.push({ id: 'text', kind: 'text', label: L.tx.cta ? 'CTA text' : 'Text' });
  (L.extras || []).forEach((x, k) => out.push({ id: `xb:${x.id}`, kind: 'text', label: `Text box ${k + 2}` }));
  for (const b of L.buttons || []) out.push({ id: `bt:${b.id}`, kind: 'button', label: `Button · ${b.m.text}` });
  if (L.wm.image) out.push({ id: 'badge', kind: 'badge', label: 'Badge' });
  (L.xbadges || []).forEach((b, k) => out.push({ id: `eb:${b.id}`, kind: 'badge', label: `Badge ${k + (L.wm.image ? 2 : 1)}` }));
  (L.drawings || []).forEach((d, k) => out.push({ id: `dr:${d.id}`, kind: 'drawing', label: `Drawing ${k + 1}` }));
  return out;
}

/** The bold CTA's type colours on this section's ground (as drawCta is given them). */
export function ctaInk(state) {
  const bd = byId(state.backdrop);
  const BARE = bareStyles();
  const dimmed = state.overlay && state.overlay.style !== 'none' && state.overlay.strength >= 0.35;
  const ground = dimmed ? 'dark' : (bd.tone || 'dark');
  return ground === 'dark' ? BARE.onDark : BARE.onLight;
}

/** Draws only `id` (an id from itemsOf) on a cleared frame. */
export function renderItem(ctx, W, H, state, id) {
  smooth(ctx);
  const bd = byId(state.backdrop);
  const L = layout(ctx, state, W, H);
  ctx.clearRect(0, 0, W, H);
  if (id === 'background') {
    ctx.save();
    paintBackdrop(ctx, W, H, bd);
    ctx.restore();
    paintOverlay(ctx, W, H, state.overlay.style, state.overlay.strength);
    return;
  }
  const BARE = bareStyles();
  const look = L.tx.look || textLook(state, bd);
  const colors = { h1: look.h1.text, body: look.body.text };
  if (id === 'inset') { drawInset(ctx, L); return; }
  if (id === 'badge') { drawBadge(ctx, L); return; }
  if (id === 'text') {
    if (L.tx.cta) {
      const dimmed = state.overlay && state.overlay.style !== 'none' && state.overlay.strength >= 0.35;
      const ground = dimmed ? 'dark' : (bd.tone || 'dark');
      if (L.tx.cta === 'button' && !(L.tx.btn && (L.tx.btn.fill || L.tx.btn.ink))
          && /^#[0-9a-f]{6}$/i.test(bd.base || '') && contrast(L.tx.brand.bg, bd.base) < 1.7) {
        L.tx.brand = { ...L.tx.brand, bg: L.tx.brand.ink, ink: L.tx.brand.bg };
      }
      L.tx.ground = ground;
      drawCta(ctx, L, ground === 'dark' ? BARE.onDark : BARE.onLight);
    } else drawTextBlock(ctx, L, colors);
    return;
  }
  const [kind, key] = [String(id).slice(0, 2), String(id).slice(3)];
  if (kind === 'eb') {
    const b = (L.xbadges || []).find((e) => e.id === key);
    if (b) drawBadge(ctx, b);
  } else if (kind === 'xb') {
    const x = (L.extras || []).find((e) => e.id === key);
    if (x) drawTextBlock(ctx, { tx: x.tx, txRect: x.txRect, S: L.S }, x.tx.look ? { h1: x.tx.look.h1.text, body: x.tx.look.body.text } : colors);
  } else if (kind === 'bt') {
    const b = (L.buttons || []).find((e) => e.id === key);
    if (b) drawButton(ctx, b, (state.adjust && state.adjust[bd.id] && state.adjust[bd.id].ground) || bd.base);
  } else if (kind === 'md') {
    const m = (L.media || []).find((e) => e.id === key);
    if (m) drawInset(ctx, m);
  } else if (kind === 'dr') {
    const d = (L.drawings || []).find((e) => e.id === key);
    if (d) drawDrawing(ctx, d.d, W, H, d.d.prog ?? 1);    // v3.21: an overlay drawing passes how far it is drawn on
  }
}

/** How far the badge scale can go before the badge would fill the frame (FIT) —
    it depends on the badge's own size and shape and on the format, so a small
    round portrait can grow far more than a wide lockup. */
export function badgeScaleMax(state, W, H) {
  const bd = byId(state.backdrop);
  const key = state.badge === 'auto' ? bd.badge : state.badge;
  const m = measureBadge({ ...state, badge: key, badgeScale: 1, badgePowered: true }, W, H);
  if (!m.image || !m.w || !m.h) return 1.4;
  return Math.max(1, Math.min(6, (W * FIT) / m.w, (H * FIT) / m.h));
}

export { C };
