# Agent entry point — nixplay-kiosk-pages

Static pages for a Nixplay Seed 8″ frame (Chromium 81 kiosk, 1024×768).
**Start with [`FRAME.md`](FRAME.md)**, then this file and [`projects/README.md`](projects/README.md).

## What this repo is

A **multi-project** GitHub Pages site. Each content type is a self-contained
folder under `projects/`. Every folder is a frame project at `/<project-id>/`.
The site root `/` still serves a convenience copy of **daily-summary** (identical
to `/daily-summary/`); the frame itself opens project URLs, not the root.

| Project | Path on Pages | Source |
|---|---|---|
| daily-summary | `/daily-summary/` (and `/` copy) | `projects/daily-summary/` |
| photo-slideshow | `/photo-slideshow/` | `projects/photo-slideshow/` — frame runbook: [`FRAME-DEPLOY.md`](projects/photo-slideshow/FRAME-DEPLOY.md) |

## Build

```bash
python3 tools/validate.py && python3 tools/build.py
```

CI deploys `site/` on push to `main` when `projects/`, `tools/`, or the
workflow change.

## Daily summary — data publish path

Writers (evening/morning bots) commit:

**`projects/daily-summary/data/YYYY-MM-DD.json`**

Prune files older than ~14 days in the same commit. Details:
[`projects/daily-summary/data/README.md`](projects/daily-summary/data/README.md).

## Hard rules

- Target Chromium 81: no flex `gap`, `inset`, `aspect-ratio`, `:is()`/`:where()`,
  `:focus-visible`, `replaceAll`, etc. (FRAME.md).
- Gestures: Tab / Enter / Shift+Tab on the page; short/long shake are frame-only
  (no `Alt+ArrowLeft`) — see FRAME.md and each project README.
- UI text for the family summary: Slovak, 24h time.
- Public site: no pickup codes / passwords / home address in JSON (RULES.md).
- Project contract (visibility pause, no demo folders in `projects/`, private
  `#` config via `make-kiosk-url.sh`) — see FRAME.md and `projects/README.md`.
