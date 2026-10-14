#!/usr/bin/env node
/* ==========================================================================
   mbk-deck — Media Brand Kit slides from the command line.

   validate / storyboard run in Node alone (js/v4/storyboard.js, the same
   module the app uses). layout / render / pptx / all run the REAL app in
   headless Chromium (served from this repo on 127.0.0.1), so the PNGs and the
   .pptx come from the same layout engine and renderer as the browser — there
   is no second implementation to drift.

   Usage
     node tools/deck/mbk-deck.mjs validate   <input>
     node tools/deck/mbk-deck.mjs storyboard <input> [-o storyboard.json]
     node tools/deck/mbk-deck.mjs layout     <input> -o layout.json  [options]
     node tools/deck/mbk-deck.mjs render     <input> -o out-dir/     [options]
     node tools/deck/mbk-deck.mjs pptx       <input> -o deck.pptx    [options]
     node tools/deck/mbk-deck.mjs all        <input> -o out-dir/     [options]
   <input>: a .txt / .md file, a .json file ({ slides: [...] }), or - for stdin.
   Options
     --brand askruth|moshpit|t4r      (default askruth)
     --format 16x9|1x1|4x5|3x4|9x16   (default 16x9 — Presentation)
     --scale 1|2                      PNG scale (default 1 → 1920 × 1080)
     --max-slides N                   (default 30)
     --timeout ms                     whole job (default 120000)
     --chromium /path/to/chrome       (or CHROMIUM_PATH; default: Playwright's own)
     --fonts-dir dir                  serve the brand fonts offline from @fontsource
                                      packages (dir containing bitter/, poppins/, roboto/)
     --site dir                       the app (default: this repo)
     --force                          write into a folder that isn't empty (only this
                                      tool's own earlier files there are replaced)
     --quiet
   Exit codes: 0 ok · 1 usage · 2 invalid input · 3 layout failed (doesn't fit)
               · 4 render/export failed · 5 timeout
   Errors are printed to stderr as one JSON line: { "error": { code, message } }.
   Logs never include the input text — only counts.
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DEFAULT = path.resolve(HERE, '..', '..');
const EXIT = { ok: 0, usage: 1, input: 2, layout: 3, render: 4, timeout: 5 };
const BRANDS = ['askruth', 'moshpit', 't4r'];
const FORMATS = ['16x9', '1x1', '4x5', '3x4', '9x16'];
const MAX_INPUT = 20000;

class JobError extends Error { constructor(kind, code, message) { super(message); this.kind = kind; this.code = code; } }

function parseArgs(argv) {
  const a = { _: [], brand: 'askruth', format: '16x9', scale: 1, maxSlides: 30, timeout: 120000, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new JobError('usage', 'usage', `${k} needs a value`); return argv[++i]; };
    if (k === '-o' || k === '--out') a.out = next();
    else if (k === '--brand') a.brand = next();
    else if (k === '--format') a.format = next();
    else if (k === '--scale') a.scale = Number(next());
    else if (k === '--max-slides') a.maxSlides = Number(next());
    else if (k === '--timeout') a.timeout = Number(next());
    else if (k === '--chromium') a.chromium = next();
    else if (k === '--fonts-dir') a.fontsDir = next();
    else if (k === '--site') a.site = next();
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--force') a.force = true;
    else if (k === '-h' || k === '--help') a.help = true;
    else if (k.startsWith('-') && k !== '-') throw new JobError('usage', 'usage', `Unknown option ${k}`);
    else a._.push(k);
  }
  if (!BRANDS.includes(a.brand)) throw new JobError('usage', 'usage', `--brand is one of ${BRANDS.join(', ')}`);
  if (!FORMATS.includes(a.format)) throw new JobError('usage', 'usage', `--format is one of ${FORMATS.join(', ')}`);
  if (![1, 2].includes(a.scale)) throw new JobError('usage', 'usage', '--scale is 1 or 2');
  if (!(a.maxSlides >= 1 && a.maxSlides <= 30)) throw new JobError('usage', 'usage', '--max-slides is 1–30');
  if (!(a.timeout >= 5000)) throw new JobError('usage', 'usage', '--timeout is at least 5000 ms');
  return a;
}

const log = (a, ...m) => { if (!a.quiet) process.stderr.write(`[mbk-deck] ${m.join(' ')}\n`); };

async function readInput(src) {
  let text;
  if (src === '-') { const chunks = []; for await (const c of process.stdin) chunks.push(c); text = Buffer.concat(chunks).toString('utf8'); }
  else {
    const st = await stat(src).catch(() => null);
    if (!st || !st.isFile()) throw new JobError('input', 'not-found', `No file at ${src}`);
    if (st.size > MAX_INPUT * 4) throw new JobError('input', 'too-big', `The input is larger than ${MAX_INPUT} characters`);
    text = await readFile(src, 'utf8');
  }
  if (text.length > MAX_INPUT) throw new JobError('input', 'too-big', `The input is larger than ${MAX_INPUT} characters`);
  if (/\.json$/i.test(src) || /^\s*[[{]/.test(text)) {
    try { return JSON.parse(text); } catch (e) { if (/\.json$/i.test(src)) throw new JobError('input', 'json', `Not valid JSON: ${e.message}`); }
  }
  return text;
}

async function storyboardModule(site) {
  return import(pathToFileURL(path.join(site, 'js', 'v4', 'storyboard.js')).href);
}

/* --- a static server for the app: this directory only, GET only, no listing --------------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain' };
function serve(root) {
  const base = path.resolve(root);
  const srv = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      const u = new URL(req.url, 'http://x');
      let p = decodeURIComponent(u.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.resolve(base, `.${p}`);
      if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
      if (/[\\/](node_modules|\.git|tools)[\\/]/.test(file.slice(base.length))) { res.writeHead(404).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (_) { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

/* --- the app in headless Chromium ------------------------------------------------------------ */
async function withApp(a, fn) {
  let pw;
  try { pw = await import('playwright-core'); }
  catch (_) { throw new JobError('render', 'no-playwright', 'playwright-core is not installed: run `npm install` in tools/deck'); }
  const site = path.resolve(a.site || SITE_DEFAULT);
  if (!existsSync(path.join(site, 'index.html'))) throw new JobError('usage', 'no-site', `No app at ${site}`);
  const srv = await serve(site);
  const port = srv.address().port;
  let browser;
  try {
    const exe = a.chromium || process.env.CHROMIUM_PATH || undefined;
    browser = await pw.chromium.launch({ executablePath: exe, headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    // nothing leaves this machine except the brand fonts' stylesheet (or nothing, with --fonts-dir)
    await ctx.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1' || u.hostname === 'fontfiles.local') return route.fallback();
      if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) && !a.fontsDir) return route.fallback();
      if (/fonts\.googleapis\.com$/.test(u.hostname) && a.fontsDir) return route.fallback();
      return route.abort();
    });
    if (a.fontsDir) {
      const dir = path.resolve(a.fontsDir);
      let css = '';
      for (const [fam, ws] of [['Bitter', [400, 500, 600, 700]], ['Poppins', [400, 500, 600, 700, 800]], ['Roboto', [900]]]) {
        for (const w of ws) css += `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-display:block;src:url(https://fontfiles.local/${fam.toLowerCase()}/${fam.toLowerCase()}-latin-${w}-normal.woff2) format('woff2');}\n`;
      }
      await ctx.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
      await ctx.route('https://fontfiles.local/**', async (r) => {
        const parts = new URL(r.request().url()).pathname.split('/').filter(Boolean);
        const file = path.join(dir, parts[0].replace(/[^a-z]/g, ''), 'files', parts[1].replace(/[^a-z0-9.-]/g, ''));
        try { await r.fulfill({ status: 200, contentType: 'font/woff2', body: await readFile(file), headers: { 'Access-Control-Allow-Origin': '*' } }); } catch (_) { await r.abort(); }
      });
    }
    const page = await ctx.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(String(e.message || e)));
    await page.goto(`http://127.0.0.1:${port}/?debug&template&ff=presentation`, { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    await page.goto(`http://127.0.0.1:${port}/?debug&template&ff=presentation`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__deck && window.__studio, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelector('#home-close') && document.querySelector('#home-close').click());
    if (a.brand !== 'askruth') { await page.selectOption('#brand-select', a.brand); await page.waitForTimeout(1200); }
    await page.evaluate(() => document.querySelector('.tb-content-btn[data-type="carousel"]').click());
    await page.waitForTimeout(400);
    await page.selectOption('#tab-format-select', `carousel:${a.format}`);
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => ['600 72px Bitter', '600 44px Poppins'].map((f) => document.fonts.check(f)));
    if (fonts.includes(false)) log(a, 'warning: a brand font did not load (no network?) — measurements use a fallback font. Use --fonts-dir.');
    const out = await fn(page);
    if (problems.length) log(a, `page reported ${problems.length} error(s); first: ${problems[0].slice(0, 160)}`);
    return out;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => srv.close(() => r()));
  }
}

async function planIn(page, input, a) {
  const r = await page.evaluate(([t, max]) => {
    const p = window.__deck.plan(t, { maxSlides: max });
    window.__mbkPlan = p;
    return { ok: p.ok, error: p.error || null, notes: p.notes || [], slides: (p.slides || []).length,
      reports: (p.reports || []).map((x) => ({ kind: x.kind, ok: x.ok, cont: !!x.cont, shrunk: x.shrunk || null, issues: x.issues, rects: x.rects, safeArea: x.sa })) };
  }, [input, a.maxSlides]);
  if (!r.ok) throw new JobError('layout', r.error.code, r.error.message);
  await page.evaluate(() => window.__deck.apply(window.__mbkPlan, 'replace'));
  await page.waitForTimeout(300);
  return r;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const [cmd, src] = a._;
  if (a.help || !cmd) { process.stdout.write(`${(await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(4, 36).join('\n')}\n`); return a.help ? EXIT.ok : EXIT.usage; }
  if (!['validate', 'storyboard', 'layout', 'render', 'pptx', 'all'].includes(cmd)) throw new JobError('usage', 'usage', `Unknown command ${cmd}`);
  if (!src) throw new JobError('usage', 'usage', 'Give an input file (or - for stdin)');
  const site = path.resolve(a.site || SITE_DEFAULT);
  const input = await readInput(src);
  const sbm = await storyboardModule(site);
  const sb = sbm.prepareStoryboard(input, { maxSlides: a.maxSlides });
  if (!sb.ok) throw new JobError('input', sb.error.code, sb.error.message);
  log(a, `storyboard: ${sb.items.length} slide(s) · ${sb.items.map((i) => i.kind).join(', ')}`);
  if (cmd === 'validate') { process.stdout.write(`${JSON.stringify({ ok: true, slides: sb.items.length, kinds: sb.items.map((i) => i.kind), notes: sb.notes })}\n`); return EXIT.ok; }
  if (cmd === 'storyboard') {
    const json = `${JSON.stringify({ version: 1, provider: sbm.deterministicProvider.id, items: sb.items, notes: sb.notes }, null, 2)}\n`;
    if (a.out) { await mkdir(path.dirname(path.resolve(a.out)), { recursive: true }); await writeFile(a.out, json); log(a, `wrote ${a.out}`); }
    else process.stdout.write(json);
    return EXIT.ok;
  }
  if (!a.out) throw new JobError('usage', 'usage', `${cmd} needs -o`);
  const outDir = cmd === 'pptx' || cmd === 'layout' ? path.dirname(path.resolve(a.out)) : path.resolve(a.out);
  await mkdir(outDir, { recursive: true });
  // never mix two runs: an output folder must be empty, or --force replaces this tool's own files
  if ((cmd === 'render' || cmd === 'all') && (await readdir(outDir)).length && !a.force) throw new JobError('usage', 'not-empty', `${outDir} isn't empty. Use an empty folder, or --force to replace this tool's earlier files there.`);
  let timer;
  const job = withApp(a, async (page) => {
    const plan = await planIn(page, input, a);
    log(a, `layout: ${plan.slides} slide(s) at ${a.format}, all checks passed`);
    const outDir = cmd === 'pptx' || cmd === 'layout' ? path.dirname(path.resolve(a.out)) : path.resolve(a.out);
    if (a.force && (cmd === 'render' || cmd === 'all')) for (const f of await readdir(outDir)) if (/^(\d{2}-.+\.png|deck\.pptx|layout\.json)$/.test(f)) await unlink(path.join(outDir, f));
    const written = [];
    if (cmd === 'layout' || cmd === 'all') {
      const geo = await page.evaluate(() => window.__deck.geometry());
      const file = cmd === 'layout' ? path.resolve(a.out) : path.join(outDir, 'layout.json');
      await writeFile(file, `${JSON.stringify({ version: 1, brand: a.brand, format: a.format, plan, geometry: geo }, null, 2)}\n`);
      written.push(file);
    }
    if (cmd === 'render' || cmd === 'all') {
      const pngs = await page.evaluate((s) => window.__deck.pngs(s), a.scale);
      for (const [k, f] of pngs.entries()) {
        const name = `${String(k + 1).padStart(2, '0')}-${f.name.replace(/^.*?-\d{2}-/, '').replace(/[^a-z0-9.-]/gi, '-')}`;
        const file = path.join(outDir, name);
        await writeFile(file, Buffer.from(f.b64, 'base64'));
        written.push(file);
      }
    }
    if (cmd === 'pptx' || cmd === 'all') {
      const r = await page.evaluate(() => window.__deck.pptx());
      const file = cmd === 'pptx' ? path.resolve(a.out) : path.join(outDir, 'deck.pptx');
      await writeFile(file, Buffer.from(r.b64, 'base64'));
      written.push(file);
      log(a, `pptx: ${r.slides} slide(s); placed as pictures: ${[...new Set(r.rasters)].join(', ') || 'none'}`);
    }
    return written;
  }).catch((e) => { throw e instanceof JobError ? e : new JobError('render', 'render', String(e && e.message || e).split('\n')[0]); });
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new JobError('timeout', 'timeout', `Took longer than ${a.timeout} ms`)), a.timeout); });
  try {
    const files = await Promise.race([job, timeout]);
    for (const f of files) process.stdout.write(`${f}\n`);
    return EXIT.ok;
  } finally { clearTimeout(timer); }
}

main().then((code) => process.exit(code)).catch((e) => {
  const kind = e instanceof JobError ? e.kind : 'render';
  process.stderr.write(`${JSON.stringify({ error: { code: e.code || 'error', message: e.message } })}\n`);
  process.exit(EXIT[kind] ?? 4);
});
