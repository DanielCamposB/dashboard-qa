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
  const memberRole = id => store.members.find(m => m.id === id)?.role || "";
  const mname = id => store.members.find(m => m.id === id)?.name || "—";

  // ---------- cálculos ----------
  const span = r => r.type === "trad" && r.acts.length ? [r.acts.map(a => a.start).sort()[0], r.acts.map(a => a.end).sort().pop()] : [r.start, r.end];
  function progress(r) {
    if (r.type !== "trad" || !r.acts.length) return +r.percent || 0;
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
    for (const r of store.reqs) {
      if (r.status === "Completado") continue;
      const e = span(r)[1];
      let worst = { d: daysLate(e), what: "Requerimiento" };
      if (r.type === "trad") for (const a of r.acts) if (a.percent < 100 && daysLate(a.end) > worst.d) worst = { d: daysLate(a.end), what: "Actividad: " + a.name };
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
  function applyMode() {
    if (D.remote) { $("#mode").disabled = true; $("#mode").parentElement.hidden = true; const em = boot.user, nm = em.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()), ini = nm.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
      $("#userMenu").hidden = false; $("#avatar").textContent = $("#avatar2").textContent = ini || "?"; $("#uname").textContent = $("#uname2").textContent = nm; $("#uemail").textContent = em;
      $("#urole").textContent = readOnly ? "Solo lectura" : "Editor"; $("#urole").className = "badge " + (readOnly ? "read" : "edit");
      const menu = $("#umenu"), btn = $("#avatarBtn"), toggle = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); };
      btn.onclick = e => { e.stopPropagation(); toggle(menu.hidden); };
      document.addEventListener("click", e => { if (!menu.contains(e.target)) toggle(false); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") toggle(false); }); if (!lsGet("qa-author", "")) lsSet("qa-author", boot.user.split("@")[0]); }
    $("#mode").value = readOnly ? "read" : "edit";
    document.body.classList.toggle("ro", readOnly);
    $("#btnNew").hidden = readOnly; $("#btnImport").hidden = readOnly;
    $("#actionbar").classList.toggle("ro", readOnly);
    document.querySelectorAll("[data-edit]").forEach(e => (e.hidden = readOnly));
  }

  // ---------- Dashboard ----------
  function visible() {
    const t = $("#fType").value, ro = $("#fRole").value, a = $("#fAssignee").value, s = $("#fStatus").value, q = $("#fText").value.toLowerCase();
    return store.reqs.filter(r => (!t || r.type === t) && (!a || r.assigneeId === a) && (!ro || memberRole(r.assigneeId) === ro) && (!s || r.status === s) &&
      (!q || (r.code + " " + r.title + " " + r.comments.map(c => c.text).join(" ")).toLowerCase().includes(q)));
  }
  function renderDash() {
    const all = store.reqs, c = f => all.filter(f).length;
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
    $("#tbl").innerHTML = `<thead><tr><th>Código</th><th>Requerimiento</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Avance</th><th>Inicio</th><th>Fin</th><th>Último seguimiento</th></tr></thead><tbody>` +
      (rows.map(r => {
        const p = progress(r), [s, e] = span(r), lc = lastComment(r);
        return `<tr data-id="${r.id}"><td><b>${esc(r.code)}</b></td><td>${esc(r.title)}</td>
          <td><span class="pill ${r.type}">${r.type === "trad" ? "Tradicional" : "Express"}</span></td><td>${esc(mname(r.assigneeId))}<br><small class="muted">${esc(memberRole(r.assigneeId))}</small></td>
          <td><span class="st st-${r.status.replace(" ", "")}">${r.status}</span>${late(r) ? ` <span class="st al${lvl(daysLate(span(r)[1]))}">Atrasado ${lvlTxt(daysLate(span(r)[1]))}</span>` : ""}</td>
          <td><div class="pbar"><i style="width:${p}%"></i><span>${p}%</span></div></td><td>${s}</td><td>${e}</td>
          <td class="lc">${lc ? `<small>${lc.at.slice(0, 10)} · ${esc(lc.by)}</small><br>${esc(lc.text.slice(0, 90))}` : '<small class="muted">Sin comentarios</small>'} <small class="muted">(${r.comments.length})</small></td></tr>`;
      }).join("") || `<tr><td colspan="9" class="muted" style="padding:20px">Sin requerimientos. Usa "+ Requerimiento".</td></tr>`) + `</tbody>`;
    $("#tbl").querySelectorAll("tbody tr[data-id]").forEach(tr => (tr.onclick = () => openReq(tr.dataset.id)));
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
    let h = `<div class="g-inner" style="width:${300 + W}px"><div class="g-head"><div class="g-row" style="height:46px;border:0"><div class="g-label" style="cursor:default">Requerimiento / actividad</div><div class="g-track" style="width:${W}px">${ticks}</div></div></div>`;
    for (const r of list) {
      const [s, e] = span(r), p = progress(r), st = "st-" + (late(r) && r.status !== "Bloqueado" ? "Atrasado" : r.status.replace(" ", ""));
      const exp = r.type === "express";
      h += `<div class="g-row grp"><div class="g-label" data-open="${r.id}">${esc(r.code)} · ${esc(r.title)}<small>${exp ? "Express · " : ""}${esc(mname(r.assigneeId))} · ${p}%</small></div>
        <div class="g-track" style="width:${W}px">${exp ? bar("req", r.id, r, st, r.code, p, true) : bar("sum", r.id, { start: s, end: e }, "st-sum", "", p, false)}</div></div>`;
      if (!exp) for (const a of r.acts) {
        const ast = a.blocked ? "st-Bloqueado" : a.percent >= 100 ? "st-Completado" : a.end < today ? "st-Atrasado" : a.percent > 0 ? "st-Encurso" : "st-Pendiente";
        h += `<div class="g-row"><div class="g-label" data-open="${r.id}">&nbsp;&nbsp;${esc(a.name)}<small>${esc(mname(a.assigneeId))}</small></div><div class="g-track" style="width:${W}px">${bar("act", r.id + "|" + a.id, a, ast, a.percent + "%", a.percent, true)}</div></div>`;
      }
    }
    h += `<div style="position:absolute;left:300px;top:46px;bottom:0;width:${W}px;pointer-events:none"><div class="today" style="left:${x(d2n(today)) + pxDay / 2}px"></div></div></div>`;
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
      store.members.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td><select data-role="${m.id}"${readOnly ? " disabled" : ""}><option value="">—</option>${store.roles.map(r => `<option${r === m.role ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></td><td>${store.reqs.filter(r => r.assigneeId === m.id && r.status !== "Completado").length}</td>
        <td>${readOnly ? "" : `<button data-rm="${m.id}" class="danger">Quitar</button>`}</td></tr>`).join("") + `</tbody>`;
    $("#memberTbl").querySelectorAll("[data-role]").forEach(sel => (sel.onchange = () => { store.members.find(m => m.id === sel.dataset.role).role = sel.value; save(); render(); }));
    $("#memberRole").innerHTML = `<option value="">Rol…</option>` + store.roles.map(r => `<option>${esc(r)}</option>`).join("");
    $("#roleTbl").innerHTML = `<thead><tr><th>Rol</th><th>Integrantes</th><th></th></tr></thead><tbody>` + store.roles.map((r, i) =>
      `<tr><td>${esc(r)}</td><td>${store.members.filter(m => m.role === r).map(m => esc(m.name)).join(", ") || '<span class="muted">—</span>'}</td><td>${readOnly ? "" : `<button data-rrm="${i}" class="danger">Eliminar</button>`}</td></tr>`).join("") + `</tbody>`;
    $("#roleTbl").querySelectorAll("[data-rrm]").forEach(b => (b.onclick = () => {
      const r = store.roles[+b.dataset.rrm];
      if (!confirm(`¿Eliminar el rol "${r}"? Sus integrantes quedarán sin rol.`)) return;
      store.roles.splice(+b.dataset.rrm, 1); store.members.forEach(m => { if (m.role === r) m.role = ""; }); save(); render();
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
  function renderTpl() {
    const t = store.templates.trad;
    $("#tplTbl").innerHTML = `<thead><tr><th>#</th><th>Actividad</th><th>Duración (días)</th><th></th></tr></thead><tbody>` +
      t.map((a, i) => `<tr><td>${i + 1}</td><td><input data-i="${i}" data-f="name" value="${esc(a.name)}"></td><td><input type="number" min="1" data-i="${i}" data-f="days" value="${a.days}" style="width:80px"></td>
        <td><button data-up="${i}">↑</button> <button data-rm="${i}" class="danger">✕</button></td></tr>`).join("") + `</tbody>`;
    $("#tplTbl").querySelectorAll("input").forEach(i => (i.onchange = () => { t[+i.dataset.i][i.dataset.f] = i.dataset.f === "days" ? Math.max(1, +i.value) : i.value; save(); }));
    $("#tplTbl").querySelectorAll("[data-rm]").forEach(b => (b.onclick = () => { t.splice(+b.dataset.rm, 1); save(); renderTpl(); }));
    $("#tplTbl").querySelectorAll("[data-up]").forEach(b => (b.onclick = () => { const i = +b.dataset.up; if (i) { [t[i - 1], t[i]] = [t[i], t[i - 1]]; save(); renderTpl(); } }));
    $("#tplTbl").querySelectorAll("input").forEach(i => (i.disabled = readOnly));
    document.querySelectorAll("#tplTbl button").forEach(b => (b.hidden = readOnly));
  }

  // ---------- Requerimiento (ventana) ----------
  function fromTemplate(start) {
    let s = start || today;
    return store.templates.trad.map(a => { const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: 0, assigneeId: draft?.assigneeId || "", blocked: false }; s = addDays(x.end, 1); return x; });
  }
  function openReq(id) {
    isNew = !id;
    draft = id ? JSON.parse(JSON.stringify(store.reqs.find(r => r.id === id)))
      : { id: uid(), code: "", title: "", type: "trad", assigneeId: store.members[0]?.id || "", status: "Pendiente", percent: 0, start: today, end: today, acts: [], comments: [] };
    if (isNew) draft.acts = fromTemplate(today);
    const f = $("#rform");
    $("#rTitle").textContent = isNew ? "Nuevo requerimiento" : `${draft.code} · ${draft.title}`;
    f.assigneeId.innerHTML = `<option value="">— Sin asignar —</option>` + store.members.map(m => `<option value="${m.id}">${esc(m.name)}${m.role ? " · " + esc(m.role) : ""}</option>`).join("");
    for (const k of ["code", "title", "type", "assigneeId", "status", "percent", "start", "end"]) f[k].value = draft[k] ?? "";
    syncType(); renderActs(); renderThread();
    $("#newComment").value = "";
    f.querySelectorAll("input,select,textarea").forEach(e => { if (e.id !== "newComment") e.disabled = readOnly; });
    $("#newComment").disabled = readOnly; $("#btnComment").hidden = readOnly; $("#rSave").hidden = readOnly; $("#rDelete").hidden = readOnly || isNew;
    f.querySelectorAll("[data-edit]").forEach(e => { if (e.id !== "rSave" && e.id !== "rDelete") e.hidden = readOnly; });
    $("#dlg").showModal();
  }
  function syncType() {
    const trad = $("#rform").type.value === "trad";
    $("#actsBox").hidden = !trad; $("#pctRow").hidden = trad; $("#datesRow").hidden = trad;
  }
  function readForm() {
    const f = $("#rform");
    for (const k of ["code", "title", "type", "assigneeId", "status", "start", "end"]) draft[k] = f[k].value;
    draft.percent = Math.min(100, Math.max(0, +f.percent.value || 0));
  }
  function renderActs() {
    const opts = sel => `<option value="">—</option>` + store.members.map(m => `<option value="${m.id}"${m.id === sel ? " selected" : ""}>${esc(m.name)}</option>`).join("");
    $("#actTbl").innerHTML = `<thead><tr><th>Actividad</th><th>Resp.</th><th>Inicio</th><th>Fin</th><th>%</th><th>Bloq.</th><th></th></tr></thead><tbody>` +
      draft.acts.map((a, i) => `<tr><td><input data-i="${i}" data-f="name" value="${esc(a.name)}"></td><td><select data-i="${i}" data-f="assigneeId">${opts(a.assigneeId)}</select></td>
        <td><input type="date" data-i="${i}" data-f="start" value="${a.start}"></td><td><input type="date" data-i="${i}" data-f="end" value="${a.end}"></td>
        <td><select data-i="${i}" data-f="percent">${[0, 25, 50, 75, 100].map(p => `<option${p === a.percent ? " selected" : ""}>${p}</option>`).join("")}</select></td>
        <td><input type="checkbox" data-i="${i}" data-f="blocked"${a.blocked ? " checked" : ""}></td><td>${readOnly ? "" : `<button type="button" data-rm="${i}" class="danger">✕</button>`}</td></tr>`).join("") + `</tbody>`;
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
    if (draft.type === "trad") {
      if (!draft.acts.length) return say("Un requerimiento tradicional necesita al menos una actividad.", 1);
      if (draft.acts.some(a => a.end < a.start)) return say("Hay una actividad con fecha de fin anterior al inicio.", 1);
    } else if (draft.end < draft.start) return say("La fecha de fin es anterior al inicio.", 1);
    if (draft.type === "trad") { const p = progress(draft); if (p >= 100) draft.status = "Completado"; else if (p > 0 && draft.status === "Pendiente") draft.status = "En curso"; }
    else { if (draft.percent >= 100) draft.status = "Completado"; else if (draft.percent > 0 && draft.status === "Pendiente") draft.status = "En curso"; }
    const i = store.reqs.findIndex(r => r.id === draft.id);
    i < 0 ? store.reqs.push(draft) : (store.reqs[i] = draft);
    save(); $("#dlg").close(); say("Guardado ✓"); render();
  }

  // ---------- global ----------
  function render() {
    if (!$("#v-dash").hidden) renderDash();
    if (!$("#v-gantt").hidden) renderGantt();
    if (!$("#v-team").hidden) renderTeam();
    if (!$("#v-tpl").hidden) renderTpl();
  }
  function csv() {
    const rows = [["Código", "Título", "Tipo", "Responsable", "Estado", "Avance %", "Inicio", "Fin", "Comentarios"]].concat(visible().map(r => {
      const [s, e] = span(r); return [r.code, r.title, r.type, mname(r.assigneeId), r.status, progress(r), s, e, r.comments.map(c => `${c.at.slice(0, 10)} ${c.by}: ${c.text}`).join(" | ")];
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
  $("#btnImport").onclick = () => $("#fileImport").click();
  $("#fileImport").onchange = async e => {
    try { const s = JSON.parse(await e.target.files[0].text()); if (!s.reqs || !s.members) throw 0; if (!confirm("Esto reemplaza todos los datos actuales. ¿Continuar?")) return; store = s; save(); render(); say("Importado ✓"); }
    catch { say("Archivo inválido.", 1); } e.target.value = "";
  };
  ["fType", "fRole", "fAssignee", "fStatus"].forEach(i => ($("#" + i).onchange = render)); $("#fText").oninput = render;
  document.querySelectorAll("#zoom button").forEach(b => (b.onclick = () => { pxDay = +b.dataset.z; lsSet("qa-zoom", pxDay); renderGantt(); }));
  $("#memberForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const f = e.target; store.members.push({ id: uid(), name: f.name.value.trim(), email: f.email.value.trim(), role: f.role.value }); f.reset(); save(); render(); };
  $("#roleForm").onsubmit = e => { e.preventDefault(); if (readOnly) return; const v = e.target.role.value.trim(); if (store.roles.includes(v)) return say("Ese rol ya existe.", 1); store.roles.push(v); e.target.reset(); save(); render(); };
  $("#btnTplAdd").onclick = () => { store.templates.trad.push({ name: "Nueva actividad", days: 1 }); save(); renderTpl(); };
  $("#btnTplReset").onclick = () => { if (confirm("¿Restaurar la plantilla por defecto?")) { store.templates = D.defaultTemplates(); save(); renderTpl(); } };
  $("#rform").type.onchange = () => { readForm(); syncType(); if (draft.type === "trad" && !draft.acts.length) { draft.acts = fromTemplate(draft.start || today); renderActs(); } };
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
  applyMode(); render();
})();
