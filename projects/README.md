# projects/

One folder per content type shown on the Nixplay frame. Each project is
self-contained and publishes to its own GitHub Pages path.

## Project contract

1. **One folder = one project**, a standalone page at `/<project-id>/`.
   Every folder here is shown on the frame — **no** demo or test-only projects.
2. **Keys:** the page handles Enter / Tab / Shift+Tab itself (`keydown`,
   capture phase, `preventDefault`). Never rely on `Alt+ArrowLeft` or browser
   history (there is no back gesture).
3. **Pausing:** on `visibilitychange` → hidden, stop all work (timers,
   animations, polling, downloads, background processing). On → visible, catch
   up at once (clock, data freshness, reload if stale), then resume. Correct if
   the page loads while hidden, or is hidden right after load. Persist anything
   that must survive a reload (`localStorage` / IndexedDB).
4. **Runs for days without leaks.**
5. **Private settings** never go in the repo. A project that needs them
   provides `tools/make-kiosk-url.sh <env-file>` (prints the full URL with the
   private part in `#`) and a `.env.example` listing keys prefixed with the
   project name (e.g. `SLIDESHOW_…`). The owner keeps values in one private env
   file outside this repo.
6. **Adding, removing or renaming** a project folder changes the frame set —
   say so to the frame agent.

Full frame facts: [`../FRAME.md`](../FRAME.md).

## Convention

Every project folder **must** include:

| Item | Purpose |
|---|---|
| `README.md` | What it is, Pages URL, how to build, where data/config lives |
| Buildable output | Either `tools/build.py` exposing `build(out_dir=...)`, or static files the root orchestrator copies |
| Data / config | Project-local (e.g. `data/`). Document the exact publish path for external writers |
| `.env.example` | **Only if** the project needs private config — list keys, never commit secrets |

Optional but common: `tools/validate.py`, `samples/`, local `designs/` previews, project `assets/`, `tools/make-kiosk-url.sh`.

## Registered projects

| Folder | Pages path | Notes |
|---|---|---|
| [`daily-summary/`](daily-summary/) | `/daily-summary/` (also mirrored at `/`) | Family day overview |
| [`photo-slideshow/`](photo-slideshow/) | `/photo-slideshow/` | Shared-album slideshow (`#cfg=`; **[FRAME-DEPLOY.md](photo-slideshow/FRAME-DEPLOY.md)** for the frame agent) |

## Root orchestrator

`tools/build.py` at the repo root:

1. Builds each project into `site/<project-id>/` (live URL `/<project-id>/`)
2. Mirrors `daily-summary` to `site/` root as a convenience copy (frame does not use `/`)
3. Uploads all of `site/` to GitHub Pages (single workflow)
