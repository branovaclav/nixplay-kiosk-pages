# daily-summary

Denný rodinný prehľad for the Nixplay Seed 8″ frame (Chromium 81, 1024×768).
Dark (Večerná) + light (Papier) themes; Slovak UI.

Read repo [`FRAME.md`](../../FRAME.md) for frame constraints and gestures.

## Pages URLs

| URL | Role |
|---|---|
| https://branovaclav.github.io/nixplay-kiosk-pages/daily-summary/ | Canonical project path (frame opens this) |
| https://branovaclav.github.io/nixplay-kiosk-pages/ | Convenience copy (identical — no redirect) |

Both serve the same `index.html` + assets + `version.json`.

## Data (publisher path)

External generators write day JSON via the GitHub Contents API here:

**`projects/daily-summary/data/YYYY-MM-DD.json`**

Also in this folder:

| Path | Purpose |
|---|---|
| `data/members.json` | Members, colours, avatars, `theme_schedule` |
| `data/RULES.md` | Author / generator cookbook |
| `data/SCHEMA.md` | JSON schema |
| `data/README.md` | Publish cadence (evening + morning) |
| `samples/` | Local/demo days — **not** built or validated |

JSON file format is unchanged from the old root `data/` location.

Prune day files older than ~14 days in the same commit as a publish.

## Build

From repo root (preferred):

```bash
python3 tools/validate.py
python3 tools/build.py
```

Project-only:

```bash
python3 projects/daily-summary/tools/validate.py
python3 projects/daily-summary/tools/build.py   # → projects/daily-summary/dist/
node projects/daily-summary/tests/run.js          # visibility/resume regression
```

Local dated previews: `designs/<date>.html` (not deployed). Archives under
`designs/archive/` and `themes/archive/` stay in-repo only.

## Behaviour

- Theme: `theme_schedule.mode` **sun** (NOAA) or **fixed**; `?theme=light|dark` override.
- Views Rodina → people (Tab/Enter / Shift+Tab); idle → Rodina; reload at `refresh_at`.
- Polls `version.json` (~5 min) after evening deploys.
- Visibility is state (`syncVisibility` on `visibilitychange`, `resume`,
  `pageshow`, `focus`, ~10 s poll). Hidden → stop clock, auto-scroll, idle,
  version poll and refresh timers. Visible → catch up clock/teraz, show Rodina,
  version/stale check (reload if needed), then resume.

## Header, fonts, auto-scroll

All sizes, fonts and timings are CSS custom properties in `themes/_shared/base.css` (`:root`).

**Header** (80 px, contents vertically centred): live clock · kicker + date · weather.

- **Kicker:** „Rodinný prehľad“ (family view) / „Osobný prehľad“ (any person view); both become „Zajtra“ when the page date is tomorrow (Prague). No person badge — the focused calendar column shows whose view it is.
- **Clock:** Europe/Prague `HH:MM` + smaller faded `:SS` (`--fs-clock` 51px, `--fs-clock-sec` 26px, `--clock-sec-opacity` 0.55, `--fw-clock` 600, tabular digits, `--clock-shift` optical nudge). One `setTimeout` aligned to each whole second; the minute change also refreshes the „teraz“ marker. `?now=HH:MM` (or `data-lock-now`) freezes it at `HH:MM:00`.
- **Two-line blocks** (kicker + date, °C + condition): `--hdr-line-gap` (2px) between the lines.

**Fonts** (`themes/_shared/fonts.css`, files in `themes/_shared/fonts/`, OFL — see `assets/fonts/OFL-NOTE.md`):

| Variable | Family / weight | Used for |
|---|---|---|
| `--font-head`, `--fw-date` / `--fw-head` / `--fw-temp` | Manrope 700 | date (`--fs-date` 33px), „Dôležité“ (`--fs-side-title` 27px), °C range (`--fs-wx-temp` 31px) |
| `--font-head`, `--fw-clock` | Manrope 600 | clock |
| `--font-label`, `--fw-label` / `--fw-kicker` | Manrope 700 / 500 | grey all-caps labels (RODINA, ZAJTRA, OSTATNÍ…) / kicker |
| `--font-body`, `--fw-body` / `--fw-bold` | Inter 400 / 600 | everything else |

**Sidebar auto-scroll** (`view.js`): the „Dôležité“ list and the outlook box are separate bounded areas (`.autoscroll` > `.autoscroll-inner`); the outlook box keeps its own area at the bottom (max `--outlook-max-h`, 300px) and never overlaps. If content overflows, it loops: pause `--autoscroll-pause` (4000 ms) at the top → `translateY` at `--autoscroll-speed` (16 px/s) → pause at the bottom → fade, jump to top. Edge fade (`--autoscroll-fade`, 18px, `-webkit-mask-image`) only while clipped. Re-measured on view change, resize, theme change and after webfonts load; nothing happens when the content fits. `body[data-scroll-debug]` lists `viewport/content` heights.

- **Debug:** `?scrollpos=0..1` freezes every overflowing area at that fraction (screenshots), e.g. `?theme=light&today=2026-11-12&now=13:00&view=andrej&scrollpos=0.5`.

## Private config

None committed. No `.env.example` yet — generators keep secrets outside this repo.
