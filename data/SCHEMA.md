# Denný rodinný prehľad — JSON schéma (návrh)

Jeden súbor na deň: `data/YYYY-MM-DD.json`. Stabilní členovia rodiny sú v `data/members.json`
(bot ich môže skopírovať do denného súboru, alebo ich build načíta zvlášť).

Vzor podľa [kucharka-recepty](https://github.com/branovaclav/kucharka-recepty):
obsah (JSON) je oddelený od prezentácie (témy). Build renderuje JSON + tému → statické HTML.

## `data/members.json`

```json
{
  "members": [
    {
      "id": "branislav",
      "display_name": "Braňo",
      "full_name": "Branislav",
      "role": "otec",
      "color": "#1F6AA5",
      "avatar": "branislav.svg",
      "notes_default": ""
    }
  ]
}
```

| Pole | Typ | Poznámka |
|---|---|---|
| `id` | string | stabilný kľúč (`branislav`, `mama`, `andrej`, `tomas`, `rodina`) |
| `display_name` | string | krátke meno na rámčeku (sk) |
| `full_name` | string | voliteľné |
| `role` | string | `otec` · `mama` · `dieta` · `rodina` |
| `color` | hex | konzistentná farba pruhu / blokov |
| `avatar` | string | súbor v `assets/avatars/` (SVG alebo foto ≤ 256 px) |
| `meta` | object | voliteľné (škola, klub…) — len na detail |

Špeciálny člen `rodina` je spoločný pruh pre rodinné udalosti (nie je na menu dlaždiciach, alebo áno podľa témy).

## `data/YYYY-MM-DD.json`

```json
{
  "date": "2026-11-06",
  "locale": "sk-SK",
  "timezone": "Europe/Prague",
  "title": "Dnes",
  "now": "09:30",
  "weather": {
    "sample": true,
    "summary": "Polojasno",
    "temp_high_c": 12,
    "temp_low_c": 4,
    "icon": "partly-cloudy"
  },
  "timeline": {
    "start": "07:00",
    "end": "21:00"
  },
  "events": [],
  "highlights": {
    "family_notes": [],
    "reminders": [],
    "bring": [],
    "weekend": []
  }
}
```

### Počasie (`weather`)

| Pole | Typ | Poznámka |
|---|---|---|
| `sample` | bool | `true` = placeholder, ešte nie live dáta |
| `summary` | string | krátky text SK |
| `temp_high_c` / `temp_low_c` | number | °C |
| `icon` | string | kľúč ikony (`sunny`, `partly-cloudy`, `cloudy`, `rain`, `snow`) |

### Časová os (`timeline`)

`start` / `end` v `HH:MM` (24 h). Build môže predĺžiť `end`, ak niektorá udalosť končí neskôr.

### Udalosti (`events[]`)

```json
{
  "id": "andrej-baseball",
  "member": "andrej",
  "title": "Baseball",
  "start": "17:00",
  "end": "19:00",
  "all_day": false,
  "location": "telocvičňa Českolipská",
  "status": "confirmed",
  "flags": ["conflict"],
  "conflict_with": ["andrej-math-prep"],
  "notes": ["Vchod bočným vchodom, nie hlavným."],
  "reminders": []
}
```

| Pole | Typ | Poznámka |
|---|---|---|
| `id` | string | unikátne v rámci dňa |
| `member` | string | `members.id` (`rodina` = spoločné) |
| `title` | string | nadpis bloku |
| `start` / `end` | `HH:MM` \| `null` | pri `all_day: true` môžu byť `null` |
| `all_day` | bool | celodenná / bez pevného času |
| `location` | string | miesto (môže byť `""`) |
| `status` | string | `confirmed` · `unconfirmed` · `tentative` · `todo` |
| `flags` | string[] | napr. `conflict`, `needs-ride`, `pickup` |
| `conflict_with` | string[] | id iných udalostí, ktoré sa prekrývajú |
| `notes` | string[] | krátke poznámky pri udalosti |
| `reminders` | string[] | pripomienky viazané na udalosť |
| `time_note` | string | voliteľné, napr. „čas potvrdí telefonát“ |

### Highlights

Všetky polia sú polia reťazcov (alebo objektov s `text` + voliteľným `member`):

| Kľúč | Účel |
|---|---|
| `family_notes` | poznámky pre celú rodinu |
| `reminders` | pripomienky (môžu mať `member`) |
| `bring` | čo zobrať / vybaviť |
| `weekend` | výhľad na víkend |

Príklad položky s väzbou na člena:

```json
{ "text": "Vysvedčenie Finančnej gramotnosti odložiť do portfólia.", "member": "andrej" }
```

### `now`

Voliteľný `HH:MM` pre značku „teraz“ na časovej osi (pri mockupoch pevná; neskôr môže doplniť build podľa času generovania, alebo ľahký JS na ráme).

## Súbory a build

```
data/members.json          stabilní členovia
data/YYYY-MM-DD.json       denný obsah (bot ráno commitne)
themes/<id>/               CSS + fonts + theme.json
tools/build.py             JSON + téma → HTML (timeline ako HTML/CSS pri builde)
designs/<id>/              výstup tohto kola návrhov
```

Žiadna ťažká knižnica: timeline sa počíta pri builde (minúty → `top`/`height` v %), výstup je čisté HTML/CSS.
Na ráme beží takmer žiadny JS (len `autofocus` / prípadne neskôr tick „teraz“).

## Otvorené body schémy

- Či `members` žijú len v `members.json`, alebo sa snapshotujú aj do denného JSON.
- Ako označovať „nie je v kalendári“ vs. `unconfirmed`.
- Presný zoznam `flags` a či konflikty počíta bot, alebo build.
- Zdroj počasia (sample vs. API) a timezone (`Europe/Prague` vs. rám `Europe/Amsterdam`).
