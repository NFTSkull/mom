-- B4.23 — is_test + exclusión de métricas + export real sin test.
-- No borra datos. No cierra campaña (eso es script operativo).

alter table public.workers
  add column if not exists is_test boolean not null default false;

comment on column public.workers.is_test is
  'B4.23: true = worker sintético/prueba; excluido de métricas/promedios/Excel real.';

create index if not exists idx_workers_is_test on public.workers (is_test);

-- Marcar únicamente candidatos inequívocos (no por nombre parcial).
update public.workers w
set is_test = true,
    updated_at = timezone('utc', now())
where coalesce(w.is_test, false) = false
  and (
    coalesce(w.external_reference, '') ~* '^(SYN-|TST-|TEST-)'
    or exists (
      select 1
      from public.worker_accounts wa
      where wa.worker_id = w.id
        and wa.username_normalized ~* '^(prueba\.|tst\.|test\.)'
    )
    or exists (
      select 1
      from public.worker_accounts wa
      join auth.users u on u.id = wa.auth_user_id
      where wa.worker_id = w.id
        and coalesce(u.raw_user_meta_data->>'marker', '') ~*
          '(PRUEBA|SMOKE|PILOT|B412|B416|WORKER_LOGIN)'
    )
  );

-- Guardrail: ningún worker real numérico debe quedar marcado test.
do $$
declare
  v_bad int;
begin
  select count(*)::int into v_bad
  from public.workers
  where is_test = true
    and external_reference ~ '^[0-9]+$';
  if v_bad <> 0 then
    raise exception 'ABORT B4.23: REAL_WORKERS_MARKED_TEST=%', v_bad;
  end if;
end $$;

-- Dashboard: campaña NOM-035 (active o closed) + excluir is_test.
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_workers int;
  v_inactive_workers int;
  v_campaign jsonb;
  v_campaign_id uuid;
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

  select count(*) filter (where activo and coalesce(is_test, false) = false),
         count(*) filter (where not activo and coalesce(is_test, false) = false)
  into v_active_workers, v_inactive_workers
  from public.workers;

  select c.id, public.admin_campaign_to_json(c)
  into v_campaign_id, v_campaign
  from public.evaluation_campaigns c
  where c.nombre = 'Evaluación NOM-035 2026'
  order by case c.status when 'active' then 0 when 'closed' then 1 else 2 end
  limit 1;

  if v_campaign_id is null then
    select c.id, public.admin_campaign_to_json(c)
    into v_campaign_id, v_campaign
    from public.evaluation_campaigns c
    where c.status = 'active'
    limit 1;
  end if;

  if v_campaign_id is not null then
    select
      count(*) filter (where a.status = 'pending'),
      count(*) filter (where a.status = 'in_progress'),
      count(*) filter (where a.status = 'completed'),
      count(*) filter (where a.status = 'revoked')
    into v_pending, v_in_progress, v_completed, v_revoked
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    where a.campaign_id = v_campaign_id
      and coalesce(w.is_test, false) = false;

    select count(*) into v_no_link
    from public.workers w
    where w.activo
      and coalesce(w.is_test, false) = false
      and not exists (
        select 1 from public.evaluation_assignments a
        where a.worker_id = w.id and a.campaign_id = v_campaign_id
      );

    select count(*) into v_results
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    where r.campaign_id = v_campaign_id
      and coalesce(w.is_test, false) = false;

    select r.guia_ii_final_risk_level::text into v_risk
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    where r.campaign_id = v_campaign_id
      and coalesce(w.is_test, false) = false
    group by r.guia_ii_final_risk_level
    order by count(*) desc, r.guia_ii_final_risk_level
    limit 1;
  else
    v_pending := 0; v_in_progress := 0; v_completed := 0; v_revoked := 0;
    v_no_link := v_active_workers;
    v_results := 0;
    v_risk := null;
  end if;

  select greatest(
    coalesce((select max(updated_at) from public.workers where coalesce(is_test,false)=false), '-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.evaluation_campaigns), '-infinity'::timestamptz),
    coalesce((select max(a.updated_at) from public.evaluation_assignments a join public.workers w on w.id=a.worker_id where coalesce(w.is_test,false)=false), '-infinity'::timestamptz),
    coalesce((select max(r.completed_at) from public.evaluation_results r join public.workers w on w.id=r.worker_id where coalesce(w.is_test,false)=false), '-infinity'::timestamptz)
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
      'lastUpdatedAt', case when v_updated = '-infinity'::timestamptz then null else v_updated end
    )
  );
end;
$$;

-- List results: excluir is_test
create or replace function public.admin_list_results(
  p_campaign_id uuid default null,
  p_worker_id uuid default null,
  p_departamento text default null,
  p_risk_level text default null,
  p_search text default null,
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
    where coalesce(w.is_test, false) = false
      and (p_campaign_id is null or r.campaign_id = p_campaign_id)
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
    from (
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
      where coalesce(w.is_test, false) = false
        and (p_campaign_id is null or r.campaign_id = p_campaign_id)
        and (p_worker_id is null or r.worker_id = p_worker_id)
        and (v_dept is null or w.departamento = v_dept)
        and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
        and (
          v_search is null
          or w.nombre ilike '%' || v_search || '%'
          or coalesce(w.departamento, '') ilike '%' || v_search || '%'
          or coalesce(w.puesto, '') ilike '%' || v_search || '%'
        )
      order by r.completed_at desc nulls last, r.id
      offset (v_page - 1) * v_size
      limit v_size
    ) filtered
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

-- Reports: excluir is_test
create or replace function public.admin_reports_summary(
  p_campaign_id uuid default null,
  p_departamento text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    from public.evaluation_campaigns c
    where c.nombre = 'Evaluación NOM-035 2026'
    order by case c.status when 'active' then 0 when 'closed' then 1 else 2 end
    limit 1;
    if v_campaign is null then
      select public.admin_campaign_to_json(c) into v_campaign
      from public.evaluation_campaigns c where c.status = 'active' limit 1;
    end if;
  end if;

  select count(*) into v_registered
  from public.workers
  where activo and coalesce(is_test, false) = false;

  select
    count(*),
    count(*) filter (where a.status = 'completed')
  into v_assignments, v_completed
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  where coalesce(w.is_test, false) = false
    and (v_campaign is null or a.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select coalesce(jsonb_object_agg(lvl, cnt), '{}'::jsonb)
  into v_levels
  from (
    select r.guia_ii_final_risk_level::text as lvl, count(*) as cnt
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    where coalesce(w.is_test, false) = false
      and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
    group by r.guia_ii_final_risk_level
  ) s;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_categories
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_category_scores) e
    where coalesce(w.is_test, false) = false
      and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
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
    where coalesce(w.is_test, false) = false
      and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
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
    where coalesce(w.is_test, false) = false
      and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
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
  where coalesce(w.is_test, false) = false
    and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select r.scoring_version, r.questionnaire_version
  into v_scoring, v_qversion
  from public.evaluation_results r
  join public.workers w on w.id = r.worker_id
  where coalesce(w.is_test, false) = false
    and (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
  order by r.completed_at desc nulls last
  limit 1;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'report.generated', 'report', null,
    jsonb_build_object(
      'campaign_id', v_campaign->>'id',
      'departamento', v_dept,
      'completed', v_completed,
      'excludeTest', true
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
$$;

-- Excel avance: excluir is_test; incluir cuentas inactivas (post-cierre).
create or replace function public.admin_export_nom035_avance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_items jsonb;
  v_completed int;
  v_total int;
begin
  perform public.require_admin_permission('dashboard.view'::public.app_permission);

  select c.id into v_campaign_id
  from public.evaluation_campaigns c
  where c.nombre = 'Evaluación NOM-035 2026'
  limit 1;

  if v_campaign_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'nombre', t.nombre,
    'usuario', t.usuario,
    'status', t.status
  ) order by t.usuario), '[]'::jsonb),
  count(*)::int,
  count(*) filter (where t.status = 'completed')::int
  into v_items, v_total, v_completed
  from (
    select
      w.nombre as nombre,
      wa.username_normalized as usuario,
      a.status::text as status
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    join public.worker_accounts wa on wa.worker_id = w.id
    where a.campaign_id = v_campaign_id
      and a.status is distinct from 'revoked'
      and coalesce(w.is_test, false) = false
      and w.external_reference ~ '^[0-9]+$'
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
  ) t;

  insert into public.audit_log(action, entity_type, entity_id, metadata)
  values (
    'admin_export_nom035_avance',
    'evaluation_campaign',
    v_campaign_id,
    jsonb_build_object(
      'total', v_total,
      'completed', v_completed,
      'excludeTest', true,
      'columns', jsonb_build_array('Nombre', 'Usuario', 'Respondió')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'campaignName', 'Evaluación NOM-035 2026',
    'items', v_items,
    'total', v_total,
    'completedCount', v_completed
  );
end;
$$;

revoke all on function public.admin_export_nom035_avance() from public, anon;
grant execute on function public.admin_export_nom035_avance() to authenticated, service_role;
