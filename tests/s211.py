R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os, subprocess, json
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    st = lambda e: pg.evaluate(e)
    # three sections 2 s each; Value on plain plum; Fade 1 s into Value, Slide 0.6 s into CTA
    await st("""(()=>{const s=__studio.state(); s.scenes.forEach(x=>{x.secs=2; x.manual=true}); const v=s.scenes.findIndex(x=>x.role==='value'); s.scenes[v].bg='solid-plum'; s.scenes[v].trans={type:'fade',secs:1}; s.scenes[v+1] && (s.scenes[v+1].trans={type:'slide',secs:0.6}, s.scenes[v+1].bg='solid-cream', s.scenes[v+1].overlay={style:'none',strength:0}); localStorage.setItem('backdrop-studio', JSON.stringify(s)); })()""")
    async with pg.expect_file_chooser() as fc:
        await pg.click('#add-btn'); await pg.wait_for_timeout(200)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300); await pg.locator('#clip-menu .clip-menu-item', has_text='Video or picture').first.click()
    await (await fc.value).set_files(D+'ov6.webm'); await pg.wait_for_timeout(1500)
    await st("(()=>{const o=__studio.state().overlays[0]; o.mode='window'; o.x=0.5; o.y=0.9; o.w=0.5; o.start=0; o.dur=6; o.fade=0;})()")
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    print('sheet', await st("[document.querySelector('#sheet-type').textContent, document.querySelector('#sheet-video').hidden, document.querySelector('#save-go').textContent]"))
    await st("(()=>{const c=document.querySelector('#sheet-cover'); if(c.checked){c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));}})()")
    async with pg.expect_download(timeout=60000) as dl:
        await pg.click('#save-go')
    d = await dl.value
    path = D+'s211_export'+os.path.splitext(d.suggested_filename)[1]
    await d.save_as(path)
    dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path],capture_output=True,text=True).stdout.strip() or 0)
    ok('export is ~6 s', 5.3 < dur < 7.5, str(dur))
    def px(t, fx, fy):
        out = subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',path,'-frames:v','1','-vf',f'crop=8:8:iw*{fx}:ih*{fy},scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
        return list(out[:3])
    hook, mid, val = px(1.0,.1,.1), px(2.5,.1,.1), px(3.8,.1,.1)
    print('hook', hook, 'mid fade', mid, 'value', val)
    between = all(min(a,c)-12 <= b <= max(a,c)+12 for a,b,c in zip(hook,mid,val)) and sum(abs(b-a) for a,b in zip(hook,mid))>30 and sum(abs(b-c) for b,c in zip(mid,val))>30
    ok('mid-fade frame lies between Hook and Value', between, str([hook,mid,val]))
    # slide into CTA at 4.0 for 0.6 s: at 4.3 the left edge still shows Value, the right edge the CTA
    v2 = px(3.8,.05,.5); c2 = px(5.6,.05,.5)
    near = lambda a,b: sum(abs(x-y) for x,y in zip(a,b))<45
    split = [t for t in (4.05,4.15,4.25,4.35,4.45,4.55) if near(px(t,.05,.5),v2) and near(px(t,.93,.5),c2)]
    ok('mid-slide: Value on the left, CTA coming in on the right', split, str([v2,c2]))
    # overlay window at the bottom: colour bars, in every section
    sat = lambda c: max(c)-min(c)
    o1, o2 = px(0.8,.45,.9), px(5.2,.45,.9)
    print('overlay', o1, o2)
    ok('overlay clip shows in the export (Hook and CTA)', sat(o1)>60 and sat(o2)>60, str([o1,o2]))
    print('TOTAL', sum(R), '/', len(R))
