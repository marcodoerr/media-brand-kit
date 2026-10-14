/* ==========================================================================
   store.js — uploaded media (images and video), kept in IndexedDB.

   localStorage would be the obvious choice but it caps out around 5 MB and
   only holds strings; a couple of photos would blow it, never mind a clip.
   IndexedDB stores the Blob itself and has room to spare.

   Every record carries a `use` ('background' | 'inset') so a backdrop upload
   and a photo-card upload never turn up in each other's UI, and a `media`
   ('image' | 'video') so callers know what they are drawing.
   ========================================================================== */

const DB_NAME = 'askruth-backdrop-studio';
const DB_VERSION = 1;
const STORE = 'uploads';

/** Longest edge kept on a still import — 2× the widest export, with headroom. */
const MAX_EDGE = 3000;

/** Clips are stored as uploaded; this is the ceiling before we refuse one. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => { dbPromise = null; throw err; });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/* --- decoding ------------------------------------------------------------ */

function readImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read that image')); };
    img.src = url;
  });
}

/* Playback settings apply to every clip at once; new clips adopt them. */
const playback = { loop: true, muted: false };

export function setPlayback(opts) {
  Object.assign(playback, opts);
  for (const rec of live.values()) {
    if (rec.media !== 'video') continue;
    rec.el.loop = playback.loop;
    // an element whose audio is tapped must stay unmuted or the tap goes quiet
    if (!audioTaps.has(rec.id)) rec.el.muted = true;
    if (playback.loop && rec.el.ended) rec.el.play().catch(() => {});
  }
}

export const isMuted = () => playback.muted;

/** A muted, inline element — the only shape browsers will autoplay. */
function readVideo(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement('video');
    el.muted = true;
    el.loop = playback.loop;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.onloadedmetadata = () => resolve(el);
    el.onerror = () => {
      URL.revokeObjectURL(url);
      // almost always a codec this browser cannot decode
      reject(new Error('this browser cannot play that video format — try MP4 (H.264) or WebM'));
    };
    el.src = url;
  });
}

/** Re-encode oversized stills so memory and storage stay sane. */
async function normaliseImage(file) {
  const img = await readImage(file);
  const long = Math.max(img.naturalWidth, img.naturalHeight);

  if (long <= MAX_EDGE && file.size < 4_000_000) {
    URL.revokeObjectURL(img.src);
    return { blob: file, w: img.naturalWidth, h: img.naturalHeight };
  }

  const k = Math.min(1, MAX_EDGE / long);
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  const hasAlpha = /png|webp|gif|svg/i.test(file.type);
  const blob = await new Promise((res) =>
    cv.toBlob(res, hasAlpha ? 'image/png' : 'image/jpeg', 0.92));
  return { blob, w, h };
}

/* --- public api ---------------------------------------------------------- */

const live = new Map(); // id -> { url, el, media, w, h, duration }

export function mediaFor(id) {
  return live.get(id) || null;
}

/** The drawable element, whichever kind it is — canvas takes both. */
export function imageFor(id) {
  const rec = live.get(id);
  return rec ? rec.el : null;
}

/** Intrinsic size, since images and video spell it differently. */
export function sizeOf(el) {
  if (!el) return { w: 0, h: 0 };
  return {
    w: el.naturalWidth || el.videoWidth || el.width || 0,
    h: el.naturalHeight || el.videoHeight || el.height || 0,
  };
}

export const isVideo = (id) => {
  const rec = live.get(id);
  return !!rec && rec.media === 'video';
};

export async function addUpload(file, use = 'background') {
  const video = /^video\//.test(file.type);
  if (!video && !/^image\//.test(file.type)) {
    throw new Error(`${file.name} is not an image or video`);
  }
  if (video && file.size > MAX_VIDEO_BYTES) {
    throw new Error(`${file.name} is over ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`);
  }

  let blob = file, w = 0, h = 0, duration = 0;
  if (video) {
    const el = await readVideo(file);
    w = el.videoWidth; h = el.videoHeight; duration = el.duration || 0;
    URL.revokeObjectURL(el.src);
  } else {
    ({ blob, w, h } = await normaliseImage(file));
  }

  const id = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Upload';
  const media = video ? 'video' : 'image';
  const record = { id, name, blob, w, h, use, media, duration, created: Date.now() };

  try { await tx('readwrite', (s) => s.put(record)); } catch (_) { /* session-only */ }
  await hydrate(record);
  return { id, name, w, h, use, media, duration };
}

async function hydrate(record) {
  const media = record.media || 'image';
  const el = await (media === 'video' ? readVideo(record.blob) : readImage(record.blob))
    .catch(() => null);
  if (!el) return;
  const size = sizeOf(el);
  live.set(record.id, {
    id: record.id,
    url: el.src,
    el,
    media,
    w: size.w,
    h: size.h,
    duration: media === 'video' ? (el.duration || 0) : 0,
  });
  if (media === 'video') el.play().catch(() => {});
}

/** Metadata for every stored upload, oldest first. */
export async function loadUploads() {
  let records = [];
  try { records = (await tx('readonly', (s) => s.getAll())) || []; } catch (_) { return []; }
  records.sort((a, b) => a.created - b.created);
  await Promise.all(records.map(hydrate));
  return records
    .filter((r) => live.has(r.id))
    // records written before photo cards and video existed are background stills
    .map(({ id, name, w, h, use, media, duration }) => ({
      id, name, w, h,
      use: use || 'background',
      media: media || 'image',
      duration: duration || 0,
    }));
}

export async function removeUpload(id) {
  const rec = live.get(id);
  if (rec) {
    if (rec.media === 'video') { try { rec.el.pause(); } catch (_) {} }
    URL.revokeObjectURL(rec.url);
    live.delete(id);
  }
  audioTaps.delete(id);
  try { await tx('readwrite', (s) => s.delete(id)); } catch (_) {}
}

/* --- audio for export -----------------------------------------------------
   A MediaElementAudioSourceNode can only be made once per element, and once
   made it takes over that element's output — which is what we want: the clip
   stays silent on screen while its audio still reaches the recorder.
   ------------------------------------------------------------------------ */

let audioCtx = null;
const audioTaps = new Map(); // id -> { source, dest }

export function audioTrackFor(id) {
  if (playback.muted) return null;
  const rec = live.get(id);
  if (!rec || rec.media !== 'video') return null;

  try {
    if (!audioTaps.has(id)) {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(rec.el);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);           // deliberately not to audioCtx.destination
      audioTaps.set(id, { source, dest });
      rec.el.muted = false;           // output is rerouted, so this stays silent
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const tap = audioTaps.get(id);
    return tap.dest.stream.getAudioTracks()[0] || null;
  } catch (_) {
    return null;                      // no audio track, or the browser said no
  }
}
