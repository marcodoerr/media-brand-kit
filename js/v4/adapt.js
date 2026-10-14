/* ==========================================================================
   v4/adapt.js — rule-based "Adapt layout": when a design moves to a size
   with less (or more) room, its long text is spread over more sections (or
   gathered back), without rewriting, shortening or removing a word.

   The rules
   - Only a section's body text moves, and only at a paragraph or list-item
     boundary (a line break). A heading stays with the text that follows it.
   - Hook and the closing CTA are never split or merged.
   - A section the user made, or locked, is never merged away; a locked
     section is never split either. Only sections this engine generated
     (`sc.auto = { from, sep }`) are ever removed — and only by giving their
     text back to the section they came from, separator and all, so going
     back to the first size restores the text exactly.
   - A section whose single paragraph doesn't fit at its size is left as it
     is and reported: nothing is shrunk below its size or cut.

   This module only plans. The app measures (it owns layout) and applies the
   plan as one undoable step.
   ========================================================================== */

/** Body text as units: [{ text, sep }], `sep` being the exact break before it ('' for the first). */
export function unitsOf(body) {
  const s = String(body || '');
  const parts = s.split(/(\n+)/);
  const out = [];
  let sep = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i % 2 === 1) { sep += p; continue; }
    if (p === '' && out.length === 0 && i < parts.length - 1) { sep = ''; continue; }   // leading breaks are kept below
    if (p === '') { continue; }
    out.push({ text: p, sep: out.length ? sep : '' });
    sep = '';
  }
  // leading / trailing breaks belong to the text: keep them on the ends
  const lead = (s.match(/^\n+/) || [''])[0];
  const trail = (s.match(/\n+$/) || [''])[0];
  if (out.length) { out[0].lead = lead; out[out.length - 1].trail = trail; }
  return out;
}
export function joinUnits(units) {
  return units.map((u, i) => (i ? u.sep : (u.lead || '')) + u.text + (i === units.length - 1 ? (u.trail || '') : '')).join('');
}

/** A section the engine made and nobody has given anything else since. */
export function isPureAuto(sc) {
  if (!sc || !sc.auto || !sc.auto.from) return false;
  if (String(sc.h1 || '').trim()) return false;
  for (const k of ['buttons', 'media', 'badges', 'blocks', 'drawings']) if ((sc[k] || []).length) return false;
  if (sc.inset && sc.inset.id && !sc.inset.hidden) return false;
  return !sc.locked;
}

/** Sections in chains: a section and the generated ones right after it that came from it. */
export function chainsOf(scenes) {
  const chains = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (isPureAuto(sc) && chains.length && chains[chains.length - 1].head.id === sc.auto.from) {
      chains[chains.length - 1].kids.push(i);
      continue;
    }
    chains.push({ head: sc, at: i, kids: [] });
  }
  return chains;
}

/** The whole text of a chain, exactly as it was before it was split. */
export function chainText(scenes, chain) {
  let t = String(chain.head.body || '');
  for (const k of chain.kids) t += (scenes[k].auto.sep || '\n') + String(scenes[k].body || '');
  return t;
}

/**
 * Plan. `measure(kind, sceneIndex, bodyText)` returns { need, avail } in canvas px for the
 * target size: kind 'head' = the chain's own section with that body; 'cont' = a body-only
 * continuation of it. Returns { ops, before, after, notes }.
 */
export function plan(scenes, measure) {
  const ops = [];
  const notes = [];
  const chains = chainsOf(scenes);
  let after = 0;
  for (const ch of chains) {
    const sc = ch.head;
    const splittable = sc.role === 'value' && !sc.locked && (sc.visibility !== 'none');
    const text = chainText(scenes, ch);
    const units = unitsOf(text);
    if (!splittable || units.length < 1) {
      after += 1 + ch.kids.length;
      if (sc.role !== 'value' || sc.locked) {
        const m = measure('head', ch.at, sc.body);
        if (m && m.need > m.avail + 1) notes.push({ at: ch.at, kind: sc.locked ? 'locked' : sc.role, msg: 'doesn’t fit at this size' });
      }
      continue;
    }
    // greedy: as many whole units as fit; the first chunk sits with the section's own items
    const chunks = [];
    let cur = [];
    const fits = (kind, list) => { const m = measure(kind, ch.at, joinUnits(list)); return !m || m.need <= m.avail + 1; };
    for (const u of units) {
      const kind = chunks.length ? 'cont' : 'head';
      const tryList = [...cur, u];
      if (!cur.length || fits(kind, tryList)) { cur = tryList; continue; }
      chunks.push(cur);
      cur = [u];
    }
    if (cur.length) chunks.push(cur);
    // a single unit that still doesn't fit: say so, never cut it
    chunks.forEach((c, i) => {
      if (c.length === 1 && !fits(i ? 'cont' : 'head', c)) notes.push({ at: ch.at, kind: 'paragraph', msg: 'has a paragraph too long for this size' });
    });
    after += chunks.length;
    const now = [String(sc.body || ''), ...ch.kids.map((k) => String(scenes[k].body || ''))];
    const want = chunks.map((c, i) => {
      // keep the original separators: the first chunk keeps the text's leading break, the last its trailing one
      const t = c.map((u, j) => (j ? u.sep : (i === 0 ? (u.lead || '') : '')) + u.text).join('') + (i === chunks.length - 1 ? (c[c.length - 1].trail || '') : '');
      return { text: t, sep: i ? c[0].sep || '\n' : '' };
    });
    const same = want.length === now.length && want.every((w, i) => w.text === now[i]);
    if (!same) ops.push({ head: sc.id, at: ch.at, kids: ch.kids.map((k) => scenes[k].id), chunks: want, from: now.length, to: want.length });
  }
  return { ops, before: scenes.length, after, notes };
}
