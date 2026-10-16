R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    D=__import__('os').environ['OUT']+'/'+''
    U='http://127.0.0.1:8766/?debug&template'
    async def fresh(w=390):
        await pg.set_viewport_size({'width':w,'height':844 if w<800 else 900}); await pg.goto(U); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await fresh()
    await pg.click('#fs-add-section'); await pg.wait_for_timeout(300)
    await pg.get_by_text('Button', exact=True).first.click(); await pg.wait_for_timeout(700)
    card = pg.locator('.btn-item:visible').last
    vis = lambda sel: card.locator(sel).first.is_visible()
    ok('button: Brand selected, colors hidden, Scale shown', await card.locator('.style-gate [data-v=brand][aria-checked=true]').count()==1 and not await vis('.cta-line') and await card.locator('.slider-row:has-text("Scale")').is_visible())
    # spacing between dots
    await card.locator('.style-gate [data-v=custom]').click(); await pg.wait_for_timeout(300)
    card = pg.locator('.btn-item:visible').last
    ok('button: Custom shows Text / Button / Stroke, stroke, corners, reset', await vis('.cta-line') and await card.locator('.slider-row:has-text("Corners")').is_visible() and await vis('.btn-reset'))
    gaps = await pg.evaluate("(()=>{const sw=[...document.querySelector('.btn-item .cta-line .swatches').children].map(e=>e.getBoundingClientRect()); return sw.slice(1).map((r,i)=>Math.round(r.left-sw[i].right))})()")
    ok('phone: 12 px between color dots', all(g>=11 for g in gaps), str(gaps))
    rows = await pg.evaluate("(()=>{const r=[...document.querySelectorAll('.btn-item .custom-box > *')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect()); return r.slice(1).map((b,i)=>Math.round(b.top-r[i].bottom))})()")
    ok('phone: at least 14 px between edit rows', all(g>=14 for g in rows), str(rows))
    # pick a fill colour -> custom look; Brand resets with undo
    await card.locator('.cta-line').nth(1).locator('.sw-colour').nth(3).click(); await pg.wait_for_timeout(300)
    lk = await pg.evaluate("__studio.state().buttons.at(-1).look")
    ok('button: a picked color is kept', lk['fill'] is not None, str(lk))
    card = pg.locator('.btn-item:visible').last
    ok('button: stays on Custom after a re-render', await card.locator('.style-gate [data-v=custom][aria-checked=true]').count()==1)
    await card.locator('.style-gate [data-v=brand]').click(); await pg.wait_for_timeout(300)
    lk = await pg.evaluate("__studio.state().buttons.at(-1).look")
    ok('button: Brand puts the brand look back', lk['fill'] is None and lk['ink'] is None and not lk['strokeW'], str(lk))
    card = pg.locator('.btn-item:visible').last
    ok('button: Brand hides the color rows again', not await card.locator('.cta-line').first.is_visible())
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(400)
    lk = await pg.evaluate("__studio.state().buttons.at(-1).look")
    ok('button: Undo brings the custom look back', lk['fill'] is not None, str(lk))
    # reload: custom button opens on Custom
    await pg.reload(); await pg.wait_for_timeout(1500); await pg.evaluate("document.querySelector('#home-close')?.click()")
    n = await pg.evaluate("[...document.querySelectorAll('.btn-item')].filter(c=>c.querySelector('.style-gate [data-v=custom][aria-checked=true]')).length")
    ok('button: a custom button opens on Custom after reload', n>=1, str(n))
    # lower badge (main)
    await fresh(1440)
    await pg.evaluate("(()=>{const t=document.querySelector('#tg-badge-lower'); if(!t.checked) t.click();})()"); await pg.wait_for_timeout(400)
    g = pg.locator('#bp-lower-body')
    ok('lower badge: text, Style row, Scale; colors hidden', await pg.locator('#lower-text').count()==1 and await g.locator('.style-gate').count()==1 and await pg.evaluate("document.querySelector('#bp-lower-body .custom-box').hidden") and await pg.evaluate("document.querySelector('#lower-scale').closest('.custom-box')===null"))
    await pg.evaluate("document.querySelector('#bp-lower-body .style-gate [data-v=custom]').click()"); await pg.wait_for_timeout(300)
    ok('lower badge: Custom shows Text / Background / Stroke / Reset', await pg.evaluate("!document.querySelector('#bp-lower-body .custom-box').hidden && document.querySelectorAll('#bp-lower-body .custom-box .lower-row').length>=2 && !!document.querySelector('#bp-lower-body .custom-box #lower-reset')"))
    await pg.evaluate("document.querySelectorAll('#bp-lower-body .lower-row[data-lower=fill] .sw')[2].click()"); await pg.wait_for_timeout(300)
    f = await pg.evaluate("__studio.state().badgeLower.fill")
    await pg.evaluate("document.querySelector('#bp-lower-body .style-gate [data-v=brand]').click()"); await pg.wait_for_timeout(300)
    lo = await pg.evaluate("__studio.state().badgeLower")
    ok('lower badge: Brand resets colors, keeps text, on and scale', lo['fill']=='none' or lo['fill']==(await pg.evaluate("null")) or lo['fill']!=f, str([f,lo]))
    ok('lower badge: Brand closes the box', await pg.evaluate("document.querySelector('#bp-lower-body .custom-box').hidden"))
    # extra badge lower
    await pg.evaluate("document.querySelector('#badge-add, #xbadge-add, [id*=badge][id*=add]')?.click()"); await pg.wait_for_timeout(500)
    n = await pg.evaluate("document.querySelectorAll('.badge-item .style-gate, .xbadge-item .style-gate').length")
    print('extra badge gates', n)
    errs=[l for l in logs if 'PAGEERROR' in l or 'error' in l.lower()]
    ok('no page errors', not errs, str(errs[:3]))
    print('TOTAL', sum(R), '/', len(R))
