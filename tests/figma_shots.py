# figma_shots · screenshots of the current build for the Figma "v4.4 as built" section (not a test)
async def test(pg, ctx, logs):
    import os
    st = lambda e, *a: pg.evaluate(e, *a)
    D = os.environ['SHOTS'] + '/fig-'
    async def fresh(q='', brand='askruth'):
        U = 'http://127.0.0.1:8766/?debug&template' + q
        await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1600)
        await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
        if brand != 'askruth': await pg.select_option('#brand-select', brand); await pg.wait_for_timeout(1400)
        await st("document.querySelector('#undo-toast') && (document.querySelector('#undo-toast').hidden = true)")
    async def calm():
        await pg.mouse.move(5, 890); await pg.wait_for_timeout(200)
        await st("document.querySelector('#undo-toast') && (document.querySelector('#undo-toast').hidden = true)")
    # 1 · header: icons only, hover label on Preview
    await fresh()
    await pg.hover('#btn-present'); await pg.wait_for_timeout(900)
    await pg.screenshot(path=D + '01-header-hover.png')
    # 2 · Background → Color with the Stripes row
    await calm()
    r = await st("(()=>{const r=document.querySelector('#preview').getBoundingClientRect();return {x:r.left+12,y:r.bottom-12}})()")
    await pg.mouse.click(r['x'], r['y']); await pg.wait_for_timeout(700)
    await pg.click('#bg-kinds [data-k="colour"]'); await pg.wait_for_timeout(500)
    await calm(); await pg.screenshot(path=D + '02-color-stripes.png')
    # 3 · captions panel (reel), Box style
    await fresh()
    await pg.click('#add-btn'); await pg.wait_for_timeout(400)
    await pg.get_by_role('menuitem', name='Captions').first.click(); await pg.wait_for_timeout(500)
    await pg.click('#cap-script'); await pg.fill('#cap-script-text', 'Stuck on a design call? Ask Ruth. Honest feedback in seconds. Grounded in design principles.')
    await pg.click('#cap-script-go'); await pg.wait_for_timeout(600)
    await st("document.querySelector('#cap-lines .cap-line .cap-jump').click()"); await pg.wait_for_timeout(600)
    await calm(); await pg.screenshot(path=D + '03-captions.png')
    # 4 · Home with half-size Recent cards
    U = 'http://127.0.0.1:8766/'
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await pg.select_option('#brand-select', 'moshpit'); await pg.wait_for_timeout(1300)
    await pg.wait_for_timeout(900); await pg.reload(); await pg.wait_for_timeout(2300)
    await pg.screenshot(path=D + '04-home.png')
    # 5 · Appearance: Neutral for each brand (Full = the existing screens)
    setv = "(v)=>{const r=document.querySelector('#appear-range');r.value=String(v);r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))}"
    for b in ['askruth', 'moshpit', 't4r']:
        await fresh('', b)
        await pg.click('#btn-appearance'); await pg.wait_for_timeout(300)
        await st(setv, 0); await pg.wait_for_timeout(300)
        await pg.screenshot(path=D + f'05-appearance-neutral-{b}.png')
        await st(setv, 100)
    # 6 · Presentation 16:9 (flag): editor with the Slides from text card, the dialog, the applied deck, Export → PowerPoint
    SAMPLE = open(os.path.join(os.environ['SITE'], 'tools', 'deck', 'samples', 'ask-ruth.md')).read()
    await fresh('&ff=presentation')
    await pg.click('.tb-content-btn[data-type="carousel"]'); await pg.wait_for_timeout(700)
    await pg.select_option('#tab-format-select', 'carousel:16x9'); await pg.wait_for_timeout(900)
    await calm(); await pg.keyboard.press('Escape'); await calm()
    await pg.screenshot(path=D + '06-presentation-editor.png')
    await pg.click('#deck-btn'); await pg.wait_for_timeout(300)
    await pg.fill('#deck-text', SAMPLE); await pg.click('#deck-go-preview'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=D + '07-slides-from-text.png')
    await pg.click('#deck-apply'); await pg.wait_for_timeout(900)
    await st("document.querySelectorAll('#scenes .clip')[4]?.querySelector('.frame-pick')?.click()"); await pg.wait_for_timeout(400)
    await pg.keyboard.press('Escape'); await calm()
    await pg.screenshot(path=D + '08-deck-applied.png')
    await pg.click('#btn-export'); await pg.wait_for_timeout(400)
    await pg.click('#seg-filetype [data-kind="pptx"]'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=D + '09-export-powerpoint.png')
    print('ok')
