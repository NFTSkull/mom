# Flujo de base de datos local — NOM-035 (B4.2+)

Base **100% local** con Supabase CLI + Docker. **Nunca** se enlaza ni empuja a remoto en este bloque.

Migraciones: `001`, `002` (público), `003` (admin core B4.4).

## Requisitos

- Docker Desktop en ejecución.
- Supabase CLI (se usa vía `npx supabase`, versión verificada 2.109.1).
- Node 20 / npm 10.

## Puertos (importante)

Este proyecto usa el rango **55xxx** (`config.toml`) para **coexistir** con otra
instancia Supabase local que pueda existir en la máquina (que ocupa 54321-54327):

| Servicio | Puerto local |
|---|---|
| API (Kong) | 55321 |
| PostgreSQL | 55322 |
| Studio | 55323 |
| Mailpit/local_smtp | 55324 |

`analytics`, `vector`, `imgproxy` y `pooler` están **desactivados** (no requeridos).

## Comandos (scripts de `package.json`)

```bash
npm run db:start    # levanta Supabase local (Docker)
npm run db:status   # estado y URLs locales
npm run db:reset    # reconstruye la base desde cero aplicando migraciones
npm run db:test     # pgTAP (001–006)
npm run db:types    # regenera database.generated.ts
```

Para panel admin local: `NOM035_ADMIN_BACKEND_MODE=local_supabase` en `.env.local`.
npm run db:test     # ejecuta las suites pgTAP en supabase/tests/database
npm run db:types    # regenera src/types/database.generated.ts
npm run db:stop     # detiene Supabase local
```

Flujo típico:

1. `npm run db:start`
2. `npm run db:reset` (aplica `supabase/migrations/001_...sql` en base limpia)
3. `npm run db:test` (pgTAP: estructura, RLS, integridad, transiciones)
4. `npm run db:types` (tras cualquier cambio de esquema)
5. `npm run db:stop` al terminar

## Comandos PROHIBIDOS antes del bloque remoto

- `supabase link` — enlazar a proyecto remoto.
- `supabase db push` — aplicar migraciones en la nube.
- Cualquier operación con `--linked` o credenciales remotas.
- `npm audit fix --force` (rompe versiones / degrada Next).

## Cómo NO copiar secretos locales

- Las llaves que imprime `supabase status`/`start` (anon, service_role, JWT secret,
  S3 keys) son **defaults de demo compartidos**: no se pegan en docs, commits ni chat.
- No se crea `.env.local` con valores reales en este bloque; el MVP corre con
  `localStorage` y no lee `SUPABASE_SECRET_KEY` durante `build`.
- Solo se versiona `.env.example` con claves vacías.

## Addendum B4.3

```bash
npm run db:seed:evaluation   # emite enlace local (solo Terminal; no escribe token a disco)
npm run test:e2e             # Playwright Chromium contra Next + Supabase local
```

Migraciones aplicables en reset: `001` + `002`.
Sesión operativa: `NOM035_EVALUATION_SESSION_MINUTES=120` en `.env.local`.
