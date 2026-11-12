# nixplay-kiosk-pages

Static pages for a self-managed **Nixplay Seed 8″** photo frame (Chromium 81
kiosk, 1024×768). This repo hosts **several content projects** side by side;
each lives under [`projects/`](projects/) and publishes to its own Pages path.

**Read [`FRAME.md`](FRAME.md) first** (display, Chromium 81 limits, gestures,
home/back behaviour). Keep it in sync with sibling `../nixplay-kiosk`.

## Live URLs

Base: [branovaclav.github.io/nixplay-kiosk-pages](https://branovaclav.github.io/nixplay-kiosk-pages/)

| Path | Project |
|---|---|
| `/` | **daily-summary** (frame home — served directly, no redirect) |
| `/daily-summary/` | daily-summary (same page) |
| `/example/` | minimal example project |
| `/photo-slideshow/` | photo slideshow (`#cfg=` / `?demo=1`) — [project](projects/photo-slideshow/), **[frame deploy](projects/photo-slideshow/FRAME-DEPLOY.md)** |

## Frame agent — photo slideshow

To put shared albums on the kiosk (second Chromium tab), follow
[`projects/photo-slideshow/FRAME-DEPLOY.md`](projects/photo-slideshow/FRAME-DEPLOY.md)
end-to-end (keys from iCloud links → private `slideshow.env` → `#cfg=` URL → tabs +
shake remap → verify). Demo without keys: `/photo-slideshow/?demo=1`.

## Layout

```
FRAME.md                 Frame facts (shared)
README.md / AGENTS.md    Repo entry points
projects/                One folder per content type
  daily-summary/         Denný rodinný prehľad (+ its data, themes, build)
  example/               Trivial Chromium 81 demo
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
