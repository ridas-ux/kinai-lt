// Cinamon Mega (Kaunas) – cinamonkino.com/api/schedule (tas pats API, kurį naudoja jų svetainė).
import { getJSON, cleanTitle, genres, age, stripHtml, youtube, sleep } from "../lib.mjs";

const BASE = "https://cinamonkino.com";
const CINEMA_ID = 77139293; // MEGA, Kaunas

export async function cinamon(days) {
  const films = new Map();
  const sessions = [];
  for (const day of days) {
    const list = await getJSON(`${BASE}/api/schedule?cinema_id=${CINEMA_ID}&timezone=Europe/Vilnius&locale=lt&date=${day}&include=film.genre,screen,relatedAttributes`);
    for (const s of Array.isArray(list) ? list : []) {
      if (!s.film || s.date !== day) continue;
      const f = s.film, id = `cinamon:${f.pid}`;
      if (!films.has(id)) {
        const { title, tags } = cleanTitle(f.name);
        const g = [].concat(f.genre || []).map((x) => x.name);
        films.set(id, {
          title, titleTags: tags, orig: f.original_name && f.original_name !== f.name ? f.original_name : "",
          year: 0, dur: +f.runtime || 0, age: age(f.rating), genres: genres(g),
          desc: stripHtml(f.synopsis || f.synopsis_short), poster: f.poster || "", trailer: youtube(f.trailer_url),
          director: "", cast: "", release: (f.premiere_date || "").slice(0, 10),
        });
      }
      const tags = [];
      if (s.is_3d) tags.push("3D");
      if (/premium/i.test(s.screen_name || "")) tags.push("PREMIUM salė");
      if (/lietuvi/i.test(s.audio_label || "")) tags.push("Lietuvių k.");
      sessions.push({
        film: id, cinema: "cm", start: String(s.showtime).replace(" ", "T").slice(0, 16),
        url: `${BASE}/mega/seat-plan/${f.slug}/${s.pid}/lt`, tags,
      });
    }
    await sleep(200);
  }
  return { films, sessions, cinemas: ["cm"] };
}
