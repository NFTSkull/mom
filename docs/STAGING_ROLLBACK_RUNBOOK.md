# Staging Rollback Runbook (frontend Preview)

## Alcance

Solo Vercel **Preview**. Prohibido Production.

## Deployments usados (B4.7)

| Rol | Deployment | ready |
|-----|------------|-------|
| A (RC) | `mom-r9v4rv87l-viozs-projects.vercel.app` | 200 live/ready/login |
| B | `mom-aysnzxp2n-viozs-projects.vercel.app` | 200 live/ready/login |
| Alias | `mom-git-release-nom035-staging-rc1-viozs-projects.vercel.app` | apunta a A tras prueba |

## Procedimiento verificado

```bash
npx vercel alias set <deployment-B> mom-git-release-nom035-staging-rc1-viozs-projects.vercel.app
# smoke alias: live/ready/login 200; /admin → 307 login
npx vercel alias set <deployment-A> mom-git-release-nom035-staging-rc1-viozs-projects.vercel.app
# smoke alias de nuevo
```

## Evidencia

- Alias → B: smoke OK (ready 200, no 503)
- Alias → A: smoke OK; alias restaurado al RC
- Sin cambios DB; sin Production

## No usar

Deployments con `ready=503` como rollback “aprobado”.
