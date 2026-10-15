# s227 · Full-screen edit on desktop, panel shown or hidden: a tap on an item and the Add button both work
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    U = 'http://127.0.0.1:8766/?debug&template'
    rect = "(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10)})()"
    badge = "(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return {x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k}})()"
    controls = """(()=>{const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>40&&r.height>40&&c.visibility!=='hidden'&&c.display!=='none'&&r.right>0&&r.left<innerWidth};
      return vis(document.querySelector('.panel-controls .section-sheet'))||vis(document.querySelector('#section-sheet'))||vis(document.querySelector('.panel-controls'))&&getComputedStyle(document.querySelector('.panel-controls')).visibility!=='hidden'})()"""
    menu = "[...document.querySelectorAll('body *')].some(e=>e.children.length===0&&e.textContent==='Header and body, in one box'&&e.getBoundingClientRect().height>0)"
    same = lambda a, b: all(abs(x - y) < 0.6 for x, y in zip(a, b))
    for vw, vh in ((1440, 900), (1280, 800)):
        for hidden in (False, True):
            tag = f'{vw} panel {"hidden" if hidden else "shown"}'
            await pg.set_viewport_size({'width': vw, 'height': vh})
            await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
            await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
            if hidden: await pg.click('#panel-toggle'); await pg.wait_for_timeout(300)
            await pg.click('#fs-open'); await pg.wait_for_timeout(700)
            check(f'{tag} · full screen on', await st("document.documentElement.classList.contains('is-fs')"))
            before = await st(rect)
            p = await st(badge); await pg.mouse.click(p['x'], p['y']); await pg.wait_for_timeout(700)
            check(f'{tag} · tap on the badge shows its controls', await st(controls))
            check(f'{tag} · canvas stays put on tap', same(before, await st(rect)), f'{before} → {await st(rect)}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            if not await st("document.documentElement.classList.contains('is-fs')"):
                await pg.click('#fs-open'); await pg.wait_for_timeout(600)
            await pg.click('#fs-add-section'); await pg.wait_for_timeout(500)
            check(f'{tag} · Add opens its menu', await st(menu))
            await pg.get_by_text('Header and body, in one box').click(); await pg.wait_for_timeout(800)
            check(f'{tag} · Add → Text shows the new text’s controls', await st(controls))
            check(f'{tag} · Add → Text adds a line and edits it', await st("!!document.querySelector('.canvas-editor:not([hidden]), [contenteditable=true]')") or await st("document.querySelector('.panel-controls').dataset.tab==='text'"))
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            if not await st("document.documentElement.classList.contains('is-fs')"): await pg.click('#fs-open'); await pg.wait_for_timeout(500)
            await pg.click('#fs-add-section'); await pg.wait_for_timeout(400)
            await pg.get_by_text('Colors, patterns, pictures · Tone down').click(); await pg.wait_for_timeout(700)
            sheet = await st("(()=>{const e=document.querySelector('#section-sheet, .section-sheet');if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.width)]})()")
            check(f'{tag} · Add → Background opens the background controls', sheet and sheet[1] > 200 and await st("document.querySelector('.panel-controls').dataset.tab") not in ('all', ''), [sheet, await st("document.querySelector('.panel-controls').dataset.tab")])
            if vw == 1440 and hidden: await pg.screenshot(path=__import__('os').environ['SHOTS'] + '/s227-hidden-text.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        if not await st("document.documentElement.classList.contains('is-fs')"): await pg.click('#fs-open'); await pg.wait_for_timeout(500)
        await st("document.documentElement.classList.remove('is-fs')"); await pg.keyboard.press('Escape')
    print(f'RESULT {ok} / {n}')
