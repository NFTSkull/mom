# B4.22 — Export Excel de avance NOM-035

**Veredicto:** **EXPORT EXCEL DE AVANCE NOM-035 LISTO**

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

## Smoke Production (2026-08-20)

| Métrica | Valor |
|---------|-------|
| Filas | **83** |
| Respondió Sí | **58** |
| Respondió No | **25** (24 pending + 1 in_progress) |
| Username range | 001–083 |
| Endpoint sin sesión | **401** |
| Deploy | `b864375` en https://nom035-production.vercel.app |
| ConCasa | intacto |
