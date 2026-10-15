import os, asyncio, threading, functools, http.server, socketserver, sys, json
HERE=os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault('OUT', os.path.join(HERE, 'out'))           # files a test writes
os.environ.setdefault('SHOTS', os.environ['OUT'])                  # screenshots
os.environ.setdefault('TESTS', HERE)
os.environ.setdefault('SITE', os.path.abspath(os.path.join(HERE, '..')))   # the app = this repo
os.makedirs(os.environ['OUT'], exist_ok=True)
ROOT=os.environ['SITE']
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve():
    h=functools.partial(Q, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address=True
    s=socketserver.ThreadingTCPServer(('127.0.0.1',8766),h); s.serve_forever()
threading.Thread(target=serve,daemon=True).start()
from playwright.async_api import async_playwright
async def run(script):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=[a for a in os.environ.get('PWARGS','').split() if a])
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        pg = await ctx.new_page()
        FP=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fontpkg', 'node_modules', '@fontsource') + '/'
        css=''
        for fam,ws in (('Bitter',(400,500,600,700)),('Poppins',(400,500,600,700,800)),('Roboto',(900,))):
            for w in ws: css+="@font-face{font-family:'%s';font-weight:%d;font-style:normal;font-display:block;src:url(https://fontfiles.test/%s/%s-latin-%d-normal.woff2) format('woff2');}\n"%(fam,w,fam.lower(),fam.lower(),w)
        async def gcss(route): await route.fulfill(status=200, content_type='text/css', body=css)
        async def gfile(route):
            parts=route.request.url.split('/')
            try: body=open(FP+parts[-2]+'/files/'+parts[-1],'rb').read()
            except OSError:   # fonts not installed: run `npm ci` in tests/fontpkg (measurements need the real fonts)
                await route.abort(); return
            await route.fulfill(status=200, content_type='font/woff2', body=body, headers={'Access-Control-Allow-Origin':'*'})
        await ctx.route('**/fonts.googleapis.com/**', gcss)
        await ctx.route('https://fontfiles.test/**', gfile)
        logs=[]
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e} {e.stack[:600]}'))
        ns={}
        exec(open(script).read(), ns)
        await ns['test'](pg, ctx, logs)
        print('--- console:'); print('\n'.join(logs) or 'clean')
        await b.close()
asyncio.run(run(sys.argv[1]))
