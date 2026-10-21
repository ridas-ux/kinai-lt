// „Pasaka“ (Senamiestis, Paupys) – api.pasaka.lt/movies ir /movies/{slug}.
import { getJSON, cleanTitle, genres, age, stripHtml, youtube, sleep } from "../lib.mjs";

const API = "https://api.pasaka.lt";
const THEATERS = { 1: "ps", 7: "pp" };

export async function pasaka(days) {
  const daySet = new Set(days);
  const list = (await getJSON(`${API}/movies`)).data || [];
  const films = new Map();
  const sessions = [];
  for (const m of list) {
    const evs = (m.events || []).filter((e) => daySet.has(e.starts_at?.date) && !e.is_cancelled && THEATERS[e.theater?.id]);
    if (!evs.length) continue;
    const id = `pasaka:${m.slug}`;
    let detail = {};
    try { detail = (await getJSON(`${API}/movies/${m.slug}?include=genres,mpaa_rating`)).data || {}; await sleep(120); }
    catch (e) { console.warn("Pasaka", m.slug, e.message); }
    const { title, tags } = cleanTitle(m.name);
    films.set(id, {
      title, titleTags: tags, orig: cleanTitle(m.original_name || "").title.replace(/^(Festiwal filmu polskiego|NK'?26|Šeimų sekmadienis|Bohemiški vakarai|5 eurų savaitė):\s*/i, ""),
      year: m.release_year || 0, dur: m.runtime || 0, age: age(detail.mpaa_rating?.name),
      genres: genres((detail.genres || []).map((g) => g.name)), desc: stripHtml(detail.description || detail.synopsis),
      poster: m.image?.poster || m.image?.original || "", trailer: youtube(detail.trailer_link), release: "",
    });
    for (const e of evs) {
      const tg = [];
      if (e.is_sold_out) tg.push("Išparduota");
      if (e.tag_text) tg.push(e.tag_text);
      sessions.push({
        film: id, cinema: THEATERS[e.theater.id], start: `${e.starts_at.date}T${e.starts_at.time}`,
        url: (e.markus_link || `https://www.pasaka.lt/filmas/${m.slug}?date=${e.starts_at.date}`).replace(/^http:/, "https:"), tags: tg,
      });
    }
  }
  return { films, sessions, cinemas: Object.values(THEATERS) };
}
