-- =============================================================================
-- NOM-035 initial schema (B4.0)
-- Proyecto: una sola empresa / un solo tenant en este MVP.
-- NO aplicar en remoto en este bloque. Solo migración revisable.
-- Defensa: RLS ON + revoke anon/authenticated + sin políticas permisivas.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.admin_role as enum ('admin', 'rh', 'psicologo', 'direccion');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.campaign_status as enum ('draft', 'active', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_status as enum ('pending', 'in_progress', 'completed', 'revoked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.risk_level as enum ('nulo', 'bajo', 'medio', 'alto', 'muy_alto');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.action_status as enum ('pendiente', 'en_proceso', 'completada', 'cancelada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.complaint_status as enum ('recibida', 'en_revision', 'resuelta', 'cerrada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.policy_status as enum ('borrador', 'publicada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.action_level as enum ('primer_nivel', 'segundo_nivel', 'tercer_nivel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.action_type as enum ('organizacional', 'grupal', 'individual_confidencial');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.evidence_type as enum (
    'politica',
    'difusion',
    'resultados',
    'reporte',
    'capacitacion',
    'plan_accion',
    'quejas',
    'canalizacion',
    'otro'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.complaint_type as enum (
    'violencia_laboral',
    'entorno_organizacional',
    'factores_riesgo_psicosocial',
    'otro'
  );
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- A) company_settings (singleton de una empresa)
-- -----------------------------------------------------------------------------

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  rfc text,
  domicilio text,
  telefono text,
  actividad_principal text,
  total_trabajadores integer not null check (total_trabajadores >= 0),
  responsable_nombre text,
  responsable_email text,
  responsable_telefono text,
  -- Impide más de una fila: único valor constante true.
  singleton_lock boolean not null default true check (singleton_lock = true),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint company_settings_singleton unique (singleton_lock)
);

comment on table public.company_settings is
  'Configuración de UNA sola empresa. UNIQUE(singleton_lock) garantiza una sola fila.';

create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- B) admin_profiles (sin crear usuarios Auth todavía)
-- -----------------------------------------------------------------------------

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null,
  role public.admin_role not null,
  can_view_sensitive_cases boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- C) workers
-- -----------------------------------------------------------------------------

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  departamento text,
  puesto text,
  turno text,
  sucursal text,
  jefe_directo text,
  antiguedad text,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workers_activo on public.workers (activo);
create index if not exists idx_workers_departamento on public.workers (departamento);

create trigger trg_workers_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- D) evaluation_campaigns
-- -----------------------------------------------------------------------------

create table if not exists public.evaluation_campaigns (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  status public.campaign_status not null default 'draft',
  fecha_inicio date,
  fecha_cierre date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_campaigns_dates_ok check (
    fecha_cierre is null or fecha_inicio is null or fecha_cierre >= fecha_inicio
  )
);

create index if not exists idx_evaluation_campaigns_status on public.evaluation_campaigns (status);

create trigger trg_evaluation_campaigns_updated_at
before update on public.evaluation_campaigns
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- E) evaluation_assignments
-- Token real NUNCA se almacena: solo token_hash + token_last4.
-- -----------------------------------------------------------------------------

create table if not exists public.evaluation_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.evaluation_campaigns (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete restrict,
  token_hash text not null,
  token_last4 text not null,
  status public.assignment_status not null default 'pending',
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_assignments_campaign_worker_unique unique (campaign_id, worker_id),
  constraint evaluation_assignments_token_hash_unique unique (token_hash),
  constraint evaluation_assignments_token_last4_len check (char_length(token_last4) = 4),
  -- Coherencia mínima estado/timestamps (B4.2): un estado terminal exige su marca.
  -- La monotonicidad (no regresar de completed/revoked) se hará en capa RPC (bloque futuro).
  constraint evaluation_assignments_completed_coherent
    check (status <> 'completed' or completed_at is not null),
  constraint evaluation_assignments_revoked_coherent
    check (status <> 'revoked' or revoked_at is not null)
);

create index if not exists idx_evaluation_assignments_campaign_id on public.evaluation_assignments (campaign_id);
create index if not exists idx_evaluation_assignments_worker_id on public.evaluation_assignments (worker_id);
create index if not exists idx_evaluation_assignments_status on public.evaluation_assignments (status);
-- token_hash ya indexado por UNIQUE

create trigger trg_evaluation_assignments_updated_at
before update on public.evaluation_assignments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- F) evaluation_answers
-- -----------------------------------------------------------------------------

create table if not exists public.evaluation_answers (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluation_assignments (id) on delete cascade,
  questionnaire_code text not null,
  question_id text not null,
  answer_text text,
  answer_value text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_answers_unique_question unique (assignment_id, questionnaire_code, question_id)
);

create index if not exists idx_evaluation_answers_assignment_id on public.evaluation_answers (assignment_id);

-- -----------------------------------------------------------------------------
-- G) evaluation_results (1:1 con assignment)
-- -----------------------------------------------------------------------------

create table if not exists public.evaluation_results (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.evaluation_assignments (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete restrict,
  campaign_id uuid not null references public.evaluation_campaigns (id) on delete restrict,
  guia_i_requires_clinical_attention boolean not null default false,
  guia_i_risk_label text,
  guia_ii_final_score integer,
  guia_ii_final_risk_level public.risk_level,
  guia_ii_category_scores jsonb not null default '{}'::jsonb,
  guia_ii_domain_scores jsonb not null default '{}'::jsonb,
  guia_ii_dimension_scores jsonb not null default '{}'::jsonb,
  alerts jsonb not null default '[]'::jsonb,
  scoring_version text not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_evaluation_results_campaign_id on public.evaluation_results (campaign_id);
create index if not exists idx_evaluation_results_worker_id on public.evaluation_results (worker_id);

-- -----------------------------------------------------------------------------
-- H) action_plans
-- -----------------------------------------------------------------------------

create table if not exists public.action_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.evaluation_campaigns (id) on delete cascade,
  area text not null,
  risk_factor text not null,
  risk_level public.risk_level not null,
  action_level public.action_level not null,
  action_type public.action_type not null,
  description text not null,
  responsible text not null,
  due_date date not null,
  status public.action_status not null default 'pendiente',
  follow_up_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_action_plans_campaign_id on public.action_plans (campaign_id);
create index if not exists idx_action_plans_status on public.action_plans (status);

create trigger trg_action_plans_updated_at
before update on public.action_plans
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- I) evidence_items (sin bucket Storage todavía)
-- -----------------------------------------------------------------------------

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.evaluation_campaigns (id) on delete set null,
  title text not null,
  evidence_type public.evidence_type not null,
  description text not null,
  storage_path text,
  original_file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_evidence_items_evidence_type on public.evidence_items (evidence_type);

create trigger trg_evidence_items_updated_at
before update on public.evidence_items
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- J) confidential_complaints
-- -----------------------------------------------------------------------------

create table if not exists public.confidential_complaints (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  complaint_type public.complaint_type not null,
  description text not null,
  is_anonymous boolean not null default true,
  reporter_name text,
  reporter_contact text,
  status public.complaint_status not null default 'recibida',
  assigned_to uuid references auth.users (id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint confidential_complaints_folio_unique unique (folio),
  -- Privacidad (B4.2): una queja anónima no debe portar datos del reportante.
  constraint confidential_complaints_anonymous_coherent
    check (is_anonymous = false or (reporter_name is null and reporter_contact is null))
);

create index if not exists idx_confidential_complaints_status on public.confidential_complaints (status);
-- folio ya indexado por UNIQUE

create trigger trg_confidential_complaints_updated_at
before update on public.confidential_complaints
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- K) policy_documents
-- -----------------------------------------------------------------------------

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  version text not null,
  status public.policy_status not null default 'borrador',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Coherencia (B4.2): una política publicada exige fecha de publicación.
  constraint policy_documents_published_coherent
    check (status <> 'publicada' or published_at is not null)
);

create index if not exists idx_policy_documents_status on public.policy_documents (status);

create trigger trg_policy_documents_updated_at
before update on public.policy_documents
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- L) audit_log
-- metadata NO debe contener respuestas completas ni PII clínica.
-- -----------------------------------------------------------------------------

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_log_created_at on public.audit_log (created_at);

-- -----------------------------------------------------------------------------
-- RLS: activar en todas las tablas public del dominio
-- -----------------------------------------------------------------------------

alter table public.company_settings enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.workers enable row level security;
alter table public.evaluation_campaigns enable row level security;
alter table public.evaluation_assignments enable row level security;
alter table public.evaluation_answers enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.action_plans enable row level security;
alter table public.evidence_items enable row level security;
alter table public.confidential_complaints enable row level security;
alter table public.policy_documents enable row level security;
alter table public.audit_log enable row level security;

-- Forzar RLS incluso para el dueño de la tabla (defensa en profundidad).
alter table public.company_settings force row level security;
alter table public.admin_profiles force row level security;
alter table public.workers force row level security;
alter table public.evaluation_campaigns force row level security;
alter table public.evaluation_assignments force row level security;
alter table public.evaluation_answers force row level security;
alter table public.evaluation_results force row level security;
alter table public.action_plans force row level security;
alter table public.evidence_items force row level security;
alter table public.confidential_complaints force row level security;
alter table public.policy_documents force row level security;
alter table public.audit_log force row level security;

-- -----------------------------------------------------------------------------
-- Permisos: denegación por defecto para anon y authenticated vía Data API.
-- El acceso privilegiado será vía service role en Route Handlers (server-only)
-- y, en un bloque Auth posterior, políticas RLS por rol.
-- NO crear políticas para anon en este bloque.
-- -----------------------------------------------------------------------------

revoke all on table public.company_settings from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;
revoke all on table public.workers from anon, authenticated;
revoke all on table public.evaluation_campaigns from anon, authenticated;
revoke all on table public.evaluation_assignments from anon, authenticated;
revoke all on table public.evaluation_answers from anon, authenticated;
revoke all on table public.evaluation_results from anon, authenticated;
revoke all on table public.action_plans from anon, authenticated;
revoke all on table public.evidence_items from anon, authenticated;
revoke all on table public.confidential_complaints from anon, authenticated;
revoke all on table public.policy_documents from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

revoke all on all tables in schema public from public;

-- Nota documental (no SQL ejecutable):
-- - En el próximo bloque Auth + roles se concederá acceso administrativo vía RLS.
-- - El flujo público por token usará Route Handlers de Next.js + cliente admin server-only.
-- - La llave secreta nunca llega al navegador.
-- - El trabajador no leerá directamente workers, answers, results o complaints.
