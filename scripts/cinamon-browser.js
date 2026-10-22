// Cinamon Mega (Kaunas) repertuaro surinkimas NARŠYKLĖJE, kai Cinamon blokuoja GitHub serverius.
// Paleidžiama atidarius https://cinamonkino.com/mega/lt – rezultatas (JSON) įdedamas į teksto laukelį #kinai-cinamon,
// iš kurio jis nukopijuojamas į GitHub failą site/cinamon.json.
(async () => {
  const DAYS = 8;
  const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius" }).format(d);
  const days = [...Array(DAYS)].map((_, i) => fmt(new Date(Date.now() + i * 86400000)));
  const strip = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const films = {}, shows = [];
  for (const day of days) {
    const list = await (await fetch(`/api/schedule?cinema_id=77139293&timezone=Europe/Vilnius&locale=lt&date=${day}&include=film.genre`)).json();
    for (const s of Array.isArray(list) ? list : []) {
      const f = s.film; if (!f) continue;
      if (!films[f.pid]) films[f.pid] = { pid: f.pid, name: f.name, original_name: f.original_name, runtime: f.runtime, rating: f.rating,
        genre: [].concat(f.genre || []).map((g) => ({ name: g.name })), synopsis: strip(f.synopsis || f.synopsis_short).slice(0, 900),
        poster: f.poster, trailer_url: f.trailer_url, premiere_date: f.premiere_date, slug: f.slug };
      shows.push({ pid: s.pid, showtime: s.showtime, is_3d: s.is_3d, screen_name: s.screen_name, audio_label: s.audio_label, film: f.pid });
    }
  }
  const out = { fetched: new Date().toISOString(), days, films, shows };
  let ta = document.getElementById("kinai-cinamon");
  if (!ta) { ta = document.createElement("textarea"); ta.id = "kinai-cinamon"; ta.style.cssText = "position:fixed;inset:10px;z-index:99999;width:90vw;height:80vh;font:11px monospace"; document.body.appendChild(ta); }
  ta.value = JSON.stringify(out);
  ta.focus(); ta.select();
  return `${shows.length} seansų, ${Object.keys(films).length} filmų, ${ta.value.length} B`;
})();
