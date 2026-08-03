-- B4.15.1 — Cambio de contraseña del trabajador no es obligatorio por defecto.
-- Conserva admin_force_worker_password_change / must_change_password=true como opción administrativa.

alter table public.worker_accounts
  alter column must_change_password set default false;

comment on column public.worker_accounts.must_change_password is
  'Si true, el portal exige cambio antes de evaluar (solo por reset/forzado admin). Default false (B4.15.1).';
