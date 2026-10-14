/* ==========================================================================
   v4/guard.js — the editor never goes blank silently, and "Saved" is only
   ever shown once the browser has really written the design.

   - Persistence: the app's save() swallows storage errors (protected code).
     We watch the one call it makes, localStorage.setItem(STORAGE_KEY, …), and
     record whether it succeeded, so the status in the top bar is the truth.
   - Faults: an uncaught error or a rejected promise shows a small banner
     with what to do, instead of leaving a dead or empty screen. The design
     is written first.
   - The preview canvas losing its GPU context (too many large clips at once)
     is reported and the frame repainted when the browser gives it back.
   ========================================================================== */

const listeners = new Set();
export const persistence = { state: 'idle', at: 0, error: '', bytes: 0 };

export function onPersistence(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(persistence); } catch (_) {} } }

export function watchPersistence(key) {
  const proto = Storage.prototype;
  if (proto.__v4wrapped) return;
  const orig = proto.setItem;
  proto.setItem = function setItem(k, v) {
    if (this !== window.localStorage || k !== key) return orig.call(this, k, v);
    persistence.state = 'saving'; emit();
    try {
      orig.call(this, k, v);
      persistence.state = 'saved';
      persistence.at = Date.now();
      persistence.error = '';
      persistence.bytes = (v && v.length) || 0;
      emit();
    } catch (e) {
      persistence.state = 'error';
      persistence.error = e && /quota/i.test(`${e.name} ${e.message}`)
        ? 'Browser storage is full'
        : 'This browser refused to save (private window or storage blocked)';
      emit();
      throw e;      // the app's own try/catch still sees it, as before
    }
  };
  proto.__v4wrapped = true;
}

let banner = null;
let faults = 0;
function showFault(msg) {
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'fault-banner';
    banner.className = 'fault-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = '<p class="fb-text"></p><div class="fb-actions"><button type="button" class="fb-reload">Reload</button><button type="button" class="fb-close" aria-label="Dismiss">×</button></div>';
    banner.querySelector('.fb-reload').addEventListener('click', () => location.reload());
    banner.querySelector('.fb-close').addEventListener('click', () => { banner.hidden = true; });
    document.body.append(banner);
  }
  banner.querySelector('.fb-text').textContent = msg;
  banner.hidden = false;
}

/** api: { persistNow, draw, canvas } */
export function installFaultGuard(api) {
  const report = (err, where) => {
    faults++;
    // one banner, however many errors follow it
    try { api.persistNow(); } catch (_) {}
    const saved = persistence.state === 'saved';
    showFault(`Something went wrong${where ? ` (${where})` : ''}. ${saved ? 'Your design is saved in this browser.' : 'The last change may not be saved.'} Reload to continue; nothing you saved is lost.`);
    // a short, private-content-free line for diagnosis
    try { console.warn('[v4 fault]', where || 'app', String(err && (err.message || err)).slice(0, 200)); } catch (_) {}
  };
  // only our own code's errors count: a browser extension, a blocked font or a media element's
  // own load error must not put a banner over a working editor
  const ours = (s) => typeof s === 'string' && /\/js\/[\w/.-]+\.js/.test(s);
  window.addEventListener('error', (e) => {
    if (!e.error || !(ours(e.filename) || ours(e.error.stack))) return;
    report(e.error, 'app');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (!r || !ours(r.stack)) return;
    if (r.name === 'AbortError' || r.name === 'NotAllowedError') return;   // play() and share() refusals
    report(r, 'app');
  });
  const c = api.canvas;
  if (c) {
    c.addEventListener('contextlost', (e) => {
      e.preventDefault();
      showFault('The preview lost its graphics memory (often too many large videos at once). It will come back by itself; if not, reload. Your design is saved.');
    });
    c.addEventListener('contextrestored', () => { if (banner) banner.hidden = true; try { api.draw(); } catch (_) {} });
  }
  return { faults: () => faults, report };
}
