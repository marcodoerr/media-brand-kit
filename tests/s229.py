# s229 · Shortcut chips are readable in every brand; ⌘Z / ⇧⌘Z are always the editor's (never the browser's)
async def test(pg, ctx, logs):
    st = lambda e: pg.evaluate(e)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    U = 'http://127.0.0.1:8766/?debug&template'
    contrast = """(()=>{const k=document.querySelector('.v4-hint kbd, #v4-hint kbd, kbd'); if(!k||!k.offsetParent) return null;
      const p=s=>{const m=s.match(/[\\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1}};
      const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
      // composite the chip over what's behind it
      let bg=p(getComputedStyle(k).backgroundColor), el=k.parentElement, under={r:255,g:255,b:255,a:1};
      while(el){const c=p(getComputedStyle(el).backgroundColor); if(c.a>0){under=c; if(c.a>=1)break;} el=el.parentElement}
      if(under.a<1){const b=p(getComputedStyle(document.body).backgroundColor);under={r:under.r*under.a+b.r*(1-under.a),g:under.g*under.a+b.g*(1-under.a),b:under.b*under.a+b.b*(1-under.a),a:1}}
      const c={r:bg.r*bg.a+under.r*(1-bg.a),g:bg.g*bg.a+under.g*(1-bg.a),b:bg.b*bg.a+under.b*(1-bg.a)};
      const t=p(getComputedStyle(k).color); const a=L(c),b=L(t); return Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100})()"""
    for brand in ('askruth', 'moshpit', 't4r'):
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(200)
        if brand != 'askruth': await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1200)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        cr = await st(contrast)
        check(f'{brand} · shortcut chips readable (≥ 4.5 : 1)', cr is not None and cr >= 4.5, cr)
    # ⌘Z with nothing to undo: the editor takes it (default prevented) and says so
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await st("window.__kd=[];window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey)__kd.push(e.key+':'+e.defaultPrevented)})")
    await st("document.activeElement&&document.activeElement.blur()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(300)
    check('⌘Z with nothing to undo is taken by the editor', await st("__kd.slice(-1)[0]") == 'z:true', await st("__kd"))
    check('…and says “Nothing to undo”', 'Nothing to undo' in (await st("document.querySelector('#undo-toast')?.textContent||''")))
    await pg.keyboard.press('Meta+Shift+z'); await pg.wait_for_timeout(300)
    check('⇧⌘Z with nothing to redo is taken by the editor', (await st("__kd.slice(-1)[0]")).endswith(':true'), await st("__kd"))
    # a real edit that the app records for undo: remove the badge with Delete, then ⌘Z / ⇧⌘Z
    count = "__studio.state().badgeImage ? 1 : 0"
    before = await st(count)
    p = await st("(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return {x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k}})()")
    await pg.mouse.click(p['x'], p['y']); await pg.wait_for_timeout(500)
    await st("document.activeElement&&document.activeElement.blur()")
    await pg.keyboard.press('Delete'); await pg.wait_for_timeout(600)
    removed = await st(count)
    check('Delete removes the selected badge', before == 1 and removed == 0, [before, removed])
    await pg.keyboard.press('Escape'); await st("document.activeElement&&document.activeElement.blur()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(700)
    check('⌘Z brings it back', await st(count) == 1)
    await pg.keyboard.press('Meta+Shift+z'); await pg.wait_for_timeout(700)
    check('⇧⌘Z removes it again', await st(count) == 0)
    # inside a text field the browser's own undo stays
    await st("(()=>{const i=document.createElement('input');i.id='tmp-in';document.body.append(i);i.focus()})()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(200)
    check('in a text field ⌘Z is left to the field', await st("__kd.slice(-1)[0]") == 'z:false', await st("__kd.slice(-1)[0]"))
    print(f'RESULT {ok} / {n}')
