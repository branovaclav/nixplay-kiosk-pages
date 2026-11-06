# What these pages run on

The pages in this repo are shown on a self-managed Nixplay Seed 8" photo frame. Device setup lives in the sibling project `../nixplay-kiosk`.

## Display and browser
- **1024 × 768 px, landscape, `devicePixelRatio` 1.** 8" 4:3 panel. No touch and no mouse.
- **Chromium 81** (2020; the newest that runs on the frame's Android 4.4), in **fullscreen kiosk mode**: no address bar, tabs or system bars.
  - Pages on the home page's origin stay fullscreen; other sites show a slim Chromium bar at the top.
- **Weak hardware** (512 MB RAM, 4× Cortex-A7). Keep pages light: little JS, few animations, images ≤ ~1024 px.
- **Pages run unattended for days.** Refresh data periodically and avoid leaks.
  - The frame boots straight into the home page (~20 s after power-on) and reopens it if the browser closes.
  - The backlight goes off after 5 min without motion in the room and comes back on at motion. The page keeps running in the dark, so don't rely on visibility events.
- **Two generator runs / day (Europe/Prague):** evening (~18:55) is the **main** generator (writes tomorrow’s JSON); morning (~06:55) only re-checks calendars and commits if something meaningful changed. The same day file serves evening-before and day-of; relative labels are client-side. Live page = newest day with `date >= today`. Frame polls `version.json` ~every 5 min; also reloads after `refresh_at` and when the page date falls behind Prague today (not when it is tomorrow).
- **Not available in Chromium 81:**
  - CSS: flex `gap` (84), `inset` (87), `aspect-ratio` (88), `:focus-visible` (86), `:is()`/`:where()` (88), `:has()`, container queries, `dvh`.
  - JS: `String.replaceAll`, `Promise.any`, `??=` (85), `Array.at` (92), `structuredClone`, top-level `await`.
  - **Available:** ES2020 (incl. `?.` and `??`), CSS grid, custom properties, `fetch`, ES modules.
- **No H.264/AAC.** Use images, or WebM/VP9 for video.
- The frame's time zone is Europe/Amsterdam. **Content times and theme schedule use Europe/Prague** (family locale); see day JSON `timezone` and `theme_schedule`.
- **Light / dark theme:** the day page embeds both palettes. `view.js` sets `html.theme-dark` or `html.theme-light` and re-checks every minute without reload.
  - Default **`mode: "sun"`**: NOAA sunrise/sunset for `lat`/`lon` in `theme_schedule` (Prague 50.08, 14.42), no network. Light from sunrise→sunset (optional minute offsets); dark otherwise. CET/CEST via `Intl` + Europe/Prague.
  - Fallback **`mode: "fixed"`** (or if sun math fails): `dark_from` / `dark_until` (default 19:00–06:30).
  - Screenshots/tests: `?theme=light` or `?theme=dark`.
- **Relative labels (client, Prague, every minute):** if `data-date` is tomorrow → Rodina kicker **Zajtra**; if today → **Rodinný prehľad**. „teraz“ only when the page is today. Outlook box title from `data-outlook-from` / `data-outlook-to` (Víkend / Zajtra / weekday). Mock: `?today=YYYY-MM-DD` + `?now=HH:MM`.

## Input: gestures arrive as `keydown` events
| Gesture on the frame | Event | Browser default |
|---|---|---|
| Tap the top edge | `key "Enter"`, `keyCode 13` | activates the focused link/button |
| Raise left side, hold ~0.8 s | `key "Tab"`, `keyCode 9`, `shiftKey false` | focus → next element |
| Raise right side, hold ~0.8 s | `key "Tab"`, `keyCode 9`, `shiftKey true` | focus → previous element |
| Shake ~1.2 s | `key "ArrowLeft"`, `keyCode 37`, **`altKey true`** | browser **back** (does nothing on the first page) |
| Keep shaking ~4.5 s | no event | the kiosk loads the **home URL** |

- **Design for "next + select".**
  - Give focused items a clearly visible `:focus` style.
  - Use a sensible DOM order.
  - Focus the first item on load (`autofocus` or `el.focus()`).
- **Native behaviour works without code.** A page may also intercept a key with `addEventListener('keydown', h, true)` + `e.preventDefault()`, e.g. Tab = next slide.
- **Bumping the frame can occasionally register as a tap**, so make Enter on idle pages harmless.
- To test on a desktop, use Chrome at 1024×768 with Tab, Shift+Tab, Enter and Alt+← as the gestures.

## Home page and navigation
- **Home page:** the kiosk's home URL will be this repo's GitHub Pages `index.html`. Tell the owner the final URL; it gets set on the frame from `../nixplay-kiosk` (the exact URL, including any query string, is baked into a security token).
- **Back = browser history.** Navigate with real links or `history.pushState`, so back returns where expected. Avoid `location.replace()` for pages you want to come back from.
- **Auto-redirect to a default page:** never redirect *immediately and unconditionally* from the home page. Back would land on it and redirect again, so home couldn't be used. Either of these works:
  - **Inactivity timeout (owner's preference):** redirect after a while with no input, and restart the timer on every key, so it never fires while someone is navigating. It also recovers after a power cut or restart, and returns to the default page if someone leaves the frame on home.
    ```js
    var t; function arm() { clearTimeout(t); t = setTimeout(function () { location.href = 'recap.html'; }, 60000); }
    document.addEventListener('keydown', arm, true); arm();
    ```
  - **Once per session:**
    ```js
    if (!sessionStorage.started) { sessionStorage.started = '1'; location.href = 'recap.html'; }
    ```
    sessionStorage survives back and the long-shake home, and resets when the frame restarts.
