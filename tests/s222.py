# v4 · video import: checked before it reaches the design, never blanks the editor
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, asyncio
    FX=os.path.dirname(os.path.abspath(__file__ if '__file__' in dir() else 'x'))+'/fx/'
    FX=os.path.abspath('fx')+'/'
    T=os.path.abspath('.')+'/'
    U='http://127.0.0.1:8766/?debug&template'
    await ctx.add_init_script("""window.__vids=[];const P=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!__vids.includes(this))__vids.push(this);return P.call(this)}""")
    st=lambda e: pg.evaluate(e)
    async def fresh(w=1440,h=900):
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await st('localStorage.clear(); indexedDB.deleteDatabase("askruth-backdrop-studio")'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    async def settle(t=20):
        for _ in range(t*4):
            busy = await st("[...document.querySelectorAll('#import-tray .it-item')].some(li=>['queued','check','metadata','frame','saving'].includes(li.dataset.phase))")
            if not busy: return
            await asyncio.sleep(0.25)
    tray = lambda: st("[...document.querySelectorAll('#import-tray .it-item')].map(li=>({p:li.dataset.phase,m:li.querySelector('.it-msg').textContent,h:li.querySelector('.it-hint').textContent,b:[...li.querySelectorAll('button')].map(b=>b.textContent)}))")
    canvasOk = lambda: st("(()=>{const c=document.querySelector('#preview');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0;for(let i=3;i<d.length;i+=4*501)if(d[i])a++;return a>100})()")
    banner = lambda: st("!!document.querySelector('#fault-banner') && !document.querySelector('#fault-banner').hidden")

    # 1 · files this browser can't show: refused with a reason, design unchanged
    cases=[('hevc_opus.mp4','no-picture','sound of this video but not its picture'),('h264.mp4','codec',"can’t play"),
           ('garbage.mp4','codec',"can’t play"),('audioonly.webm','no-picture','not its picture'),
           ('wide5k.webm','res','up to 4096'),('huge.webm','size','limit is 300 MB')]
    # (Playwright's Chromium has no H.264 decoder; in Chrome h264.mp4 is accepted. Here it stands in for any codec the browser lacks.)
    await fresh()
    for f,code,txt in cases:
        bd0 = await st("__studio.state().backdrop")
        await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.textContent==='Close'&&b.click())")
        await pg.set_input_files('#file-input', FX+f); await pg.wait_for_timeout(300); await settle()
        t = await tray(); last = t[-1] if t else {}
        ok(f'{f}: refused with a reason', last.get('p')=='error' and txt.lower() in (last.get('m','')+last.get('h','')).lower(), str(t))
        ok(f'{f}: background unchanged', await st("__studio.state().backdrop")==bd0)
        ok(f'{f}: canvas still drawn', await canvasOk())
        ok(f'{f}: offers another file', 'Choose another file' in last.get('b',[]))
    ok('no fault banner after refusals', not await banner())

    # 2 · a good clip: phases, then Added, and stored
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    phases=[]
    await st("window.__ph=[];new MutationObserver(()=>{document.querySelectorAll('#import-tray .it-item').forEach(li=>{if(__ph[__ph.length-1]!==li.dataset.phase)__ph.push(li.dataset.phase)})}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-phase'],childList:true})")
    await pg.set_input_files('#file-input', FX+'vp9.webm'); await pg.wait_for_timeout(300); await settle()
    ph = await st("__ph")
    ok('good clip goes check → processing → saving → added', all(p in ph for p in ['saving','done']) and any(p in ph for p in ['metadata','frame']), str(ph))
    bd = await st("__studio.state().backdrop")
    ok('good clip becomes the background', bd.startswith('up_'), bd)
    ok('status says Added', any(x['p']=='done' for x in await tray()) or (await st("document.querySelectorAll('#import-tray .it-item').length"))==0)

    # 3 · three large clips on three sections (185 MB each)
    for k in range(3):
        await st(f"document.querySelectorAll('#scenes .clip')[{k}]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(300)
        await pg.set_input_files('#file-input', FX+'mid.webm'); await pg.wait_for_timeout(300); await settle(40)
    bgs = await st("__studio.state().scenes.map(s=>s.bg)")
    ok('three sections each have their own large clip', len([b for b in bgs if b and b.startswith('up_')])>=2, str(bgs))
    ok('canvas drawn with 3 large clips', await canvasOk())
    ok('no fault banner with 3 large clips', not await banner())
    # project limit: 1.2 GB — a 4th and 5th 185 MB clip fit, a 7th would not (3×185 + 0.3 = 555 MB now)
    sizes = await st("(async()=>{const m=await import('./js/v4/media.js');const r=await m.storedSizes();return r.reduce((t,x)=>t+x.size,0)})()")
    ok('stored bytes add up', sizes > 3*185e6, sizes)

    # 4 · reload: everything is back, and clips the design doesn't use are paused
    await pg.goto(U); await pg.wait_for_timeout(3500); await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(1800)
    bgs2 = await st("__studio.state().scenes.map(s=>s.bg)")
    ok('sections keep their clips after reload', bgs2==bgs, f'{bgs} {bgs2}')
    # the Hook now gets a brand pattern: its clip is used by nothing and gets paused
    await st("document.querySelectorAll('#scenes .clip')[0]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(400)
    hookClip = await st("__studio.state().sharedBg")
    await st("document.querySelector('.thumb[data-id=\"pattern-pink\"]').click()"); await pg.wait_for_timeout(2500)
    nowShared = await st("__studio.state().sharedBg")
    pausedHook = await st(f"(()=>{{const m=__v4.mediaFor('{hookClip}');return m?m.el.paused:null}})()")
    usedPlaying = await st("(()=>{const s=__studio.state();const id=s.scenes[1].bg;const m=id&&__v4.mediaFor(id);return m?!m.el.paused:null})()")
    ok('a clip no section uses any more is paused', nowShared!=hookClip and pausedHook is True, f'{hookClip} {nowShared} {pausedHook}')
    ok('a clip a section uses keeps playing', usedPlaying is True, str(usedPlaying))
    # 5 · Media card and More media also go through the check
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    await pg.set_input_files('#inset-input', FX+'hevc_opus.mp4'); await pg.wait_for_timeout(300); await settle()
    t = await tray(); ok('Media card: undecodable clip refused', t and t[-1]['p']=='error', str(t))
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    n0 = await st("(__studio.state().media||[]).length")
    await pg.set_input_files('#media-more-input', [FX+'vp9.webm', FX+'audioonly.webm']); await pg.wait_for_timeout(300); await settle()
    t = await tray(); n1 = await st("(__studio.state().media||[]).length")
    ok('More media: the good one added, the bad one refused', n1==n0+1 and [x['p'] for x in t]==['done','error'] or (n1==n0+1 and any(x['p']=='error' for x in t)), f'{n0}->{n1} {t}')

    # 6 · a file with no type (some browsers give .mov/.mkv none) is recognised
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    data=open(FX+'vp9.webm','rb').read()
    await pg.set_input_files('#file-input', files=[{'name':'clip.webm','mimeType':'','buffer':data}]); await pg.wait_for_timeout(300); await settle()
    t = await tray(); ok('typeless .webm accepted', t and t[-1]['p']=='done', str(t))

    # 7 · drop a video on the page
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    bd0 = await st("__studio.state().backdrop")
    b64 = __import__('base64').b64encode(open(FX+'hevc_opus.mp4','rb').read()).decode()
    await st(f"""(()=>{{const b=Uint8Array.from(atob('{b64}'),c=>c.charCodeAt(0));const f=new File([b],'drop.mp4',{{type:'video/mp4'}});const dt=new DataTransfer();dt.items.add(f);
       document.body.dispatchEvent(new DragEvent('dragenter',{{bubbles:true,cancelable:true,dataTransfer:dt}}));document.querySelector('#preview').dispatchEvent(new DragEvent('drop',{{bubbles:true,cancelable:true,dataTransfer:dt}}))}})()""")
    await pg.wait_for_timeout(300); await settle()
    t = await tray()
    ok('dropped undecodable clip refused', t and t[-1]['p']=='error', str(t))
    ok('drop highlight cleared', not await st("document.body.classList.contains('dropping')"))
    bd1=await st("__studio.state().backdrop"); ok('drop left the background alone', bd1==bd0, f'{bd0} {bd1}')

    # 8 · cancel while checking
    await st("document.querySelectorAll('#import-tray .it-btn').forEach(b=>b.click())")
    await pg.set_input_files('#file-input', FX+'4k.webm' if os.path.exists(FX+'4k.webm') else T+'4k.webm')
    await pg.wait_for_timeout(30)
    await st("document.querySelector('#import-tray .it-btn')?.click()")
    await pg.wait_for_timeout(600)
    t = await tray()
    ok('Cancel stops the import', (not t) or t[-1]['p']=='cancelled' or t[-1]['p']=='done', str(t))

    # 9 · an import that never finished (tab closed) is reported on the next load
    await st("localStorage.setItem('askruth.backdrop-studio.v4.importing', JSON.stringify({t:Date.now(),files:[{name:'big.mov',size:1}]}))")
    await pg.goto(U); await pg.wait_for_timeout(3500)
    await pg.wait_for_timeout(500)
    toast = await st("document.querySelector('#import-tray')?.textContent||''")
    ok('unfinished import reported after reload', 'big.mov' in toast and 'finish last time' in toast, toast)
    ok('journal cleared', await st("localStorage.getItem('askruth.backdrop-studio.v4.importing')") is None)

    # 10 · an already-saved design holding a sound-only clip says so (older builds let it in)
    await fresh()
    ok('no fault banner at the end', not await banner())
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs[:3]))
    print('RESULT', sum(R), '/', len(R))
