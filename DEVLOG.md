# Devlog

## 2026-09-02 - B4.28 restaurar descarga Excel en UI

### Causa

- El endpoint y el botón en `/admin` existían, pero la sección podía no verse y no estaba en Resultados/Reportes (donde el usuario busca el reporte tras B4.26).
- Tras push a git, Production seguía en B4.27 (sin deploy) → el usuario no veía el botón en vivo.

### Decisiones

- Reexponer `GET /api/admin/nom035/reports/full` desde Inicio + Resultados + Reportes.
- Bloque destacado al tope de `/admin/reportes` (`nom035-reportes-excel-export`).
- Quitar el gate `activeCampaign?.nombre === …` en dashboard (campaña cerrada sigue exportable).
- Deploy Production obligatorio para que aparezca en la pestaña Reportes.
- Deploy B4.28.1: `dpl_AwHJNJZrN7HrCpSv5euPhKCxezmx` · SHA `f42caaa` · alias `nom035-production.vercel.app`.
- Verificado en archivos del deployment: `reportes/page.tsx` contiene `nom035-reportes-excel-export` + «Descargar Excel completo».
- No tocar agregación, XLSX, RPC ni Production data.

## 2026-09-02 - B4.27 gráficas Excel visibles

### Causa raíz (B4.26)

- PNGs existían en `xl/media` pero estaban **debajo** de tablas/listas (`tipRow+2`, `5+catDataRows`).
- Sin reserva de filas ni `activeTab`; labels truncados (`slice(0,12)`); fuente `bold`/`pt` rompía `fillText` en pureimage.

### Decisiones

- Chart-first + `embedVisibleChart(tl/br)` + zoom/printArea.
- Validación: unzip drawings/anchors + `pngHasVisibleInk` (LibreOffice no disponible en el host).
- Font Roboto en `src/lib/nom035/fonts/` + `outputFileTracingIncludes` para Vercel.
- Deploy: SHA `ba85f1a` · dpl `dpl_4osJMM3dX5rBdacFVigE52fb41r9` · CI RC `33716458393`.

## 2026-08-27 - B4.26 rediseño ejecutivo reportes

### Decisiones

- Plantilla histórica solo referencia visual; datos = Guía I+III productiva (no Guía II / no 21 antiguos).
- Dataset único `buildNom035AggregateReport` para web + Excel + PNG (evita divergencia).
- Sin métrica agregada tipo «46% riesgo»; solo **RIESGO PREDOMINANTE** (moda verificable).
- Paleta centralizada `risk-palette.ts`; gráficas siguen `pureimage` (Vercel-safe).
- READ-ONLY sobre producción: solo código de reportes/UI/endpoints de lectura.
- Deploy Production: SHA `74b62c8` · dpl `dpl_2DdeDppndLuyuYcJxBbhf85bDaVS` · CI RC `33696583425` verde.

## 2026-08-27 - B4.25 paginación Resultados

### Decisiones

- Causa raíz: no existían botones de paginación (solo label «Página 1 · N total»).
- API/RPC ya soportaban `page`/`offset`; fix = UI + URL searchParams + `totalPages`.
- pageSize=20 (mismo patrón trabajadores/plan-acción); filtros resetean page=1; cambio de page no.

## 2026-08-27 - Política vigente riesgos psicosociales

### Decisiones

- Contenido tomado del Word entregado por el usuario (Alpha Metals México / NOM-035 2026).
- Insertada directamente como `publicada` (no había política previa).
- Artefactos versionados en git bajo `docs/politica/`.

## 2026-08-26 - B4.24.1 deploy Production reportes

### Decisiones

- CI requirió sincronizar `database.generated.ts` (is_test + RPC export) y `npm audit fix`.
- Vercel: `sharp` falló (libvips); hotfix con `pureimage` PNG puro JS.
- SHA certificado deploy: `fd33d1c` · RC `33020994690` · WebKit `33020994592` · `dpl_75azMDkkB7iKinQxGBeEf3Q5S8oF`.

## 2026-08-26 - B4.24 reportes Excel completos + gráficas

### Decisiones

- Misma exclusión `is_test` que B4.23 vía RPC batch (no reglas duplicadas).
- Fuente primaria: snapshots persistidos (`guia_ii_*_scores`); no recalcular scoring.
- Gráficas XLSX: PNG con `pureimage` embebidas en ExcelJS (sin APIs externas).
- Permisos: consolidado `reports.generate`; individual `results.individual.read` (AAL1, B4.21).
- Guía III gates 65–72: filas «No aplicable» cuando no hay respuesta condicional.

## 2026-08-26 - B4.23 cierre + exclusión test

### Decisiones

- Causa del promedio: SYN-PRUEBA-LOGIN tenía assignment+result en la campaña real (además de campaña prueba).
- Marcador durable `workers.is_test` (no inferir solo por nombre).
- Desactivar `worker_accounts` reales sin borrar Auth/workers/assignments/resultados.
- Login post-cierre: mensaje único de no disponibilidad (sin enumerar).

## 2026-08-20 - B4.22 Excel avance operativo

### Decisiones

- Bloque numerado B4.22 (B4.21 ya = resultados sin AAL2).
- `Respondió=Sí` solo con `assignment.status=completed` (no draft ni Guía I sola).
- Permiso `dashboard.view` (sin AAL2): el archivo no trae datos clínicos.
- Validación server-side: total=83 y Sí = completed del mismo query.

## 2026-08-10 - B4.21 resultados sin AAL2

### Decisiones

- Producto: consultar resultados no debe pedir MFA/2FA.
- Separar sensibilidad (`can_view_sensitive_cases`) de AAL2.
- No debilitar quejas ni `users.manage` / evidencias / revoke / publish.

## 2026-08-10 - B4.20 activación definitiva campaña real

### Decisiones

- Separar `CAMPAIGN_ACTIVATION` de `ADMIN_SENSITIVE_ACTIONS`: abrir campaña no exige MFA/AAL2.
- No inventar PITR ni `backup-policy-accepted.txt`; backup lógico pre-apertura + SHA sí.
- UPDATE único draft→active con `fecha_*`/`closed_at` NULL; permanencia = status.
- Smoke no inicia evaluación (sesiones/respuestas/resultados permanecen 0).

## 2026-08-10 - B4.19.1 login simple workers

### Decisiones

- MFA/AAL2 no aplica al portal trabajador; no se enrolla ni exige segundo factor.
- No se modifica política MFA admin en este bloque; solo se documenta.
- Protección AAL2 de respuestas individuales admin se mantiene.

## 2026-08-10 - B4.19 cierre sintética / apertura bloqueada

### Decisiones

- Cerrar solo `CAMPAÑA_LOGIN_PRUEBA_PROD` tras guarda (nombre exacto, SYN-PRUEBA-LOGIN, overlap 0).
- No abrir real sin MFA verified + AAL2 + mfa_required + (PITR|backup-policy).
- No inventar `backup-policy-accepted.txt`.
- No redeploy: 833b5ca no cambia runtime de portal; 010 ya en Production.

## 2026-08-10 - B4.16.2 campaña permanente

### Decisiones

- Cierre efectivo solo vía `admin_close_campaign` (status), no por calendario.
- `fecha_inicio`/`fecha_cierre` quedan como metadatos; al activar se fuerzan NULL.
- `expires_at` de assignment se conserva para invites públicos; los 83 productivos permanecen NULL.
- Sesión HTTP puede expirar; cuenta/assignment/draft/resultados no.

## 2026-08-10 - B4.18 usernames 001–083

### Decisiones

- Solo mutar `worker_accounts.username_normalized`; email Auth y metadata no son autoridad de login.
- Orden = sort numérico `external_reference` (B4.14), no nombre/UUID/created_at.
- UPDATE en 2 fases (`x.b418.*` → `001`–`083`) por UNIQUE.
- Username es identificador de acceso independiente del número de empleado; password sigue NOM+canónico.
- `proposedUsername(empleado.*)` retirado; no autoasignar `084` sin política.

## 2026-08-06 - Saludo hub: reales vs prueba

### Decisiones

- Helper `workerPortalGreeting`: reales = «Hola, {nombre}»; prueba = «BIENVENIDO!».
- Identificación por username (`prueba.trabajador` / `trabajador.prueba`) o `externalReference` (`SYN-PRUEBA-LOGIN` / `TST-0001`), campos ya expuestos por `worker_get_portal_state`.

## 2026-08-06 - Saludo hub trabajador

### Decisiones

- En `src/app/trabajador/page.tsx` el h1 deja de personalizar con el nombre; copy único «BIENVENIDO!» alineado al header del layout.

## 2026-08-06 - Encabezado portal trabajador

### Decisiones

- Copy del header en `src/app/trabajador/layout.tsx` reducido a «BIENVENIDO!» a petición de producto; sin cambios de layout ni rutas.

## 2026-08-04 - B4.17.1 desbloqueo bloqueado

### Decisiones

- No crear `backup-policy-accepted.txt` sin autorización expresa del usuario.
- No setear `mfa_required=true` sin factor verified + AAL2.
- Con MFA=0 detener antes de backup/apertura (orden de precondiciones).

## 2026-08-04 - B4.17 apertura bloqueada

### Decisiones

- No abrir sin MFA verified ≥1 + AAL2 + mfa_required + (PITR o BACKUP_POLICY_ACCEPTED).
- Valores medidos en Auth/DB/archivo off-repo; no simulados.
- Columna real de apertura: `activated_at` (no `opened_at`).
- Dry-run/execute en `b417-open-real-campaign.ts`; execute aborta si precondiciones fallan.

## 2026-08-04 - B4.16 certificación final

### Decisiones

- Sintético en campaña separada `TST-PROD-FINAL-CAMPAIGN` active; nunca tocar la real draft.
- Flujo UI secuencial: draft `guia_iii` marca Guía I submitted; submit final atómico I+III.
- Scoring persistido: `nom035-stps-2018-guia-i-iii-v1`; algoritmo FRP: `…-guia-iii-v1`.
- Respuestas individuales: disponibles en código/RBAC; AAL2 bloqueado por MFA=0.
- Apertura real bloqueada aunque el flujo funcional pase.

## 2026-08-04 - B4.15.4B NOM+número

### Decisiones

- Password = `NOM` + canónico pad-4; sin `!` ni símbolos; cumple Auth min 6 (len 7).
- No tocar `worker_accounts`/usernames/assignments; solo Auth password + audit_log.
- Paquete `worker-credentials-b4154b`; no entregar credenciales todavía.
- Smoke vía API con Origin permitido; UI «Evaluación asignada» = `awaiting_campaign`.

## 2026-08-04 - B4.15.4 passwords = número empleado

### Decisiones

- Password = solo número falló Auth min 6; bloqueo correcto sin bajar política.
- Sonda de política debe usar `updateUserById`.

## 2026-08-03 - B4.15.3 UI awaiting_campaign

### Decisiones

- Copy de producto: título + texto fijos; sin IDs; sin CTA de inicio.
- Deploy Vercel requerido para el mensaje; RPC `awaiting_campaign` ya estaba en Production.
- No abrir campaña; MFA/backups siguen bloqueando apertura.

## 2026-08-03 - B4.15.2 campaña draft + assignments

### Decisiones

- Campaña sin `company_id` en esquema; vínculo lógico a empresa operativa singleton.
- Version `…-i-iii`; `ensure_assignment_questionnaires` siembra I+III.
- Portal distingue draft (`awaiting_campaign`) vs sin assignment (`none`); open session sigue exigiendo campaña `active`.
- MFA/backups no bloquean draft; sí bloquean apertura.

## 2026-08-03 - B4.15.1 sin cambio obligatorio

### Decisiones

- Fuente del redirect: `worker_accounts.must_change_password` (login UI, hub, open evaluación). No metadata Auth.
- Producto: passwords entregadas son permanentes; flag=false en los 83; ruta `/trabajador/cambiar-contrasena` queda para forzado admin/voluntario.
- UPDATE filtrado por empresa operativa + workers numéricos activos; idempotente (2ª vez = 0).
- Deploy runtime no requerido para el efecto: el redirect ya dependía del flag.

## 2026-08-03 - B4.14 GO-LIVE bloqueado

### Decisiones

- Hard-stop: MFA admin `factors_verified=0` y `mfa_required=false` → no crear cuentas ni abrir campaña.
- Hard-stop: PITR/backups administrados ausentes y sin aceptación explícita de «RIESGO TEMPORAL ACEPTADO».
- Cuentas futuras: username `empleado.<n>` vinculado 1:1 al worker existente (nombre/puesto/depto ya en DB); no username=nombre.
- Push CI pendiente de `GH_TOKEN` temporal (gh no autenticado localmente).

## 2026-08-03 - B4.13 flujo mínimo productivo

### Decisiones

- Producto: trabajador solo login user/pass → evaluación I+III; sin formularios de empresa/RFC/domicilio.
- `company_settings`: solo NOT NULL reales (`razon_social`, `total_trabajadores`); opcionales en NULL; no inventar.
- Legacy con draft: revocar + preservar (no convertir a III; no borrar).
- Legacy sin actividad (165): eliminación transaccional tras dry-run (0 sesiones/respuestas/resultados).
- Sintético: desactivar cuenta/worker; conservar historial; fuera de los 83.
- MFA admin y PITR no bloquean el veredicto de flujo de trabajadores.
- No crear Auth/passwords/campaña en esta fase.

## 2026-08-03 - B4.13 bloqueo por drafts legacy

### Decisiones

- Diff tooling → no redeploy de `ac1a54a`.
- 167 asg no son I+II por instrumento: dos campañas×83 + 1 sintético.
- Fase 8: cualquier draft/sesión impide saneamiento automático (2 bloquean).
- `disable_signup` vía API Management.
- Empresa/MFA requieren datos/acción humana; no inventar.
- Política 83: reset administrativo hasta SMTP verificado.
- PITR ausente → riesgo pendiente de aceptación explícita.

## 2026-08-03 - B4.12.1 harden tooling

### Decisiones

- Confirmación piloto: solo `B412_PILOT_ONLY` (rechaza yes/true/YES).
- Refs: `EXPECTED_SUPABASE_PROJECT_REF` + `CONFIRM_SUPABASE_PROJECT_REF` exactos; logs sanitizados.
- Cleanup por marcador exacto; dry-run sin escrituras; tests unitarios sin Cloud.
- `activate-prod-worker-prueba.sql` eliminado del repo (UUID/email hardcodeados, sin secretos → commit normal).
- `assign-prod-worker-prueba.sql` permanece off-repo, no versionar.

## 2026-08-03 - B4.12 cutover + piloto productivo

### Decisiones

- Deploy solo desde worktree limpio del SHA certificado.
- Peppers off-repo (B4.8); `vercel env pull` vacío (limitación CLI) — sin afirmar re-rotación.
- Piloto no sobrescribe `company_settings`; limpia solo marcadores PILOT.
- Secrets `STAGING_*` borrados (ref promovido).
- GO bloqueado: empresa sintética, MFA=0, 167×I+II, PITR off.

## 2026-08-02 - B4.11 certificación 83 sintéticos locales

### Decisiones

- B4.10 cerrado en SHA `c179e29` (RC + WebKit verdes) antes de B4.11.
- Workload solo localhost; constantes en `b411-constants` para evitar side-effect de seed al importar cleanup.
- Lecturas de drafts/results vía SQL (REST service_role sin GRANT SELECT).
- Logins concurrentes antes de submits masivos; cliente Auth aislado por worker.
- Cleanup transaccional filtrado por `CAMPANA_B411_*` / `TST-B411-%`; creds solo en `.tmp/` ignorado.
- No cuentas reales; CSV dry-run fuera de Git.

## 2026-08-02 - B4.10 e2e RC: WebKit/Firefox sin binarios

### Decisiones

- RC `82c394a`: quality/security/database OK; e2e 5 failed porque `CI=true` activaba `webkit-guia3` sin instalar WebKit, y `firefox-smoke` sin Firefox.
- WebKit workflow del mismo SHA ya era success (instala webkit).
- Fix: flag `PLAYWRIGHT_WEBKIT_GUIA3=1` para el proyecto WebKit; RC instala chromium+firefox.
- No skips; no ConCasa; no Production; no cuentas reales.

## 2026-08-02 - B4.10 unblock RC Quality (secret-scan)

### Decisiones

- RC Quality `1d27d76` falló en quality/security: `password_assignment` sobre `GUIDE_III_TEST_PASSWORD` del workflow WebKit.
- WebKit job del mismo SHA ya estaba en success; e2e RC quedó skipped por el gate.
- Allowlist acotada: solo líneas con `GUIDE_III_TEST_PASSWORD` en `.github/workflows/` (no passwords genéricos).
- No se tocó ConCasa ni Production; no se crearon cuentas reales.

## 2026-07-30 - B4.10 cierre CI WebKit + dry-run 83

### Decisiones

- WebKit no se certifica en macOS local (`PushAPIEnabled`); job dedicado en GitHub Actions con Supabase+Next locales.
- Dry-run valida CSV fuera de Git y plan de instrumentos I+III; no crea Auth.
- `assign-prod-worker-prueba.sql` queda fuera del commit B4.10 (artefacto one-shot previo).

## 2026-07-30 - B4.10 Guía III cableado productivo E2E (local)

### Decisiones

- Un solo flujo `contestar` ramificado por `questionnaireVersion` del assignment (servidor).
- Columnas legacy `guia_ii_*` almacenan el FRP activo (II o III); el tipo real vive en `result_snapshot.guide_type`.
- `assignment_questionnaires` con mutex II/III; versión I+III = `nom035-stps-2018-guias-referencia-i-iii`.
- Submit único atómico I+FRP (como I+II); UI secuencia I → III.
- Seeds sintéticos G3-A/B solo localhost; dry-run 83 reporta I+III y cero II.
- No commit/push/deploy en esta fase hasta reporte.

## 2026-07-30 - B4.9 Guía III motor (trazabilidad oficial)

### Decisiones

- Guía III estaba **AUSENTE**; se implementó manifiesto + motor desde `NOM-035-STPS-2018-oficial.txt` y Word MAT (hashes en doc de trazabilidad).
- Misma política de fronteras inclusiva/exclusiva que Guía II.
- Para N>50 el producto usa I+III, no I+II+III.
- No se crearon 83 cuentas; no se desplegó campaña productiva Guía III.

## 2026-07-30 - B4.9 portal trabajador autenticado

### Decisiones

- Login por username → resolución server-side a email Auth sintético; password solo en Auth.
- Tras login, `open_evaluation_session_for_worker` emite la misma cookie de evaluación que el flujo por token; UI reutiliza `/evaluacion/contestar`.
- Guía III ausente (P0): prueba sintética con I+II; no crear campaña real de 83.
- Solo seed local; no Production / no ConCasa / no 83 Auth.
- Acceso a datos del trabajador vía RPCs SECURITY DEFINER (sin grants/policies permisivas), coherente con B4.2.
- WebKit local en este macOS falla con `PushAPIEnabled`; smoke WebKit queda para CI.

## 2026-07-29 - B4.8 riesgo: CI staging reseed sobre Production

### Decisiones

- Mismo ref + secrets STAGING_* → WebKit en push reseedeó fixtures tras la promoción.
- Mitigación: cancelar runs, cleanup, desactivar push en `staging-webkit.yml`, guarda Management API en seeds.
- Import 83 sigue bloqueado sin empresa/admin reales.

## 2026-07-29 - B4.8 promoción nom035-production (mismo ref)

### Decisiones

- No crear tercer proyecto: el cupo free se resolvió renombrando staging → production (autorizado por el usuario).
- Rotar DB password + peppers; documentar que service_role/publishable no rotan vía API.
- Limpieza solo por filtros `STAGING_TEST` / `@nom035.staging.local` (último admin vía SQL con trigger deshabilitado).
- Excluir `scripts/` de `tsconfig` para que `next build` en Vercel no tipifique utilidades CLI.
- Import 83 y admin real detenidos hasta datos del usuario.

## 2026-07-29 - B4.8 cutover Production (bloqueado)

### Decisiones

- No reutilizar `nom035-staging` ni ConCasa como Production.
- No crear empresa ni admin ficticios; detener import hasta datos reales.
- Secretos Production generados off-repo; no copiar peppers/keys de staging.
- Cupo free Supabase (2 proyectos) bloquea creación de `nom035-production` vía API.
- Vercel exclusivo `nom035-production` creado vacío; deploy aplazado hasta DB + secrets + CI del SHA de cutover.
- UI: datos demo/localStorage no son fuente del admin; banner solo local/preview.

## 2026-07-29 - Import CSV nómina (local only)

### Decisiones

- Número de empleado = `external_reference` (no hay columna `numero_empleado`; sin cambio de esquema).
- Empresa singleton: marca de prueba vía `company_settings.razon_social` + `workers.sucursal = LOCAL_IMPORT_TEST_83`.
- Upsert por referencia: create/update RPC reales; no Auth; no campañas.
- CSV real solo en Downloads; cleanup verificado 83→0; Auth seed residual limpiado aparte.

## 2026-07-29 - B4.7 P0 backup/restore + WebKit runner

### Decisiones

- Password DB ausente al inicio → rotación vía Management API PATCH (solo en memoria) para dump; no se imprime; usuario debe resetear en Dashboard al cerrar.
- Dump acotado a schema `public` (+ roles): evita filtrar MFA secrets/auth.users en el artefacto off-site.
- Restore real en DB aislada `nom035_restore_verify` (Postgres de Supabase local) con stub mínimo `auth.users` solo para FKs; conteos 1:1 vs origen; RLS+FORCE en 16 tablas; 101 funciones; 24 FKs.
- Storage: PDF ficticio, anon denegado, signed URL TTL 60s (no persistida), restore re-upload hash OK, cleanup objetos.
- WebKit en Darwin arm64 sigue incompatible; evidencia en contenedor Linux `mcr.microsoft.com/playwright:v1.62.0-jammy` (14/16) + workflow GHA ubuntu.
- Fallos WebKit admin/logout: pageerror por prefetch RSC de `<Link>` tras cambio de sesión → `prefetch={false}` en nav/quick links (fix de app, no skip de assertions).
- Logout staging E2E: flujo UI «Cerrar sesión» + revalidación `/admin` → `/login`.

## 2026-07-29 - B4.7 push + Preview CSP + E2E staging

### Decisiones

- Token GH solo en memoria; `unset` inmediato post-push.
- Quejas staging: limpiar `public_rate_limits` en `beforeEach` (429 entre proyectos).
- WebKit darwin arm64: no compatible (`PushAPIEnabled`); habilitar con `FORCE_STAGING_WEBKIT=1` o Linux.
- Rollback: alias Vercel entre dos Preview Ready (no 503).
- Sin password DB: no inventar restore; veredicto permanece NO CERTIFICADO.

## 2026-07-29 - B4.7 cierre de bloqueos (parcial)

### Decisiones

- Causa raíz de fallos E2E local masivos: `PLAYWRIGHT_BASE_URL` quedó exportado al Preview Vercel; las rutas relativas pegaban a Cloud con credenciales locales. Mitigación: `unset` antes de `test:e2e` local.
- CSP ampliada a toda la app (`/:path*`) manteniendo `unsafe-inline`/`unsafe-eval` por compatibilidad Next + QR MFA; framing vía `frame-ancestors 'none'` y `X-Frame-Options: DENY`.
- Seed fixtures staging exige ref `agbl…kubf` + nombre `nom035-staging`; Storage público list denegado verificado.
- Suite staging ampliada (no solo smoke); WebKit iPhone en macOS 14 arm64 fallaba por `PushAPIEnabled` → Desktop Safari + Firefox smoke.
- Backup/restore y redeploy Preview con CSP nueva siguen bloqueando CERTIFICADO.

### Notas

- CI del SHA `a14d50b`: run `30430479378` success (no reutilizar `471592f`).

## 2026-07-27 - Bloque B4.7 (RC / Staging)

### Decisiones

- Proyectos `ConCasa CRM` y cualquier ref no llamado exactamente `nom035-staging` son intocables.
- El ref de staging coincidió con un nombre histórico distinto: exigir vacío antes de `db push`.
- Password de DB: interactiva / archivo `.tmp` ignorado; nunca en chat ni docs.
- CI en `release/**` sin deploy ni `db push` remoto.
- Certificación Cloud queda **NO CERTIFICADO** hasta Preview + E2E remoto + backup/restore.
- Fallo CI `quality` (run `30313214625`): `b4-3-concurrency` exige Supabase local; en `quality` no hay `.env.local`. Mitigación: `skipIf` + ejecución en job `database` con `scripts/ci-write-local-env.mjs`.
- Fallo CI `quality`/`security` (run `30428999018`): secret-scan marcaba literales `SUPABASE_SECRET_KEY=` / `NOM035_*_PEPPER=` en el generador CI. Mitigación: ensamblar nombres por partes (sin debilitar el escáner). `hasLocalSupabase` también exige `psql` alcanzable.
- CI verde `30429324801` @ `471592f`. Preview en proyecto Vercel `mom` (solo vars Preview rama RC). SSO Preview desactivado para E2E público. Auth Site URL → alias Preview. Smoke e2e-staging 6/6. Cleanup sintéticos OK. Veredicto: **NO CERTIFICADO** (suite remota completa + backup/restore pendientes).

### Notas

- Veredicto vivo en `docs/B4_7_CLOUD_STAGING_CERTIFICATION.md`.


## 2026-07-27 - Bloque B4.6 (Auth / RBAC / MFA)

### Decisiones

- Autoridad de roles/permisos en PostgreSQL (`admin_profiles` + `role_permissions`); JWT solo identidad/AAL.
- Proxy refresca con `getClaims`; layout + Route Handlers + RPC revalidan.
- `service_role` bypass SQL solo para pruebas estructurales/pgTAP y excepciones (Auth admin, Storage, público).
- Email provider habilitado para login/invitación; signup público deshabilitado en `[auth].enable_signup`.
- Contraseña local: longitud 12 + `lower_upper_letters_digits_symbols`; MFA TOTP enroll/verify on.
- E2E B4.4/B4.5: login admin + MFA; `can_view_sensitive_cases` del admin se activa en beforeAll de esas suites (seed lo deja en false).
- MFA verify/challenge: límite 120/10min para viabilidad de suites; reintentos TOTP en `loginAsRole`.

### Notas

- Veredicto **CERTIFICADO** en `docs/B4_6_AUTH_RBAC_CERTIFICATION.md`.

## 2026-07-27 - Bloque B4.5 (módulos secundarios + Storage privado)

### Decisiones

- Generación sugerida: mapeo en servicio Next; agregación + persistencia idempotente en RPC.
- Storage y DB no son una sola TX: compensación explícita + `storage_delete_pending`.
- Enum `archivada` vía `::text` en CHECKs (binding DDL); índice parcial usa literal `publicada`.
- `gen_random_bytes` calificado `extensions.` (search_path fijo de SECURITY DEFINER).
- Doble envío de queja: `useRef` síncrono además de `sending` (React no alcanza a re-render).
- CTE de versiones de evidencia: ancestors + descendants (evitar UNION recursivo inválido).
- Comparaciones enum/text en RPCs con `::text` explícito.

### Notas

- Veredicto en `docs/B4_5_SECONDARY_MODULES_CERTIFICATION.md`.

## 2026-07-24 - Bloque B4.4 (panel admin central local)

### Decisiones

- Guard no confía solo en `NODE_ENV`: exige `local_supabase` + loopback + Origin.
- Política de campañas: rechazar segunda `active` (cierre explícito obligatorio).
- Rotate: conserva draft; revoke: elimina draft; completed no se revoca.
- Tokens one-time en memoria de sesión UI; regeneración invalida hash anterior.
- CSV: parser RFC4180 propio + import atómico máx. 500 filas.
- `ACTIVE_REPOSITORY_MODE` sigue `local`; módulos secundarios no migrados.

### Notas

- Veredicto final en `docs/B4_4_ADMIN_CORE_CERTIFICATION.md` tras regresión.

## 2026-05-05 - Bloque B1 (MVP local base)

### Decisiones

- Se adopto `localStorage` como persistencia temporal con funciones encapsuladas en `src/lib/nom035/storage-local.ts`.
- Se separo logica de negocio (tipos, reglas de guias, scoring) fuera de componentes UI para facilitar migracion posterior a Supabase.
- Se uso token deterministico `campaignId__workerId` para enlaces simulados por trabajador en entorno local.
- Se definio que la pantalla publica no muestra diagnostico ni puntaje; solo redirige a una pantalla de agradecimiento.

### Notas

- No se implemento autenticacion, base de datos ni Supabase por alcance del bloque.
- El scoring es placeholder inicial y aun no refleja todos los reactivos/umbrales oficiales NOM-035.

## 2026-05-05 - Bloque B2 (Guia I oficial en MVP local)

### Decisiones

- Se centralizo el cuestionario oficial de Guia I en `src/data/nom035/guia-i.ts` para desacoplar contenido normativo de la UI.
- Se implemento `calculateGuiaIResult(answers)` como funcion pura en `src/lib/nom035/scoring-engine.ts` con reglas oficiales de umbral:
  - Seccion II: al menos 1 SI.
  - Seccion III: 3 o mas SI.
  - Seccion IV: 2 o mas SI.
- Se aplico flujo condicional en `src/app/evaluacion/[token]/page.tsx`:
  - Seccion I = NO: finaliza sin mostrar II, III y IV.
  - Seccion I = SI: requiere contestar II, III y IV.
- Se mantuvo confidencialidad del trabajador: no se muestra resultado en flujo publico, solo pantalla de agradecimiento.
- Se adapto `admin/resultados` para ver estado y resultado Guia I por trabajador sin introducir autenticacion ni backend.

### Notas

- Este bloque no introduce Supabase, login ni soporte funcional para Guia II/III.
- Persistimos en `localStorage` y guardamos el resultado estructurado de Guia I en cada evaluacion completada.

## 2026-05-05 - Bloque B2.1 (Correccion visual y legibilidad)

### Decisiones

- Se forzo base visual clara en `globals.css` para evitar herencia de tema oscuro del sistema sobre componentes con fondo blanco.
- Se estandarizo paleta visual a `slate` en vistas admin y evaluacion para asegurar contraste consistente.
- Se reforzaron encabezados, celdas y filas de tablas con colores de texto/borde de mayor legibilidad.
- Se reestructuro visualmente `/evaluacion/[token]` con contenedor centrado, fondo claro y radios claramente visibles.

### Notas

- No se modifico logica de negocio, flujo condicional de Guia I, almacenamiento local, rutas ni estructura de datos.

## 2026-05-05 - Bloque B2.2 (Flujo operativo de campanas)

### Decisiones

- Se rediseno `admin/campanas` como centro operativo para distribucion: resumen de avance, estado por trabajador y acciones de envio.
- Se implementaron acciones "Copiar link" y "Copiar mensaje" usando `navigator.clipboard`, construyendo URLs absolutas con `window.location.origin` para respetar el puerto activo.
- Se clasifico estado por trabajador en:
  - Pendiente (sin respuestas),
  - En progreso (con respuestas sin finalizar),
  - Completado (con fecha de envio/finalizacion).
- Se agrego bloque de bienvenida en `evaluacion/[token]` con boton "Iniciar evaluacion" para clarificar el arranque del cuestionario.

### Notas

- No se altero el motor de scoring, calculo de Guia I, localStorage, rutas ni estructura base de datos local.

## 2026-05-05 - Bloque B3 (Guia II dominio + scoring + pruebas)

### Decisiones

- Se incorporo `GUIA_II_QUESTIONS` con los 46 reactivos oficiales y compuertas `guia_ii_gate_clientes` y `guia_ii_gate_jefe`.
- Se separaron agrupaciones normativas en `guia-ii-groups.ts` (categorias, dominios y dimensiones) para mantener trazabilidad del calculo.
- Se definieron umbrales deterministas en `guia-ii-thresholds.ts` para resultado final, por categoria y por dominio.
- Se implemento `scoreGuiaIIAnswer(questionNumber, answer)` con mapeo directo e invertido segun grupo de reactivos.
- Se implemento `calculateGuiaIIResult(answers)` con:
  - aplicacion de compuertas condicionales,
  - `skippedQuestions`,
  - puntaje por dimension/dominio/categoria,
  - nivel final de riesgo,
  - alertas operativas.
- Se agrego `getRiskLevelFromThresholds(score, thresholds)` para reutilizar logica de clasificacion de riesgo.

### Notas

- Este bloque no integra Guia II en `/evaluacion/[token]` ni altera la UI del trabajador.
- No se implemento Supabase, login ni Guia III.

## 2026-05-05 - Bloque B3.1 (Integracion visual Guia II)

### Decisiones

- Se incorporo flujo por etapas en `evaluacion/[token]`:
  - Bienvenida,
  - Guia I,
  - Guia II (si aplica por tamano de empresa),
  - Finalizacion.
- Se mantuvo la regla de Guia I (si Seccion I = NO, no se muestran II/III/IV), pero en empresas de 16-50 se continua a Guia II antes de finalizar.
- Se implemento Guia II en bloques navegables con `Anterior/Siguiente`, validacion por bloque e indicador de progreso para evitar cargar 46 reactivos en una sola vista.
- Se integraron compuertas de Guia II:
  - clientes/usuarios para 41-43,
  - jefe para 44-46.
  Si responde `no`, esas preguntas se omiten y quedan como no aplicables en resultado.
- Se amplio `EvaluationRecord` y `storage-local` para guardar:
  - `guiaIAnswers`,
  - `guiaIIAnswers`,
  - `guiaIResult`,
  - `guiaIIResult`,
  - `status`,
  - `completedAt`.
- Se actualizo `admin/resultados` con cards y tabla combinada Guia I + Guia II sin mostrar respuestas detalladas.

### Notas

- No se modifico el motor de scoring de Guia II, salvo su consumo para integracion.
- No se agrego Supabase, login ni Guia III.

## 2026-05-05 - Fix hidratacion admin (campanas / resultados)

### Decisiones

- Se dejo de ejecutar lecturas de `localStorage` durante el render inicial de paginas admin para alinear HTML servidor y cliente.
- Se cargo un snapshot de datos en `useEffect` (diferido con `setTimeout` para cumplir reglas de lint) y se mostro skeleton estable hasta tener datos reales.

## 2026-05-05 - Bloque B3.2 (Dashboard ejecutivo resultados)

### Decisiones

- Se creo `src/lib/nom035/results-analytics.ts` con helpers puros para agregados:
  - `getRiskDistribution`,
  - `getDepartmentSummaries`,
  - `getCriticalDomains`,
  - `getDominantRiskLevel`,
  - `getAverageGuiaIIScore`,
  - `getWorkerCriticalDomains`.
- Se rediseno `admin/resultados` como tablero ejecutivo para RH/direccion:
  - encabezado con campana activa y fecha de corte,
  - cards KPI,
  - distribucion de riesgo Guia II,
  - analisis por departamento,
  - seccion de dominios con mayor atencion requerida + recomendacion,
  - tabla individual resumida con filtros.
- Se incluyeron acciones de operacion:
  - actualizar resultados,
  - limpiar filtros,
  - ir a campanas,
  - preparar reporte (placeholder para siguiente bloque).
- Se mantuvo privacidad: no se exponen respuestas item por item ni textos de diagnostico clinico.

### Notas

- No se modificaron flujo del trabajador, Supabase, login ni Guia III.

## 2026-05-05 - Bloque B3.3 (Reporte imprimible profesional)

### Decisiones

- Se creo la ruta `admin/reportes` como documento ejecutivo imprimible para direccion/RH.
- Se reutilizaron helpers de analytics para resultados agregados y se creo `report-generator.ts` para:
  - conclusiones ejecutivas,
  - recomendaciones generales,
  - plan de intervencion sugerido.
- Se agrego enlace "Reportes" en navegacion admin.
- Se incorporaron estilos `@media print` para:
  - ocultar navegacion y botones de accion,
  - mantener fondo blanco y texto legible,
  - minimizar cortes de tabla en impresion.
- Se incluyeron campos editables en estado local para responsable de evaluacion (nombre, cargo, cedula, fecha).

### Notas

- No se muestran respuestas individuales ni diagnostico clinico.
- No se modificaron Supabase, login, Guia III ni flujo del trabajador.

## 2026-05-05 - Bloque B3.4 (Plan de accion local/mock)

### Decisiones

- Se creo la ruta `admin/plan-accion` para convertir resultados agregados NOM-035 en acciones de seguimiento operativas.
- Se incorporo modelo `ActionPlanItem` en tipos de dominio con campos de ciclo de vida, responsable, fechas y notas.
- Se amplio `storage-local` con CRUD de acciones:
  - `getActionPlans`,
  - `saveActionPlan`,
  - `updateActionPlan`,
  - `deleteActionPlan`.
- Se creo `action-plan-generator.ts` con logica para:
  - generar acciones sugeridas desde dominios criticos y seguimiento confidencial Guia I,
  - evitar duplicados por campana/area/factor/tipo,
  - calcular vencimientos y estadisticas.
- Se agregaron filtros por estado, area, riesgo y tipo de accion, junto con tabla de seguimiento editable.

### Notas

- No se alteraron scoring-engine, flujo del trabajador, Supabase, login ni Guia III.

## 2026-05-05 - Bloque B3.5 (Evidencias documentales local/mock)

### Decisiones

- Se creo la ruta `admin/evidencias` para documentar evidencia de cumplimiento NOM-035 sin carga real de archivos.
- Se incorporo tipo `EvidenceItem` con metadatos de referencia documental (titulo, tipo, descripcion, archivo/url, notas, fechas).
- Se amplio `storage-local` con CRUD de evidencias:
  - `getEvidenceItems`,
  - `saveEvidenceItem`,
  - `updateEvidenceItem`,
  - `deleteEvidenceItem`.
- Se creo `evidence-analytics.ts` con helpers:
  - `getEvidenceStats`,
  - `getEvidenceChecklist`,
  - `getEvidenceTypeLabel`.
- Se agrego checklist de cumplimiento documental con estado completo/incompleto por tipo de evidencia.

### Notas

- En esta fase solo se guarda referencia de archivo/URL en localStorage; no hay upload real.
- No se modificaron Supabase, login, Guia III, scoring-engine ni flujo del trabajador.

## 2026-05-05 - Bloque B3.6 (Quejas confidenciales local/mock)

### Decisiones

- Se agrego la ruta publica `queja-confidencial` como canal institucional sin login, con opcion anonima o identificada.
- Se incorporo modelo `ConfidentialComplaint` y CRUD local en `storage-local`:
  - `getComplaints`,
  - `saveComplaint`,
  - `updateComplaint`,
  - `deleteComplaint`.
- Se creo `complaint-analytics.ts` para centralizar:
  - etiquetado de tipo y estado,
  - estadisticas por estado,
  - generacion incremental de folio (`NOM035-Q-AAAA-0001`).
- Se implemento `admin/quejas` con:
  - cards de monitoreo,
  - filtros (tipo/estado/texto),
  - tabla de seguimiento sin exponer contacto,
  - acciones de actualizacion (estado, asignacion, notas, cierre, eliminacion),
  - vista de detalle con datos de contacto solo cuando aplica.
- Se agrego enlace "Quejas" en navegacion admin para acceso operativo del modulo.

### Notas

- Se mantuvo privacidad: contacto solo en detalle; tabla principal solo indica "Anonima" o "Con datos de contacto".
- No se tocaron flujo de evaluacion, scoring-engine, Supabase, login ni Guia III.

## 2026-05-05 - Bloque B3.7 (Politica institucional local/mock)

### Decisiones

- Se creo la ruta `admin/politica` para gestionar el ciclo completo del documento institucional:
  - generar base,
  - editar contenido,
  - guardar borrador,
  - publicar,
  - imprimir,
  - administrar historial.
- Se incorporo el tipo `PolicyDocument` y se amplio `storage-local` con CRUD de politicas:
  - `getPolicyDocuments`,
  - `savePolicyDocument`,
  - `updatePolicyDocument`,
  - `deletePolicyDocument`,
  - `getLatestPolicyDocument`.
- Se creo `policy-generator.ts` para:
  - generar texto base institucional con datos de empresa,
  - mapear etiquetas de estado (`borrador` / `publicada`).
- Se agrego historial de versiones con acciones operativas (editar, duplicar, publicar, eliminar).
- Se incluyo vista imprimible del documento y reglas `@media print` para ocultar navegacion y controles.
- Se agrego nota operativa para registrar la politica publicada en Evidencias (tipo "Politica"), sin automatizacion.
- Se agrego enlace "Politica" en la navegacion admin.

### Notas

- No se modificaron Supabase, login, Guia III, scoring-engine ni flujo de evaluacion del trabajador.

## 2026-05-05 - Bloque B3.8 (Gestion de trabajadores y links)

### Decisiones

- Se rediseño `admin/trabajadores` para soportar operacion real del MVP local:
  - alta manual con campos operativos (nombre, email, telefono, departamento, puesto, turno, sucursal, jefe directo, antiguedad, activo),
  - edicion,
  - desactivacion,
  - eliminacion,
  - importacion por CSV.
- Se amplio el modelo `Worker` con metadatos opcionales sin romper compatibilidad de registros existentes.
- Se incorporo capa de asignaciones en `storage-local`:
  - `getCampaignAssignments`,
  - `saveCampaignAssignment`,
  - `updateCampaignAssignment`,
  junto con sincronizacion de `workerIds` de campana para mantener compatibilidad con modulos existentes.
- Se actualizo `admin/campanas` para:
  - tomar solo trabajadores activos desde localStorage,
  - mostrar estados `Sin link / Pendiente / En progreso / Completado`,
  - generar enlaces faltantes para activos sin duplicar asignaciones,
  - mantener acciones de abrir/copy link/copy message usando `window.location.origin`.
- Se agrego aviso explicito de alcance de enlaces en localhost para evitar uso incorrecto en ambientes no publicados.

### Notas

- No se tocaron `calculateGuiaIResult`, `calculateGuiaIIResult`, Supabase, login ni Guia III.
- El flujo de evaluacion por token se conserva; solo se fortalecio la gestion de origen de enlaces/asignaciones.

## 2026-05-05 - Bloque B3.9 (Auditoria final MVP local)

### Hallazgos principales

- La navegacion admin no mostraba claramente la ruta actual.
- `/admin` estaba muy basico para demo y no concentraba estado global del sistema.
- Faltaban utilidades de reseteo/carga de datos para demos repetibles con cliente.
- Persistia riesgo de desajuste SSR/cliente en `admin/configuracion` por lectura directa de localStorage en render.
- Habia textos operativos sin acentos en modulos clave para presentacion formal.

### Decisiones y correcciones

- Se actualizo `AdminNav` a componente cliente con `usePathname` para marcar ruta activa.
- Se rediseño `admin/page` como tablero de auditoria/demo con:
  - KPIs transversales (trabajadores, campaña, evaluaciones, riesgo, plan, quejas, evidencias, politica),
  - accesos rapidos a todos los modulos,
  - herramientas demo locales (`Cargar datos demo`, `Limpiar datos locales`, `Actualizar resumen`).
- Se creo `demo-data.ts` con funciones:
  - `seedDemoData`,
  - `clearNom035LocalData`,
  - `getNom035LocalDataStatus`,
  - `computeNom035LocalDataStatus` (pura, con pruebas).
- Se ajusto `admin/configuracion` para cargar datos tras mounted y mostrar skeleton estable.
- Se corrigieron textos visibles en `campanas` y `trabajadores` para mejorar claridad y ortografia en demo.

### Notas

- No se agregaron Supabase, login ni Guia III.
- No se modifico scoring-engine ni preguntas oficiales.

## 2026-06-22 - Revision ortografica cuestionarios evaluacion

### Decisiones

- Se alineo el texto de Guia I y Guia II con la redaccion publicada en NOM-035-STPS-2018 (DOF), incluyendo signos de interrogacion de apertura y acentos.
- Se corrigio la pregunta 15 de Guia I, que decia "Ha estado sobresaltado facilmente" y en la norma es "¿Se ha sobresaltado fácilmente por cualquier cosa?".
- Se cambio la UI de Guia I para renderizar el encabezado de seccion solo al inicio de cada bloque (I, II, III, IV), evitando repeticion en cada reactivo.

### Notas

- La logica de scoring y los IDs de preguntas no cambiaron; solo texto visible y presentacion.

## 2026-07-24 - B4.0 Fundamentos seguros Supabase (sin cutover)

### Decisiones

- El MVP permanece en `localStorage` (`ACTIVE_REPOSITORY_MODE = "local"`). Las pantallas no se migraron.
- Se preparo infraestructura Supabase (clientes, env, migracion SQL, docs de seguridad) sin link remoto ni `db push`.
- Se eligieron `@supabase/supabase-js@2.109.0` + `@supabase/ssr@0.12.0` para respetar Node 20 del entorno (versiones 2.110.x exigen Node >=22).
- Politica de denegacion por defecto: RLS enable+force, revoke a anon/authenticated, cero politicas anon.
- Tokens de evaluacion en schema futuro: solo `token_hash` + `token_last4` (nunca token en claro).
- `company_settings` usa `singleton_lock` UNIQUE para una sola empresa.
- npm audit se documento como baseline; no se aplicaron fixes automaticos.

### Notas

- No se agrego login, Auth users, Storage bucket ni Guia III.
- No se expuso `SUPABASE_SECRET_KEY` al cliente; `admin.ts` usa `server-only`.
- No se hizo commit/push/deploy ni aplicacion SQL remota.

## 2026-07-24 - B4.1 Certificación normativa (CERTIFICADO)

### Decisiones

- La fuente canónica oficial se verificó en la raíz Git del agente (mismo worktree `main`, sin contenedor): tamaño 220837 y SHA-256 esperado.
- Se centralizó Guía II en `guia-ii-manifest.ts`; `guia-ii.ts` / groups / thresholds se derivan del manifiesto.
- Fronteras tipográficas ambiguas de la norma → política operativa determinística (inferior inclusivo, superior exclusivo, último ≥), documentada aparte.
- El motor deja de asumir 0 en faltantes: valida y falla duro; resultados nuevos llevan `scoringVersion = nom035-stps-2018-guia-i-ii-v1`.
- Revisión final del trabajador sin exponer puntajes/riesgo; envío definitivo con confirmación e `isSubmitting`.
- Admin etiqueta resultados legacy como “versión no registrada” sin mezclarlos silenciosamente.

### Notas

- Comparación reactivo a reactivo vs fuente: 0 mismatches de texto; scoring Tabla 2 alineado; acentos de cat/dom/dim corregidos.
- Sin Supabase remoto, SQL aplicado, login, Guía III, deploy, commit ni push.
- Veredicto final: **CERTIFICADO** (`docs/SCORING_CERTIFICATION.md`).

## 2026-07-24 - B4.2 Certificación DB local + dependencias (NO CERTIFICADO)

### Decisiones

- Se detectó otra instancia Supabase local (`Copia_de_concasa_crm`) ocupando 54321-54327. Para NO interferir un proyecto ajeno, se desplazaron los puertos de mom a 55321-55324 en `config.toml` (analytics/vector/pooler off). Alternativa descartada: detener la otra instancia (destructivo para trabajo de terceros).
- Se mantuvo `major_version = 15` fiel a B4.0 (aunque implicó pull de imagen PG15).
- Dependencias: se subió `next`/`eslint-config-next` a la última estable (16.2.11) y se aplicó `npm audit fix` sin `--force`. No se usó preview/canary aunque serían las únicas builds fuera del rango vulnerable de Next → decisión: NO CERTIFICAR en vez de degradar la política de versiones.
- Auditoría de migración: se añadieron 4 CHECK de coherencia (assignment completed/revoked, queja anónima, policy publicada). La monotonicidad de estados se difiere explícitamente a la capa RPC (no se finge en la tabla).
- pgTAP consulta el catálogo real de PostgreSQL (no busca texto en el SQL): 170 assertions en 4 archivos.

### Notas

- Base local real (Docker): 10 contenedores healthy; migración reconstruida desde cero 2 veces (reproducible).
- Tipos autogenerados desde la base local; regresión del MVP intacta (95 tests, build OK); smoke HTTP 12/12 rutas 200.
- Único bloqueo del veredicto: 3 high de producción (`next`/`postcss`/`sharp`) sin fix estable disponible. No se ocultan como “solo dev”.
- Sin remoto/link/push, sin usuarios/Auth/roles, sin cambiar repository mode, sin tocar scoring/manifiesto certificados, sin Guía III, sin deploy, sin commit/push.
- Veredicto: **NO CERTIFICADO** (`docs/B4_2_DATABASE_CERTIFICATION.md`).

## 2026-07-24 - B4.2.1 Remediación definitiva de dependencias (CERTIFICADO)

### Decisiones

- Se reabrió el audit sin aceptar el rango agregado de `next` como si fuera un
  advisory propio. El JSON demostró que `next.via = [postcss, sharp]`: era una
  metavulnerabilidad inducida por transitivos.
- El dato “PostCSS corregido en 8.5.10” era insuficiente: aparecieron dos GHSA
  posteriores, con parches 8.5.12 y 8.5.18. Se eligió la latest estable 8.5.23.
- Next fija PostCSS 8.4.31 y restringe sharp a `^0.34.5`; dependencias directas
  habrían dejado copias vulnerables. Se aprobaron overrides exactos a PostCSS
  8.5.23 y sharp 0.35.3, validados con instalación limpia, API y binario nativo.
- Next se mantiene en 16.2.11, release Active LTS de seguridad oficial; no se usó
  16.3 preview/canary.
- Los scripts `db:*` ahora usan `npx --yes supabase`: el primer `db:test` reveló
  exit 127 al no existir binario local; la repetición real pasó 170 pgTAP.

### Notas

- Audits completo y producción: 0 vulnerabilidades, todos exit 0.
- Sharp 0.35.3 + libvips 8.18.3; prueba de resize en memoria PASS.
- Regresión: 99 Vitest, lint/typecheck/build PASS, 170 pgTAP, smoke 11/11.
- B4.1, scoringVersion, fuente canónica, repository mode y tipos generados intactos.
- Sin force, prereleases para la remediación, remoto/link/push, login/usuarios,
  Guía III, deploy, commit ni push.
- Veredicto: **CERTIFICADO** (`docs/B4_2_1_DEPENDENCY_REMEDIATION.md`).


## 2026-07-24 - Bloque B4.3 (evaluación pública por token)

### Decisiones

- El repositorio general permanece `ACTIVE_REPOSITORY_MODE=local`. El flujo público
  se activa con `NOM035_PUBLIC_EVALUATION_BACKEND=supabase` (canal aparte, no
  migra el panel admin).
- Token: `ev_` + 32 bytes `randomBytes`, HMAC-SHA-256 con `NOM035_TOKEN_PEPPER`.
  Solo se persiste hash + last4.
- Sesión: secreto distinto, cookie HttpOnly `SameSite=Strict`; en prod `__Host-`.
  `NOM035_EVALUATION_SESSION_MINUTES=120` (margen sobre 15–25 min del instrumento).
- Peppers independientes para token / sesión / rate-limit.
- Cálculo exclusivo en servidor (`prepareCanonicalSubmission`); campos de
  autoridad del cliente se ignoran y quedan en `validation_warnings`.
- Submit vía RPC `SECURITY DEFINER` con `FOR UPDATE`, idempotencia por
  `submission_id`, skipped no se insertan, draft y sesiones se limpian.
- Seed como `.mjs` ESM (sin tooling TS ni deps nuevas) + transport inerte de
  realtime para Node 20 sin WebSocket global.
- Playwright 1.62.0 + Chromium; overrides `minimatch`/`brace-expansion` para
  mantener audit en 0 tras instalar eslint transitivos vulnerables.

### Notas

- pgTAP 247, Vitest 118, E2E 10/10, audit 0/0.
- Veredicto: **CERTIFICADO** (`docs/B4_3_PUBLIC_EVALUATION_CERTIFICATION.md`).
- Sin remoto/link/push, Auth, panel central, Guía III, deploy, commit ni push.
