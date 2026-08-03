# B4.13 — Flujo productivo mínimo (83 trabajadores)

**Fecha UTC:** 2026-08-03  
**Veredicto:** **FLUJO DE 83 TRABAJADORES LISTO**

No se crearon las 83 cuentas Auth. No se generaron contraseñas. No se abrió campaña.

## 1. Empresa (`company_settings`)

### Campos obligatorios reales (NOT NULL)

| Campo | Valor aplicado |
|---|---|
| `razon_social` | `NOM035_EMPRESA_OPERATIVA` (identificador interno) |
| `total_trabajadores` | `83` |
| `singleton_lock` | (técnico, sin cambio) |

### Campos opcionales dejados en NULL

- `rfc`
- `domicilio`
- `telefono`
- `actividad_principal`
- `responsable_nombre`
- `responsable_email`
- `responsable_telefono`

Ninguna columna opcional se rellenó con datos ficticios.  
No hay formulario empresarial para trabajadores.

## 2. Login trabajador

`/trabajador/login` muestra únicamente:

- Usuario
- Contraseña
- Botón «Iniciar sesión»

Identidad post-login: `auth.getUser()` → `worker_accounts.auth_user_id` → `workers` → assignment.  
El navegador no envía `worker_id` como fuente de autoridad.

## 3. Legacy

| Acción | Resultado |
|---|---:|
| Assignments sin actividad eliminados | 165 |
| Assignments con draft revocados (`legacy_i_ii_preserved_draft`) | 2 |
| Drafts preservados | 2 |
| Sesiones legacy revocadas | 3 |
| Assignments activos (pending/in_progress/completed) | 0 |
| Campañas activas | 0 |
| Guía II activa para los 83 | 0 |

Worker/account sintético: `activo=false` / `is_active=false`; historial conservado; fuera de conteo de 83.

## 4. Dry-run final cuentas (sin escritura)

| Métrica | Valor |
|---|---:|
| workers existentes | 83 |
| workers a crear | 0 |
| Auth users a crear | 83 |
| worker_accounts a crear | 83 |
| usernames únicos | 83 (`empleado.<n>`) |
| colisiones | 0 |
| assignments nuevos | 83 |
| Guía I | 83 |
| Guía III | 83 |
| Guía II | 0 |
| campos adicionales al trabajador | 0 |
| passwords generadas | 0 |

## 5. Backups

| Tipo | Estado |
|---|---|
| Backup lógico | Disponible (pre-saneamiento + pre-execute) |
| PITR | No disponible |
| Backups administrados Supabase | No disponibles (`backups=[]`) |

La aceptación del riesgo PITR es operativa e independiente del flujo de trabajadores.

## 6. MFA

- Trabajadores: sin MFA (usuario + contraseña).
- Admin: MFA pendiente (no bloquea preparación de las 83 cuentas).

## 7. Bloqueos técnicos restantes (no bloquean el veredicto de flujo)

1. Crear las 83 Auth + worker_accounts + assignments I+III (aún no ejecutado a propósito).
2. Abrir campaña productiva (aún no).
3. MFA admin para panel sensible.
4. PITR / backups administrados (riesgo aceptado o pendiente por operación).

## 8. Herramienta

```bash
# Dry-run (default)
ALLOW_PRODUCTION_SANITIZE=B413_LEGACY_ONLY NOM035_TARGET_ENV=production \
EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
npm run b413:sanitize:dry-run

# Ejecutar (ya aplicado en esta fase)
… B413_EXECUTE=1 npm run b413:sanitize:execute
```
