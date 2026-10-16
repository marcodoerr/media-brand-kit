R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    st = lambda e: pg.evaluate(e)
    ok('desktop: overlay row with "Add an overlay clip"', await pg.locator('#tl-overlay .ov-add').is_visible())
    ok('a cut mark per cut', await pg.locator('#scenes .cut-mark').count() == (await st("__studio.state().scenes.length"))-1)
    # --- Value up to 3 min
    roles = await st("__studio.state().scenes.map(s=>s.role)")
    vi = roles.index('value')
    await pg.locator('#scenes .clip').nth(vi).locator('.clip-label').click(); await pg.wait_for_timeout(300)
    await pg.get_by_text('Duration', exact=False).first.click(); await pg.wait_for_timeout(300)
    note = await pg.locator('.clip-dur-note').inner_text()
    await pg.fill('#clip-dur-in', '180'); await pg.click('.clip-dur-set'); await pg.wait_for_timeout(400)
    ok('Value takes 180 s', abs(await st(f"__studio.state().scenes[{vi}].secs")-180)<0.01, note)
    ok('duration note says up to 3 min', '180' in note, note)
    hi = roles.index('hook')
    await pg.locator('#scenes .clip').nth(hi).locator('.clip-label').click(); await pg.wait_for_timeout(300)
    await pg.get_by_text('Duration', exact=False).first.click(); await pg.wait_for_timeout(300)
    await pg.fill('#clip-dur-in', '180'); await pg.click('.clip-dur-set'); await pg.wait_for_timeout(400)
    ok('Hook still stops at 30 s', abs(await st(f"__studio.state().scenes[{hi}].secs")-30)<0.01)
    # back to short times for the rest
    await st(f"(()=>{{const s=__studio.state().scenes; s.forEach(x=>{{x.secs=2; x.manual=true}}); }})()")
    await pg.evaluate("localStorage.setItem('x','1')")
    # re-render timeline
    await pg.locator('#scenes .clip').nth(0).locator('.frame-pick').click(); await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape')
    # --- overlay clip from the + Add menu
    async with pg.expect_file_chooser() as fc:
        await pg.click('#add-btn'); await pg.wait_for_timeout(200)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300); await pg.locator('#clip-menu .clip-menu-item', has_text='Video or picture').first.click()
    ch = await fc.value
    await ch.set_files(D+'ov6.webm'); await pg.wait_for_timeout(1500)
    ov = await st("__studio.state().overlays")
    ok('+ Add → Overlay clip adds one on the track', len(ov)==1 and ov[0]['mode']=='full', str(ov))
    ok('it shows as a clip on the overlay row', await pg.locator('#tl-overlay .ov-clip').count()==1)
    # drawn on the preview at the playhead
    m0 = (await st("__studio.motion()"))['overlays']
    await st("__studio.draw()"); await pg.wait_for_timeout(300)
    ok('drawn on the preview while the playhead is over it', (await st("__studio.motion()"))['overlays']>m0)
    await pg.screenshot(path=D+'s210_overlay_full.png')
    # drag it later
    clip = pg.locator('#tl-overlay .ov-clip')
    b = await clip.bounding_box()
    s0 = ov[0]['start']
    await pg.mouse.move(b['x']+b['width']/2, b['y']+b['height']/2); await pg.mouse.down()
    await pg.mouse.move(b['x']+b['width']/2+60, b['y']+b['height']/2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
    s1 = (await st("__studio.state().overlays[0].start"))
    ok('drag moves it along the film', s1>s0+0.1, str([s0,s1]))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    ok('Undo puts it back', abs(await st("__studio.state().overlays[0].start")-s0)<0.01)
    # tap → menu → Window
    b = await pg.locator('#tl-overlay .ov-clip').bounding_box()
    await pg.mouse.click(b['x']+20, b['y']+b['height']/2); await pg.wait_for_timeout(400)
    ok('tap opens its options (in the panel)', await pg.locator('#group-overlay').is_visible())
    await pg.locator('#ov-body button', has_text='Window').click(); await pg.wait_for_timeout(300)
    ok('Window shows Size and position', await st("__studio.state().overlays[0].mode")=='window' and await pg.locator('#ov-body .slider-row', has_text='Size').is_visible())
    await pg.screenshot(path=D+'s210_overlay_window.png')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # reload keeps it
    await pg.reload(); await pg.wait_for_timeout(1800); await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    ok('kept after reload', len(await st("__studio.state().overlays"))==1 and await pg.locator('#tl-overlay .ov-clip').count()==1)
    # --- transitions
    await pg.locator('#scenes .cut-mark').first.click(); await pg.wait_for_timeout(300)
    ok('cut mark opens Cut · Fade · Slide · Zoom', await pg.locator('#clip-menu .trans-type').count()==4)
    t0 = (await st("__studio.motion()"))['trans']
    await pg.locator('#clip-menu .trans-type', has_text='Fade').click(); await pg.wait_for_timeout(2500)
    tr = await st("__studio.state().scenes[1].trans")
    ok('Fade is set on the cut', tr and tr['type']=='fade', str(tr))
    ms = await st("__studio.motion()")
    ok('picking it plays the cut: blended frames drawn', ms['trans']-t0>=5, str(ms))
    ok('the mark shows it', await pg.locator('#scenes .cut-mark.has-trans').count()==1)
    await pg.screenshot(path=D+'s210_trans_menu.png')
    for name in ('Slide','Zoom'):
        if not await pg.locator('#clip-menu').is_visible():
            await pg.locator('#scenes .cut-mark').first.click(); await pg.wait_for_timeout(300)
        k0 = (await st("__studio.motion()"))['kinds'].get(name.lower(),0)
        await pg.locator('#clip-menu .trans-type', has_text=name).click(); await pg.wait_for_timeout(2500)
        ok(f'{name} plays', (await st("__studio.motion()"))['kinds'].get(name.lower(),0)>k0+3)
    if not await pg.locator('#clip-menu').is_visible():
        await pg.locator('#scenes .cut-mark').first.click(); await pg.wait_for_timeout(300)
    await pg.locator('#clip-menu .trans-all').click(); await pg.wait_for_timeout(300)
    trs = await st("__studio.state().scenes.slice(1).map(s=>s.trans&&s.trans.type)")
    ok('Use on every cut', all(t=='zoom' for t in trs), str(trs))
    # editing never shows a transition
    t1 = (await st("__studio.motion()"))['trans']
    await st("__studio.draw()"); await pg.wait_for_timeout(300)
    ok('editing draws the section itself', (await st("__studio.motion()"))['trans']==t1)
    # phone: row hidden until there is a clip — here there is one
    errs=[l for l in logs if 'PAGEERROR' in l or 'error:' in l.lower()]
    ok('no page errors', not errs, str(errs[:3]))
    print('TOTAL', sum(R), '/', len(R))
