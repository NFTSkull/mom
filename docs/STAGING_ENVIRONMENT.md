# Entorno Staging NOM-035

## Identidad

- Proyecto Supabase: **`nom035-staging`** (exclusivo).
- App: Vercel **Preview** (nunca Production en B4.7).
- Rama Git: `release/nom035-staging-rc1`.

## Prohibido

- `ConCasa CRM`
- Cualquier proyecto que no se llame exactamente `nom035-staging`
- Producción, dominio final, usuarios reales, datos reales

## Variables (nombres, sin valores)

Públicas Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Privadas Preview:

- `SUPABASE_SECRET_KEY`
- `NOM035_TOKEN_PEPPER`
- `NOM035_SESSION_PEPPER`
- `NOM035_RATE_LIMIT_PEPPER`
- `NOM035_ADMIN_BACKEND_MODE=auth_rbac`
- `NOM035_PUBLIC_EVALUATION_BACKEND`
- `NOM035_PUBLIC_COMPLAINT_BACKEND`
- `NOM035_EVIDENCE_BUCKET`
- peppers **nuevos** solo staging (no reutilizar local ni futura prod)

Archivos locales ignorados:

- `.env.staging.local`
- `.tmp/staging-project-ref.txt`
- `.tmp/staging-auth-credentials.json`

## Comandos seguros

```bash
npm run staging:seed:auth
npm run staging:cleanup:auth
npm run test:e2e:staging
```

Scripts fallan cerrado si el project ref no coincide con el verificado.
