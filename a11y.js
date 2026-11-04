// Accesibilidad: da nombre a los controles que se dibujan dinámicamente (tablas, filas) y texto a los encabezados vacíos.
// Se vuelve a aplicar sola cada vez que la pantalla se redibuja.
(function () {
  const txt = el => { const c = el.cloneNode(true); c.querySelectorAll(".qhint, .ferr, small, select, input, button").forEach(x => x.remove()); return c.textContent.replace(/[*!]/g, "").replace(/\s+/g, " ").trim(); };
  function nameFor(el) {
    const td = el.closest("td");
    if (td) {
      const table = td.closest("table"), row = td.parentElement, col = td.cellIndex;
      const th = table && table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[col];
      const head = th ? txt(th) : "";
      const first = row.cells[0] ? txt(row.cells[0]) : "";
      const rowName = first && first.length <= 40 ? first : "fila " + (row.rowIndex);
      const base = head || el.title || el.placeholder || (el.type === "checkbox" ? "Marcar" : "Campo");
      return `${base} · ${rowName}`;
    }
    return el.title || el.placeholder || "";
  }
  function apply() {
    document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea").forEach(el => {
      if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") || el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`))) return;
      const n = nameFor(el); if (n) el.setAttribute("aria-label", n);
    });
    document.querySelectorAll("button").forEach(b => {
      if (b.hasAttribute("aria-label")) return;
      const t = b.textContent.trim();
      if (t === "✕" || t === "×" || t === "x") b.setAttribute("aria-label", b.closest("td") ? "Eliminar fila" : "Cerrar");
      else if (t === "+" ) b.setAttribute("aria-label", "Agregar");
    });
    document.querySelectorAll("th").forEach(th => { if (!th.textContent.trim() && !th.querySelector("input,select,button")) { th.classList.add("th-act"); th.innerHTML = '<span class="sr-only">Acciones</span>'; } });
    document.querySelectorAll('.tablewrap, .gantt, .thread, #backupTbl, #permTbl').forEach(e => { if (!e.hasAttribute('tabindex')) e.tabIndex = 0; });   // regiones con scroll: se pueden recorrer con el teclado
    document.querySelectorAll('.htog[role="button"]').forEach(h => { if (!h.hasAttribute("tabindex")) h.tabIndex = 0; });
  }
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(apply, 80); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", apply);
})();
