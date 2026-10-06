# B4.29 — Distribución por nivel de riesgo como fuente principal de interpretación

## Problema

Admin → Resultados mostraba «Promedio por categoría» y «Promedio por dominio» (puntaje bruto). Cada dominio tiene rango y puntos de corte propios (p. ej. Jornada de trabajo: medio ≥ 2, alto ≥ 4, muy alto ≥ 6; Carga de trabajo: medio ≥ 21, alto ≥ 27, muy alto ≥ 37). Graficar 2.86 junto a 21.74 en la misma escala sugería que Jornada era un problema menor, cuando es el dominio con mayor proporción Alto/Muy alto.

## Alcance

- Solo presentación: UI, gráficas PNG, XLSX consolidado, textos de interpretación.
- **Sin cambios** en `evaluation_answers`, `evaluation_results`, scoring, thresholds, snapshots, assignments, workers, cuentas, campaña ni `scoringVersion`.
- Sin migración SQL. Sin recalcular históricos: la fuente son los `riskLevel` persistidos en `guia_ii_category_scores` / `guia_ii_domain_scores`.

## Fuente única

RPC `admin_export_nom035_full_report` → `normalizeFullReportPayload` → `buildNom035AggregateReport` → endpoint `executive`, XLSX, PNG y UI (`/admin/resultados`, `/admin/reportes`).

## Indicadores

| Indicador | Fórmula | Nota |
|-----------|---------|------|
| Medio+ | Medio + Alto + Muy alto | Descriptivo, no nivel oficial |
| Alto+ | Alto + Muy alto | Descriptivo, no nivel oficial |

Redacción: «70% del personal se encuentra en nivel Medio, Alto o Muy alto en este dominio». Nunca «70% de riesgo».

## Superficies

- **UI Resultados:** A. Distribución general · B. Avance · C. Distribución por categoría · D. Distribución por dominio (barras apiladas 100 %, Medio+/Alto+ a la derecha) + tablas completas + nota de interpretación.
- **Resumen ejecutivo (web y XLSX):** lectura prioritaria (dominio con mayor Alto+, categoría con mayor Medio+), ranking «Dominios con mayor proporción Alto / Muy alto», categorías con Medio+ y Alto+ en columnas separadas. Sin promedios como KPI.
- **XLSX:** «GENERADO: …» y «VERSIÓN DE REPORTE: B4.29»; Categorías y Dominios (1/2, 2/2) con gráfica apilada arriba y tabla abajo; Metodología con «CÓMO INTERPRETAR». 11 hojas (sin hoja nueva).
- **Reportes:** recomendaciones basadas en el ranking Alto+ (antes se ordenaban por promedio bruto). Promedios brutos solo en `<details>` etiquetado «NO COMPARABLE ENTRE DOMINIOS».
- **Individual:** gráficas de puntaje con el nivel en la etiqueta (`Dominio (Alto)`) y color de nivel.

## Auditoría Production (read-only, pre-cambio)

`scripts/b429-audit-distributions.ts` (transacción `read only`, sin nombres):

- REAL_WORKERS=83 · REAL_COMPLETED=80 · REAL_RESULTS=80 · TEST_INCLUDED=0 · ATS=2 · CLINICAL=1.
- Dominio Jornada de trabajo: 14 / 10 / 22 / 24 / 10 → Medio+ 56 (70 %), Alto+ 34 (42.5 %).
- Categoría Organización del tiempo de trabajo: 26 / 13 / 21 / 18 / 2 → Medio+ 41 (51.25 %), Alto+ 20 (25 %).
- Huellas md5 de answers/results/assignments/workers/worker_accounts/campaigns registradas antes y comparadas después del deploy.

## Pruebas

`src/lib/nom035/__tests__/b429-risk-distribution.test.ts` (fixture `fixtures/b429-production-matrix.ts`, sin PII) + aserción e2e en `e2e/admin-core.spec.ts`.
