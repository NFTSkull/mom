# B4.21 — Resultados individuales sin MFA/AAL2

**Veredicto:** **RESULTADOS VISIBLES SIN VERIFICACIÓN EN 2 PASOS**

## Cambio

| Permiso | Antes | Después |
|---------|-------|---------|
| `results.individual.read` | AAL2 + sensitive | **solo** sensitive |
| `results.answers.read` | AAL2 + sensitive | **solo** sensitive |
| `results.clinical.read` | AAL2 + sensitive | **solo** sensitive |

## Intactos (siguen AAL2)

- quejas (`complaints.*`)
- `users.manage`
- `evidence.download`
- `assignments.rotate` / `revoke`
- `policies.publish`

## Artefactos

- `supabase/migrations/011_results_without_aal2.sql`
- `src/lib/nom035/auth/permissions.ts`
- tests Vitest B4.21 + DB 008
