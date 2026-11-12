# Photo slideshow — spec v1 (decided)

Status: decisions agreed with Braňo, 11 Nov 2026. Project `projects/photo-slideshow/` in
`branovaclav/nixplay-kiosk-pages`, served at `https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/`.
**[M]** = measured on the box, **[A]** = assumption to verify on the frame.

> **Frame agent:** start with **[`FRAME-DEPLOY.md`](FRAME-DEPLOY.md)** — album keys,
> private env + `tools/make-kiosk-url.sh`, page keys, visibility pause, privacy.
> Do not rely on chat history; that file is the runbook.

## 1. Target & constraints
- Hacked Nixplay 8", 1024×768, Chromium 81 kiosk, Android 4.4.4, ~512 MB RAM, weak CPU.
- ES5 only; no flex `gap`, `:has()`, `aspect-ratio`. Chromium 81 APIs only.
- Scale: 1–5 shared albums (iOS 27 / CloudKit format), ~2 000 photos max in total.
- Non-goals v1: video / Live Photo motion, editing, uploading, weather.
  (A small **UI clock** is shown with the overlay; it is not a separate weather/clock page.)
- **Privacy:** no photos, album keys, GPS, names or comments are ever committed to the public repo.

## 2. Project layout
`index.html`, `slideshow.js` (ES5), `slideshow.css`, `README.md` (this spec), `FRAME-DEPLOY.md`
(steps for the Claude Code frame agent), `.env.example`, `tools/make-kiosk-url.sh`, `tests/`
(bplist, date, label, shuffle-bag unit tests).

## 3. Config
- Source: private `slideshow.env`, never committed (format in `.env.example`):
  ```
  SLIDESHOW_ALBUMS=<id1>,<id2>       # 1–5 photos.icloud.com/shared/album/<id> keys (or full URLs)
  SLIDESHOW_INTERVAL=5                # seconds per photo
  SLIDESHOW_FADE=0.6                  # dissolve seconds
  SLIDESHOW_SHARPEN=0.3               # unsharp-mask amount, 0 = off
  ```
- `tools/make-kiosk-url.sh slideshow.env` → `…/photo-slideshow/#cfg=<base64url JSON>`.
  The frame agent sets this as the slideshow tab's URL in the kiosk launcher config.
- The page reads `#cfg=`; if present it validates it and mirrors it to `localStorage['ps.cfg']`; if absent it uses the mirror;
  if both are missing it shows `Prezentácia nie je nastavená`. The fragment always wins. It is never sent to GitHub
  (fragments are not sent in requests or Referer), and it survives a site-data wipe because the URL is re-read at every boot.
- Defaults for all settings live in `slideshow.js`; config only overrides them. Geocoder endpoints are also overridable
  in config (Nominatim policy requires switching without a code update).
- **Note:** all of `branovaclav.github.io` is **one origin**. Any page in any of Braňo's Pages repos can read this
  `localStorage`/IndexedDB, including the keys and cached photos.
- Album keys are contributor-writable links (read-write link access), so treat them like passwords.

## 4. Data flow & caching (serverless)
```
boot → config → IndexedDB → play from cache immediately
     └ background sync, album by album:
       resolve (retry TRY_AGAIN_LATER up to 6×, 1.5 s backoff) → count → list assets + posts (startRank paging)
       → diff stable asset IDs → for each NEW id: download JPEGMed → resize+sharpen → store blob + meta
       → map post comments → geocode queue; IDs gone from the album are deleted from the cache
       → drop any cached photos whose album is not in config (shared github.io origin; demo uses ps.demo.v1)
```
- Protocol: see [`notes/icloud-protocol.md`](notes/icloud-protocol.md). XHR with `Content-Type: text/plain` (no preflight); CORS `*` verified in Chromium 81 **[M]**.
- Download URLs expire after ~16 min and the token after 20 min, so download each listed page right away;
  on 400/403, re-resolve and re-list.
- ID = `CPLAsset.recordName`. Re-download when `recordModificationDate` or the derivative fingerprint changes.
  Prefer the asset's (edited) `resJPEGMedRes` over the master's. Skip videos; Live Photos show as stills.
- Sync on boot, then a cheap check every 6 h (count + `changes/zone` with the stored syncToken); full re-list every 30 days.
- IndexedDB stores (Blob in IDB verified in Chromium 81 **[M]**):
  - `photos` {id → JPEG Blob}
  - `meta` {id, album, takenUtc, tzOffset, lat, lon, w, h, postId, geoCell, fingerprint}
  - `posts` {postId → comment}
  - `geo` {cell → label}
  - `state` {settings, shuffle bag, position, seen}
- Display via `URL.createObjectURL`; revoke the URL when the image leaves the DOM. Call `navigator.storage.persist()` once
  (it returns false by default in Chromium 81 **[M]**).
- If storage is wiped: config returns from the URL fragment and the cache rebuilds (≈2 000 × ~130 KB ≈ 0.25 GB).

## 5. Images
- Resize once on the frame to fit **1024×768** (portrait **576×768**):
  `drawImage` with `imageSmoothingQuality='high'` → 3×3 unsharp mask (separable [1 2 1] blur, `out = px + a·(px − blur)`),
  **amount 0.3** from config (0 = off) → `toBlob('image/jpeg', 0.90)`. Run in the background, one photo at a time, never during playback.
- Why **[M]** (3–4 album photos, real Chromium 81):
  - JPEGMed 2048×1536 averages 643 KB. The result is ~145–160 KB landscape and ~70 KB portrait, ~4–5× smaller.
  - Plain canvas `'high'` is 4–15 % softer than Lanczos. With USM 0.3 it matches or slightly exceeds Lanczos with no visible haloes; 0.6 over-sharpens.
  - USM takes ~25 ms per image on the box. Frame estimate: ~0.35–0.75 s per photo **[A]**.
- Memory: a decoded 1024×768 image is 3.1 MB vs 12.6 MB at 2048; at most 3 decoded images at a time.
- Quota: Chromium 81 gives an origin 60 % of total disk **[M desktop]**. Frame disk is unknown **[A ~8 GB eMMC]**;
  the frame agent checks `df -h /data` and `navigator.storage.estimate()`.
- Canvas output carries no EXIF, so metadata is stored separately (§6).

## 6. Metadata
| Item | Source |
|---|---|
| Capture date | `CPLAsset.assetDate` (UTC ms) + `timeZoneOffset` (s): the date local to where the photo was taken (matches EXIF **[M]**). Shown as **date only**. |
| GPS | `CPLAsset.locationEnc` (base64 binary plist: lat/lon/…), parsed by a small ES5 bplist parser. Many photos have none. |
| Trip name | Upload (post) comment, see §8 |
| Not used | Album name, Title/Caption/Keywords (these do not carry over into shared albums), filename, device, people |

## 7. Places (reverse geocoding)
- Nominatim `reverse?format=jsonv2&zoom=10&accept-language=sk` → one-liner `city|town|village|municipality, country`;
  if there is no locality → `county|state, country`; else `country`; if nothing is found, show no place.
- Fallback: Photon (`photon.komoot.io/reverse`, same OSM data). Both return CORS `*` **[M]**. No API keys.
- Coordinates are rounded to **0.01°** (~1 km) *before* sending, and results are cached per cell; cached cells are never re-queried.
  Rate ≤ 1 request/15 s in steady state (≤ 1/s for a short backfill). The overlay shows `© OpenStreetMap`.
- BigDataCloud is excluded (its fair use forbids stored coordinates); OpenCage is excluded (needs a key).

## 8. Trip name = upload comment
- When photos are added to a shared album with a comment, that comment is stored on the post: `CPLPost.caption`.
- Query `records/query` with recordType `CPLPostByPostTimestamp` to list posts. Map each post to its photos via the post's assets
  (`CPLAssetAndMasterInPost`, or the shared `assetBatchId`), and store `meta.postId`.
- **No fallback**: if a photo's post has no comment, no trip name is shown (not even the album name).
- The comment often already contains the place (e.g. "Dovolenka v Paríži, Francúzsko"); this drives the overlay rule in §10.

## 9. Projects, keys, lifecycle
- Each project is its own fullscreen Chromium window (no tabs / iframes). The frame
  order puts **photo-slideshow first**, then daily-summary. Short shake cycles
  projects (page gets no key). **Long shake = the frame restarts Chromium and
  reloads all projects**, with photo-slideshow in front.
- On `visibilitychange` hidden: pause timer, clock, sync, downloads, resize and
  geocoding (finish the current download item, then wait); free decoded images,
  object URLs and canvas buffers. On visible: restore display, catch up clock,
  resume timer; full album sync only if interrupted or last completed sync is
  older than a few hours (6 h timer still applies while visible). No forced
  reload on switch. Photos from albums not in `#cfg=` (including leftover
  `?demo=1` cache) are deleted and never played; demo mode uses a separate DB.

| Gesture | Key | Action |
|---|---|---|
| Tap | Enter | Toggle overlay |
| Left-corner lift | Tab | Toggle shuffle (always, overlay shown or hidden); show a brief shuffle-state icon in the centre (~1.5 s, not part of the overlay) |
| Right-corner lift | Shift+Tab | Previous photo + auto-show overlay |
| Short shake | (frame) | Next project — not delivered to the page |
| Long shake | (frame) | Restart Chromium; reload all projects; photo-slideshow in front |

- `preventDefault()` on every handled key (capture phase on `document`). Ignore `e.repeat`; debounce 400 ms.
- There is no "next" gesture: photos advance only on the timer.
- `Alt+ArrowLeft` / browser back no longer arrives from the frame.

## 10. Overlay
- Thin bar at the bottom, full width, semi-transparent black (~`rgba(0,0,0,0.5)`), white text, small and unobtrusive.
- It stays on until toggled off: no auto-hide, and the timer does not pause. Its visibility is persisted.
- Content, one line:
  - **Date** in Slovak with short month names, no time: `14. jún 2025`.
    Months: `jan feb mar apr máj jún júl aug sep okt nov dec`.
  - **Comment and place share the same position and text style**, each with its own small icon in front
    (💬-style speech icon for the comment, 📍-style pin for the place; implemented as inline SVG or CSS, not emoji fonts):
    - both present → comment first, then the place **dimmed** (e.g. 60 % opacity);
    - only one present → show that one, at full strength;
    - neither present → date only.
  - `© OpenStreetMap` in a small font at the far right, only when a place is shown.
- The album name and playback settings are not shown.
- OpenStreetMap attribution is **not** in the overlay. See `NOTICE` and §7: place
  names only. Credit is a brief splash on the loading screen plus this README / NOTICE
  (ODbL §4.3 / Geocoding Guideline; Nominatim usage policy).

## 11. Playback
- Auto-start on load from cache. With an empty cache, show `Načítavam fotky…` until the first photo is ready.
- Modes (persisted, toggled with Tab):
  - **shuffle**: a shuffle bag over all albums, so every photo is shown once per cycle; new photos go into the remaining bag;
  - **sequential**: album after album in config order, ordered by capture date within each album.
- The shuffle-state icon text is `Náhodne` / `Postupne`.
- Resume after reload: settings, position and seen state (bag) from `state`.
- Defaults: **5 s** per photo, **0.6 s** dissolve (both in config). Two stacked `<img>` layers with CSS opacity transition and
  `will-change: opacity`: the incoming image fades 0→1 while the outgoing fades 1→0.
- The next image is always preloaded and `img.decode()`-d before the fade starts. The previous image stays available for Shift+Tab.
- Fit: `object-fit: contain` on black; portraits get black side bars (blurred fill possibly later).
- Offline / sync errors: keep playing from cache and never show error dialogs (at most a tiny indicator).

## 12. Risks
- Unofficial CloudKit web API; build numbers change. The protocol is isolated in one module, and cached photos keep playing.
- TRY_AGAIN_LATER on ~30 % of resolve calls is handled by retries.
- Frame unknowns: disk/quota, decode and USM speed, low-memory behaviour.
- Nominatim policy (be polite; Photon fallback). Rounded GPS goes to a third party.
- Same-origin exposure across all `branovaclav.github.io` pages.
- Eviction under disk pressure triggers a slow, self-healing re-download.

## 13. Resolved / later
1. Post comments confirmed on the live album (11 Nov): `records/query` `CPLPostByPostTimestamp` (descending, startRank 0) returns `CPLPost.caption` (STRING) with the public anonymous token; post members via `CPLAssetAndMasterInPost` / matching `assetBatchId`. Note: a full `changes/zone` sync can die on a sentinel `INTERNAL_ERROR`; posts must be fetched via the query, not only via changes/zone.
2. Long shake = the frame restarts Chromium and reloads all projects (slideshow in front); saved settings, position, seen state and cache are kept (consistent with resume).
3. Deployment (frame agent, documented in FRAME-DEPLOY.md): multi-window projects, env → `#cfg=` URL, visibility pause.
4. Overlay visual polish after a first on-frame look.
