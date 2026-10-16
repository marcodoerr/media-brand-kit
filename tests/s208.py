R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    D=__import__('os').environ['OUT']+'/'+''
    U='http://127.0.0.1:8766/?debug&template'
    G="""(id=>{const e=document.getElementById(id); if(!e||!e.offsetParent) return null; const b=e.getBoundingClientRect(); return [b.left,b.right,b.top,b.bottom]})"""
    # phone
    await pg.set_viewport_size({'width':390,'height':844}); await pg.goto(U); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    a,p,s,sc=[await pg.evaluate(G+f"('{i}')") for i in ('fs-add-section','fs-preview','fs-surface','fs-scope')]
    # Release 1: Undo / Redo sit between + and Preview; the group ends at the right edge, nothing off-screen
    ok('phone: + · Preview · Light/Dark in that order, right-aligned, on screen', a and p and s and a[1]<=p[0] and p[1]<=s[0] and abs(s[1]-378)<2, str([a,p,s]))
    ok('phone: section name stays on the left', sc and sc[0]<20, str(sc))
    ok('phone: nothing in the top bars runs off the screen', await pg.evaluate("[...document.querySelectorAll('.topbar button, .topbar select, .fs-bar button')].filter(e=>e.offsetParent).every(e=>{const r=e.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth+0.5})"))
    ok('phone: same row', abs(a[2]-s[2])<2 and abs(a[2]-sc[2])<6)
    await pg.click('#fs-add-section'); await pg.wait_for_timeout(300)
    m = await pg.evaluate("(()=>{const m=[...document.querySelectorAll('[role=menu], .clip-menu, .menu, [class*=menu]')].find(e=>e.offsetParent); if(!m) return null; const b=m.getBoundingClientRect(); return [b.left,b.right,b.top, m.innerText.slice(0,60)]})()")
    ok('phone: + opens the Add menu on screen', m and m[0]>=0 and m[1]<=390 and 'Background' in m[3], str(m))
    await pg.screenshot(path=D+'s208_phone_add.png')
    await pg.mouse.click(200, 800); await pg.wait_for_timeout(300)
    await pg.click('#fs-preview'); await pg.wait_for_timeout(400)
    ok('phone preview: + hidden', (await pg.evaluate(G+"('fs-add-section')")) is None)
    ok('phone preview: no sideways scroll', await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    await pg.click('#fs-preview'); await pg.wait_for_timeout(400)
    ok('phone back to edit: + back', (await pg.evaluate(G+"('fs-add-section')")) is not None)
    # resize to desktop: + goes back to nav
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.wait_for_timeout(500)
    ok('desktop: + back beside the section arrows', await pg.evaluate("document.querySelector('#fs-add-section').parentElement.classList.contains('fs-nav')"))
    # desktop text style labels
    await pg.goto(U); await pg.wait_for_timeout(1500); await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    labels = await pg.evaluate("[...document.querySelectorAll('#seg-tone button')].map(b=>b.dataset.t+':'+b.textContent.trim())")
    ok('Style reads Light (dark type) · Dark (light type) · Custom', labels==['dark:Light','light:Dark','custom:Custom'], str(labels))
    # click Light → textTone dark
    await pg.evaluate("document.querySelector('#seg-tone button[data-t=dark]').click()"); await pg.wait_for_timeout(300)
    t = await pg.evaluate("window.__studio.state().textTone")
    on = await pg.evaluate("document.querySelector('#seg-tone [aria-checked=true]')?.textContent.trim()")
    ok('Light picks dark type and shows as selected', t=='dark' and on=='Light', str([t,on]))
    await pg.evaluate("document.querySelector('#seg-tone button[data-t=light]').click()"); await pg.wait_for_timeout(300)
    t = await pg.evaluate("window.__studio.state().textTone"); on = await pg.evaluate("document.querySelector('#seg-tone [aria-checked=true]')?.textContent.trim()")
    ok('Dark picks light type and shows as selected', t=='light' and on=='Dark', str([t,on]))
    print('TOTAL', sum(R), '/', len(R))
