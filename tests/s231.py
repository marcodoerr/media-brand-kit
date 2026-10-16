# s231 · An upload turned into a pattern lives under Pattern; turned back into a picture it lives under Image
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    import os
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    PHOTO = os.path.join(os.path.dirname(os.path.abspath('harness.py')), 'photo.png')
    U = 'http://127.0.0.1:8766/?debug&template'
    up_in = """(k)=>[...document.querySelectorAll('#thumbs > .thumb-wrap')].filter(w=>{const t=w.querySelector('.thumb');return t&&t.dataset.id===__studio.state().backdrop}).filter(w=>getComputedStyle(w).display!=='none').length"""
    tab = "document.querySelector('#group-background').dataset.k"
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
    await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(500)
    await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('#file-input', PHOTO); await pg.wait_for_timeout(2500)
    cur = await st("__studio.state().backdrop")
    check('the upload is the background', not cur.startswith(('solid', 'pattern')), cur)
    check('…shown under Image', await st(tab) == 'image' and await st(f"({up_in})('image')") >= 1, [await st(tab), await st(f"({up_in})('image')")])
    # turn it into a pattern
    await pg.click('#seg-upload-fit button[data-f="pattern"]'); await pg.wait_for_timeout(700)
    check('Pattern switches the tab to Pattern', await st(tab) == 'pattern', await st(tab))
    check('…and the upload is listed under Pattern', await st(f"({up_in})('pattern')") >= 1)
    await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(300)
    check('…and no longer under Image', await st(f"({up_in})('image')") == 0, await st(f"({up_in})('image')"))
    await pg.click('#bg-kinds [data-k="pattern"]'); await pg.wait_for_timeout(300)
    # back into a picture, from the Pattern tab
    await pg.click('#seg-upload-fit button[data-f="fill"], #seg-upload-fit button:not([data-f="pattern"])'); await pg.wait_for_timeout(700)
    check('Fill (from Pattern) switches the tab to Image', await st(tab) == 'image', await st(tab))
    check('…and the upload is listed under Image again', await st(f"({up_in})('image')") >= 1)
    await pg.click('#bg-kinds [data-k="pattern"]'); await pg.wait_for_timeout(300)
    check('…and no longer under Pattern', await st(f"({up_in})('pattern')") == 0, await st(f"({up_in})('pattern')"))
    # reload keeps it in the right place
    await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(200)
    await pg.click('#seg-upload-fit button[data-f="pattern"]'); await pg.wait_for_timeout(1200)
    await pg.reload(); await pg.wait_for_timeout(2500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(700)
    check('after reload a pattern upload opens under Pattern', await st(tab) == 'pattern', await st(tab))
    # route 2: Pattern tab → “Upload a pattern”, on desktop and on a phone, and in full screen
    for vw, vh, fs in ((1440, 900, False), (390, 844, False), (1440, 900, True)):
        tag = f'{vw}{" full screen" if fs else ""}'
        await pg.set_viewport_size({'width': vw, 'height': vh})
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        if fs: await pg.click('#fs-open'); await pg.wait_for_timeout(600)
        r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
        await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(600)
        await pg.click('#bg-kinds [data-k="pattern"]'); await pg.wait_for_timeout(300)
        await st("document.querySelector('#btn-upload').click()")
        await pg.set_input_files('#file-input', PHOTO); await pg.wait_for_timeout(2500)
        check(f'{tag} · “Upload a pattern” makes it a pattern', await st("!!(__studio.state().adjust[__studio.state().backdrop]||{}).pattern"))
        check(f'{tag} · …the tab stays Pattern', await st(tab) == 'pattern', await st(tab))
        check(f'{tag} · …listed under Pattern', await st(f"({up_in})('pattern')") >= 1, await st(f"({up_in})('pattern')"))
        await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(300)
        check(f'{tag} · …not under Image', await st(f"({up_in})('image')") == 0, await st(f"({up_in})('image')"))
        if vw == 390: await pg.screenshot(path=__import__('os').environ['SHOTS'] + '/s231-phone-image.png')
    # route 3: the Fill / Pattern switch itself on a phone and in full screen
    for vw, vh, fs in ((390, 844, False), (1440, 900, True)):
        tag = f'{vw}{" full screen" if fs else ""} switch'
        await pg.set_viewport_size({'width': vw, 'height': vh})
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        if fs: await pg.click('#fs-open'); await pg.wait_for_timeout(600)
        r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
        await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(600)
        await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(300)
        await pg.set_input_files('#file-input', PHOTO); await pg.wait_for_timeout(2500)
        await pg.locator('#seg-upload-fit button[data-f="pattern"]').click(); await pg.wait_for_timeout(800)
        check(f'{tag} · Pattern moves the tab to Pattern', await st(tab) == 'pattern', await st(tab))
        await pg.click('#bg-kinds [data-k="image"]'); await pg.wait_for_timeout(300)
        check(f'{tag} · …and it is gone from Image', await st(f"({up_in})('image')") == 0, await st(f"({up_in})('image')"))
    print(f'RESULT {ok} / {n}')
