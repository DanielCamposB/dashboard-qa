// Desplegables con buscador.
//  · Filtros (Dashboard y tablas): selección MÚLTIPLE. Lo elegido se ve como etiquetas con una «×» para quitar cada opción; la lista tiene un campo «Buscar…».
//  · Selector de Clientes/Departamentos del encabezado: elige una sola opción, también con buscador.
// El <select> original se conserva (oculto en los filtros) como fuente de las opciones y para disparar el evento «change»; QA_MS expone la selección.
// Teclado: ↓ ↑ (o Enter / espacio) abren; en la lista ↓ ↑ mueven, Enter / espacio marcan o desmarcan, Esc cierra. En pantallas táctiles el selector de cliente usa la lista nativa.
(function () {
  var SINGLE = "#clientSel";
  var panel, input, list, none, foot, cnt, clr, cur = null, mode = "single", shown = [], act = -1, uid = 0;
  var norm = function (t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); };
  var coarse = function () { return window.matchMedia && matchMedia("(pointer: coarse)").matches; };
  var opts = function (sel) { return [].slice.call(sel.options).filter(function (o) { return o.value !== ""; }); };   // value "" = «Todos…» (solo texto de reposo)

  // ---------- estado de los filtros múltiples ----------
  function get(sel) { var s = sel._ms || new Set(); return opts(sel).map(function (o) { return o.value; }).filter(function (v) { return s.has(v); }); }
  function fire(sel) { sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); }
  function set(sel, arr, silent) { sel._ms = new Set(arr); paint(sel); if (!silent) fire(sel); }
  function clear(sel, silent) { if (sel._ms && sel._ms.size) set(sel, [], silent); }
  function toggle(sel, v) { var s = sel._ms; s.has(v) ? s.delete(v) : s.add(v); paint(sel); fire(sel); }
  function label(sel, v) { var o = opts(sel).filter(function (x) { return x.value === v; })[0]; return o ? o.textContent : v; }

  function paint(sel) {
    var box = sel._mfx; if (!box) return;
    var vals = get(sel), ph = sel.options[0] ? sel.options[0].textContent : "Todos";
    box.textContent = "";
    if (!vals.length) { var p = document.createElement("span"); p.className = "mfx-ph"; p.textContent = ph; box.append(p); }
    vals.forEach(function (v) {
      var c = document.createElement("span"); c.className = "mfx-chip"; var t = document.createElement("span"); t.className = "mfx-t"; t.textContent = label(sel, v); t.title = t.textContent;
      var x = document.createElement("button"); x.type = "button"; x.className = "mfx-x"; x.textContent = "×"; x.setAttribute("aria-label", "Quitar " + t.textContent); x.dataset.v = v; x.tabIndex = -1;
      c.append(t, x); box.append(c);
    });
    box.classList.toggle("has", vals.length > 0);
    box.setAttribute("aria-label", (sel.getAttribute("aria-label") || ph) + (vals.length ? ": " + vals.map(function (v) { return label(sel, v); }).join(", ") : ": " + ph));
  }
  function enhance(sel) {
    if (sel._mfx || sel.tagName !== "SELECT") return;
    sel._ms = new Set();
    var box = document.createElement("div"); box.className = "mfx"; box.tabIndex = 0; box.setAttribute("role", "combobox"); box.setAttribute("aria-haspopup", "listbox"); box.setAttribute("aria-expanded", "false");
    sel._mfx = box; box._sel = sel; sel.hidden = true; sel.setAttribute("aria-hidden", "true"); sel.tabIndex = -1;
    sel.insertAdjacentElement("afterend", box); paint(sel);
    new MutationObserver(function () { var ok = {}; opts(sel).forEach(function (o) { ok[o.value] = 1; }); sel._ms.forEach(function (v) { if (!ok[v]) sel._ms.delete(v); }); paint(sel); }).observe(sel, { childList: true, subtree: true, characterData: true });
  }
  window.QA_MS = { enhance: enhance, get: get, set: set, clear: clear };

  // ---------- panel ----------
  function build() {
    if (panel) return;
    panel = document.createElement("div"); panel.className = "sxp"; panel.hidden = true;
    input = document.createElement("input"); input.type = "search"; input.className = "sxq"; input.placeholder = "Buscar…"; input.autocomplete = "off"; input.maxLength = 60;
    input.setAttribute("role", "combobox"); input.setAttribute("aria-label", "Buscar en la lista"); input.setAttribute("aria-expanded", "true"); input.setAttribute("aria-controls", "sxl");
    list = document.createElement("div"); list.className = "sxl"; list.id = "sxl"; list.setAttribute("role", "listbox");
    none = document.createElement("div"); none.className = "sxn"; none.textContent = "Sin resultados"; none.hidden = true;
    foot = document.createElement("div"); foot.className = "sxf"; cnt = document.createElement("span"); clr = document.createElement("button"); clr.type = "button"; clr.className = "ghost sxc"; clr.textContent = "Borrar selección"; foot.append(cnt, clr);
    panel.append(input, list, none, foot); document.body.append(panel);
    input.addEventListener("input", function () { render(input.value, true); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); setAct(0); }
      else if (e.key === "End") { e.preventDefault(); setAct(shown.length - 1); }
      else if (e.key === "Enter" || (e.key === " " && mode === "multi" && !input.value)) { e.preventDefault(); if (act >= 0) pick(shown[act]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === "Tab") close(false);
    });
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    list.addEventListener("click", function (e) { var o = e.target.closest(".sxo"); if (o && !o.hasAttribute("aria-disabled")) pick(shown[+o.dataset.i]); });
    list.addEventListener("mousemove", function (e) { var o = e.target.closest(".sxo"); if (o && +o.dataset.i !== act) setAct(+o.dataset.i, true); });
    clr.addEventListener("mousedown", function (e) { e.preventDefault(); });
    clr.addEventListener("click", function () { if (cur) { clear(cur); render(input.value, false); input.focus({ preventScroll: true }); } });
  }
  function render(q, resetAct) {
    var n = norm(q), all = mode === "multi" ? opts(cur) : [].slice.call(cur.options), sel = mode === "multi" ? cur._ms : null;
    shown = all.filter(function (o) { return !n || norm(o.textContent).indexOf(n) >= 0; });
    list.innerHTML = "";
    shown.forEach(function (o, i) {
      var d = document.createElement("div"); d.className = "sxo"; d.id = "sxo" + (++uid); d.dataset.i = i; d.setAttribute("role", "option"); d.textContent = o.textContent;
      d.setAttribute("aria-selected", (mode === "multi" ? sel.has(o.value) : o.selected) ? "true" : "false"); if (o.disabled) d.setAttribute("aria-disabled", "true");
      if (mode === "multi") d.classList.add("chk");
      list.append(d);
    });
    none.hidden = shown.length > 0; foot.hidden = mode !== "multi";
    if (mode === "multi") { var k = get(cur).length; cnt.textContent = k ? k + (k === 1 ? " seleccionada" : " seleccionadas") : "Ninguna seleccionada"; clr.disabled = !k; }
    var first = shown.findIndex(function (o) { return mode === "multi" ? sel.has(o.value) : o.selected; });
    setAct(resetAct ? (n ? 0 : Math.max(first, 0)) : Math.max(act, first, 0));
    if (!shown.length) { act = -1; input.removeAttribute("aria-activedescendant"); }
    place();
  }
  function setAct(i, noScroll) {
    if (!shown.length) return; act = Math.max(0, Math.min(shown.length - 1, i));
    [].forEach.call(list.children, function (c, k) { c.classList.toggle("act", k === act); });
    var el = list.children[act]; if (el) { input.setAttribute("aria-activedescendant", el.id); if (!noScroll) el.scrollIntoView({ block: "nearest" }); }
  }
  function move(d) { var i = act; do { i += d; } while (i >= 0 && i < shown.length && shown[i].disabled); if (i >= 0 && i < shown.length) setAct(i); }
  function anchorEl() { return cur && (mode === "multi" ? cur._mfx : cur); }
  function place() {
    var a = anchorEl(); if (!a || panel.hidden) return;
    var r = a.getBoundingClientRect(), w = Math.min(Math.max(r.width, 280), innerWidth - 16);
    panel.style.width = w + "px"; panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    list.style.maxHeight = "260px";
    var h = panel.offsetHeight, below = innerHeight - r.bottom - 12, above = r.top - 12, extra = h - list.offsetHeight;
    if (h > below && above > below) { list.style.maxHeight = Math.max(120, Math.min(260, above - extra - 8)) + "px"; panel.style.top = "auto"; panel.style.bottom = (innerHeight - r.top + 4) + "px"; }
    else { list.style.maxHeight = Math.max(120, Math.min(260, below - extra - 8)) + "px"; panel.style.bottom = "auto"; panel.style.top = (r.bottom + 4) + "px"; }
  }
  function open(sel, m) {
    build(); if (cur && cur !== sel) close(false);
    cur = sel; mode = m; input.value = ""; panel.hidden = false; act = -1;
    (m === "multi" ? sel._mfx : sel).setAttribute("aria-expanded", "true");
    render("", false); input.focus({ preventScroll: true });
  }
  function close(back) {
    if (!panel || panel.hidden) return; panel.hidden = true;
    var s = cur, m = mode; cur = null;
    if (s) { var a = m === "multi" ? s._mfx : s; a.setAttribute("aria-expanded", "false"); if (m !== "multi") s.removeAttribute("aria-expanded"); if (back) a.focus({ preventScroll: true }); }
  }
  function pick(o) {
    if (!o || !cur) return;
    if (mode === "multi") { toggle(cur, o.value); render(input.value, false); return; }      // la lista sigue abierta para marcar más opciones
    var s = cur, changed = s.value !== o.value; close(true);
    if (changed) { s.value = o.value; fire(s); }
  }

  // ---------- eventos globales ----------
  var single = function (e) { var t = e.target && e.target.closest ? e.target.closest(SINGLE) : null; return t && t.tagName === "SELECT" && !t.disabled ? t : null; };
  var multi = function (e) { var t = e.target && e.target.closest ? e.target.closest(".mfx") : null; return t && t._sel ? t : null; };
  document.addEventListener("mousedown", function (e) {
    var x = e.target.closest && e.target.closest(".mfx-x");
    if (x && multi(e)) { e.preventDefault(); e.stopPropagation(); var box = multi(e); toggle(box._sel, x.dataset.v); if (cur === box._sel) render(input.value, false); return; }   // «×»: quita esa opción
    var m = multi(e);
    if (m && e.button === 0) { e.preventDefault(); m.focus({ preventScroll: true }); if (cur === m._sel) close(true); else open(m._sel, "multi"); return; }
    var s = single(e);
    if (s && !coarse() && e.button === 0) { e.preventDefault(); s.focus({ preventScroll: true }); if (cur === s) close(true); else open(s, "single"); return; }
    if (panel && !panel.hidden && !panel.contains(e.target)) close(false);                       // clic fuera: se cierra
  }, true);
  document.addEventListener("click", function (e) { var s = single(e); if (s && !coarse()) e.preventDefault(); }, true);
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var m = multi(e);
    if (m && e.target === m) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(m._sel, "multi"); }
      else if (e.key === "Backspace" || e.key === "Delete") { var v = get(m._sel); if (v.length) { e.preventDefault(); toggle(m._sel, v[v.length - 1]); } }   // quita la última etiqueta
      return;
    }
    var s = single(e); if (!s || coarse()) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(s, "single"); }
  }, true);
  window.addEventListener("resize", function () { close(false); });
  document.addEventListener("scroll", function (e) { if (panel && !panel.hidden && !panel.contains(e.target)) place(); }, true);
  window.addEventListener("blur", function () { close(false); });

  // filtros del Dashboard (los de las tablas los registra app.js al crearlos)
  ["fType", "fRole", "fAssignee", "fPrio", "fBucket", "fStatus"].forEach(function (id) { var s = document.getElementById(id); if (s) enhance(s); });
})();
