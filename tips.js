// Iconos «!» amarillos con una breve explicación de cada columna, campo y sección, en todas las solapas.
// Se agregan solos cada vez que la pantalla se redibuja (no hace falta tocar cada tabla).
(function () {
  const norm = s => s.replace(/⁠/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\*/g, "").replace(/\(opcional\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
  const own = el => norm([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(" "));
  const T = {
    dash: {
      "cliente": "Cliente al que pertenece el requerimiento.",
      "código": "Identificador del requerimiento: 1 letra y hasta 8 números (ej: R1903).",
      "requerimiento": "Título o nombre del requerimiento.",
      "tipo": "Plantilla de trabajo: QA Tradicional (carta Gantt completa), QA Express (rápido) u otra que hayas creado.",
      "responsables qa": "Integrantes del equipo QA asignados. Debajo aparece el líder del requerimiento.",
      "estado": "Situación actual: Pendiente, En curso, Bloqueado o Completado. Se ajusta solo según el avance de las actividades; si hay atraso se agrega una etiqueta.",
      "prioridad": "Urgencia del requerimiento: Urgente, Importante, Media o Baja.",
      "etapa del proyecto": "Fase del proyecto en que está (ej: Análisis, Certificación). Solo letras.",
      "avance": "Porcentaje completado, calculado con el avance de todas sus actividades.",
      "entregables": "Entregables terminados sobre el total. En rojo, los que ya vencieron sin entregarse.",
      "inicio": "Fecha de la primera actividad.",
      "fin": "Fecha de término de la última actividad. «+N d» indica los días de retraso respecto a la fecha comprometida.",
      "último seguimiento": "Último comentario o avance registrado, con su autor y fecha.",
    },
    team: {
      "nombre": "Nombre de la persona.",
      "correo de teams (para avisos)": "Correo de la organización con el que recibe los avisos personales por Teams.",
      "rol": "Funciones que cumple en el equipo (QA, DevOps, SDET, etc.). Puede tener varios.",
      "roles": "Funciones que cumple. Puede tener varios.",
      "requerimientos activos": "Cantidad de requerimientos no completados en los que participa.",
      "integrantes": "Personas que tienen este rol.",
      "responsables": "Personas que tienen este rol.",
      "correo": "Correo de contacto de la persona.",
    },
    res: {
      "cliente": "Cliente al que pertenecen los requerimientos.",
      "total": "Requerimientos del cliente.",
      "en curso": "Requerimientos que están en ejecución.",
      "verde": "En plazo y sin problemas.",
      "amarillo": "En riesgo: atraso leve, entregable vencido o sin actualizar.",
      "rojo": "Crítico: atraso importante o actividades bloqueadas.",
      "atrasados": "Con fecha de término vencida y sin completar.",
      "sin actualizar": "Sin cambios ni comentarios en los últimos días hábiles.",
      "entreg. vencidos": "Entregables pendientes cuya fecha ya pasó.",
      "ejecución": "Casos ejecutados sobre casos diseñados.",
      "automatizado": "Casos automatizados sobre casos diseñados.",
      "defectos abiertos": "Defectos críticos, altos, medios y bajos informados.",
    },
    acc: {
      "nombre": "Nombre de la persona.", "cargo": "Cargo o rol en la empresa.", "vertical": "Área de negocio donde trabaja.", "cumpleaños": "Fecha de cumpleaños.",
      "teléfono": "Teléfono de contacto.", "correo": "Correo con el que ingresa al sitio.", "acceso": "Nivel de acceso: administrador, editor o solo lectura.",
      "estado": "Si la cuenta está activa, pendiente de aprobación o bloqueada.", "permiso": "Lo que la persona puede hacer en el sitio.",
    },
    act: {
      "actividad": "Tarea del requerimiento. Máximo 500 caracteres.",
      "resp. qa": "Integrantes del equipo QA que ejecutan la actividad.",
      "inicio": "Fecha de inicio (opcional: si la dejas vacía se toma desde la actividad anterior).",
      "fin": "Fecha de término (opcional: si la dejas vacía es el mismo día de inicio).",
      "% avance": "Porcentaje completado de la actividad. Al llegar a 100% se considera terminada.",
      "bloqueado": "Marca si algo impide avanzar. Pide un motivo y deja el requerimiento en estado Bloqueado.",
      "entregable": "Documento o resultado que se debe entregar (informe, evidencias, matriz).",
      "vence": "Fecha límite del entregable.",
      "estado": "Pendiente, Entregado o Validado.",
      "enlace (sharepoint / devops)": "Link al documento o ticket. Debe comenzar con https://.",
      "duración": "Cuánto dura la actividad, en días o en HH (8 HH = 1 día). Se copia a cada requerimiento nuevo.",
    },
    form: {
      "cliente": "Cliente dueño del requerimiento.", "código": "1 letra y hasta 8 números, sin símbolos (ej: R1903).",
      "tipo": "Plantilla de actividades que se copia al crear el requerimiento.",
      "título": "Nombre del requerimiento. Letras, números, espacios y ( ) # $ / -.",
      "prioridad": "Urgencia: Urgente, Importante, Media o Baja.", "etapa del proyecto": "Fase del proyecto. Solo letras y espacios.",
      "responsables qa": "Integrantes del equipo QA asignados.", "responsables de requerimiento": "Líderes que piden o supervisan el requerimiento (se crean en su solapa).",
      "estado": "Pendiente, En curso, Bloqueado o Completado. Se actualiza solo según las actividades, salvo que lo elijas tú.",
      "nombres": "Tus nombres.", "apellido paterno": "Tu primer apellido.", "apellido materno": "Tu segundo apellido (opcional).",
      "rol / cargo en la empresa": "Tu cargo (ej: Analista QA, Líder QA).", "vertical donde trabaja": "Área de negocio donde trabajas.",
      "cumpleaños": "Se usa para saludar al equipo.", "teléfono": "Teléfono de contacto.", "correo de acceso": "Correo con el que ingresas; no se puede cambiar.",
      "motivo": "Explica por qué cambia el plazo; queda en el historial de cambios de plazo.",
      "contraseña actual": "La contraseña con la que ingresas hoy.", "nueva contraseña": "Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.",
    },
    gantt: { "requerimiento / actividad": "Cada requerimiento con sus actividades. Las barras muestran el avance; la línea roja es hoy y la punteada, la fecha comprometida. Arrastra una barra para mover fechas (modo Editor)." },
    kpi: {
      "requerimientos": "Total de requerimientos con los filtros aplicados.", "qa express": "Requerimientos del tipo Express.", "qa tradicional": "Requerimientos del tipo Tradicional.",
      "en curso": "Requerimientos en ejecución.", "bloqueados": "Requerimientos con alguna actividad bloqueada.", "atrasados": "Con fecha de término vencida y sin completar.",
      "sin actualizar": "Sin cambios ni comentarios en los últimos días hábiles.", "entregables vencidos": "Entregables pendientes cuya fecha ya pasó.", "completados": "Requerimientos terminados.",
      "en plazo": "Verde: avanzan dentro de lo comprometido.", "en riesgo": "Amarillo: atraso leve o entregables vencidos.", "críticos": "Rojo: atraso importante o actividades bloqueadas.",
      "cumplimiento de plazos": "De los requerimientos completados, el porcentaje que terminó dentro de la fecha comprometida.",
      "ejecución de casos": "Casos ejecutados sobre casos diseñados.", "defectos críticos/altos": "Defectos críticos y altos de requerimientos no completados.",
    },
    head: {
      "por cliente": "Resumen de salud de los requerimientos de cada cliente.", "requerimientos que necesitan atención": "Los que están atrasados, bloqueados, con entregables vencidos o sin actualizar.",
      "seguimiento de hoy": "Actividades que vencen hoy, atrasadas, bloqueadas o sin actualizar. Registra el avance sin abrir cada requerimiento.",
      "roles": "Funciones que se pueden asignar a los integrantes del equipo QA.", "perfiles de usuarios": "Datos que cada usuario completó en «Mi perfil». Solo los ven los editores.",
      "roles de los responsables de requerimiento": "Funciones que se pueden asignar a los responsables de requerimiento.",
      "permisos de acceso": "Quién puede entrar al sitio y con qué permiso. Solo administradores.", "copias de seguridad": "Respaldos automáticos de los datos; el administrador puede restaurarlos.",
      "clientes": "Clientes del equipo y su canal de Teams para avisos.", "actividades base de qa tradicional": "Actividades que se copian a cada requerimiento tradicional nuevo.",
      "actividades base de qa express": "Actividades que se copian a cada requerimiento express nuevo.",
      "solo mis actividades": "Muestra únicamente las actividades asignadas a ti.",
    },
  };
  const RULES = [
    ["#tbl th", T.dash], ["#memberTbl th, #roleTbl th, #leaderTbl th, #leaderRoleTbl th", T.team], ["#resCli th", T.res],
    ["#profTbl th, #permTbl th", T.acc], ["#actTbl th, #delTbl th, #v-tpl th", T.act],
    ["#rform label, #rform .lbl, #pform label, #rsdlg label", T.form], [".kpis .kpi span", T.kpi], ["#gantt .g-head .g-label", T.gantt],
    ["#v-hoy h2, #v-resumen h2, #v-team h2, #v-leaders h2, #v-perm h2, #v-clients h2, #v-tpl h2, #v-hoy label.chk", T.head],
  ];
  const mk = tip => { const s = document.createElement("span"); s.className = "qhint"; s.tabIndex = 0; s.setAttribute("role", "note"); s.dataset.tip = tip; s.setAttribute("aria-label", tip); s.textContent = "!"; return s; };
  function apply() {
    for (const [sel, dict] of RULES) document.querySelectorAll(sel).forEach(el => {
      if (el.querySelector(":scope > .qhint, :scope > .hint, :scope > .lcap")) return;
      const tip = dict[own(el)]; if (!tip) return;
      if (el.tagName === "LABEL" || el.classList.contains("lbl")) {                      // en los formularios el ícono va junto al nombre del campo, no debajo
        if (el.querySelector(":scope > .lcap")) return;
        const cap = document.createElement("span"); cap.className = "lcap";
        const first = el.firstChild; if (!first || first.nodeType !== 3) { el.append("\u2060", mk(tip)); return; }
        el.insertBefore(cap, first); cap.append(first);
        if (cap.nextSibling && cap.nextSibling.classList && cap.nextSibling.classList.contains("star")) cap.append(" ", cap.nextSibling);
        cap.append("\u2060", mk(tip));
      } else el.append("\u2060", mk(tip));
    });
  }
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(apply, 60); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", apply);
  // globo flotante (no lo recorta ninguna tabla con scroll)
  const initTip = () => {
    if (document.querySelector(".tipbox")) return;
    const tip = document.createElement("div"); tip.className = "tipbox"; tip.hidden = true; tip.setAttribute("role", "tooltip"); if (tip.showPopover) tip.setAttribute("popover", "manual"); document.body.appendChild(tip);
    const show = h => { tip.textContent = h.dataset.tip; tip.hidden = false; if (tip.showPopover && !tip.matches(":popover-open")) tip.showPopover(); else if (tip.showPopover) { tip.hidePopover(); tip.showPopover(); }   // capa superior: queda sobre las ventanas modales
      const r = h.getBoundingClientRect(), w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; tip.style.top = r.bottom + 8 + "px"; };
    const hide = () => { if (tip.showPopover && tip.matches(":popover-open")) tip.hidePopover(); tip.hidden = true; };
    document.addEventListener("mouseover", e => { const h = e.target.closest?.(".qhint"); if (h) show(h); });
    document.addEventListener("mouseout", e => { if (e.target.closest?.(".qhint")) hide(); });
    document.addEventListener("focusin", e => { const h = e.target.closest?.(".qhint"); if (h) show(h); });
    document.addEventListener("focusout", hide);
    document.addEventListener("click", e => { const h = e.target.closest?.(".qhint"); if (h) { e.preventDefault(); show(h); } else hide(); });
    window.addEventListener("scroll", hide, true);
  };
  document.body ? initTip() : document.addEventListener("DOMContentLoaded", initTip);
})();
