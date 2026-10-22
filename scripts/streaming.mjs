// Surenka „Žiūrėti namuose“ sąrašus ir įrašo site/streaming.json.
//   Netflix  – oficialus Lietuvos savaitės TOP 10 (netflix.com/tudum/top10)
//   Go3      – „TOP 20 žiūrimiausių filmų nuomoje“ (go3.lt)
//   LRT Epika – „Epikos web topas“ ir naujienos (epika.lrt.lt)
//   Apple TV – populiariausi filmai Apple TV parduotuvėje Lietuvoje (oficialus Apple RSS)
//   HBO Max, Prime Video – rankiniu būdu: scripts/streaming-manual.json
// Plakatai, IMDb ir Rotten Tomatoes vertinimai: OMDb (reikia OMDB_KEY), atsarginis plakatas – IMDb paieška.
// Paleidimas: OMDB_KEY=xxxx node scripts/streaming.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fetchRetry, getJSON, sleep } from "./lib.mjs";

const OUT = new URL("../site/streaming.json", import.meta.url);
const MANUAL = new URL("./streaming-manual.json", import.meta.url);
const OMDB = process.env.OMDB_KEY || "";
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const yt = (t, y) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t} ${y || ""} trailer`.replace(/\s+/g, " ").trim())}`;
const httpsImg = (u) => (u ? (u.startsWith("//") ? "https:" + u : u).replace(/\?.*$/, "") : "");

let previous = null;
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch {}
const manual = JSON.parse(await readFile(MANUAL, "utf8"));
const report = [];

/* ---------- šaltiniai ---------- */
async function netflix() {
  const res = await fetchRetry("https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv", { headers: { Accept: "text/tab-separated-values,*/*" } });
  const rows = (await res.text()).split("\n").map((l) => l.split("\t")).filter((r) => r[1] === "LT");
  if (!rows.length) throw new Error("nėra Lietuvos eilučių");
  const week = rows.map((r) => r[2]).sort().at(-1);
  const pick = (cat) => rows.filter((r) => r[2] === week && r[3] === cat).sort((a, b) => a[4] - b[4])
    .map((r) => ({ t: r[5], season: r[6] !== "N/A" ? r[6] : "", weeks: +r[7] || 0, kind: cat === "Films" ? "Filmas" : "Serialas" }));
  return { week, lists: [{ name: "Filmai", items: pick("Films") }, { name: "Serialai", items: pick("TV") }] };
}
async function redge(host, query, match, urlOf, limit = 10) {
  const j = await getJSON(`https://${host}/api/products/sections/main?${query}`);
  const out = [];
  for (const [name, re] of match) {
    const sec = j.find((s) => re.test(s.title || ""));
    if (!sec) continue;
    out.push({
      name,
      items: sec.elements.map((e) => e.item).filter((i) => i && i.title).slice(0, limit).map((i) => ({
        t: i.title, o: i.originalTitle && i.originalTitle !== i.title ? i.originalTitle : "", y: i.year || 0,
        kind: /serial/i.test(i.type_ || i.type || "") ? "Serialas" : "Filmas",
        url: urlOf(i), poster: httpsImg(((i.images || {})["3x4"] || [])[0]?.url), desc: (i.lead || "").slice(0, 300),
      })),
    });
  }
  if (!out.some((l) => l.items.length)) throw new Error("nerasta sąrašų");
  return { lists: out };
}
const go3 = () => redge("go3.lt", "platform=BROWSER&lang=LT&tenant=OM_LT&tier=TIER_2&elementsLimit=20&maxResults=20",
  [["TOP filmai nuomoje", /top/i], ["Naujai pridėti", /naujai prid/i]],
  (i) => `https://go3.lt/${/serial/i.test(i.type_ || "") ? "series" : "movies"}/${i.slug},${/serial/i.test(i.type_ || "") ? "serial" : "vod"}-${i.id}`);
const epika = () => redge("epika.lrt.lt", "elementsLimit=30&tenantUid=Lh8t&lang=LIT&platform=BROWSER&maxResults=20",
  [["Epikos topas", /topas/i], ["Naujienos", /^naujienos/i]], (i) => i.webUrl || "https://epika.lrt.lt/");
async function apple() {
  const j = await getJSON("https://itunes.apple.com/lt/rss/topmovies/limit=10/json");
  const items = (j.feed.entry || []).map((e) => {
    const links = [].concat(e.link || []).map((l) => l.attributes || {});
    return {
      t: e["im:name"].label, y: +(e["im:releaseDate"]?.label || "").slice(0, 4) || 0, kind: "Filmas",
      url: (links.find((l) => l.type === "text/html") || links[0] || {}).href?.replace(/\?.*$/, "") || "",
      poster: (e["im:image"] || []).slice(-1)[0]?.label?.replace(/\/\d+x\d+bb\.(png|jpg)$/, "/400x600bb.jpg") || "",
      trailer: (links.find((l) => /video/i.test(l.type || "")) || {}).href || "",
      desc: (e.summary?.label || "").slice(0, 300),
    };
  });
  if (!items.length) throw new Error("tuščias sąrašas");
  return { lists: [{ name: "Populiariausi filmai (nuoma ir pirkimas)", items }] };
}

const PLATFORMS = [
  ["nf", "Netflix", netflix],
  ["go3", "Go3", go3],
  ["epika", "LRT Epika", epika],
  ["atv", "Apple TV", apple],
  ["hbo", "HBO Max", async () => ({ lists: [{ name: "Populiaru", items: (manual.hbo || []).map((t) => ({ t })) }] })],
  ["pv", "Prime Video", async () => ({ lists: [{ name: "Populiaru", items: (manual.pv || []).map((t) => ({ t })) }] })],
];

const platforms = [];
for (const [k, name, fn] of PLATFORMS) {
  try {
    const r = await fn();
    platforms.push({ k, name, ...r });
    report.push(`✔ ${name}: ${r.lists.map((l) => `${l.name} ${l.items.length}`).join(", ")}`);
  } catch (e) {
    const old = previous && (previous.platforms || []).find((p) => p.k === k);
    if (old) platforms.push({ ...old, stale: true });
    report.push(`✖ ${name}: ${e.message}${old ? " – naudojami ankstesni duomenys" : ""}`);
  }
}

/* ---------- plakatai, vertinimai, anonsai ---------- */
const cache = new Map();
for (const p of (previous && previous.platforms) || []) for (const l of p.lists || []) for (const it of l.items || []) if (it.imdb || (!OMDB && it.imdbId)) cache.set(norm(it.o || it.t) + "|" + (it.y0 ?? ""), it);
let omdbCalls = 0;
async function omdb(t, y, kind, id) {
  if (!OMDB || omdbCalls > 400) return null;
  omdbCalls++;
  if (id) { const r = await getJSON(`https://www.omdbapi.com/?apikey=${OMDB}&i=${id}`).catch(() => null); return r && r.Response === "True" ? r : null; }
  const type = kind === "Serialas" ? "&type=series" : kind === "Filmas" ? "&type=movie" : "";
  const q = (extra) => getJSON(`https://www.omdbapi.com/?apikey=${OMDB}&t=${encodeURIComponent(t)}${type}${extra}`).catch(() => null);
  // Be metų (Netflix) pirmiausia ieškome naujausių: tas pats pavadinimas dažnai turi senesnį filmą.
  const now = new Date().getFullYear();
  const tries = y ? [`&y=${y}`, ""] : [`&y=${now}`, `&y=${now - 1}`, ""];
  let r = null;
  for (const x of tries) {
    r = await q(x);
    // Spėtų metų atitikmuo tinka tik jei pavadinimas sutampa tiksliai (kitaip „Ice Age“ virstų 2026 m. tęsiniu).
    if (r && r.Response === "True" && (y || !x || norm(r.Title) === norm(t))) break;
    r = null;
  }
  return r && r.Response === "True" ? r : null;
}
async function imdbSuggest(t, y) {
  try {
    const j = await getJSON(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(norm(t).slice(0, 60))}.json`);
    const c = (j.d || []).filter((x) => /^tt/.test(x.id));
    const now = new Date().getFullYear();
    const exact = c.filter((x) => norm(x.l) === norm(t));
    return (y ? c.find((x) => Math.abs((x.y || 0) - y) <= 1) : exact.find((x) => (x.y || 0) >= now - 1) || exact[0]) || c[0] || null;
  } catch { return null; }
}
for (const p of platforms) {
  if (p.stale) continue;
  for (const l of p.lists) {
    for (const it of l.items) {
      const title = it.o || it.t;
      it.y0 = it.y || 0; // šaltinio metai (Netflix jų neturi) – pagal juos ir talpykla
      const old = cache.get(norm(title) + "|" + it.y0);
      if (old) { for (const f of ["imdbId", "imdb", "rt", "poster", "y", "plot"]) if (!it[f] && old[f]) it[f] = old[f]; }
      else {
        let o = await omdb(title, it.y, it.kind);
        if (!o && OMDB) { const s = await imdbSuggest(title, it.y); if (s) o = await omdb(title, 0, "", s.id); }
        if (o) {
          it.imdbId = o.imdbID; it.y = it.y || +String(o.Year).slice(0, 4) || 0;
          if (o.imdbRating && o.imdbRating !== "N/A") it.imdb = o.imdbRating;
          const rt = (o.Ratings || []).find((x) => x.Source === "Rotten Tomatoes"); if (rt) it.rt = rt.Value;
          if (!it.poster && o.Poster && o.Poster !== "N/A") it.poster = o.Poster;
          if (!it.desc && o.Plot && o.Plot !== "N/A") it.plot = o.Plot.slice(0, 300);
        } else if (!it.poster || !it.imdbId) {
          const s = await imdbSuggest(title, it.y);
          if (s) { it.imdbId = it.imdbId || s.id; it.y = it.y || s.y || 0; if (!it.poster && s.i) it.poster = s.i.imageUrl.replace(/\._V1_.*\.jpg$/, "._V1_QL75_UX400_.jpg"); }
        }
        await sleep(120);
      }
      if (!it.trailer) it.trailer = yt(title, it.y);
    }
  }
}

const data = { updated: new Date().toISOString(), platforms, extra: manual.extra || [], report };
if (!platforms.some((p) => !p.stale && p.lists.some((l) => l.items.length))) {
  console.error(report.join("\n")); console.error("Negauta jokių sąrašų – streaming.json neperrašomas."); process.exit(0);
}
await writeFile(OUT, JSON.stringify(data));
console.log(report.join("\n"));
console.log(`OMDb užklausų: ${omdbCalls}${OMDB ? "" : " (OMDB_KEY nenurodytas – IMDb/RT vertinimų nebus)"}`);
