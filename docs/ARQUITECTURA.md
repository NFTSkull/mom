# Arquitectura — portal NOM-035

## Capas

1. **UI admin (B4.4–B4.6):** páginas `/admin/*` vía `/api/admin/nom035/*` + Supabase Auth local.
   - Autorización: PostgreSQL (`admin_profiles` + `role_permissions` + `require_admin_permission*`).
   - Proxy (`src/proxy.ts`) refresca sesión con `getClaims`; cada layout/endpoint/RPC revalida.
   - MFA TOTP (AAL2) obligatorio cuando `mfa_required=true`.
   - Modo: `NOM035_ADMIN_BACKEND_MODE=auth_rbac`.
   - Evidencias: Storage privado `nom035-evidence` + signed downloads tras permiso + AAL2.
2. **UI trabajador pública (B4.3):** Route Handlers + Supabase local (server-only); sin login.
3. **Motor certificado:** `scoring-engine.ts` + manifiesto Guía II (inalterable sin prueba).
4. **PostgreSQL local:** migraciones 001–005, RLS cerrada, RPCs atómicas con auth interna.
5. **Staging (B4.7):** proyecto Supabase Cloud `nom035-staging` + Vercel Preview (nunca Production en este bloque).
6. **Repositorio general:** `ACTIVE_REPOSITORY_MODE=local` (sin cambio global).
7. **Health:** `GET /api/health/live` y `GET /api/health/ready` (sin secretos).

## Flujo admin

`/login` → perfil activo → MFA (AAL2) → `/admin` → Route Handler `requirePermission` →
cliente autenticado → RPC `require_admin_permission` → respuesta filtrada por rol.

## Flujo público

`/evaluacion/[token]` → POST `/api/public/evaluations/session` → cookie HttpOnly →
`/evaluacion/contestar` → draft/start/submit → `/evaluacion/gracias`.

Detalle: `docs/PUBLIC_EVALUATION_API.md`, `docs/ADMIN_CORE_API.md`, `docs/AUTH_SECURITY_MODEL.md`.
