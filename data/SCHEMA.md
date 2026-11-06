# Denný rodinný prehľad — JSON schéma (návrh)

Jeden súbor na deň: `data/YYYY-MM-DD.json`. Stabilní členovia: `data/members.json`.
**Pravidlá obsahu (kde čo patrí, duplicity, sekcie, chat):** [`RULES.md`](RULES.md).

Vzor podľa [kucharka-recepty](https://github.com/branovaclav/kucharka-recepty):
obsah (JSON) oddelený od prezentácie (témy). Build: JSON + téma → statické HTML.

## `data/members.json`

Bezo zmeny oproti predchádzajúcemu návrhu — pozri pole `members[]`
(`id`, `display_name`, `role`, `color`, `avatar`, voliteľné `meta`).

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
  "sections": [
    {
      "id": "rodina",
      "title": "Rodina",
      "items": [
        { "text": "…", "member": "andrej" }
      ]
    }
  ]
}
```

### Počasie (`weather`)

| Pole | Typ | Poznámka |
|---|---|---|
| `sample` | bool | `true` = placeholder |
| `summary` | string | krátky text SK |
| `temp_high_c` / `temp_low_c` | number | °C |
| `icon` | string | `sunny` · `partly-cloudy` · `cloudy` · `rain` · `snow` |

### Časová os (`timeline`)

`start` / `end` v `HH:MM`. Build môže predĺžiť `end`, ak udalosť končí neskôr.

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
  "flags": [],
  "conflict_with": [],
  "notes": ["Vchod bočným vchodom, nie hlavným."],
  "reminders": [],
  "time_note": null
}
```

| Pole | Typ | Poznámka |
|---|---|---|
| `id` | string | unikátne v rámci dňa |
| `member` | string | `members.id` |
| `title` | string | nadpis |
| `start` / `end` | `HH:MM` \| `null` | bez `start` → nečasovaný pás |
| `all_day` | bool | celodenná |
| `location` | string | môže byť `""` |
| `status` | string | `confirmed` · `unconfirmed` · `tentative` · `todo` |
| `flags` | string[] | `conflict` · `needs-ride` · `pickup` · `time-tbd` |
| `conflict_with` | string[] | id prekrývajúcich sa udalostí |
| `notes` / `reminders` | string[] | viazané **len** na túto udalosť |
| `time_note` | string \| null | keď chýba `start` |

### Sekcie (`sections[]`) — dynamický sidebar / chat

**Nie** sú fixné kľúče `family_notes` / `reminders` / `bring` / `weekend`.
Autor volí `title` (SK); témy vykreslia sekcie v poradí poľa. Prázdna sekcia sa nezapisuje.

```json
{
  "id": "pripomienky",
  "title": "Pripomienky",
  "items": [
    { "text": "Diplom odložiť do portfólia.", "member": "andrej" },
    { "text": "…", "member": "tomas", "event_id": "tomas-tripartita" }
  ]
}
```

| Pole | Typ | Poznámka |
|---|---|---|
| `id` | string | slug sekcie |
| `title` | string | voľný nadpis SK (odporúčané štandardy v RULES.md) |
| `items[].text` | string | povinné |
| `items[].member` | string? | voliteľný chip |
| `items[].event_id` | string? | voliteľný odkaz; predvolene vynechať |

Odporúčané `id` / `title`: `rodina` / Rodina, `pripomienky` / Pripomienky,
`zobrat` / Zobrať / vybaviť, `vyhlad` / Výhľad — pozri RULES.md §3.

### `now`

Voliteľný `HH:MM` pre značku „teraz“ (mockupy pevné; neskôr čas generovania).

## Súbory a build

```
data/RULES.md              kuchárka pre autora/bota (+ chat derivácia)
data/SCHEMA.md             tento súbor
data/members.json
data/YYYY-MM-DD.json
themes/<id>/
tools/build.py             sections → sidebar; member page = events + položky zo sections
designs/<id>/              výstup návrhov
```

Timeline sa počíta pri builde (minúty → `top`/`height` %). Na ráme takmer žiadny JS.

## Otvorené body schémy

- Snapshot `members` do denného JSON vs. vždy `members.json`.
- Zdroj počasia a timezone (`Europe/Prague` vs. rám `Europe/Amsterdam`).
- Finálny formát chat postu (Markdown vs. plain) — RULES.md §6 popisuje obsah, nie transport.
