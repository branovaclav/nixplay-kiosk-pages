# Denný rodinný prehľad — JSON schéma

Jeden súbor na deň: `data/YYYY-MM-DD.json`. Členovia + site config: `data/members.json`.
**Pravidlá:** [`RULES.md`](RULES.md).

Rám zobrazí **jednu stránku na deň** s pohľadmi Rodina → osoby (žiadne samostatné member HTML).
Dva vizuálne režimy z toho istého JSON: **dark** (Večerná) a **light** (tá istá štruktúra, Papier paleta).

## `members.json`

```json
{
  "members": [
    {
      "id": "branislav",
      "display_name": "Braňo",
      "role": "otec",
      "color": "#1F6AA5",
      "avatar": "branislav.svg"
    }
  ],
  "family": {
    "id": "rodina",
    "display_name": "Rodina",
    "color": "#6B4C9A",
    "avatar": "rodina.svg"
  },
  "theme_schedule": {
    "mode": "sun",
    "lat": 50.08,
    "lon": 14.42,
    "sunrise_offset_min": 0,
    "sunset_offset_min": 0,
    "dark_from": "19:00",
    "dark_until": "06:30"
  }
}
```

Štyria ľudia v pevnom poradí stĺpcov: Braňo, Zuzka, Andrej, Tomáš.
`family` je meta pre pohľad Rodina (avatar/farba) — **nie** stĺpec kalendára.

### `theme_schedule`

| Pole | Predvolené | Poznámka |
|---|---|---|
| `mode` | `sun` ak sú lat/lon, inak `fixed` | `sun` = light od východu do západu; `fixed` = hodiny |
| `lat` / `lon` | Praha `50.08` / `14.42` | WGS84; NOAA výpočet v `view.js` (bez siete) |
| `sunrise_offset_min` | `0` | posun východu (minúty; kladné = neskôr) |
| `sunset_offset_min` | `0` | posun západu (minúty) |
| `dark_from` | `19:00` | fallback / `mode: fixed` — začiatok dark |
| `dark_until` | `06:30` | fallback / `mode: fixed` — koniec dark (exclusive) |

Deň môže rovnaké polia prebiť v `theme_schedule` vo vlastnom JSON.
Stránka každú minútu prepočíta režim (`html.theme-dark` / `html.theme-light`, bez reloadu).
`?theme=light|dark` zamkne režim (screenshoty / test).

## Deň `YYYY-MM-DD.json`

```json
{
  "date": "2026-11-06",
  "locale": "sk-SK",
  "timezone": "Europe/Prague",
  "now": "09:30",
  "refresh_at": "06:30",
  "weather": { "sample": true, "summary": "Polojasno", "temp_high_c": 12, "temp_low_c": 4, "icon": "partly-cloudy" },
  "timeline": { "start": "07:00", "end": "21:00" },
  "events": [],
  "sections": []
}
```

`refresh_at` — `HH:MM` Europe/Prague; stránka sa raz denne obnoví tesne po tomto čase (predvolene `06:30`). Ak `date` ≠ dnešok, skok na `index.html` (dnešný súbor).

`weather.sample` zostáva v dátach (označuje ukážkové počasie), ale **badge UKÁŽKA sa nerenderuje**.

### Udalosti

```json
{
  "id": "andrej-baseball",
  "members": ["andrej"],
  "title": "Baseball",
  "start": "17:00",
  "end": "19:00",
  "all_day": false,
  "location": "telocvičňa Českolipská",
  "status": "confirmed",
  "flags": [],
  "conflict_with": [],
  "notes": [],
  "reminders": [],
  "time_note": null
}
```

| Pole | Poznámka |
|---|---|
| `members` | pole id (`branislav` · `zuzka` · `andrej` · `tomas`); celá rodina = všetci štyria |
| `start` / `end` | `HH:MM` alebo `null` (nečasovaný pás) |
| `status` | `confirmed` · `unconfirmed` · `tentative` · `todo` |
| `flags` | `conflict` · `needs-ride` · `pickup` · `time-tbd` |

Staré pole `member` (string) sa už nepoužíva.

### Sekcie

```json
{
  "id": "vyhlad",
  "title": "Víkend",
  "outlook": { "from": "2026-11-07", "to": "2026-11-08" },
  "items": [
    { "text": "So — voľno.", "detail": "Sobota — nič naplánované." },
    { "text": "Ne — brigáda.", "detail": "Nedeľa — rodinný program." }
  ]
}
```

| Pole | Poznámka |
|---|---|
| `text` | krátky (pohľad Rodina, ak `family` nie je false) |
| `detail` | voliteľný dlhší (pohľad člena) |
| `member` | voliteľný filter pre pohľad člena |
| `family` | `false` = skryť v Rodina (ekvivalent `level: "detail"`) |
| `outlook` | len pri `vyhlad` (alebo inej outlook sekcii): `{ "from", "to" }` ISO dátumy cieľa |

Štandardné title: Rodina, Pripomienky, Zobrať / vybaviť.

**`vyhlad`:** `outlook.from` / `outlook.to` sú povinné. `title` je len **fallback** pre HTML pred JS.
Klient prepočíta nadpis voči dňu pozerania (Prague): So+Ne → `Víkend`; jeden deň = zajtra → `Zajtra`; inak weekday.
Nikdy `Zajtra / Víkend`. Pozri [`RULES.md`](RULES.md) §3.

Mock pre screenshoty / test: `?today=YYYY-MM-DD` + `?now=HH:MM` (Europe/Prague logika v `view.js`).

### Počasie `icon`

`sunny` · `partly-cloudy` · `cloudy` · `rain` · `snow` · `fog` · `storm` — SVG v `assets/weather/`.

## Build

```bash
python3 tools/validate.py   # fail CI if JSON breaks this schema / RULES
python3 tools/build.py      # → site/ (Pages) + designs/ (local dated previews)
```

Produkcia: `site/index.html` = dnešný súbor (Europe/Prague), inak najnovší `data/YYYY-MM-DD.json`.
Žiadne member HTML. JS: pohľady, now-marker, theme podľa času / `?theme=`, idle → Rodina, denný reload.
Archív A/B/C: `designs/archive/`, `themes/archive/` (v repo, nie na Pages).
