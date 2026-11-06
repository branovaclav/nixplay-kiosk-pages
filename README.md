# nixplay-kiosk-pages

Statické stránky pre Nixplay Seed 8″ rám (kiosk Chromium 81, 1024×768).
Denný rodinný prehľad — finálny smer: **dark** + **light**.

Prečítaj najprv [`FRAME.md`](FRAME.md) (displej, gestá → klávesy, limity Chromium 81, téma podľa času).

## Vzhľad

Jedna stránka na deň z `data/YYYY-MM-DD.json`. Dva režimy (prepínanie bez reloadu):

| | Režim | |
|---|---|---|
| · | **dark** | Večerná (layout + farby) |
| · | **light** | tá istá štruktúra, Papier paleta |

Predvolene dark 19:00–06:30 Europe/Prague (`theme_schedule` v `members.json`). Test: `?theme=light|dark`.

Otvor [`designs/hub.html`](designs/hub.html) alebo [`designs/index.html`](designs/index.html) (dnes).

```
data/YYYY-MM-DD.json  +  themes/_shared/  →  tools/build.py  →  designs/<date>.html
```

```bash
python3 tools/build.py
```

Pravidlá: [`data/RULES.md`](data/RULES.md) · schéma: [`data/SCHEMA.md`](data/SCHEMA.md).
Pohľady Rodina→osoby. Staršie A/B/C: [`designs/archive/`](designs/archive/).

GitHub Action (`.github/workflows/build.yml`) je **stub** — bez deployu Pages.
