# Action Plan API (B4.5)

## Endpoints (admin, local-only)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/nom035/action-plans` | Listado paginado + filtros |
| POST | `/api/admin/nom035/action-plans` | Alta manual |
| PUT | `/api/admin/nom035/action-plans/[id]` | Edición |
| POST | `/api/admin/nom035/action-plans/[id]/status` | Cambio de estado |
| POST | `/api/admin/nom035/action-plans/[id]/archive` | Archivo histórico |
| POST | `/api/admin/nom035/action-plans/generate` | Sugeridas desde resultados centrales |
| GET | `/api/admin/nom035/action-plans/summary` | Resumen agregado |

## Generación sugerida

1. El servicio Next construye el mapa dominio → plantilla.
2. La RPC `admin_generate_suggested_action_plans` agrega riesgos desde `evaluation_results` (sin nombres).
3. Persistencia idempotente por `source_key` (`domain:<nombre>`, `guia_i_followup`).
4. Respuesta: `created`, `existing`, `skipped`, `summary`.

## Transiciones

Permitidas: pendiente→en_proceso|completada|cancelada; en_proceso→completada|cancelada.
Bloqueadas: regresiones desde completada/cancelada (trigger + RPC).
