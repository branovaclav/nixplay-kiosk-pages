# Frame deploy — photo slideshow

**Audience:** the frame agent that configures the Nixplay kiosk (sibling repo
`branovaclav/nixplay-kiosk`). Work only from this file, [`README.md`](README.md),
[`.env.example`](.env.example), and [`NOTICE`](NOTICE).

**Live page:** `https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/`  
**Demo (no album):** `…/photo-slideshow/?demo=1`  
**Target:** Chromium 81, 1024×768 landscape, Android 4.4.4, ~512 MB RAM.

The frame opens each project as its own fullscreen Chromium window. Slideshow
is the **first** project. Short shake cycles projects (page gets no key); long
shake restarts Chromium and reloads **all** projects, with photo-slideshow in
front. See root [`FRAME.md`](../../FRAME.md).

---

## Album keys

iCloud shared albums (CloudKit / current Photos share links) look like:

```
https://photos.icloud.com/shared/album/<id>
```

**The album key is the `<id>` path segment** (about 25 characters, e.g.
`AbCdE_fgHijKlMnOpQrStUvWx`). Bare ids are used as-is.
`tools/make-kiosk-url.sh` also accepts the full `photos.icloud.com` URL and
strips it down to the id.

- 1–5 keys, **comma-separated**, order = sequential playback order.
- Contributor-writable links → **passwords**. Never put keys, full `#cfg=` URLs,
  photos, GPS, names, emails or comments into the public repo, PR text, CI logs,
  or public chat.

---

## Env keys + `make-kiosk-url.sh`

On a machine that will **not** commit the file (owner keeps one private env
outside this repo):

```bash
cd /path/to/nixplay-kiosk-pages
# copy keys into the owner's private env (see .env.example)
projects/photo-slideshow/tools/make-kiosk-url.sh /path/to/private.env
```

Keys (prefix `SLIDESHOW_…`):

```
SLIDESHOW_ALBUMS=AbCdE_fgHijKlMnOpQrStUvWx,XyZ12_abCdeFgHijKlMnOpQrS
# or full links:
# SLIDESHOW_ALBUMS=https://photos.icloud.com/shared/album/AbCdE_fgHijKlMnOpQrStUvWx
SLIDESHOW_INTERVAL=5
SLIDESHOW_FADE=0.6
SLIDESHOW_SHARPEN=0.3
# optional:
# SLIDESHOW_CLOCK_FONT=manrope  # default; or system for the old stack
# SLIDESHOW_NOMINATIM_URL=https://nominatim.openstreetmap.org/reverse
# SLIDESHOW_PHOTON_URL=https://photon.komoot.io/reverse
```

The script prints:

```
https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/#cfg=<base64url>
```

**Keep the `#cfg=…` fragment.** Fragments are not sent to GitHub. The page
mirrors config into `localStorage['ps.cfg']`; the fragment always wins on boot.

Optional override: `SLIDESHOW_BASE_URL` if Pages path differs.

---

## Keys the page handles

| Frame gesture | Key | Page action |
|---|---|---|
| Tap | **Enter** | Toggle overlay + clock |
| Left-corner lift | **Tab** | Toggle shuffle ↔ sequential; toast `Náhodne` / `Postupne` |
| Right-corner lift | **Shift+Tab** | Previous photo + force-show overlay |

- Ignore key `repeat`; debounce ~400 ms. No “next” key — timer advances photos.
- Visibility is **state** (`syncVisibility` on `visibilitychange`, `resume`,
  `pageshow`, `focus`, and a ~10 s poll). **hidden** → pause timer, clock,
  sync/downloads/geocode; finish the current download item then free decoded
  images / object URLs. **visible** → restore images (if restore fails or hangs
  ~10 s, `advance()` so the screen is never left black), catch up clock, resume
  timer; run a full album sync only if the previous one was interrupted or the
  last completed sync is older than a few hours (6 h timer still runs while
  visible). New album photos download only while on screen.
- Cache is scoped to configured album ids: photos from removed albums or a prior
  `?demo=1` visit are deleted and never played. Demo mode uses a separate IndexedDB.

---

## Privacy

- Never commit private env files, album keys, `#cfg=` URLs, real photos, GPS,
  names, emails, or personal comments.
- Public demo: `?demo=1` synthetic placeholders only.

## Doc map

| File | Use |
|---|---|
| This file | Frame agent: URL + env keys |
| [`README.md`](README.md) | Product / protocol spec |
| [`.env.example`](.env.example) | Env key names |
| [`NOTICE`](NOTICE) | OpenStreetMap / ODbL credit |
| Root [`FRAME.md`](../../FRAME.md) | Shared frame + project contract |
