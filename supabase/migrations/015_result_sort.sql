-- B4.28.1 — Orden configurable en admin_list_results
-- Agrega p_sort con 4 opciones: name_asc (default), name_desc, recent, oldest.
-- El ORDER BY siempre incluye r.id como tie-breaker estable.
-- Normalización de nombre: unaccent() → compatible con Ñ y vocales acentuadas.
-- No modifica datos, assignments, results, scoring ni workers.

-- Habilitar extensión unaccent si no existe (sólo añade si schema lo permite)
create extension if not exists unaccent;

create or replace function public.admin_list_results(
  p_campaign_id uuid default null,
  p_worker_id   uuid default null,
  p_departamento text default null,
  p_risk_level  text default null,
  p_search      text default null,
  p_page        integer default 1,
  p_page_size   integer default 20,
  p_sort        text default 'name_asc'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int  := greatest(coalesce(p_page, 1), 1);
  v_size int  := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_sort text := coalesce(lower(trim(p_sort)), 'name_asc');
  v_total int;
  v_items jsonb;
  v_search text := public.nom035_nullif_blank(p_search);
  v_dept   text := public.nom035_nullif_blank(p_departamento);
begin
  perform public.require_admin_permission('results.aggregate.read'::public.app_permission);

  -- Validar sort
  if v_sort not in ('name_asc', 'name_desc', 'recent', 'oldest') then
    v_sort := 'name_asc';
  end if;

  -- Conteo total (igual que antes)
  with filtered as (
    select r.id
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_campaigns c on c.id = r.campaign_id
    where coalesce(w.is_test, false) = false
      and (p_campaign_id is null or r.campaign_id = p_campaign_id)
      and (p_worker_id   is null or r.worker_id   = p_worker_id)
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

  -- Página con orden configurable
  select coalesce(jsonb_agg(to_jsonb(t) order by t."sortKey", t.id), '[]'::jsonb)
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
      completed_at as "completedAt",
      sort_key as "sortKey"
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
        c.nombre as campaign_nombre,
        -- Sort key unificado (text para todas las variantes)
        case v_sort
          when 'name_asc'  then lower(unaccent(coalesce(w.nombre, '')))
          when 'name_desc' then lower(unaccent(coalesce(w.nombre, '')))
          when 'recent'    then coalesce(to_char(r.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '0001-01-01T00:00:00.000Z')
          when 'oldest'    then coalesce(to_char(r.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '9999-12-31T00:00:00.000Z')
          else lower(unaccent(coalesce(w.nombre, '')))
        end as sort_key
      from public.evaluation_results r
      join public.workers w on w.id = r.worker_id
      join public.evaluation_campaigns c on c.id = r.campaign_id
      where coalesce(w.is_test, false) = false
        and (p_campaign_id is null or r.campaign_id = p_campaign_id)
        and (p_worker_id   is null or r.worker_id   = p_worker_id)
        and (v_dept is null or w.departamento = v_dept)
        and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
        and (
          v_search is null
          or w.nombre ilike '%' || v_search || '%'
          or coalesce(w.departamento, '') ilike '%' || v_search || '%'
          or coalesce(w.puesto, '') ilike '%' || v_search || '%'
        )
      order by
        case v_sort
          when 'name_asc'  then lower(unaccent(coalesce(w.nombre, ''))) end asc,
        case v_sort
          when 'name_desc' then lower(unaccent(coalesce(w.nombre, ''))) end desc,
        case v_sort
          when 'recent'    then r.completed_at end desc nulls last,
        case v_sort
          when 'oldest'    then r.completed_at end asc  nulls last,
        r.id asc
      offset (v_page - 1) * v_size
      limit  v_size
    ) inner_q
  ) t;

  return jsonb_build_object(
    'ok',       true,
    'page',     v_page,
    'pageSize', v_size,
    'total',    v_total,
    'sort',     v_sort,
    'items',    v_items
  );
end;
$$;
