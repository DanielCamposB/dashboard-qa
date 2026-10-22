(async function () {
  const D = window.QA_DATA, { addDays, uid, iso } = D;
  const $ = s => document.querySelector(s);
  const DAY = 86400000, today = iso(new Date());
  const d2n = s => Math.round(Date.parse(s + "T00:00:00Z") / DAY);
  const n2d = n => new Date(n * DAY).toISOString().slice(0, 10);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (m, err) => { const e = $("#msg"); e.textContent = m || ""; e.className = "msg" + (err ? " err" : ""); if (m && !err) setTimeout(() => say(""), 1800); };
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
    $("#urole").textContent = readOnly ? "Solo lectura" : "Editor"; $("#urole").className = "badge " + (readOnly ? "read" : "edit");
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
    $("#pErr").hidden = true;
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
  // Directorio de perfiles (solo editores con Supabase)
  let profCache = { at: 0, rows: [] };
  async function renderProfiles() {
    const card = $("#profCard"); card.hidden = !(D.remote && !readOnly); if (card.hidden) return;
    const draw = rows => {
      const bd = r => (r.cumpleanos ? new Date(r.cumpleanos + "T00:00:00Z").toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" }) : "—");
      $("#profTbl").innerHTML = "<thead><tr><th>Nombre</th><th>Cargo</th><th>Vertical</th><th>Cumpleaños</th><th>Teléfono</th><th>Correo</th><th>Acceso</th></tr></thead><tbody>" +
        rows.map(r => `<tr><td>${esc([r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(" ")) || '<span class="muted">Sin completar</span>'}</td><td>${esc(r.cargo || "—")}</td><td>${esc(r.vertical || "—")}</td><td>${bd(r)}</td><td>${esc(r.telefono || "—")}</td><td>${esc(r.email)}</td><td>${r.role === "editor" ? "Editor" : "Solo lectura"}</td></tr>`).join("") + "</tbody>";
    };
    draw(profCache.rows);
    if (Date.now() - profCache.at < 20000) return;
    profCache.at = Date.now();
    try { profCache.rows = await D.listProfiles(); draw(profCache.rows); }
    catch (er) { $("#profTbl").innerHTML = `<tbody><tr><td class="muted">${/does not exist|schema/i.test(er.message) ? "Falta ejecutar supabase-perfil.sql en Supabase." : "No se pudieron cargar los perfiles: " + esc(er.message)}</td></tr></tbody>`; }
  }

  function applyMode() {
    if (D.remote) { $("#mode").disabled = true; $("#mode").parentElement.hidden = true; }
    refreshUserMenu();
    $("#mode").value = readOnly ? "read" : "edit";
    document.body.classList.toggle("ro", readOnly);
    $("#btnNew").hidden = readOnly; $("#btnImport").hidden = readOnly;
    $("#actionbar").classList.toggle("ro", readOnly);
    document.querySelectorAll("[data-edit]").forEach(e => (e.hidden = readOnly));
  }

  // ---------- Dashboard ----------
  function visible() {
    const t = $("#fType").value, ro = $("#fRole").value, a = $("#fAssignee").value, s = $("#fStatus").value, q = $("#fText").value.toLowerCase();
    return scoped().filter(r => (!t || r.type === t) && (!a || r.assigneeId === a) && (!ro || memberRoles(r.assigneeId).includes(ro)) && (!s || r.status === s) &&
      (!q || (r.code + " " + r.title + " " + r.comments.map(c => c.text).join(" ")).toLowerCase().includes(q)));
  }
  function renderDash() {
    const all = scoped(), c = f => all.filter(f).length;
    const al = alertsList();
    $("#alerts").innerHTML = al.length ? `<details open><summary><b>${al.length} alerta${al.length > 1 ? "s" : ""} de atraso</b></summary>` +
      al.map(a => `<div class="al al${lvl(a.d)}" data-id="${a.r.id}"><b>${lvlTxt(a.d)} de atraso</b> · ${esc(a.r.code)} ${esc(a.r.title)} · <span>${esc(a.what)}</span> · ${esc(mname(a.r.assigneeId))}</div>`).join("") + "</details>" : "";
    $("#alerts").querySelectorAll(".al").forEach(x => (x.onclick = () => openReq(x.dataset.id)));
    $("#kpis").innerHTML = [["Requerimientos", all.length], ["QA Express", c(r => r.type === "express")], ["QA Tradicional", c(r => r.type === "trad")],
      ["En curso", c(r => r.status === "En curso")], ["Bloqueados", c(r => r.status === "Bloqueado")], ["Atrasados", c(late)], ["Completados", c(r => r.status === "Completado")]]
      .map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
    const keep = $("#fAssignee").value;
    $("#fAssignee").innerHTML = `<option value="">Todo el equipo</option>` + store.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
    $("#fAssignee").value = keep;
    const kr = $("#fRole").value;
    $("#fRole").innerHTML = `<option value="">Todos los roles</option>` + store.roles.map(r => `<option>${esc(r)}</option>`).join("");
    $("#fRole").value = kr;
    const rows = visible().sort((a, b) => span(a)[1].localeCompare(span(b)[1]));
    $("#tbl").innerHTML = `<thead><tr>${clientId === "all" ? "<th>Cliente</th>" : ""}<th>Código</th><th>Requerimiento</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Avance</th><th>Inicio</th><th>Fin</th><th>Último seguimiento</th></tr></thead><tbody>` +
      (rows.map(r => {
        const p = progress(r), [s, e] = span(r), lc = lastComment(r);
        return `<tr data-id="${r.id}">${clientId === "all" ? `<td>${esc(clientName(r.clientId))}</td>` : ""}<td><b>${esc(r.code)}</b></td><td>${esc(r.title)}</td>
          <td><span class="pill ${r.type}">${r.type === "trad" ? "Tradicional" : "Express"}</span></td><td>${esc(mname(r.assigneeId))}<br><small class="muted">${esc(memberRoles(r.assigneeId).join(", "))}</small></td>
          <td><span class="st st-${r.status.replace(" ", "")}">${r.status}</span>${late(r) ? ` <span class="st al${lvl(daysLate(span(r)[1]))}">Atrasado ${lvlTxt(daysLate(span(r)[1]))}</span>` : ""}</td>
          <td><div class="pbar"><i style="width:${p}%"></i><span>${p}%</span></div></td><td>${s}</td><td>${e}</td>
          <td class="lc">${lc ? `<small>${lc.at.slice(0, 10)} · ${esc(lc.by)}</small><br>${esc(lc.text.slice(0, 90))}` : '<small class="muted">Sin comentarios</small>'} <small class="muted">(${r.comments.length})</small></td></tr>`;
      }).join("") || `<tr><td colspan="9" class="muted" style="padding:20px">Sin requerimientos. Usa "+ Requerimiento".</td></tr>`) + `</tbody>`;
    const hs = [...$("#tbl").querySelectorAll("thead th")].map(t => t.textContent);   // etiquetas para la vista de tarjetas en móvil
    $("#tbl").querySelectorAll("tbody tr[data-id]").forEach(tr => { [...tr.children].forEach((td, i) => (td.dataset.l = hs[i] || "")); tr.onclick = () => openReq(tr.dataset.id); });
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
      h += `<div class="g-row grp"><div class="g-label" data-open="${r.id}">${esc(r.code)} · ${esc(r.title)}<small>${r.type === "express" ? "Express · " : ""}${esc(mname(r.assigneeId))} · ${p}%</small></div>
        <div class="g-track" style="width:${W}px">${exp ? bar("req", r.id, r, st, r.code, p, true) : bar("sum", r.id, { start: s, end: e }, "st-sum", "", p, false)}</div></div>`;
      if (!exp) for (const a of r.acts) {
        const ast = a.blocked ? "st-Bloqueado" : a.percent >= 100 ? "st-Completado" : a.end < today ? "st-Atrasado" : a.percent > 0 ? "st-Encurso" : "st-Pendiente";
        h += `<div class="g-row"><div class="g-label" data-open="${r.id}">&nbsp;&nbsp;${esc(a.name)}<small>${esc(mname(a.assigneeId))}</small></div><div class="g-track" style="width:${W}px">${bar("act", r.id + "|" + a.id, a, ast, a.percent + "%", a.percent, true)}</div></div>`;
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
      const up = () => {
        bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up);
        if (!bar._moved) return;
        t.start = n2d(bar._ns); t.end = n2d(bar._ne); save(); say("Guardado ✓"); render();
      };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    });
  }

  // ---------- Equipo ----------
  function renderTeam() {
    $("#memberTbl").innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Requerimientos activos</th><th></th></tr></thead><tbody>` +
      store.members.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${pick(`data-mrole="${m.id}"`, m.roles, readOnly)}</td><td>${store.reqs.filter(r => r.assigneeId === m.id && r.status !== "Completado").length}</td>
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
      store.reqs.forEach(r => { if (r.assigneeId === m.id) r.assigneeId = ""; r.acts.forEach(a => { if (a.assigneeId === m.id) a.assigneeId = ""; }); });
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
  function renderTpl() {
    for (const k of ["trad", "express"]) {
      const t = store.templates[k], tbl = $("#tplTbl-" + k);
      tbl.innerHTML = `<thead><tr><th>#</th><th>Actividad</th><th>Duración (días)</th><th></th></tr></thead><tbody>` +
        t.map((x, i) => `<tr><td>${i + 1}</td><td><textarea class="grow" rows="1" data-i="${i}" data-f="name">${esc(x.name)}</textarea></td><td><input type="number" min="1" data-i="${i}" data-f="days" value="${x.days}"></td>
          <td><button data-up="${i}">↑</button> <button data-rm="${i}" class="danger">✕</button></td></tr>`).join("") + `</tbody>`;
      tbl.querySelectorAll("input,textarea").forEach(i => { i.onchange = () => { t[+i.dataset.i][i.dataset.f] = i.dataset.f === "days" ? Math.max(1, +i.value) : i.value; save(); }; i.disabled = readOnly; });
      tbl.querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => { t.splice(+b.dataset.rm, 1); save(); renderTpl(); }));
      tbl.querySelectorAll("[data-up]").forEach(b => (b.onclick = () => { const i = +b.dataset.up; if (i) { [t[i - 1], t[i]] = [t[i], t[i - 1]]; save(); renderTpl(); } }));
      tbl.querySelectorAll("button").forEach(b => (b.hidden = readOnly));
      autosize(tbl);
    }
  }

  // ---------- Requerimiento (ventana) ----------
  function fromTemplate(start) {
    let s = start || today;
    return store.templates[(draft?.type || "trad") === "express" ? "express" : "trad"].map(a => { const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: 0, assigneeId: draft?.assigneeId || "", blocked: false }; s = addDays(x.end, 1); return x; });
  }
  function openReq(id) {
    isNew = !id;
    draft = id ? JSON.parse(JSON.stringify(store.reqs.find(r => r.id === id)))
      : { id: uid(), clientId: clientId !== "all" ? clientId : (store.clients[0]?.id || ""), code: "", title: "", type: "trad", assigneeId: store.members[0]?.id || "", status: "Pendiente", percent: 0, start: today, end: today, acts: [], comments: [] };
    if (isNew) draft.acts = fromTemplate(today);
    if (!isNew && draft.type === "express" && !draft.acts.length) {           // requerimiento express antiguo: pasa a las 4 actividades
      draft.acts = fromTemplate(draft.start || today); const done = Math.round((draft.percent || 0) / 100 * draft.acts.length); draft.acts.forEach((x, i) => (x.percent = i < done ? 100 : 0));
    }
    const f = $("#rform");
    $("#rTitle").textContent = isNew ? "Nuevo requerimiento" : `${draft.code} · ${draft.title}`;
    f.clientId.innerHTML = store.clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    f.assigneeId.innerHTML = `<option value="">— Sin asignar —</option>` + store.members.map(m => `<option value="${m.id}">${esc(m.name)}${m.roles.length ? " · " + esc(m.roles.join(", ")) : ""}</option>`).join("");
    for (const k of ["clientId", "code", "title", "type", "assigneeId", "status", "percent", "start", "end"]) f[k].value = draft[k] ?? "";
    syncType(); renderActs(); renderThread();
    $("#newComment").value = "";
    f.querySelectorAll("input,select,textarea").forEach(e => { if (e.id !== "newComment") e.disabled = readOnly; });
    $("#newComment").disabled = readOnly; $("#btnComment").hidden = readOnly; $("#rSave").hidden = readOnly; $("#rDelete").hidden = readOnly || isNew;
    f.querySelectorAll("[data-edit]").forEach(e => { if (e.id !== "rSave" && e.id !== "rDelete") e.hidden = readOnly; });
    $("#dlg").showModal(); autosize($("#actTbl"));
  }
  function syncType() {
    $("#actsBox").hidden = false; $("#pctRow").hidden = true; $("#datesRow").hidden = true;
  }
  function readForm() {
    const f = $("#rform");
    for (const k of ["clientId", "code", "title", "type", "assigneeId", "status", "start", "end"]) draft[k] = f[k].value;
    draft.percent = Math.min(100, Math.max(0, +f.percent.value || 0));
  }
  function renderActs() {
    const opts = sel => `<option value="">—</option>` + store.members.map(m => `<option value="${m.id}"${m.id === sel ? " selected" : ""}>${esc(m.name)}</option>`).join("");
    $("#actTbl").innerHTML = `<thead><tr><th>Actividad</th><th>Resp.</th><th>Inicio</th><th>Fin</th><th>%</th><th>Bloq.</th><th></th></tr></thead><tbody>` +
      draft.acts.map((a, i) => `<tr><td><textarea class="grow" rows="1" data-i="${i}" data-f="name">${esc(a.name)}</textarea></td><td><select data-i="${i}" data-f="assigneeId">${opts(a.assigneeId)}</select></td>
        <td><input type="date" data-i="${i}" data-f="start" value="${a.start}"></td><td><input type="date" data-i="${i}" data-f="end" value="${a.end}"></td>
        <td><select data-i="${i}" data-f="percent">${[0, 25, 50, 75, 100].map(p => `<option${p === a.percent ? " selected" : ""}>${p}</option>`).join("")}</select></td>
        <td><input type="checkbox" data-i="${i}" data-f="blocked"${a.blocked ? " checked" : ""}></td><td>${readOnly ? "" : `<button type="button" data-rm="${i}" class="danger">✕</button>`}</td></tr>`).join("") + `</tbody>`;
    autosize($("#actTbl"));
    $("#actTbl").querySelectorAll("[data-f]").forEach(el => {
      el.disabled = readOnly;
      el.onchange = () => { const a = draft.acts[+el.dataset.i], f = el.dataset.f; a[f] = f === "blocked" ? el.checked : f === "percent" ? +el.value : el.value; };
    });
    $("#actTbl").querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => { draft.acts.splice(+b.dataset.rm, 1); renderActs(); }));
  }
  function renderThread() {
    $("#thread").innerHTML = draft.comments.length ? draft.comments.map(c => `<div class="cm"><small>${new Date(c.at).toLocaleString("es")} · <b>${esc(c.by)}</b></small><p>${esc(c.text)}</p></div>`).join("")
      : `<p class="muted">Aún no hay comentarios.</p>`;
    $("#thread").scrollTop = 1e6;
  }
  function addComment() {
    const text = $("#newComment").value.trim(); if (!text) return;
    let by = lsGet("qa-author", ""); if (!by) { by = prompt("¿Con qué nombre quieres firmar tus comentarios?", "") || "Anónimo"; lsSet("qa-author", by); }
    draft.comments.push({ id: uid(), at: new Date().toISOString(), by, text });
    if (!isNew) { store.reqs.find(r => r.id === draft.id).comments = JSON.parse(JSON.stringify(draft.comments)); save(); render(); }
    $("#newComment").value = ""; renderThread();
  }
  function submitReq(e) {
    e.preventDefault(); if (readOnly) return;
    readForm();
    if (!draft.acts.length) return say("Agrega al menos una actividad.", 1);
    if (draft.acts.some(x => x.end < x.start)) return say("Hay una actividad con fecha de fin anterior al inicio.", 1);
    [draft.start, draft.end] = span(draft);
    { const p = progress(draft); draft.percent = p; if (p >= 100) draft.status = "Completado"; else if (p > 0 && draft.status === "Pendiente") draft.status = "En curso"; }
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
    if (!$("#v-dash").hidden) renderDash();
    if (!$("#v-gantt").hidden) renderGantt();
    if (!$("#v-team").hidden) renderTeam();
    renderClientSel();
    if (!$("#v-team").hidden) renderProfiles();
    if (!$("#v-clients").hidden) renderClients();
    if (!$("#v-tpl").hidden) renderTpl();
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
      t += row(cn, nm, r.acts.length ? "(resumen)" : "—", mname(r.assigneeId), s, e, p, rs, r.type === "trad" ? "Tradicional" : "Express", true);
      r.acts.forEach(a => (t += row("", "", a.name, mname(a.assigneeId), a.start, a.end, a.percent, actSt(a), "", false)));
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
      const [s, e] = span(r); return [clientName(r.clientId), r.code, r.title, r.type, mname(r.assigneeId), r.status, progress(r), s, e, r.comments.map(c => `${c.at.slice(0, 10)} ${c.by}: ${c.text}`).join(" | ")];
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
  document.addEventListener("click", e => document.querySelectorAll(".rolepick[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }));
  $("#roleForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const v = e.target.role.value.trim(); if (store.roles.includes(v)) return say("Ese rol ya existe.", 1); store.roles.push(v); e.target.reset(); save(); render(); };
  $("#clientSel").onchange = e => { clientId = e.target.value; lsSet("qa-client", clientId); render(); };
  $("#clientForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const v = e.target.name.value.trim(); if (!v) return; if (store.clients.some(c => c.name.toLowerCase() === v.toLowerCase())) return say("Ese cliente ya existe.", 1); const c = { id: uid(), name: v }; store.clients.push(c); e.target.reset(); save(); clientId = c.id; lsSet("qa-client", clientId); render(); say("Cliente creado y seleccionado ✓"); };
  document.querySelectorAll(".tplAdd").forEach(b => (b.onclick = () => { store.templates[b.dataset.k].push({ name: "Nueva actividad", days: 1 }); save(); renderTpl(); }));
  document.querySelectorAll(".tplReset").forEach(b => (b.onclick = () => { if (confirm("¿Restaurar esta plantilla por defecto?")) { store.templates[b.dataset.k] = D.defaultTemplates()[b.dataset.k]; save(); renderTpl(); } }));
  $("#rform").type.onchange = () => {
    const prev = draft.type; readForm(); syncType();
    if (draft.type === prev) return;
    const label = draft.type === "express" ? "QA Express" : "QA Tradicional";
    const prevNames = JSON.stringify((store.templates[prev === "express" ? "express" : "trad"]).map(t => t.name)), untouched = JSON.stringify(draft.acts.map(t => t.name)) === prevNames;
    if (!draft.acts.length || untouched || confirm(`Cambiar a ${label} reemplaza las actividades actuales por las de su plantilla. ¿Continuar?`)) { draft.acts = fromTemplate(draft.acts[0]?.start || today); renderActs(); }
    else { draft.type = prev; $("#rform").type.value = prev; syncType(); }
  };
  $("#rform").assigneeId.onchange = () => { draft.assigneeId = $("#rform").assigneeId.value; };
  $("#btnActAdd").onclick = () => { const last = draft.acts[draft.acts.length - 1]; const s = last ? addDays(last.end, 1) : today; draft.acts.push({ id: uid(), name: "Nueva actividad", start: s, end: s, percent: 0, assigneeId: draft.assigneeId, blocked: false }); renderActs(); };
  $("#btnActTpl").onclick = () => { if (!draft.acts.length || confirm("Esto reemplaza las actividades actuales por la plantilla. ¿Continuar?")) { readForm(); draft.acts = fromTemplate(draft.acts[0]?.start || today); renderActs(); } };
  $("#btnComment").onclick = addComment;
  $("#rform").onsubmit = submitReq;
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
