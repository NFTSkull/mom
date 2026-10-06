-- B4.29.1 — admin_list_results: firma única e inequívoca.
-- 015 agregó p_sort con CREATE OR REPLACE, lo que creó una sobrecarga nueva (8 args)
-- y dejó viva la legacy de 7 args (005/013). Cualquier llamada sin p_sort resultaba
-- ambigua ("function is not unique").
-- Evidencia previa (Production, read-only): ninguna otra función SQL referencia
-- admin_list_results y el único llamador de la app (admin-core-service) siempre envía p_sort.
-- 015 también reordenaba cada página en ascendente (jsonb_agg ... order by sortKey),
-- invirtiendo name_desc/recent dentro de la página. Se conserva el orden de la página
-- con un ordinal (mismo ORDER BY) que no se expone en la salida.
-- Mismos filtros, mismo payload, mismos valores de p_sort (default name_asc).
-- No modifica datos, scoring, resultados, assignments ni workers.

drop function if exists public.admin_list_results(uuid, uuid, text, text, text, integer, integer);

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
  select coalesce(jsonb_agg(to_jsonb(t) - 'sortOrdinal' order by t."sortOrdinal"), '[]'::jsonb)
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
      sort_key as "sortKey",
      sort_ordinal as "sortOrdinal"
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
        row_number() over (
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
        ) as sort_ordinal,
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

-- 015 no endureció grants: la nueva firma quedó ejecutable por PUBLIC/anon.
-- Se restablece el mismo ACL que tenía la firma legacy.
revoke all on function public.admin_list_results(uuid, uuid, text, text, text, integer, integer, text) from public;
revoke all on function public.admin_list_results(uuid, uuid, text, text, text, integer, integer, text) from anon;
grant execute on function public.admin_list_results(uuid, uuid, text, text, text, integer, integer, text) to authenticated, service_role;

comment on function public.admin_list_results(uuid, uuid, text, text, text, integer, integer, text) is
  'B4.28.1/B4.29.1: listado de resultados reales (is_test=false). p_sort: name_asc (default) | name_desc | recent | oldest; tie-breaker r.id.';
