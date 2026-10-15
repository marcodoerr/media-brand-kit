R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    async def add(label, opener):
        await pg.click(opener); await pg.wait_for_timeout(250)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('#clip-menu .clip-menu-item', has_text=label).first.click(); await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    rows = lambda: st("[...document.querySelectorAll('#tl-overlay .ov-clip')].map(e=>[e.dataset.id, e.offsetTop, e.getBoundingClientRect().top|0])")
    for w,h,opener in ((1440,900,'#add-btn'),(390,844,'#fs-add-section')):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        tag = 'desktop' if w>800 else 'phone'
        for k in ('Text','Badge','Cogent'): await add(k, opener)
        ov = await st("__studio.state().overlays")
        ok(f'{tag}: three overlays at the same time', len(ov)==3 and len({o['start'] for o in ov})==1, str([(o['kind'],o['start']) for o in ov]))
        boxes = await st("__studio.state().overlays.map(o=>__studio.ovRect(o.id))")
        inter = lambda a,b: a['x']<b['x']+b['w'] and b['x']<a['x']+a['w'] and a['y']<b['y']+b['h'] and b['y']<a['y']+a['h']
        clash = [(i,j) for i in range(3) for j in range(i+1,3) if boxes[i] and boxes[j] and inter(boxes[i],boxes[j])]
        ok(f'{tag}: new clips land clear of each other on the preview', not clash, str(clash))
        r = await rows()
        tops = sorted({t for _,t,_ in r})
        ok(f'{tag}: each on its own row (nothing hidden)', len(tops)==3, str(r))
        # every clip can be tapped on its row
        good = 0
        for k in range(3):
            el = pg.locator('#tl-overlay .ov-clip').nth(k)
            await el.click(position={'x':12,'y':12}); await pg.wait_for_timeout(300)
            if await st(f"(()=>{{const t=document.querySelectorAll('#tl-overlay .ov-clip')[{k}]; return t && t.classList.contains('is-selected')}})()"): good += 1
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        ok(f'{tag}: each row\'s clip can be tapped and selected', good==3, str(good))
        ok(f'{tag}: all three are drawn on the preview', (await st("__studio.motion()"))['overlays']>=3)
        # sound row sits under the overlay rows
        ob = await st("(()=>{const o=document.querySelector('#tl-overlay').getBoundingClientRect(); const a=document.querySelector('#tl-audio').getBoundingClientRect(); return [o.bottom|0, a.top|0]})()")
        ok(f'{tag}: the sound row moves down below them', ob[1] >= ob[0], str(ob))
        ok(f'{tag}: no sideways scroll', await st("document.documentElement.scrollWidth<=innerWidth"))
        # move one clear of the others → rows close up
        pps = await st("(()=>{const c=document.querySelector('#tl-overlay .ov-clip'); return c.getBoundingClientRect().width/__studio.state().overlays[0].dur})()")
        for idx, secs in ((2, 6.0), (1, 3.0)):
            el = pg.locator(f'#tl-overlay .ov-clip[data-id="{ov[idx]["id"]}"]')
            await el.scroll_into_view_if_needed()
            b = await el.bounding_box()
            await pg.mouse.move(b['x']+20, b['y']+b['height']/2); await pg.mouse.down()
            await pg.mouse.move(b['x']+20+secs*pps, b['y']+b['height']/2, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(400)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        r2 = await rows()
        ok(f'{tag}: clips apart in time share one row again', len({t for _,t,_ in r2})==1, str(r2))
        await pg.screenshot(path=D+f's215_{tag}.png')
        await st("(()=>{const s=__studio.state(); s.overlays.forEach(o=>o.start=0);})()")
        await pg.locator('#scenes .clip').nth(0).locator('.frame-pick').click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=D+f's215_{tag}_stacked.png')
        if tag=='phone':
            cv = await st("document.querySelector('#preview').getBoundingClientRect().height")
            ok('phone: the preview keeps a usable size with three rows', cv>300, str(cv))
    errs=[l for l in logs if 'PAGEERROR' in l]
    ok('no page errors', not errs, str(errs[:3]))
    print('TOTAL', sum(R), '/', len(R))
