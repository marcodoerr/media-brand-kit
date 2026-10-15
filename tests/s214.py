R=[]
def ok(n,c,x=''): c=bool(c); R.append(c); print(('PASS ' if c else 'FAIL ')+n, '' if c else x)
async def test(pg, ctx, logs):
    import os
    D=os.environ['OUT']+'/'
    U='http://127.0.0.1:8766/?debug&template'
    st = lambda e: pg.evaluate(e)
    await pg.set_viewport_size({'width':1440,'height':900})
    await pg.goto(U); await pg.evaluate('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
    await pg.evaluate("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    chooser = []
    pg.on('filechooser', lambda fc: chooser.append(fc))
    await pg.click('#tl-overlay .ov-add'); await pg.wait_for_timeout(400)
    kinds = await st("[...document.querySelectorAll('#clip-menu .clip-menu-item span')].map(s=>s.textContent)")
    ok('the row button opens the same choice as + → Overlay clip', kinds[:5]==['Video or picture','Text','Badge','Cogent','Drawing'], str(kinds))
    ok('…not the file picker', not chooser)
    await pg.screenshot(path=D+'s214_menu.png')
    await pg.locator('#clip-menu .clip-menu-item', has_text='Text').first.click(); await pg.wait_for_timeout(500)
    ok('Text from there makes a text clip', [o['kind'] for o in await st("__studio.state().overlays")]==['text'])
    # the small + after the last clip does the same
    await pg.click('#tl-overlay .ov-add.is-small'); await pg.wait_for_timeout(400)
    ok('the small + after a clip opens it too', await pg.locator('#clip-menu .clip-menu-item', has_text='Cogent').count()==1)
    await pg.click('#tl-overlay .ov-add.is-small'); await pg.wait_for_timeout(300)
    ok('tapping it again closes it', await pg.locator('#clip-menu').is_hidden())
    async with pg.expect_file_chooser() as fc:
        await pg.click('#tl-overlay .ov-add.is-small'); await pg.wait_for_timeout(300)
        await pg.locator('#clip-menu .clip-menu-item', has_text='Video or picture').first.click()
    await (await fc.value).set_files(D+'ov6.webm'); await pg.wait_for_timeout(1500)
    ok('Video or picture still picks a file', [o['kind'] for o in await st("__studio.state().overlays")]==['text','media'])
    print('TOTAL', sum(R), '/', len(R))
