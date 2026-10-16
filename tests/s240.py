# s240 · Badge surface: a background + stroke behind the whole badge, sized from the parts that show;
#        the main badge and an added badge; kept on reload. Home: no "Open now" label.
async def test(pg, ctx, logs):
    import os
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    SH = os.environ.get('SHOTS', 'out') + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    await pg.set_viewport_size({'width': 1440, 'height': 900})
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    check('home: no "Open now" label on the cards', await st("![...document.querySelectorAll('.home-live')].length && !document.body.innerText.includes('Open now')"))
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(400)
    # open the badge's controls by tapping it
    r = await st("(()=>{const c=document.querySelector('#preview'); const b=c.getBoundingClientRect(); const k=b.width/c.width; const R=__studio.layout().badge.parts.image||__studio.layout().badge.rect; return [b.left+(R.x+R.w/2)*k, b.top+(R.y+R.h/2)*k]})()")
    await pg.mouse.click(r[0], r[1]); await pg.wait_for_timeout(600)
    sw = pg.locator('#badge-controls .badge-surface .bp-head input')
    check('main badge: a Surface switch, off by default', await sw.count() == 1 and not await sw.is_checked())
    check('…and no surface drawn yet', not await st("!!__studio.layout().badge.surface"))
    await pg.locator('#badge-controls .badge-surface .bp-head').click(); await pg.wait_for_timeout(500)
    S0 = await st("__studio.layout().badge.surface")
    P = await st("(()=>{const p=__studio.layout().badge.parts; return Object.fromEntries(Object.entries(p).map(([k,r])=>[k,[r.x,r.y,r.w,r.h]]))})()")
    check('Surface on: drawn behind the badge, around every part that shows', S0 and all(S0['x'] < v[0] and S0['y'] < v[1] and S0['x']+S0['w'] > v[0]+v[2] and S0['y']+S0['h'] > v[1]+v[3] for v in P.values()), [S0, P])
    check('it is kept in the section', await st("!!(__studio.state().badgeSurface && __studio.state().badgeSurface.on)"))
    # remove the upper badge → the surface gets shorter, and still wraps what's left
    if 'upper' not in P:
        # pick a lockup that has the upper ("Powered by") part, with it on
        await st("(()=>{const s=__studio.state(); const k=[...document.querySelectorAll('#badge-thumbs [data-badge], #badge-thumbs .thumb')].map(t=>t.dataset.badge||t.dataset.id).filter(Boolean); window.__keys=k; })()")
        await st("(()=>{const s=__studio.state(); s.badgePowered=true; __studio.draw()})()"); await pg.wait_for_timeout(300)
        for key in await st("window.__keys"):
            await st(f"(()=>{{const s=__studio.state(); s.badge='{key}'; s.badgePowered=true; __studio.draw()}})()"); await pg.wait_for_timeout(250)
            if await st("!!__studio.layout().badge.parts.upper"): break
        S0 = await st("__studio.layout().badge.surface")
        P = await st("(()=>{const p=__studio.layout().badge.parts; return Object.fromEntries(Object.entries(p).map(([k,r])=>[k,[r.x,r.y,r.w,r.h]]))})()")
    had_upper = 'upper' in P
    if had_upper:
        await st("(()=>{const t=document.querySelector('#tg-powered'); t.click();})()"); await pg.wait_for_timeout(500)
        S1 = await st("__studio.layout().badge.surface")
        check('upper badge off: the surface shrinks to fit (shorter, same width or less)', S1['h'] < S0['h'] - 5 and S1['w'] <= S0['w'] + 1, [S0['h'], S1['h']])
        await st("document.querySelector('#tg-powered').click()"); await pg.wait_for_timeout(400)
    else:
        check('upper badge off: the surface shrinks to fit', False, 'this brand badge has no upper part')
    # lower badge on → taller
    await st("document.querySelector('#tg-badge-lower').click()"); await pg.wait_for_timeout(500)
    S2 = await st("__studio.layout().badge.surface")
    check('lower badge on: the surface grows to hold it', S2['h'] > S0['h'] + 5, [S0['h'], S2['h']])
    # colours and stroke
    body = pg.locator('#badge-controls .badge-surface .bp-body')
    chips = body.locator('[aria-label="Badge surface background"] .sw-colour')
    await chips.nth(1).click(); await pg.wait_for_timeout(300)
    want = await chips.nth(1).get_attribute('title')
    fill = await st("__studio.layout().badge.surface.fill")
    check('Background: a brand colour applies', fill and fill.lower() == (await st("[...document.querySelectorAll('#badge-controls .badge-surface [aria-label=\"Badge surface background\"] .sw-colour')][1].style.getPropertyValue('--sw')")).strip().lower(), [fill, want])
    await body.locator('.switch-row', has_text='Stroke').click(); await pg.wait_for_timeout(300)
    check('Stroke on: drawn with a width', (await st("__studio.layout().badge.surface.sw")) > 0)
    await st("(()=>{const i=[...document.querySelectorAll('#badge-controls .badge-surface input[type=range]')].find(x=>/width/i.test(x.getAttribute('aria-label'))); i.value=10; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(300)
    check('Stroke width slider changes it', (await st("__studio.layout().badge.surface.sw")) > 10)
    await pg.screenshot(path=SH + 's240_main.png')
    # pixels: the surface colour is on the canvas just inside the surface's top-left corner
    px = await st("(()=>{const s=__studio.layout().badge.surface; const d=document.querySelector('#preview').getContext('2d').getImageData(Math.round(s.x+5), Math.round(s.y+s.h/2), 1, 1).data; return '#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('')})()")
    check('it is painted on the canvas', px.lower() == fill.lower(), [px, fill])
    # Undo turns the stroke width back
    await st("document.activeElement && document.activeElement.blur()")
    await st("[...document.querySelectorAll('[data-hist=undo]')].find(b=>b.offsetParent).click()"); await pg.wait_for_timeout(400)
    check('Undo works on surface changes', (await st("__studio.layout().badge.surface.sw")) <= 10)
    # reload keeps it
    await pg.reload(); await pg.wait_for_timeout(2200)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(400)
    check('reload: the surface is kept', await st("!!(__studio.layout().badge && __studio.layout().badge.surface)"))
    # an added badge has its own surface
    await pg.click('#add-btn'); await pg.wait_for_timeout(250)
    await pg.locator('#clip-menu .clip-menu-item', has_text='Badge').first.click(); await pg.wait_for_timeout(700)
    xs = pg.locator('#badge-more .badge-item').last.locator('.badge-surface .bp-head')
    check('added badge: its own Surface switch', await xs.count() == 1)
    await xs.click(); await pg.wait_for_timeout(500)
    xb = await st("(()=>{const L=__studio.layout(); const x=(L.xbadges||[]).at(-1); return x && x.badge && x.badge.surface ? [x.badge.surface.w, x.badge.surface.h] : null})()")
    check('…drawing a surface behind that badge only', xb is not None and xb[0] > 0, xb)
    check('…saved on that badge', await st("!!(__studio.state().badges.at(-1).surface && __studio.state().badges.at(-1).surface.on)"))
    await pg.screenshot(path=SH + 's240_added.png')
    # phone: the controls are there in the sheet
    await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.reload(); await pg.wait_for_timeout(2000)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(400)
    r = await st("(()=>{const c=document.querySelector('#preview'); const b=c.getBoundingClientRect(); const k=b.width/c.width; const R=__studio.layout().badge.parts.image||__studio.layout().badge.rect; return [b.left+(R.x+R.w/2)*k, b.top+(R.y+R.h/2)*k]})()")
    await pg.mouse.click(r[0], r[1]); await pg.wait_for_timeout(700)
    check('phone: the badge sheet has the Surface controls', await pg.locator('#section-sheet .badge-surface').first.is_visible())
    await pg.screenshot(path=SH + 's240_phone.png')
    check('no page errors', not [l for l in logs if 'PAGEERROR' in l], logs)
    print(f'RESULT {ok} / {n}')
