# B4.3 — Certificación de evaluación pública por token

**Veredicto: CERTIFICADO**

Fecha: 2026-07-24

## Objetivo alcanzado

Flujo extremo a extremo local:

1. Emisión de enlace criptográfico (`ev_` + 32 bytes).
2. Intercambio por sesión HttpOnly (`SameSite=Strict`).
3. Token retirado de la URL.
4. Draft central recuperable.
5. Cálculo **solo servidor** con motor certificado `nom035-stps-2018-guia-i-ii-v1`.
6. Submit atómico: answers + result + completed + draft borrado + sesiones revocadas.
7. Trabajador sin scores.
8. Playwright real 10/10.

## Estado inicial (guardas)

- Fuente oficial: 220837 bytes / SHA-256 `8d5c2c63…d7a76`
- B4.1 CERTIFICADO · B4.2.1 CERTIFICADO
- Baseline pre-cambio: audit 0/0, lint 0, typecheck 0, Vitest 99/99, pgTAP 170/170, build 0
- Repository mode general: `local`
- Sin link remoto Supabase

## Migración 002

Archivo: `supabase/migrations/002_public_evaluation_backend.sql`

| Elemento | Estado |
|----------|--------|
| `evaluation_assignments.questionnaire_version` | OK |
| `evaluation_results.submission_id` UNIQUE NOT NULL | OK |
| `evaluation_results.validation_warnings` | OK |
| `evaluation_drafts` | OK + RLS/FORCE |
| `evaluation_sessions` + 1 activa | OK + RLS/FORCE |
| `public_rate_limits` | OK + RLS/FORCE |
| Trigger `enforce_assignment_transition` | OK |
| RPCs atómicas SECURITY DEFINER | OK (EXECUTE solo service_role) |

## Pruebas

| Suite | Resultado |
|-------|-----------|
| pgTAP (001–005) | **247/247** PASS |
| Vitest | **118/118** PASS |
| Playwright Chromium | **10/10** PASS |
| lint / typecheck / build | PASS |
| npm audit completo | **0** vulnerabilidades |
| npm audit producción | **0** vulnerabilidades |
| db reset × 2 | PASS |
| db:types | PASS (tablas + RPCs) |

### Casos Playwright

1. Flujo completo + DB  
2. Recuperación de draft  
3. Móvil sin overflow  
4. Gate clientes=No (41–43 ausentes)  
5. Gate jefe=No (44–46 ausentes)  
6. Doble clic → 1 resultado  
7. Refresh post-completado  
8. Token inválido  
9. Token vencido  
10. Sesión sustituida  

## Seguridad

- Score manipulado (`finalScore:999`) → ignorado; persistido `64` (servidor)
- Cookie HttpOnly verificada por curl
- Origin inválido → 403
- Content-Type inválido → 400
- `ACTIVE_REPOSITORY_MODE` = `local`
- scoringVersion inalterado
- Fuente canónica inalterada

## Variables (sin valores)

`NOM035_PUBLIC_EVALUATION_BACKEND`, `NOM035_TOKEN_PEPPER`, `NOM035_SESSION_PEPPER`, `NOM035_RATE_LIMIT_PEPPER`, `NOM035_EVALUATION_SESSION_MINUTES` (=120), `NEXT_PUBLIC_APP_URL`

## Limitaciones / no alcance

- Panel administrativo central: no migrado
- Auth / usuarios / roles: no
- Guía III: no
- Supabase remoto / link / db push: no
- Repository mode general: sigue `local` (el flujo público usa backend supabase **aparte**)

## Confirmaciones

- sin Supabase remoto · sin link · sin db push  
- sin usuarios · sin Auth · sin panel admin central  
- sin cambio de `ACTIVE_REPOSITORY_MODE`  
- sin cambios al scoring certificado · sin Guía III  
- sin deploy · sin commit · sin push  
