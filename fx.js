// Animaciones sutiles de la interfaz, sin librerías (Web Animations API del navegador, ~1 KB).
// Pensado para uso institucional: respeta «reducir movimiento» del sistema operativo (WCAG 2.3.3), dura menos de 0,25 s,
// no usa bucles ni parpadeos y no mueve el foco ni el diseño. Si el navegador no soporta la API, simplemente no anima.
(function () {
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var off = function () { return !!(mq && mq.matches) || document.documentElement.dataset.motion === "off"; };
  var ok = typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
  var ease = "cubic-bezier(.2,.7,.2,1)";

  function enter(el, o) {                                      // aparece con un leve desplazamiento hacia arriba
    if (!ok || off() || !el) return;
    o = o || {};
    el.animate([{ opacity: 0, transform: "translateY(" + (o.y == null ? 8 : o.y) + "px)" }, { opacity: 1, transform: "none" }],
      { duration: o.ms || 180, delay: o.delay || 0, easing: ease, fill: "backwards" });
  }
  function pop(el) {                                           // ventanas modales: aparece con un zoom muy leve
    if (!ok || off() || !el) return;
    el.animate([{ opacity: 0, transform: "scale(.985) translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 170, easing: ease });
  }
  function stagger(els, max) {                                 // filas de una tabla: entran en cascada (solo las primeras)
    if (!ok || off()) return;
    Array.prototype.slice.call(els, 0, max || 12).forEach(function (el, i) { enter(el, { y: 6, ms: 150, delay: i * 18 }); });
  }

  window.QA_FX = { enter: enter, pop: pop, stagger: stagger, enabled: function () { return ok && !off(); } };

  // ventanas modales: se animan al abrirse (atributo open)
  new MutationObserver(function (list) {
    list.forEach(function (m) { if (m.target.tagName === "DIALOG" && m.target.open && m.oldValue === null) pop(m.target); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["open"], attributeOldValue: true, subtree: true });
})();
