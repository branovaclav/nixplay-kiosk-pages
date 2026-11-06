# nixplay-kiosk-pages

Statické stránky pre Nixplay Seed 8″ rám (kiosk Chromium 81, 1024×768).
Denný rodinný prehľad — **dark** (Večerná) + **light** (Papier paleta).

Prečítaj najprv [`FRAME.md`](FRAME.md).

## Produkcia

Live: [branovaclav.github.io/nixplay-kiosk-pages](https://branovaclav.github.io/nixplay-kiosk-pages/)  
(`site/index.html` = dnešný `data/YYYY-MM-DD.json`, inak najnovší súbor.)

```
data/members.json + data/YYYY-MM-DD.json
        │
        ▼
tools/validate.py → tools/build.py → site/   (Pages)
                                 ↘ designs/  (lokálny náhľad dátumov)
```

```bash
python3 tools/validate.py
python3 tools/build.py
```

Téma: predvolene **`mode: sun`** (NOAA východ/západ pre Prahu, bez siete); fallback `fixed` 19:00–06:30; test `?theme=light|dark`.  
Pohľady Rodina→osoby (Tab/Enter); idle → Rodina; denný reload o `refresh_at`.

Obsah: [`data/RULES.md`](data/RULES.md) · [`data/SCHEMA.md`](data/SCHEMA.md) · [`data/README.md`](data/README.md).  
Archív starých A/B/C návrhov je v repo (`designs/archive/`, `themes/archive/`), na Pages sa nenasadzuje.
