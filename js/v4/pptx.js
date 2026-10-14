/* ==========================================================================
   v4/pptx.js — editable PowerPoint (.pptx) from the slides' resolved layout.

   One coordinate space: the canvas, in pixels (1920 × 1080 for Presentation
   16:9). Inches and points are only worked out here, at the edge:
   1920 px = 13.333 in (PowerPoint's 16:9), so 1 px = 0.5 pt.

   What stays editable
   - Headers, body text and extra text boxes: real text boxes in the brand's
     font (its weight as a named face, e.g. "Bitter SemiBold"), size, colour and
     line spacing. Lines break where they break on the canvas (soft line breaks)
     and wrapping is off, so a substituted font can't re-flow them into the next
     box; a longer edit in PowerPoint needs its own line break (Shift+Enter).
   - Text cards and borders: rounded rectangles.
   - Standard buttons: a rounded rectangle with its label.
   What is a picture (placed exactly where it is on the canvas)
   - The background (patterns, photos, gradients and the Dim).
   - Logos and badges, media, drawings, Luxury buttons (gradient, ring and
     shadow), and a CTA's "bold" lettering.
   Fonts are named, not embedded: PowerPoint uses them when they are installed
   (Bitter, Poppins…: free Google Fonts) and substitutes otherwise.

   Uses PptxGenJS 4.0.1 (MIT), loaded on demand from js/vendor/.
   ========================================================================== */

export const PPTX_VENDOR = 'js/vendor/pptxgen-4.0.1.bundle.js';
export const TEXT_SLACK = 1.06;   // text boxes are 6 % wider than the measured line

let loading = null;
/** Load PptxGenJS once (browser). Resolves to the constructor. */
export function loadPptxGen(base = '') {
  if (typeof window !== 'undefined' && window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = base + PPTX_VENDOR;
    s.async = true;
    s.onload = () => (window.PptxGenJS ? resolve(window.PptxGenJS) : reject(new Error('PowerPoint library did not load')));
    s.onerror = () => { loading = null; reject(new Error('PowerPoint library could not be loaded')); };
    document.head.append(s);
  });
  return loading;
}

/** "rgba(1,2,3,.5)" / "#abc" / "#aabbcc" → { hex: 'AABBCC', alpha: 0…1 } (null when not a colour). */
export function colourOf(v) {
  const s = String(v || '').trim();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return { hex: h.toUpperCase(), alpha: 1 }; }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { hex: [m[1], m[2], m[3]].map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: m[4] == null ? 1 : +m[4] };
  return null;
}
/** "600 72px Bitter, Georgia, serif" → { face: 'Bitter', weight: 600 } */
export function fontOf(css) {
  const m = String(css).match(/^\s*(\d{3}|bold|normal)?\s*[\d.]+px\s+(.+)$/);
  const fam = m ? m[2] : 'Arial';
  const face = fam.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const w = m && m[1] ? (m[1] === 'bold' ? 700 : m[1] === 'normal' ? 400 : +m[1]) : 400;
  // static font files (how Google Fonts installs on Windows and macOS) name each weight as its own
  // face: 600 is "Bitter SemiBold", not "Bitter" in bold (Bold is 700 and sets wider)
  const named = WEIGHT_FACES[w];
  return { face: named ? `${face} ${named}` : face, weight: w, bold: w === 700 };
}
const WEIGHT_FACES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 500: 'Medium', 600: 'SemiBold', 800: 'ExtraBold', 900: 'Black' };

/**
 * Build the .pptx.
 * deck: { W, H, title, author, slides: [{ items: [Item], notes? }] } in canvas px.
 * Item:
 *  { type: 'image', x, y, w, h, data: 'data:image/png;base64,…', name }
 *  { type: 'shape', x, y, w, h, radius, fill, line?: { colour, w } , name }
 *  { type: 'text', x, y, w, h, paras: [{ lines: [string], bullet: bool, indent }], size, face, bold, colour,
 *    lineHeight, align: 'left'|'center', valign: 'top'|'middle', name }
 * Returns a Blob (browser) through pptx.write({ outputType: 'blob' }).
 */
export async function buildPptx(PptxGenJS, deck) {
  const pptx = new PptxGenJS();
  const inW = 13.333, inH = +(inW * deck.H / deck.W).toFixed(3);
  pptx.defineLayout({ name: 'MBK', width: inW, height: inH });
  pptx.layout = 'MBK';
  pptx.title = deck.title || 'Slides';
  pptx.author = deck.author || '';
  pptx.company = deck.author || '';
  pptx.subject = 'Made with Media Brand Kit';
  const k = inW / deck.W;               // px → in
  const pt = (px) => +(px * k * 72).toFixed(2);   // px → pt
  const pos = (it) => ({ x: +(it.x * k).toFixed(4), y: +(it.y * k).toFixed(4), w: +(Math.max(1, it.w) * k).toFixed(4), h: +(Math.max(1, it.h) * k).toFixed(4) });
  for (const sl of deck.slides) {
    const slide = pptx.addSlide();
    if (sl.background) slide.background = { color: sl.background };
    for (const it of sl.items) {
      if (it.type === 'image') {
        slide.addImage({ data: it.data, ...pos(it), altText: it.name || '', objectName: it.name || undefined });
      } else if (it.type === 'shape') {
        const f = colourOf(it.fill);
        const ln = it.line && colourOf(it.line.colour);
        // PptxGenJS takes the corner radius in inches (at most half the shorter side)
        const radius = +(Math.max(0, Math.min(it.radius || 0, Math.min(it.w, it.h) / 2)) * k).toFixed(4);
        slide.addShape(radius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
          ...pos(it),
          rectRadius: radius,
          fill: f ? { color: f.hex, transparency: Math.round((1 - f.alpha) * 100) } : { type: 'none' },
          line: ln && it.line.w > 0 ? { color: ln.hex, width: pt(it.line.w), transparency: Math.round((1 - ln.alpha) * 100) } : { type: 'none' },
          objectName: it.name || undefined,
        });
      } else if (it.type === 'text') {
        const c = colourOf(it.colour) || { hex: '000000', alpha: 1 };
        const runs = [];
        // one paragraph per source paragraph / list item; its canvas lines joined by soft breaks
        it.paras.forEach((p, pi) => {
          p.lines.forEach((line, li) => {
            const o = { fontFace: it.face, fontSize: pt(it.size), bold: !!it.bold, color: c.hex };
            if (c.alpha < 1) o.transparency = Math.round((1 - c.alpha) * 100);
            if (li === 0 && p.bullet) o.bullet = { indent: pt(p.indent || it.size * 0.55) };
            if (li > 0) o.softBreakBefore = true;
            if (li === p.lines.length - 1 && pi < it.paras.length - 1) o.breakLine = true;
            runs.push({ text: line || ' ', options: o });
          });
        });
        slide.addText(runs, {
          ...pos(it), margin: 0, align: it.align || 'left', valign: it.valign || 'top',
          ...(it.lineSpacingPx ? { lineSpacing: pt(it.lineSpacingPx) } : { lineSpacingMultiple: it.lineHeight || 1.2 }), paraSpaceBefore: 0, paraSpaceAfter: 0,
          // lines already break where the canvas breaks them: PowerPoint must not wrap them again
          fit: 'none', wrap: false, isTextBox: true, objectName: it.name || undefined,
        });
      }
    }
    if (sl.notes) slide.addNotes(sl.notes);
  }
  return pptx;
}

/* PptxGenJS 4.0.1 writes a second <a:pPr> right after a soft line break (<a:br/>), which the
   OOXML schema does not allow (paragraph properties come first, once). PowerPoint may then
   offer to "repair" the file. The fix, after writing: drop those stray properties — the
   paragraph's own (first) properties already say everything. */
export const STRAY_PPR = /(<a:br\/>)<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
export function fixSlideXml(xml) { return xml.replace(STRAY_PPR, '$1'); }

/** Write the deck, with the slide XML fixed. type: 'blob' | 'base64'. */
export async function writePptx(pptx, type = 'blob') {
  const JSZip = (typeof window !== 'undefined' && window.JSZip) || null;
  if (!JSZip) throw new Error('JSZip is missing (it comes with the PowerPoint library)');
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'arraybuffer' }));
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const xml = await zip.file(name).async('string');
    const fixed = fixSlideXml(xml);
    if (fixed !== xml) zip.file(name, fixed);
  }
  return zip.generateAsync({ type, compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

