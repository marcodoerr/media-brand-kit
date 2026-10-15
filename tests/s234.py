# s234 · Luxury button style: per brand, a light-ground and a dark-ground version, chosen per button
async def test(pg, ctx, logs):
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    # colour count inside the first button's rect (canvas px)
    inbtn = """(hex)=>{const L=__studio.layout();const b=(L.buttons||[])[0];if(!b)return -1;const r=b.rect;const c=document.querySelector('#preview');const g=c.getContext('2d');
      const d=g.getImageData(Math.max(0,r.x|0),Math.max(0,r.y|0),Math.max(1,r.w|0),Math.max(1,r.h|0)).data;const R=parseInt(hex.slice(1,3),16),G=parseInt(hex.slice(3,5),16),B=parseInt(hex.slice(5,7),16);let k=0;
      for(let i=0;i<d.length;i+=8){if(Math.abs(d[i]-R)<18&&Math.abs(d[i+1]-G)<18&&Math.abs(d[i+2]-B)<18)k++}return k}"""
    LUX = {'askruth': {'dark': '#ffdafe', 'light': '#4a0649', 'lightbg': 'solid-cream'},
           'moshpit': {'dark': '#0bb8d9', 'light': '#1a1915', 'lightbg': 'mp-paper'},
           't4r': {'dark': '#03d5ff', 'light': '#0e253f', 'lightbg': 't4r-white'}}
    for brand, P in LUX.items():
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(200)
        if brand != 'askruth': await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1300)
        # the CTA section has the brand's button
        await st("document.querySelectorAll('#scenes .clip')[2]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(800)
        nb = await st("(__studio.state().buttons||[]).length")
        check(f'{brand} · the CTA section has a button', nb >= 1, nb)
        L = await st("(()=>{const b=(__studio.layout().buttons||[])[0];return b&&b.rect})()")
        c = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left,y:r.top,k:r.width/document.querySelector('#preview').width}})()")
        await pg.mouse.click(c['x'] + (L['x'] + L['w'] / 2) * c['k'], c['y'] + (L['y'] + L['h'] / 2) * c['k']); await pg.wait_for_timeout(700)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        w0 = await st("(__studio.layout().buttons||[])[0].rect.w")
        await st("document.querySelector('.btn-style [data-st=luxury]').click()"); await pg.wait_for_timeout(600)
        check(f'{brand} · Luxury is stored on the button', await st("(__studio.state().buttons[0].look||{}).style") == 'luxury')
        dark = await st(inbtn, P['dark'])
        check(f'{brand} · dark ground: the dark-ground luxury colours are drawn', dark > 30, dark)
        w1 = await st("(__studio.layout().buttons||[])[0].rect.w")
        check(f'{brand} · the luxury button is wider (arrow chip)', w1 > w0, [w0, w1])
        await pg.screenshot(path=O + f's234-{brand}-dark.png', clip={'x': 300, 'y': 70, 'width': 760, 'height': 600})
        # a light ground → the light-ground version
        await st(f"(()=>{{const s=__studio.state();s.backdrop='{P['lightbg']}';s.scenes[s.scene].bg='{P['lightbg']}';__studio.draw();}})()"); await pg.wait_for_timeout(700)
        check(f'{brand} · the ground really is light now', await st("__studio.state().scenes[__studio.state().scene].bg") == P['lightbg'])
        light = await st(inbtn, P['light'])
        check(f'{brand} · light ground: the light-ground luxury colours are drawn', light > 30, light)
        await pg.screenshot(path=O + f's234-{brand}-light.png', clip={'x': 300, 'y': 70, 'width': 760, 'height': 600})
        # back to Standard
        await st("document.querySelector('.btn-style [data-st=standard]').click()"); await pg.wait_for_timeout(500)
        check(f'{brand} · Standard brings the brand button back', await st("(__studio.state().buttons[0].look||{}).style") == 'standard' and await st("(__studio.layout().buttons||[])[0].rect.w") < w1)
    print(f'RESULT {ok} / {n}')
