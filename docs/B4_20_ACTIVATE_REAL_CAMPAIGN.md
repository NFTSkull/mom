# B4.20 — Activación definitiva campaña NOM-035 (83 trabajadores)

**Veredicto:** **CAMPAÑA NOM-035 ACTIVA PERMANENTEMENTE — 83 TRABAJADORES LISTOS PARA RESPONDER**

## Decisión de producto

- `Evaluación NOM-035 2026`: **draft → active**
- Permanencia hasta **cierre manual** admin (`status=closed`)
- **Sin** expiración automática / `fecha_cierre` / recreación / nuevos assignments / magic links / OTP / MFA workers / cambio obligatorio de password
- Activación de campaña **NO** exige MFA/AAL2 admin
- AAL2 permanece en endpoints admin sensibles (respuestas individuales, quejas, users.manage, evidencias, etc.)
- `WORKER_MFA_REQUIRED=false` intacto

## Separación de gates

| Gate | MFA/AAL2 |
|------|----------|
| `CAMPAIGN_ACTIVATION` (B417/B420) | **false** |
| `ADMIN_SENSITIVE_ACTIONS` | **true** (sin cambio) |

## Pre-audit Production (`agbl…kubf`)

workers/Auth/WA/usernames/must_change_false/assignments/pending = **83**  
I/II/III = **83/0/83** · sesiones/respuestas/resultados = **0/0/0**  
campaña real = draft → (pre) · active sintéticas = 0 · mapping 1:1 = 83 · dups/orphans = 0  
ConCasa **no** conectado.

## Backup pre-apertura

- UTC stamp: `2026-08-10T16-19-16-711Z`
- Ruta: `~/Desktop/nom035-production-backups/2026-08-10T16-19-16-711Z-b420-pre-open/`
- Data SHA-256: `5c0f204e21bea13260ef0e780e83a4c0b76ccc8a1e24183ebd3aec55c9bb83b3` (309 468 bytes)
- Schema SHA-256: `fb763fb77e38080b66979c98f9d5441bb679e7ae3bd23c9b5a1c91f5f7eef1ff` (273 654 bytes)
- Incluye public: workers, worker_accounts, campaigns, assignments, questionnaires, drafts, submissions, answers, results/sessions.

## Activación

| Campo | Valor |
|-------|-------|
| Campaña | Evaluación NOM-035 2026 |
| Transición | draft → **active** |
| rows_updated | **1** |
| activated_at | **2026-08-10T16:20:43.858Z** |
| closed_at / fecha_inicio / fecha_cierre | **NULL** |
| AUTO_EXPIRATION | **false** |
| ASSIGNMENTS_EXPIRING | **0** |

## Smoke 001 / 042 / 083

API + browser (001): login ×2 PASS · sin MFA/OTP · sin must_change · `evaluationStatus=pending` · campaña correcta · **Comenzar evaluación** visible · **no** se pulsó Comenzar.

Post-smoke: sesiones/respuestas/resultados = **0/0/0**.

## Conteos finales

| Métrica | Valor |
|---------|-------|
| workers / Auth / WA | 83 / 83 / 83 |
| usernames 001–083 | 83 |
| campaña real status | **active** |
| ACTIVE_REAL / ACTIVE_SYNTH | 1 / 0 |
| assignments / pending | 83 / 83 |
| I / II / III | 83 / 0 / 83 |
| sessions / answers / results | 0 / 0 / 0 |
| duplicates / orphans | 0 / 0 |
| passwords / usernames / asg modified | 0 / 0 / 0 |
| ConCasa | intacto |

Nota: existe campaña histórica **closed** `Test` con 1 assignment a un worker real; no está active y no es la campaña de los 83. La campaña permanente de los 83 es únicamente `Evaluación NOM-035 2026`.

## Artefactos código

- `scripts/b417-open-real-campaign.ts` — sin gate MFA; requiere backup SHA + structural 83
- `src/lib/nom035/campaign-activation-gates.ts` + tests B4.20
- `scripts/b420-smoke-login-start-button.ts`

## Intactos

passwords · usernames · assignments · AAL2 sensibles · ConCasa · credenciales no reimprimidas
