# v3.21 · video stays in its section, New project (+ on phone, button on desktop), sheet Done, stage buttons when the panel
# is hidden, no Exit full screen, no "Tap anything" box, Preview dims, drawings draw on in the video
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    async def fresh(w=1440,h=900):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    pick = lambda i: st(f"document.querySelectorAll('#scenes .clip .frame-pick')[{i}].click()")

    # ---------- a video background stays in its section ----------
    await fresh()
    before = await st("(()=>{const s=__studio.state(); return s.backdrop})()")
    await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(500)
    await pg.locator('#file-input').set_input_files(D+'hd.webm'); await pg.wait_for_timeout(2500)
    vid = await st("__studio.state().backdrop")
    ok('Hook: the video is its background', str(vid).startswith('up_'), vid)
    await pick(1); await pg.wait_for_timeout(600)
    v1 = await st("__studio.state().backdrop")
    ok('Value keeps the background it had (not the Hook video)', v1==before, str([v1,before]))
    await pick(2); await pg.wait_for_timeout(600)
    ok('CTA neither', await st("__studio.state().backdrop")!=vid)
    await pick(0); await pg.wait_for_timeout(600)
    ok('back on the Hook: the video', await st("__studio.state().backdrop")==vid)
    # a still picked on the Hook is still shared
    await st("__studio.state()")
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pick(1); await pg.wait_for_timeout(600)
    ok('after a reload: Value still without the video', await st("__studio.state().backdrop")==before)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await st("document.querySelector('#ui-scrim.is-on')?.click()"); await pg.wait_for_timeout(300)
    # a section can still have the video if you put it there
    await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(500)
    await pg.locator('#file-input').set_input_files(D+'hd.webm'); await pg.wait_for_timeout(2500)
    vb = await st("__studio.state().backdrop")
    await pick(0); await pg.wait_for_timeout(500); await pick(1); await pg.wait_for_timeout(500)
    ok('a video put on Value stays on Value', await st("__studio.state().backdrop")==vb, vb)

    # ---------- desktop: New project by the heart ----------
    await fresh()
    ok('desktop: New project button sits before the heart', await st("(()=>{const n=document.querySelector('#btn-new-proj'), h=document.querySelector('#btn-save-proj'); return n && n.offsetParent && n.nextElementSibling===h})()"))
    ok('☰ Projects lists New project (v4)', await st("(()=>{document.querySelector('#burger').click(); const t=[...document.querySelectorAll('#burger-menu .burger-act')].map(b=>b.textContent); document.querySelector('#burger-scrim').click(); return t.some(x=>x.startsWith('New project'))})()"))
    await pg.select_option('#brand-select', 't4r'); await pg.wait_for_timeout(1200)
    await st("__studio.state().h1='Changed for the test'"); 
    await pg.click('#btn-new-proj'); await pg.wait_for_timeout(1500)
    s = await st("(()=>{const s=__studio.state(); return {brand:s.brand, h1:s.h1, pristine:s.pristine}})()")
    ok('it opens a new project in the selected brand (T4R)', s['brand']=='t4r' and s['h1']!='Changed for the test' and s['pristine'], str(s))
    tt = await st("(()=>{const t=document.querySelector('#undo-toast'); return t && !t.hidden ? t.textContent : ''})()")
    ok('…and says where the last one went', 'Recent' in tt, tt)

    # ---------- view menu in full screen: no Exit full screen ----------
    await st("document.querySelector('#fs-open').click()"); await pg.wait_for_timeout(400)
    vm = await st("(()=>{const b=[...document.querySelectorAll('#fs-bar button')].find(b=>/view|grid/i.test(b.id+b.title+b.getAttribute('aria-label'))); if(!b) return null; b.click(); return [...document.querySelectorAll('#clip-menu .clip-menu-item')].map(x=>x.textContent)})()")
    ok('full-screen view menu: Safe area, Grid — no Exit full screen', vm and not any('Exit full screen' in x for x in vm) and any('Grid' in x for x in vm), str(vm))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # ---------- Preview dims the page ----------
    await st("document.querySelector('#fs-preview').click()"); await pg.wait_for_timeout(700)
    sh = await st("getComputedStyle(document.querySelector('.stage')).boxShadow")
    ok('Preview: the page behind the design is toned down', 'inset' in sh and '0.3' in sh, sh)
    await pg.screenshot(path=D+'s217_preview.png')
    await st("document.querySelector('#fs-preview').click()"); await pg.wait_for_timeout(300)
    ok('Edit again: no dim', 'inset' not in await st("getComputedStyle(document.querySelector('.stage')).boxShadow"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

    # ---------- panel hidden: stage buttons at the right edge ----------
    await fresh(2000,1000)
    await st("document.querySelector('#panel-toggle').click()"); await pg.wait_for_timeout(500)
    r = await st("['surface-toggle','fs-open','panel-toggle','btn-export'].map(i=>Math.round(document.getElementById(i).getBoundingClientRect().right))")
    ok('panel hidden: the three buttons line up with Export on the right', abs(r[0]-r[3])<=2 and r[0]==r[1]==r[2], str(r))
    ok('…and the neutral "Tap anything" box is gone', not await st("!!document.querySelector('#neutral-hint').offsetParent"))
    await st("document.querySelector('#panel-toggle').click()"); await pg.wait_for_timeout(500)
    r2 = await st("Math.round(document.getElementById('surface-toggle').getBoundingClientRect().right)")
    ok('panel shown: they sit by the stage again', r2 < r[3]-200, str(r2))
    await pg.screenshot(path=D+'s217_desktop.png')

    # ---------- drawings draw on ----------
    await fresh()
    await pg.click('#add-btn'); await pg.wait_for_timeout(250)
    await pg.locator('#clip-menu .clip-menu-item', has_text='Drawing').first.click(); await pg.wait_for_timeout(500)
    c = await pg.locator('#preview').bounding_box()
    await pg.mouse.move(c['x']+c['width']*0.15, c['y']+c['height']*0.85); await pg.mouse.down()
    for k in range(1,30): await pg.mouse.move(c['x']+c['width']*(0.15+k*0.025), c['y']+c['height']*(0.85-k*0.004))
    await pg.mouse.up(); await pg.wait_for_timeout(200)
    await pg.click('#draw-done'); await pg.wait_for_timeout(600)
    dr = await st("__studio.state().drawings")
    ok('a section drawing', len(dr)==1, str(len(dr)))
    ok('its panel: "Draw it on in the video", on by default', await st("document.querySelector('#draw-anim').checked") and await pg.locator('#draw-anim-row').is_visible())
    js_count = """(()=>{const cv=document.querySelector('#preview'); const g=cv.getContext('2d'); const W=cv.width,H=cv.height;
      const d=g.getImageData(0, Math.round(H*0.6), W, Math.round(H*0.35)).data; let n=0; for(let i=0;i<d.length;i+=4){ if(Math.abs(d[i]-17)<12&&Math.abs(d[i+1]-17)<12&&Math.abs(d[i+2]-17)<12) n++; } return n})()"""
    col = await st("__studio.state().drawings[0].color")
    full = await st(js_count)
    await st("document.querySelectorAll('#scenes .clip .frame-pick')[0].click()"); await pg.wait_for_timeout(300)
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(330)
    early = await st(js_count)
    await pg.wait_for_timeout(1300)
    late = await st(js_count)
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(300)
    ok(f'playing: early in the section only part of it is drawn ({early} of {full} px)', early < full*0.7, str([early, late, full, col]))
    ok('…and all of it once drawn on', late > full*0.85, str([early, late, full]))
    # off: shows at once
    await st("(()=>{const d=__studio.state().drawings[0]; window.__studio.state().drawings[0].anim=false; __studio.draw()})()")
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(330)
    early2 = await st(js_count)
    await st("document.querySelector('#tl-play').click()"); await pg.wait_for_timeout(300)
    ok('switched off: there at once', early2 > full*0.85, str([early2, full]))

    # ---------- phone: + → New project, sheet Done ----------
    await fresh(390,844)
    await pg.click('#fs-add-section'); await pg.wait_for_timeout(300)
    labels = await st("[...document.querySelectorAll('#clip-menu .clip-menu-item')].map(b=>b.textContent)")
    ok('phone: + lists New project (last)', labels and labels[-1].startswith('New project'), str(labels[-2:]))
    ok('phone: the New project button by the heart is hidden', not await st("!!document.querySelector('#btn-new-proj').offsetParent"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(700)
    ok('phone: the sheet opens with Done in its top-right corner', await pg.locator('#section-sheet-done').is_visible())
    dn = await st("(()=>{const d=document.querySelector('#section-sheet-done').getBoundingClientRect(), s=document.querySelector('#section-sheet').getBoundingClientRect(); return {right:s.right-d.right, top:d.top-s.top}})()")
    ok('…in the corner', dn['right']<24 and dn['top']<24, str(dn))
    await st("document.querySelector('#section-sheet-body').scrollTop=400"); await pg.wait_for_timeout(200)
    ok('…and still there after scrolling the sheet', await pg.locator('#section-sheet-done').is_visible())
    await pg.screenshot(path=D+'s217_phone_sheet.png')
    await pg.click('#section-sheet-done'); await pg.wait_for_timeout(500)
    ok('Done closes the sheet', await st("document.querySelector('#section-sheet').hidden"))
    await pg.click('#fs-add-section'); await pg.wait_for_timeout(300)
    await pg.locator('#clip-menu .clip-menu-item', has_text='New project').click(); await pg.wait_for_timeout(1500)
    ok('phone: New project opens a fresh one', await st("__studio.state().pristine"))
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs))
    print('TOTAL', sum(R), '/', len(R))
