# B4.19.1 — Login simple username+password (83) y MFA solo admin

**Veredicto:** **LOGIN SIMPLE USERNAME + PASSWORD CERTIFICADO PARA 83 TRABAJADORES**

**ADMIN_MFA_IS_SEPARATE=true**  
**WORKER_MFA_REQUIRED=false**

## Workers (Production)

| Métrica | Valor |
|---------|-------|
| workers / Auth / WA | 83 / 83 / 83 |
| usernames | 001–083 |
| must_change_password=false | 83 |
| MFA factors workers | **0** |
| MFA verified workers | **0** |
| inactive / dup / huérfanos | 0 / 0 / 0 |
| campaña | **draft** |
| asg / I / II / III | 83 / 83 / 0 / 83 |
| sesiones/respuestas/resultados | 0 / 0 / 0 |

Flujo: `username+password` → `signInWithPassword` → `auth.uid()` → `worker_account` → assignment → campaña.  
UI login solo campos Usuario/Contraseña. Respuesta API: `{ok, mustChangePassword, requestId}` — sin MFA/OTP/AAL.

## Smoke (sin mostrar passwords)

| User | Login×2 | must_change | MFA challenge | Estado portal |
|------|---------|-------------|---------------|---------------|
| 001 | 200/200 | false | no | awaiting_campaign |
| 042 | 200/200 | false | no | awaiting_campaign |
| 083 | 200/200 | false | no | awaiting_campaign |

## Admin MFA (documentado, sin cambios)

Estado medido: MFA verified=**0**, `mfa_required`=**false**, AAL2 no alcanzable aún.

### A–D respuestas individuales

| | |
|--|--|
| A. Dashboard general sin MFA | **Sí** (`dashboard.view` → AAL1 OK) |
| B. Métricas agregadas sin MFA | **Sí** (`results.aggregate.read` → AAL1 OK) |
| C. Detalle individual requiere AAL2 | **Sí** (`GET …/results/[id]` → `results.individual.read`) |
| D. Bloqueado sin MFA/AAL2 | Detalle/respuestas/clínico individuales; quejas sensibles; `users.manage`; `evidence.download`; rotate/revoke assignment; `policies.publish` |

Campaña **no abierta**. Passwords/usernames no modificados. ConCasa intacto.
