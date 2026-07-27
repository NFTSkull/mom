-- =============================================================================
-- B4.6 · pgTAP · Auth / RBAC / MFA (005_auth_rbac_mfa)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- ============================ ESTRUCTURA ====================================
select has_type('public', 'app_permission', 'app_permission existe');
select has_table('public', 'role_permissions', 'role_permissions existe');
select has_column('public', 'admin_profiles', 'mfa_required', 'mfa_required');
select has_column('public', 'admin_profiles', 'must_change_password', 'must_change_password');
select has_column('public', 'admin_profiles', 'last_login_at', 'last_login_at');
select has_column('public', 'admin_profiles', 'deactivated_at', 'deactivated_at');
select has_column('public', 'admin_profiles', 'version', 'version');

select is(
  (select count(*)::text from public.role_permissions),
  '73',
  'matriz role_permissions completa (73)');

select is(
  (select count(*)::text from public.role_permissions where role = 'admin'),
  '31',
  'admin tiene 31 permisos');

select throws_ok(
  $$insert into public.role_permissions(role, permission) values ('admin', 'dashboard.view')$$,
  '23505',
  NULL,
  'permisos duplicados rechazados');

-- ============================ USUARIOS AUTH SINTÉTICOS ======================
create temporary table _t_users (
  role public.admin_role primary key,
  id uuid not null
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  r.email,
  crypt('TestPass!23456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from (values
  ('admin@pgtap.nom035.local'),
  ('rh@pgtap.nom035.local'),
  ('psico@pgtap.nom035.local'),
  ('dir@pgtap.nom035.local'),
  ('admin2@pgtap.nom035.local')
) as r(email);

insert into public.admin_profiles (id, nombre, email, role, can_view_sensitive_cases, mfa_required, active)
select u.id,
  split_part(u.email, '@', 1),
  u.email,
  case
    when u.email like 'admin2%' then 'admin'::public.admin_role
    when u.email like 'admin%' then 'admin'::public.admin_role
    when u.email like 'rh%' then 'rh'::public.admin_role
    when u.email like 'psico%' then 'psicologo'::public.admin_role
    else 'direccion'::public.admin_role
  end,
  (u.email like 'psico%'),
  true,
  true
from auth.users u
where u.email like '%@pgtap.nom035.local';

insert into _t_users(role, id)
select p.role, p.id
from public.admin_profiles p
where p.email like '%@pgtap.nom035.local'
  and p.email not like 'admin2%'
on conflict (role) do update set id = excluded.id;

-- ============================ HELPERS JWT ===================================
create or replace function pg_temp.set_jwt(p_uid uuid, p_aal text default 'aal2')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.aal', p_aal, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end;
$$;

-- ============================ AUTORIZACIÓN ==================================
select lives_ok(
  $$select public.require_admin_permission('dashboard.view'::public.app_permission)$$,
  'postgres sin JWT puede (bypass pruebas estructurales)');

select is(
  (select public.has_admin_permission('dashboard.view'::public.app_permission)),
  true,
  'postgres bypass has_admin_permission');

-- Perfil inexistente
select pg_temp.set_jwt('00000000-0000-0000-0000-000000000099');
select throws_ok(
  $$select public.require_admin_permission('dashboard.view'::public.app_permission)$$,
  'P0001',
  'profile_missing',
  'perfil inexistente rechazado');

-- Admin AAL2 OK
select pg_temp.set_jwt((select id from _t_users where role = 'admin'), 'aal2');
select lives_ok(
  $$select public.require_admin_permission('users.manage'::public.app_permission)$$,
  'admin AAL2 users.manage OK');

select throws_ok(
  $$select public.require_admin_permission('results.individual.read'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'admin sin sensitive no ve individual');

-- Admin AAL1 rechazado en users.manage
select pg_temp.set_jwt((select id from _t_users where role = 'admin'), 'aal1');
select throws_ok(
  $$select public.require_admin_permission('users.manage'::public.app_permission)$$,
  'P0001',
  'aal2_required',
  'AAL1 rechazado cuando requiere AAL2');

-- RH no individual / no quejas
select pg_temp.set_jwt((select id from _t_users where role = 'rh'), 'aal2');
select throws_ok(
  $$select public.require_admin_permission('results.individual.read'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'RH no resultados individuales');
select throws_ok(
  $$select public.require_admin_permission('complaints.list'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'RH no quejas');
select lives_ok(
  $$select public.require_admin_permission('workers.write'::public.app_permission)$$,
  'RH workers.write OK');

-- Psicólogo sensible OK
select pg_temp.set_jwt((select id from _t_users where role = 'psicologo'), 'aal2');
select lives_ok(
  $$select public.require_admin_permission('results.individual.read'::public.app_permission)$$,
  'psicologo individual OK');
select throws_ok(
  $$select public.require_admin_permission('users.manage'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'psicologo no users.manage');

-- Dirección solo agregados
select pg_temp.set_jwt((select id from _t_users where role = 'direccion'), 'aal2');
select lives_ok(
  $$select public.require_admin_permission('results.aggregate.read'::public.app_permission)$$,
  'direccion aggregate OK');
select throws_ok(
  $$select public.require_admin_permission('workers.write'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'direccion no muta trabajadores');

-- Cambio de rol inmediato
update public.admin_profiles
set role = 'direccion'
where id = (select id from _t_users where role = 'rh');
select pg_temp.set_jwt((select id from _t_users where role = 'rh'), 'aal2');
select throws_ok(
  $$select public.require_admin_permission('workers.write'::public.app_permission)$$,
  'P0001',
  'forbidden',
  'cambio de rol surte efecto inmediato');
-- restaurar
update public.admin_profiles
set role = 'rh'
where id = (select id from _t_users where role = 'rh');

-- Desactivación inmediata
update public.admin_profiles
set active = false
where id = (select id from _t_users where role = 'direccion');
select pg_temp.set_jwt((select id from _t_users where role = 'direccion'), 'aal2');
select throws_ok(
  $$select public.require_admin_permission('dashboard.view'::public.app_permission)$$,
  'P0001',
  'account_disabled',
  'perfil inactivo rechazado de inmediato');
update public.admin_profiles
set active = true
where id = (select id from _t_users where role = 'direccion');

-- Último admin protegido: desactivar TODOS los demás admins e intentar
update public.admin_profiles set active = false
where role = 'admin'
  and id <> (select id from _t_users where role = 'admin');

select is(
  (select count(*)::text from public.admin_profiles where role='admin' and active),
  '1',
  'queda exactamente un admin activo antes de la prueba de protección');

select throws_ok(
  $$update public.admin_profiles set active = false
    where id = (select id from _t_users where role = 'admin')$$,
  'P0001',
  'last_admin_protected',
  'último admin no se desactiva');
select throws_ok(
  $$update public.admin_profiles set role = 'rh'
    where id = (select id from _t_users where role = 'admin')$$,
  'P0001',
  'last_admin_protected',
  'último admin no cambia de rol');

-- Matriz: no quitar users.manage a admin
select throws_ok(
  $$delete from public.role_permissions
    where role = 'admin' and permission = 'users.manage'$$,
  'P0001',
  'last_admin_permission_protected',
  'no quitar users.manage de matriz admin');

-- ============================ GRANTS RPC ====================================
select ok(
  has_function_privilege('authenticated', 'public.admin_dashboard_summary()', 'EXECUTE'),
  'authenticated EXECUTE admin_dashboard_summary');
select ok(
  not has_function_privilege('anon', 'public.admin_dashboard_summary()', 'EXECUTE'),
  'anon sin EXECUTE admin_dashboard_summary');
select ok(
  has_function_privilege('authenticated', 'public.admin_list_users()', 'EXECUTE'),
  'authenticated EXECUTE admin_list_users');

-- Acceso directo a tablas denegado
select ok(
  not has_table_privilege('authenticated', 'public.admin_profiles', 'SELECT'),
  'authenticated sin SELECT directo admin_profiles');
select ok(
  not has_table_privilege('anon', 'public.role_permissions', 'SELECT'),
  'anon sin SELECT role_permissions');

-- search_path fijo
select ok(
  (select prosecdef and proconfig::text like '%search_path%'
   from pg_proc where proname = 'require_admin_permission' limit 1),
  'require_admin_permission security definer + search_path');

select * from finish();
rollback;
