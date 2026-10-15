# v3.21b · overlay rows past three: a visible ▲ ▼ control, wheel and touch; drawing overlays draw on
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    async def fresh(w,h):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def add(label, opener):
        await pg.click(opener); await pg.wait_for_timeout(250)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('#clip-menu .clip-menu-item', has_text=label).first.click(); await pg.wait_for_timeout(500)
    info = "(()=>{const l=document.querySelector('#tl-overlay'), c=document.querySelector('#ov-rows'); const lr=l.getBoundingClientRect(), cr=c?c.getBoundingClientRect():null, tl=document.querySelector('#timeline').getBoundingClientRect(); return {st:l.scrollTop, max:l.scrollHeight-l.clientHeight, ctl:!!c&&!c.hidden, n:c?c.querySelector('.ov-rows-n').textContent:'', up:c?c.querySelectorAll('button')[0].disabled:null, down:c?c.querySelectorAll('button')[1].disabled:null, lane:[lr.top|0,lr.bottom|0], c:cr?[cr.top|0,cr.bottom|0,cr.right|0]:null, tlr:tl.right|0}})()"
    for w,h,opener in ((1440,900,'#add-btn'),(390,844,'#fs-add-section')):
        tag = 'desktop' if w>800 else 'phone'
        await fresh(w,h)
        for k in range(3): await add('Text', opener); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        i = await st(info)
        ok(f'{tag}: three rows — no row control yet', not i['ctl'], str(i))
        for k in range(2): await add('Text', opener); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        i = await st(info)
        ok(f'{tag}: five rows — the ▲ ▼ control shows, level with the rows, inside the timeline', i['ctl'] and abs(i['c'][0]-i['lane'][0])<=2 and i['c'][2]<=i['tlr'], str(i))
        ok(f'{tag}: it says which rows show ({i["n"]})', i['n']=='3–5 of 5', str(i))
        await pg.locator('#ov-rows .ov-rows-btn').first.click(); await pg.wait_for_timeout(500)
        await pg.locator('#ov-rows .ov-rows-btn').first.click(); await pg.wait_for_timeout(500)
        i = await st(info)
        ok(f'{tag}: ▲ twice → rows 1–3, ▲ off, ▼ on', i['st']==0 and i['up'] and not i['down'] and i['n']=='1–3 of 5', str(i))
        await pg.locator('#ov-rows .ov-rows-btn').last.click(); await pg.wait_for_timeout(500)
        i = await st(info)
        ok(f'{tag}: ▼ → one row down', 30 <= i['st'] <= 38 and i['n']=='2–4 of 5', str(i))
        if tag=='desktop':
            r = await st("(()=>{const r=document.querySelector('#tl-overlay').getBoundingClientRect(); return [r.left, r.top, r.height]})()")
            await pg.mouse.move(r[0]+400, r[1]+r[2]/2); await pg.mouse.wheel(0, 200); await pg.wait_for_timeout(400)
            i = await st(info)
            ok('desktop: the mouse wheel over the rows scrolls them', i['st']==i['max'], str(i))
        else:
            # a vertical swipe on a clip (CDP touch) scrolls the rows, and does not move the clip
            await st("document.querySelector('#tl-overlay').scrollTop=0"); await pg.wait_for_timeout(200)
            s0 = await st("__studio.state().overlays.map(o=>o.start).join()")
            cdp = await ctx.new_cdp_session(pg)
            b = await pg.locator('#tl-overlay .ov-clip').nth(2).bounding_box()
            x, y = b['x']+b['width']/2, b['y']+b['height']/2
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for k in range(1,9): await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y-k*9}]}); await pg.wait_for_timeout(16)
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(500)
            i = await st(info)
            ok('phone: a vertical swipe on the rows scrolls them', i['st']>10, str(i))
            ok('…without moving a clip', await st("__studio.state().overlays.map(o=>o.start).join()")==s0)
        await pg.screenshot(path=D+f's219_{tag}.png')
    # ---------- a drawing overlay draws on ----------
    await fresh(1440,900)
    await add('Drawing', '#add-btn'); await pg.wait_for_timeout(300)
    c = await pg.locator('#preview').bounding_box()
    await pg.mouse.move(c['x']+c['width']*0.12, c['y']+c['height']*0.82); await pg.mouse.down()
    for k in range(1,32): await pg.mouse.move(c['x']+c['width']*(0.12+k*0.024), c['y']+c['height']*(0.82-k*0.003))
    await pg.mouse.up(); await pg.wait_for_timeout(200)
    await pg.click('#draw-done'); await pg.wait_for_timeout(600)
    o = await st("__studio.state().overlays.at(-1)")
    ok('a drawing overlay clip', o['kind']=='drawing', str(o.get('kind')))
    ok('its panel offers Draw it on (selected) · Show at once', await pg.locator('#ov-body [aria-label="Draw on"] button', has_text='Draw it on').get_attribute('aria-checked')=='true')
    await st("(()=>{const o=__studio.state().overlays.at(-1); o.start=0; o.dur=3; o.fade=0; o.tin='cut'; o.tout='cut'})()")
    cnt = """(()=>{const cv=document.querySelector('#preview'); const g=cv.getContext('2d'); const W=cv.width,H=cv.height;
      const d=g.getImageData(0, Math.round(H*0.6), W, Math.round(H*0.35)).data; let n=0; for(let i=0;i<d.length;i+=4){ if(Math.abs(d[i]-17)<12&&Math.abs(d[i+1]-17)<12&&Math.abs(d[i+2]-17)<12) n++; } return n})()"""
    full = await st(cnt)
    await st("document.querySelectorAll('#scenes .clip .frame-pick')[0].click()"); await pg.wait_for_timeout(300)
    await st("(()=>{const s=document.querySelector('#ui-scrim.is-on'); if(s) s.click()})()")
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(380)
    early = await st(cnt)
    await pg.wait_for_timeout(1300)
    late = await st(cnt)
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(300)
    ok(f'playing: the drawing overlay draws on (early {early}, later {late}, editor {full})', early < full*0.7 and late > full*0.8, str([early, late, full]))
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs))
    print('TOTAL', sum(R), '/', len(R))
