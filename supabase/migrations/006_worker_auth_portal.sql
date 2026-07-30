-- =============================================================================
-- B4.9 · Portal autenticado de trabajadores (worker_accounts)
-- Singleton company_settings → company_id. Contraseñas solo en Auth.
-- Reutiliza evaluation_sessions / draft / submit existentes.
-- =============================================================================

create table if not exists public.worker_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings (id) on delete restrict,
  worker_id uuid not null references public.workers (id) on delete restrict,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  username_normalized text not null,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint worker_accounts_worker_id_unique unique (worker_id),
  constraint worker_accounts_auth_user_id_unique unique (auth_user_id),
  constraint worker_accounts_company_username_unique unique (company_id, username_normalized),
  constraint worker_accounts_username_normalized_chk check (
    username_normalized = lower(btrim(username_normalized))
    and length(username_normalized) between 3 and 64
    and username_normalized ~ '^[a-z0-9][a-z0-9._-]*$'
  )
);

create index if not exists idx_worker_accounts_username
  on public.worker_accounts (username_normalized);

create index if not exists idx_worker_accounts_active
  on public.worker_accounts (is_active);

create trigger trg_worker_accounts_updated_at
before update on public.worker_accounts
for each row execute function public.set_updated_at();

alter table public.worker_accounts enable row level security;
alter table public.worker_accounts force row level security;
revoke all on table public.worker_accounts from anon, authenticated, public;
grant all on table public.worker_accounts to service_role;

comment on table public.worker_accounts is
  'B4.9: vínculo 1:1 Auth↔worker. Sin passwords/tokens. Contraseña solo en Supabase Auth.';

-- Sin políticas permisivas ni grants a authenticated: acceso solo vía SECURITY DEFINER RPCs.
-- (misma postura de denegación por defecto que B4.2–B4.6)

create or replace function public.nom035_normalize_username(p text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p, ''))), '');
$$;

create or replace function public.current_worker_account()
returns public.worker_accounts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.worker_accounts%rowtype;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into v_row
  from public.worker_accounts
  where auth_user_id = auth.uid()
  limit 1;
  return v_row;
end;
$$;

revoke all on function public.current_worker_account() from public, anon, authenticated;
grant execute on function public.current_worker_account() to authenticated, service_role;

create or replace function public.worker_get_portal_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.worker_accounts%rowtype;
  v_worker public.workers%rowtype;
  v_asg public.evaluation_assignments%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
  v_eval_status text;
begin
  v_acc := public.current_worker_account();
  if v_acc.id is null then
    return jsonb_build_object('ok', false, 'code', 'account_missing');
  end if;
  if v_acc.is_active is not true then
    return jsonb_build_object('ok', false, 'code', 'account_disabled');
  end if;

  select * into v_worker from public.workers where id = v_acc.worker_id;
  if not found or v_worker.activo is not true then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  select a.* into v_asg
  from public.evaluation_assignments a
  join public.evaluation_campaigns c on c.id = a.campaign_id
  where a.worker_id = v_worker.id
    and c.status = 'active'
    and a.status <> 'revoked'
  order by
    case a.status
      when 'in_progress' then 0
      when 'pending' then 1
      when 'completed' then 2
      else 3
    end,
    a.created_at desc
  limit 1;

  if v_asg.id is null then
    v_eval_status := 'none';
  else
    v_eval_status := v_asg.status::text;
    select * into v_campaign from public.evaluation_campaigns where id = v_asg.campaign_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mustChangePassword', v_acc.must_change_password,
    'account', jsonb_build_object(
      'id', v_acc.id,
      'username', v_acc.username_normalized,
      'isActive', v_acc.is_active
    ),
    'worker', jsonb_build_object(
      'id', v_worker.id,
      'nombre', v_worker.nombre,
      'externalReference', v_worker.external_reference,
      'departamento', v_worker.departamento,
      'puesto', v_worker.puesto
    ),
    'assignment', case when v_asg.id is null then null else jsonb_build_object(
      'id', v_asg.id,
      'status', v_asg.status,
      'campaignId', v_asg.campaign_id,
      'campaignName', v_campaign.nombre,
      'startedAt', v_asg.started_at,
      'completedAt', v_asg.completed_at
    ) end,
    'evaluationStatus', v_eval_status
  );
end;
$$;

revoke all on function public.worker_get_portal_state() from public, anon;
grant execute on function public.worker_get_portal_state() to authenticated, service_role;

create or replace function public.open_evaluation_session_for_worker(
  p_worker_id uuid,
  p_session_hash text,
  p_session_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.evaluation_assignments%rowtype;
  v_state text;
begin
  if p_worker_id is null or public.nom035_nullif_blank(p_session_hash) is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select a.* into v_assignment
  from public.evaluation_assignments a
  where a.id = (
    select a2.id
    from public.evaluation_assignments a2
    join public.evaluation_campaigns c on c.id = a2.campaign_id
    where a2.worker_id = p_worker_id
      and c.status = 'active'
      and a2.status in ('pending', 'in_progress')
    order by
      case a2.status when 'in_progress' then 0 else 1 end,
      a2.created_at desc
    limit 1
  )
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_assignment');
  end if;

  if v_assignment.questionnaire_version <> 'nom035-stps-2018-guias-referencia-i-ii' then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  update public.evaluation_sessions
    set revoked_at = timezone('utc', now())
    where assignment_id = v_assignment.id and revoked_at is null;

  insert into public.evaluation_sessions (assignment_id, session_hash, expires_at, last_seen_at)
  values (v_assignment.id, p_session_hash, p_session_expires_at, timezone('utc', now()));

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker_session_created',
    'evaluation_assignment',
    v_assignment.id,
    jsonb_build_object('workerId', p_worker_id)
  );

  return jsonb_build_object('ok', true, 'context',
    public.build_public_assignment_context(v_assignment.id));
end;
$$;

revoke all on function public.open_evaluation_session_for_worker(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.open_evaluation_session_for_worker(uuid, text, timestamptz) to service_role;

create or replace function public.admin_resolve_worker_login(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := public.nom035_normalize_username(p_username);
  v_acc public.worker_accounts%rowtype;
  v_email text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select wa.* into v_acc
  from public.worker_accounts wa
  where wa.username_normalized = v_user
  limit 1;

  if not found then
    select wa.* into v_acc
    from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where lower(btrim(coalesce(w.external_reference, ''))) = v_user
    limit 1;
  end if;

  -- Permite escribir el correo Auth (p. ej. prueba@trabajador.com) en el campo usuario.
  if not found then
    select wa.* into v_acc
    from public.worker_accounts wa
    join auth.users u on u.id = wa.auth_user_id
    where lower(btrim(coalesce(u.email, ''))) = v_user
    limit 1;
  end if;

  if not found or v_acc.is_active is not true then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_acc.auth_user_id;

  if v_email is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'authUserId', v_acc.auth_user_id,
    'workerId', v_acc.worker_id,
    'accountId', v_acc.id,
    'email', v_email,
    'mustChangePassword', v_acc.must_change_password
  );
end;
$$;

revoke all on function public.admin_resolve_worker_login(text) from public, anon, authenticated;
grant execute on function public.admin_resolve_worker_login(text) to service_role;

create or replace function public.worker_mark_login(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.worker_accounts
    set last_login_at = timezone('utc', now())
  where auth_user_id = p_auth_user_id and is_active = true;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.worker_clear_must_change_password(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.worker_accounts
    set must_change_password = false
  where auth_user_id = p_auth_user_id and is_active = true;
  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker_password_changed',
    'worker_account',
    p_auth_user_id,
    '{}'::jsonb
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.worker_mark_login(uuid) from public, anon, authenticated;
revoke all on function public.worker_clear_must_change_password(uuid) from public, anon, authenticated;
grant execute on function public.worker_mark_login(uuid) to service_role;
grant execute on function public.worker_clear_must_change_password(uuid) to service_role;

create or replace function public.admin_set_worker_account_active(
  p_worker_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.worker_accounts%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);
  update public.worker_accounts
    set is_active = coalesce(p_active, false)
  where worker_id = p_worker_id
  returning * into v_acc;
  if v_acc.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    case when p_active then 'worker_account_reactivated' else 'worker_account_blocked' end,
    'worker_account',
    v_acc.id,
    jsonb_build_object('workerId', p_worker_id)
  );
  return jsonb_build_object('ok', true, 'isActive', v_acc.is_active);
end;
$$;

create or replace function public.admin_force_worker_password_change(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.worker_accounts%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);
  update public.worker_accounts
    set must_change_password = true
  where worker_id = p_worker_id
  returning * into v_acc;
  if v_acc.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker_password_reset_forced', 'worker_account', v_acc.id, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reset_worker_access(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_acc public.worker_accounts%rowtype;
begin
  perform public.require_admin_permission('workers.write'::public.app_permission);
  select * into v_acc from public.worker_accounts where worker_id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.worker_accounts
    set must_change_password = true, is_active = true
  where id = v_acc.id;

  -- Revoca sesiones Auth del trabajador (sin tocar passwords; Auth Admin las rotó).
  delete from auth.refresh_tokens where user_id = v_acc.auth_user_id;
  delete from auth.sessions where user_id = v_acc.auth_user_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker_access_reset',
    'worker_account',
    v_acc.id,
    jsonb_build_object('workerId', p_worker_id)
  );

  return jsonb_build_object('ok', true, 'accountId', v_acc.id);
end;
$$;

revoke all on function public.admin_set_worker_account_active(uuid, boolean) from public, anon;
revoke all on function public.admin_force_worker_password_change(uuid) from public, anon;
revoke all on function public.admin_reset_worker_access(uuid) from public, anon;
grant execute on function public.admin_set_worker_account_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_force_worker_password_change(uuid) to authenticated, service_role;
grant execute on function public.admin_reset_worker_access(uuid) to authenticated, service_role;

-- Enrichment admin workers: accountStatus + evaluationStatus (sin secretos)
create or replace function public.admin_worker_portal_status(p_worker_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_acc public.worker_accounts%rowtype;
  v_asg public.evaluation_assignments%rowtype;
  v_account_status text := 'sin_cuenta';
  v_eval_status text := 'sin_asignar';
begin
  select * into v_acc from public.worker_accounts where worker_id = p_worker_id limit 1;
  if found then
    if v_acc.is_active is not true then
      v_account_status := 'bloqueado';
    elsif v_acc.must_change_password then
      v_account_status := 'invitado';
    else
      v_account_status := 'activo';
    end if;
  end if;

  select a.* into v_asg
  from public.evaluation_assignments a
  join public.evaluation_campaigns c on c.id = a.campaign_id
  where a.worker_id = p_worker_id
    and a.status <> 'revoked'
  order by
    case when c.status = 'active' then 0 else 1 end,
    case a.status
      when 'in_progress' then 0
      when 'pending' then 1
      when 'completed' then 2
      else 3
    end,
    a.created_at desc
  limit 1;

  if found then
    v_eval_status := case v_asg.status
      when 'pending' then 'pendiente'
      when 'in_progress' then 'en_progreso'
      when 'completed' then 'completada'
      else v_asg.status::text
    end;
  end if;

  return jsonb_build_object(
    'accountStatus', v_account_status,
    'evaluationStatus', v_eval_status,
    'evaluationStartedAt', v_asg.started_at,
    'evaluationCompletedAt', v_asg.completed_at
  );
end;
$$;

revoke all on function public.admin_worker_portal_status(uuid) from public, anon;
grant execute on function public.admin_worker_portal_status(uuid) to authenticated, service_role;

create or replace function public.admin_list_workers(
  p_search text default null,
  p_activo boolean default null,
  p_departamento text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  select coalesce(
    jsonb_agg(
      public.admin_worker_to_json(t) || public.admin_worker_portal_status(t.id)
      order by t.nombre, t.id
    ),
    '[]'::jsonb
  )
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

  return jsonb_build_object(
    'ok', true,
    'page', v_page,
    'pageSize', v_size,
    'total', v_total,
    'items', v_items
  );
end;
$$;
