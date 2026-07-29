# Backup / Restore — NOM-035 Staging

**Proyecto autorizado:** `nom035-staging` (ref sanitizado `agbl…kubf`).
**Alcance de este runbook:** backup lógico verificado + restore de prueba aislado.
**Aviso obligatorio:** un dump CLI **no sustituye** los backups administrados de Supabase (daily / PITR según plan).

No incluir en dumps, manifests, commits ni chats: passwords DB, service keys, peppers, JWT, TOTP, signed URLs activas ni credenciales Auth en claro.

---

## 1. Alcance del backup lógico

### Incluido (schema `public` + archivo de roles)

| Artefacto | Descripción |
|-----------|-------------|
| `00-roles.sql` | Roles custom del dump CLI (`--role-only`) |
| `01-schema-public.sql` | DDL public: tablas, tipos, funciones/RPC, índices, triggers, grants, policies RLS |
| `02-data-public.sql` | Datos sintéticos public (`--data-only --use-copy --schema public`) |
| `MANIFEST.json` | Fecha UTC, CLI version, ref sanitizado, tamaños, SHA-256 |
| `SOURCE_COUNTS.json` | Conteos origen al momento del dump |
| `RESTORE_VERIFICATION.json` | Resultado del restore aislado |
| `STORAGE_MANIFEST.json` | Hash/MIME/privacidad de objeto ficticio (sin URL firmada) |

### No incluido (documentar y restaurar por canal aparte)

- Usuarios Auth / factores MFA / sesiones / refresh tokens
- Secretos del proyecto (API keys, peppers, JWT)
- Objetos físicos de Storage (solo metadata en `evidence_items` si aplica)
- Configuración Dashboard (Auth providers, SMTP, etc.)
- Backups físicos administrados / PITR de Supabase

---

## 2. Precondiciones

1. Rama de trabajo `release/**` (nunca Production / `main` para esta certificación).
2. Proyecto enlazado = `nom035-staging` (`supabase/.temp/project-ref` = `.tmp/staging-project-ref.txt`).
3. El script **debe abortar** si detecta ConCasa, production u otro ref.
4. Variable de entorno `SUPABASE_DB_PASSWORD` presente (nunca echo / printenv).
5. Datos sintéticos `STAGING_TEST` sembrados (`npm run staging:seed:fixtures`) o inventario limpio documentado.
6. Carpeta de salida **fuera del repo**: `~/Desktop/nom035-staging-backup-verified/` (modo `0700`).

---

## 3. Procedimiento de dump

```bash
cd /path/to/Mom
# Confirmar enlace staging (ref sanitizado en logs)
test "$(cat supabase/.temp/project-ref)" = "$(cat .tmp/staging-project-ref.txt)"

# Password solo en entorno (no en historial con -p en línea de comando)
export SUPABASE_DB_PASSWORD='…'   # interactivo / keychain / rotación Dashboard
npm run staging:seed:fixtures     # si hace falta inventario sintético
node scripts/staging-backup-dump.mjs
unset SUPABASE_DB_PASSWORD
```

Equivalente CLI (misma política de secretos):

```bash
npx supabase db dump --linked --role-only -f ~/Desktop/nom035-staging-backup-verified/00-roles.sql
npx supabase db dump --linked --schema public -f ~/Desktop/nom035-staging-backup-verified/01-schema-public.sql
npx supabase db dump --linked --data-only --use-copy --schema public \
  -f ~/Desktop/nom035-staging-backup-verified/02-data-public.sql
```

Generar SHA-256 y tamaños en `MANIFEST.json` (el script lo hace).

---

## 4. Procedimiento de restore (verificación real)

**Entorno de prueba:** base PostgreSQL aislada `nom035_restore_verify` en el Postgres de **Supabase local** (limpia, no es el trabajo diario de `postgres`).

```bash
npx supabase start   # si no está arriba
# SOURCE_COUNTS.json debe existir (conteos del origen)
node scripts/staging-backup-restore-verify.mjs
```

El script:

1. Crea DB limpia `nom035_restore_verify`.
2. Prepara schemas `extensions` / stub mínimo `auth.users` (solo para FKs; Auth real no se restaura).
3. Aplica `01-schema-public.sql` y `02-data-public.sql`.
4. Verifica conteos vs origen, FKs, constraints, RLS (+ FORCE RLS), funciones/RPC.
5. Elimina la DB aislada salvo `VERIFY_KEEP=1`.

**No declarar “backup OK” solo porque el dump se creó.**

---

## 5. Verificación de conteos / constraints / RLS

Checklist mínimo post-restore:

- [ ] `company_settings` = 1 y razón social con marcador `STAGING_TEST`
- [ ] `workers`, `evaluation_campaigns`, `evaluation_assignments` > 0
- [ ] `evaluation_results` / sesiones / planes / quejas / evidencia / política según origen
- [ ] Conteos restaurados **iguales** a `SOURCE_COUNTS.json`
- [ ] Foreign keys presentes; constraints > 0
- [ ] RLS habilitado y FORCE RLS en tablas public sensibles
- [ ] Funciones/RPC public presentes (orden de magnitud ≥ 50 en este esquema)

---

## 6. Storage (bucket privado `nom035-evidence`)

```bash
node scripts/staging-storage-backup-verify.mjs
```

Verifica:

1. Upload de PDF 100 % ficticio bajo prefijo `STAGING_TEST/…`
2. Acceso anónimo directo denegado
3. Signed URL funcional (TTL corto; **no** se persiste la URL)
4. SHA-256 descarga = original
5. Re-carga de recuperación (“restore”) con mismo hash
6. Eliminación de objetos de prueba

Manifest: `STORAGE_MANIFEST.json` (bucket, path sanitizado, MIME, bytes, sha256, flags de privacidad).

---

## 7. Auth y configuración del proyecto

| Elemento | Canal de recuperación |
|----------|------------------------|
| Usuarios admin / MFA | Re-seed sintético (`staging:seed:auth`) o Dashboard Auth — **no** vía dump public |
| Peppers / API keys | Secret manager / Vercel env / rotación |
| Storage files | Export/import de objetos + metadata DB |
| Backups administrados | Dashboard Supabase → Database → Backups / PITR |

---

## 8. Rotación de credenciales

Tras dump/certificación:

1. `unset SUPABASE_DB_PASSWORD` en el shell.
2. Si la password DB se rotó para el dump, **resetear** de nuevo en Dashboard (Database → Settings) y actualizar solo almacenes autorizados.
3. No dejar password en archivos del Desktop sin cifrado.
4. Rotar PAT temporales usados para push/API al cerrar el bloque.

---

## 9. Frecuencia sugerida / responsables / RTO·RPO

| Tema | Estado |
|------|--------|
| Frecuencia dump lógico off-site | Sugerida: semanal + antes de RC; **pendiente aprobación negocio** |
| Responsable operativo | Equipo NOM-035 / DevOps del proyecto Mom |
| Responsable de verificación restore | Quien firme la certificación del RC |
| RTO | **Pendiente aprobación del negocio** |
| RPO | **Pendiente aprobación del negocio** |

---

## 10. Procedimiento de emergencia

1. Confirmar incidente (pérdida lógica staging, corrupción, borrado).
2. **No** restaurar sobre Production ni ConCasa.
3. Preferir restore administrado Supabase (PITR/backup diario) si el plan lo permite.
4. Si solo hay dump lógico: crear proyecto/base temporal `*-restore`, aplicar roles → schema → data, validar conteos/RLS, luego cutover controlado.
5. Rehidratar Auth/Storage/secretos por canales de la §7.
6. Auditar `audit_log` y accesos; rotar secretos expuestos.
7. Documentar en DEVLOG el incidente y la evidencia de verificación.

---

## 11. Cleanup

Después de la prueba:

```bash
npm run staging:cleanup:fixtures
npm run staging:cleanup:auth
unset SUPABASE_DB_PASSWORD
# dumps: cifrar o eliminar según política; nunca commit a Git
```

Confirmar: cero usuarios/fixtures sintéticos huérfanos si ya no se necesitan; cero PII real; `SUPABASE_DB_PASSWORD_UNSET`.

---

## 12. Scripts del repositorio

| Script | Uso |
|--------|-----|
| `scripts/staging-backup-dump.mjs` | Dump roles + public schema/data + manifest |
| `scripts/staging-backup-restore-verify.mjs` | Restore aislado + verificación |
| `scripts/staging-storage-backup-verify.mjs` | Manifest Storage + privacidad + hash |

NPM (opcionales): `staging:backup:dump`, `staging:backup:restore-verify`, `staging:backup:storage-verify`.
