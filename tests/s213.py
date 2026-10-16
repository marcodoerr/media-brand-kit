# v3.15 · overlay clips of every kind, editing in the panel / sheet, ✕, drag, pinch zoom
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, asyncio, subprocess
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    async def fresh(w=1440,h=900):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def add_kind(label, opener='#add-btn'):
        await pg.click(opener); await pg.wait_for_timeout(250)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('#clip-menu .clip-menu-item', has_text=label).first.click(); await pg.wait_for_timeout(600)
    RECT = "(id)=>{const o=__studio.state().overlays.find(o=>o.id===id); return o}"
    async def screen_rect(id):
        # the ✕ sits on the clip's upper-right corner; use the outline via the ✕'s position and the layout
        return await st("""(()=>{const b=document.querySelector('#sel-del'); if(b.hidden) return null; const r=b.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]})()""")
    def canvas_px(x,y):  # canvas (export) pixels → screen
        return st(f"(()=>{{const c=document.querySelector('#preview').getBoundingClientRect(); const k=c.width/document.querySelector('#preview').width; return [c.left+{x}*k, c.top+{y}*k]}})()")

    # ---------- desktop ----------
    await fresh()
    await pg.click('#add-btn'); await pg.wait_for_timeout(250)
    await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
    kinds = await st("[...document.querySelectorAll('#clip-menu .clip-menu-item span')].map(s=>s.textContent)")
    ok('Overlay clip offers Video or picture, Text, Badge, Cogent, Drawing', all(k in kinds for k in ['Video or picture','Text','Badge','Cogent','Drawing']), str(kinds))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # text
    m0 = (await st("__studio.motion()"))['overlays']
    await add_kind('Text')
    ov = await st("__studio.state().overlays")
    ok('Text overlay added at the playhead', len(ov)==1 and ov[0]['kind']=='text' and ov[0]['start']==0, str(ov))
    tid = ov[0]['id']
    ok('its controls open (Overlay · Text)', await pg.locator('#group-overlay').is_visible() and 'text' in (await pg.locator('#ov-title').inner_text()).lower())
    ok('the ✕ shows on it', await pg.locator('#sel-del').is_visible())
    ok('it is drawn on the preview', (await st("__studio.motion()"))['overlays']>m0)
    await pg.locator('#ov-body .ov-text').first.fill('Limited offer'); await pg.wait_for_timeout(300)
    ok('typing in Header changes it', (await st("__studio.state().overlays[0].h1"))=='Limited offer')
    await pg.screenshot(path=D+'s213_text.png')
    # drag it on the preview
    x0 = await st("__studio.state().overlays[0].x")
    cx = await st("""(()=>{const s=__studio.state(); const o=s.overlays[0]; const c=document.querySelector('#preview').getBoundingClientRect(); return [c.left+o.x*c.width, c.top+o.y*c.height]})()""")
    # find a point on the text: scan near (x, y) for a hit by asking which overlay is under it via a tap test
    await pg.mouse.move(cx[0], cx[1]+8); await pg.mouse.down(); await pg.mouse.move(cx[0]+60, cx[1]+8, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
    x1 = await st("__studio.state().overlays[0].x")
    ok('drag on the preview moves it', x1 > x0+0.05, str([x0,x1]))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    ok('Undo moves it back', abs(await st("__studio.state().overlays[0].x") - x0) < 0.01)
    # ✕ removes, Undo brings back
    await st("document.querySelector('#scenes .clip .frame-pick').click()"); await pg.wait_for_timeout(300)
    await pg.locator('#tl-overlay .ov-clip').first.click(); await pg.wait_for_timeout(400)
    ok('tap on its timeline clip selects it again', (await st("String(window.__sel||'')"))=='' and await pg.locator('#group-overlay').is_visible())
    await pg.click('#sel-del'); await pg.wait_for_timeout(300)
    ok('✕ removes it', len(await st("__studio.state().overlays"))==0)
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    ok('Undo brings it back', len(await st("__studio.state().overlays"))==1)
    # badge
    await add_kind('Badge')
    ov = await st("__studio.state().overlays")
    ok('Badge overlay added', ov[-1]['kind']=='badge' and ov[-1]['badge'], str(ov[-1]))
    btns = await pg.locator('#ov-body [role=radiogroup][aria-label=Badge] button').count()
    ok('its badge choice is offered', btns>=2, str(btns))
    await pg.screenshot(path=D+'s213_badge.png')
    # cogent
    await add_kind('Cogent')
    ov = await st("__studio.state().overlays")
    ok('Cogent overlay added (Ruth / Clara / Ada for Ask Ruth)', ov[-1]['kind']=='cogent' and ov[-1]['who'] in ('ruth','clara','ada'), str(ov[-1]))
    await pg.locator('#ov-body [aria-label=Look] button', has_text='Rough edges').click(); await pg.wait_for_timeout(300)
    ok('Round / Rough edges', (await st("__studio.state().overlays.at(-1).sticker"))==True)
    await pg.screenshot(path=D+'s213_cogent.png')
    # drawing
    await add_kind('Drawing'); await pg.wait_for_timeout(400)
    ok('Drawing opens draw mode', await pg.locator('#draw-bar').is_visible())
    c = await pg.locator('#preview').bounding_box()
    await pg.mouse.move(c['x']+c['width']*0.3, c['y']+c['height']*0.7); await pg.mouse.down()
    for k in range(1,12): await pg.mouse.move(c['x']+c['width']*(0.3+k*0.03), c['y']+c['height']*(0.7-k*0.01))
    await pg.mouse.up(); await pg.wait_for_timeout(200)
    nd = await st("(__studio.state().drawings||[]).length")
    await pg.click('#draw-done'); await pg.wait_for_timeout(500)
    ov = await st("__studio.state().overlays")
    ok('Done turns the drawing into an overlay clip (not a section drawing)', ov[-1]['kind']=='drawing' and ov[-1]['d'] and (await st("(__studio.state().drawings||[]).length"))==nd, str([ov[-1].get('kind'), nd]))
    await pg.screenshot(path=D+'s213_drawing.png')
    ok('four overlay clips on the row', await pg.locator('#tl-overlay .ov-clip').count()==4)
    # reload keeps them all
    await pg.reload(); await pg.wait_for_timeout(1800); await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    ok('kept after reload', [o['kind'] for o in await st("__studio.state().overlays")]==['text','badge','cogent','drawing'])
    # export: text overlay shows only during its time (0–2 s), with a fade
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=2.4;x.manual=true}); s.overlays=s.overlays.filter(o=>o.kind==='text'); const o=s.overlays[0]; o.start=0.8; o.dur=0.9; o.fade=0.15; o.y=0.5; o.h1='OVERLAY'; o.scale=1.6;})()")
    rr = await st("(()=>{const o=__studio.state().overlays[0]; const r=__studio.ovRect(o.id); const c=document.querySelector('#preview'); return [r.x/c.width, r.y/c.height, r.w/c.width, r.h/c.height]})()")
    got=[]
    async def grab(d): p=D+'s213_'+d.suggested_filename; await d.save_as(p); got.append(p)
    pg.on('download', lambda d: asyncio.ensure_future(grab(d)))
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c&&c.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    await pg.click('#save-go')
    for _ in range(160):
        if got: break
        await asyncio.sleep(0.25)
    await asyncio.sleep(0.5)
    def region(t):
        return subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',got[0],'-frames:v','1','-vf',f'crop=iw*{rr[2]:.3f}:ih*{rr[3]:.3f}:iw*{rr[0]:.3f}:ih*{rr[1]:.3f},scale=40:8','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
    if got:
        a,b,c2 = region(0.3), region(1.25), region(2.2)
        diff = lambda x,y: sum(abs(p-q) for p,q in zip(x,y))/max(1,len(x))
        ok('export: the text overlay appears during its time only', diff(a,b)>8 and diff(a,c2)<diff(a,b)/2, str([round(diff(a,b),1), round(diff(a,c2),1)]))
    else: ok('export: video downloaded', False)
    if await pg.locator('#sheet-close').is_visible(): await pg.click('#sheet-close')

    # ---------- phone: tap the overlay → the sheet, ✕; pinch zoom ----------
    await fresh(390,844)
    await add_kind('Text', '#fs-add-section')
    ok('phone: adding opens its sheet', await pg.locator('#section-sheet #group-overlay').is_visible())
    await pg.mouse.click(195, 30); await pg.wait_for_timeout(300)
    if await pg.locator('#section-sheet').is_visible():
        await st("document.querySelector('#panel-done')?.click()")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await st("(()=>{const o=__studio.state().overlays[0]; o.x=0.5; o.y=0.75; o.h1='Tap me'; __studio.draw();})()"); await pg.wait_for_timeout(300)
    # find the text's centre from the overlay hit area
    cent = await st("""(()=>{const c=document.querySelector('#preview'); const b=c.getBoundingClientRect(); const k=b.width/c.width; const o=__studio.state().overlays[0]; const r=__studio.ovRect(o.id); return [b.left+(r.x+r.w/2)*k, b.top+(r.y+r.h/2)*k]})()""")
    cdp = await ctx.new_cdp_session(pg)
    async def tap(x,y):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    hitxy=None
    for dy in (0,):
        await tap(cent[0], cent[1]+dy); await pg.wait_for_timeout(500)
        if await pg.locator('#section-sheet #group-overlay').is_visible(): hitxy=(cent[0],cent[1]+dy); break
    ok('phone: tapping the overlay on the preview opens its sheet', hitxy, str(cent))
    ok('phone: and shows the ✕', await pg.locator('#sel-del').is_visible())
    await pg.screenshot(path=D+'s213_phone_sheet.png')
    # pinch
    await st("document.querySelector('#panel-done')?.click()"); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    c = await pg.locator('#preview').bounding_box()
    mx, my = c['x']+c['width']/2, c['y']+c['height']/2
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':mx-20,'y':my,'id':1},{'x':mx+20,'y':my,'id':2}]})
    for k in range(1,9):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':mx-20-k*10,'y':my,'id':1},{'x':mx+20+k*10,'y':my,'id':2}]})
        await pg.wait_for_timeout(30)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    await pg.wait_for_timeout(400)
    tf = await st("getComputedStyle(document.querySelector('#preview')).transform")
    sc = await st("document.querySelector('#preview').getBoundingClientRect().width") / c['width']
    ok('phone: pinch zooms the preview', sc>2.0, str([tf, sc]))
    ok('phone: the 1:1 chip shows', await pg.locator('#zoom-reset').is_visible())
    ok('phone: nothing moved or got selected by the pinch', (await st("__studio.state().overlays[0].x"))==0.5 and not await pg.locator('#section-sheet').is_visible())
    await pg.screenshot(path=D+'s213_phone_zoom.png')
    await pg.click('#zoom-reset'); await pg.wait_for_timeout(300)
    sc2 = await st("document.querySelector('#preview').getBoundingClientRect().width") / c['width']
    ok('phone: 1:1 puts it back', abs(sc2-1)<0.01, str(sc2))
    # a pinch whose first finger lands on the overlay: zooms, does not drag it
    cent = await st("""(()=>{const c=document.querySelector('#preview'); const b=c.getBoundingClientRect(); const k=b.width/c.width; const o=__studio.state().overlays[0]; const r=__studio.ovRect(o.id); return [b.left+(r.x+r.w/2)*k, b.top+(r.y+r.h/2)*k]})()""")
    x0 = await st("__studio.state().overlays[0].x")
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':cent[0],'y':cent[1],'id':1}]})
    await pg.wait_for_timeout(60)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':cent[0],'y':cent[1],'id':1},{'x':cent[0]+40,'y':cent[1]-60,'id':2}]})
    for k in range(1,8):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':cent[0]-k*8,'y':cent[1]+k*8,'id':1},{'x':cent[0]+40+k*8,'y':cent[1]-60-k*8,'id':2}]})
        await pg.wait_for_timeout(30)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    await pg.wait_for_timeout(400)
    sc4 = await st("document.querySelector('#preview').getBoundingClientRect().width") / c['width']
    ok('phone: a pinch that starts on the overlay zooms and leaves it where it is', sc4>1.3 and abs(await st("__studio.state().overlays[0].x")-x0)<0.001, str([sc4]))
    await st("document.querySelector('#zoom-reset').click()"); await pg.wait_for_timeout(200)
    # desktop trackpad pinch (ctrl + wheel)
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.wait_for_timeout(500)
    c = await pg.locator('#preview').bounding_box()
    await pg.mouse.move(c['x']+c['width']/2, c['y']+c['height']/2)
    await pg.keyboard.down('Control'); await pg.mouse.wheel(0,-300); await pg.keyboard.up('Control'); await pg.wait_for_timeout(300)
    sc3 = await st("document.querySelector('#preview').getBoundingClientRect().width") / c['width']
    ok('desktop: ctrl + wheel (trackpad pinch) zooms', sc3>1.3, str(sc3))
    errs=[l for l in logs if 'PAGEERROR' in l]
    ok('no page errors', not errs, str(errs[:3]))
    print('TOTAL', sum(R), '/', len(R))
