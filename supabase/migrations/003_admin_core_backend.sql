-- =============================================================================
-- B4.4 · Backend administrativo central (local-only vía service_role)
--
-- DIFERENCIAS vs esquema 001+002 (documentadas antes de alterar):
-- A) company_settings: ya tiene singleton + total >= 0 + updated_at.
--    Falta: normalización vacíos→null y auditoría en RPC; email validado en servidor.
-- B) workers: faltan normalized_email/phone, external_reference, deactivated_at,
--    created_by/updated_by, CHECKs de nombre/activo, uniques parciales.
-- C) evaluation_campaigns: faltan questionnaire_version, activated_at, closed_at,
--    created_by/updated_by, coherencia status↔ y UNA sola campaña active.
-- D) evaluation_assignments: questionnaire_version ya en 002; faltan
--    token_issued_at, token_rotated_at, revoked_reason, created_by/updated_by.
-- E) evaluation_results: sin cambios de scoring.
-- F) audit_log: eventos admin vía RPCs (sin token/respuestas/scores detallados).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de normalización
-- -----------------------------------------------------------------------------

create or replace function public.nom035_nullif_blank(p text)
returns text
language sql
immutable
as $$
  select nullif(btrim(p), '');
$$;

create or replace function public.nom035_normalize_email(p text)
returns text
language sql
immutable
as $$
  select lower(public.nom035_nullif_blank(p));
$$;

create or replace function public.nom035_normalize_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(public.nom035_nullif_blank(p), ''), '[^0-9+]', '', 'g'), '');
$$;

create or replace function public.nom035_is_valid_email(p text)
returns boolean
language sql
immutable
as $$
  select p is null or p ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$';
$$;

-- -----------------------------------------------------------------------------
-- B) workers — columnas y restricciones
-- -----------------------------------------------------------------------------

alter table public.workers
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists external_reference text,
  add column if not exists deactivated_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

-- Backfill normalización a partir de datos existentes
update public.workers
set
  normalized_email = public.nom035_normalize_email(email),
  normalized_phone = public.nom035_normalize_phone(telefono),
  external_reference = public.nom035_nullif_blank(external_reference)
where true;

alter table public.workers
  drop constraint if exists workers_nombre_not_blank;

alter table public.workers
  add constraint workers_nombre_not_blank
  check (length(btrim(nombre)) > 0);

alter table public.workers
  drop constraint if exists workers_activo_deactivated_coherent;

alter table public.workers
  add constraint workers_activo_deactivated_coherent
  check (
    (activo = true and deactivated_at is null)
    or (activo = false)
  );

create unique index if not exists uq_workers_normalized_email
  on public.workers (normalized_email)
  where normalized_email is not null;

create unique index if not exists uq_workers_external_reference
  on public.workers (external_reference)
  where external_reference is not null;

create index if not exists idx_workers_deactivated_at
  on public.workers (deactivated_at)
  where deactivated_at is not null;

-- -----------------------------------------------------------------------------
-- C) evaluation_campaigns — columnas y una sola active
-- -----------------------------------------------------------------------------

alter table public.evaluation_campaigns
  add column if not exists questionnaire_version text,
  add column if not exists activated_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.evaluation_campaigns
set questionnaire_version = coalesce(
  questionnaire_version,
  'nom035-stps-2018-guias-referencia-i-ii'
)
where questionnaire_version is null;

alter table public.evaluation_campaigns
  alter column questionnaire_version set default 'nom035-stps-2018-guias-referencia-i-ii';

alter table public.evaluation_campaigns
  alter column questionnaire_version set not null;

-- Backfill timestamps para filas existentes antes del CHECK
update public.evaluation_campaigns
set activated_at = coalesce(activated_at, created_at)
where status = 'active' and activated_at is null;

update public.evaluation_campaigns
set closed_at = coalesce(closed_at, updated_at, created_at)
where status = 'closed' and closed_at is null;

-- Si hubiera más de una active (datos sucios), dejar solo la más reciente
with ranked as (
  select id, row_number() over (order by activated_at desc nulls last, created_at desc) as rn
  from public.evaluation_campaigns
  where status = 'active'
)
update public.evaluation_campaigns c
set status = 'closed',
    closed_at = coalesce(c.closed_at, timezone('utc', now()))
from ranked r
where c.id = r.id and r.rn > 1;

-- Coherencia estado / timestamps
alter table public.evaluation_campaigns
  drop constraint if exists evaluation_campaigns_status_timestamps_ok;

alter table public.evaluation_campaigns
  add constraint evaluation_campaigns_status_timestamps_ok
  check (
    (status = 'draft' and activated_at is null and closed_at is null)
    or (status = 'active' and activated_at is not null and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  );

-- MVP: solo una campaña active a la vez
create unique index if not exists uq_evaluation_campaigns_one_active
  on public.evaluation_campaigns ((true))
  where status = 'active';

-- Backfill automático de timestamps en INSERT/UPDATE directo (tests legacy 004/005).
create or replace function public.nom035_fill_campaign_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and new.activated_at is null then
    new.activated_at := coalesce(new.created_at, timezone('utc', now()));
  end if;
  if new.status = 'closed' and new.closed_at is null then
    new.closed_at := coalesce(new.updated_at, new.created_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_campaign_status_timestamps on public.evaluation_campaigns;
create trigger trg_fill_campaign_status_timestamps
before insert or update on public.evaluation_campaigns
for each row execute function public.nom035_fill_campaign_status_timestamps();

-- -----------------------------------------------------------------------------
-- D) evaluation_assignments — metadatos de token
-- -----------------------------------------------------------------------------

alter table public.evaluation_assignments
  add column if not exists token_issued_at timestamptz,
  add column if not exists token_rotated_at timestamptz,
  add column if not exists revoked_reason text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.evaluation_assignments
set token_issued_at = coalesce(token_issued_at, created_at)
where token_issued_at is null;

-- -----------------------------------------------------------------------------
-- Actualizar create_public_evaluation_assignment para token_issued_at
-- -----------------------------------------------------------------------------

create or replace function public.create_public_evaluation_assignment(
  p_campaign_id uuid,
  p_worker_id uuid,
  p_token_hash text,
  p_token_last4 text,
  p_expires_at timestamptz,
  p_questionnaire_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_worker public.workers%rowtype;
  v_id uuid;
begin
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id;
  if not found or v_campaign.status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select * into v_worker from public.workers where id = p_worker_id;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  if exists (
    select 1 from public.evaluation_assignments
    where campaign_id = p_campaign_id and worker_id = p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_assignment');
  end if;

  insert into public.evaluation_assignments
    (campaign_id, worker_id, token_hash, token_last4, status, expires_at,
     questionnaire_version, token_issued_at)
  values
    (p_campaign_id, p_worker_id, p_token_hash, p_token_last4, 'pending', p_expires_at,
     coalesce(p_questionnaire_version, 'nom035-stps-2018-guias-referencia-i-ii'),
     timezone('utc', now()))
  returning id into v_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('assignment_created', 'evaluation_assignment', v_id,
          jsonb_build_object('campaign_id', p_campaign_id));

  return jsonb_build_object('ok', true, 'assignmentId', v_id, 'status', 'pending',
                            'expiresAt', p_expires_at);
end;
$$;

-- =============================================================================
-- RPCs ADMINISTRATIVAS
-- =============================================================================

-- A) admin_upsert_company_settings
create or replace function public.admin_upsert_company_settings(
  p_razon_social text,
  p_rfc text default null,
  p_domicilio text default null,
  p_telefono text default null,
  p_actividad_principal text default null,
  p_total_trabajadores integer default 0,
  p_responsable_nombre text default null,
  p_responsable_email text default null,
  p_responsable_telefono text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_razon text := public.nom035_nullif_blank(p_razon_social);
  v_rfc text := public.nom035_nullif_blank(p_rfc);
  v_email text := public.nom035_normalize_email(p_responsable_email);
  v_row public.company_settings%rowtype;
begin
  if v_razon is null then
    return jsonb_build_object('ok', false, 'code', 'razon_social_required');
  end if;
  if p_total_trabajadores is null or p_total_trabajadores < 0 then
    return jsonb_build_object('ok', false, 'code', 'total_trabajadores_invalid');
  end if;
  if not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_rfc is not null then
    v_rfc := upper(v_rfc);
  end if;

  insert into public.company_settings as cs (
    razon_social, rfc, domicilio, telefono, actividad_principal,
    total_trabajadores, responsable_nombre, responsable_email, responsable_telefono
  ) values (
    v_razon, v_rfc,
    public.nom035_nullif_blank(p_domicilio),
    public.nom035_nullif_blank(p_telefono),
    public.nom035_nullif_blank(p_actividad_principal),
    p_total_trabajadores,
    public.nom035_nullif_blank(p_responsable_nombre),
    v_email,
    public.nom035_nullif_blank(p_responsable_telefono)
  )
  on conflict (singleton_lock) do update set
    razon_social = excluded.razon_social,
    rfc = excluded.rfc,
    domicilio = excluded.domicilio,
    telefono = excluded.telefono,
    actividad_principal = excluded.actividad_principal,
    total_trabajadores = excluded.total_trabajadores,
    responsable_nombre = excluded.responsable_nombre,
    responsable_email = excluded.responsable_email,
    responsable_telefono = excluded.responsable_telefono,
    updated_at = timezone('utc', now())
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'company.updated', 'company_settings', v_row.id,
    jsonb_build_object('total_trabajadores', v_row.total_trabajadores)
  );

  return jsonb_build_object(
    'ok', true,
    'company', jsonb_build_object(
      'id', v_row.id,
      'razonSocial', v_row.razon_social,
      'rfc', v_row.rfc,
      'domicilio', v_row.domicilio,
      'telefono', v_row.telefono,
      'actividadPrincipal', v_row.actividad_principal,
      'totalTrabajadores', v_row.total_trabajadores,
      'responsableNombre', v_row.responsable_nombre,
      'responsableEmail', v_row.responsable_email,
      'responsableTelefono', v_row.responsable_telefono,
      'updatedAt', v_row.updated_at
    )
  );
end;
$$;

-- Helper JSON worker (sin contacto completo sensible en audit; sí en respuesta admin local)
create or replace function public.admin_worker_to_json(p public.workers)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'email', p.email,
    'telefono', p.telefono,
    'departamento', p.departamento,
    'puesto', p.puesto,
    'turno', p.turno,
    'sucursal', p.sucursal,
    'jefeDirecto', p.jefe_directo,
    'antiguedad', p.antiguedad,
    'externalReference', p.external_reference,
    'activo', p.activo,
    'deactivatedAt', p.deactivated_at,
    'normalizedEmail', p.normalized_email,
    'normalizedPhone', p.normalized_phone,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

-- B) admin_create_worker
create or replace function public.admin_create_worker(
  p_nombre text,
  p_email text default null,
  p_telefono text default null,
  p_departamento text default null,
  p_puesto text default null,
  p_turno text default null,
  p_sucursal text default null,
  p_jefe_directo text default null,
  p_antiguedad text default null,
  p_external_reference text default null,
  p_activo boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.nom035_nullif_blank(p_nombre);
  v_email text := public.nom035_normalize_email(p_email);
  v_phone text := public.nom035_normalize_phone(p_telefono);
  v_ext text := public.nom035_nullif_blank(p_external_reference);
  v_activo boolean := coalesce(p_activo, true);
  v_row public.workers%rowtype;
begin
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  if v_email is not null and not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_email is not null and exists (
    select 1 from public.workers where normalized_email = v_email
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_email');
  end if;
  if v_ext is not null and exists (
    select 1 from public.workers where external_reference = v_ext
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_external_reference');
  end if;

  insert into public.workers (
    nombre, email, telefono, departamento, puesto, turno, sucursal,
    jefe_directo, antiguedad, activo, normalized_email, normalized_phone,
    external_reference, deactivated_at
  ) values (
    v_nombre,
    v_email,
    public.nom035_nullif_blank(p_telefono),
    public.nom035_nullif_blank(p_departamento),
    public.nom035_nullif_blank(p_puesto),
    public.nom035_nullif_blank(p_turno),
    public.nom035_nullif_blank(p_sucursal),
    public.nom035_nullif_blank(p_jefe_directo),
    public.nom035_nullif_blank(p_antiguedad),
    v_activo,
    v_email,
    v_phone,
    v_ext,
    case when v_activo then null else timezone('utc', now()) end
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker.created', 'worker', v_row.id,
    jsonb_build_object('activo', v_row.activo, 'departamento', v_row.departamento)
  );

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$$;

-- C) admin_update_worker
create or replace function public.admin_update_worker(
  p_worker_id uuid,
  p_nombre text default null,
  p_email text default null,
  p_telefono text default null,
  p_departamento text default null,
  p_puesto text default null,
  p_turno text default null,
  p_sucursal text default null,
  p_jefe_directo text default null,
  p_antiguedad text default null,
  p_external_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.workers%rowtype;
  v_nombre text;
  v_email text;
  v_phone text;
  v_ext text;
begin
  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_nombre := coalesce(public.nom035_nullif_blank(p_nombre), v_row.nombre);
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;

  if p_email is null then
    v_email := v_row.normalized_email;
  else
    v_email := public.nom035_normalize_email(p_email);
  end if;
  if v_email is not null and not public.nom035_is_valid_email(v_email) then
    return jsonb_build_object('ok', false, 'code', 'email_invalid');
  end if;
  if v_email is not null and exists (
    select 1 from public.workers where normalized_email = v_email and id <> p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_email');
  end if;

  if p_external_reference is null then
    v_ext := v_row.external_reference;
  else
    v_ext := public.nom035_nullif_blank(p_external_reference);
  end if;
  if v_ext is not null and exists (
    select 1 from public.workers where external_reference = v_ext and id <> p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_external_reference');
  end if;

  v_phone := case
    when p_telefono is null then v_row.normalized_phone
    else public.nom035_normalize_phone(p_telefono)
  end;

  update public.workers set
    nombre = v_nombre,
    email = case when p_email is null then email else v_email end,
    telefono = case when p_telefono is null then telefono else public.nom035_nullif_blank(p_telefono) end,
    departamento = case when p_departamento is null then departamento else public.nom035_nullif_blank(p_departamento) end,
    puesto = case when p_puesto is null then puesto else public.nom035_nullif_blank(p_puesto) end,
    turno = case when p_turno is null then turno else public.nom035_nullif_blank(p_turno) end,
    sucursal = case when p_sucursal is null then sucursal else public.nom035_nullif_blank(p_sucursal) end,
    jefe_directo = case when p_jefe_directo is null then jefe_directo else public.nom035_nullif_blank(p_jefe_directo) end,
    antiguedad = case when p_antiguedad is null then antiguedad else public.nom035_nullif_blank(p_antiguedad) end,
    external_reference = v_ext,
    normalized_email = v_email,
    normalized_phone = v_phone,
    updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'worker.updated', 'worker', v_row.id,
    jsonb_build_object('departamento', v_row.departamento, 'activo', v_row.activo)
  );

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$$;

-- D) admin_deactivate_worker
create or replace function public.admin_deactivate_worker(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.workers%rowtype;
begin
  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.workers
  set activo = false,
      deactivated_at = coalesce(deactivated_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  update public.evaluation_sessions s
  set revoked_at = timezone('utc', now())
  from public.evaluation_assignments a
  where a.id = s.assignment_id
    and a.worker_id = p_worker_id
    and s.revoked_at is null
    and a.status in ('pending', 'in_progress');

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.deactivated', 'worker', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$$;

-- E) admin_reactivate_worker
create or replace function public.admin_reactivate_worker(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.workers%rowtype;
begin
  select * into v_row from public.workers where id = p_worker_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.workers
  set activo = true,
      deactivated_at = null,
      updated_at = timezone('utc', now())
  where id = p_worker_id
  returning * into v_row;

  -- No reactivar assignments revoked (política documentada).
  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.updated', 'worker', v_row.id, jsonb_build_object('reactivated', true));

  return jsonb_build_object('ok', true, 'worker', public.admin_worker_to_json(v_row));
end;
$$;

-- F) admin_delete_worker
create or replace function public.admin_delete_worker(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_history boolean;
begin
  if not exists (select 1 from public.workers where id = p_worker_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select exists (
    select 1 from public.evaluation_assignments where worker_id = p_worker_id
    union all
    select 1 from public.evaluation_results where worker_id = p_worker_id
  ) into v_has_history;

  if v_has_history then
    return jsonb_build_object(
      'ok', false,
      'code', 'has_history',
      'message', 'No se puede eliminar: tiene historial. Desactive el trabajador.'
    );
  end if;

  delete from public.workers where id = p_worker_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('worker.deleted', 'worker', p_worker_id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'deletedId', p_worker_id);
end;
$$;

-- G) admin_import_workers
create or replace function public.admin_import_workers(
  p_rows jsonb,
  p_mode text default 'atomic'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := coalesce(p_mode, 'atomic');
  v_max int := 500;
  v_row jsonb;
  v_idx int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_seen_emails text[] := '{}';
  v_seen_exts text[] := '{}';
  v_nombre text;
  v_email text;
  v_ext text;
  v_inserted int := 0;
  v_skipped int := 0;
  v_item jsonb;
begin
  if v_mode not in ('atomic', 'validate_only') then
    return jsonb_build_object('ok', false, 'code', 'invalid_mode');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if jsonb_array_length(p_rows) > v_max then
    return jsonb_build_object('ok', false, 'code', 'batch_too_large', 'max', v_max);
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_nombre := public.nom035_nullif_blank(v_row->>'nombre');
    v_email := public.nom035_normalize_email(v_row->>'email');
    v_ext := public.nom035_nullif_blank(v_row->>'referencia_externa');

    if v_nombre is null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'nombre_required'));
      continue;
    end if;
    if v_email is not null and not public.nom035_is_valid_email(v_email) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'email_invalid'));
      continue;
    end if;
    if v_email is not null and v_email = any (v_seen_emails) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_email_in_file'));
      continue;
    end if;
    if v_ext is not null and v_ext = any (v_seen_exts) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_external_reference_in_file'));
      continue;
    end if;
    if v_email is not null and exists (select 1 from public.workers where normalized_email = v_email) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_email'));
      continue;
    end if;
    if v_ext is not null and exists (select 1 from public.workers where external_reference = v_ext) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_idx, 'code', 'duplicate_external_reference'));
      continue;
    end if;

    if v_email is not null then v_seen_emails := array_append(v_seen_emails, v_email); end if;
    if v_ext is not null then v_seen_exts := array_append(v_seen_exts, v_ext); end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_failed',
      'inserted', 0,
      'skipped', 0,
      'errors', v_errors
    );
  end if;

  if v_mode = 'validate_only' then
    return jsonb_build_object(
      'ok', true,
      'mode', 'validate_only',
      'inserted', 0,
      'skipped', 0,
      'validCount', jsonb_array_length(p_rows),
      'errors', '[]'::jsonb
    );
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_item := public.admin_create_worker(
      v_row->>'nombre',
      v_row->>'email',
      v_row->>'telefono',
      v_row->>'departamento',
      v_row->>'puesto',
      v_row->>'turno',
      v_row->>'sucursal',
      v_row->>'jefe_directo',
      v_row->>'antiguedad',
      v_row->>'referencia_externa',
      coalesce((v_row->>'activo')::boolean, true)
    );
    if (v_item->>'ok')::boolean then
      v_inserted := v_inserted + 1;
    else
      -- En modo atomic no debería ocurrir tras validación previa
      raise exception 'import_atomic_failed';
    end if;
  end loop;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'workers.imported', 'worker', null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped)
  );

  return jsonb_build_object(
    'ok', true,
    'mode', 'atomic',
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', '[]'::jsonb
  );
end;
$$;

-- H) admin_create_campaign
create or replace function public.admin_create_campaign(
  p_nombre text,
  p_descripcion text default null,
  p_fecha_inicio date default null,
  p_fecha_cierre date default null,
  p_questionnaire_version text default 'nom035-stps-2018-guias-referencia-i-ii'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.nom035_nullif_blank(p_nombre);
  v_row public.evaluation_campaigns%rowtype;
begin
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  if p_fecha_cierre is not null and p_fecha_inicio is not null and p_fecha_cierre < p_fecha_inicio then
    return jsonb_build_object('ok', false, 'code', 'invalid_dates');
  end if;

  insert into public.evaluation_campaigns (
    nombre, descripcion, status, fecha_inicio, fecha_cierre, questionnaire_version
  ) values (
    v_nombre,
    public.nom035_nullif_blank(p_descripcion),
    'draft',
    p_fecha_inicio,
    p_fecha_cierre,
    coalesce(public.nom035_nullif_blank(p_questionnaire_version), 'nom035-stps-2018-guias-referencia-i-ii')
  )
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.created', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$$;

create or replace function public.admin_campaign_to_json(p public.evaluation_campaigns)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'status', p.status,
    'fechaInicio', p.fecha_inicio,
    'fechaCierre', p.fecha_cierre,
    'questionnaireVersion', p.questionnaire_version,
    'activatedAt', p.activated_at,
    'closedAt', p.closed_at,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

-- I) admin_update_campaign
create or replace function public.admin_update_campaign(
  p_campaign_id uuid,
  p_nombre text default null,
  p_descripcion text default null,
  p_fecha_inicio date default null,
  p_fecha_cierre date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_campaigns%rowtype;
  v_nombre text;
  v_fi date;
  v_fc date;
begin
  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'campaign_closed');
  end if;

  v_nombre := coalesce(public.nom035_nullif_blank(p_nombre), v_row.nombre);
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'code', 'nombre_required');
  end if;
  v_fi := coalesce(p_fecha_inicio, v_row.fecha_inicio);
  v_fc := coalesce(p_fecha_cierre, v_row.fecha_cierre);
  if v_fc is not null and v_fi is not null and v_fc < v_fi then
    return jsonb_build_object('ok', false, 'code', 'invalid_dates');
  end if;

  update public.evaluation_campaigns set
    nombre = v_nombre,
    descripcion = case when p_descripcion is null then descripcion else public.nom035_nullif_blank(p_descripcion) end,
    fecha_inicio = v_fi,
    fecha_cierre = v_fc,
    updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.updated', 'evaluation_campaign', v_row.id, jsonb_build_object('status', v_row.status));

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$$;

-- J) admin_activate_campaign — rechaza si ya hay otra active
create or replace function public.admin_activate_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_campaigns%rowtype;
begin
  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if public.nom035_nullif_blank(v_row.nombre) is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_campaign');
  end if;
  if exists (
    select 1 from public.evaluation_campaigns
    where status = 'active' and id <> p_campaign_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'another_active_exists');
  end if;

  update public.evaluation_campaigns
  set status = 'active',
      activated_at = timezone('utc', now()),
      closed_at = null,
      updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.activated', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$$;

-- K) admin_close_campaign
create or replace function public.admin_close_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_campaigns%rowtype;
begin
  select * into v_row from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.evaluation_campaigns
  set status = 'closed',
      closed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values ('campaign.closed', 'evaluation_campaign', v_row.id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$$;

-- L) admin_issue_assignment — requiere campaña active
create or replace function public.admin_issue_assignment(
  p_campaign_id uuid,
  p_worker_id uuid,
  p_token_hash text,
  p_token_last4 text,
  p_expires_at timestamptz,
  p_questionnaire_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_worker public.workers%rowtype;
  v_id uuid;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_hash');
  end if;
  if p_token_last4 is null or char_length(p_token_last4) <> 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_last4');
  end if;
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id for update;
  if not found or v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select * into v_worker from public.workers where id = p_worker_id for update;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  if exists (
    select 1 from public.evaluation_assignments
    where campaign_id = p_campaign_id and worker_id = p_worker_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_assignment');
  end if;

  insert into public.evaluation_assignments (
    campaign_id, worker_id, token_hash, token_last4, status, expires_at,
    questionnaire_version, token_issued_at
  ) values (
    p_campaign_id, p_worker_id, p_token_hash, p_token_last4, 'pending', p_expires_at,
    coalesce(p_questionnaire_version, v_campaign.questionnaire_version),
    timezone('utc', now())
  )
  returning id into v_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.issued', 'evaluation_assignment', v_id,
    jsonb_build_object('campaign_id', p_campaign_id, 'token_last4', p_token_last4)
  );

  return jsonb_build_object(
    'ok', true,
    'assignmentId', v_id,
    'status', 'pending',
    'tokenLast4', p_token_last4,
    'expiresAt', p_expires_at
  );
end;
$$;

-- M) admin_list_missing_assignment_workers + admin_issue_assignments_batch
create or replace function public.admin_list_missing_assignment_workers(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.evaluation_campaigns%rowtype;
  v_ids jsonb;
begin
  select * into v_campaign from public.evaluation_campaigns where id = p_campaign_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  select coalesce(jsonb_agg(w.id order by w.nombre, w.id), '[]'::jsonb)
  into v_ids
  from public.workers w
  where w.activo = true
    and not exists (
      select 1 from public.evaluation_assignments a
      where a.campaign_id = p_campaign_id and a.worker_id = w.id
    );

  return jsonb_build_object('ok', true, 'workerIds', v_ids);
end;
$$;

create or replace function public.admin_issue_assignments_batch(
  p_campaign_id uuid,
  p_items jsonb,
  p_questionnaire_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_result jsonb;
  v_created jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_idx int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if jsonb_array_length(p_items) > 500 then
    return jsonb_build_object('ok', false, 'code', 'batch_too_large');
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_idx := v_idx + 1;
    v_result := public.admin_issue_assignment(
      p_campaign_id,
      (v_item->>'workerId')::uuid,
      v_item->>'tokenHash',
      v_item->>'tokenLast4',
      (v_item->>'expiresAt')::timestamptz,
      coalesce(p_questionnaire_version, v_item->>'questionnaireVersion')
    );
    if (v_result->>'ok')::boolean then
      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'workerId', v_item->>'workerId',
        'assignmentId', v_result->>'assignmentId',
        'tokenLast4', v_result->>'tokenLast4'
      ));
    else
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'workerId', v_item->>'workerId',
        'code', v_result->>'code'
      ));
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    -- Fallar toda la transacción si algún elemento falla (atomicidad razonable)
    raise exception 'batch_issue_failed: %', v_errors::text;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'errors', '[]'::jsonb);
end;
$$;

-- N) admin_rotate_assignment_token
create or replace function public.admin_rotate_assignment_token(
  p_assignment_id uuid,
  p_token_hash text,
  p_token_last4 text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_assignments%rowtype;
  v_worker public.workers%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
begin
  select * into v_row from public.evaluation_assignments where id = p_assignment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status not in ('pending', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_hash');
  end if;
  if p_token_last4 is null or char_length(p_token_last4) <> 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_token_last4');
  end if;
  if p_expires_at is null or p_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'code', 'invalid_expiration');
  end if;

  select * into v_worker from public.workers where id = v_row.worker_id;
  if not found or v_worker.activo = false then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;
  select * into v_campaign from public.evaluation_campaigns where id = v_row.campaign_id;
  if not found or v_campaign.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'campaign_unavailable');
  end if;

  update public.evaluation_assignments
  set token_hash = p_token_hash,
      token_last4 = p_token_last4,
      expires_at = p_expires_at,
      token_rotated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_assignment_id
  returning * into v_row;

  update public.evaluation_sessions
  set revoked_at = timezone('utc', now())
  where assignment_id = p_assignment_id and revoked_at is null;

  -- Draft se conserva (política rotate)

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.token_rotated', 'evaluation_assignment', v_row.id,
    jsonb_build_object('status', v_row.status, 'token_last4', p_token_last4)
  );

  return jsonb_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'status', v_row.status,
    'tokenLast4', p_token_last4,
    'expiresAt', p_expires_at,
    'startedAt', v_row.started_at
  );
end;
$$;

-- O) admin_revoke_assignment — elimina draft
create or replace function public.admin_revoke_assignment(
  p_assignment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_assignments%rowtype;
  v_reason text := public.nom035_nullif_blank(p_reason);
begin
  select * into v_row from public.evaluation_assignments where id = p_assignment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_row.status not in ('pending', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.evaluation_assignments
  set status = 'revoked',
      revoked_at = timezone('utc', now()),
      revoked_reason = v_reason,
      updated_at = timezone('utc', now())
  where id = p_assignment_id
  returning * into v_row;

  update public.evaluation_sessions
  set revoked_at = timezone('utc', now())
  where assignment_id = p_assignment_id and revoked_at is null;

  delete from public.evaluation_drafts where assignment_id = p_assignment_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'assignment.revoked', 'evaluation_assignment', v_row.id,
    jsonb_build_object('had_reason', v_reason is not null)
  );

  return jsonb_build_object('ok', true, 'assignmentId', v_row.id, 'status', 'revoked');
end;
$$;

-- P) admin_dashboard_summary
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_workers int;
  v_inactive_workers int;
  v_campaign jsonb;
  v_pending int;
  v_in_progress int;
  v_completed int;
  v_revoked int;
  v_no_link int;
  v_results int;
  v_risk text;
  v_updated timestamptz;
begin
  select count(*) filter (where activo), count(*) filter (where not activo)
  into v_active_workers, v_inactive_workers
  from public.workers;

  select public.admin_campaign_to_json(c)
  into v_campaign
  from public.evaluation_campaigns c
  where c.status = 'active'
  limit 1;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'in_progress'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'revoked')
  into v_pending, v_in_progress, v_completed, v_revoked
  from public.evaluation_assignments;

  -- Sin enlace: activos sin assignment en campaña active (si existe)
  if v_campaign is not null then
    select count(*) into v_no_link
    from public.workers w
    where w.activo
      and not exists (
        select 1 from public.evaluation_assignments a
        where a.worker_id = w.id
          and a.campaign_id = (v_campaign->>'id')::uuid
      );
  else
    v_no_link := v_active_workers;
  end if;

  select count(*) into v_results from public.evaluation_results;

  select r.guia_ii_final_risk_level::text into v_risk
  from public.evaluation_results r
  group by r.guia_ii_final_risk_level
  order by count(*) desc, r.guia_ii_final_risk_level
  limit 1;

  select greatest(
    coalesce((select max(updated_at) from public.workers), '-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.evaluation_campaigns), '-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.evaluation_assignments), '-infinity'::timestamptz),
    coalesce((select max(completed_at) from public.evaluation_results), '-infinity'::timestamptz)
  ) into v_updated;

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'activeWorkers', v_active_workers,
      'inactiveWorkers', v_inactive_workers,
      'activeCampaign', v_campaign,
      'assignments', jsonb_build_object(
        'noLink', v_no_link,
        'pending', v_pending,
        'inProgress', v_in_progress,
        'completed', v_completed,
        'revoked', v_revoked
      ),
      'totalResults', v_results,
      'predominantRisk', v_risk,
      'lastUpdatedAt', nullif(v_updated, '-infinity'::timestamptz)
    )
  );
end;
$$;

-- Q) admin_list_results
create or replace function public.admin_list_results(
  p_campaign_id uuid default null,
  p_worker_id uuid default null,
  p_departamento text default null,
  p_risk_level text default null,
  p_search text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total int;
  v_items jsonb;
  v_search text := public.nom035_nullif_blank(p_search);
  v_dept text := public.nom035_nullif_blank(p_departamento);
begin
  with filtered as (
    select
      r.id,
      r.assignment_id,
      r.worker_id,
      r.campaign_id,
      r.guia_i_requires_clinical_attention,
      r.guia_ii_final_score,
      r.guia_ii_final_risk_level,
      r.scoring_version,
      r.questionnaire_version,
      r.completed_at,
      w.nombre as worker_nombre,
      w.departamento,
      w.puesto,
      c.nombre as campaign_nombre
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_campaigns c on c.id = r.campaign_id
    where (p_campaign_id is null or r.campaign_id = p_campaign_id)
      and (p_worker_id is null or r.worker_id = p_worker_id)
      and (v_dept is null or w.departamento = v_dept)
      and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.departamento, '') ilike '%' || v_search || '%'
        or coalesce(w.puesto, '') ilike '%' || v_search || '%'
      )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      r.id,
      r.assignment_id,
      r.worker_id,
      r.campaign_id,
      r.guia_i_requires_clinical_attention,
      r.guia_ii_final_score,
      r.guia_ii_final_risk_level,
      r.scoring_version,
      r.questionnaire_version,
      r.completed_at,
      w.nombre as worker_nombre,
      w.departamento,
      w.puesto,
      c.nombre as campaign_nombre
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    join public.evaluation_campaigns c on c.id = r.campaign_id
    where (p_campaign_id is null or r.campaign_id = p_campaign_id)
      and (p_worker_id is null or r.worker_id = p_worker_id)
      and (v_dept is null or w.departamento = v_dept)
      and (p_risk_level is null or r.guia_ii_final_risk_level::text = p_risk_level)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.departamento, '') ilike '%' || v_search || '%'
        or coalesce(w.puesto, '') ilike '%' || v_search || '%'
      )
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t."completedAt" desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select
      id,
      assignment_id as "assignmentId",
      worker_id as "workerId",
      campaign_id as "campaignId",
      worker_nombre as "workerNombre",
      departamento,
      puesto,
      campaign_nombre as "campaignNombre",
      guia_i_requires_clinical_attention as "guiaIRequiresClinicalAttention",
      guia_ii_final_score as "finalScore",
      guia_ii_final_risk_level as "finalRiskLevel",
      scoring_version as "scoringVersion",
      questionnaire_version as "questionnaireVersion",
      completed_at as "completedAt"
    from filtered
    order by completed_at desc, id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object(
    'ok', true,
    'page', v_page,
    'pageSize', v_size,
    'total', v_total,
    'items', v_items
  );
end;
$$;

-- R) admin_get_result_detail
create or replace function public.admin_get_result_detail(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.evaluation_results%rowtype;
  v_w public.workers%rowtype;
  v_c public.evaluation_campaigns%rowtype;
  v_a public.evaluation_assignments%rowtype;
  v_answers jsonb;
begin
  select * into v_r from public.evaluation_results where id = p_result_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_a from public.evaluation_assignments where id = v_r.assignment_id;
  select * into v_w from public.workers where id = v_r.worker_id;
  select * into v_c from public.evaluation_campaigns where id = v_r.campaign_id;

  if v_a.id is null or v_a.worker_id <> v_r.worker_id or v_a.campaign_id <> v_r.campaign_id then
    return jsonb_build_object('ok', false, 'code', 'inconsistent_result');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'questionnaireCode', ans.questionnaire_code,
    'questionId', ans.question_id,
    'answerText', ans.answer_text,
    'answerValue', ans.answer_value
  ) order by ans.questionnaire_code, ans.question_id), '[]'::jsonb)
  into v_answers
  from public.evaluation_answers ans
  where ans.assignment_id = v_r.assignment_id;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'result.viewed', 'evaluation_result', v_r.id,
    jsonb_build_object('assignment_id', v_r.assignment_id)
  );

  return jsonb_build_object(
    'ok', true,
    'disclaimer',
      'Resultado calculado conforme al instrumento NOM-035. No sustituye una valoración clínica profesional.',
    'detail', jsonb_build_object(
      'id', v_r.id,
      'assignmentId', v_r.assignment_id,
      'worker', jsonb_build_object(
        'id', v_w.id,
        'nombre', v_w.nombre,
        'departamento', v_w.departamento,
        'puesto', v_w.puesto
      ),
      'campaign', jsonb_build_object(
        'id', v_c.id,
        'nombre', v_c.nombre,
        'status', v_c.status
      ),
      'status', v_a.status,
      'completedAt', v_r.completed_at,
      'startedAt', v_a.started_at,
      'answers', v_answers,
      'guiaIRequiresClinicalAttention', v_r.guia_i_requires_clinical_attention,
      'guiaIRiskLabel', v_r.guia_i_risk_label,
      'finalScore', v_r.guia_ii_final_score,
      'finalRiskLevel', v_r.guia_ii_final_risk_level,
      'categoryScores', v_r.guia_ii_category_scores,
      'domainScores', v_r.guia_ii_domain_scores,
      'dimensionScores', v_r.guia_ii_dimension_scores,
      'alerts', v_r.alerts,
      'scoringVersion', v_r.scoring_version,
      'questionnaireVersion', v_r.questionnaire_version,
      'validationWarnings', v_r.validation_warnings
    )
  );
end;
$$;

-- Listados auxiliares admin
create or replace function public.admin_get_company_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.company_settings%rowtype;
  v_active_count int;
begin
  select * into v_row from public.company_settings limit 1;
  select count(*) into v_active_count from public.workers where activo;

  if not found then
    return jsonb_build_object('ok', true, 'company', null, 'activeWorkersCount', v_active_count);
  end if;

  return jsonb_build_object(
    'ok', true,
    'activeWorkersCount', v_active_count,
    'company', jsonb_build_object(
      'id', v_row.id,
      'razonSocial', v_row.razon_social,
      'rfc', v_row.rfc,
      'domicilio', v_row.domicilio,
      'telefono', v_row.telefono,
      'actividadPrincipal', v_row.actividad_principal,
      'totalTrabajadores', v_row.total_trabajadores,
      'responsableNombre', v_row.responsable_nombre,
      'responsableEmail', v_row.responsable_email,
      'responsableTelefono', v_row.responsable_telefono,
      'updatedAt', v_row.updated_at,
      'createdAt', v_row.created_at
    )
  );
end;
$$;

create or replace function public.admin_list_workers(
  p_search text default null,
  p_activo boolean default null,
  p_departamento text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_dept text := public.nom035_nullif_blank(p_departamento);
  v_total int;
  v_items jsonb;
begin
  select count(*) into v_total
  from public.workers w
  where (p_activo is null or w.activo = p_activo)
    and (v_dept is null or w.departamento = v_dept)
    and (
      v_search is null
      or w.nombre ilike '%' || v_search || '%'
      or coalesce(w.email, '') ilike '%' || v_search || '%'
      or coalesce(w.external_reference, '') ilike '%' || v_search || '%'
    );

  select coalesce(jsonb_agg(public.admin_worker_to_json(t) order by t.nombre, t.id), '[]'::jsonb)
  into v_items
  from (
    select w.*
    from public.workers w
    where (p_activo is null or w.activo = p_activo)
      and (v_dept is null or w.departamento = v_dept)
      and (
        v_search is null
        or w.nombre ilike '%' || v_search || '%'
        or coalesce(w.email, '') ilike '%' || v_search || '%'
        or coalesce(w.external_reference, '') ilike '%' || v_search || '%'
      )
    order by w.nombre, w.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$$;

create or replace function public.admin_list_campaigns(
  p_status text default null,
  p_search text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_total int;
  v_items jsonb;
begin
  select count(*) into v_total
  from public.evaluation_campaigns c
  where (p_status is null or c.status::text = p_status)
    and (v_search is null or c.nombre ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(public.admin_campaign_to_json(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select c.*
    from public.evaluation_campaigns c
    where (p_status is null or c.status::text = p_status)
      and (v_search is null or c.nombre ilike '%' || v_search || '%')
    order by c.created_at desc, c.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$$;

create or replace function public.admin_list_campaign_assignments(
  p_campaign_id uuid,
  p_status text default null,
  p_search text default null,
  p_page int default 1,
  p_page_size int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_search text := public.nom035_nullif_blank(p_search);
  v_total int;
  v_items jsonb;
begin
  if not exists (select 1 from public.evaluation_campaigns where id = p_campaign_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select count(*) into v_total
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  where a.campaign_id = p_campaign_id
    and (p_status is null or a.status::text = p_status)
    and (v_search is null or w.nombre ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'campaignId', t.campaign_id,
    'workerId', t.worker_id,
    'workerNombre', t.worker_nombre,
    'workerActivo', t.worker_activo,
    'status', t.status,
    'tokenLast4', t.token_last4,
    'expiresAt', t.expires_at,
    'startedAt', t.started_at,
    'completedAt', t.completed_at,
    'revokedAt', t.revoked_at,
    'tokenIssuedAt', t.token_issued_at,
    'tokenRotatedAt', t.token_rotated_at,
    'questionnaireVersion', t.questionnaire_version
  ) order by t.worker_nombre, t.id), '[]'::jsonb)
  into v_items
  from (
    select
      a.*,
      w.nombre as worker_nombre,
      w.activo as worker_activo
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    where a.campaign_id = p_campaign_id
      and (p_status is null or a.status::text = p_status)
      and (v_search is null or w.nombre ilike '%' || v_search || '%')
    order by w.nombre, a.id
    offset (v_page - 1) * v_size
    limit v_size
  ) t;

  return jsonb_build_object('ok', true, 'page', v_page, 'pageSize', v_size, 'total', v_total, 'items', v_items);
end;
$$;

create or replace function public.admin_reports_summary(
  p_campaign_id uuid default null,
  p_departamento text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company jsonb;
  v_campaign jsonb;
  v_dept text := public.nom035_nullif_blank(p_departamento);
  v_registered int;
  v_assignments int;
  v_completed int;
  v_levels jsonb;
  v_categories jsonb;
  v_domains jsonb;
  v_dimensions jsonb;
  v_guia_i jsonb;
  v_scoring text;
  v_qversion text;
begin
  select (public.admin_get_company_settings())->'company' into v_company;

  if p_campaign_id is not null then
    select public.admin_campaign_to_json(c) into v_campaign
    from public.evaluation_campaigns c where c.id = p_campaign_id;
    if v_campaign is null then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
  else
    select public.admin_campaign_to_json(c) into v_campaign
    from public.evaluation_campaigns c where c.status = 'active' limit 1;
  end if;

  select count(*) into v_registered from public.workers where activo;

  select
    count(*),
    count(*) filter (where a.status = 'completed')
  into v_assignments, v_completed
  from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  where (v_campaign is null or a.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select coalesce(jsonb_object_agg(lvl, cnt), '{}'::jsonb)
  into v_levels
  from (
    select r.guia_ii_final_risk_level::text as lvl, count(*) as cnt
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
    group by r.guia_ii_final_risk_level
  ) s;

  -- Agregados jsonb de scores (promedio del campo score en objetos anidados)
  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_categories
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_category_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_domains
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_domain_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select coalesce(jsonb_object_agg(key, avg_val), '{}'::jsonb)
  into v_dimensions
  from (
    select e.key, round(avg(nullif(e.value->>'score', '')::numeric), 2) as avg_val
    from public.evaluation_results r
    join public.workers w on w.id = r.worker_id
    cross join lateral jsonb_each(r.guia_ii_dimension_scores) e
    where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
      and (v_dept is null or w.departamento = v_dept)
      and jsonb_typeof(e.value) = 'object'
    group by e.key
  ) x;

  select jsonb_build_object(
    'clinicalAttentionCount', count(*) filter (where r.guia_i_requires_clinical_attention),
    'totalWithGuiaI', count(*)
  )
  into v_guia_i
  from public.evaluation_results r
  join public.workers w on w.id = r.worker_id
  where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
    and (v_dept is null or w.departamento = v_dept);

  select r.scoring_version, r.questionnaire_version
  into v_scoring, v_qversion
  from public.evaluation_results r
  where (v_campaign is null or r.campaign_id = (v_campaign->>'id')::uuid)
  order by r.completed_at desc
  limit 1;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'report.generated', 'report', null,
    jsonb_build_object(
      'campaign_id', v_campaign->>'id',
      'departamento', v_dept,
      'completed', v_completed
    )
  );

  return jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'company', v_company,
      'campaign', v_campaign,
      'departamento', v_dept,
      'registeredWorkers', v_registered,
      'assignments', v_assignments,
      'completed', v_completed,
      'participationRate', case when v_assignments = 0 then 0
        else round((v_completed::numeric / v_assignments::numeric) * 100, 2) end,
      'riskLevels', v_levels,
      'categoryAverages', v_categories,
      'domainAverages', v_domains,
      'dimensionAverages', v_dimensions,
      'guiaIAggregate', v_guia_i,
      'scoringVersion', v_scoring,
      'questionnaireVersion', v_qversion,
      'generatedAt', timezone('utc', now())
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos: REVOKE public/anon/authenticated; GRANT service_role
-- -----------------------------------------------------------------------------

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'nom035_nullif_blank',
        'nom035_normalize_email',
        'nom035_normalize_phone',
        'nom035_is_valid_email',
        'admin_worker_to_json',
        'admin_campaign_to_json',
        'admin_upsert_company_settings',
        'admin_create_worker',
        'admin_update_worker',
        'admin_deactivate_worker',
        'admin_reactivate_worker',
        'admin_delete_worker',
        'admin_import_workers',
        'admin_create_campaign',
        'admin_update_campaign',
        'admin_activate_campaign',
        'admin_close_campaign',
        'admin_issue_assignment',
        'admin_list_missing_assignment_workers',
        'admin_issue_assignments_batch',
        'admin_rotate_assignment_token',
        'admin_revoke_assignment',
        'admin_dashboard_summary',
        'admin_list_results',
        'admin_get_result_detail',
        'admin_get_company_settings',
        'admin_list_workers',
        'admin_list_campaigns',
        'admin_list_campaign_assignments',
        'admin_reports_summary',
        'create_public_evaluation_assignment'
      )
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('revoke all on function %s from anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end;
$$;

comment on function public.admin_activate_campaign(uuid) is
  'B4.4: activa draft→active. Rechaza si ya existe otra active (cierre explícito requerido).';
comment on function public.admin_revoke_assignment(uuid, text) is
  'B4.4: revoca pending/in_progress, elimina draft, preserva resultados completed (no revocables).';
comment on function public.admin_import_workers(jsonb, text) is
  'B4.4: importación atómica o validate_only. Máximo 500 filas.';
