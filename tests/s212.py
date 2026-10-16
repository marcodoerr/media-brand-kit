# v3.14 · end-to-end exports and core flows, desktop + phone
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, subprocess, json, zipfile, asyncio
    from PIL import Image
    D=os.environ['OUT']+'/'
    X=D+'x212/'; os.makedirs(X, exist_ok=True)
    for f in os.listdir(X): os.remove(X+f)
    U='http://127.0.0.1:8766/?debug&template'
    got=[]
    async def grab(d):
        p=X+d.suggested_filename; await d.save_as(p); got.append(p)
    pg.on('download', lambda d: asyncio.ensure_future(grab(d)))
    st = lambda e: pg.evaluate(e)
    async def fresh(w=1440,h=900):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def wait_files(n, t=60):
        for _ in range(t*4):
            if len(got)>=n: await asyncio.sleep(0.6); return
            await asyncio.sleep(0.25)
    def probe(p):
        o=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',p],capture_output=True,text=True).stdout
        j=json.loads(o or '{}'); v=[s for s in j.get('streams',[]) if s.get('codec_type')=='video']; a=[s for s in j.get('streams',[]) if s.get('codec_type')=='audio']
        return float(j.get('format',{}).get('duration',0) or 0), (v[0]['width'],v[0]['height']) if v else None, bool(a)
    def frame(p,t):
        out=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',p,'-frames:v','1','-vf','scale=54:96','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
        return out
    def spread(img):  # not a flat frame
        ex=Image.open(img).convert('L').getextrema(); return ex[1]-ex[0]
    async def export(go_label=None, setup=None):
        await pg.click('#btn-export'); await pg.wait_for_timeout(500)
        if setup: await setup()
        await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c && c.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
        await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go')

    # ---------- 1. PNG slides of a video project (3 sections) ----------
    await fresh()
    n0=len(got)
    async def png(): await st("document.querySelector('#seg-filetype [data-kind=png]')?.click()")
    # a video project: the sheet offers video; images come from the file-type row when shown
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    kinds = await st("[...document.querySelectorAll('#seg-filetype [data-kind], [data-kind=video]')].filter(b=>b.offsetParent).map(b=>b.dataset.kind)")
    go = await st("document.querySelector('#save-go').textContent")
    print('video sheet kinds', kinds, go)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    if await pg.locator('#sheet-close').is_visible(): await pg.click('#sheet-close')

    # ---------- 2. video export with cover, 3 sections ----------
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=1.5;x.manual=true});})()")
    await pg.locator('#scenes .clip').nth(0).locator('.frame-pick').click(); await pg.wait_for_timeout(300)
    total = await st("__studio.state().scenes.reduce((t,x)=>t+x.secs,0)")
    n0=len(got)
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c && !c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go'); await wait_files(n0+2, 40)
    vids=[p for p in got[n0:] if p.endswith(('.mp4','.webm'))]; covers=[p for p in got[n0:] if p.endswith('.jpg')]
    ok('video export downloads a video', vids, str(got[n0:]))
    if vids:
        dur,dim,aud = probe(vids[0])
        ok(f'video length ≈ {total:.1f}s', abs(dur-total)<1.0, str(dur))
        ok('video is 1080×1920', dim==(1080,1920), str(dim))
        f1,f2=frame(vids[0],0.7),frame(vids[0],total-0.7)
        print('DUR', dur, total, len(f1 or b''), len(f2 or b''))
        ok('video frames differ between Hook and CTA', f1 and f2 and f1!=f2)
    ok('cover image saved too (JPG 1080×1920)', covers and Image.open(covers[0]).size==(1080,1920), str(covers))
    if covers: ok('cover is not blank', spread(covers[0])>40)

    # ---------- 3. carousel: PNG and JPG slides, Large 2× ----------
    await fresh()
    await pg.select_option('#tab-format-select', 'carousel:9x16'); await pg.wait_for_timeout(600)
    n=await st("__studio.state().scenes.length")
    for kind, ext, scale, dims in (('png','.png',1,(1080,1920)),('jpg','.jpg',1,(1080,1920)),('png','.png',2,(2160,3840))):
        n0=len(got)
        await pg.click('#btn-export'); await pg.wait_for_timeout(500)
        await st(f"document.querySelector('#seg-filetype [data-kind={kind}]').click()")
        await st(f"document.querySelector('#seg-size [data-scale=\"{scale}\"]').click()")
        await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go'); await wait_files(n0+n, 30)
        files=[p for p in got[n0:] if p.endswith(ext)]
        ok(f'carousel {kind.upper()} {scale}×: one file per slide ({n})', len(files)==n, str([os.path.basename(f) for f in got[n0:]]))
        if files:
            ok(f'carousel {kind.upper()} {scale}×: size {dims}', all(Image.open(f).size==dims for f in files), str([Image.open(f).size for f in files]))
            ok(f'carousel {kind.upper()} {scale}×: slides not blank', all(spread(f)>40 for f in files))
        if await pg.locator('#sheet-close').is_visible(): await pg.click('#sheet-close'); await pg.wait_for_timeout(300)

    # ---------- 4. every format and brand: a PNG with the right size ----------
    sizes={'4x5':(1080,1350),'1x1':(1080,1080),'16x9':(1920,1080),'9x16':(1080,1920)}
    for brand in ('askruth','moshpit','t4r'):
        await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(800)
        for fmt,dims in sizes.items():
            await pg.select_option('#tab-format-select', f'carousel:{fmt}'); await pg.wait_for_timeout(500)
            n=await st("__studio.state().scenes.length")
            n0=len(got)
            await pg.click('#btn-export'); await pg.wait_for_timeout(400)
            await st("document.querySelector('#seg-filetype [data-kind=png]').click(); document.querySelector('#seg-size [data-scale=\"1\"]').click()")
            await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go'); await wait_files(n0+n, 30)
            files=[p for p in got[n0:] if p.endswith('.png')]
            ok(f'{brand} {fmt}: {n} PNGs at {dims[0]}×{dims[1]}', len(files)==n and all(Image.open(f).size==dims for f in files) and all(spread(f)>30 for f in files), str([Image.open(f).size for f in files]))
            if await pg.locator('#sheet-close').is_visible(): await pg.click('#sheet-close'); await pg.wait_for_timeout(250)

    # ---------- 5. items as PNGs: .zip and full frame ----------
    await pg.select_option('#brand-select', 'askruth'); await pg.wait_for_timeout(600)
    await pg.select_option('#tab-format-select', 'video:9x16'); await pg.wait_for_timeout(500)
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("document.querySelector('#sheet-items').open=true"); await pg.wait_for_timeout(400)
    items=await st("[...document.querySelectorAll('#items-list button, #items-list .png-btn')].length")
    n0=len(got)
    await pg.click('#items-all'); await wait_files(n0+1, 30)
    zips=[p for p in got[n0:] if p.endswith('.zip')]
    ok('items: Save all as .zip', zips, str(got[n0:]))
    if zips:
        z=zipfile.ZipFile(zips[0]); names=[x for x in z.namelist() if x.endswith('.png')]
        ok(f'items .zip holds PNGs ({len(names)})', len(names)>=3, str(names[:6]))
        im=Image.open(z.open(names[0])); ok('item PNGs are transparent (RGBA)', im.mode=='RGBA', im.mode)
    if await pg.locator('#sheet-close').is_visible(): await pg.click('#sheet-close'); await pg.wait_for_timeout(300)

    # ---------- 6. video background + sound + overlay + transitions: one export ----------
    await fresh()
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=2;x.manual=true}); s.scenes[1].trans={type:'fade',secs:0.6}; s.scenes[2].trans={type:'slide',secs:0.5};})()")
    # background video on the Hook (shared)
    await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(500)
    up = pg.locator('#file-input')
    await up.set_input_files(D+'hd.webm'); await pg.wait_for_timeout(2500)
    bg = await st("__studio.state().backdrop")
    ok('a video upload becomes the background', str(bg).startswith('up_'), bg)
    # sound
    snd = await st("!!document.querySelector('#music-input')")
    if snd:
        await pg.locator('#music-input').set_input_files(D+'tone.wav'); await pg.wait_for_timeout(2500)
    ok('a sound is added', await st("!!__studio.state().music"), str(snd))
    async with pg.expect_file_chooser() as fc:
        await pg.click('#add-btn'); await pg.wait_for_timeout(200)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300); await pg.locator('#clip-menu .clip-menu-item', has_text='Video or picture').first.click()
    await (await fc.value).set_files(D+'ov6.webm'); await pg.wait_for_timeout(1500)
    await st("(()=>{const o=__studio.state().overlays[0]; o.mode='window'; o.y=0.85; o.w=0.5; o.start=0.5; o.dur=4;})()")
    total = await st("__studio.state().scenes.reduce((t,x)=>t+x.secs,0)")
    n0=len(got)
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c && c.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go'); await wait_files(n0+1, 40)
    vids=[p for p in got[n0:] if p.endswith(('.mp4','.webm'))]
    ok('full film exports', vids, str(got[n0:]))
    if vids:
        dur,dim,aud = probe(vids[0])
        ok(f'full film ≈ {total:.0f}s', abs(dur-total)<1.0, str(dur))
        ok('full film has its sound', aud)
        a,b=frame(vids[0],0.2),frame(vids[0],0.6)
        ok('the background video moves in the export', a!=b)
    # ---------- 7. save, reload, reopen from ☰ ----------
    await pg.click('#btn-save-proj'); await pg.wait_for_timeout(400)
    await pg.fill('#save-pop-name', 'E2E film'); await pg.wait_for_timeout(100)
    await pg.click('#save-pop-go'); await pg.wait_for_timeout(800)
    await pg.goto(U); await pg.wait_for_timeout(1800)
    await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await pg.click('#burger'); await pg.wait_for_timeout(400)
    await pg.click('#burger-menu .burger-all'); await pg.wait_for_timeout(600)
    await st("(()=>{const t=[...document.querySelectorAll('#home-all [role=tab], #home-all button')].find(b=>/^\\s*saved/i.test(b.textContent)); t&&t.click();})()"); await pg.wait_for_timeout(500)
    names = await st("document.querySelector('#home-all').innerText")
    ok('saved project listed under ☰ → All projects after reload', 'E2E film' in names, names[:300])
    await st("document.querySelector('#home-all-close')?.click()"); await pg.wait_for_timeout(300)
    s2 = await st("({ov:(__studio.state().overlays||[]).length, tr:__studio.state().scenes.map(s=>s.trans&&s.trans.type)})")
    ok('overlay and transitions kept after reload', s2['ov']==1 and s2['tr'][1]=='fade' and s2['tr'][2]=='slide', str(s2))

    # ---------- 8. phone: video export reaches the user ----------
    await fresh(390,844)
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=1;x.manual=true});})()")
    n0=len(got)
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c && c.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    await st("(()=>{const z=document.querySelector('#sheet-zip');if(z&&z.checked){z.checked=false;z.dispatchEvent(new Event('change'))}})()"); await pg.click('#save-go')
    for _ in range(80):
        if len(got)>n0 or await pg.locator('#ready-bar:not([hidden])').count(): break
        await asyncio.sleep(0.25)
    if len(got)==n0 and await pg.locator('#ready-bar:not([hidden])').count():
        await pg.locator('#ready-bar button').first.click(); await wait_files(n0+1, 10)
    vids=[p for p in got[n0:] if p.endswith(('.mp4','.webm'))]
    ok('phone: the video reaches the user (download or the Save bar)', vids, str(got[n0:]))
    if vids: ok('phone video length ≈ 3s', abs(probe(vids[0])[0]-3)<1.0)
    errs=[l for l in logs if 'PAGEERROR' in l]
    ok('no page errors', not errs, str(errs[:3]))
    print('TOTAL', sum(R), '/', len(R))
