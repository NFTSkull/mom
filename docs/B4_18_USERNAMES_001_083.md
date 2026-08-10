# B4.18 — Usernames 001–083

**Veredicto:** **USERNAMES 001–083 ACTUALIZADOS CORRECTAMENTE**

## Arquitectura (auditada antes de escribir)

Login del trabajador:

1. UI `/trabajador/login` → `POST /api/trabajador/login` (Zod: `username` string trim, min 3).
2. `normalizeUsername` = `trim().toLowerCase()` — **sin** `Number` / `parseInt`.
3. RPC `admin_resolve_worker_login(p_username)` (service_role):
   - busca `worker_accounts.username_normalized`
   - fallback: `workers.external_reference`
   - fallback: `auth.users.email`
4. `signInWithPassword({ email: emailTécnico, password })`.
5. Identidad post-login: `auth.uid()` → `worker_accounts.auth_user_id` (no el username).

Email técnico: `empleado.<n>@workers.nom035.invalid` (histórico B4.14).  
**No se modificó** el email ni `auth_user_id`. El login no requiere username=email.

Mirror en `user_metadata.username` (legado): **no** usado para resolver login → no actualizado.

UNIQUE: `(company_id, username_normalized)`. Check: `^[a-z0-9][a-z0-9._-]*$` (acepta `001`).

## Mapping

Fuente de orden: mismo sort numérico de `external_reference` que B4.14 / lista de credenciales (no por nombre).

| Fila | Ejemplo |
|------|---------|
| 1 | `empleado.0003` → `001` |
| 2 | `empleado.0029` → `002` |
| 83 | `empleado.0688` → `083` |

Password: **sin cambios** = `NOM` + número canónico pad-4.

## Ejecución

- Dry-run PASS (colisiones 0, passwords/auth/worker/asg a modificar = 0).
- Backup off-repo SHA-256 `5cd38b50…f210e9`.
- Transacción 2 fases: `x.b418.*` → `001`–`083`.
- Paquete credenciales (no entregado): `~/Desktop/nom035-production-secrets/worker-credentials-b418/`.

## Smoke

| Username | Login×2 | must_change | Estado | Legado `empleado.*` |
|----------|---------|-------------|--------|---------------------|
| 001 | 200/200 | false | awaiting_campaign | 401 |
| 042 | 200/200 | false | awaiting_campaign | 401 |
| 083 | 200/200 | false | awaiting_campaign | 401 |
| 084 | 401 | — | — | — |

## Conteos finales

workers/Auth/WA=83; usernames únicos 001–083; legacy=0; must_false=83; asg=83; I/II/III=83/0/83; sesiones/respuestas/resultados=0/0/0; campaña=**draft**; ConCasa intacto.

## Política futura

Username de acceso ≠ número de empleado. No inventar el siguiente (`084`) sin política explícita. Helper `proposedUsername(empleado.*)` retirado.
