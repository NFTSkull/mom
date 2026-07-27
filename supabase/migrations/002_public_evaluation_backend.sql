-- =============================================================================
-- NOM-035 · B4.3 · Backend de evaluación pública por token
-- Solo local. NO remoto / NO db push.
-- Añade: columnas de versión + submission_id, drafts, sessions, rate limits,
-- trigger de transiciones monótonas y funciones atómicas server-only.
-- Todas las funciones: SECURITY DEFINER, search_path fijo, EXECUTE solo a
-- service_role (revocado de PUBLIC/anon/authenticated).
-- =============================================================================

-- Versión de cuestionario soportada (debe coincidir con NOM035_QUESTIONNAIRE_VERSION).
-- -----------------------------------------------------------------------------
-- A) evaluation_assignments — versión + refuerzos
-- -----------------------------------------------------------------------------
alter table public.evaluation_assignments
  add column if not exists questionnaire_version text not null
    default 'nom035-stps-2018-guias-referencia-i-ii';

-- -----------------------------------------------------------------------------
-- B) evaluation_results — versión + submission_id + validation_warnings
-- -----------------------------------------------------------------------------
alter table public.evaluation_results
  add column if not exists questionnaire_version text not null
    default 'nom035-stps-2018-guias-referencia-i-ii';
alter table public.evaluation_results
  add column if not exists submission_id uuid;
alter table public.evaluation_results
  add column if not exists validation_warnings jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.evaluation_results
    add constraint evaluation_results_submission_id_unique unique (submission_id);
exception when duplicate_object then null;
end $$;

-- submission_id obligatorio para resultados nuevos (tabla vacía en migración limpia).
do $$ begin
  alter table public.evaluation_results
    alter column submission_id set not null;
exception when others then
  -- Si hubiera filas legacy sin submission_id, no forzar (no aplica en local limpio).
  null;
end $$;

-- -----------------------------------------------------------------------------
-- C) evaluation_drafts — borrador central (sin scores/token/PII)
-- -----------------------------------------------------------------------------
create table if not exists public.evaluation_drafts (
  assignment_id uuid primary key
    references public.evaluation_assignments (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_evaluation_drafts_updated_at
before update on public.evaluation_drafts
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- D) evaluation_sessions — sesión HttpOnly (solo hash)
-- -----------------------------------------------------------------------------
create table if not exists public.evaluation_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null
    references public.evaluation_assignments (id) on delete cascade,
  session_hash text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_sessions_session_hash_unique unique (session_hash)
);

create index if not exists idx_evaluation_sessions_assignment_id
  on public.evaluation_sessions (assignment_id);
create index if not exists idx_evaluation_sessions_expires_at
  on public.evaluation_sessions (expires_at);
create index if not exists idx_evaluation_sessions_revoked_at
  on public.evaluation_sessions (revoked_at);

-- Solo una sesión ACTIVA (no revocada) por assignment.
create unique index if not exists uq_evaluation_sessions_one_active
  on public.evaluation_sessions (assignment_id)
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- E) public_rate_limits — sin IP/token/user-agent en claro
-- -----------------------------------------------------------------------------
create table if not exists public.public_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null default timezone('utc', now()),
  request_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (key_hash, action)
);

-- -----------------------------------------------------------------------------
-- F) Transiciones monótonas de assignment (trigger BEFORE UPDATE)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_assignment_transition()
returns trigger
language plpgsql
as $$
begin
  -- Coherencia de timestamps por estado.
  if new.status = 'pending' then
    if new.completed_at is not null or new.revoked_at is not null then
      raise exception 'pending no puede tener completed_at ni revoked_at'
        using errcode = '23514';
    end if;
  elsif new.status = 'in_progress' then
    if new.started_at is null then
      raise exception 'in_progress requiere started_at' using errcode = '23514';
    end if;
    if new.completed_at is not null or new.revoked_at is not null then
      raise exception 'in_progress no puede tener completed_at ni revoked_at'
        using errcode = '23514';
    end if;
  end if;

  -- Transiciones permitidas.
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('in_progress', 'revoked') then
    return new;
  end if;

  if old.status = 'in_progress' and new.status in ('completed', 'revoked') then
    return new;
  end if;

  raise exception 'transición de estado no permitida: % -> %', old.status, new.status
    using errcode = '23514';
end;
$$;

revoke all on function public.enforce_assignment_transition() from public;
revoke all on function public.enforce_assignment_transition() from anon, authenticated;

drop trigger if exists trg_enforce_assignment_transition on public.evaluation_assignments;
create trigger trg_enforce_assignment_transition
before update on public.evaluation_assignments
for each row execute function public.enforce_assignment_transition();

-- -----------------------------------------------------------------------------
-- RLS + FORCE + REVOKE en tablas nuevas (sin políticas).
-- -----------------------------------------------------------------------------
alter table public.evaluation_drafts enable row level security;
alter table public.evaluation_sessions enable row level security;
alter table public.public_rate_limits enable row level security;
alter table public.evaluation_drafts force row level security;
alter table public.evaluation_sessions force row level security;
alter table public.public_rate_limits force row level security;

revoke all on table public.evaluation_drafts from anon, authenticated;
revoke all on table public.evaluation_sessions from anon, authenticated;
revoke all on table public.public_rate_limits from anon, authenticated;
revoke all on table public.evaluation_drafts from public;
revoke all on table public.evaluation_sessions from public;
revoke all on table public.public_rate_limits from public;

-- =============================================================================
-- FUNCIONES ATÓMICAS (server-only vía service_role)
-- =============================================================================

-- A) create_public_evaluation_assignment
create or replace function public.create_public_evaluation_assignment(
  p_campaign_id uuid,
  p_worker_id uuid,
  p_token_hash text,
  p_token_last4 text,
  p_expires_at timestamptz,
  p_questionnaire_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_worker public.workers%rowtype;
  v_id uuid;
begin
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id;
  if not found or v_campaign.status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select * into v_worker from public.workers where id = p_worker_id;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  if exists (
    select 1 from public.evaluation_assignments
    where campaign_id = p_campaign_id and worker_id = p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_assignment');
  end if;

  insert into public.evaluation_assignments
    (campaign_id, worker_id, token_hash, token_last4, status, expires_at, questionnaire_version)
  values
    (p_campaign_id, p_worker_id, p_token_hash, p_token_last4, 'pending', p_expires_at,
     coalesce(p_questionnaire_version, 'nom035-stps-2018-guias-referencia-i-ii'))
  returning id into v_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('assignment_created', 'evaluation_assignment', v_id,
          jsonb_build_object('campaign_id', p_campaign_id));

  return jsonb_build_object('ok', true, 'assignmentId', v_id, 'status', 'pending',
                            'expiresAt', p_expires_at);
end;
$$;

-- Contexto mínimo del assignment (nunca token_hash/worker_id/PII de contacto).
create or replace function public.build_public_assignment_context(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx jsonb;
begin
  select jsonb_build_object(
    'assignmentId', a.id,
    'workerName', w.nombre,
    'campaignId', c.id,
    'campaignName', c.nombre,
    'status', a.status,
    'startedAt', a.started_at,
    'expiresAt', a.expires_at,
    'questionnaireVersion', a.questionnaire_version,
    'draft', (select d.payload from public.evaluation_drafts d where d.assignment_id = a.id)
  )
  into v_ctx
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  join public.evaluation_campaigns c on c.id = a.campaign_id
  where a.id = p_assignment_id;

  return v_ctx;
end;
$$;

-- Validación de estado de assignment/campaña/worker. Devuelve código o 'ok'.
create or replace function public.check_assignment_usable(p_assignment public.evaluation_assignments)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
begin
  if p_assignment.status = 'revoked' then return 'revoked'; end if;
  if p_assignment.status = 'completed' then return 'completed'; end if;
  if p_assignment.expires_at is not null and p_assignment.expires_at <= timezone('utc', now()) then
    return 'expired';
  end if;

  select * into v_worker from public.workers where id = p_assignment.worker_id;
  if not found or v_worker.activo = false then return 'worker_inactive'; end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_assignment.campaign_id;
  if not found or v_campaign.status <> 'active' then return 'campaign_unavailable'; end if;
  if v_campaign.fecha_inicio is not null and v_campaign.fecha_inicio > (timezone('utc', now()))::date then
    return 'campaign_unavailable';
  end if;
  if v_campaign.fecha_cierre is not null and v_campaign.fecha_cierre < (timezone('utc', now()))::date then
    return 'campaign_unavailable';
  end if;

  return 'ok';
end;
$$;

-- B) exchange_evaluation_token
create or replace function public.exchange_evaluation_token(
  p_token_hash text,
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
  select * into v_assignment
  from public.evaluation_assignments
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_assignment.questionnaire_version <> 'nom035-stps-2018-guias-referencia-i-ii' then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  -- Revocar sesiones activas anteriores del mismo assignment.
  update public.evaluation_sessions
    set revoked_at = timezone('utc', now())
    where assignment_id = v_assignment.id and revoked_at is null;

  insert into public.evaluation_sessions (assignment_id, session_hash, expires_at, last_seen_at)
  values (v_assignment.id, p_session_hash, p_session_expires_at, timezone('utc', now()));

  insert into public.audit_log (action, entity_type, entity_id)
  values ('session_created', 'evaluation_assignment', v_assignment.id);

  return jsonb_build_object('ok', true, 'context',
    public.build_public_assignment_context(v_assignment.id));
end;
$$;

-- Resuelve sesión válida → assignment (o null). Actualiza nada.
create or replace function public.resolve_active_session(p_session_hash text)
returns public.evaluation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.evaluation_sessions%rowtype;
begin
  select * into v_session
  from public.evaluation_sessions
  where session_hash = p_session_hash;
  if not found then
    return null;
  end if;
  return v_session;
end;
$$;

-- C) get_evaluation_session_context
create or replace function public.get_evaluation_session_context(p_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.evaluation_sessions%rowtype;
  v_assignment public.evaluation_assignments%rowtype;
  v_state text;
begin
  v_session := public.resolve_active_session(p_session_hash);
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'session_revoked');
  end if;
  if v_session.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;

  select * into v_assignment from public.evaluation_assignments where id = v_session.assignment_id;
  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  return jsonb_build_object('ok', true, 'context',
    public.build_public_assignment_context(v_assignment.id));
end;
$$;

-- D) start_public_evaluation
create or replace function public.start_public_evaluation(p_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.evaluation_sessions%rowtype;
  v_assignment public.evaluation_assignments%rowtype;
  v_state text;
begin
  v_session := public.resolve_active_session(p_session_hash);
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'session_revoked');
  end if;
  if v_session.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;

  select * into v_assignment from public.evaluation_assignments
    where id = v_session.assignment_id for update;

  if v_assignment.status = 'completed' then
    return jsonb_build_object('ok', false, 'code', 'completed');
  end if;
  if v_assignment.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  if v_assignment.status = 'pending' then
    update public.evaluation_assignments
      set status = 'in_progress', started_at = timezone('utc', now())
      where id = v_assignment.id;
    insert into public.audit_log (action, entity_type, entity_id)
    values ('evaluation_started', 'evaluation_assignment', v_assignment.id);
  end if;

  update public.evaluation_sessions set last_seen_at = timezone('utc', now())
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'context',
    public.build_public_assignment_context(v_assignment.id));
end;
$$;

-- E) save_public_evaluation_draft
create or replace function public.save_public_evaluation_draft(
  p_session_hash text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.evaluation_sessions%rowtype;
  v_assignment public.evaluation_assignments%rowtype;
  v_existing public.evaluation_drafts%rowtype;
  v_updated timestamptz;
begin
  v_session := public.resolve_active_session(p_session_hash);
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'session_revoked');
  end if;
  if v_session.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;

  select * into v_assignment from public.evaluation_assignments
    where id = v_session.assignment_id for update;

  if v_assignment.status not in ('pending', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', v_assignment.status::text);
  end if;

  select * into v_existing from public.evaluation_drafts where assignment_id = v_assignment.id;
  if found and p_expected_updated_at is not null
     and v_existing.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'stale_draft',
                              'updatedAt', v_existing.updated_at);
  end if;

  insert into public.evaluation_drafts (assignment_id, payload, updated_at)
  values (v_assignment.id, p_payload, timezone('utc', now()))
  on conflict (assignment_id) do update
    set payload = excluded.payload, updated_at = timezone('utc', now())
  returning updated_at into v_updated;

  update public.evaluation_sessions set last_seen_at = timezone('utc', now())
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'updatedAt', v_updated);
end;
$$;

-- F) submit_public_evaluation
create or replace function public.submit_public_evaluation(
  p_session_hash text,
  p_submission_id uuid,
  p_answers jsonb,
  p_result jsonb,
  p_questionnaire_version text,
  p_scoring_version text,
  p_calculated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.evaluation_sessions%rowtype;
  v_assignment public.evaluation_assignments%rowtype;
  v_existing public.evaluation_results%rowtype;
  v_state text;
  v_answer jsonb;
  v_completed_at timestamptz;
begin
  v_session := public.resolve_active_session(p_session_hash);
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'session_revoked');
  end if;
  if v_session.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;

  select * into v_assignment from public.evaluation_assignments
    where id = v_session.assignment_id for update;

  -- Idempotencia / conflicto si ya está completed.
  if v_assignment.status = 'completed' then
    select * into v_existing from public.evaluation_results
      where assignment_id = v_assignment.id;
    if found and v_existing.submission_id = p_submission_id then
      return jsonb_build_object('ok', true, 'code', 'already_completed',
        'completedAt', v_assignment.completed_at, 'submissionId', p_submission_id);
    end if;
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  if v_assignment.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  -- Reemplazar respuestas parciales por las canónicas.
  delete from public.evaluation_answers where assignment_id = v_assignment.id;

  for v_answer in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    insert into public.evaluation_answers
      (assignment_id, questionnaire_code, question_id, answer_value, answer_text)
    values (
      v_assignment.id,
      v_answer->>'questionnaire_code',
      v_answer->>'question_id',
      v_answer->>'answer_value',
      v_answer->>'answer_text'
    );
  end loop;

  v_completed_at := timezone('utc', now());

  -- Un único resultado; worker/campaign SIEMPRE desde el assignment.
  insert into public.evaluation_results (
    assignment_id, worker_id, campaign_id,
    guia_i_requires_clinical_attention, guia_i_risk_label,
    guia_ii_final_score, guia_ii_final_risk_level,
    guia_ii_category_scores, guia_ii_domain_scores, guia_ii_dimension_scores,
    alerts, scoring_version, questionnaire_version, submission_id,
    validation_warnings, completed_at
  ) values (
    v_assignment.id, v_assignment.worker_id, v_assignment.campaign_id,
    coalesce((p_result->>'guia_i_requires_clinical_attention')::boolean, false),
    p_result->>'guia_i_risk_label',
    nullif(p_result->>'guia_ii_final_score','')::integer,
    nullif(p_result->>'guia_ii_final_risk_level','')::public.risk_level,
    coalesce(p_result->'guia_ii_category_scores', '{}'::jsonb),
    coalesce(p_result->'guia_ii_domain_scores', '{}'::jsonb),
    coalesce(p_result->'guia_ii_dimension_scores', '{}'::jsonb),
    coalesce(p_result->'alerts', '[]'::jsonb),
    p_scoring_version, p_questionnaire_version, p_submission_id,
    coalesce(p_result->'validation_warnings', '[]'::jsonb),
    coalesce(p_calculated_at, v_completed_at)
  );

  update public.evaluation_assignments
    set status = 'completed', completed_at = v_completed_at
    where id = v_assignment.id;

  delete from public.evaluation_drafts where assignment_id = v_assignment.id;

  update public.evaluation_sessions set revoked_at = timezone('utc', now())
    where assignment_id = v_assignment.id and revoked_at is null;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evaluation_completed', 'evaluation_assignment', v_assignment.id,
          jsonb_build_object('submission_id', p_submission_id));

  return jsonb_build_object('ok', true, 'completedAt', v_completed_at,
                            'submissionId', p_submission_id);
end;
$$;

-- G) consume_public_rate_limit
create or replace function public.consume_public_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.public_rate_limits%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_count integer;
  v_window_start timestamptz;
begin
  select * into v_row from public.public_rate_limits
    where key_hash = p_key_hash and action = p_action
    for update;

  if not found then
    insert into public.public_rate_limits (key_hash, action, window_started_at, request_count, updated_at)
    values (p_key_hash, p_action, v_now, 1, v_now);
    v_count := 1;
    v_window_start := v_now;
  elsif v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.public_rate_limits
      set window_started_at = v_now, request_count = 1, updated_at = v_now
      where key_hash = p_key_hash and action = p_action;
    v_count := 1;
    v_window_start := v_now;
  else
    update public.public_rate_limits
      set request_count = request_count + 1, updated_at = v_now
      where key_hash = p_key_hash and action = p_action
      returning request_count into v_count;
    v_window_start := v_row.window_started_at;
  end if;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'retryAfter',
      case when v_count <= p_limit then 0
      else ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::int
      end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de las funciones: EXECUTE solo a service_role.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.create_public_evaluation_assignment(uuid, uuid, text, text, timestamptz, text)',
    'public.build_public_assignment_context(uuid)',
    'public.check_assignment_usable(public.evaluation_assignments)',
    'public.exchange_evaluation_token(text, text, timestamptz)',
    'public.resolve_active_session(text)',
    'public.get_evaluation_session_context(text)',
    'public.start_public_evaluation(text)',
    'public.save_public_evaluation_draft(text, jsonb, timestamptz)',
    'public.submit_public_evaluation(text, uuid, jsonb, jsonb, text, text, timestamptz)',
    'public.consume_public_rate_limit(text, text, integer, integer)'
  ]
  loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon, authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- GRANTs mínimos a service_role (rol privilegiado server-only).
-- Solo tablas de configuración/administración base para gestión desde el servidor
-- (emisión de enlaces, futuro panel admin). Las tablas sensibles del flujo público
-- (answers, results, drafts, sessions, rate_limits) NO reciben GRANT directo:
-- solo son accesibles vía las funciones SECURITY DEFINER de arriba.
-- service_role tiene BYPASSRLS; estos GRANTs habilitan el acceso vía Data API.
-- anon/authenticated permanecen sin acceso (cerrado por 001).
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on table public.company_settings to service_role;
grant select, insert, update, delete on table public.workers to service_role;
grant select, insert, update, delete on table public.evaluation_campaigns to service_role;
grant select, insert, update, delete on table public.evaluation_assignments to service_role;
