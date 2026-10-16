# s239 · Full screen: a tap (finger or mouse) on any item, or the background, opens its edit panel / sheet
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    U = 'http://127.0.0.1:8766/?debug&template'
    SHEET = "(()=>{const s=document.querySelector('#section-sheet'); return s&&!s.hidden ? document.querySelector('.panel-controls').dataset.tab : null})()"
    WANT = {'badge': 'badge', 'text': 'text', 'button': 'buttons', 'background': 'background'}
    for w, h, touch in ((1440, 900, False), (390, 844, True), (390, 844, False)):
        tag = ('phone' if w < 800 else 'desktop') + (' · finger' if touch else ' · mouse')
        await pg.set_viewport_size({'width': w, 'height': h}); await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(400)
        if w > 800: await st("document.querySelector('#fs-open').click()"); await pg.wait_for_timeout(600)
        await st("document.querySelector('#fs-next')?.click(); document.querySelector('#fs-next')?.click()"); await pg.wait_for_timeout(600)   # the CTA: it has a button
        its = await st("""(()=>{const c=document.querySelector('#preview'); const b=c.getBoundingClientRect(); const k=b.width/c.width; const L=__studio.layout();
          const ctr=(r)=>r?[b.left+(r.x+r.w/2)*k, b.top+(r.y+r.h/2)*k]:null;
          return {badge:ctr(L.wmRect), text:ctr(L.txRect), button:(L.buttons&&L.buttons[0])?ctr(L.buttons[0].rect):null, background:[b.left+b.width*0.5, b.top+b.height*0.95]}})()""")
        cdp = await ctx.new_cdp_session(pg)
        for name, xy in its.items():
            if not xy: continue
            await st("(()=>{const d=document.querySelector('#fs-sheet-close'); if(d&&d.offsetParent) d.click(); const e=document.querySelector('#section-sheet-done'); if(e&&e.offsetParent) e.click();})()"); await pg.wait_for_timeout(400)
            if touch:
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': xy[0], 'y': xy[1], 'id': 1}]}); await pg.wait_for_timeout(60)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            else:
                await pg.mouse.click(xy[0], xy[1])
            await pg.wait_for_timeout(800)
            got = await st(SHEET)
            check(f'{tag}: tap on the {name} opens its panel', got == WANT[name], got)
        check(f'{tag}: still in full screen', await st("document.documentElement.classList.contains('is-fs')"))
    check('no page errors', not [l for l in logs if 'PAGEERROR' in l], logs)
    print(f'RESULT {ok} / {n}')
