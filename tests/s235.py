# s235 · Home: Recent and Saved cards at half size; the format chip is a small label
async def test(pg, ctx, logs):
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    O = __import__('os').environ['SHOTS'] + '/'
    U = 'http://127.0.0.1:8766/'
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    await pg.select_option('#brand-select', 'moshpit'); await pg.wait_for_timeout(1300)
    await pg.wait_for_timeout(900); await pg.reload(); await pg.wait_for_timeout(2200)
    vis = await st("!document.querySelector('#home').hidden && !document.querySelector('#home-recent').hidden")
    check('Home shows Recent', vis)
    w = await st("(()=>{const c=document.querySelector('#home-recent-list .home-card, #home-recent-list .home-tile');return c?c.getBoundingClientRect().width:0})()")
    check('a Recent card is half the old width (84 px, was 168)', 80 <= w <= 88, w)
    kh = await st("(()=>{const k=document.querySelector('#home-recent-list .home-kind');return k?k.getBoundingClientRect().height:0})()")
    check('the format chip is a small label, not a 44 px button', 0 < kh < 22, kh)
    over = await st("[...document.querySelectorAll('#home-recent-list .home-card')].some(c=>c.scrollWidth>c.clientWidth+1)")
    check('nothing spills out of a card', not over)
    await pg.screenshot(path=O + 's235-home.png', clip={'x': 0, 'y': 0, 'width': 1200, 'height': 700})
    await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(500)
    w2 = await st("(()=>{const c=document.querySelector('#home-recent-list .home-card, #home-recent-list .home-tile');return c?c.getBoundingClientRect().width:0})()")
    check('phone: cards are small too', 70 <= w2 <= 88, w2)
    await pg.screenshot(path=O + 's235-home-phone.png')
    print(f'RESULT {ok} / {n}')
