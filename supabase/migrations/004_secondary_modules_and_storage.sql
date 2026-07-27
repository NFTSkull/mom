-- =============================================================================
-- NOM-035 · B4.5 · Módulos secundarios centrales + Supabase Storage privado
-- Solo local. NO remoto / NO db push / NO buckets públicos.
--
-- MATRIZ DE CAMBIOS (documentada antes de alterar):
-- | Requisito                         | Esquema actual (001-003)        | Cambio 004                                   | Riesgo |
-- |-----------------------------------|---------------------------------|----------------------------------------------|--------|
-- | Plan: fuente/idempotencia/estados | action_plans básico, due NOT NULL| +source/source_key/version/*_at, due nullable | bajo   |
-- | Plan: no regresión de estado      | sin trigger                      | trigger enforce_action_plan_transition        | bajo   |
-- | Evidencia: archivo/versionado     | storage_path suelto, sin source  | evidence_source + storage/version/soft-delete | medio  |
-- | Storage privado                   | sin bucket                       | bucket nom035-evidence privado + MIME limit   | medio  |
-- | Quejas: folio/estado/privacidad   | folio libre, sin submission_id   | folio secuencial, submission/confirmation, +estados | medio |
-- | Política: versionado/archivada    | borrador/publicada              | enum 'archivada' + version_number/label       | medio  |
-- | Audit                             | audit_log genérico               | eventos B4.5 vía RPC (sin PII)               | bajo   |
--
-- Compatibilidad: las nuevas columnas NOT NULL usan DEFAULT seguro para no
-- romper inserts directos de pruebas pgTAP previas. Las funciones/servicios
-- siempre pasan valores explícitos.
-- =============================================================================

-- =============================================================================
-- 3A) action_plans
-- =============================================================================

alter table public.action_plans
  add column if not exists source text not null default 'manual',
  add column if not exists source_key text,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists created_by uuid references auth.users (id),
  add column if not exists updated_by uuid references auth.users (id),
  add column if not exists version integer not null default 1;

-- due_date pasa a nullable (B4.5).
alter table public.action_plans alter column due_date drop not null;

alter table public.action_plans drop constraint if exists action_plans_source_ok;
alter table public.action_plans
  add constraint action_plans_source_ok check (source in ('manual', 'suggested'));

alter table public.action_plans drop constraint if exists action_plans_description_not_blank;
alter table public.action_plans
  add constraint action_plans_description_not_blank check (length(btrim(description)) > 0);

alter table public.action_plans drop constraint if exists action_plans_version_positive;
alter table public.action_plans
  add constraint action_plans_version_positive check (version > 0);

alter table public.action_plans drop constraint if exists action_plans_suggested_key_ok;
alter table public.action_plans
  add constraint action_plans_suggested_key_ok
  check (source <> 'suggested' or source_key is not null);

alter table public.action_plans drop constraint if exists action_plans_status_timestamps_ok;
alter table public.action_plans
  add constraint action_plans_status_timestamps_ok check (
    (status = 'pendiente' and completed_at is null and cancelled_at is null)
    or (status = 'en_proceso' and completed_at is null and cancelled_at is null)
    or (status = 'completada' and completed_at is not null and cancelled_at is null)
    or (status = 'cancelada' and cancelled_at is not null and completed_at is null)
  );

-- Evitar duplicados sugeridos activos por (campaña, source_key).
create unique index if not exists uq_action_plans_suggested
  on public.action_plans (campaign_id, source_key)
  where source = 'suggested' and archived_at is null;

create index if not exists idx_action_plans_archived_at
  on public.action_plans (archived_at) where archived_at is not null;

-- Transiciones controladas (no regresión de estados terminales).
create or replace function public.enforce_action_plan_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'pendiente' and new.status in ('en_proceso', 'completada', 'cancelada') then
    return new;
  end if;
  if old.status = 'en_proceso' and new.status in ('completada', 'cancelada') then
    return new;
  end if;
  raise exception 'transición de acción no permitida: % -> %', old.status, new.status
    using errcode = '23514';
end;
$$;

revoke all on function public.enforce_action_plan_transition() from public;
revoke all on function public.enforce_action_plan_transition() from anon, authenticated;

drop trigger if exists trg_enforce_action_plan_transition on public.action_plans;
create trigger trg_enforce_action_plan_transition
before update on public.action_plans
for each row execute function public.enforce_action_plan_transition();

-- =============================================================================
-- 3B) evidence_items
-- =============================================================================

alter table public.evidence_items
  add column if not exists evidence_source text,
  add column if not exists storage_bucket text,
  add column if not exists safe_file_name text,
  add column if not exists external_url text,
  add column if not exists sha256 text,
  add column if not exists version integer not null default 1,
  add column if not exists supersedes_id uuid references public.evidence_items (id),
  add column if not exists replaced_by_id uuid references public.evidence_items (id),
  add column if not exists deleted_at timestamptz,
  add column if not exists storage_delete_pending boolean not null default false,
  add column if not exists updated_by uuid references auth.users (id);

-- Backfill + NOT NULL (tabla vacía en reset limpio).
update public.evidence_items
set evidence_source = coalesce(
  evidence_source,
  case when storage_path is not null then 'upload' else 'external' end
)
where evidence_source is null;

alter table public.evidence_items
  alter column evidence_source set not null;

alter table public.evidence_items drop constraint if exists evidence_items_source_ok;
alter table public.evidence_items
  add constraint evidence_items_source_ok check (evidence_source in ('upload', 'external'));

alter table public.evidence_items drop constraint if exists evidence_items_title_not_blank;
alter table public.evidence_items
  add constraint evidence_items_title_not_blank check (length(btrim(title)) > 0);

alter table public.evidence_items drop constraint if exists evidence_items_version_positive;
alter table public.evidence_items
  add constraint evidence_items_version_positive check (version > 0);

-- size_bytes: si presente, > 0 y <= 15 MB. (Reemplaza el check >= 0 de 001.)
alter table public.evidence_items drop constraint if exists evidence_items_size_bytes_check;
alter table public.evidence_items drop constraint if exists evidence_items_size_bytes_range;
alter table public.evidence_items
  add constraint evidence_items_size_bytes_range
  check (size_bytes is null or (size_bytes > 0 and size_bytes <= 15728640));

alter table public.evidence_items drop constraint if exists evidence_items_sha256_hex;
alter table public.evidence_items
  add constraint evidence_items_sha256_hex
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

-- Sin path traversal ni rutas absolutas.
alter table public.evidence_items drop constraint if exists evidence_items_path_safe;
alter table public.evidence_items
  add constraint evidence_items_path_safe
  check (
    storage_path is null
    or (position('..' in storage_path) = 0 and left(storage_path, 1) <> '/')
  );

-- MIME permitido solo para uploads.
alter table public.evidence_items drop constraint if exists evidence_items_mime_allowed;
alter table public.evidence_items
  add constraint evidence_items_mime_allowed
  check (
    evidence_source <> 'upload'
    or mime_type in ('application/pdf', 'image/jpeg', 'image/png')
  );

-- Coherencia por tipo de fuente.
alter table public.evidence_items drop constraint if exists evidence_items_source_fields_ok;
alter table public.evidence_items
  add constraint evidence_items_source_fields_ok check (
    (
      evidence_source = 'upload'
      and storage_bucket is not null
      and storage_path is not null
      and safe_file_name is not null
      and mime_type is not null
      and size_bytes is not null
      and sha256 is not null
      and external_url is null
    )
    or (
      evidence_source = 'external'
      and external_url is not null
      and external_url ~* '^https://'
      and storage_path is null
      and storage_bucket is null
    )
  );

-- Un reemplazo debe apuntar a una evidencia distinta.
alter table public.evidence_items drop constraint if exists evidence_items_supersedes_distinct;
alter table public.evidence_items
  add constraint evidence_items_supersedes_distinct
  check (supersedes_id is null or supersedes_id <> id);
alter table public.evidence_items drop constraint if exists evidence_items_replaced_distinct;
alter table public.evidence_items
  add constraint evidence_items_replaced_distinct
  check (replaced_by_id is null or replaced_by_id <> id);

create index if not exists idx_evidence_items_deleted_at
  on public.evidence_items (deleted_at) where deleted_at is not null;
create index if not exists idx_evidence_items_cleanup_pending
  on public.evidence_items (storage_delete_pending) where storage_delete_pending = true;

-- =============================================================================
-- 3C) Storage privado: bucket nom035-evidence
-- Idempotente: reafirma privacidad y límites tras cada db reset.
-- No se crean políticas en storage.objects; sin acceso anon/authenticated.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nom035-evidence',
  'nom035-evidence',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- =============================================================================
-- 3D) confidential_complaints
-- =============================================================================

alter table public.confidential_complaints
  add column if not exists public_submission_id uuid not null default gen_random_uuid(),
  add column if not exists confirmation_code text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  add column if not exists closed_at timestamptz,
  add column if not exists resolution_category text,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_label text,
  add column if not exists version integer not null default 1;

do $$ begin
  alter table public.confidential_complaints
    add constraint confidential_complaints_submission_unique unique (public_submission_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.confidential_complaints
    add constraint confidential_complaints_confirmation_unique unique (confirmation_code);
exception when duplicate_object then null;
end $$;

alter table public.confidential_complaints drop constraint if exists confidential_complaints_description_not_blank;
alter table public.confidential_complaints
  add constraint confidential_complaints_description_not_blank
  check (length(btrim(description)) > 0);

-- identificada exige al menos nombre o contacto.
alter table public.confidential_complaints drop constraint if exists confidential_complaints_identified_has_data;
alter table public.confidential_complaints
  add constraint confidential_complaints_identified_has_data
  check (is_anonymous = true or (reporter_name is not null or reporter_contact is not null));

-- cerrada exige closed_at; no-cerrada no debe portar closed_at.
alter table public.confidential_complaints drop constraint if exists confidential_complaints_closed_coherent;
alter table public.confidential_complaints
  add constraint confidential_complaints_closed_coherent
  check (
    (status = 'cerrada' and closed_at is not null)
    or (status <> 'cerrada' and closed_at is null)
  );

alter table public.confidential_complaints drop constraint if exists confidential_complaints_version_positive;
alter table public.confidential_complaints
  add constraint confidential_complaints_version_positive check (version > 0);

-- Secuencia de folios atómica (sin count(*)+1).
create sequence if not exists public.nom035_complaint_folio_seq;

create or replace function public.nom035_next_complaint_folio()
returns text
language sql
as $$
  select 'NOM035-Q-' || to_char(timezone('utc', now()), 'YYYY') || '-'
    || lpad(nextval('public.nom035_complaint_folio_seq')::text, 6, '0');
$$;

revoke all on function public.nom035_next_complaint_folio() from public;
revoke all on function public.nom035_next_complaint_folio() from anon, authenticated;

-- =============================================================================
-- 3E) policy_documents
-- =============================================================================

-- Nuevo valor de enum. Se compara siempre vía ::text en DDL para evitar
-- "unsafe use of new value" dentro de la misma transacción de migración.
alter type public.policy_status add value if not exists 'archivada';

alter table public.policy_documents
  add column if not exists supersedes_id uuid references public.policy_documents (id),
  add column if not exists archived_at timestamptz,
  add column if not exists created_by uuid references auth.users (id),
  add column if not exists updated_by uuid references auth.users (id),
  add column if not exists version_number integer not null default 1,
  add column if not exists version_label text not null default encode(extensions.gen_random_bytes(8), 'hex');

alter table public.policy_documents drop constraint if exists policy_documents_title_not_blank;
alter table public.policy_documents
  add constraint policy_documents_title_not_blank check (length(btrim(title)) > 0);

alter table public.policy_documents drop constraint if exists policy_documents_content_not_blank;
alter table public.policy_documents
  add constraint policy_documents_content_not_blank check (length(btrim(content)) > 0);

alter table public.policy_documents drop constraint if exists policy_documents_version_number_positive;
alter table public.policy_documents
  add constraint policy_documents_version_number_positive check (version_number > 0);

do $$ begin
  alter table public.policy_documents
    add constraint policy_documents_version_label_unique unique (version_label);
exception when duplicate_object then null;
end $$;

-- Coherencia de estados (usa ::text para no vincular el nuevo valor de enum en DDL).
alter table public.policy_documents drop constraint if exists policy_documents_published_coherent;
alter table public.policy_documents drop constraint if exists policy_documents_status_coherent;
alter table public.policy_documents
  add constraint policy_documents_status_coherent check (
    (status::text = 'borrador' and published_at is null and archived_at is null)
    or (status::text = 'publicada' and published_at is not null and archived_at is null)
    or (status::text = 'archivada' and archived_at is not null)
  );

-- Solo una política publicada a la vez.
-- Predicado con el valor de enum original 'publicada' (inmutable; el nuevo valor
-- 'archivada' solo se usa vía ::text en CHECKs para evitar binding en DDL).
create unique index if not exists uq_policy_documents_one_published
  on public.policy_documents ((true))
  where status = 'publicada';

create index if not exists idx_policy_documents_archived_at
  on public.policy_documents (archived_at) where archived_at is not null;

-- =============================================================================
-- RPCs · PLAN DE ACCIÓN
-- =============================================================================

create or replace function public.admin_action_plan_to_json(p public.action_plans)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'campaignId', p.campaign_id,
    'area', p.area,
    'riskFactor', p.risk_factor,
    'riskLevel', p.risk_level,
    'actionLevel', p.action_level,
    'actionType', p.action_type,
    'description', p.description,
    'responsible', p.responsible,
    'dueDate', p.due_date,
    'status', p.status,
    'followUpNotes', p.follow_up_notes,
    'source', p.source,
    'sourceKey', p.source_key,
    'version', p.version,
    'completedAt', p.completed_at,
    'cancelledAt', p.cancelled_at,
    'archivedAt', p.archived_at,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

create or replace function public.admin_list_action_plans(
  p_campaign_id uuid default null,
  p_status text default null,
  p_source text default null,
  p_include_archived boolean default false,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total int;
  v_items jsonb;
begin
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
$$;

create or replace function public.admin_create_action_plan(
  p_campaign_id uuid,
  p_area text,
  p_risk_factor text,
  p_risk_level text,
  p_action_level text,
  p_action_type text,
  p_description text,
  p_responsible text,
  p_due_date date default null,
  p_follow_up_notes text default '',
  p_source text default 'manual',
  p_source_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.action_plans%rowtype;
  v_desc text := public.nom035_nullif_blank(p_description);
  v_area text := public.nom035_nullif_blank(p_area);
  v_factor text := public.nom035_nullif_blank(p_risk_factor);
  v_resp text := public.nom035_nullif_blank(p_responsible);
  v_source text := coalesce(public.nom035_nullif_blank(p_source), 'manual');
begin
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
$$;

create or replace function public.admin_update_action_plan(
  p_id uuid,
  p_area text default null,
  p_risk_factor text default null,
  p_risk_level text default null,
  p_action_level text default null,
  p_action_type text default null,
  p_description text default null,
  p_responsible text default null,
  p_due_date date default null,
  p_follow_up_notes text default null,
  p_clear_due_date boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.action_plans%rowtype;
begin
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
$$;

create or replace function public.admin_change_action_plan_status(
  p_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.action_plans%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
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
$$;

create or replace function public.admin_archive_action_plan(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.action_plans%rowtype;
begin
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
$$;

create or replace function public.admin_generate_suggested_action_plans(
  p_campaign_id uuid,
  p_domain_map jsonb,
  p_responsible text default 'RH',
  p_due_days int default 30,
  p_guia_i jsonb default null,
  p_guia_i_due_days int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.admin_action_plan_summary(p_campaign_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
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
$$;

-- =============================================================================
-- RPCs · EVIDENCIAS
-- =============================================================================

create or replace function public.admin_evidence_to_json(p public.evidence_items)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'campaignId', p.campaign_id,
    'title', p.title,
    'evidenceType', p.evidence_type,
    'description', p.description,
    'evidenceSource', p.evidence_source,
    'storageBucket', p.storage_bucket,
    'storagePath', p.storage_path,
    'externalUrl', p.external_url,
    'originalFileName', p.original_file_name,
    'safeFileName', p.safe_file_name,
    'mimeType', p.mime_type,
    'sizeBytes', p.size_bytes,
    'sha256', p.sha256,
    'version', p.version,
    'supersedesId', p.supersedes_id,
    'replacedById', p.replaced_by_id,
    'deletedAt', p.deleted_at,
    'storageDeletePending', p.storage_delete_pending,
    'notes', p.notes,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'state', case
      when p.deleted_at is not null and p.storage_delete_pending then 'cleanup_pending'
      when p.deleted_at is not null then 'deleted'
      when p.replaced_by_id is not null then 'superseded'
      when p.evidence_source = 'external' then 'external'
      else 'active'
    end
  );
$$;

create or replace function public.admin_list_evidence(
  p_evidence_type text default null,
  p_search text default null,
  p_state text default 'active',
  p_page int default 1,
  p_page_size int default 20
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
  v_state text := coalesce(p_state, 'active');
  v_total int;
  v_items jsonb;
begin
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
$$;

create or replace function public.admin_create_evidence_metadata(
  p_evidence_source text,
  p_title text,
  p_evidence_type text,
  p_description text,
  p_campaign_id uuid default null,
  p_storage_bucket text default null,
  p_storage_path text default null,
  p_external_url text default null,
  p_original_file_name text default null,
  p_safe_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_sha256 text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
  v_title text := public.nom035_nullif_blank(p_title);
  v_desc text := coalesce(public.nom035_nullif_blank(p_description), '');
begin
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
$$;

create or replace function public.admin_update_evidence_metadata(
  p_id uuid,
  p_title text default null,
  p_evidence_type text default null,
  p_description text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
begin
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
$$;

create or replace function public.admin_replace_evidence_metadata(
  p_old_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_original_file_name text,
  p_safe_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.evidence_items%rowtype;
  v_new public.evidence_items%rowtype;
begin
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
$$;

create or replace function public.admin_soft_delete_evidence(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
begin
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
$$;

create or replace function public.admin_mark_evidence_storage_deleted(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
begin
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
$$;

create or replace function public.admin_mark_evidence_cleanup_pending(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
begin
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
$$;

create or replace function public.admin_get_evidence_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evidence_items%rowtype;
  v_versions jsonb;
begin
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
$$;

create or replace function public.admin_evidence_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by_type jsonb;
  v_checklist jsonb;
  v_total int;
  v_cleanup int;
begin
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
$$;

-- =============================================================================
-- RPCs · QUEJAS
-- =============================================================================

create or replace function public.public_submit_confidential_complaint(
  p_complaint_type text,
  p_description text,
  p_is_anonymous boolean,
  p_reporter_name text default null,
  p_reporter_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text := public.nom035_nullif_blank(p_description);
  v_anon boolean := coalesce(p_is_anonymous, true);
  v_name text := public.nom035_nullif_blank(p_reporter_name);
  v_contact text := public.nom035_nullif_blank(p_reporter_contact);
  v_type public.complaint_type;
  v_folio text;
  v_code text;
  v_row public.confidential_complaints%rowtype;
begin
  if v_desc is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  begin
    v_type := p_complaint_type::public.complaint_type;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_anon then
    v_name := null;
    v_contact := null;
  elsif v_name is null and v_contact is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_folio := public.nom035_next_complaint_folio();
  v_code := encode(extensions.gen_random_bytes(12), 'hex');

  insert into public.confidential_complaints (
    folio, complaint_type, description, is_anonymous, reporter_name, reporter_contact,
    status, public_submission_id, confirmation_code
  ) values (
    v_folio, v_type, v_desc, v_anon, v_name, v_contact,
    'recibida', gen_random_uuid(), v_code
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('complaint.received', 'complaint', v_row.id,
          jsonb_build_object('complaintType', v_row.complaint_type, 'isAnonymous', v_row.is_anonymous));

  return jsonb_build_object(
    'ok', true,
    'folio', v_row.folio,
    'confirmationCode', v_row.confirmation_code,
    'receivedAt', v_row.created_at
  );
end;
$$;

create or replace function public.admin_complaint_list_to_json(p public.confidential_complaints)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'folio', p.folio,
    'complaintType', p.complaint_type,
    'descriptionPreview', left(p.description, 120),
    'isAnonymous', p.is_anonymous,
    'status', p.status,
    'assignedLabel', p.assigned_label,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

create or replace function public.admin_list_complaints(
  p_status text default null,
  p_complaint_type text default null,
  p_folio text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_folio text := public.nom035_nullif_blank(p_folio);
  v_total int;
  v_items jsonb;
begin
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
$$;

create or replace function public.admin_get_complaint_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.confidential_complaints%rowtype;
begin
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
$$;

create or replace function public.admin_assign_complaint(p_id uuid, p_assigned_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.confidential_complaints%rowtype;
  v_label text := public.nom035_nullif_blank(p_assigned_label);
begin
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
$$;

create or replace function public.admin_change_complaint_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.confidential_complaints%rowtype;
begin
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
$$;

create or replace function public.admin_resolve_complaint(
  p_id uuid,
  p_category text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.confidential_complaints%rowtype;
begin
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
$$;

create or replace function public.admin_close_complaint(p_id uuid, p_justification text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.confidential_complaints%rowtype;
begin
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
$$;

create or replace function public.admin_complaint_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
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
$$;

-- =============================================================================
-- RPCs · POLÍTICA
-- =============================================================================

create or replace function public.admin_policy_to_json(p public.policy_documents)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'content', p.content,
    'version', p.version,
    'versionNumber', p.version_number,
    'versionLabel', p.version_label,
    'status', p.status,
    'publishedAt', p.published_at,
    'archivedAt', p.archived_at,
    'supersedesId', p.supersedes_id,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

create or replace function public.admin_list_policies(
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
  v_total int;
  v_items jsonb;
begin
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
$$;

create or replace function public.admin_get_policy(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.policy_documents%rowtype;
begin
  select * into v from public.policy_documents where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'policy', public.admin_policy_to_json(v));
end;
$$;

create or replace function public.admin_create_policy_draft(
  p_title text,
  p_content text,
  p_version_label text default null,
  p_supersedes_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := public.nom035_nullif_blank(p_title);
  v_content text := public.nom035_nullif_blank(p_content);
  v_label text := public.nom035_nullif_blank(p_version_label);
  v_num int;
  v_row public.policy_documents%rowtype;
begin
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
$$;

create or replace function public.admin_update_policy_draft(
  p_id uuid,
  p_title text default null,
  p_content text default null,
  p_version_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.policy_documents%rowtype;
  v_label text := public.nom035_nullif_blank(p_version_label);
begin
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
$$;

create or replace function public.admin_duplicate_policy(p_id uuid, p_version_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.policy_documents%rowtype;
  v_num int;
  v_label text := public.nom035_nullif_blank(p_version_label);
  v_row public.policy_documents%rowtype;
begin
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
$$;

create or replace function public.admin_publish_policy(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.policy_documents%rowtype;
  v_archived_id uuid;
begin
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
$$;

create or replace function public.admin_archive_policy(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.policy_documents%rowtype;
begin
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
$$;

create or replace function public.admin_policy_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published jsonb;
  v_total int;
  v_drafts int;
  v_archived int;
begin
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
$$;

-- =============================================================================
-- Permisos: REVOKE public/anon/authenticated; GRANT EXECUTE solo service_role
-- =============================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'nom035_next_complaint_folio',
        'admin_action_plan_to_json',
        'admin_list_action_plans',
        'admin_create_action_plan',
        'admin_update_action_plan',
        'admin_change_action_plan_status',
        'admin_archive_action_plan',
        'admin_generate_suggested_action_plans',
        'admin_action_plan_summary',
        'admin_evidence_to_json',
        'admin_list_evidence',
        'admin_create_evidence_metadata',
        'admin_update_evidence_metadata',
        'admin_replace_evidence_metadata',
        'admin_soft_delete_evidence',
        'admin_mark_evidence_storage_deleted',
        'admin_mark_evidence_cleanup_pending',
        'admin_get_evidence_detail',
        'admin_evidence_summary',
        'public_submit_confidential_complaint',
        'admin_complaint_list_to_json',
        'admin_list_complaints',
        'admin_get_complaint_detail',
        'admin_assign_complaint',
        'admin_change_complaint_status',
        'admin_resolve_complaint',
        'admin_close_complaint',
        'admin_complaint_summary',
        'admin_policy_to_json',
        'admin_list_policies',
        'admin_get_policy',
        'admin_create_policy_draft',
        'admin_update_policy_draft',
        'admin_duplicate_policy',
        'admin_publish_policy',
        'admin_archive_policy',
        'admin_policy_summary'
      )
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('revoke all on function %s from anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end;
$$;

comment on function public.public_submit_confidential_complaint(text, text, boolean, text, text) is
  'B4.5: alta pública de queja. Genera folio + confirmation_code. Devuelve solo folio/code/receivedAt.';
comment on function public.admin_generate_suggested_action_plans(uuid, jsonb, text, int, jsonb, int) is
  'B4.5: genera acciones sugeridas deterministas e idempotentes desde resultados centrales.';
comment on function public.admin_publish_policy(uuid) is
  'B4.5: publica borrador y archiva la política vigente en la misma transacción (una sola publicada).';
