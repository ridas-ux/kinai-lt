// „Skalvija“ – skalvija.lt/wp-json/data/v1/get_shows/ (seansai + filmų informacija).
import { getJSON, cleanTitle, genres, age, stripHtml, youtube, unixToVilnius, KNOWN_GENRE_KEYS, key } from "../lib.mjs";

const BASE = "https://skalvija.lt";

function parseInfoline(s) {
  // Pvz.: "Komedija, Drama, Italija, N-13, Italų k., 2025, 2.13"
  const parts = String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  let dur = 0, year = 0, ag = "";
  const gs = [];
  for (const p of parts) {
    if (/^\d\.\d\d$/.test(p)) { const [h, m] = p.split("."); dur = +h * 60 + +m; }
    else if (/^(19|20)\d\d$/.test(p)) year = +p;
    else if (/^(V|N-?\d+)$/i.test(p)) ag = age(p);
    else if (KNOWN_GENRE_KEYS.has(key(p))) gs.push(p);
  }
  return { dur, year, age: ag, genres: genres(gs) };
}

export async function skalvija(days) {
  const daySet = new Set(days);
  const j = await getJSON(`${BASE}/wp-json/data/v1/get_shows/`);
  const evById = new Map((j.events || []).map((e) => [String(e.eventid ?? e._id), e]));
  const films = new Map();
  const sessions = [];
  for (const s of j.shows || []) {
    const start = unixToVilnius(s.start_date);
    if (!daySet.has(start.slice(0, 10))) continue;
    const e = evById.get(String(s.eventid));
    if (!e) continue;
    const id = `skalvija:${e.eventid}`;
    if (!films.has(id)) {
      const { title, tags } = cleanTitle(e.title);
      const info = parseInfoline(e.infoline);
      const vid = (e.videos || [])[0] || "";
      films.set(id, {
        title, titleTags: tags, orig: e.title_originalo_kalba || "", ...info,
        desc: stripHtml(e.content).replace(/^Įėjimas su nemokamais bilietais[^\n]*\n*/i, ""),
        poster: e.mainimg || (e.imgs || [])[0]?.img || "", trailer: youtube((vid.match(/embed\/([\w-]{11})/) || [])[1]),
        director: e.rezisierius || "", cast: e.vaidina || "", release: "",
      });
    }
    const tags = [...(Array.isArray(s.title) ? s.title : [s.title]).filter(Boolean)];
    if (s.sold_out) tags.push("Išparduota");
    sessions.push({ film: id, cinema: "sk", start, url: s.url || `${BASE}${e.link || "/filmas/" + e.slug + "/"}`, tags });
  }
  return { films, sessions, cinemas: ["sk"] };
}
