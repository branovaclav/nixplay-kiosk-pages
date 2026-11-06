# Agent entry point — nixplay-kiosk-pages

Static pages for a Nixplay Seed 8″ frame (Chromium 81 kiosk, 1024×768).
Start with [`FRAME.md`](FRAME.md), then this file.

## Final design direction

Two visual modes from the same day JSON, one HTML page per day:

| Mode | Source | Notes |
|---|---|---|
| **dark** | Večerná layout + colors | Default evening/night |
| **light** | Same layout, Papier palette | Timeline bg slightly brighter than original Papier |

Auto theme: Europe/Prague clock, default dark `19:00`–`06:30` (`theme_schedule` in `members.json` or day JSON). Override with `?theme=light|dark`. Re-check every minute (class on `<html>`, no reload).

Views: Rodina → Braňo → Zuzka → Andrej → Tomáš. Archived A/B/C: `designs/archive/`, `themes/archive/`.

```
data/members.json + data/YYYY-MM-DD.json
        │
        ▼
themes/_shared/  (base + dark + light + fonts + view.js)  +  tools/build.py
        │
        ▼
designs/<date>.html · designs/index.html · designs/hub.html
```

```bash
python3 tools/build.py
```

Content cookbook: [`data/RULES.md`](data/RULES.md). Schema: [`data/SCHEMA.md`](data/SCHEMA.md).

## Hard rules

- Target Chromium 81: no flex `gap`, `inset`, `aspect-ratio`, `:is()`/`:where()`, `:focus-visible`, `replaceAll`, etc. (see FRAME.md). Animate `flex-basis`/`width`, not `grid-template-columns`.
- Gestures: Tab/Enter = next view, Shift+Tab = previous (`preventDefault`); Alt+ArrowLeft → Rodina. Idle ~60 s → Rodina.
- UI text Slovak, 24h time. Timeline build-time; light `view.js` for views + now-marker + theme.
- Public site: no pickup codes / passwords / home address in JSON (RULES.md).
- Do not enable Pages deploy until ready; `.github/workflows/build.yml` is a stub.
