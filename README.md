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
