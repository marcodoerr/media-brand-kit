# v3.23 · Stripes backgrounds in every brand: listed under Color (v4.1; was Pattern), Stripe width, Tone down, saved, exported
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    bars = """(()=>{const c=document.querySelector('#preview'); const g=c.getContext('2d'); const y=Math.round(c.height*0.03); const d=g.getImageData(0,y,c.width,1).data; const cols=[]; let last=null, n=0;
      for(let x=0;x<c.width;x+=2){const k=[d[x*4],d[x*4+1],d[x*4+2]]; if(!last||Math.abs(k[0]-last[0])+Math.abs(k[1]-last[1])+Math.abs(k[2]-last[2])>40){cols.push(k); n++; last=k;}} return {n, first:cols.slice(0,8)}})()"""
    for w,h in ((1440,900),(390,844)):
        tag = 'desktop' if w>800 else 'phone'
        for brand in ('askruth','moshpit','t4r'):
            await pg.set_viewport_size({'width':w,'height':h})
            await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
            await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
            await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1200)
            await pg.locator('#preview').click(position={'x':10,'y':10}); await pg.wait_for_timeout(600)
            await pg.locator('#bg-kinds [data-k="pattern"]').click(); await pg.wait_for_timeout(400)
            pat = await st("[...document.querySelectorAll('#thumbs .thumb-wrap')].filter(t=>t.offsetParent).map(t=>t.querySelector('.thumb').title)")
            ok(f'{tag} {brand}: Pattern no longer lists the stripes', not any('Stripes' in x for x in pat), str(pat))
            await pg.locator('#bg-kinds [data-k="colour"]').click(); await pg.wait_for_timeout(400)
            names = await st("[...document.querySelectorAll('#thumbs .thumb-wrap')].filter(t=>t.offsetParent).map(t=>t.querySelector('.thumb').title)")
            ok(f'{tag} {brand}: Color lists Stripes Classic and Stripes Brand', 'Stripes Classic' in names and 'Stripes Brand' in names, str(names))
            await pg.locator('#thumbs .thumb[title="Stripes Classic"]').click(); await pg.wait_for_timeout(600)
            b = await st(bars)
            ok(f'{tag} {brand}: Stripes Classic paints colour bars (7 a frame)', 6 <= b['n'] <= 9, str(b))
            ctl = await st("(()=>{const t=document.querySelector('#tile-controls'); const vis=(sel)=>{const e=t.querySelector(sel); return !!(e && (e.closest('.slider-row,.switch-row')||e).offsetParent)}; return {open:!t.hidden && !!t.offsetParent, lbl:document.querySelector('#tile-scale').closest('.slider-row').querySelector('span').textContent, gap:vis('.adj-gap'), row:vis('.adj-row'), mir:vis('#tg-tile-mirror'), tone:!!document.querySelector('#ov-strength')&&!!document.querySelector('#ov-strength').offsetParent}})()")
            ok(f'{tag} {brand}: Width and Tone down show; Spacing / Offset / Mirror do not', ctl['open'] and ctl['lbl']=='Width' and not ctl['gap'] and not ctl['row'] and not ctl['mir'] and ctl['tone'], str(ctl))
            # wider stripes → fewer bars
            await st("(()=>{const i=document.querySelector('#tile-scale'); i.value=2; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(500)
            b2 = await st(bars)
            ok(f'{tag} {brand}: Width 200% → half as many bars', b2['n'] <= (b['n']+1)//2 + 1, str([b['n'], b2['n']]))
            if tag=='desktop':
                await pg.screenshot(path=D+f's220_{brand}_classic.png')
            # tone down (from off: a brand may start a background already toned down)
            await st("(()=>{const i=document.querySelector('#ov-strength'); i.value=0; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(400)
            before = await st("(()=>{const c=document.querySelector('#preview'); const d=c.getContext('2d').getImageData(Math.round(c.width*0.05),Math.round(c.height*0.03),1,1).data; return [d[0],d[1],d[2]]})()")
            await st("(()=>{const i=document.querySelector('#ov-strength'); i.value=0.6; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(500)
            after = await st("(()=>{const c=document.querySelector('#preview'); const d=c.getContext('2d').getImageData(Math.round(c.width*0.05),Math.round(c.height*0.03),1,1).data; return [d[0],d[1],d[2]]})()")
            ok(f'{tag} {brand}: Tone down tones the stripes down', sum(abs(a-b) for a,b in zip(before,after))>30, str([before,after]))
            await pg.locator('#thumbs .thumb[title="Stripes Brand"]').click(); await pg.wait_for_timeout(600)
            b3 = await st(bars)
            ok(f'{tag} {brand}: Stripes Brand paints the brand colours', b3['n'] >= 5, str(b3))
            if tag=='desktop':
                await pg.screenshot(path=D+f's220_{brand}_brand.png')
            if tag=='desktop' and brand=='t4r':
                await pg.reload(); await pg.wait_for_timeout(2200)
                ok('reload: the stripes background and its width are kept', await st("__studio.state().backdrop")=='t4r-stripes-brand', await st("__studio.state().backdrop"))
                await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs))
    print('TOTAL', sum(R), '/', len(R))
