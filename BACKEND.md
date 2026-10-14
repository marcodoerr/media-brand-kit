# Media Brand Kit: media backend (designed, not provisioned)

Status, 2026-10-13: **not set up**. The app is browser-only, as before. The browser side of the
backend lives in `js/v4/backend.js`. Everything in it is switched off while
`<meta name="mbk-backend">` is absent. The UI says "not set up yet" wherever a feature would
need the backend: cloud upload in the import panel, and server rendering in Export. Nothing
is faked.

Nothing below was bought, created or connected. Setting it up needs the accounts and
credentials listed under **What you'd provision**.

## 1. Why a backend, and why not for everything

| Today, in the browser | Limits that remain |
|---|---|
| Editing, previews, PNG/JPG/PDF/zip export, video recorded in real time with MediaRecorder | The browser stores media itself, so it isn't shared between people or devices. Recording runs in real time and needs the tab in front. Exports are MP4 only where the browser can record it (otherwise WebM). Large 4K/HEVC clips depend on the laptop's decoder. |

The v4 fixes (import check, paused unused clips, reload fix) remove the blank-editor failure
without a server. A backend adds:
- shared media for the team
- browser-friendly previews of heavy originals
- full-quality renders that don't depend on the person's laptop

## 2. Architecture

```
Browser (Netlify static site)
  │  1. POST /api/uploads {name,type,size,projectId}   ← Netlify Function: auth, quota, size/type check
  │  2. PUT part n → signed URL (16 MB parts, resumable) → R2 bucket "mbk-originals" (private)
  │  3. POST /api/uploads/:id/complete                   → enqueues a "process" job
  │  4. GET  /api/jobs/:id  (poll)                       ← job state in a small DB (Turso/D1/Postgres)
  ▼
Worker (Fly.io machine, scales to zero) — long jobs never run inside a Netlify request
  process: ffprobe (codec, size, duration) → reject or accept → ffmpeg preview
           (H.264 1080p ≤ 8 Mbps + poster JPG) → R2 "mbk-previews"
  render:  headless Chromium (Playwright) loads the SAME app build with the project JSON,
           fonts and assets, plays the export path, captures, muxes audio with ffmpeg → R2 "mbk-renders"
```

**Why rendering reuses the app.** Everything is drawn by `render.js` on a Canvas2D: text
layout, badges, patterns, transitions, overlays and draw-on. A separate server renderer would
drift from the preview.

- **Phase 1:** run the current export path in headless Chromium, in real time. The output is
  identical to the browser's and needs the least new code.
- **Phase 2:** a frame-stepped clock. Seek each video to frame *n*, call `render()`, take a
  `canvas.toBlob`, and pipe the frames to ffmpeg. That makes renders deterministic and faster
  than real time. It needs a deterministic clock hook (`seqClock` already exists) and frame-accurate
  video seeking.

## 3. API contract (what `backend.js` calls)

| Call | Server does |
|---|---|
| `POST /uploads` | Checks the team session, size (≤ 300 MB per clip), type, and the project quota (≤ 1.2 GB per design, ≤ 20 GB per team). Returns `{uploadId, mediaId, parts}`. |
| `POST /uploads/:id/parts/:n` | Returns a signed PUT URL, valid 15 min. |
| `POST /uploads/:id/complete` | Completes the multipart upload and queues a process job. Returns `{jobId}`. |
| `GET /jobs/:id` | Returns `{state: queued\|running\|done\|failed, progress, error, outputs}`. |
| `POST /jobs/:id/retry` · `POST /jobs/:id/cancel` | Retries or cancels the job. |
| `POST /renders` | Queues a render job for a project JSON. Returns `{jobId}`. |
| `GET /media/:id` | Returns a signed GET URL (preview by default, original on request), valid 1 h. |

**Errors** use plain messages: "Over this project's 1.2 GB", "Codec not supported: ProRes 422",
"Render failed at 00:07 (Value 2): font missing". Logs record ids, sizes, codecs and timings,
never file contents or text from designs.

## 4. Security, access, limits

- **Access:** this is an internal team, so there are no public accounts.
  - Recommended: put Cloudflare Access (or Netlify's password / SSO protection) in front of
    `/api/*`, with an allow-list of the team's emails.
  - Every function checks the Access JWT.
  - Optional later: per-person accounts, only if private shared projects are wanted.
- **Secrets** (R2 keys, DB token, worker token) live in Netlify and Fly environment variables only.
  The browser only ever sees short-lived signed URLs.
- **Rate limits:**
  - 30 upload starts per person per hour
  - 10 renders per person per hour
  - a monthly processing cap for the team (minutes), checked before queueing
- **Validation:** done again on the server (ffprobe), whatever the browser said.
- **Retention:**
  - Previews are deleted 30 days after their project is deleted.
  - Temporary parts from failed uploads are deleted after 24 h.
  - Renders are deleted after 14 days.
  - **Originals are never deleted automatically.** They go only when a person deletes the media or the
    project, after a 7-day trash.

## 5. Cost model (estimates, list prices checked 2026-10-13)

Prices:
- Cloudflare R2 Standard: storage **$0.015/GB-month**, Class A ops **$4.50 per million**, Class B
  ops **$0.36 per million**, **egress free**. Free tier: 10 GB-month, 1 M Class A, 10 M Class B.
- Fly.io: shared-cpu-2x / 4 GB **$0.00000826/s** (~$21.40/month if always on); performance-2x / 4 GB
  **$0.00002392/s**. The worker is billed per second while it runs and stops when idle.

**Assumptions:**
- 10 people
- 200 clips a month at 150 MB on average (30 GB of originals a month)
- previews at 15% of the original size
- 120 renders a month, each 45 s of 1080p
- phase 1 renders take about 1.5× real time on performance-2x; processing takes about 0.5× clip length

| Item | Monthly |
|---|---|
| Storage after 6 months: about 180 GB originals + 27 GB previews + 10 GB renders, roughly 217 GB (first 10 GB free) | ≈ **$3.10** |
| Storage ops: about 40 k Class A + 400 k Class B, inside the free tier | **$0** |
| Downloads (egress) | **$0** |
| Processing: 200 clips × ~1 min × 0.5 ≈ 100 min on performance-2x | ≈ **$0.15** |
| Renders: 120 × 45 s × 1.5 ≈ 135 min on performance-2x | ≈ **$0.20** |
| Worker idle | $0 (stops when idle; the stopped rootfs costs about $0.15/GB-month) |
| Job database (Turso / Cloudflare D1 free tiers) | $0 at this size |
| Netlify Functions (API coordination only) | Within the current plan at this size; check your plan's function and credit allowance |
| **Total** | **about $4–6 a month**, growing with stored originals (~$0.45 more per month for each extra 30 GB kept) |

The cost is mostly storage. At 10× the volume it is still about $35–50 a month. Set a Fly spend
cap and an R2 usage alert before going live.

## 6. What you'd provision (none done)

1. A Cloudflare account with R2 enabled, and buckets `mbk-originals`, `mbk-previews` and
   `mbk-renders` (all private), plus an R2 API token scoped to them.
2. Cloudflare Access (Zero Trust free tier up to 50 users) in front of the API, or Netlify's
   site protection. Add the team's emails.
3. A Fly.io app `mbk-worker` with a spend limit. The image contains ffmpeg, Playwright Chromium
   and the brand fonts (Bitter, Poppins, Roboto 900).
4. A small database for jobs (Turso or D1).
5. Netlify environment variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `JOBS_DB_URL`, `JOBS_DB_TOKEN`, `WORKER_URL`, `WORKER_TOKEN`, `ACCESS_AUD`.
6. Then: Netlify Functions in `netlify/functions/` for the contract in §3, the worker service,
   and `<meta name="mbk-backend" content="/api">` in `index.html` to switch the browser side on.

Until then, the app keeps working exactly as it does now, browser-only.
