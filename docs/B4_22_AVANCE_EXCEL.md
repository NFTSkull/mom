# B4.22 — Export Excel de avance NOM-035

**Veredicto:** **EXPORT EXCEL DE AVANCE NOM-035 LISTO** (tras QA verde)

## Qué es

Reporte operativo de seguimiento: quién ya **completó** la evaluación y quién **no**.

## Qué no es

No incluye respuestas, scores, riesgo, categorías, dominios ni datos clínicos.

## Endpoint

`GET /api/admin/nom035/campaigns/avance-excel` · permiso `dashboard.view` · sin AAL2.

## Archivo

`avance-nom035-2026.xlsx` · hoja `Avance NOM035` · `Nombre | Usuario | Respondió`.

## Regla Respondió

- **Sí** → assignment `completed`
- **No** → pending / in_progress / draft / cualquier no-completed
