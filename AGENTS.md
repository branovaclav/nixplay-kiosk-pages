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

Content cookbook: [`data/RULES.md`](data/RULES.md) (where facts go, no duplication, sections, chat derivation).
Schema draft: [`data/SCHEMA.md`](data/SCHEMA.md).
Pattern inspired by [kucharka-recepty](https://github.com/branovaclav/kucharka-recepty) (JSON content → theme → static HTML).

## Hard rules

- Target Chromium 81: no flex `gap`, `inset`, `aspect-ratio`, `:is()`/`:where()`, `:focus-visible`, `replaceAll`, etc. (see FRAME.md).
- Gestures = keys: Tab / Shift+Tab / Enter / Alt+ArrowLeft. Visible `:focus`, sensible DOM order.
- UI text Slovak, 24h time. Little or no runtime JS (timeline is build-time HTML/CSS).
- Do not enable Pages deploy until a theme is chosen; `.github/workflows/build.yml` is a stub.
