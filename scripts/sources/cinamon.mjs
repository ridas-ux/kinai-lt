// Cinamon Mega (Kaunas) – cinamonkino.com/api/schedule (tas pats API, kurį naudoja jų svetainė).
// Cinamon blokuoja GitHub serverius (HTTP 403), todėl jei tiesioginis surinkimas nepavyksta,
// naudojamas failas site/cinamon.json, surinktas naršyklėje (scripts/cinamon-browser.js).
import { readFile } from "node:fs/promises";
import { getJSON, cleanTitle, genres, age, stripHtml, youtube, sleep } from "../lib.mjs";

const BASE = "https://cinamonkino.com";
const CINEMA_ID = 77139293; // MEGA, Kaunas
const FILE = new URL("../../site/cinamon.json", import.meta.url);
const MAX_AGE_H = 48;

// shows: [{ pid, date, showtime, is_3d, screen_name, audio_label, film: {...} }]
function parse(shows, days) {
  const daySet = new Set(days);
  const films = new Map();
  const sessions = [];
  for (const s of shows) {
    if (!s.film || !daySet.has(String(s.showtime).slice(0, 10))) continue;
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
  return { films, sessions };
}

async function live(days) {
  const shows = [];
  for (const day of days) {
    const list = await getJSON(`${BASE}/api/schedule?cinema_id=${CINEMA_ID}&timezone=Europe/Vilnius&locale=lt&date=${day}&include=film.genre,screen,relatedAttributes`);
    shows.push(...(Array.isArray(list) ? list : []));
    await sleep(200);
  }
  return { ...parse(shows, days), cinemas: ["cm"] };
}

async function fromFile(days) {
  const j = JSON.parse(await readFile(FILE, "utf8"));
  const ageH = (Date.now() - new Date(j.fetched).getTime()) / 3600000;
  if (!(ageH < MAX_AGE_H)) throw new Error(`cinamon.json per senas (${Math.round(ageH)} val.)`);
  const shows = (j.shows || []).map((s) => ({ ...s, film: j.films[s.film] }));
  const r = parse(shows, days);
  if (!r.sessions.length) throw new Error("cinamon.json be seansų");
  return { ...r, cinemas: ["cm"], note: `iš cinamon.json (${Math.round(ageH)} val. senumo)` };
}

export async function cinamon(days) {
  try {
    return await live(days);
  } catch (e) {
    console.warn(`Cinamon tiesiogiai nepasiekiamas (${e.message}) – bandomas site/cinamon.json`);
    return await fromFile(days);
  }
}
