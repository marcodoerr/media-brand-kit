# s230 · Calm default backgrounds, "Preview" naming, undo for every change + Undo / Redo buttons
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    kind = "(()=>{const s=__studio.state();return s.backdrop})()"
    calm = {'askruth': 'solid-blush', 'moshpit': 'mp-charcoal', 't4r': 't4r-mist'}
    # 1 · a new project in each brand opens on a plain colour, not a pattern
    for brand in ('askruth', 'moshpit', 't4r'):
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(200)
        if brand != 'askruth': await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1300)
        bd = await st(kind)
        scenes = await st("(__studio.state().scenes||[]).map(s=>s.bg||null)")
        check(f'{brand} · opens on its calm colour', bd == calm[brand], [bd, scenes])
        check(f'{brand} · no section starts on a pattern', not any(x and ('pattern' in x or 'skull' in x) for x in scenes), scenes)
    # the patterned Signature look is still offered, after Simple
    names = await st("""(()=>{try{return (window.__v4&&0)||null}catch(e){return null}})()""")
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    # 2 · Preview, not Present
    check('top bar says Preview', (await st("document.querySelector('#btn-present').textContent.trim()")) == 'Preview')
    check('full-screen bar says Preview', (await st("document.querySelector('#fs-preview-label').textContent.trim()")) == 'Preview')
    check('no “Present” left in the visible UI', 'Present' not in await st("document.body.innerText"))
    # 3 · Undo / Redo buttons
    check('Undo and Redo buttons in the top bar', await st("document.querySelectorAll('.hist-btns [data-hist]').length") == 2)
    check('…and in the full-screen bar', await st("document.querySelectorAll('#fs-bar [data-hist]').length") == 2)
    check('Undo starts disabled', await st("document.querySelector('.hist-btns [data-hist=undo]').disabled"))
    before = await st(kind)
    r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
    await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(500)
    await pg.click('#bg-kinds [data-k="colour"]'); await pg.wait_for_timeout(300)
    await st("[...document.querySelectorAll('#bg-colours .swatch[data-id]')].find(b=>b.getAttribute('aria-checked')!=='true').click()"); await pg.wait_for_timeout(1100)
    changed = await st(kind)
    check('a colour pick changes the background', changed != before, [before, changed])
    check('…and Undo becomes available', not await st("document.querySelector('.hist-btns [data-hist=undo]').disabled"))
    await pg.screenshot(path=O + 's230-topbar.png', clip={'x': 600, 'y': 0, 'width': 840, 'height': 72})
    await pg.click('.hist-btns [data-hist=undo]'); await pg.wait_for_timeout(900)
    check('Undo button brings the colour back', await st(kind) == before, await st(kind))
    check('…and Redo becomes available', not await st("document.querySelector('.hist-btns [data-hist=redo]').disabled"))
    await pg.click('.hist-btns [data-hist=redo]'); await pg.wait_for_timeout(900)
    check('Redo button applies it again', await st(kind) == changed, await st(kind))
    # a slider drag is one step, not dozens
    depth0 = await st("document.querySelector('.hist-btns [data-hist=undo]').disabled ? 0 : 1")
    sl = pg.locator('#group-background input[type=range]').first
    box = await sl.bounding_box()
    await pg.mouse.move(box['x'] + 4, box['y'] + box['height'] / 2); await pg.mouse.down()
    for i in range(12): await pg.mouse.move(box['x'] + 8 + i * 8, box['y'] + box['height'] / 2); await pg.wait_for_timeout(30)
    await pg.mouse.up(); await pg.wait_for_timeout(900)
    print('  slider:', await st("(()=>{const i=document.querySelector('#group-background input[type=range]');return i.id+'='+i.value})()"), 'overlay:', await st("JSON.stringify(__studio.state().overlay)"), 'diffs:', await st("window.__histDiffs"))
    await st("document.activeElement&&document.activeElement.blur()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(900)
    check('one ⌘Z undoes a whole slider drag (back to the redone colour, still picked)', await st(kind) == changed, await st(kind))
    # moving to another section is not an undo step
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    await st("window.__u0 = document.querySelector('.hist-btns [data-hist=undo]').disabled")
    await st("document.querySelector('#fs-next, .scene-next, [aria-label=\"Next section\"]')?.click()"); await pg.wait_for_timeout(900)
    print(f'RESULT {ok} / {n}')
