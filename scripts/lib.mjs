// Bendros pagalbinės funkcijos: užklausos, laikas, pavadinimų normalizavimas, žanrai.

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export async function getJSON(url, opts = {}) {
  const res = await fetchRetry(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Ne JSON atsakymas iš ${url}: ${text.slice(0, 120)}`); }
}

export async function fetchRetry(url, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { "User-Agent": UA, "Accept": "application/json, text/html;q=0.9", "Accept-Language": "lt,en;q=0.8", ...(opts.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res;
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Grąžina šiandienos ir kitų dienų datas Vilniaus laiku: ["2026-10-21", ...]. */
export function vilniusDays(count) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    out.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
  }
  return out;
}

/** Unix sekundės -> "YYYY-MM-DDTHH:MM" Vilniaus laiku. */
export function unixToVilnius(sec) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(sec * 1000)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`;
}

export function key(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// Seanso ciklų priešdėliai ir priesagos: nuimami nuo pavadinimo ir paverčiami žymomis.
const PREFIX = [
  [/^5 eurų savaitė:\s*/i, "5 € savaitė"],
  [/^(20-asis )?Lenkų kino festivalis( 2026)?:?\s*/i, "Lenkų kino festivalis"],
  [/^NK'?26:\s*/i, "Nepatogus kinas"],
  [/^Šeimų sekmadienis:\s*/i, "Šeimų sekmadienis"],
  [/^Bohemiški vakarai:\s*/i, "Bohemiški vakarai"],
  [/^POWER HIT RADIO premjera:\s*/i, "Išankstinė premjera"],
  [/^LADIES FIRST!\s*/i, "Ladies first"],
  [/^PASIKLYDĘ EKRANE kino klasika:\s*/i, "Kino klasika"],
  [/^Nemokamas seansas senjorams:\s*/i, "Senjorams · nemokamas"],
  [/^RC kino premjera:\s*/i, "Premjera"],
  [/^90-ųjų kioskas pristato:\s*Jubiliejiniai filmai\s*/i, "90-ųjų kioskas"],
  [/^Šiurpnaktis:\s*/i, "Šiurpnaktis"],
  [/^Vidurnakčio klyksmai:\s*/i, "Vidurnakčio klyksmai"],
  [/^SCA26:\s*/i, "Scanorama"],
  [/^Festiwal filmu polskiego:\s*/i, ""],
  [/^[A-Z !'’]*premiere:\s*/, ""],
  [/^NK'?26:\s*/i, ""],
];
const SUFFIX = [
  [/\s*\(dubliuotas\)/i, "Dubliuotas"],
  [/\s*\(su lietuviškais subtitrais\)/i, "LT subtitrai"],
  [/\s*\(išankstinė premjera\)/i, "Išankstinė premjera"],
  [/\s*\+\s*susitikimas/i, "Su susitikimu"],
  [/\s*\+\s*diskusija/i, "Su diskusija"],
  [/\s*\+\s*discussion/i, ""],
  [/\s*\(dubbed\)/i, ""],
  [/\s*\(with lithuanian subtitles\)/i, ""],
  [/\s*\(\d{4}\)$/, ""],
];

/** Išvalo pavadinimą: grąžina { title, tags }. */
export function cleanTitle(raw) {
  let t = (raw || "").replace(/\s+/g, " ").trim().replace(/^[„"“]+|[“"”]+$/g, "");
  const tags = [];
  for (const [re, tag] of [...PREFIX, ...SUFFIX]) {
    if (re.test(t)) { t = t.replace(re, ""); if (tag) tags.push(tag); }
  }
  return { title: t.trim(), tags };
}

/** VISOS DIDŽIOSIOS -> Pirmoji didžioji. */
export function fixCase(t) {
  if (!t) return t;
  const letters = t.replace(/[^A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]/g, "");
  if (letters && letters === letters.toUpperCase() && letters.length > 3) {
    t = t.toLowerCase();
  }
  const i = t.search(/[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]/);
  return i < 0 ? t : t.slice(0, i) + t[i].toUpperCase() + t.slice(i + 1);
}

const GMAP = {
  "seimos": "Šeimai", "seimai": "Šeimai", "visai seimai": "Šeimai", "animacinis": "Animacija", "animacija": "Animacija",
  "dokumentika": "Dokumentinis", "dokumentinis": "Dokumentinis", "mistika": "Mistinis", "mistinis": "Mistinis",
  "psichologinis trileris": "Trileris", "romantine drama": "Romantinis|Drama", "kriminaline drama": "Kriminalinis|Drama",
  "juodoji komedija": "Komedija", "satyra": "", "erotinis": "", "koncertas": "Koncertas", "specialus renginys": "",
  "miuziklas": "Muzikinis", "muzikinis": "Muzikinis", "istorinis": "Istorinis", "karinis": "Karo", "karo": "Karo",
  "moksline fantastika": "Mokslinė fantastika", "fantastinis": "Fantastinis", "fantastika": "Fantastinis",
  "veiksmo": "Veiksmo", "nuotykiu": "Nuotykių", "siaubo": "Siaubo", "trileris": "Trileris", "drama": "Drama",
  "komedija": "Komedija", "kriminalinis": "Kriminalinis", "biografinis": "Biografinis", "romantinis": "Romantinis",
  "detektyvas": "Kriminalinis", "anime": "Animacija", "lietuviskas kinas": "Lietuviškas", "sporto": "Sporto",
};
export const KNOWN_GENRE_KEYS = new Set(Object.keys(GMAP));

export function genres(list) {
  const arr = Array.isArray(list) ? list : String(list || "").split(",");
  const out = [];
  for (const g of arr) {
    const k = key(g);
    if (!k) continue;
    const m = k in GMAP ? GMAP[k] : null;
    if (m === null) continue; // nežinomas žanras (šalis, kalba ir pan.)
    for (const x of m.split("|")) if (x && !out.includes(x)) out.push(x);
  }
  return out;
}

export function age(a) {
  a = String(a || "").trim().toUpperCase().replace(/\s/g, "");
  const m = a.match(/^(V|N-?\d{1,2})/);
  if (!m) return /^\d{1,2}$/.test(a) ? "N-" + a : "";
  return m[1] === "V" ? "V" : m[1].replace(/^N-?/, "N-");
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "’")
    .replace(/&bdquo;/g, "„").replace(/&ldquo;/g, "“").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&scaron;/g, "š")
    .replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function youtube(u) {
  if (!u) return "";
  const m = String(u).match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || String(u).match(/^([\w-]{11})$/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : "";
}
