# nixplay-kiosk-pages

Statické stránky pre Nixplay Seed 8″ rám (kiosk Chromium 81, 1024×768).
Začíname **denným rodinným prehľadom** — toto kolo sú len **návrhy vzhľadu**.

Prečítaj najprv [`FRAME.md`](FRAME.md) (displej, gestá → klávesy, limity Chromium 81).

## Návrhy (toto kolo)

Tri témy, rovnaký obsah z `data/`:

| | Téma | Jedným riadkom |
|---|---|---|
| A | **Papier** | Pokojný papierový plánovač |
| B | **Farbičky** | Odvážne detské farbičky |
| C | **Večerná** | Tmavá ambientná obývačka |

Otvor [`designs/index.html`](designs/index.html).

```
data/YYYY-MM-DD.json  +  themes/<id>/  →  tools/build.py  →  designs/<id>/*.html
```

```bash
python3 tools/build.py
```

Schéma: [`data/SCHEMA.md`](data/SCHEMA.md). Vzor obsahu/prezentácie podľa
[kucharka-recepty](https://github.com/branovaclav/kucharka-recepty).

GitHub Action (`.github/workflows/build.yml`) je **stub** — bez deployu Pages.
