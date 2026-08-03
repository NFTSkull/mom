# B4.15.2 — Campaña draft + 83 assignments I+III

**Fecha UTC:** 2026-08-03  
**Veredicto:** **EVALUACIONES ASIGNADAS — CAMPAÑA DRAFT LISTA**  
**Apertura:** **APERTURA BLOQUEADA** (MFA admin=0; PITR/backups administrados no activos; sin aceptación B explícita)

## Resultados

| Ítem | Valor |
|---|---:|
| Campaña | Evaluación NOM-035 2026 |
| Estado | draft (`activated_at` null) |
| Workers / WA / Auth vinculados | 83 / 83 / 83 |
| Assignments pending | 83 |
| GUIA_I / GUIA_III / GUIA_II | 83 / 83 / **0** |
| Sesiones / respuestas / resultados nuevas | 0 / 0 / 0 |
| Legacy revocados / drafts | 2 / 2 |
| Duplicados / huérfanos | 0 / 0 |
| Passwords modificadas | 0 |
| 2ª ejecución (idempotente) | 0 creados |

## Portal trabajador

Con campaña draft: `evaluationStatus=awaiting_campaign`  
Mensaje: «Tu evaluación está asignada y estará disponible cuando la campaña sea abierta.»  
Abrir sesión: bloqueado (`no_assignment` mientras no esté `active`).

## Backups

- Pre: `…-pre-b4152-assignments`
- Post: `…-post-b4152-assignments`

## Confirmaciones

- Campaña no abierta; credenciales no enviadas; ConCasa intacto; legacy preservado.
