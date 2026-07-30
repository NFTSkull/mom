-- =============================================================================
-- B4.10 · Cableado productivo Guía III
-- - assignment_questionnaires (I + II|III)
-- - result_snapshot jsonb
-- - allowlist de questionnaire_version I+II e I+III en exchange / open worker
-- - submit guarda result_snapshot
-- =============================================================================

create table if not exists public.assignment_questionnaires (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments (id) on delete cascade,
  questionnaire_type text not null
    check (questionnaire_type in ('GUIA_I', 'GUIA_II', 'GUIA_III')),
  questionnaire_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted', 'revoked')),
  started_at timestamptz null,
  submitted_at timestamptz null,
  last_saved_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint assignment_questionnaires_unique unique (assignment_id, questionnaire_type)
);

create index if not exists idx_assignment_questionnaires_assignment
  on public.assignment_questionnaires (assignment_id);
create index if not exists idx_assignment_questionnaires_status
  on public.assignment_questionnaires (status);

create trigger trg_assignment_questionnaires_updated_at
before update on public.assignment_questionnaires
for each row execute function public.set_updated_at();

alter table public.assignment_questionnaires enable row level security;
alter table public.assignment_questionnaires force row level security;
revoke all on table public.assignment_questionnaires from anon, authenticated, public;
grant all on table public.assignment_questionnaires to service_role;

create or replace function public.enforce_assignment_questionnaire_mutex()
returns trigger
language plpgsql
as $$
begin
  if new.questionnaire_type in ('GUIA_II', 'GUIA_III') then
    if exists (
      select 1 from public.assignment_questionnaires aq
      where aq.assignment_id = new.assignment_id
        and aq.questionnaire_type in ('GUIA_II', 'GUIA_III')
        and aq.questionnaire_type <> new.questionnaire_type
        and (tg_op = 'INSERT' or aq.id <> new.id)
    ) then
      raise exception 'Guía II y Guía III son mutuamente excluyentes en el mismo assignment';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assignment_questionnaire_mutex on public.assignment_questionnaires;
create trigger trg_assignment_questionnaire_mutex
before insert or update on public.assignment_questionnaires
for each row execute function public.enforce_assignment_questionnaire_mutex();

alter table public.evaluation_results
  add column if not exists result_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.nom035_is_supported_questionnaire_version(p text)
returns boolean
language sql
immutable
as $$
  select coalesce(p, '') in (
    'nom035-stps-2018-guias-referencia-i-ii',
    'nom035-stps-2018-guias-referencia-i-iii'
  );
$$;

-- Sembrar instrumentos a partir de questionnaire_version del assignment
create or replace function public.ensure_assignment_questionnaires(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version text;
begin
  select questionnaire_version into v_version
  from public.evaluation_assignments where id = p_assignment_id;
  if v_version is null then
    return;
  end if;

  insert into public.assignment_questionnaires (
    assignment_id, questionnaire_type, questionnaire_version, status
  ) values (
    p_assignment_id, 'GUIA_I', v_version, 'pending'
  ) on conflict (assignment_id, questionnaire_type) do nothing;

  if v_version = 'nom035-stps-2018-guias-referencia-i-ii' then
    insert into public.assignment_questionnaires (
      assignment_id, questionnaire_type, questionnaire_version, status
    ) values (
      p_assignment_id, 'GUIA_II', v_version, 'pending'
    ) on conflict (assignment_id, questionnaire_type) do nothing;
  elsif v_version = 'nom035-stps-2018-guias-referencia-i-iii' then
    insert into public.assignment_questionnaires (
      assignment_id, questionnaire_type, questionnaire_version, status
    ) values (
      p_assignment_id, 'GUIA_III', v_version, 'pending'
    ) on conflict (assignment_id, questionnaire_type) do nothing;
  end if;
end;
$$;

revoke all on function public.ensure_assignment_questionnaires(uuid) from public, anon, authenticated;
grant execute on function public.ensure_assignment_questionnaires(uuid) to service_role;

-- exchange: allowlist I+II e I+III
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

  if not public.nom035_is_supported_questionnaire_version(v_assignment.questionnaire_version) then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  perform public.ensure_assignment_questionnaires(v_assignment.id);

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

-- open worker: misma allowlist
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

  if not public.nom035_is_supported_questionnaire_version(v_assignment.questionnaire_version) then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  perform public.ensure_assignment_questionnaires(v_assignment.id);

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

-- submit: persiste result_snapshot y marca instrumentos
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
  v_snapshot jsonb;
begin
  v_session := public.resolve_active_session(p_session_hash);
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  select * into v_assignment from public.evaluation_assignments
    where id = v_session.assignment_id for update;

  -- Idempotencia: aunque la sesión ya esté revocada tras un submit exitoso.
  if v_assignment.status = 'completed' then
    select * into v_existing from public.evaluation_results
      where assignment_id = v_assignment.id;
    if found and v_existing.submission_id = p_submission_id then
      return jsonb_build_object('ok', true, 'code', 'already_completed',
        'completedAt', v_assignment.completed_at, 'submissionId', p_submission_id);
    end if;
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'session_revoked');
  end if;
  if v_session.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;

  if v_assignment.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_assignment.questionnaire_version is distinct from p_questionnaire_version then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  if not public.nom035_is_supported_questionnaire_version(v_assignment.questionnaire_version) then
    return jsonb_build_object('ok', false, 'code', 'version_mismatch');
  end if;

  v_state := public.check_assignment_usable(v_assignment);
  if v_state <> 'ok' then
    return jsonb_build_object('ok', false, 'code', v_state);
  end if;

  perform public.ensure_assignment_questionnaires(v_assignment.id);

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
  v_snapshot := coalesce(p_result->'result_snapshot', '{}'::jsonb);

  insert into public.evaluation_results (
    assignment_id, worker_id, campaign_id,
    guia_i_requires_clinical_attention, guia_i_risk_label,
    guia_ii_final_score, guia_ii_final_risk_level,
    guia_ii_category_scores, guia_ii_domain_scores, guia_ii_dimension_scores,
    alerts, scoring_version, questionnaire_version, submission_id,
    validation_warnings, completed_at, result_snapshot
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
    coalesce(p_calculated_at, v_completed_at),
    v_snapshot
  );

  update public.assignment_questionnaires
    set status = 'submitted',
        submitted_at = v_completed_at,
        started_at = coalesce(started_at, v_completed_at)
    where assignment_id = v_assignment.id
      and questionnaire_type in ('GUIA_I', 'GUIA_II', 'GUIA_III')
      and status <> 'revoked';

  update public.evaluation_assignments
    set status = 'completed', completed_at = v_completed_at
    where id = v_assignment.id;

  delete from public.evaluation_drafts where assignment_id = v_assignment.id;

  update public.evaluation_sessions set revoked_at = timezone('utc', now())
    where assignment_id = v_assignment.id and revoked_at is null;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('evaluation_completed', 'evaluation_assignment', v_assignment.id,
          jsonb_build_object(
            'submission_id', p_submission_id,
            'questionnaire_version', p_questionnaire_version
          ));

  return jsonb_build_object('ok', true, 'completedAt', v_completed_at,
                            'submissionId', p_submission_id);
end;
$$;

-- Contexto público: instrumentos del assignment
create or replace function public.build_public_assignment_context(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx jsonb;
  v_instruments jsonb;
begin
  perform public.ensure_assignment_questionnaires(p_assignment_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'questionnaireType', aq.questionnaire_type,
    'questionnaireVersion', aq.questionnaire_version,
    'status', aq.status,
    'startedAt', aq.started_at,
    'submittedAt', aq.submitted_at,
    'lastSavedAt', aq.last_saved_at
  ) order by aq.questionnaire_type), '[]'::jsonb)
  into v_instruments
  from public.assignment_questionnaires aq
  where aq.assignment_id = p_assignment_id;

  select jsonb_build_object(
    'assignmentId', a.id,
    'workerName', w.nombre,
    'campaignId', c.id,
    'campaignName', c.nombre,
    'status', a.status,
    'startedAt', a.started_at,
    'expiresAt', a.expires_at,
    'questionnaireVersion', a.questionnaire_version,
    'instruments', v_instruments,
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

-- Al iniciar: marca Guía I in_progress
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

  perform public.ensure_assignment_questionnaires(v_assignment.id);

  if v_assignment.status = 'pending' then
    update public.evaluation_assignments
      set status = 'in_progress', started_at = timezone('utc', now())
      where id = v_assignment.id;
    insert into public.audit_log (action, entity_type, entity_id)
    values ('evaluation_started', 'evaluation_assignment', v_assignment.id);
  end if;

  update public.assignment_questionnaires
    set status = case when status = 'pending' then 'in_progress' else status end,
        started_at = coalesce(started_at, timezone('utc', now())),
        last_saved_at = timezone('utc', now())
    where assignment_id = v_assignment.id
      and questionnaire_type = 'GUIA_I'
      and status <> 'revoked';

  update public.evaluation_sessions set last_seen_at = timezone('utc', now())
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'context',
    public.build_public_assignment_context(v_assignment.id));
end;
$$;

-- Draft: actualiza last_saved_at e instrumento FRP según stage
create or replace function public.sync_assignment_instruments_from_draft(
  p_assignment_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text := coalesce(p_payload->>'stage', '');
  v_now timestamptz := timezone('utc', now());
begin
  perform public.ensure_assignment_questionnaires(p_assignment_id);

  update public.assignment_questionnaires
    set last_saved_at = v_now
    where assignment_id = p_assignment_id and status <> 'revoked';

  if v_stage in ('guia_ii', 'guia_iii', 'review') then
    update public.assignment_questionnaires
      set status = case when status = 'pending' then 'in_progress' else status end,
          started_at = coalesce(started_at, v_now),
          last_saved_at = v_now
      where assignment_id = p_assignment_id
        and questionnaire_type in ('GUIA_II', 'GUIA_III')
        and status <> 'revoked'
        and status <> 'submitted';

    -- Guía I se considera enviada al avanzar al FRP (flujo UI secuencial)
    update public.assignment_questionnaires
      set status = case when status <> 'submitted' then 'submitted' else status end,
          submitted_at = coalesce(submitted_at, v_now),
          last_saved_at = v_now
      where assignment_id = p_assignment_id
        and questionnaire_type = 'GUIA_I'
        and status <> 'revoked';
  end if;
end;
$$;

revoke all on function public.sync_assignment_instruments_from_draft(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_assignment_instruments_from_draft(uuid, jsonb) to service_role;

-- Patch save_public_evaluation_draft to sync instruments (redefine full body from 002 + sync)
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
  values (v_assignment.id, coalesce(p_payload, '{}'::jsonb), timezone('utc', now()))
  on conflict (assignment_id) do update
    set payload = excluded.payload, updated_at = timezone('utc', now())
  returning updated_at into v_updated;

  if v_assignment.status = 'pending' then
    update public.evaluation_assignments
      set status = 'in_progress', started_at = coalesce(started_at, timezone('utc', now()))
      where id = v_assignment.id;
  end if;

  perform public.sync_assignment_instruments_from_draft(v_assignment.id, coalesce(p_payload, '{}'::jsonb));

  update public.evaluation_sessions set last_seen_at = timezone('utc', now())
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'updatedAt', v_updated);
end;
$$;

-- Admin list: estados por instrumento
create or replace function public.admin_list_campaign_assignments(
  p_campaign_id uuid,
  p_status text default null,
  p_search text default null,
  p_page int default 1,
  p_page_size int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    and (v_search is null or w.nombre ilike '%' || v_search || '%'
         or coalesce(w.external_reference,'') ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'campaignId', t.campaign_id,
    'workerId', t.worker_id,
    'workerNombre', t.worker_nombre,
    'workerNumero', t.worker_numero,
    'workerPuesto', t.worker_puesto,
    'workerDepartamento', t.worker_departamento,
    'workerActivo', t.worker_activo,
    'accountStatus', t.account_status,
    'status', t.status,
    'tokenLast4', t.token_last4,
    'expiresAt', t.expires_at,
    'startedAt', t.started_at,
    'completedAt', t.completed_at,
    'lastActivityAt', t.last_activity_at,
    'revokedAt', t.revoked_at,
    'tokenIssuedAt', t.token_issued_at,
    'tokenRotatedAt', t.token_rotated_at,
    'questionnaireVersion', t.questionnaire_version,
    'guiaIStatus', t.guia_i_status,
    'guiaIIStatus', t.guia_ii_status,
    'guiaIIIStatus', t.guia_iii_status
  ) order by t.worker_nombre, t.id), '[]'::jsonb)
  into v_items
  from (
    select
      a.*,
      w.nombre as worker_nombre,
      w.external_reference as worker_numero,
      w.puesto as worker_puesto,
      w.departamento as worker_departamento,
      w.activo as worker_activo,
      case
        when wa.id is null then 'sin_cuenta'
        when wa.is_active then 'activa'
        else 'inactiva'
      end as account_status,
      greatest(
        a.started_at,
        a.completed_at,
        (select max(aq.last_saved_at) from public.assignment_questionnaires aq where aq.assignment_id = a.id)
      ) as last_activity_at,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_I' limit 1) as guia_i_status,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_II' limit 1) as guia_ii_status,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_III' limit 1) as guia_iii_status
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    left join public.worker_accounts wa on wa.worker_id = w.id
    where a.campaign_id = p_campaign_id
      and (p_status is null or a.status::text = p_status)
      and (v_search is null or w.nombre ilike '%' || v_search || '%'
           or coalesce(w.external_reference,'') ilike '%' || v_search || '%')
    order by w.nombre, a.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$$;
