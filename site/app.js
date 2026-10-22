"use strict";
/* Kinai.lt – skaito data.json (atnaujinama kasdien) ir streaming.json. */

const CINEMAS = {
  fv:  { name: "Forum Cinemas Vingis", short: "Forum Vingis", addr: "Savanorių pr. 7", home: "https://forumcinemas.lt/lt/kinas/forum-cinemas-vingis/" },
  aa:  { name: "Apollo Akropolis", short: "Apollo Akropolis", addr: "PPC Akropolis, Ozo g. 25", home: "https://www.apollokinas.lt/cinemas/akropolis" },
  ao:  { name: "Apollo Vilnius Outlet", short: "Apollo Outlet", addr: "PC Vilnius Outlet", home: "https://www.apollokinas.lt/cinemas/vilniusoutlet" },
  vue: { name: "Vue Vilnius", short: "Vue Ozas", addr: "PPC Ozas, Ozo g. 18", home: "https://vuekinas.lt/kino-teatras/vilnius/repertuaras" },
  ps:  { name: "Senamiesčio „Pasaka“", short: "Pasaka Senamiestis", addr: "Šv. Ignoto g. 4/3", home: "https://www.pasaka.lt/" },
  pp:  { name: "Paupio „Pasaka“", short: "Pasaka Paupys", addr: "Paupio g. 26", home: "https://www.pasaka.lt/" },
  sk:  { name: "Skalvija", short: "Skalvija", addr: "A. Goštauto g. 2", home: "https://skalvija.lt/repertuaras/" },
};
const STREAM = {
  nf:  { name: "Netflix", cls: "nf", search: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}` },
  pv:  { name: "Prime Video", cls: "pv", search: (q) => `https://www.primevideo.com/search/?phrase=${encodeURIComponent(q)}` },
  hbo: { name: "HBO Max", cls: "hbo", search: (q) => `https://play.hbomax.com/search?q=${encodeURIComponent(q)}` },
  go3: { name: "Go3", cls: "go3", search: () => "https://go3.lt/" },
  epika: { name: "LRT Epika", cls: "epika", search: () => "https://epika.lrt.lt/" },
  atv: { name: "Apple TV", cls: "atv", search: (q) => `https://tv.apple.com/lt/search?term=${encodeURIComponent(q)}` },
};

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const dur = (m) => (m ? `${Math.floor(m / 60)} val. ${m % 60} min.` : "");
const plural = (n, a, b, c) => { const t = n % 100, o = n % 10; return (t > 10 && t < 20) || o === 0 ? c : o === 1 ? a : b; };
const WD = ["Sk", "Pr", "An", "Tr", "Kt", "Pn", "Št"];
const WDL = ["sekmadienis", "pirmadienis", "antradienis", "trečiadienis", "ketvirtadienis", "penktadienis", "šeštadienis"];
const MONTHS = ["sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio", "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio"];
const KIDS = new Set(["V", "N-7"]);
const TICKET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
const store = {
  get(k, d) { try { const v = localStorage.getItem("kinas." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("kinas." + k, JSON.stringify(v)); } catch {} },
};
function vilniusNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
const dateObj = (iso) => new Date(iso + "T12:00:00");
const ALL = "all";
const isAll = () => state.day === ALL;
function dayLabel(iso) {
  if (iso === ALL) return "Visi filmai, visos dienos";
  const d = dateObj(iso);
  return `${iso === NOW.date ? "Šiandien, " : ""}${MONTHS[d.getMonth()]} ${d.getDate()} d., ${WDL[d.getDay()]}`;
}

let NOW = vilniusNow();
let PAGES = {};
let FILMS = [], SESS = [], DAYS = [], CATALOG = [], TOP = null, UPDATED = "";
const state = {
  tab: "filmai", day: "", from: "now", q: "", genre: "",
  cinemas: new Set(store.get("cinemas", [])), kids: false, prem: false, cheap: false, limit: 30,
  liked: new Set(store.get("liked", [])), favGenres: new Set(store.get("favGenres", [])),
};

/* ---------- data ---------- */
async function load() {
  const [data, stream] = await Promise.all([
    fetch("data.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch("streaming.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => null),
  ]);
  UPDATED = data.updated;
  try { PAGES = await (await fetch("films-index.json", { cache: "no-cache" })).json(); } catch { PAGES = {}; }
  FILMS = data.films.map((f, i) => ({ ...f, i, id: norm(f.title), key: norm([f.title, f.orig, (f.genres || []).join(" "), f.director, f.cast].join(" ")) }));
  SESS = data.sessions.map((s) => ({ f: s.f, c: s.c, day: s.t.slice(0, 10), m: +s.t.slice(11, 13) * 60 + +s.t.slice(14, 16), u: s.u, b: (s.g || []).join(" · ") }));
  DAYS = [...new Set(SESS.map((s) => s.day))].filter((d) => d >= NOW.date).sort();
  if (!DAYS.length) DAYS = [...new Set(SESS.map((s) => s.day))].sort();
  if (stream) {
    TOP = stream;
    const t = stream.top || {};
    if (stream.platforms) {
      // Naujas formatas (scripts/streaming.mjs): platformos → sąrašai → filmai su plakatais ir vertinimais.
      CATALOG = stream.platforms.flatMap((p) => p.lists.flatMap((l) => l.items.map((x) => ({ ...x, p: p.k, k: x.kind || "" }))))
        .concat(stream.extra || []).filter((x) => STREAM[x.p]);
      CATALOG = CATALOG.flatMap((x) => [{ ...x, n: norm(x.t) }, ...(x.o ? [{ ...x, n: norm(x.o) }] : [])]);
    } else CATALOG = [
      ...(t.nfMovies || []).map((x) => ({ t: x, p: "nf", k: "Filmas" })),
      ...(t.nfShows || []).map((x) => ({ t: x, p: "nf", k: "Serialas" })),
      ...(t.hbo || []).map((x) => ({ t: x, p: "hbo", k: "" })),
      ...(t.pv || []).map((x) => ({ t: x, p: "pv", k: "" })),
      ...(stream.extra || []),
    ].map((x) => ({ ...x, n: norm(x.t) }));
    if (!stream.platforms) CATALOG = CATALOG.filter((x) => STREAM[x.p]);
  }
  // Liked films are stored by normalized title so they survive daily updates.
  state.liked = new Set([...state.liked].filter((x) => typeof x === "string"));
  const hashTab = (location.hash || "").slice(1);
  if (["filmai", "teatrai", "namuose", "tau"].includes(hashTab)) state.tab = hashTab;
  // Pradžioje rodomi visi filmai per visas dienas (įskaitant tuos, kurie pradės rodyti vėliau).
  state.day = ALL;
  state.from = "now";
}

/* ---------- controls ---------- */
function buildDays() {
  $("#days").innerHTML = `<button class="day all" type="button" data-d="${ALL}" aria-pressed="${isAll()}" aria-label="Visos dienos"><small>Visos</small><b>${DAYS.length}<i>d.</i></b></button>` + DAYS.map((iso, i) => {
    const d = dateObj(iso);
    const label = iso === NOW.date ? "Šiand." : i > 0 && DAYS[i - 1] === NOW.date ? "Rytoj" : WD[d.getDay()];
    return `<button class="day" type="button" data-d="${iso}" aria-pressed="${iso === state.day}" aria-label="${esc(dayLabel(iso))}"><small>${label}</small><b>${d.getDate()}</b></button>`;
  }).join("");
}
function buildFrom() {
  const opts = [];
  if (isAll() || state.day === NOW.date) opts.push(["now", "Nuo dabar"]);
  opts.push(["0", "Visą dieną"]);
  for (let h = 10; h <= 22; h++) opts.push([String(h * 60), `Nuo ${String(h).padStart(2, "0")}:00`]);
  opts.push(["e17", "Vakare (po 17:00)"]);
  if (!opts.some((o) => o[0] === state.from)) state.from = opts[0][0];
  $("#from").innerHTML = opts.map(([v, l]) => `<option value="${v}"${v === state.from ? " selected" : ""}>${l}</option>`).join("");
}
function buildStatic() {
  const genres = [...new Set(FILMS.flatMap((f) => f.genres || []))].sort((a, b) => a.localeCompare(b, "lt"));
  $("#genre").insertAdjacentHTML("beforeend", genres.map((g) => `<option>${esc(g)}</option>`).join(""));
  $("#cinemaChips").innerHTML = Object.entries(CINEMAS).map(([k, c]) => `<button class="chip" type="button" data-c="${k}" aria-pressed="${state.cinemas.has(k)}">${esc(c.short)}</button>`).join("");
  state.allGenres = genres;
}
function wire() {
  $("#days").addEventListener("click", (e) => {
    const b = e.target.closest(".day"); if (!b) return;
    state.day = b.dataset.d; state.limit = 30;
    $("#days").querySelectorAll(".day").forEach((x) => x.setAttribute("aria-pressed", x === b));
    buildFrom(); render();
  });
  $("#from").addEventListener("change", (e) => { state.from = e.target.value; render(); });
  $("#genre").addEventListener("change", (e) => { state.genre = e.target.value; render(); });
  $("#q").addEventListener("input", (e) => { state.q = e.target.value; state.limit = 30; $("#qclear").hidden = !state.q; render(); });
  $("#qclear").addEventListener("click", () => { state.q = ""; $("#q").value = ""; $("#qclear").hidden = true; render(); $("#q").focus(); });
  $("#fbtn").addEventListener("click", () => {
    const open = $("#filters").hidden; $("#filters").hidden = !open; $("#fbtn").setAttribute("aria-expanded", open);
  });
  $("#cinemaChips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return; const c = b.dataset.c;
    state.cinemas.has(c) ? state.cinemas.delete(c) : state.cinemas.add(c);
    b.setAttribute("aria-pressed", state.cinemas.has(c)); savePrefs(); render();
  });
  [["#fKids", "kids"], ["#fImax", "prem"], ["#fCheap", "cheap"]].forEach(([id, k]) =>
    $(id).addEventListener("click", (e) => { state[k] = !state[k]; e.currentTarget.setAttribute("aria-pressed", state[k]); render(); }));
  document.querySelector("nav.tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });
  $("#main").addEventListener("click", onMainClick);
  $("#sheet").addEventListener("click", (e) => {
    if (e.target.id === "sheet" || e.target.closest(".sh-close")) $("#sheet").close();
    const like = e.target.closest("[data-like]"); if (like) toggleLike(like);
    const sh = e.target.closest("[data-share]"); if (sh) openShare(+sh.dataset.share);
  });
  // Lankomumas: „pirkti bilietą“ paspaudimai pagal kino teatrą (GoatCounter)
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.t");
    if (a && window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "bilietas/" + (a.dataset.c || "?"), title: a.dataset.f || "", event: true });
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { NOW = vilniusNow(); render(); } });
}
function setTab(t) {
  state.tab = t;
  document.querySelectorAll("nav.tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", x.dataset.tab === t));
  history.replaceState(null, "", "#" + t);
  render(); window.scrollTo({ top: 0 });
}

/* ---------- pomėgiai: šiame įrenginyje + paskyroje (auth.js) ---------- */
function prefs() { return { liked: [...state.liked], favGenres: [...state.favGenres], cinemas: [...state.cinemas] }; }
function savePrefs() {
  const p = prefs();
  store.set("liked", p.liked); store.set("favGenres", p.favGenres); store.set("cinemas", p.cinemas);
  if (window.kinaiCloud) window.kinaiCloud.save(p);
}
// auth.js kviečia prisijungus: sujungiame paskyros ir šio įrenginio pomėgius.
window.kinai = {
  prefs,
  merge(remote) {
    if (!remote) return prefs();
    (remote.liked || []).forEach((x) => typeof x === "string" && state.liked.add(x));
    (remote.favGenres || []).forEach((x) => state.favGenres.add(x));
    if (!state.cinemas.size) (remote.cinemas || []).forEach((x) => CINEMAS[x] && state.cinemas.add(x));
    const p = prefs();
    store.set("liked", p.liked); store.set("favGenres", p.favGenres); store.set("cinemas", p.cinemas);
    if (FILMS.length) {
      document.querySelectorAll("#cinemaChips .chip").forEach((b) => b.setAttribute("aria-pressed", state.cinemas.has(b.dataset.c)));
      render();
    }
    return p;
  },
  userChanged() { if (FILMS.length) render(); },
};

/* ---------- filtering ---------- */
function minFrom(day = state.day) {
  if (state.from === "now") return day === NOW.date ? NOW.min - 5 : 0;
  if (state.from === "e17") return 17 * 60;
  return +state.from;
}
function sessOK(s) {
  if (isAll() ? s.day < NOW.date : s.day !== state.day) return false;
  if (s.m < minFrom(s.day)) return false;
  if (state.cinemas.size && !state.cinemas.has(s.c)) return false;
  if (state.prem && !/IMAX|LIUKS|iLUXE/i.test(s.b)) return false;
  if (state.cheap && !/5 €|nemokam/i.test(s.b)) return false;
  return true;
}
function filmOK(f) {
  if (state.genre && !(f.genres || []).includes(state.genre)) return false;
  if (state.kids && !KIDS.has(f.age)) return false;
  const q = norm(state.q);
  if (q && !q.split(" ").every((w) => f.key.includes(w))) return false;
  return true;
}
function grouped() {
  const by = new Map();
  for (const s of SESS) {
    if (!sessOK(s)) continue;
    const f = FILMS[s.f]; if (!filmOK(f)) continue;
    if (!by.has(f.i)) by.set(f.i, []); by.get(f.i).push(s);
  }
  const out = [...by.entries()].map(([i, ss]) => ({ f: FILMS[i], ss, all: ss }));
  if (!isAll()) return out.sort((a, b) => b.ss.length - a.ss.length || a.ss[0].m - b.ss[0].m);
  // Visų dienų režimas: kortelėje – artimiausios dienos seansai; rikiuojama pagal pirmą rodymo dieną, tada pagal populiarumą.
  for (const x of out) { x.first = x.all[0].day; x.ss = x.all.filter((s) => s.day === x.first); }
  return out.sort((a, b) => a.first.localeCompare(b.first) || b.all.length - a.all.length || a.ss[0].m - b.ss[0].m);
}
const shortDay = (iso) => { const d = dateObj(iso); return iso === NOW.date ? "Šiandien" : `${MONTHS[d.getMonth()]} ${d.getDate()} d.`; };
function dayNote(x) {
  // Rodoma tik „visų dienų“ režime: kurios dienos seansai rodomi ir kiek dar dienų filmas rodomas.
  if (!x.first) return "";
  const days = [...new Set(x.all.map((s) => s.day))];
  // „Premjera“ – tik kai kino teatras nurodo vėlesnę premjeros datą (kitaip tai tiesiog artimiausias seansas).
  const prem = x.first > NOW.date && (x.f.release || "") > NOW.date;
  return `<div class="dnote">${prem ? `<span class="prem">Premjera ${esc(shortDay(x.first))}</span>` : `<b>${x.first > NOW.date ? "Artimiausias: " : ""}${esc(shortDay(x.first))}</b>`}${days.length > 1 ? `<span>rodomas ${days.length} ${plural(days.length, "dieną", "dienas", "dienų")} · ${x.all.length} ${plural(x.all.length, "seansas", "seansai", "seansų")}</span>` : ""}</div>`;
}

/* ---------- streaming ---------- */
function streamMatches(q) {
  const w = norm(q).split(" ").filter((x) => x.length > 1);
  return w.length ? CATALOG.filter((x) => w.every((v) => x.n.includes(v))) : [];
}
const streamBtns = (items) => `<div class="sbtns">${items.filter((x, i, a) => a.findIndex((y) => y.p === x.p) === i).map((x) => { const p = STREAM[x.p]; return `<a class="sbtn ${p.cls}" href="${esc(x.url || p.search(x.t))}" target="_blank" rel="noopener">${p.name}</a>`; }).join("")}</div>`;
function streamBox(q) {
  const m = streamMatches(q); if (!m.length) return "";
  return `<section class="stream" aria-label="Žiūrėti namuose"><h3>Žiūrėti namuose</h3>${m.map((x) => `<div style="display:grid;gap:6px"><div style="font-weight:700">${esc(x.t)}${x.k ? ` <small style="color:var(--muted);font-weight:400">· ${esc(x.k)}</small>` : ""}</div>${streamBtns([x])}</div>`).join("")}</section>`;
}
function filmStream(f) {
  const keys = [norm(f.title), norm(f.orig)].filter(Boolean);
  const m = CATALOG.filter((x) => keys.includes(x.n));
  return m.length ? `<div class="cin"><div class="cname">Žiūrėti namuose</div>${streamBtns(m)}</div>` : "";
}

/* ---------- render pieces ---------- */
function chip(s) {
  const c = CINEMAS[s.c];
  return `<a class="t" data-c="${s.c}" data-f="${esc(FILMS[s.f].title)}" href="${esc(s.u)}" target="_blank" rel="noopener" aria-label="Pirkti bilietą ${hm(s.m)}, ${esc(c.name)}"><b>${hm(s.m)}</b>${s.b ? `<small>${esc(s.b)}</small>` : ""}</a>`;
}
function poster(f, big) {
  const h = hue(f.title);
  const letter = (f.title.replace(/^[^\p{L}\p{N}]+/u, "")[0] || "").toUpperCase();
  const img = f.poster ? `<img src="${esc(f.poster)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  return `<${big ? "div" : "button type=\"button\""} class="poster" ${big ? "" : `data-open="${f.i}" aria-label="Apie filmą ${esc(f.title)}"`} style="background:linear-gradient(160deg,hsl(${h} 55% 40%),hsl(${(h + 40) % 360} 60% 18%))"><span aria-hidden="true">${esc(letter)}</span>${img}</${big ? "div" : "button"}>`;
}
const meta = (f) => `<div class="meta">${f.age ? `<span class="age">${esc(f.age)}</span>` : ""}${(f.genres || []).length ? `<span>${esc(f.genres.slice(0, 3).join(", "))}</span>` : ""}${f.dur ? `<span>${dur(f.dur)}</span>` : ""}</div>`;
function sessionsBlock(ss) {
  const byC = {};
  ss.forEach((s) => (byC[s.c] = byC[s.c] || []).push(s));
  return Object.keys(byC).sort((a, b) => byC[a][0].m - byC[b][0].m).map((c) =>
    `<div class="cin"><div class="cname">${esc(CINEMAS[c].name)}<small>${byC[c].length} ${plural(byC[c].length, "seansas", "seansai", "seansų")}</small></div><div class="times">${byC[c].map(chip).join("")}</div></div>`).join("");
}
function filmCard(f, ss, x) {
  return `<article class="film">
    <div class="fhead">${poster(f)}
      <div class="ftitle"><h2><button type="button" data-open="${f.i}">${esc(f.title)}</button></h2>${f.orig ? `<div class="orig">${esc(f.orig)}</div>` : ""}${meta(f)}
        ${f.desc ? `<p class="desc">${esc(f.desc)}</p>` : ""}</div>
      <div class="acts"><button class="like" type="button" data-like="${esc(f.id)}" aria-pressed="${state.liked.has(f.id)}" aria-label="Patinka">${HEART}</button><button class="like share" type="button" data-share="${f.i}" aria-label="Dalintis">${SHARE}</button></div>
    </div>
    ${x ? dayNote(x) : ""}${sessionsBlock(ss)}${filmStream(f)}
  </article>`;
}

function renderFilms() {
  const g = grouped();
  const total = g.reduce((a, x) => a + x.all.length, 0);
  let h = `<div class="status">${esc(dayLabel(state.day))} · ${g.length} ${plural(g.length, "filmas", "filmai", "filmų")} · ${total} ${plural(total, "seansas", "seansai", "seansų")}</div>`;
  if (!g.length) {
    h += `<div class="empty"><strong>Nieko neradome</strong>${state.q ? "Šią dieną šis filmas kine nerodomas. Pabandykite kitą dieną ar laiką." : "Pakeiskite laiką, dieną arba filtrus."}</div>`;
  } else {
    h += `<p class="hint">${TICKET}Paspauskite seanso laiką, kad pirktumėte bilietą</p><div class="list" style="margin-top:8px">${g.slice(0, state.limit).map((x) => filmCard(x.f, x.ss, x)).join("")}</div>`;
    if (g.length > state.limit) h += `<button class="more" type="button" id="more" style="margin-top:12px">Rodyti dar ${g.length - state.limit}</button>`;
  }
  if (state.q) { const sb = streamBox(state.q.trim()); if (sb) h += `<div style="height:12px"></div>${sb}`; }
  if (!isAll()) h += renderSoon();
  return h;
}
function renderSoon() {
  // „Netrukus“: filmai, kurių pirmas seansas vėlesnis nei rytoj.
  const first = new Map();
  for (const s of SESS) if (!first.has(s.f) || s.day < first.get(s.f)) first.set(s.f, s.day);
  const soon = [...first.entries()].filter(([, d]) => d > DAYS[1]).sort((a, b) => a[1].localeCompare(b[1])).slice(0, 12);
  if (!soon.length) return "";
  return `<section class="sec"><h3>Netrukus kine</h3><ul class="soon">${soon.map(([i, d]) => { const dt = dateObj(d); return `<li><b>${MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getDate()}</b><button class="ft" type="button" data-open="${i}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer">${esc(FILMS[i].title)}</button></li>`; }).join("")}</ul></section>`;
}
function renderCinemas() {
  const keys = Object.keys(CINEMAS).filter((k) => !state.cinemas.size || state.cinemas.has(k));
  let h = `<div class="status">${esc(dayLabel(state.day))}</div><div class="list">`;
  for (const k of keys) {
    const c = CINEMAS[k], by = new Map();
    for (const s of SESS) { if (s.c !== k || !sessOK(s)) continue; const f = FILMS[s.f]; if (!filmOK(f)) continue; if (!by.has(f.i)) by.set(f.i, []); by.get(f.i).push(s); }
    let items = [...by.entries()];
    if (isAll()) items = items.map(([i, ss]) => [i, ss.filter((s) => s.day === ss[0].day)]).sort((a, b) => a[1][0].day.localeCompare(b[1][0].day) || a[1][0].m - b[1][0].m);
    else items.sort((a, b) => a[1][0].m - b[1][0].m);
    h += `<section class="cinema-card"><h2>${esc(c.name)}</h2><div class="addr">${esc(c.addr)} · <a href="${esc(c.home)}" target="_blank" rel="noopener">Svetainė</a></div>
      ${items.length ? items.map(([i, ss]) => { const f = FILMS[i]; return `<div class="crow"><button class="ft" type="button" data-open="${i}">${esc(f.title)}<small>${isAll() ? esc(shortDay(ss[0].day)) + " · " : ""}${esc(f.age || "")}${f.dur ? " · " + dur(f.dur) : ""}</small></button><div class="times">${ss.map(chip).join("")}</div></div>`; }).join("")
        : `<div class="crow" style="color:var(--muted);font-size:13px">Pagal pasirinktą laiką seansų nėra.</div>`}</section>`;
  }
  return h + "</div>";
}
function topList(items, plat) {
  const p = STREAM[plat], q = norm(state.q);
  const list = q ? items.filter((t) => norm(t).includes(q)) : items;
  if (!list.length) return `<p>Šiame sąraše pagal paiešką nieko nėra.</p>`;
  return `<ol class="top10">${list.map((t) => `<li style="counter-set:n ${items.indexOf(t)}"><span>${esc(t)}</span><a href="${esc(p.search(t))}" target="_blank" rel="noopener" style="background:var(--${p.cls})">Žiūrėti</a></li>`).join("")}</ol>`;
}
function rating(x) {
  return `${x.imdb ? `<a class="rt imdb" href="https://www.imdb.com/title/${esc(x.imdbId)}/" target="_blank" rel="noopener" aria-label="IMDb ${esc(x.imdb)}"><b>IMDb</b>${esc(x.imdb)}</a>` : ""}${x.rt ? `<span class="rt tom" aria-label="Rotten Tomatoes ${esc(x.rt)}"><b>RT</b>${esc(x.rt)}</span>` : ""}`;
}
function homeCard(x, i, p) {
  const P = STREAM[p.k], title = x.t, h = hue(title);
  const watch = x.url || P.search(x.o || x.t);
  return `<li class="hc"><a class="hc-p" href="${esc(watch)}" target="_blank" rel="noopener" style="background:linear-gradient(160deg,hsl(${h} 55% 40%),hsl(${(h + 40) % 360} 60% 18%))" aria-label="${esc(title)} – ${esc(P.name)}">
      <span aria-hidden="true">${esc((title.replace(/^[^\p{L}\p{N}]+/u, "")[0] || "").toUpperCase())}</span>${x.poster ? `<img src="${esc(x.poster)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<i>${i + 1}</i></a>
    <div class="hc-t">${esc(title)}</div><div class="hc-m">${[x.y || "", x.kind || ""].filter(Boolean).join(" · ")}</div>
    <div class="hc-r">${rating(x)}</div>
    <div class="hc-b"><a class="hb" href="${esc(watch)}" target="_blank" rel="noopener" style="background:var(--${P.cls})">Žiūrėti</a>${x.trailer ? `<a class="hb ghost" href="${esc(x.trailer)}" target="_blank" rel="noopener">▶ Anonsas</a>` : ""}</div></li>`;
}
function renderHomeNew() {
  const q = norm(state.q);
  const match = (x) => !q || norm([x.t, x.o].join(" ")).includes(q);
  let h = `<div class="status">Populiariausi Lietuvoje · atnaujinta ${esc(new Intl.DateTimeFormat("lt-LT", { timeZone: "Europe/Vilnius", month: "long", day: "numeric" }).format(new Date(TOP.updated)))}</div>`;
  let any = false;
  for (const p of TOP.platforms) {
    if (!STREAM[p.k]) continue;
    const lists = p.lists.map((l) => ({ ...l, items: l.items.filter(match) })).filter((l) => l.items.length);
    if (!lists.length) continue;
    any = true;
    h += `<section class="sec"><h3><span class="plat" style="background:var(--${STREAM[p.k].cls})"></span>${esc(p.name)}</h3>${lists.map((l) =>
      `${lists.length > 1 || p.lists.length > 1 ? `<p>${esc(l.name)}</p>` : ""}<ol class="hrow">${l.items.map((x, i) => homeCard(x, i, p)).join("")}</ol>`).join("")}</section>`;
  }
  if (!any) h += `<div class="empty"><strong>Nieko neradome</strong>Pagal paiešką populiariausiųjų sąrašuose nieko nėra.</div>`;
  h += `<p class="hint" style="margin-top:14px">IMDb ir Rotten Tomatoes vertinimai – iš OMDb. Anonsai atsidaro YouTube ar platformoje.</p>`;
  return h;
}
function renderHome() {
  if (TOP && TOP.platforms) return renderHomeNew();
  if (!TOP) return `<div class="empty"><strong>Nepavyko įkelti</strong>Srautinių platformų sąrašas šiuo metu neprieinamas.</div>`;
  const t = TOP.top || {};
  const sec = (title, cls, items, p) => items && items.length ? `<section class="sec"><h3><span class="plat" style="background:var(--${cls})"></span>${title}</h3>${topList(items, p)}</section>` : "";
  return `<div class="status">Populiariausi Lietuvoje · ${esc(TOP.updated || "")}</div><div class="cols">
    ${sec("Netflix filmai", "nf", t.nfMovies, "nf")}${sec("Netflix serialai", "nf", t.nfShows, "nf")}${sec("HBO Max", "hbo", t.hbo, "hbo")}${sec("Prime Video", "pv", t.pv, "pv")}</div>`;
}
function renderForYou() {
  const fav = state.favGenres, liked = state.liked;
  const weights = {}, people = {};
  fav.forEach((g) => (weights[g] = (weights[g] || 0) + 2));
  // Širdelės: kiekvienas patikęs filmas sustiprina savo žanrus, režisierių ir aktorius.
  const likedFilms = FILMS.filter((f) => liked.has(f.id));
  likedFilms.forEach((f) => {
    (f.genres || []).forEach((g) => (weights[g] = (weights[g] || 0) + 1));
    splitPeople(f.director).forEach((n) => (people[n] = (people[n] || 0) + 3));
    splitPeople(f.cast).forEach((n) => (people[n] = (people[n] || 0) + 1.5));
  });
  const ac = window.kinaiAuth;
  const who = ac && ac.enabled ? (ac.user
    ? `Pomėgiai išsaugoti paskyroje <b>${esc(ac.user.name)}</b> – matysite juos ir kituose įrenginiuose.`
    : `<button class="linkbtn" type="button" data-login>Prisijunkite</button>, kad širdelės ir žanrai išliktų visuose įrenginiuose.`)
    : "Pasirinkimai saugomi šiame įrenginyje.";
  let h = `<section class="sec" style="margin-top:14px"><h3>Mano skonis</h3><p>Pažymėkite mėgstamus žanrus arba spauskite širdelę prie patikusių filmų – rekomendacijos prisitaikys. ${who}</p>
    <div class="tags">${state.allGenres.map((g) => `<button class="chip" type="button" data-g="${esc(g)}" aria-pressed="${fav.has(g)}">${esc(g)}</button>`).join("")}</div>
    ${likedFilms.length ? `<p style="margin-top:4px"><b style="color:var(--ink)">Jums patiko (${likedFilms.length}):</b></p><div class="tags">${likedFilms.map((f) => `<button class="chip" type="button" data-open="${f.i}">♥ ${esc(f.title)}</button>`).join("")}</div>` : ""}</section>`;
  if (!Object.keys(weights).length) return h + `<div class="empty"><strong>Pasirinkite žanrus</strong>Tada čia pamatysite jums tinkančius filmus su artimiausiais seansais.</div>`;
  const score = (f) => (f.genres || []).reduce((a, gg) => a + (weights[gg] || 0), 0)
    + [...splitPeople(f.director), ...splitPeople(f.cast)].reduce((a, n) => a + (people[n] || 0), 0);
  // Jau patikę filmai rodomi atskirai viršuje, rekomendacijose – tik nauji atradimai.
  const g = grouped().map((x) => ({ ...x, score: score(x.f) }))
    .filter((x) => x.score > 0 && !liked.has(x.f.id)).sort((a, b) => b.score - a.score || b.all.length - a.all.length);
  h += `<div class="status">Rekomenduojama tau · ${esc(dayLabel(state.day))}</div>`;
  h += g.length ? `<div class="list">${g.slice(0, 12).map((x) => filmCard(x.f, x.ss, x)).join("")}</div>` : `<div class="empty"><strong>Šią dieną nėra</strong>Pabandykite kitą dieną ar laiką.</div>`;
  return h;
}
function splitPeople(s) { return String(s || "").split(/\s*,\s*/).map(norm).filter((x) => x.length > 3); }
function footer() {
  const d = UPDATED ? new Date(UPDATED) : null;
  const when = d ? new Intl.DateTimeFormat("lt-LT", { timeZone: "Europe/Vilnius", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "";
  return `<footer><p class="updated">Atnaujinta: ${esc(when)}</p><p>Seansai, aprašymai ir plakatai iš Forum Cinemas, Apollo Kinas, Vue, „Pasakos“ ir „Skalvijos“ svetainių. Bilietus parduoda patys kino teatrai: paspaudus laiką atsidaro jų pardavimo puslapis.</p><p>„Žiūrėti namuose“ rodoma tik tada, kai filmas patvirtintai yra platformoje.</p></footer>`;
}
function render() {
  const n = state.cinemas.size + state.kids + state.prem + state.cheap;
  $("#fcount").hidden = !n; $("#fcount").textContent = n;
  const views = { filmai: renderFilms, teatrai: renderCinemas, namuose: renderHome, tau: renderForYou };
  $("#main").innerHTML = views[state.tab]() + footer();
}

/* ---------- film detail sheet ---------- */
function openFilm(i) {
  const f = FILMS[i];
  if (isAll()) return openFilmAll(i);
  const ss = SESS.filter((s) => s.f === i && s.day === state.day && s.m >= minFrom());
  const nextDays = [...new Set(SESS.filter((s) => s.f === i && s.day > state.day).map((s) => s.day))].slice(0, 4);
  $("#sheetBody").innerHTML = `
    <button class="sh-close" type="button" aria-label="Uždaryti">×</button>
    <div class="sh-top">${poster(f, true)}
      <div style="min-width:0"><h2 id="sheetTitle">${esc(f.title)}</h2>${f.orig ? `<div class="orig">${esc(f.orig)}${f.year ? `, ${f.year}` : ""}</div>` : ""}${meta(f)}
        <div class="acts row" style="margin-top:10px"><button class="like" type="button" data-like="${esc(f.id)}" aria-pressed="${state.liked.has(f.id)}" aria-label="Patinka">${HEART}</button><button class="like share" type="button" data-share="${f.i}" aria-label="Dalintis">${SHARE}</button></div></div>
    </div>
    ${sheetInfo(f)}
    <div class="status" style="margin:4px 0 0">${esc(dayLabel(state.day))}</div>
    ${ss.length ? sessionsBlock(ss) : `<p style="margin:0;color:var(--muted);font-size:14px">Šią dieną pagal pasirinktą laiką seansų nėra.${nextDays.length ? ` Kitos dienos: ${nextDays.map((d) => `<button class="chip" type="button" data-goday="${d}" data-film="${i}">${dateObj(d).getDate()} d.</button>`).join(" ")}` : ""}</p>`}
    ${filmStream(f)}`;
  $("#sheetBody").querySelectorAll("[data-goday]").forEach((b) => b.addEventListener("click", () => {
    state.day = b.dataset.goday; state.from = "0";
    $("#days").querySelectorAll(".day").forEach((x) => x.setAttribute("aria-pressed", x.dataset.d === state.day));
    buildFrom(); render(); openFilm(+b.dataset.film);
  }));
  const dlg = $("#sheet");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
function sheetTop(f) {
  return `<button class="sh-close" type="button" aria-label="Uždaryti">×</button>
    <div class="sh-top">${poster(f, true)}
      <div style="min-width:0"><h2 id="sheetTitle">${esc(f.title)}</h2>${f.orig ? `<div class="orig">${esc(f.orig)}${f.year ? `, ${f.year}` : ""}</div>` : ""}${meta(f)}
        <div class="acts row" style="margin-top:10px"><button class="like" type="button" data-like="${esc(f.id)}" aria-pressed="${state.liked.has(f.id)}" aria-label="Patinka">${HEART}</button><button class="like share" type="button" data-share="${f.i}" aria-label="Dalintis">${SHARE}</button></div></div>
    </div>`;
}
function sheetInfo(f) {
  return `${f.desc ? `<p class="sh-desc">${esc(f.desc)}</p>` : ""}
    ${f.director || f.cast ? `<div class="sh-credits">${f.director ? `<div><b>Režisierius:</b> ${esc(f.director)}</div>` : ""}${f.cast ? `<div><b>Vaidina:</b> ${esc(f.cast)}</div>` : ""}</div>` : ""}
    ${f.trailer ? `<a class="trailer" href="${esc(f.trailer)}" target="_blank" rel="noopener">▶ Žiūrėti anonsą</a>` : ""}
    ${PAGES[f.title] ? `<a class="trailer" href="filmai/${esc(PAGES[f.title])}/">Visi filmo seansai ir aprašymas →</a>` : ""}`;
}
function openFilmAll(i) {
  // Visų dienų režimas: filmo lange – visi būsimi seansai, sugrupuoti pagal dieną.
  const f = FILMS[i];
  const ss = SESS.filter((s) => s.f === i && sessOK(s));
  const byDay = new Map();
  ss.forEach((s) => (byDay.get(s.day) || byDay.set(s.day, []).get(s.day)).push(s));
  $("#sheetBody").innerHTML = sheetTop(f) + sheetInfo(f) +
    (byDay.size ? [...byDay.entries()].map(([d, x]) => `<div class="status" style="margin:10px 0 0">${esc(dayLabel(d))}</div>${sessionsBlock(x)}`).join("")
      : `<p style="margin:0;color:var(--muted);font-size:14px">Pagal pasirinktus filtrus seansų nėra.</p>`) + filmStream(f);
  const dlg = $("#sheet");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
/* ---------- dalijimasis filmo nuoroda ---------- */
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function filmUrl(f) { return PAGES[f.title] ? `https://kinai.lt/filmai/${PAGES[f.title]}/` : `https://kinai.lt/?f=${encodeURIComponent(f.id)}`; }
function openShare(i) {
  const f = FILMS[i], url = filmUrl(f), text = `${f.title} – seansai Vilniaus kino teatruose`;
  const u = encodeURIComponent(url), tu = encodeURIComponent(`${text} ${url}`);
  const items = [
    ["copy", "Kopijuoti nuorodą", "", "#6b6472"],
    ["wa", "WhatsApp", `https://wa.me/?text=${tu}`, "#1fa855"],
    ["vb", "Viber", `viber://forward?text=${tu}`, "#7360f2"],
    ["ms", "Messenger", MOBILE ? `fb-messenger://share/?link=${u}` : "", "#0a7cff"],
    ["sms", "SMS", `sms:${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?"}body=${tu}`, "#34a853"],
  ];
  if (navigator.share && MOBILE) items.push(["more", "Daugiau…", "", "#1d1a24"]);
  const dlg = $("#shareDlg");
  dlg.innerHTML = `<div class="sh-in"><button class="sh-close" type="button" aria-label="Uždaryti">×</button>
    <h2 class="au-h" style="font-size:24px">Dalintis</h2><p class="au-p">${esc(f.title)}</p>
    <div class="share-grid">${items.map(([k, l, href, c]) =>
      href ? `<a class="sbtn2" data-sk="${k}" href="${esc(href)}" ${k === "wa" ? 'target="_blank" rel="noopener"' : ""}><i style="background:${c}"></i>${l}</a>`
           : `<button class="sbtn2" type="button" data-sk="${k}"><i style="background:${c}"></i>${l}</button>`).join("")}</div>
    <input class="share-url" readonly value="${esc(url)}" aria-label="Filmo nuoroda"><p class="au-msg ok" role="status"></p></div>`;
  const say = (t) => (dlg.querySelector(".au-msg").textContent = t);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { const inp = dlg.querySelector(".share-url"); inp.select(); document.execCommand("copy"); }
  };
  dlg.onclick = async (e) => {
    if (e.target === dlg || e.target.closest(".sh-close")) return dlg.close();
    const b = e.target.closest("[data-sk]"); if (!b) return;
    const k = b.dataset.sk;
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "dalintis/" + k, title: f.title, event: true });
    if (k === "copy") { await copy(); say("Nuoroda nukopijuota ✓"); }
    else if (k === "ms" && !MOBILE) { await copy(); say("Nuoroda nukopijuota – įklijuokite ją Messenger pokalbyje."); window.open("https://www.messenger.com/", "_blank", "noopener"); }
    else if (k === "more") { try { await navigator.share({ title: f.title, text, url }); } catch {} }
  };
  if (!dlg.open) dlg.showModal();
}
function toggleLike(btn) {
  const id = btn.dataset.like;
  state.liked.has(id) ? state.liked.delete(id) : state.liked.add(id);
  savePrefs();
  document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach((b) => b.setAttribute("aria-pressed", state.liked.has(id)));
  if (state.tab === "tau") render();
}
function onMainClick(e) {
  const like = e.target.closest("[data-like]"); if (like) return toggleLike(like);
  const sh = e.target.closest("[data-share]"); if (sh) return openShare(+sh.dataset.share);
  const g = e.target.closest("[data-g]");
  if (g) { const v = g.dataset.g; state.favGenres.has(v) ? state.favGenres.delete(v) : state.favGenres.add(v); savePrefs(); return render(); }
  if (e.target.closest("[data-login]")) return window.kinaiAuth && window.kinaiAuth.open();
  const open = e.target.closest("[data-open]"); if (open) return openFilm(+open.dataset.open);
  if (e.target.id === "more") { state.limit += 30; render(); }
}

/* ---------- start ---------- */
load().then(() => {
  buildStatic(); buildDays(); buildFrom(); wire();
  document.querySelectorAll("nav.tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", x.dataset.tab === state.tab));
  render();
  const deep = new URLSearchParams(location.search).get("f");
  if (deep) { const f = FILMS.find((x) => x.id === deep); if (f) openFilm(f.i); }
  requestAnimationFrame(() => { const a = $("#days [aria-pressed='true']"); if (a) a.scrollIntoView({ inline: "center", block: "nearest" }); });
}).catch((e) => {
  $("#main").innerHTML = `<div class="empty"><strong>Nepavyko įkelti repertuaro</strong>Pabandykite atnaujinti puslapį po kelių minučių.</div>`;
  console.error(e);
});
