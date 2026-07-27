-- =============================================================================
-- B4.4 · pgTAP · Backend administrativo central (003_admin_core_backend)
-- Estructura + RLS/permisos + RPCs admin en PG real.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Limpieza defensiva ante residuales de Vitest/E2E (una sola active).
update public.evaluation_campaigns
set status = 'closed',
    closed_at = coalesce(closed_at, timezone('utc', now()))
where status = 'active';

-- ============================ ESTRUCTURA workers ============================
select has_column('public', 'workers', 'normalized_email', 'workers.normalized_email');
select has_column('public', 'workers', 'normalized_phone', 'workers.normalized_phone');
select has_column('public', 'workers', 'external_reference', 'workers.external_reference');
select has_column('public', 'workers', 'deactivated_at', 'workers.deactivated_at');
select has_column('public', 'workers', 'created_by', 'workers.created_by');
select has_column('public', 'workers', 'updated_by', 'workers.updated_by');

-- ============================ ESTRUCTURA campaigns ========================
select has_column('public', 'evaluation_campaigns', 'questionnaire_version', 'campaigns.questionnaire_version');
select col_not_null('public', 'evaluation_campaigns', 'questionnaire_version', 'questionnaire_version NOT NULL');
select has_column('public', 'evaluation_campaigns', 'activated_at', 'campaigns.activated_at');
select has_column('public', 'evaluation_campaigns', 'closed_at', 'campaigns.closed_at');
select has_column('public', 'evaluation_campaigns', 'created_by', 'campaigns.created_by');
select has_column('public', 'evaluation_campaigns', 'updated_by', 'campaigns.updated_by');

-- ============================ ESTRUCTURA assignments ======================
select has_column('public', 'evaluation_assignments', 'token_issued_at', 'assignments.token_issued_at');
select has_column('public', 'evaluation_assignments', 'token_rotated_at', 'assignments.token_rotated_at');
select has_column('public', 'evaluation_assignments', 'revoked_reason', 'assignments.revoked_reason');
select has_column('public', 'evaluation_assignments', 'created_by', 'assignments.created_by');
select has_column('public', 'evaluation_assignments', 'updated_by', 'assignments.updated_by');

select hasnt_column('public', 'evaluation_assignments', 'token',
  'assignments NO tiene columna token en texto plano');

-- ============================ ÍNDICES =======================================
select has_index('public', 'workers', 'uq_workers_normalized_email', 'uq workers normalized_email');
select has_index('public', 'workers', 'uq_workers_external_reference', 'uq workers external_reference');
select has_index('public', 'workers', 'idx_workers_deactivated_at', 'idx workers deactivated_at');
select has_index('public', 'evaluation_campaigns', 'uq_evaluation_campaigns_one_active', 'uq one active campaign');

-- ============================ RLS + FORCE ===================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.workers'::regclass),
  'RLS habilitado en workers');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.workers'::regclass),
  'FORCE RLS en workers');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_campaigns'::regclass),
  'RLS habilitado en campaigns');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.evaluation_campaigns'::regclass),
  'FORCE RLS en campaigns');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_assignments'::regclass),
  'RLS habilitado en assignments');
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.evaluation_assignments'::regclass),
  'FORCE RLS en assignments');

-- ============================ PERMISOS RPC admin ============================
select function_privs_are('public', 'admin_upsert_company_settings',
  ARRAY['text','text','text','text','text','integer','text','text','text'], 'anon', '{}'::text[],
  'anon sin EXECUTE en admin_upsert_company_settings');
select ok(
  has_function_privilege('authenticated', 'public.admin_upsert_company_settings(text,text,text,text,text,integer,text,text,text)', 'EXECUTE'),
  'authenticated CON EXECUTE en admin_upsert_company_settings (B4.6 + require_admin_permission)');

select function_privs_are('public', 'admin_create_worker',
  ARRAY['text','text','text','text','text','text','text','text','text','text','boolean'], 'anon', '{}'::text[],
  'anon sin EXECUTE en admin_create_worker');
select ok(
  has_function_privilege('authenticated', 'public.admin_create_worker(text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE'),
  'authenticated CON EXECUTE en admin_create_worker (B4.6)');

select function_privs_are('public', 'admin_issue_assignment',
  ARRAY['uuid','uuid','text','text','timestamptz','text'], 'anon', '{}'::text[],
  'anon sin EXECUTE en admin_issue_assignment');
select ok(
  has_function_privilege('authenticated', 'public.admin_rotate_assignment_token(uuid,text,text,timestamptz)', 'EXECUTE'),
  'authenticated CON EXECUTE en admin_rotate_assignment_token (B4.6)');
select function_privs_are('public', 'admin_dashboard_summary',
  ARRAY[]::text[], 'anon', '{}'::text[],
  'anon sin EXECUTE en admin_dashboard_summary');
select ok(
  has_function_privilege('authenticated', 'public.admin_get_result_detail(uuid)', 'EXECUTE'),
  'authenticated CON EXECUTE en admin_get_result_detail (B4.6)');

select ok(
  not has_function_privilege('anon', 'public.admin_import_workers(jsonb,text)', 'EXECUTE'),
  'anon sin EXECUTE admin_import_workers (regprocedure)');
select ok(
  has_function_privilege('authenticated', 'public.admin_revoke_assignment(uuid,text)', 'EXECUTE'),
  'authenticated CON EXECUTE admin_revoke_assignment (B4.6)');

-- ============================ COMPANY singleton =============================
select is(
  (public.admin_upsert_company_settings(
    'Empresa Demo SA de CV', 'ABC123456XYZ', 'Calle 1', '5551234567',
    'Servicios', 25, 'Responsable RH', 'rh@empresa-demo.test', '5559876543'))->>'ok',
  'true', 'admin_upsert_company_settings OK');

select is(
  (select count(*)::text from public.company_settings),
  '1', 'company_settings singleton (una sola fila)');

select is(
  (public.admin_upsert_company_settings('Empresa Demo Actualizada SA de CV', null, null, null, null, 30))->>'ok',
  'true', 'admin_upsert_company_settings actualiza singleton');

select is(
  (select total_trabajadores::text from public.company_settings limit 1),
  '30', 'singleton actualizado conserva una fila con nuevos datos');

select is(
  (public.admin_upsert_company_settings('', null, null, null, null, 10))->>'code',
  'razon_social_required', 'razon social vacía rechazada');

select is(
  (public.admin_upsert_company_settings('X', null, null, null, null, -1))->>'code',
  'total_trabajadores_invalid', 'total_trabajadores negativo rechazado');

-- ============================ WORKERS CRUD ==================================
select is(
  (public.admin_create_worker(
    'Ana Operadora', 'ana@empresa-demo.test', '+52 55 1111 2222', 'Produccion',
    'Operador', 'Matutino', 'Planta Norte', null, '2 años', 'EXT-001'))->>'ok',
  'true', 'admin_create_worker OK');

select is(
  (select normalized_email from public.workers where external_reference = 'EXT-001'),
  'ana@empresa-demo.test', 'email normalizado a minúsculas');

select is(
  (public.admin_create_worker('Bruno Logistica', 'bruno@empresa-demo.test', null, 'Logistica'))->>'ok',
  'true', 'admin_create_worker segundo OK');

select is(
  (public.admin_create_worker('Carlos Sin Historial', 'carlos@empresa-demo.test'))->>'ok',
  'true', 'admin_create_worker para delete OK');

select is(
  (public.admin_create_worker('Diana Resultados', 'diana@empresa-demo.test', null, 'Calidad'))->>'ok',
  'true', 'admin_create_worker para resultados OK');

select is(
  (public.admin_create_worker('   '))->>'code',
  'nombre_required', 'nombre vacío rechazado por RPC');

select throws_ok(
  $$insert into public.workers (nombre) values ('   ')$$,
  '23514', NULL, 'nombre vacío rechazado por CHECK workers_nombre_not_blank');

select is(
  (public.admin_create_worker('Dup Email', 'ana@empresa-demo.test'))->>'code',
  'duplicate_email', 'email duplicado rechazado');

select is(
  (public.admin_create_worker('Dup Ext', null, null, null, null, null, null, null, null, 'EXT-001'))->>'code',
  'duplicate_external_reference', 'external_reference duplicado rechazado');

select is(
  (public.admin_update_worker(
    (select id from public.workers where external_reference = 'EXT-001'),
    'Ana Operadora Senior', null, null, 'Produccion Avanzada'))->>'ok',
  'true', 'admin_update_worker OK');

select is(
  (select departamento from public.workers where external_reference = 'EXT-001'),
  'Produccion Avanzada', 'admin_update_worker persiste cambios');

select is(
  (public.admin_deactivate_worker(
    (select id from public.workers where normalized_email = 'bruno@empresa-demo.test')))->>'ok',
  'true', 'admin_deactivate_worker OK');

select is(
  (select activo::text from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  'false', 'deactivate deja activo=false');

select ok(
  (select deactivated_at is not null from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  'deactivate fija deactivated_at');

select is(
  (public.admin_reactivate_worker(
    (select id from public.workers where normalized_email = 'bruno@empresa-demo.test')))->>'ok',
  'true', 'admin_reactivate_worker OK');

select is(
  (select activo::text from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  'true', 'reactivate deja activo=true');

select ok(
  (select deactivated_at is null from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  'reactivate limpia deactivated_at');

select is(
  (public.admin_delete_worker(
    (select id from public.workers where normalized_email = 'carlos@empresa-demo.test')))->>'ok',
  'true', 'admin_delete_worker sin historial OK');

select ok(
  not exists (select 1 from public.workers where normalized_email = 'carlos@empresa-demo.test'),
  'worker sin historial eliminado');

-- ============================ IMPORT workers =================================
select is(
  (public.admin_import_workers(
    '[{"nombre":"Import Uno","email":"imp1@empresa-demo.test","referencia_externa":"IMP-001"},
      {"nombre":"Import Dos","email":"imp2@empresa-demo.test"}]'::jsonb,
    'validate_only'))->>'ok',
  'true', 'admin_import_workers validate_only OK');

select is(
  (public.admin_import_workers(
    '[{"nombre":"Import Uno","email":"imp1@empresa-demo.test","referencia_externa":"IMP-001"},
      {"nombre":"Import Dos","email":"imp2@empresa-demo.test"}]'::jsonb,
    'atomic'))->>'ok',
  'true', 'admin_import_workers atomic OK');

select is(
  (select count(*)::text from public.workers where normalized_email like 'imp%@empresa-demo.test'),
  '2', 'import atomic inserta filas');

select is(
  (public.admin_import_workers('[{"nombre":""}]'::jsonb, 'validate_only'))->>'code',
  'validation_failed', 'import validate_only rechaza nombre vacío');

select is(
  (public.admin_import_workers(
    '[{"nombre":"X","email":"dupfile@empresa-demo.test"},
      {"nombre":"Y","email":"dupfile@empresa-demo.test"}]'::jsonb,
    'validate_only'))->>'code',
  'validation_failed', 'import rechaza email duplicado en archivo');

-- ============================ CAMPAIGNS =====================================
select is(
  (public.admin_create_campaign('Campana Alpha', 'Desc A', current_date, current_date + 30))->>'ok',
  'true', 'admin_create_campaign draft OK');

select is(
  (public.admin_create_campaign('Campana Beta'))->>'ok',
  'true', 'admin_create_campaign segunda draft OK');

select is(
  (public.admin_create_campaign('   '))->>'code',
  'nombre_required', 'campaign nombre vacío rechazado');

select is(
  (public.admin_activate_campaign(
    (select id from public.evaluation_campaigns where nombre = 'Campana Alpha')))->>'ok',
  'true', 'admin_activate_campaign OK');

select ok(
  (select activated_at is not null from public.evaluation_campaigns where nombre = 'Campana Alpha'),
  'activate fija activated_at');

select is(
  (public.admin_activate_campaign(
    (select id from public.evaluation_campaigns where nombre = 'Campana Beta')))->>'code',
  'another_active_exists', 'segunda campaña active rechazada');

select is(
  (public.admin_update_campaign(
    (select id from public.evaluation_campaigns where nombre = 'Campana Beta'),
    'Campana Beta Editada'))->>'ok',
  'true', 'admin_update_campaign draft OK');

select is(
  (public.admin_close_campaign(
    (select id from public.evaluation_campaigns where nombre = 'Campana Alpha')))->>'ok',
  'true', 'admin_close_campaign OK');

select ok(
  (select closed_at is not null from public.evaluation_campaigns where nombre = 'Campana Alpha'),
  'close fija closed_at');

select is(
  (public.admin_activate_campaign(
    (select id from public.evaluation_campaigns where nombre = 'Campana Beta Editada')))->>'ok',
  'true', 'activar beta tras cerrar alpha OK');

-- IDs estables para pruebas de assignments
-- Campaña activa: Campana Beta Editada
-- Trabajadores activos: EXT-001 (Ana), Diana, Import Uno/Dos, Bruno

-- ============================ ISSUE assignment ==============================
select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where external_reference = 'EXT-001'),
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    'a001',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'ok',
  'true', 'admin_issue_assignment OK');

select ok(
  (select token_issued_at is not null from public.evaluation_assignments where token_last4 = 'a001'),
  'issue fija token_issued_at');

select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where external_reference = 'EXT-001'),
    'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
    'dup1',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'duplicate_assignment', 'issue duplicado campaign+worker rechazado');

select is(
  (public.admin_deactivate_worker(
    (select id from public.workers where normalized_email = 'diana@empresa-demo.test')))->>'ok',
  'true', 'deactivate diana para prueba inactive');

select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where normalized_email = 'diana@empresa-demo.test'),
    'feedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface',
    'din1',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'worker_inactive', 'issue worker inactivo rechazado');

select is(
  (public.admin_create_campaign('Campana Draft Issue'))->>'ok',
  'true', 'draft para issue negativo');

select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where nombre = 'Campana Draft Issue'),
    (select id from public.workers where normalized_email = 'imp1@empresa-demo.test'),
    'badc0de0badc0de0badc0de0badc0de0badc0de0badc0de0badc0de0badc0de0',
    'drft',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'campaign_unavailable', 'issue campaña no active rechazado');

-- Segundo assignment pending para rotate/revoke
select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where normalized_email = 'imp1@empresa-demo.test'),
    'decafbaddecafbaddecafbaddecafbaddecafbaddecafbaddecafbaddecafbaddecafbad',
    'b002',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'ok',
  'true', 'issue segundo assignment pending OK');

-- has_history bloquea delete de Ana (tiene assignment)
select is(
  (public.admin_delete_worker(
    (select id from public.workers where external_reference = 'EXT-001')))->>'code',
  'has_history', 'delete worker con historial rechazado');

-- ============================ ROTATE pending + draft ========================
insert into public.evaluation_drafts (assignment_id, payload)
  values (
    (select id from public.evaluation_assignments where token_last4 = 'b002'),
    '{"step":1,"answers":[]}'::jsonb);

insert into public.evaluation_sessions (assignment_id, session_hash, expires_at)
  values (
    (select id from public.evaluation_assignments where token_last4 = 'b002'),
    'sh_admin_rot_pending',
    timezone('utc', now()) + interval '1 hour');

select is(
  (public.admin_rotate_assignment_token(
    (select id from public.evaluation_assignments where token_last4 = 'b002'),
    '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff0000',
    'r001',
    timezone('utc', now()) + interval '14 days'))->>'ok',
  'true', 'rotate pending OK');

select is(
  (select token_hash from public.evaluation_assignments where token_last4 = 'r001'),
  '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff0000',
  'rotate actualiza token_hash');

select ok(
  (select token_rotated_at is not null from public.evaluation_assignments where token_last4 = 'r001'),
  'rotate fija token_rotated_at');

select is(
  (select count(*)::text from public.evaluation_drafts
    where assignment_id = (select id from public.evaluation_assignments where token_last4 = 'r001')),
  '1', 'rotate pending preserva draft');

select is(
  (select count(*)::text from public.evaluation_sessions
    where assignment_id = (select id from public.evaluation_assignments where token_last4 = 'r001')
      and revoked_at is not null),
  '1', 'rotate revoca sesiones activas');

-- ============================ ROTATE in_progress ============================
select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where normalized_email = 'imp2@empresa-demo.test'),
    'aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999aaaa',
    'c003',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'ok',
  'true', 'issue assignment para in_progress OK');

update public.evaluation_assignments
set status = 'in_progress', started_at = timezone('utc', now())
where token_last4 = 'c003';

insert into public.evaluation_drafts (assignment_id, payload)
  values (
    (select id from public.evaluation_assignments where token_last4 = 'c003'),
    '{"step":2}'::jsonb);

select is(
  (public.admin_rotate_assignment_token(
    (select id from public.evaluation_assignments where token_last4 = 'c003'),
    'bbbbccccddddeeeeffff0000111122223333444455556666777788889999aaaabbbb',
    'r002',
    timezone('utc', now()) + interval '14 days'))->>'ok',
  'true', 'rotate in_progress OK');

select is(
  (select status::text from public.evaluation_assignments where token_last4 = 'r002'),
  'in_progress', 'rotate in_progress conserva status');

select is(
  (select count(*)::text from public.evaluation_drafts
    where assignment_id = (select id from public.evaluation_assignments where token_last4 = 'r002')),
  '1', 'rotate in_progress preserva draft');

-- ============================ ROTATE completed/revoked rechazado ==============
select is(
  (public.admin_create_worker('Felipe Revocado', 'felipe@empresa-demo.test'))->>'ok',
  'true', 'worker para rotate revoked OK');

insert into public.evaluation_assignments (
  id, campaign_id, worker_id, token_hash, token_last4, status,
  completed_at, started_at, questionnaire_version, token_issued_at
) values (
  'f0000000-0000-0000-0000-000000000001',
  (select id from public.evaluation_campaigns where status = 'active'),
  (select id from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  'ccccddddeeeeffff0000111122223333444455556666777788889999aaaabbbbcccc',
  'done',
  'completed',
  timezone('utc', now()),
  timezone('utc', now()),
  'nom035-stps-2018-guias-referencia-i-ii',
  timezone('utc', now())
);

select is(
  (public.admin_rotate_assignment_token(
    'f0000000-0000-0000-0000-000000000001',
    'ddddeeeeffff0000111122223333444455556666777788889999aaaabbbbccccdddd',
    'x999',
    timezone('utc', now()) + interval '7 days'))->>'code',
  'invalid_status', 'rotate completed rechazado');

insert into public.evaluation_assignments (
  id, campaign_id, worker_id, token_hash, token_last4, status,
  revoked_at, questionnaire_version, token_issued_at
) values (
  'f0000000-0000-0000-0000-000000000002',
  (select id from public.evaluation_campaigns where status = 'active'),
  (select id from public.workers where normalized_email = 'felipe@empresa-demo.test'),
  'eeeeffff0000111122223333444455556666777788889999aaaabbbbccccddddeeee',
  'revk',
  'revoked',
  timezone('utc', now()),
  'nom035-stps-2018-guias-referencia-i-ii',
  timezone('utc', now())
);

select is(
  (public.admin_rotate_assignment_token(
    'f0000000-0000-0000-0000-000000000002',
    'ffff0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    'y888',
    timezone('utc', now()) + interval '7 days'))->>'code',
  'invalid_status', 'rotate revoked rechazado');

-- ============================ REVOKE pending/in_progress + draft =============
select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where normalized_email = 'diana@empresa-demo.test'),
    '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
    'd004',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'code',
  'worker_inactive', 're-issue diana sigue inactiva (sanity)');

select is(
  (public.admin_reactivate_worker(
    (select id from public.workers where normalized_email = 'diana@empresa-demo.test')))->>'ok',
  'true', 'reactivate diana para revoke pending');

select is(
  (public.admin_issue_assignment(
    (select id from public.evaluation_campaigns where status = 'active'),
    (select id from public.workers where normalized_email = 'diana@empresa-demo.test'),
    '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
    'd004',
    timezone('utc', now()) + interval '7 days',
    'nom035-stps-2018-guias-referencia-i-ii'))->>'ok',
  'true', 'issue diana reactivada OK');

insert into public.evaluation_drafts (assignment_id, payload)
  values (
    (select id from public.evaluation_assignments where token_last4 = 'd004'),
    '{"pending_revoke":true}'::jsonb);

select is(
  (public.admin_revoke_assignment(
    (select id from public.evaluation_assignments where token_last4 = 'd004'),
    'Prueba administrativa'))->>'ok',
  'true', 'revoke pending OK');

select is(
  (select status::text from public.evaluation_assignments where token_last4 = 'd004'),
  'revoked', 'revoke pending deja status revoked');

select is(
  (select count(*)::text from public.evaluation_drafts
    where assignment_id = (select id from public.evaluation_assignments where token_last4 = 'd004')),
  '0', 'revoke pending elimina draft');

select is(
  (public.admin_revoke_assignment(
    (select id from public.evaluation_assignments where token_last4 = 'r002'),
    'Cierre administrativo'))->>'ok',
  'true', 'revoke in_progress OK');

select is(
  (public.admin_revoke_assignment(
    'f0000000-0000-0000-0000-000000000001',
    'No debe proceder'))->>'code',
  'invalid_status', 'revoke completed rechazado');

-- ============================ RESULTADOS mínimos =============================
insert into public.evaluation_results (
  id, assignment_id, worker_id, campaign_id,
  guia_i_requires_clinical_attention, guia_ii_final_score, guia_ii_final_risk_level,
  guia_ii_category_scores, guia_ii_domain_scores, guia_ii_dimension_scores,
  alerts, scoring_version, questionnaire_version, submission_id, completed_at
) values (
  'a0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  (select id from public.workers where normalized_email = 'bruno@empresa-demo.test'),
  (select id from public.evaluation_campaigns where status = 'active'),
  false,
  12,
  'bajo',
  '{"cat1":{"score":3}}'::jsonb,
  '{"dom1":{"score":4}}'::jsonb,
  '{"dim1":{"score":5}}'::jsonb,
  '[]'::jsonb,
  'nom035-v1',
  'nom035-stps-2018-guias-referencia-i-ii',
  '22222222-aaaa-4bbb-8ccc-000000000001'::uuid,
  timezone('utc', now())
);

insert into public.evaluation_answers (
  assignment_id, questionnaire_code, question_id, answer_text, answer_value
) values
  ('f0000000-0000-0000-0000-000000000001', 'GUIA_I', 'guia_i_1', 'No', 'no'),
  ('f0000000-0000-0000-0000-000000000001', 'GUIA_II', 'guia_ii_1', 'Casi nunca', '1');

-- ============================ DASHBOARD / LIST / DETAIL ======================
select is(
  (public.admin_dashboard_summary())->>'ok',
  'true', 'admin_dashboard_summary OK');

select ok(
  (public.admin_dashboard_summary())->'summary' ? 'activeWorkers',
  'dashboard incluye activeWorkers');

select ok(
  (public.admin_dashboard_summary())->'summary' ? 'assignments',
  'dashboard incluye assignments');

select is(
  (public.admin_list_results(null, null, null, null, null, 1, 10))->>'ok',
  'true', 'admin_list_results OK');

select ok(
  jsonb_array_length((public.admin_list_results())->'items') >= 1,
  'admin_list_results devuelve al menos un item');

select is(
  (public.admin_get_result_detail('a0000000-0000-0000-0000-000000000001'))->>'ok',
  'true', 'admin_get_result_detail OK');

select is(
  jsonb_array_length(
    (public.admin_get_result_detail('a0000000-0000-0000-0000-000000000001'))->'detail'->'answers'),
  2, 'admin_get_result_detail incluye respuestas');

select ok(
  not ((public.admin_get_result_detail('a0000000-0000-0000-0000-000000000001')) ? 'token_hash'),
  'result detail no expone token_hash');

-- ============================ AUDIT_LOG =====================================
select ok(
  exists (select 1 from public.audit_log where action = 'company.updated'),
  'audit company.updated');

select ok(
  exists (select 1 from public.audit_log where action = 'worker.created'),
  'audit worker.created');

select ok(
  exists (select 1 from public.audit_log where action = 'worker.updated'),
  'audit worker.updated');

select ok(
  exists (select 1 from public.audit_log where action = 'worker.deactivated'),
  'audit worker.deactivated');

select ok(
  exists (select 1 from public.audit_log where action = 'worker.deleted'),
  'audit worker.deleted');

select ok(
  exists (select 1 from public.audit_log where action = 'workers.imported'),
  'audit workers.imported');

select ok(
  exists (select 1 from public.audit_log where action = 'campaign.created'),
  'audit campaign.created');

select ok(
  exists (select 1 from public.audit_log where action = 'campaign.activated'),
  'audit campaign.activated');

select ok(
  exists (select 1 from public.audit_log where action = 'campaign.closed'),
  'audit campaign.closed');

select ok(
  exists (select 1 from public.audit_log where action = 'campaign.updated'),
  'audit campaign.updated');

select ok(
  exists (select 1 from public.audit_log where action = 'assignment.issued'),
  'audit assignment.issued');

select ok(
  exists (select 1 from public.audit_log where action = 'assignment.token_rotated'),
  'audit assignment.token_rotated');

select ok(
  exists (select 1 from public.audit_log where action = 'assignment.revoked'),
  'audit assignment.revoked');

select ok(
  exists (select 1 from public.audit_log where action = 'result.viewed'),
  'audit result.viewed');

select is(
  (select count(*)::text from public.audit_log where metadata ? 'token_hash'),
  '0', 'audit_log sin token_hash en metadata');

select is(
  (select count(*)::text from public.audit_log
    where metadata ? 'answers' or metadata ? 'answer_value' or metadata ? 'responses'),
  '0', 'audit_log sin respuestas personales en metadata');

select * from finish();
rollback;
