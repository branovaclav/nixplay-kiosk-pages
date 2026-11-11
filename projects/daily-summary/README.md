# daily-summary

Denný rodinný prehľad for the Nixplay Seed 8″ frame (Chromium 81, 1024×768).
Dark (Večerná) + light (Papier) themes; Slovak UI.

Read repo [`FRAME.md`](../../FRAME.md) for frame constraints and gestures.

## Pages URLs

| URL | Role |
|---|---|
| https://branovaclav.github.io/nixplay-kiosk-pages/ | **Frame home** (identical copy — no redirect) |
| https://branovaclav.github.io/nixplay-kiosk-pages/daily-summary/ | Canonical project path |

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
```

Local dated previews: `designs/<date>.html` (not deployed). Archives under
`designs/archive/` and `themes/archive/` stay in-repo only.

## Behaviour (unchanged)

- Theme: `theme_schedule.mode` **sun** (NOAA) or **fixed**; `?theme=light|dark` override.
- Views Rodina → people (Tab/Enter); idle → Rodina; reload at `refresh_at`.
- Frame polls `version.json` (~5 min) after evening deploys.

## Private config

None committed. No `.env.example` yet — generators keep secrets outside this repo.
