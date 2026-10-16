# v4 · section video backgrounds survive a reload (lost on every reload in v3.25)
R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    FX=os.path.abspath('fx')+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st=lambda e: pg.evaluate(e)
    snap = "(()=>{const s=__studio.state();return {shared:s.sharedBg,bgs:s.scenes.map(x=>x.bg),scene:s.scene,bd:s.backdrop}})()"
    for openAt in (2, 0, 1):
        await pg.goto(U); await st('localStorage.clear(); indexedDB.deleteDatabase("askruth-backdrop-studio")'); await pg.goto(U); await pg.wait_for_timeout(1500)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        for k in range(3):
            await st(f"document.querySelectorAll('#scenes .clip')[{k}]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(300)
            await pg.set_input_files('#file-input', FX+'vp9.webm'); await pg.wait_for_timeout(2600)
        await st(f"document.querySelectorAll('#scenes .clip')[{openAt}]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(500)
        a = await st(snap)
        for n in range(2):
            await pg.goto(U); await pg.wait_for_timeout(3000); await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(600)
        b = await st(snap)
        ok(f'open on section {openAt}: Hook clip kept after 2 reloads', a['shared']==b['shared'] and a['shared'].startswith('up_'), f'{a} {b}')
        ok(f'open on section {openAt}: section clips kept after 2 reloads', a['bgs']==b['bgs'], f'{a} {b}')
        ok(f'open on section {openAt}: the open section shows its clip', b['bd']==a['bd'], f'{a} {b}')
    # an upload that really is gone still heals to a brand background
    await st("indexedDB.deleteDatabase('askruth-backdrop-studio')"); await pg.goto(U); await pg.wait_for_timeout(3000)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(500)
    c = await st(snap)
    ok('missing uploads fall back to a brand background', not c['bd'].startswith('up_'), str(c))
    print('RESULT', sum(R), '/', len(R))
