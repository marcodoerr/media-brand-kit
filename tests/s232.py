# s232 · Captions for reels: add, paste a script, import .srt, styles / size / position, drawn on the canvas, undo, reload
async def test(pg, ctx, logs):
    import os, tempfile
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/?debug&template'
    # pixels in a horizontal band of the canvas that match a colour (± tolerance)
    band = """([y0,y1,hex])=>{const c=document.querySelector('#preview');const g=c.getContext('2d');const Y0=Math.round(c.height*y0),Y1=Math.round(c.height*y1);
      const d=g.getImageData(0,Y0,c.width,Y1-Y0).data;const r=parseInt(hex.slice(1,3),16),gg=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);let k=0;
      for(let i=0;i<d.length;i+=16){if(Math.abs(d[i]-r)<14&&Math.abs(d[i+1]-gg)<14&&Math.abs(d[i+2]-b)<14)k++}return k}"""
    white = """([y0,y1])=>{const c=document.querySelector('#preview');const g=c.getContext('2d');const Y0=Math.round(c.height*y0),Y1=Math.round(c.height*y1);
      const d=g.getImageData(0,Y0,c.width,Y1-Y0).data;let k=0;for(let i=0;i<d.length;i+=16){if(d[i]>245&&d[i+1]>245&&d[i+2]>245)k++}return k}"""
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    total = await st("(()=>{let t=0;for(const s of __studio.state().scenes||[])t+=0;return 0})()")
    # 1 · from the Add menu
    await pg.click('#add-btn'); await pg.wait_for_timeout(400)
    has = await st("[...document.querySelectorAll('[role=menu] [role=menuitem]')].some(m=>/Captions/.test(m.textContent))")
    check('Add menu offers Captions on a reel', has)
    await pg.get_by_role('menuitem', name='Captions').first.click(); await pg.wait_for_timeout(500)
    check('the Captions panel opens', await st("!document.querySelector('#cap-pop').hidden"))
    before_plate = await st(band, [0.62, 0.82, '#4a0649'])
    # 2 · paste a script
    await pg.click('#cap-script'); await pg.fill('#cap-script-text', 'Stuck on a design call? Ask Ruth. Honest feedback in seconds. Grounded in design principles.')
    await pg.click('#cap-script-go'); await pg.wait_for_timeout(600)
    cues = await st("__studio.state().captions.cues")
    check('a script becomes 4 timed lines', len(cues) == 4, [(c['start'], c['end'], c['text'][:12]) for c in cues])
    check('…spread over the whole reel, in order', cues[0]['start'] == 0 and all(cues[i]['end'] <= cues[i + 1]['start'] + 0.11 for i in range(3)))
    check('…all four listed in the panel', await st("document.querySelectorAll('#cap-lines .cap-line').length") == 4)
    # 3 · drawn on the canvas at the playhead (Box style = the brand plate, plum for Ask Ruth)
    await st("document.querySelector('#cap-lines .cap-line .cap-jump').click()"); await pg.wait_for_timeout(600)
    after_plate = await st(band, [0.62, 0.82, '#4a0649'])
    check('Box: the caption plate is drawn near the bottom', after_plate > before_plate + 40, [before_plate, after_plate])
    await pg.screenshot(path=O + 's232-box.png')
    # position: top moves it up
    await pg.click('#cap-pos button[data-p="top"]'); await pg.wait_for_timeout(400)
    check('Top moves it to the top band', await st(band, [0.1, 0.3, '#4a0649']) > 40 and await st(band, [0.62, 0.82, '#4a0649']) <= before_plate + 10)
    await pg.click('#cap-pos button[data-p="bottom"]'); await pg.wait_for_timeout(400)
    # size: bigger plate
    small = await st(band, [0.6, 0.85, '#4a0649'])
    await st("(()=>{const r=document.querySelector('#cap-size');r.value='1.6';r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()"); await pg.wait_for_timeout(400)
    big = await st(band, [0.6, 0.85, '#4a0649'])
    check('Size 160 % draws a bigger caption', big > small * 1.3, [small, big])
    # styles: Clean = white type, Highlight = the brand button colour (Ask Ruth pink)
    await pg.click('#cap-styles button[data-s="clean"]'); await pg.wait_for_timeout(400)
    check('Clean: white type, no plate', await st(white, [0.6, 0.85]) > 30 and await st(band, [0.6, 0.85, '#4a0649']) <= before_plate + 10)
    await pg.click('#cap-styles button[data-s="highlight"]'); await pg.wait_for_timeout(400)
    check('Highlight: bars in the brand button colour', await st(band, [0.6, 0.85, '#ff8eff']) > 60)
    await pg.screenshot(path=O + 's232-highlight.png')
    await pg.click('#cap-styles button[data-s="bold"]'); await pg.wait_for_timeout(400)
    check('Bold: white type with the plate as outline', await st(white, [0.6, 0.85]) > 30 and await st(band, [0.6, 0.85, '#4a0649']) > 20)
    await pg.screenshot(path=O + 's232-bold.png')
    # off hides it
    await pg.click('label.cap-on'); await pg.wait_for_timeout(400)
    check('switching captions off hides them', await st(white, [0.6, 0.85]) <= 30 or await st(band, [0.6, 0.85, '#4a0649']) <= before_plate + 10)
    await pg.click('label.cap-on'); await pg.wait_for_timeout(300)
    # 4 · undo the last change (back to on? no — undo style change chain): ⌘Z restores the previous style
    await st("document.activeElement&&document.activeElement.blur()")
    await pg.wait_for_timeout(600)
    sty = await st("__studio.state().captions.style")
    await pg.click('#cap-styles button[data-s="box"]'); await pg.wait_for_timeout(900)
    await st("document.activeElement&&document.activeElement.blur()")
    await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(900)
    check('⌘Z undoes a caption style change', await st("__studio.state().captions.style") == sty, await st("__studio.state().captions.style"))
    # 5 · import an .srt
    srt = "1\n00:00:00,500 --> 00:00:02,000\nFirst line\n\n2\n00:00:02,000 --> 00:00:04,250\nSecond <i>line</i>\n\n3\n00:00:04,250 --> 00:00:06,000\nThird\n"
    f = os.path.join(tempfile.gettempdir(), 'cap-test.srt'); open(f, 'w').write(srt)
    await pg.set_input_files('#cap-file', f); await pg.wait_for_timeout(700)
    cues = await st("__studio.state().captions.cues")
    check('.srt import: 3 lines with their times, tags removed', len(cues) == 3 and cues[0]['start'] == 0.5 and cues[1]['end'] == 4.25 and cues[1]['text'] == 'Second line', cues)
    vtt = "WEBVTT\n\n00:00.000 --> 00:01.500\nHello\n\n00:01.500 --> 00:03.000 align:center\nWorld\n"
    f2 = os.path.join(tempfile.gettempdir(), 'cap-test.vtt'); open(f2, 'w').write(vtt)
    await pg.set_input_files('#cap-file', f2); await pg.wait_for_timeout(700)
    check('.vtt import works too', await st("__studio.state().captions.cues.map(c=>c.text).join('|')") == 'Hello|World')
    async with pg.expect_download() as dl: await pg.click('#cap-download')
    d = await dl.value; body = open(await d.path()).read()
    check('Download .srt writes the lines', '00:00:01,500 --> 00:00:03,000' in body and 'World' in body, body[:80])
    # 6 · edit a line's text in place
    await pg.fill('#cap-lines .cap-line:nth-child(1) .cap-text', 'Hello there'); await pg.locator('#cap-lines .cap-line:nth-child(1) .cap-text').press('Tab'); await pg.wait_for_timeout(500)
    # 7 · reload keeps them
    await pg.wait_for_timeout(800); await pg.reload(); await pg.wait_for_timeout(2500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    check('captions survive a reload', await st("(__studio.state().captions||{}).cues?.length") == 2)
    # 8 · not for carousels
    await pg.click('.tb-content-btn[data-type="carousel"]'); await pg.wait_for_timeout(900)
    await pg.click('#add-btn'); await pg.wait_for_timeout(400)
    check('carousels have no Captions in Add', not await st("[...document.querySelectorAll('[role=menu] [role=menuitem]')].some(m=>/Captions/.test(m.textContent))"))
    print(f'RESULT {ok} / {n}')
