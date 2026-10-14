/* ==========================================================================
   v4/media.js — check a video before it goes into the design.

   Why this exists (v4 diagnosis, see HANDOFF §49):
   - A file whose *sound* the browser can play but whose *picture* it cannot
     (HEVC / ProRes .mov, 10-bit H.264 from some cameras) fired
     `loadedmetadata` with a 0 × 0 picture. store.js accepted it, the section's
     background went empty with no message, and the empty background came
     back after every reload.
   - Every stored clip was decoded and played at once on load, including clips
     the open design doesn't use. Several large clips (plus a new one being
     read twice) can run a laptop's video decoders and GPU memory out, and the
     preview canvas then goes blank.
   - There was no time-out, so a file that never answered left the UI waiting
     with no feedback.

   Everything here only *reads* the file through an object URL with
   preload="metadata" and one seek. Nothing reads the whole file into memory.
   ========================================================================== */

export const MB = 1024 * 1024;

/** Limits. The per-clip ceiling mirrors store.js MAX_VIDEO_BYTES. */
export const LIMITS = {
  clipBytes: 300 * MB,          // per video file (store.js refuses above this too)
  imageBytes: 60 * MB,          // per picture before it is scaled down to 3000 px
  projectBytes: 1200 * MB,      // all media one design uses, together
  storeBytes: 2400 * MB,        // all media kept in this browser, every design
  maxEdge: 4096,                // longest side of a clip's picture (4K UHD / DCI fits)
  maxSecs: 10 * 60,             // a clip loops behind its section; longer is a sign of the wrong file
  warnBytes: 120 * MB,          // heads-up: may stutter on phones
  warnEdge: 1920,               // heads-up above 1080p
  probeMs: 15000,               // metadata must arrive within this
  frameMs: 12000,               // and one frame must decode within this
};

const VIDEO_EXT = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', qt: 'video/quicktime',
  webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg',
};
const NOT_PLAYABLE_EXT = ['avi', 'wmv', 'flv', 'mts', 'm2ts', 'mpg', 'mpeg', '3gp', 'mxf', 'braw', 'r3d'];
const IMAGE_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', svg: 'image/svg+xml' };

export const extOf = (name) => ((name || '').match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();

/** 'video' | 'image' | null, from the type the browser gave or the file's extension. */
export function kindOf(file) {
  if (/^video\//.test(file.type)) return 'video';
  if (/^image\//.test(file.type)) return 'image';
  const ext = extOf(file.name);
  if (VIDEO_EXT[ext] || NOT_PLAYABLE_EXT.includes(ext)) return 'video';
  if (IMAGE_EXT[ext]) return 'image';
  return null;
}

/** A File the rest of the app recognises: some browsers give .mov / .mkv no type. */
export function withType(file) {
  if (file.type) return file;
  const ext = extOf(file.name);
  const type = VIDEO_EXT[ext] || IMAGE_EXT[ext];
  if (!type) return file;
  try { return new File([file], file.name, { type, lastModified: file.lastModified }); } catch (_) { return file; }
}

export const fmtBytes = (n) => (n >= 1024 * MB ? `${(n / 1024 / MB).toFixed(1)} GB` : `${Math.max(1, Math.round(n / MB))} MB`);
const fmtSecs = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** A plain-language problem: what happened, what to do. `retry` = trying again may help. */
export class MediaProblem extends Error {
  constructor(code, message, hint = '', retry = false) {
    super(message);
    this.code = code; this.hint = hint; this.retry = retry;
  }
}

const EXPORT_HINT = 'Export it as MP4 (H.264), 1080p or 4K: QuickTime › File › Export As › 1080p, or H.264 in Premiere, CapCut or HandBrake.';

/** Quick checks that need no decoding. Throws MediaProblem. */
export function precheck(file, { projectBytes = 0, storeBytes = 0, quotaLeft = Infinity } = {}) {
  const kind = kindOf(file);
  const ext = extOf(file.name);
  if (!kind) throw new MediaProblem('type', `${file.name} isn't a picture or a video.`, 'Use MP4, MOV or WebM for video, and JPG, PNG or WebP for pictures.');
  if (kind === 'video' && NOT_PLAYABLE_EXT.includes(ext)) {
    throw new MediaProblem('container', `Browsers can't play .${ext} files.`, EXPORT_HINT);
  }
  if (kind === 'video' && file.size > LIMITS.clipBytes) {
    throw new MediaProblem('size', `${file.name} is ${fmtBytes(file.size)}. The limit is ${fmtBytes(LIMITS.clipBytes)} per clip.`,
      'Trim it, or export at 1080p with a lower bitrate (about 10–16 Mbps looks the same on a phone).');
  }
  if (kind === 'image' && file.size > LIMITS.imageBytes) {
    throw new MediaProblem('size', `${file.name} is ${fmtBytes(file.size)}. Pictures can be up to ${fmtBytes(LIMITS.imageBytes)}.`, 'Save it as a JPG first.');
  }
  if (projectBytes + file.size > LIMITS.projectBytes) {
    throw new MediaProblem('project', `This design would hold ${fmtBytes(projectBytes + file.size)} of media. The limit is ${fmtBytes(LIMITS.projectBytes)} per design.`,
      'Remove a clip you no longer use from this design, or use a shorter or smaller version of this one.');
  }
  if (storeBytes + file.size > LIMITS.storeBytes) {
    throw new MediaProblem('store', `This browser already keeps ${fmtBytes(storeBytes)} of media for your designs.`,
      'Delete older projects you no longer need (☰ › All projects), then try again.');
  }
  if (file.size > quotaLeft) {
    throw new MediaProblem('quota', 'There isn’t enough storage left in this browser for that file.',
      'Free some disk space or delete older projects, then try again. In a private window, storage is very small.');
  }
  return kind;
}

const once = (el, events, ms, signal) => new Promise((resolve, reject) => {
  let t = 0;
  const off = () => { clearTimeout(t); for (const ev of events) el.removeEventListener(ev, on); if (signal) signal.removeEventListener('abort', ab); };
  const on = (e) => { off(); resolve(e.type); };
  const ab = () => { off(); reject(new MediaProblem('cancelled', 'Cancelled.')); };
  for (const ev of events) el.addEventListener(ev, on);
  if (signal) { if (signal.aborted) return ab(); signal.addEventListener('abort', ab); }
  t = setTimeout(() => { off(); resolve('timeout'); }, ms);
});

/**
 * Decode the metadata and one frame of a video. Resolves with
 * { w, h, duration, thumb (a small JPEG data URL or ''), warnings: [] }.
 * Throws MediaProblem. Every resource it made is released before it returns.
 */
export async function inspectVideo(file, { signal, onPhase } = {}) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'metadata';
  const release = () => {
    try { v.pause(); } catch (_) {}
    v.removeAttribute('src');
    try { v.load(); } catch (_) {}
    URL.revokeObjectURL(url);
  };
  try {
    onPhase && onPhase('metadata');
    const got = once(v, ['loadedmetadata', 'error'], LIMITS.probeMs, signal);
    v.src = url;
    const ev = await got;
    const ext = extOf(file.name);
    if (ev === 'error') {
      throw new MediaProblem('codec', ext === 'mov'
        ? 'This .mov uses a format this browser can’t play (often ProRes or HEVC).'
        : 'This browser can’t play that video.', EXPORT_HINT);
    }
    if (ev === 'timeout') {
      throw new MediaProblem('timeout', 'The video didn’t open within 15 seconds.',
        'If it is on a network or cloud drive, copy it to your computer first. Then try again.', true);
    }
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) {
      throw new MediaProblem('no-picture', 'This browser can play the sound of this video but not its picture.',
        `${EXPORT_HINT} (Usually an HEVC or 10-bit file from a phone or camera.)`);
    }
    const duration = Number.isFinite(v.duration) ? v.duration : 0;   // camera recordings report Infinity
    if (Math.max(w, h) > LIMITS.maxEdge) {
      throw new MediaProblem('resolution', `This clip is ${w} × ${h}. Clips can be up to ${LIMITS.maxEdge} px on the long side.`,
        'Export it at 4K (3840 × 2160) or 1080p.');
    }
    if (duration > LIMITS.maxSecs) {
      throw new MediaProblem('duration', `This clip runs ${fmtSecs(duration)}. Clips can run up to ${fmtSecs(LIMITS.maxSecs)}.`,
        'Trim it to the part you need. A section shows up to 30 s (a Value up to 3 min).');
    }

    onPhase && onPhase('frame');
    // one frame, near the start: proves the picture really decodes
    v.preload = 'auto';
    const seekTo = duration ? Math.min(0.5, duration / 3) : 0;
    // wait for *this* seek: events already queued from the metadata load (canplay) don't count
    const deadline = Date.now() + LIMITS.frameMs;
    const sought = once(v, ['seeked', 'error'], LIMITS.frameMs, signal);
    try { v.currentTime = seekTo || 0.001; } catch (_) {}
    let fev = await sought;
    while (fev !== 'error' && fev !== 'timeout' && v.readyState < 2) {
      const left = deadline - Date.now();
      if (left <= 0) { fev = 'timeout'; break; }
      fev = await once(v, ['loadeddata', 'canplay', 'canplaythrough', 'error'], left, signal);
    }
    if (fev === 'error') throw new MediaProblem('decode', 'The video opened, but its picture couldn\u2019t be decoded.', EXPORT_HINT);
    if (fev === 'timeout' || v.readyState < 2) {
      throw new MediaProblem('timeout', 'The video opened, but no picture arrived within 12 seconds.',
        'Very large or high-bitrate files can do this. Export a 1080p H.264 copy, or try again.', true);
    }
    let thumb = '';
    try {
      const k = 160 / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      thumb = c.toDataURL('image/jpeg', 0.7);
      c.width = c.height = 0;
    } catch (_) { /* a thumbnail is a nicety */ }

    const warnings = [];
    if (file.size > LIMITS.warnBytes || Math.min(w, h) > 1080) {
      warnings.push('Large or high-resolution clip: playback and export may stutter on phones. 1080p works best.');
    }
    return { w, h, duration, thumb, warnings };
  } finally {
    release();
  }
}

/* --- what this browser keeps -------------------------------------------------
   Read-only look at store.js's IndexedDB (same database, same store). Used for
   the size limits and to confirm a clip really was written, because store.js
   carries on "session-only" when the write fails. */
const DB_NAME = 'askruth-backdrop-studio';
const STORE = 'uploads';
function openRead() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => { /* store.js creates it; nothing to do here */ };
  });
}
/** [{ id, size, media, name }] for every stored upload. */
export async function storedSizes() {
  try {
    const db = await openRead();
    if (!db.objectStoreNames.contains(STORE)) { db.close(); return []; }
    const rows = await new Promise((resolve, reject) => {
      const out = [];
      const t = db.transaction(STORE, 'readonly');
      const req = t.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        const r = c.value;
        out.push({ id: r.id, size: (r.blob && r.blob.size) || 0, media: r.media || 'image', name: r.name });
        c.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
    });
    db.close();
    return rows;
  } catch (_) { return []; }
}
export async function isStored(id) {
  return (await storedSizes()).some((r) => r.id === id);
}
export async function quotaLeft() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return Infinity;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return quota ? Math.max(0, quota - usage) : Infinity;
  } catch (_) { return Infinity; }
}

/** Every upload id the open design shows: backgrounds, photo cards, media, overlay clips.
    (Not `adjust`, which keeps framing for every upload ever made, nor other brands' designs.) */
export function idsInDesign(state) {
  const out = new Set();
  const add = (id) => { if (typeof id === 'string' && id.startsWith('up_')) out.add(id); };
  if (!state) return out;
  add(state.backdrop); add(state.sharedBg); add(state.sharedStill);
  add(state.inset && state.inset.id);
  for (const m of state.media || []) add(m && m.src);
  for (const o of state.overlays || []) add(o && o.src);
  for (const sc of state.scenes || []) {
    if (!sc) continue;
    add(sc.bg);
    add(sc.inset && sc.inset.id);
    for (const m of sc.media || []) add(m && m.src);
  }
  return out;
}
