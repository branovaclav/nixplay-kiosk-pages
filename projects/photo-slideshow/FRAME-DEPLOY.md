# Frame deploy — photo slideshow

**Audience:** the Claude Code agent that configures the Nixplay frame over ADB
(sibling repo `branovaclav/nixplay-kiosk`). You have **no** access to the chat
that built this project — work only from this file, [`README.md`](README.md),
[`.env.example`](.env.example), and [`NOTICE`](NOTICE).

**Live page:** `https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/`  
**Demo (no album):** `…/photo-slideshow/?demo=1`  
**Target:** Chromium 81, 1024×768 landscape, Android 7, ~512 MB RAM.

---

## 0. Prerequisites

- Frame online with ADB (or the kiosk project's usual access path).
- Repo `nixplay-kiosk-pages` checked out on a **private** machine (or the frame
  host) so you can run `tools/make-kiosk-url.sh` without committing secrets.
- Braňo supplies **1–5 iCloud shared-album links** (or bare keys). Treat them
  like passwords.
- Daily overview already works at
  `https://branovaclav.github.io/nixplay-kiosk-pages/` (site root).

---

## 1. Album links → keys

iCloud shared albums look like:

```
https://www.icloud.com/sharedalbum/#B0xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**The album key is the fragment after `#`** (starts with `B0…`).  
If Braňo pastes a bare `B0…` string, use that as-is.

Rules:

- 1–5 keys, **comma-separated**, order = sequential playback order (album after album).
- Contributor-writable links → **passwords**. Never put keys, full `#cfg=` URLs,
  photos, GPS, names, emails or comments into the public repo, PR text, CI logs,
  or public chat.

---

## 2. Private env + kiosk URL

On a machine that will **not** commit the file:

```bash
cd /path/to/nixplay-kiosk-pages
cp projects/photo-slideshow/.env.example slideshow.env
# edit slideshow.env — see below
projects/photo-slideshow/tools/make-kiosk-url.sh slideshow.env
```

`slideshow.env` (never commit; keep outside git or gitignored locally):

```
SLIDESHOW_ALBUMS=B0keyOne,B0keyTwo
SLIDESHOW_INTERVAL=5
SLIDESHOW_FADE=0.6
SLIDESHOW_SHARPEN=0.3
```

Optional overrides (Nominatim policy may require switching without a code change):

```
# SLIDESHOW_NOMINATIM_URL=https://nominatim.openstreetmap.org/reverse
# SLIDESHOW_PHOTON_URL=https://photon.komoot.io/reverse
```

The script prints one URL:

```
https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/#cfg=<base64url>
```

**Keep the `#cfg=…` fragment.** Fragments are not sent to GitHub in requests or
Referer. The page mirrors config into `localStorage['ps.cfg']`; the fragment
always wins on boot.

---

## 3. Two Chromium tabs

| Tab | URL | Role |
|---|---|---|
| **A — slideshow** | URL from §2 (`…/photo-slideshow/#cfg=…`) | Photo playback |
| **B — overview** | `https://branovaclav.github.io/nixplay-kiosk-pages/` | Daily summary (existing home) |

Configure the kiosk launcher so both tabs stay open. Prefer starting on the
overview or slideshow per Braňo's preference; shake switches to overview (§4).

---

## 4. Shake remap (browser / kiosk layer — **not** the page)

| Gesture | Action |
|---|---|
| Short shake | Switch to the **overview** tab. Do **not** deliver Alt+Left / BrowserBack to the slideshow page. |
| Long shake | Reload the **active** tab's URL. Page settings, shuffle bag, position and IndexedDB cache are kept. |

The slideshow page does **not** handle shake.

---

## 5. Keys the page handles (capture phase, `preventDefault`)

| Frame gesture | Key | Page action |
|---|---|---|
| Tap | **Enter** | Toggle overlay + clock |
| Left-corner lift | **Tab** | Toggle shuffle ↔ sequential; brief centre toast `Náhodne` / `Postupne` (~1.5 s) |
| Right-corner lift | **Shift+Tab** | Previous photo + force-show overlay |

- Ignore key `repeat`; debounce ~400 ms.
- There is **no** “next” key — photos advance only on the timer (default 5 s).
- `visibilitychange` **hidden** → pause timer; **visible** → resume (no reload).

---

## 6. First-boot behaviour

1. Brief **OSM credit splash** (~3 s): `Miesta: © OpenStreetMap · ODbL` (see `NOTICE`).
2. Status `Načítavam fotky…` until the first cached JPEG is ready; then playback.
3. Background sync per album: CloudKit resolve (retries `TRY_AGAIN_LATER` up to 6× / 1.5 s) → list → download new IDs only → resize + sharpen → IndexedDB.
4. Tiny red sync-dot (top-right) on persistent sync failure — no error dialogs; keep playing from cache.

### Storage checks

```bash
df -h /data          # aim for headroom; ~2000 photos ≈ 0.25 GB cache
```

In a console on the slideshow origin:

```js
navigator.storage.estimate().then(console.log)
navigator.storage.persist().then(console.log)   // often false on Chromium 81
```

Stores: `photos`, `meta`, `posts`, `geo`, `state` in IndexedDB `ps.v1`.  
Same origin as all `branovaclav.github.io` Pages — other Pages on that host can read this data.

---

## 7. Adding or removing albums later

1. Edit private `slideshow.env` (`SLIDESHOW_ALBUMS=…`).
2. Re-run `tools/make-kiosk-url.sh` and set the **new** tab URL (new `#cfg=`).
3. Reload the slideshow tab (or long-shake reload).
4. Removed albums: assets no longer listed are deleted from IndexedDB on sync.
5. New albums: downloaded in the background; shuffle bag picks up new IDs.

---

## 8. Verify

- [ ] Slideshow tab opens with `#cfg=` intact (not stripped by the launcher).
- [ ] After splash, photos appear (or `Načítavam…` then first photo).
- [ ] Enter toggles overlay + clock; Tab toggles shuffle toast; Shift+Tab goes previous.
- [ ] Short shake → overview tab; returning to slideshow resumes (no forced reload).
- [ ] Hide the tab / blank the screen → timer pauses; show again → resumes.
- [ ] `?demo=1` works without keys (layout check only).
- [ ] Overview root URL still loads unchanged.

---

## 9. Troubleshooting

| Symptom | What to try |
|---|---|
| `Prezentácia nie je nastavená` | Missing `#cfg=` and empty `localStorage`. Re-set tab URL from `make-kiosk-url.sh`. |
| Stuck on `Načítavam fotky…` | Empty album, wrong key, or network. Confirm key in a desktop browser; check sync-dot. |
| Frequent sync-dot / no new photos | CloudKit `TRY_AGAIN_LATER` is retried automatically; wait or reload. Download URLs expire ~16 min — sync re-lists. |
| Quota / eviction | `storage.estimate()` + `df -h /data`. Cache rebuilds from `#cfg=` after a wipe (~slow). |
| Clear cache (keep config) | DevTools → Application → IndexedDB → delete `ps.v1`. Or wipe site data; `#cfg=` in the URL re-seeds config. |
| Wrong theme / old assets | Hard reload; confirm Pages deploy finished after a `main` push. |
| Gestures navigate away | Shake/back remap leaking into the page — fix at kiosk layer (§4). |

---

## 10. Privacy (hard rules)

- Never commit `slideshow.env`, album keys, `#cfg=` URLs, real photos, GPS, names, emails, or personal comments.
- Do not paste those into public GitHub issues/PRs, Actions logs, or public channels.
- Album links are contributor-writable — treat like passwords; rotate if leaked.
- Public demo uses `?demo=1` synthetic placeholders only.

---

## 11. Doc map

| File | Use |
|---|---|
| This file | End-to-end frame setup |
| [`README.md`](README.md) | Product / protocol spec |
| [`.env.example`](.env.example) | Env key names |
| [`NOTICE`](NOTICE) | OpenStreetMap / ODbL credit |
| [`notes/icloud-protocol.md`](notes/icloud-protocol.md) | CloudKit endpoints (no secrets) |
| Root [`FRAME.md`](../../FRAME.md) | Shared frame hardware / gesture facts |
| Root [`README.md`](../../README.md) | Repo index + live URLs |
