# Dashboard QA

App web estática (HTML/JS). Con `config.js` vacío funciona en modo local (datos en el navegador). Con Supabase configurado es multiusuario: login por correo, roles editor/lectura aplicados por la base de datos.

## Probar local
```
npx http-server -p 5173 -c-1 .
```

## Puesta en producción (gratis)

### 1. Supabase (base de datos + login)
1. supabase.com → Sign up → **New project** (nombre `dashboard-qa`, región cercana, guarda la contraseña de BD). Espera ~2 min.
2. **SQL Editor → New query**: abre `supabase.example.sql`, cambia los 3 correos del final por los reales (tú, jefe de analista, líder QA; `editor` o `viewer`) y pulsa **Run**.
3. **Project Settings → API**: copia *Project URL* y la clave *anon public* a `config.js`.
4. Más adelante (paso 3) vuelves a **Authentication → URL Configuration** para poner la URL publicada.

### 2. Publicar la página (GitHub Pages)
1. github.com → New repository (`dashboard-qa`, público).
2. Sube `index.html`, `app.js`, `data.js`, `styles.css`, `config.js` (Add file → Upload files).
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
4. Queda en `https://TU-USUARIO.github.io/dashboard-qa/`.
   (Es seguro que el repositorio sea público: la anon key es pública y los datos los protegen las políticas RLS.)

### 3. Conectar login con la URL
Supabase → **Authentication → URL Configuration**: *Site URL* = `https://TU-USUARIO.github.io/dashboard-qa/` y la misma en *Redirect URLs*.

### 4. Agregar o cambiar personas
Supabase → Table Editor → `profiles` → insertar fila (`email` en minúsculas, `role` = `editor` o `viewer`). Quien no esté en la tabla ve "no tiene acceso" aunque pueda iniciar sesión.

## Notas
- El enlace mágico lo envía Supabase; el correo por defecto tiene límite bajo de envíos por hora. Si lo necesitas, configura un SMTP propio (Authentication → SMTP).
- Dos editores a la vez: gana quien guarda primero; el otro recibe un aviso y se le carga la versión nueva. La pantalla se refresca sola cada 30 s.
- Los datos se guardan como un solo documento JSON (`app_state`). Es simple y suficiente para un equipo pequeño. Usa "Respaldo JSON" periódicamente.

## Planner (solo lectura) y Teams — rama `planner-pruebas`
El dashboard se alimenta de Microsoft Planner; **nunca escribe en Planner**. Cada cliente se activa con sus propios interruptores en la pestaña **Clientes**.

**Cómo se mapea Planner → dashboard**
| Planner | Dashboard |
|---|---|
| Nombre de la tarea (proyecto) | Código + título (si empieza con algo como `R1903 - …` se separa el código; si no, `PL-xxxxx`) |
| Estado (No iniciado / En curso / Completada) | Pendiente / En curso / Completado (solo se importan los **activos**) |
| Prioridad | Urgente / Importante / Media / Baja (columna **Prioridad**) |
| Fecha de inicio / vencimiento | Inicio / Fin (el primer vencimiento queda como **fecha comprometida**) |
| Depósito (bucket) | Columna **Etapa del proyecto**; si coincide con una actividad (p. ej. «Análisis», «Certificación») las anteriores quedan completas |
| Etiqueta («QA Tradicional», «QA Express», un tipo personalizado) | Tipo del requerimiento (define sus actividades) |
| Asignados | Responsables (se buscan por correo/nombre en la pestaña Equipo) |
| Comentarios de la tarea | Seguimiento, con la marca «Planner» |

**Regla de edición:** lo que cambies en el dashboard se conserva. Un campo vuelve a tomar el valor de Planner solo cuando *cambió en Planner* desde la última sincronización.

**Configuración (una sola vez, la hace TI o tú con permisos)**
1. Entra a portal.azure.com → Microsoft Entra ID → Registros de aplicaciones → Nuevo registro (solo este directorio).
2. Plataforma **Aplicación de página única (SPA)** y redirect URIs: la dirección publicada y `http://localhost:5173/`.
3. Permisos de API (Microsoft Graph, delegados): `Tasks.Read`, `Group.Read.All`, `User.ReadBasic.All`. `Group.Read.All` (necesario para leer los comentarios) requiere **consentimiento de administrador**.
4. Copia *Application (client) ID* y *Directory (tenant) ID* a `msalClientId` y `msalTenantId` en `config.js`.
5. En **Clientes**: activa «Conectar con Planner», pulsa «Conectar cuenta», «Buscar mis planes», elige el plan y «Sincronizar ahora». Cada persona que sincronice debe ser miembro del grupo del plan.

**Teams:** en Teams crea un flujo «Cuando se recibe una solicitud de webhook» (Workflows) que publique en el canal; pega su URL en la tarjeta del cliente. Hay mensaje de prueba, resumen manual, aviso al sincronizar y aviso cuando se bloquea una actividad. Limitaciones: sin servidor no hay avisos automáticos diarios, y el navegador no puede confirmar la entrega.

### Avisos automáticos (9:00, 12:00, 15:00 y 18:00)
- Pestaña **Avisos**: horarios (hora de Chile) y días de envío; se editan ahí, sin tocar Supabase.
- Instalación única: Supabase → SQL Editor → pega `supabase-avisos.sql` → Run. Un job (`pg_cron`, cada 5 min) revisa la hora y publica en Teams con `pg_net`, aunque nadie tenga el sitio abierto. Prueba: `select public.qa_avisos(true);`.
- **Canal**: un resumen por cliente con Teams activo (opciones por cliente en Clientes: envío automático, omitir si todo está en orden).
- **Responsable**: mensaje personal con sus pendientes. Requiere un segundo flujo de Power Automate que reciba `to` (correo) y publique la tarjeta en el chat; la URL se pega en Avisos. El correo sale de la pestaña Equipo.
- Los botones «Enviar resumen al canal» y «Avisar a responsables ahora» siguen disponibles para envíos fuera de horario.
- El servidor solo envía a direcciones de Microsoft y usa los datos tal como están (última sincronización de Planner).

## Acceso: cuentas pendientes, recuperación con código y bloqueo
Ejecutar **una vez** en Supabase → SQL Editor: `supabase-acceso.sql` (después de `supabase-admin.sql`).

- **Crear cuenta:** la persona queda *Pendiente* y no ve nada. En **Permisos** aparece primero (con un contador rojo en la pestaña): eliges su permiso para autorizarla, o «Rechazar».
- **Olvidé mi contraseña:** la persona escribe su correo → recibe un código → lo ingresa → crea su nueva contraseña. Cada cambio entre pantallas (Ingresar / Crear cuenta / Olvidé / código) limpia los campos.
- **Bloqueo:** a la 5.ª contraseña incorrecta la cuenta se bloquea (aunque después use la correcta). Solo un administrador la desbloquea en **Permisos → Desbloquear**. Un administrador bloqueado se libera solo a los 15 min (para que nadie pueda dejarte fuera).
- La espera y el bloqueo se aplican en la base de datos (RLS): una cuenta pendiente o bloqueada no puede leer ni escribir datos.
- Límite: el contador cuenta los intentos hechos desde esta página; un ataque directo a la API de Supabase no lo incrementa (Supabase aplica además su propio límite de intentos).

**Plantilla del correo con código (obligatorio para «Olvidé mi contraseña»):** Supabase → Authentication → Email Templates → **Reset Password** → reemplaza el contenido por:
```html
<h2>Código para recuperar tu contraseña</h2>
<p>Tu código de verificación es:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Vence en pocos minutos. Si no lo pediste, ignora este correo.</p>
```

## Seguridad: URLs de Teams solo para administradores y copias automáticas
Ejecutar en Supabase → SQL Editor, **en este orden** (todos se pueden repetir): `supabase-acceso.sql` → `supabase-seguridad.sql` → `supabase-avisos.sql`.

- **URLs de webhook:** `supabase-seguridad.sql` mueve las URLs que hoy están en los datos compartidos a la tabla `notify_secrets` (solo la lee y escribe un administrador) y las borra de ahí. En el sitio, solo un administrador ve el campo para pegar o reemplazar una URL (nunca se muestra la guardada); los editores ven «✓ Guardada por un administrador». Los editores siguen enviando avisos (prueba, resumen, responsables): los publica el servidor (`qa_post`) y la URL no pasa por su navegador.
- **Copias de seguridad:** cada 6 horas se guarda una copia de todos los datos (solo si cambiaron) y se conservan 45 días. En **Permisos → Copias de seguridad** el administrador puede crear una copia manual o restaurar una; antes de restaurar se guarda automáticamente el estado actual.
- **Modo local** (sin Supabase): todo sigue funcionando como antes; las URLs quedan en el navegador.
- Después de ejecutar `supabase-seguridad.sql`, vuelve a ejecutar `supabase-avisos.sql`: ahora lee las URLs de `notify_secrets`.
