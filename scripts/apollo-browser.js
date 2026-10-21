// Apollo repertuaro surinkimas NARŠYKLĖJE (tavo Mac'e), kai Apollo blokuoja GitHub serverius.
// Paleidžiama atidarius https://www.apollokinas.lt/ – rezultatas (JSON) įdedamas į teksto laukelį #kinai-apollo,
// iš kurio jis nukopijuojamas į GitHub failą site/apollo.json.
(async () => {
  const AREAS = { 1019: "aa", 1024: "ao" };
  const DAYS = 8;
  const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius" }).format(d);
  const days = [...Array(DAYS)].map((_, i) => fmt(new Date(Date.now() + i * 86400000)));
  const strip = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const yt = (u) => { const m = String(u || "").match(/^([\w-]{11})$/) || String(u || "").match(/(?:v=|embed\/|youtu\.be\/)([\w-]{11})/); return m ? m[1] : ""; };
  const films = {};
  const sessions = [];
  for (const area of Object.keys(AREAS)) {
    for (const list of ["NowInTheatres", "ComingSoon"]) {
      try {
        const evs = await (await fetch(`/xml/Events/?area=${area}&listType=${list}`)).json();
        for (const e of evs) {
          if (films[e.ID]) continue;
          const img = e.Images || {};
          films[e.ID] = {
            rawTitle: e.Title, orig: e.OriginalTitle, year: e.ProductionYear, dur: e.LengthInMinutes, rating: e.RatingLabel, genres: e.Genres,
            desc: strip(e.Synopsis || e.ShortSynopsis).slice(0, 900),
            poster: img.EventLargeImagePortrait || img.EventMediumImagePortrait || img.EventSmallImagePortrait || "",
            yt: yt((e.Videos || []).find((v) => v.MediaResourceFormat === "YouTubeVideo")?.Location),
            director: (e.Directors || []).map((d) => `${d.FirstName} ${d.LastName}`.trim()).join(", "),
            cast: (e.Cast || []).slice(0, 6).map((d) => `${d.FirstName} ${d.LastName}`.trim()).join(", "),
            release: (e.dtLocalRelease || "").slice(0, 10),
          };
        }
      } catch (err) { console.warn("Events", area, list, err); }
    }
    for (const day of days) {
      const [y, m, d] = day.split("-");
      const j = await (await fetch(`/xml/Schedule/?area=${area}&dt=${d}.${m}.${y}`)).json();
      for (const s of j.Shows || []) {
        if (!films[s.EventID]) films[s.EventID] = { rawTitle: s.Title, orig: s.OriginalTitle, year: s.ProductionYear, dur: s.LengthInMinutes, rating: s.RatingLabel, genres: s.Genres };
        const tags = [];
        if (s.PresentationMethod && s.PresentationMethod !== "2D") tags.push(s.PresentationMethod);
        if (/liuks/i.test(s.EventSeries || "")) tags.push("LIUKS salė");
        if (s.SpokenLanguage?.ISOTwoLetterCode === "lt" && s.SubtitleLanguage1 == null) tags.push("Lietuvių k.");
        sessions.push([s.EventID, AREAS[area], s.dttmShowStart.slice(0, 16), s.ID, tags]);
      }
    }
  }
  const used = new Set(sessions.map((s) => String(s[0])));
  for (const id of Object.keys(films)) if (!used.has(id)) delete films[id];
  const out = { fetched: new Date().toISOString(), days, films, sessions };
  let ta = document.getElementById("kinai-apollo");
  if (!ta) { ta = document.createElement("textarea"); ta.id = "kinai-apollo"; ta.style.cssText = "position:fixed;inset:10px;z-index:99999;width:90vw;height:80vh;font:11px monospace"; document.body.appendChild(ta); }
  ta.value = JSON.stringify(out);
  ta.focus(); ta.select();
  window.__kinaiApollo = `${sessions.length} seansų, ${Object.keys(films).length} filmų, ${ta.value.length} B`;
  return window.__kinaiApollo;
})();
