# s226 · Hidden panel: tapping an item floats the panel in, and the canvas must not move or resize
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    U = 'http://127.0.0.1:8766/?debug&template'
    rect = "(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return [Math.round(r.left*10)/10,Math.round(r.top*10)/10,Math.round(r.width*10)/10,Math.round(r.height*10)/10]})()"
    badge = "(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return {x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k}})()"
    same = lambda a, b: all(abs(x - y) < 0.6 for x, y in zip(a, b))
    for vw, vh in ((1440, 900), (1280, 800)):
        await pg.set_viewport_size({'width': vw, 'height': vh})
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        await pg.click('#panel-toggle'); await pg.wait_for_timeout(500)
        check(f'{vw} panel hidden', await st("document.documentElement.classList.contains('panel-collapsed')"))
        fmts = await st("[...document.querySelectorAll('#tab-format-select option')].filter(o=>!o.hidden).map(o=>o.value)")
        for fmt in [None] + [f for f in fmts if '16' in f or 'land' in f.lower()][:1]:
            if fmt:
                await pg.select_option('#tab-format-select', fmt); await pg.wait_for_timeout(900)
            before = await st(rect)
            p = await st(badge)
            await pg.mouse.click(p['x'], p['y']); await pg.wait_for_timeout(600)
            peek = await st("document.documentElement.classList.contains('panel-peek')")
            after = await st(rect)
            tag = f'{vw} {fmt or "default"}'
            check(f'{tag} panel floats in on tap', peek)
            check(f'{tag} canvas stays put when the panel floats in', same(before, after), f'{before} → {after}')
            hidden = await st("""(()=>{const p=document.querySelector('.panel-controls').getBoundingClientRect();
              return [...document.querySelectorAll('.stage-inner > button, .stage-inner > .surface-toggle, #view-btn')].filter(b=>b.offsetParent).filter(b=>{const r=b.getBoundingClientRect();
              return r.width>0 && !(r.right<=p.left||r.left>=p.right||r.bottom<=p.top||r.top>=p.bottom)}).map(b=>b.id||b.className)})()""")
            check(f'{tag} round stage buttons not under the panel', not hidden, hidden)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
            closed = await st(rect)
            check(f'{tag} panel away again', not await st("document.documentElement.classList.contains('panel-peek')"))
            check(f'{tag} canvas stays put when the panel goes away', same(before, closed), f'{before} → {closed}')
            if vw == 1440 and not fmt: await pg.screenshot(path=__import__('os').environ['SHOTS'] + '/s226-1440.png')
        # wide canvas: a tap near its right edge, where the right-hand panel would sit
        await pg.select_option('#tab-format-select', 'video:16x9'); await pg.wait_for_timeout(900)
        before = await st(rect)
        await pg.mouse.click(before[0] + before[2] - 30, before[1] + before[3] / 2); await pg.wait_for_timeout(600)
        after = await st(rect)
        peek = await st("document.documentElement.classList.contains('panel-peek')")
        left = await st("document.documentElement.classList.contains('peek-left')")
        tag = f'{vw} 16:9 right-edge tap'
        check(f'{tag} panel floats in', peek)
        check(f'{tag} opens at the left', left)
        check(f'{tag} canvas stays put', same(before, after), f'{before} → {after}')
        cover = await st("""(()=>{const p=document.querySelector('.panel-controls').getBoundingClientRect();return p.right})()""")
        check(f'{tag} tapped spot is clear of the panel', cover < before[0] + before[2] - 30, cover)
        if vw == 1440: await pg.screenshot(path=__import__('os').environ['SHOTS'] + '/s226-1440-wide.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        check(f'{tag} canvas stays put after closing', same(before, await st(rect)))
    print(f'RESULT {ok} / {n}')
