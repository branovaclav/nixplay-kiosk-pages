# data/ — denný obsah

| Súbor | Účel |
|---|---|
| `members.json` | Členovia, farby, avatary, `theme_schedule` |
| `YYYY-MM-DD.json` | Jeden deň (udalosti + sekcie) |
| `RULES.md` | Kuchárka pre generátor / autora |
| `SCHEMA.md` | JSON schéma |

## Ako vzniká denný súbor

Ranný **generátor** (bot / skript) každú noc alebo ráno:

1. Zloží `data/YYYY-MM-DD.json` podľa [`RULES.md`](RULES.md) (Europe/Prague).
2. Commitne ho do `main` (jeden commit; staršie súbory **staršie ako ~14 dní** v tom istom commite zmaže).
3. Push na `main` spustí GitHub Action → `tools/validate.py` + `tools/build.py` → deploy `site/` na Pages.

Na ráme je vždy `index.html` = dnešný súbor (ak chýba, najnovší dostupný). Žiadny HTML commit z bota — build beží v CI.

Validácia pred merge / v CI: `python3 tools/validate.py`.

Pages source: GitHub Actions (`site/` artifact).
