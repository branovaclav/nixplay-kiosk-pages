# Agent entry point — nixplay-kiosk-pages

Static pages for a Nixplay Seed 8″ frame (Chromium 81 kiosk, 1024×768).
Start with [`FRAME.md`](FRAME.md), then this file.

## Production

| Mode | Source |
|---|---|
| **dark** | Večerná layout + colors |
| **light** | Same layout, Papier palette |

`tools/build.py` → **`site/index.html`** (today Europe/Prague, else newest day JSON) + assets.  
Theme: `theme_schedule.mode` **sun** (NOAA sunrise/sunset, Prague lat/lon) or **fixed** clock; `?theme=` override.  
GitHub Action validates (`tools/validate.py`) and deploys `site/` to Pages on push to `main` (paths: `data/`, `themes/`, `tools/`, `assets/`).

```bash
python3 tools/validate.py && python3 tools/build.py
```

Local dated previews: `designs/<date>.html`. Archives (`designs/archive/`, `themes/archive/`) stay in the repo, not deployed.

Morning generator commits only `data/YYYY-MM-DD.json` (prune &gt; ~14 days in the same commit) — see [`data/README.md`](data/README.md).

## Hard rules

- Target Chromium 81: no flex `gap`, `inset`, `aspect-ratio`, `:is()`/`:where()`, `:focus-visible`, `replaceAll`, etc. (see FRAME.md). Animate `flex-basis`/`width`, not `grid-template-columns`.
- Gestures: Tab/Enter = next view, Shift+Tab = previous (`preventDefault`); Alt+ArrowLeft → Rodina. Idle ~60 s → Rodina.
- UI text Slovak, 24h time. Timeline build-time; `view.js` for views + now-marker + theme + daily reload.
- Public site: no pickup codes / passwords / home address in JSON (RULES.md).
