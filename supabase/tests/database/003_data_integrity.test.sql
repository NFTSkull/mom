-- =============================================================================
-- B4.2 · pgTAP · Integridad de datos (positivos y negativos)
-- SQLSTATE: 23502 not-null · 23503 FK · 23505 unique · 23514 check · 22P02 enum
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- IDs fijos para referencias
-- worker A 111..1, worker B 222..2, campaign 333..3, assignment 444..4

-- ============================ A) company_settings ===========================
select throws_ok(
  $$insert into public.company_settings (razon_social, total_trabajadores)
    values ('ACME', -5)$$,
  '23514', NULL, 'company_settings rechaza total_trabajadores negativo');

select lives_ok(
  $$insert into public.company_settings (razon_social, total_trabajadores)
    values ('ACME SA de CV', 10)$$,
  'company_settings permite una configuración válida');

select throws_ok(
  $$insert into public.company_settings (razon_social, total_trabajadores)
    values ('OTRA', 3)$$,
  '23505', NULL, 'company_settings rechaza una segunda fila (singleton)');

-- ================================ B) workers ================================
select throws_ok(
  $$insert into public.workers (email) values ('x@x.com')$$,
  '23502', NULL, 'workers exige nombre (NOT NULL)');

select lives_ok(
  $$insert into public.workers (id, nombre, email)
    values ('11111111-1111-1111-1111-111111111111','Trabajador A', NULL)$$,
  'workers permite email nullable');

select lives_ok(
  $$insert into public.workers (id, nombre)
    values ('22222222-2222-2222-2222-222222222222','Trabajador B')$$,
  'workers inserta B');

select is(
  (select activo from public.workers
     where id='22222222-2222-2222-2222-222222222222'),
  true, 'workers.activo default true');

select lives_ok(
  $$update public.workers set activo=false
     where id='22222222-2222-2222-2222-222222222222'$$,
  'workers permite desactivar');

-- ============================== C) campaigns ================================
select lives_ok(
  $$insert into public.evaluation_campaigns (id, nombre, fecha_inicio, fecha_cierre)
    values ('33333333-3333-3333-3333-333333333333','Campaña 2026',
            '2026-01-01','2026-03-01')$$,
  'campaigns permite campaña válida');

select throws_ok(
  $$insert into public.evaluation_campaigns (nombre, fecha_inicio, fecha_cierre)
    values ('Mala','2026-03-01','2026-01-01')$$,
  '23514', NULL, 'campaigns rechaza fecha_cierre < fecha_inicio');

select throws_ok(
  $$insert into public.evaluation_campaigns (nombre, status)
    values ('X','status_invalido')$$,
  '22P02', NULL, 'campaigns rechaza status inválido');

-- ============================= D) assignments ===============================
select lives_ok(
  $$insert into public.evaluation_assignments
      (id, campaign_id, worker_id, token_hash, token_last4)
    values ('44444444-4444-4444-4444-444444444444',
            '33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111','hash_A','1234')$$,
  'assignments permite assignment válido');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_A','5678')$$,
  '23505', NULL, 'assignments rechaza token_hash duplicado');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4)
    values ('33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111','hash_dup','9999')$$,
  '23505', NULL, 'assignments rechaza mismo worker+campaña');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_b','12')$$,
  '23514', NULL, 'assignments exige token_last4 de longitud 4');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_c','1234','no_estado')$$,
  '22P02', NULL, 'assignments rechaza status inválido');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_d','1234','completed')$$,
  '23514', NULL, 'assignments: completed exige completed_at (coherencia B4.2)');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_e','1234','revoked')$$,
  '23514', NULL, 'assignments: revoked exige revoked_at (coherencia B4.2)');

select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4)
    values ('99999999-9999-9999-9999-999999999999',
            '11111111-1111-1111-1111-111111111111','hash_f','1234')$$,
  '23503', NULL, 'assignments rechaza campaign_id inexistente (FK)');

-- Segundo assignment (worker B) para pruebas que requieren otro assignment_id
select lives_ok(
  $$insert into public.evaluation_assignments
      (id, campaign_id, worker_id, token_hash, token_last4)
    values ('55555555-5555-5555-5555-555555555555',
            '33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222','hash_B','5678')$$,
  'assignments permite segundo assignment (worker B)');

-- FK RESTRICT: no borrar worker con assignment
select throws_ok(
  $$delete from public.workers where id='11111111-1111-1111-1111-111111111111'$$,
  '23503', NULL, 'workers: ON DELETE RESTRICT con assignment existente');

-- ================================ E) answers ================================
select lives_ok(
  $$insert into public.evaluation_answers
      (assignment_id, questionnaire_code, question_id, answer_value)
    values ('44444444-4444-4444-4444-444444444444','GUIA_II','q1','nunca')$$,
  'answers permite respuesta válida');

select throws_ok(
  $$insert into public.evaluation_answers
      (assignment_id, questionnaire_code, question_id, answer_value)
    values ('44444444-4444-4444-4444-444444444444','GUIA_II','q1','siempre')$$,
  '23505', NULL, 'answers rechaza duplicado assignment/cuestionario/pregunta');

select throws_ok(
  $$insert into public.evaluation_answers
      (assignment_id, questionnaire_code, question_id)
    values ('99999999-9999-9999-9999-999999999999','GUIA_II','q2')$$,
  '23503', NULL, 'answers rechaza assignment inexistente (FK)');

-- ================================ F) results ================================
select lives_ok(
  $$insert into public.evaluation_results
      (assignment_id, worker_id, campaign_id, scoring_version, submission_id, completed_at)
    values ('44444444-4444-4444-4444-444444444444',
            '11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333',
            'nom035-stps-2018-guia-i-ii-v1',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now())$$,
  'results permite un resultado válido');

select is(
  (select guia_ii_category_scores::text from public.evaluation_results
     where assignment_id='44444444-4444-4444-4444-444444444444'),
  '{}', 'results.guia_ii_category_scores default {}');

select throws_ok(
  $$insert into public.evaluation_results
      (assignment_id, worker_id, campaign_id, scoring_version, submission_id, completed_at)
    values ('44444444-4444-4444-4444-444444444444',
            '11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333','v1',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', now())$$,
  '23505', NULL, 'results rechaza segundo resultado para el mismo assignment');

select throws_ok(
  $$insert into public.evaluation_results
      (assignment_id, worker_id, campaign_id, scoring_version, submission_id, completed_at)
    values ('55555555-5555-5555-5555-555555555555',
            '88888888-8888-8888-8888-888888888888',
            '33333333-3333-3333-3333-333333333333','v1',
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now())$$,
  '23503', NULL, 'results rechaza worker inexistente (FK)');

select throws_ok(
  $$insert into public.evaluation_results
      (assignment_id, worker_id, campaign_id, submission_id, completed_at)
    values ('44444444-4444-4444-4444-444444444444',
            '11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333',
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd', now())$$,
  '23502', NULL, 'results exige scoring_version (NOT NULL)');

select throws_ok(
  $$insert into public.evaluation_results
      (assignment_id, worker_id, campaign_id, scoring_version, submission_id)
    values ('44444444-4444-4444-4444-444444444444',
            '11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333','v1',
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$$,
  '23502', NULL, 'results exige completed_at (NOT NULL)');

-- ============================= G) action_plans ==============================
select lives_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type,
       description, responsible, due_date)
    values ('33333333-3333-3333-3333-333333333333','Operaciones','Carga de trabajo',
            'alto','segundo_nivel','grupal','Rediseñar cargas','RH','2026-06-01')$$,
  'action_plans permite plan válido');

select throws_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type,
       description, responsible, due_date, status)
    values ('33333333-3333-3333-3333-333333333333','A','B','alto','segundo_nivel',
            'grupal','d','r','2026-06-01','estatus_malo')$$,
  '22P02', NULL, 'action_plans rechaza status inválido');

-- B4.5: due_date ahora es nullable (acciones sugeridas/manuales sin fecha).
select lives_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type,
       description, responsible)
    values ('33333333-3333-3333-3333-333333333333','A','B','alto','segundo_nivel',
            'grupal','d','r')$$,
  'action_plans permite due_date nullable (B4.5)');

-- ================================ H) evidence ===============================
-- B4.5: evidencia externa (referencia HTTPS) con campaign nullable.
select lives_ok(
  $$insert into public.evidence_items
      (campaign_id, title, evidence_type, description, evidence_source, external_url)
    values (NULL,'Política firmada','politica','PDF de política','external',
            'https://ejemplo.local/politica.pdf')$$,
  'evidence permite campaign nullable (external)');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, external_url, size_bytes)
    values ('x','reporte','d','external','https://ejemplo.local/a.pdf', -1)$$,
  '23514', NULL, 'evidence rechaza size_bytes inválido');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, external_url)
    values ('x','tipo_malo','d','external','https://ejemplo.local/a.pdf')$$,
  '22P02', NULL, 'evidence rechaza evidence_type inválido');

-- =============================== I) complaints ==============================
select lives_ok(
  $$insert into public.confidential_complaints
      (folio, complaint_type, description)
    values ('F-0001','violencia_laboral','Descripción del caso')$$,
  'complaints permite queja anónima válida');

select throws_ok(
  $$insert into public.confidential_complaints
      (folio, complaint_type, description)
    values ('F-0001','otro','Otra')$$,
  '23505', NULL, 'complaints rechaza folio duplicado');

select throws_ok(
  $$insert into public.confidential_complaints (folio, complaint_type)
    values ('F-0002','otro')$$,
  '23502', NULL, 'complaints exige description (NOT NULL)');

select throws_ok(
  $$insert into public.confidential_complaints
      (folio, complaint_type, description, status)
    values ('F-0003','otro','d','estatus_malo')$$,
  '22P02', NULL, 'complaints rechaza status inválido');

select throws_ok(
  $$insert into public.confidential_complaints
      (folio, complaint_type, description, is_anonymous, reporter_name)
    values ('F-0004','otro','d', true, 'Juan')$$,
  '23514', NULL, 'complaints: anónima no puede portar datos del reportante (B4.2)');

select lives_ok(
  $$insert into public.confidential_complaints
      (folio, complaint_type, description, is_anonymous, reporter_name)
    values ('F-0005','otro','d', false, 'Juan Pérez')$$,
  'complaints permite identificada con datos');

-- ================================ J) policy =================================
select throws_ok(
  $$insert into public.policy_documents (title, version) values ('P', '1.0')$$,
  '23502', NULL, 'policy exige content (NOT NULL)');

select lives_ok(
  $$insert into public.policy_documents (title, content, version)
    values ('Política','Contenido','1.0')$$,
  'policy permite borrador sin published_at');

select throws_ok(
  $$insert into public.policy_documents (title, content, version, status)
    values ('Política 2','Contenido','2.0','publicada')$$,
  '23514', NULL, 'policy: publicada exige published_at (coherencia B4.2)');

select lives_ok(
  $$insert into public.policy_documents
      (title, content, version, status, published_at)
    values ('Política 3','Contenido','3.0','publicada', now())$$,
  'policy permite publicada con published_at');

select throws_ok(
  $$insert into public.policy_documents (title, content, version, status)
    values ('P','c','1.0','estatus_malo')$$,
  '22P02', NULL, 'policy rechaza status inválido');

-- =============================== K) audit_log ===============================
select throws_ok(
  $$insert into public.audit_log (entity_type) values ('worker')$$,
  '23502', NULL, 'audit_log exige action (NOT NULL)');

select throws_ok(
  $$insert into public.audit_log (action) values ('create')$$,
  '23502', NULL, 'audit_log exige entity_type (NOT NULL)');

select lives_ok(
  $$insert into public.audit_log (action, entity_type, entity_id)
    values ('create','worker','11111111-1111-1111-1111-111111111111')$$,
  'audit_log permite registro válido');

select is(
  (select metadata::text from public.audit_log
     where action='create' and entity_type='worker' limit 1),
  '{}', 'audit_log.metadata default {}');

select * from finish();
rollback;
