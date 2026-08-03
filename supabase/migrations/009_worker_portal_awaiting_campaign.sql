-- B4.15.2 — Portal trabajador: assignment en campaña draft → awaiting_campaign
-- No permite abrir sesión hasta que la campaña esté active (open_evaluation sigue filtrando active).

create or replace function public.worker_get_portal_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_acc public.worker_accounts%rowtype;
  v_worker public.workers%rowtype;
  v_asg public.evaluation_assignments%rowtype;
  v_campaign public.evaluation_campaigns%rowtype;
  v_eval_status text := 'none';
  v_campaign_status text := null;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  select * into v_acc
  from public.worker_accounts
  where auth_user_id = v_uid
  limit 1;

  if not found or v_acc.is_active is not true then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  select * into v_worker from public.workers where id = v_acc.worker_id;
  if not found or v_worker.activo is not true then
    return jsonb_build_object('ok', false, 'code', 'worker_inactive');
  end if;

  -- Preferir assignment de campaña activa
  select a.* into v_asg
  from public.evaluation_assignments a
  join public.evaluation_campaigns c on c.id = a.campaign_id
  where a.worker_id = v_worker.id
    and c.status = 'active'
    and a.status <> 'revoked'
  order by
    case a.status
      when 'in_progress' then 0
      when 'pending' then 1
      when 'completed' then 2
      else 3
    end,
    a.created_at desc
  limit 1;

  if v_asg.id is null then
    -- Assignment en campaña draft (asignado, aún no abierta)
    select a.* into v_asg
    from public.evaluation_assignments a
    join public.evaluation_campaigns c on c.id = a.campaign_id
    where a.worker_id = v_worker.id
      and c.status = 'draft'
      and a.status <> 'revoked'
    order by a.created_at desc
    limit 1;

    if v_asg.id is not null then
      v_eval_status := 'awaiting_campaign';
      select * into v_campaign from public.evaluation_campaigns where id = v_asg.campaign_id;
      v_campaign_status := v_campaign.status::text;
    else
      v_eval_status := 'none';
    end if;
  else
    v_eval_status := v_asg.status::text;
    select * into v_campaign from public.evaluation_campaigns where id = v_asg.campaign_id;
    v_campaign_status := v_campaign.status::text;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mustChangePassword', v_acc.must_change_password,
    'account', jsonb_build_object(
      'id', v_acc.id,
      'username', v_acc.username_normalized,
      'isActive', v_acc.is_active
    ),
    'worker', jsonb_build_object(
      'id', v_worker.id,
      'nombre', v_worker.nombre,
      'externalReference', v_worker.external_reference,
      'departamento', v_worker.departamento,
      'puesto', v_worker.puesto
    ),
    'assignment', case when v_asg.id is null then null else jsonb_build_object(
      'id', v_asg.id,
      'status', v_asg.status,
      'campaignId', v_asg.campaign_id,
      'campaignName', v_campaign.nombre,
      'campaignStatus', v_campaign_status,
      'startedAt', v_asg.started_at,
      'completedAt', v_asg.completed_at
    ) end,
    'evaluationStatus', v_eval_status
  );
end;
$$;

revoke all on function public.worker_get_portal_state() from public, anon;
grant execute on function public.worker_get_portal_state() to authenticated, service_role;

comment on function public.worker_get_portal_state() is
  'Estado portal worker. awaiting_campaign = assignment en campaña draft (B4.15.2).';
