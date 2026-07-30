-- Activación ONE-SHOT en nom035-production del worker de prueba Auth.
-- UID: 8e457b1b-93e0-4bd0-8181-062ce55531d1
-- Email: prueba@trabajador.com
-- No toca ConCasa. No crea los 83. Idempotente.

begin;

-- 1) Rol worker en Auth (app_metadata; no editable por el usuario en UI normal)
update auth.users
set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'worker'),
    raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('synthetic', true, 'marker', 'WORKER_LOGIN_SMOKE_PROD')
where id = '8e457b1b-93e0-4bd0-8181-062ce55531d1'
  and lower(email) = 'prueba@trabajador.com';

do $$
declare
  v_company_id uuid;
  v_worker_id uuid;
  v_auth uuid := '8e457b1b-93e0-4bd0-8181-062ce55531d1';
begin
  if not exists (
    select 1 from auth.users
    where id = v_auth and lower(email) = 'prueba@trabajador.com'
  ) then
    raise exception 'Auth user no encontrado o email no coincide';
  end if;

  select id into v_company_id from public.company_settings limit 1;
  if v_company_id is null then
    insert into public.company_settings (razon_social, total_trabajadores)
    values ('EMPRESA_PRUEBA_LOGIN_PROD', 1)
    returning id into v_company_id;
  end if;

  select id into v_worker_id
  from public.workers
  where external_reference = 'SYN-PRUEBA-LOGIN'
  limit 1;

  if v_worker_id is null then
    insert into public.workers (
      nombre, puesto, departamento, external_reference, activo
    ) values (
      'Trabajador Prueba Portal',
      'Puesto de Prueba',
      'Departamento de Prueba',
      'SYN-PRUEBA-LOGIN',
      true
    )
    returning id into v_worker_id;
  else
    update public.workers
    set nombre = 'Trabajador Prueba Portal',
        puesto = 'Puesto de Prueba',
        departamento = 'Departamento de Prueba',
        activo = true
    where id = v_worker_id;
  end if;

  insert into public.worker_accounts (
    company_id, worker_id, auth_user_id, username_normalized,
    is_active, must_change_password
  ) values (
    v_company_id, v_worker_id, v_auth, 'prueba.trabajador',
    true, false
  )
  on conflict (worker_id) do update set
    auth_user_id = excluded.auth_user_id,
    username_normalized = excluded.username_normalized,
    is_active = true,
    must_change_password = false,
    updated_at = timezone('utc', now());

  -- Si ya existía otro vínculo por auth_user_id distinto, asegurar unique
  update public.worker_accounts
  set auth_user_id = v_auth,
      username_normalized = 'prueba.trabajador',
      is_active = true,
      must_change_password = false
  where worker_id = v_worker_id;
end;
$$;

commit;

-- Verificación (solo metadatos, sin secretos)
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as role,
  wa.username_normalized,
  wa.is_active,
  w.external_reference,
  w.nombre
from auth.users u
join public.worker_accounts wa on wa.auth_user_id = u.id
join public.workers w on w.id = wa.worker_id
where u.id = '8e457b1b-93e0-4bd0-8181-062ce55531d1';
