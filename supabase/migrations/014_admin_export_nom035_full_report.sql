-- B4.24 — Exportación Excel completo NOM-035 (datos batch, excluye test)

create or replace function public.admin_get_result_detail(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.evaluation_results%rowtype;
  v_w public.workers%rowtype;
  v_c public.evaluation_campaigns%rowtype;
  v_a public.evaluation_assignments%rowtype;
  v_username text;
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

  if coalesce(v_w.is_test, false) then
    return jsonb_build_object('ok', false, 'code', 'test_worker_excluded');
  end if;

  if v_a.id is null or v_a.worker_id <> v_r.worker_id or v_a.campaign_id <> v_r.campaign_id then
    return jsonb_build_object('ok', false, 'code', 'inconsistent_result');
  end if;

  select wa.username_normalized into v_username
  from public.worker_accounts wa
  where wa.worker_id = v_w.id
  limit 1;

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
      'username', v_username,
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
$$;

create or replace function public.admin_export_nom035_full_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_campaign_name text;
  v_campaign_status text;
  v_real_workers int;
  v_real_completed int;
  v_real_pending int;
  v_real_in_progress int;
  v_real_results int;
  v_test_workers int;
  v_test_results_stored int;
  v_guia_i_completed int;
  v_guia_iii_completed int;
  v_risk jsonb;
  v_category_avgs jsonb;
  v_domain_avgs jsonb;
  v_workers jsonb;
begin
  perform public.require_admin_permission('reports.generate'::public.app_permission);

  select c.id, c.nombre, c.status::text
  into v_campaign_id, v_campaign_name, v_campaign_status
  from public.evaluation_campaigns c
  where c.nombre = 'Evaluación NOM-035 2026'
  limit 1;

  if v_campaign_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select count(*) into v_real_workers
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  join public.worker_accounts wa on wa.worker_id = w.id
  where a.campaign_id = v_campaign_id
    and a.status is distinct from 'revoked'
    and coalesce(w.is_test, false) = false
    and w.external_reference ~ '^[0-9]+$'
    and wa.username_normalized ~ '^[0-9]{3}$'
    and wa.username_normalized::int between 1 and 83;

  select
    count(*) filter (where a.status = 'completed'),
    count(*) filter (where a.status = 'pending'),
    count(*) filter (where a.status = 'in_progress')
  into v_real_completed, v_real_pending, v_real_in_progress
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  join public.worker_accounts wa on wa.worker_id = w.id
  where a.campaign_id = v_campaign_id
    and a.status is distinct from 'revoked'
    and coalesce(w.is_test, false) = false
    and w.external_reference ~ '^[0-9]+$'
    and wa.username_normalized ~ '^[0-9]{3}$'
    and wa.username_normalized::int between 1 and 83;

  select count(*) into v_real_results
  from public.evaluation_results r
  join public.workers w on w.id = r.worker_id
  join public.evaluation_assignments a on a.id = r.assignment_id
  join public.worker_accounts wa on wa.worker_id = w.id
  where r.campaign_id = v_campaign_id
    and a.status = 'completed'
    and coalesce(w.is_test, false) = false
    and wa.username_normalized ~ '^[0-9]{3}$'
    and wa.username_normalized::int between 1 and 83;

  select count(*) into v_test_workers
  from public.workers w
  where coalesce(w.is_test, false) = true;

  select count(*) into v_test_results_stored
  from public.evaluation_results r
  join public.workers w on w.id = r.worker_id
  where r.campaign_id = v_campaign_id
    and coalesce(w.is_test, false) = true;

  select
    count(*) filter (where coalesce(t.guia_i_status, '') = 'submitted'),
    count(*) filter (where coalesce(t.guia_iii_status, '') = 'submitted')
  into v_guia_i_completed, v_guia_iii_completed
  from (
    select
      a.id,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_I' limit 1) as guia_i_status,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_III' limit 1) as guia_iii_status
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    join public.worker_accounts wa on wa.worker_id = w.id
    where a.campaign_id = v_campaign_id
      and a.status = 'completed'
      and coalesce(w.is_test, false) = false
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
  ) t;

  select coalesce(jsonb_object_agg(lvl, cnt), '{}'::jsonb)
  into v_risk
  from (
    select r.guia_ii_final_risk_level::text as lvl, count(*) as cnt
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_assignments a on a.id = r.assignment_id
    join public.worker_accounts wa on wa.worker_id = w.id
    where r.campaign_id = v_campaign_id
      and a.status = 'completed'
      and coalesce(w.is_test, false) = false
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
    group by r.guia_ii_final_risk_level
  ) s;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_category_avgs
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 4) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_assignments a on a.id = r.assignment_id
    join public.worker_accounts wa on wa.worker_id = w.id
    cross join lateral jsonb_each(r.guia_ii_category_scores) e
    where r.campaign_id = v_campaign_id
      and a.status = 'completed'
      and coalesce(w.is_test, false) = false
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_domain_avgs
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 4) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_assignments a on a.id = r.assignment_id
    join public.worker_accounts wa on wa.worker_id = w.id
    cross join lateral jsonb_each(r.guia_ii_domain_scores) e
    where r.campaign_id = v_campaign_id
      and a.status = 'completed'
      and coalesce(w.is_test, false) = false
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  with completed_workers as (
    select
      r.id as result_id,
      a.id as assignment_id,
      wa.username_normalized as username,
      w.nombre,
      w.puesto,
      w.departamento,
      a.status::text as status,
      a.started_at,
      r.completed_at,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_I' limit 1) as guia_i_status,
      (select aq.status from public.assignment_questionnaires aq
        where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_III' limit 1) as guia_iii_status,
      r.guia_ii_final_score as final_score,
      r.guia_ii_final_risk_level::text as final_risk_level,
      r.guia_ii_category_scores as category_scores,
      r.guia_ii_domain_scores as domain_scores,
      r.guia_i_requires_clinical_attention,
      r.guia_i_risk_label,
      r.scoring_version,
      r.questionnaire_version
    from public.evaluation_results r
    join public.evaluation_assignments a on a.id = r.assignment_id
    join public.workers w on w.id = r.worker_id
    join public.worker_accounts wa on wa.worker_id = w.id
    where r.campaign_id = v_campaign_id
      and a.status = 'completed'
      and coalesce(w.is_test, false) = false
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
  ),
  answers_by_assignment as (
    select
      ans.assignment_id,
      jsonb_agg(jsonb_build_object(
        'questionnaireCode', ans.questionnaire_code,
        'questionId', ans.question_id,
        'answerText', ans.answer_text,
        'answerValue', ans.answer_value
      ) order by ans.questionnaire_code, ans.question_id) as answers
    from public.evaluation_answers ans
    where ans.assignment_id in (select assignment_id from completed_workers)
    group by ans.assignment_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'resultId', cw.result_id,
    'username', cw.username,
    'nombre', cw.nombre,
    'puesto', cw.puesto,
    'departamento', cw.departamento,
    'status', cw.status,
    'startedAt', cw.started_at,
    'completedAt', cw.completed_at,
    'guiaIStatus', cw.guia_i_status,
    'guiaIIIStatus', cw.guia_iii_status,
    'finalScore', cw.final_score,
    'finalRiskLevel', cw.final_risk_level,
    'categoryScores', cw.category_scores,
    'domainScores', cw.domain_scores,
    'guiaIRequiresClinicalAttention', cw.guia_i_requires_clinical_attention,
    'guiaIRiskLabel', cw.guia_i_risk_label,
    'scoringVersion', cw.scoring_version,
    'questionnaireVersion', cw.questionnaire_version,
    'answers', coalesce(ab.answers, '[]'::jsonb)
  ) order by cw.username), '[]'::jsonb)
  into v_workers
  from completed_workers cw
  left join answers_by_assignment ab on ab.assignment_id = cw.assignment_id;

  insert into public.audit_log(action, entity_type, entity_id, metadata)
  values (
    'admin_export_nom035_full_report',
    'evaluation_campaign',
    v_campaign_id,
    jsonb_build_object(
      'realCompleted', v_real_completed,
      'realResults', v_real_results,
      'workersExported', jsonb_array_length(v_workers),
      'excludeTest', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'generatedAt', timezone('utc', now()),
    'campaign', jsonb_build_object(
      'nombre', v_campaign_name,
      'status', v_campaign_status
    ),
    'counts', jsonb_build_object(
      'realWorkers', v_real_workers,
      'realCompleted', v_real_completed,
      'realPending', v_real_pending,
      'realInProgress', v_real_in_progress,
      'realResults', v_real_results,
      'testWorkers', v_test_workers,
      'testResultsStored', v_test_results_stored,
      'testResultsIncluded', 0,
      'guiaICompleted', v_guia_i_completed,
      'guiaIIICompleted', v_guia_iii_completed,
      'guiaIICompleted', 0
    ),
    'riskDistribution', v_risk,
    'categoryAverages', v_category_avgs,
    'domainAverages', v_domain_avgs,
    'workers', v_workers
  );
end;
$$;

revoke all on function public.admin_export_nom035_full_report() from public, anon;
grant execute on function public.admin_export_nom035_full_report() to authenticated, service_role;

comment on function public.admin_export_nom035_full_report() is
  'B4.24 — Datos batch para Excel completo NOM-035; solo trabajadores reales completed; excluye is_test.';
