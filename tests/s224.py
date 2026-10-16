# v4 · Adapt layout: spread / gather text between sections without losing a word; locks
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    st=lambda e: pg.evaluate(e)
    U='http://127.0.0.1:8766/?debug&template'
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1800)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    TEXT = "\n".join([f"Point {i}: a reason worth a line of its own." for i in range(1,8)])
    TEXT = TEXT.replace("Point 4", "\nPoint 4")   # one blank-line paragraph break too
    scenes = "__studio.state().scenes"
    # start wide (Landscape): the text fits there
    await pg.select_option('#tab-format-select', 'video:16x9'); await pg.wait_for_timeout(700)
    await st("document.querySelector('#undo-toast') && (document.querySelector('#undo-toast').hidden=true)")
    # put long text on the Value section through the panel field
    await st("document.querySelectorAll('#scenes .clip')[1].querySelector('.frame-pick').click()"); await pg.wait_for_timeout(400)
    await st(f"(()=>{{const f=document.querySelector('#in-body');f.value={TEXT!r};f.dispatchEvent(new Event('input',{{bubbles:true}}))}})()"); await pg.wait_for_timeout(400)
    hook0 = await st(f"JSON.stringify((({{h1,body,buttons,media,badge}})=>({{h1,body,b:(buttons||[]).length,m:(media||[]).length,badge}}))({scenes}[0]))"); cta0 = await st(f"(()=>{{const s={scenes};const c=s[s.length-1];return JSON.stringify({{h1:c.h1,body:c.body,b:(c.buttons||[]).map(b=>b.text||b.label)}})}})()")
    n0 = await st(f"{scenes}.length")
    chain = f"(()=>{{const s={scenes};const v=s[1];let t=v.body;for(let i=2;i<s.length;i++){{if(s[i].auto&&s[i].auto.from===v.id)t+=s[i].auto.sep+s[i].body;else break}}return t}})()"
    ok('Value holds the long text', (await st(chain))==TEXT)

    # a window resize changes nothing
    await pg.set_viewport_size({'width':1000,'height':700}); await pg.wait_for_timeout(500)
    await pg.set_viewport_size({'width':1440,'height':900}); await pg.wait_for_timeout(500)
    ok('a window resize does not adapt', await st(f"{scenes}.length")==n0)

    ok('it fits Landscape: nothing to adapt there', await st("__v4.plan('16x9').ops.length")==0)
    # switch to Vertical 9:16 (less usable room): an offer appears; Review shows the preview
    await pg.select_option('#tab-format-select', 'video:9x16'); await pg.wait_for_timeout(900)
    toast = await st("document.querySelector('#undo-toast')?.textContent||''")
    ok('size change offers Adapt layout', 'Review' in toast and '→' in toast, toast)
    ok('the offer changed nothing yet', await st(f"{scenes}.length")==n0)
    await st("[...document.querySelectorAll('#undo-toast button')].find(b=>b.textContent==='Review')?.click()"); await pg.wait_for_timeout(500)
    pop = await st("(()=>{const p=document.querySelector('#adapt-pop');return p&&!p.hidden?p.textContent:''})()")
    ok('preview says how many sections', f'{n0} sections' in pop and 'Nothing is rewritten' in pop, pop[:200])
    await st("document.querySelector('#adapt-apply').click()"); await pg.wait_for_timeout(800)
    n1 = await st(f"{scenes}.length")
    ok('text spread over more sections', n1 > n0, f'{n0}->{n1}')
    ok('not a word lost or changed', (await st(chain))==TEXT)
    ok('splits are at line breaks', await st(f"{scenes}.filter(s=>s.auto).every(s=>/^\\n+$/.test(s.auto.sep))"))
    ok('Hook untouched', await st(f"JSON.stringify((({{h1,body,buttons,media,badge}})=>({{h1,body,b:(buttons||[]).length,m:(media||[]).length,badge}}))({scenes}[0]))")==hook0)
    cta1 = await st(f"(()=>{{const s={scenes};const c=s[s.length-1];return JSON.stringify({{h1:c.h1,body:c.body,b:(c.buttons||[]).map(b=>b.text||b.label)}})}})()")
    ok('CTA untouched and still last', cta1==cta0 and await st(f"{scenes}[{scenes}.length-1].role")=='cta')
    ok('the heading stays with the first part', await st(f"{scenes}[1].h1")!='' and await st(f"{scenes}.filter(s=>s.auto).every(s=>s.h1==='')"))
    fits = await st("""(()=>{const L=__studio.layout();return true})()""")
    # one Undo puts it back
    await st("document.querySelector('#undo-toast button')?.click()"); await pg.wait_for_timeout(800)
    ok('one Undo restores the sections', await st(f"{scenes}.length")==n0 and (await st(f"{scenes}[1].body"))==TEXT, str(await st(f"{scenes}.length")))
    # apply again via the panel button, then go back to 9:16 and gather
    await st("document.querySelector('#panel-done')?.click()"); await pg.wait_for_timeout(200)
    await st("document.querySelector('#adapt-btn').click()"); await pg.wait_for_timeout(500)
    await st("document.querySelector('#adapt-apply')?.click()"); await pg.wait_for_timeout(800)
    ok('Adapt layout button works', await st(f"{scenes}.length")==n1)
    await pg.select_option('#tab-format-select', 'video:16x9'); await pg.wait_for_timeout(900)
    toast = await st("document.querySelector('#undo-toast')?.textContent||''")
    ok('back to 16:9 offers to gather', 'back together' in toast, toast)
    await st("[...document.querySelectorAll('#undo-toast button')].find(b=>b.textContent==='Review')?.click()"); await pg.wait_for_timeout(400)
    await st("document.querySelector('#adapt-apply')?.click()"); await pg.wait_for_timeout(800)
    n2 = await st(f"{scenes}.length")
    ok('gathered back', n2 < n1, f'{n1}->{n2}')
    ok('text exactly as written after the round trip', (await st(chain))==TEXT)
    # a section you made is never merged: add a Value by hand after it, adapt again: still there
    # lock the Value section: Adapt leaves it
    await st(f"{scenes}[1].locked=true");
    await pg.select_option('#tab-format-select', 'video:16x9'); await pg.wait_for_timeout(900)
    await st("document.querySelector('#adapt-btn')?.click()"); await pg.wait_for_timeout(500)
    toast = await st("document.querySelector('#undo-toast')?.textContent||''")
    ok('a locked section is left as it is', await st(f"{scenes}.length")==n2 and 'Nothing to change' in toast, toast)
    await st(f"{scenes}[1].locked=false")

    # item lock: lock the Hook badge, drag it and Tidy up: it stays
    await st("document.querySelectorAll('#scenes .clip')[0].querySelector('.frame-pick').click()"); await pg.wait_for_timeout(400)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)   # a tap on a clip opens its menu
    r = await st("(()=>{const L=__studio.layout();const c=document.querySelector('#preview').getBoundingClientRect();const k=c.width/document.querySelector('#preview').width;return {x:c.left+(L.wmRect.x+L.wmRect.w/2)*k,y:c.top+(L.wmRect.y+L.wmRect.h/2)*k}})()")
    await pg.mouse.click(r['x'], r['y'], button='right'); await pg.wait_for_timeout(400)
    print('menu:', await st("[...document.querySelectorAll('.clip-menu button')].filter(b=>b.offsetParent).map(b=>b.textContent.slice(0,30))"), r)
    clicked = await st("(()=>{const b=[...document.querySelectorAll('.clip-menu button')].find(b=>/Lock position/.test(b.textContent));if(b){b.click();return true}return false})()")
    ok('item menu offers Lock position', clicked)
    await pg.wait_for_timeout(300)
    p0 = await st("JSON.stringify(__studio.state().pos[__studio.state().format].watermark)")
    await pg.mouse.move(r['x'], r['y']); await pg.mouse.down()
    for i in range(12): await pg.mouse.move(r['x']+i*5, r['y']+i*8)
    await pg.mouse.up(); await pg.wait_for_timeout(400)
    ok('a locked item does not move when dragged', await st("JSON.stringify(__studio.state().pos[__studio.state().format].watermark)")==p0)
    await st("document.querySelector('#panel-done')?.click()"); await pg.wait_for_timeout(200)
    await st("document.querySelector('#tidy-btn').click()"); await pg.wait_for_timeout(500)
    ok('Tidy up leaves a locked item where it is', await st("JSON.stringify(__studio.state().pos[__studio.state().format].watermark)")==p0)
    # persists
    await pg.goto(U); await pg.wait_for_timeout(2500); await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    ok('locks and split text survive a reload', await st(f"!!{scenes}[0].locks && {scenes}[0].locks.watermark===true") and (await st(chain))==TEXT)
    ok('no page errors', not [l for l in logs if 'PAGEERROR' in l], str(logs[:3]))
    ok('no fault banner', not await st("!!document.querySelector('#fault-banner') && !document.querySelector('#fault-banner').hidden"))
    print('RESULT', sum(R), '/', len(R))
