# Evidence Storage Security (B4.5)

## Bucket

- Nombre: `nom035-evidence` (configurable vía `NOM035_EVIDENCE_BUCKET`)
- `public = false`
- `file_size_limit = 15728640` (15 MB)
- MIME: `application/pdf`, `image/jpeg`, `image/png`
- Sin políticas públicas en `storage.objects`
- Acceso Storage: cliente admin server-only (`service_role`) solo tras `requirePermission` en Route Handler
- Descarga firmada: `evidence.download` + AAL2; URL no cacheable / no compartida entre usuarios
- Listado/lectura: `evidence.read`; escritura: `evidence.write`

## Validación de archivo

Antes de subir:

- tamaño 1..15 MB (env)
- MIME declarado permitido
- extensión coherente
- magic bytes (PDF `%PDF-`, JPEG `FF D8 FF`, PNG firma 8 bytes)
- nombre seguro (sin traversal, sin doble extensión peligrosa)
- SHA-256 del contenido

Path generado solo en servidor:

`company/evidence/YYYY/MM/<uuid>/<safe-name>`

## Compensación Storage ↔ DB

**Upload / replace**

1. Validar
2. Subir objeto (path nuevo; nunca overwrite)
3. Insertar metadata vía RPC
4. Si falla metadata → eliminar objeto subido
5. Si falla limpieza → error `orphan_cleanup_failed` (no silencioso)

**Delete**

1. Soft delete (`deleted_at`)
2. Intentar borrar objeto
3. Éxito → `storage_delete_pending=false`
4. Fallo → `storage_delete_pending=true` + reintento admin

## Descargas

- Endpoint admin genera signed URL (30–300 s, default 120)
- No se persiste la URL en DB ni en `audit_log`
- `Cache-Control: no-store`
- URL directa al objeto sin firma debe fallar
