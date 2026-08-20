-- B4.22 — Export de avance operativo (Nombre | Usuario | Respondió).
-- Solo lectura. Sin respuestas, scores ni datos clínicos.

create or replace function public.admin_export_nom035_avance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_items jsonb;
  v_completed int;
  v_total int;
begin
  perform public.require_admin_permission('dashboard.view'::public.app_permission);

  select c.id into v_campaign_id
  from public.evaluation_campaigns c
  where c.nombre = 'Evaluación NOM-035 2026'
  limit 1;

  if v_campaign_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'nombre', t.nombre,
    'usuario', t.usuario,
    'status', t.status
  ) order by t.usuario), '[]'::jsonb),
  count(*)::int,
  count(*) filter (where t.status = 'completed')::int
  into v_items, v_total, v_completed
  from (
    select
      w.nombre as nombre,
      wa.username_normalized as usuario,
      a.status::text as status
    from public.evaluation_assignments a
    join public.workers w on w.id = a.worker_id
    join public.worker_accounts wa on wa.worker_id = w.id and wa.is_active
    where a.campaign_id = v_campaign_id
      and a.status is distinct from 'revoked'
      and w.activo
      and w.external_reference ~ '^[0-9]+$'
      and wa.username_normalized ~ '^[0-9]{3}$'
      and wa.username_normalized::int between 1 and 83
  ) t;

  insert into public.audit_log(action, entity_type, entity_id, metadata)
  values (
    'admin_export_nom035_avance',
    'evaluation_campaign',
    v_campaign_id,
    jsonb_build_object(
      'total', v_total,
      'completed', v_completed,
      'columns', jsonb_build_array('Nombre', 'Usuario', 'Respondió')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'campaignName', 'Evaluación NOM-035 2026',
    'items', v_items,
    'total', v_total,
    'completedCount', v_completed
  );
end;
$$;

revoke all on function public.admin_export_nom035_avance() from public, anon;
grant execute on function public.admin_export_nom035_avance() to authenticated, service_role;

comment on function public.admin_export_nom035_avance() is
  'B4.22: export avance NOM-035 (nombre/usuario/completado). Sin answers/scores. Requiere dashboard.view.';
