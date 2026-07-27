# Rollback Staging

## A) Frontend (Vercel Preview)

1. Identificar deployment RC.
2. Promover/reactivar el deployment anterior de la misma rama Preview.
3. Smoke: `/api/health/live`, login, evaluación pública.
4. Confirmar commit esperado.

Simulacro obligatorio en B4.7: RC → deploy controlado → volver a RC.

## B) Base de datos

- Preferir migración **forward-fix**.
- No down destructivo improvisado.
- Restaurar dump solo ante corrupción.
- Criterio de parar tráfico: datos inconsistentes o Auth rota.

## C) Auth

- Desactivar usuarios sintéticos.
- Revocar sesiones.
- Rotar secretos si hubo exposición.

## D) Storage

- Inventariar objetos staging.
- Soft-delete / cleanup seguro.
- Preservar historial de evidencia cuando aplique.
