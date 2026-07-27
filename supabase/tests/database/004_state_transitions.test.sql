-- =============================================================================
-- B4.2 · pgTAP · Transiciones de estado
-- Lo que la BD SÍ garantiza hoy (coherencia estado/timestamp) vs. lo DIFERIDO
-- a la capa RPC (monotonicidad / no-regresión). No se finge protección.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Limpieza defensiva: Vitest/E2E pueden dejar una campaña active residual.
update public.evaluation_campaigns
set status = 'closed',
    closed_at = coalesce(closed_at, timezone('utc', now()))
where status = 'active';

-- Base: campaña + 5 trabajadores distintos (UNIQUE(campaign_id, worker_id)).
insert into public.evaluation_campaigns (id, nombre, status)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc','C','active');
insert into public.workers (id, nombre) values
  ('11111111-1111-1111-1111-111111111111','W1'),
  ('22222222-2222-2222-2222-222222222222','W2'),
  ('33333333-3333-3333-3333-333333333333','W3'),
  ('44444444-4444-4444-4444-444444444444','W4'),
  ('55555555-5555-5555-5555-555555555555','W5');

-- ===================== Assignments: estados coherentes ======================
select lives_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
            '11111111-1111-1111-1111-111111111111','t_pending','0001','pending')$$,
  'pending sin started_at/completed_at/revoked_at es válido');

select lives_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status, started_at)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
            '22222222-2222-2222-2222-222222222222','t_inprog','0002','in_progress', now())$$,
  'in_progress con started_at es válido');

select lives_ok(
  $$insert into public.evaluation_assignments
      (id, campaign_id, worker_id, token_hash, token_last4, status, completed_at)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            '33333333-3333-3333-3333-333333333333','t_done','0003','completed', now())$$,
  'completed con completed_at es válido');

select lives_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status, revoked_at)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
            '44444444-4444-4444-4444-444444444444','t_rev','0004','revoked', now())$$,
  'revoked con revoked_at es válido');

-- completed exige completed_at (coherencia forzada por la BD)
select throws_ok(
  $$insert into public.evaluation_assignments
      (campaign_id, worker_id, token_hash, token_last4, status)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
            '55555555-5555-5555-5555-555555555555','t_bad','0005','completed')$$,
  '23514', NULL, 'BD impide completed sin completed_at');

-- --------------- MONOTONICIDAD FORZADA EN BD (B4.3, trigger) ----------------
select diag('B4.3: la monotonicidad ahora la fuerza enforce_assignment_transition()');
select diag('mediante trigger BEFORE UPDATE. La regresión de estado terminal FALLA.');

-- Ahora la BD IMPIDE regresar de completed a pending (antes era brecha diferida).
select throws_ok(
  $$update public.evaluation_assignments
      set status='pending', completed_at=null
    where id='dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  '23514', NULL, 'BD impide completed->pending (trigger de transición monótona)');

-- ===================== Campaigns: estados válidos ===========================
select lives_ok(
  $$insert into public.evaluation_campaigns (nombre, status) values ('draft-c','draft')$$,
  'campaign draft válido');
select lives_ok(
  $$insert into public.evaluation_campaigns (nombre, status) values ('closed-c','closed')$$,
  'campaign closed válido');
select lives_ok(
  $$insert into public.evaluation_campaigns
      (nombre, status, fecha_inicio, fecha_cierre)
    values ('ok-fechas','closed','2026-01-01','2026-02-01')$$,
  'campaign con fecha de cierre coherente');

-- ===================== Complaints: estados válidos ==========================
select lives_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, status)
    values ('T-1','otro','d','recibida')$$, 'complaint recibida');
select lives_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, status)
    values ('T-2','otro','d','en_revision')$$, 'complaint en_revision');
select lives_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, status)
    values ('T-3','otro','d','resuelta')$$, 'complaint resuelta');
select lives_ok(
  $$insert into public.confidential_complaints (folio, complaint_type, description, status, closed_at)
    values ('T-4','otro','d','cerrada', now())$$, 'complaint cerrada (con closed_at B4.5)');

-- ===================== Policies: borrador vs publicada ======================
select lives_ok(
  $$insert into public.policy_documents (title, content, version, status)
    values ('B','c','1.0','borrador')$$,
  'policy borrador sin published_at');
select lives_ok(
  $$insert into public.policy_documents
      (title, content, version, status, published_at)
    values ('P','c','1.0','publicada', now())$$,
  'policy publicada con published_at');

select diag('DIFERIDO A RPC: transiciones de complaint/policy y su bitácora en audit_log');
select diag('se implementarán mediante funciones controladas en el bloque de API/Auth.');

select * from finish();
rollback;
