-- B4.21 — Ver resultados individuales sin AAL2/MFA.
-- Mantiene permiso RBAC + can_view_sensitive_cases.
-- Quejas, users.manage, evidencias, etc. siguen exigiendo AAL2.

update public.role_permissions
set requires_aal2 = false
where permission in (
  'results.individual.read'::public.app_permission,
  'results.answers.read'::public.app_permission,
  'results.clinical.read'::public.app_permission
);

comment on table public.role_permissions is
  'Matriz RBAC. B4.21: results.*individual/answers/clinical sin requires_aal2; quejas y operaciones críticas sí.';
