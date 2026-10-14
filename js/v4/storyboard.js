/* ==========================================================================
   v4/storyboard.js — Slides from text, step 1: a deterministic storyboard.

   No AI, no network. This only PREPARES the text the user gave: it finds the
   slides, headings, paragraphs, lists and the call to action that are already
   there, in their order, and never writes, shortens or invents a word.
   (Writing a storyboard from a topic — choosing a narrative, wording — is a
   separate, later release behind its own flag; see StoryboardProvider.)

   Input
   - Structured JSON: { title?, slides: [{ heading?, body?, bullets?: [], button?,
     image?: '<upload id>', kind?: 'title'|'point'|'list'|'image'|'cta' }] }
   - Plain text (Markdown-like):
       ---            a line of 3+ dashes (or ===) starts a new slide
       # Heading      a heading starts a new slide (##, ### too)
       - item         list items (also *, •, "1." and "1)")
       Button: Text   the call to action's button (on the last slide)
       ![alt](x)      an image slot — pictures are never fetched from links
     Without separators or headings, blank-line paragraphs become slides of
     their own only when the text is long; short text stays on one slide.
   Output: { ok, items: [StoryboardItem], notes: [], error? }
   ========================================================================== */

/**
 * @typedef {'title'|'point'|'list'|'image'|'cta'} SlideKind
 * @typedef {{ start: number, end: number }} SourceRef   character range in the input
 * @typedef {{
 *   id: string, kind: SlideKind, heading: string, paragraphs: string[],
 *   button: string|null, image: { ref: string|null, alt: string }|null,
 *   src: SourceRef, needsContent?: boolean
 * }} StoryboardItem
 * @typedef {{ ok: boolean, items: StoryboardItem[], notes: string[], error?: { code: string, message: string } }} Storyboard
 * @typedef {{ maxSlides?: number }} StoryboardOptions
 *
 * The interface a storyboard provider implements. The deterministic one below is
 * the only provider in this release; an AI provider would be registered behind
 * FLAGS.aiStoryboard (off) and must return the same shape, BEFORE layout.
 * @typedef {{ id: string, label: string, prepare: (input: string|object, opts?: StoryboardOptions) => Promise<Storyboard> }} StoryboardProvider
 */

export const STORYBOARD_LIMITS = {
  maxChars: 20000,       // input size cap (the dialog and the CLI both enforce it)
  maxSlides: 30,         // configured default; the dialog's Advanced settings can lower it
  topicWords: 12,        // a single line under this many words is a topic, not slide text
};

const SEP = /^\s*(?:-{3,}|={3,})\s*$/;
const HEAD = /^\s*(#{1,3})\s+(.+?)\s*#*\s*$/;
const LIST = /^\s*(?:[-*•]|\d{1,3}[.)])\s+/;
const BUTTON = /^\s*(?:button|cta)\s*:\s*(.+?)\s*$/i;
const IMAGE = /^\s*!\[([^\]]*)\]\(([^)]*)\)\s*$/;

const clean = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[​﻿]/g, '');
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
let seq = 0;
const nid = () => `sb${(++seq).toString(36)}`;

/** A list line in the app's own form: "- item" (bullets) or "1. item" kept as written. */
function listLine(line) {
  const t = line.trim();
  if (/^[-*•]\s+/.test(t)) return `- ${t.replace(/^[-*•]\s+/, '')}`;
  return t;   // numbered: the number is part of the text
}

function kindOf(it, k, n) {
  if (it.button) return 'cta';
  if (it.image) return 'image';
  if (it.paragraphs.some((p) => /^- /.test(p) || /^\d{1,3}[.)]\s/.test(p))) return 'list';
  if (k === 0 && it.heading && it.paragraphs.join(' ').length <= 140 && n > 1) return 'title';
  return 'point';
}

/** One block of lines → an item (heading, paragraphs, button, image). */
function blockItem(lines, start, end, notes) {
  const it = { id: nid(), kind: null, heading: '', paragraphs: [], button: null, image: null, src: { start, end } };
  let para = [];
  const flush = () => { if (para.length) { it.paragraphs.push(para.join(' ')); para = []; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(HEAD))) {
      flush();
      if (!it.heading && !it.paragraphs.length) it.heading = m[2].trim();
      else it.paragraphs.push(m[2].trim());   // a second heading inside one slide stays as text, in order
      continue;
    }
    if ((m = line.match(BUTTON))) { flush(); it.button = m[1]; continue; }
    if ((m = line.match(IMAGE))) {
      flush();
      const ref = /^upload:/.test(m[2]) ? m[2].slice(7) : null;
      it.image = { ref, alt: m[1] };
      if (!ref) notes.push(`Pictures aren’t loaded from links: add “${m[1] || 'the picture'}” to that slide yourself (Add element → Picture).`);
      continue;
    }
    if (LIST.test(line)) { flush(); it.paragraphs.push(listLine(line)); continue; }
    para.push(line.trim());
  }
  flush();
  return it;
}

/** Plain text → blocks of lines (by separators and headings). */
function splitText(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = [], start = 0, pos = 0, curStart = 0;
  const push = (end) => { if (cur.some((l) => l.trim())) blocks.push({ lines: cur, start: curStart, end }); cur = []; };
  for (const line of lines) {
    const lineEnd = pos + line.length;
    if (SEP.test(line)) { push(pos); curStart = lineEnd + 1; }
    else if (HEAD.test(line) && cur.some((l) => l.trim())) { push(pos); curStart = pos; cur.push(line); }
    else { if (!cur.length) curStart = pos; cur.push(line); }
    pos = lineEnd + 1;
  }
  push(text.length);
  void start;
  return blocks;
}

/** A long block without headings: its paragraphs become slides of their own (in order). */
function spreadLong(items) {
  if (items.length !== 1) return items;
  const it = items[0];
  if (it.heading || it.paragraphs.length < 3 || it.paragraphs.join(' ').length < 420) return items;
  return it.paragraphs.map((p, k) => ({ ...it, id: nid(), heading: '', paragraphs: [p], button: k === it.paragraphs.length - 1 ? it.button : null, image: k === 0 ? it.image : null }));
}

function fromJson(obj, notes) {
  const slides = Array.isArray(obj) ? obj : obj && Array.isArray(obj.slides) ? obj.slides : null;
  if (!slides) return { error: { code: 'schema', message: 'The JSON needs a “slides” list.' } };
  const items = [];
  const str = (v, name, k) => {
    if (v == null) return '';
    if (typeof v !== 'string') throw new Error(`Slide ${k + 1}: “${name}” must be text.`);
    return clean(v).trim();
  };
  try {
    slides.forEach((s, k) => {
      if (!s || typeof s !== 'object') throw new Error(`Slide ${k + 1} must be an object.`);
      const heading = str(s.heading ?? s.title, 'heading', k);
      const body = str(s.body, 'body', k);
      const paragraphs = body ? body.split(/\n\s*\n/).flatMap((p) => p.split('\n').some((l) => LIST.test(l)) ? p.split('\n').filter((l) => l.trim()).map((l) => (LIST.test(l) ? listLine(l) : l.trim())) : [p.replace(/\s*\n\s*/g, ' ').trim()]).filter(Boolean) : [];
      if (s.bullets != null) {
        if (!Array.isArray(s.bullets)) throw new Error(`Slide ${k + 1}: “bullets” must be a list.`);
        for (const b of s.bullets) paragraphs.push(`- ${str(b, 'bullets', k)}`);
      }
      const button = s.button != null ? str(s.button, 'button', k) || null : null;
      const image = s.image != null ? { ref: str(s.image, 'image', k).replace(/^upload:/, '') || null, alt: str(s.alt, 'alt', k) } : null;
      const kinds = ['title', 'point', 'list', 'image', 'cta'];
      if (s.kind != null && !kinds.includes(s.kind)) throw new Error(`Slide ${k + 1}: “kind” is one of ${kinds.join(', ')}.`);
      if (!heading && !paragraphs.length && !button && !image) throw new Error(`Slide ${k + 1} is empty.`);
      items.push({ id: nid(), kind: s.kind || null, heading, paragraphs, button, image, src: { start: k, end: k + 1 } });
    });
  } catch (e) { return { error: { code: 'schema', message: e.message } }; }
  void notes;
  return { items };
}

/** The deterministic preparation. Same input → same storyboard. */
export function prepareStoryboard(input, opts = {}) {
  seq = 0;
  const notes = [];
  const maxSlides = Math.max(1, Math.min(STORYBOARD_LIMITS.maxSlides, opts.maxSlides || STORYBOARD_LIMITS.maxSlides));
  let items;
  if (input && typeof input === 'object') {
    const r = fromJson(input, notes);
    if (r.error) return { ok: false, items: [], notes, error: r.error };
    items = r.items;
  } else {
    const text = clean(input);
    if (text.length > STORYBOARD_LIMITS.maxChars) return { ok: false, items: [], notes, error: { code: 'too-big', message: `That’s more than ${STORYBOARD_LIMITS.maxChars.toLocaleString('en')} characters. Split it into two decks.` } };
    const t = text.trim();
    if (!t) return { ok: false, items: [], notes, error: { code: 'empty', message: 'Paste or type the text for your slides.' } };
    if (/^[[{]/.test(t)) {
      try { return prepareStoryboard(JSON.parse(t), opts); } catch (_) { /* not JSON: plain text */ }
    }
    if (!t.includes('\n') && words(t) < STORYBOARD_LIMITS.topicWords && !HEAD.test(t)) {
      return { ok: false, items: [], notes, error: { code: 'needs-content', message: 'That reads like a topic. Add the text you want on the slides (headings, paragraphs, lists) — slides aren’t written for you in this release.' } };
    }
    items = spreadLong(splitText(text).map((b) => blockItem(b.lines, b.start, b.end, notes)));
  }
  items = items.filter((it) => it.heading || it.paragraphs.length || it.button || it.image);
  if (!items.length) return { ok: false, items: [], notes, error: { code: 'empty', message: 'There’s no text to put on slides.' } };
  // the kind follows what is there (a button makes a CTA wherever it is, as written);
  // a kind given in JSON is kept, except a CTA without a button
  items.forEach((it, k) => { if (!it.kind || (it.kind === 'cta' && !it.button)) it.kind = kindOf(it, k, items.length); });
  if (items.length > maxSlides) return { ok: false, items, notes, error: { code: 'max-slides', message: `That makes ${items.length} slides; the limit is ${maxSlides}. Split the text into two decks, or raise the limit in Advanced.` } };
  return { ok: true, items, notes };
}

/** @type {StoryboardProvider} */
export const deterministicProvider = {
  id: 'deterministic',
  label: 'From your text (no AI)',
  prepare: async (input, opts) => prepareStoryboard(input, opts),
};

/* ---- splitting for continuation slides ------------------------------------------------ */
const ABBR = /(?:\b(?:z\.\s?B|d\.\s?h|u\.\s?a|bzw|ca|vgl|usw|etc|e\.g|i\.e|vs|Dr|Mr|Mrs|Ms|Prof|Nr|St|Inc|Ltd|Co|Jr|Sr|No|Abb|Tel)\.)$/i;
/** A paragraph → its sentences (never inside an abbreviation, a number like 3.5 or a URL). */
export function sentencesOf(p) {
  const s = String(p);
  const out = [];
  let from = 0;
  const re = /([.!?…]["”»’)]*)\s+(?=["“„«(]?[A-ZÄÖÜ0-9])/g;
  let m;
  while ((m = re.exec(s))) {
    const end = m.index + m[1].length;
    const head = s.slice(from, end);
    if (ABBR.test(head) || /\d\.$/.test(head) && /^\d/.test(s.slice(re.lastIndex))) continue;
    out.push(head.trim());
    from = re.lastIndex;
  }
  out.push(s.slice(from).trim());
  return out.filter(Boolean);
}

const isItem = (p) => /^- /.test(p) || /^\d{1,3}[.)]\s/.test(p);
/** The break between two paragraphs as the app stores it: a list keeps its items on
    consecutive lines; prose paragraphs get a blank line between them. */
export const sepBetween = (a, b) => (isItem(a) && isItem(b) ? '\n' : '\n\n');
/** The slide's body text as the app stores it. */
export const bodyOf = (paras) => paras.reduce((acc, p, i) => (i ? acc + sepBetween(paras[i - 1], p) + p : p), '');

/** All words of a storyboard, in order — what every layout must still show. */
export function sourceWords(items) {
  const out = [];
  for (const it of items) {
    for (const t of [it.heading, ...it.paragraphs, it.button || '']) for (const w of String(t).replace(/^- /gm, '').split(/\s+/)) if (w) out.push(w);
  }
  return out;
}
