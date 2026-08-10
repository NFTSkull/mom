# B4.19 — Cierre sintética + apertura real (bloqueada por MFA/backup)

**Veredicto:** **CAMPAÑA PERMANENTE CERTIFICADA — APERTURA AÚN BLOQUEADA**

## RUNTIME_DEPLOY_REQUIRED

**false**

Commit `833b5ca` contiene: docs/CHANGELOG/DEVLOG, script de certificación, helper Vitest `campaign-permanence.ts` (**no** importado por `src/app`), y migración `010` (ya aplicada en Production: `schema_migrations` incluye `010`; RPC `check_assignment_usable` / `admin_activate_campaign` con lógica B4.16.2).

La permanencia efectiva vive en **DB/RPC**, no en el bundle Next de Vercel. No se redeployó.

SHA local/remoto: `833b5ca`.  
Production Vercel alias: deploy `dpl_HED2fwVQcVeTHciC3uue3YRKfxaa` (Ready; ~2026-08-06 UI greeting). Preview de `833b5ca` existe.

## Campaña sintética

| Campo | Valor |
|-------|-------|
| Nombre | `CAMPAÑA_LOGIN_PRUEBA_PROD` |
| id prefix | `c64cdf0b` |
| Antes | **active** |
| Después | **closed** (`closed_at` set) |
| Assignments | 1 |
| Worker | `SYN-PRUEBA-LOGIN` |
| Overlap con 83 reales | **0** |
| answers/results | 0/0 |

Cerrada con guarda anti-error (≠ real, overlap 0, real sigue draft). Sin DELETE.

## Post-cierre

- campañas **active** = **0**
- real `Evaluación NOM-035 2026` = **draft**
- workers/asg = 83; sesiones/respuestas/resultados reales = 0/0/0

## Precondiciones apertura (medidas)

| Flag | Valor |
|------|-------|
| MFA_FACTORS_VERIFIED | **0** |
| ADMIN_AAL2 | **false** |
| mfa_required | **false** |
| PITR_ENABLED | **false** |
| BACKUP_POLICY_ACCEPTED | **false** (archivo ausente) |

Dry-run B417: `APERTURA BLOQUEADA` — **no** se ejecutó `B417_EXECUTE=1`.

## Para desbloquear (humano)

1. MFA admin verified + re-login AAL2 → luego `mfa_required=true` solo admin.  
2. Crear `~/Desktop/nom035-production-secrets/backup-policy-accepted.txt` (autorización expresa) **o** habilitar PITR.  
3. Reintentar: `B417_EXECUTE=1 npx tsx scripts/b417-open-real-campaign.ts`

## Intactos

passwords 0 · usernames 0 · assignments 0 · ConCasa intacto · credenciales no entregadas
