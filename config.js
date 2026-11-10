// Datos de los proyectos Supabase. La anon key es pública por diseño: la seguridad la hacen las políticas RLS (ver supabase.example.sql).
// Si los dejas vacíos, la app funciona en modo local (datos solo en este navegador).
//
// Hay dos ambientes, cada uno con su propia base de datos y sus propios usuarios:
//   · prod → el sitio publicado (danielcamposb.github.io)
//   · test → pruebas en tu equipo (localhost / 127.0.0.1)
// Se elige solo según la dirección desde la que se abre la página. Para forzar uno: agrega ?env=test o ?env=prod a la URL
// (la elección queda guardada en este navegador; ?env=auto vuelve a la selección automática).
(function () {
  var ENVS = {
    prod: {
      supabaseUrl: "https://ozvjfqiumkbsqsmshcqf.supabase.co",
      supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dmpmcWl1bWtic3FzbXNoY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDExMzIsImV4cCI6MjEwODI3NzEzMn0.NmGo0dM6t1X7ACF07vi3hx7PbqngxW7qUnHdYkCR07c"
    },
    test: {
      supabaseUrl: "https://kuidzbnwloqirautncnn.supabase.co",
      supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1aWR6Ym53bG9xaXJhdXRuY25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTUzMzcsImV4cCI6MjEwOTg3MTMzN30.qoXyaF7cBHxCM_F7aamZBNEuLegL-KWM7mx8KH0MHTc"
    }
  };
  var h = location.hostname, isLocal = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || /\.localhost$/.test(h);
  var env = isLocal ? "test" : "prod";
  try {
    var q = new URLSearchParams(location.search).get("env");
    if (q === "auto") localStorage.removeItem("qa-env");
    else if (q === "test" || q === "prod") localStorage.setItem("qa-env", q);
    var saved = localStorage.getItem("qa-env");
    if (saved === "test" || saved === "prod") env = saved;
  } catch (e) {}

  window.QA_ENV = env;
  window.QA_CONFIG = {
    supabaseUrl: ENVS[env].supabaseUrl,
    supabaseKey: ENVS[env].supabaseKey,

    // Planner (Microsoft Graph, solo lectura). Se llenan al registrar la aplicación en Entra ID (ver README, sección Planner).
    // Archivos adjuntos de los entregables. El máximo por archivo no puede superar el límite de Storage del proyecto Supabase (50 MB en el plan gratuito).
    maxFileMB: 50,
    maxFilesPerDeliverable: 20,

    msalClientId: "",
    msalTenantId: ""
  };

  // Franja visible en cualquier ambiente que no sea producción, para no confundirse de base de datos.
  if (env !== "prod") {
    var bar = function () {
      var b = document.createElement("div");
      b.id = "envBar"; b.setAttribute("role", "status");
      b.textContent = "AMBIENTE DE PRUEBAS · base de datos de test (no es producción)";
      b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#c2410c;color:#fff;text-align:center;font:700 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;padding:5px 10px;pointer-events:none";
      document.body.appendChild(b);
    };
    document.body ? bar() : document.addEventListener("DOMContentLoaded", bar);
  }
})();
