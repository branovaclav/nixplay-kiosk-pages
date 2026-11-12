# Frame deploy — photo slideshow

**Audience:** the frame agent that configures the Nixplay kiosk (sibling repo
`branovaclav/nixplay-kiosk`). Work only from this file, [`README.md`](README.md),
[`.env.example`](.env.example), and [`NOTICE`](NOTICE).

**Live page:** `https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/`  
**Demo (no album):** `…/photo-slideshow/?demo=1`  
**Target:** Chromium 81, 1024×768 landscape, Android 4.4.4, ~512 MB RAM.

The frame opens each project as its own fullscreen Chromium window. Slideshow
is the **first** project. Short shake cycles projects (page gets no key); long
shake reloads this first project and shows it. See root [`FRAME.md`](../../FRAME.md).

---

## Album keys

iCloud shared albums look like:

```
https://www.icloud.com/sharedalbum/#B0xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**The album key is the fragment after `#`** (starts with `B0…`).  
Bare `B0…` strings are used as-is.

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
SLIDESHOW_ALBUMS=B0keyOne,B0keyTwo
SLIDESHOW_INTERVAL=5
SLIDESHOW_FADE=0.6
SLIDESHOW_SHARPEN=0.3
# optional:
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
- `visibilitychange` **hidden** → pause timer, clock, sync/downloads/geocode; finish
  the current download item then free decoded images / object URLs. **visible** →
  restore images, catch up clock, resume timer + sync (new album photos download
  only while on screen).

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
