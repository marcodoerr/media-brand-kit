/* ==========================================================================
   v4/captions.js — captions for reels: parse .srt / .vtt, and draw one cue
   in one of four brand styles. Pure functions; the app owns state and UI.
   - Clean      white type, soft shadow
   - Box        the brand's text-badge plate (Ask Ruth plum/pink, MoshPit
                night/turquoise, T4R navy/cyan)
   - Bold       the brand's headline face in capitals, thick outline
   - Highlight  each line on its own bar in the brand's button colours
   Sizes are relative to the canvas width, so every format and the export
   match the preview.
   ========================================================================== */

export const CAPTION_STYLES = [
  { id: 'clean', name: 'Clean' },
  { id: 'box', name: 'Box' },
  { id: 'bold', name: 'Bold' },
  { id: 'highlight', name: 'Highlight' },
];
export const CAPTION_POS = [{ id: 'top', name: 'Top' }, { id: 'middle', name: 'Middle' }, { id: 'bottom', name: 'Bottom' }];
export const captionDefaults = () => ({ on: true, style: 'box', scale: 1, pos: 'bottom', cues: [] });

/** "00:01:02,500" / "01:02.5" / "62.5" → seconds */
function secs(s) {
  const t = String(s).trim().replace(',', '.');
  const parts = t.split(':').map(Number);
  if (parts.some((x) => Number.isNaN(x))) return NaN;
  return parts.reduce((a, b) => a * 60 + b, 0);
}

/** SRT or WebVTT text → [{ start, end, text }] (sorted, empty cues dropped). */
export function parseCues(text) {
  const out = [];
  const src = String(text || '').replace(/\r/g, '').replace(/^﻿/, '');
  for (const block of src.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const start = secs(a), end = secs(String(b).trim().split(/\s+/)[0]);
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').trim();
    if (!body || !(end > start)) continue;
    out.push({ start: Math.max(0, start), end, text: body });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** A pasted script → cues spread over `total` seconds, by word count (sentences or lines). */
export function cuesFromScript(script, total) {
  const pieces = String(script || '').replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (!pieces.length || !(total > 0)) return [];
  const words = pieces.map((p) => Math.max(1, p.split(/\s+/).length));
  const sum = words.reduce((a, b) => a + b, 0);
  let t = 0;
  return pieces.map((text, k) => {
    const d = (words[k] / sum) * total;
    const c = { start: Math.round(t * 10) / 10, end: Math.round((t + d) * 10) / 10, text };
    t += d;
    return c;
  });
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function srtTime(s) {
  const ms = Math.round(s * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
/** cues → .srt text (for the captions file next to the video). */
export function toSrt(cues) {
  return (cues || []).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}

export const cueAt = (cues, t) => (cues || []).find((c) => t >= c.start && t < c.end) || null;

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

/**
 * Draw one caption.
 * brand: { headFamily, headWeight, bodyFamily, plateFill, plateInk, btnBg, btnInk, upperHead }
 */
export function drawCaption(ctx, W, H, text, opt, brand) {
  if (!text) return;
  const style = opt.style || 'box';
  const scale = Math.max(0.5, Math.min(2, Number(opt.scale) || 1));
  const bold = style === 'bold';
  let size = W * (bold ? 0.064 : 0.05) * scale;
  const fam = bold ? brand.headFamily : brand.bodyFamily;
  const weight = bold ? brand.headWeight || 800 : 600;
  const maxW = W * 0.82;
  const str = bold ? String(text).toUpperCase() : String(text);
  let lines;
  for (let k = 0; k < 6; k++) {   // shrink until it fits in three lines
    ctx.font = `${weight} ${Math.round(size)}px ${fam}`;
    lines = wrap(ctx, str, maxW);
    if (lines.length <= 3) break;
    size *= 0.88;
  }
  const lh = size * 1.22;
  const blockH = lines.length * lh;
  const cy = opt.pos === 'top' ? H * 0.2 : opt.pos === 'middle' ? H * 0.5 : H * 0.72;
  const y0 = cy - blockH / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const padX = size * 0.5, padY = size * 0.24;
  if (style === 'box') {
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = brand.plateFill;
    roundRect(ctx, W / 2 - w / 2, y0 - padY, w, blockH + padY * 2, size * 0.42);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  lines.forEach((l, i) => {
    const y = y0 + lh * i + lh / 2;
    if (style === 'highlight') {
      const w = ctx.measureText(l).width + padX * 1.4;
      ctx.fillStyle = brand.btnBg;
      roundRect(ctx, W / 2 - w / 2, y - lh / 2 + size * 0.04, w, lh - size * 0.08, size * 0.22);
      ctx.fill();
      ctx.fillStyle = brand.btnInk;
      ctx.fillText(l, W / 2, y);
    } else if (style === 'bold') {
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.strokeStyle = brand.plateFill;
      ctx.strokeText(l, W / 2, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(l, W / 2, y);
    } else if (style === 'clean') {
      ctx.shadowColor = 'rgba(0, 0, 0, .6)';
      ctx.shadowBlur = size * 0.35;
      ctx.shadowOffsetY = size * 0.05;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(l, W / 2, y);
      ctx.shadowColor = 'transparent';
    } else {
      ctx.fillStyle = brand.plateInk;
      ctx.fillText(l, W / 2, y);
    }
  });
  ctx.restore();
}
