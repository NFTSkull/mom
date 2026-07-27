# Certificación de base de datos local y dependencias — B4.2

**Fecha:** 2026-07-24  
**Veredicto:** **NO CERTIFICADO**

> Motivo único de bloqueo: persisten **3 vulnerabilidades high de producción**
> (`next`, `postcss`, `sharp`) **sin versión estable** que las corrija al momento de
> ejecución. Todo lo demás (base local, migración, RLS, integridad, pgTAP, tipos,
> regresión, build) **pasó**. No se declara CERTIFICADO porque el criterio del bloque
> exige `0 high` en `npm audit` y no ocultar highs de producción como “solo dev”.

---

## 1. Estado inicial

| Campo | Valor |
|---|---|
| pwd / raíz Git | `/Users/grecovillanuevaortiz/Desktop/Mom` |
| Rama | `main` |
| Último commit | `b037cad` Corrige ortografía del cuestionario NOM-035… |
| Node / npm | v20.20.1 / 10.8.2 |
| Next.js | 16.2.4 → **16.2.11** |
| React / React-DOM | 19.2.4 (sin cambio) |
| @supabase/supabase-js | 2.109.0 |
| @supabase/ssr | 0.12.0 |
| Supabase CLI | 2.109.1 |
| Docker | 29.5.3 (daemon iniciado durante el bloque) |
| Docker Compose | v5.1.4 |

Fuente canónica intacta: `docs/source/NOM-035-STPS-2018-oficial.txt` — 220837 bytes,
SHA-256 `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76`.
B4.1 sigue **CERTIFICADO**. Sin `.env` versionado (solo `.env.example` con claves
vacías), sin proyecto remoto enlazado, sin secretos en el working tree.

## 2. Dependencias — vulnerabilidades antes/después

| | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| **Antes** (`npm audit`) | 0 | 6 | 0 | 1 | 7 |
| **Después** | 0 | **3** | 0 | 0 | 3 |
| **Después (`--omit=dev`)** | 0 | **3** | 0 | 0 | 3 |

Corregidos con `npm audit fix` (sin `--force`): `brace-expansion`, `js-yaml`, `vite`
(dev, high) y `@babel/core` (dev, low). Bump directo: `next` y `eslint-config-next`
`16.2.4 → 16.2.11` (última estable). Detalle completo en
`docs/DEPENDENCY_SECURITY_CERTIFICATION.md`.

**Residual (bloqueante):** `next`/`postcss`/`sharp` high. El rango vulnerable del
advisory de Next abarca hasta `16.3.0-preview.7`, incluyendo **toda versión estable**
(`latest = 16.2.11`). Las únicas builds fuera del rango son `preview`/`canary`
(prohibidas). No hay fix estable disponible.

## 3. Docker y Supabase local

- Docker daemon operativo (ServerVersion 29.5.3).
- `supabase start` **real**: 10 contenedores de `mom-nom035-local` arriba y healthy.
- Servicios verificados: **PostgreSQL, API (Kong/REST), Auth (GoTrue), Storage, Studio**.
  `analytics`/`vector`/`imgproxy`/`pooler` desactivados.
- Puertos desplazados a **55321-55324** para coexistir con otra instancia local
  (54321-54327) sin interferirla.
- Llaves locales: son defaults demo compartidos → **no** se transcriben.

## 4. Reconstrucción desde cero (dos resets)

| Reset | Exit code | Migraciones | Errores | Warnings | Duración |
|---|---|---|---|---|---|
| #1 | 0 | `001_nom035_initial_schema.sql` aplicada | ninguno | `NOTICE pgcrypto already exists` (benigno) | ~30 s |
| #2 | 0 | `001_...` aplicada | ninguno | mismo NOTICE benigno | ~29 s |

Tras ambos resets: **12 tablas** y las 4 restricciones nuevas presentes.
Reproducible, sin depender de cambios manuales en Studio ni seed.

## 5. Auditoría de la migración (matriz)

| Elemento esperado | Presente | Probado en DB | Resultado |
|---|:--:|:--:|---|
| Extensión pgcrypto | sí | sí | OK |
| 11 enums de dominio + valores | sí | sí (`enum_has_labels`) | OK |
| 12 tablas | sí | sí (`has_table` + count=12) | OK |
| Columnas / tipos / NOT NULL | sí | sí | OK |
| Defaults (jsonb `{}`/`[]`, activo, status) | sí | sí | OK |
| CHECK (total≥0, fechas, token_last4=4, size≥0) | sí | sí | OK |
| UNIQUE (singleton, campaign+worker, token_hash, answers, results, folio) | sí | sí (`col_is_unique`) | OK |
| Foreign keys + ON DELETE (RESTRICT/CASCADE/SET NULL) | sí | sí (`fk_ok` + `confdeltype`) | OK |
| Índices obligatorios | sí | sí (`has_index`) | OK |
| Función `set_updated_at` + triggers | sí | sí | OK |
| RLS ENABLE + FORCE (12/12) | sí | sí | OK |
| REVOKE anon/authenticated/PUBLIC | sí | sí (0 grants) | OK |
| Sin políticas anon permisivas / admin prematuras | sí | sí (0 policies) | OK |
| Sin token en texto plano; token_hash/token_last4 | sí | sí (`hasnt_column`) | OK |
| audit_log sin respuestas sensibles | sí | sí (metadata `{}`) | OK |

### Discrepancias detectadas y corregidas (coherencia)

Se añadieron CHECK de coherencia mínima (documentadas y probadas):

- `evaluation_assignments_completed_coherent`: `completed` ⇒ `completed_at` no nulo.
- `evaluation_assignments_revoked_coherent`: `revoked` ⇒ `revoked_at` no nulo.
- `confidential_complaints_anonymous_coherent`: anónima ⇒ sin datos del reportante.
- `policy_documents_published_coherent`: `publicada` ⇒ `published_at` no nulo.

## 6. Pruebas pgTAP (PostgreSQL real)

Comando: `supabase test db --local supabase/tests/database`.

| Archivo | Assertions | Resultado |
|---|---:|---|
| `001_schema_structure.test.sql` | 85 | PASS |
| `002_security_rls.test.sql` | 19 | PASS |
| `003_data_integrity.test.sql` | 51 | PASS |
| `004_state_transitions.test.sql` | 15 | PASS |
| **Total** | **170** | **PASS** (exit 0) |

## 7. Transiciones — brechas diferidas (contrato bloque futuro)

La BD garantiza coherencia estado/timestamp, pero **no** la monotonicidad. Se difiere
a la **capa RPC** (bloque API/Auth), no se finge protección en la tabla:

- No-regresión (`completed`/`revoked` → `pending`): forzar por RPC transaccional.
- Un solo resultado por assignment: ya garantizado por `UNIQUE(assignment_id)`.
- Transiciones de complaint/policy + bitácora en `audit_log`: vía funciones controladas.

## 8. Tipos TypeScript generados

- `src/types/database.generated.ts` (autogenerado, encabezado “no editar”): 12 tablas,
  enums, `Row`/`Insert`/`Update`.
- `src/types/database.ts`: alias controlados (sin copiar esquema).
- `typecheck` OK tras generar.

## 9. Regresión del MVP (repository mode sigue `local`)

| Paso | Resultado |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` (Vitest) | **12 files / 95 tests** PASS (86 B4.1 + 9 estáticos B4.2) |
| `npm run build` | exit 0 (Next 16.2.11, sin leer `SUPABASE_SECRET_KEY`) |

Pruebas estáticas B4.2 (`b4-2-database-hardening.test.ts`): secretos fuera del cliente,
sin import de `admin.ts`/service role, ninguna página accede aún a Supabase, repository
mode `local`, scoring version intacto, SHA-256 de fuente y manifiesto intactos.

### Smoke HTTP (build de producción, `next start` :3100)

12/12 rutas admin/públicas → **200**. `/evaluacion/[token]` → 200 para token válido,
inexistente y “completado”: en este MVP la validez/estado del token se resuelve en
**cliente** (localStorage), por lo que el HTTP no diferencia. No se ejecutó E2E de
navegador (no se declara).

## 10. Veredicto y pendientes

**NO CERTIFICADO.**

- **P1 bloqueante:** `next`/`postcss`/`sharp` high sin fix estable. Actualizar a la
  primera `next >= 16.3.0` **estable** que salga del rango y reejecutar toda la regresión.
- **Diferido (contrato):** monotonicidad de estados y bitácora vía RPC (bloque API/Auth).

Todo lo verificable de base de datos y regresión pasó; el único impedimento es de
seguridad de dependencias de producción.

## 11. Confirmación de restricciones

Sin Supabase remoto · sin `supabase link` · sin `db push` · sin usuarios · sin Auth ·
sin roles funcionales · sin cambio de repository mode · sin migrar pantallas · sin tocar
scoring/manifiesto/preguntas certificados · sin Guía III · sin deploy · sin commit · sin push.

---

## 12. Addendum B4.2.1 — cierre del bloqueo (2026-07-24)

El veredicto **NO CERTIFICADO** anterior se conserva como registro histórico del
estado observado al cerrar B4.2. B4.2.1 investigó los nodos exactos y demostró que
el “high de next” era una metavulnerabilidad inducida por PostCSS y sharp.

Remediación posterior:

- `postcss@8.5.23` mediante override (corrige los 3 GHSA residuales).
- `sharp@0.35.3` mediante override (incluye libvips 8.18.3).
- Next permanece en la estable oficial `16.2.11`.
- Audit completo y producción: 0 critical/high/moderate/low.
- Regresión: lint/typecheck/build PASS, Vitest 99/99, pgTAP 170/170,
  smoke HTTP 11/11.

**Veredicto de la reevaluación B4.2.1:** **CERTIFICADO**.

Detalle: `docs/B4_2_1_DEPENDENCY_REMEDIATION.md`.
