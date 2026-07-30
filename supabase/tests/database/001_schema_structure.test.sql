-- =============================================================================
-- B4.2 · pgTAP · Estructura del esquema NOM-035
-- Consulta el catálogo real de PostgreSQL (no busca texto en el .sql).
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- --- 17 tablas esperadas (16 previas + worker_accounts B4.9) ----------------
select has_table('public', t, 'tabla ' || t || ' existe')
from unnest(array[
  'company_settings','admin_profiles','workers','evaluation_campaigns',
  'evaluation_assignments','evaluation_answers','evaluation_results',
  'action_plans','evidence_items','confidential_complaints',
  'policy_documents','audit_log',
  'evaluation_drafts','evaluation_sessions','public_rate_limits',
  'role_permissions','worker_accounts'
]) as t;

select is(
  (select count(*)::int from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'),
  17, 'public tiene exactamente 17 tablas base');

-- --- Columnas clave ----------------------------------------------------------
select has_column('public','company_settings','singleton_lock','company_settings.singleton_lock');
select has_column('public','company_settings','total_trabajadores','company_settings.total_trabajadores');
select has_column('public','workers','activo','workers.activo');
select has_column('public','evaluation_assignments','token_hash','assignments.token_hash');
select has_column('public','evaluation_assignments','token_last4','assignments.token_last4');
select has_column('public','evaluation_assignments','status','assignments.status');
select has_column('public','evaluation_results','scoring_version','results.scoring_version');
select has_column('public','evaluation_results','completed_at','results.completed_at');
select has_column('public','audit_log','metadata','audit_log.metadata');

-- --- SIN token en texto plano; SÍ token_hash --------------------------------
select hasnt_column('public','evaluation_assignments','token',
  'evaluation_assignments NO tiene columna token en texto plano');
select col_type_is('public','evaluation_assignments','token_hash','text',
  'token_hash es text');

-- --- Tipos representativos ---------------------------------------------------
select col_type_is('public','evaluation_results','guia_ii_category_scores','jsonb',
  'category_scores es jsonb');
select col_type_is('public','audit_log','metadata','jsonb','metadata es jsonb');
select col_type_is('public','company_settings','total_trabajadores','integer',
  'total_trabajadores es integer');

-- --- NOT NULL obligatorios ---------------------------------------------------
select col_not_null('public','workers','nombre','workers.nombre NOT NULL');
select col_not_null('public','evaluation_assignments','token_hash','token_hash NOT NULL');
select col_not_null('public','evaluation_assignments','token_last4','token_last4 NOT NULL');
select col_not_null('public','evaluation_results','scoring_version','scoring_version NOT NULL');
select col_not_null('public','evaluation_results','completed_at','completed_at NOT NULL');
select col_not_null('public','audit_log','action','audit_log.action NOT NULL');
select col_not_null('public','audit_log','entity_type','audit_log.entity_type NOT NULL');

-- --- Primary keys ------------------------------------------------------------
select has_pk('public', t, 'PK en ' || t)
from unnest(array[
  'company_settings','admin_profiles','workers','evaluation_campaigns',
  'evaluation_assignments','evaluation_answers','evaluation_results',
  'action_plans','evidence_items','confidential_complaints',
  'policy_documents','audit_log'
]) as t;

-- --- Unique constraints obligatorios ----------------------------------------
select col_is_unique('public','company_settings', array['singleton_lock'],
  'company_settings singleton por UNIQUE(singleton_lock)');
select col_is_unique('public','evaluation_assignments', array['campaign_id','worker_id'],
  'UNIQUE(campaign_id, worker_id)');
select col_is_unique('public','evaluation_assignments', array['token_hash'],
  'UNIQUE(token_hash)');
select col_is_unique('public','evaluation_answers',
  array['assignment_id','questionnaire_code','question_id'],
  'UNIQUE(assignment_id, questionnaire_code, question_id)');
select col_is_unique('public','evaluation_results', array['assignment_id'],
  'UNIQUE(evaluation_results.assignment_id)');
select col_is_unique('public','confidential_complaints', array['folio'],
  'UNIQUE(folio)');

-- --- Foreign keys ------------------------------------------------------------
select fk_ok('public','evaluation_assignments','campaign_id',
             'public','evaluation_campaigns','id');
select fk_ok('public','evaluation_assignments','worker_id',
             'public','workers','id');
select fk_ok('public','evaluation_answers','assignment_id',
             'public','evaluation_assignments','id');
select fk_ok('public','evaluation_results','assignment_id',
             'public','evaluation_assignments','id');
select fk_ok('public','evaluation_results','worker_id','public','workers','id');
select fk_ok('public','evaluation_results','campaign_id',
             'public','evaluation_campaigns','id');
select fk_ok('public','action_plans','campaign_id',
             'public','evaluation_campaigns','id');

-- --- ON DELETE de FKs sensibles (catálogo real) ------------------------------
-- worker_id en assignments/results debe ser RESTRICT ('r'); campaign_id CASCADE ('c').
select is(
  (select confdeltype from pg_constraint
     where conname='evaluation_assignments_worker_id_fkey'), 'r',
  'assignments.worker_id ON DELETE RESTRICT');
select is(
  (select confdeltype from pg_constraint
     where conrelid='public.evaluation_assignments'::regclass
       and confrelid='public.evaluation_campaigns'::regclass), 'c',
  'assignments.campaign_id ON DELETE CASCADE');
select is(
  (select confdeltype from pg_constraint
     where conrelid='public.evidence_items'::regclass
       and confrelid='public.evaluation_campaigns'::regclass), 'n',
  'evidence_items.campaign_id ON DELETE SET NULL');

-- --- CHECK constraints -------------------------------------------------------
select has_check('public','company_settings','company_settings tiene CHECK');
select has_check('public','evaluation_campaigns','evaluation_campaigns tiene CHECK (fechas)');
select has_check('public','evaluation_assignments','evaluation_assignments tiene CHECK');

-- --- Enums y valores ---------------------------------------------------------
select has_type('public','admin_role','enum admin_role existe');
select enum_has_labels('public','admin_role',
  array['admin','rh','psicologo','direccion'],'admin_role labels');
select enum_has_labels('public','campaign_status',
  array['draft','active','closed'],'campaign_status labels');
select enum_has_labels('public','assignment_status',
  array['pending','in_progress','completed','revoked'],'assignment_status labels');
select enum_has_labels('public','risk_level',
  array['nulo','bajo','medio','alto','muy_alto'],'risk_level labels');
select enum_has_labels('public','action_status',
  array['pendiente','en_proceso','completada','cancelada'],'action_status labels');
select enum_has_labels('public','complaint_status',
  array['recibida','en_revision','resuelta','cerrada'],'complaint_status labels');
select enum_has_labels('public','policy_status',
  array['borrador','publicada','archivada'],'policy_status labels');

-- --- Función updated_at + triggers ------------------------------------------
select has_function('public','set_updated_at','función updated_at existe');
select has_trigger('public','company_settings','trg_company_settings_updated_at','trigger updated_at company_settings');
select has_trigger('public','workers','trg_workers_updated_at','trigger updated_at workers');
select has_trigger('public','evaluation_campaigns','trg_evaluation_campaigns_updated_at','trigger updated_at campaigns');
select has_trigger('public','evaluation_assignments','trg_evaluation_assignments_updated_at','trigger updated_at assignments');
select has_trigger('public','action_plans','trg_action_plans_updated_at','trigger updated_at action_plans');
select has_trigger('public','confidential_complaints','trg_confidential_complaints_updated_at','trigger updated_at complaints');
select has_trigger('public','policy_documents','trg_policy_documents_updated_at','trigger updated_at policy');

-- --- Índices obligatorios ----------------------------------------------------
select has_index('public','workers','idx_workers_activo','idx_workers_activo');
select has_index('public','evaluation_assignments','idx_evaluation_assignments_status',
  'idx assignments status');
select has_index('public','evaluation_answers','idx_evaluation_answers_assignment_id',
  'idx answers assignment');
select has_index('public','audit_log','idx_audit_log_created_at','idx audit_log created_at');

select * from finish();
rollback;
