/* ==========================================================================
   assets.js — loads the active brand's artwork and serves it to the painters.

   Only one brand is on screen at a time, so switching clears the cache and
   reloads. The files are already in the browser cache by then, so a switch
   back is effectively instant.
   ========================================================================== */

import { brandOf, DEFAULT_BRAND } from './brands.js';
import { HIRES } from './hires.js';

let current = brandOf(DEFAULT_BRAND);

const images = new Map();
const patterns = new Map();

/* High-resolution masters. Every asset ships at a light 1× size so the app
   opens fast; the @2x/@3x file (listed in hires.js) is fetched only for the
   backdrop and badge actually in use, and replaces the 1× one as soon as it
   arrives — preview and export both draw it. */
const hi = new Map();          // key -> decoded high-res Image
const hiPending = new Map();   // key -> Promise<void>
let wanted = [];
let onHi = () => {};

/** The active brand's palette — what the text treatments draw from. */
export let C = current.palette;

export const activeBrand = () => current;

export const img = (key) => hi.get(key) || images.get(key) || null;

/** How many source pixels per 1× pixel the image `img(key)` returns (tiles need it). */
export function density(key) {
  const h = hi.get(key), base = images.get(key);
  if (!h || !base || !base.naturalWidth) return 1;
  // measured, not nominal: a tile cut at its true repeat can be 358 px for a 119 px 1× tile
  return h.naturalWidth / base.naturalWidth;
}


/** Called whenever a high-res master finishes loading (the app repaints). */
export function onHiRes(fn) { onHi = fn; }

/** Ask for the masters of these asset keys; drops masters no longer in use. */
export function requestHi(keys) {
  wanted = keys.filter((k) => current.assets && HIRES[current.assets[k]]);
  for (const k of [...hi.keys()]) if (!wanted.includes(k)) hi.delete(k);
  for (const key of wanted) {
    if (hi.has(key) || hiPending.has(key)) continue;
    const src = current.assets[key];
    const brand = current;
    hiPending.set(key, new Promise((done) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => {
        hiPending.delete(key);
        if (brand === current && wanted.includes(key)) { hi.set(key, el); patterns.clear(); onHi(); }
        done();
      };
      el.onerror = () => { hiPending.delete(key); console.warn('missing master', HIRES[src]); done(); };
      el.src = HIRES[src];
    }));
  }
}

/** True once every requested master is in (exports wait for this). */
export const hiReady = () => wanted.every((k) => hi.has(k) || !hiPending.has(k));

/** Resolves when the requested masters have loaded (or failed). */
export const whenHiReady = () => Promise.all(wanted.map((k) => hiPending.get(k)).filter(Boolean));

/** Cached CanvasPattern per (context, tile) — rebuilding one per frame is slow. */
export function tilePattern(ctx, key) {
  const image = img(key);
  if (!image) return null;
  let perCtx = patterns.get(ctx);
  if (!perCtx) { perCtx = new Map(); patterns.set(ctx, perCtx); }
  if (!perCtx.has(key)) perCtx.set(key, ctx.createPattern(image, 'repeat'));
  return perCtx.get(key);
}

export function loadAssets(brandId) {
  current = brandOf(brandId || DEFAULT_BRAND);
  C = current.palette;
  images.clear();
  patterns.clear();
  hi.clear();
  hiPending.clear();
  wanted = [];

  const entries = Object.entries(current.assets || {});
  return Promise.all(entries.map(([key, src]) => new Promise((done) => {
    const el = new Image();
    el.onload = () => { images.set(key, el); done(); };
    el.onerror = () => { console.warn('missing asset', src); done(); };
    el.src = src;
  })));
}
