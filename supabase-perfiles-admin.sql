-- Corrección de permisos del administrador (ejecutar UNA vez en cada proyecto: producción y pruebas; se puede repetir).
-- Supabase → SQL Editor → New query → Run.
--
-- Qué arregla:
--  1) El administrador solo veía su propia cuenta en la pestaña Permisos.
--     Causa: la política «editores ven perfiles» quedó solo para el rol 'editor'.
--  2) El administrador veía las cuentas pero al cambiar un permiso salía «No tienes permiso de administrador para hacer esto».
--     Causa: supabase-perfil.sql hace «revoke update on profiles» y, si se ejecuta DESPUÉS de supabase-admin.sql, quita el permiso
--     de actualizar la columna «role». (El orden correcto es perfil → admin; esta corrección sirve si se ejecutaron al revés.)

-- 1) Los editores y los administradores ven todos los perfiles
drop policy if exists "editores ven perfiles" on profiles;
create policy "editores ven perfiles" on profiles for select to authenticated
  using (public.my_role() in ('editor', 'admin'));

-- 2) Devolver al administrador la posibilidad de cambiar permisos
grant update (role) on profiles to authenticated;

drop policy if exists "admin cambia" on profiles;
create policy "admin cambia" on profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 3) Seguro: aunque la columna sea actualizable, solo un administrador puede cambiar un rol (ni siquiera el propio)
create or replace function public.guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  if new.email is distinct from old.email then
    raise exception 'No se puede cambiar el correo';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_role on profiles;
create trigger trg_guard_role before update on profiles for each row execute function public.guard_role();

-- Para comprobar (debe aparecer «authenticated» con UPDATE sobre la columna role):
--   select grantee, privilege_type, column_name from information_schema.column_privileges
--   where table_name = 'profiles' and column_name = 'role' and privilege_type = 'UPDATE';
