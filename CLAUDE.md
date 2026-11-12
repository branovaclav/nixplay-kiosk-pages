# nixplay-kiosk-pages

Web pages (GitHub Pages) shown in kiosk mode on the owner's Nixplay photo
frame. Multiple content projects live under `projects/`; each is a fullscreen
Chromium window at `/<project-id>/`. The frame no longer uses the site root as
home (root still mirrors daily-summary).

**Read `FRAME.md` first.** It covers the display size, Chromium 81, Android
4.4.4, gestures (Enter/Tab/Shift+Tab on the page; shake is frame-only), and
the visibility pause/resume contract. Keep it in sync if the frame setup
changes; the source of truth is the sibling project `../nixplay-kiosk`.

Then read `projects/README.md` and `AGENTS.md`.
