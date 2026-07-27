-- =============================================================================
-- B4.3 · pgTAP · Backend de evaluación pública por token
-- Estructura + RLS/permisos + comportamiento de funciones atómicas en PG real.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- ============================ ESTRUCTURA ====================================
select has_table('public', 'evaluation_drafts', 'existe evaluation_drafts');
select has_table('public', 'evaluation_sessions', 'existe evaluation_sessions');
select has_table('public', 'public_rate_limits', 'existe public_rate_limits');

select has_column('public', 'evaluation_assignments', 'questionnaire_version', 'assignments.questionnaire_version');
select col_not_null('public', 'evaluation_assignments', 'questionnaire_version', 'questionnaire_version NOT NULL');
select has_column('public', 'evaluation_results', 'questionnaire_version', 'results.questionnaire_version');
select has_column('public', 'evaluation_results', 'submission_id', 'results.submission_id');
select col_not_null('public', 'evaluation_results', 'submission_id', 'submission_id NOT NULL');
select col_is_unique('public', 'evaluation_results', ARRAY['submission_id'], 'submission_id UNIQUE');
select has_column('public', 'evaluation_results', 'validation_warnings', 'results.validation_warnings');

select col_is_pk('public', 'evaluation_drafts', ARRAY['assignment_id'], 'drafts PK assignment_id');
select col_is_unique('public', 'evaluation_sessions', ARRAY['session_hash'], 'session_hash UNIQUE');
select col_is_pk('public', 'public_rate_limits', ARRAY['key_hash','action'], 'rate_limits PK (key_hash, action)');

select has_index('public', 'evaluation_sessions', 'idx_evaluation_sessions_assignment_id', 'idx sessions assignment_id');
select has_index('public', 'evaluation_sessions', 'idx_evaluation_sessions_expires_at', 'idx sessions expires_at');
select has_index('public', 'evaluation_sessions', 'idx_evaluation_sessions_revoked_at', 'idx sessions revoked_at');
select has_index('public', 'evaluation_sessions', 'uq_evaluation_sessions_one_active', 'idx único de sesión activa');

-- ============================ RLS + FORCE ===================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_drafts'::regclass),
  'RLS habilitado en drafts');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.evaluation_drafts'::regclass),
  'FORCE RLS en drafts');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_sessions'::regclass),
  'RLS habilitado en sessions');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.evaluation_sessions'::regclass),
  'FORCE RLS en sessions');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.public_rate_limits'::regclass),
  'RLS habilitado en rate_limits');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.public_rate_limits'::regclass),
  'FORCE RLS en rate_limits');

-- ============================ PERMISOS ======================================
select table_privs_are('public', 'evaluation_drafts', 'anon', '{}'::text[], 'anon sin privilegios en drafts');
select table_privs_are('public', 'evaluation_drafts', 'authenticated', '{}'::text[], 'authenticated sin privilegios en drafts');
select table_privs_are('public', 'evaluation_sessions', 'anon', '{}'::text[], 'anon sin privilegios en sessions');
select table_privs_are('public', 'evaluation_sessions', 'authenticated', '{}'::text[], 'authenticated sin privilegios en sessions');
select table_privs_are('public', 'public_rate_limits', 'anon', '{}'::text[], 'anon sin privilegios en rate_limits');
select table_privs_are('public', 'public_rate_limits', 'authenticated', '{}'::text[], 'authenticated sin privilegios en rate_limits');

-- Funciones internas: sin EXECUTE para anon/authenticated.
select function_privs_are('public', 'submit_public_evaluation',
  ARRAY['text','uuid','jsonb','jsonb','text','text','timestamptz'], 'anon', '{}'::text[],
  'anon sin EXECUTE en submit_public_evaluation');
select function_privs_are('public', 'exchange_evaluation_token',
  ARRAY['text','text','timestamptz'], 'anon', '{}'::text[],
  'anon sin EXECUTE en exchange_evaluation_token');
select function_privs_are('public', 'consume_public_rate_limit',
  ARRAY['text','text','integer','integer'], 'authenticated', '{}'::text[],
  'authenticated sin EXECUTE en consume_public_rate_limit');

-- ============================ DATOS DE PRUEBA ===============================
-- Limpieza defensiva ante residuales de Vitest/E2E (una sola active).
update public.evaluation_campaigns
set status = 'closed',
    closed_at = coalesce(closed_at, timezone('utc', now()))
where status = 'active';

insert into public.workers (id, nombre, activo) values
  ('a0000000-0000-0000-0000-000000000001','W activo', true),
  ('a0000000-0000-0000-0000-000000000002','W inactivo', false),
  ('a0000000-0000-0000-0000-000000000003','W draft camp', true),
  ('a0000000-0000-0000-0000-000000000004','W closed camp', true),
  ('a0000000-0000-0000-0000-000000000005','W expirado', true),
  ('a0000000-0000-0000-0000-000000000006','W revocado', true),
  ('a0000000-0000-0000-0000-000000000007','W completado', true),
  ('a0000000-0000-0000-0000-000000000008','W draft2', true);
insert into public.evaluation_campaigns (id, nombre, status, fecha_inicio, fecha_cierre) values
  ('c0000000-0000-0000-0000-000000000001','Activa','active', current_date - 1, current_date + 30),
  ('c0000000-0000-0000-0000-000000000002','Borrador','draft', null, null),
  ('c0000000-0000-0000-0000-000000000003','Cerrada','closed', current_date - 10, current_date - 1);

-- ============================ EMISIÓN =======================================
select is(
  (public.create_public_evaluation_assignment(
    'c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
    'th_ok','o001', now() + interval '2 days', 'nom035-stps-2018-guias-referencia-i-ii'))->>'ok',
  'true', 'emisión válida OK');

-- expira en el pasado → rechazada
select is(
  (public.create_public_evaluation_assignment(
    'c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000008',
    'th_pastexp','o099', now() - interval '1 hour', 'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'invalid_expiration', 'emisión exige expiración futura');

-- duplicado campaign+worker → rechazado
select is(
  (public.create_public_evaluation_assignment(
    'c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
    'th_dup','o002', now() + interval '2 days', 'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'duplicate_assignment', 'emisión impide duplicado campaign+worker');

-- ============================ INTERCAMBIO ===================================
-- token inexistente
select is(
  (public.exchange_evaluation_token('th_no_existe','sh_x', now() + interval '1 hour'))->>'code',
  'not_found', 'exchange token inexistente → not_found');

-- intercambio válido
select is(
  (public.exchange_evaluation_token('th_ok','sh_ok_1', now() + interval '1 hour'))->>'ok',
  'true', 'exchange válido OK');

-- el contexto NO devuelve token_hash ni worker_id
select ok(
  not ((public.get_evaluation_session_context('sh_ok_1'))->'context' ? 'token_hash'),
  'contexto no expone token_hash');
select ok(
  not ((public.get_evaluation_session_context('sh_ok_1'))->'context' ? 'worker_id'),
  'contexto no expone worker_id');
select ok(
  (public.get_evaluation_session_context('sh_ok_1'))->'context' ? 'workerName',
  'contexto expone solo nombre visible');

-- Segunda sesión revoca la anterior; solo una activa.
select is(
  (public.exchange_evaluation_token('th_ok','sh_ok_2', now() + interval '1 hour'))->>'ok',
  'true', 'segundo exchange OK');
select is(
  (select count(*)::text from public.evaluation_sessions
    where assignment_id=(select id from public.evaluation_assignments where token_hash='th_ok')
      and revoked_at is null),
  '1', 'solo una sesión activa por assignment');
select is(
  (public.get_evaluation_session_context('sh_ok_1'))->>'code',
  'session_revoked', 'sesión anterior queda revocada');

-- ============================ START =========================================
select is((public.start_public_evaluation('sh_ok_2'))->'context'->>'status', 'in_progress',
  'start: pending → in_progress');
select is((public.start_public_evaluation('sh_ok_2'))->'context'->>'status', 'in_progress',
  'start idempotente cuando ya está in_progress');
select is(
  (select started_at is not null from public.evaluation_assignments where token_hash='th_ok')::text,
  'true', 'start fija started_at');

-- ============================ DRAFT =========================================
select is((public.save_public_evaluation_draft('sh_ok_2','{"a":1}'::jsonb))->>'ok', 'true',
  'draft upsert OK');
select is(
  (select payload::text from public.evaluation_drafts
    where assignment_id=(select id from public.evaluation_assignments where token_hash='th_ok')),
  '{"a": 1}', 'draft guarda payload');
select is((public.save_public_evaluation_draft('sh_ok_2','{"a":2}'::jsonb))->>'ok', 'true',
  'draft upsert reemplaza');
select is(
  (select count(*)::text from public.evaluation_drafts),
  '1', 'un solo draft por assignment (upsert)');

-- ============================ SUBMIT ========================================
select is(
  (public.submit_public_evaluation(
     'sh_ok_2','11111111-aaaa-4bbb-8ccc-000000000001'::uuid,
     '[{"questionnaire_code":"GUIA_I","question_id":"guia_i_1","answer_value":"no"},
       {"questionnaire_code":"GUIA_II","question_id":"guia_ii_gate_clientes","answer_value":"no"}]'::jsonb,
     '{"guia_ii_final_score":10,"guia_ii_final_risk_level":"bajo","alerts":[]}'::jsonb,
     'nom035-stps-2018-guias-referencia-i-ii','nom035-stps-2018-guia-i-ii-v1', now()))->>'ok',
  'true', 'submit válido OK');

select is((select status::text from public.evaluation_assignments where token_hash='th_ok'),
  'completed', 'submit deja assignment completed');
select is(
  (select completed_at is not null from public.evaluation_assignments where token_hash='th_ok')::text,
  'true', 'submit fija completed_at');
select is((select count(*)::text from public.evaluation_results
  where assignment_id=(select id from public.evaluation_assignments where token_hash='th_ok')),
  '1', 'submit inserta exactamente un resultado');
select is((select count(*)::text from public.evaluation_answers
  where assignment_id=(select id from public.evaluation_assignments where token_hash='th_ok')),
  '2', 'submit inserta las respuestas canónicas provistas');
select is((select count(*)::text from public.evaluation_drafts), '0',
  'submit elimina el draft');
select is(
  (select count(*)::text from public.evaluation_sessions
    where assignment_id=(select id from public.evaluation_assignments where token_hash='th_ok')
      and revoked_at is null),
  '0', 'submit revoca todas las sesiones');

-- Idempotencia: mismo submission_id (sesión ya revocada → se rehidrata vía nueva)
select is(
  (public.exchange_evaluation_token('th_ok','sh_ok_3', now() + interval '1 hour'))->>'code',
  'completed', 'no se puede reintercambiar un assignment completado');

-- audit_log no contiene respuestas ni scores detallados
select is(
  (select count(*)::text from public.audit_log
    where action='evaluation_completed'
      and (metadata ? 'answers' or metadata ? 'guia_ii_final_score' or metadata ? 'responses')),
  '0', 'audit_log de completado sin respuestas ni scores');

-- ============================ NEGATIVOS DE ESTADO ===========================
-- assignment expirado
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, expires_at)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005',
          'th_exp','oexp','pending', now() - interval '1 minute');
select is((public.exchange_evaluation_token('th_exp','sh_exp', now() + interval '1 hour'))->>'code',
  'expired', 'exchange assignment expirado → expired');

-- assignment revocado
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, revoked_at)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000006',
          'th_rev','orev','revoked', now());
select is((public.exchange_evaluation_token('th_rev','sh_rev', now() + interval '1 hour'))->>'code',
  'revoked', 'exchange assignment revocado → revoked');

-- worker inactivo
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, expires_at)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
          'th_wina','owin','pending', now() + interval '1 day');
select is((public.exchange_evaluation_token('th_wina','sh_wina', now() + interval '1 hour'))->>'code',
  'worker_inactive', 'exchange worker inactivo → worker_inactive');

-- campaña draft
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, expires_at)
  values ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003',
          'th_draft','odrf','pending', now() + interval '1 day');
select is((public.exchange_evaluation_token('th_draft','sh_draft', now() + interval '1 hour'))->>'code',
  'campaign_unavailable', 'exchange campaña draft → campaign_unavailable');

-- campaña cerrada
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, expires_at)
  values ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
          'th_closed','oclo','pending', now() + interval '1 day');
select is((public.exchange_evaluation_token('th_closed','sh_closed', now() + interval '1 hour'))->>'code',
  'campaign_unavailable', 'exchange campaña cerrada → campaign_unavailable');

-- ============================ DRAFT EN COMPLETED ============================
-- crea assignment completado y prueba que no acepta draft ni transición
insert into public.evaluation_assignments (id, campaign_id, worker_id, token_hash, token_last4, status, completed_at, started_at)
  values ('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001',
          'a0000000-0000-0000-0000-000000000007','th_done','odon','completed', now(), now());

-- transición completed irreversible (trigger)
select throws_ok(
  $$update public.evaluation_assignments set status='pending', completed_at=null
     where id='e0000000-0000-0000-0000-000000000007'$$,
  '23514', NULL, 'completed → pending bloqueado por trigger');
select throws_ok(
  $$update public.evaluation_assignments set status='in_progress', completed_at=null
     where id='e0000000-0000-0000-0000-000000000007'$$,
  '23514', NULL, 'completed → in_progress bloqueado por trigger');

-- revoked irreversible (usa worker 004 que solo tenía campaign closed)
insert into public.evaluation_assignments (id, campaign_id, worker_id, token_hash, token_last4, status, revoked_at)
  values ('e0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001',
          'a0000000-0000-0000-0000-000000000004','th_done2','od22','revoked', now());
select throws_ok(
  $$update public.evaluation_assignments set status='completed', revoked_at=null, completed_at=now()
     where id='e0000000-0000-0000-0000-000000000006'$$,
  '23514', NULL, 'revoked → completed bloqueado por trigger');

-- ============================ DRAFT SEPARADO POR ASSIGNMENT =================
-- Nueva sesión sobre assignment completado no procede; usamos otro assignment pending.
insert into public.evaluation_assignments (campaign_id, worker_id, token_hash, token_last4, status, expires_at)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000008',
          'th_ok2','ok2x','pending', now() + interval '1 day');
select is((public.exchange_evaluation_token('th_ok2','sh_ok2', now() + interval '1 hour'))->>'ok',
  'true', 'exchange segundo assignment OK');
select is((public.save_public_evaluation_draft('sh_ok2','{"b":9}'::jsonb))->>'ok', 'true',
  'draft en segundo assignment OK');
select is((select count(distinct assignment_id)::text from public.evaluation_drafts), '1',
  'drafts separados por assignment (solo el nuevo)');

-- ============================ RATE LIMIT ====================================
select is((public.consume_public_rate_limit('rk','act',2,60))->>'allowed', 'true', 'rate 1/2 permitido');
select is((public.consume_public_rate_limit('rk','act',2,60))->>'allowed', 'true', 'rate 2/2 permitido');
select is((public.consume_public_rate_limit('rk','act',2,60))->>'allowed', 'false', 'rate 3/2 bloqueado');
select ok(((public.consume_public_rate_limit('rk','act',2,60))->>'retryAfter')::int > 0,
  'rate limit expone retryAfter > 0');

select * from finish();
rollback;
