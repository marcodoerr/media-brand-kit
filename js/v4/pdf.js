/* ==========================================================================
   v4/pdf.js — a small PDF writer: one page per slide, each page a JPEG at
   the slide's own proportions. No library, no network. The pages are
   pictures (like the PNG / JPG export), not editable text; that is stated
   in the export sheet.
   ========================================================================== */

const enc = new TextEncoder();

/**
 * pages: [{ jpeg: Uint8Array, w: px, h: px }]. Page size is the picture at 96 dpi
 * (1080 px wide = 810 pt, 11.25 in). Returns a Blob('application/pdf').
 */
export function pdfOf(pages, { title = 'Slides', author = '' } = {}) {
  const chunks = [];
  let len = 0;
  const offsets = [];
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const esc = (s) => String(s).replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, '?');

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // 1 catalog, 2 pages, 3 info; then per page: page, contents, image
  const pageNo = (i) => 4 + i * 3;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageNo(i)} 0 R`).join(' ')}] >>`));
  obj(3, () => push(`<< /Title (${esc(title)}) /Author (${esc(author)}) /Producer (Media Brand Kit) >>`));
  pages.forEach((p, i) => {
    const pw = +(p.w * 0.75).toFixed(2), ph = +(p.h * 0.75).toFixed(2);
    const P = pageNo(i), C = P + 1, I = P + 2;
    obj(P, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${I} 0 R >> >> /Contents ${C} 0 R >>`));
    const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    obj(C, () => { push(`<< /Length ${draw.length} >>\nstream\n`); push(draw); push('\nendstream'); });
    obj(I, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });
  const total = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) x += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`;
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
