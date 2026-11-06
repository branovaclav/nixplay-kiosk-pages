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
| `dark_from` | `19:00` | začiatok dark (Europe/Prague) |
| `dark_until` | `06:30` | koniec dark (exclusive); interval môže prechádzať polnoc |

Deň môže rovnaké polia prebiť v `theme_schedule` vo vlastnom JSON.
Stránka každú minútu prepočíta režim (prepne `html.theme-dark` / `html.theme-light` bez reloadu).
Pre screenshoty / test: `?theme=light` alebo `?theme=dark` (zamkne režim).

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
  "title": "Zajtra / Víkend",
  "items": [
    { "text": "So — voľno.", "detail": "Sobota — nič naplánované." },
    {
      "member": "branislav",
      "family": false,
      "text": "Osobný detail len v pohľade Braňo.",
      "detail": "Dlhší text…"
    }
  ]
}
```

| Pole | Poznámka |
|---|---|
| `text` | krátky (pohľad Rodina, ak `family` nie je false) |
| `detail` | voliteľný dlhší (pohľad člena) |
| `member` | voliteľný filter pre pohľad člena |
| `family` | `false` = skryť v Rodina (ekvivalent `level: "detail"`) |

Štandardné title: Rodina, Pripomienky, Zobrať / vybaviť, **Zajtra / Víkend**.

### Počasie `icon`

`sunny` · `partly-cloudy` · `cloudy` · `rain` · `snow` · `fog` · `storm` — SVG v `assets/weather/`.

## Build

`tools/build.py` → `designs/<date>.html` (jedna stránka, dark+light CSS) + `designs/index.html` (dnes / fallback) + `designs/hub.html`.
Žiadne member HTML. JS: pohľady, now-marker, theme podľa času / `?theme=`, idle → Rodina, denný reload.
Staršie A/B/C návrhy: `designs/archive/` (+ `themes/archive/`).
