# s241 · the View (grid) menu has no Full screen item — the ⤢ button beside it is the one way in
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    U = 'http://127.0.0.1:8766/?debug&template'
    ITEMS = "[...document.querySelectorAll('#clip-menu .clip-menu-item')].map(b=>b.textContent.trim())"
    for w, h in ((1440, 900), (390, 844)):
        tag = 'phone' if w < 800 else 'desktop'
        await pg.set_viewport_size({'width': w, 'height': h}); await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(400)
        vb = await st("(()=>{const b=document.querySelector('#view-btn'); return !!(b&&b.offsetParent)})()")
        if vb:
            await st("document.querySelector('#view-btn').click()"); await pg.wait_for_timeout(400)
            items = await st(ITEMS)
            check(f'{tag}: view menu opens', len(items) >= 2, items)
            check(f'{tag}: view menu has no Full screen', not any('Full screen' in t for t in items), items)
            check(f'{tag}: view menu still has Safe area and Grid', any('Safe area' in t for t in items) and any('Grid' in t for t in items), items)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        fo = await st("(()=>{const b=document.querySelector('#fs-open'); return !!(b&&b.offsetParent)})()")
        check(f'{tag}: the full-screen button is still there', fo or not vb)
        if fo:
            await st("document.querySelector('#clip-menu').hidden=true; document.querySelector('#fs-open').click()"); await pg.wait_for_timeout(700)
            check(f'{tag}: the full-screen button opens full screen', await st("document.documentElement.classList.contains('is-fs')"))
            await st("document.querySelector('#fs-view')?.click()"); await pg.wait_for_timeout(400)
            items = await st(ITEMS)
            check(f'{tag}: full-screen view menu has no Full screen either', not any('Full screen' in t for t in items), items)
    check('no page errors', not [l for l in logs if 'PAGEERROR' in l], logs)
    print(f'RESULT {ok} / {n}')
