-- Archivos adjuntos en los entregables de un requerimiento.
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run (en cada proyecto: producción y pruebas).
-- Requiere haber ejecutado antes supabase.example.sql y supabase-admin.sql (usan public.my_role()).
--
-- Quién puede qué:
--   · Adjuntar y descargar: cualquier usuario autorizado (lector, editor o administrador).
--   · Quitar archivos: solo editores y administradores.
-- Los archivos viven en un almacenamiento PRIVADO (no hay enlaces públicos): se descargan con un enlace temporal de 2 minutos.

-- IMPORTANTE: el límite por archivo del bucket no puede superar el límite global del proyecto. En el plan gratuito el máximo es 50 MB
-- (Supabase → Storage → Settings → «Upload file size limit»). Para subir videos más pesados hace falta el plan Pro o un servidor propio.

-- 1) Almacenamiento privado, máximo 50 MB por archivo
insert into storage.buckets (id, name, public, file_size_limit)
values ('entregables', 'entregables', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- 2) Permisos sobre los archivos
drop policy if exists "entregables leen"   on storage.objects;
drop policy if exists "entregables suben"  on storage.objects;
drop policy if exists "entregables borran" on storage.objects;

create policy "entregables leen"   on storage.objects for select to authenticated
  using (bucket_id = 'entregables' and public.my_role() in ('viewer', 'editor', 'admin'));
create policy "entregables suben"  on storage.objects for insert to authenticated
  with check (bucket_id = 'entregables' and public.my_role() in ('viewer', 'editor', 'admin'));
create policy "entregables borran" on storage.objects for delete to authenticated
  using (bucket_id = 'entregables' and public.my_role() in ('editor', 'admin'));

-- 3) Registrar el archivo en el entregable (también para lectores, que no pueden modificar nada más).
--    Si el entregable aún no existe, lo crea con el nombre indicado. El autor, el correo y la fecha los fija el servidor.
create or replace function public.qa_attach(p_req text, p_deliv text, p_name text, p_due text, p_file jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare st jsonb; ri int; di int; d jsonb; f jsonb; n int; v_pre text := p_req || '/' || p_deliv || '/';
        v_at text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if coalesce(public.my_role(), '') not in ('viewer', 'editor', 'admin') then raise exception 'No tienes permiso para adjuntar archivos'; end if;
  if left(coalesce(p_file->>'path', ''), length(v_pre)) <> v_pre or position('..' in p_file->>'path') > 0 then raise exception 'Ruta de archivo no válida'; end if;
  select data into st from public.app_state where id = 1 for update;
  select (t.ord - 1)::int into ri from jsonb_array_elements(st->'reqs') with ordinality as t(v, ord) where t.v->>'id' = p_req;
  if ri is null then raise exception 'Requerimiento no encontrado'; end if;
  select (t.ord - 1)::int, t.v into di, d from jsonb_array_elements(coalesce(st->'reqs'->ri->'deliverables', '[]'::jsonb)) with ordinality as t(v, ord) where t.v->>'id' = p_deliv;
  if di is null then
    d := jsonb_build_object('id', left(p_deliv, 40), 'name', left(coalesce(nullif(trim(p_name), ''), 'Entregable'), 200),
                            'due', coalesce(left(p_due, 10), ''), 'state', 'pendiente', 'url', '', 'files', '[]'::jsonb);
    st := jsonb_set(st, array['reqs', ri::text, 'deliverables'], coalesce(st->'reqs'->ri->'deliverables', '[]'::jsonb) || jsonb_build_array(d));
    di := jsonb_array_length(st->'reqs'->ri->'deliverables') - 1;
  end if;
  n := coalesce(jsonb_array_length(st->'reqs'->ri->'deliverables'->di->'files'), 0);
  if n >= 20 then raise exception 'Cada entregable admite hasta 20 archivos'; end if;
  f := jsonb_build_object('id', left(coalesce(nullif(p_file->>'id', ''), md5(random()::text)), 40),
        'name', left(coalesce(nullif(trim(p_file->>'name'), ''), 'archivo'), 200),
        'size', coalesce((p_file->>'size')::bigint, 0), 'type', left(coalesce(p_file->>'type', ''), 100),
        'path', p_file->>'path', 'at', v_at,
        'by', left(coalesce(nullif(trim(p_file->>'by'), ''), 'Anónimo'), 80), 'byEmail', lower(coalesce(auth.jwt()->>'email', '')));
  st := jsonb_set(st, array['reqs', ri::text, 'deliverables', di::text, 'files'],
        coalesce(st->'reqs'->ri->'deliverables'->di->'files', '[]'::jsonb) || jsonb_build_array(f));
  st := jsonb_set(st, array['reqs', ri::text, 'lastUpdate'], to_jsonb(v_at));
  update public.app_state set data = st, version = version + 1 where id = 1;
end $$;
revoke all on function public.qa_attach(text, text, text, text, jsonb) from public, anon;
grant execute on function public.qa_attach(text, text, text, text, jsonb) to authenticated;
