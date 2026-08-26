# B4.23 — Cierre controlado + exclusión de prueba de métricas

**Veredicto:** **CAMPAÑA NOM-035 CERRADA — HISTÓRICO PROTEGIDO — USUARIO DE PRUEBA EXCLUIDO DE MÉTRICAS**

## Hallazgo test

| Campo | Valor |
|-------|-------|
| Worker | `SYN-PRUEBA-LOGIN` |
| Username | `prueba.trabajador` |
| Marker | `WORKER_LOGIN_SMOKE_PROD` |
| Assignment en campaña real | **completed** + result |
| Guías en campaña real | GUIA_I + **GUIA_II** |
| Contaminaba agregados | sí (dashboard/results globales / campaña sin filtro is_test) |

## Corrección

- Columna `workers.is_test` (mig `013`)
- `TEST_WORKERS_MARKED=1` · `REAL_WORKERS_MARKED_TEST=0`
- RPCs: dashboard, list_results, reports_summary, avance-excel filtran `is_test=false`
- Test **no** borrado; permanece en BD fuera de métricas

## Promedio (guia_ii_final_score)

| | Valor |
|--|-------|
| Antes (con test) | **77.0247** |
| Después (reales) | **76.9875** |
| Test contribution | **0** en métricas |

## Cierre

| | |
|--|--|
| Antes | active |
| Después | **closed** |
| closed_at | **2026-08-26T19:03:02.106Z** |
| ACTIVE_REAL_WORKER_ACCOUNTS | **0** |
| WORKER_AUTH_SESSIONS | **0** |
| answers/results deleted | **0/0** |

## Backups

- Pre: `…/2026-08-26T19-01-48-233Z-b423-pre-close/` data SHA `905f13c4…c06417`
- Post: `…/2026-08-26T19-03-47-997Z-b423-post-close/` data SHA `17713abc…fa262a`
