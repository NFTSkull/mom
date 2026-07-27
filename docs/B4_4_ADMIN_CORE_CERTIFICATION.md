# B4.4 — Certificación panel administrativo central

## Veredicto

**CERTIFICADO**

Fecha: 2026-07-24

## Objetivo cumplido

Migración de `/admin`, `/admin/configuracion`, `/admin/trabajadores`, `/admin/campanas`, `/admin/resultados` y `/admin/reportes` desde localStorage a Supabase local, con guard local-only y sin Auth.

## Intactos

| Ítem | Estado |
|------|--------|
| B4.1 | CERTIFICADO |
| B4.2.1 | CERTIFICADO |
| B4.3 | CERTIFICADO |
| Fuente | 220837 bytes |
| SHA-256 | `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76` |
| scoringVersion | `nom035-stps-2018-guia-i-ii-v1` |
| ACTIVE_REPOSITORY_MODE | `local` |

## Evidencia de regresión

| Check | Resultado |
|-------|-----------|
| npm audit | 0 |
| npm audit --omit=dev | 0 |
| lint | 0 |
| typecheck | 0 |
| Vitest | 149/149 (≥118) |
| pgTAP | 378/378 (≥247) |
| build | 0 |
| db:reset ×2 | 0 |
| db:types | 0 |
| Playwright B4.3 | 10/10 |
| Playwright B4.4 | 6/6 |
| Playwright total | 16/16 |

## Entregables

- `supabase/migrations/003_admin_core_backend.sql`
- `supabase/tests/database/006_admin_core_backend.test.sql`
- Guard `admin-access-guard.ts` + banner permanente
- API `/api/admin/nom035/*`
- UI migrada (6 páginas)
- Docs: `ADMIN_CORE_API.md`, `ADMIN_CORE_LOCAL_SECURITY.md`

## Fuera de alcance (localStorage)

plan-acción, evidencias, quejas, política, queja-confidencial.

## Confirmaciones negativas

Sin Supabase remoto, link, db push, Auth, usuarios, roles, Guía III, cambio de scoring, deploy, commit ni push.
