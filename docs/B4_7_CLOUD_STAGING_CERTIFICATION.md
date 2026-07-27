# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO** (Supabase staging migrado; falta Preview/E2E/Auth remoto y push Git del RC).

## Completado en esta fase

- Destino verificado: `nom035-staging` / `us-east-1` / `agbl…kubf`
- Wipe legado autorizado + respaldo fuera de Git
- Dry-run limpio + `db push` 001–005
- Verificación remota RLS/Storage/role_permissions
- ConCasa CRM intacto

## Pendiente / bloqueadores

1. Push de `release/nom035-staging-rc1` (PAT sin scope `workflow`)
2. Vercel Preview + variables (no iniciado — detención pedida)
3. Auth redirects / usuarios sintéticos / E2E remoto
4. Backup/restore formal post-NOM-035 + rollback frontend

## Confirmaciones

- Proyecto Supabase **no** eliminado
- Sin Production / sin merge a main / sin usuarios reales / sin Vercel deploy
- Sin secretos en docs
