/* ==========================================================================
   v4/importer.js — every picture or video added to a design passes through
   here first: checked, shown with its progress, and only then handed to the
   app's own (protected) upload code, unchanged.

   How it sits around the protected code:
   - A capture-phase `change` listener on the document sees every file input
     (Background, Media, More media, Overlay clip) before the input's own
     handler. For a video it stops that event, checks the file, and when the
     file is fine it puts the file back on the same input and fires `change`
     again, flagged so it goes straight through.
   - A capture-phase `drop` on the window does the same for files dropped on
     the page (they become a Background, as before).
   - Pictures that pass the size checks go straight through, untouched.
   ========================================================================== */

import {
  LIMITS, kindOf, withType, precheck, inspectVideo, MediaProblem, fmtBytes,
  storedSizes, quotaLeft, idsInDesign,
} from './media.js';

const JOURNAL_KEY = 'askruth.backdrop-studio.v4.importing';
const BEFORE_KEY = 'askruth.backdrop-studio.v4.before-import';
const SKIP_INPUTS = new Set(['music-input', 'music-video-input', 'cam-input']);
const ERROR_FOR = { 'file-input': '#upload-error', 'inset-input': '#inset-error', 'media-more-input': '#media-more-error' };

let api = null;
let tray = null;
let cache = { project: 0, store: 0, quota: Infinity, rows: [], t: 0 };
const items = new Map();     // id -> item
let seq = 0;

/** Sizes for the limits: refreshed before each check, and every few seconds while idle. */
async function refreshSizes() {
  const rows = await storedSizes();
  const used = idsInDesign(api.state());
  cache = {
    rows,
    project: rows.filter((r) => used.has(r.id)).reduce((t, r) => t + r.size, 0),
    store: rows.reduce((t, r) => t + r.size, 0),
    quota: await quotaLeft(),
    t: Date.now(),
  };
  return cache;
}

/* --- the tray ------------------------------------------------------------------ */
function ensureTray() {
  if (tray) return tray;
  tray = document.createElement('section');
  tray.id = 'import-tray';
  tray.className = 'import-tray';
  tray.setAttribute('aria-label', 'Adding media');
  tray.setAttribute('role', 'region');
  tray.hidden = true;
  tray.innerHTML = '<ol class="it-list" aria-live="polite"></ol>';
  document.body.append(tray);
  return tray;
}
const PHASES = {
  queued: ['Waiting', 0.05],
  check: ['Checking file', 0.12],
  metadata: ['Processing · reading video details', 0.3],
  frame: ['Processing · decoding a frame', 0.55],
  saving: ['Saving in this browser', 0.8],
  done: ['Added', 1],
  local: ['Added for this session only', 1],
  error: ['Couldn’t add', 1],
  cancelled: ['Cancelled', 1],
};
function renderItem(it) {
  ensureTray();
  let li = tray.querySelector(`[data-it="${it.id}"]`);
  if (!li) {
    li = document.createElement('li');
    li.dataset.it = it.id;
    li.className = 'it-item';
    li.innerHTML = '<span class="it-thumb" aria-hidden="true"></span><div class="it-body"><p class="it-name"></p><p class="it-phase"></p>'
      + '<div class="it-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="it-msg"></p><p class="it-hint"></p></div><div class="it-actions"></div>';
    tray.querySelector('.it-list').append(li);
  }
  const [label, p] = PHASES[it.phase] || PHASES.queued;
  li.dataset.phase = it.phase;
  li.querySelector('.it-name').textContent = it.notice ? 'Media' : `${it.file.name} · ${fmtBytes(it.file.size)}`;
  li.querySelector('.it-phase').textContent = it.notice ? 'Needs your attention' : label;
  li.classList.toggle('is-notice', !!it.notice);
  const bar = li.querySelector('.it-bar');
  bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  bar.setAttribute('aria-label', label);
  bar.querySelector('i').style.width = `${Math.round(p * 100)}%`;
  bar.hidden = ['done', 'local', 'error', 'cancelled'].includes(it.phase);
  const th = li.querySelector('.it-thumb');
  th.style.backgroundImage = it.thumb ? `url(${it.thumb})` : '';
  th.classList.toggle('is-video', it.kind === 'video');
  li.querySelector('.it-msg').textContent = it.msg || '';
  li.querySelector('.it-hint').textContent = it.hint || '';
  const acts = li.querySelector('.it-actions');
  acts.innerHTML = '';
  const btn = (text, fn, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `it-btn ${cls}`; b.textContent = text;
    b.addEventListener('click', fn);
    acts.append(b);
    return b;
  };
  if (['queued', 'check', 'metadata', 'frame'].includes(it.phase)) btn('Cancel', () => cancel(it));
  if (it.phase === 'error' && it.retry) btn('Try again', () => retry(it), 'is-primary');
  if (it.action) btn(it.action.label, () => { dismiss(it); it.action.run(); }, 'is-primary');
  if (it.phase === 'error' && it.input) btn('Choose another file', () => { dismiss(it); it.input.click(); });
  if (['done', 'local', 'error', 'cancelled'].includes(it.phase)) btn(it.phase === 'error' ? 'Close' : 'OK', () => dismiss(it));
  tray.hidden = items.size === 0;
}
function dismiss(it) {
  items.delete(it.id);
  const li = tray && tray.querySelector(`[data-it="${it.id}"]`);
  if (li) li.remove();
  if (tray) tray.hidden = items.size === 0;
}
function setPhase(it, phase, extra = {}) {
  Object.assign(it, extra, { phase });
  renderItem(it);
  if (phase === 'done' || phase === 'cancelled') setTimeout(() => { if (it.phase === phase) dismiss(it); }, phase === 'done' && !it.msg ? 2600 : 6000);
}
function cancel(it) {
  if (it.ctrl) it.ctrl.abort();
  setPhase(it, 'cancelled');
}
function retry(it) {
  setPhase(it, 'queued', { msg: '', hint: '', retry: false });
  run([it]);
}

/* --- the journal: an import that never finished (the tab closed or crashed) ---------- */
function journal(list) {
  try {
    if (list && list.length) {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify({ t: Date.now(), files: list.map((it) => ({ name: it.file.name, size: it.file.size })) }));
      const cur = localStorage.getItem(api.STORAGE_KEY);
      if (cur) localStorage.setItem(BEFORE_KEY, cur);
    } else {
      localStorage.removeItem(JOURNAL_KEY);
      localStorage.removeItem(BEFORE_KEY);
    }
  } catch (_) { /* storage full or private: the import still runs */ }
}
/** A message that stays in the tray until dismissed (recovery, a clip this browser can't show). */
export function notice(msg, hint = '', action = null) {
  const it = { id: `it${++seq}`, file: { name: '', size: 0 }, kind: 'notice', phase: 'error', msg, hint, retry: false, notice: true, action };
  items.set(it.id, it);
  renderItem(it);
  return it;
}
function recoverFromLastTime() {
  let j = null, before = null;
  try { j = JSON.parse(localStorage.getItem(JOURNAL_KEY) || 'null'); before = localStorage.getItem(BEFORE_KEY); } catch (_) {}
  if (!j) return;
  const names = (j.files || []).map((f) => `“${f.name}”`).join(', ');
  let now = null;
  try { now = localStorage.getItem(api.STORAGE_KEY); } catch (_) {}
  const changed = before && now && before !== now;
  journal(null);
  if (changed) {
    try { localStorage.setItem('askruth.backdrop-studio.v4.recovery', before); } catch (_) {}
    notice(`Adding ${names} didn’t finish last time.`, 'Your design is open as it was last saved. You can go back to the copy from just before that import.', {
      label: 'Use the copy from before',
      run: () => { try { localStorage.setItem(api.STORAGE_KEY, before); } catch (_) {} location.reload(); },
    });
  } else {
    notice(`Adding ${names} didn’t finish last time.`, 'Your design wasn’t changed. A smaller copy, or MP4 (H.264), usually works.');
  }
}

/* --- the run ------------------------------------------------------------------------ */
function newItem(file, input) {
  const it = { id: `it${++seq}`, file: withType(file), input, kind: kindOf(file), phase: 'queued', msg: '', hint: '', thumb: '', retry: false };
  items.set(it.id, it);
  renderItem(it);
  return it;
}

/** Wait until the app's own handler has finished with the file(s) we passed on. */
function waitForApp(input, before, errSel, n) {
  return new Promise((resolve) => {
    const errEl = errSel && document.querySelector(errSel);
    const errWas = errEl ? errEl.textContent : '';
    const t0 = Date.now();
    const tick = () => {
      const ids = idsInDesign(api.state());
      const added = [...ids].filter((id) => !before.has(id));
      if (added.length >= n) return resolve({ added });
      if (errEl && !errEl.hidden && errEl.textContent && errEl.textContent !== errWas) return resolve({ added, error: errEl.textContent });
      const toast = document.querySelector('#undo-toast');
      if (!errEl && toast && !toast.hidden && /not an image|over \d+ MB|cannot play|could not read/i.test(toast.textContent)) return resolve({ added, error: toast.textContent });
      if (Date.now() - t0 > 90000) return resolve({ added, error: 'The app didn’t finish adding the file within 90 seconds.' });
      setTimeout(tick, 250);
    };
    tick();
  });
}

function passOn(input, files) {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
  input.__v4pass = true;
  try { input.dispatchEvent(new Event('change', { bubbles: true })); } finally { input.__v4pass = false; }
}

async function run(list) {
  const input = list[0].input || document.querySelector('#file-input');
  journal(list);
  await refreshSizes();
  const ok = [];
  let projectBytes = cache.project, storeBytes = cache.store, quota = cache.quota;
  for (const it of list) {
    if (it.phase === 'cancelled') continue;
    it.ctrl = new AbortController();
    try {
      setPhase(it, 'check');
      precheck(it.file, { projectBytes, storeBytes, quotaLeft: quota });
      if (it.kind === 'video') {
        const info = await inspectVideo(it.file, { signal: it.ctrl.signal, onPhase: (p) => setPhase(it, p) });
        it.thumb = info.thumb;
        it.info = info;
        if (info.warnings.length) it.msg = info.warnings[0];
      }
      if (it.phase === 'cancelled') continue;
      projectBytes += it.file.size; storeBytes += it.file.size; quota -= it.file.size;
      ok.push(it);
    } catch (e) {
      if (it.phase === 'cancelled' || (e && e.code === 'cancelled')) { setPhase(it, 'cancelled'); continue; }
      const p = e instanceof MediaProblem ? e : new MediaProblem('unknown', 'Something went wrong reading that file.', String(e && e.message || e), true);
      setPhase(it, 'error', { msg: p.message, hint: p.hint, retry: p.retry });
    }
  }
  if (!ok.length) { journal(null); return; }

  // single-file inputs take one at a time
  const multi = input.multiple;
  const batches = multi ? [ok] : ok.map((it) => [it]);
  for (const batch of batches) {
    const before = idsInDesign(api.state());
    for (const it of batch) setPhase(it, 'saving');
    passOn(input, batch.map((it) => it.file));
    const res = await waitForApp(input, before, ERROR_FOR[input.id], batch.length);
    await refreshSizes();
    const stored = new Set(cache.rows.map((r) => r.id));
    batch.forEach((it, k) => {
      const id = res.added[k];
      if (!id) { setPhase(it, 'error', { msg: res.error || 'The file couldn’t be added.', hint: 'Your design wasn’t changed.', retry: true }); return; }
      if (!stored.has(id)) {
        setPhase(it, 'local', { msg: 'This browser couldn’t store it (storage full, or a private window). It works until you close this tab.', hint: 'Free some space and add it again to keep it.' });
        return;
      }
      setPhase(it, 'done');
    });
  }
  journal(null);
  api.afterImport && api.afterImport();
}

function intercept(files, input) {
  const list = files.map((f) => newItem(f, input));
  run(list);
}

/* --- install -------------------------------------------------------------------------- */
export function installImportGuard(appApi) {
  api = appApi;
  ensureTray();

  document.addEventListener('change', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (input.__v4pass || SKIP_INPUTS.has(input.id)) return;
    const files = [...(input.files || [])];
    if (!files.length) return;
    const anyVideo = files.some((f) => kindOf(f) === 'video');
    const typeless = files.some((f) => !f.type && kindOf(f));
    // pictures that are fine go straight through; videos and anything doubtful are checked first
    if (!anyVideo && !typeless) {
      try { files.forEach((f) => precheck(f, { projectBytes: cache.project, storeBytes: cache.store, quotaLeft: cache.quota })); return; } catch (_) { /* fall through: show why */ }
    }
    e.stopImmediatePropagation();
    input.value = '';
    intercept(files, input);
  }, true);

  // dropped on the page: the app imports drops as a Background
  window.addEventListener('drop', (e) => {
    if (e.__v4pass) return;
    const dt = e.dataTransfer;
    if (!dt || ![...(dt.types || [])].includes('Files')) return;
    const files = [...dt.files].filter((f) => kindOf(f));
    if (!files.some((f) => kindOf(f) === 'video' || !f.type)) return;   // pictures: the app's own drop
    e.preventDefault();
    e.stopImmediatePropagation();
    // let the app's drop handler reset its drag highlight, with nothing in it
    try {
      // a "Files" drop holding nothing the app imports: it resets its highlight and does nothing else
      const none = new DataTransfer();
      none.items.add(new File([''], 'none.txt', { type: 'text/plain' }));
      const empty = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: none });
      empty.__v4pass = true;
      window.dispatchEvent(empty);
    } catch (_) { /* no DragEvent constructor: clear it ourselves */ }
    document.body.classList.remove('dropping');
    intercept(files, document.querySelector('#file-input'));
  }, true);

  setInterval(() => { if (!items.size) refreshSizes(); }, 8000);
  refreshSizes();
  recoverFromLastTime();
}

/* --- decoder budget ---------------------------------------------------------------------
   Clips the open design doesn't use are paused, so only the clips you can see
   (and export) decode. They resume as soon as a design that uses them is open. */
export function installDecoderBudget(appApi, mediaFor) {
  const parked = new Set();
  const step = () => {
    if (appApi.busy()) return;                      // an export or playback owns the clips
    const used = idsInDesign(appApi.state());
    for (const r of cache.rows) {
      if (r.media !== 'video') continue;
      const m = mediaFor(r.id);
      if (!m || !m.el) continue;
      if (!used.has(r.id)) {
        if (!m.el.paused) { try { m.el.pause(); } catch (_) {} parked.add(r.id); }
      } else if (parked.has(r.id)) {
        parked.delete(r.id);
        m.el.play().catch(() => {});
      }
    }
  };
  setInterval(step, 1000);
  setTimeout(step, 300);
  return { parked };
}

/* --- clips already in a design that this browser can't show ------------------------------ */
export function reportUnplayable(appApi, mediaFor) {
  const used = idsInDesign(appApi.state());
  const bad = [];
  for (const id of used) {
    const m = mediaFor(id);
    if (m && m.media === 'video' && (!m.w || !m.h)) bad.push(id);
  }
  if (bad.length) {
    notice(`${bad.length === 1 ? 'A video' : `${bad.length} videos`} in this design can’t be shown in this browser (sound only).`,
      'It’s kept, not deleted. Replace it with an MP4 (H.264) copy: tap the section, then Background.');
  }
  return bad;
}

export { LIMITS };
