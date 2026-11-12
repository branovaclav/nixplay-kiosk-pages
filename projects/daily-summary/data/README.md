# data/ — denný obsah (daily-summary)

| Súbor | Účel |
|---|---|
| `members.json` | Členovia, farby, avatary, `theme_schedule` |
| `YYYY-MM-DD.json` | Jeden deň (udalosti + sekcie) |
| `RULES.md` | Kuchárka pre generátor / autora |
| `SCHEMA.md` | JSON schéma |

## Publisher path (GitHub Contents API)

Write day files here (repo-relative):

**`projects/daily-summary/data/YYYY-MM-DD.json`**

(Formerly repo-root `data/YYYY-MM-DD.json` — update external publishers.)

## Dva behy denne (Europe/Prague)

**Jeden súbor na deň** slúži večer pred dňom aj počas dňa — bez regenerácie kvôli popiskom.
Relatívne texty (kicker **Zajtra** / **Rodinný prehľad** / **Osobný prehľad**, nadpis výhľadu) počíta klient podľa Prague času.

| Beh | Približne | Súbor | Úloha |
|---|---|---|---|
| **Večer** | ~18:55 | `…/data/<zajtra>.json` | **Hlavný generátor** — vytvorí / prepíše zajtrajší prehľad. Po pushi sa stránka hneď prepne na zajtra (najnovší súbor s dátumom ≥ dnes). |
| **Ráno** | ~06:55 | `…/data/<dnes>.json` | **Len kontrola kalendárov.** Nový commit len ak sa niečo zmysluplne zmenilo; inak reuse večerného súboru (žiadny commit). |

Každý commit, ktorý mení JSON:

1. Zapisuje / aktualizuje `projects/daily-summary/data/YYYY-MM-DD.json` podľa [`RULES.md`](RULES.md) (vrátane `outlook.from` / `outlook.to` pri `vyhlad`).
2. V tom istom commite **vymaže** súbory staršie než **~14 dní**.
3. Push na `main` → Action `validate` + `build` → Pages (`site/index.html` + `site/daily-summary/` + `version.json`).

Na ráme: `index.html` = najnovší deň s `date >= dnes` (Prague). Rám každých ~5 min kontroluje `version.json` a po večernom deployi sa sám obnoví. Žiadny HTML commit z bota.

Validácia: `python3 tools/validate.py` (číta len `projects/daily-summary/data/*.json`, nie `samples/`).

Ukážkové / testovacie dni (napr. „zajtra“ pre lokálny náhľad) dávaj do **`projects/daily-summary/samples/`** — build a validator ich **neberú**, aby sa nestali živou stránkou.

Pages source: GitHub Actions (`site/` artifact).
