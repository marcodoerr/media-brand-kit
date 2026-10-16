/* ==========================================================================
   v4/appearance.js — Interface color: one slider, Neutral ↔ Full brand color.

   Editor chrome only. It never touches the canvas, thumbnails, swatches,
   exports or project data:
   - The brand's own tokens (styles.css, :root[data-brand=…]) stay untouched.
     Every change first removes this layer's inline overrides, reads the
     brand's original values, and derives new ones from them — never from
     already-changed values.
   - Colours are muted in OKLCH: chroma × amount, lightness kept, so a dark
     interface stays dark and a light one stays light.
   - At Full brand color (the default) there are no overrides at all: the
     interface is exactly the original.
   - Focus rings, errors and the editor overlays (selection ✕, the active
     section's outline) keep the brand's full colour through --ov-* tokens.
     Grid, safe area and selection lines are drawn on the canvas with their
     own fixed colours and are not affected.
   - Foreground/background pairs are re-checked after muting; a pair that
     lost contrast has its foreground moved in lightness until it is back.
   - A browser preference (localStorage), not project content: it is not
     saved with a design and never enters Undo.
   ========================================================================== */

export const APPEAR_KEY = 'askruth.backdrop-studio.ui-colour';

/** Chrome tokens that are muted. Not listed (never muted): --focus, --error, --surface-*
 *  (the light/dark preview ground), shadows, and the content palette. */
export const CHROME_TOKENS = [
  '--ui-bg', '--ui-glow-1', '--ui-glow-2', '--ui-topbar', '--ui-panel', '--ui-panel-solid',
  '--ui-field', '--ui-field-soft', '--ui-field-strong', '--ui-field-solid', '--ui-toggle',
  '--ui-stage-glass', '--ui-sheet-top', '--ui-sheet-bottom', '--ui-popover', '--ui-menu',
  '--line', '--line-soft', '--txt', '--txt-dim', '--heading',
  '--accent', '--accent-hover', '--on-accent', '--accent-tint', '--accent-tint-soft', '--accent-wash',
  '--active', '--on-active', '--active-tint', '--add', '--on-add',
  '--ratio-border', '--ratio-tint', '--range-track', '--outline', '--outline-text',
  '--mark-bg', '--placeholder', '--mono-bg', '--switch-off', '--scrim', '--caret',
];
/** Overlay tokens: copies of the original colours, so selection cues and focus never fade. */
const OVERLAY = { '--ov-active': '--active', '--ov-on-active': '--on-active' };
/** [foreground, background] pairs to keep readable. */
export const CONTRAST_PAIRS = [
  ['--on-accent', '--accent'], ['--on-active', '--active'], ['--on-add', '--add'],
  ['--txt', '--ui-panel-solid'], ['--txt-dim', '--ui-panel-solid'], ['--heading', '--ui-bg'],
  ['--txt', '--ui-bg'], ['--outline-text', '--ui-panel-solid'], ['--txt', '--ui-popover'],
];

/* ---- colour maths: sRGB ↔ OKLab ↔ OKLCH ---------------------------------------------- */
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function rgbToOklch([r, g, b]) {
  const R = toLin(r / 255), G = toLin(g / 255), B = toLin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
}
export function oklchToRgb([L, C, h]) {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map((c) => Math.round(Math.max(0, Math.min(1, toSrgb(Math.max(0, Math.min(1, c))))) * 255));
}
/** Mute one rgb triple: chroma × k, lightness and hue kept. */
export function muteRgb(rgb, k) {
  if (k >= 1) return rgb.slice();
  const [L, C, h] = rgbToOklch(rgb);
  return oklchToRgb([L, C * Math.max(0, k), h]);
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const toHex = (rgb) => `#${rgb.map(hex2).join('')}`;
function parseHex(h) {
  let s = h.replace('#', '');
  if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
/** Every colour literal in a token value (#hex, rgb(), rgba(), %23hex inside an SVG url), muted. */
export function muteValue(v, k) {
  if (k >= 1 || !v) return v;
  return String(v)
    .replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(,\s*[\d.]+\s*)?\)/g, (all, r, g, b, a) => {
      const m = muteRgb([+r, +g, +b], k);
      return a ? `rgba(${m.join(', ')}${a.replace(/\s+/g, ' ')})` : `rgb(${m.join(', ')})`;
    })
    .replace(/(%23|#)([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g, (all, pre, hex) => pre + toHex(muteRgb(parseHex(hex), k)).slice(1));
}

/* ---- contrast ------------------------------------------------------------------------- */
function parseColour(v) {
  const s = String(v || '').trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { const rgb = parseHex(s); const a = m[1].length === 8 ? parseInt(m[1].slice(6), 16) / 255 : 1; return { rgb, a }; }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] == null ? 1 : +m[4] };
  return null;
}
const lum = (rgb) => { const [r, g, b] = rgb.map((c) => toLin(c / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a)));

/* ---- the token layer ------------------------------------------------------------------ */
let amount = 1;          // 0 = Neutral … 1 = Full brand color
let lastAudit = [];
const root = () => document.documentElement;

function clearLayer() {
  const st = root().style;
  for (const t of [...CHROME_TOKENS, ...Object.keys(OVERLAY)]) st.removeProperty(t);
}
function originals() {
  const cs = getComputedStyle(root());
  const o = {};
  for (const t of CHROME_TOKENS) o[t] = cs.getPropertyValue(t).trim();
  return o;
}

/** Apply `k` (0…1). Always recomputed from the brand's original tokens. */
export function applyAppearance(k = amount) {
  amount = Math.max(0, Math.min(1, Number.isFinite(+k) ? +k : 1));
  clearLayer();
  root().dataset.uiColour = String(Math.round(amount * 100));
  if (amount >= 1) { lastAudit = []; return; }       // Full brand color: the original, exactly
  const o = originals();
  const st = root().style;
  for (const [ov, src] of Object.entries(OVERLAY)) if (o[src]) st.setProperty(ov, o[src]);
  const out = {};
  for (const t of CHROME_TOKENS) if (o[t]) out[t] = muteValue(o[t], amount);
  // contrast: a pair may not end up harder to read than min(original, 4.5:1)
  const page = parseColour(o['--ui-bg']);
  const pageRgb = page ? page.rgb : [0, 0, 0];
  lastAudit = [];
  for (const [f, b] of CONTRAST_PAIRS) {
    const F0 = parseColour(o[f]), B0 = parseColour(o[b]), F1 = parseColour(out[f]), B1 = parseColour(out[b]);
    if (!F0 || !B0 || !F1 || !B1) continue;
    const bg0 = over(B0, pageRgb), bg1 = over(B1, parseColour(out['--ui-bg'])?.rgb || pageRgb);
    const need = Math.min(contrast(over(F0, bg0), bg0), 4.5) - 0.02;
    let fg = F1.rgb, r = contrast(over({ rgb: fg, a: F1.a }, bg1), bg1), steps = 0;
    if (r < need) {
      const lighter = lum(bg1) < 0.18;
      let [L, C, h] = rgbToOklch(fg);
      while (r < need && steps < 40) {
        L = Math.max(0, Math.min(1, L + (lighter ? 0.01 : -0.01)));
        fg = oklchToRgb([L, C, h]);
        r = contrast(over({ rgb: fg, a: F1.a }, bg1), bg1);
        steps++;
      }
      out[f] = F1.a < 1 ? `rgba(${fg.join(', ')}, ${F1.a})` : toHex(fg);
    }
    lastAudit.push({ fg: f, bg: b, need: +need.toFixed(2), ratio: +r.toFixed(2), adjusted: steps > 0, ok: r >= need });
  }
  for (const [t, v] of Object.entries(out)) if (v !== o[t]) st.setProperty(t, v);
}

export const appearanceAudit = () => lastAudit.slice();
export const appearanceAmount = () => amount;

function load() {
  try { const v = localStorage.getItem(APPEAR_KEY); if (v !== null && v !== '' && Number.isFinite(+v)) return Math.max(0, Math.min(100, +v)) / 100; } catch (_) {}
  return 1;
}
function store(k) {
  try { if (k >= 1) localStorage.removeItem(APPEAR_KEY); else localStorage.setItem(APPEAR_KEY, String(Math.round(k * 100))); } catch (_) {}
}

// a water drop, half filled: saturation (the preview's light/dark toggle keeps the half-filled circle)
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2s-6.2 6.6-6.2 10.9a6.2 6.2 0 0 0 12.4 0C18.2 9.8 12 3.2 12 3.2z"/><path d="M12 3.2v17.1a6.2 6.2 0 0 0 6.2-6.2C18.2 9.8 12 3.2 12 3.2z" fill="currentColor" stroke="none"/></svg>';

/** The header button + its Appearance dropdown. `before`: the element it goes in front of. */
export function wireAppearance(before) {
  applyAppearance(load());
  // a brand switch swaps the original tokens: derive again from the new brand
  new MutationObserver(() => { if (amount < 1) applyAppearance(amount); })
    .observe(root(), { attributes: true, attributeFilter: ['data-brand'] });
  if (!before || document.getElementById('btn-appearance')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-appearance';
  btn.className = 'save-heart appear-btn';
  btn.setAttribute('aria-label', 'Appearance');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'appear-pop');
  btn.dataset.tip = 'Appearance';
  btn.innerHTML = ICON;
  before.parentNode.insertBefore(btn, before);

  const pop = document.createElement('div');
  pop.className = 'save-pop appear-pop';
  pop.id = 'appear-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', 'appear-title');
  pop.hidden = true;
  pop.innerHTML = `
    <h2 class="save-pop-title" id="appear-title">Appearance</h2>
    <label class="appear-label" for="appear-range">Interface color</label>
    <input type="range" id="appear-range" min="0" max="100" step="5">
    <div class="appear-ends" aria-hidden="true"><span>Neutral</span><span>Full brand color</span></div>
    <p class="save-pop-sub appear-note">Only the editor around your design. Your design, its colors and exports don’t change.</p>
    <div class="save-pop-actions"><button class="link-btn" id="appear-reset" type="button">Reset to full brand color</button></div>`;
  document.body.append(pop);
  const range = pop.querySelector('#appear-range');
  const reset = pop.querySelector('#appear-reset');
  const sync = () => {
    const v = Math.round(amount * 100);
    range.value = String(v);
    range.setAttribute('aria-valuetext', v >= 100 ? 'Full brand color' : v <= 0 ? 'Neutral' : `${v}% brand color`);
    range.style.setProperty('--fill', `${v}%`);
    reset.disabled = v >= 100;
  };
  sync();
  range.addEventListener('input', () => { applyAppearance(+range.value / 100); sync(); });
  range.addEventListener('change', () => store(amount));
  reset.addEventListener('click', () => { applyAppearance(1); store(1); sync(); range.focus(); });
  const place = () => {
    const r = btn.getBoundingClientRect();
    if (window.innerWidth > 820) { pop.style.top = `${Math.round(r.bottom + 8)}px`; pop.style.right = `${Math.max(14, Math.round(window.innerWidth - r.right))}px`; }
    else { pop.style.top = ''; pop.style.right = ''; }
  };
  const open = () => { sync(); place(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); range.focus({ preventScroll: true }); };
  const close = (focusBtn) => { if (pop.hidden) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focusBtn) btn.focus({ preventScroll: true }); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); if (pop.hidden) open(); else close(); });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) close(); }, true);
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } });
  window.addEventListener('resize', () => { if (!pop.hidden) place(); });
}
