-- Corrección: el administrador no veía a los demás usuarios en la pestaña Permisos.
-- Causa: la política «editores ven perfiles» quedó solo para el rol 'editor' (la dejó así supabase-perfil.sql si se ejecutó después de supabase-admin.sql).
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run (en cada proyecto: producción y pruebas).
drop policy if exists "editores ven perfiles" on profiles;
create policy "editores ven perfiles" on profiles for select to authenticated
  using (public.my_role() in ('editor', 'admin'));

-- Para comprobar cómo quedó (debe decir: ... in ('editor','admin')):
--   select policyname, qual from pg_policies where tablename = 'profiles' and policyname = 'editores ven perfiles';
