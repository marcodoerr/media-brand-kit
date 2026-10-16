# v3.21 export check: a Hook-only video background, a drawing that draws on, an overlay with In Slide / Out Zoom
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, subprocess
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    await pg.set_viewport_size({'width':1440,'height':900})
    await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=2; x.manual=true; x.trans=null}); s.scenes[2].bg=null; s.scenes[2].overlay=null})()")
    async def pick(i):
        await st(f"document.querySelectorAll('#scenes .clip .frame-pick')[{i}].click()"); await pg.wait_for_timeout(300)
        await st("(()=>{const s=document.querySelector('#ui-scrim.is-on'); if(s) s.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));})()"); await pg.wait_for_timeout(200)
    corner = """(()=>{const c=document.querySelector('#preview'); const d=c.getContext('2d').getImageData(Math.round(c.width*0.06),Math.round(c.height*0.06),8,8).data; let r=0,g=0,b=0; for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]} const n=d.length/4; return [r/n|0,g/n|0,b/n|0]})()"""
    # Value's look before anything (shares the Hook's still background)
    await pick(1); await pg.wait_for_timeout(500)
    val_still = await st(corner)
    # Hook: a video background
    await pick(0); await pg.wait_for_timeout(400)
    await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(500)
    await pg.locator('#file-input').set_input_files(D+'hd.webm'); await pg.wait_for_timeout(2500)
    await st("__studio.state().scenes.forEach(x=>{x.secs=2; x.manual=true})")
    vid = await st("__studio.state().backdrop")
    ok('Hook has the video background', str(vid).startswith('up_'), vid)
    # CTA: a drawing (dark, long stroke along the lower part)
    await pick(2); await pg.wait_for_timeout(500)
    await pg.keyboard.press('Escape')
    await pg.click('#add-btn'); await pg.wait_for_timeout(250)
    await pg.locator('#clip-menu .clip-menu-item', has_text='Drawing').first.click(); await pg.wait_for_timeout(500)
    c = await pg.locator('#preview').bounding_box()
    await pg.mouse.move(c['x']+c['width']*0.12, c['y']+c['height']*0.8); await pg.mouse.down()
    for k in range(1,32): await pg.mouse.move(c['x']+c['width']*(0.12+k*0.024), c['y']+c['height']*(0.8-k*0.003))
    await pg.mouse.up(); await pg.wait_for_timeout(200)
    await pg.click('#draw-done'); await pg.wait_for_timeout(600)
    dcol = await st("__studio.state().drawings.at(-1).color")
    ok('CTA has a drawing (draws on by default)', await st("__studio.state().drawings.length")==1 and await st("__studio.state().drawings[0].anim")!=False, dcol)
    # an overlay window (colour bars) 0–1.6 s, In Slide / Out Zoom, 0.8 s
    await pick(0); await pg.wait_for_timeout(400)
    async with pg.expect_file_chooser() as fc:
        await pg.click('#add-btn'); await pg.wait_for_timeout(200)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Video or picture').first.click()
    await (await fc.value).set_files(D+'ov6.webm'); await pg.wait_for_timeout(1500)
    await st("(()=>{const o=__studio.state().overlays[0]; o.mode='window'; o.x=0.5; o.y=0.75; o.w=0.5; o.start=0; o.dur=1.6; o.fade=0.8; o.tin='slide'; o.tout='zoom';})()")
    # export the video
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c&&c.checked){c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    async with pg.expect_download(timeout=90000) as dl:
        await pg.click('#save-go')
    d = await dl.value
    path = D+'s218_export'+os.path.splitext(d.suggested_filename)[1]
    await d.save_as(path)
    dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path],capture_output=True,text=True).stdout.strip() or 0)
    ok('the video downloads, ~6 s', 5.3 < dur < 7.5, str(dur))
    def px(t, fx, fy, n=8):
        out = subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',path,'-frames:v','1','-vf',f'crop={n}:{n}:iw*{fx}:ih*{fy},scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
        return list(out[:3])
    def dark_count(t):
        # the recorder only adds a frame when the canvas changes, so a still ending is one held frame: 'last' reads it
        if t == 'last':
            raw = subprocess.run(['ffmpeg','-v','error','-ss','4.0','-i',path,'-vf','crop=iw:ih*0.3:0:ih*0.6','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
            fsz = 1080*int(1920*0.3)*3
            out = raw[-fsz:] if len(raw) >= fsz else raw
        else:
            out = subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',path,'-frames:v','1','-vf','crop=iw:ih*0.3:0:ih*0.6','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
        return sum(1 for i in range(0,len(out),3) if out[i]<40 and out[i+1]<40 and out[i+2]<40)
    diff = lambda a,b: sum(abs(x-y) for x,y in zip(a,b))
    hook_px = px(1.0,.06,.06); val_px = px(3.0,.06,.06)
    print('hook', hook_px, 'value', val_px, 'value still (editor)', val_still)
    ok('Hook frames show the video', diff(hook_px, val_still) > 40, str([hook_px, val_still]))
    v2 = px(3.6,.06,.06)
    ok('Value frames show its still background (the pink pattern), not the Hook video', val_px[0]>150 and val_px[2]>150 and val_px[1]<val_px[0]-40 and diff(val_px,v2)<60, str([val_px, v2, hook_px]))
    # overlay window centre: faint/away at 0.05 s (sliding in), there at 0.9 s, shrinking at 1.5 s
    sat = lambda c: max(c)-min(c)
    o0, o1 = px(0.05,.45,.75), px(0.9,.45,.75)
    ok('overlay In Slide: barely there at the start', sat(o0) < sat(o1)-40 or diff(o0,o1) > 60, str([o0,o1]))
    ok('overlay fully in by 0.9 s (colour bars)', sat(o1) > 60, str(o1))
    edge_full, edge_out = px(0.9,.27,.75,4), px(1.55,.27,.75,4)
    ok('overlay Out Zoom: smaller at the end (its left edge pulls in)', diff(edge_full, edge_out) > 40, str([edge_full, edge_out]))
    # drawing on the CTA (4.0–6.0): partial early, whole later
    early, late = dark_count(4.3), dark_count('last')
    print('drawing dark px', early, late)
    ok('drawing draws on in the export: partial early in the CTA', late > 0 and early < late*0.75, str([early, late]))
    ok('…and complete later', late > 500, str(late))
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs))
    print('TOTAL', sum(R), '/', len(R))
