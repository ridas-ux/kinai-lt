// Apollo Kinas (Akropolis, Vilnius Outlet) – viešas Finnkino tipo API: /xml/Schedule ir /xml/Events.
// Apollo blokuoja GitHub serverius (HTTP 403), todėl jei tiesioginis surinkimas nepavyksta,
// naudojamas failas site/apollo.json, kurį kasdien surenka tavo Mac'as (scripts/apollo-browser.js).
import { readFile } from "node:fs/promises";
import { getJSON, cleanTitle, genres, age, stripHtml, youtube } from "../lib.mjs";

const BASE = "https://www.apollokinas.lt";
const AREAS = { 1019: "aa", 1024: "ao" };
const FILE = new URL("../../site/apollo.json", import.meta.url);
const MAX_AGE_H = 48;

async function live(days) {
  const films = new Map();
  const sessions = [];
  for (const area of Object.keys(AREAS)) {
    for (const list of ["NowInTheatres", "ComingSoon"]) {
      try {
        const evs = await getJSON(`${BASE}/xml/Events/?area=${area}&listType=${list}`);
        for (const e of evs) {
          if (films.has(e.ID)) continue;
          const img = e.Images || {};
          films.set(e.ID, {
            rawTitle: e.Title, orig: e.OriginalTitle, year: e.ProductionYear, dur: e.LengthInMinutes,
            age: age(e.RatingLabel), genres: genres(e.Genres),
            desc: stripHtml(e.Synopsis || e.ShortSynopsis),
            poster: img.EventLargeImagePortrait || img.EventMediumImagePortrait || img.EventSmallImagePortrait || "",
            trailer: youtube((e.Videos || []).find((v) => v.MediaResourceFormat === "YouTubeVideo")?.Location),
            director: (e.Directors || []).map((d) => `${d.FirstName} ${d.LastName}`.trim()).join(", "),
            cast: (e.Cast || []).slice(0, 6).map((d) => `${d.FirstName} ${d.LastName}`.trim()).join(", "),
            release: (e.dtLocalRelease || "").slice(0, 10),
          });
        }
      } catch (e) { console.warn("Apollo Events:", e.message); }
    }
    for (const day of days) {
      const [y, m, d] = day.split("-");
      const j = await getJSON(`${BASE}/xml/Schedule/?area=${area}&dt=${d}.${m}.${y}`);
      for (const s of j.Shows || []) {
        if (!films.has(s.EventID)) {
          films.set(s.EventID, { rawTitle: s.Title, orig: s.OriginalTitle, year: s.ProductionYear, dur: s.LengthInMinutes, age: age(s.RatingLabel), genres: genres(s.Genres) });
        }
        const tags = [];
        if (s.PresentationMethod && s.PresentationMethod !== "2D") tags.push(s.PresentationMethod);
        if (/liuks/i.test(s.EventSeries || "")) tags.push("LIUKS salė");
        if (s.SpokenLanguage?.ISOTwoLetterCode === "lt" && s.SubtitleLanguage1 == null && !/^lt/i.test(s.OriginalTitle || "")) tags.push("Lietuvių k.");
        sessions.push({ film: `apollo:${s.EventID}`, cinema: AREAS[area], start: s.dttmShowStart.slice(0, 16), url: s.ShowURL, tags });
      }
    }
  }
  const out = new Map();
  for (const [id, f] of films) {
    const { title, tags } = cleanTitle(f.rawTitle);
    out.set(`apollo:${id}`, { ...f, title, titleTags: tags });
  }
  return { films: out, sessions, cinemas: Object.values(AREAS) };
}

/** Duomenys iš site/apollo.json (surinkti tavo Mac'e). */
async function fromFile(days) {
  const j = JSON.parse(await readFile(FILE, "utf8"));
  const ageH = (Date.now() - new Date(j.fetched).getTime()) / 3600000;
  if (!(ageH < MAX_AGE_H)) throw new Error(`apollo.json per senas (${Math.round(ageH)} val.)`);
  const daySet = new Set(days);
  const films = new Map();
  for (const [id, f] of Object.entries(j.films || {})) {
    const { title, tags } = cleanTitle(f.rawTitle);
    films.set(`apollo:${id}`, {
      title, titleTags: tags, orig: f.orig, year: f.year, dur: f.dur, age: age(f.rating), genres: genres(f.genres),
      desc: f.desc || "", poster: f.poster || "", trailer: youtube(f.yt), director: f.director || "", cast: f.cast || "", release: f.release || "",
    });
  }
  const sessions = (j.sessions || [])
    .filter(([, , start]) => daySet.has(start.slice(0, 10)))
    .map(([eid, cinema, start, showId, tags]) => ({ film: `apollo:${eid}`, cinema, start, url: `${BASE}/websales/show/${showId}`, tags: tags || [] }));
  return { films, sessions, cinemas: Object.values(AREAS), note: `iš apollo.json (${Math.round(ageH)} val. senumo)` };
}

export async function apollo(days) {
  try {
    return await live(days);
  } catch (e) {
    console.warn(`Apollo tiesiogiai nepasiekiamas (${e.message}) – bandomas site/apollo.json`);
    return await fromFile(days);
  }
}
