# s228 · Striped bands live under Color (not Pattern), with their Width control; Gradient hides for them
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    shown = """(()=>[...document.querySelectorAll('#thumbs > .thumb-wrap')].filter(w=>getComputedStyle(w).display!=='none'&&w.offsetParent&&!!document.querySelector('#thumbs').offsetParent).map(w=>{const t=w.querySelector('.thumb');return (t&&(t.getAttribute('aria-label')||t.title||t.dataset.id))||'?'}))()"""
    for brand in ('askruth', 'moshpit', 't4r'):
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(200)
        if brand != 'askruth': await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1200)
        # open Background (tap empty canvas edge = background)
        await st("document.querySelector('[data-tab=bg], #tab-bg, button[data-tab=\"bg\"]')?.click()")
        r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
        await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(600)
        await pg.click('#bg-kinds [data-k="pattern"]'); await pg.wait_for_timeout(400)
        pat = await st(shown)
        check(f'{brand} · no stripes under Pattern', not any('stripe' in x.lower() for x in pat), pat)
        await pg.click('#bg-kinds [data-k="colour"]'); await pg.wait_for_timeout(400)
        col = await st(shown)
        check(f'{brand} · both stripes under Color', sum('stripe' in x.lower() for x in col) == 2, col)
        check(f'{brand} · colour swatches still under Color', await st("!!document.querySelector('#bg-colours').offsetParent"))
        if brand == 'askruth': await pg.locator('#group-background').screenshot(path=O + 's228-colour.png')
        # pick a stripe: Width shows, Gradient hides, tab stays Color
        await st("document.querySelector('#thumbs .thumb[data-id$=stripes-brand]').click()"); await pg.wait_for_timeout(700)
        check(f'{brand} · picking a stripe keeps the Color tab', await st("document.querySelector('#group-background').dataset.k") == 'colour')
        check(f'{brand} · the stripe’s Width control shows', await st("(()=>{const t=document.querySelector('#tile-controls');return !!t&&!!t.offsetParent&&t.classList.contains('is-stripes')})()"))
        check(f'{brand} · Gradient hides for a stripe', not await st("!!document.querySelector('#grad-controls').offsetParent"))
        if brand == 'askruth': await pg.locator('#group-background').screenshot(path=O + 's228-stripe.png')
        # pick a plain colour again: Gradient back
        await st("document.querySelector('#bg-colours .swatch[data-id]').click()"); await pg.wait_for_timeout(500)
        check(f'{brand} · Gradient back for a plain colour', await st("!!document.querySelector('#grad-controls').offsetParent"))
    print(f'RESULT {ok} / {n}')
