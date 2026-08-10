# Matriz Auth / RBAC — NOM-035 (B4.6)

Autoridad: PostgreSQL `role_permissions` + `require_admin_permission`.
La UI solo oculta; no autoriza.

## Permisos

Ver enum `app_permission` y filas en `role_permissions` (migración 005).

## Por rol

| Módulo | admin | rh | psicologo | direccion |
|---|---|---|---|---|
| dashboard | sí | sí | sí | sí |
| company write | sí | no | no | no |
| workers | sí | sí | no | no |
| campaigns write | sí | sí | no | no |
| results aggregate | sí | sí | sí | sí |
| results individual/answers/clinical | sí si sensitive (sin AAL2) | no | sí si sensitive (sin AAL2) | no |
| complaints | solo si sensitive+AAL2 | no | sí (sensitive+AAL2) | no |
| users.manage | sí + AAL2 | no | no | no |
| audit.read | sí + AAL2 | no | no | no |

## Sensitive + AAL2

Permisos de **quejas** requieren `can_view_sensitive_cases=true` y sesión `aal=aal2`.

**Resultados individuales / answers / clinical (B4.21):** requieren `can_view_sensitive_cases=true` pero **NO** AAL2/MFA.

Además siempre AAL2: `users.manage`, `evidence.download`, `assignments.rotate|revoke`, `policies.publish`.
