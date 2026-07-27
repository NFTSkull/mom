# Runbook de despliegue Staging

1. Verificar rama `release/nom035-staging-rc1` y CI verde.
2. Confirmar proyecto Supabase nombre exacto `nom035-staging`.
3. `npx supabase link --project-ref <ref>` (password interactivo; no documentar).
4. Verificar vacío + `db push --dry-run`.
5. `db push` una sola vez.
6. Configurar Auth (signup off, TOTP on, redirects exactos).
7. Configurar variables **solo Preview** en Vercel.
8. Deploy Preview (nunca `--prod`).
9. Ajustar `NEXT_PUBLIC_APP_URL` + redirects Auth al URL Preview exacto.
10. Seed sintético + E2E staging + cleanup.

Rollback: `docs/STAGING_ROLLBACK_RUNBOOK.md`.
