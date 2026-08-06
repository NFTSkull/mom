# B4.17 — Apertura final controlada de la campaña real

**Fecha UTC:** 2026-08-04  
**Veredicto:** **APERTURA BLOQUEADA**

## Objetivo

Pasar `Evaluación NOM-035 2026` de `draft` → `active` únicamente con MFA/AAL2/backup válidos.

## Precondiciones (medidas, no simuladas)

| Flag | Valor | Requerido |
|---|---|---|
| MFA_FACTORS_VERIFIED | **0** | ≥ 1 |
| ADMIN_AAL2 | **false** | true |
| mfa_required (admin activo) | **false** | true |
| PITR_ENABLED | **false** | true **o** backup policy |
| BACKUP_POLICY_ACCEPTED | **false** (archivo off-repo ausente) | true si sin PITR |

**Bloqueadores:** los 4 fallan → **cero escritura** en la campaña.

## Estado de la campaña (sin cambios)

| Campo | Valor |
|---|---|
| Nombre | Evaluación NOM-035 2026 |
| Status | **draft** |
| activated_at | null |
| Campañas active | 0 |
| Assignments / pending | 83 / 83 |
| Guía I / III / II | 83 / 83 / 0 |
| Sesiones / respuestas / resultados | 0 / 0 / 0 |

## Acciones no ejecutadas

- Backup pre-apertura (no procede sin precondiciones)
- `UPDATE … status=active`
- Smoke de «Comenzar evaluación»
- Panel post-apertura

## Para desbloquear (operación humana)

1. Enroll MFA admin (factor verified ≥ 1) y sesión AAL2.
2. `admin_profiles.mfa_required = true`.
3. Habilitar PITR/backups administrados **o** crear  
   `~/Desktop/nom035-production-secrets/backup-policy-accepted.txt`  
   con aceptación explícita (`RIESGO TEMPORAL ACEPTADO` / `ACCEPTED`).
4. Reejecutar:  
   `B417_EXECUTE=1 npx tsx scripts/b417-open-real-campaign.ts`

## Confirmaciones

- Campaña **no** abierta  
- Passwords/usernames intactos  
- ConCasa intacto  
- Credenciales no entregadas  
