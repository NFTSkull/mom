# B4.6 — Certificación Auth, RBAC y MFA

## Veredicto

**CERTIFICADO** (Supabase Auth local + PostgreSQL RBAC + MFA TOTP real).

No producción Cloud: sin `supabase link`, sin `db push`, sin deploy, sin usuarios reales.

## Regresión final (2026-07-27)

| Check | Resultado |
|---|---|
| npm audit / audit prod | 0 / 0 |
| lint / typecheck / build | 0 |
| Vitest | 189/189 |
| pgTAP | 517/517 |
| db:reset ×2 | 0 |
| migraciones | 001–005 |
| auth:seed:test / cleanup | 0 |
| Playwright total | 42/42 (B4.3+B4.4+B4.5+B4.6) |
| Fuente SHA-256 | `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76` (220837 bytes) |
| scoringVersion | `nom035-stps-2018-guia-i-ii-v1` |
| NOM035_ADMIN_BACKEND_MODE | `auth_rbac` |
| ACTIVE_REPOSITORY_MODE | `local` |

## Criterios de aceptación

| # | Criterio | Resultado |
|---|---|---|
| 1 | `/admin` sin sesión → login | OK |
| 2 | `/api/admin/nom035/*` sin Auth → 401 | OK |
| 3 | Proxy refresca; no es única barrera | OK |
| 4 | Página/endpoint/servicio/RPC validan permiso | OK |
| 5 | Perfil inactivo pierde acceso inmediato | OK (E2E + pgTAP) |
| 6 | Roles/permisos contra PostgreSQL | OK |
| 7 | Frontend no es autoridad | OK |
| 8 | Cookie/JWT/metadata/URL/payload no escalan | OK |
| 9 | Dirección solo agregados | OK |
| 10 | RH sin individuales/clínica/quejas | OK |
| 11 | Psicología con individual autorizado | OK |
| 12 | Admin sin clínica automática (sensitive=false por defecto) | OK |
| 13 | Sensible exige MFA/AAL2 | OK |
| 14 | Sin registro público | OK (`enable_signup=false`) |
| 15 | Usuarios solo por operación admin | OK |
| 16 | Último admin protegido | OK |
| 17 | Logout / password / recuperación / revocación | OK |
| 18 | Cuatro roles con usuarios sintéticos | OK (`@nom035.local`) |
| 19 | Sin usuarios reales | OK |
| 20 | B4.1–B4.5 sin regresión | OK |

## MFA

- TOTP real de Supabase Auth (seed + E2E).
- QR/secreto solo en enrolamiento; no persistido en DB app ni logs.
- AAL2 exigido en admin cuando `mfa_required=true`.

## Artefactos

- Migración `005_auth_rbac_mfa.sql`
- pgTAP `008_auth_rbac_mfa.test.sql`
- Proxy `src/proxy.ts` + `src/lib/supabase/proxy.ts`
- Guards `auth-context` / `require-admin-auth` / `require-permission` / `require-aal2`
- Manifiesto `endpoint-permissions.ts`
- Seed/cleanup `scripts/seed-auth-test-users.ts` / `cleanup-auth-test-users.ts`
- E2E `e2e/auth-rbac.spec.ts`
- Docs: AUTH_RBAC_MATRIX, AUTH_SECURITY_MODEL, MFA_OPERATIONS, USER_PROVISIONING_RUNBOOK, ACCESS_REVOCATION_RUNBOOK

## Confirmaciones operativas

- Sin Supabase remoto / link / db push / deploy
- Sin commit / push en este bloque
- Sin contraseñas/TOTP en Git ni en documentación de entrega
- Credenciales temporales solo en `.tmp/` (gitignore) y borradas en cleanup
- Cleanup local desactiva temporalmente el trigger del último admin solo para borrar `@nom035.local`

## Riesgos residuales (P0/P1)

- P1: CSP aún permite `'unsafe-inline'` / `'unsafe-eval'`.
- P1: retención/purge de evidencias soft-deleted.
- P1: jobs `storage_delete_pending`.
- P0 siguiente: provisionar usuarios reales de empresa (fuera de B4.6) y Cloud.
