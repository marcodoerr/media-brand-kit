# s233 · Captions are in the exported video, at their times (frame check with ffmpeg)
async def test(pg, ctx, logs):
    import asyncio, os, subprocess, tempfile
    st = lambda e, *a: pg.evaluate(e, *a)
    ok = 0; n = 0
    def check(name, cond, info=''):
        nonlocal ok, n
        n += 1; ok += bool(cond)
        print(('PASS ' if cond else 'FAIL ') + name + (' · ' + str(info) if info else ''))
    got = []
    async def grab(d):
        p = os.path.join(tempfile.gettempdir(), d.suggested_filename); await d.save_as(p); got.append(p)
    pg.on('download', lambda d: asyncio.ensure_future(grab(d)))
    U = 'http://127.0.0.1:8766/?debug&template'
    await pg.goto(U); await st('localStorage.clear()'); await pg.goto(U); await pg.wait_for_timeout(1500)
    await st("document.querySelector('#home-close')?.click()"); await pg.wait_for_timeout(300)
    # one caption 1.0–4.0 s, Box style (Ask Ruth plate #4a0649), bottom
    await st("""(()=>{const s=__studio.state();s.captions={on:true,style:'box',scale:1.4,pos:'bottom',cues:[{id:'a',start:1,end:4,text:'Caption in the video'}]};})()""")
    await st("window.dispatchEvent(new Event('resize'))"); await pg.wait_for_timeout(300)
    await pg.click('#btn-export'); await pg.wait_for_timeout(500)
    await st("document.querySelector('#seg-filetype [data-kind=video]')?.click()"); await pg.wait_for_timeout(200)
    await st("(()=>{const t=document.querySelector('#tg-cover, #sheet-cover');if(t&&t.checked){t.checked=false;t.dispatchEvent(new Event('change'))}})()")
    await pg.click('#save-go')
    for _ in range(60):
        await pg.wait_for_timeout(1000)
        vids = [p for p in got if p.endswith(('.webm', '.mp4'))]
        if vids: break
    vids = [p for p in got if p.endswith(('.webm', '.mp4'))]
    check('the video exported', bool(vids), got)
    if vids:
        def plum(t):
            out = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', vids[0], '-frames:v', '1', '-vf', 'scale=108:192', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
            k = 0
            for i in range(0, len(out) - 2, 3):
                y = (i // 3) // 108
                if 120 <= y <= 165 and abs(out[i] - 0x4a) < 22 and out[i + 1] < 30 and abs(out[i + 2] - 0x49) < 22: k += 1
            return k
        a, b, c = plum(0.4), plum(2.0), plum(6.5)
        check('no caption before its start (0.4 s)', a < 20, a)
        check('the caption is in the video at 2.0 s', b > a + 60, b)
        check('…and gone after its end (6.5 s)', c < b / 3, c)
    print(f'RESULT {ok} / {n}')
