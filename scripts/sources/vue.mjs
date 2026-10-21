// Vue Vilnius (buv. Multikino Ozas) – vuekinas.lt/data/filmswithshowings/1001.
import { getJSON, cleanTitle, fixCase, genres, age, stripHtml } from "../lib.mjs";

const BASE = "https://vuekinas.lt";
const CINEMA_ID = 1001;

export async function vue(days) {
  const daySet = new Set(days);
  const j = await getJSON(`${BASE}/data/filmswithshowings/${CINEMA_ID}`, { headers: { "X-Requested-With": "XMLHttpRequest" } });
  const films = new Map();
  const sessions = [];
  for (const f of j.films || []) {
    // Pavadinimas dažnai „PAVADINIMAS (Original)“ – nuimame originalą skliaustuose.
    let raw = (f.title || "").replace(/\s+/g, " ").trim();
    const orig = (f.title_orginal || "").trim();
    if (orig) raw = raw.replace(new RegExp(`\\s*\\(${orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i"), "");
    raw = raw.replace(/\s*\([^)]*\)\s*$/, "");
    const { title, tags } = cleanTitle(raw);
    const id = `vue:${f.id}`;
    films.set(id, {
      title: fixCase(title), titleTags: tags, orig: fixCase(orig) === fixCase(title) ? "" : orig,
      dur: parseInt(f.info_runningtime, 10) || 0, age: age(f.info_age),
      genres: genres((f.genres?.names || []).map((g) => g.name)), desc: stripHtml(f.synopsis_short),
      poster: f.image_poster || "", release: "",
    });
    for (const d of f.showings || []) {
      if (!daySet.has(d.date_time)) continue;
      for (const t of d.times || []) {
        if (t.hidden) continue;
        const tg = [];
        if (t.screen_type && t.screen_type !== "2D") tg.push(t.screen_type);
        if (t.lang) tg.push(t.lang);
        sessions.push({ film: id, cinema: "vue", start: `${d.date_time}T${t.time}`, url: BASE + t.link, tags: tg });
      }
    }
  }
  return { films, sessions, cinemas: ["vue"] };
}
