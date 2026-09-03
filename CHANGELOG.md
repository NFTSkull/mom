# Changelog

## 2026-09-03 (B4.28.1 — orden alfabético configurable en Admin → Resultados)

- Default: **Nombre A–Z** (antes era cronológico inverso).
- Selector «Ordenar por»: Nombre A–Z / Z–A / Más recientes / Más antiguos.
- URL param `?sort=name_asc|name_desc|recent|oldest`; cambio de sort resetea page=1.
- Indicador visual: "80 resultados · Orden: Nombre A–Z".
- Migración `015_result_sort.sql`: `admin_list_results` con `p_sort` + `unaccent()` + tie-breaker `id ASC`.
- 23 tests B4.28.1 PASS; suite total 395 PASS.
- Exports Excel/Avance no afectados.

## 2026-09-02 (B4.28 — restaurar descarga Excel consolidado en UI)

- Botón **Descargar Excel completo** visible en Inicio, Resultados y Reportes (mismo endpoint).
- En `/admin/reportes`: bloque destacado «Descargar reporte en Excel» al inicio de la pestaña.
- Sección Reportes NOM-035 en dashboard sin gate por campaña activa.
- Helper compartido `download-full-report.ts`; sin cambios a generación XLSX ni datos.

## 2026-09-02 (B4.27 — gráficas Excel visibles y presentation-ready)

- Layout chart-first: Resumen/Categorías/Dominios/Distribución/ATS muestran gráficas arriba.
- `embedVisibleChart` con ancla tl/br + filas reservadas; `activeTab=0` en Resumen Ejecutivo.
- PNG 1400×700, labels multilínea (`wrapChartLabel`), tipografía Roboto embebida.
- Auditoría estructural `xlsx-visual-audit` (media/drawings/anchors/ink).
- **Veredicto: GRÁFICAS VISUALES NOM-035 INTEGRADAS Y VERIFICADAS EN XLSX**

## 2026-08-27 (B4.26 — rediseño ejecutivo reportes NOM-035)

- Excel consolidado 11 hojas (Resumen Ejecutivo, Categorías, Dominios, Distribución Final, ATS, etc.).
- Dataset compartido `buildNom035AggregateReport` + paleta única de riesgo.
- `GET /api/admin/nom035/reports/executive` y sección web Resumen Ejecutivo en `/admin/resultados`.
- Modelo fijo Guía I+III; test excluido; sin % de riesgo inventado (riesgo predominante).
- **Veredicto: REPORTES NOM-035 REDISEÑADOS — MODELO EJECUTIVO + TABLAS + GRÁFICAS CERTIFICADO**

## 2026-08-27 (B4.25 — paginación Admin Resultados)

- Controles Anterior/Siguiente + URL `?page=` en `/admin/resultados`.
- API lista resultados expone `totalPages`; pageSize=20; sin cambios a datos.
- **Veredicto: PAGINACIÓN DE RESULTADOS CORREGIDA — TODOS LOS COMPLETADOS VISIBLES**

## 2026-08-27 — Política vigente NOM-035 2026

- Fuente Word: `docs/politica/politica-riesgos-psicosociales-2026.docx` (+ texto `.txt`).
- Publicada en Production como `policy_documents` status=`publicada`, versionLabel=`2026-v1`.

## 2026-08-26 (B4.24.1 — deploy reportes + fix gráficas Vercel)

- Hotfix: gráficas PNG con `pureimage` (sin `sharp`/libvips) para serverless Vercel.
- Deploy Production `nom035-production` SHA certificado tras CI verde.

## 2026-08-26 (B4.24 — reportes Excel completos NOM-035)

- Sección admin «Reportes NOM-035»: avance Sí/No + Excel completo con 8 hojas y gráficas PNG.
- `GET /api/admin/nom035/reports/full` y `GET /api/admin/nom035/results/[id]/report`.
- RPC `admin_export_nom035_full_report` (migración 014); solo reales completed; test excluido.
- Gráficas web en `/admin/resultados` vía `admin_reports_summary`.
- **Veredicto: REPORTES NOM-035 COMPLETOS — EXCEL + GRÁFICAS LISTOS**

## 2026-08-26 (B4.23 — cierre controlado + test fuera de métricas)

- Cerrada `Evaluación NOM-035 2026`; workers reales `is_active=false`; sesiones=0.
- `workers.is_test` + filtros en dashboard/results/reports/Excel; SYN-PRUEBA-LOGIN excluido de promedios.
- Histórico answers/results intacto; test no borrado.
- **Veredicto: CAMPAÑA NOM-035 CERRADA — HISTÓRICO PROTEGIDO — USUARIO DE PRUEBA EXCLUIDO DE MÉTRICAS**

## 2026-08-20 (B4.22 — Excel avance NOM-035)

- Botón admin «Descargar Excel de respuestas» en dashboard de `Evaluación NOM-035 2026`.
- `GET /api/admin/nom035/campaigns/avance-excel` (`dashboard.view`, sin AAL2).
- XLSX: Nombre | Usuario | Respondió (Sí solo si assignment completed); 83 filas.
- RPC `admin_export_nom035_avance` (migración 012).

## 2026-08-10 (B4.21 — resultados sin MFA/AAL2)

- Ver resultados individuales/answers/clinical en AAL1 (sin verificación en 2 pasos).
- Sigue RBAC + `can_view_sensitive_cases`; quejas/users/evidencias críticas con AAL2.
- Migración `011_results_without_aal2.sql`.

## 2026-08-10 (B4.20 — campaña real ACTIVE permanente)

- Activada `Evaluación NOM-035 2026` (draft→active); `activated_at=2026-08-10T16:20:43.858Z`.
- Gate MFA/AAL2 eliminado solo para apertura de campaña; AAL2 admin sensible intacto.
- Backup pre-apertura off-repo; dry-run + 1 fila; smoke 001/042/083 → Comenzar (sin enviar).
- **Veredicto: CAMPAÑA NOM-035 ACTIVA PERMANENTEMENTE — 83 TRABAJADORES LISTOS PARA RESPONDER**

## 2026-08-10 (B4.19.1 — login simple workers)

- Confirmado: 83 workers solo username+password; MFA workers=0; must_change=false.
- Smoke 001/042/083 ×2 PASS → `awaiting_campaign`; sin MFA/OTP.
- Admin MFA es flujo separado; detalle `results/[id]` (hasta B4.21) exigía AAL2.
- **Veredicto: LOGIN SIMPLE USERNAME + PASSWORD CERTIFICADO PARA 83 TRABAJADORES**
- **ADMIN_MFA_IS_SEPARATE=true**

## 2026-08-10 (B4.19 — sintética cerrada; apertura real bloqueada)

- Cerrada `CAMPAÑA_LOGIN_PRUEBA_PROD` (active→closed); overlap 83=0; active=0.
- Real `Evaluación NOM-035 2026` sigue **draft**.
- MFA=0 / AAL2=false / backup ausente / PITR=false → sin `B417_EXECUTE`.
- **Veredicto: CAMPAÑA PERMANENTE CERTIFICADA — APERTURA AÚN BLOQUEADA**
- RUNTIME_DEPLOY_REQUIRED=false (permanencia en RPC migración 010).

## 2026-08-10 (B4.16.2 — campaña permanente)

- Disponibilidad = status manual (`active`/`closed`); sin gate por `fecha_cierre`/`fecha_inicio`.
- Activate limpia fechas de calendario; assignments 83 con `expires_at` NULL.
- **Veredicto: CAMPAÑA PERMANENTE CERTIFICADA — APERTURA Y CIERRE EXCLUSIVAMENTE MANUALES**
- Campaña real sigue **draft** (no abierta).

## 2026-08-10 (B4.18 — usernames 001–083)

- Usernames de los 83: `empleado.<n>` → `"001"`…`"083"` (string; orden lista B4.14).
- Passwords / auth_user_id / worker_id / assignments intactos; campaña draft.
- Login legado `empleado.*` deja de resolver; smoke 001/042/083 PASS.
- **Veredicto: USERNAMES 001–083 ACTUALIZADOS CORRECTAMENTE**

## 2026-08-06 (UI — saludo hub: reales vs prueba)

- Hub `/trabajador`: trabajadores reales «Hola, {nombre}»; cuenta prueba (`prueba.trabajador` / `SYN-PRUEBA-LOGIN`) «BIENVENIDO!».

## 2026-08-06 (UI — saludo hub trabajador)

- Hub `/trabajador`: título fijo «BIENVENIDO!» (ya no «Hola, {nombre}»).

## 2026-08-06 (UI — encabezado portal trabajador)

- Encabezado del layout trabajador: de «Portal del trabajador · NOM-035» a «BIENVENIDO!».

## 2026-08-04 (B4.17.1 — desbloqueo MFA/backup)

- MFA verified=0; backup-policy file ausente; AAL2=false.
- No se inventó aceptación de backup; no se abrió campaña; draft intacto.
- **Veredicto: APERTURA BLOQUEADA**

## 2026-08-04 (B4.17 — apertura campaña real)

- Precondiciones MFA/AAL2/backup/PITR medidas en vivo: **todas fallan**.
- Cero escritura; campaña permanece **draft**.
- Script `scripts/b417-open-real-campaign.ts` con guardas.
- **Veredicto: APERTURA BLOQUEADA**

## 2026-08-04 (B4.16 — certificación final Production)

- Certificación sintética `TST-PROD-FINAL-001` I→III completa; snapshot PASS; limpieza 0.
- **SISTEMA FUNCIONAL CERTIFICADO PARA 83 TRABAJADORES**
- **RESPUESTAS INDIVIDUALES DISPONIBLES** (detalle admin + AAL2)
- **APERTURA DE CAMPAÑA BLOQUEADA** (MFA=0 / backups / PITR)
- 83 reales intactos; campaña real sigue draft.

## 2026-08-04 (B4.15.4B — passwords NOM+número)

- Password = `NOM` + número canónico (sin `!`); 83 Auth actualizadas; must_change=false.
- Paquete cifrado off-repo `worker-credentials-b4154b/`; smoke 3 OK; campaña draft.
- **Veredicto: PASSWORDS ACTUALIZADAS A NOM + NÚMERO** (credenciales no entregadas aún).

## 2026-08-04 (B4.15.4 — passwords = número de empleado)

- Decisión inicial: password = solo número; Auth min 6 vs len 4 → bloqueo; 0 actualizadas.
- Superado por B4.15.4B (`NOM`+número).

## 2026-08-03 (B4.15.3 — UI awaiting_campaign publicada)

- Portal: «Evaluación asignada» + copy de campaña pendiente; sin botón Comenzar.
- SHA `f2666b9` — RC + WebKit verdes; deploy Production READY.
- **Veredicto: UI DE CAMPAÑA DRAFT PUBLICADA** (campaña sigue draft).

## 2026-08-03 (B4.15.2 — campaña draft + 83 I+III)

- Campaña `Evaluación NOM-035 2026` en **draft**; 83 assignments pending; GUIA_I=83, GUIA_III=83, GUIA_II=0.
- Portal: `awaiting_campaign` mientras la campaña no esté abierta (migración `009`).
- Idempotente; passwords intactas; legacy 2 preservados. **APERTURA BLOQUEADA** (MFA=0 / backups).
- **Veredicto: EVALUACIONES ASIGNADAS — CAMPAÑA DRAFT LISTA**

## 2026-08-03 (B4.15.1 — sin cambio obligatorio de contraseña)

- `must_change_password=false` en los 83 worker_accounts reales (passwords intactas).
- Default DB `false` (migración `008`); seeds/creación futura ya no fuerzan `true`.
- Login → `/trabajador` (cambio solo si admin fuerza el flag). E2E/Vitest actualizados.
- **Veredicto: CAMBIO OBLIGATORIO ELIMINADO**

## 2026-08-03 (B4.14 — GO-LIVE bloqueado: MFA=0)

- Runtime login trabajador finalizado (solo Usuario/Contraseña/«Iniciar sesión»).
- Herramientas B4.13 versionadas; dry-run 83 PASS.
- **Veredicto: PRODUCCIÓN BLOQUEADA** — admin MFA factors verificados = 0; sin aceptación explícita de riesgo backups/PITR.
- Sin crear 83 Auth/accounts/assignments; sin abrir campaña.

## 2026-08-03 (B4.13 — flujo 83 listo; sin crear cuentas)

- Empresa mínima: `NOM035_EMPRESA_OPERATIVA`, `total_trabajadores=83`, opcionales NULL.
- Login trabajador: solo Usuario + Contraseña + «Iniciar sesión».
- Legacy: 165 asg sin actividad eliminados; 2 drafts I+II preservados y revocados; sintético desactivado.
- Dry-run 83: Auth/accounts/assignments I+III listos; 0 II; 0 passwords; sin escritura.
- **Veredicto: FLUJO DE 83 TRABAJADORES LISTO** (cuentas/campaña aún no creadas).

## 2026-08-03 (B4.13 — auditoría saneamiento; GO bloqueado)

- Redeploy no requerido (`ac1a54a` = tooling). Backup pre-saneamiento off-repo.
- CSV↔DB 83/83. Explicados 167 asg = 83+83+1 (2 con draft → saneamiento no ejecutado).
- `disable_signup=true`. Empresa/MFA/PITR pendientes. Sin crear 83 cuentas.

## 2026-08-03 (B4.12.1 — endurecer y versionar herramientas piloto)

- Guardas `ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY` + `EXPECTED`/`CONFIRM` project ref.
- Política piloto solo `TST-PROD-PILOT-001`; dry-run; tests de rechazo.
- Eliminado `activate-prod-worker-prueba.sql` (IDs hardcodeados). `assign-prod-*` fuera de Git.

## 2026-08-03 (B4.12 — cutover productivo + piloto; GO bloqueado)

- Migración `007` en Production; deploy Vercel SHA `42d7286…`; piloto `TST-PROD-PILOT-001` I→III + cleanup 0.
- Guardas productivas y scripts `b412:pilot:*`; secrets `STAGING_*` retirados.
- **Veredicto: PRODUCCIÓN BLOQUEADA** (empresa prueba, MFA ausente, assignments I+II, sin PITR).
- Sin 83 cuentas reales / sin campaña real / ConCasa intacto.

## 2026-08-02 (B4.11 — certificación local 83 sintéticos I+III)

- Scripts locales `b411:seed|cleanup|certify` con guardas anti-Cloud/ConCasa.
- Carga 83/`TST-B411-*`, I+III (0 II), aislamiento, drafts, concurrencia, 33 snapshots, backup lógico, cleanup a cero.
- Dry-run CSV externo sin escritura Auth.
- **Sin** cuentas reales, **sin** mutar Production, **sin** ConCasa.

## 2026-08-02 (B4.10 — aislar WebKit del e2e RC)

- `playwright.config`: proyecto `webkit-guia3` solo con `PLAYWRIGHT_WEBKIT_GUIA3=1`.
- RC Quality instala `chromium`+`firefox`; WebKit permanece en workflow dedicado.
- Causa del fallo e2e en `82c394a`: RC intentaba lanzar WebKit/Firefox sin binarios.

## 2026-08-02 (B4.10 — fix secret-scan WebKit CI)

- `ci-secret-scan.py`: permite `GUIDE_III_TEST_PASSWORD` sintético en `.github/workflows/` (falso positivo que bloqueaba RC Quality en `1d27d76`).
- Sin cambios de producto; WebKit local stack intacto.

## 2026-07-30 (B4.10 — cierre: CI WebKit + dry-run 83)

- Workflow `.github/workflows/guia-iii-webkit.yml` (stack local en ubuntu, cero Cloud).
- Dry-run CSV externo: 83 I+III / 0 II; sin Auth ni passwords.
- Secret-scan: permite passwords sintéticos en `e2e/` / seeds.
- Veredicto pendiente de CI WebKit verde en el mismo SHA.

## 2026-07-30 (B4.10 — Guía III end-to-end local)

- Migración `007_guia_iii_wiring.sql`: `assignment_questionnaires`, `result_snapshot`, allowlist I+III.
- UI `/evaluacion/contestar` orientada por `questionnaireVersion` (I→II o I→III desde manifiesto).
- Submit servidor resuelve FRP desde assignment (cliente no elige instrumento).
- Campañas/emisión usan `getRequiredQuestionnaires` / tamaño de plantilla.
- Seed/cleanup/backup local `EMPRESA_GUIA_III_TEST` + E2E/pgTAP/Vitest B4.10.
- **Sin** 83 cuentas reales, **sin** deploy Production, **sin** ConCasa.

## 2026-07-30 (B4.9 — Guía III motor + trazabilidad)

- Manifiesto Guía III (72 reactivos, Tablas 5–7), `calculateGuiaIIIResult`, validación de compuertas.
- `getRequiredQuestionnaires(>50)` → `GUIA_I` + `GUIA_III` (sin Guía II para N>50).
- Doc `docs/GUIDE_III_SCORING_TRACEABILITY.md`.
- **Pendiente:** UI/submit productivo Guía III, E2E 83, crear cuentas reales.

## 2026-07-30 (B4.9 — portal autenticado trabajador, LOCAL)

- Migración `006_worker_auth_portal.sql`: `worker_accounts`, RLS, RPCs de login/sesión.
- Rutas `/trabajador/*` + APIs; reutiliza motor de evaluación existente (cookie → contestar).
- Seed/cleanup local `trabajador.prueba` / TST-0001.
- **P0:** Guía III pendiente — no campaña productiva de 83.

## 2026-07-29 (B4.8 — bloquear reseeds staging sobre Production)

- WebKit staging: solo `workflow_dispatch` + fail-fast; seeds abortan si el nombre remoto es `nom035-production`.
- Re-limpieza tras reseed accidental de CI; DB productiva vacía otra vez.

## 2026-07-29 (B4.8 — promoción proyecto + limpieza; Production aún bloqueada)

- Proyecto Supabase renombrado `nom035-staging` → `nom035-production` (mismo ref `agbl…kubf`); sin tercer proyecto.
- Scripts productivos con guardas de ref/nombre; limpieza de residuos `STAGING_TEST`; peppers nuevos; backup pre-import off-repo.
- `tsconfig` excluye `scripts` del typecheck de Next (evita fallo de deploy).
- Dashboard: “Sin campaña activa”. Veredicto: **PRODUCCIÓN BLOQUEADA** (falta empresa real + admin + deploy READY).

## 2026-07-29 (B4.8 — cutover Production BLOQUEADO)

- Copy productivo: sin “MVP local” / “Supabase local”; banner admin omitido en `VERCEL_ENV=production`.
- Proyecto Vercel `nom035-production` creado; Supabase `nom035-production` **no** creado (límite free 2/2).
- CSV 83 validado fuera de repo; **sin** import a Production.
- Veredicto: **PRODUCCIÓN BLOQUEADA** (`docs/B4_8_PRODUCTION_CUTOVER.md`).

## 2026-07-29 (B4.7 CERTIFICADO @ 0ff37fd)

- CI RC `30480578873` + WebKit `30480578619` success en el mismo SHA.
- Preview healthy con CSP; cleanup sintético staging OK.
- Veredicto: **CERTIFICADO** (sin Production; tag no empujado).

## 2026-07-29 (B4.7 — WebKit staging CI + secrets)

- Push `f32272c`; RC CI verde; secrets STAGING_* en Actions; WebKit 14/16 por pageerror Safari RSC.
- Mitigación: `prefetch={false}` en login/recuperar-acceso; guards staging ignoran solo `Load failed` / `_rsc access control` de WebKit (HTTP 500 sigue fallando).

## 2026-07-29 (Import trabajadores — aliases + upsert local)

- `mapWorkerCsv`: aliases de nómina (`Número`→`referencia_externa`, `Nombre Completo`→`nombre`).
- Import idempotente `mode: upsert` (actualiza nombre/puesto/departamento por número).
- Script `workers:import:local` / cleanup solo `LOCAL_IMPORT_TEST_83` (localhost-only).
- Tests con fixtures ficticios; sin CSV real ni nombres reales en el repo.

## 2026-07-29 (B4.7 — backup/restore verificado + WebKit CI)

- Dump lógico `public` de `nom035-staging` fuera del repo + restore aislado en Supabase local con conteos/RLS/FK/RPC verificados; Storage PDF ficticio con hash y privacidad.
- Workflow `.github/workflows/staging-webkit.yml` (Linux x64, WebKit + deps, seed/cleanup `always()`).
- `prefetch={false}` en nav/quick links admin (evita pageerror WebKit por prefetch RSC tras logout/auth).
- Scripts `staging:backup:*`; runbook `docs/BACKUP_RESTORE_RUNBOOK.md` ampliado.
- Veredicto: pendiente CI WebKit verde en el SHA final + secrets staging en Actions.

## 2026-07-29 (B4.7 — push c6ec8a5+, Preview CSP, E2E staging 42)

- Push `c6ec8a5`; CI `30465305919` verde; Preview con CSP global observada.
- E2E staging 42/42 (Chromium desktop/móvil + Firefox); WebKit omitido en darwin (frozen).
- Rollback Preview A↔B con ready 200; cleanup sintéticos.
- `SUPABASE_DB_PASSWORD_ABSENT` → restore no ejecutado → **NO CERTIFICADO**.

## 2026-07-29 (B4.7 — CSP global + suite staging ampliada)

- `next.config.ts`: CSP + `X-Frame-Options: DENY` + `frame-ancestors 'none'` en `/:path*` y rutas sensibles; `unsafe-inline`/`unsafe-eval` residuales documentados (Next/hidratación/MFA).
- Scripts `staging:seed:fixtures` / `staging:cleanup:fixtures` (empresa, campaña, tokens, PDF, quejas, plan, política; solo `nom035-staging`).
- Suite `e2e-staging`: público, Auth/MFA/roles, módulos, seguridad, Chromium desktop/móvil, WebKit público, Firefox smoke.
- Regresión local con Supabase arriba: Vitest 189 (0 skip), pgTAP 517, Playwright 42.
- CI `a14d50b` run `30430479378` verde; veredicto sigue **NO CERTIFICADO** hasta E2E staging 100% + backup/restore + redeploy CSP.

## 2026-07-27 (B4.7 — Release Candidate / Staging prep)

- Rama `release/nom035-staging-rc1`, CI release, health `/api/health/live|ready`.
- Playwright staging config + scripts seed/cleanup sintéticos (fallan fuera de staging).
- Docs: CI_SECURITY_MODEL, STAGING_*, BACKUP/ROLLBACK, PRODUCTION_CHECKLIST_PRELIMINARY, B4_7.
- Enlace Cloud únicamente a proyecto nombre exacto `nom035-staging` (sin tocar otros).
- CI: `b4-3-concurrency` se omite en `quality` sin `.env.local`; corre en `database` tras `ci-write-local-env`.
- CI: `ci-write-local-env` ensambla nombres de env por partes (evita falso positivo del secret-scan).
- CI verde run `30429324801` @ `471592f`; Preview Vercel + smoke remoto; veredicto **NO CERTIFICADO** (falta E2E completo + backup restore).
- Sin Vercel Production, sin merge a main, sin usuarios/datos reales.

## 2026-07-27 (B4.6 — Auth, RBAC y MFA)

- Migración `005_auth_rbac_mfa.sql`: `app_permission`, `role_permissions`, perfil MFA, último admin, `require_admin_permission*`.
- RPCs admin ordinarias con autorización interna; EXECUTE a `authenticated`.
- Proxy Next 16 + `getClaims`; guards server-side; login/logout/MFA/password/users/audit.
- `NOM035_ADMIN_BACKEND_MODE=auth_rbac`; seed `@nom035.local` + cleanup.
- pgTAP `008_*`, Vitest B4.6, Playwright `e2e/auth-rbac.spec.ts`.
- Docs: AUTH_RBAC_MATRIX, AUTH_SECURITY_MODEL, MFA_OPERATIONS, USER_PROVISIONING_RUNBOOK, ACCESS_REVOCATION_RUNBOOK, B4_6_AUTH_RBAC_CERTIFICATION.
- Certificación local: Vitest 189, pgTAP 517, Playwright 42; audit 0.
- Sin remoto/link/push/deploy; sin usuarios reales; sin commit/push.

## 2026-07-27 (B4.5 — módulos secundarios + Storage privado)

- Migración `004_secondary_modules_and_storage.sql`: plan/evidencias/quejas/políticas + bucket `nom035-evidence` privado.
- RPCs `admin_*` / `public_submit_confidential_complaint` (service_role).
- APIs admin + pública; UI migrada sin localStorage; dashboard/reportes con agregados.
- Validación magic bytes, compensación Storage↔DB, signed downloads, rate limit/honeypot.
- pgTAP `007_*`, Vitest B4.5, Playwright `e2e/secondary-modules.spec.ts`.
- Docs: ACTION_PLAN_API, EVIDENCE_STORAGE_SECURITY, COMPLAINTS_PRIVACY_MODEL, POLICY_VERSIONING, B4_5_SECONDARY_MODULES_CERTIFICATION.
- Sin Auth, sin remoto, sin scoring/Guía III, sin commit/push.

## 2026-07-24 (B4.4 — panel administrativo central)

- Migración `003_admin_core_backend.sql`: columnas admin, una campaña active, RPCs `admin_*`.
- Guard local-only (`admin-access-guard`) + API `/api/admin/nom035/*` (Zod, server-only).
- UI migrada: dashboard, configuración, trabajadores (+CSV), campañas (tokens one-time), resultados, reportes.
- Módulos fuera de alcance siguen en localStorage (plan-acción, evidencias, quejas, política).
- pgTAP `006_*`, Vitest B4.4, Playwright `e2e/admin-core.spec.ts`.
- Docs: `ADMIN_CORE_API.md`, `ADMIN_CORE_LOCAL_SECURITY.md`, `B4_4_ADMIN_CORE_CERTIFICATION.md`.
- Sin Auth, sin remoto, sin scoring/Guía III, sin commit/push.

## 2026-05-05

- Se inicializo base `Next.js + TypeScript + Tailwind` para el portal interno NOM-035.
- Se creo estructura App Router para rutas admin y evaluacion publica por token.
- Se agregaron tipos de dominio, datos mock y capa `localStorage` para MVP local.
- Se incorporo motor de scoring inicial desacoplado de componentes React.
- Se agregaron pruebas unitarias base para reglas de guias y scoring inicial.
- Se implemento la Guia de Referencia I con preguntas oficiales, flujo condicional y resultado automatico oficial.
- Se actualizo la pantalla de evaluacion por token para aplicar reglas de salto por Seccion I.
- Se actualizaron resultados admin con conteo de alertas y estado por trabajador.
- Se agregaron pruebas unitarias de umbrales oficiales para `calculateGuiaIResult`.
- Se corrigio contraste y legibilidad visual en admin y evaluacion, eliminando estilos lavados por herencia global.
- Se fortalecio `/admin/campanas` como centro de distribucion de evaluaciones con resumen operativo, tabla por trabajador y acciones de copiado.
- Se agrego bienvenida con accion "Iniciar evaluacion" en `/evaluacion/[token]` para clarificar el inicio del cuestionario.
- Se agregaron datos oficiales de Guia II (reactivos, compuertas, grupos y umbrales) en capa de dominio local.
- Se implementaron `scoreGuiaIIAnswer`, `getRiskLevelFromThresholds` y `calculateGuiaIIResult` con calculo por dimension, dominio, categoria y resultado final.
- Se agregaron pruebas unitarias de scoring, compuertas condicionales y niveles de riesgo para Guia II.
- Se integro Guia II al flujo de trabajador por pasos en `/evaluacion/[token]` para empresas de 16 a 50 trabajadores.
- Se amplio `storage-local` para persistir respuestas/resultados de Guia I y Guia II, estado y fecha de completado.
- Se actualizo `/admin/resultados` para mostrar resumen de Guia II, puntaje, riesgo y dominios criticos por trabajador.
- Se evito hydration mismatch en `/admin/campanas` y `/admin/resultados` leyendo datos de `localStorage` solo tras montar en cliente (skeleton estable en SSR y primer paint).
- Se implemento dashboard ejecutivo en `/admin/resultados` con cards clave, distribucion de riesgo Guia II, analisis por departamento, dominios prioritarios y filtros operativos.
- Se agregaron helpers puros en `src/lib/nom035/results-analytics.ts` y pruebas unitarias de agregados.
- Se creo `/admin/reportes` como informe imprimible profesional NOM-035 con portada, alcance, resultados agregados, conclusiones y plan de intervencion.
- Se agrego `report-generator.ts` con pruebas unitarias para conclusiones, recomendaciones y plan de intervencion.
- Se creo `/admin/plan-accion` para registrar y dar seguimiento a acciones preventivas/correctivas de forma local.
- Se implemento CRUD local de `ActionPlanItem` y generacion automatica de acciones sugeridas desde resultados agregados.
- Se agrego `action-plan-generator.ts` con pruebas unitarias para sugerencias, vencimientos y estadisticas del plan.
- Se creo `/admin/evidencias` para registrar y organizar evidencias documentales NOM-035 en almacenamiento local/mock.
- Se agregaron tipos, CRUD local y analytics de evidencias (stats/checklist/etiquetas) con pruebas unitarias.
- Se creo el canal publico `/queja-confidencial` para registrar reportes confidenciales anonimos o identificados con folio autogenerado.
- Se creo `/admin/quejas` para administrar reportes con filtros, detalle reservado, cambio de estado, asignacion y notas de resolucion.
- Se agregaron `ConfidentialComplaint`, CRUD local de quejas y helper `complaint-analytics` (stats, etiquetas, folios) con pruebas unitarias.
- Se incorporo el acceso "Quejas" en navegacion admin y se mantuvo privacidad al no exponer datos de contacto en tablas.
- Se creo `/admin/politica` para generar, editar, versionar, publicar e imprimir la Politica de Prevencion NOM-035 en almacenamiento local/mock.
- Se agrego `PolicyDocument`, CRUD local de politicas y helper `policy-generator` para texto base institucional y etiquetas de estado.
- Se incorporo historial de versiones con acciones editar/duplicar/publicar/eliminar y vista imprimible con controles ocultos en impresion.
- Se agrego enlace "Politica" en navegacion admin y nota de integracion documental hacia el modulo Evidencias.
- Se mejoro `/admin/trabajadores` con formulario completo (alta/edicion/desactivacion/eliminacion) y carga CSV para trabajadores reales.
- Se ampliaron tipos de trabajador y `storage-local` con CRUD de trabajadores y asignaciones de campana (`getCampaignAssignments`, `saveCampaignAssignment`, `updateCampaignAssignment`).
- Se actualizo `/admin/campanas` para listar trabajadores activos, detectar estado "Sin link" y generar enlaces faltantes sin duplicar.
- Los enlaces individuales se construyen con `window.location.origin` y se mantiene copiado de link/mensaje para envio operativo.
- Se realizo auditoria final del MVP local con mejoras de navegacion admin (resaltado de ruta activa y etiquetas con acentos).
- Se transformo `/admin` en dashboard ejecutivo de demo con resumen transversal de modulos y accesos rapidos.
- Se agregaron herramientas demo locales: cargar datos demo, limpiar solo llaves NOM-035 y refrescar estado.
- Se creo `src/lib/nom035/demo-data.ts` y pruebas unitarias para estado de datos locales.
- Se corrigio riesgo de hydration mismatch en `/admin/configuracion` cargando datos tras `mounted` con skeleton estable.

## 2026-06-22

- Se corrigio ortografia y acentos del cuestionario oficial en `guia-i.ts` y `guia-ii.ts` segun NOM-035-STPS-2018 (DOF).
- Se ajusto la pregunta 15 de Guia I al texto oficial: "¿Se ha sobresaltado fácilmente por cualquier cosa?".
- Se muestra el encabezado de cada seccion de Guia I una sola vez (II, III y IV ya no se repiten por pregunta).
- Se actualizaron textos visibles de `/evaluacion/[token]` con ortografia correcta y opciones "Sí"/"No".

## 2026-07-24

- **B4.3 CERTIFICADO** — evaluación pública centralizada por token (Supabase local).
- Migración `002_public_evaluation_backend.sql`: drafts, sessions, rate_limits, submission_id, trigger monótono y RPCs atómicas.
- Módulos server-only: token HMAC, sesión HttpOnly, rate-limit, scoring server-side.
- Route handlers `/api/public/evaluations/{session,start,draft,submit}`.
- UI: `/evaluacion/[token]` (intercambio) + `/evaluacion/contestar` + `/evaluacion/gracias`.
- Cabeceras de privacidad + CSP en `next.config.ts`.
- Script `db:seed:evaluation` (solo localhost).
- pgTAP 247 assertions; Vitest 118; Playwright Chromium 10/10.
- Overrides adicionales `minimatch@10.2.5` / `brace-expansion@5.0.8` (dev, audit 0).
- Docs: `PUBLIC_EVALUATION_API.md`, `PUBLIC_EVALUATION_THREAT_MODEL.md`, `B4_3_PUBLIC_EVALUATION_CERTIFICATION.md`.

## 2026-07-24 (prev)

- Auditoria formal de produccion documentada en `docs/PRODUCTION_READINESS_AUDIT.md` (veredicto NO-GO).
- Bloque B4.0: fundamentos seguros Supabase sin migrar pantallas fuera de localStorage.
- Se agrego linea base `docs/NPM_AUDIT_BASELINE.md` (sin `audit fix --force`).
- Se instalaron `@supabase/supabase-js@2.109.0`, `@supabase/ssr@0.12.0` y `server-only` (compatibles con Node 20).
- Se creo `.env.example`, `src/lib/env.ts` y clientes `src/lib/supabase/{client,server,admin}.ts`.
- Se agrego migracion revisable `supabase/migrations/001_nom035_initial_schema.sql` con RLS force, revoke anon/authenticated y token_hash.
- Se documentaron `docs/DATABASE_SECURITY_MODEL.md` y el adaptador `Nom035Repository` fijo en modo `local`.
- Se agregaron pruebas estaticas de seguridad/esquema en `b4-security-foundation.test.ts`.
- `.gitignore` ahora excluye secretos env y permite versionar `.env.example`.

## 2026-07-24 (B4.2.1 — CERTIFICADO)

- Se demostró que el high atribuido a `next@16.2.11` era una metavulnerabilidad
  inducida por `postcss@8.4.31` y `sharp@0.34.5`, no un advisory residual propio.
- Se documentaron GHSA/CVE/rangos/parches exactos en
  `docs/B4_2_1_DEPENDENCY_REMEDIATION.md`.
- Overrides estables: `postcss@8.5.23` y `sharp@0.35.3`; árbol final único,
  sharp nativo con libvips 8.18.3 e instalación limpia reproducible.
- Audits completo y producción: **0 vulnerabilidades**.
- Pruebas de no-regresión de lockfile y resize sharp en memoria.
- Regresión: lint/typecheck/build PASS, **99 pruebas Vitest**, **170 pgTAP**,
  smoke HTTP 11/11.
- Scripts `db:*` corregidos para invocar Supabase CLI mediante `npx --yes`.
- Veredicto de reevaluación: **CERTIFICADO**.

## 2026-07-24 (B4.2 — NO CERTIFICADO por deps de producción)

- Certificación local de base de datos y seguridad de dependencias (sin remoto/link/push).
- `next`/`eslint-config-next` `16.2.4 → 16.2.11` (última estable); `npm audit fix` (sin `--force`) limpió highs/low de desarrollo.
- Audit final: 0 critical, **3 high de producción** (`next`/`postcss`/`sharp`) **sin fix estable** (rango vulnerable llega a `16.3.0-preview.7`). Documentado en `docs/DEPENDENCY_SECURITY_CERTIFICATION.md`.
- Supabase local real (Docker): 10 contenedores healthy; puertos desplazados a 55321-55324 para coexistir con otra instancia; migración aplicada desde cero **dos veces** (reproducible).
- `config.toml` ampliado (puertos, analytics/pooler off). Migración: se añadieron CHECK de coherencia (`completed`/`revoked`/`published`/queja anónima).
- pgTAP en PostgreSQL real: `supabase/tests/database/00{1..4}` → **170 assertions, PASS** (estructura, RLS/permisos, integridad, transiciones).
- Tipos generados `src/types/database.generated.ts` (12 tablas) + alias `src/types/database.ts`.
- Scripts `db:start/stop/status/reset/test/types`; guía `docs/LOCAL_DATABASE_WORKFLOW.md`.
- Pruebas estáticas B4.2 (`b4-2-database-hardening.test.ts`); regresión: lint/typecheck OK, **95 tests**, build OK; smoke HTTP 12/12 rutas → 200.
- Veredicto B4.2 **NO CERTIFICADO** (`docs/B4_2_DATABASE_CERTIFICATION.md`): único bloqueo = highs de producción sin versión estable.

## 2026-07-24 (B4.1 — CERTIFICADO)

- Fuente canónica verificada: `docs/source/NOM-035-STPS-2018-oficial.txt` (220837 bytes, SHA-256 `8d5c2c63…7a76`).
- Manifiesto único Guía II (`guia-ii-manifest.ts`) como fuente de reactivos, scoring, cat/dom/dim, gates y umbrales.
- Motor de scoring con validación estricta (falla duro ante respuestas faltantes/inválidas) y metadatos `scoringVersion` / `questionnaireVersion`.
- Política de fronteras tipográficas documentada en `docs/SCORING_BOUNDARY_POLICY.md`.
- UI de revisión final del trabajador (sin puntajes), confirmación y protección anti doble envío.
- 10 fixtures golden + suite de certificación; aviso de “versión no registrada” en admin/resultados.
- Veredicto **CERTIFICADO** en `docs/SCORING_CERTIFICATION.md` tras lint/typecheck/test/build en verde.
- Restricciones respetadas: sin Supabase remoto, SQL, login, Guía III, deploy, commit ni push.
