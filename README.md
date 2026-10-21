# Kinai.lt

Visų Vilniaus kino teatrų repertuaras vienoje vietoje: Forum Cinemas Vingis, Apollo Akropolis ir Vilnius Outlet, Vue Ozas, Senamiesčio ir Paupio „Pasaka“, „Skalvija“.

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

## Kaip veikia duomenų rinkimas

| Kino teatras | Šaltinis | Ką gauname |
|---|---|---|
| Apollo | `apollokinas.lt/xml/Schedule`, `/xml/Events` | seansai, aprašymai, plakatai, anonsai, režisieriai, aktoriai |
| Forum Cinemas | `restapi.forumcinemas.lt/api` | seansai, aprašymai, plakatai, anonsai |
| Vue | `vuekinas.lt/data/filmswithshowings/1001` | seansai, trumpi aprašymai, plakatai |
| Pasaka | `api.pasaka.lt/movies` | seansai, aprašymai, plakatai, anonsai |
| Skalvija | `skalvija.lt/wp-json/data/v1/get_shows/` | seansai, aprašymai, plakatai, bilietų nuorodos |

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
