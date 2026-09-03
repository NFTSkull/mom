# Contratos de API

## Bloque actual: B4.28 — UI descarga Excel consolidado

Misma API que B4.26/B4.24. Superficie UI:

| Pantalla | Control |
|----------|---------|
| `/admin` | Reportes NOM-035 → Descargar Excel completo (+ avance Sí/No) |
| `/admin/resultados` | Descargar Excel completo (+ individual en detalle) |
| `/admin/reportes` | Descargar Excel completo |

Endpoint: `GET /api/admin/nom035/reports/full` · permiso `reports.generate`.

## Bloque B4.26 — Reportes ejecutivos NOM-035 (Guía I+III)

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/admin/nom035/campaigns/avance-excel` | `dashboard.view` | Avance Sí/No (B4.22) |
| GET | `/api/admin/nom035/reports/summary` | `reports.generate` | Resumen/gráficas legacy |
| GET | `/api/admin/nom035/reports/executive` | `reports.generate` | JSON agregado ejecutivo (mismo dataset que Excel) |
| GET | `/api/admin/nom035/reports/full` | `reports.generate` | XLSX consolidado 11 hojas + gráficas PNG |
| GET | `/api/admin/nom035/results/[id]/report` | `results.individual.read` | XLSX individual 6 hojas; solo `completed` real |

Archivos: `reporte-completo-nom035-2026.xlsx` · `nom035-<username>-2026.xlsx`.

Fuente: RPC `admin_export_nom035_full_report` + snapshots + `buildNom035AggregateReport`; **excluye** `is_test=true`.

Modelo mostrado: **GUÍA I Y III DE NOM-035** (nunca Guía II).

Headers: `Cache-Control: no-store` · `Content-Disposition: attachment` (XLSX).

Ver `docs/B4_26_REPORTES_EJECUTIVOS.md`.

## Bloque B4.24 — Reportes Excel completos NOM-035

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/admin/nom035/campaigns/avance-excel` | `dashboard.view` | Avance Sí/No (B4.22) |
| GET | `/api/admin/nom035/reports/full` | `reports.generate` | XLSX consolidado (evolucionado en B4.26 a 11 hojas) |
| GET | `/api/admin/nom035/results/[id]/report` | `results.individual.read` | XLSX individual; solo `completed` real |

Archivos: `reporte-completo-nom035-2026.xlsx` · `nom035-<username>-2026.xlsx`.

Fuente: RPC `admin_export_nom035_full_report` + snapshots persistidos; **excluye** `is_test=true` (misma regla que B4.23).

Headers: `Cache-Control: no-store` · `Content-Disposition: attachment`.

Migración: `014_admin_export_nom035_full_report.sql`.

## Bloque B4.23 — Cierre campaña + exclusión test de métricas

- Campaña `Evaluación NOM-035 2026`: cierre manual → `closed` (histórico legible).
- `workers.is_test` marca sintéticos; métricas/reportes/Excel **excluyen** `is_test=true`.
- Login worker con campaña cerrada: `evaluation_unavailable` / «La evaluación ya no está disponible.»
- Migración: `013_is_test_exclude_metrics.sql`.
- Script: `scripts/b423-close-campaign.ts`.

## Bloque B4.22 — Export Excel de avance NOM-035

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/admin/nom035/campaigns/avance-excel` | `dashboard.view` | XLSX operativo; **sin** AAL2 |

Archivo: `avance-nom035-2026.xlsx` · hoja `Avance NOM035` · columnas `Nombre \| Usuario \| Respondió`.

Fuente: RPC `admin_export_nom035_avance` → campaña exacta `Evaluación NOM-035 2026` · 83 workers reales · `Respondió=Sí` solo si assignment `completed`.

No exporta answers/scores/risk/passwords/UUIDs.

## Bloque B4.21 — Resultados sin MFA/AAL2

- `results.individual.read` / `results.answers.read` / `results.clinical.read`: **sin** AAL2.
- Siguen exigiendo Auth + permiso RBAC + `can_view_sensitive_cases`.
- Quejas, `users.manage`, evidencias protegidas y operaciones críticas **mantienen** AAL2.
- Migración: `011_results_without_aal2.sql`.

## Bloque B4.16.2 — Campaña permanente (hasta cierre manual)

Campaña operativa prevista: `Evaluación NOM-035 2026`.

- Apertura: `admin_activate_campaign` (manual).
- Cierre: `admin_close_campaign` (manual).
- Sin auto-expiración por `fecha_inicio`/`fecha_cierre`.
- Portal trabajador: login `001`–`083`; assignments durables (`expires_at` NULL).
- Ver `docs/B4_16_2_PERMANENT_CAMPAIGN.md`.

## Bloque B4.9 — Portal autenticado del trabajador

| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/api/trabajador/login` | Username string (B4.18: `001`–`083`) + password; mensaje genérico; trim OK; sin coerción numérica |
| POST | `/api/trabajador/logout` | Cierra Auth + cookie de evaluación |
| GET | `/api/trabajador/me` | Estado portal (assignment) |
| POST | `/api/trabajador/password/change` | Cambio voluntario (o forzado solo si admin marca `must_change_password`) |
| POST | `/api/trabajador/evaluacion/open` | Emite cookie de sesión y reutiliza `/evaluacion/contestar` |

UI: `/trabajador/login`, `/trabajador`, `/trabajador/cambiar-contrasena`, `/trabajador/evaluacion`, `/trabajador/completado`.

**Username (B4.18):** identificador de acceso independiente del número de empleado. Formato actual del grupo de 83: `"001"`…`"083"` (string, ceros iniciales). Password permanece `NOM` + número de empleado canónico.

**Login workers (B4.19.1):** únicamente username + password. **WORKER_MFA_REQUIRED=false**. MFA/AAL2 es solo admin (`ADMIN_MFA_IS_SEPARATE=true`).

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
