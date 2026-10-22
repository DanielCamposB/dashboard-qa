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
    ]
  });
  const defaultRoles = () => ["QA Funcional", "QA Automatizador"];
  const emptyStore = () => ({ members: [], roles: defaultRoles(), templates: defaultTemplates(), reqs: [] });
  const normalize = o => { o.roles ||= defaultRoles(); o.templates ||= defaultTemplates(); o.members ||= []; o.reqs ||= []; o.members.forEach(m => (m.role ||= "")); return o; };

  function seed() {
    const t = iso(new Date());
    const m = [
      { id: uid(), name: "Ana Torres", email: "ana@empresa.com", role: "QA Funcional" },
      { id: uid(), name: "Luis Rojas", email: "luis@empresa.com", role: "QA Automatizador" },
      { id: uid(), name: "Marta Díaz", email: "marta@empresa.com", role: "QA Funcional" }
    ];
    const tpl = defaultTemplates();
    let s = addDays(t, -9);
    const acts = tpl.trad.map((a, i) => {
      const x = { id: uid(), name: a.name, start: s, end: addDays(s, a.days - 1), percent: i < 3 ? 100 : i === 3 ? 50 : 0, assigneeId: m[0].id, blocked: false };
      s = addDays(x.end, 1); return x;
    });
    return {
      members: m, roles: defaultRoles(), templates: tpl,
      reqs: [
        { id: uid(), code: "R1903", title: "Aranda - SOLFON", type: "trad", assigneeId: m[0].id, status: "En curso", percent: 0, start: acts[0].start, end: acts[acts.length - 1].end, acts,
          comments: [{ id: uid(), at: new Date().toISOString(), by: "Ana Torres", text: "Casos aprobados por el analista. Iniciando ciclo 1." }] },
        { id: uid(), code: "R2044", title: "Ajuste de reporte de saldos", type: "express", assigneeId: m[1].id, status: "En curso", percent: 60, start: addDays(t, -1), end: addDays(t, 1), acts: [],
          comments: [{ id: uid(), at: new Date().toISOString(), by: "Luis Rojas", text: "Probado 60%, falta validar con datos de producción." }] },
        { id: uid(), code: "R2051", title: "Validación campo teléfono", type: "express", assigneeId: m[2].id, status: "Pendiente", percent: 0, start: addDays(t, 2), end: addDays(t, 2), acts: [], comments: [] }
      ]
    };
  }

  const D = { iso, addDays, uid, defaultTemplates, defaultRoles, remote, onError: () => {}, onRemoteChange: () => {} };

  // ---------- local ----------
  function localLoad() {
    try { const r = localStorage.getItem(KEY); if (r) return normalize(JSON.parse(r)); } catch {}
    const s = seed(); localSave(s); return s;
  }
  function localSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  // ---------- Supabase ----------
  let sb, version = 0, canEdit = false, timer = null, pending = null, userEmail = "";
  async function fetchState() {
    const { data, error } = await sb.from("app_state").select("data,version").eq("id", 1).single();
    if (error) throw error;
    version = data.version;
    return data.data && data.data.reqs ? normalize(data.data) : null;
  }
  async function pushNow() {
    const s = pending; pending = null; if (!s) return;
    const { data, error } = await sb.from("app_state").update({ data: s, version: version + 1 }).eq("id", 1).eq("version", version).select("version");
    if (error) return D.onError("No se pudo guardar: " + error.message);
    if (!data.length) {
      D.onError("Otra persona guardó cambios antes que tú. Se cargó la versión más reciente; repite tu cambio.");
      const fresh = await fetchState(); if (fresh) D.onRemoteChange(fresh);
      return;
    }
    version = data[0].version;
  }

  D.init = async function () {
    if (!remote) return { store: localLoad(), forceRead: null, user: "" };
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { needLogin: true };
    if (/type=recovery/.test(location.hash)) return { needLogin: true, recovery: true };
    userEmail = (session.user.email || "").toLowerCase();
    const { data: prof, error } = await sb.from("profiles").select("role").eq("email", userEmail).maybeSingle();
    if (error) throw error;
    if (!prof) return { denied: true, user: userEmail };
    canEdit = prof.role === "editor";
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
    if (!canEdit) return;
    pending = s; clearTimeout(timer); timer = setTimeout(pushNow, 400);
  };
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
