# B4.28.2 — Limpieza definitiva residuos SYN/SMOKE en Production

**Veredicto:** **RESIDUOS SYN/SMOKE ELIMINADOS — PRODUCTION LIMPIA**

## Target

| Campo | Valor |
|-------|-------|
| Project | `nom035-production` (`agbl…kubf`) |
| Worker | `external_reference=SYN-PRUEBA-LOGIN` + `is_test=true` |
| Nombre | Trabajador Prueba Portal |
| Username | `prueba.trabajador` |
| Resuelto | **exactamente 1** |

## Conteos test

| Métrica | Antes | Después |
|---------|------:|--------:|
| TEST_WORKERS | 1 | **0** |
| TEST_ASSIGNMENTS | 2 | **0** |
| TEST_RESULTS | 1 | **0** |
| TEST_ANSWERS | 57 | **0** |
| TEST_SESSIONS | 6 | **0** |
| TEST_QUESTIONNAIRES | 4 | **0** |
| SYN-PRUEBA-LOGIN | 1 | **0** |
| CAMPAÑA_LOGIN_PRUEBA_PROD | 1 | **0** (sin datos reales) |

## Auth / campaña

| Ítem | Resultado |
|------|-----------|
| Auth synthetic eliminado | **sí** (`prueba.trabajador`, no admin) |
| Campaña synthetic eliminada | **sí** |
| Campaña real `Evaluación NOM-035 2026` | intacta (`closed`) |

## Datos reales (pre = post)

| Métrica | Pre | Post |
|---------|----:|-----:|
| REAL_WORKERS | 83 | 83 |
| REAL_COMPLETED | 80 | 80 |
| REAL_PENDING | 3 | 3 |
| REAL_RESULTS | 80 | 80 |
| REAL_ANSWERS | 5568 | 5568 |
| ATS | 2 | 2 |
| CLINICAL | 1 | 1 |
| realWorkerRefsSha | `216cc15a…12f6` | `216cc15a…12f6` (idéntico) |

## Backups off-repo

| Fase | Ruta (hint) | SHA-256 |
|------|-------------|---------|
| Pre | `~/Desktop/nom035-production-backups/2026-09-03T16-50-24-759Z-b4282-pre-cleanup/` | `4e540fc6…2a28` |
| Post | `~/Desktop/nom035-production-backups/2026-09-03T16-50-57-391Z-b4282-post-cleanup/` | `1c16342b…70b5` |

Método: `psql-json-logical` (Docker/`pg_dump` v17 no disponible en el host).

## Seguridad

```
DATA_REAL_MODIFIED=0
REAL_ANSWERS_DELETED=0
REAL_RESULTS_DELETED=0
REAL_ASSIGNMENTS_DELETED=0
REAL_WORKERS_DELETED=0
CONCASA_INTACTO=true
```

## Scripts

- `scripts/b4282-cleanup-syn-prueba.ts` — dry-run / execute
- `scripts/b4282-psql-backup.ts` — backup lógico JSON
