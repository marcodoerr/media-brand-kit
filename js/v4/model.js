/* ==========================================================================
   v4/model.js — one editable object model for everything in a project,
   whoever made it (a person, a template, Adapt layout, later a design
   agent). Read-only helpers and a scoped-change wrapper; no agent here.

   Stable ids
     project            the saved design (localStorage key) — one per brand
     section            sc.id                    ('hook', 'v…', 'c…')
     element            `${sc.id}/${key}`         key: text, badge, inset, bt:<id>, md:<id>, xb:<id>, eb:<id>, dr:<id>
   Flags on every element/section
     locked             sc.locked / sc.locks[key] — a change must leave it as it is
     generated          sc.auto (Adapt layout) or sc.gen (Slides from text) — may be re-made
                        while unedited; everything else is the user's
   Layout format vs export format
     layout             what the canvas is: 'reel' | 'carousel' | 'presentation' (a Carousel at
                        16:9 — the same sections, editor and Undo). Stored as contentType + format.
     exports            files it can be saved as: PowerPoint (.pptx) is an export of a
                        presentation, never a layout; nothing about it is stored in the project.
     group              item.group — elements that move and export together (data only today)
   History
     Every scoped change goes through the app's own Undo (pushUndo), as one step.
   ========================================================================== */

const LISTS = { buttons: 'bt', media: 'md', blocks: 'xb', badges: 'eb', drawings: 'dr' };

/** The project as plain data: sections and their elements, each with a stable id and its flags. */
export function describe(state) {
  const sections = (state.scenes || []).map((sc, i) => {
    const locks = sc.locks || {};
    const el = (key, kind, extra = {}) => ({ id: `${sc.id}/${key}`, key, kind, locked: !!locks[key], ...extra });
    const elements = [];
    if (String(sc.h1 || '').trim() || String(sc.body || '').trim()) elements.push(el('text', 'text', { h1: sc.h1 || '', body: sc.body || '' }));
    if (sc.badge && sc.badge !== 'none') elements.push(el('badge', 'badge'));
    if (sc.inset && sc.inset.id && !sc.inset.hidden) elements.push(el('inset', 'media', { src: sc.inset.id }));
    for (const [list, pre] of Object.entries(LISTS)) {
      for (const it of sc[list] || []) elements.push(el(`${pre}:${it.id}`, list.replace(/s$/, ''), { group: it.group || null, ...(it.text ? { text: it.text } : {}), ...(it.src ? { src: it.src } : {}) }));
    }
    return {
      id: sc.id, index: i, role: sc.role, seconds: sc.secs, locked: !!sc.locked,
      generated: sc.auto ? { by: 'adapt-layout', from: sc.auto.from } : sc.gen ? { by: 'slides-from-text', deck: sc.gen.deck || null, part: sc.gen.part || 0 } : null,
      background: sc.bg || null, elements,
    };
  });
  const layout = state.contentType !== 'carousel' ? 'reel' : state.format === '16x9' ? 'presentation' : 'carousel';
  const exports = layout === 'reel' ? ['video', 'png', 'jpg', 'pdf'] : layout === 'presentation' ? ['png', 'jpg', 'pdf', 'pptx'] : ['png', 'jpg', 'pdf'];
  return { brand: state.brand, contentType: state.contentType, format: state.format, layout, exports, deck: state.deck ? { id: state.deck.id, slides: state.deck.count } : null, sections };
}

/**
 * Run `fn` as one undoable change limited to `scope`: { section } | { element } | 'project'.
 * Locked targets are refused (returns { ok: false, reason }). `app` = { state, pushUndo, commitScene, save, draw, renderScenes }.
 */
export function scopedChange(app, scope, label, fn) {
  const st = app.state();
  const sec = scope && scope.section ? st.scenes.find((s) => s.id === scope.section) : null;
  if (scope && scope.section && !sec) return { ok: false, reason: 'no such section' };
  if (sec && sec.locked) return { ok: false, reason: 'section is locked' };
  if (scope && scope.element) {
    const [sid, key] = scope.element.split('/');
    const s = st.scenes.find((x) => x.id === sid);
    if (!s) return { ok: false, reason: 'no such element' };
    if (s.locked || (s.locks && s.locks[key])) return { ok: false, reason: 'element is locked' };
  }
  app.commitScene();
  app.pushUndo(label);
  fn(st);
  app.save();
  app.renderScenes && app.renderScenes();
  app.draw();
  return { ok: true };
}
