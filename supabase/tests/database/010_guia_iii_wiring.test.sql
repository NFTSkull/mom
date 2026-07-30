-- =============================================================================
-- B4.10 · pgTAP · Cableado Guía III (assignment_questionnaires + I+III)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table('public', 'assignment_questionnaires', 'existe assignment_questionnaires');
select has_column('public', 'evaluation_results', 'result_snapshot', 'result_snapshot');
select col_not_null('public', 'assignment_questionnaires', 'questionnaire_version', 'version NOT NULL');
select col_is_unique('public', 'assignment_questionnaires',
  ARRAY['assignment_id','questionnaire_type'], 'UNIQUE(assignment_id, questionnaire_type)');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.assignment_questionnaires'::regclass),
  'RLS en assignment_questionnaires');
select table_privs_are('public', 'assignment_questionnaires', 'anon', '{}'::text[],
  'anon sin privilegios en assignment_questionnaires');
select table_privs_are('public', 'assignment_questionnaires', 'authenticated', '{}'::text[],
  'authenticated sin privilegios en assignment_questionnaires');

select ok(public.nom035_is_supported_questionnaire_version('nom035-stps-2018-guias-referencia-i-ii'),
  'allowlist i-ii');
select ok(public.nom035_is_supported_questionnaire_version('nom035-stps-2018-guias-referencia-i-iii'),
  'allowlist i-iii');
select ok(not public.nom035_is_supported_questionnaire_version('version-inventada'),
  'rechaza versión inventada');

-- Datos sintéticos
update public.evaluation_campaigns
set status = 'closed', closed_at = coalesce(closed_at, timezone('utc', now()))
where status = 'active';

insert into public.workers (id, nombre, activo, external_reference) values
  ('b4100000-0000-0000-0000-0000000000a1','W G3 A', true, 'WORKER-G3-A-TEST'),
  ('b4100000-0000-0000-0000-0000000000b1','W G3 B', true, 'WORKER-G3-B-TEST');

insert into public.evaluation_campaigns (id, nombre, status, activated_at, questionnaire_version)
values (
  'b4100000-0000-0000-0000-00000000c001',
  'CAMP_G3_PGTAP',
  'active',
  timezone('utc', now()),
  'nom035-stps-2018-guias-referencia-i-iii'
);

insert into public.evaluation_assignments (
  id, campaign_id, worker_id, token_hash, token_last4, status, questionnaire_version
) values (
  'b4100000-0000-0000-0000-00000000a001',
  'b4100000-0000-0000-0000-00000000c001',
  'b4100000-0000-0000-0000-0000000000a1',
  repeat('a', 64), 'aaaa', 'pending',
  'nom035-stps-2018-guias-referencia-i-iii'
);

select lives_ok(
  $$select public.ensure_assignment_questionnaires('b4100000-0000-0000-0000-00000000a001'::uuid)$$,
  'ensure_assignment_questionnaires i-iii');

select is(
  (select count(*)::int from public.assignment_questionnaires
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'
      and questionnaire_type = 'GUIA_I'),
  1, 'siembra GUIA_I');
select is(
  (select count(*)::int from public.assignment_questionnaires
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'
      and questionnaire_type = 'GUIA_III'),
  1, 'siembra GUIA_III');
select is(
  (select count(*)::int from public.assignment_questionnaires
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'
      and questionnaire_type = 'GUIA_II'),
  0, 'no siembra GUIA_II en i-iii');

-- Mutex II/III
select throws_ok(
  $$insert into public.assignment_questionnaires
    (assignment_id, questionnaire_type, questionnaire_version)
   values ('b4100000-0000-0000-0000-00000000a001', 'GUIA_II',
           'nom035-stps-2018-guias-referencia-i-ii')$$,
  'Guía II y Guía III son mutuamente excluyentes en el mismo assignment',
  'mutex II/III');

-- Assignment B + aislamiento de tablas (sin grants)
insert into public.evaluation_assignments (
  id, campaign_id, worker_id, token_hash, token_last4, status, questionnaire_version
) values (
  'b4100000-0000-0000-0000-00000000b001',
  'b4100000-0000-0000-0000-00000000c001',
  'b4100000-0000-0000-0000-0000000000b1',
  repeat('b', 64), 'bbbb', 'pending',
  'nom035-stps-2018-guias-referencia-i-iii'
);
select public.ensure_assignment_questionnaires('b4100000-0000-0000-0000-00000000b001');

select isnt(
  (select id from public.evaluation_assignments where id = 'b4100000-0000-0000-0000-00000000a001'),
  (select id from public.evaluation_assignments where id = 'b4100000-0000-0000-0000-00000000b001'),
  'assignments A/B distintos');

-- Submit atómico i-iii con snapshot
update public.evaluation_assignments
  set status = 'in_progress', started_at = timezone('utc', now())
  where id = 'b4100000-0000-0000-0000-00000000a001';

insert into public.evaluation_sessions (assignment_id, session_hash, expires_at)
values (
  'b4100000-0000-0000-0000-00000000a001',
  repeat('s', 64),
  timezone('utc', now()) + interval '1 hour'
);

select ok(
  (select (public.submit_public_evaluation(
    repeat('s', 64),
    'b4100000-0000-0000-0000-00000000aa01'::uuid,
    jsonb_build_array(
      jsonb_build_object('questionnaire_code','GUIA_I','question_id','guia_i_1','answer_value','no'),
      jsonb_build_object('questionnaire_code','GUIA_III','question_id','guia_iii_gate_clientes','answer_value','no'),
      jsonb_build_object('questionnaire_code','GUIA_III','question_id','guia_iii_gate_jefe','answer_value','no')
    ),
    jsonb_build_object(
      'guia_i_requires_clinical_attention', false,
      'guia_i_risk_label', 'sin_alerta',
      'guia_ii_final_score', 10,
      'guia_ii_final_risk_level', 'bajo',
      'guia_ii_category_scores', '{}'::jsonb,
      'guia_ii_domain_scores', '{}'::jsonb,
      'guia_ii_dimension_scores', '{}'::jsonb,
      'alerts', '[]'::jsonb,
      'validation_warnings', '[]'::jsonb,
      'result_snapshot', jsonb_build_object(
        'guide_type','GUIA_III',
        'final_score', 10,
        'final_risk_level', 'bajo'
      )
    ),
    'nom035-stps-2018-guias-referencia-i-iii',
    'nom035-stps-2018-guia-i-iii-v1',
    timezone('utc', now())
  )->>'ok')::boolean),
  'submit i-iii ok');

select is(
  (select status::text from public.evaluation_assignments
    where id = 'b4100000-0000-0000-0000-00000000a001'),
  'completed', 'assignment A completed tras submit');

select is(
  (select count(*)::int from public.assignment_questionnaires
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'
      and status = 'submitted'),
  2, 'I y III submitted');

select is(
  (select result_snapshot->>'guide_type' from public.evaluation_results
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'),
  'GUIA_III', 'snapshot guide_type GUIA_III');

-- Segundo submit idempotente
select is(
  (select public.submit_public_evaluation(
    repeat('s', 64),
    'b4100000-0000-0000-0000-00000000aa01'::uuid,
    '[]'::jsonb, '{}'::jsonb,
    'nom035-stps-2018-guias-referencia-i-iii',
    'nom035-stps-2018-guia-i-iii-v1',
    timezone('utc', now())
  )->>'code'),
  'already_completed',
  'submit repetido idempotente');

select is(
  (select count(*)::int from public.evaluation_results
    where assignment_id = 'b4100000-0000-0000-0000-00000000a001'),
  1, 'un solo resultado');

-- B sigue pendiente (no mezclado)
select is(
  (select status::text from public.evaluation_assignments
    where id = 'b4100000-0000-0000-0000-00000000b001'),
  'pending', 'assignment B intacto');

-- Cleanup
delete from public.evaluation_results where assignment_id in (
  'b4100000-0000-0000-0000-00000000a001','b4100000-0000-0000-0000-00000000b001');
delete from public.evaluation_answers where assignment_id in (
  'b4100000-0000-0000-0000-00000000a001','b4100000-0000-0000-0000-00000000b001');
delete from public.evaluation_sessions where assignment_id in (
  'b4100000-0000-0000-0000-00000000a001','b4100000-0000-0000-0000-00000000b001');
delete from public.assignment_questionnaires where assignment_id in (
  'b4100000-0000-0000-0000-00000000a001','b4100000-0000-0000-0000-00000000b001');
delete from public.evaluation_assignments where id in (
  'b4100000-0000-0000-0000-00000000a001','b4100000-0000-0000-0000-00000000b001');
delete from public.evaluation_campaigns where id = 'b4100000-0000-0000-0000-00000000c001';
delete from public.workers where id in (
  'b4100000-0000-0000-0000-0000000000a1','b4100000-0000-0000-0000-0000000000b1');

select * from finish();
rollback;
