// Forum Cinemas Vingis – restapi.forumcinemas.lt (tas pats API, kurį naudoja jų svetainė).
import { getJSON, cleanTitle, genres, age, stripHtml, youtube, sleep } from "../lib.mjs";

const API = "https://restapi.forumcinemas.lt/api";
const REGION_VILNIUS = "e9202daa-51f9-4de9-8811-3076ad5449be";
const CINEMA_VINGIS = "f933f355-2e6b-466f-9b97-e267ecd8e266";

function nextDay(day) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function forum(days) {
  const sessions = [];
  const movieIds = new Set();
  for (const day of days) {
    const url = `${API}/region/${REGION_VILNIUS}/screening?dateTimeFrom=${day}T02:00:00.000&dateTimeTo=${nextDay(day)}T01:59:59.999&movieId=null`;
    const list = await getJSON(url);
    for (const s of list) {
      if (s.cinemaId !== CINEMA_VINGIS) continue;
      movieIds.add(s.movieId);
      const tags = [];
      const pt = (s.printType || "").replace(/\b2D\b/, "").trim();
      if (pt) tags.push(pt);
      for (const f of s.screenFeatures || []) if (!tags.includes(f)) tags.push(f);
      if (s.speakingType === "DUB" || /dubliuot/i.test(s.release || "")) tags.push("Dubliuotas");
      sessions.push({
        film: `forum:${s.movieId}`, cinema: "fv", start: s.screeningTimeFrom.slice(0, 16),
        url: `https://forumcinemas.lt/lt/ekranas/?id=${s.id}&cid=${s.cinemaId}`, tags,
      });
    }
  }

  const films = new Map();
  for (const id of movieIds) {
    try {
      const m = await getJSON(`${API}/movie/${id}`);
      const { title, tags } = cleanTitle(m.title);
      films.set(`forum:${id}`, {
        title, titleTags: tags, orig: cleanTitle(m.originalTitle || "").title, year: +m.yearOfProduction || 0, dur: m.duration,
        age: age((m.ratings || [])[0]?.value), genres: genres((m.genres || []).map((g) => g.name)),
        desc: stripHtml(m.description), poster: (m.posters || [])[0] || "", trailer: youtube((m.trailers || [])[0]),
        director: m.director || "", cast: m.filmCast || "", release: (m.premiereDate || "").slice(0, 10),
      });
      await sleep(150);
    } catch (e) { console.warn("Forum movie", id, e.message); }
  }
  return { films, sessions, cinemas: ["fv"] };
}
