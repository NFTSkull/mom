# Runbook — revocación de acceso

1. Admin desactiva perfil (`active=false`, `deactivated_at`).
2. La siguiente petición admin falla con 403 `account_disabled` aunque el JWT siga vigente.
3. Layout redirige a `/cuenta-deshabilitada`.
4. Cambio de rol: efecto inmediato vía `role_permissions` + perfil (no esperar nuevo JWT).
5. Logout: `POST /api/auth/logout` invalida sesión/cookies.
6. No borrar `audit_log` ni historial al desactivar.
