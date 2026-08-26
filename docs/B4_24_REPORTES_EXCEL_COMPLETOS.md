# B4.24 — Reportes Excel completos NOM-035

## Veredicto

**REPORTES NOM-035 COMPLETOS — EXCEL + GRÁFICAS LISTOS**

## Conteos Production (2026-08-26)

| Métrica | Valor |
|---------|-------|
| REAL_WORKERS | 83 |
| REAL_COMPLETED | 80 |
| REAL_PENDING | 3 |
| REAL_IN_PROGRESS | 0 |
| REAL_RESULTS | 80 |
| TEST_WORKERS | 1 |
| TEST_RESULTS_STORED | 1 |
| TEST_RESULTS_INCLUDED | 0 |
| TEST_ROWS_IN_EXPORT | 0 |
| TEST_CONTRIBUTION_TO_CHARTS | 0 |
| PASSWORD_COLUMNS | 0 |
| AUTH_SECRET_COLUMNS | 0 |

## Endpoints

| Uso | Ruta | Permiso |
|-----|------|---------|
| Excel avance Sí/No | `GET /api/admin/nom035/campaigns/avance-excel` | `dashboard.view` |
| Excel consolidado | `GET /api/admin/nom035/reports/full` | `reports.generate` |
| Excel individual | `GET /api/admin/nom035/results/[id]/report` | `results.individual.read` |

Headers: `Cache-Control: no-store`, `Content-Disposition: attachment`.

## Archivos XLSX

### Consolidado: `reporte-completo-nom035-2026.xlsx`

1. Resumen
2. Completados
3. Resultados Individuales
4. Categorías
5. Dominios
6. Guía I - Respuestas
7. Guía III - Respuestas
8. Gráficas (tablas + PNG embebidas)

### Individual: `nom035-<username>-2026.xlsx`

1. Resumen
2. Guía I
3. Guía III
4. Categorías
5. Dominios
6. Gráficas

## UI

- Admin → Inicio: sección **Reportes NOM-035**
- Admin → Resultados: gráficas web + botón **Descargar Excel individual** en detalle completed

## RPC

- `admin_export_nom035_full_report()` — migración `014_admin_export_nom035_full_report.sql`
- Filtro idéntico a métricas B4.23 (`is_test=false`, usernames 001–083, `assignment.status=completed`)

## Tests

`src/lib/nom035/__tests__/b424-full-report.test.ts` — 328 tests PASS total suite.

## ConCasa

Sin cambios a datos reales, campaña, passwords ni accesos workers.
