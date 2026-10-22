// Surenka Vilniaus, Kauno ir Klaipėdos kino teatrų repertuarą ir įrašo į site/data.json.
// Paleidimas: node scripts/scrape.mjs   (DAYS=10 node scripts/scrape.mjs – kiek dienų į priekį)
import { readFile, writeFile } from "node:fs/promises";
import { key, vilniusDays } from "./lib.mjs";
import { apollo } from "./sources/apollo.mjs";
import { forum } from "./sources/forum.mjs";
import { vue } from "./sources/vue.mjs";
import { pasaka } from "./sources/pasaka.mjs";
import { skalvija } from "./sources/skalvija.mjs";
import { cinamon } from "./sources/cinamon.mjs";
import { romuva } from "./sources/romuva.mjs";

const OUT = new URL("../site/data.json", import.meta.url);
const DAYS = vilniusDays(+(process.env.DAYS || 8));

// Šaltinių eiliškumas: kas pirmesnis, to pavadinimas ir aprašymas laimi.
const SOURCES = [
  ["Apollo", apollo, ["aa", "ao"]],
  ["Forum Cinemas", forum, ["fv", "fk", "fkl"]],
  ["Pasaka", pasaka, ["ps", "pp"]],
  ["Vue", vue, ["vue"]],
  ["Skalvija", skalvija, ["sk"]],
  ["Cinamon Mega", cinamon, ["cm"]],
  ["Romuva", romuva, ["rk"]],
];
const POSTER_PRIORITY = ["forum", "apollo", "cinamon", "pasaka", "vue", "skalvija", "romuva"];

const ALIAS = { "forgotten island": "uzmirstoji sala" };

let previous = null;
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch {}

const report = [];
const raw = [];
for (const [name, fn, cinemas] of SOURCES) {
  const t0 = Date.now();
  try {
    const r = await fn(DAYS);
    if (!r.sessions.length) throw new Error("negauta nė vieno seanso");
    raw.push(r);
    report.push(`✔ ${name}: ${r.sessions.length} seansų, ${r.films.size} filmų (${((Date.now() - t0) / 1000).toFixed(1)} s)${r.note ? " – " + r.note : ""}`);
  } catch (e) {
    report.push(`✖ ${name}: ${e.message}`);
    // Jei šaltinis neveikia, paliekame vakarykščius šio kino teatro seansus, kad svetainė neištuštėtų.
    if (previous) {
      const keep = previous.sessions.filter((s) => cinemas.includes(s.c) && DAYS.includes(s.t.slice(0, 10)));
      const films = new Map();
      const sessions = keep.map((s) => {
        const f = previous.films[s.f];
        films.set(`prev:${s.f}`, { ...f, titleTags: [] });
        return { film: `prev:${s.f}`, cinema: s.c, start: s.t, url: s.u, tags: s.g || [] };
      });
      raw.push({ films, sessions, stale: true });
      report.push(`  ↳ naudojami ankstesni duomenys: ${sessions.length} seansų`);
    }
  }
}

// --- Filmų sujungimas pagal normalizuotą pavadinimą ---
const merged = new Map(); // key -> {meta, sources:Set}
const filmKeyOf = new Map(); // source film id -> merged key
for (const r of raw) {
  for (const [id, f] of r.films) {
    let k = key(f.title);
    k = ALIAS[k] || k;
    if (!k) continue;
    filmKeyOf.set(id, k);
    const src = id.split(":")[0];
    if (!merged.has(k)) { merged.set(k, { title: f.title, orig: "", year: 0, dur: 0, age: "", genres: [], desc: "", poster: "", posterSrc: "", trailer: "", director: "", cast: "", release: "" }); }
    const m = merged.get(k);
    if (!m.orig && f.orig && key(f.orig) !== k) m.orig = f.orig;
    for (const p of ["year", "dur", "age", "trailer", "director", "cast", "release"]) if (!m[p] && f[p]) m[p] = f[p];
    if (!m.genres.length && f.genres?.length) m.genres = f.genres;
    if ((f.desc || "").length > (m.desc || "").length * 1.3) m.desc = f.desc;
    if (f.poster) {
      const better = !m.poster || POSTER_PRIORITY.indexOf(src) < POSTER_PRIORITY.indexOf(m.posterSrc);
      if (better) { m.poster = f.poster; m.posterSrc = src; }
    }
  }
}

const keys = [...merged.keys()];
const index = new Map(keys.map((k, i) => [k, i]));
const films = keys.map((k) => {
  const { posterSrc, ...m } = merged.get(k);
  if (m.desc.length > 1200) m.desc = m.desc.slice(0, 1200).replace(/\s+\S*$/, "") + "…";
  return m;
});

const seen = new Set();
const sessions = [];
for (const r of raw) {
  for (const s of r.sessions) {
    const k = filmKeyOf.get(s.film);
    if (k == null) continue;
    const f = r.films.get(s.film);
    const tags = [...new Set([...(f?.titleTags || []), ...s.tags])];
    const dedupe = `${s.cinema}|${s.start}|${k}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    sessions.push({ f: index.get(k), c: s.cinema, t: s.start, u: s.url, g: tags });
  }
}
sessions.sort((a, b) => a.t.localeCompare(b.t) || a.c.localeCompare(b.c));

// Paliekame tik filmus, kurie turi seansų.
const used = [...new Set(sessions.map((s) => s.f))].sort((a, b) => a - b);
const remap = new Map(used.map((old, i) => [old, i]));
const outFilms = used.map((i) => films[i]);
for (const s of sessions) s.f = remap.get(s.f);

const data = { updated: new Date().toISOString(), days: DAYS, films: outFilms, sessions, report };
if (sessions.length < +(process.env.MIN_SESSIONS || 50)) {
  console.error(report.join("\n"));
  console.error(`Per mažai seansų (${sessions.length}) – data.json neperrašomas.`);
  process.exit(1);
}
await writeFile(OUT, JSON.stringify(data));
console.log(report.join("\n"));
console.log(`Iš viso: ${outFilms.length} filmų, ${sessions.length} seansų, ${DAYS[0]}–${DAYS.at(-1)}`);
