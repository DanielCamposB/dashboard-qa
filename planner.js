// Integración con Microsoft Planner (SOLO LECTURA) y avisos a Teams, por cliente.
//  - Capa Graph: inicio de sesión Microsoft (MSAL) + lectura de planes, tareas, depósitos, etiquetas y comentarios.
//  - UI: tarjetas de la pestaña Clientes con los interruptores Planner / Teams.
// Nunca escribe en Planner: el dashboard solo se alimenta de él.
(function () {
  const cfg = window.QA_CONFIG || {};
  const G = "https://graph.microsoft.com/v1.0";
  const SCOPES = ["Tasks.Read", "Group.Read.All", "User.ReadBasic.All"];
  const MOCK = () => window.QA_PLANNER_MOCK;                     // solo para pruebas locales
  const configured = () => !!MOCK() || !!(cfg.msalClientId && cfg.msalTenantId && window.msal);

  // ---------- Graph ----------
  let app = null, account = null;
  async function msalApp() {
    if (app) return app;
    app = new window.msal.PublicClientApplication({
      auth: { clientId: cfg.msalClientId, authority: "https://login.microsoftonline.com/" + cfg.msalTenantId, redirectUri: location.origin + location.pathname },
      cache: { cacheLocation: "sessionStorage" }
    });
    await app.initialize?.();
    account = app.getAllAccounts()[0] || null;
    return app;
  }
  async function token(interactive) {
    const a = await msalApp();
    account = account || a.getAllAccounts()[0] || null;
    if (account) { try { return (await a.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; } catch (e) { if (!interactive) throw e; } }
    if (!interactive) throw new Error("NO_SESSION");
    const r = await a.loginPopup({ scopes: SCOPES, prompt: "select_account" });
    account = r.account;
    return r.accessToken || (await a.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  }
  const errEs = e => {
    const m = String(e?.message || e || ""), st = e?.status;
    if (/NO_SESSION/.test(m)) return "Conecta tu cuenta Microsoft primero.";
    if (/user_cancelled|popup_window_error|empty_window|BrowserAuthError.*popup/i.test(m)) return "No se completó el inicio de sesión de Microsoft (¿ventana emergente bloqueada o cancelada?).";
    if (/interaction_in_progress/.test(m)) return "Ya hay un inicio de sesión en curso. Termínalo e inténtalo de nuevo.";
    if (/AADSTS65001|consent_required|admin.?consent/i.test(m)) return "Falta el consentimiento de administrador para los permisos de Planner (Tasks.Read, Group.Read.All, User.ReadBasic.All). Pídeselo a TI.";
    if (/AADSTS50011|redirect_uri/i.test(m)) return "La dirección de esta página no está registrada como «redirect URI» (SPA) en la aplicación de Entra ID.";
    if (/AADSTS700016|AADSTS900023|unauthorized_client/i.test(m)) return "El clientId/tenantId de config.js no corresponde a una aplicación válida de Entra ID.";
    if (st === 401) return "La sesión de Microsoft expiró. Vuelve a conectar la cuenta.";
    if (st === 403) return "Sin permiso en Microsoft 365 para leer ese plan (¿eres miembro del grupo del plan?) o falta consentimiento de administrador.";
    if (st === 404) return "No se encontró el plan. Revisa el ID o que tu cuenta tenga acceso.";
    if (st === 429) return "Microsoft pide esperar unos segundos (demasiadas consultas). Reintenta en un minuto.";
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "No hay conexión con Microsoft Graph. Revisa tu internet.";
    return "Error: " + m;
  };
  async function gx(path, tk, init) {
    if (MOCK()) return MOCK()(init?.method || "GET", path, init?.body ? JSON.parse(init.body) : null);
    const res = await fetch(path.startsWith("http") ? path : G + path, { ...init, headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json", ...(init?.headers || {}) } });
    if (!res.ok) { const t = await res.text(); const er = new Error(`Graph ${res.status}: ${t.slice(0, 160)}`); er.status = res.status; throw er; }
    return res.status === 204 ? null : res.json();
  }
  async function page(path, tk) { let out = [], url = path; while (url) { const r = await gx(url, tk); out = out.concat(r.value || []); url = r["@odata.nextLink"]; } return out; }
  async function batch(urls, tk) {                               // hasta 20 peticiones GET por llamada
    const out = new Array(urls.length);
    for (let i = 0; i < urls.length; i += 20) {
      const chunk = urls.slice(i, i + 20), r = await gx("/$batch", tk, { method: "POST", body: JSON.stringify({ requests: chunk.map((u, k) => ({ id: String(k), method: "GET", url: u })) }) });
      (r.responses || []).forEach(x => (out[i + +x.id] = x));
    }
    return out;
  }
  const pDate = s => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return ""; if (d.getUTCHours() >= 12) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const prioTxt = p => (p <= 1 ? "Urgente" : p <= 4 ? "Importante" : p <= 7 ? "Media" : "Baja");
  const html2txt = h => { try { return (new DOMParser().parseFromString(h || "", "text/html").body.textContent || "").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); } catch { return String(h || ""); } };

  const P = {
    configured,
    errEs,
    async signIn() { if (MOCK()) return { account: "Cuenta de prueba" }; await token(true); return { account: account?.name || account?.username || (MOCK() ? "Cuenta de prueba" : "") }; },
    async session() { if (MOCK()) return "Cuenta de prueba"; if (!configured()) return ""; const a = await msalApp(); account = account || a.getAllAccounts()[0] || null; return account ? (account.name || account.username) : ""; },
    async signOut() { if (!app || !account) return; const a = account; account = null; try { await app.logoutPopup({ account: a, postLogoutRedirectUri: location.href }); } catch {} },
    async listPlans() { const tk = MOCK() ? "" : await token(false); return (await page("/me/planner/plans", tk)).map(p => ({ id: p.id, title: p.title })).sort((a, b) => a.title.localeCompare(b.title)); },
    async loadPlan(planId) {
      const tk = MOCK() ? "" : await token(false), warnings = [];
      const [plan, details, buckets, tasks] = await Promise.all([gx(`/planner/plans/${planId}`, tk), gx(`/planner/plans/${planId}/details`, tk), page(`/planner/plans/${planId}/buckets`, tk), page(`/planner/plans/${planId}/tasks`, tk)]);
      const groupId = plan.owner || plan.container?.containerId || "", cats = details.categoryDescriptions || {}, bname = Object.fromEntries(buckets.map(b => [b.id, b.name]));
      const users = {};
      const uids = [...new Set(tasks.flatMap(t => Object.keys(t.assignments || {})))];
      if (uids.length) {
        try { (await batch(uids.map(u => `/users/${u}?$select=displayName,mail,userPrincipalName`), tk)).forEach((x, i) => { if (x?.status === 200) users[uids[i]] = { id: uids[i], name: x.body.displayName || "", email: (x.body.mail || x.body.userPrincipalName || "").toLowerCase() }; }); }
        catch (e) { warnings.push("No pude leer los nombres de los responsables (permiso User.ReadBasic.All)."); }
      }
      const checks = {};
      if (tasks.length) {
        try { (await batch(tasks.map(t => `/planner/tasks/${t.id}/details`), tk)).forEach((x, i) => { if (x?.status === 200) checks[tasks[i].id] = Object.values(x.body.checklist || {}).map(c => (c.title || "").trim()).filter(Boolean); }); }
        catch (e) { warnings.push("No pude leer la lista de verificación de las tareas (de ahí sale el tipo QA Tradicional/Express)."); }
      }
      const comments = {};
      const withThread = tasks.filter(t => t.conversationThreadId && groupId);
      if (withThread.length) {
        try {
          (await batch(withThread.map(t => `/groups/${groupId}/threads/${t.conversationThreadId}/posts`), tk)).forEach((x, i) => {
            if (x?.status !== 200) return;
            comments[withThread[i].id] = (x.body.value || []).map(p => ({ id: "pl-" + p.id, at: p.createdDateTime, by: p.from?.emailAddress?.name || p.sender?.emailAddress?.name || "Planner", text: html2txt(p.body?.content), src: "planner" })).filter(c => c.text);
          });
        } catch (e) { warnings.push("No pude leer los comentarios (falta el permiso Group.Read.All o el consentimiento de administrador)."); }
        if (!Object.keys(comments).length && !warnings.length) warnings.push("Las tareas no devolvieron comentarios.");
      }
      return {
        planId, planName: plan.title || "", groupId, warnings,
        tasks: tasks.map(t => ({
          id: t.id, title: (t.title || "").trim(), percent: t.percentComplete || 0, priority: prioTxt(t.priority ?? 5), start: pDate(t.startDateTime), due: pDate(t.dueDateTime), created: pDate(t.createdDateTime),
          bucket: bname[t.bucketId] || "", labels: Object.keys(t.appliedCategories || {}).filter(k => t.appliedCategories[k] && cats[k]).map(k => cats[k]),
          checks: checks[t.id] || [], assignees: Object.keys(t.assignments || {}).map(u => users[u]).filter(Boolean), comments: (comments[t.id] || []).sort((a, b) => a.at.localeCompare(b.at))
        }))
      };
    }
  };
  window.QA_PLANNER = P;

  // =====================================================================================
  //  UI + mezcla con el dashboard
  // =====================================================================================
  window.QA_PLANNER_UI = function (A) {
    const { esc, say, uid } = A;
    const store = () => A.store();
    const D = window.QA_DATA, REMOTE = !!D?.remote, canSecret = () => !REMOTE || D.isAdmin();   // en línea, solo un administrador ve o cambia las URLs
    const fmtDT = s => (s ? new Date(s).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "nunca");
    let acct = "";

    // ---- Teams ----
    const HOST_OK = /(^|\.)(webhook\.office\.com|office\.com|logic\.azure\.com|powerplatform\.com|powerautomate\.com|microsoft\.com|office365\.com)$/i;
    function urlOk(u) { try { const x = new URL(u); return x.protocol === "https:" && HOST_OK.test(x.hostname); } catch { return false; } }
    async function post(t, title, facts, lines, to, who) {            // t = cliente o "user"; who = {name, email}: saludo con @mención real de Teams
      if (REMOTE) {                                                   // en línea lo publica el servidor: la URL nunca llega al navegador
        try { await D.qaPost({ target: t === "user" ? "user" : "client:" + t.id, title, facts: (facts || []).map(([a, b]) => ({ title: a, value: String(b) })), lines: (lines || []).join("\n\n"), to, name: who?.name }); return { ok: true, unconfirmed: true }; }
        catch (e) { const m = String(e?.message || e); return { ok: false, err: /Solo editores/i.test(m) ? "No tienes permiso para enviar avisos." : /URL no configurada/i.test(m) ? "Falta la URL del webhook: pide a un administrador que la guarde." : /could not find the function|qa_post/i.test(m) ? "Falta ejecutar supabase-seguridad.sql en Supabase." : "No se pudo enviar: " + m }; }
      }
      const url = String((t === "user" ? store().notify?.userWebhook : t.teams?.webhook) || "").trim();
      if (!urlOk(url)) return { ok: false, err: "La URL no parece un webhook de Teams / Power Automate (debe ser https y de Microsoft)." };
      const body = JSON.stringify({ type: "message", ...(to ? { to } : {}), attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4",
        ...(who ? { msteams: { entities: [{ type: "mention", text: `<at>${who.name}</at>`, mentioned: { id: who.email, name: who.name } }] } } : {}),
        body: [{ type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true }, ...(who ? [{ type: "TextBlock", text: `Hola <at>${who.name}</at>, estas son tus actividades pendientes:`, wrap: true }] : []), ...(facts?.length ? [{ type: "FactSet", facts: facts.map(([t, v]) => ({ title: t, value: String(v) })) }] : []), ...(lines?.length ? [{ type: "TextBlock", text: lines.join("\n\n"), wrap: true }] : [])],
        actions: [{ type: "Action.OpenUrl", title: "Abrir dashboard", url: location.href.split("#")[0] }] } }] });
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        return r.ok || r.status === 202 ? { ok: true } : { ok: false, err: `Teams respondió ${r.status}.` };
      } catch {                                                  // el navegador suele bloquear la respuesta (CORS): se envía igual, sin poder confirmar
        try { await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body }); return { ok: true, unconfirmed: true }; }
        catch (e) { return { ok: false, err: "No se pudo contactar el webhook (¿sin internet?)." }; }
      }
    }
    const sendTeams = (c, title, facts, lines) => post(c, title, facts, lines);
    const sendUser = (email, title, facts, lines, name) => post("user", title, facts, lines, email, name ? { name: String(name).replace(/[<>&]/g, ""), email } : null);
    function summaryFor(c) {
      const rs = store().reqs.filter(r => r.clientId === c.id && r.status !== "Completado");
      const worstLate = r => Math.max(A.daysLate(A.span(r)[1]), ...r.acts.filter(a => a.percent < 100).map(a => A.daysLate(a.end))), late = rs.filter(r => worstLate(r) >= 1).sort((x, y) => worstLate(y) - worstLate(x)), blocked = rs.filter(r => r.status === "Bloqueado" || r.acts.some(a => a.blocked)), stale = rs.filter(r => A.staleDays(r) >= 2), dov = rs.filter(r => A.delOverdue(r).length);
      const line = (r, extra) => `• **${r.code}** ${r.title} — ${extra}`;
      const lines = [];
      if (late.length) lines.push("**Atrasados**\n\n" + late.slice(0, 8).map(r => line(r, A.lvlTxt(worstLate(r)) + " de atraso")).join("\n\n"));
      if (blocked.length) lines.push("**Bloqueados**\n\n" + blocked.slice(0, 8).map(r => line(r, r.acts.filter(a => a.blocked).map(a => a.blockReason || a.name).join("; ") || "bloqueado")).join("\n\n"));
      if (stale.length) lines.push("**Sin actualizar**\n\n" + stale.slice(0, 8).map(r => line(r, `hace ${A.staleDays(r)} días hábiles`)).join("\n\n"));
      if (dov.length) lines.push("**Entregables vencidos**\n\n" + dov.slice(0, 8).map(r => line(r, A.delOverdue(r).map(d => d.name).join(", "))).join("\n\n"));
      const ev = c.teams?.events || {}, mem = store().members;
      const whoOf = r => [...new Set(idsOf(r).map(id => mem.find(m => m.id === id)?.name).filter(Boolean))].join(", ");
      if (ev.all) {
        const list = rs.slice().sort((x, y) => (A.span(x)[1] < A.span(y)[1] ? -1 : 1));
        lines.push(`**Todos los requerimientos en curso (${rs.length})**\n\n` + (list.length ? list.slice(0, 25).map(r => `• **${r.code}** ${r.title} — ${r.status} · ${A.progress(r)}% · fin ${A.span(r)[1]}${whoOf(r) ? " · " + whoOf(r) : ""}`).join("\n\n") + (list.length > 25 ? `\n\n… y ${list.length - 25} más en el dashboard` : "") : "Sin requerimientos en curso."));
      }
      if (ev.byOwner) {
        const by = {};
        for (const r of rs) for (const act of r.acts.filter(x => x.percent < 100)) {
          const who = idsOf(act).length ? idsOf(act) : idsOf(r), d = A.daysLate(act.end), sev = act.blocked ? 0 : d >= 1 ? 1 : d >= -3 ? 2 : 3;
          const tag = sev === 0 ? "🚧 bloqueada" : sev === 1 ? "🔴 atrasada " + A.lvlTxt(d) : sev === 2 ? "🟡 vence " + act.end : "🔵 termina " + act.end;
          for (const id of new Set(who)) { const m = mem.find(x => x.id === id); if (m) (by[m.name] ||= []).push({ sev, end: act.end, text: `  · ${r.code} ${act.name} — ${tag}` }); }
        }
        const people = Object.entries(by).map(([name, rows]) => { rows.sort((x, y) => x.sev - y.sev || (x.end < y.end ? -1 : 1)); return { name, rows, nl: rows.filter(x => x.sev === 1).length, nb: rows.filter(x => x.sev === 0).length }; }).sort((x, y) => y.nl - x.nl || y.nb - x.nb || y.rows.length - x.rows.length);
        lines.push("**Carga por responsable**\n\n" + (people.length ? people.map(p => `**${p.name}** — ${p.rows.length} actividad(es)${p.nl ? " · " + p.nl + " atrasada(s)" : ""}${p.nb ? " · " + p.nb + " bloqueada(s)" : ""}\n\n` + p.rows.slice(0, 6).map(x => x.text).join("\n\n") + (p.rows.length > 6 ? `\n\n  … y ${p.rows.length - 6} más` : "")).join("\n\n") : "Nadie con actividades abiertas."));
      }
      return { title: `Resumen QA · ${c.name} · ${A.today}`, facts: [["En curso", rs.length], ["Atrasados", late.length], ["Bloqueados", blocked.length], ["Sin actualizar", stale.length], ["Entregables vencidos", dov.length]], lines: lines.length ? lines : ["Todo en orden ✅"] };
    }
    const testTo = () => { try { const v = localStorage.getItem("qa-test-to"); if (v) return v; } catch {} const m = (store().members || []).find(x => x.email); return m ? m.email : (A.userEmail() || ""); };
    const teamsOn = c => !!(REMOTE ? c.teams?.hasUrl : c.teams?.webhook);
    const userUrlOn = () => REMOTE ? !!store().notify?.hasUserUrl : !!(store().notify?.userWebhook || "").trim();
    // Guarda/borra una URL: en línea va a la tabla de secretos (solo admin); local queda en el navegador
    async function saveUrl(key, v, localSet, flag) {
      if (REMOTE) { await D.setSecret(key, v); flag(!!v); } else localSet(v);
    }

    // ---- mensajes personales: pendientes de cada responsable ----
    const idsOf = x => (x?.assigneeIds?.length ? x.assigneeIds : x?.assigneeId ? [x.assigneeId] : []);
    function ownerDigests(c) {
      const mem = store().members, out = {};
      for (const r of store().reqs.filter(r => r.clientId === c.id && r.status !== "Completado")) {
        for (const act of r.acts.filter(x => x.percent < 100)) {
          const who = idsOf(act).length ? idsOf(act) : idsOf(r), d = A.daysLate(act.end);
          const [sev, tag] = act.blocked ? [0, "🚧 bloqueada" + (act.blockReason ? ": " + act.blockReason : "")] : d >= 1 ? [1, "🔴 atrasada " + A.lvlTxt(d)] : d >= -3 ? [2, "🟡 vence " + act.end] : [3, "🔵 pendiente, termina " + act.end];
          for (const id of new Set(who)) { const m = mem.find(x => x.id === id); if (!m || !m.email) continue; const k = m.email.toLowerCase(); (out[k] ||= { email: k, name: m.name, rows: [] }).rows.push({ sev, end: act.end, text: `• **${r.code}** ${r.title} · ${act.name} — ${tag}` }); }
        }
      }
      return Object.values(out).map(p => { p.rows.sort((x, y) => x.sev - y.sev || (x.end < y.end ? -1 : 1)); const cnt = s => p.rows.filter(x => x.sev === s).length; return { email: p.email, name: p.name, facts: [["Atrasadas", cnt(1)], ["Bloqueadas", cnt(0)], ["Por vencer (≤3 días)", cnt(2)], ["Pendientes", cnt(3)]], lines: [...p.rows.slice(0, 15).map(x => x.text), ...(p.rows.length > 15 ? [`… y ${p.rows.length - 15} más en el dashboard`] : [])] }; });
    }

    // ---- pestaña Avisos: horarios del envío automático + mensajes personales ----
    const th = (t, tip) => `<th>${t}${tip ? ` <span class="qhint" tabindex="0" role="note" data-tip="${esc(tip)}" aria-label="${esc(tip)}">!</span>` : ""}</th>`;
    const DAYS = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"]];
    // Celda/campo de URL: local = visible; en línea, admin = campo para reemplazar (la URL guardada no se muestra); no admin = solo estado
    function urlCell(c, p, ro) {
      const has = REMOTE ? !!c.teams?.hasUrl : !!c.teams?.webhook;
      if (!canSecret()) return `<span class="muted sm">${has ? "✓ Guardada por un administrador" : "Sin URL: la guarda un administrador"}</span>`;
      return `<input type="text" class="secret" name="qa-hook-${c.id}" spellcheck="false" data-${p}-url="${c.id}" value="${REMOTE ? "" : esc(c.teams?.webhook || "")}" placeholder="${REMOTE && has ? "✓ URL guardada: pega otra para reemplazarla" : "Pega aquí la URL del canal"}" autocomplete="off"${ro ? " disabled" : ""} aria-label="URL del canal de ${esc(c.name)}">${REMOTE && has && !ro ? ` <button type="button" class="ghost" data-${p}-urlrm="${c.id}">Quitar</button>` : ""}`;
    }
    function avisosHtml(ro) {
      const n = store().notify || {}, dis = ro ? " disabled" : "", cur = A.clientId(), curC = store().clients.find(c => c.id === cur);
      const selTxt = cur === "all" ? "todos los clientes" : esc(curC?.name || "cliente");
      return `<div class="card">
        <h2>Avisos automáticos a Teams</h2>
        <p class="muted">Hay dos tipos de aviso, independientes entre sí: el <b>resumen al grupo «QA - Avisos»</b> (un canal por cliente) y el <b>mensaje personal</b> a cada responsable (su chat privado). Los dos se envían solos en los horarios de abajo, hora de Chile, aunque nadie tenga el sitio abierto. Los botones «Enviar ahora» sirven para enviar cuando quieras, sin esperar al horario.</p>
        <label class="switch"><input type="checkbox" id="avMaster"${n.auto !== false ? " checked" : ""}${dis}><i></i><b>Envío automático activado</b></label>
        <p class="muted sm">Si lo apagas no sale ningún aviso programado, ni al canal ni personal. Los botones «Enviar ahora» siguen funcionando.</p>
        <h3>Horarios</h3>
        <div class="crow" id="avTimes">${(n.times || []).map(t => `<span class="tchip"><input type="time" value="${esc(t)}" data-av-time="${esc(t)}"${dis} aria-label="Horario de envío"><button type="button" class="ghost" data-av-del="${esc(t)}"${dis} title="Quitar horario" aria-label="Quitar horario ${esc(t)}">×</button></span>`).join("") || '<span class="muted">Sin horarios: no se enviará nada automático.</span>'}</div>
        <div class="crow"><input type="time" id="avNew" value="10:00"${dis} aria-label="Nuevo horario"><button type="button" id="avAdd"${dis}>+ Agregar horario</button><button type="button" id="avDef"${dis}>Restablecer 9, 12, 15 y 18 h</button></div>
        <h3>Días</h3>
        <div class="crow">${DAYS.map(([d, l]) => `<label class="chk"><input type="checkbox" data-av-day="${d}"${(n.days || []).includes(d) ? " checked" : ""}${dis}> ${l}</label>`).join("")}</div>
      </div>
      <div class="card">
        <h2>1 · Resumen al grupo «QA - Avisos»</h2>
        <p class="muted">Un mensaje por cliente, en el canal de Teams de ese cliente, con sus requerimientos atrasados, bloqueados, sin actualizar y entregables vencidos. Opcionalmente puede incluir la lista completa de requerimientos y la carga de cada responsable. Cada cliente tiene su propia URL de webhook (la que entrega Teams al crear el flujo del canal).</p>
        <div class="tablewrap"><table class="avtbl"><thead><tr>${th("Cliente")}${th("Canal", "Estado de la conexión: «Conectado» si ya hay una URL de webhook guardada para el canal de este cliente; «Sin URL» si falta.")}${th("URL del canal (webhook)", "La dirección que entrega Teams al crear el flujo «Cuando se recibe una solicitud de webhook» del canal de este cliente. La guarda un administrador y no se vuelve a mostrar.")}${th("Programado", "Si está marcada, este cliente recibe el resumen solo, en los horarios de arriba. Si no, nunca sale solo y solo se envía con el botón «Enviar ahora». Además debe estar encendido el interruptor «Envío automático activado» de arriba.")}${th("Incluir todos los requerimientos", "Agrega al resumen la lista completa de requerimientos en curso del cliente, con estado, avance, fecha de fin y responsables.")}${th("Incluir carga por responsable", "Agrega al resumen un bloque por persona con todas sus actividades abiertas: atrasadas, bloqueadas, por vencer y pendientes.")}${th("Omitir si no hay atrasos ni bloqueos", "Solo afecta al envío programado: si no hay nada atrasado, bloqueado, sin actualizar ni entregables vencidos, ese resumen no se envía. Si arriba incluyes la lista completa o la carga por responsable, el resumen sale siempre.")}${th("Aviso inmediato al bloquear", "Aviso corto al canal en el momento en que alguien marca una actividad como bloqueada en el dashboard. No depende de los horarios.")}${th("Aviso al sincronizar Planner", "Aviso al canal cada vez que alguien sincroniza Planner de este cliente.")}${th("Envío manual", "«Prueba» manda un mensaje corto para verificar que el canal funciona. «Enviar ahora» manda el resumen real ahora mismo, sin esperar al horario y sin importar la casilla «Programado».")}</tr></thead><tbody>${store().clients.map(c => {
          const ev = c.teams?.events || {}, hook = teamsOn(c), d = ro || !hook ? " disabled" : "";
          return `<tr><td><b>${esc(c.name)}</b></td><td>${hook ? '<span class="badge okb">Conectado</span>' : '<span class="badge warnb">Sin URL</span>'}</td>
            <td>${urlCell(c, "av", ro)}</td>
            <td><label class="chk"><input type="checkbox" data-avc="auto" data-cid="${c.id}"${ev.auto !== false ? " checked" : ""}${d} aria-label="Resumen automático al canal de ${esc(c.name)}"> Automático</label></td>
            <td><input type="checkbox" data-avc="all" data-cid="${c.id}"${ev.all === true ? " checked" : ""}${d} aria-label="Incluir todos los requerimientos de ${esc(c.name)} en el resumen"></td>
            <td><input type="checkbox" data-avc="byOwner" data-cid="${c.id}"${ev.byOwner === true ? " checked" : ""}${d} aria-label="Incluir la carga por responsable de ${esc(c.name)} en el resumen"></td>
            <td><input type="checkbox" data-avc="quiet" data-cid="${c.id}"${ev.quiet !== false ? " checked" : ""}${d || (ev.auto === false ? " disabled" : "")} aria-label="Omitir el resumen automático de ${esc(c.name)} si no hay atrasos ni bloqueos"></td>
            <td><input type="checkbox" data-avc="blocked" data-cid="${c.id}"${ev.blocked !== false ? " checked" : ""}${d} aria-label="Aviso inmediato al canal cuando se bloquea una actividad de ${esc(c.name)}"></td>
            <td><input type="checkbox" data-avc="sync" data-cid="${c.id}"${ev.sync !== false ? " checked" : ""}${d} aria-label="Avisar al canal al sincronizar Planner de ${esc(c.name)}"></td>
            <td><div class="crow"><button type="button" data-av-test="${c.id}"${ro || !hook ? " disabled" : ""}>Prueba</button><button type="button" data-av-now="${c.id}"${ro || !hook ? " disabled" : ""}>Enviar ahora</button></div></td></tr>`; }).join("")}</tbody></table></div>
        <div class="crow"><button type="button" class="primary" id="avSel"${dis}>Enviar resumen ahora: ${selTxt}</button><span class="muted sm">Usa el cliente elegido arriba, en el selector «Cliente». Si eliges uno solo, solo sale ese.</span></div>
      </div>
      <div class="card">
        <h2>2 · Mensaje personal a cada responsable</h2>
        <p class="muted"><b>Para qué sirve:</b> cada responsable recibe en su propio chat de Teams (aparece como «Flujos de trabajo») la lista de <b>sus</b> actividades atrasadas, bloqueadas o por vencer, con su nombre mencionado. Es distinto del canal: el webhook del canal no puede escribirle a una persona, por eso hace falta un segundo flujo de Power Automate que recibe el correo de la persona y le entrega el mensaje. Es <b>una sola URL para todos los clientes</b>, y los correos salen de <b>Equipo → Correo de Teams</b>.</p>
        <label>URL del flujo de mensajes personales${canSecret() ? `<input type="text" class="secret" name="qa-hook-user" spellcheck="false" id="avUser" value="${REMOTE ? "" : esc(n.userWebhook || "")}" placeholder="${REMOTE && n.hasUserUrl ? "✓ URL guardada: pega otra para reemplazarla" : "https://prod-…logic.azure.com/…"}"${dis} autocomplete="off">${REMOTE && n.hasUserUrl && !ro ? ` <button type="button" class="ghost" id="avUserRm">Quitar</button>` : ""}` : `<span class="muted sm">${n.hasUserUrl ? "✓ Guardada por un administrador" : "Sin URL: la guarda un administrador"}</span>`}</label>
        <div class="tablewrap"><table class="avtbl"><thead><tr>${th("Cliente")}${th("Responsables con aviso", "Personas de este cliente que recibirían un mensaje: tienen actividades abiertas y un correo de Teams cargado en la pestaña Equipo.")}${th("Programado", "Si está marcada, cada responsable de este cliente recibe su mensaje personal solo, en los horarios de arriba. Además debe estar encendido el interruptor «Envío automático activado».")}${th("Envío manual", "«Enviar ahora» manda ahora mismo el mensaje personal a cada responsable de este cliente, sin esperar al horario.")}</tr></thead><tbody>${store().clients.map(c => {
          const ev = c.teams?.events || {}, ds = ownerDigests(c), d = ro || !userUrlOn() ? " disabled" : "";
          return `<tr><td><b>${esc(c.name)}</b></td><td class="sm">${ds.length ? esc(ds.map(x => x.name).join(", ")) : '<span class="muted">Nadie con pendientes o sin correo en Equipo</span>'}</td>
            <td><label class="chk"><input type="checkbox" data-avc="owners" data-cid="${c.id}"${ev.owners === true ? " checked" : ""}${d} aria-label="Mensaje personal automático a los responsables de ${esc(c.name)}"> Automático</label></td>
            <td><button type="button" data-av-own="${c.id}"${d}>Enviar ahora</button></td></tr>`; }).join("")}</tbody></table></div>
        <div class="crow"><button type="button" class="primary" id="avSelOwn"${ro || !userUrlOn() ? " disabled" : ""}>Enviar mensajes personales ahora: ${selTxt}</button></div>
        <h3>Probar el flujo</h3>
        <div class="crow"><label>Correo de Teams para la prueba<input type="text" id="avTestTo" value="${esc(testTo())}" placeholder="nombre@tu-organizacion.cl" autocomplete="off" spellcheck="false"></label><button type="button" id="avTest"${dis}>Enviarme un mensaje de prueba</button></div><p class="muted sm">Debe ser el correo con que entras a Teams (el de tu organización), no un Gmail personal: Teams solo puede escribirle a cuentas de la organización.</p>
        <details><summary>Cómo crear el flujo (una vez)</summary>
          <ol class="sm">
            <li>Entra a <b>make.powerautomate.com</b> → <b>Crear</b> → <b>Flujo de nube instantáneo</b> y omite la elección de desencadenador.</li>
            <li>Desencadenador: <b>Cuando se recibe una solicitud de webhook de Teams</b> (<i>When a Teams webhook request is received</i>). En «Quién puede desencadenar» elige <b>Cualquiera</b>.</li>
            <li>Acción: <b>Publicar tarjeta en un chat o canal</b> (<i>Post card in a chat or channel</i>), publicando como <b>Usuario del flujo</b>, en <b>Chat con el usuario del flujo</b> (o «Chat»).</li>
            <li><b>Destinatario</b>: contenido dinámico → expresión <code>triggerBody()?['to']</code>.</li>
            <li><b>Tarjeta adaptable</b>: expresión <code>triggerBody()?['attachments']?[0]?['content']</code>.</li>
            <li>Guarda, abre el desencadenador, copia la <b>URL HTTP POST</b> y pégala arriba. Prueba con el botón.</li>
          </ol>
          <p class="muted sm">Si IPS no permite este tipo de flujo, los avisos al canal siguen funcionando; los personales no se enviarán.</p>
        </details>
      </div>
      <div class="card">
        <h2>Instalar el envío automático (una sola vez)</h2>
        <ol class="sm">
          <li>En Supabase, <b>SQL Editor → New query</b>, pega el contenido de <code>supabase-avisos.sql</code> y pulsa <b>Run</b> (activa <code>pg_cron</code> y <code>pg_net</code> si hace falta).</li>
          <li>Prueba al instante ejecutando <code>select public.qa_avisos(true);</code> y mira el canal de Teams.</li>
          <li>Desde ahí, los cambios de horario se hacen en esta pestaña; no hay que tocar Supabase de nuevo.</li>
        </ol>
        <p class="warn sm">⚠ El envío automático usa los datos tal como están en el dashboard. Planner se lee con la sesión de quien pulsa «Sincronizar»: si nadie sincroniza, los avisos reflejan la última sincronización (se indica en el mensaje).</p>
      </div>`;
    }
    // Envíos manuales: cada uno devuelve un texto con el resultado
    async function sendChannelNow(c) {
      if (!teamsOn(c)) return `${c.name}: sin URL de canal`;
      const m = summaryFor(c), r = await sendTeams(c, m.title, m.facts, m.lines);
      return `${c.name}: ` + (r.ok ? (r.unconfirmed ? "resumen enviado al canal (revisa Teams)" : "resumen enviado al canal ✓") : "no se pudo enviar al canal: " + r.err);
    }
    async function sendOwnersNow(c) {
      if (!userUrlOn()) return `${c.name}: falta la URL del flujo de mensajes personales`;
      const ds = ownerDigests(c); if (!ds.length) return `${c.name}: ningún responsable con pendientes o con correo en Equipo`;
      let ok = 0; for (const d of ds) if ((await sendUser(d.email, `Tus pendientes QA · ${c.name} · ${A.today}`, d.facts, d.lines, d.name)).ok) ok++;
      return `${c.name}: mensajes personales ${ok}/${ds.length}`;
    }
    function avisosBind(root, ro) {
      if (ro) return;
      const setUrl = async (cid, v) => {                           // guarda la URL de un cliente (tabla de secretos en línea)
        try { await saveUrl("client:" + cid, v, x => A.commit(s => { const c = s.clients.find(y => y.id === cid); if (c) { c.teams ||= {}; c.teams.webhook = x; } }), f => A.commit(s => { const c = s.clients.find(y => y.id === cid); if (c) { c.teams ||= {}; c.teams.hasUrl = f; delete c.teams.webhook; } }));
          A.commit(s => { const c = s.clients.find(y => y.id === cid); if (c && v) { c.teams ||= {}; c.teams.enabled = true; } }); A.render(); say(v ? "URL guardada ✓" + (REMOTE ? " (solo administradores pueden verla)." : "") : "URL quitada.");
        } catch (e) { say(/row-level|permission|policy|notify_secrets|does not exist/i.test(String(e.message)) ? "No se pudo guardar: solo un administrador puede, y hay que ejecutar supabase-seguridad.sql." : "No se pudo guardar: " + e.message, 1); }
      };
      root.querySelectorAll("[data-av-url]").forEach(i => (i.onchange = () => {
        const v = i.value.trim(); if (v && !urlOk(v)) return A.fieldErr(i, "La URL no parece un webhook de Teams / Power Automate (debe ser https y de Microsoft).");
        A.fieldErr(i, ""); setUrl(i.dataset.avUrl, v);
      }));
      root.querySelectorAll("[data-av-urlrm]").forEach(b => (b.onclick = async () => { if (await QA_UI.ask("¿Quitar la URL de este cliente? Dejará de recibir avisos.")) setUrl(b.dataset.avUrlrm, ""); }));
      root.querySelectorAll("[data-avc]").forEach(cb => (cb.onchange = () => { A.commit(s => { const c = s.clients.find(x => x.id === cb.dataset.cid); if (c) { c.teams ||= {}; (c.teams.events ||= {})[cb.dataset.avc] = cb.checked; } }); if (cb.dataset.avc === "auto") A.render(); say("Guardado ✓"); }));
      const run = async (btn, fn) => { btn.disabled = true; try { say(await fn()); } finally { btn.disabled = false; } };
      root.querySelectorAll("[data-av-test]").forEach(b => (b.onclick = () => run(b, async () => { const c = store().clients.find(x => x.id === b.dataset.avTest), r = await sendTeams(c, `Prueba · Dashboard QA · ${c.name}`, [["Enviado por", A.authorName()]], ["Si ves este mensaje, la conexión con el canal funciona ✅"]); return `${c.name}: ` + (r.ok ? (r.unconfirmed ? "prueba enviada, revisa el canal de Teams" : "prueba enviada ✓") : r.err); })));
      root.querySelectorAll("[data-av-now]").forEach(b => (b.onclick = async () => { const c = store().clients.find(x => x.id === b.dataset.avNow); if (await QA_UI.ask(`¿Enviar ahora el resumen de ${c.name} a su canal?`)) run(b, () => sendChannelNow(c)); }));
      root.querySelectorAll("[data-av-own]").forEach(b => (b.onclick = async () => { const c = store().clients.find(x => x.id === b.dataset.avOwn), ds = ownerDigests(c); if (!ds.length) return say(`${c.name}: ningún responsable con pendientes o con correo en Equipo.`, 1); if (await QA_UI.ask(`Se enviará un mensaje personal a ${ds.length} persona(s) de ${c.name}. ¿Continuar?`)) run(b, () => sendOwnersNow(c)); }));
      const selList = pred => { const cur = A.clientId(); return store().clients.filter(c => (cur === "all" || c.id === cur) && pred(c)); };
      const sel = root.querySelector("#avSel");
      if (sel) sel.onclick = async () => { const list = selList(teamsOn); if (!list.length) return say("El cliente elegido no tiene URL de canal.", 1); if (await QA_UI.ask(`¿Enviar ahora el resumen al canal de: ${list.map(c => c.name).join(", ")}?`)) run(sel, async () => { const res = []; for (const c of list) res.push(await sendChannelNow(c)); return res.join("  |  "); }); };
      const selO = root.querySelector("#avSelOwn");
      if (selO) selO.onclick = async () => { const list = selList(c => ownerDigests(c).length); if (!list.length) return say("El cliente elegido no tiene responsables con pendientes y correo en Equipo.", 1); if (await QA_UI.ask(`¿Enviar ahora mensajes personales de: ${list.map(c => c.name).join(", ")}?`)) run(selO, async () => { const res = []; for (const c of list) res.push(await sendOwnersNow(c)); return res.join("  |  "); }); };
      const upd = fn => { A.commit(s => { s.notify ||= {}; s.notify.times ||= []; s.notify.days ||= []; fn(s.notify); if (!/^(localhost|127\.)/.test(location.hostname)) s.notify.siteUrl = location.href.split("#")[0]; }); };
      const okT = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t), norm = l => [...new Set(l.filter(okT))].sort();
      root.querySelector("#avMaster").onchange = e => { upd(n => { n.auto = e.target.checked; }); say(e.target.checked ? "Envío automático activado ✓" : "Envío automático apagado: no saldrá ningún aviso programado."); };
      root.querySelectorAll("[data-av-time]").forEach(i => (i.onchange = () => { const old = i.dataset.avTime; if (!okT(i.value)) { i.value = old; return; } upd(n => { n.times = norm(n.times.map(t => (t === old ? i.value : t))); }); A.render(); }));
      root.querySelectorAll("[data-av-del]").forEach(b => (b.onclick = () => { upd(n => { n.times = n.times.filter(t => t !== b.dataset.avDel); }); A.render(); }));
      root.querySelector("#avAdd").onclick = () => { const v = root.querySelector("#avNew").value; if (!okT(v)) return say("Elige una hora válida.", 1); upd(n => { n.times = norm([...n.times, v]); }); A.render(); };
      root.querySelector("#avDef").onclick = () => { upd(n => { n.times = ["09:00", "12:00", "15:00", "18:00"]; }); A.render(); };
      root.querySelectorAll("[data-av-day]").forEach(cb => (cb.onchange = () => { upd(n => { const d = +cb.dataset.avDay; n.days = cb.checked ? [...new Set([...n.days, d])].sort() : n.days.filter(x => x !== d); }); }));
      const setUser = async v => {
        try { await saveUrl("user", v, x => upd(n => { n.userWebhook = x; }), f => upd(n => { n.hasUserUrl = f; delete n.userWebhook; })); A.render(); say(v ? "URL guardada ✓" : "URL quitada."); }
        catch (e) { say(/row-level|permission|policy|notify_secrets|does not exist/i.test(String(e.message)) ? "No se pudo guardar: solo un administrador puede, y hay que ejecutar supabase-seguridad.sql." : "No se pudo guardar: " + e.message, 1); }
      };
      const au = root.querySelector("#avUser"); if (au) au.onchange = e => { const v = e.target.value.trim(); if (v && !urlOk(v)) return A.fieldErr(e.target, "La URL no parece un webhook de Teams / Power Automate (https de Microsoft)."); A.fieldErr(e.target, ""); setUser(v); };
      const aur = root.querySelector("#avUserRm"); if (aur) aur.onclick = async () => { if (await QA_UI.ask("¿Quitar la URL de mensajes personales?")) setUser(""); };
      root.querySelector("#avTest").onclick = async () => {
        const inp = root.querySelector("#avTestTo"), em = inp.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return A.fieldErr(inp, "Escribe un correo válido de Teams, por ejemplo nombre@tu-organizacion.cl.");
        A.fieldErr(inp, ""); try { localStorage.setItem("qa-test-to", em); } catch {}
        const r = await sendUser(em, "Prueba · mensajes personales Dashboard QA", [["Para", em]], ["Si ves este mensaje, el flujo de mensajes personales funciona ✅"]);
        say(r.ok ? (r.unconfirmed ? "Enviado. Revisa tu chat de Teams (no se puede confirmar desde el navegador)." : "Enviado ✓") : r.err, !r.ok);
      };
    }

    // ---- mezcla Planner → dashboard (lectura; no escribe nunca en Planner) ----
    const mapStatus = p => (p >= 100 ? "Completado" : p > 0 ? "En curso" : "Pendiente");
    function typeFrom(s, labels) {
      for (const l of labels) { const n = A.norm(l); if (/express/.test(n)) return "express"; const c = (s.customTpl || []).find(x => A.norm(x.name) === n || n.includes(A.norm(x.name))); if (c) return c.id; if (/tradic/.test(n)) return "trad"; }
      return "";
    }
    function splitCode(t) {
      const m = t.title.match(/^\s*([A-Za-z]{1,6}[-_ ]?\d{2,7})\s*[-–—:·|]?\s*(.*)$/);
      return m && m[2] ? { code: m[1].toUpperCase().replace(/\s+/g, ""), title: m[2] } : { code: "PL-" + t.id.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase(), title: t.title };
    }
    function memberIds(s, t) {
      const out = [];
      for (const u of t.assignees) { const m = s.members.find(x => (x.email && u.email && x.email.toLowerCase() === u.email) || A.norm(x.name) === A.norm(u.name)); if (m && !out.includes(m.id)) out.push(m.id); }
      return out;
    }
    function applyStage(r, bucket) {                              // el depósito marca la etapa: las actividades anteriores quedan completas
      const nb = A.norm(bucket); if (!nb || !r.acts.length) return false;
      const i = r.acts.findIndex(a => { const na = A.norm(a.name); return na.includes(nb) || nb.split(" ").some(w => w.length >= 6 && na.includes(w)); });
      if (i < 0) return false;
      let ch = false;
      r.acts.forEach((a, k) => { if (k < i && a.percent < 100) { a.percent = 100; ch = true; } if (k === i && a.percent === 0) { a.percent = 50; ch = true; } });
      return ch;
    }
    function fitActs(r, start, end) {                             // reparte las actividades entre las fechas de Planner
      if (!start || !end || end < start || !r.acts.length) return;
      const T = A.d2n(end) - A.d2n(start) + 1, base = r.acts.map(a => Math.max(1, A.d2n(a.end || a.start || start) - A.d2n(a.start || start) + 1)), ds = A.scaleActs(base, T);
      let s = start; r.acts.forEach((a, i) => { a.start = s; a.end = A.addDays(s, ds[i] - 1); s = A.addDays(a.end, 1); });
    }
    function newReq(s, c, t, now) {
      const { code, title } = splitCode(t), type = typeFrom(s, [...t.labels, ...t.checks]) || "trad", tpl = A.tplFor(type);
      const start = t.start || t.created || A.today, base = tpl.map(x => x.days), tot = base.reduce((x, y) => x + y, 0), end = t.due && t.due >= start ? t.due : A.addDays(start, tot - 1);
      const ds = A.scaleActs(base, A.d2n(end) - A.d2n(start) + 1); let cur = start;
      const mem = memberIds(s, t);
      const acts = tpl.map((x, i) => { const e = A.addDays(cur, ds[i] - 1), a = { id: uid(), name: x.name, start: cur, end: e, percent: 0, blocked: false, blockReason: "", blockedSince: "" }; A.setIds(a, mem); cur = A.addDays(e, 1); return a; });
      const r = { id: uid(), clientId: c.id, code, title, type, status: mapStatus(t.percent), percent: 0, start, end, acts, committedEnd: end, dateLog: [], lastUpdate: now, priority: t.priority, bucket: t.bucket,
        deliverables: (type === "express" ? ["Informe final"] : ["Plan de pruebas", "Evidencias (EVP)", "Informe final"]).map(n => ({ id: uid(), name: n, due: end, state: "pendiente", url: "" })), metrics: {}, comments: [],
        src: { planner: true, taskId: t.id, planId: c.planner.planId, labels: t.labels, checks: t.checks, syncedAt: now, snap: {} } };
      A.setIds(r, mem); applyStage(r, t.bucket); r.percent = A.progress(r);
      if (r.percent > 0 && r.status === "Pendiente") r.status = "En curso";
      return r;
    }
    function applyPlanner(s, cid, data, sum, by) {
      Object.assign(sum, { created: 0, updated: 0, completed: 0, comments: 0, skipped: 0, changes: [], newReqs: [] });
      const c = s.clients.find(x => x.id === cid); if (!c) return; const now = new Date().toISOString();
      for (const t of data.tasks) {
        let r = s.reqs.find(x => x.src?.taskId === t.id && x.clientId === cid);
        const cur = { title: t.title, status: mapStatus(t.percent), start: t.start, end: t.due, priority: t.priority, bucket: t.bucket, labels: [...t.labels, ...t.checks].join("|"), who: t.assignees.map(a => a.id).join("|") };
        if (!r) {
          if (t.percent >= 100) { sum.skipped++; continue; }    // solo proyectos activos
          r = newReq(s, c, t, now); r.src.snap = cur; s.reqs.push(r); sum.created++; sum.newReqs.push(r);
        } else {
          const sn = r.src.snap || {}, ch = [];
          if (cur.title !== sn.title) { const sp = splitCode(t); r.title = sp.title; if (!r.code || /^PL-/.test(r.code)) r.code = sp.code; ch.push("nombre"); }
          if (cur.status !== sn.status) {
            if (cur.status === "Completado") { r.status = "Completado"; r.completedAt = A.today; r.acts.forEach(a => (a.percent = 100)); r.percent = 100; sum.completed++; }
            else { r.status = r.status === "Completado" ? "En curso" : (r.status === "Bloqueado" ? "Bloqueado" : cur.status); r.completedAt = ""; }
            ch.push("estado");
          }
          if (cur.priority !== sn.priority) { r.priority = cur.priority; ch.push("prioridad " + cur.priority); }
          if (cur.bucket !== sn.bucket) { r.bucket = cur.bucket; if (applyStage(r, cur.bucket)) { r.percent = A.progress(r); if (r.percent > 0 && r.status === "Pendiente") r.status = "En curso"; } ch.push("depósito → " + (cur.bucket || "—")); }
          if (cur.start !== sn.start || cur.end !== sn.end) {
            const from = A.span(r)[1]; fitActs(r, cur.start || A.span(r)[0], cur.end || from); const to = A.span(r)[1];
            r.start = A.span(r)[0]; r.end = to; if (from !== to) { (r.dateLog ||= []).push({ at: now, by: "Planner", from, to, reason: "Cambio de fecha de vencimiento en Planner" }); ch.push("vencimiento " + to); } else ch.push("fechas");
          }
          if (cur.labels !== sn.labels) { const ty = typeFrom(s, [...t.labels, ...t.checks]); if (ty && ty !== r.type) { r.type = ty; ch.push("tipo"); } r.src.labels = t.labels; r.src.checks = t.checks; }
          if (cur.who !== sn.who) { const mem = memberIds(s, t); if (mem.length) { A.setIds(r, mem); ch.push("responsables"); } }
          if (ch.length) { r.lastUpdate = now; sum.updated++; sum.changes.push(`${r.code}: ${ch.join(", ")}`); }
          r.src.snap = cur; r.src.syncedAt = now;
        }
        const have = new Set(r.comments.map(x => x.id)); let added = 0;
        for (const cm of t.comments) if (!have.has(cm.id)) { r.comments.push(cm); added++; if (!r.lastUpdate || cm.at > r.lastUpdate) r.lastUpdate = cm.at; }
        sum.comments += added;
      }
      c.planner.lastSync = now;
    }

    async function sync(cid) {
      const c = store().clients.find(x => x.id === cid); if (!c) return;
      const pl = c.planner || {};
      if (!pl.enabled) return say(`«${c.name}» no tiene Planner activado.`, 1);
      if (!pl.planId) return say(`Elige el plan de Planner de «${c.name}» antes de sincronizar.`, 1);
      if (!configured()) return say("Falta configurar la aplicación de Microsoft (msalClientId / msalTenantId en config.js).", 1);
      try {
        say(`Leyendo Planner de ${c.name}…`);
        if (!MOCK()) await token(true).then(() => P.session().then(n => (acct = n)));
        const data = await P.loadPlan(pl.planId), sum = {}, by = A.authorName();
        A.commit(s => applyPlanner(s, cid, data, sum, by));
        A.render();
        const msg = `Planner · ${c.name}: ${sum.created} nuevo(s), ${sum.updated} actualizado(s), ${sum.comments} comentario(s) nuevo(s)` + (sum.skipped ? ` · ${sum.skipped} ya completado(s) omitido(s)` : "") + (data.warnings.length ? ` · ⚠ ${data.warnings.join(" ")}` : "");
        say(msg);
        if (teamsOn(c) && c.teams.events?.sync !== false && (sum.created || sum.updated)) {
          sendTeams(c, `Planner sincronizado · ${c.name}`, [["Nuevos", sum.created], ["Actualizados", sum.updated], ["Comentarios nuevos", sum.comments]], [...sum.newReqs.slice(0, 6).map(r => `🆕 **${r.code}** ${r.title}`), ...sum.changes.slice(0, 10).map(x => `🔄 ${x}`)]);
        }
        return sum;
      } catch (e) { say(errEs(e), 1); }
    }
    async function syncActive() {
      const list = store().clients.filter(c => c.planner?.enabled && c.planner.planId && (A.clientId() === "all" || A.clientId() === c.id));
      if (!list.length) return say("No hay clientes con Planner activado y plan elegido (pestaña Clientes).", 1);
      for (const c of list) await sync(c.id);
    }

    // ---- tarjetas de cliente ----
    function cardHtml(c, ro) {
      const pl = c.planner || {}, tm = c.teams || {}, n = store().reqs.filter(r => r.clientId === c.id), dis = ro ? " disabled" : "";
      const nPl = n.filter(r => r.src?.planner).length, ev = tm.events || {};
      return `<div class="ccard" data-cid="${c.id}">
        <div class="chead"><input data-cn="${c.id}" value="${esc(c.name)}"${dis} aria-label="Nombre del cliente"><span class="muted">${n.length} requerimiento(s)${nPl ? ` · ${nPl} desde Planner` : ""}</span>${ro ? "" : `<button data-cdel="${c.id}" class="danger">Eliminar cliente</button>`}</div>
        <div class="cint">
          <div class="cbox">
            <label class="switch"><input type="checkbox" data-pl-en${pl.enabled ? " checked" : ""}${dis}><i></i><b>Conectar con Planner</b></label>
            <p class="muted sm">Solo lectura: el dashboard se alimenta de Planner (proyecto, estado, prioridad, fechas, depósito, tipo y comentarios). No escribe nada en Planner.</p>
            <div class="cdet"${pl.enabled ? "" : " hidden"}>
              ${configured() ? `<p class="sm">Cuenta Microsoft: <b data-pl-acct>${esc(acct || "sin conectar")}</b> ${acct ? "" : `<button type="button" data-pl-login${dis}>Conectar cuenta</button>`}</p>`
                : `<p class="warn sm">Falta registrar la aplicación en Microsoft Entra ID y poner <code>msalClientId</code> y <code>msalTenantId</code> en <code>config.js</code> (ver README, sección Planner).</p>`}
              <label>Plan de Planner<select data-pl-plan${dis}><option value="">${pl.planId ? esc(pl.planName || pl.planId) : "— elige un plan —"}</option>${pl.planId ? "" : ""}</select></label>
              <div class="crow"><button type="button" data-pl-list${dis}>Buscar mis planes</button><input data-pl-planid placeholder="o pega el ID del plan" value="${esc(pl.planId || "")}"${dis}></div>
              <div class="crow"><button type="button" class="primary" data-pl-sync${dis}>↻ Sincronizar ahora</button><span class="muted sm">Última sincronización: ${esc(fmtDT(pl.lastSync))}</span></div>
            </div>
          </div>
          <div class="cbox">
            <b>Avisos a Teams</b>
            <p class="muted sm">Estado del canal: ${teamsOn(c) ? '<span class="badge okb">Conectado</span>' : '<span class="badge warnb">Sin URL</span>'}. La URL del canal, los envíos automáticos, los mensajes personales y los botones «Enviar ahora» se manejan ahora en la pestaña <b>Avisos</b>.</p>
            <div class="crow"><button type="button" data-go-avisos>Ir a Avisos</button></div>
          </div>
        </div>
      </div>`;
    }
    function bind(root) {
      root.querySelectorAll(".ccard").forEach(card => {
        const cid = card.dataset.cid, upd = fn => { A.commit(s => { const c = s.clients.find(x => x.id === cid); if (c) { c.planner ||= {}; c.teams ||= {}; fn(c); } }); };
        const q = s => card.querySelector(s);
        q("[data-pl-en]").onchange = e => { upd(c => (c.planner.enabled = e.target.checked)); A.render(); };
        q("[data-pl-planid]").onchange = e => { const v = e.target.value.trim(); upd(c => { c.planner.planId = v; c.planner.planName = v ? (c.planner.planName || v) : ""; }); A.render(); };
        q("[data-pl-sync]").onclick = () => sync(cid);
        const lg = q("[data-pl-login]"); if (lg) lg.onclick = async () => { try { await P.signIn(); acct = await P.session(); A.render(); say("Cuenta Microsoft conectada ✓"); } catch (e) { say(errEs(e), 1); } };
        q("[data-pl-list]").onclick = async () => {
          if (!configured()) return say("Falta configurar la aplicación de Microsoft (config.js).", 1);
          try { if (!acct) { await P.signIn(); acct = await P.session(); } say("Buscando tus planes…"); const plans = await P.listPlans(), sel = q("[data-pl-plan]");
            sel.innerHTML = `<option value="">— elige un plan (${plans.length}) —</option>` + plans.map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join(""); say(plans.length ? `${plans.length} plan(es) encontrados. Elige uno.` : "No encontré planes con esta cuenta."); }
          catch (e) { say(errEs(e), 1); }
        };
        q("[data-pl-plan]").onchange = e => { const o = e.target.selectedOptions[0]; if (!e.target.value) return; upd(c => { c.planner.planId = e.target.value; c.planner.planName = o.textContent; }); say(`Plan «${o.textContent}» elegido. Pulsa «Sincronizar ahora».`); A.render(); };
        const ga = q("[data-go-avisos]"); if (ga) ga.onclick = () => document.querySelector('#tabs [data-v="avisos"]').click();
      });
    }
    // la burbuja de ayuda de los signos «!» la maneja tips.js
    P.session().then(n => { acct = n; }).catch(() => {});
    return {
      cardHtml, bind, sync, syncActive, summaryFor, sendTeams, sendUser, ownerDigests, avisosHtml, avisosBind,
      anyEnabled: () => store().clients.some(c => c.planner?.enabled && c.planner.planId),
      onBlock(r, a, reason) { const c = store().clients.find(x => x.id === r.clientId); if (teamsOn(c) && c.teams.events?.blocked !== false) sendTeams(c, `🚧 Bloqueo · ${c.name}`, [["Requerimiento", `${r.code} ${r.title}`], ["Actividad", a.name], ["Reportado por", A.authorName()]], [reason || "Sin motivo indicado"]); },
      applyPlanner                                               // expuesto para pruebas
    };
  };
})();
