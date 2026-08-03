# B4.12 — Cutover productivo, piloto E2E y certificación previa a las 83 cuentas reales

**Fecha UTC:** 2026-08-03
**Veredicto:** **PRODUCCIÓN BLOQUEADA**

## Resumen

Cutover técnico sobre `nom035-production` (`agbl…kubf`) con SHA certificado `42d7286aeb45f85a2816620ca5d736312640b413` (RC + WebKit success).
Migración `007` aplicada, deployment Production READY, piloto sintético I→III completado y limpiado a cero.
**No** se crearon las 83 cuentas reales ni se abrió campaña real.

## Bloqueadores P0 (impiden GO)

1. **Empresa no productiva** — `company_settings` con marca sintética de prueba; `total_trabajadores=1` (se requiere 83 reales).
2. **MFA admin ausente** — 1 admin activo; `mfa_required=false`; factores MFA verificados = 0.
3. **Assignments existentes en Guía I+II** — 167 filas `…-i-ii` y **0** `…-i-iii`; incorrecto para N=83.
4. **Backups administrados / PITR** — `pitr_enabled=false`, `backups=[]`. Solo dumps lógicos off-repo.

## Confirmaciones

- ConCasa intacto (`fvtq…vwzy`).
- CSV fuera de Git; passwords/tokens no impresos.
- Piloto `TST-PROD-PILOT-001` residue = 0.
- Secrets GitHub `STAGING_*` eliminados.
- `WORKERS_CSV_UNSET` tras dry-run.
- `assign-prod-worker-prueba.sql` inseguro: fuera del repo (off-repo unsafe).
- `activate-prod-worker-prueba.sql` eliminado del árbol (IDs/email hardcodeados; sin guarda de ref).

## Artefactos clave

| Ítem | Valor |
|---|---|
| SHA | `42d7286aeb45f85a2816620ca5d736312640b413` |
| RC run | `30774933712` |
| WebKit run | `30774933715` |
| Deploy | `dpl_Gzyr1sRrAHykdicFiGwTxc5G4RyC` |
| URL | `https://nom035-production.vercel.app` |
| Backup pre | off-repo `nom035-production-backups/*-pre-cutover-b412` |
| Backup post | off-repo `nom035-production-backups/*-post-cutover-b412` |

## Herramientas B4.12.1

Scripts versionados con `ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY` + refs esperada/confirmada:
`b412:pilot:seed|seed:dry-run|smoke|storage|cleanup`.

## Siguiente (antes de crear 83 cuentas)

1. Sustituir empresa sintética por razón social real + `total_trabajadores=83`.
2. Enroll MFA admin (AAL2) y `mfa_required=true`.
3. Plan de conversión/cierre de assignments I+II → I+III.
4. Plan Supabase con backups administrados/PITR recomendado.
