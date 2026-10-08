-- B4.30 · pgTAP admin_export_nom035_full_report: `personnel` aditivo; `workers` solo completed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ============================ Permisos =======================================
select ok(
  not has_function_privilege('anon', 'public.admin_export_nom035_full_report()', 'execute'),
  'anon sin EXECUTE');

select ok(
  coalesce((select not (p.proacl::text ~ '(^|[{,])=[^,}]*X')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'admin_export_nom035_full_report'), false),
  'PUBLIC sin EXECUTE');

select ok(
  has_function_privilege('authenticated', 'public.admin_export_nom035_full_report()', 'execute'),
  'authenticated conserva EXECUTE (gated por reports.generate)');

select ok(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_export_nom035_full_report'),
  'sigue siendo security definer');

-- ============================ Fixture local ==================================
update public.evaluation_campaigns
set nombre = nombre || ' (pgtap-b430)'
where nombre = 'Evaluación NOM-035 2026';

insert into public.company_settings (razon_social, total_trabajadores)
select 'Empresa pgTAP B4.30', 6
where not exists (select 1 from public.company_settings);

insert into public.evaluation_campaigns (id, nombre, status, closed_at)
values ('b4300000-0000-4000-8000-000000000001', 'Evaluación NOM-035 2026', 'closed',
  timezone('utc', now()));

create temporary table _b430 (
  n int primary key,
  username text not null,
  ext text not null,
  is_test boolean not null,
  status public.assignment_status not null
);

insert into _b430 values
  (1, '001', '93001', false, 'completed'),
  (2, '002', '93002', false, 'pending'),
  (3, '003', '93003', false, 'in_progress'),
  (4, '004', '93004', true,  'pending'),
  (5, '005', '93005', false, 'revoked'),
  (6, '900', '93006', false, 'pending');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  ('b4300000-0000-4000-8000-1000000000' || lpad(t.n::text, 2, '0'))::uuid,
  'authenticated', 'authenticated',
  'b430-' || t.username || '@pgtap.nom035.local',
  crypt('TestPass!23456', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from _b430 t;

insert into public.workers (id, nombre, puesto, departamento, external_reference, is_test)
select
  ('b4300000-0000-4000-8000-2000000000' || lpad(t.n::text, 2, '0'))::uuid,
  'Persona pgTAP ' || t.n, 'Operador', 'Planta', t.ext, t.is_test
from _b430 t;

insert into public.worker_accounts (company_id, worker_id, auth_user_id, username_normalized)
select
  (select id from public.company_settings limit 1),
  ('b4300000-0000-4000-8000-2000000000' || lpad(t.n::text, 2, '0'))::uuid,
  ('b4300000-0000-4000-8000-1000000000' || lpad(t.n::text, 2, '0'))::uuid,
  t.username
from _b430 t;

insert into public.evaluation_assignments (
  id, campaign_id, worker_id, token_hash, token_last4, status,
  started_at, completed_at, revoked_at, questionnaire_version, token_issued_at
)
select
  ('b4300000-0000-4000-8000-3000000000' || lpad(t.n::text, 2, '0'))::uuid,
  'b4300000-0000-4000-8000-000000000001',
  ('b4300000-0000-4000-8000-2000000000' || lpad(t.n::text, 2, '0'))::uuid,
  repeat('b4', 31) || lpad(t.n::text, 4, '0'),
  'b4' || lpad(t.n::text, 2, '0'),
  t.status,
  case when t.status in ('completed', 'in_progress') then timezone('utc', now()) end,
  case when t.status = 'completed' then timezone('utc', now()) end,
  case when t.status = 'revoked' then timezone('utc', now()) end,
  'nom035-stps-2018-guias-referencia-i-ii',
  timezone('utc', now())
from _b430 t;

insert into public.evaluation_results (
  assignment_id, worker_id, campaign_id,
  guia_i_requires_clinical_attention, guia_ii_final_score, guia_ii_final_risk_level,
  guia_ii_category_scores, guia_ii_domain_scores, guia_ii_dimension_scores,
  alerts, scoring_version, questionnaire_version, submission_id, completed_at
) values (
  'b4300000-0000-4000-8000-300000000001',
  'b4300000-0000-4000-8000-200000000001',
  'b4300000-0000-4000-8000-000000000001',
  false, 40, 'medio',
  '{"Ambiente de trabajo":{"score":3,"riskLevel":"bajo"}}'::jsonb,
  '{"Carga de trabajo":{"score":15,"riskLevel":"medio"}}'::jsonb,
  '{}'::jsonb, '[]'::jsonb,
  'nom035-v1', 'nom035-stps-2018-guias-referencia-i-ii',
  'b4300000-0000-4000-8000-400000000001'::uuid,
  timezone('utc', now())
);

-- ============================ Payload ========================================
create temporary table _payload as
select public.admin_export_nom035_full_report() as p;

select is((select p->>'ok' from _payload), 'true', 'RPC ok');

select is((select jsonb_array_length(p->'personnel') from _payload), 3,
  'personnel = 3 (001 completed, 002 pending, 003 in_progress)');

select is((select (p->'counts'->>'realWorkers')::int from _payload),
  (select jsonb_array_length(p->'personnel') from _payload),
  'personnel cuadra con counts.realWorkers');

select is(
  (select string_agg(e->>'username', ',' order by ord)
     from _payload, jsonb_array_elements(p->'personnel') with ordinality as x(e, ord)),
  '001,002,003', 'personnel ordenado por username');

select is(
  (select string_agg(e->>'status', ',' order by e->>'username')
     from _payload, jsonb_array_elements(p->'personnel') e),
  'completed,pending,in_progress', 'personnel conserva estados reales');

select ok(
  not exists (select 1 from _payload, jsonb_array_elements(p->'personnel') e
    where e->>'username' in ('004', '005', '900')),
  'personnel excluye is_test, revoked y usuarios fuera de 001–083');

select ok(
  (select bool_and(e ? 'nombre' and e ? 'puesto' and e ? 'departamento'
      and e ? 'startedAt' and e ? 'completedAt')
     from _payload, jsonb_array_elements(p->'personnel') e),
  'personnel incluye nombre, puesto, departamento, startedAt, completedAt');

select ok(
  not exists (select 1 from _payload, jsonb_array_elements(p->'personnel') e
    where e ?| array['finalScore', 'finalRiskLevel', 'answers', 'categoryScores', 'domainScores']),
  'personnel no expone resultados ni respuestas');

select is((select jsonb_array_length(p->'workers') from _payload), 1,
  'workers sigue siendo solo completed con resultado');

select is((select p->'workers'->0->>'username' from _payload), '001', 'workers = 001');

select is((select (p->'counts'->>'realResults')::int from _payload), 1, 'realResults = 1');
select is((select (p->'counts'->>'realPending')::int from _payload), 1, 'realPending = 1');
select is((select (p->'counts'->>'realInProgress')::int from _payload), 1, 'realInProgress = 1');

select is(
  (select (select sum(value::int) from jsonb_each_text(p->'riskDistribution')) from _payload),
  1::bigint, 'riskDistribution solo cuenta completados con resultado');

select is(
  (select (metadata->>'personnelExported')::int from public.audit_log
    where action = 'admin_export_nom035_full_report' order by created_at desc limit 1),
  3, 'audit_log registra personnelExported');

select is(
  (select count(*)::int from public.evaluation_results
    where campaign_id = 'b4300000-0000-4000-8000-000000000001'),
  1, 'el RPC no crea resultados para incompletos');

select * from finish();
rollback;
