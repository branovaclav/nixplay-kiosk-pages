# nixplay-kiosk-pages

Static pages for a self-managed **Nixplay Seed 8″** photo frame (Chromium 81
kiosk, 1024×768). This repo hosts **several content projects** side by side;
each lives under [`projects/`](projects/) and publishes to `/<project-id>/`.

**Read [`FRAME.md`](FRAME.md) first** (display, Chromium 81 limits, gestures,
visibility pause, project contract). Keep it in sync with sibling
`../nixplay-kiosk`.

## Live URLs

Base: [branovaclav.github.io/nixplay-kiosk-pages](https://branovaclav.github.io/nixplay-kiosk-pages/)

| Path | Project |
|---|---|
| `/photo-slideshow/` | photo slideshow (`#cfg=` / `?demo=1`) — [project](projects/photo-slideshow/), **[frame deploy](projects/photo-slideshow/FRAME-DEPLOY.md)** |
| `/daily-summary/` | daily-summary |
| `/` | convenience copy of daily-summary (frame opens project URLs, not root) |

## Frame agent — photo slideshow

To put shared albums on the kiosk, follow
[`projects/photo-slideshow/FRAME-DEPLOY.md`](projects/photo-slideshow/FRAME-DEPLOY.md)
(keys from iCloud links → private env → `#cfg=` URL). Demo without keys:
`/photo-slideshow/?demo=1`.

## Layout

```
FRAME.md                 Frame facts + project contract
README.md / AGENTS.md    Repo entry points
projects/                One folder per frame project
  daily-summary/         Denný rodinný prehľad (+ its data, themes, build)
  photo-slideshow/       Shared-album slideshow (+ FRAME-DEPLOY.md)
tools/                   Shared validate + build orchestrator → site/
.github/workflows/       One Pages deploy for every project
```

Project convention: [`projects/README.md`](projects/README.md).

## Build & deploy

```bash
python3 tools/validate.py
python3 tools/build.py          # → site/ (gitignored; CI artifact)
```

Push to `main` (paths under `projects/`, `tools/`, workflow) runs validate +
build and deploys `site/` to GitHub Pages.

## Daily summary data (publisher)

External scripts publish day JSON via the GitHub Contents API to:

**`projects/daily-summary/data/YYYY-MM-DD.json`**

(Previously `data/YYYY-MM-DD.json` at repo root — update publishers.)
Format unchanged. See [`projects/daily-summary/data/README.md`](projects/daily-summary/data/README.md).
