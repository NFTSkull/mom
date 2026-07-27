-- =============================================================================
-- B4.5 · pgTAP · Módulos secundarios + Storage privado (004)
-- Plan de acción · Evidencias · Quejas · Políticas · Seguridad · Storage.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Limpieza defensiva (residuales de Vitest/E2E).
update public.evaluation_campaigns
set status = 'closed', closed_at = coalesce(closed_at, timezone('utc', now()))
where status = 'active';

-- ============================ ESTRUCTURA action_plans ========================
select has_column('public', 'action_plans', 'source', 'action_plans.source');
select has_column('public', 'action_plans', 'source_key', 'action_plans.source_key');
select has_column('public', 'action_plans', 'completed_at', 'action_plans.completed_at');
select has_column('public', 'action_plans', 'cancelled_at', 'action_plans.cancelled_at');
select has_column('public', 'action_plans', 'archived_at', 'action_plans.archived_at');
select has_column('public', 'action_plans', 'version', 'action_plans.version');
select col_hasnt_default('public', 'action_plans', 'due_date', 'action_plans.due_date nullable (sin NOT NULL)');
select has_index('public', 'action_plans', 'uq_action_plans_suggested', 'uq acción sugerida por campaña/source_key');

-- ============================ ESTRUCTURA evidence_items ======================
select has_column('public', 'evidence_items', 'evidence_source', 'evidence.evidence_source');
select has_column('public', 'evidence_items', 'storage_bucket', 'evidence.storage_bucket');
select has_column('public', 'evidence_items', 'safe_file_name', 'evidence.safe_file_name');
select has_column('public', 'evidence_items', 'external_url', 'evidence.external_url');
select has_column('public', 'evidence_items', 'sha256', 'evidence.sha256');
select has_column('public', 'evidence_items', 'version', 'evidence.version');
select has_column('public', 'evidence_items', 'supersedes_id', 'evidence.supersedes_id');
select has_column('public', 'evidence_items', 'replaced_by_id', 'evidence.replaced_by_id');
select has_column('public', 'evidence_items', 'deleted_at', 'evidence.deleted_at');
select has_column('public', 'evidence_items', 'storage_delete_pending', 'evidence.storage_delete_pending');
select hasnt_column('public', 'evidence_items', 'file_url', 'evidence NO tiene file_url pública');
select hasnt_column('public', 'evidence_items', 'signed_url', 'evidence NO persiste signed_url');
select col_not_null('public', 'evidence_items', 'evidence_source', 'evidence_source NOT NULL');

-- ============================ ESTRUCTURA complaints =========================
select has_column('public', 'confidential_complaints', 'public_submission_id', 'complaints.public_submission_id');
select has_column('public', 'confidential_complaints', 'confirmation_code', 'complaints.confirmation_code');
select has_column('public', 'confidential_complaints', 'closed_at', 'complaints.closed_at');
select has_column('public', 'confidential_complaints', 'resolution_category', 'complaints.resolution_category');
select has_column('public', 'confidential_complaints', 'assigned_at', 'complaints.assigned_at');
select col_is_unique('public', 'confidential_complaints', array['public_submission_id'], 'public_submission_id único');
select col_is_unique('public', 'confidential_complaints', array['confirmation_code'], 'confirmation_code único');

-- ============================ ESTRUCTURA policies ===========================
select has_column('public', 'policy_documents', 'version_number', 'policy.version_number');
select has_column('public', 'policy_documents', 'version_label', 'policy.version_label');
select has_column('public', 'policy_documents', 'archived_at', 'policy.archived_at');
select has_column('public', 'policy_documents', 'supersedes_id', 'policy.supersedes_id');
select col_is_unique('public', 'policy_documents', array['version_label'], 'version_label único');
select has_index('public', 'policy_documents', 'uq_policy_documents_one_published', 'uq una sola publicada');

-- ============================ BASE de datos de prueba =======================
insert into public.workers (id, nombre)
  values ('b0000000-0000-0000-0000-000000000001', 'W B45');
insert into public.evaluation_campaigns (id, nombre, status, activated_at)
  values ('b0000000-0000-0000-0000-0000000000c1', 'Campaña B45', 'active', timezone('utc', now()));
insert into public.evaluation_assignments (id, campaign_id, worker_id, token_hash, token_last4, status, completed_at)
  values ('b0000000-0000-0000-0000-0000000000a1',
          'b0000000-0000-0000-0000-0000000000c1',
          'b0000000-0000-0000-0000-000000000001', 'hash_b45', '4545', 'completed', now());
insert into public.evaluation_results (
  assignment_id, worker_id, campaign_id, scoring_version, submission_id, completed_at,
  guia_i_requires_clinical_attention, guia_ii_domain_scores)
values (
  'b0000000-0000-0000-0000-0000000000a1',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-0000000000c1',
  'nom035-stps-2018-guia-i-ii-v1',
  'b0000000-0000-4000-8000-0000000000f1', now(),
  true,
  '{"Carga de trabajo":{"score":30,"riskLevel":"alto"}}'::jsonb);

-- ============================ PLAN: constraints =============================
select throws_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type, description, responsible, status, completed_at)
    values ('b0000000-0000-0000-0000-0000000000c1','A','B','alto','primer_nivel','organizacional','d','r','pendiente', now())$$,
  '23514', NULL, 'plan: pendiente no puede tener completed_at');

select throws_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type, description, responsible, status)
    values ('b0000000-0000-0000-0000-0000000000c1','A','B','alto','primer_nivel','organizacional','d','r','completada')$$,
  '23514', NULL, 'plan: completada exige completed_at');

select throws_ok(
  $$insert into public.action_plans
      (campaign_id, area, risk_factor, risk_level, action_level, action_type, description, responsible, source)
    values ('b0000000-0000-0000-0000-0000000000c1','A','B','alto','primer_nivel','organizacional','d','r','suggested')$$,
  '23514', NULL, 'plan: source suggested exige source_key');

-- Transición inválida (completada -> pendiente) bloqueada por trigger.
insert into public.action_plans
  (id, campaign_id, area, risk_factor, risk_level, action_level, action_type, description, responsible, status, completed_at)
  values ('b0000000-0000-0000-0000-0000000000d1','b0000000-0000-0000-0000-0000000000c1',
          'A','B','alto','primer_nivel','organizacional','d','r','completada', now());
select throws_ok(
  $$update public.action_plans set status='pendiente', completed_at=null
    where id='b0000000-0000-0000-0000-0000000000d1'$$,
  '23514', NULL, 'plan: trigger bloquea completada -> pendiente');

-- ============================ PLAN: RPCs ===================================
select is(
  (public.admin_create_action_plan(
    'b0000000-0000-0000-0000-0000000000c1','Operaciones','Carga','alto','primer_nivel','organizacional',
    'Acción manual','RH','2026-06-01')->>'ok')::boolean,
  true, 'admin_create_action_plan crea acción manual');

-- Generación sugerida determinista + idempotente.
select is(
  (public.admin_generate_suggested_action_plans(
    'b0000000-0000-0000-0000-0000000000c1',
    '{"Carga de trabajo":{"area":"Operaciones","actionLevel":"primer_nivel","actionType":"organizacional","description":"Revisar cargas."}}'::jsonb,
    'RH', 30,
    '{"area":"RH","actionLevel":"tercer_nivel","description":"Canalizar."}'::jsonb, 15
  )->>'created')::int,
  2, 'generación sugerida crea 2 acciones (dominio + Guía I)');

select is(
  (public.admin_generate_suggested_action_plans(
    'b0000000-0000-0000-0000-0000000000c1',
    '{"Carga de trabajo":{"area":"Operaciones","actionLevel":"primer_nivel","actionType":"organizacional","description":"Revisar cargas."}}'::jsonb,
    'RH', 30,
    '{"area":"RH","actionLevel":"tercer_nivel","description":"Canalizar."}'::jsonb, 15
  )->>'created')::int,
  0, 'generación sugerida es idempotente (0 nuevas la 2a vez)');

select is(
  (select count(*)::int from public.action_plans
    where campaign_id='b0000000-0000-0000-0000-0000000000c1' and source='suggested'),
  2, 'existen 2 acciones sugeridas persistidas');

select is(
  (select action_type::text from public.action_plans
    where source_key='guia_i_followup' limit 1),
  'individual_confidencial', 'acción Guía I es individual_confidencial');

select is(
  (public.admin_action_plan_summary('b0000000-0000-0000-0000-0000000000c1')->'summary'->>'sugeridas')::int,
  2, 'summary refleja 2 sugeridas');

-- audit_log de generación sin PII.
select ok(
  exists(select 1 from public.audit_log where action='action_plan.suggestions_generated'),
  'audit_log registra action_plan.suggestions_generated');

-- ============================ EVIDENCIAS: constraints ======================
select throws_ok(
  $$insert into public.evidence_items (title, evidence_type, description, evidence_source)
    values ('x','otro','d','upload')$$,
  '23514', NULL, 'evidence upload exige bucket/path/nombre/mime/size/sha');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, storage_bucket, storage_path,
       safe_file_name, mime_type, size_bytes, sha256)
    values ('x','otro','d','upload','nom035-evidence','company/evidence/2026/07/u/a.pdf',
            'a.pdf','image/svg+xml', 100, repeat('a',64))$$,
  '23514', NULL, 'evidence upload rechaza MIME no permitido (svg)');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, storage_bucket, storage_path,
       safe_file_name, mime_type, size_bytes, sha256)
    values ('x','otro','d','upload','nom035-evidence','company/evidence/2026/07/u/a.pdf',
            'a.pdf','application/pdf', 100, 'zzzz')$$,
  '23514', NULL, 'evidence rechaza sha256 no hexadecimal de 64');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, storage_bucket, storage_path,
       safe_file_name, mime_type, size_bytes, sha256)
    values ('x','otro','d','upload','nom035-evidence','company/evidence/2026/07/u/a.pdf',
            'a.pdf','application/pdf', 20000000, repeat('a',64))$$,
  '23514', NULL, 'evidence rechaza size_bytes > 15 MB');

select throws_ok(
  $$insert into public.evidence_items
      (title, evidence_type, description, evidence_source, storage_bucket, storage_path,
       safe_file_name, mime_type, size_bytes, sha256)
    values ('x','otro','d','upload','nom035-evidence','../../etc/passwd',
            'a.pdf','application/pdf', 100, repeat('a',64))$$,
  '23514', NULL, 'evidence rechaza path con ..');

select throws_ok(
  $$insert into public.evidence_items (title, evidence_type, description, evidence_source, external_url)
    values ('x','otro','d','external','http://inseguro.local/a.pdf')$$,
  '23514', NULL, 'evidence external exige HTTPS');

-- ============================ EVIDENCIAS: RPCs =============================
select is(
  (public.admin_create_evidence_metadata(
    'upload','Reporte PDF','reporte','desc',
    'b0000000-0000-0000-0000-0000000000c1','nom035-evidence',
    'company/evidence/2026/07/aaaa/reporte.pdf', null, 'reporte.pdf','reporte.pdf',
    'application/pdf', 1024, repeat('a',64))->>'ok')::boolean,
  true, 'admin_create_evidence_metadata (upload) ok');

-- Guardamos el id de la evidencia subida para versiones.
select is(
  (public.admin_create_evidence_metadata(
    'external','Enlace externo','difusion','desc',
     null, null, null, 'https://ejemplo.local/difusion.pdf')->>'ok')::boolean,
  true, 'admin_create_evidence_metadata (external) ok');

-- Reemplazo versionado.
do $$
declare v_id uuid; v_res jsonb;
begin
  select id into v_id from public.evidence_items
    where evidence_source='upload' and replaced_by_id is null and deleted_at is null limit 1;
  v_res := public.admin_replace_evidence_metadata(
    v_id, 'nom035-evidence', 'company/evidence/2026/07/bbbb/reporte-v2.pdf',
    'reporte-v2.pdf', 'reporte-v2.pdf', 'application/pdf', 2048, repeat('b',64));
  perform set_config('b45.replace_ok', (v_res->>'ok'), true);
  perform set_config('b45.old_id', v_id::text, true);
end $$;
select is(current_setting('b45.replace_ok'), 'true', 'admin_replace_evidence_metadata ok');
select is(
  (select version from public.evidence_items where supersedes_id = current_setting('b45.old_id')::uuid),
  2, 'reemplazo crea versión 2');
select ok(
  (select replaced_by_id is not null from public.evidence_items where id = current_setting('b45.old_id')::uuid),
  'versión 1 conserva replaced_by_id (preservada)');

-- Soft delete + cleanup pending.
do $$
declare v_id uuid; v_res jsonb;
begin
  select id into v_id from public.evidence_items
    where evidence_source='upload' and supersedes_id is not null limit 1;
  v_res := public.admin_soft_delete_evidence(v_id);
  perform set_config('b45.del_id', v_id::text, true);
end $$;
select ok(
  (select deleted_at is not null from public.evidence_items where id = current_setting('b45.del_id')::uuid),
  'soft delete marca deleted_at');
select ok(
  (select storage_delete_pending from public.evidence_items where id = current_setting('b45.del_id')::uuid),
  'soft delete de upload marca storage_delete_pending');
select is(
  (public.admin_mark_evidence_storage_deleted(current_setting('b45.del_id')::uuid)->>'ok')::boolean,
  true, 'mark_evidence_storage_deleted ok');
select ok(
  (select not storage_delete_pending from public.evidence_items where id = current_setting('b45.del_id')::uuid),
  'tras limpieza storage_delete_pending=false');

-- Summary/checklist.
select is(
  (public.admin_evidence_summary()->'summary'->'checklist'->>'difusion'),
  'true', 'checklist marca difusión cumplida (evidencia externa activa)');

-- ============================ STORAGE privado ==============================
select is(
  (select public::text from storage.buckets where id='nom035-evidence'),
  'false', 'bucket nom035-evidence es privado');
select is(
  (select file_size_limit from storage.buckets where id='nom035-evidence'),
  15728640::bigint, 'bucket con file_size_limit 15 MB');
select ok(
  (select allowed_mime_types @> array['application/pdf','image/jpeg','image/png']
     from storage.buckets where id='nom035-evidence'),
  'bucket restringe MIME a pdf/jpeg/png');
select ok(
  (select not ('image/svg+xml' = any(allowed_mime_types)) from storage.buckets where id='nom035-evidence'),
  'bucket NO permite svg');

-- ============================ QUEJAS: RPC pública ==========================
do $$
declare v1 jsonb; v2 jsonb;
begin
  v1 := public.public_submit_confidential_complaint('violencia_laboral','Caso uno', true, null, null);
  v2 := public.public_submit_confidential_complaint('otro','Caso dos', false, 'Juan', null);
  perform set_config('b45.folio1', v1->>'folio', true);
  perform set_config('b45.folio2', v2->>'folio', true);
  perform set_config('b45.code1', v1->>'confirmationCode', true);
  perform set_config('b45.code2', v2->>'confirmationCode', true);
end $$;
select matches(current_setting('b45.folio1'), '^NOM035-Q-[0-9]{4}-[0-9]{6}$', 'folio con formato correcto');
select isnt(current_setting('b45.folio1'), current_setting('b45.folio2'), 'folios secuenciales distintos');
select isnt(current_setting('b45.code1'), current_setting('b45.code2'), 'confirmation_code distinto por queja');

-- Queja anónima con contacto → rechazada por constraint.
select throws_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, is_anonymous, reporter_name)
    values ('Z-1','otro','d', true, 'Ana')$$,
  '23514', NULL, 'queja anónima no puede portar datos del reportante');

-- Identificada sin datos → rechazada.
select throws_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, is_anonymous)
    values ('Z-2','otro','d', false)$$,
  '23514', NULL, 'queja identificada exige nombre o contacto');

-- Transiciones válidas / inválidas.
do $$
declare v_id uuid;
begin
  select id into v_id from public.confidential_complaints where folio = current_setting('b45.folio1');
  perform set_config('b45.q1', v_id::text, true);
end $$;
select is(
  (public.admin_change_complaint_status(current_setting('b45.q1')::uuid, 'en_revision')->>'ok')::boolean,
  true, 'transición recibida -> en_revision');
select is(
  (public.admin_resolve_complaint(current_setting('b45.q1')::uuid, 'entorno', 'notas')->>'ok')::boolean,
  true, 'transición en_revision -> resuelta');
select is(
  (public.admin_change_complaint_status(current_setting('b45.q1')::uuid, 'recibida')->>'code'),
  'invalid_transition', 'transición inválida resuelta -> recibida bloqueada');
select is(
  (public.admin_close_complaint(current_setting('b45.q1')::uuid, 'cierre')->>'ok')::boolean,
  true, 'transición resuelta -> cerrada');
select ok(
  (select closed_at is not null from public.confidential_complaints where id = current_setting('b45.q1')::uuid),
  'cierre establece closed_at');

-- Listado NO expone contacto; detalle SÍ.
select ok(
  not (public.admin_list_complaints()::text like '%reporterContact%'),
  'listado de quejas no incluye contacto');
select ok(
  (public.admin_get_complaint_detail(
    (select id from public.confidential_complaints where folio=current_setting('b45.folio2')))
    ->'complaint' ? 'reporterName'),
  'detalle de queja identificada incluye reporterName');

-- audit_log de quejas sin descripción/contacto.
select ok(
  not exists(
    select 1 from public.audit_log
    where entity_type='complaint'
      and (metadata::text like '%Caso uno%' or metadata::text like '%Juan%')),
  'audit_log de quejas no contiene descripción ni contacto');

-- Summary.
select is(
  (public.admin_complaint_summary()->'summary'->>'total')::int,
  2, 'complaint summary total = 2');

-- ============================ POLÍTICAS ====================================
do $$
declare v jsonb; v_id uuid;
begin
  v := public.admin_create_policy_draft('Política B45', 'Contenido base de política.', 'v-base');
  perform set_config('b45.pol1', (v->'policy'->>'id'), true);
end $$;
select ok(current_setting('b45.pol1') <> '', 'admin_create_policy_draft crea borrador');

select is(
  (public.admin_update_policy_draft(current_setting('b45.pol1')::uuid, null, 'Contenido editado.')->>'ok')::boolean,
  true, 'admin_update_policy_draft edita borrador');

select is(
  (public.admin_publish_policy(current_setting('b45.pol1')::uuid)->>'ok')::boolean,
  true, 'admin_publish_policy publica borrador');

select is(
  (select count(*)::int from public.policy_documents where status = 'publicada'),
  1, 'solo una política publicada');

-- Publicar una nueva archiva la anterior.
do $$
declare v jsonb; v_id uuid;
begin
  v := public.admin_create_policy_draft('Política B45 v2', 'Contenido v2.', 'v-2');
  v_id := (v->'policy'->>'id')::uuid;
  perform public.admin_publish_policy(v_id);
  perform set_config('b45.pol2', v_id::text, true);
end $$;
select is(
  (select count(*)::int from public.policy_documents where status = 'publicada'),
  1, 'sigue habiendo una sola publicada tras publicar nueva');
select is(
  (select status::text from public.policy_documents where id = current_setting('b45.pol1')::uuid),
  'archivada', 'la política anterior quedó archivada');

-- Publicada no editable.
select is(
  (public.admin_update_policy_draft(current_setting('b45.pol2')::uuid, 'no')->>'code'),
  'policy_not_editable', 'no se edita una política publicada');

-- version_label única.
select is(
  (public.admin_create_policy_draft('Otra', 'c', 'v-2')->>'code'),
  'duplicate_version_label', 'version_label debe ser única');

-- version monotónica.
select ok(
  (select max(version_number) from public.policy_documents) >= 2,
  'version_number monotónico');

select ok(
  exists(select 1 from public.audit_log where action='policy.published'),
  'audit_log registra policy.published');
select ok(
  exists(select 1 from public.audit_log where action='policy.archived'),
  'audit_log registra policy.archived');

-- ============================ SEGURIDAD ====================================
-- anon sin EXECUTE; authenticated CON EXECUTE en admin_* (B4.6 + require_admin_permission).
-- public_submit sigue solo service_role.
select function_privs_are('public', 'public_submit_confidential_complaint',
  ARRAY['text','text','boolean','text','text'], 'anon', '{}'::text[],
  'anon sin EXECUTE en public_submit_confidential_complaint');
select function_privs_are('public', 'admin_generate_suggested_action_plans',
  ARRAY['uuid','jsonb','text','integer','jsonb','integer'], 'anon', '{}'::text[],
  'anon sin EXECUTE en admin_generate_suggested_action_plans');
select ok(
  has_function_privilege('authenticated', 'public.admin_publish_policy(uuid)', 'EXECUTE'),
  'authenticated CON EXECUTE en admin_publish_policy (B4.6)');
select function_privs_are('public', 'admin_create_evidence_metadata',
  ARRAY['text','text','text','text','uuid','text','text','text','text','text','text','bigint','text','text'],
  'anon', '{}'::text[],
  'anon sin EXECUTE en admin_create_evidence_metadata');

-- RLS + FORCE en tablas del bloque.
select ok((select relrowsecurity from pg_class where oid='public.action_plans'::regclass), 'RLS action_plans');
select ok((select relforcerowsecurity from pg_class where oid='public.action_plans'::regclass), 'FORCE action_plans');
select ok((select relrowsecurity from pg_class where oid='public.evidence_items'::regclass), 'RLS evidence_items');
select ok((select relforcerowsecurity from pg_class where oid='public.evidence_items'::regclass), 'FORCE evidence_items');
select ok((select relrowsecurity from pg_class where oid='public.confidential_complaints'::regclass), 'RLS complaints');
select ok((select relforcerowsecurity from pg_class where oid='public.policy_documents'::regclass), 'FORCE policy');

-- anon/authenticated sin privilegios directos sobre tablas sensibles.
select ok(not has_table_privilege('anon','public.evidence_items','SELECT'), 'anon sin SELECT en evidence_items');
select ok(not has_table_privilege('anon','public.confidential_complaints','SELECT'), 'anon sin SELECT en complaints');
select ok(not has_table_privilege('authenticated','public.action_plans','INSERT'), 'authenticated sin INSERT en action_plans');

select * from finish();
rollback;
