# B4.26 — Rediseño profesional de reportes NOM-035 (Guía I+III)

## Objetivo

Presentación ejecutiva equivalente a la plantilla histórica de referencia, alimentada **solo** con datos productivos Guía I + Guía III (población >50). La plantilla `.xls` antigua es referencia visual; no se importan sus 21 encuestados ni Guía II.

## Modelo

`GUÍA I Y III DE NOM-035` — nunca Guía II en el reporte real.

## Dataset compartido

`buildNom035AggregateReport(...)` → population, overallRiskDistribution, predominantRisk (descriptivo), categories×nivel, domains×nivel, ATS, clinicalAttention, tops.

Usado por:

- Excel consolidado
- Excel individual (KPIs)
- `GET /api/admin/nom035/reports/executive`
- Admin → Resultados → Resumen Ejecutivo

## Excel consolidado (11 hojas)

1. Resumen Ejecutivo  
2. Categorías  
3. Dominios  
4. Distribución Final  
5. Acontecimiento Traumático  
6. Completados  
7. Resultados Individuales  
8. Guía I - Respuestas  
9. Guía III - Respuestas  
10. Datos para Gráficas (oculta si la API lo permite)  
11. Metodología  

## Métricas

- PERSONAL EVALUADO = REAL_COMPLETED dinámico  
- Test excluido (`testResultsIncluded=0`)  
- Sin inventar “% de riesgo” agregado; se muestra **RIESGO PREDOMINANTE**  
- ATS / clínica desde lógica Guía I certificada  

## Paleta

`src/lib/nom035/risk-palette.ts` — única fuente hex/ARGB para web + Excel + PNG.

## Endpoints

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/admin/nom035/reports/full` | `reports.generate` |
| GET | `/api/admin/nom035/reports/executive` | `reports.generate` |
| GET | `/api/admin/nom035/results/[id]/report` | `results.individual.read` |

READ-ONLY sobre workers/answers/results/campaña.
