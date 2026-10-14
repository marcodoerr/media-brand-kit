# Rollback — Media Brand Kit

Recorded 2026-10-13, before any v4 change.

| What | Value |
|---|---|
| Production site | https://studio.askruth.ai (Netlify site `astonishing-treacle-ace0f7`) |
| Production deploy before v4 | `6ac9ec8a91cc77c57c2bce01` — https://6ac9ec8a91cc77c57c2bce01--astonishing-treacle-ace0f7.netlify.app |
| Git baseline | commit `f114a5642d795cd307c5fe1a2654b74838450af3` on `main` and `backup/v3.25-2026-10-13` (tag `baseline/v3.25-2026-10-13` in the local clone) |
| Figma original | page "App · Media Brand Kit — v3.25 ORIGINAL (frozen 2026-10-13)" in file 0amKYViLpkdmw2ZL93G7FN |

## Roll the site back (1 minute, no rebuild)

1. app.netlify.com → the studio.askruth.ai project → **Deploys**.
2. Open deploy `6ac9ec8a91cc77c57c2bce01` (or the permalink above).
3. **Publish deploy**. The custom domain serves it within seconds.
4. If auto publishing is unlocked, lock it so the next push doesn't replace it.

## Roll the code back

    git checkout main
    git reset --hard f114a56     # or: git revert <v4 merge commit>
    git push --force-with-lease origin main

Prefer `git revert` of the merge on `main` if others have pulled.

## Stored data

Designs live in each browser (localStorage `askruth.backdrop-studio.v2` and IndexedDB
`askruth-backdrop-studio`). v4 adds keys but changes none of the existing ones, so v3.25 opens a
design saved by v4. v4-only keys v3.25 ignores: `askruth.backdrop-studio.v4.*`.
