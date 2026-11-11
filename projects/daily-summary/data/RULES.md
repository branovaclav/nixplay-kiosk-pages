# Denný JSON — pravidlá pre autora / bota

Tento súbor je **jediná kuchárka** pre generovanie
`projects/daily-summary/data/YYYY-MM-DD.json`.
Rovnaký súbor napája (1) jednu stránku na Nixplay ráme (pohľady Rodina → osoby)
a (2) textový ranný súhrn do chatu. Schéma: [`SCHEMA.md`](SCHEMA.md).
Členovia: [`members.json`](members.json).

Jazyk obsahu: **slovenčina**. Časy: **24 h** (`HH:MM`). `timezone`: `Europe/Prague`.

**Stránka je verejná (GitHub Pages).** Nikdy nedávaj na rám / do JSON: kódy vyzdvihnutia,
heslá, prihlasovacie údaje, presnú domácu adresu. Namiesto kódu: „kód v SMS“ / „kód v e-maile“.

---

## 0. Denný commit (generátor)

Dva behy denne (Europe/Prague) — **jeden súbor na deň** slúži večer (ako „zajtra“) aj ráno (ako „dnes“):

| Beh | Úloha |
|---|---|
| **Večer (~18:55)** | Hlavný generátor: vytvorí / prepíše `projects/daily-summary/data/<zajtra>.json`. |
| **Ráno (~06:55)** | Len prekontroluje kalendáre; nový commit **len ak** sa niečo zmysluplne zmenilo. Inak reuse večerného súboru. |

Generátor **zapisuje len JSON**, nie HTML:

1. Vytvorí / aktualizuje `projects/daily-summary/data/YYYY-MM-DD.json` (Europe/Prague, podľa tejto kuchárky).
2. V tom istom commite **vymaže** súbory `projects/daily-summary/data/YYYY-MM-DD.json` staršie než **~14 dní**.
3. Push na `main` → Action `validate` + `build` → GitHub Pages (`site/index.html` + `site/daily-summary/`).

Relatívne popisky na ráme (**Zajtra** / **Rodinný prehľad**, názov výhľadu) počíta **klient** podľa Prague času pri pozeraní — nie pri generovaní. Pozri §3.

`members.json` sa mení zriedka (farby, avatary, `theme_schedule`).  
Lokálne / CI: `python3 tools/validate.py` musí prejsť pred deployom.

---

## 1. Kde čo patrí

| Miesto | Kedy |
|---|---|
| **Timeline** (`events[]` s `start`) | Konkrétny začiatok dnes. |
| **Nečasovaný pás** (bez `start` / `all_day`) | Dnes + osoba(y), bez pevného času. |
| **`sections[]`** | Nie je udalosť: poznámky, pripomienky, výhľad. |

### 1.1 Udalosti a `members[]`

- Každá udalosť má **`members: ["branislav", …]`** (pole id z `members.json`).
- **Žiadny stĺpec Rodina** na kalendári. Spoločná udalosť = všetci štyria v `members`,
  alebo podmnožina; build ju roztiahne cez stĺpce zúčastnených.
- Ak sú stĺpce **súvislé**, jeden blok cez ne; ak nie, rovnaký štýl bloku v každom stĺpci.
- `time_note` povinný, keď chýba `start`.

### 1.2 Sekcie

```json
"sections": [
  {
    "id": "pripomienky",
    "title": "Pripomienky",
    "items": [
      {
        "text": "Krátky text (pohľad Rodina).",
        "detail": "Dlhší text (pohľad člena).",
        "member": "andrej"
      }
    ]
  }
]
```

- `text` — povinný, krátky (sidebar v Rodina).
- `detail` — voliteľný; v pohľade člena, inak sa použije `text`.
- `member` — voliteľný; v pohľade člena sa ukazujú položky s týmto `member` **alebo bez `member`** (rodinné).
- **`family: false`** (alebo `level: "detail"`) — položka sa **nezobrazí v pohľade Rodina**; len v relevantnom pohľade člena. Použi pre menej dôležité / osobné detaily, ktoré by Rodinu zahltili. Rodina = len to, čo sa zmestí a naozaj treba vidieť naraz.
- Prázdna sekcia sa **nezapisuje**. Poradie poľa = poradie na ráme aj v chate.

---

## 2. Žiadna duplicita

Fakt práve raz. Status `unconfirmed` namiesto sidebar „potvrdiť“. Kódy / heslá na udalosti
**vôbec nie** (verejný web). Notes špecifické pre udalosť žijú na udalosti, nie v `sections`.

---

## 3. Sekcie — názvy a limity

### Štandardné názvy

| `id` | `title` |
|---|---|
| `rodina` | Rodina |
| `pripomienky` | Pripomienky |
| `zobrat` | Zobrať / vybaviť |
| `vyhlad` | **dynamický** — pozri nižšie |

Sekcia `vyhlad` sa na ráme kreslí ako **samostatný box** (oddelený od ostatných sekcií).

### Výhľad — `outlook.{from,to}` (povinné)

Generátor ukladá **cieľové dátumy** výhľadu, nie finálny relatívny názov:

```json
{
  "id": "vyhlad",
  "title": "Streda",
  "outlook": { "from": "2026-11-11", "to": "2026-11-11" },
  "items": [ … ]
}
```

| Pole | Význam |
|---|---|
| `outlook.from` | prvý cieľový deň (YYYY-MM-DD) |
| `outlook.to` | posledný cieľový deň (rovnaký ako `from` pri jednom dni) |
| `title` | **fallback** (weekday / Víkend), kým JS neprepočíta; nikdy `Zajtra / Víkend` |

Klient (Europe/Prague, každú minútu) nastaví nadpis boxu podľa `from`/`to` voči **dňu pozerania**:

| Cieľ | Nadpis na ráme |
|---|---|
| span So+Ne | **Víkend** |
| jeden deň = zajtra voči teraz | **Zajtra** |
| inak jeden deň | weekday (`Pondelok` … `Nedeľa`) |

Príklad: utorkový súbor s výhľadom na stredu — v pondelok večer ukáže **Streda**, v utorok ráno **Zajtra**. Ten istý JSON, bez regenerácie.

Obsah položiek: Po–Št → nasledujúci deň; Pia → So+Ne; So/Ne → pondelok (víkend So+Ne = jeden „deň“ voči ďalšiemu pracovnému).

Nový title OK ako fallback, keď lepšie sedí (1–3 slová). Max **4 sekcie**, ~**8 položiek** spolu;
`text` ≤ ~100 znakov, `detail` ≤ ~220.

Poradie: Rodina / detský šport → Pripomienky detí → osobné → výhľad (`vyhlad`) na konci.

---

## 4. Status a flagy

`confirmed` · `unconfirmed` · `tentative` · `todo`  
Flagy: `conflict` · `needs-ride` · `pickup` · `time-tbd`

Konflikt: pretínajúce sa timed intervaly **tej istej osoby** v `members` →
`conflict` + `conflict_with` na oboch. Počíta autor/bot; build len kreslí.

---

## 5. Štýl textu

Slovak, krátke, 24 h. Bez emoji. Bez tajomstiev (pozri úvod). `weather.sample: true`, kým nie live (badge UKÁŽKA sa nerenderuje).

---

## 6. Chatový súhrn (z toho istého JSON)

1. Hlavička: dátum + počasie.  
2. Timed events podľa `start` (`HH:MM–HH:MM · mená · názov · miesto`).  
3. Nečasované.  
4. Sekcie: `## {title}` + `text` (chat používa krátky `text`; `detail` len ak treba doplniť).  
5. Preskoč prázdne časti.

---

## 7. Rám — jedna stránka, pohľady

Nie sú samostatné HTML odkazy. Pohľady: **Rodina → Braňo → Zuzka → Andrej → Tomáš → (cyklus)**.  
Tab / Enter = ďalší, Shift+Tab = predchádzajúci; **krátky shake (Alt+←) = hneď Rodina**; idle ~60 s → Rodina.  
(Dlhý shake môže neskôr ísť na iný URL — nespoliehaj sa naň pre reset pohľadu.)  
Kalendár: 4 stĺpce osôb (Rodina pohľad) alebo široký stĺpec osoby + úzky „ostatní“ (pohľad člena).

Obnova stránky: raz denne o `refresh_at` (predvolene **06:30** Europe/Prague, po rannom súhrne), plus ak dátum na stránke ≠ dnes → skok na dnešný súbor.

Téma **dark** / **light**: podľa `theme_schedule` — predvolene `mode: sun` (východ/západ, Praha); fallback `fixed` 19:00–06:30; `?theme=light|dark` na test.

---

## 8. Checklist

- [ ] `members[]` na každej udalosti; žiadny lane `rodina`
- [ ] `text` (+ `detail` kde dáva zmysel); žiadna prázdna sekcia
- [ ] Žiadne kódy / heslá / presná adresa
- [ ] `unconfirmed` namiesto sidebar „potvrdiť“
- [ ] Konflikty označené na oboch stranách
- [ ] Outlook `vyhlad` má `outlook.from` / `outlook.to`; `title` len fallback (nikdy „Zajtra / Víkend“)
