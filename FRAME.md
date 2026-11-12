# What these pages run on

The pages in this repo are shown on a self-managed Nixplay Seed 8" photo frame. Device setup lives in the sibling project `../nixplay-kiosk`.

## Display and browser
- **1024 × 768 px, landscape, `devicePixelRatio` 1.** 8" 4:3 panel. No touch and no mouse.
- **Chromium 81** (2020; the newest that runs on the frame's **Android 4.4.4**), in **fullscreen kiosk mode**: no address bar, tabs or system bars.
  - Pages on the same origin stay fullscreen; other sites show a slim Chromium bar at the top.
- **Weak hardware** (512 MB RAM, 4× Cortex-A7). Keep pages light: little JS, few animations, images ≤ ~1024 px. Each project page uses ~20–45 MB; **all projects stay in memory at once**.
- **Pages run unattended for days.** Refresh data periodically and avoid leaks.
  - On boot the frame opens every project window one after another and ends on the first (photo-slideshow). Switching projects does **not** reload; a switch takes ~1 s. Android may still kill a hidden page under memory pressure — Chromium reloads it when shown again.
  - **Hidden / visible is the pause signal.** The page gets `visibilitychange` → `hidden` when the owner switches to another project, or when the screen goes off (5 min without motion; the frame puts a black system screen in front). → `visible` when shown again. Verified on Chromium 81. The browser does **not** stop hidden pages: timers keep running (only slowed). **Pages must stop themselves** on hidden (timers, animations, polling, downloads, background work) and catch up on visible (clock, data freshness, reload if stale), then resume. Behave correctly if the page loads while already hidden, or is hidden right after load. Persist anything that must survive a reload (`localStorage` / IndexedDB).
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
- **Relative labels (client, Prague, every minute):** kicker above the date is **Rodinný prehľad** in the family view and **Osobný prehľad** in every person view; if `data-date` is tomorrow, both read **Zajtra**. „teraz“ only when the page is today. Outlook box title from `data-outlook-from` / `data-outlook-to` (Víkend / Zajtra / weekday). Mock: `?today=YYYY-MM-DD` + `?now=HH:MM`.

## Input: gestures arrive as `keydown` events
| Gesture on the frame | Event | Who handles it |
|---|---|---|
| Tap the top edge | `key "Enter"`, `keyCode 13` | **the page** (capture-phase `keydown` + `preventDefault`) |
| Raise left side, hold ~0.8 s | `key "Tab"`, `keyCode 9`, `shiftKey false` | **the page** |
| Raise right side, hold ~0.8 s | `key "Tab"`, `keyCode 9`, `shiftKey true` | **the page** |
| Short shake | *(no key)* | **the frame** cycles to the next project |
| Long shake | *(no key)* | **the frame** restarts Chromium and reloads **all** projects, with photo-slideshow in front |

- **`Alt+ArrowLeft` (browser back) no longer arrives.** There is no back gesture. Pages must not rely on browser history.
- **Design for "next + select".**
  - Give focused items a clearly visible `:focus` style.
  - Use a sensible DOM order.
  - Focus the first item on load (`autofocus` or `el.focus()`).
- Intercept keys with `addEventListener('keydown', h, true)` + `e.preventDefault()`.
- **Bumping the frame can occasionally register as a tap**, so make Enter on idle pages harmless.
- To test on a desktop, use Chrome at 1024×768 with Tab, Shift+Tab and Enter as the page gestures. Project switching is frame-only (emulate with DevTools visibility or separate windows).

## Projects and switching
- Every folder under `projects/` is a **project**: a standalone fullscreen page at
  `https://branovaclav.github.io/nixplay-kiosk-pages/<project-id>/`
  (optional private `#…` fragment for secrets). No tabs, no iframes, no wrapper page.
- The frame keeps its own order (today: **photo-slideshow**, then **daily-summary**). It no longer opens the site root `/`. The root still hosts a copy of daily-summary for convenience / bookmarks.
- Adding, removing or renaming a project folder changes what the frame must open — tell the frame agent.
- Private settings never go in the repo. A project that needs them provides `tools/make-kiosk-url.sh <env-file>` (prints the full URL with the private part in `#`) and a `.env.example` listing keys prefixed with the project name (e.g. `SLIDESHOW_…`). The owner keeps all values in one private env file outside this repo.

## Project contract

1. **One folder = one project**, served at `/<project-id>/`. Every folder in `projects/` is shown on the frame — no demo or test-only projects there.
2. **Keys:** the page handles Enter / Tab / Shift+Tab itself (`keydown`, capture phase, `preventDefault`). It never relies on `Alt+ArrowLeft` or browser history.
3. **Pausing:** on `visibilitychange` → hidden, stop all work (timers, animations, polling, downloads, background processing). On → visible, catch up at once (clock, data freshness, reload if stale), then resume. Correct if the page loads while hidden, or is hidden right after load. Save anything that must survive a reload (`localStorage` / IndexedDB).
4. **Runs for days without leaks.**
5. **Private settings** never in the repo — see `make-kiosk-url.sh` / `.env.example` above.
6. **Folder add/remove/rename** changes the frame set — call it out when you do that.
