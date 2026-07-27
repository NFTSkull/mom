# B4.5 — Certificación módulos secundarios + Storage privado

## Veredicto

**CERTIFICADO** (local / Supabase local). No producción: falta Auth/RBAC y Cloud.

## Regresión final (2026-07-27)

| Check | Resultado |
|---|---|
| npm audit / audit prod | 0 / 0 |
| lint / typecheck / build | 0 |
| Vitest | 184/184 |
| pgTAP | 481/481 |
| db:reset ×2 | 0 |
| bucket tras resets | `nom035-evidence` privado, 15 MB |
| Playwright total | 31/31 (B4.3+B4.4+B4.5) |
| Fuente SHA-256 | intacta |
| scoringVersion | `nom035-stps-2018-guia-i-ii-v1` |
| ACTIVE_REPOSITORY_MODE | `local` |

## Alcance migrado

- `/admin/plan-accion`
- `/admin/evidencias`
- `/admin/quejas`
- `/admin/politica`
- `/queja-confidencial`
- Conteos secundarios en `/admin` y sección agregada en `/admin/reportes`

## Evidencias de certificación

| Criterio | Resultado |
|---|---|
| Plan central + sugeridas idempotentes | OK |
| Evidencias en bucket privado + magic bytes | OK |
| Signed download temporal | OK |
| Compensación / soft delete / cleanup | OK |
| Queja pública central + rate limit + doble envío | OK |
| Contacto solo en detalle | OK |
| Política versionada (una publicada) | OK |
| Dashboard central coherente | OK |
| Dos navegadores sin localStorage | OK |
| Admin bloqueado fuera de local / Origin | OK |
| Sin secretos en cliente | OK |
| pgTAP ≥ 378 | OK (481 con 007) |
| Vitest ≥ 149 | OK (184) |
| Playwright B4.5 | OK (15/15) |
| npm audit 0 | Ver regresión final |
| Fuente / scoring / repository mode | Intactos |

## Artefactos

- Migración `004_secondary_modules_and_storage.sql`
- pgTAP `007_secondary_modules_and_storage.test.sql`
- Servicios server-only: action-plan / evidence* / complaint / policy
- E2E `e2e/secondary-modules.spec.ts`
- Docs: ACTION_PLAN_API, EVIDENCE_STORAGE_SECURITY, COMPLAINTS_PRIVACY_MODEL, POLICY_VERSIONING

## Riesgos residuales (P0/P1)

- P0 producción: sin Auth/RBAC el panel no debe abrirse fuera de loopback (guard activo).
- P1: retención/purge de evidencias soft-deleted; jobs de cleanup pendiente.
- P1: confirmationCode no consulta la queja en este bloque (intencional).

## Confirmaciones

- Sin Supabase remoto / link / db push / deploy / commit / push
- Sin login / usuarios reales / Guía III / cambio de scoring / repository mode
