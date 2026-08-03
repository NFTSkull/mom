# Contratos de API

## Bloque actual: B4.9 — Portal autenticado del trabajador

| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/api/trabajador/login` | Usuario/número + password; mensaje genérico |
| POST | `/api/trabajador/logout` | Cierra Auth + cookie de evaluación |
| GET | `/api/trabajador/me` | Estado portal (assignment) |
| POST | `/api/trabajador/password/change` | Cambio voluntario (o forzado solo si admin marca `must_change_password`) |
| POST | `/api/trabajador/evaluacion/open` | Emite cookie de sesión y reutiliza `/evaluacion/contestar` |

UI: `/trabajador/login`, `/trabajador`, `/trabajador/cambiar-contrasena`, `/trabajador/evaluacion`, `/trabajador/completado`.

**P0:** Guía III no implementada — no usar este portal para campaña productiva de 83 hasta cerrar Guía III.

## Bloque B4.6 — Auth, RBAC y MFA

Ver:

- `docs/AUTH_SECURITY_MODEL.md`
- `docs/AUTH_RBAC_MATRIX.md`
- `docs/MFA_OPERATIONS.md`
- `docs/USER_PROVISIONING_RUNBOOK.md`
- `docs/ACCESS_REVOCATION_RUNBOOK.md`
- `docs/B4_6_AUTH_RBAC_CERTIFICATION.md`

Auth:

| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/api/auth/login` | Credenciales; mensaje genérico |
| POST | `/api/auth/logout` | Invalida sesión + cookies |
| GET | `/api/auth/me` | Perfil + AAL (sin secretos) |
| POST | `/api/auth/mfa/enroll\|challenge\|verify\|unenroll` | TOTP |
| GET | `/api/auth/mfa/status` | Factores (sin secretos) |
| POST | `/api/auth/password/request-reset\|update\|change` | Política fuerte |
| GET | `/auth/confirm` | Callback PKCE |

Admin users (users.manage + AAL2):

| Método | Ruta |
|--------|------|
| GET/POST | `/api/admin/nom035/users` |
| PUT | `/api/admin/nom035/users/[id]` |
| POST | `/api/admin/nom035/users/[id]/deactivate\|reactivate\|reset-mfa\|send-reset` |
| DELETE | `/api/admin/nom035/users/[id]` |
| GET | `/api/admin/nom035/audit` |

Todos los `/api/admin/nom035/*` exigen Auth + permiso del manifiesto `endpoint-permissions.ts`.

## Bloque B4.5 — módulos secundarios + Storage privado

Ver:

- `docs/ACTION_PLAN_API.md`
- `docs/EVIDENCE_STORAGE_SECURITY.md`
- `docs/COMPLAINTS_PRIVACY_MODEL.md`
- `docs/POLICY_VERSIONING.md`
- `docs/B4_5_SECONDARY_MODULES_CERTIFICATION.md`

## Bloque B4.4 — panel administrativo central

Ver `docs/ADMIN_CORE_API.md`. Guard loopback supersedido por Auth (B4.6); ver `docs/AUTH_SECURITY_MODEL.md`.

## Bloque B4.3 — evaluación pública

Ver `docs/PUBLIC_EVALUATION_API.md` (fuente de verdad de endpoints, códigos,
cookies, idempotencia y campos no expuestos). Sin login de trabajador.
