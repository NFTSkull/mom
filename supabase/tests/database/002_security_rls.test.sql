-- =============================================================================
-- B4.2 · pgTAP · RLS y permisos (denegación por defecto)
-- Verifica contra PostgreSQL real: RLS ENABLE+FORCE, sin grants a anon/authenticated,
-- sin políticas permisivas, EXECUTE no público en función interna.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- --- RLS ENABLE en tablas del dominio (+ worker_accounts B4.9) ---------------
select ok(
  (select bool_and(c.relrowsecurity)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname = any(array[
        'company_settings','admin_profiles','workers','evaluation_campaigns',
        'evaluation_assignments','evaluation_answers','evaluation_results',
        'action_plans','evidence_items','confidential_complaints',
        'policy_documents','audit_log',
        'evaluation_drafts','evaluation_sessions','public_rate_limits',
        'worker_accounts'])),
  'RLS ENABLE en tablas del dominio');

-- --- FORCE RLS --------------------------------------------------------------
select ok(
  (select bool_and(c.relforcerowsecurity)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname = any(array[
        'company_settings','admin_profiles','workers','evaluation_campaigns',
        'evaluation_assignments','evaluation_answers','evaluation_results',
        'action_plans','evidence_items','confidential_complaints',
        'policy_documents','audit_log',
        'evaluation_drafts','evaluation_sessions','public_rate_limits',
        'worker_accounts'])),
  'FORCE RLS en tablas del dominio');

-- --- anon NO tiene SELECT/INSERT/UPDATE/DELETE en tablas sensibles -----------
-- (recorre las tablas más sensibles y los 4 privilegios)
select ok(
  not bool_or(has_table_privilege('anon', ('public.'||t)::regclass, p)),
  'anon SIN '||p||' directo en tablas sensibles')
from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
cross join unnest(array[
  'workers','evaluation_assignments','evaluation_answers','evaluation_results',
  'confidential_complaints','admin_profiles','audit_log','worker_accounts']) t
group by p;

-- --- authenticated tampoco tiene acceso directo (RPCs SECURITY DEFINER) ------
select ok(
  not bool_or(has_table_privilege('authenticated', ('public.'||t)::regclass, p)),
  'authenticated SIN '||p||' directo en tablas sensibles')
from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
cross join unnest(array[
  'workers','evaluation_assignments','evaluation_answers','evaluation_results',
  'confidential_complaints','admin_profiles','audit_log','worker_accounts']) t
group by p;

-- --- PUBLIC/anon/authenticated: cero grants en information_schema ------------
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_schema='public'
       and grantee in ('anon','authenticated','PUBLIC')),
  0, 'sin grants residuales para anon/authenticated/PUBLIC en public.*');

-- --- No existen políticas (ni permisivas anon ni administrativas prematuras) -
select is(
  (select count(*)::int from pg_policies where schemaname='public'),
  0, 'sin políticas en public en este bloque (ni anon ni admin)');

-- --- Función interna set_updated_at: EXECUTE no público ----------------------
select ok(not has_function_privilege('anon','public.set_updated_at()','EXECUTE'),
  'anon SIN EXECUTE en set_updated_at()');
select ok(not has_function_privilege('authenticated','public.set_updated_at()','EXECUTE'),
  'authenticated SIN EXECUTE en set_updated_at()');

-- --- Chequeos explícitos por tabla crítica (anon sin SELECT) -----------------
select ok(not has_table_privilege('anon','public.admin_profiles','SELECT'),
  'admin_profiles: anon sin SELECT');
select ok(not has_table_privilege('anon','public.confidential_complaints','SELECT'),
  'complaints: anon sin SELECT');
select ok(not has_table_privilege('anon','public.evaluation_results','SELECT'),
  'results: anon sin SELECT');
select ok(not has_table_privilege('anon','public.evaluation_answers','SELECT'),
  'answers: anon sin SELECT');
select ok(not has_table_privilege('anon','public.audit_log','SELECT'),
  'audit_log: anon sin SELECT');

select * from finish();
rollback;
