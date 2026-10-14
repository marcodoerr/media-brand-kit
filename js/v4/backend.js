/* ==========================================================================
   v4/backend.js — the browser's side of the (not yet provisioned) media
   backend: resumable uploads to private object storage, processing jobs
   (validate, transcode a browser-friendly preview), and server renders.

   Nothing here is live. `BACKEND` is null until the endpoints in BACKEND.md
   exist; every call then throws BackendUnavailable and the UI says
   "not set up yet". No upload or render is ever reported as done unless the
   server said so. No secret lives in this file: the browser only ever holds
   short-lived signed URLs the server hands out.
   ========================================================================== */

/** Set at deploy time (e.g. a <meta name="mbk-backend" content="https://…/api">). Null = no backend. */
export const BACKEND = (() => {
  try {
    const m = document.querySelector('meta[name="mbk-backend"]');
    return m && m.content ? m.content.replace(/\/$/, '') : null;
  } catch (_) { return null; }
})();

export class BackendUnavailable extends Error {
  constructor(what) { super(`${what} isn’t available yet: the media backend hasn’t been set up.`); this.code = 'unavailable'; }
}

export const isAvailable = () => !!BACKEND;

async function call(path, init = {}) {
  if (!BACKEND) throw new BackendUnavailable('This');
  const r = await fetch(`${BACKEND}${path}`, { credentials: 'include', headers: { 'content-type': 'application/json' }, ...init });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = r.status; e.retry = r.status >= 500 || r.status === 429; throw e;
  }
  return r.json();
}

/**
 * Resumable multipart upload. The server checks size, type and the project's quota before it
 * signs anything. Parts go straight to storage on signed URLs; progress is real bytes acknowledged.
 * Returns { uploadId, mediaId }. `signal` cancels; `resumeFrom` continues an interrupted upload.
 */
export async function uploadMedia(file, { projectId, onProgress, signal, resumeFrom } = {}) {
  if (!BACKEND) throw new BackendUnavailable('Cloud upload');
  const PART = 16 * 1024 * 1024;
  const start = resumeFrom || await call('/uploads', { method: 'POST', body: JSON.stringify({ projectId, name: file.name, type: file.type, size: file.size, parts: Math.ceil(file.size / PART) }) });
  const done = new Set(start.doneParts || []);
  let sent = done.size * PART;
  const etags = start.etags || {};
  for (let n = 0; n * PART < file.size; n++) {
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (done.has(n)) continue;
    const { url } = await call(`/uploads/${start.uploadId}/parts/${n}`, { method: 'POST' });
    const r = await fetch(url, { method: 'PUT', body: file.slice(n * PART, (n + 1) * PART), signal });
    if (!r.ok) { const e = new Error(`part ${n}: ${r.status}`); e.retry = true; throw e; }
    etags[n] = r.headers.get('etag');
    sent = Math.min(file.size, sent + PART);
    onProgress && onProgress(sent / file.size);
  }
  return call(`/uploads/${start.uploadId}/complete`, { method: 'POST', body: JSON.stringify({ etags }) });
}

/** A processing or render job: { id, kind, state: queued|running|done|failed, progress, error, outputs }. */
export const getJob = (id) => call(`/jobs/${id}`);
export const retryJob = (id) => call(`/jobs/${id}/retry`, { method: 'POST' });
export const cancelJob = (id) => call(`/jobs/${id}/cancel`, { method: 'POST' });

/** Final server render of a project (same layout code, fonts and assets as the browser). */
export async function requestRender(projectJson, { format, scale = 1, sections } = {}) {
  if (!BACKEND) throw new BackendUnavailable('Server rendering');
  return call('/renders', { method: 'POST', body: JSON.stringify({ project: projectJson, format, scale, sections }) });
}

/** Poll a job until it ends; never claims success the server didn't report. */
export async function waitForJob(id, { onUpdate, signal, everyMs = 2000 } = {}) {
  for (;;) {
    if (signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const j = await getJob(id);
    onUpdate && onUpdate(j);
    if (j.state === 'done' || j.state === 'failed') return j;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
