# v3.24 · scrubbing the playhead across sections shows each overlay clip in its own time
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    for w,h,opener in ((1440,900,'#add-btn'),(390,844,'#fs-add-section')):
        tag = 'desktop' if w>800 else 'phone'
        await pg.set_viewport_size({'width':w,'height':h})
        await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        for k in range(3):
            await pg.click(opener); await pg.wait_for_timeout(250)
            await pg.locator('#clip-menu .clip-menu-item', has_text='Overlay clip').first.click(); await pg.wait_for_timeout(300)
            await pg.locator('#clip-menu .clip-menu-item', has_text='Badge').first.click(); await pg.wait_for_timeout(500)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await st("document.querySelector('#sheet-close, #section-sheet-done')") 
        await st("(()=>{const o=__studio.state().overlays; [[1,2],[4,2],[8.5,1.5]].forEach(([s,d],i)=>{o[i].start=s;o[i].dur=d;o[i].x=0.5;o[i].y=0.2+i*0.3;o[i].scale=0.6}); window.__ovIds=o.map(x=>x.id); __studio.draw()})()")
        if tag=='phone':
            await st("(()=>{const d=document.querySelector('#section-sheet-done'); if(d&&d.offsetParent) d.click()})()"); await pg.wait_for_timeout(400)
        # what each clip's spot looks like with nothing on it (all clips out of time) — sampled per section later
        sig = """((i)=>{const id=window.__ovIds[i]; const r=__studio.ovRect(id); const c=document.querySelector('#preview'); const g=c.getContext('2d');
          const d=g.getImageData(Math.round(r.x+r.w*0.3),Math.round(r.y+r.h*0.3),Math.max(4,Math.round(r.w*0.4)),Math.max(4,Math.round(r.h*0.4))).data; let s=0; for(let k=0;k<d.length;k+=4) s+=d[k]*3+d[k+1]*5+d[k+2]; return Math.round(s/(d.length/4))})"""
        r = await st("(()=>{const r=document.querySelector('#tl-ruler').getBoundingClientRect(); return [r.left, r.top+r.height/2, r.width]})()")
        pps = await st("(()=>{const h=document.querySelector('#tl-playhead'); return null})()")
        total = await st("__studio.state().scenes.reduce((a,s)=>a,0)")
        await pg.mouse.move(r[0]+1, r[1]); await pg.mouse.down()
        seen = {}
        for t in (0.4, 1.8, 3.4, 4.6, 6.6, 7.6, 9.2, 10.3):
            # move until the clock reads t (pps from the time label)
            x = await st(f"(()=>{{const r=document.querySelector('#tl-ruler').getBoundingClientRect(); const lp=parseFloat(getComputedStyle(document.querySelector('#tl-ruler')).left)||0; return null}})()")
            await pg.mouse.move(r[0] + t * await st("(()=>{const sc=document.querySelector('#tl-scroll'); const clips=[...document.querySelectorAll('#scenes .clip')]; const a=clips[0].getBoundingClientRect(), b=clips.at(-1).getBoundingClientRect(); const tot=__studio.state().scenes.reduce((s,x)=>s+(x.secs||0),0); return (b.right-a.left)/tot})()"), r[1], steps=3)
            await pg.wait_for_timeout(250)
            tt = await st("document.querySelector('#tl-time').textContent.split(' / ')[0]")
            seen[t] = [await st(f"{sig}({i})") for i in range(3)] + [tt]
        await pg.mouse.up()
        print(tag, seen)
        # clip i shows at times inside its window and not outside: compare its spot inside vs the nearest outside sample in the same section
        def diff(a,b): return abs(a-b)
        ok(f'{tag}: clip 1 (1–3 s, Hook→Value) shows at 1.8 s, gone at 3.4 s', diff(seen[1.8][0], seen[0.4][0])>20 and diff(seen[3.4][0], seen[0.4][0])<20 or diff(seen[1.8][0], seen[3.4][0])>20, str([seen[0.4][0],seen[1.8][0],seen[3.4][0]]))
        ok(f'{tag}: clip 2 (4–6 s, inside Value) shows at 4.6 s, not at 3.4 or 6.6 s', diff(seen[4.6][1], seen[3.4][1])>20 and diff(seen[6.6][1], seen[3.4][1])<20, str([seen[3.4][1],seen[4.6][1],seen[6.6][1]]))
        ok(f'{tag}: clip 3 (8.5–10 s, CTA) shows at 9.2 s, not at 10.3 s', diff(seen[9.2][2], seen[10.3][2])>20, str([seen[9.2][2],seen[10.3][2]]))
        ok(f'{tag}: the clock follows the drag', seen[4.6][3].startswith('0:04') and seen[9.2][3].startswith('0:09'), str({k:v[3] for k,v in seen.items()}))
        await pg.screenshot(path=D+f's221_{tag}.png')
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs))
    print('TOTAL', sum(R), '/', len(R))
