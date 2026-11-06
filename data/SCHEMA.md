# Denný rodinný prehľad — JSON schéma

Jeden súbor na deň: `data/YYYY-MM-DD.json`. Členovia: `data/members.json`.
**Pravidlá:** [`RULES.md`](RULES.md).

Rám zobrazí **jednu stránku na deň** s pohľadmi Rodina → osoby (žiadne samostatné member HTML).

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
    "color": "#4A6670",
    "avatar": "rodina.svg"
  }
}
```

Štyria ľudia v pevnom poradí stĺpcov: Braňo, Zuzka, Andrej, Tomáš.
`family` je meta pre pohľad Rodina (avatar/farba) — **nie** stĺpec kalendára.

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

`tools/build.py` → `designs/<theme>/<date>.html` (jedna stránka) + `designs/<theme>/index.html` (dnes / fallback).
Žiadne member HTML. JS: prepínanie pohľadov, now-marker, idle → Rodina, reload ~30 min.
