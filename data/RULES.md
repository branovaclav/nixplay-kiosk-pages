# Denný JSON — pravidlá pre autora / bota

Tento súbor je **jediná kuchárka** pre generovanie `data/YYYY-MM-DD.json`.
Rovnaký súbor napája (1) prehľad na Nixplay ráme a (2) textový ranný súhrn do chatu.
Schéma polí: [`SCHEMA.md`](SCHEMA.md). Stabilní členovia: [`members.json`](members.json).

Jazyk obsahu: **slovenčina**. Časy: **24 h** (`HH:MM`). Timezone poľa `timezone`: `Europe/Prague`
(rám beží v `Europe/Amsterdam` — pri hraniciach dňa pozor).

---

## 1. Kde čo patrí (tri miesta, žiadna štvrtá)

| Miesto v JSON | Kedy |
|---|---|
| **Timeline** (`events[]` s `start` + `end`, `all_day: false`) | Konkrétny začiatok (a zvyčajne aj koniec) dnes. |
| **Nečasovaný pás** (`events[]` bez `start`, alebo `all_day: true`) | Patrí k dnešku a osobe/rodine, ale **nemá pevný čas**: time TBD, „do zatváracej doby“, celý deň, „ráno po telefonáte“. |
| **Sidebar / chat sekcie** (`sections[]`) | **Nie je to udalosť**: poznámky, pripomienky, výhľad na ďalšie dni, rodinné správy. |

Nikdy nevymýšľaj štvrtý kanál. Ak má položka čas → timeline. Ak je to dnešná úloha/návšteva bez času → nečasovaný pás. Inak → `sections`.

### 1.1 Timeline vs nečasovaný pás (udalosti)

- `start` / `end` sú `HH:MM` alebo `null`.
- Ak existuje `start` → položka ide na časovú os (build ju umiestni podľa minút).
- Ak `start` chýba (alebo `all_day: true`) → nečasovaný pás nad osou.
- `time_note` (napr. „čas potvrdí telefonát“, „do zatváracej doby“) je **povinný**, keď chýba `start`.
- Člen `member` je vždy `members.id` (`branislav`, `mama`, `andrej`, `tomas`, `rodina`).

### 1.2 Sidebar = `sections[]`

```json
"sections": [
  {
    "id": "rodina",
    "title": "Rodina",
    "items": [
      { "text": "…", "member": "andrej", "event_id": "optional-id" }
    ]
  }
]
```

- Poradie poľa = poradie na ráme aj v chate.
- **Nikdy nezapisuj prázdnu sekciu** (`items` musí mať ≥ 1).
- `title` je voľný slovenský text (autor ho volí podľa dňa).
- `id` je stabilný slug (`rodina`, `pripomienky`, `vyhlad`, …) — na témy a budúce filtre.
- `member` na položke: voliteľné; použi, keď sa text týka jednej osoby.
- `event_id`: voliteľný odkaz na `events[].id`, ak položka súvisí s udalosťou, ale **nie je** jej duplikátom (výnimočné; predvolene vynechaj).

---

## 2. Žiadna duplicita — fakt na jednom mieste

Každý fakt je **práve raz**.

| Fakt | Kde žije | Kde **nie** |
|---|---|---|
| Čas a miesto udalosti | `events[]` | `sections` |
| Poznámka špecifická pre udalosť (vchod, parkovanie, kód vyzdvihnutia) | `events[].notes` / `reminders` | `sections` |
| „Treba potvrdiť“ | `status: "unconfirmed"` (príp. `tentative`) | samostatná pripomienka v `sections` |
| Konflikt dvoch udalostí | `flags: ["conflict"]` + `conflict_with` na **oboch** | dlhý opis toho istého v `sections` (stačí krátka akcia, ak treba rozhodnúť) |
| Potreba odvozu | `flags: ["needs-ride"]` na udalosti | „nezabudni odvoz“ v `sections`, ak nič nepridáva |
| Rodinná správa bez času | `sections` (napr. Rodina) | falošná udalosť na osi |
| Výhľad na víkend / zajtra | `sections` (Výhľad) | `events` dnešného dňa |

**Príklady (6. 11. 2026):**

- Kód Sportisimo `7717040101` → `notes` na udalosti vyzdvihnutia, **nie** v sekcii Zobrať.
- Tenis „treba potvrdiť“ → `status: "unconfirmed"`, **nie** položka „Potvrdiť tenis“.
- Lístok s e-mailom do peračníka → `reminders` na udalosti tripartity / informatiky Tomáša, **nie** druhýkrát v Pripomienkach.
- Diplom Finančnej gramotnosti → `sections` (Pripomienky, `member: andrej`), lebo to nie je viazané na dnešný blok v kalendári.

Ak by sidebar len opakoval status/flag/note udalosti, položku **vynechaj**.

---

## 3. Sekcie — názvy, zlúčenie, limity, poradie

### 3.1 Odporúčané štandardné názvy

Použi, keď sedí význam (konzistentné znenie deň čo deň):

| `id` (odporúčané) | `title` | Typický obsah |
|---|---|---|
| `rodina` | Rodina | spoločné správy, škola → rodičia, domácnosť |
| `pripomienky` | Pripomienky | čo nezabudnúť a **nie je** už na udalosti |
| `zobrat` | Zobrať / vybaviť | balenie, nákup, vybavenie **mimo** notes udalosti |
| `vyhlad` | Výhľad | zajtra / víkend / budúce dni |

Nový `title` je OK, keď lepšie sedí (napr. „Škola“, „Šport“, „Zdravie“) — stále krátky, 1–3 slová, s veľkým východiskovým písmenom.

### 3.2 Zlúčiť vs rozdeliť

- **Zlúč** položky pod jeden title, ak majú rovnaký účel (viac pripomienok → jedna Pripomienky).
- **Rozdeľ** novú sekciu, len ak iný účel alebo iná priorita čítania (napr. urgentná Rodina oddelene od Výhľadu).
- Jedna položka ≠ jedna sekcia, ak sa zmestí pod existujúci title.

### 3.3 Limity pre 1024×768 (sidebar ~280 px × ~640 px)

Orientačné maximum, aby sidebar neorezal text na ráme:

- **Najviac 4 sekcie** za deň.
- **Najviac ~8 položiek** spolu vo všetkých sekciách.
- Jedna položka: ideálne **≤ 140 znakov**; tvrdé maximum ~200.
- Ak je toho viac: skráť, zlúč, alebo nechaj detail na `events[].notes` a v sekcii len odkaz-úroveň („pozri Baseball — vchod“ len ak fakt ešte nie je na udalosti — predvolene **neodkazuj**, fakt nechaj na udalosti).

### 3.4 Poradie dôležitosti

1. Rodina / spoločné rozhodnutia večer a detský šport (konflikty, odvozy), ktoré ešte nie sú len flagmi.
2. Pripomienky viazané na deti.
3. Osobné (dospelí) vybavenia, ktoré nie sú na udalosti.
4. Výhľad (víkend, zajtra) — vždy na konci.

V rámci sekcie: najprv položky s `member` detí / `rodina`, potom dospelí.

### 3.5 Tagovanie člena

- `member` nastav, keď je adresát jasný jednému človeku.
- Rodinné správy bez jedného adresáta: `member` vynechaj.
- Na ráme sa pri `member` zobrazí farebný chip mena.

---

## 4. Status a flagy

### 4.1 `status`

| Hodnota | Význam | UI |
|---|---|---|
| `confirmed` | platí | bežný blok (štítok netreba) |
| `unconfirmed` | treba potvrdiť | čiarkovaný okraj + „treba potvrdiť“ |
| `tentative` | nezáväzné / skôr nápad | čiarkovaný + „nezáväzné“ |
| `todo` | úloha (často nečasovaná) | štítok „úloha“ |

### 4.2 `flags[]`

| Flag | Význam |
|---|---|
| `conflict` | prekrýva sa s inou udalosťou toho istého člena (alebo logický konflikt) |
| `needs-ride` | treba odvoz / doprovod |
| `pickup` | vyzdvihnutie zásielky / objednávky |
| `time-tbd` | čas ešte nie je známy (spravidla nečasovaný pás) |

### 4.3 Detekcia konfliktov

1. Zober timed udalosti **rovnakého** `member` (nie `rodina` vs osoba, pokiaľ nie je explicitný konflikt).
2. Intervaly `[start, end)` sa pretínajú → na **obe** daj `flags: ["conflict"]` a navzájom `conflict_with: ["<id>"]`.
3. Autor/bot to spočíta pri zápise JSON; build konflikt **nevymýšľa**, len vykreslí flagy.
4. Do `sections` daj konflikt len ak treba **rozhodnutie navyše** (jedna krátka akčná veta), nie opis časov znova.

---

## 5. Štýl textu

- Slovenčina, krátke vety, holé fakty.
- Časy vždy `H:MM` alebo `HH:MM` v 24 h (v JSON vždy `HH:MM`).
- Miesta stručne (`telocvičňa Českolipská`, `OC Krakov Bohnice`).
- Žiadne tajomstvá navyše (heslá, celé prihlasovacie údaje). **Kódy vyzdvihnutia sú OK** v `notes` udalosti.
- Bez emoji. Bez anglických UI reťazcov v obsahu.
- `weather.sample: true`, kým nie sú live dáta.

---

## 6. Chatový ranný súhrn (derivácia z toho istého JSON)

Chat post **nepridáva** nové fakty. Zostaví sa len z JSON:

1. **Hlavička:** dátum (`date`) + weekday, počasie (`weather.summary`, teploty; ak `sample`, označ „ukážka“).
2. **Časová os:** timed `events` zoradené podľa `start`; riadok: `HH:MM–HH:MM · Meno · názov · miesto` (+ krátky status/flag ak nie `confirmed`).
3. **Bez času:** nečasované / all-day udalosti rovnakým štýlom, namiesto času `time_note` alebo „celý deň“.
4. **Sekcie:** pre každú položku v `sections` v danom poradí: `## {title}` potom `- {Meno: }{text}`.
5. **Preskoč** prázdne časti (ak nie sú timed events, vynechaj blok osi; prázdne sekcie v súbore nie sú).

Odporúčaný tón chatu: rovnaké krátke slovenské vety ako na ráme; jeden príspevok, žiadne duplicitné „nezabudni potvrdiť“, ak už je `unconfirmed` pri udalosti.

---

## 7. Kontrolný zoznam pred commitom

- [ ] Každý fakt práve na jednom mieste (timeline **alebo** nečasovaný pás **alebo** sections **alebo** notes udalosti).
- [ ] `unconfirmed` namiesto sidebar pripomienky „potvrdiť“.
- [ ] Konflikty majú `conflict` + `conflict_with` na oboch stranách.
- [ ] Žiadna prázdna sekcia; ≤ 4 sekcie, ≤ ~8 položiek.
- [ ] Slovak + 24 h; `member` id z `members.json`.
- [ ] Chat aj rám vedia prečítať súbor bez ďalšieho kontextu.
