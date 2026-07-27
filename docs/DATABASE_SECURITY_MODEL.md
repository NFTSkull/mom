# Modelo de seguridad de base de datos — NOM-035

**Estado B4.6:** migraciones locales 001–005 aplicadas. Bucket `nom035-evidence` privado. Sin remoto/link/push.
Panel admin: Auth + RBAC (`role_permissions`) + MFA. Operaciones ordinarias vía cliente `authenticated` + `require_admin_permission`.
`service_role` solo: invitación Auth, Storage admin, evaluación/queja pública, seed/cleanup.

## Principios

1. **Defensa en profundidad:** permisos SQL (`REVOKE`) + RLS habilitado y forzado + sin políticas permisivas para `anon`.
2. **Secretos solo en servidor:** `SUPABASE_SECRET_KEY` y peppers nunca usan prefijo `NEXT_PUBLIC_`.
3. **Una empresa:** `company_settings.singleton_lock` con `UNIQUE` garantiza una sola fila de configuración.
4. **Token opaco:** el trabajador recibe un token aleatorio; la base solo guarda `token_hash` y `token_last4`.
5. **Una campaña active:** índice único parcial `uq_evaluation_campaigns_one_active`.

## Por qué `anon` no tiene acceso directo

En este bloque:

- RLS está `ENABLE` + `FORCE` en todas las tablas del dominio.
- Se hace `REVOKE ALL` a `anon` y `authenticated` sobre tablas sensibles.
- **No** existen políticas `FOR anon` ni políticas abiertas tipo `USING (true)`.
- RPCs admin ordinarias: `REVOKE` de `PUBLIC`/`anon`; `GRANT EXECUTE` a `authenticated` (y `service_role` excepcional); autorización interna con `require_admin_permission` / AAL2 / sensitive.
- Tablas: sin GRANTs DML a `anon`/`authenticated`; RLS FORCE.

Resultado: aunque alguien use la publishable key desde el navegador contra el Data API, **no obtiene filas** de workers, answers, results o complaints.

Las operaciones admin ordinarias usan el cliente SSR autenticado (JWT del usuario). `SUPABASE_SECRET_KEY` no se expone al browser.

## Por qué no se almacena el token real

| Campo | Uso |
|---|---|
| Token en URL (solo en tránsito / mensaje al trabajador) | Valor aleatorio criptográfico |
| `token_hash` | Único; comparación server-side |
| `token_last4` | Soporte operativo sin exponer el secreto |

Detalle admin: `docs/ADMIN_CORE_LOCAL_SECURITY.md`.

Si la base se filtra, el atacante **no** puede reconstruir enlaces válidos a partir del hash (asumiendo pepper + hash fuerte).

## Cómo se verificará el hash del token (bloque futuro)

1. Route Handler recibe el token en claro del path/body.
2. Calcula `hash = HMAC-SHA256(token, NOM035_TOKEN_PEPPER)` (o equivalente).
3. Busca `evaluation_assignments` por `token_hash` con cliente admin.
4. Valida `status`, `expires_at`, campaña activa.
5. Nunca loguea el token completo ni el pepper.

## Cómo se evitará el segundo envío

En schema:

- `assignment_status` incluye `completed` y `revoked`.
- `evaluation_results.assignment_id` es **UNIQUE** (un solo resultado).

En aplicación (bloque futuro de API):

- Si `status = completed`, rechazar nuevos writes de respuestas.
- Transacción: insert answers → insert result → update assignment a `completed`.
- No reutilizar el mismo token tras `revoked`/`completed`.

## Cómo se protegerán resultados y quejas

| Recurso | Protección B4.0 | Protección post-Auth |
|---|---|---|
| `evaluation_results` | Sin grants a anon/authenticated; RLS force | Políticas por `admin_profiles.role` |
| `evaluation_answers` | Igual | Solo roles autorizados; preferir agregados en UI |
| `confidential_complaints` | Igual | Lectura limitada a roles con `can_view_sensitive_cases` |
| `audit_log` | Igual; `metadata` sin respuestas completas | Append-only para acciones admin |

## Acceso por rol (cuando se implemente Auth)

| Rol | Alcance previsto |
|---|---|
| `admin` | Configuración, trabajadores, campañas, evidencias, políticas, plan de acción; resultados agregados; quejas si `can_view_sensitive_cases` |
| `rh` | Trabajadores, campañas, evidencias, plan de acción, reportes agregados |
| `psicologo` | Resultados/alertas clínicas y quejas sensibles **solo** si `can_view_sensitive_cases = true` |
| `direccion` | Reportes agregados, política, plan de acción; sin PII clínica salvo flag explícito |

El trabajador **nunca** tendrá rol en `admin_profiles` y **nunca** leerá tablas sensibles vía cliente browser.

## Flujo público por token (próximos bloques)

```
Trabajador → Route Handler Next.js → createSupabaseAdminClient()
         → verifica hash / estado → lee/escribe assignment+answers+results
Admin UI → Auth (futuro) → createSupabaseServerClient() + RLS por rol
```

## Qué NO hace B4.0

- No aplica SQL remoto.
- No crea usuarios Auth.
- No crea políticas administrativas.
- (B4.5 sí migra pantallas secundarias y crea bucket Storage privado.)

## Addendum B4.5 — módulos secundarios + Storage

- Bucket `nom035-evidence`: `public=false`, MIME/size limitados, sin policies anon.
- RPCs `admin_*` / `public_submit_confidential_complaint`: EXECUTE solo `service_role`.
- Compensación Storage↔DB y soft delete documentados en `EVIDENCE_STORAGE_SECURITY.md`.

## Addendum B4.3 — evaluación pública

Tablas nuevas (`evaluation_drafts`, `evaluation_sessions`, `public_rate_limits`):
RLS ENABLE + FORCE, sin políticas, `REVOKE` a anon/authenticated/PUBLIC.

Funciones públicas internas (`exchange_evaluation_token`, `submit_public_evaluation`,
etc.): `SECURITY DEFINER`, `search_path=public`, `EXECUTE` solo a `service_role`.

GRANTs DML a `service_role` limitados a tablas de configuración
(`company_settings`, `workers`, `evaluation_campaigns`, `evaluation_assignments`).
`answers` / `results` / `drafts` / `sessions` / `rate_limits` no reciben GRANT
directo: solo vía RPC.

Transiciones monótonas de assignment forzadas por trigger
`enforce_assignment_transition` (completed/revoked irreversibles).
