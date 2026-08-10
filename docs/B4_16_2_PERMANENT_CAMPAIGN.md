# B4.16.2 — Campaña NOM-035 permanente hasta cierre manual

**Veredicto:** **CAMPAÑA PERMANENTE CERTIFICADA — APERTURA Y CIERRE EXCLUSIVAMENTE MANUALES**

**Campaña:** `Evaluación NOM-035 2026` (sigue **draft**; no abierta en esta fase).

## Arquitectura de ciclo de vida

| Capacidad | Comportamiento |
|-----------|----------------|
| Abrir | Solo `admin_activate_campaign` (status `draft` → `active`, `activated_at`, `closed_at=null`, limpia `fecha_inicio`/`fecha_cierre`) |
| Cerrar | Solo `admin_close_campaign` (status → `closed` + `closed_at`) |
| Auto-expiración calendario | **Eliminada** de `check_assignment_usable` (ya no usa `fecha_inicio`/`fecha_cierre`) |
| Cron / scheduler | **0** (`pg_cron`/`pg_net` ausentes; `vercel.json` sin crons) |
| Assignment TTL | Solo si `expires_at` ≠ NULL (links públicos). Los **83** tienen `expires_at` NULL |
| Sesión evaluación | `evaluation_sessions.expires_at` — expira la sesión, no la cuenta ni el assignment |
| Draft | `evaluation_drafts` PK=`assignment_id`; sin columna de expiración |

## Login permanente

URL: `https://nom035-production.vercel.app/trabajador/login`  
Usernames `001`–`083` + password actual. Sin magic link / invite / URL individual.

## Estados (portal)

| Assignment + campaña active | UI |
|-----------------------------|-----|
| pending | Comenzar evaluación |
| in_progress | Continuar evaluación |
| completed | Evaluación completada (no reabre sesión de captura) |

## Conteos certificados

workers/Auth/WA/asg = 83; I/II/III = 83/0/83; `ASSIGNMENTS_DURABLE=83`; `ASSIGNMENTS_EXPIRING=0`; `AUTO_EXPIRATION=false`; simulación +1/+7/+30/+90 = ok.

## Cambios

- Migración `010_campaign_permanent_until_manual_close.sql` (Production aplicada).
- Helper `src/lib/nom035/campaign-permanence.ts` + Vitest.
- Script `scripts/b4162-certify-permanent-campaign.ts`.

## Nota operativa

Hay otra campaña **active** sintética de prueba; al abrir la real habrá que cerrarla antes o el RPC devolverá `another_active_exists`. No se abrió la real en B4.16.2.
