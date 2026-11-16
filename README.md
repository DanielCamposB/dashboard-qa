# Dashboard QA

Sistema web para que un equipo de pruebas de software (QA) siga sus **requerimientos**, **actividades**, **entregables** y **avance**, con alertas de atraso, carta Gantt, informes y avisos a Microsoft Teams. Es una aplicación estática (HTML + JavaScript, sin proceso de compilación) que guarda sus datos en **Supabase** (base de datos y acceso de usuarios).

- Sitio publicado: `https://danielcamposb.github.io/dashboard-qa/` (rama `main`).
- Documentación para usuarios y pruebas: carpeta [`docs/`](docs/) (manual de usuario en Word y PDF, plan de pruebas).

## Contenido

1. [Funcionalidades](#1-funcionalidades)
2. [Perfiles y permisos](#2-perfiles-y-permisos)
3. [Arquitectura y archivos](#3-arquitectura-y-archivos)
4. [Modos de funcionamiento y ambientes](#4-modos-de-funcionamiento-y-ambientes)
5. [Instalación paso a paso](#5-instalación-paso-a-paso)
6. [Configuración (`config.js`)](#6-configuración-configjs)
7. [Reglas de negocio](#7-reglas-de-negocio)
8. [Entregables y archivos adjuntos](#8-entregables-y-archivos-adjuntos)
9. [Importar y exportar](#9-importar-y-exportar)
10. [Integraciones: Teams y Planner](#10-integraciones-teams-y-planner)
11. [Seguridad](#11-seguridad)
12. [Acceso de usuarios y correos](#12-acceso-de-usuarios-y-correos)
13. [Montar el sistema en un servidor propio](#13-montar-el-sistema-en-un-servidor-propio)
14. [Desarrollo, pruebas y publicación](#14-desarrollo-pruebas-y-publicación)
15. [Solución de problemas](#15-solución-de-problemas)
16. [Límites conocidos](#16-límites-conocidos)

---

## 1. Funcionalidades

La barra superior tiene estas pestañas. Algunas solo las ve el administrador (ver [permisos](#2-perfiles-y-permisos)).

| Pestaña | Para qué sirve |
|---|---|
| **Dashboard** | Indicadores (KPI), alertas de atraso, filtros combinables y la tabla de requerimientos. Desde aquí se crea, abre, edita y exporta a CSV. |
| **Hoy** | Seguimiento diario: actividades atrasadas, que vencen hoy, bloqueadas, en ejecución y por vencer en 3 días, más los requerimientos sin actualizar. Permite registrar el avance sin abrir cada requerimiento. |
| **Resumen** | Resumen ejecutivo con semáforo (verde, amarillo, rojo) por cliente o departamento y la lista de requerimientos que necesitan atención. |
| **Carta Gantt** | Barras por requerimiento y por actividad, con zoom por día, semana o mes, detalle al pasar el mouse y exportación a Excel y PDF. |
| **Equipo** | Integrantes del equipo QA (nombre, correo de Teams, roles) y los roles disponibles. Muestra los perfiles de usuarios a editores y administradores. |
| **Responsables de requerimiento** | Líderes técnicos, jefaturas, coordinadores y otros; se asignan a cada requerimiento. |
| **Clientes/Departamentos** | Alta y baja de clientes o departamentos y su conexión con Planner. El nombre de la sección es editable. *(Solo administrador.)* |
| **Avisos** | Avisos automáticos y manuales a Teams. *(Solo administrador.)* |
| **Permisos** | Altas, autorizaciones, bloqueos y copias de seguridad. *(Solo administrador.)* |
| **Plantilla de actividades** | Plantillas de actividades por tipo de requerimiento (Tradicional, Express y tipos propios). *(Solo administrador.)* |

Otras funciones transversales:

- **Ficha del requerimiento** (ventana a pantalla completa): datos, responsables QA y de requerimiento, actividades, entregables con archivos adjuntos, métricas técnicas, comentarios y historial de cambios de plazo.
- **Filtros con buscador** en listas largas, selección múltiple con etiquetas «×» y botón **Borrar filtros** (solo activo si hay algún filtro). Equipo, Responsables y Clientes reinician sus filtros al cambiar de pestaña.
- **Importar** requerimientos desde Excel o CSV y **exportar** a CSV, Excel (Gantt), PDF (Gantt) y Word (resumen de actividades).
- **Mi perfil**: datos personales y cambio de contraseña.
- **16 temas de color**, selector de cliente o departamento y avisos de ayuda («!») en cada columna y campo.
- Accesibilidad: foco visible, etiquetas ARIA, navegación con teclado y animaciones que respetan la preferencia «reducir movimiento».

## 2. Perfiles y permisos

Hay tres perfiles. Los permisos se aplican en la **base de datos** (políticas RLS de Supabase), no solo en la pantalla.

| Acción | Administrador | Editor | Solo lectura |
|---|:-:|:-:|:-:|
| Ver Dashboard, Hoy, Resumen, Gantt, Equipo y Responsables | Sí | Sí | Sí |
| Comentar y editar sus propios comentarios | Sí | Sí | Sí |
| Adjuntar y descargar archivos en entregables | Sí | Sí | Sí |
| Exportar CSV, Gantt (Excel/PDF) y resumen Word | Sí | Sí | Sí |
| Crear, editar y eliminar requerimientos | Sí | Sí | No |
| Crear y eliminar actividades y entregables | Sí | Sí | No |
| Registrar avance en **Hoy** | Sí | Sí | No |
| Importar desde Excel o CSV | Sí | Sí | No |
| Quitar archivos adjuntos | Sí | Sí | No |
| Agregar integrantes y responsables de requerimiento | Sí | Sí | No |
| Editar o eliminar integrantes y responsables | Sí | No | No |
| Ver perfiles de usuarios (en Equipo) | Sí | Sí | No |
| Clientes/Departamentos, Avisos y Plantillas | Sí | No | No |
| Permisos: autorizar, cambiar rol, desbloquear, quitar acceso | Sí | No | No |
| Copias de seguridad: crear y restaurar | Sí | No | No |
| Guardar URL de los canales de Teams | Sí | No | No |

Una cuenta **pendiente** (recién creada) o **bloqueada** no ve ni escribe datos.

## 3. Arquitectura y archivos

```
Navegador (HTML + JS)  ──►  Supabase (PostgreSQL + Auth + Storage)  ──►  Teams (webhooks de Power Automate)
        │
        └──►  Microsoft Graph (Planner, solo lectura)  — pendiente de activar
```

| Archivo | Descripción |
|---|---|
| `index.html` | Estructura de todas las pantallas y ventanas. |
| `app.js` | Lógica principal: vistas, reglas de negocio, ficha del requerimiento, Gantt, importación y exportación. |
| `data.js` | Capa de datos: Supabase o modo local, login, perfiles, permisos, archivos adjuntos. |
| `config.js` | Conexión a Supabase por ambiente y opciones de adjuntos. **Es el archivo que se edita al cambiar de servidor.** |
| `planner.js` | Integración con Planner (Microsoft Graph) y pestaña **Avisos** (Teams). |
| `report.js` | Informe Word «Resumen de actividades» (librería `docx`). |
| `selectsearch.js` | Listas desplegables con buscador y selección múltiple. |
| `dialogs.js` | Ventanas de confirmación Sí/No y de texto. |
| `fx.js` | Animaciones de entrada (respetan «reducir movimiento»). |
| `tips.js` | Avisos de ayuda «!» de columnas y campos. |
| `a11y.js` | Mejoras de accesibilidad. |
| `styles.css` | Estilos y temas. |
| `supabase*.sql` | Scripts de la base de datos (ver [orden de instalación](#scripts-sql-y-su-orden)). |
| `docs/` | Manual de usuario (Word y PDF) y plan de pruebas. |

Los datos de los requerimientos se guardan como **un solo documento JSON** (tabla `app_state`, con control de versión). Las personas con permiso de edición se sincronizan cada 30 segundos; si dos editores guardan a la vez, gana quien guarda primero y el otro recibe un aviso con la versión nueva. Los archivos adjuntos viven aparte, en un almacenamiento privado (Storage).

## 4. Modos de funcionamiento y ambientes

**Modo local.** Si `supabaseUrl` y `supabaseKey` están vacíos, el sistema no pide login y guarda todo en el navegador. Aparece el selector **Modo** (Editor o Solo lectura). Sirve para probar y capacitar.

**Modo en línea (Supabase).** Login con correo y contraseña, varios usuarios y permisos por perfil. El selector **Modo** se oculta: el perfil lo define el administrador.

**Ambientes.** `config.js` define dos proyectos de Supabase y elige uno solo según la dirección desde la que se abre la página:

| Ambiente | Cuándo se usa | Señal visible |
|---|---|---|
| `prod` | Sitio publicado (cualquier dirección distinta de localhost) | Ninguna |
| `test` | `localhost`, `127.0.0.1` y `*.localhost` | Franja naranja «AMBIENTE DE PRUEBAS» |

Para forzar uno: agrega `?env=test` o `?env=prod` a la dirección (se recuerda en ese navegador); `?env=auto` vuelve a la selección automática.

## 5. Instalación paso a paso

### 5.1 Crear el proyecto en Supabase
1. En supabase.com: **New project** (región cercana; guarda la contraseña de la base). Espera unos minutos.
2. **Project Settings → API**: copia *Project URL* y la clave `anon public` (formato `eyJ…`, la antigua de tipo JWT) a `config.js`.
3. **No uses nunca** la clave `service_role` ni una clave «secret» en el sitio: da acceso total a la base.

### 5.2 Scripts SQL y su orden
Ejecuta en **SQL Editor → New query → Run**. Todos se pueden repetir sin problema.

| Orden | Archivo | Qué hace |
|:-:|---|---|
| 1 | `supabase.example.sql` | Tablas `profiles` y `app_state`, función `my_role()`, políticas base. Cambia los correos del final por los reales. |
| 2 | `supabase-perfil.sql` | Datos de perfil (nombres, cargo, cumpleaños, teléfono) que cada usuario edita solo en su propia fila. |
| 3 | `supabase-admin.sql` | Rol administrador y gestión de accesos. Al final, pon tu correo como `admin`. |
| 4 | `supabase-acceso.sql` | Cuentas pendientes, bloqueo a los 5 intentos y recuperación de contraseña. |
| 5 | `supabase-seguridad.sql` | URLs de Teams solo para administradores y copias de seguridad automáticas. |
| 6 | `supabase-comentarios.sql` | Permite comentar (y editar el propio comentario) a quien es de solo lectura. |
| 7 | `supabase-entregables.sql` | Almacenamiento privado de archivos adjuntos y la función que los registra. |
| 8 | `supabase-avisos.sql` | Avisos automáticos a Teams. Requiere las extensiones `pg_cron` y `pg_net`. Opcional. |
| — | `supabase-perfiles-admin.sql` | Corrección: que el administrador vea todos los perfiles en **Permisos**. Solo si esa lista muestra una cuenta. |

> Si ejecutas `supabase-seguridad.sql` después de `supabase-avisos.sql`, vuelve a ejecutar `supabase-avisos.sql`: ahora lee las URLs de la tabla protegida.

### 5.3 Publicar el sitio (GitHub Pages)
1. Sube todos los archivos del proyecto a un repositorio de GitHub (puede ser público: la clave `anon` es pública por diseño y los datos los protegen las políticas RLS).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Queda en `https://TU-USUARIO.github.io/dashboard-qa/`.
4. En Supabase → **Authentication → URL Configuration**: *Site URL* y *Redirect URLs* con esa dirección.

### 5.4 Primer ingreso
Crea la cuenta del administrador desde la pantalla de login, confirma el correo y entra. Si no ve la pestaña **Permisos**, revisa que su correo esté con rol `admin` en la tabla `profiles`.

## 6. Configuración (`config.js`)

| Parámetro | Descripción |
|---|---|
| `ENVS.prod.supabaseUrl` / `supabaseKey` | Proyecto de producción. |
| `ENVS.test.supabaseUrl` / `supabaseKey` | Proyecto de pruebas (se usa en localhost). |
| `maxFileMB` | Tamaño máximo por archivo adjunto. Por defecto 50. No puede superar el límite de Storage del proyecto (50 MB en el plan gratuito de Supabase). |
| `maxFilesPerDeliverable` | Archivos por entregable. Por defecto 20. |
| `msalClientId`, `msalTenantId` | Datos de la aplicación de Entra ID para Planner. Vacíos: Planner desactivado. |

La regla `isLocal` decide el ambiente por el nombre del servidor; si montas el sistema con otro nombre (por ejemplo `qa.sonda.local`), ajústala ahí.

## 7. Reglas de negocio

- **Código** del requerimiento: 1 letra y hasta 8 números, sin símbolos (ej. `R1903`). **Título**: letras, números, espacios y `( ) # $ /  -`. **Etapa del proyecto**: solo letras y espacios.
- **Tipos** = plantillas de actividades. Vienen *Tradicional* (carta Gantt completa) y *Express* (4 actividades); el administrador crea más. Al crear un requerimiento se copian las actividades de su plantilla; cambiarla después no altera los ya creados.
- **Estados**: Pendiente, En curso, Bloqueado y Completado. Se ajustan solos según las actividades (100 % → Completado; alguna bloqueada → Bloqueado; avance mayor a 0 → En curso) salvo que se elija el estado a mano.
- **Avance del requerimiento**: promedio de sus actividades ponderado por su duración. Cada actividad avanza de 5 en 5 %.
- **Fechas**: el inicio y el fin de actividades son opcionales (si faltan, se completan con la actividad anterior); el requerimiento toma desde la primera hasta la última. Formato en pantalla `dd-mm-aaaa`; años de 4 dígitos.
- **Fecha comprometida**: queda fijada al crear. Si el plazo cambia, el sistema pide un **motivo** y lo guarda en el historial.
- **Atraso**: 1 día, 2 a 4, 5 a 6, 1 semana y 2 o más semanas (alertas por nivel).
- **Sin actualizar**: sin cambios ni comentarios por 2 o más días hábiles.
- **Semáforo** del requerimiento:
  - *Rojo*: atraso de 3 o más días, bloqueado hace 3 o más días, entregable vencido hace 3 o más días o plazo +5 días respecto al compromiso.
  - *Amarillo*: atraso de 1 a 2 días, bloqueado, entregable vencido, plazo +1 a +4 días o sin actualizar.
  - *Verde*: sin problemas. Los completados no se evalúan.
- **Actividad terminada** (100 %): se desbloquea sola. **Bloquear** exige un motivo.
- **Contraseñas**: mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.
- **Eliminar** una actividad, un entregable, un archivo o un requerimiento pide confirmar con **Sí / No**.

## 8. Entregables y archivos adjuntos

Cada requerimiento tiene entregables (nombre, fecha de vencimiento, estado Pendiente / Entregado / Validado y enlace a SharePoint o DevOps).

- **Adjuntar** (botón 📎): lo pueden hacer todos los perfiles. Se pueden elegir varios archivos a la vez (fotos, videos, `.zip`, documentos…).
- **Límites**: hasta 20 archivos por entregable y 50 MB por archivo (configurable en `config.js` y en `supabase-entregables.sql`). No se aceptan ejecutables ni scripts (`.exe`, `.bat`, `.cmd`, `.js`, `.ps1`, etc.).
- Cada archivo se ve como una etiqueta con icono y nombre; al pasar el mouse muestra tamaño, fecha, autor y correo; con un clic se descarga.
- **Quitar** un archivo, y crear o eliminar actividades y entregables, solo lo hacen administradores y editores.
- El requerimiento debe estar guardado antes de adjuntar.
- Almacenamiento: en Supabase, bucket privado `entregables` con enlaces de descarga temporales (2 minutos). En modo local, en el navegador.
- Para evidencias muy pesadas (videos largos) conviene subirlas a SharePoint y pegar el enlace en el entregable.

## 9. Importar y exportar

| Acción | Dónde | Formato |
|---|---|---|
| Importar requerimientos | Botón superior | Excel (`.xlsx`) o CSV (UTF-8 o Windows-1252, coma o punto y coma). Columnas: Código, Título, Cliente, Tipo, Responsable, Inicio, Fin, Estado, Avance. Hay una plantilla CSV descargable. |
| Exportar la tabla | Dashboard → Exportar CSV | CSV con los requerimientos filtrados. |
| Exportar la carta Gantt | Carta Gantt | Excel y PDF; se elige qué requerimientos incluir y el detalle de las columnas (día, semana o mes). |
| Resumen de actividades | Botón superior | Word: resumen ejecutivo, vista general y detalle por requerimiento (actividades, entregables con indicación de adjunto Sí/No, métricas y comentarios). |

## 10. Integraciones: Teams y Planner

### Teams (avisos)
Los avisos se publican en Teams mediante **flujos de Power Automate** con el desencadenador «Cuando se recibe una solicitud de webhook de Teams».

- **Resumen al canal** (uno por cliente o departamento): atrasados, bloqueados, sin actualizar y entregables vencidos; opcionalmente la lista completa y la carga por responsable.
- **Mensaje personal** a cada responsable (su chat privado) con sus actividades atrasadas, bloqueadas o por vencer. Usa un segundo flujo (una URL para todos) y el correo de cada persona sale de **Equipo → Correo de Teams**.
- **Avisos inmediatos**: al bloquear una actividad y al sincronizar Planner.
- **Programación**: horarios (por defecto 9, 12, 15 y 18 h, hora de Chile) y días de la semana, editables en la pestaña **Avisos**. El envío automático corre en el servidor (`pg_cron` + `pg_net`), aunque nadie tenga el sitio abierto. Botones de prueba y de envío manual.
- **Seguridad**: las URL de los webhooks las guarda solo un administrador, en una tabla protegida; no se muestran de nuevo. Solo se aceptan direcciones de Microsoft.
- **Instalación**: ejecutar `supabase-avisos.sql` y crear los flujos (la pestaña **Avisos** trae el paso a paso).

### Planner (pendiente de activar)
El código de la integración existe (`planner.js`) pero **está desactivado**: falta registrar la aplicación en Microsoft Entra ID y completar `msalClientId` y `msalTenantId` en `config.js`. Es de **solo lectura**: el dashboard se alimenta de Planner y nunca escribe en él.

| Planner | Dashboard |
|---|---|
| Nombre de la tarea | Código + título (si empieza como `R1903 - …`; si no, `PL-xxxxx`) |
| Estado (No iniciado / En curso / Completada) | Pendiente / En curso / Completado (solo tareas activas) |
| Prioridad | Urgente / Importante / Media / Baja |
| Fecha de inicio y de vencimiento | Inicio y Fin (el primer vencimiento queda como fecha comprometida) |
| Depósito (bucket) | Etapa del proyecto |
| Etiqueta («QA Tradicional», «QA Express», tipo propio) | Tipo del requerimiento |
| Asignados | Responsables (se buscan por correo o nombre en Equipo) |
| Comentarios | Seguimiento, con la marca «Planner» |

Regla de edición: lo que cambies en el dashboard se conserva; un campo vuelve a tomar el valor de Planner solo si cambió en Planner desde la última sincronización.

**Para activarlo** (lo hace TI o quien tenga permisos): registrar una aplicación de página única (SPA) en Entra ID con las direcciones del sitio como *redirect URI*; permisos delegados de Microsoft Graph `Tasks.Read`, `Group.Read.All` y `User.ReadBasic.All` (el segundo requiere **consentimiento de administrador**); copiar los dos identificadores a `config.js`; y luego, en **Clientes/Departamentos**, activar «Conectar con Planner», conectar la cuenta, elegir el plan y sincronizar. Cada persona que sincronice debe ser miembro del grupo del plan.

## 11. Seguridad

- **RLS** (seguridad por filas) en todas las tablas: cada consulta se evalúa con el rol del usuario en la base de datos.
- **Clave `anon`** pública por diseño; **nunca** publicar `service_role`.
- **Cuentas nuevas** quedan *Pendientes* hasta que un administrador las autoriza y elige su permiso.
- **Bloqueo** tras 5 contraseñas incorrectas; solo un administrador desbloquea (un administrador bloqueado se libera solo a los 15 minutos).
- **Contraseñas** con requisitos de complejidad; cambio pidiendo la contraseña actual; recuperación por código enviado al correo.
- **Webhooks de Teams** en tabla protegida (`notify_secrets`), solo administradores.
- **Archivos adjuntos** en almacenamiento privado, sin enlaces públicos; subir lo permiten los perfiles autorizados y borrar solo editores y administradores; se rechazan ejecutables.
- **Copias de seguridad**: cada 6 horas (solo si hubo cambios), conservadas 45 días; el administrador las restaura desde **Permisos** (antes de restaurar se guarda el estado actual).
- **Sesión**: la página no guarda contraseñas; las sesiones las gestiona Supabase Auth.

## 12. Acceso de usuarios y correos

- **Crear cuenta** → la persona queda *Pendiente*. Si el proyecto exige confirmar el correo, el perfil pendiente se crea **al ingresar por primera vez después de confirmar**: si el correo de confirmación no llega, la persona no aparecerá en **Permisos**.
- **Olvidé mi contraseña**: se envía un **código** al correo. Hay que reemplazar la plantilla «Reset Password» de Supabase (Authentication → Emails → Templates) por:

```html
<h2>Código para recuperar tu contraseña</h2>
<p>Tu código de verificación es:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Vence en pocos minutos. Si no lo pediste, ignora este correo.</p>
```

- **Importante**: Supabase solo permite editar las plantillas si el proyecto usa un **servidor de correo propio (SMTP)** (Authentication → Emails → SMTP Settings). Con el correo por defecto de Supabase los envíos son pocos por hora y llega la plantilla estándar con enlace en lugar del código. Para producción configura SMTP.
- **Administrador bloqueado**: espera 15 minutos o ejecuta en SQL: `update profiles set locked = false, fails = 0, locked_at = null where email = 'correo@dominio.cl';`
- **Restablecer una contraseña por SQL** (emergencia): `update auth.users set encrypted_password = crypt('ClaveTemporal', gen_salt('bf')) where email = 'correo@dominio.cl';` y cambiarla al ingresar.
- Se recomienda tener **al menos dos administradores**.

## 13. Montar el sistema en un servidor propio

La aplicación es estática; solo necesita un servidor web y una API de Supabase.

1. **Base de datos**: la aplicación habla con la API de Supabase, no directamente con PostgreSQL. En un servidor propio se instala **Supabase autoalojado** (Docker). Si solo se dispone de PostgreSQL, habría que desarrollar una API equivalente (cambio mayor).
2. **Archivos**: copiar el contenido del proyecto a cualquier servidor web (IIS, Nginx, Apache…).
3. **Conexión**: editar `config.js` (URL del servidor y clave `anon` generada para ese servidor) y ajustar `isLocal` si el nombre del servidor cambia el ambiente.
4. **Base**: ejecutar los scripts SQL en el orden de la [sección 5.2](#52-scripts-sql-y-su-orden).
5. **Dependencias externas**: hoy se cargan desde internet `supabase-js` y `msal-browser` (cdn.jsdelivr.net), las tipografías (Google Fonts) y, bajo demanda, `docx` (jsdelivr) y `xlsx` (cdnjs). En una red sin internet hay que descargarlas a una carpeta local y cambiar las rutas en `index.html`, `report.js` y `app.js`.
6. **Correo**: configurar SMTP institucional en la autenticación.
7. **Archivos adjuntos**: el límite por archivo lo define el servidor; ajustar `maxFileMB` y `file_size_limit` del bucket.

## 14. Desarrollo, pruebas y publicación

- **Probar en el equipo**: `npx http-server -p 5173 -c-1 .` (o cualquier servidor estático) y abrir `http://localhost:5173/`. Usa el ambiente `test`. Con `config.js` vacío se usa el modo local.
- **Flujo de ramas**: se desarrolla y valida en `QA`; cuando está aprobado, `main` avanza a ese mismo punto (GitHub Pages publica `main`). Antes de fusionar a `main`, validar en QA con el [plan de pruebas](docs/Plan-de-pruebas-Dashboard-QA.xlsx).
- **Cómo validar lo que se fusiona a QA**: revisar los cambios (diff), ejecutar los casos del plan de pruebas que corresponden a los módulos tocados, probar con cuentas de los tres perfiles y confirmar que en localhost aparece la franja «AMBIENTE DE PRUEBAS».
- **Contribuir**: no usar nunca claves `service_role`; no versionar datos reales; mantener los textos en español.

## 15. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El administrador ve solo su cuenta en **Permisos** | La política «editores ven perfiles» solo incluye el rol `editor` | Ejecutar `supabase-perfiles-admin.sql` |
| Una cuenta nueva no aparece como pendiente | El correo no se confirmó (el perfil pendiente se crea al primer ingreso) | Confirmar el correo, o en SQL: `update auth.users set email_confirmed_at = now() where email = '…';` |
| «Olvidé mi contraseña» envía un enlace y no un código | El proyecto no tiene SMTP propio y no se pudo editar la plantilla | Configurar SMTP y editar la plantilla «Reset Password» |
| Al adjuntar sale «Falta ejecutar supabase-entregables.sql» | Falta el script de adjuntos | Ejecutarlo en Supabase |
| No se puede subir un archivo grande | Supera `maxFileMB` o el límite de Storage del proyecto | Comprimir, subir a SharePoint y pegar el enlace, o aumentar el límite del proyecto |
| «Otra persona guardó cambios antes que tú» | Edición simultánea | Se carga la versión nueva; repetir el cambio |
| Los avisos de Teams no salen | Falta la URL del canal, el flujo o `supabase-avisos.sql` | Revisar la pestaña **Avisos** y probar con el botón «Prueba» |
| Aparece la franja naranja «AMBIENTE DE PRUEBAS» | Se abrió en localhost o con `?env=test` | Usar la dirección publicada, o `?env=auto` |

## 16. Límites conocidos

- Los datos de requerimientos son un único documento JSON: adecuado para un equipo pequeño o mediano; con muchos editores simultáneos conviene normalizar en tablas.
- El envío automático de avisos usa los datos tal como están guardados; Planner solo se lee cuando alguien sincroniza.
- El contador de intentos fallidos cuenta los hechos desde esta página; un ataque directo a la API no lo incrementa (Supabase aplica además su propio límite).
- El plan gratuito de Supabase limita el almacenamiento total (1 GB), el tamaño por archivo (50 MB) y el envío de correos.
- La conexión con Planner está pendiente de activación (ver sección 10).
