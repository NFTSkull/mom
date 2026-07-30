-- B4.9 · pgTAP worker_accounts
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'worker_accounts', 'worker_accounts existe');

select ok(
  (select c.relrowsecurity and c.relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'worker_accounts'),
  'RLS + FORCE en worker_accounts'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'worker_accounts_worker_id_unique'
  ),
  'unique worker_id'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'worker_accounts_auth_user_id_unique'
  ),
  'unique auth_user_id'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'worker_accounts_company_username_unique'
  ),
  'unique username por empresa'
);

select ok(
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'worker_get_portal_state'
  ),
  'RPC worker_get_portal_state'
);

select ok(
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'open_evaluation_session_for_worker'
  ),
  'RPC open_evaluation_session_for_worker'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_accounts'
      and column_name = 'password'
  ),
  'sin columna password'
);

select ok(
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_resolve_worker_login'
  ),
  'RPC admin_resolve_worker_login'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.evaluation_assignments'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%campaign_id%'
      and pg_get_constraintdef(oid) ilike '%worker_id%'
  ),
  'unique(campaign_id, worker_id) en assignments'
);

select ok(
  not has_table_privilege('authenticated', 'public.worker_accounts', 'SELECT'),
  'authenticated sin SELECT directo en worker_accounts'
);

select ok(
  not has_table_privilege('authenticated', 'public.evaluation_results', 'SELECT'),
  'authenticated sin SELECT en results'
);

select ok(
  has_function_privilege('authenticated', 'public.worker_get_portal_state()', 'EXECUTE'),
  'worker puede ejecutar worker_get_portal_state'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.open_evaluation_session_for_worker(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'anon sin open_evaluation_session_for_worker'
);

select * from finish();
rollback;
