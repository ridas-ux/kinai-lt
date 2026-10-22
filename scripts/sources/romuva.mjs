// Kauno kino centras „Romuva“ – kcromuva.lt/repertuaras/ (WordPress puslapis, kiekviena kortelė – vienas seansas).
import { fetchRetry, cleanTitle, genres, age, key, fixCase } from "../lib.mjs";

const BASE = "https://kcromuva.lt";
const dec = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&ndash;/g, "–")
  .replace(/&#8222;|&bdquo;/g, "„").replace(/&#8220;|&ldquo;/g, "“").replace(/&#8217;|&rsquo;/g, "’").replace(/&#0?39;/g, "’").replace(/&quot;/g, '"')
  .replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();

export async function romuva(days) {
  const daySet = new Set(days);
  const html = await (await fetchRetry(`${BASE}/repertuaras/`, { headers: { Accept: "text/html" } })).text();
  const films = new Map();
  const sessions = [];
  const year0 = +days[0].slice(0, 4), month0 = +days[0].slice(5, 7);
  for (const art of html.split(/<article\b/).slice(1)) {
    const a = art.split(/<\/article>/)[0];
    const title = dec((a.match(/<h2[^>]*post_title[^>]*>([\s\S]*?)<\/h2>/) || [])[1]);
    const link = (a.match(/href="(https:\/\/kcromuva\.lt\/filmai\/[^"]+)"/) || [])[1];
    const date = dec((a.match(/>(\d{2}-\d{2})</) || [])[1]);
    const time = dec((a.match(/>(\d{2}:\d{2})</) || [])[1]);
    if (!title || !date || !time) continue;
    const [mm, dd] = date.split("-").map(Number);
    const yr = mm < month0 - 6 ? year0 + 1 : year0;
    const day = `${yr}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (!daySet.has(day)) continue;
    // Laukai: „Originalo kalba:“, „Rež.:“, „Cenzas:“ ir pan. – prieš kiekvieną reikšmę yra „w-post-elm-before“.
    const field = (label) => dec((a.match(new RegExp(`${label}\\s*</span>\\s*<span[^>]*w-post-elm-value[^>]*>([\\s\\S]*?)</span>`)) || [])[1]);
    const values = [...a.matchAll(/<span class="w-post-elm-value">([\s\S]*?)<\/span>/g)].map((m) => dec(m[1]));
    const id = `romuva:${key(title)}`;
    if (!films.has(id)) {
      // „JAPONIŠKAS VAKARAS: Ikiru“, „SVEČIUOSE | „Vėjo nublokšti““ – ciklo pavadinimas tampa žyma.
      const cyc = title.match(/^([A-ZĄČĘĖĮŠŲŪŽ0-9 '’.-]{4,})\s*[:|]\s*(.+)$/);
      const { title: t, tags } = cleanTitle(cyc ? cyc[2] : title);
      if (cyc) tags.unshift(fixCase(cyc[1].trim()));
      const afterTitle = a.split(/<\/h2>/)[1] || "";
      const orig = dec((afterTitle.match(/<span class="w-post-elm-value">([\s\S]*?)<\/span>/) || [])[1]);
      films.set(id, {
        title: t, titleTags: tags, orig: orig && key(orig) !== key(t) && !/:$/.test(orig) ? orig : "",
        year: 0, dur: 0, age: age(field("Cenzas:")), genres: genres(values[0] || ""),
        desc: dec((a.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1]), poster: (a.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "",
        trailer: "", director: field("Rež\\.:"), cast: "", release: "",
      });
    }
    const tags = [];
    const sub = field("Subtitrai:");
    if (sub) tags.push(`Subtitrai: ${sub}`);
    sessions.push({ film: id, cinema: "rk", start: `${day}T${time}`, url: link || `${BASE}/repertuaras/`, tags });
  }
  if (!sessions.length) throw new Error("nerasta seansų");
  return { films, sessions, cinemas: ["rk"] };
}
