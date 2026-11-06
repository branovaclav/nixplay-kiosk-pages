# data/ — denný obsah

| Súbor | Účel |
|---|---|
| `members.json` | Členovia, farby, avatary, `theme_schedule` |
| `YYYY-MM-DD.json` | Jeden deň (udalosti + sekcie) |
| `RULES.md` | Kuchárka pre generátor / autora |
| `SCHEMA.md` | JSON schéma |

## Dva behy denne (Europe/Prague)

| Beh | Približne | Súbor | Poznámka |
|---|---|---|---|
| **Ráno** | ~06:55 | `data/<dnes>.json` | Prehľad na **dnes**. Ak večerný beh už pripravil ten istý súbor ako „zajtra“ a nič sa nezmenilo, **žiadny commit** (reuse). |
| **Večer** | ~18:55 | `data/<zajtra>.json` | Prehľad na **zajtra**. Po pushi sa stránka hneď prepne na zajtra (najnovší súbor s dátumom ≥ dnes). |

Každý commit, ktorý mení JSON:

1. Zapisuje / aktualizuje `data/YYYY-MM-DD.json` podľa [`RULES.md`](RULES.md).
2. V tom istom commite **vymaže** súbory staršie než **~14 dní**.
3. Push na `main` → Action `validate` + `build` → Pages (`site/index.html` + `site/version.json`).

Na ráme: `index.html` = najnovší deň s `date >= dnes` (Prague). Rám každých ~5 min kontroluje `version.json` a po večernom deployi sa sám obnoví. Žiadny HTML commit z bota.

Validácia: `python3 tools/validate.py` (číta len `data/*.json`, nie `samples/`).

Ukážkové / testovacie dni (napr. „zajtra“ pre lokálny náhľad) dávaj do **`samples/`** — build a validator ich **neberú**, aby sa nestali živou stránkou.

Pages source: GitHub Actions (`site/` artifact).
