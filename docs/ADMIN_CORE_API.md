# API administrativa central NOM-035 (B4.4 + B4.6)

## Alcance

Endpoints bajo `/api/admin/nom035/*` para el panel conectado a Supabase local.

**B4.6:** `NOM035_ADMIN_BACKEND_MODE=auth_rbac`. Cada endpoint declara permiso en `endpoint-permissions.ts` y exige Auth + perfil activo (+ AAL2 cuando corresponda). Origin validado en mutaciones.

## Guard

Ver `docs/AUTH_SECURITY_MODEL.md`. El guard loopback de B4.4 (`ADMIN_CORE_LOCAL_SECURITY.md`) quedó supersedido.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dashboard` | Resumen agregado |
| GET/PUT | `/company` | Singleton company_settings |
| GET/POST | `/workers` | Listar / crear |
| PUT/DELETE | `/workers/[id]` | Actualizar / eliminar (sin historial) |
| POST | `/workers/[id]/deactivate` | Desactivar + revocar sesiones |
| POST | `/workers/[id]/reactivate` | Reactivar |
| POST | `/workers/import/validate` | Preview CSV |
| POST | `/workers/import/commit` | Import atómico (máx. 500) |
| GET/POST | `/campaigns` | Listar / crear draft |
| PUT | `/campaigns/[id]` | Editar (no closed) |
| POST | `/campaigns/[id]/activate` | Activar (rechaza si hay otra active) |
| POST | `/campaigns/[id]/close` | Cerrar |
| GET | `/campaigns/[id]/assignments` | Assignments paginados |
| POST | `/campaigns/[id]/assignments/issue` | Emitir un enlace (token one-time) |
| POST | `/campaigns/[id]/assignments/issue-missing` | Emitir faltantes (batch) |
| POST | `/assignments/[id]/rotate-token` | Regenerar (pending/in_progress) |
| POST | `/assignments/[id]/revoke` | Revocar + eliminar draft |
| GET | `/results` | Lista paginada (sin respuestas) |
| GET | `/results/[id]` | Detalle con respuestas (solo local) |
| GET | `/reports/summary` | Agregados + `report.generated` |

## Contrato de error

```json
{
  "ok": false,
  "code": "string",
  "message": "string",
  "requestId": "uuid",
  "fieldErrors": {}
}
```

## Tokens

- El token real se genera en Next (`evaluation-token`) y se devuelve **una sola vez**.
- DB solo guarda `token_hash` + `token_last4`.
- Tras recargar la UI: “Enlace no recuperable” + regenerar.

## Paginación

`page` ≥ 1, `pageSize` 1..100.

## Validación

Zod `.strict()` en mutaciones. No se aceptan `finalScore`, `token`, `answers` ni `scoringVersion` del cliente en altas de trabajadores.
