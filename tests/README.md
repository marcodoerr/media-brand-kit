# Tests

Browser tests that drive the real app (Python + Playwright + Chromium). They check what a person
sees and does, not how the code is written — so they keep working through refactors (e.g. a move
to TypeScript or React).

## Setup (once)

```
pip install playwright && python -m playwright install chromium
cd tests/fontpkg && npm ci && cd ..          # Bitter / Poppins / Roboto, served offline to the tests
sh make_fixtures.sh                          # video files for s212, s217, s218, s222, s223 (needs ffmpeg)
```

## Run (from `tests/`)

```
python3 protect.py                 # the 39 protected app.js functions are unchanged vs origin/main
python3 harness.py s237.py         # one test → PASS / FAIL lines and "RESULT n / m"
for t in s2*.py; do echo $t; python3 harness.py $t | grep -E "RESULT|TOTAL"; done
```

`harness.py` serves the repo on 127.0.0.1:8766. Screenshots and downloads go to `tests/out/`
(`OUT` / `SHOTS` env vars). `SITE=/path/to/another/checkout` tests another build — e.g. the
baseline, to compare before / after.

| Tests | Covers |
|---|---|
| s208–s221 | v3.x editor: sections, video, export, Present, full screen |
| s222–s225 | v4: video import checks, reload keeps videos, Adapt layout, export scopes / PDF |
| s226–s233 | panel, undo/redo, stripes, header, Preview, defaults, upload tabs, captions |
| s234 | Luxury buttons per brand, light and dark |
| s235 | Home: half-size Recent cards |
| s236 | Appearance → Interface color |
| s237–s238 | Presentation 16:9, Slides from text, PowerPoint (flag `presentation`) |

Known: s212's "frames differ" check can flake in headless recording (passes on rerun); s227 has
a rare flake at 1280 px. `fixtures/old-602dd93-carousel.json` is a project saved by an older
build — s237 checks it still opens.
