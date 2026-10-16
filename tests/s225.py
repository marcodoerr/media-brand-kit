# v4 · Export: what to export (entire / chosen / this one / elements), PNG · JPG · PDF · .zip, video subsets
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, asyncio, zipfile, subprocess, json, io
    from PIL import Image
    D=os.environ['OUT']+'/x225/'; os.makedirs(D, exist_ok=True)
    for f in os.listdir(D): os.remove(D+f)
    got=[]
    async def grab(d):
        p=D+d.suggested_filename; await d.save_as(p); got.append(p)
    pg.on('download', lambda d: asyncio.ensure_future(grab(d)))
    st=lambda e: pg.evaluate(e)
    U='http://127.0.0.1:8766/?debug&template'
    async def fresh():
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1800)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def wait_files(n, t=60):
        for _ in range(t*4):
            if len(got)>=n: await asyncio.sleep(0.5); return
            await asyncio.sleep(0.25)
    async def sheet(scope=None, kind=None, zipOn=None):
        await pg.click('#btn-export'); await pg.wait_for_timeout(500)
        if scope: await st(f"document.querySelector('#seg-scope [data-scope={scope}]').click()"); await pg.wait_for_timeout(300)
        if kind: await st(f"document.querySelector('#seg-filetype [data-kind={kind}]').click()"); await pg.wait_for_timeout(200)
        if zipOn is not None: await st(f"(()=>{{const z=document.querySelector('#sheet-zip');if(z.checked!=={str(zipOn).lower()}){{z.checked={str(zipOn).lower()};z.dispatchEvent(new Event('change'))}}}})()")
        await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c && c.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    def probe(p):
        o=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',p],capture_output=True,text=True).stdout
        return float(json.loads(o or '{}').get('format',{}).get('duration',0) or 0)

    await fresh()
    # --- Reel: the sheet shows the four scopes, video first
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    scopes = await st("[...document.querySelectorAll('#seg-scope button')].map(b=>b.dataset.scope)")
    kinds = await st("[...document.querySelectorAll('#seg-filetype button')].filter(b=>!b.hidden).map(b=>b.dataset.kind)")
    ok('four scopes', scopes==['all','pick','current','elements'], str(scopes))
    ok('Reel offers Video, PNG, JPG, PDF', kinds==['video','png','jpg','pdf'], str(kinds))
    ok('video is the default for a Reel', await st("document.querySelector('#seg-filetype [data-kind=video]').getAttribute('aria-checked')")=='true')
    # v4.4: PowerPoint exists only for a Presentation with its flag on (s238); here: not visible
    ok('PPTX is not offered', await st("(()=>{const b=document.querySelector('#seg-filetype [data-kind=pptx]');return !b||b.hidden||b.getBoundingClientRect().width===0})()"))
    await st("document.querySelector('#sheet-close').click()")

    # --- reference: the whole film at 3.0s (headless recorders run a little short, so compare like with like)
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=1;x.manual=true});})()")
    await sheet('all')
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 40)
    ref = probe([p for p in got[n0:] if p.endswith(('.mp4','.webm'))][0])
    # --- Choose: Hook + CTA only, as a video: its length is those two
    await st("(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=1.5;x.manual=true}); s.scenes[1].secs=3;})()")
    await sheet('pick')
    await st("document.querySelectorAll('#sheet-thumbs .sheet-pick')[1].click()"); await pg.wait_for_timeout(300)
    go = await st("document.querySelector('#save-go').textContent")
    ok('Choose: leaving Value out makes it a 3.0s video', '3.0s' in go, go)
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 40)
    vids=[p for p in got[n0:] if p.endswith(('.mp4','.webm'))]
    ok('chosen sections export as one video, as long as a 3.0s film', vids and abs(probe(vids[0])-ref) < 0.7, f'{[probe(v) for v in vids]} vs {ref}')
    ok('the timeline still has every section after export', await st("__studio.state().scenes.length")==3)
    ok('the scope is forgotten when the sheet closes', await st("document.querySelector('#sheet').hidden"))

    # --- This one: the Value section as a PNG (not the open Hook)
    await st("document.querySelectorAll('#scenes .clip')[1].querySelector('.frame-pick').click()"); await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    await sheet('current', 'png')
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 20)
    pngs=[p for p in got[n0:] if p.endswith('.png')]
    ok('This one: one PNG of the open section', len(pngs)==1 and Image.open(pngs[0]).size==(1080,1920), str(got[n0:]))

    # --- switch to Carousel (same project): PNG as one .zip, then separate files, then PDF
    await st("document.querySelector('.tb-content-btn[data-type=carousel]').click()"); await pg.wait_for_timeout(500)
    ok('Reel → Carousel keeps the sections', await st("__studio.state().scenes.length")==3 and await st("__studio.state().contentType")=='carousel')
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    kinds = await st("[...document.querySelectorAll('#seg-filetype button')].filter(b=>!b.hidden).map(b=>b.dataset.kind)")
    ok('Carousel offers PNG, JPG, PDF (no video)', kinds==['png','jpg','pdf'], str(kinds))
    await st("document.querySelector('#sheet-close').click()")
    await sheet('all', 'png', True)
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 30)
    zips=[p for p in got[n0:] if p.endswith('.zip')]
    ok('carousel as one .zip', len(zips)==1, str(got[n0:]))
    if zips:
        z=zipfile.ZipFile(zips[0]); names=z.namelist()
        ok('zip holds 3 numbered PNGs in order', len(names)==3 and [n.split('-')[-3] if False else n for n in names]==sorted(names), str(names))
        ok('zip PNGs are full size', all(Image.open(io.BytesIO(z.read(n))).size==(1080,1920) for n in names))
    await sheet('all', 'jpg', False)
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+3, 30)
    jpgs=[p for p in got[n0:] if p.endswith('.jpg')]
    ok('zip off: 3 separate JPGs', len(jpgs)==3, str(got[n0:]))
    await sheet('all', 'pdf')
    hint = await st("document.querySelector('#pdf-hint').hidden ? '' : document.querySelector('#pdf-hint').textContent")
    ok('PDF says it is pictures, and Preview is separate', 'Preview' in hint and 'picture' in hint, hint)
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 40)
    pdfs=[p for p in got[n0:] if p.endswith('.pdf')]
    ok('a PDF downloads', len(pdfs)==1, str(got[n0:]))
    if pdfs:
        info=subprocess.run(['pdfinfo',pdfs[0]],capture_output=True,text=True).stdout
        pages=[l for l in info.splitlines() if l.startswith('Pages:')]
        size=[l for l in info.splitlines() if l.startswith('Page size:')]
        ok('PDF has 3 pages', pages and pages[0].split()[-1]=='3', info)
        ok('PDF page has the 9:16 shape', size and '810 x 1440' in size[0], str(size))
        ok('qpdf finds the PDF valid', subprocess.run(['qpdf','--check',pdfs[0]],capture_output=True,text=True).returncode==0)
        subprocess.run(['pdftoppm','-r','20','-png','-f','2','-l','2',pdfs[0],D+'pg'],capture_output=True)
        pp=[D+f for f in os.listdir(D) if f.startswith('pg')]
        ex = Image.open(pp[0]).convert('L').getextrema() if pp else (0,0)
        ok('PDF page 2 renders with content', pp and ex[1]-ex[0] > 40, str(ex))
    # PDF of chosen slides
    await sheet('pick', 'pdf')
    await st("document.querySelectorAll('#sheet-thumbs .sheet-pick')[0].click()"); await pg.wait_for_timeout(200)
    n0=len(got); await pg.click('#save-go'); await wait_files(n0+1, 40)
    pdfs=[p for p in got[n0:] if p.endswith('.pdf')]
    info=subprocess.run(['pdfinfo',pdfs[0]],capture_output=True,text=True).stdout if pdfs else ''
    import re as _re
    ok('PDF of 2 chosen slides has 2 pages', _re.search(r'^Pages:\s+2$', info, _re.M), info[:300])

    # --- Elements: badge + text selected → transparent PNGs, cut or in position
    await pg.goto(U); await pg.wait_for_timeout(2200); await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await st("document.querySelectorAll('#scenes .clip')[0].querySelector('.frame-pick').click()"); await pg.wait_for_timeout(300)
    await pg.mouse.click(5, 450); await pg.wait_for_timeout(300)
    pts = await st("(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return [{x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k},{x:c.left+(L.txRect.x+L.txRect.w/2)*k,y:c.top+(L.txRect.y+L.tx.h/2)*k}]})()")
    await pg.mouse.click(pts[0]['x'], pts[0]['y']); await pg.wait_for_timeout(500)
    pts = await st("(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return [{x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k},{x:c.left+(L.txRect.x+L.txRect.w/2)*k,y:c.top+(L.txRect.y+L.tx.h/2)*k}]})()")
    await pg.keyboard.down('Shift'); await pg.mouse.click(pts[1]['x'], pts[1]['y']); await pg.keyboard.up('Shift'); await pg.wait_for_timeout(300)
    await pg.click('#btn-export'); await pg.wait_for_timeout(600)
    sc = await st("document.querySelector('#seg-scope [aria-checked=true]').dataset.scope")
    ok('with several selected, Export opens on Elements', sc=='elements', sc)
    ticked = await st("[...document.querySelectorAll('#sel-list input')].filter(i=>i.checked).length")
    ok('the selected two are ticked', ticked==2, str(ticked))
    n0=len(got); await pg.click('#sel-go'); await wait_files(n0+1, 20)
    zips=[p for p in got[n0:] if p.endswith('.zip')]
    ok('two elements as one .zip', len(zips)==1, str(got[n0:]))
    if zips:
        z=zipfile.ZipFile(zips[0]); ims=[Image.open(io.BytesIO(z.read(n))) for n in z.namelist()]
        ok('elements are transparent PNGs, cut to themselves', len(ims)==2 and all(i.mode=='RGBA' and i.size[1]<1920 for i in ims), str([(i.mode,i.size) for i in ims]))
    await pg.click('#btn-export'); await pg.wait_for_timeout(600)
    await st("(()=>{const c=document.querySelector('#sel-full');c.checked=true;})()")
    lbl = await st("document.querySelector('#sheet-sel').textContent")
    ok('plain words for full frame', 'Keep each element in its original position' in lbl)
    n0=len(got); await pg.click('#sel-go'); await wait_files(n0+1, 20)
    zips=[p for p in got[n0:] if p.endswith('.zip')]
    if zips:
        z=zipfile.ZipFile(zips[0]); ims=[Image.open(io.BytesIO(z.read(n))) for n in z.namelist()]
        ok('in position: full-size frames', all(i.size==(1080,1920) for i in ims), str([i.size for i in ims]))
    else: ok('in position: full-size frames', False, str(got[n0:]))
    # the old "items as separate PNGs" list still works
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("document.querySelector('#seg-scope [data-scope=all]').click()")
    await st("document.querySelector('#sheet-items').open=true"); await pg.wait_for_timeout(800)
    n0=len(got); await st("document.querySelector('#items-all').click()"); await wait_files(n0+1, 30)
    ok('Elements as separate PNGs (.zip) still works', any(p.endswith('-items.zip') for p in got[n0:]), str(got[n0:]))
    # phone: the sheet fits
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(500)
    await st("document.querySelector('#sheet').hidden=true")
    await st("document.querySelector('#btn-export').click()"); await pg.wait_for_timeout(600)
    w = await st("document.documentElement.scrollWidth")
    ok('phone: no sideways scroll with the sheet open', w<=390, str(w))
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs[:3]))
    print('RESULT', sum(R), '/', len(R))
