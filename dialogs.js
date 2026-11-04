// Ventanas de confirmación y de texto centradas en pantalla (reemplazan confirm() y prompt() del navegador).
// Hay que elegir un botón: ni Esc ni hacer clic fuera cierran la ventana.
(function () {
  let dlg;
  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "askdlg";
    dlg.innerHTML = '<form method="dialog" class="askf" novalidate><h3 class="askT"></h3><p class="askM"></p><input class="askI" maxlength="120" autocomplete="off" hidden><div class="askErr" hidden></div><div class="askB"><button type="button" class="askNo"></button><button type="button" class="askYes primary"></button></div></form>';
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", e => { e.preventDefault(); shake(); });            // tecla Esc
    dlg.addEventListener("mousedown", e => { if (e.target === dlg) shake(); });       // clic fuera de la ventana
  }
  function shake() { dlg.classList.remove("shake"); void dlg.offsetWidth; dlg.classList.add("shake"); }
  function open(o) {
    if (!dlg) build();
    return new Promise(resolve => {
      const $ = s => dlg.querySelector(s), inp = $(".askI"), yes = $(".askYes"), no = $(".askNo"), err = $(".askErr");
      $(".askT").textContent = o.title || (o.input ? "Escribe un valor" : "Confirmar");
      $(".askM").textContent = o.msg || "";
      yes.textContent = o.ok || "Aceptar"; no.textContent = o.cancel || "Cancelar";
      yes.classList.toggle("danger", !!o.danger); yes.classList.toggle("primary", !o.danger);
      inp.hidden = !o.input; inp.value = o.def || ""; inp.placeholder = o.placeholder || ""; err.hidden = true;
      const done = v => { yes.onclick = no.onclick = null; inp.onkeydown = null; dlg.close(); resolve(v); };
      yes.onclick = () => { if (!o.input) return done(true); const v = inp.value.trim(); if (!v && !o.optional) { err.textContent = "Escribe un valor para continuar."; err.hidden = false; inp.focus(); return; } done(v); };
      no.onclick = () => done(o.input ? null : false);
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); yes.click(); } };
      dlg.showModal(); (o.input ? inp : yes).focus();
    });
  }
  window.QA_UI = {
    ask: (msg, o = {}) => open({ msg, ...o }),
    askText: (msg, def = "", o = {}) => open({ msg, def, input: true, ...o }),
  };
})();
