# projects/

One folder per content type shown on the Nixplay frame. Each project is
self-contained and publishes to its own GitHub Pages path.

## Convention

Every project folder **must** include:

| Item | Purpose |
|---|---|
| `README.md` | What it is, Pages URL, how to build, where data/config lives |
| Buildable output | Either `tools/build.py` exposing `build(out_dir=...)`, or static files the root orchestrator copies |
| Data / config | Project-local (e.g. `data/`). Document the exact publish path for external writers |
| `.env.example` | **Only if** the project needs private config — list keys, never commit secrets |

Optional but common: `tools/validate.py`, `samples/`, local `designs/` previews, project `assets/`.

## Registered projects

| Folder | Pages path | Notes |
|---|---|---|
| [`daily-summary/`](daily-summary/) | `/daily-summary/` **and** `/` | Frame home URL stays at site root (identical copy) |
| [`example/`](example/) | `/example/` | Minimal Chromium 81 static demo |
| [`photo-slideshow/`](photo-slideshow/) | `/photo-slideshow/` | Shared-album slideshow (`#cfg=`; **[FRAME-DEPLOY.md](photo-slideshow/FRAME-DEPLOY.md)** for the frame agent) |

## Root orchestrator

`tools/build.py` at the repo root:

1. Builds each project into `site/<project-id>/`
2. Mirrors `daily-summary` to `site/` root for backwards compatibility
3. Uploads all of `site/` to GitHub Pages (single workflow)
