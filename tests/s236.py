# s236 · Appearance · Interface color: Neutral ↔ Full brand color, editor chrome only
async def test(pg, ctx, logs):
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    tok = "(t)=>getComputedStyle(document.documentElement).getPropertyValue(t).trim()"
    # OKLCH chroma of a token's (first) colour
    chroma = """(t)=>{const v=getComputedStyle(document.documentElement).getPropertyValue(t).trim();const m=v.match(/#([0-9a-f]{6})/i)||null;let r,g,b;
      if(m){r=parseInt(m[1].slice(0,2),16);g=parseInt(m[1].slice(2,4),16);b=parseInt(m[1].slice(4,6),16)}else{const q=v.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)/);if(!q)return -1;r=+q[1];g=+q[2];b=+q[3]}
      const L=c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4};const R=L(r),G=L(g),B=L(b);
      const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B),mm=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B),s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);
      const Ll=0.2104542553*l+0.793617785*mm-0.0040720468*s,a=1.9779984951*l-2.428592205*mm+0.4505937099*s,bb=0.0259040371*l+0.7827717662*mm-0.808675766*s;return [Ll,Math.hypot(a,bb)]}"""
    canvasSig = "(()=>{const c=document.querySelector('#preview');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])>>>0;return h})()"
    setv = "(v)=>{const r=document.querySelector('#appear-range');r.value=String(v);r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))}"
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    check('one Appearance button in the header', await st("document.querySelectorAll('.topbar #btn-appearance').length") == 1)
    check('…no slider sits in the header itself', await st("!document.querySelector('.topbar input[type=range]')"))
    check('default is Full brand color: no overrides', await st("!document.documentElement.style.getPropertyValue('--accent')"))
    for brand in ['askruth', 'moshpit', 't4r']:
        if brand != 'askruth':
            await st(setv, 100); await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1300)
        orig = {t: await st(tok, t) for t in ['--accent', '--ui-bg', '--active', '--focus', '--error', '--surface-alt']}
        c0 = await st(chroma, '--accent'); bg0 = await st(chroma, '--ui-bg')
        sig0 = await st(canvasSig); snap0 = await st("JSON.stringify(__studio.state())")
        proj0 = await st("localStorage.getItem('askruth.backdrop-studio.v2')")
        undo0 = await st("!!document.querySelector('.topbar [data-hist=undo]')?.disabled")
        await pg.click('#btn-appearance'); await pg.wait_for_timeout(250)
        check(f'{brand} · the Appearance dropdown opens', await st("!document.querySelector('#appear-pop').hidden"))
        await st(setv, 0); await pg.wait_for_timeout(250)
        cN = await st(chroma, '--accent'); bgN = await st(chroma, '--ui-bg')
        check(f'{brand} · Neutral: the accent has (almost) no colour', cN[1] < 0.01, [round(c0[1], 3), round(cN[1], 3)])
        check(f'{brand} · Neutral: surfaces keep their lightness (dark stays dark, light stays light)', abs(bgN[0] - bg0[0]) < 0.02 and bgN[1] < 0.01, [round(bg0[0], 3), round(bgN[0], 3)])
        aud = await st("import('./js/v4/appearance.js').then(m=>m.appearanceAudit())")
        bad = [a for a in aud if not a['ok']]
        check(f'{brand} · Neutral: every text/background pair is still readable', len(aud) >= 6 and not bad, bad or len(aud))
        check(f'{brand} · focus, errors and the preview ground are untouched', all([await st(tok, t) == orig[t] for t in ['--focus', '--error', '--surface-alt']]))
        check(f'{brand} · selection cues keep the full brand colour', await st(tok, '--ov-active') == orig['--active'])
        check(f'{brand} · the canvas is not repainted differently', await st(canvasSig) == sig0)
        check(f'{brand} · the design is not changed, saved or put in Undo', await st("JSON.stringify(__studio.state())") == snap0 and await st("localStorage.getItem('askruth.backdrop-studio.v2')") == proj0 and await st("!!document.querySelector('.topbar [data-hist=undo]')?.disabled") == undo0)
        await pg.screenshot(path=O + f's236-{brand}-neutral.png')
        await st(setv, 50); await pg.wait_for_timeout(200)
        cM = await st(chroma, '--accent')
        check(f'{brand} · midpoint: in between', cN[1] < cM[1] < c0[1], [round(cM[1], 3)])
        await pg.screenshot(path=O + f's236-{brand}-mid.png')
        await st(setv, 100); await pg.wait_for_timeout(200)
        check(f'{brand} · Full brand color: exactly the original tokens', all([await st(tok, t) == orig[t] for t in orig]) and await st("!document.documentElement.style.getPropertyValue('--accent')"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # keyboard, persistence, brand switch
    await pg.click('#btn-appearance'); await pg.wait_for_timeout(200)
    check('the slider has a name and a spoken value', await st("(()=>{const r=document.querySelector('#appear-range');return !!document.querySelector('label[for=appear-range]') && r.getAttribute('aria-valuetext')==='Full brand color'})()"))
    for _ in range(4): await pg.keyboard.press('ArrowLeft')
    await pg.wait_for_timeout(200)
    v = await st("+document.querySelector('#appear-range').value")
    check('arrow keys move it (focus lands on the slider)', v == 80, v)
    await pg.keyboard.press('Home'); await pg.wait_for_timeout(300)
    check('Home → Neutral', await st("document.querySelector('#appear-range').getAttribute('aria-valuetext')") == 'Neutral')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    check('Escape closes it and focus goes back to the button', await st("document.querySelector('#appear-pop').hidden && document.activeElement.id==='btn-appearance'"))
    await pg.select_option('#brand-select', 'moshpit'); await pg.wait_for_timeout(1300)
    check('it stays Neutral after a brand switch', (await st(chroma, '--accent'))[1] < 0.01)
    await pg.reload(); await pg.wait_for_timeout(2200)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    check('…and after a reload', (await st(chroma, '--accent'))[1] < 0.01 and await st("localStorage.getItem('askruth.backdrop-studio.ui-colour')") == '0')
    # full screen editing: the bar follows the setting, the canvas doesn't
    await pg.click('#fs-open'); await pg.wait_for_timeout(700)
    await pg.screenshot(path=O + 's236-fs-neutral.png')
    check('full screen is muted too', await st("document.documentElement.classList.contains('is-fs')") and (await st(chroma, '--active'))[1] < 0.01)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    # Reset
    await pg.click('#btn-appearance'); await pg.wait_for_timeout(200)
    await pg.click('#appear-reset'); await pg.wait_for_timeout(200)
    check('Reset brings full brand color back and forgets the setting', await st("!document.documentElement.style.getPropertyValue('--accent')") and await st("localStorage.getItem('askruth.backdrop-studio.ui-colour')") is None)
    await pg.keyboard.press('Escape')
    # phone
    await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(500)
    vis = await st("(()=>{const b=document.querySelector('#btn-appearance');const r=b.getBoundingClientRect();return getComputedStyle(b).display!=='none'&&r.width>0})()")
    if vis:
        await pg.click('#btn-appearance'); await pg.wait_for_timeout(300)
        await st(setv, 0); await pg.wait_for_timeout(200)
        r = await st("(()=>{const r=document.querySelector('#appear-pop').getBoundingClientRect();return [r.left,r.right,r.bottom,innerWidth,innerHeight]})()")
        check('phone: the dropdown is a sheet on screen', r[0] >= -1 and r[1] <= r[3] + 1 and r[2] <= r[4] + 1, r)
        await pg.screenshot(path=O + 's236-phone-neutral.png')
    else:
        check('phone: Appearance is reachable', False, 'button hidden on phone')
    print(f'RESULT {ok} / {n}')
