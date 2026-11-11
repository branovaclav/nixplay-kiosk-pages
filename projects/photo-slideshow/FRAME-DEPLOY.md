# Frame deploy — photo slideshow

For the Claude Code agent that configures the Nixplay kiosk (`../nixplay-kiosk`).
Target: Chromium 81, 1024×768, two tabs.

## What to set on the frame

1. **Two Chromium tabs**
   - Tab A — slideshow: URL from `tools/make-kiosk-url.sh slideshow.env`
     (`…/photo-slideshow/#cfg=<base64url>`). Keep the fragment; it is how
     album keys reach the page without going through GitHub.
   - Tab B — daily overview: `https://branovaclav.github.io/nixplay-kiosk-pages/`

2. **Shake remap (browser / kiosk layer, not the page)**
   - Short shake → switch to the overview tab (do **not** deliver Alt+Left to the page).
   - Long shake → reload the active tab’s URL (settings, position, seen bag and
     IndexedDB cache are kept by the page).

3. **Build the URL on a private machine**
   ```bash
   cp projects/photo-slideshow/.env.example slideshow.env   # fill real keys
   projects/photo-slideshow/tools/make-kiosk-url.sh slideshow.env
   ```
   Never commit `slideshow.env` or paste keys into the public repo / chat logs.

## Checks after first boot

```bash
df -h /data          # confirm free space for ~0.25 GB cache at ~2000 photos
```

In a Chromium console on the slideshow origin:

```js
navigator.storage.estimate().then(console.log)
navigator.storage.persist().then(console.log)   // often false on Chromium 81
```

## Runtime behaviour (page owns these)

| Gesture | Key | Page action |
|---|---|---|
| Tap | Enter | Toggle overlay |
| Left-corner lift | Tab | Toggle shuffle; brief `Náhodne` / `Postupne` centre icon |
| Right-corner lift | Shift+Tab | Previous photo + show overlay |
| Shake | (browser) | Switch to overview — page ignores |

- `visibilitychange` hidden → pause timer; visible → resume (no reload).
- Sync: boot + cheap check every 6 h; full re-list every 30 days.
- Offline / sync errors: keep playing from IndexedDB; no error dialogs.

## Privacy

Album keys are contributor-writable. Treat them like passwords. The whole
`branovaclav.github.io` origin shares `localStorage` / IndexedDB.
