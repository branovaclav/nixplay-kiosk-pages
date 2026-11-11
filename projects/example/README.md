# example

Minimal static project that proves the multi-project Pages layout.

## Pages URL

https://branovaclav.github.io/nixplay-kiosk-pages/example/

## Build

No compile step. The repo-root orchestrator (`tools/build.py`) copies
`index.html` (and any other static assets in this folder except `README.md`)
into `site/example/`.

## Data / config

None. No private config — no `.env.example`.

## Chromium 81

Plain HTML + CSS only. Avoid flex `gap`, `inset`, `aspect-ratio`, `:is()`,
`:where()`, `:has()` (see repo [`FRAME.md`](../../FRAME.md)).
