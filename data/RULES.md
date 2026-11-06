# Denný JSON — pravidlá pre autora / bota

Tento súbor je **jediná kuchárka** pre generovanie `data/YYYY-MM-DD.json`.
Rovnaký súbor napája (1) jednu stránku na Nixplay ráme (pohľady Rodina → osoby)
a (2) textový ranný súhrn do chatu. Schéma: [`SCHEMA.md`](SCHEMA.md).
Členovia: [`members.json`](members.json).

Jazyk obsahu: **slovenčina**. Časy: **24 h** (`HH:MM`). `timezone`: `Europe/Prague`.

**Stránka je verejná (GitHub Pages).** Nikdy nedávaj na rám / do JSON: kódy vyzdvihnutia,
heslá, prihlasovacie údaje, presnú domácu adresu. Namiesto kódu: „kód v SMS“ / „kód v e-maile“.

---

## 0. Denný commit (generátor)

Ranný generátor **zapisuje len JSON**, nie HTML:

1. Vytvorí / prepíše `data/YYYY-MM-DD.json` (Europe/Prague, podľa tejto kuchárky).
2. V tom istom commite **vymaže** súbory `data/YYYY-MM-DD.json` staršie než **~14 dní**.
3. Push na `main` → Action `validate` + `build` → GitHub Pages (`site/index.html`).

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
**Title nikdy nie je** `Zajtra / Víkend`. Generátor zapíše title podľa dňa v týždni
(`date` v JSON, Europe/Prague):

| Deň `date` | `title` | Obsah položiek |
|---|---|---|
| Po–Št | **Zajtra** | nasledujúci deň |
| Pia | **Víkend** | sobota + nedeľa |
| So | **Pondelok** | pondelok (prípadne aj nedeľné položky, ak sú relevantné) |
| Ne | **Zajtra** | pondelok |

Víkend (So+Ne) sa počíta ako **jeden deň** voči „ďalšiemu“ pracovnému dňu → po sobote aj nedeľi je výhľad na pondelok.

Nový title OK, keď lepšie sedí (1–3 slová). Max **4 sekcie**, ~**8 položiek** spolu;
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
- [ ] Outlook `vyhlad` title podľa dňa: Po–Št/Ne **Zajtra**, Pia **Víkend**, So **Pondelok** (nikdy „Zajtra / Víkend“)
