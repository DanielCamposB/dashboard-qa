// Almacenamiento: Supabase (compartido, con login) o localStorage (si config.js está vacío).
(function () {
  const KEY = "qa-dashboard-v2";
  const cfg = window.QA_CONFIG || {};
  const remote = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const uid = () => crypto.randomUUID();

  const defaultTemplates = () => ({
    trad: [
      { name: "Análisis y comprensión del requerimiento", days: 2 },
      { name: "Diseño de casos de prueba", days: 4 },
      { name: "Preparación de ambiente y datos", days: 2 },
      { name: "Ejecución de pruebas ciclo 1", days: 5 },
      { name: "Gestión de defectos / ciclo 2", days: 3 },
      { name: "Regresión", days: 3 },
      { name: "Evidencias y cierre (EVP)", days: 2 }
    ],
    express: [
      { name: "Diseño de casos de prueba", days: 1 },
      { name: "Ejecución", days: 2 },
      { name: "Certificación", days: 1 },
      { name: "Informe final", days: 1 }
    ]
  });
  const defaultRoles = () => ["QA Funcional", "QA Automatizador"];
  const emptyStore = () => ({ clients: [], members: [], roles: defaultRoles(), templates: defaultTemplates(), reqs: [] });
  const normalize = o => { o.roles ||= defaultRoles(); o.templates ||= defaultTemplates(); o.templates.express ||= defaultTemplates().express; o.members ||= []; o.reqs ||= []; o.clients ||= []; if (!o.clients.length) o.clients.push({ id: uid(), name: "General" }); o.reqs.forEach(r => { if (!o.clients.some(c => c.id === r.clientId)) r.clientId = o.clients[0].id; r.comments ||= []; r.acts ||= []; r.deliverables ||= []; r.metrics ||= {}; r.dateLog ||= []; r.committedEnd ||= r.end; r.lastUpdate ||= (r.comments.length ? r.comments[r.comments.length - 1].at : new Date().toISOString()); r.acts.forEach(a => { a.blockReason ||= ""; a.blockedSince ||= ""; }); }); o.members.forEach(m => { m.roles ||= m.role ? [m.role] : []; delete m.role; }); return o; };

  function seed() {
    const t = iso(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
    const m = [
      { id: uid(), name: "Ana Torres", email: "ana@empresa.com", roles: ["QA Funcional"] },
      { id: uid(), name: "Luis Rojas", email: "luis@empresa.com", roles: ["QA Automatizador", "QA Funcional"] },
      { id: uid(), name: "Marta Díaz", email: "marta@empresa.com", roles: ["QA Funcional"] }
    ];
    const tpl = defaultTemplates();
    let s = addDays(t, -9);
    const acts = tpl.trad.map((a, i) => {
      const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: i < 3 ? 100 : i === 3 ? 50 : 0, assigneeId: m[0].id, blocked: false };
      s = addDays(x.end, 1); return x;
    });
    const mkActs = (list, start, pcts, who) => { let s = start; return list.map((a, i) => { const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: pcts[i] ?? 0, assigneeId: who, blocked: false }; s = addDays(x.end, 1); return x; }); };
    const ex1 = mkActs(tpl.express, addDays(t, -2), [100, 50, 0, 0], m[1].id), ex2 = mkActs(tpl.express, addDays(t, 2), [], m[2].id);
    const cl = [{ id: uid(), name: "IPS" }, { id: uid(), name: "Hites" }, { id: uid(), name: "PDI" }];
    return {
      clients: cl, members: m, roles: defaultRoles(), templates: tpl,
      reqs: [
        { id: uid(), clientId: cl[0].id, code: "R1903", title: "Aranda - SOLFON", type: "trad", assigneeId: m[0].id, status: "En curso", percent: 0, start: acts[0].start, end: acts[acts.length - 1].end, acts,
          comments: [{ id: uid(), at: new Date().toISOString(), by: "Ana Torres", text: "Casos aprobados por el analista. Iniciando ciclo 1." }] },
        { id: uid(), clientId: cl[1].id, code: "R2044", title: "Ajuste de reporte de saldos", type: "express", assigneeId: m[1].id, status: "En curso", percent: 0, start: ex1[0].start, end: ex1[3].end, acts: ex1,
          comments: [{ id: uid(), at: new Date().toISOString(), by: "Luis Rojas", text: "Probado 60%, falta validar con datos de producción." }] },
        { id: uid(), clientId: cl[2].id, code: "R2051", title: "Validación campo teléfono", type: "express", assigneeId: m[2].id, status: "Pendiente", percent: 0, start: ex2[0].start, end: ex2[3].end, acts: ex2, comments: [] }
      ]
    };
  }

  const D = { iso, addDays, uid, defaultTemplates, defaultRoles, remote, onError: () => {}, onRemoteChange: () => {} };

  // ---------- local ----------
  function localLoad() {
    try { const r = localStorage.getItem(KEY); if (r) return normalize(JSON.parse(r)); } catch {}
    const s = normalize(seed()); localSave(s); return s;
  }
  function localSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  // ---------- Supabase ----------
  const PF = ["nombres", "apellido_paterno", "apellido_materno", "cargo", "vertical", "cumpleanos", "telefono"];
  let profile = {};
  let sb, version = 0, canEdit = false, timer = null, pending = null, userEmail = "";
  async function fetchState() {
    const { data, error } = await sb.from("app_state").select("data,version").eq("id", 1).single();
    if (error) throw error;
    version = data.version;
    return data.data && data.data.reqs ? normalize(data.data) : null;
  }
  let ops = [];                                  // cambios pequeños (check-ins, comentarios) que se pueden re-aplicar sobre la última versión
  D.queueOp = op => { if (remote && canEdit) ops.push(op); };
  async function pushNow(retry = 0) {
    const s = pending; pending = null; if (!s) return;
    const mine = ops; ops = [];
    let res; try { res = await sb.from("app_state").update({ data: s, version: version + 1 }).eq("id", 1).eq("version", version).select("version"); }
    catch (e) { ops = mine.concat(ops); return D.onError("No se pudo guardar (sin conexión): " + (e.message || e)); }
    const { data, error } = res;
    if (error) { ops = mine.concat(ops); return D.onError("No se pudo guardar: " + error.message); }
    if (!data.length) {
      const fresh = await fetchState();
      if (fresh && mine.length && retry < 3) {      // re-aplica mis cambios sobre la versión más nueva y reintenta
        mine.forEach(op => op(fresh)); ops = mine.concat(ops); pending = fresh; D.onRemoteChange(fresh);
        return pushNow(retry + 1);
      }
      D.onError("Otra persona guardó cambios antes que tú. Se cargó la versión más reciente; repite tu cambio.");
      if (fresh) D.onRemoteChange(fresh);
      return;
    }
    version = data[0].version;
  }

  D.init = async function () {
    if (!remote) { try { profile = JSON.parse(localStorage.getItem("qa-profile") || "{}"); } catch {} return { store: localLoad(), forceRead: null, user: "" }; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { needLogin: true };
    if (/type=recovery/.test(location.hash)) return { needLogin: true, recovery: true };
    userEmail = (session.user.email || "").toLowerCase();
    const { data: prof, error } = await sb.from("profiles").select("*").eq("email", userEmail).maybeSingle();
    if (error) throw error;
    if (!prof) return { denied: true, user: userEmail };
    canEdit = prof.role === "editor" || prof.role === "admin"; profile = prof;
    let store = await fetchState();
    if (!store) { store = canEdit ? seedOrEmpty() : emptyStore(); if (canEdit) { pending = store; await pushNow(); } }
    setInterval(async () => {                       // refresco cada 30 s si no hay cambios por guardar
      if (pending) return;
      try { const { data } = await sb.from("app_state").select("version").eq("id", 1).single(); if (data.version !== version) { const f = await fetchState(); if (f) D.onRemoteChange(f); } } catch {}
    }, 30000);
    return { store, forceRead: canEdit ? false : true, user: userEmail, role: prof.role };
  };
  const seedOrEmpty = () => emptyStore();           // el sistema compartido arranca vacío (sin datos de ejemplo)

  D.save = function (s) {
    if (!remote) return localSave(s);
    if (!canEdit) return D.onError && D.onError("Tu cuenta no tiene permiso de edición: los cambios no se guardaron.");
    pending = s; clearTimeout(timer); timer = setTimeout(pushNow, 400);
  };
  D.getProfile = () => profile;
  D.isAdmin = () => remote && profile.role === "admin";
  D.myEmail = () => userEmail;
  D.setRole = async (email, role) => { const { data, error } = await sb.from("profiles").update({ role }).eq("email", email).select("email"); if (error) throw error; if (!data.length) throw new Error("No se pudo cambiar (sin permiso)"); };
  D.addUser = async (email, role) => { const { error } = await sb.from("profiles").insert({ email, role }); if (error) throw error; };
  D.removeUser = async email => { const { data, error } = await sb.from("profiles").delete().eq("email", email).select("email"); if (error) throw error; if (!data.length) throw new Error("No se pudo quitar (sin permiso)"); };
  D.saveProfile = async p => {
    const clean = {}; PF.forEach(k => (clean[k] = (p[k] ?? "").toString().trim() || null));
    if (!remote) { profile = { ...profile, ...clean }; try { localStorage.setItem("qa-profile", JSON.stringify(profile)); } catch {} return; }
    const { error } = await sb.from("profiles").update(clean).eq("email", userEmail);
    if (error) throw error;
    profile = { ...profile, ...clean };
  };
  D.listProfiles = async () => { const { data, error } = await sb.from("profiles").select("*").order("email"); if (error) throw error; return data; };
  D.login = async (email, password) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  D.signUp = async (email, password) => {
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    return !!data.session;                       // true si no requiere confirmar correo
  };
  D.resetPassword = async email => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  };
  D.updatePassword = async password => {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  };
  D.logout = async () => { await sb.auth.signOut(); location.reload(); };
  D.exportJson = function (store) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }));
    a.download = `qa-dashboard-${iso(new Date())}.json`; a.click();
  };

  window.QA_DATA = D;
})();
