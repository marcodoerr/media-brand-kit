import re,sys,os
import subprocess
HERE=os.path.dirname(os.path.abspath(__file__))
SITE=os.environ.get('SITE', os.path.join(HERE, '..'))
ORIG=os.environ.get('ORIG')   # a folder with the baseline; default: read it from git (BASE, default origin/main)
def orig(rel):
    if ORIG: return open(os.path.join(ORIG, rel)).read()
    return subprocess.run(['git','show',os.environ.get('BASE','origin/main')+':'+rel], cwd=SITE, capture_output=True, text=True, check=True).stdout
names="exportImage exportVideo pickVideoMime primaryVideoId sourceDuration downloadBlob showExportNote exportSlug save loadTemplates writeTemplates snapshot thumbDataUrl saveTemplate deleteTemplate renderTemplates importFiles dropUpload redrawThumbWhenReady adjustFor syncAdjust bindAdjusts sizeCanvas hasMotion tick draw wireUploads wireInset syncInsetControls placeInsetClearOfText buildOverlaySegments bindText bindToggle trackTopbar overhang snap toCanvas revealThumb syncThumbs".split()
def body(src,name):
    m=re.search(r'(?:async\s+)?function\s+'+name+r'\s*\(',src)
    if not m: return None
    i=src.index('{',m.end()); d=0
    for j in range(i,len(src)):
        if src[j]=='{': d+=1
        elif src[j]=='}':
            d-=1
            if d==0: return src[m.start():j+1]
a=orig('js/app.js'); b=open(SITE+'/js/app.js').read()
bad=[n for n in names if body(a,n)!=body(b,n)]
print('protected functions identical:', len(names)-len(bad),'/',len(names), 'diff:',bad)
for f in ['store.js']:
        # store.js may differ from the baseline only in the MAX_VIDEO_BYTES line
    cap=lambda t: re.sub(r'MAX_VIDEO_BYTES = [^;]+;', 'MAX_VIDEO_BYTES = …;', t)
    print(f, 'identical apart from MAX_VIDEO_BYTES:', cap(orig('js/'+f))==cap(open(SITE+'/js/'+f).read()))
