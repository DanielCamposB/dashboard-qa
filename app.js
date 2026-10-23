(async function () {
  const D = window.QA_DATA, { addDays, uid, iso } = D;
  const $ = s => document.querySelector(s);
  const DAY = 86400000, today = iso(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
  const d2n = s => Math.round(Date.parse(s + "T00:00:00Z") / DAY);
  const n2d = n => new Date(n * DAY).toISOString().slice(0, 10);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (m, err) => {
    const e = $("#msg"); e.textContent = m || ""; e.className = "msg" + (err ? " err" : ""); if (m && !err) setTimeout(() => say(""), 1800);
    if (m) toast(m, err);
  };
  // Aviso visible también sobre ventanas modales (el #msg de la página queda tapado por ellas)
  function toast(m, err) {
    const open = [...document.querySelectorAll("dialog[open]")].pop();
    const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.setAttribute("role", "alert"); t.textContent = m;
    t.onclick = () => t.remove();
    (open || document.body).append(t); setTimeout(() => t.remove(), err ? 9000 : 2200);
  }
  const errText = e => (e && (e.message || e.error_description || e.details)) || String(e);
  window.addEventListener("error", ev => { console.error(ev.error || ev.message); toast("Error: " + (ev.message || errText(ev.error)), 1); });
  window.addEventListener("unhandledrejection", ev => { console.error(ev.reason); toast("Error: " + errText(ev.reason), 1); });
  const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const errEs = e => {
    const m = String(e?.message || e || ""), s = e?.status;
    if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(m)) return "Aún no confirmas tu correo. Abre el enlace que te enviamos (revisa spam).";
    if (/already registered|already been registered/i.test(m)) return "Ese correo ya tiene una cuenta. Usa «Ingresar» u «Olvidé mi contraseña».";
    if (/password should be at least|weak password/i.test(m)) return "La contraseña es muy débil o corta (mínimo 8 caracteres).";
    if (/should be different/i.test(m)) return "La nueva contraseña debe ser distinta a la anterior.";
    if (/rate limit|too many|security purposes/i.test(m) || s === 429) return "Demasiados intentos o correos enviados. Espera unos minutos e inténtalo de nuevo.";
    if (/signups? not allowed|signup is disabled/i.test(m)) return "El registro de cuentas está deshabilitado. Pide al administrador que te cree el usuario.";
    if (/invalid email|unable to validate email/i.test(m)) return "El correo no tiene un formato válido.";
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
    if (/jwt|session|expired/i.test(m)) return "El enlace expiró o ya fue usado. Solicita uno nuevo.";
    return "Error: " + m;
  };
  function drawArt() {                       // red de nodos decorativa (generada, sin imágenes externas)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = Array.from({ length: 46 }, () => ({ x: rnd() * 600, y: rnd() * 600, r: 1.5 + rnd() * 3, d: rnd() * 4 }));
    let s = '<defs><radialGradient id="gl" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#00ffff" stop-opacity=".35"/><stop offset="1" stop-color="#00ffff" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="url(#gl)"/>';
    pts.forEach((p, i) => pts.slice(i + 1).forEach(q => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 120) s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#00ffff" stroke-opacity="${(0.5 * (1 - d / 120)).toFixed(2)}"/>`; }));
    pts.forEach(p => (s += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#00ffff" class="nd" style="animation-delay:${p.d.toFixed(1)}s"/>`));
    $("#heroArt").innerHTML = s;
  }
  function showLogin(boot) {
    $("#login").hidden = false; $("#app").hidden = true; document.querySelector("header.top").hidden = true; $("#actionbar").hidden = true;
    document.body.classList.add("on-login"); drawArt();
    const f = $("#loginForm"), err = $("#loginErr"), info = $("#loginInfo");
    let mode = boot.recovery ? "newpw" : "login";
    const showErr = t => { err.textContent = t; err.hidden = !t; };
    const setMode = m => {
      mode = m; showErr("");
      const t = { login: ["Ingresar al Dashboard QA", "Usa tu correo y contraseña.", "Ingresar"], signup: ["Crear cuenta", "Usa tu correo corporativo. Un administrador debe autorizar tu acceso después.", "Crear cuenta"],
        reset: ["Recuperar contraseña", "Te enviaremos un enlace para crear una contraseña nueva.", "Enviar enlace"], newpw: ["Nueva contraseña", "Escribe tu nueva contraseña (mínimo 8 caracteres).", "Guardar contraseña"] }[m];
      $("#loginTitle").textContent = t[0]; info.textContent = t[1]; $("#loginBtn").textContent = t[2];
      f.email.parentElement.hidden = m === "newpw"; $("#pwRow").hidden = m === "reset"; $("#pw2Row").hidden = !(m === "signup" || m === "newpw");
      f.password.autocomplete = m === "login" ? "current-password" : "new-password";
      $("#lnkSignup").hidden = m !== "login"; $("#lnkReset").hidden = m === "reset" || m === "newpw"; $("#lnkBack").hidden = m === "login";
    };
    document.querySelectorAll("#loginForm .eye").forEach(b => (b.onclick = () => { const i = b.previousElementSibling, show = i.type === "password"; i.type = show ? "text" : "password"; b.classList.toggle("on", show); }));
    $("#lnkSignup").onclick = e => { e.preventDefault(); setMode("signup"); };
    $("#lnkReset").onclick = e => { e.preventDefault(); setMode("reset"); };
    $("#lnkBack").onclick = e => { e.preventDefault(); setMode("login"); };
    if (boot.denied) {
      info.textContent = `Tu correo (${boot.user}) no tiene acceso. Pide a un administrador que te agregue.`; f.hidden = true; document.querySelector(".loginLinks").hidden = true;
      const b = document.createElement("button"); b.textContent = "Cerrar sesión"; b.onclick = D.logout; $("#login .login-panel").append(b); return;
    }
    setMode(mode);
    if (boot.initError) showErr(errEs(boot.initError));
    f.onsubmit = async e => {
      e.preventDefault(); showErr("");
      const email = f.email.value.trim(), pw = f.password.value, pw2 = f.password2.value;
      if (mode !== "newpw") { if (!email) return showErr("Escribe tu correo."); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showErr("El correo no tiene un formato válido."); }
      if (mode !== "reset" && !pw) return showErr("Escribe tu contraseña.");
      if (mode === "signup" || mode === "newpw") { if (pw.length < 8) return showErr("La contraseña debe tener al menos 8 caracteres."); if (pw !== pw2) return showErr("Las contraseñas no coinciden."); }
      const btn = $("#loginBtn"); btn.disabled = true;
      try {
        if (mode === "login") { await D.login(email, pw); location.reload(); }
        else if (mode === "signup") { const inSession = await D.signUp(email, pw); if (inSession) location.reload(); else { setMode("login"); info.textContent = "Cuenta creada. Revisa tu correo y confirma el enlace; luego ingresa."; } }
        else if (mode === "reset") { await D.resetPassword(email); setMode("login"); info.textContent = "Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo (y spam)."; }
        else { await D.updatePassword(pw); history.replaceState(null, "", location.pathname); location.reload(); }
      } catch (er) { showErr(errEs(er)); }
      btn.disabled = false;
    };
  }
  const boot = await D.init().catch(e => ({ needLogin: true, initError: e }));
  if (boot.needLogin || boot.denied) { showLogin(boot); return; }
  let store = boot.store, readOnly = boot.forceRead ?? (lsGet("qa-mode", "edit") === "read"), pxDay = +lsGet("qa-zoom", 14), draft = null, isNew = false;
  const save = () => D.save(store);
  let clientId = lsGet("qa-client", "all");
  const clientName = id => store.clients.find(c => c.id === id)?.name || "—";
  const scoped = () => (clientId === "all" ? store.reqs : store.reqs.filter(r => r.clientId === clientId));
  const memberRoles = id => store.members.find(m => m.id === id)?.roles || [];
  const pick = (attr, sel, off) => `<details class="rolepick"><summary>${sel.length ? esc(sel.join(", ")) : "Sin rol"}</summary><div class="rpmenu">${store.roles.length ? store.roles.map(r => `<label><input type="checkbox" ${attr} value="${esc(r)}"${sel.includes(r) ? " checked" : ""}${off ? " disabled" : ""}> ${esc(r)}</label>`).join("") : '<small class="muted">Crea un rol primero</small>'}</div></details>`;
  const mname = id => store.members.find(m => m.id === id)?.name || "—";
  // Responsables: lista (assigneeIds); assigneeId se mantiene como el primero por compatibilidad con datos antiguos
  const ids = x => (x?.assigneeIds?.length ? x.assigneeIds : x?.assigneeId ? [x.assigneeId] : []).filter(i => store.members.some(m => m.id === i));
  const effIds = (a, r) => (ids(a).length ? ids(a) : ids(r));
  const mnames = (x, fb) => { const l = effIds(x, fb); return l.length ? l.map(mname).join(", ") : "—"; };
  const pctOpts = cur => { const l = Array.from({ length: 21 }, (_, i) => i * 5); if (!l.includes(cur) && cur >= 0) l.push(cur), l.sort((x, y) => x - y); return l.map(p => `<option${p === cur ? " selected" : ""}>${p}</option>`).join(""); };
  // Tipos de requerimiento = plantillas de actividades: "trad", "express" y las personalizadas (customTpl)
  const BASE_TYPES = { trad: "Tradicional", express: "Express" };
  const typeName = t => BASE_TYPES[t] || (store.customTpl || []).find(c => c.id === t)?.name || "Tipo eliminado";
  const tplFor = t => store.templates[t] || (store.customTpl || []).find(c => c.id === t)?.acts || store.templates.trad;
  const typeOpts = (first, base) => (first ? `<option value="">${first}</option>` : "") + (base ? `<option value="trad">QA Tradicional (Gantt)</option><option value="express">QA Express (rápido)</option>` : `<option value="express">QA Express</option><option value="trad">QA Tradicional</option>`) + (store.customTpl || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const setIds =(x, l) => { x.assigneeIds = l; x.assigneeId = l[0] || ""; };
  const rolesOf = x => [...new Set(ids(x).flatMap(memberRoles))];
  const memberPick = (attr, sel, off) => `<details class="rolepick"><summary>${sel.length ? esc(sel.map(mname).join(", ")) : "Sin asignar"}</summary><div class="rpmenu">${store.members.length ? store.members.map(m => `<label><input type="checkbox" ${attr} value="${m.id}"${sel.includes(m.id) ? " checked" : ""}${off ? " disabled" : ""}> ${esc(m.name)}${m.roles.length ? " · " + esc(m.roles.join(", ")) : ""}</label>`).join("") : '<small class="muted">Agrega miembros en Equipo</small>'}</div></details>`;

  // ---------- cálculos ----------
  const span = r => r.acts.length ? [r.acts.map(a => a.start).sort()[0], r.acts.map(a => a.end).sort().pop()] : [r.start, r.end];
  function progress(r) {
    if (!r.acts.length) return +r.percent || 0;
    const w = r.acts.map(a => d2n(a.end) - d2n(a.start) + 1), tot = w.reduce((s, x) => s + x, 0);
    return Math.round(r.acts.reduce((s, a, i) => s + a.percent * w[i], 0) / tot);
  }
  const late = r => r.status !== "Completado" && span(r)[1] < today;
  // Alertas de atraso: 1 día, 2-4, 5-6, 1 semana, 2+ semanas
  const daysLate = end => d2n(today) - d2n(end);
  const lvl = d => d >= 14 ? 4 : d >= 7 ? 3 : d >= 5 ? 2 : d >= 2 ? 1 : 0;
  const lvlTxt = d => d >= 14 ? Math.floor(d / 7) + " semanas" : d >= 7 ? Math.floor(d / 7) + " semana" + (d >= 14 ? "s" : "") + (d % 7 ? " y " + (d % 7) + " d" : "") : d + (d === 1 ? " día" : " días");
  function alertsList() {
    const out = [];
    for (const r of scoped()) {
      if (r.status === "Completado") continue;
      const e = span(r)[1];
      let worst = { d: daysLate(e), what: "Requerimiento" };
      for (const a of r.acts) if (a.percent < 100 && daysLate(a.end) > worst.d) worst = { d: daysLate(a.end), what: "Actividad: " + a.name };
      if (worst.d >= 1) out.push({ r, ...worst });
    }
    return out.sort((a, b) => b.d - a.d);
  }
  const lastComment = r => r.comments.length ? r.comments[r.comments.length - 1] : null;

  // ---------- seguimiento: última actualización, compromiso, check-in ----------
  const STALE = 2;                                   // días hábiles sin actualizar para alertar
  const bizDaysSince = day => { let n = d2n(day), c = 0; const t = d2n(today); while (n < t) { n++; const w = new Date(n * DAY).getUTCDay(); if (w !== 0 && w !== 6) c++; } return c; };
  const ldate = s => (s ? iso(new Date(new Date(s).getTime() - new Date().getTimezoneOffset() * 60000)) : "");   // fecha local de un instante ISO
  const staleDays = r => (r.status === "Completado" ? 0 : bizDaysSince(ldate(r.lastUpdate) || today));
  const staleList = () => scoped().filter(r => staleDays(r) >= STALE).sort((x, y) => staleDays(y) - staleDays(x));
  const authorName = () => lsGet("qa-author", "") || "Anónimo";
  const commit = op => { op(store); D.queueOp(op); save(); };   // cambio pequeño que se puede re-aplicar si otra persona guardó antes
  const slip = r => (r.committedEnd && span(r)[1] > r.committedEnd ? d2n(span(r)[1]) - d2n(r.committedEnd) : 0);
  const delOverdue = r => r.deliverables.filter(d => d.state === "pendiente" && d.due && d.due < today);
  const delDone = r => r.deliverables.filter(d => d.state !== "pendiente").length;
  const M = r => r.metrics || {};
  const openDef = r => ["crit", "high", "med", "low"].reduce((s, k) => s + (+M(r)[k] || 0), 0);
  const pct = (n, d) => (d > 0 ? Math.round(((+n || 0) / d) * 100) : null);
  function health(r) {                              // semáforo por requerimiento
    if (r.status === "Completado") return { lvl: "d", why: ["Completado"] };
    const why = []; let red = false, yel = false;
    const worstLate = Math.max(daysLate(span(r)[1]), ...r.acts.filter(x => x.percent < 100).map(x => daysLate(x.end)));
    if (worstLate >= 3) { red = true; why.push("atraso de " + lvlTxt(worstLate)); } else if (worstLate >= 1) { yel = true; why.push("atraso de " + lvlTxt(worstLate)); }
    const bd = Math.max(0, ...r.acts.filter(x => x.blocked).map(x => (x.blockedSince ? d2n(today) - d2n(x.blockedSince) : 0)));
    if (r.acts.some(x => x.blocked) || r.status === "Bloqueado") { if (bd >= 3) { red = true; why.push("bloqueado hace " + lvlTxt(bd)); } else { yel = true; why.push("bloqueado"); } }
    const od = delOverdue(r); if (od.length) { const dd = Math.max(...od.map(x => daysLate(x.due))); if (dd >= 3) red = true; else yel = true; why.push(od.length + " entregable(s) vencido(s)"); }
    const sl = slip(r); if (sl >= 5) { red = true; why.push("plazo +" + sl + " d vs compromiso"); } else if (sl >= 1) { yel = true; why.push("plazo +" + sl + " d vs compromiso"); }
    if (staleDays(r) >= STALE) { yel = true; why.push("sin actualizar " + staleDays(r) + " días hábiles"); }
    return { lvl: red ? "r" : yel ? "y" : "g", why };
  }
  function statusSync(r, nowIso) {
    const p = progress(r), anyB = r.acts.some(x => x.blocked); r.percent = p; r.lastUpdate = nowIso;
    if (p >= 100) { if (r.status !== "Completado") { r.status = "Completado"; r.completedAt = today; } return; }
    if (r.status === "Completado") r.status = "En curso";
    if (anyB) r.status = "Bloqueado"; else if (r.status === "Bloqueado") r.status = "En curso"; else if (p > 0 && r.status === "Pendiente") r.status = "En curso";
  }
  function askReason(msg) {
    return new Promise(res => {
      const d = $("#rsdlg"); $("#rsMsg").textContent = msg; $("#rsText").value = ""; $("#rsErr").hidden = true;
      const done = v => { d.close(); res(v); };
      $("#rsOk").onclick = () => { const v = $("#rsText").value.trim(); if (!v) { $("#rsErr").hidden = false; return; } done(v); };
      $("#rsCancel").onclick = () => done(null); d.oncancel = e => { e.preventDefault(); done(null); };
      d.showModal(); $("#rsText").focus();
    });
  }

  // ---------- navegación / modo ----------
  function setView(v) {
    document.querySelectorAll(".view").forEach(e => (e.hidden = e.id !== "v-" + v));
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    render();
  }
  const fullName = () => { const p = D.getProfile(); return [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" "); };
  function refreshUserMenu() {
    const em = boot.user || "", p = D.getProfile();
    const nm = fullName() || (em ? em.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Usuario local");
    const ini = p.nombres ? ((p.nombres[0] || "") + (p.apellido_paterno?.[0] || "")).toUpperCase() : nm.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
    $("#avatar").textContent = $("#avatar2").textContent = ini || "?";
    $("#uname").textContent = p.nombres ? p.nombres.split(" ")[0] : nm; $("#uname2").textContent = nm; $("#uemail").textContent = em;
    $("#ucargo").textContent = [p.cargo, p.vertical].filter(Boolean).join(" · "); $("#ucargo").hidden = !$("#ucargo").textContent;
    const roleTxt = D.isAdmin() ? "Administrador" : readOnly ? "Solo lectura" : "Editor";
    $("#urole").textContent = D.isAdmin() ? "★ Administrador" : roleTxt; $("#urole").className = "badge " + (D.isAdmin() ? "admin" : readOnly ? "read" : "edit");
    $("#avatarBtn").classList.toggle("isAdmin", D.isAdmin()); $("#avatar").title = D.isAdmin() ? "Administrador" : "";
    $("#tabPerm").hidden = !D.isAdmin();
    if (fullName()) lsSet("qa-author", fullName()); else if (em && !lsGet("qa-author", "")) lsSet("qa-author", em.split("@")[0]);
  }
  function initUserMenu() {
    $("#userMenu").hidden = false; $("#btnLogout").hidden = !D.remote;
    const menu = $("#umenu"), btn = $("#avatarBtn"), toggle = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); };
    btn.onclick = e => { e.stopPropagation(); toggle(menu.hidden); };
    document.addEventListener("click", e => { if (!menu.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") toggle(false); });
    $("#btnProfile").onclick = () => { toggle(false); openProfile(false); };
  }
  // ---------- Mi perfil ----------
  function openProfile(first) {
    const f = $("#pform"), p = D.getProfile();
    f.email.value = boot.user || "(modo local)";
    ["nombres", "apellido_paterno", "apellido_materno", "cargo", "vertical", "cumpleanos", "telefono"].forEach(k => (f[k].value = p[k] ?? ""));
    $("#pErr").hidden = true; $("#pAdminBadge").hidden = !D.isAdmin();
    $("#pHint").textContent = first ? "Bienvenido/a. Completa tu perfil para que el equipo te identifique. Puedes editarlo después desde «Mi perfil»." : "Esta información identifica a cada integrante del equipo.";
    $("#pdlg").showModal();
  }
  async function submitProfile(e) {
    e.preventDefault(); const f = e.target, err = $("#pErr"); err.hidden = true;
    if (!f.nombres.value.trim()) { err.textContent = "Escribe tus nombres."; err.hidden = false; return; }
    if (!f.apellido_paterno.value.trim()) { err.textContent = "Escribe tu apellido paterno."; err.hidden = false; return; }
    if (f.cumpleanos.value && f.cumpleanos.value > today) { err.textContent = "La fecha de cumpleaños no puede ser futura."; err.hidden = false; return; }
    const btn = $("#pSave"); btn.disabled = true;
    try {
      await D.saveProfile(Object.fromEntries(["nombres", "apellido_paterno", "apellido_materno", "cargo", "vertical", "cumpleanos", "telefono"].map(k => [k, f[k].value])));
      $("#pdlg").close(); refreshUserMenu(); say("Perfil guardado ✓"); if (!$("#v-team").hidden) renderTeam();
    } catch (er) {
      const m = String(er.message || er);
      err.textContent = /column .* does not exist|schema cache/i.test(m) ? "Falta ejecutar el SQL de perfiles en Supabase (archivo supabase-perfil.sql)." : /permission denied|row-level/i.test(m) ? "No tienes permiso para guardar este perfil." : /failed to fetch|network/i.test(m) ? "No hay conexión con el servidor. Inténtalo de nuevo." : "No se pudo guardar: " + m;
      err.hidden = false;
    }
    btn.disabled = false;
  }
  const ROLE_TXT = { admin: "Administrador", editor: "Editor", viewer: "Solo lectura" };
  // Directorio de perfiles (solo editores con Supabase)
  let profCache = { at: 0, rows: [] };
  async function renderProfiles() {
    const card = $("#profCard"); card.hidden = !(D.remote && !readOnly); if (card.hidden) return;
    const draw = rows => {
      const bd = r => (r.cumpleanos ? new Date(r.cumpleanos + "T00:00:00Z").toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" }) : "—");
      $("#profTbl").innerHTML = "<thead><tr><th>Nombre</th><th>Cargo</th><th>Vertical</th><th>Cumpleaños</th><th>Teléfono</th><th>Correo</th><th>Acceso</th></tr></thead><tbody>" +
        rows.map(r => `<tr><td>${esc([r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(" ")) || '<span class="muted">Sin completar</span>'}</td><td>${esc(r.cargo || "—")}</td><td>${esc(r.vertical || "—")}</td><td>${bd(r)}</td><td>${esc(r.telefono || "—")}</td><td>${esc(r.email)}</td><td>${ROLE_TXT[r.role] || r.role}</td></tr>`).join("") + "</tbody>";
    };
    draw(profCache.rows);
    if (Date.now() - profCache.at < 20000) return;
    profCache.at = Date.now();
    try { profCache.rows = await D.listProfiles(); draw(profCache.rows); }
    catch (er) { $("#profTbl").innerHTML = `<tbody><tr><td class="muted">${/does not exist|schema/i.test(er.message) ? "Falta ejecutar supabase-perfil.sql en Supabase." : "No se pudieron cargar los perfiles: " + esc(er.message)}</td></tr></tbody>`; }
  }

  // ---------- Permisos (solo administrador) ----------
  const permErr = er => { const m = String(er.message || er); return /duplicate key|already exists/i.test(m) ? "Ese correo ya tiene acceso." : /row-level|permission denied|Solo un administrador|sin permiso/i.test(m) ? "No tienes permiso de administrador para hacer esto." : /check constraint|profiles_role_check/i.test(m) ? "Falta ejecutar supabase-admin.sql en Supabase." : /failed to fetch|network/i.test(m) ? "No hay conexión con el servidor." : "Error: " + m; };
  async function renderPerms() {
    if (!D.isAdmin()) { $("#v-perm").hidden = true; return; }
    const tbl = $("#permTbl");
    try {
      const rows = await D.listProfiles(), me = D.myEmail();
      tbl.innerHTML = "<thead><tr><th>Correo</th><th>Nombre</th><th>Permiso</th><th></th></tr></thead><tbody>" + rows.map(r => {
        const self = r.email === me, nm = [r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(" ");
        return `<tr><td>${esc(r.email)}${self ? ' <span class="badge">tú</span>' : ""}</td><td>${esc(nm) || '<span class="muted">Sin completar</span>'}</td>
          <td><select data-pe="${esc(r.email)}"${self ? " disabled title=\"No puedes cambiar tu propio permiso\"" : ""}>${Object.entries(ROLE_TXT).map(([k, v]) => `<option value="${k}"${k === r.role ? " selected" : ""}>${v}</option>`).join("")}</select></td>
          <td>${self ? "" : `<button class="danger" data-pd="${esc(r.email)}">Quitar acceso</button>`}</td></tr>`;
      }).join("") + "</tbody>";
      tbl.querySelectorAll("[data-pe]").forEach(s => (s.onchange = async () => {
        try { await D.setRole(s.dataset.pe, s.value); say("Permiso actualizado ✓"); profCache.at = 0; } catch (er) { say(permErr(er), 1); renderPerms(); }
      }));
      tbl.querySelectorAll("[data-pd]").forEach(b => (b.onclick = async () => {
        if (!confirm(`¿Quitar el acceso a ${b.dataset.pd}? Ya no podrá ver el dashboard.`)) return;
        try { await D.removeUser(b.dataset.pd); say("Acceso quitado ✓"); profCache.at = 0; renderPerms(); } catch (er) { say(permErr(er), 1); }
      }));
    } catch (er) { tbl.innerHTML = `<tbody><tr><td class="muted">${esc(permErr(er))}</td></tr></tbody>`; }
  }
  $("#permForm").onsubmit = async e => {
    e.preventDefault(); const f = e.target, email = f.email.value.trim().toLowerCase();
    try { await D.addUser(email, f.role.value); f.reset(); say("Acceso otorgado ✓"); profCache.at = 0; renderPerms(); } catch (er) { say(permErr(er), 1); }
  };

  function applyMode() {
    if (D.remote) { $("#mode").disabled = true; $("#mode").parentElement.hidden = true; }
    refreshUserMenu();
    $("#mode").value = readOnly ? "read" : "edit";
    document.body.classList.toggle("ro", readOnly);
    $("#btnNew").hidden = readOnly; $("#btnImport").hidden = readOnly; $("#btnImportXls").hidden = readOnly;
    $("#actionbar").classList.toggle("ro", readOnly);
    document.querySelectorAll("[data-edit]").forEach(e => (e.hidden = readOnly));
  }

  // ---------- Dashboard ----------
  function visible() {
    const t = $("#fType").value, ro = $("#fRole").value, a = $("#fAssignee").value, s = $("#fStatus").value, q = $("#fText").value.toLowerCase();
    return scoped().filter(r => (!t || r.type === t) && (!a || ids(r).includes(a)) && (!ro || rolesOf(r).includes(ro)) && (!s || r.status === s) &&
      (!q || (r.code + " " + r.title + " " + r.comments.map(c => c.text).join(" ")).toLowerCase().includes(q)));
  }
  function renderDash() {
    const all = scoped(), c = f => all.filter(f).length;
    const al = alertsList(), st = staleList(), total = al.length + st.length;
    $("#alerts").innerHTML = total ? `<details open><summary><b>${total} alerta${total > 1 ? "s" : ""}</b> · ${al.length} de atraso · ${st.length} sin actualizar</summary>` +
      al.map(x => `<div class="al al${lvl(x.d)}" data-id="${x.r.id}"><b>${lvlTxt(x.d)} de atraso</b> · ${esc(x.r.code)} ${esc(x.r.title)} · <span>${esc(x.what)}</span> · ${esc(mnames(x.r))}</div>`).join("") +
      st.map(r => `<div class="al alS" data-id="${r.id}"><b>Sin actualizar hace ${staleDays(r)} días hábiles</b> · ${esc(r.code)} ${esc(r.title)} · <span>Último avance: ${ldate(r.lastUpdate)}</span> · ${esc(mnames(r))}</div>`).join("") + "</details>" : "";
    $("#alerts").querySelectorAll(".al").forEach(x => (x.onclick = () => openReq(x.dataset.id)));
    $("#kpis").innerHTML = [["Requerimientos", all.length], ["QA Express", c(r => r.type === "express")], ["QA Tradicional", c(r => r.type === "trad")],
      ["En curso", c(r => r.status === "En curso")], ["Bloqueados", c(r => r.status === "Bloqueado")], ["Atrasados", c(late)], ["Sin actualizar", st.length], ["Entregables vencidos", all.reduce((n, r) => n + delOverdue(r).length, 0)], ["Completados", c(r => r.status === "Completado")]]
      .map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
    const keep = $("#fAssignee").value;
    $("#fAssignee").innerHTML = `<option value="">Todo el equipo</option>` + store.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
    $("#fAssignee").value = keep;
    const kr = $("#fRole").value;
    $("#fRole").innerHTML = `<option value="">Todos los roles</option>` + store.roles.map(r => `<option>${esc(r)}</option>`).join("");
    $("#fRole").value = kr;
    const rows = visible().sort((a, b) => span(a)[1].localeCompare(span(b)[1]));
    $("#tbl").innerHTML = `<thead><tr>${clientId === "all" ? "<th>Cliente</th>" : ""}<th>Código</th><th>Requerimiento</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Avance</th><th>Entregables</th><th>Inicio</th><th>Fin</th><th>Último seguimiento</th></tr></thead><tbody>` +
      (rows.map(r => {
        const p = progress(r), [s, e] = span(r), lc = lastComment(r);
        return `<tr data-id="${r.id}">${clientId === "all" ? `<td>${esc(clientName(r.clientId))}</td>` : ""}<td><b>${esc(r.code)}</b></td><td>${esc(r.title)}</td>
          <td><span class="pill ${BASE_TYPES[r.type] ? r.type : "custom"}">${esc(typeName(r.type))}</span></td><td>${esc(mnames(r))}<br><small class="muted">${esc(rolesOf(r).join(", "))}</small></td>
          <td><span class="dot ${health(r).lvl}" title="${esc(health(r).why.join(" · ") || "En plazo")}"></span> <span class="st st-${r.status.replace(" ", "")}">${r.status}</span>${late(r) ? ` <span class="st al${lvl(daysLate(span(r)[1]))}">Atrasado ${lvlTxt(daysLate(span(r)[1]))}</span>` : ""}</td>
          <td><div class="pbar"><i style="width:${p}%"></i><span>${p}%</span></div></td><td>${r.deliverables.length ? `${delDone(r)}/${r.deliverables.length}${delOverdue(r).length ? ` <span class="st al3">${delOverdue(r).length} vencido(s)</span>` : ""}` : "—"}</td><td>${s}</td><td>${e}${slip(r) ? ` <span class="st al1" title="Comprometida: ${r.committedEnd}">+${slip(r)} d</span>` : ""}</td>
          <td class="lc">${lc ? `<small>${lc.at.slice(0, 10)} · ${esc(lc.by)}</small><br>${esc(lc.text.slice(0, 90))}` : '<small class="muted">Sin comentarios</small>'} <small class="muted">(${r.comments.length})</small></td></tr>`;
      }).join("") || `<tr><td colspan="11" class="muted" style="padding:20px">Sin requerimientos. Usa "+ Requerimiento".</td></tr>`) + `</tbody>`;
    const hs = [...$("#tbl").querySelectorAll("thead th")].map(t => t.textContent);   // etiquetas para la vista de tarjetas en móvil
    $("#tbl").querySelectorAll("tbody tr[data-id]").forEach(tr => { [...tr.children].forEach((td, i) => (td.dataset.l = hs[i] || "")); tr.onclick = () => openReq(tr.dataset.id); });
  }

  // ---------- Resumen ejecutivo ----------
  function renderResumen() {
    const all = scoped(), act = all.filter(r => r.status !== "Completado"), hs = act.map(r => ({ r, h: health(r) }));
    const cnt = l => hs.filter(x => x.h.lvl === l).length;
    const done = all.filter(r => r.status === "Completado" && r.completedAt), onTime = done.filter(r => r.completedAt <= (r.committedEnd || r.end)).length;
    const ex = pct(all.reduce((n, r) => n + (+M(r).executed || 0), 0), all.reduce((n, r) => n + (+M(r).designed || 0), 0));
    const au = pct(all.reduce((n, r) => n + (+M(r).automated || 0), 0), all.reduce((n, r) => n + (+M(r).designed || 0), 0));
    const crit = all.filter(r => r.status !== "Completado").reduce((n, r) => n + (+M(r).crit || 0) + (+M(r).high || 0), 0);
    $("#resKpis").innerHTML = [["En curso", act.length], ["🟢 En plazo", cnt("g")], ["🟡 En riesgo", cnt("y")], ["🔴 Críticos", cnt("r")],
      ["Cumplimiento de plazos", done.length ? pct(onTime, done.length) + "%" : "—"], ["Entregables vencidos", act.reduce((n, r) => n + delOverdue(r).length, 0)],
      ["Ejecución de casos", ex !== null ? ex + "%" : "—"], ["Automatizado", au !== null ? au + "%" : "—"], ["Defectos críticos/altos", crit]]
      .map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
    const rows = store.clients.filter(c => clientId === "all" || c.id === clientId).map(c => {
      const rs = store.reqs.filter(r => r.clientId === c.id), ac = rs.filter(r => r.status !== "Completado"), h = ac.map(health);
      const d = rs.reduce((n, r) => n + (+M(r).designed || 0), 0), e = rs.reduce((n, r) => n + (+M(r).executed || 0), 0), au2 = rs.reduce((n, r) => n + (+M(r).automated || 0), 0);
      return `<tr><td><b>${esc(c.name)}</b></td><td>${rs.length}</td><td>${ac.length}</td><td><span class="dot g"></span> ${h.filter(x => x.lvl === "g").length}</td><td><span class="dot y"></span> ${h.filter(x => x.lvl === "y").length}</td><td><span class="dot r"></span> ${h.filter(x => x.lvl === "r").length}</td>
        <td>${ac.filter(late).length}</td><td>${ac.filter(r => staleDays(r) >= STALE).length}</td><td>${ac.reduce((n, r) => n + delOverdue(r).length, 0)}</td><td>${pct(e, d) !== null ? pct(e, d) + "%" : "—"}</td><td>${pct(au2, d) !== null ? pct(au2, d) + "%" : "—"}</td><td>${ac.reduce((n, r) => n + openDef(r), 0)}</td></tr>`;
    }).join("");
    $("#resCli").innerHTML = "<thead><tr><th>Cliente</th><th>Total</th><th>En curso</th><th>Verde</th><th>Amarillo</th><th>Rojo</th><th>Atrasados</th><th>Sin actualizar</th><th>Entreg. vencidos</th><th>Ejecución</th><th>Automatizado</th><th>Defectos abiertos</th></tr></thead><tbody>" + (rows || '<tr><td class="muted">Sin clientes</td></tr>') + "</tbody>";
    const att = hs.filter(x => x.h.lvl !== "g").sort((x, y) => (x.h.lvl === "r" ? 0 : 1) - (y.h.lvl === "r" ? 0 : 1) || span(x.r)[1].localeCompare(span(y.r)[1]));
    $("#resAtt").innerHTML = att.length ? att.map(({ r, h }) => `<div class="hrow" data-open="${r.id}"><div class="hinfo"><span class="dot ${h.lvl}"></span> <b>${esc(r.code)}</b> · ${esc(r.title)} <small class="muted">${esc(clientName(r.clientId))} · ${esc(mnames(r))} · plazo ${span(r)[1]}</small>
      <div class="hact">${esc(h.why.join(" · "))}</div></div><div class="hctl"><button class="ghost">Abrir</button></div></div>`).join("") : '<p class="muted">Nada en riesgo. Todo en plazo 👌</p>';
    $("#resAtt").querySelectorAll("[data-open]").forEach(x => (x.onclick = () => openReq(x.dataset.open)));
  }

  // ---------- Hoy ----------
  const myMemberId = () => { const em = (boot.user || "").toLowerCase(); return em ? (store.members.find(m => m.email && m.email.toLowerCase() === em)?.id || "") : ""; };
  let hoyClosed = new Set(); try { hoyClosed = new Set(JSON.parse(lsGet("qa-hoy-closed", "[]"))); } catch {}
  function setHoyAll(close) {
    const keys = [...$("#hoyBody").querySelectorAll(".hgroup")].map(g => g.dataset.g);
    hoyClosed = new Set(close ? keys : []); lsSet("qa-hoy-closed", JSON.stringify([...hoyClosed])); renderHoy();
  }
  function renderHoy() {
    $("#hoyDate").textContent = new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    const mineOn = $("#hoyMine").checked, me = myMemberId(), mine = mineOn && me;
    $("#hoyMineNote").textContent = mineOn && !me ? "No encontré tu correo en la pestaña Equipo; se muestran todas." : "";
    const items = [];
    scoped().forEach(r => { if (r.status === "Completado") return; r.acts.forEach(a => { if (a.percent >= 100) return; if (mine && !effIds(a, r).includes(me)) return; items.push({ r, a }); }); });
    const t0 = d2n(today), within = (i, n) => d2n(i.a.end) > t0 && d2n(i.a.end) <= t0 + n;
    const groups = [
      ["Atrasadas", "al3", items.filter(i => i.a.end < today && !i.a.blocked)],
      ["Vencen hoy", "al1", items.filter(i => i.a.end === today && !i.a.blocked)],
      ["Bloqueadas", "al2", items.filter(i => i.a.blocked)],
      ["En ejecución hoy", "", items.filter(i => i.a.start <= today && i.a.end > today && !within(i, 3) && !i.a.blocked)],
      ["Vencen en los próximos 3 días", "al0", items.filter(i => within(i, 3) && !i.a.blocked)]
    ];
    const row = ({ r, a }) => {
      const late = a.end < today ? ` · <b class="red">${lvlTxt(daysLate(a.end))} de atraso</b>` : "";
      const blk = a.blocked ? ` · <b class="orange">Bloqueada ${a.blockedSince ? lvlTxt(d2n(today) - d2n(a.blockedSince)) : ""}</b> ${a.blockReason ? "— " + esc(a.blockReason) : ""}` : "";
      return `<div class="hrow" data-r="${r.id}" data-a="${a.id}">
        <div class="hinfo"><b>${esc(r.code)}</b> · ${esc(r.title)} <small class="muted">${esc(clientName(r.clientId))}</small>
          <div class="hact">${esc(a.name)} · ${esc(mnames(a, r))} · vence ${a.end}${late}${blk}</div></div>
        ${readOnly ? `<div class="hctl"><span class="pbar"><i style="width:${a.percent}%"></i><span>${a.percent}%</span></span></div>` : `<div class="hctl">
          <select class="hp" aria-label="Avance">${pctOpts(a.percent)}</select>
          <input class="hc" placeholder="Comentario (obligatorio si bloqueas)" aria-label="Comentario">
          <label class="hb"><input type="checkbox" class="hbk"${a.blocked ? " checked" : ""}> Bloqueada</label>
          <button class="primary hs">Registrar</button></div>`}
      </div>`;
    };
    const stale = staleList().filter(r => !mine || ids(r).includes(me));
    const grp = (key, cls, n, title, body) => `<div class="card hgroup${hoyClosed.has(key) ? " closed" : ""}" data-g="${esc(key)}"><h3 class="${cls} htog" role="button" tabindex="0" aria-expanded="${!hoyClosed.has(key)}" title="Clic para expandir o minimizar"><span class="hcount">${n}</span> ${title}<span class="hchev">▾</span></h3><div class="hbody">${body}</div></div>`;
    let h = groups.map(([t, cls, list]) => grp(t, cls, list.length, t, list.length ? list.sort((x, y) => x.a.end.localeCompare(y.a.end)).map(row).join("") : '<p class="muted">Nada por aquí 👌</p>')).join("");
    h += grp("stale", "alS", stale.length, `Requerimientos sin actualizar (≥ ${STALE} días hábiles)`, stale.length ? stale.map(r => `<div class="hrow stale" data-open="${r.id}"><div class="hinfo"><b>${esc(r.code)}</b> · ${esc(r.title)} <small class="muted">${esc(clientName(r.clientId))}</small><div class="hact">${esc(mnames(r))} · último avance ${ldate(r.lastUpdate)} (hace ${staleDays(r)} días hábiles)</div></div><div class="hctl"><button class="ghost">Abrir</button></div></div>`).join("") : '<p class="muted">Todo al día 👌</p>');
    $("#hoyBody").innerHTML = h;
    $("#hoyBody").querySelectorAll(".htog").forEach(t => { const toggle = () => { const g = t.closest(".hgroup"), k = g.dataset.g, c = !g.classList.contains("closed"); g.classList.toggle("closed", c); t.setAttribute("aria-expanded", !c); c ? hoyClosed.add(k) : hoyClosed.delete(k); lsSet("qa-hoy-closed", JSON.stringify([...hoyClosed])); }; t.onclick = toggle; t.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }; });
    $("#hoyBody").querySelectorAll("[data-open]").forEach(x => (x.onclick = () => openReq(x.dataset.open)));
    $("#hoyBody").querySelectorAll(".hrow[data-a] .hs").forEach(btn => (btn.onclick = () => {
      const rowEl = btn.closest(".hrow"), rid = rowEl.dataset.r, aid = rowEl.dataset.a;
      const pct = +rowEl.querySelector(".hp").value, blocked = rowEl.querySelector(".hbk").checked, text = rowEl.querySelector(".hc").value.trim();
      if (blocked && !text && !store.reqs.find(x => x.id === rid)?.acts.find(x => x.id === aid)?.blockReason) return say("Indica el motivo del bloqueo en el comentario.", 1);
      const by = authorName(), at = new Date().toISOString(), cid = uid();
      commit(s => {
        const r = s.reqs.find(x => x.id === rid), x = r?.acts.find(y => y.id === aid); if (!x) return;
        const before = x.percent, wasB = x.blocked;
        x.percent = pct; x.blocked = blocked;
        if (blocked) { if (!wasB || !x.blockedSince) x.blockedSince = today; if (text) x.blockReason = text; } else { x.blockReason = ""; x.blockedSince = ""; }
        const msg = text || (before !== pct ? `Avance ${before}% → ${pct}%` : (blocked !== wasB ? (blocked ? "Bloqueada" : "Desbloqueada") : ""));
        if (msg && !r.comments.some(k => k.id === cid)) r.comments.push({ id: cid, at, by, text: `[${x.name} · ${pct}%${blocked ? " · BLOQUEADA" : ""}] ${msg}` });
        statusSync(r, at);
      });
      say("Registrado ✓"); render();
    }));
  }

  // ---------- Gantt ----------
  function renderGantt() {
    document.querySelectorAll("#zoom button").forEach(b => b.classList.toggle("on", +b.dataset.z === pxDay));
    const list = visible(), g = $("#gantt");
    g.className = "gantt" + (readOnly ? " read" : "");
    if (!list.length) { g.innerHTML = `<p class="muted" style="padding:20px">Sin requerimientos para mostrar.</p>`; return; }
    const all = list.flatMap(r => span(r)).map(d2n);
    const min = Math.min(...all, d2n(today)) - 5, max = Math.max(...all, d2n(today)) + 15, W = (max - min + 1) * pxDay, x = n => (n - min) * pxDay;
    let ticks = "";
    for (let n = min; n <= max; n++) {
      const d = new Date(n * DAY), dd = d.getUTCDate();
      if (dd === 1 || n === min) ticks += `<div class="g-tick m" style="left:${x(n)}px">${d.toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" })}</div>`;
      if (pxDay >= 28 || (pxDay >= 10 && d.getUTCDay() === 1)) ticks += `<div class="g-tick d" style="left:${x(n)}px">${dd}</div>`;
    }
    const bar = (kind, id, obj, st, label, pct, drag) => {
      const s = d2n(obj.start), e = Math.max(d2n(obj.end), s);
      return `<div class="bar ${st}${drag ? "" : " nodrag"}" data-k="${kind}" data-id="${id}" style="left:${x(s)}px;width:${(e - s + 1) * pxDay}px" title="${esc(label)} · ${pct}%"><div class="fill" style="width:${pct}%"></div><i class="h l"></i><span>${pxDay >= 14 ? esc(label) : ""}</span><i class="h r"></i></div>`;
    };
    let h = `<div class="g-inner" style="width:calc(var(--lw) + ${W}px)"><div class="g-head"><div class="g-row" style="height:46px;border:0"><div class="g-label" style="cursor:default">Requerimiento / actividad</div><div class="g-track" style="width:${W}px">${ticks}</div></div></div>`;
    for (const r of list) {
      const [s, e] = span(r), p = progress(r), st = "st-" + (late(r) && r.status !== "Bloqueado" ? "Atrasado" : r.status.replace(" ", ""));
      const exp = !r.acts.length;
      h += `<div class="g-row grp"><div class="g-label" data-open="${r.id}">${esc(r.code)} · ${esc(r.title)}<small>${r.type !== "trad" ? esc(typeName(r.type)) + " · " : ""}${esc(mnames(r))} · ${p}%</small></div>
        <div class="g-track" style="width:${W}px">${r.committedEnd && r.committedEnd !== e ? `<i class="cmark" style="left:${x(d2n(r.committedEnd) + 1)}px" title="Fecha comprometida ${r.committedEnd}"></i>` : ""}${exp ? bar("req", r.id, r, st, r.code, p, true) : bar("sum", r.id, { start: s, end: e }, "st-sum", "", p, false)}</div></div>`;
      if (!exp) for (const a of r.acts) {
        const ast = a.blocked ? "st-Bloqueado" : a.percent >= 100 ? "st-Completado" : a.end < today ? "st-Atrasado" : a.percent > 0 ? "st-Encurso" : "st-Pendiente";
        h += `<div class="g-row"><div class="g-label" data-open="${r.id}">&nbsp;&nbsp;${esc(a.name)}<small>${esc(mnames(a, r))}</small></div><div class="g-track" style="width:${W}px">${bar("act", r.id + "|" + a.id, a, ast, a.percent + "%", a.percent, true)}</div></div>`;
      }
    }
    h += `<div style="position:absolute;left:var(--lw);top:46px;bottom:0;width:${W}px;pointer-events:none"><div class="today" style="left:${x(d2n(today)) + pxDay / 2}px"></div></div></div>`;
    g.innerHTML = h;
    g.querySelectorAll("[data-open]").forEach(l => (l.onclick = () => openReq(l.dataset.open)));
    g.querySelectorAll(".bar").forEach(bindDrag);
  }
  function target(bar) {
    const [id, aid] = bar.dataset.id.split("|"), r = store.reqs.find(x => x.id === id);
    return bar.dataset.k === "act" ? r.acts.find(a => a.id === aid) : bar.dataset.k === "req" ? r : null;
  }
  function bindDrag(bar) {
    bar.addEventListener("click", () => { if (!bar._moved) openReq(bar.dataset.id.split("|")[0]); });
    const t = target(bar);
    if (readOnly || !t) return;
    bar.addEventListener("pointerdown", ev => {
      const mode = ev.target.classList.contains("l") ? "l" : ev.target.classList.contains("r") ? "r" : "m";
      const x0 = ev.clientX, s0 = d2n(t.start), e0 = d2n(t.end), l0 = bar.offsetLeft, w0 = bar.offsetWidth;
      bar._moved = false; bar.setPointerCapture?.(ev.pointerId);
      const mv = e => {
        const dd = Math.round((e.clientX - x0) / pxDay); if (dd) bar._moved = true;
        let ns = mode === "r" ? s0 : s0 + dd, ne = mode === "l" ? e0 : e0 + dd;
        if (mode === "l") ns = Math.min(ns, e0); if (mode === "r") ne = Math.max(ne, s0);
        bar.style.left = l0 + (ns - s0) * pxDay + "px"; bar.style.width = w0 + ((ne - ns) - (e0 - s0)) * pxDay + "px"; bar._ns = ns; bar._ne = ne;
      };
      const up = async () => {
        bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up);
        if (!bar._moved) return;
        const [rid, aid] = bar.dataset.id.split("|"), ns = n2d(bar._ns), ne = n2d(bar._ne), r = store.reqs.find(x => x.id === rid);
        const prev = { start: t.start, end: t.end }, oldEnd = span(r)[1];
        t.start = ns; t.end = ne; const newEnd = span(r)[1]; t.start = prev.start; t.end = prev.end;      // simulación
        let why = "";
        if (newEnd !== oldEnd) { why = await askReason(`${r.code}: el plazo del requerimiento cambia de ${oldEnd} a ${newEnd}.`); if (why === null) { render(); setTimeout(() => (bar._moved = false), 0); return; } }
        const by = authorName(), at = new Date().toISOString();
        commit(s => { const rr = s.reqs.find(x => x.id === rid); if (!rr) return; const tt = bar.dataset.k === "act" ? rr.acts.find(x => x.id === aid) : rr; if (!tt) return;
          const before = span(rr)[1]; tt.start = ns; tt.end = ne; const [s0, e0] = span(rr); rr.start = s0; rr.end = e0; rr.lastUpdate = at;
          if (why && e0 !== before) rr.dateLog.push({ at, by, from: before, to: e0, reason: why }); });
        say("Guardado ✓"); render(); setTimeout(() => (bar._moved = false), 0);
      };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    });
  }

  // ---------- Equipo ----------
  function renderTeam() {
    $("#memberTbl").innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Requerimientos activos</th><th></th></tr></thead><tbody>` +
      store.members.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${pick(`data-mrole="${m.id}"`, m.roles, readOnly)}</td><td>${store.reqs.filter(r => ids(r).includes(m.id) && r.status !== "Completado").length}</td>
        <td>${readOnly ? "" : `<button data-rm="${m.id}" class="danger">Quitar</button>`}</td></tr>`).join("") + `</tbody>`;
    $("#memberTbl").querySelectorAll("[data-mrole]").forEach(cb => (cb.onchange = () => { const id = cb.dataset.mrole; store.members.find(m => m.id === id).roles = [...$("#memberTbl").querySelectorAll(`[data-mrole="${id}"]:checked`)].map(x => x.value); save(); render(); const d = document.querySelector(`[data-mrole="${id}"]`)?.closest("details"); if (d) d.open = true; }));
    { const keep = [...document.querySelectorAll("#memberRole input:checked")].map(x => x.value); $("#memberRole").innerHTML = pick('data-newrole', keep, readOnly).replace("Sin rol", "Roles…"); }
    $("#roleTbl").innerHTML = `<thead><tr><th>Rol</th><th>Integrantes</th><th></th></tr></thead><tbody>` + store.roles.map((r, i) =>
      `<tr><td>${esc(r)}</td><td>${store.members.filter(m => m.roles.includes(r)).map(m => esc(m.name)).join(", ") || '<span class="muted">—</span>'}</td><td>${readOnly ? "" : `<button data-rrm="${i}" class="danger">Eliminar</button>`}</td></tr>`).join("") + `</tbody>`;
    $("#roleTbl").querySelectorAll("[data-rrm]").forEach(b => (b.onclick = () => {
      const r = store.roles[+b.dataset.rrm];
      if (!confirm(`¿Eliminar el rol "${r}"? Sus integrantes quedarán sin rol.`)) return;
      store.roles.splice(+b.dataset.rrm, 1); store.members.forEach(m => { m.roles = m.roles.filter(x => x !== r); }); save(); render();
    }));
    $("#memberTbl").querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => {
      const m = store.members.find(x => x.id === b.dataset.rm);
      if (!confirm(`¿Quitar a ${m.name}? Sus requerimientos quedarán sin responsable.`)) return;
      store.members = store.members.filter(x => x !== m);
      const drop = x => { if (ids(x).includes(m.id) || x.assigneeId === m.id) setIds(x, ids(x).filter(i => i !== m.id)); };
      store.reqs.forEach(r => { drop(r); r.acts.forEach(drop); });
      save(); render();
    }));
  }

  // ---------- Plantilla ----------
  function autosize(root) {                 // las cajas de texto crecen según lo escrito
    root.querySelectorAll("textarea.grow").forEach(t => {
      const fit = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
      t.oninput = fit; fit();
    });
  }
  function tplTable(tbl, t) {
    tbl.innerHTML = `<thead><tr><th>#</th><th>Actividad</th><th>Duración (días)</th><th></th></tr></thead><tbody>` +
      t.map((x, i) => `<tr><td>${i + 1}</td><td><textarea class="grow" rows="1" data-i="${i}" data-f="name">${esc(x.name)}</textarea></td><td><input type="number" min="1" data-i="${i}" data-f="days" value="${x.days}"></td>
        <td><button data-up="${i}">↑</button> <button data-rm="${i}" class="danger">✕</button></td></tr>`).join("") + `</tbody>`;
    tbl.querySelectorAll("input,textarea").forEach(i => { i.onchange = () => { t[+i.dataset.i][i.dataset.f] = i.dataset.f === "days" ? Math.max(1, +i.value) : i.value; save(); }; i.disabled = readOnly; });
    tbl.querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => { t.splice(+b.dataset.rm, 1); save(); renderTpl(); }));
    tbl.querySelectorAll("[data-up]").forEach(b => (b.onclick = () => { const i = +b.dataset.up; if (i) { [t[i - 1], t[i]] = [t[i], t[i - 1]]; save(); renderTpl(); } }));
    tbl.querySelectorAll("button").forEach(b => (b.hidden = readOnly));
    autosize(tbl);
  }
  function renderTpl() {
    for (const k of ["trad", "express"]) tplTable($("#tplTbl-" + k), store.templates[k]);
    const box = $("#tplCustom");
    box.innerHTML = (store.customTpl || []).map((c, n) => `<div class="card" data-c="${n}">
      <h2><input class="tplName" data-cn="${n}" value="${esc(c.name)}" aria-label="Nombre de la plantilla"${readOnly ? " disabled" : ""}></h2>
      <p class="muted">Tipo personalizado: aparece en el campo "Tipo" de los requerimientos y copia estas actividades.</p>
      <table id="tplTblC-${n}"></table>
      <button class="tplCAdd" data-n="${n}" data-edit>+ Actividad</button>
      <button class="tplCDel danger" data-n="${n}" data-edit>Eliminar tipo</button></div>`).join("");
    (store.customTpl || []).forEach((c, n) => tplTable($("#tplTblC-" + n), c.acts));
    box.querySelectorAll(".tplName").forEach(i => (i.onchange = () => { const v = i.value.trim(); if (!v) { i.value = store.customTpl[+i.dataset.cn].name; return; } store.customTpl[+i.dataset.cn].name = v; save(); render(); }));
    box.querySelectorAll(".tplCAdd").forEach(b => (b.onclick = () => { store.customTpl[+b.dataset.n].acts.push({ name: "Nueva actividad", days: 1 }); save(); renderTpl(); }));
    box.querySelectorAll(".tplCDel").forEach(b => (b.onclick = () => { const c = store.customTpl[+b.dataset.n], n = store.reqs.filter(r => r.type === c.id).length; if (n) return say(`No se puede eliminar "${c.name}": lo usan ${n} requerimiento(s). Cámbiales el tipo primero.`, 1); if (!confirm(`¿Eliminar el tipo "${c.name}"?`)) return; store.customTpl.splice(+b.dataset.n, 1); save(); renderTpl(); }));
    box.querySelectorAll("[data-edit]").forEach(b => (b.hidden = readOnly));
  }
  function renderTypeSel() {
    $("#rform").type.innerHTML = typeOpts("", true);
  }
  function renderTypeFilter() {
    const ft = $("#fType"), keep = ft.value; ft.innerHTML = typeOpts("Todos los tipos", false); ft.value = [...ft.options].some(o => o.value === keep) ? keep : "";
  }

  // ---------- Requerimiento (ventana) ----------
  function fromTemplate(start) {
    let s = start || today;
    return tplFor(draft?.type || "trad").map(a => { const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: 0, blocked: false }; setIds(x, ids(draft)); s = addDays(x.end, 1); return x; });
  }
  function renderReqPick() {
    const box = $("#assigneePick"), open = box.querySelector("details")?.open;
    box.innerHTML = memberPick("data-ra", ids(draft), readOnly);
    if (open) box.querySelector("details").open = true;
    box.querySelectorAll("[data-ra]").forEach(cb => (cb.onchange = () => { setIds(draft, [...box.querySelectorAll("[data-ra]:checked")].map(x => x.value)); renderReqPick(); }));
  }
  function openReq(id) {
    isNew = !id;
    draft = id ? JSON.parse(JSON.stringify(store.reqs.find(r => r.id === id)))
      : { id: uid(), clientId: clientId !== "all" ? clientId : (store.clients[0]?.id || ""), code: "", title: "", type: "trad", assigneeId: store.members[0]?.id || "", assigneeIds: store.members[0] ? [store.members[0].id] : [], status: "Pendiente", percent: 0, start: today, end: today, acts: [], comments: [] };
    if (isNew) draft.acts = fromTemplate(today);
    if (!isNew && draft.type === "express" && !draft.acts.length) {           // requerimiento express antiguo: pasa a las 4 actividades
      draft.acts = fromTemplate(draft.start || today); const done = Math.round((draft.percent || 0) / 100 * draft.acts.length); draft.acts.forEach((x, i) => (x.percent = i < done ? 100 : 0));
    }
    const f = $("#rform");
    $("#rTitle").textContent = isNew ? "Nuevo requerimiento" : `${draft.code} · ${draft.title}`;
    f.clientId.innerHTML = store.clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    setIds(draft, ids(draft));
    renderTypeSel(); renderReqPick();
    for (const k of ["clientId", "code", "title", "type", "status", "percent", "start", "end"]) f[k].value = draft[k] ?? "";
    draft.deliverables ||= []; draft.metrics ||= {};
    if (isNew && !draft.deliverables.length) draft.deliverables = (draft.type === "express" ? ["Informe final"] : ["Plan de pruebas", "Evidencias (EVP)", "Informe final"]).map(n => ({ id: uid(), name: n, due: span(draft)[1], state: "pendiente", url: "" }));
    syncType(); renderActs(); renderDel(); renderMetrics(); renderThread(); renderCommit();
    $("#newComment").value = "";
    f.querySelectorAll("input,select,textarea").forEach(e => { if (e.id !== "newComment") e.disabled = readOnly; });
    $("#newComment").disabled = readOnly; $("#btnComment").hidden = readOnly; $("#rSave").hidden = readOnly; $("#rDelete").hidden = readOnly || isNew;
    f.querySelectorAll("[data-edit]").forEach(e => { if (e.id !== "rSave" && e.id !== "rDelete") e.hidden = readOnly; });
    $("#dlg").showModal(); autosize($("#actTbl"));
  }
  function renderCommit() {
    const b = $("#commitBox"); if (isNew || !draft.committedEnd) { b.hidden = true; return; }
    const cur = span(draft)[1], d = d2n(cur) - d2n(draft.committedEnd);
    b.hidden = false;
    b.innerHTML = `<b>Compromiso:</b> ${draft.committedEnd} · <b>Plazo actual:</b> ${cur} ${d > 0 ? `<span class="st al1">+${d} días</span>` : d < 0 ? `<span class="st st-Completado">${d} días</span>` : '<span class="st st-Completado">en plazo</span>'}` +
      (draft.dateLog.length ? `<details><summary>Historial de cambios de plazo (${draft.dateLog.length})</summary>` + draft.dateLog.map(l => `<div class="dl"><small>${new Date(l.at).toLocaleString("es")} · <b>${esc(l.by)}</b></small><br>${l.from} → ${l.to}: ${esc(l.reason)}</div>`).join("") + "</details>" : "");
  }
  function syncType() {
    $("#actsBox").hidden = false; $("#pctRow").hidden = true; $("#datesRow").hidden = true;
  }
  function readForm() {
    const f = $("#rform");
    for (const k of ["clientId", "code", "title", "type", "status", "start", "end"]) draft[k] = f[k].value;
    draft.percent = Math.min(100, Math.max(0, +f.percent.value || 0));
  }
  function renderActs() {
    $("#actTbl").innerHTML = `<thead><tr><th>Actividad <span class="star">*</span></th><th>Resp.</th><th>Inicio <small class="opt">(opcional)</small></th><th>Fin <small class="opt">(opcional)</small></th><th>% Avance</th><th>Bloq.</th><th></th></tr></thead><tbody>` +
      draft.acts.map((a, i) => `<tr><td><textarea class="grow" rows="1" required data-i="${i}" data-f="name">${esc(a.name)}</textarea></td><td>${memberPick(`data-ai="${i}"`, ids(a), readOnly)}</td>
        <td><input type="date" data-i="${i}" data-f="start" value="${a.start}"></td><td><input type="date" data-i="${i}" data-f="end" value="${a.end}"></td>
        <td><select data-i="${i}" data-f="percent" title="% de avance de la actividad">${pctOpts(a.percent)}</select></td>
        <td><input type="checkbox" data-i="${i}" data-f="blocked"${a.blocked ? " checked" : ""}></td><td>${readOnly ? "" : `<button type="button" data-rm="${i}" class="danger">✕</button>`}</td></tr>`).join("") + `</tbody>`;
    autosize($("#actTbl"));
    $("#actTbl").querySelectorAll("[data-f]").forEach(el => {
      el.disabled = readOnly;
      el.onchange = () => { const a = draft.acts[+el.dataset.i], f = el.dataset.f; a[f] = f === "blocked" ? el.checked : f === "percent" ? +el.value : el.value; if (f === "blocked") { a.blockedSince = el.checked ? (a.blockedSince || today) : ""; if (!el.checked) a.blockReason = ""; } };
    });
    $("#actTbl").querySelectorAll("[data-ai]").forEach(cb => (cb.onchange = () => {
      const det = cb.closest("details"), l = [...det.querySelectorAll("[data-ai]:checked")].map(x => x.value);
      setIds(draft.acts[+cb.dataset.ai], l); det.querySelector("summary").textContent = l.length ? l.map(mname).join(", ") : "Sin asignar";
    }));
    $("#actTbl").querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => { draft.acts.splice(+b.dataset.rm, 1); renderActs(); }));
  }
  const DEL_ST = { pendiente: "Pendiente", entregado: "Entregado", validado: "Validado" };
  function renderDel() {
    const t = $("#delTbl");
    t.innerHTML = `<thead><tr><th>Entregable</th><th>Vence</th><th>Estado</th><th>Enlace (SharePoint / DevOps)</th><th></th></tr></thead><tbody>` +
      draft.deliverables.map((d, i) => `<tr><td><textarea class="grow" rows="1" data-di="${i}" data-df="name">${esc(d.name)}</textarea></td><td><input type="date" data-di="${i}" data-df="due" value="${d.due || ""}"></td>
        <td><select data-di="${i}" data-df="state">${Object.entries(DEL_ST).map(([k, v]) => `<option value="${k}"${k === d.state ? " selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><input type="url" data-di="${i}" data-df="url" value="${esc(d.url || "")}" placeholder="https://..."></td>
        <td>${readOnly ? "" : `<button type="button" class="danger" data-drm="${i}">✕</button>`}</td></tr>`).join("") + "</tbody>";
    autosize(t);
    t.querySelectorAll("[data-df]").forEach(el => { el.disabled = readOnly; el.onchange = () => { const d = draft.deliverables[+el.dataset.di], f = el.dataset.df; d[f] = el.value; if (f === "state") d.deliveredAt = el.value === "pendiente" ? "" : (d.deliveredAt || today); }; });
    t.querySelectorAll("[data-drm]").forEach(b => (b.onclick = () => { draft.deliverables.splice(+b.dataset.drm, 1); renderDel(); }));
  }
  function renderMetrics() {
    const m = draft.metrics;
    $("#metBox").querySelectorAll("[data-m]").forEach(el => {
      el.value = m[el.dataset.m] ?? ""; el.disabled = readOnly;
      el.oninput = () => { m[el.dataset.m] = el.type === "number" ? (el.value === "" ? "" : Math.max(0, +el.value)) : el.value.trim(); calcMet(); };
    });
    calcMet();
  }
  function calcMet() {
    const m = draft.metrics, ex = pct(+m.executed, +m.designed), pa = pct(+m.passed, +m.executed), au = pct(+m.automated, +m.designed);
    $("#metCalc").textContent = [ex !== null ? `Ejecución: ${ex}%` : "", pa !== null ? `Aprobación: ${pa}%` : "", au !== null ? `Automatizado: ${au}%` : "", openDef(draft) ? `Defectos abiertos: ${openDef(draft)}` : ""].filter(Boolean).join(" · ");
  }
  function renderThread() {
    $("#thread").innerHTML = draft.comments.length ? draft.comments.map(c => `<div class="cm"><small>${new Date(c.at).toLocaleString("es")} · <b>${esc(c.by)}</b></small><p>${esc(c.text)}</p></div>`).join("")
      : `<p class="muted">Aún no hay comentarios.</p>`;
    $("#thread").scrollTop = 1e6;
  }
  function addComment() {
    const text = $("#newComment").value.trim(); if (!text) return;
    let by = lsGet("qa-author", ""); if (!by) { by = prompt("¿Con qué nombre quieres firmar tus comentarios?", "") || "Anónimo"; lsSet("qa-author", by); }
    const cm = { id: uid(), at: new Date().toISOString(), by, text }; draft.comments.push(cm);
    if (!isNew) { const id = draft.id; commit(s => { const r = s.reqs.find(x => x.id === id); if (r && !r.comments.some(k => k.id === cm.id)) { r.comments.push(cm); r.lastUpdate = cm.at; } }); render(); }
    $("#newComment").value = ""; renderThread();
  }
  async function submitReq(e) {
    e.preventDefault();
    if (readOnly) return say("Estás en modo solo lectura: no tienes permiso para guardar cambios.", 1);
    try { await submitReqInner(); } catch (err) { console.error(err); say("No se pudo guardar: " + errText(err), 1); }
  }
  async function submitReqInner() {
    readForm();
    const form = $("#rform"), bad = [];
    form.querySelectorAll(".bad").forEach(el => el.classList.remove("bad"));
    const mark = (el, why) => { if (el) { el.classList.add("bad"); bad.push(why); } };
    for (const [k, n] of [["clientId", "Cliente"], ["code", "Código"], ["title", "Título"]]) if (!String(draft[k] || "").trim()) mark(form[k], `${n} es obligatorio`);
    const wiUrl = form.querySelector('[data-m="wiUrl"]'); if (wiUrl && !wiUrl.checkValidity()) mark(wiUrl, "El enlace al work item debe comenzar con https://");
    if (!draft.acts.length) { mark($("#btnActAdd"), "Agrega al menos una actividad"); mark($("#actTbl"), ""); }
    // fechas opcionales: si se dejan vacías se completan con la actividad anterior (inicio) o con el inicio (fin)
    draft.acts.forEach((a, i) => {
      if (!a.start) a.start = i ? addDays(draft.acts[i - 1].end || draft.acts[i - 1].start, 1) : (draft.start || today);
      if (!a.end) a.end = a.start;
      const row = $("#actTbl").querySelector(`tbody tr:nth-child(${i + 1})`);
      if (!String(a.name || "").trim()) mark(row?.querySelector('[data-f="name"]'), `Actividad ${i + 1}: el nombre es obligatorio`);
      if (a.end < a.start) { mark(row?.querySelector('[data-f="end"]'), `Actividad ${i + 1}: la fecha de fin es anterior al inicio`); mark(row?.querySelector('[data-f="start"]'), ""); }
    });
    if (bad.length) { form.querySelector(".bad")?.scrollIntoView({ block: "center" }); return say("Revisa los campos marcados en rojo: " + [...new Set(bad.filter(Boolean))].join("; ") + ".", 1); }
    [draft.start, draft.end] = span(draft);
    { const p = progress(draft); draft.percent = p; if (p >= 100) draft.status = "Completado"; else if (p > 0 && draft.status === "Pendiente") draft.status = "En curso"; }
    if (draft.status === "Completado" && !draft.completedAt) draft.completedAt = today;
    if (draft.status !== "Completado") draft.completedAt = "";
    const old = store.reqs.find(r => r.id === draft.id);
    draft.dateLog ||= []; draft.lastUpdate = new Date().toISOString();
    if (!old || !draft.committedEnd) draft.committedEnd = draft.end;
    if (old && old.end !== draft.end) {
      const why = await askReason(`${draft.code}: el plazo cambia de ${old.end} a ${draft.end}.`); if (why === null) return;
      draft.dateLog = [...draft.dateLog, { at: draft.lastUpdate, by: authorName(), from: old.end, to: draft.end, reason: why }];
    }
    const i = store.reqs.findIndex(r => r.id === draft.id);
    i < 0 ? store.reqs.push(draft) : (store.reqs[i] = draft);
    save(); $("#dlg").close(); say("Guardado ✓"); render();
  }

  // ---------- global ----------
  function renderClientSel() {
    if (clientId !== "all" && !store.clients.some(c => c.id === clientId)) clientId = "all";
    const sel = $("#clientSel");
    sel.innerHTML = `<option value="all">Todos los clientes (${store.reqs.length})</option>` + store.clients.map(c => `<option value="${c.id}">${esc(c.name)} (${store.reqs.filter(r => r.clientId === c.id).length})</option>`).join("");
    sel.value = clientId;
  }
  function renderClients() {
    $("#clientTbl").innerHTML = `<thead><tr><th>Cliente</th><th>Requerimientos</th><th></th></tr></thead><tbody>` + store.clients.map(c => `<tr><td><input data-cn="${c.id}" value="${esc(c.name)}"${readOnly ? " disabled" : ""}></td><td>${store.reqs.filter(r => r.clientId === c.id).length}</td><td>${readOnly ? "" : `<button data-cdel="${c.id}" class="danger">Eliminar</button>`}</td></tr>`).join("") + "</tbody>";
    $("#clientTbl").querySelectorAll("[data-cn]").forEach(i => (i.onchange = () => { const v = i.value.trim(); if (!v) { i.value = clientName(i.dataset.cn); return; } store.clients.find(c => c.id === i.dataset.cn).name = v; save(); renderClientSel(); }));
    $("#clientTbl").querySelectorAll("[data-cdel]").forEach(b => (b.onclick = () => {
      const c = store.clients.find(x => x.id === b.dataset.cdel);
      if (store.reqs.some(r => r.clientId === c.id)) return say(`No se puede eliminar "${c.name}": tiene requerimientos. Elimínalos o muévelos a otro cliente primero.`, 1);
      if (!confirm(`¿Eliminar el cliente "${c.name}"?`)) return;
      store.clients = store.clients.filter(x => x !== c); save(); render();
    }));
  }
  function render() {
    renderTypeFilter();
    if (!$("#v-dash").hidden) renderDash();
    if (!$("#v-hoy").hidden) renderHoy();
    if (!$("#v-resumen").hidden) renderResumen();
    if (!$("#v-gantt").hidden) renderGantt();
    if (!$("#v-team").hidden) renderTeam();
    renderClientSel();
    if (!$("#v-team").hidden) renderProfiles();
    if (!$("#v-perm").hidden) renderPerms();
    if (!$("#v-clients").hidden) renderClients();
    if (!$("#v-tpl").hidden) renderTpl();
  }
  // ---------- Importar Excel / CSV ----------
  const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const HEAD = { code: ["codigo", "cod", "id", "nro", "numero", "n", "ticket", "codigo requerimiento"], title: ["titulo", "nombre", "descripcion", "detalle", "requerimiento", "proyecto"], client: ["cliente", "empresa"],
    type: ["tipo", "tipo qa", "modalidad"], assignee: ["responsable", "analista", "asignado", "qa", "encargado"], start: ["inicio", "fecha inicio", "desde", "f inicio", "fecha de inicio"],
    end: ["fin", "termino", "fecha fin", "fecha termino", "fecha compromiso", "compromiso", "plazo", "vencimiento", "fecha de termino", "fecha de fin"], status: ["estado"], percent: ["avance", "% avance", "progreso"] };
  function toIsoDate(v) {
    if (v == null || v === "") return "";
    if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 60000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }   // SheetJS: los componentes locales son los de la celda
    if (typeof v === "number") return iso(new Date(Math.round((v - 25569) * 86400000)));            // serial de Excel
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return "";
  }
  const loadScript = src => new Promise((ok, no) => { if (window.XLSX) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No se pudo cargar el lector de Excel (¿sin internet?)")); document.head.append(s); });
  let imRows = [];
  function scaleActs(days, T) {
    const tot = days.reduce((x, y) => x + y, 0); let ds = days.map(d => Math.max(1, Math.round(d * T / tot)));
    const diff = T - ds.reduce((x, y) => x + y, 0); ds[ds.length - 1] = Math.max(1, ds[ds.length - 1] + diff); return ds;
  }
  function parseSheet(rows) {
    const keys = Object.keys(rows[0] || {}), map = {};
    for (const [f, syn] of Object.entries(HEAD)) { const k = keys.find(k => syn.includes(norm(k)) && !Object.values(map).includes(k)); if (k) map[f] = k; }
    if (!map.code && !map.title) throw new Error("No encontré columnas «Código» ni «Título» en la primera hoja.");
    const seen = new Set(store.reqs.map(r => (r.clientId + "|" + r.code).toLowerCase())), out = [];
    rows.forEach((row, i) => {
      const g = f => (map[f] ? row[map[f]] : ""), code = String(g("code") || "").trim(), title = String(g("title") || "").trim();
      if (!code && !title) return;
      const it = { line: i + 2, code: code || title.slice(0, 12), title: title || code, notes: [], err: "" };
      const cn = String(g("client") || "").trim();
      const cli = cn ? store.clients.find(c => norm(c.name) === norm(cn)) : (clientId !== "all" ? store.clients.find(c => c.id === clientId) : store.clients[0]);
      it.clientId = cli?.id || ""; it.clientNew = cli ? "" : (cn || "General"); it.clientName = cli?.name || it.clientNew;
      it.type = /expr/i.test(String(g("type"))) ? "express" : "trad";
      const an = String(g("assignee") || "").trim(), mem = an ? store.members.find(m => norm(m.name) === norm(an) || norm(m.name).includes(norm(an)) || norm(an).includes(norm(m.name))) : null;
      it.assigneeId = mem?.id || ""; it.assigneeName = mem?.name || an; if (an && !mem) it.notes.push("responsable no encontrado");
      it.start = toIsoDate(g("start")) || today; it.end = toIsoDate(g("end"));
      if (it.end && it.end < it.start) it.err = "Fin anterior al inicio";
      const st = norm(g("status")); it.status = /complet|termin|cerrad/.test(st) ? "Completado" : /bloq/.test(st) ? "Bloqueado" : /curso|proceso|ejecu/.test(st) ? "En curso" : "";
      const pc = parseFloat(String(g("percent")).replace(",", ".").replace("%", "")); it.percent = isNaN(pc) ? null : Math.max(0, Math.min(100, pc <= 1 && String(g("percent")).indexOf("%") < 0 && pc > 0 && pc < 1 ? pc * 100 : pc));
      const key = ((it.clientId || it.clientNew) + "|" + it.code).toLowerCase();
      if (!it.err && seen.has(key)) it.err = "Duplicado (ya existe)"; else seen.add(key);
      it.ok = !it.err; out.push(it);
    });
    if (!out.length) throw new Error("La planilla no tiene filas con datos.");
    return out;
  }
  function renderImport() {
    $("#imWrap").hidden = !imRows.length;
    $("#imTbl").innerHTML = "<thead><tr><th></th><th>Estado</th><th>Código</th><th>Título</th><th>Cliente</th><th>Tipo</th><th>Responsable</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>" +
      imRows.map((r, i) => `<tr><td><input type="checkbox" data-ii="${i}"${r.ok ? " checked" : ""}${r.err ? " disabled" : ""}></td><td>${r.err ? `<span class="st al3">${esc(r.err)}</span>` : `<span class="st st-Completado">OK</span>${r.notes.length ? ` <small class="muted">${esc(r.notes.join(", "))}</small>` : ""}`}</td>
        <td><b>${esc(r.code)}</b></td><td>${esc(r.title)}</td><td>${esc(r.clientName)}${r.clientNew ? ' <span class="badge">nuevo</span>' : ""}</td><td>${r.type === "express" ? "Express" : "Tradicional"}</td><td>${esc(r.assigneeName || "—")}</td><td>${r.start}</td><td>${r.end || '<span class="muted">según plantilla</span>'}</td></tr>`).join("") + "</tbody>";
    $("#imTbl").querySelectorAll("[data-ii]").forEach(c => (c.onchange = () => { imRows[+c.dataset.ii].ok = c.checked; sumImport(); }));
    sumImport();
  }
  function sumImport() { const n = imRows.filter(r => r.ok).length; $("#imSum").textContent = imRows.length ? `${n} de ${imRows.length} filas se importarán` : ""; $("#imOk").disabled = !n; $("#imOk").textContent = n ? `Importar ${n}` : "Importar"; }
  function buildImported() {
    const newClients = {}, by = authorName(), at = new Date().toISOString(), reqs = [];
    for (const r of imRows.filter(x => x.ok)) {
      let cid = r.clientId; if (!cid) { newClients[r.clientNew] ||= { id: uid(), name: r.clientNew }; cid = newClients[r.clientNew].id; }
      const tpl = tplFor(r.type), base = tpl.map(t => t.days), tot = base.reduce((x, y) => x + y, 0);
      const T = r.end ? Math.max(1, d2n(r.end) - d2n(r.start) + 1) : tot, ds = scaleActs(base, T);
      let s = r.start; const acts = tpl.map((t, i) => { const e = addDays(s, ds[i] - 1), x = { id: uid(), name: t.name, start: s, end: e, percent: 0, assigneeId: r.assigneeId, blocked: false, blockReason: "", blockedSince: "" }; s = addDays(e, 1); return x; });
      const p = r.status === "Completado" ? 100 : (r.percent ?? 0), done = Math.round(p / 100 * acts.length); acts.forEach((x, i) => (x.percent = i < done ? 100 : 0));
      const end = acts[acts.length - 1].end;
      const req = { id: uid(), clientId: cid, code: r.code, title: r.title, type: r.type, assigneeId: r.assigneeId, status: r.status || (done ? "En curso" : "Pendiente"), percent: 0, start: r.start, end, acts,
        committedEnd: r.end || end, dateLog: [], lastUpdate: at, deliverables: (r.type === "express" ? ["Informe final"] : ["Plan de pruebas", "Evidencias (EVP)", "Informe final"]).map(n => ({ id: uid(), name: n, due: end, state: "pendiente", url: "" })), metrics: {},
        comments: [{ id: uid(), at, by, text: "Requerimiento importado desde planilla." }] };
      req.percent = progress(req); if (req.percent >= 100) { req.status = "Completado"; req.completedAt = today; } reqs.push(req);
    }
    return { reqs, clients: Object.values(newClients) };
  }
  function openImport() { imRows = []; $("#imFile").value = ""; $("#imMsg").hidden = true; renderImport(); $("#imdlg").showModal(); }
  async function onImportFile(e) {
    const f = e.target.files[0]; if (!f) return; const m = $("#imMsg"); m.hidden = true; imRows = []; renderImport();
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      let wb;
      if (/\.csv$/i.test(f.name)) {                       // CSV: UTF-8 o Windows-1252, separado por coma o punto y coma
        const buf = await f.arrayBuffer(); let txt = new TextDecoder("utf-8").decode(buf); if (txt.includes("\uFFFD")) txt = new TextDecoder("windows-1252").decode(buf);
        txt = txt.replace(/^\uFEFF/, ""); const l1 = txt.split(/\r?\n/)[0] || "";
        wb = XLSX.read(txt, { type: "string", raw: true, FS: (l1.match(/;/g) || []).length > (l1.match(/,/g) || []).length ? ";" : "," });
      } else wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
      imRows = parseSheet(rows); renderImport();
    } catch (er) { m.textContent = er.message || "No se pudo leer el archivo."; m.hidden = false; }
  }

  // ---------- Exportar carta Gantt ----------
  function ganttHtml(forPrint) {
    const list = visible().sort((x, y) => clientName(x.clientId).localeCompare(clientName(y.clientId)) || x.code.localeCompare(y.code));
    if (!list.length) return null;
    const all = list.flatMap(r => span(r)).concat(today).map(d2n);
    let min = Math.min(...all) - 1, max = Math.max(...all) + 3;
    const weekly = max - min > 100;
    if (weekly) min -= (new Date(min * DAY).getUTCDay() + 6) % 7;            // lunes
    const step = weekly ? 7 : 1, cols = [];
    for (let n = min; n <= max; n += step) cols.push(n);
    const COL = { Completado: "#2e9e6a", "En curso": "#2f6fed", Bloqueado: "#e0861b", Atrasado: "#d6394a", Pendiente: "#9aa3b5" };
    const tint = c => c + "55";
    const actSt = a => a.blocked ? "Bloqueado" : a.percent >= 100 ? "Completado" : a.end < today ? "Atrasado" : a.percent > 0 ? "En curso" : "Pendiente";
    const reqSt = r => (late(r) && r.status !== "Bloqueado" && r.status !== "Completado") ? "Atrasado" : r.status;
    const months = [];
    cols.forEach(n => { const d = new Date(n * DAY), k = d.toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" }); const l = months[months.length - 1]; l && l.k === k ? l.n++ : months.push({ k, n: 1 }); });
    const cell = (n, s, e, pct, color) => {
      const to = n + step - 1, today0 = d2n(today), isToday = today0 >= n && today0 <= to;
      const wk = !weekly && [0, 6].includes(new Date(n * DAY).getUTCDay());
      const border = isToday ? "border-left:2px solid #d6394a;" : "";
      if (e < n || s > to) return `<td style="${border}${wk ? "background:#f0f0f0;" : ""}"></td>`;
      const len = e - s + 1, done = Math.round(pct / 100 * len), idx = Math.max(n, s) - s + (weekly ? Math.min(step - 1, 0) : 0);
      return `<td style="${border}background:${idx < done ? color : tint(color)};"></td>`;
    };
    const th = "background:#0b1220;color:#fff;font-weight:bold;text-align:center;border:1px solid #333;";
    let t = `<table border="1" cellspacing="0" cellpadding="3" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:${forPrint ? 8 : 11}pt">
      <tr><td colspan="${9 + cols.length}" style="font-size:16pt;font-weight:bold;border:0">Carta Gantt QA — ${esc(clientId === "all" ? "Todos los clientes" : clientName(clientId))}</td></tr>
      <tr><td colspan="${9 + cols.length}" style="border:0;color:#555">Generada el ${today} · Vista ${weekly ? "semanal" : "diaria"} · Avance: tono fuerte = completado, tono claro = pendiente · Línea roja = hoy</td></tr>
      <tr>${["Cliente", "Requerimiento", "Actividad", "Responsable", "Inicio", "Fin", "Avance", "Estado", "Tipo"].map(x => `<td rowspan="2" style="${th}">${x}</td>`).join("")}${months.map(m => `<td colspan="${m.n}" style="${th}">${esc(m.k)}</td>`).join("")}</tr>
      <tr>${cols.map(n => { const d = new Date(n * DAY); return `<td style="${th}font-size:${weekly ? 7 : 8}pt">${weekly ? d.getUTCDate() + "/" + (d.getUTCMonth() + 1) : d.getUTCDate()}</td>`; }).join("")}</tr>`;
    const row = (cl, req, act, who, s, e, pct, st, tipo, bold) => `<tr style="${bold ? "font-weight:bold;background:#eef2fb;" : ""}"><td>${esc(cl)}</td><td>${esc(req)}</td><td>${esc(act)}</td><td>${esc(who)}</td><td>${s}</td><td>${e}</td><td style="text-align:center">${pct}%</td><td style="color:${COL[st]};font-weight:bold">${st}</td><td>${tipo}</td>${cols.map(n => cell(n, d2n(s), d2n(e), pct, COL[st])).join("")}</tr>`;
    for (const r of list) {
      const [s, e] = span(r), p = progress(r), rs = reqSt(r), cn = clientName(r.clientId), nm = `${r.code} · ${r.title}`;
      t += row(cn, nm, r.acts.length ? "(resumen)" : "—", mnames(r), s, e, p, rs, typeName(r.type), true);
      r.acts.forEach(a => (t += row("", "", a.name, mnames(a, r), a.start, a.end, a.percent, actSt(a), "", false)));
    }
    return t + "</table>";
  }
  function exportGanttXls() {
    const t = ganttHtml(false); if (!t) return say("No hay requerimientos para exportar.", 1);
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Carta Gantt</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${t}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
    a.download = `carta-gantt-qa-${today}.xls`; a.click(); say("Gantt exportado ✓");
  }
  function exportGanttPdf() {
    const t = ganttHtml(true); if (!t) return say("No hay requerimientos para exportar.", 1);
    const w = window.open("", "_blank"); if (!w) return say("El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.", 1);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Carta Gantt QA ${today}</title><style>@page{size:A3 landscape;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}table td{padding:2px 4px;white-space:nowrap}</style></head><body>${t}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }

  function csv() {
    const rows = [["Cliente", "Código", "Título", "Tipo", "Responsable", "Estado", "Avance %", "Inicio", "Fin", "Comentarios"]].concat(visible().map(r => {
      const [s, e] = span(r); return [clientName(r.clientId), r.code, r.title, typeName(r.type), mnames(r), r.status, progress(r), s, e, r.comments.map(c => `${c.at.slice(0, 10)} ${c.by}: ${c.text}`).join(" | ")];
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n")], { type: "text/csv" }));
    a.download = `seguimiento-qa-${today}.csv`; a.click();
  }

  document.querySelectorAll("#tabs button").forEach(b => (b.onclick = () => setView(b.dataset.v)));
  $("#mode").onchange = e => { readOnly = e.target.value === "read"; lsSet("qa-mode", e.target.value); applyMode(); render(); };
  $("#btnNew").onclick = () => openReq(null);
  $("#btnExport").onclick = () => D.exportJson(store);
  $("#btnCsv").onclick = csv;
  $("#btnImportXls").onclick = openImport; $("#imFile").onchange = onImportFile;
  $("#imClose").onclick = $("#imCancel").onclick = () => $("#imdlg").close();
  $("#imOk").onclick = () => {
    const { reqs, clients } = buildImported(); if (!reqs.length) return;
    commit(s => { clients.forEach(c => { if (!s.clients.some(x => x.id === c.id)) s.clients.push(c); }); reqs.forEach(r => { if (!s.reqs.some(x => x.id === r.id)) s.reqs.push(r); }); });
    $("#imdlg").close(); say(`${reqs.length} requerimiento(s) importado(s) ✓`); render();
  };
  $("#imTpl").onclick = e => { e.preventDefault(); const c = "Código,Título,Cliente,Tipo,Responsable,Inicio,Fin,Estado,Avance\r\nR1903,Aranda - SOLFON,IPS,Tradicional,Ana Torres,2026-10-14,2026-11-03,En curso,40\r\nR2044,Ajuste reporte de saldos,Hites,Express,Luis Rojas,2026-10-21,2026-10-24,Pendiente,0\r\n";
    const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob(["\ufeff" + c], { type: "text/csv" })); l.download = "plantilla-importacion-requerimientos.csv"; l.click(); };
  $("#hoyMine").onchange = renderHoy;
  $("#btnGanttXls").onclick = exportGanttXls;
  $("#btnGanttPdf").onclick = exportGanttPdf;
  $("#btnImport").onclick = () => $("#fileImport").click();
  $("#fileImport").onchange = async e => {
    try { const s = JSON.parse(await e.target.files[0].text()); if (!s.reqs || !s.members) throw 0; if (!confirm("Esto reemplaza todos los datos actuales. ¿Continuar?")) return; store = s; save(); render(); say("Importado ✓"); }
    catch { say("Archivo inválido.", 1); } e.target.value = "";
  };
  ["fType", "fRole", "fAssignee", "fStatus"].forEach(i => ($("#" + i).onchange = render)); $("#fText").oninput = render;
  document.querySelectorAll("#zoom button").forEach(b => (b.onclick = () => { pxDay = +b.dataset.z; lsSet("qa-zoom", pxDay); renderGantt(); }));
  $("#memberForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const f = e.target; store.members.push({ id: uid(), name: f.name.value.trim(), email: f.email.value.trim(), roles: [...document.querySelectorAll("#memberRole input:checked")].map(x => x.value) }); f.reset(); save(); render(); };
  // el menú se posiciona sobre la ventana (fixed) para que ninguna columna lo recorte ni lo solape
  const placeMenu = d => { const m = d.querySelector(".rpmenu"), r = d.querySelector("summary").getBoundingClientRect(), h = Math.min(m.scrollHeight, 320), below = innerHeight - r.bottom - 12, up = below < h && r.top > below;
    Object.assign(m.style, { position: "fixed", left: r.left + "px", minWidth: r.width + "px", maxHeight: Math.max(120, Math.min(320, up ? r.top - 12 : below)) + "px", overflowY: "auto", top: up ? "" : r.bottom + 4 + "px", bottom: up ? innerHeight - r.top + 4 + "px" : "" }); };
  document.addEventListener("toggle", e => { if (e.target.matches?.(".rolepick[open]")) placeMenu(e.target); }, true);
  document.addEventListener("scroll", e => { if (!e.target.closest?.(".rpmenu")) document.querySelectorAll(".rolepick[open]").forEach(d => (d.open = false)); }, true);
  document.addEventListener("click", e => document.querySelectorAll(".rolepick[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }));
  $("#roleForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const v = e.target.role.value.trim(); if (store.roles.includes(v)) return say("Ese rol ya existe.", 1); store.roles.push(v); e.target.reset(); save(); render(); };
  $("#clientSel").onchange = e => { clientId = e.target.value; lsSet("qa-client", clientId); render(); };
  $("#clientForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const v = e.target.name.value.trim(); if (!v) return; if (store.clients.some(c => c.name.toLowerCase() === v.toLowerCase())) return say("Ese cliente ya existe.", 1); const c = { id: uid(), name: v }; store.clients.push(c); e.target.reset(); save(); clientId = c.id; lsSet("qa-client", clientId); render(); say("Cliente creado y seleccionado ✓"); };
  document.querySelectorAll(".tplAdd").forEach(b => (b.onclick = () => { store.templates[b.dataset.k].push({ name: "Nueva actividad", days: 1 }); save(); renderTpl(); }));
  document.querySelectorAll(".tplReset").forEach(b => (b.onclick = () => { if (confirm("¿Restaurar esta plantilla por defecto?")) { store.templates[b.dataset.k] = D.defaultTemplates()[b.dataset.k]; save(); renderTpl(); } }));
  $("#rform").type.onchange = () => {
    const prev = draft.type; readForm(); syncType();
    if (draft.type === prev) return;
    const label = "QA " + typeName(draft.type);
    const prevNames = JSON.stringify(tplFor(prev).map(t => t.name)), untouched = JSON.stringify(draft.acts.map(t => t.name)) === prevNames;
    if (!draft.acts.length || untouched || confirm(`Cambiar a ${label} reemplaza las actividades actuales por las de su plantilla. ¿Continuar?`)) { draft.acts = fromTemplate(draft.acts[0]?.start || today); renderActs(); }
    else { draft.type = prev; $("#rform").type.value = prev; syncType(); }
  };
  $("#hoyExpand").onclick = () => setHoyAll(false); $("#hoyCollapse").onclick = () => setHoyAll(true);
  $("#btnActAdd").onclick = () => { const last = draft.acts[draft.acts.length - 1]; const s = last ? addDays(last.end, 1) : today; draft.acts.push({ id: uid(), name: "Nueva actividad", start: s, end: s, percent: 0, assigneeId: draft.assigneeId, assigneeIds: [...ids(draft)], blocked: false }); renderActs(); };
  $("#btnDelAdd").onclick = () => { draft.deliverables.push({ id: uid(), name: "Nuevo entregable", due: span(draft)[1] || today, state: "pendiente", url: "" }); renderDel(); };
  $("#btnTplNew").onclick = () => {
    if (readOnly) return;
    const name = (prompt("Nombre del nuevo tipo de requerimiento (ej: QA Performance, Regresión):", "") || "").trim(); if (!name) return;
    if ((store.customTpl ||= []).some(c => c.name.toLowerCase() === name.toLowerCase())) return say("Ya existe un tipo con ese nombre.", 1);
    store.customTpl.push({ id: uid(), name, acts: [{ name: "Nueva actividad", days: 1 }] }); save(); renderTpl(); render(); say("Tipo creado ✓ (ya está disponible en el campo Tipo)");
  };
  $("#btnComment").onclick = addComment;
  $("#rform").onsubmit = submitReq;
  // campos inválidos (p. ej. Código/Título vacío, enlace mal escrito) bloquean el envío sin avisar si quedan fuera de vista
  ["input", "change"].forEach(t => $("#rform").addEventListener(t, ev => ev.target.classList?.remove("bad")));
  $("#rform").addEventListener("invalid", ev => { ev.target.classList.add("bad"); const l =ev.target.closest("label"); say(`Campo inválido: ${(l ? l.childNodes[0].textContent : ev.target.name || "").trim().replace(/\s*\*$/, "")} — ${ev.target.validationMessage}`, 1); }, true);
  $("#rCancel").onclick = $("#rClose").onclick = () => $("#dlg").close();
  $("#rDelete").onclick = () => { if (confirm("¿Eliminar este requerimiento y su seguimiento?")) { store.reqs = store.reqs.filter(r => r.id !== draft.id); save(); $("#dlg").close(); render(); } };

  $("#btnLogout").onclick = D.logout;
  const paintTheme = () => { const t = document.documentElement.dataset.theme; document.querySelectorAll("#themes button").forEach(b => { b.classList.toggle("on", b.dataset.t === t); b.setAttribute("aria-pressed", b.dataset.t === t); }); };
  document.querySelectorAll("#themes button").forEach(b => (b.onclick = () => { document.documentElement.dataset.theme = b.dataset.t; lsSet("qa-theme", b.dataset.t); paintTheme(); }));
  paintTheme();
  D.onError = m => say(m, 1);
  D.onRemoteChange = s => { store = s; if (!$("#dlg").open) render(); };
  $("#pform").onsubmit = submitProfile;
  $("#pClose").onclick = $("#pCancel").onclick = () => $("#pdlg").close();
  initUserMenu();
  applyMode(); render();
  if (D.remote && !D.getProfile().nombres) setTimeout(() => openProfile(true), 400);
})();
