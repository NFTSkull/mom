# B4.15.1 — Eliminar cambio obligatorio de contraseña

**Fecha UTC:** 2026-08-03  
**Veredicto:** **CAMBIO OBLIGATORIO ELIMINADO**

## Fuente del redirect

Únicamente `worker_accounts.must_change_password`:

| Archivo | Comportamiento |
|---|---|
| `src/app/trabajador/login/page.tsx` | `mustChangePassword` → `/trabajador/cambiar-contrasena` |
| `src/app/trabajador/page.tsx` | mismo flag vía `/api/trabajador/me` |
| `src/app/api/trabajador/evaluacion/open/route.ts` | bloquea con `must_change_password` |
| `src/app/trabajador/evaluacion/page.tsx` | redirige si API responde ese código |

No depende de `app_metadata` / `user_metadata` del worker.

## Datos

- Backup: off-repo `…-pre-b4151-must-change`
- Dry-run: 83 a actualizar, admins 0, sintéticos 0
- Filas actualizadas: **83**
- Segunda ejecución: **0**
- Passwords / usernames / auth_user_id: **sin cambios**

## Conteos finales

| Métrica | Valor |
|---|---:|
| Auth workers | 83 |
| worker_accounts activos | 83 |
| must_change_password=true | 0 |
| must_change_password=false | 83 |
| huérfanos / duplicados | 0 / 0 |
| admin modificado | no |

## Post-login

Destino: `/trabajador`  
Sin assignment → «No tienes una evaluación activa»  
Ruta `/trabajador/cambiar-contrasena` conservada (forzado admin).

## Confirmaciones

- Contraseñas no mostradas / no regeneradas
- Paquete cifrado intacto
- ConCasa intacto (`linked=false`)
- Campaña/assignments: no creados en este bloque
