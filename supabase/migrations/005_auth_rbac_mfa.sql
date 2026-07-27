-- =============================================================================
-- B4.6 · Autenticación, RBAC y MFA (portal administrativo)
-- Local-only. Sin remoto/link/push. Autoridad en PostgreSQL + Route Handlers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) app_permission
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_permission as enum (
    'dashboard.view',
    'company.read',
    'company.write',
    'workers.read',
    'workers.write',
    'workers.import',
    'campaigns.read',
    'campaigns.write',
    'assignments.issue',
    'assignments.rotate',
    'assignments.revoke',
    'results.aggregate.read',
    'results.individual.read',
    'results.answers.read',
    'results.clinical.read',
    'reports.generate',
    'action_plans.read',
    'action_plans.write',
    'evidence.read',
    'evidence.write',
    'evidence.download',
    'complaints.list',
    'complaints.detail',
    'complaints.contact.read',
    'complaints.manage',
    'policies.read',
    'policies.write',
    'policies.publish',
    'users.read',
    'users.manage',
    'audit.read'
  );
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- B) role_permissions
-- -----------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role public.admin_role not null,
  permission public.app_permission not null,
  requires_sensitive_access boolean not null default false,
  requires_aal2 boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
revoke all on table public.role_permissions from anon, authenticated;

-- Reconstrucción determinística (idempotente en cada migrate/reset)
truncate public.role_permissions;

-- Helper temporal de siembra
create or replace function public._seed_role_perm(
  p_role public.admin_role,
  p_permission public.app_permission,
  p_sensitive boolean,
  p_aal2 boolean
) returns void
language sql
set search_path = public
as $$
  insert into public.role_permissions(role, permission, requires_sensitive_access, requires_aal2)
  values (p_role, p_permission, p_sensitive, p_aal2)
  on conflict (role, permission) do update set
    requires_sensitive_access = excluded.requires_sensitive_access,
    requires_aal2 = excluded.requires_aal2;
$$;

-- ADMIN
select public._seed_role_perm('admin','dashboard.view',false,false);
select public._seed_role_perm('admin','company.read',false,false);
select public._seed_role_perm('admin','company.write',false,false);
select public._seed_role_perm('admin','workers.read',false,false);
select public._seed_role_perm('admin','workers.write',false,false);
select public._seed_role_perm('admin','workers.import',false,false);
select public._seed_role_perm('admin','campaigns.read',false,false);
select public._seed_role_perm('admin','campaigns.write',false,false);
select public._seed_role_perm('admin','assignments.issue',false,false);
select public._seed_role_perm('admin','assignments.rotate',false,true);
select public._seed_role_perm('admin','assignments.revoke',false,true);
select public._seed_role_perm('admin','results.aggregate.read',false,false);
select public._seed_role_perm('admin','results.individual.read',true,true);
select public._seed_role_perm('admin','results.answers.read',true,true);
select public._seed_role_perm('admin','results.clinical.read',true,true);
select public._seed_role_perm('admin','reports.generate',false,false);
select public._seed_role_perm('admin','action_plans.read',false,false);
select public._seed_role_perm('admin','action_plans.write',false,false);
select public._seed_role_perm('admin','evidence.read',false,false);
select public._seed_role_perm('admin','evidence.write',false,false);
select public._seed_role_perm('admin','evidence.download',false,true);
select public._seed_role_perm('admin','complaints.list',true,true);
select public._seed_role_perm('admin','complaints.detail',true,true);
select public._seed_role_perm('admin','complaints.contact.read',true,true);
select public._seed_role_perm('admin','complaints.manage',true,true);
select public._seed_role_perm('admin','policies.read',false,false);
select public._seed_role_perm('admin','policies.write',false,false);
select public._seed_role_perm('admin','policies.publish',false,true);
select public._seed_role_perm('admin','users.read',false,false);
select public._seed_role_perm('admin','users.manage',false,true);
select public._seed_role_perm('admin','audit.read',false,true);

-- RH
select public._seed_role_perm('rh','dashboard.view',false,false);
select public._seed_role_perm('rh','company.read',false,false);
select public._seed_role_perm('rh','workers.read',false,false);
select public._seed_role_perm('rh','workers.write',false,false);
select public._seed_role_perm('rh','workers.import',false,false);
select public._seed_role_perm('rh','campaigns.read',false,false);
select public._seed_role_perm('rh','campaigns.write',false,false);
select public._seed_role_perm('rh','assignments.issue',false,false);
select public._seed_role_perm('rh','assignments.rotate',false,true);
select public._seed_role_perm('rh','assignments.revoke',false,true);
select public._seed_role_perm('rh','results.aggregate.read',false,false);
select public._seed_role_perm('rh','reports.generate',false,false);
select public._seed_role_perm('rh','action_plans.read',false,false);
select public._seed_role_perm('rh','action_plans.write',false,false);
select public._seed_role_perm('rh','evidence.read',false,false);
select public._seed_role_perm('rh','evidence.write',false,false);
select public._seed_role_perm('rh','evidence.download',false,true);
select public._seed_role_perm('rh','policies.read',false,false);
select public._seed_role_perm('rh','policies.write',false,false);

-- PSICOLOGO
select public._seed_role_perm('psicologo','dashboard.view',false,false);
select public._seed_role_perm('psicologo','company.read',false,false);
select public._seed_role_perm('psicologo','campaigns.read',false,false);
select public._seed_role_perm('psicologo','results.aggregate.read',false,false);
select public._seed_role_perm('psicologo','results.individual.read',true,true);
select public._seed_role_perm('psicologo','results.answers.read',true,true);
select public._seed_role_perm('psicologo','results.clinical.read',true,true);
select public._seed_role_perm('psicologo','reports.generate',false,false);
select public._seed_role_perm('psicologo','action_plans.read',false,false);
select public._seed_role_perm('psicologo','action_plans.write',false,false);
select public._seed_role_perm('psicologo','evidence.read',false,false);
select public._seed_role_perm('psicologo','evidence.download',false,true);
select public._seed_role_perm('psicologo','complaints.list',true,true);
select public._seed_role_perm('psicologo','complaints.detail',true,true);
select public._seed_role_perm('psicologo','complaints.contact.read',true,true);
select public._seed_role_perm('psicologo','complaints.manage',true,true);
select public._seed_role_perm('psicologo','policies.read',false,false);

-- DIRECCION
select public._seed_role_perm('direccion','dashboard.view',false,false);
select public._seed_role_perm('direccion','results.aggregate.read',false,false);
select public._seed_role_perm('direccion','reports.generate',false,false);
select public._seed_role_perm('direccion','action_plans.read',false,false);
select public._seed_role_perm('direccion','evidence.read',false,false);
select public._seed_role_perm('direccion','policies.read',false,false);

drop function public._seed_role_perm(public.admin_role, public.app_permission, boolean, boolean);

-- -----------------------------------------------------------------------------
-- C) Ampliar admin_profiles
-- -----------------------------------------------------------------------------
alter table public.admin_profiles
  add column if not exists mfa_required boolean not null default true,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists version integer not null default 1;

alter table public.admin_profiles drop constraint if exists admin_profiles_active_deactivated_ck;
alter table public.admin_profiles
  add constraint admin_profiles_active_deactivated_ck check (
    (active = true and deactivated_at is null)
    or (active = false and deactivated_at is not null)
  );

alter table public.admin_profiles drop constraint if exists admin_profiles_version_positive;
alter table public.admin_profiles
  add constraint admin_profiles_version_positive check (version > 0);

alter table public.admin_profiles drop constraint if exists admin_profiles_email_normalized;
alter table public.admin_profiles
  add constraint admin_profiles_email_normalized check (email = lower(btrim(email)));

create or replace function public.tg_admin_profiles_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  new.nombre := btrim(new.nombre);
  if new.nombre is null or new.nombre = '' then
    raise exception 'nombre_required' using errcode = '23514';
  end if;
  if new.active = false and new.deactivated_at is null then
    new.deactivated_at := timezone('utc', now());
  end if;
  if new.active = true then
    new.deactivated_at := null;
  end if;
  if tg_op = 'UPDATE' then
    new.version := coalesce(old.version, 0) + 1;
    new.updated_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_normalize on public.admin_profiles;
create trigger trg_admin_profiles_normalize
before insert or update on public.admin_profiles
for each row execute function public.tg_admin_profiles_normalize();

-- -----------------------------------------------------------------------------
-- D) Protección del último administrador activo
-- -----------------------------------------------------------------------------
create or replace function public.count_active_admins()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.admin_profiles
  where role = 'admin' and active = true;
$$;

create or replace function public.tg_protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.active = true then
      select count(*)::integer into v_remaining
      from public.admin_profiles
      where role = 'admin' and active = true and id <> old.id;
      if v_remaining < 1 then
        raise exception 'last_admin_protected' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'admin' and old.active = true then
    if (new.active = false) or (new.role is distinct from 'admin') then
      select count(*)::integer into v_remaining
      from public.admin_profiles
      where role = 'admin' and active = true and id <> old.id;
      if v_remaining < 1 then
        raise exception 'last_admin_protected' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_last_admin on public.admin_profiles;
create trigger trg_protect_last_admin
before update or delete on public.admin_profiles
for each row execute function public.tg_protect_last_admin();

create or replace function public.tg_protect_last_admin_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.permission = 'users.manage'::public.app_permission then
      raise exception 'last_admin_permission_protected' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.role = 'admin' and old.permission = 'users.manage'::public.app_permission then
      if new.permission is distinct from old.permission or new.role is distinct from old.role then
        raise exception 'last_admin_permission_protected' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_last_admin_permission on public.role_permissions;
create trigger trg_protect_last_admin_permission
before update or delete on public.role_permissions
for each row execute function public.tg_protect_last_admin_permission();

-- -----------------------------------------------------------------------------
-- E) Funciones de identidad y autorización
-- -----------------------------------------------------------------------------
create or replace function public.nom035_current_aal()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'aal', ''),
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    'aal1'
  );
$$;

create or replace function public.nom035_jwt_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
$$;

create or replace function public.nom035_write_auth_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
      - 'password' - 'token' - 'secret' - 'totp' - 'refresh_token' - 'access_token'
      - 'cookie' - 'ip' - 'email'
  );
exception when others then
  null;
end;
$$;

create or replace function public.current_admin_profile()
returns public.admin_profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.admin_profiles;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_row from public.admin_profiles where id = v_uid;
  return v_row;
end;
$$;

create or replace function public.current_admin_role()
returns public.admin_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.admin_profiles;
begin
  v_row := public.current_admin_profile();
  if v_row is null or v_row.active is not true then
    return null;
  end if;
  return v_row.role;
end;
$$;

create or replace function public.is_active_admin_user()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.admin_profiles;
begin
  v_row := public.current_admin_profile();
  return v_row is not null and v_row.active = true;
end;
$$;

create or replace function public.has_admin_permission(p_permission public.app_permission)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.admin_profiles;
  v_rp public.role_permissions;
  v_jwt_role text := public.nom035_jwt_role();
begin
  if auth.uid() is null then
    if v_jwt_role = 'service_role' then
      return true;
    end if;
    if v_jwt_role in ('anon', 'authenticated') then
      return false;
    end if;
    if current_user in ('postgres', 'supabase_admin') then
      return true;
    end if;
    return false;
  end if;

  v_row := public.current_admin_profile();
  if v_row is null or v_row.active is not true then
    return false;
  end if;

  select * into v_rp
  from public.role_permissions
  where role = v_row.role and permission = p_permission;
  if not found then
    return false;
  end if;
  if v_rp.requires_sensitive_access and v_row.can_view_sensitive_cases is not true then
    return false;
  end if;
  if v_rp.requires_aal2 and public.nom035_current_aal() is distinct from 'aal2' then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.require_admin_permission(p_permission public.app_permission)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.admin_profiles;
  v_rp public.role_permissions;
  v_jwt_role text := public.nom035_jwt_role();
begin
  if auth.uid() is null then
    if v_jwt_role = 'service_role' then
      return;
    end if;
    if v_jwt_role in ('anon', 'authenticated') then
      perform public.nom035_write_auth_audit('auth.access_denied', 'permission', null,
        jsonb_build_object('permission', p_permission::text, 'reason', 'no_uid'));
      raise exception 'unauthorized' using errcode = 'P0001';
    end if;
    if current_user in ('postgres', 'supabase_admin') then
      return;
    end if;
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  v_row := public.current_admin_profile();
  if v_row is null then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', null,
      jsonb_build_object('permission', p_permission::text, 'reason', 'profile_missing'));
    raise exception 'profile_missing' using errcode = 'P0001';
  end if;
  if v_row.active is not true then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', v_row.id,
      jsonb_build_object('permission', p_permission::text, 'reason', 'account_disabled'));
    raise exception 'account_disabled' using errcode = 'P0001';
  end if;

  select * into v_rp
  from public.role_permissions
  where role = v_row.role and permission = p_permission;
  if not found then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', v_row.id,
      jsonb_build_object('permission', p_permission::text, 'reason', 'forbidden', 'role', v_row.role::text));
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_rp.requires_sensitive_access and v_row.can_view_sensitive_cases is not true then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', v_row.id,
      jsonb_build_object('permission', p_permission::text, 'reason', 'sensitive_required'));
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_rp.requires_aal2 and public.nom035_current_aal() is distinct from 'aal2' then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', v_row.id,
      jsonb_build_object('permission', p_permission::text, 'reason', 'aal2_required'));
    raise exception 'aal2_required' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.require_admin_permission_aal2(p_permission public.app_permission)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.nom035_current_aal() is distinct from 'aal2' and auth.uid() is not null then
    perform public.nom035_write_auth_audit('auth.access_denied', 'permission', auth.uid(),
      jsonb_build_object('permission', p_permission::text, 'reason', 'aal2_required'));
    raise exception 'aal2_required' using errcode = 'P0001';
  end if;
  perform public.require_admin_permission(p_permission);
end;
$$;

create or replace function public.admin_get_my_auth_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.admin_profiles;
  v_perms jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_row := public.current_admin_profile();
  if v_row is null then
    return jsonb_build_object('ok', false, 'code', 'profile_missing');
  end if;
  if v_row.active is not true then
    return jsonb_build_object('ok', false, 'code', 'account_disabled');
  end if;

  select coalesce(jsonb_agg(rp.permission::text order by rp.permission::text), '[]'::jsonb)
  into v_perms
  from public.role_permissions rp
  where rp.role = v_row.role
    and (not rp.requires_sensitive_access or v_row.can_view_sensitive_cases = true);

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id', v_row.id,
      'nombre', v_row.nombre,
      'email', v_row.email,
      'role', v_row.role,
      'canViewSensitiveCases', v_row.can_view_sensitive_cases,
      'mfaRequired', v_row.mfa_required,
      'mustChangePassword', v_row.must_change_password,
      'active', v_row.active,
      'lastLoginAt', v_row.last_login_at,
      'version', v_row.version
    ),
    'permissions', v_perms,
    'aal', public.nom035_current_aal()
  );
end;
$$;

create or replace function public.admin_touch_last_login()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  update public.admin_profiles
  set last_login_at = timezone('utc', now())
  where id = v_uid and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'profile_missing');
  end if;
  perform public.nom035_write_auth_audit('auth.login_succeeded', 'admin_profile', v_uid, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_permission('users.read'::public.app_permission);
  return jsonb_build_object(
    'ok', true,
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'email', p.email,
        'role', p.role,
        'active', p.active,
        'canViewSensitiveCases', p.can_view_sensitive_cases,
        'mfaRequired', p.mfa_required,
        'lastLoginAt', p.last_login_at,
        'deactivatedAt', p.deactivated_at,
        'version', p.version,
        'updatedAt', p.updated_at
      ) order by p.email)
      from public.admin_profiles p
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert_admin_profile(
  p_id uuid,
  p_nombre text,
  p_email text,
  p_role public.admin_role,
  p_can_view_sensitive_cases boolean default false,
  p_mfa_required boolean default true,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_row public.admin_profiles;
  v_exists boolean;
begin
  perform public.require_admin_permission('users.manage'::public.app_permission);
  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists(select 1 from public.admin_profiles where id = p_id) into v_exists;
  begin
    if v_exists then
      update public.admin_profiles set
        nombre = v_nombre,
        email = v_email,
        role = p_role,
        can_view_sensitive_cases = coalesce(p_can_view_sensitive_cases, false),
        mfa_required = coalesce(p_mfa_required, true),
        active = coalesce(p_active, true),
        updated_by = auth.uid()
      where id = p_id
      returning * into v_row;
      perform public.nom035_write_auth_audit('auth.profile_updated', 'admin_profile', p_id,
        jsonb_build_object('role', p_role::text, 'active', p_active));
    else
      insert into public.admin_profiles (
        id, nombre, email, role, can_view_sensitive_cases, mfa_required, active, invited_by, updated_by
      ) values (
        p_id, v_nombre, v_email, p_role,
        coalesce(p_can_view_sensitive_cases, false),
        coalesce(p_mfa_required, true),
        coalesce(p_active, true),
        auth.uid(), auth.uid()
      ) returning * into v_row;
      perform public.nom035_write_auth_audit('auth.profile_created', 'admin_profile', p_id,
        jsonb_build_object('role', p_role::text));
    end if;
  exception
    when raise_exception then
      if sqlerrm like '%last_admin_protected%' then
        return jsonb_build_object('ok', false, 'code', 'last_admin_protected');
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_row.id,
      'nombre', v_row.nombre,
      'email', v_row.email,
      'role', v_row.role,
      'active', v_row.active,
      'canViewSensitiveCases', v_row.can_view_sensitive_cases,
      'mfaRequired', v_row.mfa_required,
      'version', v_row.version
    )
  );
end;
$$;

create or replace function public.admin_deactivate_admin_profile(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_permission('users.manage'::public.app_permission);
  begin
    update public.admin_profiles
    set active = false, updated_by = auth.uid()
    where id = p_id and active = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
  exception
    when raise_exception then
      if sqlerrm like '%last_admin_protected%' then
        return jsonb_build_object('ok', false, 'code', 'last_admin_protected');
      end if;
      raise;
  end;
  perform public.nom035_write_auth_audit('auth.profile_deactivated', 'admin_profile', p_id, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reactivate_admin_profile(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_permission('users.manage'::public.app_permission);
  update public.admin_profiles
  set active = true, updated_by = auth.uid()
  where id = p_id and active = false;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.nom035_write_auth_audit('auth.profile_reactivated', 'admin_profile', p_id, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_list_audit_log(
  p_limit integer default 100,
  p_action text default null,
  p_entity_type text default null,
  p_actor uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform public.require_admin_permission('audit.read'::public.app_permission);
  return jsonb_build_object(
    'ok', true,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'createdAt', a.created_at,
        'actorUserId', a.actor_user_id,
        'action', a.action,
        'entityType', a.entity_type,
        'entityId', a.entity_id,
        'metadata', a.metadata
      ) order by a.created_at desc)
      from (
        select * from public.audit_log x
        where (p_action is null or x.action = p_action)
          and (p_entity_type is null or x.entity_type = p_entity_type)
          and (p_actor is null or x.actor_user_id = p_actor)
        order by x.created_at desc
        limit v_limit
      ) a
    ), '[]'::jsonb)
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- F) Inyectar require_admin_permission en RPCs administrativas existentes
-- -----------------------------------------------------------------------------
-- guard: admin_action_plan_summary -> action_plans.read
CREATE OR REPLACE FUNCTION public.admin_action_plan_summary(p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
begin
  perform public.require_admin_permission('action_plans.read'::public.app_permission);

  select jsonb_build_object(
    'total', count(*) filter (where archived_at is null),
    'pendientes', count(*) filter (where status = 'pendiente' and archived_at is null),
    'enProceso', count(*) filter (where status = 'en_proceso' and archived_at is null),
    'completadas', count(*) filter (where status = 'completada' and archived_at is null),
    'canceladas', count(*) filter (where status = 'cancelada' and archived_at is null),
    'archivadas', count(*) filter (where archived_at is not null),
    'vencidas', count(*) filter (
      where archived_at is null and status in ('pendiente', 'en_proceso')
        and due_date is not null and due_date < current_date),
    'sugeridas', count(*) filter (where source = 'suggested' and archived_at is null),
    'manuales', count(*) filter (where source = 'manual' and archived_at is null)
  )
  into v
  from public.action_plans a
  where (p_campaign_id is null or a.campaign_id = p_campaign_id);

  return jsonb_build_object('ok', true, 'summary', v);
end;
$function$;

-- guard: admin_activate_campaign -> campaigns.write
CREATE OR REPLACE FUNCTION public.admin_activate_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evaluation_campaigns%rowtype;
begin
  perform public.require_admin_permission('campaigns.write'::public.app_permission);

  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if public.nom035_nullif_blank(v_row.nombre) is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_campaign');
  end if;
  if exists (
    select 1 from public.evaluation_campaigns
    where status = 'active' and id <> p_campaign_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'another_active_exists');
  end if;

  update public.evaluation_campaigns
  set status = 'active',
      activated_at = timezone('utc', now()),
      closed_at = null,
      updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.activated', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$function$;

-- guard: admin_archive_action_plan -> action_plans.write
CREATE OR REPLACE FUNCTION public.admin_archive_action_plan(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.action_plans%rowtype;
begin
  perform public.require_admin_permission('action_plans.write'::public.app_permission);

  select * into v_row from public.action_plans where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.archived_at is not null then
    return jsonb_build_object('ok', true, 'actionPlan', public.admin_action_plan_to_json(v_row));
  end if;

  update public.action_plans set
    archived_at = timezone('utc', now()),
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('action_plan.archived', 'action_plan', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'actionPlan', public.admin_action_plan_to_json(v_row));
end;
$function$;

-- guard: admin_archive_policy -> policies.write
CREATE OR REPLACE FUNCTION public.admin_archive_policy(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.policy_documents%rowtype;
begin
  perform public.require_admin_permission('policies.write'::public.app_permission);

  select * into v_row from public.policy_documents where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status::text <> 'publicada' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.policy_documents set
    status = 'archivada'::public.policy_status,
    archived_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('policy.archived', 'policy', v_row.id, jsonb_build_object('reason', 'manual'));

  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v_row));
end;
$function$;

-- guard: admin_assign_complaint -> complaints.manage
CREATE OR REPLACE FUNCTION public.admin_assign_complaint(p_id uuid, p_assigned_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.confidential_complaints%rowtype;
  v_label text := public.nom035_nullif_blank(p_assigned_label);
begin
  perform public.require_admin_permission('complaints.manage'::public.app_permission);

  select * into v from public.confidential_complaints where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_label is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  update public.confidential_complaints set
    assigned_label = v_label,
    assigned_at = timezone('utc', now()),
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('complaint.assigned', 'complaint', v.id, jsonb_build_object('assigned', true));

  return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
end;
$function$;

-- guard: admin_change_action_plan_status -> action_plans.write
CREATE OR REPLACE FUNCTION public.admin_change_action_plan_status(p_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.action_plans%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  perform public.require_admin_permission('action_plans.write'::public.app_permission);

  select * into v_row from public.action_plans where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p_status not in ('pendiente', 'en_proceso', 'completada', 'cancelada') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  -- Validación explícita de transición (el trigger es la garantía dura).
  if v_row.status::text <> p_status then
    if not (
      (v_row.status::text = 'pendiente' and p_status in ('en_proceso', 'completada', 'cancelada'))
      or (v_row.status::text = 'en_proceso' and p_status in ('completada', 'cancelada'))
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_transition');
    end if;
  end if;

  update public.action_plans set
    status = p_status::public.action_status,
    completed_at = case when p_status = 'completada' then coalesce(completed_at, v_now) else null end,
    cancelled_at = case when p_status = 'cancelada' then coalesce(cancelled_at, v_now) else null end,
    version = version + 1,
    updated_at = v_now
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('action_plan.status_changed', 'action_plan', v_row.id,
          jsonb_build_object('status', v_row.status));

  return jsonb_build_object('ok', true, 'actionPlan', public.admin_action_plan_to_json(v_row));
end;
$function$;

-- guard: admin_change_complaint_status -> complaints.manage
CREATE OR REPLACE FUNCTION public.admin_change_complaint_status(p_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.confidential_complaints%rowtype;
begin
  perform public.require_admin_permission('complaints.manage'::public.app_permission);

  select * into v from public.confidential_complaints where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Solo recibida -> en_revision (resolución/cierre por RPCs dedicados).
  if p_status = v.status::text then
    return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
  end if;
  if not (v.status = 'recibida' and p_status = 'en_revision') then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  update public.confidential_complaints set
    status = 'en_revision',
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('complaint.status_changed', 'complaint', v.id, jsonb_build_object('status', v.status));

  return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
end;
$function$;

-- guard: admin_close_campaign -> campaigns.write
CREATE OR REPLACE FUNCTION public.admin_close_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evaluation_campaigns%rowtype;
begin
  perform public.require_admin_permission('campaigns.write'::public.app_permission);

  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.evaluation_campaigns
  set status = 'closed',
      closed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.closed', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$function$;

-- guard: admin_close_complaint -> complaints.manage
CREATE OR REPLACE FUNCTION public.admin_close_complaint(p_id uuid, p_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.confidential_complaints%rowtype;
begin
  perform public.require_admin_permission('complaints.manage'::public.app_permission);

  select * into v from public.confidential_complaints where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status = 'cerrada' then
    return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
  end if;
  -- recibida/en_revision/resuelta -> cerrada.
  if v.status not in ('recibida', 'en_revision', 'resuelta') then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  update public.confidential_complaints set
    status = 'cerrada',
    closed_at = timezone('utc', now()),
    resolution_notes = coalesce(public.nom035_nullif_blank(p_justification), resolution_notes),
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('complaint.closed', 'complaint', v.id, jsonb_build_object('hadJustification', p_justification is not null));

  return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
end;
$function$;

-- guard: admin_complaint_summary -> complaints.list
CREATE OR REPLACE FUNCTION public.admin_complaint_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
begin
  perform public.require_admin_permission('complaints.list'::public.app_permission);

  select jsonb_build_object(
    'total', count(*),
    'recibidas', count(*) filter (where status = 'recibida'),
    'enRevision', count(*) filter (where status = 'en_revision'),
    'resueltas', count(*) filter (where status = 'resuelta'),
    'cerradas', count(*) filter (where status = 'cerrada')
  )
  into v
  from public.confidential_complaints;

  return jsonb_build_object('ok', true, 'summary', v);
end;
$function$;

-- guard: admin_create_action_plan -> action_plans.write
CREATE OR REPLACE FUNCTION public.admin_create_action_plan(p_campaign_id uuid, p_area text, p_risk_factor text, p_risk_level text, p_action_level text, p_action_type text, p_description text, p_responsible text, p_due_date date DEFAULT NULL::date, p_follow_up_notes text DEFAULT ''::text, p_source text DEFAULT 'manual'::text, p_source_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.action_plans%rowtype;
  v_desc text := public.nom035_nullif_blank(p_description);
  v_area text := public.nom035_nullif_blank(p_area);
  v_factor text := public.nom035_nullif_blank(p_risk_factor);
  v_resp text := public.nom035_nullif_blank(p_responsible);
  v_source text := coalesce(public.nom035_nullif_blank(p_source), 'manual');
begin
  perform public.require_admin_permission('action_plans.write'::public.app_permission);

  if not exists (select 1 from public.evaluation_campaigns where id = p_campaign_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_desc is null or v_area is null or v_factor is null or v_resp is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if v_source not in ('manual', 'suggested') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  insert into public.action_plans (
    campaign_id, area, risk_factor, risk_level, action_level, action_type,
    description, responsible, due_date, status, follow_up_notes, source, source_key
  ) values (
    p_campaign_id, v_area, v_factor, p_risk_level::public.risk_level,
    p_action_level::public.action_level, p_action_type::public.action_type,
    v_desc, v_resp, p_due_date, 'pendiente',
    coalesce(public.nom035_nullif_blank(p_follow_up_notes), ''),
    v_source, public.nom035_nullif_blank(p_source_key)
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('action_plan.created', 'action_plan', v_row.id,
          jsonb_build_object('source', v_row.source, 'area', v_row.area));

  return jsonb_build_object('ok', true, 'actionPlan', public.admin_action_plan_to_json(v_row));
end;
$function$;

-- guard: admin_create_campaign -> campaigns.write
CREATE OR REPLACE FUNCTION public.admin_create_campaign(p_nombre text, p_descripcion text DEFAULT NULL::text, p_fecha_inicio date DEFAULT NULL::date, p_fecha_cierre date DEFAULT NULL::date, p_questionnaire_version text DEFAULT 'nom035-stps-2018-guias-referencia-i-ii'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nombre text := public.nom035_nullif_blank(p_nombre);
  v_row public.evaluation_campaigns%rowtype;
begin
  perform public.require_admin_permission('campaigns.write'::public.app_permission);

  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  if p_fecha_cierre is not null and p_fecha_inicio is not null and p_fecha_cierre < p_fecha_inicio then
    return jsonb_build_object('ok', false, 'code', 'invalid_dates');
  end if;

  insert into public.evaluation_campaigns (
    nombre, descripcion, status, fecha_inicio, fecha_cierre, questionnaire_version
  ) values (
    v_nombre,
    public.nom035_nullif_blank(p_descripcion),
    'draft',
    p_fecha_inicio,
    p_fecha_cierre,
    coalesce(public.nom035_nullif_blank(p_questionnaire_version), 'nom035-stps-2018-guias-referencia-i-ii')
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.created', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$function$;

-- guard: admin_create_evidence_metadata -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_create_evidence_metadata(p_evidence_source text, p_title text, p_evidence_type text, p_description text, p_campaign_id uuid DEFAULT NULL::uuid, p_storage_bucket text DEFAULT NULL::text, p_storage_path text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_original_file_name text DEFAULT NULL::text, p_safe_file_name text DEFAULT NULL::text, p_mime_type text DEFAULT NULL::text, p_size_bytes bigint DEFAULT NULL::bigint, p_sha256 text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
  v_title text := public.nom035_nullif_blank(p_title);
  v_desc text := coalesce(public.nom035_nullif_blank(p_description), '');
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  if v_title is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_evidence_source not in ('upload', 'external') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  insert into public.evidence_items (
    campaign_id, title, evidence_type, description, evidence_source,
    storage_bucket, storage_path, external_url, original_file_name, safe_file_name,
    mime_type, size_bytes, sha256, notes
  ) values (
    p_campaign_id, v_title, p_evidence_type::public.evidence_type, v_desc, p_evidence_source,
    public.nom035_nullif_blank(p_storage_bucket),
    public.nom035_nullif_blank(p_storage_path),
    public.nom035_nullif_blank(p_external_url),
    public.nom035_nullif_blank(p_original_file_name),
    public.nom035_nullif_blank(p_safe_file_name),
    public.nom035_nullif_blank(p_mime_type),
    p_size_bytes,
    public.nom035_nullif_blank(p_sha256),
    public.nom035_nullif_blank(p_notes)
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    case when p_evidence_source = 'upload' then 'evidence.uploaded' else 'evidence.created' end,
    'evidence', v_row.id,
    jsonb_build_object('evidenceType', v_row.evidence_type, 'source', v_row.evidence_source)
  );

  return jsonb_build_object('ok', true, 'evidence', public.admin_evidence_to_json(v_row));
end;
$function$;

-- guard: admin_create_policy_draft -> policies.write
CREATE OR REPLACE FUNCTION public.admin_create_policy_draft(p_title text, p_content text, p_version_label text DEFAULT NULL::text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_title text := public.nom035_nullif_blank(p_title);
  v_content text := public.nom035_nullif_blank(p_content);
  v_label text := public.nom035_nullif_blank(p_version_label);
  v_num int;
  v_row public.policy_documents%rowtype;
begin
  perform public.require_admin_permission('policies.write'::public.app_permission);

  if v_title is null or v_content is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_num from public.policy_documents;
  v_label := coalesce(v_label, 'v' || v_num);

  if exists (select 1 from public.policy_documents where version_label = v_label) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_version_label');
  end if;

  insert into public.policy_documents (
    title, content, version, version_number, version_label, status, supersedes_id
  ) values (
    v_title, v_content, v_label, v_num, v_label, 'borrador', p_supersedes_id
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('policy.created', 'policy', v_row.id, jsonb_build_object('versionNumber', v_row.version_number));

  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v_row));
end;
$function$;

-- guard: admin_create_worker -> workers.write
CREATE OR REPLACE FUNCTION public.admin_create_worker(p_nombre text, p_email text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_departamento text DEFAULT NULL::text, p_puesto text DEFAULT NULL::text, p_turno text DEFAULT NULL::text, p_sucursal text DEFAULT NULL::text, p_jefe_directo text DEFAULT NULL::text, p_antiguedad text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text, p_activo boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nombre text := public.nom035_nullif_blank(p_nombre);
  v_email text := public.nom035_normalize_email(p_email);
  v_phone text := public.nom035_normalize_phone(p_telefono);
  v_ext text := public.nom035_nullif_blank(p_external_reference);
  v_activo boolean := coalesce(p_activo, true);
  v_row public.workers%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);

  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  if v_email is not null and not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_email is not null and exists (
    select 1 from public.workers where normalized_email = v_email
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_email');
  end if;
  if v_ext is not null and exists (
    select 1 from public.workers where external_reference = v_ext
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_external_reference');
  end if;

  insert into public.workers (
    nombre, email, telefono, departamento, puesto, turno, sucursal,
    jefe_directo, antiguedad, activo, normalized_email, normalized_phone,
    external_reference, deactivated_at
  ) values (
    v_nombre,
    v_email,
    public.nom035_nullif_blank(p_telefono),
    public.nom035_nullif_blank(p_departamento),
    public.nom035_nullif_blank(p_puesto),
    public.nom035_nullif_blank(p_turno),
    public.nom035_nullif_blank(p_sucursal),
    public.nom035_nullif_blank(p_jefe_directo),
    public.nom035_nullif_blank(p_antiguedad),
    v_activo,
    v_email,
    v_phone,
    v_ext,
    case when v_activo then null else timezone('utc', now()) end
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker.created', 'worker', v_row.id,
    jsonb_build_object('activo', v_row.activo, 'departamento', v_row.departamento)
  );

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$function$;

-- guard: admin_dashboard_summary -> dashboard.view
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_active_workers int;
  v_inactive_workers int;
  v_campaign jsonb;
  v_pending int;
  v_in_progress int;
  v_completed int;
  v_revoked int;
  v_no_link int;
  v_results int;
  v_risk text;
  v_updated timestamptz;
begin
  perform public.require_admin_permission('dashboard.view'::public.app_permission);

  select count(*) filter (where activo), count(*) filter (where not activo)
  into v_active_workers, v_inactive_workers
  from public.workers;

  select public.admin_campaign_to_json(c)
  into v_campaign
  from public.evaluation_campaigns c
  where c.status = 'active'
  limit 1;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'in_progress'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'revoked')
  into v_pending, v_in_progress, v_completed, v_revoked
  from public.evaluation_assignments;

  -- Sin enlace: activos sin assignment en campaña active (si existe)
  if v_campaign is not null then
    select count(*) into v_no_link
    from public.workers w
    where w.activo
      and not exists (
        select 1 from public.evaluation_assignments a
        where a.worker_id = w.id
          and a.campaign_id = (v_campaign->>'id')::uuid
      );
  else
    v_no_link := v_active_workers;
  end if;

  select count(*) into v_results from public.evaluation_results;

  select r.guia_ii_final_risk_level::text into v_risk
  from public.evaluation_results r
  group by r.guia_ii_final_risk_level
  order by count(*) desc, r.guia_ii_final_risk_level
  limit 1;

  select greatest(
    coalesce((select max(updated_at) from public.workers), '-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.evaluation_campaigns), '-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.evaluation_assignments), '-infinity'::timestamptz),
    coalesce((select max(completed_at) from public.evaluation_results), '-infinity'::timestamptz)
  ) into v_updated;

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'activeWorkers', v_active_workers,
      'inactiveWorkers', v_inactive_workers,
      'activeCampaign', v_campaign,
      'assignments', jsonb_build_object(
        'noLink', v_no_link,
        'pending', v_pending,
        'inProgress', v_in_progress,
        'completed', v_completed,
        'revoked', v_revoked
      ),
      'totalResults', v_results,
      'predominantRisk', v_risk,
      'lastUpdatedAt', nullif(v_updated, '-infinity'::timestamptz)
    )
  );
end;
$function$;

-- guard: admin_deactivate_worker -> workers.write
CREATE OR REPLACE FUNCTION public.admin_deactivate_worker(p_worker_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.workers%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);

  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.workers
  set activo = false,
      deactivated_at = coalesce(deactivated_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  update public.evaluation_sessions s
  set revoked_at = timezone('utc', now())
  from public.evaluation_assignments a
  where a.id = s.assignment_id
    and a.worker_id = p_worker_id
    and s.revoked_at is null
    and a.status in ('pending', 'in_progress');

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.deactivated', 'worker', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$function$;

-- guard: admin_delete_worker -> workers.write
CREATE OR REPLACE FUNCTION public.admin_delete_worker(p_worker_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_has_history boolean;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);

  if not exists (select 1 from public.workers where id = p_worker_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select exists (
    select 1 from public.evaluation_assignments where worker_id = p_worker_id
    union all
    select 1 from public.evaluation_results where worker_id = p_worker_id
  ) into v_has_history;

  if v_has_history then
    return jsonb_build_object(
      'ok', false,
      'code', 'has_history',
      'message', 'No se puede eliminar: tiene historial. Desactive el trabajador.'
    );
  end if;

  delete from public.workers where id = p_worker_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.deleted', 'worker', p_worker_id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'deletedId', p_worker_id);
end;
$function$;

-- guard: admin_duplicate_policy -> policies.write
CREATE OR REPLACE FUNCTION public.admin_duplicate_policy(p_id uuid, p_version_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_src public.policy_documents%rowtype;
  v_num int;
  v_label text := public.nom035_nullif_blank(p_version_label);
  v_row public.policy_documents%rowtype;
begin
  perform public.require_admin_permission('policies.write'::public.app_permission);

  select * into v_src from public.policy_documents where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_num from public.policy_documents;
  v_label := coalesce(v_label, 'v' || v_num);
  if exists (select 1 from public.policy_documents where version_label = v_label) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_version_label');
  end if;

  insert into public.policy_documents (
    title, content, version, version_number, version_label, status, supersedes_id
  ) values (
    v_src.title, v_src.content, v_label, v_num, v_label, 'borrador', v_src.id
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('policy.duplicated', 'policy', v_row.id, jsonb_build_object('supersedesId', v_src.id));

  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v_row));
end;
$function$;

-- guard: admin_evidence_summary -> evidence.read
CREATE OR REPLACE FUNCTION public.admin_evidence_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_by_type jsonb;
  v_checklist jsonb;
  v_total int;
  v_cleanup int;
begin
  perform public.require_admin_permission('evidence.read'::public.app_permission);

  select count(*) filter (where deleted_at is null and replaced_by_id is null),
         count(*) filter (where storage_delete_pending = true)
  into v_total, v_cleanup
  from public.evidence_items;

  select coalesce(jsonb_object_agg(t, c), '{}'::jsonb) into v_by_type
  from (
    select evidence_type::text as t, count(*) as c
    from public.evidence_items
    where deleted_at is null and replaced_by_id is null
    group by evidence_type
  ) s;

  select jsonb_build_object(
    'politica', bool_or(evidence_type = 'politica'),
    'difusion', bool_or(evidence_type = 'difusion'),
    'reporte', bool_or(evidence_type in ('reporte', 'resultados')),
    'plan_accion', bool_or(evidence_type = 'plan_accion'),
    'capacitacion', bool_or(evidence_type = 'capacitacion'),
    'quejas', bool_or(evidence_type = 'quejas'),
    'canalizacion', bool_or(evidence_type = 'canalizacion')
  )
  into v_checklist
  from public.evidence_items
  where deleted_at is null and replaced_by_id is null;

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'activeTotal', v_total,
      'cleanupPending', v_cleanup,
      'byType', v_by_type,
      'checklist', coalesce(v_checklist, jsonb_build_object(
        'politica', false, 'difusion', false, 'reporte', false, 'plan_accion', false,
        'capacitacion', false, 'quejas', false, 'canalizacion', false))
    )
  );
end;
$function$;

-- guard: admin_generate_suggested_action_plans -> action_plans.write
CREATE OR REPLACE FUNCTION public.admin_generate_suggested_action_plans(p_campaign_id uuid, p_domain_map jsonb, p_responsible text DEFAULT 'RH'::text, p_due_days integer DEFAULT 30, p_guia_i jsonb DEFAULT NULL::jsonb, p_guia_i_due_days integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created int := 0;
  v_existing int := 0;
  v_skipped int := 0;
  v_domains jsonb := '[]'::jsonb;
  v_cfg jsonb;
  v_level text;
  v_key text;
  v_guia_i_count int;
  rec record;
begin
  perform public.require_admin_permission('action_plans.write'::public.app_permission);

  if not exists (select 1 from public.evaluation_campaigns where id = p_campaign_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p_domain_map is null or jsonb_typeof(p_domain_map) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  for rec in
    with dom as (
      select
        e.key as domain,
        case (e.value->>'riskLevel')
          when 'muy_alto' then 4 when 'alto' then 3 when 'medio' then 2 else 0 end as sev
      from public.evaluation_results r
      cross join lateral jsonb_each(r.guia_ii_domain_scores) e
      where r.campaign_id = p_campaign_id
        and jsonb_typeof(e.value) = 'object'
        and (e.value->>'riskLevel') in ('medio', 'alto', 'muy_alto')
    )
    select domain, count(*)::int as workers, max(sev) as sev
    from dom
    group by domain
    order by domain
  loop
    v_cfg := p_domain_map -> rec.domain;
    if v_cfg is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_level := case rec.sev when 4 then 'muy_alto' when 3 then 'alto' else 'medio' end;
    v_key := 'domain:' || rec.domain;
    v_domains := v_domains || jsonb_build_array(jsonb_build_object(
      'domain', rec.domain, 'workers', rec.workers, 'level', v_level));

    if exists (
      select 1 from public.action_plans
      where campaign_id = p_campaign_id and source = 'suggested'
        and source_key = v_key and archived_at is null
    ) then
      v_existing := v_existing + 1;
      continue;
    end if;

    insert into public.action_plans (
      campaign_id, area, risk_factor, risk_level, action_level, action_type,
      description, responsible, due_date, status, follow_up_notes, source, source_key
    ) values (
      p_campaign_id,
      coalesce(v_cfg->>'area', 'General'),
      rec.domain,
      v_level::public.risk_level,
      coalesce(v_cfg->>'actionLevel', 'primer_nivel')::public.action_level,
      coalesce(v_cfg->>'actionType', 'organizacional')::public.action_type,
      coalesce(v_cfg->>'description', 'Revisar factores asociados al dominio.'),
      p_responsible,
      (current_date + (p_due_days || ' days')::interval)::date,
      'pendiente', '', 'suggested', v_key
    );
    v_created := v_created + 1;
  end loop;

  select count(*) into v_guia_i_count
  from public.evaluation_results
  where campaign_id = p_campaign_id and guia_i_requires_clinical_attention;

  if v_guia_i_count > 0 and p_guia_i is not null and jsonb_typeof(p_guia_i) = 'object' then
    v_key := 'guia_i_followup';
    if exists (
      select 1 from public.action_plans
      where campaign_id = p_campaign_id and source = 'suggested'
        and source_key = v_key and archived_at is null
    ) then
      v_existing := v_existing + 1;
    else
      insert into public.action_plans (
        campaign_id, area, risk_factor, risk_level, action_level, action_type,
        description, responsible, due_date, status, follow_up_notes, source, source_key
      ) values (
        p_campaign_id,
        coalesce(p_guia_i->>'area', 'RH'),
        'Seguimiento confidencial Guía I',
        'medio'::public.risk_level,
        coalesce(p_guia_i->>'actionLevel', 'tercer_nivel')::public.action_level,
        'individual_confidencial'::public.action_type,
        coalesce(p_guia_i->>'description',
          'Canalizar a seguimiento psicológico, médico o institucional por personal autorizado.'),
        p_responsible,
        (current_date + (p_guia_i_due_days || ' days')::interval)::date,
        'pendiente', '', 'suggested', v_key
      );
      v_created := v_created + 1;
    end if;
  end if;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('action_plan.suggestions_generated', 'action_plan', null,
          jsonb_build_object('campaign_id', p_campaign_id, 'created', v_created,
                             'existing', v_existing, 'criticalDomains', jsonb_array_length(v_domains)));

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'existing', v_existing,
    'skipped', v_skipped,
    'summary', jsonb_build_object(
      'criticalDomains', v_domains,
      'guiaIClinicalAttention', v_guia_i_count
    )
  );
end;
$function$;

-- guard: admin_get_company_settings -> company.read
CREATE OR REPLACE FUNCTION public.admin_get_company_settings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.company_settings%rowtype;
  v_active_count int;
begin
  perform public.require_admin_permission('company.read'::public.app_permission);

  select * into v_row from public.company_settings limit 1;
  select count(*) into v_active_count from public.workers where activo;

  if not found then
    return jsonb_build_object('ok', true, 'company', null, 'activeWorkersCount', v_active_count);
  end if;

  return jsonb_build_object(
    'ok', true,
    'activeWorkersCount', v_active_count,
    'company', jsonb_build_object(
      'id', v_row.id,
      'razonSocial', v_row.razon_social,
      'rfc', v_row.rfc,
      'domicilio', v_row.domicilio,
      'telefono', v_row.telefono,
      'actividadPrincipal', v_row.actividad_principal,
      'totalTrabajadores', v_row.total_trabajadores,
      'responsableNombre', v_row.responsable_nombre,
      'responsableEmail', v_row.responsable_email,
      'responsableTelefono', v_row.responsable_telefono,
      'updatedAt', v_row.updated_at,
      'createdAt', v_row.created_at
    )
  );
end;
$function$;

-- guard: admin_get_complaint_detail -> complaints.detail
CREATE OR REPLACE FUNCTION public.admin_get_complaint_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.confidential_complaints%rowtype;
begin
  perform public.require_admin_permission('complaints.detail'::public.app_permission);

  select * into v from public.confidential_complaints where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'confidentialityNotice',
      'Información confidencial. Uso reservado exclusivamente por personal autorizado.',
    'complaint', jsonb_build_object(
      'id', v.id,
      'folio', v.folio,
      'complaintType', v.complaint_type,
      'description', v.description,
      'isAnonymous', v.is_anonymous,
      'reporterName', case when v.is_anonymous then null else v.reporter_name end,
      'reporterContact', case when v.is_anonymous then null else v.reporter_contact end,
      'status', v.status,
      'assignedLabel', v.assigned_label,
      'assignedAt', v.assigned_at,
      'resolutionCategory', v.resolution_category,
      'resolutionNotes', v.resolution_notes,
      'closedAt', v.closed_at,
      'createdAt', v.created_at,
      'updatedAt', v.updated_at
    )
  );
end;
$function$;

-- guard: admin_get_evidence_detail -> evidence.read
CREATE OR REPLACE FUNCTION public.admin_get_evidence_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
  v_versions jsonb;
begin
  perform public.require_admin_permission('evidence.read'::public.app_permission);

  select * into v_row from public.evidence_items where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  with recursive ancestors as (
    select e.* from public.evidence_items e where e.id = v_row.id
    union all
    select prev.* from public.evidence_items prev
    join ancestors a on a.supersedes_id = prev.id
  ),
  descendants as (
    select e.* from public.evidence_items e where e.id = v_row.id
    union all
    select nxt.* from public.evidence_items nxt
    join descendants d on nxt.supersedes_id = d.id
  ),
  chain as (
    select * from ancestors
    union
    select * from descendants
  )
  select coalesce(jsonb_agg(public.admin_evidence_to_json(c) order by c.version), '[]'::jsonb)
  into v_versions from chain c;

  return jsonb_build_object(
    'ok', true,
    'evidence', public.admin_evidence_to_json(v_row),
    'versions', v_versions
  );
end;
$function$;

-- guard: admin_get_policy -> policies.read
CREATE OR REPLACE FUNCTION public.admin_get_policy(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.policy_documents%rowtype;
begin
  perform public.require_admin_permission('policies.read'::public.app_permission);

  select * into v from public.policy_documents where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v));
end;
$function$;

-- guard: admin_get_result_detail -> results.individual.read
CREATE OR REPLACE FUNCTION public.admin_get_result_detail(p_result_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_r public.evaluation_results%rowtype;
  v_w public.workers%rowtype;
  v_c public.evaluation_campaigns%rowtype;
  v_a public.evaluation_assignments%rowtype;
  v_answers jsonb;
begin
  perform public.require_admin_permission('results.individual.read'::public.app_permission);

  select * into v_r from public.evaluation_results where id = p_result_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_a from public.evaluation_assignments where id = v_r.assignment_id;
  select * into v_w from public.workers where id = v_r.worker_id;
  select * into v_c from public.evaluation_campaigns where id = v_r.campaign_id;

  if v_a.id is null or v_a.worker_id <> v_r.worker_id or v_a.campaign_id <> v_r.campaign_id then
    return jsonb_build_object('ok', false, 'code', 'inconsistent_result');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'questionnaireCode', ans.questionnaire_code,
    'questionId', ans.question_id,
    'answerText', ans.answer_text,
    'answerValue', ans.answer_value
  ) order by ans.questionnaire_code, ans.question_id), '[]'::jsonb)
  into v_answers
  from public.evaluation_answers ans
  where ans.assignment_id = v_r.assignment_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'result.viewed', 'evaluation_result', v_r.id,
    jsonb_build_object('assignment_id', v_r.assignment_id)
  );

  return jsonb_build_object(
    'ok', true,
    'disclaimer',
      'Resultado calculado conforme al instrumento NOM-035. No sustituye una valoración clínica profesional.',
    'detail', jsonb_build_object(
      'id', v_r.id,
      'assignmentId', v_r.assignment_id,
      'worker', jsonb_build_object(
        'id', v_w.id,
        'nombre', v_w.nombre,
        'departamento', v_w.departamento,
        'puesto', v_w.puesto
      ),
      'campaign', jsonb_build_object(
        'id', v_c.id,
        'nombre', v_c.nombre,
        'status', v_c.status
      ),
      'status', v_a.status,
      'completedAt', v_r.completed_at,
      'startedAt', v_a.started_at,
      'answers', v_answers,
      'guiaIRequiresClinicalAttention', v_r.guia_i_requires_clinical_attention,
      'guiaIRiskLabel', v_r.guia_i_risk_label,
      'finalScore', v_r.guia_ii_final_score,
      'finalRiskLevel', v_r.guia_ii_final_risk_level,
      'categoryScores', v_r.guia_ii_category_scores,
      'domainScores', v_r.guia_ii_domain_scores,
      'dimensionScores', v_r.guia_ii_dimension_scores,
      'alerts', v_r.alerts,
      'scoringVersion', v_r.scoring_version,
      'questionnaireVersion', v_r.questionnaire_version,
      'validationWarnings', v_r.validation_warnings
    )
  );
end;
$function$;

-- guard: admin_import_workers -> workers.import
CREATE OR REPLACE FUNCTION public.admin_import_workers(p_rows jsonb, p_mode text DEFAULT 'atomic'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mode text := coalesce(p_mode, 'atomic');
  v_max int := 500;
  v_row jsonb;
  v_idx int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_seen_emails text[] := '{}';
  v_seen_exts text[] := '{}';
  v_nombre text;
  v_email text;
  v_ext text;
  v_inserted int := 0;
  v_skipped int := 0;
  v_item jsonb;
begin
  perform public.require_admin_permission('workers.import'::public.app_permission);

  if v_mode not in ('atomic', 'validate_only') then
    return jsonb_build_object('ok', false, 'code', 'invalid_mode');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if jsonb_array_length(p_rows) > v_max then
    return jsonb_build_object('ok', false, 'code', 'batch_too_large', 'max', v_max);
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_nombre := public.nom035_nullif_blank(v_row->>'nombre');
    v_email := public.nom035_normalize_email(v_row->>'email');
    v_ext := public.nom035_nullif_blank(v_row->>'referencia_externa');

    if v_nombre is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'nombre_required'));
      continue;
    end if;
    if v_email is not null and not public.nom035_is_valid_email(v_email) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'email_invalid'));
      continue;
    end if;
    if v_email is not null and v_email = any (v_seen_emails) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_email_in_file'));
      continue;
    end if;
    if v_ext is not null and v_ext = any (v_seen_exts) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_external_reference_in_file'));
      continue;
    end if;
    if v_email is not null and exists (select 1 from public.workers where normalized_email = v_email) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_email'));
      continue;
    end if;
    if v_ext is not null and exists (select 1 from public.workers where external_reference = v_ext) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_external_reference'));
      continue;
    end if;

    if v_email is not null then v_seen_emails := array_append(v_seen_emails, v_email); end if;
    if v_ext is not null then v_seen_exts := array_append(v_seen_exts, v_ext); end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_failed',
      'inserted', 0,
      'skipped', 0,
      'errors', v_errors
    );
  end if;

  if v_mode = 'validate_only' then
    return jsonb_build_object(
      'ok', true,
      'mode', 'validate_only',
      'inserted', 0,
      'skipped', 0,
      'validCount', jsonb_array_length(p_rows),
      'errors', '[]'::jsonb
    );
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_item := public.admin_create_worker(
      v_row->>'nombre',
      v_row->>'email',
      v_row->>'telefono',
      v_row->>'departamento',
      v_row->>'puesto',
      v_row->>'turno',
      v_row->>'sucursal',
      v_row->>'jefe_directo',
      v_row->>'antiguedad',
      v_row->>'referencia_externa',
      coalesce((v_row->>'activo')::boolean, true)
    );
    if (v_item->>'ok')::boolean then
      v_inserted := v_inserted + 1;
    else
      -- En modo atomic no debería ocurrir tras validación previa
      raise exception 'import_atomic_failed';
    end if;
  end loop;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'workers.imported', 'worker', null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped)
  );

  return jsonb_build_object(
    'ok', true,
    'mode', 'atomic',
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', '[]'::jsonb
  );
end;
$function$;

-- guard: admin_issue_assignment -> assignments.issue
CREATE OR REPLACE FUNCTION public.admin_issue_assignment(p_campaign_id uuid, p_worker_id uuid, p_token_hash text, p_token_last4 text, p_expires_at timestamp with time zone, p_questionnaire_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_worker public.workers%rowtype;
  v_id uuid;
begin
  perform public.require_admin_permission('assignments.issue'::public.app_permission);

  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_hash');
  end if;
  if p_token_last4 is null or char_length(p_token_last4) <> 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_last4');
  end if;
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found or v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select * into v_worker from public.workers where id = p_worker_id for update;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  if exists (
    select 1 from public.evaluation_assignments
    where campaign_id = p_campaign_id and worker_id = p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_assignment');
  end if;

  insert into public.evaluation_assignments (
    campaign_id, worker_id, token_hash, token_last4, status, expires_at,
    questionnaire_version, token_issued_at
  ) values (
    p_campaign_id, p_worker_id, p_token_hash, p_token_last4, 'pending', p_expires_at,
    coalesce(p_questionnaire_version, v_campaign.questionnaire_version),
    timezone('utc', now())
  )
  returning id into v_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.issued', 'evaluation_assignment', v_id,
    jsonb_build_object('campaign_id', p_campaign_id, 'token_last4', p_token_last4)
  );

  return jsonb_build_object(
    'ok', true,
    'assignmentId', v_id,
    'status', 'pending',
    'tokenLast4', p_token_last4,
    'expiresAt', p_expires_at
  );
end;
$function$;

-- guard: admin_issue_assignments_batch -> assignments.issue
CREATE OR REPLACE FUNCTION public.admin_issue_assignments_batch(p_campaign_id uuid, p_items jsonb, p_questionnaire_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item jsonb;
  v_result jsonb;
  v_created jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_idx int := 0;
begin
  perform public.require_admin_permission('assignments.issue'::public.app_permission);

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if jsonb_array_length(p_items) > 500 then
    return jsonb_build_object('ok', false, 'code', 'batch_too_large');
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_idx := v_idx + 1;
    v_result := public.admin_issue_assignment(
      p_campaign_id,
      (v_item->>'workerId')::uuid,
      v_item->>'tokenHash',
      v_item->>'tokenLast4',
      (v_item->>'expiresAt')::timestamptz,
      coalesce(p_questionnaire_version, v_item->>'questionnaireVersion')
    );
    if (v_result->>'ok')::boolean then
      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'workerId', v_item->>'workerId',
        'assignmentId', v_result->>'assignmentId',
        'tokenLast4', v_result->>'tokenLast4'
      ));
    else
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'workerId', v_item->>'workerId',
        'code', v_result->>'code'
      ));
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    -- Fallar toda la transacción si algún elemento falla (atomicidad razonable)
    raise exception 'batch_issue_failed: %', v_errors::text;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'errors', '[]'::jsonb);
end;
$function$;

-- guard: admin_list_action_plans -> action_plans.read
CREATE OR REPLACE FUNCTION public.admin_list_action_plans(p_campaign_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_include_archived boolean DEFAULT false, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('action_plans.read'::public.app_permission);

  select count(*) into v_total
  from public.action_plans a
  where (p_campaign_id is null or a.campaign_id = p_campaign_id)
    and (p_status is null or a.status::text = p_status)
    and (p_source is null or a.source = p_source)
    and (p_include_archived or a.archived_at is null);

  select coalesce(jsonb_agg(public.admin_action_plan_to_json(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select a.*
    from public.action_plans a
    where (p_campaign_id is null or a.campaign_id = p_campaign_id)
      and (p_status is null or a.status::text = p_status)
      and (p_source is null or a.source = p_source)
      and (p_include_archived or a.archived_at is null)
    order by a.created_at desc, a.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_campaign_assignments -> campaigns.read
CREATE OR REPLACE FUNCTION public.admin_list_campaign_assignments(p_campaign_id uuid, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('campaigns.read'::public.app_permission);

  if not exists (select 1 from public.evaluation_campaigns where id = p_campaign_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select count(*) into v_total
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  where a.campaign_id = p_campaign_id
    and (p_status is null or a.status::text = p_status)
    and (v_search is null or w.nombre ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'campaignId', t.campaign_id,
    'workerId', t.worker_id,
    'workerNombre', t.worker_nombre,
    'workerActivo', t.worker_activo,
    'status', t.status,
    'tokenLast4', t.token_last4,
    'expiresAt', t.expires_at,
    'startedAt', t.started_at,
    'completedAt', t.completed_at,
    'revokedAt', t.revoked_at,
    'tokenIssuedAt', t.token_issued_at,
    'tokenRotatedAt', t.token_rotated_at,
    'questionnaireVersion', t.questionnaire_version
  ) order by t.worker_nombre, t.id), '[]'::jsonb)
  into v_items
  from (
    select
      a.*,
      w.nombre as worker_nombre,
      w.activo as worker_activo
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    where a.campaign_id = p_campaign_id
      and (p_status is null or a.status::text = p_status)
      and (v_search is null or w.nombre ilike '%' || v_search || '%')
    order by w.nombre, a.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_campaigns -> campaigns.read
CREATE OR REPLACE FUNCTION public.admin_list_campaigns(p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('campaigns.read'::public.app_permission);

  select count(*) into v_total
  from public.evaluation_campaigns c
  where (p_status is null or c.status::text = p_status)
    and (v_search is null or c.nombre ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(public.admin_campaign_to_json(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select c.*
    from public.evaluation_campaigns c
    where (p_status is null or c.status::text = p_status)
      and (v_search is null or c.nombre ilike '%' || v_search || '%')
    order by c.created_at desc, c.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_complaints -> complaints.list
CREATE OR REPLACE FUNCTION public.admin_list_complaints(p_status text DEFAULT NULL::text, p_complaint_type text DEFAULT NULL::text, p_folio text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_folio text := public.nom035_nullif_blank(p_folio);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('complaints.list'::public.app_permission);

  select count(*) into v_total
  from public.confidential_complaints c
  where (p_status is null or c.status::text = p_status)
    and (p_complaint_type is null or c.complaint_type::text = p_complaint_type)
    and (v_folio is null or c.folio ilike '%' || v_folio || '%');

  select coalesce(jsonb_agg(public.admin_complaint_list_to_json(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select c.*
    from public.confidential_complaints c
    where (p_status is null or c.status::text = p_status)
      and (p_complaint_type is null or c.complaint_type::text = p_complaint_type)
      and (v_folio is null or c.folio ilike '%' || v_folio || '%')
    order by c.created_at desc, c.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_evidence -> evidence.read
CREATE OR REPLACE FUNCTION public.admin_list_evidence(p_evidence_type text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_state text DEFAULT 'active'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_state text := coalesce(p_state, 'active');
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('evidence.read'::public.app_permission);

  select count(*) into v_total
  from public.evidence_items e
  where (p_evidence_type is null or e.evidence_type::text = p_evidence_type)
    and (
      v_state = 'all'
      or (v_state = 'active' and e.deleted_at is null and e.replaced_by_id is null)
      or (v_state = 'deleted' and e.deleted_at is not null)
      or (v_state = 'superseded' and e.replaced_by_id is not null)
      or (v_state = 'cleanup_pending' and e.storage_delete_pending = true)
    )
    and (
      v_search is null
      or e.title ilike '%' || v_search || '%'
      or e.description ilike '%' || v_search || '%'
    );

  select coalesce(jsonb_agg(public.admin_evidence_to_json(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select e.*
    from public.evidence_items e
    where (p_evidence_type is null or e.evidence_type::text = p_evidence_type)
      and (
        v_state = 'all'
        or (v_state = 'active' and e.deleted_at is null and e.replaced_by_id is null)
        or (v_state = 'deleted' and e.deleted_at is not null)
        or (v_state = 'superseded' and e.replaced_by_id is not null)
        or (v_state = 'cleanup_pending' and e.storage_delete_pending = true)
      )
      and (
        v_search is null
        or e.title ilike '%' || v_search || '%'
        or e.description ilike '%' || v_search || '%'
      )
    order by e.created_at desc, e.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_missing_assignment_workers -> assignments.issue
CREATE OR REPLACE FUNCTION public.admin_list_missing_assignment_workers(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_ids jsonb;
begin
  perform public.require_admin_permission('assignments.issue'::public.app_permission);

  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select coalesce(jsonb_agg(w.id order by w.nombre, w.id), '[]'::jsonb)
  into v_ids
  from public.workers w
  where w.activo = true
    and not exists (
      select 1 from public.evaluation_assignments a
      where a.campaign_id = p_campaign_id and a.worker_id = w.id
    );

  return jsonb_build_object('ok', true, 'workerIds', v_ids);
end;
$function$;

-- guard: admin_list_policies -> policies.read
CREATE OR REPLACE FUNCTION public.admin_list_policies(p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('policies.read'::public.app_permission);

  select count(*) into v_total from public.policy_documents;

  select coalesce(jsonb_agg(public.admin_policy_to_json(t) order by t.version_number desc, t.created_at desc), '[]'::jsonb)
  into v_items
  from (
    select p.* from public.policy_documents p
    order by p.version_number desc, p.created_at desc
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_list_results -> results.aggregate.read
CREATE OR REPLACE FUNCTION public.admin_list_results(p_campaign_id uuid DEFAULT NULL::uuid, p_worker_id uuid DEFAULT NULL::uuid, p_departamento text DEFAULT NULL::text, p_risk_level text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total int;
  v_items jsonb;
  v_search text := public.nom035_nullif_blank(p_search);
  v_dept text := public.nom035_nullif_blank(p_departamento);
begin
  perform public.require_admin_permission('results.aggregate.read'::public.app_permission);

  with filtered as (
    select
      r.id,
      r.assignment_id,
      r.worker_id,
      r.campaign_id,
      r.guia_i_requires_clinical_attention,
      r.guia_ii_final_score,
      r.guia_ii_final_risk_level,
      r.scoring_version,
      r.questionnaire_version,
      r.completed_at,
      w.nombre as worker_nombre,
      w.departamento,
      w.puesto,
      c.nombre as campaign_nombre
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_campaigns c on c.id = r.campaign_id
    where (p_campaign_id is null or r.campaign_id = p_campaign_id)
      and (p_worker_id is null or r.worker_id = p_worker_id)
      and (v_dept is null or w.departamento = v_dept)
      and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.departamento, '') ilike '%' || v_search || '%'
        or coalesce(w.puesto, '') ilike '%' || v_search || '%'
      )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      r.id,
      r.assignment_id,
      r.worker_id,
      r.campaign_id,
      r.guia_i_requires_clinical_attention,
      r.guia_ii_final_score,
      r.guia_ii_final_risk_level,
      r.scoring_version,
      r.questionnaire_version,
      r.completed_at,
      w.nombre as worker_nombre,
      w.departamento,
      w.puesto,
      c.nombre as campaign_nombre
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_campaigns c on c.id = r.campaign_id
    where (p_campaign_id is null or r.campaign_id = p_campaign_id)
      and (p_worker_id is null or r.worker_id = p_worker_id)
      and (v_dept is null or w.departamento = v_dept)
      and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.departamento, '') ilike '%' || v_search || '%'
        or coalesce(w.puesto, '') ilike '%' || v_search || '%'
      )
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t."completedAt" desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select
      id,
      assignment_id as "assignmentId",
      worker_id as "workerId",
      campaign_id as "campaignId",
      worker_nombre as "workerNombre",
      departamento,
      puesto,
      campaign_nombre as "campaignNombre",
      guia_i_requires_clinical_attention as "guiaIRequiresClinicalAttention",
      guia_ii_final_score as "finalScore",
      guia_ii_final_risk_level as "finalRiskLevel",
      scoring_version as "scoringVersion",
      questionnaire_version as "questionnaireVersion",
      completed_at as "completedAt"
    from filtered
    order by completed_at desc, id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object(
    'ok', true,
    'page', v_page,
    'pageSize', v_size,
    'total', v_total,
    'items', v_items
  );
end;
$function$;

-- guard: admin_list_workers -> workers.read
CREATE OR REPLACE FUNCTION public.admin_list_workers(p_search text DEFAULT NULL::text, p_activo boolean DEFAULT NULL::boolean, p_departamento text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_dept text := public.nom035_nullif_blank(p_departamento);
  v_total int;
  v_items jsonb;
begin
  perform public.require_admin_permission('workers.read'::public.app_permission);

  select count(*) into v_total
  from public.workers w
  where (p_activo is null or w.activo = p_activo)
    and (v_dept is null or w.departamento = v_dept)
    and (
      v_search is null
      or w.nombre ilike '%' || v_search || '%'
      or coalesce(w.email, '') ilike '%' || v_search || '%'
      or coalesce(w.external_reference, '') ilike '%' || v_search || '%'
    );

  select coalesce(jsonb_agg(public.admin_worker_to_json(t) order by t.nombre, t.id), '[]'::jsonb)
  into v_items
  from (
    select w.*
    from public.workers w
    where (p_activo is null or w.activo = p_activo)
      and (v_dept is null or w.departamento = v_dept)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.email, '') ilike '%' || v_search || '%'
        or coalesce(w.external_reference, '') ilike '%' || v_search || '%'
      )
    order by w.nombre, w.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$function$;

-- guard: admin_mark_evidence_cleanup_pending -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_mark_evidence_cleanup_pending(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  select * into v_row from public.evidence_items where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.evidence_items set
    storage_delete_pending = true,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evidence.storage_cleanup_pending', 'evidence', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'evidence', public.admin_evidence_to_json(v_row));
end;
$function$;

-- guard: admin_mark_evidence_storage_deleted -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_mark_evidence_storage_deleted(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  select * into v_row from public.evidence_items where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.evidence_items set
    storage_delete_pending = false,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  return jsonb_build_object('ok', true, 'evidence', public.admin_evidence_to_json(v_row));
end;
$function$;

-- guard: admin_policy_summary -> policies.read
CREATE OR REPLACE FUNCTION public.admin_policy_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_published jsonb;
  v_total int;
  v_drafts int;
  v_archived int;
begin
  perform public.require_admin_permission('policies.read'::public.app_permission);

  select count(*), count(*) filter (where status::text = 'borrador'),
         count(*) filter (where status::text = 'archivada')
  into v_total, v_drafts, v_archived
  from public.policy_documents;

  select public.admin_policy_to_json(p) into v_published
  from public.policy_documents p where p.status::text = 'publicada' limit 1;

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'total', v_total,
      'drafts', v_drafts,
      'archived', v_archived,
      'published', v_published
    )
  );
end;
$function$;

-- guard: admin_publish_policy -> policies.publish
CREATE OR REPLACE FUNCTION public.admin_publish_policy(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.policy_documents%rowtype;
  v_archived_id uuid;
begin
  perform public.require_admin_permission('policies.publish'::public.app_permission);

  select * into v_row from public.policy_documents where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status::text <> 'borrador' then
    return jsonb_build_object('ok', false, 'code', 'policy_not_editable');
  end if;

  -- Archivar la vigente en la misma transacción (antes de publicar la nueva).
  update public.policy_documents
  set status = 'archivada'::public.policy_status,
      archived_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where status::text = 'publicada'
  returning id into v_archived_id;

  if v_archived_id is not null then
    insert into public.audit_log (action, entity_type, entity_id, metadata)
    values ('policy.archived', 'policy', v_archived_id, jsonb_build_object('reason', 'superseded'));
  end if;

  update public.policy_documents set
    status = 'publicada'::public.policy_status,
    published_at = timezone('utc', now()),
    archived_at = null,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('policy.published', 'policy', v_row.id, jsonb_build_object('versionNumber', v_row.version_number));

  return jsonb_build_object(
    'ok', true,
    'policy', public.admin_policy_to_json(v_row),
    'archivedId', v_archived_id
  );
end;
$function$;

-- guard: admin_reactivate_worker -> workers.write
CREATE OR REPLACE FUNCTION public.admin_reactivate_worker(p_worker_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.workers%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);

  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.workers
  set activo = true,
      deactivated_at = null,
      updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  -- No reactivar assignments revoked (política documentada).
  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.updated', 'worker', v_row.id, jsonb_build_object('reactivated', true));

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$function$;

-- guard: admin_replace_evidence_metadata -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_replace_evidence_metadata(p_old_id uuid, p_storage_bucket text, p_storage_path text, p_original_file_name text, p_safe_file_name text, p_mime_type text, p_size_bytes bigint, p_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old public.evidence_items%rowtype;
  v_new public.evidence_items%rowtype;
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  select * into v_old from public.evidence_items where id = p_old_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_old.deleted_at is not null or v_old.replaced_by_id is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  insert into public.evidence_items (
    campaign_id, title, evidence_type, description, evidence_source,
    storage_bucket, storage_path, original_file_name, safe_file_name,
    mime_type, size_bytes, sha256, notes, version, supersedes_id
  ) values (
    v_old.campaign_id, v_old.title, v_old.evidence_type, v_old.description, 'upload',
    public.nom035_nullif_blank(p_storage_bucket),
    public.nom035_nullif_blank(p_storage_path),
    public.nom035_nullif_blank(p_original_file_name),
    public.nom035_nullif_blank(p_safe_file_name),
    public.nom035_nullif_blank(p_mime_type),
    p_size_bytes,
    public.nom035_nullif_blank(p_sha256),
    v_old.notes,
    v_old.version + 1,
    v_old.id
  )
  returning * into v_new;

  update public.evidence_items
  set replaced_by_id = v_new.id, updated_at = timezone('utc', now())
  where id = v_old.id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evidence.replaced', 'evidence', v_new.id,
          jsonb_build_object('supersedesId', v_old.id, 'version', v_new.version));

  return jsonb_build_object(
    'ok', true,
    'evidence', public.admin_evidence_to_json(v_new),
    'previousStoragePath', v_old.storage_path,
    'previousBucket', v_old.storage_bucket
  );
end;
$function$;

-- guard: admin_reports_summary -> reports.generate
CREATE OR REPLACE FUNCTION public.admin_reports_summary(p_campaign_id uuid DEFAULT NULL::uuid, p_departamento text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company jsonb;
  v_campaign jsonb;
  v_dept text := public.nom035_nullif_blank(p_departamento);
  v_registered int;
  v_assignments int;
  v_completed int;
  v_levels jsonb;
  v_categories jsonb;
  v_domains jsonb;
  v_dimensions jsonb;
  v_guia_i jsonb;
  v_scoring text;
  v_qversion text;
begin
  perform public.require_admin_permission('reports.generate'::public.app_permission);

  select (public.admin_get_company_settings())->'company' into v_company;

  if p_campaign_id is not null then
    select public.admin_campaign_to_json(c) into v_campaign
    from public.evaluation_campaigns c where c.id = p_campaign_id;
    if v_campaign is null then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
  else
    select public.admin_campaign_to_json(c) into v_campaign
    from public.evaluation_campaigns c where c.status = 'active' limit 1;
  end if;

  select count(*) into v_registered from public.workers where activo;

  select
    count(*),
    count(*) filter (where a.status = 'completed')
  into v_assignments, v_completed
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  where (v_campaign is null or a.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select coalesce(jsonb_object_agg(lvl, cnt), '{}'::jsonb)
  into v_levels
  from (
    select r.guia_ii_final_risk_level::text as lvl, count(*) as cnt
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
    group by r.guia_ii_final_risk_level
  ) s;

  -- Agregados jsonb de scores (promedio del campo score en objetos anidados)
  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_categories
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_category_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_domains
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_domain_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_dimensions
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_dimension_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select jsonb_build_object(
    'clinicalAttentionCount', count(*) filter (where r.guia_i_requires_clinical_attention),
    'totalWithGuiaI', count(*)
  )
  into v_guia_i
  from public.evaluation_results r
  join public.workers w on w.id = r.worker_id
  where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select r.scoring_version, r.questionnaire_version
  into v_scoring, v_qversion
  from public.evaluation_results r
  where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
  order by r.completed_at desc
  limit 1;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'report.generated', 'report', null,
    jsonb_build_object(
      'campaign_id', v_campaign->>'id',
      'departamento', v_dept,
      'completed', v_completed
    )
  );

  return jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'company', v_company,
      'campaign', v_campaign,
      'departamento', v_dept,
      'registeredWorkers', v_registered,
      'assignments', v_assignments,
      'completed', v_completed,
      'participationRate', case when v_assignments = 0 then 0
        else round((v_completed::numeric / v_assignments::numeric) * 100, 2) end,
      'riskLevels', v_levels,
      'categoryAverages', v_categories,
      'domainAverages', v_domains,
      'dimensionAverages', v_dimensions,
      'guiaIAggregate', v_guia_i,
      'scoringVersion', v_scoring,
      'questionnaireVersion', v_qversion,
      'generatedAt', timezone('utc', now())
    )
  );
end;
$function$;

-- guard: admin_resolve_complaint -> complaints.manage
CREATE OR REPLACE FUNCTION public.admin_resolve_complaint(p_id uuid, p_category text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.confidential_complaints%rowtype;
begin
  perform public.require_admin_permission('complaints.manage'::public.app_permission);

  select * into v from public.confidential_complaints where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status <> 'en_revision' then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  update public.confidential_complaints set
    status = 'resuelta',
    resolution_category = public.nom035_nullif_blank(p_category),
    resolution_notes = public.nom035_nullif_blank(p_notes),
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('complaint.resolved', 'complaint', v.id,
          jsonb_build_object('hasCategory', v.resolution_category is not null));

  return jsonb_build_object('ok', true, 'complaint', public.admin_complaint_list_to_json(v));
end;
$function$;

-- guard: admin_revoke_assignment -> assignments.revoke
CREATE OR REPLACE FUNCTION public.admin_revoke_assignment(p_assignment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evaluation_assignments%rowtype;
  v_reason text := public.nom035_nullif_blank(p_reason);
begin
  perform public.require_admin_permission('assignments.revoke'::public.app_permission);

  select * into v_row from public.evaluation_assignments where id = p_assignment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status not in ('pending', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.evaluation_assignments
  set status = 'revoked',
      revoked_at = timezone('utc', now()),
      revoked_reason = v_reason,
      updated_at = timezone('utc', now())
  where id = p_assignment_id
  returning * into v_row;

  update public.evaluation_sessions
  set revoked_at = timezone('utc', now())
  where assignment_id = p_assignment_id and revoked_at is null;

  delete from public.evaluation_drafts where assignment_id = p_assignment_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.revoked', 'evaluation_assignment', v_row.id,
    jsonb_build_object('had_reason', v_reason is not null)
  );

  return jsonb_build_object('ok', true, 'assignmentId', v_row.id, 'status', 'revoked');
end;
$function$;

-- guard: admin_rotate_assignment_token -> assignments.rotate
CREATE OR REPLACE FUNCTION public.admin_rotate_assignment_token(p_assignment_id uuid, p_token_hash text, p_token_last4 text, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evaluation_assignments%rowtype;
  v_worker public.workers%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
begin
  perform public.require_admin_permission('assignments.rotate'::public.app_permission);

  select * into v_row from public.evaluation_assignments where id = p_assignment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status not in ('pending', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_hash');
  end if;
  if p_token_last4 is null or char_length(p_token_last4) <> 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_last4');
  end if;
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_worker from public.workers where id = v_row.worker_id;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;
  select * into v_campaign from public.evaluation_campaigns where id = v_row.campaign_id;
  if not found or v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  update public.evaluation_assignments
  set token_hash = p_token_hash,
      token_last4 = p_token_last4,
      expires_at = p_expires_at,
      token_rotated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_assignment_id
  returning * into v_row;

  update public.evaluation_sessions
  set revoked_at = timezone('utc', now())
  where assignment_id = p_assignment_id and revoked_at is null;

  -- Draft se conserva (política rotate)

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.token_rotated', 'evaluation_assignment', v_row.id,
    jsonb_build_object('status', v_row.status, 'token_last4', p_token_last4)
  );

  return jsonb_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'status', v_row.status,
    'tokenLast4', p_token_last4,
    'expiresAt', p_expires_at,
    'startedAt', v_row.started_at
  );
end;
$function$;

-- guard: admin_soft_delete_evidence -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_soft_delete_evidence(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  select * into v_row from public.evidence_items where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.deleted_at is not null then
    return jsonb_build_object('ok', true, 'evidence', public.admin_evidence_to_json(v_row));
  end if;

  update public.evidence_items set
    deleted_at = timezone('utc', now()),
    storage_delete_pending = (v_row.evidence_source = 'upload'),
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evidence.deleted', 'evidence', v_row.id,
          jsonb_build_object('source', v_row.evidence_source));

  return jsonb_build_object(
    'ok', true,
    'evidence', public.admin_evidence_to_json(v_row),
    'storagePath', v_row.storage_path,
    'storageBucket', v_row.storage_bucket
  );
end;
$function$;

-- guard: admin_update_action_plan -> action_plans.write
CREATE OR REPLACE FUNCTION public.admin_update_action_plan(p_id uuid, p_area text DEFAULT NULL::text, p_risk_factor text DEFAULT NULL::text, p_risk_level text DEFAULT NULL::text, p_action_level text DEFAULT NULL::text, p_action_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_responsible text DEFAULT NULL::text, p_due_date date DEFAULT NULL::date, p_follow_up_notes text DEFAULT NULL::text, p_clear_due_date boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.action_plans%rowtype;
begin
  perform public.require_admin_permission('action_plans.write'::public.app_permission);

  select * into v_row from public.action_plans where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.archived_at is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.action_plans set
    area = coalesce(public.nom035_nullif_blank(p_area), area),
    risk_factor = coalesce(public.nom035_nullif_blank(p_risk_factor), risk_factor),
    risk_level = coalesce(p_risk_level::public.risk_level, risk_level),
    action_level = coalesce(p_action_level::public.action_level, action_level),
    action_type = coalesce(p_action_type::public.action_type, action_type),
    description = coalesce(public.nom035_nullif_blank(p_description), description),
    responsible = coalesce(public.nom035_nullif_blank(p_responsible), responsible),
    due_date = case when p_clear_due_date then null else coalesce(p_due_date, due_date) end,
    follow_up_notes = case when p_follow_up_notes is null then follow_up_notes
                           else coalesce(public.nom035_nullif_blank(p_follow_up_notes), '') end,
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('action_plan.updated', 'action_plan', v_row.id,
          jsonb_build_object('version', v_row.version));

  return jsonb_build_object('ok', true, 'actionPlan', public.admin_action_plan_to_json(v_row));
end;
$function$;

-- guard: admin_update_campaign -> campaigns.write
CREATE OR REPLACE FUNCTION public.admin_update_campaign(p_campaign_id uuid, p_nombre text DEFAULT NULL::text, p_descripcion text DEFAULT NULL::text, p_fecha_inicio date DEFAULT NULL::date, p_fecha_cierre date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evaluation_campaigns%rowtype;
  v_nombre text;
  v_fi date;
  v_fc date;
begin
  perform public.require_admin_permission('campaigns.write'::public.app_permission);

  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'campaign_closed');
  end if;

  v_nombre := coalesce(public.nom035_nullif_blank(p_nombre), v_row.nombre);
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  v_fi := coalesce(p_fecha_inicio, v_row.fecha_inicio);
  v_fc := coalesce(p_fecha_cierre, v_row.fecha_cierre);
  if v_fc is not null and v_fi is not null and v_fc < v_fi then
    return jsonb_build_object('ok', false, 'code', 'invalid_dates');
  end if;

  update public.evaluation_campaigns set
    nombre = v_nombre,
    descripcion = case when p_descripcion is null then descripcion else public.nom035_nullif_blank(p_descripcion) end,
    fecha_inicio = v_fi,
    fecha_cierre = v_fc,
    updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.updated', 'evaluation_campaign', v_row.id, jsonb_build_object('status', v_row.status));

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$function$;

-- guard: admin_update_evidence_metadata -> evidence.write
CREATE OR REPLACE FUNCTION public.admin_update_evidence_metadata(p_id uuid, p_title text DEFAULT NULL::text, p_evidence_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.evidence_items%rowtype;
begin
  perform public.require_admin_permission('evidence.write'::public.app_permission);

  select * into v_row from public.evidence_items where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.evidence_items set
    title = coalesce(public.nom035_nullif_blank(p_title), title),
    evidence_type = coalesce(p_evidence_type::public.evidence_type, evidence_type),
    description = case when p_description is null then description
                      else coalesce(public.nom035_nullif_blank(p_description), '') end,
    notes = case when p_notes is null then notes else public.nom035_nullif_blank(p_notes) end,
    version = version + 1,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evidence.updated', 'evidence', v_row.id, jsonb_build_object('version', v_row.version));

  return jsonb_build_object('ok', true, 'evidence', public.admin_evidence_to_json(v_row));
end;
$function$;

-- guard: admin_update_policy_draft -> policies.write
CREATE OR REPLACE FUNCTION public.admin_update_policy_draft(p_id uuid, p_title text DEFAULT NULL::text, p_content text DEFAULT NULL::text, p_version_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.policy_documents%rowtype;
  v_label text := public.nom035_nullif_blank(p_version_label);
begin
  perform public.require_admin_permission('policies.write'::public.app_permission);

  select * into v_row from public.policy_documents where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status::text <> 'borrador' then
    return jsonb_build_object('ok', false, 'code', 'policy_not_editable');
  end if;
  if v_label is not null and exists (
    select 1 from public.policy_documents where version_label = v_label and id <> p_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_version_label');
  end if;

  update public.policy_documents set
    title = coalesce(public.nom035_nullif_blank(p_title), title),
    content = coalesce(public.nom035_nullif_blank(p_content), content),
    version_label = coalesce(v_label, version_label),
    version = coalesce(v_label, version),
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('policy.updated', 'policy', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v_row));
end;
$function$;

-- guard: admin_update_worker -> workers.write
CREATE OR REPLACE FUNCTION public.admin_update_worker(p_worker_id uuid, p_nombre text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_departamento text DEFAULT NULL::text, p_puesto text DEFAULT NULL::text, p_turno text DEFAULT NULL::text, p_sucursal text DEFAULT NULL::text, p_jefe_directo text DEFAULT NULL::text, p_antiguedad text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.workers%rowtype;
  v_nombre text;
  v_email text;
  v_phone text;
  v_ext text;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);

  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_nombre := coalesce(public.nom035_nullif_blank(p_nombre), v_row.nombre);
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;

  if p_email is null then
    v_email := v_row.normalized_email;
  else
    v_email := public.nom035_normalize_email(p_email);
  end if;
  if v_email is not null and not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_email is not null and exists (
    select 1 from public.workers where normalized_email = v_email and id <> p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_email');
  end if;

  if p_external_reference is null then
    v_ext := v_row.external_reference;
  else
    v_ext := public.nom035_nullif_blank(p_external_reference);
  end if;
  if v_ext is not null and exists (
    select 1 from public.workers where external_reference = v_ext and id <> p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_external_reference');
  end if;

  v_phone := case
    when p_telefono is null then v_row.normalized_phone
    else public.nom035_normalize_phone(p_telefono)
  end;

  update public.workers set
    nombre = v_nombre,
    email = case when p_email is null then email else v_email end,
    telefono = case when p_telefono is null then telefono else public.nom035_nullif_blank(p_telefono) end,
    departamento = case when p_departamento is null then departamento else public.nom035_nullif_blank(p_departamento) end,
    puesto = case when p_puesto is null then puesto else public.nom035_nullif_blank(p_puesto) end,
    turno = case when p_turno is null then turno else public.nom035_nullif_blank(p_turno) end,
    sucursal = case when p_sucursal is null then sucursal else public.nom035_nullif_blank(p_sucursal) end,
    jefe_directo = case when p_jefe_directo is null then jefe_directo else public.nom035_nullif_blank(p_jefe_directo) end,
    antiguedad = case when p_antiguedad is null then antiguedad else public.nom035_nullif_blank(p_antiguedad) end,
    external_reference = v_ext,
    normalized_email = v_email,
    normalized_phone = v_phone,
    updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker.updated', 'worker', v_row.id,
    jsonb_build_object('departamento', v_row.departamento, 'activo', v_row.activo)
  );

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$function$;

-- guard: admin_upsert_company_settings -> company.write
CREATE OR REPLACE FUNCTION public.admin_upsert_company_settings(p_razon_social text, p_rfc text DEFAULT NULL::text, p_domicilio text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_actividad_principal text DEFAULT NULL::text, p_total_trabajadores integer DEFAULT 0, p_responsable_nombre text DEFAULT NULL::text, p_responsable_email text DEFAULT NULL::text, p_responsable_telefono text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_razon text := public.nom035_nullif_blank(p_razon_social);
  v_rfc text := public.nom035_nullif_blank(p_rfc);
  v_email text := public.nom035_normalize_email(p_responsable_email);
  v_row public.company_settings%rowtype;
begin
  perform public.require_admin_permission('company.write'::public.app_permission);

  if v_razon is null then
    return jsonb_build_object('ok', false, 'code', 'razon_social_required');
  end if;
  if p_total_trabajadores is null or p_total_trabajadores < 0 then
    return jsonb_build_object('ok', false, 'code', 'total_trabajadores_invalid');
  end if;
  if not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_rfc is not null then
    v_rfc := upper(v_rfc);
  end if;

  insert into public.company_settings as cs (
    razon_social, rfc, domicilio, telefono, actividad_principal,
    total_trabajadores, responsable_nombre, responsable_email, responsable_telefono
  ) values (
    v_razon, v_rfc,
    public.nom035_nullif_blank(p_domicilio),
    public.nom035_nullif_blank(p_telefono),
    public.nom035_nullif_blank(p_actividad_principal),
    p_total_trabajadores,
    public.nom035_nullif_blank(p_responsable_nombre),
    v_email,
    public.nom035_nullif_blank(p_responsable_telefono)
  )
  on conflict (singleton_lock) do update set
    razon_social = excluded.razon_social,
    rfc = excluded.rfc,
    domicilio = excluded.domicilio,
    telefono = excluded.telefono,
    actividad_principal = excluded.actividad_principal,
    total_trabajadores = excluded.total_trabajadores,
    responsable_nombre = excluded.responsable_nombre,
    responsable_email = excluded.responsable_email,
    responsable_telefono = excluded.responsable_telefono,
    updated_at = timezone('utc', now())
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'company.updated', 'company_settings', v_row.id,
    jsonb_build_object('total_trabajadores', v_row.total_trabajadores)
  );

  return jsonb_build_object(
    'ok', true,
    'company', jsonb_build_object(
      'id', v_row.id,
      'razonSocial', v_row.razon_social,
      'rfc', v_row.rfc,
      'domicilio', v_row.domicilio,
      'telefono', v_row.telefono,
      'actividadPrincipal', v_row.actividad_principal,
      'totalTrabajadores', v_row.total_trabajadores,
      'responsableNombre', v_row.responsable_nombre,
      'responsableEmail', v_row.responsable_email,
      'responsableTelefono', v_row.responsable_telefono,
      'updatedAt', v_row.updated_at
    )
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- G) Grants: authenticated + service_role; revocar anon/public
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'admin_%'
        or p.proname in (
          'current_admin_profile','current_admin_role','has_admin_permission',
          'require_admin_permission','require_admin_permission_aal2','is_active_admin_user',
          'nom035_current_aal','nom035_jwt_role','nom035_write_auth_audit','count_active_admins'
        )
      )
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('revoke all on function %s from anon', f.sig);
    -- helpers SQL internos (*_to_json) solo service_role
    if f.proname like '%_to_json' then
      execute format('revoke all on function %s from authenticated', f.sig);
      execute format('grant execute on function %s to service_role', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end;
$$;

revoke all on table public.admin_profiles from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
-- service_role: aprovisionamiento/compensación (seed, Auth admin flows)
grant all on table public.admin_profiles to service_role;
grant all on table public.role_permissions to service_role;
grant all on table public.audit_log to service_role;

comment on type public.app_permission is 'B4.6: permisos del portal administrativo NOM-035';
comment on table public.role_permissions is 'B4.6: matriz rol→permiso (autoridad en DB)';
comment on function public.require_admin_permission(public.app_permission) is
  'B4.6: valida auth.uid + perfil activo + role_permissions + sensitive + AAL2';
