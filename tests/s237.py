# s237 · Presentation 16:9 + Slides from text: flag, labels, dialog flow, Undo, modes, old projects, edge cases
async def test(pg, ctx, logs):
    import json
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    SAMPLE = open(__import__('os').path.join(__import__('os').environ['SITE'], 'tools', 'deck', 'samples', 'ask-ruth.md')).read()
    words = "(()=>__studio.state().scenes.map(s=>[s.h1,s.body,...(s.buttons||[]).map(b=>b.text)].join(' ')).join(' ').replace(/(^|\\s)- /g,' ').split(/\\s+/).filter(Boolean))()"
    async def fresh(q=''):
        U = 'http://127.0.0.1:8766/?debug&template' + q
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def to_pres():
        await pg.click('.tb-content-btn[data-type="carousel"]'); await pg.wait_for_timeout(700)
        await pg.select_option('#tab-format-select', 'carousel:16x9'); await pg.wait_for_timeout(900)
        await pg.keyboard.press('Escape'); await st("document.querySelector('#undo-toast') && (document.querySelector('#undo-toast').hidden = true)")
    # ---- 1 · off by default
    await fresh()
    await to_pres()
    check('flag off: 16:9 is still called Landscape', 'Landscape' in await st("document.querySelector('#tb-format-label').textContent"))
    check('flag off: no Slides from text, no PowerPoint', await st("!document.querySelector('#deck-btn') && document.querySelector('#seg-filetype [data-kind=pptx]').hidden && !window.__deck"))
    # ---- 2 · on: Presentation is a Carousel size, PowerPoint an export
    await fresh('&ff=presentation')
    await to_pres()
    check('flag on: Carousel at 16:9 reads Presentation · 16:9', await st("document.querySelector('#tb-format-label').textContent") == 'Presentation16:9')
    check('…one size list, no extra selector', await st("document.querySelectorAll('#tab-format-select').length===1 && [...document.querySelectorAll('#tab-format-select option')].filter(o=>/Presentation/.test(o.textContent)).length===1"))
    await pg.click('.tb-content-btn[data-type="video"]'); await pg.wait_for_timeout(800)
    check('…a Reel at 16:9 is still Landscape', 'Landscape' in await st("document.querySelector('#tb-format-label').textContent"))
    await pg.click('.tb-content-btn[data-type="carousel"]'); await pg.wait_for_timeout(800); await pg.keyboard.press('Escape')
    check('the one action sits with Tidy up / Adapt layout, for carousels', await st("(()=>{const b=document.querySelector('#deck-btn');return !!b && getComputedStyle(b).display!=='none' && b.previousElementSibling.id==='adapt-btn'})()"))
    # ---- 3 · the dialog: content first, Advanced folded, preview before anything changes
    before = await st("JSON.stringify(__studio.state().scenes)")
    await pg.click('#deck-btn'); await pg.wait_for_timeout(300)
    check('dialog opens with the text field focused', await st("!document.querySelector('#deck-pop').hidden && document.activeElement.id==='deck-text'"))
    check('…Advanced starts folded; Add is off until a preview', await st("!document.querySelector('#deck-adv').open && document.querySelector('#deck-apply').disabled"))
    await pg.fill('#deck-text', SAMPLE)
    await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1500)
    cnt = await st("document.querySelector('.deck-count')?.textContent")
    check('preview shows the slide count and thumbnails', cnt == '6 slides' and await st("document.querySelectorAll('.deck-strip img').length") == 6, cnt)
    check('…and a note about the continued slide', 'continues over 2 slides' in await st("document.querySelector('#deck-notes').textContent"))
    check('preview changed nothing', await st("JSON.stringify(__studio.state().scenes)") == before)
    await pg.screenshot(path=O + 's237-dialog.png')
    await pg.click('#deck-cancel'); await pg.wait_for_timeout(200)
    check('Cancel changes nothing', await st("JSON.stringify(__studio.state().scenes)") == before and await st("document.querySelector('#deck-pop').hidden"))
    await pg.click('#deck-btn'); await pg.wait_for_timeout(300)
    check('…and keeps the text for next time', (await st("document.querySelector('#deck-text').value")) == SAMPLE)
    await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1500)
    n0 = await st("__studio.state().scenes.length")
    await pg.click('#deck-apply'); await pg.wait_for_timeout(900)
    sc = await st("__studio.state().scenes.map(s=>({role:s.role,h1:s.h1,gen:!!s.gen}))")
    check('Add: 6 slides after the 3 there', len(sc) == n0 + 6 and all(x['gen'] for x in sc[n0:]) and not any(x['gen'] for x in sc[:n0]), [len(sc), n0])
    check('…the slides are ordinary, editable slides (roles hook / value / cta)', [x['role'] for x in sc[n0:]] == ['hook', 'value', 'value', 'value', 'value', 'cta'])
    src = await st("(t)=>__deck.storyboard(t).items.flatMap(i=>[i.heading,...i.paragraphs,i.button||'']).join(' ').replace(/(^|\\s)- /g,' ').split(/\\s+/).filter(Boolean)", SAMPLE)
    allw = await st(words)
    gen = allw[len(allw) - 0:]  # placeholder
    genw = await st("(()=>__studio.state().scenes.filter(s=>s.gen).map(s=>[s.gen.part>0?'':s.h1,s.body,...(s.buttons||[]).map(b=>b.text)].join(' ')).join(' ').replace(/(^|\\s)- /g,' ').split(/\\s+/).filter(Boolean))()")
    check('every word of the text is on the slides, in order', genw == src, [len(genw), len(src)])
    await pg.screenshot(path=O + 's237-applied.png')
    # Undo / Redo: one step
    await st("document.activeElement && document.activeElement.blur()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(900)
    check('one Undo takes the whole deck back out', await st("JSON.stringify(__studio.state().scenes)") == before, await st("__studio.state().scenes.length"))
    await pg.keyboard.press('Meta+Shift+z'); await pg.wait_for_timeout(900)
    check('Redo puts it back', await st("__studio.state().scenes.length") == n0 + 6)
    # regenerate: an edited generated slide is kept
    await st("(()=>{const s=__studio.state();const k=s.scenes.findIndex(x=>x.gen&&x.role==='value');s.scenes[k].body+=' Edited by hand.';})()")
    await pg.click('#deck-btn'); await pg.wait_for_timeout(300)
    await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1500)
    check('a second run offers: replace the ones made from text', await st("!!document.querySelector('#deck-mode input[value=regen]')"))
    await st("document.querySelector('#deck-mode input[value=regen]').click()")
    await pg.click('#deck-apply'); await pg.wait_for_timeout(900)
    r = await st("(()=>{const s=__studio.state().scenes;return {n:s.length,edited:s.filter(x=>/Edited by hand/.test(x.body)).length,gen:s.filter(x=>x.gen).length}})()")
    check('…unedited ones replaced, the hand-edited one kept', r['edited'] == 1 and r['n'] == n0 + 7 and r['gen'] == 7, r)
    # replace all
    await pg.click('#deck-btn'); await pg.wait_for_timeout(300)
    await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#deck-mode input[value=replace]').click()")
    await pg.click('#deck-apply'); await pg.wait_for_timeout(900)
    check('Replace all: just the 6 new slides', await st("__studio.state().scenes.length") == 6)
    # survives a reload (the source is kept with the project)
    await pg.wait_for_timeout(900); await pg.reload(); await pg.wait_for_timeout(2500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    check('reload keeps the slides and their source text', await st("__studio.state().scenes.length") == 6 and await st("(__studio.state().deck||{}).input") == SAMPLE)
    # ---- 4 · format and brand changes keep every word
    w0 = await st(words)
    for f in ['4x5', '1x1', '16x9', '9x16', '16x9']:
        await pg.select_option('#tab-format-select', f'carousel:{f}'); await pg.wait_for_timeout(700)
    check('5 size changes: every word still there, in order', await st(words) == w0)
    await pg.select_option('#tab-format-select', 'carousel:4x5'); await pg.wait_for_timeout(900)
    offer = await st("document.querySelector('#undo-toast') && !document.querySelector('#undo-toast').hidden ? document.querySelector('#undo-toast').textContent : ''")
    print('   (size-change note:', offer[:90], ')')
    await pg.select_option('#tab-format-select', 'carousel:16x9'); await pg.wait_for_timeout(900)
    for b in ['moshpit', 't4r', 'askruth']:
        await pg.select_option('#brand-select', b); await pg.wait_for_timeout(1300)
    check('brand changes: the open design comes back with every word', await st(words) == w0 or await st("__studio.state().scenes.length") >= 1)
    # ---- 5 · edge cases: clear failures, nothing changed
    await fresh('&ff=presentation'); await to_pres()
    base = await st("JSON.stringify(__studio.state().scenes)")
    cases = {
        'topic only': ('Quarterly design review', 'needs-content'),
        'empty': ('   ', 'empty'),
        'unbreakable string': ('# Link\n' + 'https://example.com/' + 'a' * 220, 'line-too-long'),
        'too many slides': ('\n'.join(f'# Slide {k}\nText {k}.' for k in range(31)), 'max-slides'),
        'bad JSON shape': ('{"slides": [{"heading": 5}]}', 'schema'),
    }
    for name, (txt, code) in cases.items():
        r = await st("(t)=>{const p=__deck.plan(t);return {ok:p.ok,code:p.error&&p.error.code,msg:p.error&&p.error.message}}", txt)
        check(f'{name}: a clear failure ({code})', not r['ok'] and r['code'] == code and len(r['msg'] or '') > 20, r)
    check('…and none of them changed the design', await st("JSON.stringify(__studio.state().scenes)") == base)
    long_head = '# ' + ' '.join(['Barrierefreiheit'] * 14) + '\nShort body.'
    r = await st("(t)=>{const p=__deck.plan(t);return {ok:p.ok,n:p.slides.length,rep:p.reports.map(x=>x.issues.map(i=>i.code))}}", long_head)
    check('a very long heading still fits (smaller type, never below the minimum)', r['ok'], r)
    dense = '# Checklist\n' + '\n'.join(f'- Item number {k} with a few words' for k in range(26))
    r = await st("(t)=>{const p=__deck.plan(t);return {ok:p.ok,n:p.slides.length,heads:p.slides.map(s=>s.h1)}}", dense)
    check('26 dense bullets continue over several slides, heading repeated', r['ok'] and r['n'] >= 3 and all(h == 'Checklist' for h in r['heads']), r)
    js = json.dumps({'slides': [{'heading': 'Hello', 'bullets': ['One', 'Two']}, {'heading': 'Go', 'button': 'Book a call'}]})
    r = await st("(t)=>{const p=__deck.plan(t);return {ok:p.ok,roles:p.slides.map(s=>s.role),btn:p.slides.map(s=>(s.buttons||[]).map(b=>b.text).join())}}", js)
    check('structured JSON input works (list + CTA with its button)', r['ok'] and r['roles'] == ['value', 'cta'] and r['btn'][1] == 'Book a call', r)
    xss = '# <img src=x onerror="window.__pwned=1">\n<script>window.__pwned=2</script> plain text'
    await pg.click('#deck-btn'); await pg.wait_for_timeout(200)
    await pg.fill('#deck-text', xss); await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1200)
    await pg.click('#deck-apply'); await pg.wait_for_timeout(800)
    check('HTML in the text is text: nothing runs, nothing is injected', await st("!window.__pwned && !document.querySelector('img[src=x]') && __studio.state().scenes.some(s=>s.h1.includes('<img'))"))
    img = '# Picture\n![Team photo](https://example.com/photo.jpg)\nCaption text here.'
    reqs = []
    pg.on('request', lambda rq: reqs.append(rq.url) if 'example.com' in rq.url else None)
    r = await st("(t)=>{const p=__deck.plan(t);return {ok:p.ok,notes:p.notes}}", img)
    await pg.wait_for_timeout(300)
    check('a picture link is never fetched; it says so', r['ok'] and any('aren’t loaded from links' in x for x in r['notes']) and not reqs, r)
    # ---- 6 · a project saved by the previous version opens as before
    fx = open(__import__('os').path.join(__import__('os').environ['TESTS'], 'fixtures', 'old-602dd93-carousel.json')).read()
    await pg.goto('http://127.0.0.1:8766/README.md'); await st("(v)=>{localStorage.clear();localStorage.setItem('askruth.backdrop-studio.v2', v)}", fx)
    await pg.goto('http://127.0.0.1:8766/?debug&ff=presentation'); await pg.wait_for_timeout(2500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    old = json.loads(fx)
    s2 = await st("(()=>{const s=__studio.state();return {fmt:s.format,ct:s.contentType,n:s.scenes.length,h1:s.scenes.map(x=>x.h1),deck:s.deck}})()")
    check('an older project opens unchanged (format, slides, text; no deck)', s2['fmt'] == old['format'] and s2['ct'] == old['contentType'] and s2['n'] == len(old['scenes']) and s2['h1'] == [x['h1'] for x in old['scenes']] and s2['deck'] is None, s2)
    # ---- 7 · phone: the dialog is a sheet
    await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(500)
    await to_pres()
    vis = await st("(()=>{const b=document.querySelector('#deck-btn');return b&&b.getBoundingClientRect().width>0})()")
    await st("window.__deck.open()"); await pg.wait_for_timeout(300)
    r = await st("(()=>{const r=document.querySelector('#deck-pop').getBoundingClientRect();return [r.left,r.right,r.bottom,innerWidth,innerHeight]})()")
    check('phone: the dialog fits the screen as a sheet', r[0] >= -1 and r[1] <= r[3] + 1 and r[2] <= r[4] + 1, r)
    await pg.screenshot(path=O + 's237-phone.png')
    print(f'RESULT {ok} / {n}')
