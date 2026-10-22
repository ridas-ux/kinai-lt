/* Kinai.lt – lankytojų prisijungimas (Google, el. paštas) ir pomėgių saugojimas paskyroje.
   Naudoja Firebase Authentication + Cloud Firestore (users/{uid}).
   Kol firebase-config.js tuščias, prisijungimo mygtukas nerodomas ir svetainė veikia kaip anksčiau. */
const V = "12.19.0";
const CFG = window.KINAI_FIREBASE || {};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ui = { enabled: false, user: null, open: () => {} };
window.kinaiAuth = ui;

const ERR = {
  "auth/invalid-email": "Neteisingas el. pašto adresas.",
  "auth/missing-password": "Įveskite slaptažodį.",
  "auth/weak-password": "Slaptažodis per trumpas – bent 6 simboliai.",
  "auth/email-already-in-use": "Paskyra su šiuo el. paštu jau yra – spauskite „Prisijungti“.",
  "auth/invalid-credential": "Neteisingas el. paštas arba slaptažodis.",
  "auth/wrong-password": "Neteisingas el. paštas arba slaptažodis.",
  "auth/user-not-found": "Tokios paskyros nėra – spauskite „Sukurti paskyrą“.",
  "auth/too-many-requests": "Per daug bandymų. Pabandykite po kelių minučių.",
  "auth/network-request-failed": "Nėra interneto ryšio.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/account-exists-with-different-credential": "Šis el. paštas jau naudojamas kitu prisijungimo būdu.",
  "auth/unauthorized-domain": "Šis adresas neįtrauktas į Firebase leidžiamus domenus.",
  "auth/operation-not-allowed": "Šis prisijungimo būdas dar neįjungtas.",
};
const msg = (e) => (e && e.code in ERR ? ERR[e.code] : "Nepavyko. Pabandykite dar kartą.");

if (CFG.apiKey && CFG.projectId) start().catch((e) => console.error("auth", e));

async function start() {
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js"),
  ]);
  const app = initializeApp(CFG);
  const auth = A.getAuth(app);
  auth.languageCode = "lt";
  const db = F.getFirestore(app);
  if (CFG.emulator) { A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); F.connectFirestoreEmulator(db, "127.0.0.1", 8080); } // tik testams
  const ref = (u) => F.doc(db, "users", u.uid);

  ui.enabled = true;
  const btn = $("#acct"), dlg = $("#authDlg"), body = $("#authBody");
  btn.hidden = false;

  /* --- pomėgių sinchronizavimas --- */
  let timer = 0, uid = null;
  window.kinaiCloud = {
    save(p) {
      if (!uid) return;
      clearTimeout(timer);
      timer = setTimeout(() => F.setDoc(F.doc(db, "users", uid), { ...p, updated: F.serverTimestamp() }, { merge: true }).catch((e) => console.warn("save", e)), 800);
    },
  };

  A.onAuthStateChanged(auth, async (u) => {
    uid = u ? u.uid : null;
    ui.user = u ? { name: u.displayName || u.email || "", email: u.email || "", photo: u.photoURL || "" } : null;
    paintButton();
    if (u) {
      try {
        const snap = await F.getDoc(ref(u));
        const merged = window.kinai ? window.kinai.merge(snap.exists() ? snap.data() : null) : null;
        if (merged) await F.setDoc(ref(u), { ...merged, name: ui.user.name, updated: F.serverTimestamp() }, { merge: true });
      } catch (e) { console.warn("load", e); }
    }
    if (dlg.open) paint();
    if (window.kinai) window.kinai.userChanged();
  });
  A.getRedirectResult(auth).catch((e) => console.warn("redirect", e));

  /* --- UI --- */
  function paintButton() {
    const u = ui.user;
    btn.setAttribute("aria-label", u ? `Paskyra: ${u.name}` : "Prisijungti");
    btn.classList.toggle("in", !!u);
    btn.innerHTML = u
      ? (u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<b>${esc((u.name || "?").trim()[0].toUpperCase())}</b>`)
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Prisijungti</span>`;
  }
  function paint(note = "") {
    const u = ui.user;
    if (u) {
      const p = window.kinai ? window.kinai.prefs() : { liked: [], favGenres: [] };
      body.innerHTML = `<button class="sh-close" type="button" aria-label="Uždaryti">×</button>
        <h2 id="authTitle" class="au-h">Jūsų paskyra</h2>
        <p class="au-p">Prisijungta kaip <b>${esc(u.name)}</b>${u.email && u.email !== u.name ? ` (${esc(u.email)})` : ""}.</p>
        <p class="au-p">Išsaugota: ${p.liked.length} patikę filmai, ${p.favGenres.length} mėgstami žanrai. Rekomendacijas rasite skiltyje „Tau“.</p>
        <button class="au-btn" type="button" data-act="tau">Mano rekomendacijos</button>
        <button class="au-btn ghost" type="button" data-act="out">Atsijungti</button>`;
      return;
    }
    body.innerHTML = `<button class="sh-close" type="button" aria-label="Uždaryti">×</button>
      <h2 id="authTitle" class="au-h">Prisijungti</h2>
      <p class="au-p">Širdelės ir mėgstami žanrai bus išsaugoti jūsų paskyroje, o rekomendacijos – tos pačios telefone ir kompiuteryje.</p>
      <button class="au-btn google" type="button" data-act="google"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Tęsti su Google</button>
      <div class="au-or"><span>arba el. paštu</span></div>
      <form class="au-form" novalidate>
        <label>El. paštas<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label>Slaptažodis<input name="pass" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="au-row"><button class="au-btn" type="submit" data-act="in">Prisijungti</button><button class="au-btn ghost" type="button" data-act="new">Sukurti paskyrą</button></div>
        <button class="linkbtn" type="button" data-act="reset">Pamiršau slaptažodį</button>
      </form>
      <p class="au-msg" role="status">${esc(note)}</p>
      <p class="au-small">Prisijungę sutinkate, kad saugotume jūsų el. paštą ir pomėgius (patikusius filmus, žanrus, kino teatrus) tik rekomendacijoms. Paskyrą ištrinsime paprašius.</p>`;
  }
  const say = (t, ok) => { const m = body.querySelector(".au-msg"); if (m) { m.textContent = t; m.classList.toggle("ok", !!ok); } };
  const busy = (on) => body.querySelectorAll("button,input").forEach((x) => (x.disabled = on));

  ui.open = () => { paint(); if (!dlg.open) dlg.showModal(); };
  btn.addEventListener("click", ui.open);
  dlg.addEventListener("click", async (e) => {
    if (e.target === dlg || e.target.closest(".sh-close")) return dlg.close();
    const b = e.target.closest("[data-act]"); if (!b || b.type === "submit") return;
    await act(b.dataset.act);
  });
  dlg.addEventListener("submit", (e) => { e.preventDefault(); act("in"); });

  async function act(a) {
    const f = body.querySelector(".au-form");
    const email = f ? f.email.value.trim() : "", pass = f ? f.pass.value : "";
    try {
      if (a === "google") {
        const prov = new A.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: "select_account" });
        busy(true);
        try { await A.signInWithPopup(auth, prov); }
        catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return A.signInWithRedirect(auth, prov); throw e; }
        dlg.close();
      } else if (a === "in" || a === "new") {
        if (!email) return say("Įveskite el. pašto adresą.");
        if (!pass) return say("Įveskite slaptažodį.");
        busy(true);
        if (a === "new") {
          const c = await A.createUserWithEmailAndPassword(auth, email, pass);
          A.sendEmailVerification(c.user).catch(() => {});
        } else await A.signInWithEmailAndPassword(auth, email, pass);
        dlg.close();
      } else if (a === "reset") {
        if (!email) return say("Įrašykite el. paštą ir spauskite dar kartą.");
        busy(true);
        await A.sendPasswordResetEmail(auth, email);
        say("Išsiuntėme laišką slaptažodžiui atkurti. Patikrinkite paštą.", true);
      } else if (a === "out") {
        await A.signOut(auth); dlg.close();
      } else if (a === "tau") {
        dlg.close(); document.querySelector('nav.tabs [data-tab="tau"]').click();
      }
    } catch (e) {
      console.warn(a, e); say(msg(e));
    } finally { busy(false); }
  }
}
