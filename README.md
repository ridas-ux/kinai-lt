# Kinai.lt

Vilniaus, Kauno ir Klaipėdos kino teatrų repertuaras vienoje vietoje.

- **Vilnius:** Forum Cinemas Vingis, Apollo Akropolis ir Vilnius Outlet, Vue Ozas, Senamiesčio ir Paupio „Pasaka“, „Skalvija“.
- **Kaunas:** Forum Cinemas Kaunas, Cinamon Mega, kino centras „Romuva“.
- **Klaipėda:** Forum Cinemas Klaipėda.

Viršuje galima pasirinkti miestą; be pasirinkimo rodomi visų miestų seansai.

Kasdien du kartus (apie 06:00 ir 15:00 Vilniaus laiku) GitHub automatiškai surenka 8 dienų seansus su pavadinimais, aprašymais, plakatais, anonsais ir bilietų nuorodomis, o tada atnaujina svetainę. Serverio nuomotis nereikia, viskas nemokama.

## Kas yra kur

| Failas | Kam skirtas |
|---|---|
| `scripts/scrape.mjs` | Pagrindinis scenarijus: paleidžia visus šaltinius, sujungia filmus, įrašo `site/data.json` |
| `scripts/sources/*.mjs` | Po vieną failą kiekvienam kino teatrų tinklui |
| `scripts/lib.mjs` | Bendros funkcijos: pavadinimų valymas, žanrai, amžiaus cenzai |
| `site/` | Pati svetainė (`index.html`, `app.js`, `style.css`) |
| `site/streaming.json` | Netflix / HBO Max / Prime Video sąrašas, pildomas rankiniu būdu |
| `.github/workflows/update.yml` | Kasdienis automatinis paleidimas ir svetainės paskelbimas |

## Paleidimas GitHub'e (vieną kartą, ~15 min.)

1. **Susikurk paskyrą** github.com (jei dar neturi).
2. **Naujas repozitorijus:** viršuje dešinėje „+“ → *New repository*. Pavadinimas `kinai-lt`, pasirink **Public** (nemokamas GitHub Pages veikia viešiems repozitorijams) → *Create repository*.
3. **Įkelk failus:** naujame repozitorijuje spausk *uploading an existing file*, nutempk į langą **visą išarchyvuoto aplanko turinį** → *Commit changes*.
   - Svarbu: aplankas `.github` paslėptas. Mac'e Finder'yje paspausk **Cmd + Shift + .**, kad jis pasirodytų, ir nutempk kartu su kitais.
   - Jei `.github` vis tiek neįsikėlė: *Add file → Create new file*, pavadinime įrašyk `.github/workflows/update.yml` ir įklijuok to failo turinį.
4. **Įjunk svetainę:** *Settings → Pages → Build and deployment → Source:* pasirink **GitHub Actions**.
5. **Pirmas paleidimas:** skirtukas *Actions* → kairėje „Atnaujinti repertuarą“ → *Run workflow*. Po 2–3 min. svetainė veiks adresu `https://TAVO-VARDAS.github.io/kinai-lt/`.
6. **Patikrink žurnalą:** atidaryk paleidimą → *build* → „Surinkti repertuarą“. Ten matysi, kiek seansų gauta iš kiekvieno kino teatro:
   ```
   ✔ Apollo: 480 seansų, 52 filmų
   ✔ Forum Cinemas: 190 seansų, 30 filmų
   ...
   ```

Toliau viskas vyksta savaime. Jei paleidimas nepavyksta, GitHub atsiunčia laišką.

## Domenas kinai.lt

1. **Užregistruok** `kinai.lt` pas bet kurį akredituotą .lt paslaugų teikėją (sąrašas domreg.lt). 2026-10-21 domenas buvo laisvas.
2. Paslaugų teikėjo **DNS nustatymuose** pridėk:
   | Tipas | Vardas | Reikšmė |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | TAVO-VARDAS.github.io |
3. GitHub: *Settings → Pages → Custom domain* įrašyk `kinai.lt` → *Save*. Kai DNS įsigalios (nuo kelių minučių iki para), pažymėk *Enforce HTTPS*.
4. Rekomenduojama: *Settings → Pages* viršuje patvirtink domeną (*Verify domain*), kad niekas kitas negalėtų jo prijungti prie savo GitHub puslapio.

## Lankytojų prisijungimas (Google ir el. paštas)

Lankytojai gali prisijungti per Google arba el. paštu su slaptažodžiu. Tada jų širdelės, mėgstami žanrai ir kino teatrai saugomi paskyroje ir rekomendacijos („Tau“ skiltis) būna tos pačios visuose įrenginiuose. Be prisijungimo viskas veikia kaip anksčiau – pomėgiai saugomi tik naršyklėje.

Naudojama **Firebase** (Google) – nemokamo plano užtenka. Failai: `site/auth.js` (prisijungimas ir sinchronizavimas), `site/firebase-config.js` (projekto raktai), `firestore.rules` (duomenų apsauga). Kol `firebase-config.js` tuščias, mygtukas „Prisijungti“ nerodomas.

Vieną kartą (~10 min.):

1. **console.firebase.google.com** → *Create a project* → pavadinimas `kinai-lt` (Google Analytics nebūtina).
2. **Web programėlė:** projekto pradžioje spausk `</>` → pavadinimas `kinai.lt` → *Register app*. Nukopijuok rodomus `apiKey`, `authDomain`, `projectId`, `appId` į `site/firebase-config.js`.
3. **Authentication** → *Get started* → *Sign-in method*: įjunk **Google** (nurodyk palaikymo el. paštą) ir **Email/Password**.
4. **Authentication → Settings → Authorized domains** → *Add domain*: `kinai.lt` ir `www.kinai.lt`.
5. **Firestore Database** → *Create database* → vieta `eur3 (europe-west)` → *production mode*. Skirtuke *Rules* įklijuok `firestore.rules` turinį → *Publish*.
6. Laiškų kalba (slaptažodžio atkūrimas, patvirtinimas): *Authentication → Templates* → kalba *Lithuanian*.

Vėliau galima pridėti Apple (reikia Apple Developer paskyros), Facebook ir telefono numerį – *Sign-in method* sąraše, o `auth.js` papildyti atitinkamu mygtuku.

Duomenys Firestore: `users/{uid}` → `liked` (patikę filmai, normalizuotais pavadinimais), `favGenres`, `cinemas`, `name`, `updated`. Lankytojas mato ir keičia tik savo įrašą. Paskyrą ištrinti: *Authentication → Users* ir *Firestore → users*.

## Žiūrėti namuose

`scripts/streaming.mjs` kartu su repertuaru atnaujina `site/streaming.json`:

| Platforma | Šaltinis |
|---|---|
| Netflix | oficialus Lietuvos savaitės TOP 10 (netflix.com/tudum/top10) |
| Go3 | go3.lt „TOP 20 žiūrimiausių filmų nuomoje“ ir „Naujai pridėti“ |
| LRT Epika | epika.lrt.lt „Epikos web topas“ ir „Naujienos“ |
| Apple TV | oficialus Apple populiariausių filmų sąrašas Lietuvoje |
| HBO Max, Prime Video | rankiniu būdu: `scripts/streaming-manual.json` (viešo Lietuvos TOP nėra) |

IMDb ir Rotten Tomatoes vertinimai bei plakatai imami iš **OMDb**. Raktas laikomas GitHub paslaptyje: *Settings → Secrets and variables → Actions → New repository secret*, vardas `OMDB_KEY`. Be rakto sąrašai veikia, tik be vertinimų.

## Kaip veikia duomenų rinkimas

| Kino teatras | Šaltinis | Ką gauname |
|---|---|---|
| Apollo | `apollokinas.lt/xml/Schedule`, `/xml/Events` | seansai, aprašymai, plakatai, anonsai, režisieriai, aktoriai |
| Forum Cinemas (Vilnius, Kaunas, Klaipėda) | `restapi.forumcinemas.lt/api` | seansai, aprašymai, plakatai, anonsai |
| Vue | `vuekinas.lt/data/filmswithshowings/1001` | seansai, trumpi aprašymai, plakatai |
| Pasaka | `api.pasaka.lt/movies` | seansai, aprašymai, plakatai, anonsai |
| Skalvija | `skalvija.lt/wp-json/data/v1/get_shows/` | seansai, aprašymai, plakatai, bilietų nuorodos |
| Cinamon Mega (Kaunas) | `cinamonkino.com/api/schedule` | seansai, aprašymai, plakatai, anonsai, bilietų nuorodos |
| Romuva (Kaunas) | `kcromuva.lt/repertuaras/` (HTML) | seansai, aprašymai, plakatai, režisieriai |

- Tas pats filmas iš skirtingų kino teatrų sujungiamas pagal pavadinimą. „5 eurų savaitė:“, „(dubliuotas)“, „Lenkų kino festivalis“ ir pan. nuimami nuo pavadinimo ir rodomi kaip žymos prie seanso.
- Plakatas imamas pirmiausia iš Forum (didžiausia raiška), toliau iš Apollo, Pasakos, Vue ir Skalvijos. Aprašymas imamas ilgiausias.
- **Jei kurio nors kino teatro svetainė neatsako**, paliekami jo vakarykščiai seansai. Jei duomenų gaunama per mažai (< 50 seansų), svetainė neatnaujinama, kad neištuštėtų.

## Ką reikės prižiūrėti

- **Kino teatrai keičia svetaines.** Jei žurnale prie kurio nors atsiras ✖, pataisymas paprastai užtrunka 10–30 min., ir tai tik to kino teatro failas `scripts/sources/…`.
- **Vue gali blokuoti GitHub serverius.** Jei taip atsitiks, reikės kito paleidimo vietos (pvz. pigaus VPS), o kiti kino teatrai veiks toliau.
- **`site/streaming.json`** atnaujink kartą per savaitę ar mėnesį: įrašyk tik tuos pavadinimus, kurie tikrai yra platformoje Lietuvoje. Redaguoti galima tiesiai GitHub'e (pieštuko ženklas).
- **Leidimai.** Plakatai ir aprašymai priklauso platintojams ir kino teatrams. Prieš reklamuojant svetainę verta parašyti kino teatrams ir susitarti. Jiems tai dažniausiai naudinga, nes visi bilietų pirkimai nukreipiami į jų svetaines.

## Paleidimas savo kompiuteryje (nebūtina)

Reikia Node.js 20 ar naujesnio (nodejs.org).

```bash
node scripts/scrape.mjs        # surenka duomenis į site/data.json
npx serve site                 # atidaro svetainę http://localhost:3000
DAYS=14 node scripts/scrape.mjs  # surinkti 14 dienų į priekį
```
