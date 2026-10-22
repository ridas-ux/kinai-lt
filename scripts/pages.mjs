// Sugeneruoja atskirą puslapį kiekvienam filmui (paieškos sistemoms), sitemap.xml ir robots.txt.
// Paleidžiama po scrape.mjs: node scripts/pages.mjs
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

const SITE = "https://kinai.lt";
const ROOT = new URL("../site/", import.meta.url);
const data = JSON.parse(await readFile(new URL("data.json", ROOT), "utf8"));

const CINEMAS = {
  fv: ["Forum Cinemas Vingis", "Savanorių pr. 7, Vilnius"],
  aa: ["Apollo Akropolis", "Ozo g. 25, Vilnius"],
  ao: ["Apollo Vilnius Outlet", "Vilnius Outlet, Vilnius"],
  vue: ["Vue Vilnius", "Ozo g. 18, Vilnius"],
  ps: ["Senamiesčio „Pasaka“", "Šv. Ignoto g. 4/3, Vilnius"],
  pp: ["Paupio „Pasaka“", "Paupio g. 26, Vilnius"],
  sk: ["Skalvija", "A. Goštauto g. 2, Vilnius"],
  fk: ["Forum Cinemas Kaunas", "PC Akropolis, Karaliaus Mindaugo pr. 49, Kaunas"],
  cm: ["Cinamon Mega", "PC Mega, Islandijos pl. 32, Kaunas"],
  rk: ["Kino centras „Romuva“", "Laisvės al. 54, Kaunas"],
  fkl: ["Forum Cinemas Klaipėda", "PC Akropolis, Taikos pr. 61, Klaipėda"],
};
const CITY_ORDER = ["Vilnius", "Kaunas", "Klaipėda"];
const CITY_LOC = { Vilnius: "Vilniuje", Kaunas: "Kaune", Klaipėda: "Klaipėdoje" };
const CITY_GEN = { Vilnius: "Vilniaus", Kaunas: "Kauno", Klaipėda: "Klaipėdos" };
const joinLt = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + " ir " + a.at(-1) : a[0] || "");
const WDL = ["sekmadienis", "pirmadienis", "antradienis", "trečiadienis", "ketvirtadienis", "penktadienis", "šeštadienis"];
const MONTHS = ["sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio", "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "filmas";
const dayLabel = (iso) => { const d = new Date(iso + "T12:00:00Z"); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} d., ${WDL[d.getUTCDay()]}`; };
const dur = (m) => (m ? `${Math.floor(m / 60)} val. ${m % 60} min.` : "");

// Unikalūs slug'ai
const used = new Map();
const slugs = data.films.map((f) => {
  let s = slug(f.title);
  if (used.has(s)) s = `${s}-${f.year || used.get(s) + 1}`;
  used.set(s, (used.get(s) || 0) + 1);
  return s;
});

const head = (title, desc, url, image, extra = "") => `<!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kinai.lt">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="theme-color" content="#f6f3ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#13111a" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="../../style.css">
<style>
.fp{padding-block:16px 40px;display:grid;gap:16px}
.crumbs{font-size:13px;color:var(--muted)}.crumbs a{color:inherit}
.fp-top{display:grid;grid-template-columns:120px minmax(0,1fr);gap:16px;align-items:start}
@media(min-width:700px){.fp-top{grid-template-columns:200px minmax(0,1fr)}}
.fp-top img,.fp-top .ph{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:var(--chip)}
.fp h1{font-family:var(--display);font-weight:900;font-size:clamp(30px,6vw,52px);line-height:.95;margin:0;text-transform:uppercase;overflow-wrap:anywhere}
.fp .desc-full{font-size:15px;line-height:1.6;white-space:pre-line;margin:0;max-width:70ch}
.day-h{font-family:var(--display);font-weight:800;font-size:22px;text-transform:uppercase;margin:12px 0 0}
.back{display:inline-flex;font-weight:700;text-decoration:none;padding:10px 14px;border-radius:10px;background:var(--chip);justify-self:start}
</style>
<script data-goatcounter="https://ridas.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
${extra}
</head>
<body>
<header class="top"><div class="wrap" style="padding-block:10px"><a href="../../" style="text-decoration:none"><span class="logo">Kinai<span>.</span>lt</span></a></div></header>
`;

await rm(new URL("filmai/", ROOT), { recursive: true, force: true });
const urls = [`${SITE}/`];
const vilnius = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`; };
const offset = (t) => (new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vilnius", timeZoneName: "longOffset" }).formatToParts(new Date(t + ":00Z")).find((x) => x.type === "timeZoneName")?.value || "GMT+02:00").replace("GMT", "");
const now = vilnius(new Date());

for (let i = 0; i < data.films.length; i++) {
  const f = data.films[i];
  const s = slugs[i];
  const ss = data.sessions.filter((x) => x.f === i && x.t >= now).sort((a, b) => a.t.localeCompare(b.t));
  if (!ss.length) continue;
  const url = `${SITE}/filmai/${s}/`;
  const cinemasHere = [...new Set(ss.map((x) => CINEMAS[x.c][0]))];
  const cities = CITY_ORDER.filter((c) => ss.some((x) => CINEMAS[x.c][1].endsWith(c)));
  const where = joinLt(cities.map((c) => CITY_LOC[c]));
  const title = `${f.title} – seansai ${where}, bilietai | Kinai.lt`;
  const desc = `${f.title}${f.orig ? ` (${f.orig})` : ""} ${joinLt(cities.map((c) => CITY_GEN[c]))} kino teatruose: ${cinemasHere.join(", ")}. ${ss.length} seansai artimiausiomis dienomis. ${(f.desc || "").slice(0, 110)}`.trim();

  const byDay = {};
  for (const x of ss) (byDay[x.t.slice(0, 10)] ||= []).push(x);
  const daysHtml = Object.entries(byDay).map(([day, list]) => {
    const byC = {};
    for (const x of list) (byC[x.c] ||= []).push(x);
    return `<h2 class="day-h">${esc(dayLabel(day))}</h2>` + Object.entries(byC).map(([c, xs]) =>
      `<div class="cin"><div class="cname">${esc(CINEMAS[c][0])}<small>${esc(CINEMAS[c][1])}</small></div><div class="times">${xs.map((x) =>
        `<a class="t" href="${esc(x.u)}" target="_blank" rel="noopener" data-c="${c}"><b>${x.t.slice(11, 16)}</b>${x.g?.length ? `<small>${esc(x.g.join(" · "))}</small>` : ""}</a>`).join("")}</div></div>`).join("");
  }).join("");

  const ld = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: f.title,
    ...(f.orig ? { alternateName: f.orig } : {}),
    ...(f.poster ? { image: f.poster } : {}),
    ...(f.desc ? { description: f.desc.slice(0, 500) } : {}),
    ...(f.director ? { director: f.director.split(", ").map((n) => ({ "@type": "Person", name: n })) } : {}),
    ...(f.cast ? { actor: f.cast.split(", ").map((n) => ({ "@type": "Person", name: n })) } : {}),
    ...(f.dur ? { duration: `PT${Math.floor(f.dur / 60)}H${f.dur % 60}M` } : {}),
    ...(f.genres?.length ? { genre: f.genres } : {}),
    ...(f.age ? { contentRating: f.age } : {}),
  };
  const events = ss.slice(0, 40).map((x) => ({
    "@context": "https://schema.org", "@type": "ScreeningEvent", name: f.title,
    startDate: `${x.t}:00${offset(x.t)}`,
    location: { "@type": "MovieTheater", name: CINEMAS[x.c][0], address: CINEMAS[x.c][1] },
    workPresented: { "@type": "Movie", name: f.title },
    offers: { "@type": "Offer", url: x.u, availability: "https://schema.org/InStock" },
  }));

  const html = head(title, desc, url, f.poster, `<script type="application/ld+json">${JSON.stringify([ld, ...events]).replace(/</g, "\\u003c")}</script>`) + `
<main class="wrap fp">
  <nav class="crumbs"><a href="../../">Kinai.lt</a> › Filmai › ${esc(f.title)}</nav>
  <div class="fp-top">
    ${f.poster ? `<img src="${esc(f.poster)}" alt="${esc(f.title)} plakatas" loading="eager" referrerpolicy="no-referrer">` : `<div class="ph"></div>`}
    <div style="min-width:0;display:grid;gap:8px">
      <h1>${esc(f.title)}</h1>
      ${f.orig ? `<div class="orig">${esc(f.orig)}${f.year ? `, ${f.year}` : ""}</div>` : ""}
      <div class="meta">${f.age ? `<span class="age">${esc(f.age)}</span>` : ""}${f.genres?.length ? `<span>${esc(f.genres.join(", "))}</span>` : ""}${f.dur ? `<span>${dur(f.dur)}</span>` : ""}</div>
      ${f.director || f.cast ? `<div class="sh-credits">${f.director ? `<div><b>Režisierius:</b> ${esc(f.director)}</div>` : ""}${f.cast ? `<div><b>Vaidina:</b> ${esc(f.cast)}</div>` : ""}</div>` : ""}
      ${f.trailer ? `<a class="trailer" href="${esc(f.trailer)}" target="_blank" rel="noopener">▶ Žiūrėti anonsą</a>` : ""}
    </div>
  </div>
  ${f.desc ? `<p class="desc-full">${esc(f.desc)}</p>` : ""}
  <section><h2 class="day-h" style="margin-top:0">Seansai ${esc(where)}</h2><p class="hint">Paspauskite laiką, kad pirktumėte bilietą kino teatro svetainėje</p>${daysHtml}</section>
  <a class="back" href="../../">← Visas repertuaras</a>
  <footer><p>Seansai atnaujinami kasdien. Bilietus parduoda patys kino teatrai.</p></footer>
</main>
<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a.t");if(a&&window.goatcounter&&window.goatcounter.count){window.goatcounter.count({path:"bilietas/"+(a.dataset.c||"?"),title:${JSON.stringify(f.title)},event:true})}});</script>
</body>
</html>`;
  const dir = new URL(`filmai/${s}/`, ROOT);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), html);
  urls.push(url);
}

// Puslapių sąrašas pagrindinei svetainei (filmo pavadinimas -> adresas)
await writeFile(new URL("films-index.json", ROOT), JSON.stringify(Object.fromEntries(urls.slice(1).map((u) => { const s = u.split("/filmai/")[1].replace("/", ""); return [data.films[slugs.indexOf(s)].title, s]; }))));

const today = new Date().toISOString().slice(0, 10);
await writeFile(new URL("sitemap.xml", ROOT), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}
</urlset>
`);
await writeFile(new URL("robots.txt", ROOT), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Sugeneruota ${urls.length - 1} filmų puslapių + sitemap.xml`);
