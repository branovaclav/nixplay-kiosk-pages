# Agent entry point — nixplay-kiosk-pages

Static pages for a Nixplay Seed 8″ frame (Chromium 81 kiosk, 1024×768).
Start with [`FRAME.md`](FRAME.md), then this file.

## This round: design proposals only

Three themes rendered from sample JSON into `designs/<theme>/`.
Pick a direction before wiring the morning bot + GitHub Pages deploy.

| Letter | Theme | Intent |
|---|---|---|
| A | **Papier** | Calm cool paper planner |
| B | **Farbičky** | Bold colorful kid-friendly |
| C | **Večerná** | Dark ambient living-room |

```
data/members.json + data/YYYY-MM-DD.json
        │
        ▼
themes/<id>/  (CSS, fonts, theme.json)  +  tools/build.py
        │
        ▼
designs/<id>/*.html   (and designs/index.html)
```

```bash
python3 tools/build.py
```

Content cookbook: [`data/RULES.md`](data/RULES.md). Schema: [`data/SCHEMA.md`](data/SCHEMA.md).
One HTML page per day; views Rodina → Braňo → Zuzka → Andrej → Tomáš (Tab/Enter). Events use `members[]`.

## Hard rules

- Target Chromium 81: no flex `gap`, `inset`, `aspect-ratio`, `:is()`/`:where()`, `:focus-visible`, `replaceAll`, etc. (see FRAME.md). Animate `flex-basis`/`width`, not `grid-template-columns`.
- Gestures: Tab/Enter = next view, Shift+Tab = previous (`preventDefault`); Alt+ArrowLeft ignored. Idle ~60 s → Rodina.
- UI text Slovak, 24h time. Timeline build-time; light `view.js` for views + now-marker.
- Public site: no pickup codes / passwords / home address in JSON (RULES.md).
- Do not enable Pages deploy until a theme is chosen; `.github/workflows/build.yml` is a stub.
