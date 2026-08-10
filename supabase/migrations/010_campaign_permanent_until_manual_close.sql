-- B4.16.2 — Campaña permanente: apertura/cierre exclusivamente manuales.
-- - Disponibilidad de evaluación = status de campaña (active) + status assignment.
-- - fecha_inicio / fecha_cierre dejan de bloquear por calendario (solo metadatos admin).
-- - Al activar: se anulan fecha_inicio/fecha_cierre (NULL).
-- - Cierre solo vía admin_close_campaign (status=closed + closed_at).
-- - expires_at de assignment sigue aplicando (links públicos); los 83 productivos
--   deben permanecer con expires_at NULL (sin TTL de assignment).

create or replace function public.check_assignment_usable(
  p_assignment public.evaluation_assignments
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
begin
  if p_assignment.status = 'revoked' then return 'revoked'; end if;
  if p_assignment.status = 'completed' then return 'completed'; end if;
  -- TTL solo si el assignment tiene expires_at explícito (invites/token públicos).
  -- Assignments durables del portal trabajador: expires_at NULL → no expiran.
  if p_assignment.expires_at is not null
     and p_assignment.expires_at <= timezone('utc', now()) then
    return 'expired';
  end if;

  select * into v_worker from public.workers where id = p_assignment.worker_id;
  if not found or v_worker.activo = false then return 'worker_inactive'; end if;

  select * into v_campaign from public.evaluation_campaigns where id = p_assignment.campaign_id;
  -- B4.16.2: sin gates por fecha_inicio/fecha_cierre. Solo status.
  if not found or v_campaign.status <> 'active' then
    return 'campaign_unavailable';
  end if;

  return 'ok';
end;
$$;

comment on function public.check_assignment_usable(public.evaluation_assignments) is
  'B4.16.2: usable si worker activo, campaña status=active, assignment no revoked/completed; expires_at solo si no es NULL. Sin auto-cierre por calendario.';

create or replace function public.admin_activate_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.evaluation_campaigns%rowtype;
begin
  perform public.require_admin_permission('campaigns.write'::public.app_permission);

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

  -- Permanente hasta cierre manual: sin fechas de calendario efectivas.
  update public.evaluation_campaigns
  set status = 'active',
      activated_at = timezone('utc', now()),
      closed_at = null,
      fecha_inicio = null,
      fecha_cierre = null,
      updated_at = timezone('utc', now())
  where id = p_campaign_id
  returning * into v_row;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'campaign.activated',
    'evaluation_campaign',
    v_row.id,
    jsonb_build_object(
      'permanentUntilManualClose', true,
      'fechaInicioCleared', true,
      'fechaCierreCleared', true
    )
  );

  return jsonb_build_object('ok', true, 'campaign', public.admin_campaign_to_json(v_row));
end;
$$;

comment on function public.admin_activate_campaign(uuid) is
  'Activa campaña (única active). B4.16.2: limpia fecha_inicio/fecha_cierre; cierre solo manual.';
