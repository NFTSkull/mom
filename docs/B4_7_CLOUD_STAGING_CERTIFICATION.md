# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO**

Motivo: falta evidencia CI del SHA final con job WebKit staging en verde (y secrets Actions configurados). Backup/restore lógico + Storage ya verificados off-site.

## Completado

- SHA base previo `d727691`; CI `30470463127` quality/security/database/e2e success
- Preview RC live/ready/login 200; CSP + framing; rollback A↔B OK
- E2E staging Chromium+Firefox 42/42
- **Backup lógico** en `~/Desktop/nom035-staging-backup-verified/` (roles + schema/data public + MANIFEST SHA-256)
- **Restore real** en DB aislada local: conteos 1:1, 213 constraints, 24 FK, RLS+FORCE 16, 101 RPC/funciones
- **Storage**: manifest + anon denegado + signed URL + hash restore; objetos de prueba eliminados
- Workflow WebKit Linux x64 + `prefetch={false}` admin (mitiga pageerror Safari/WebKit)

## Pendiente cierre CERTIFICADO

1. Push SHA con workflow + fix prefetch
2. Secrets GitHub Actions staging configurados
3. Job `webkit-staging` success en el mismo SHA que quality/security/database/e2e
4. Cleanup final + `SUPABASE_DB_PASSWORD_UNSET` + reset password Dashboard si se rotó

## Confirmaciones

- `main` intacto `b037cad…`
- Tag no empujado
- ConCasa / Production / dominio final no tocados
- Sin usuarios ni datos reales
