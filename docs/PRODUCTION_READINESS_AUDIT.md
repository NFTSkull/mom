# Auditoría de preparación para producción — Portal NOM-035

**Fecha de auditoría:** 2026-07-24  
**Alcance:** Solo evidencia y diagnóstico. **No se modificó código funcional.**  
**Único artefacto generado:** este archivo (`docs/PRODUCTION_READINESS_AUDIT.md`).  
**Restricciones respetadas:** sin funcionalidades nuevas, sin Supabase, sin cambios de scoring, sin cambios de preguntas, sin rediseño de UI, sin correcciones silenciosas.

---

## Veredicto

# NO-GO PARA PRODUCCIÓN

**Justificación (resumen):** El producto compila, pasa lint/typecheck/tests y funciona como **MVP local/demo en un solo navegador**. Toda la persistencia operativa vive en `localStorage`. Un trabajador **no puede** responder desde su celular y hacer que la respuesta aparezca en el panel administrativo de otra computadora. No hay autenticación, ni backend, ni RLS, ni Storage real, ni uso único de tokens. Eso bloquea integridad, confidencialidad y operación real con trabajadores.

---

## 1. Estado del repositorio

| Campo | Valor |
|---|---|
| Ruta exacta | `/Users/grecovillanuevaortiz/Desktop/Mom` |
| Rama actual | `main` |
| Último commit | `b037cad4b378ab1d72e34a386fa1c9286546808c` — *Corrige ortografía del cuestionario NOM-035 y encabezados de sección.* (2026-06-22) |
| `git status` | Working tree limpio (sin cambios pendientes al momento de la auditoría post-comandos) |
| Node | `v20.20.1` |
| npm | `10.8.2` |
| Next.js | `16.2.4` (package.json) |
| React | `19.2.4` (package.json) |
| `package-lock.json` | Existe (`yes`) |
| Archivos sin seguimiento / cambios no documentados | Ninguno en código funcional al cierre de comandos. Este informe es el único archivo nuevo previsto. |

**No se hizo commit ni push en este bloque.**

---

## 2. Instalación y verificaciones

Orden ejecutado: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.

| Comando | Exit code | Duración aprox. | Resultado | ¿Modificó archivos? |
|---|---|---|---|---|
| `npm ci` | `0` | ~8.3 s | 393 packages; `npm audit` reportó **7 vulnerabilidades** (1 low, 6 high) | Reinstaló `node_modules` (esperado). No cambió fuentes. |
| `npm run lint` | `0` | ~2.7 s | Sin errores ESLint reportados | No |
| `npm run typecheck` | `0` | ~1.1 s | `tsc --noEmit` OK | No |
| `npm test` | `0` | ~1.4 s (Vitest ~576 ms) | **9** archivos, **46** tests passed | No |
| `npm run build` | `0` | ~6.0 s | Build OK; 15 rutas estáticas/dinamicas generadas | Generó/actualizó artefactos `.next/` (build). No fuentes. |

**Nota:** Pasar estos comandos **no** implica producción lista. El sistema es coherente como MVP local, no como plataforma multi-usuario.

---

## 3. Inventario real de rutas

Todas las rutas solicitadas **existen** y fueron listadas por `next build`.

| Ruta | Existe | Tipo componente | Usa localStorage | Riesgo hydration | Estado vacío | Error handling | ¿Apta producción? |
|---|---|---|---|---|---|---|---|
| `/` | Sí | Server | No | Bajo | N/A (landing fija) | Mínimo | No (expone “MVP local”, link abierto a admin) |
| `/admin` | Sí | Client (`"use client"`) | Sí (vía demo/storage) | Mitigado parcialmente (`mounted`) | Skeleton / ceros | Limitado | No |
| `/admin/configuracion` | Sí | Client | Sí | Mitigado (`mounted`) | Skeleton | Solo lectura; sin edición | No |
| `/admin/trabajadores` | Sí | Client | Sí | Mitigado | Skeleton + mensajes | Validación básica UI | No |
| `/admin/campanas` | Sí | Client | Sí + `window.location.origin` | Mitigado | Skeleton | Feedback UI | No (copy promete flujo celular→panel) |
| `/admin/resultados` | Sí | Client | Sí | Mitigado | Mensaje sin completadas | Filtros locales | No |
| `/admin/reportes` | Sí | Client | Sí | Mitigado | Informe con ceros / vacío | Campos manuales responsable | No |
| `/admin/plan-accion` | Sí | Client | Sí | Mitigado | Lista vacía | CRUD local | No |
| `/admin/evidencias` | Sí | Client | Sí | Mitigado | Checklist incompleto | Solo metadata | No |
| `/admin/quejas` | Sí | Client | Sí | Mitigado | Lista vacía | CRUD local | No |
| `/admin/politica` | Sí | Client | Sí | Mitigado | Sin política | Generación local | No |
| `/evaluacion/[token]` | Sí | Client | Sí | **Alto** (`seedNom035LocalData()` en render; evidencia previa de hydration warning) | Welcome + form | Validación de respuestas visibles; **no** valida token inexistente/completado | No |
| `/evaluacion/[token]/gracias` | Sí | Server | No | Bajo | N/A | Ninguno | Parcial (texto OK; sin verificación server-side de envío) |
| `/queja-confidencial` | Sí | Client | Sí | Mitigado (`mounted`) | Formulario | Validación UI | No (privacidad falsa: local al navegador) |

---

## 4. Auditoría de persistencia

### Apariciones en `src` (evidencia)

| Patrón | Archivos |
|---|---|
| `localStorage` / keys `nom035.*` | `src/lib/nom035/storage-local.ts`, `src/lib/nom035/demo-data.ts` |
| Keys exactas | `nom035.company`, `nom035.workers`, `nom035.campaigns`, `nom035.evaluations`, `nom035.actionPlans`, `nom035.evidences`, `nom035.complaints`, `nom035.policies`, `nom035.assignments` |
| `sessionStorage` | **No encontrado** |
| `mock` / `MOCK_*` | `src/data/nom035/mock-company.ts`, `mock-workers.ts`, `mock-campaigns.ts`; imports en `storage-local.ts`, tests de policy |
| `localhost` | Texto en `src/app/admin/campanas/page.tsx` (nota al usuario) |
| `window.location` | `src/app/admin/campanas/page.tsx` (`window.location.origin`) |
| `Math.random` | `storage-local.ts` (IDs de worker, assignment, action, evidence, complaint, policy) |
| `crypto.randomUUID` | **No encontrado** |

### Determinaciones

| Pregunta | Respuesta |
|---|---|
| ¿Qué se guarda solo en el navegador? | Empresa, trabajadores, campañas, assignments, evaluaciones (respuestas + resultados), plan de acción, evidencias (metadata), quejas, políticas. |
| ¿Qué se pierde al borrar caché/localStorage? | **Todo** lo operativo anterior. |
| ¿Qué no se comparte entre dispositivos? | **Todo** lo anterior. |
| ¿Qué sensible queda visible al usuario del navegador? | Nombres, emails, teléfonos, respuestas NOM-035, resultados clínicos/riesgo, quejas (descripción + contacto), tokens, políticas. Accesible vía DevTools → Application → Local Storage. |
| ¿Qué falla si el trabajador responde desde otro celular? | El admin en otra máquina **no ve** la evaluación ni la queja. El “resultado” queda en el `localStorage` del celular del trabajador. |

### Confirmación expresa

> **Hoy un trabajador NO puede responder desde su celular y hacer que la respuesta aparezca en el panel administrativo de otra computadora.**  
> La arquitectura actual es **single-browser / local-only**.

---

## 5. Auditoría de trabajadores y asignaciones

| Capacidad | Estado | Evidencia / riesgo |
|---|---|---|
| Alta | Implementada localmente | `saveWorker` en `storage-local.ts` |
| Edición | Implementada | `updateWorker` |
| Desactivación | Implementada | `deactivateWorker` → `INACTIVE` |
| Importación CSV | Implementada (cliente) | `trabajadores/page.tsx` parseo simple por comas; frágil con comas en campos |
| Activos / inactivos | Sí | Campañas filtran `ACTIVE` |
| Generación de assignments | Sí | Seed + `saveCampaignAssignment` |
| Tokens “únicos” | Determinísticos | `token = `${campaignId}__${workerId}`` — únicos por par, **predecibles** |
| Prevención duplicados assignment | Parcial | `saveCampaignAssignment` retorna existing si mismo campaign+worker |
| Estados sin_link / pending / in_progress / completed | Parcial | UI campañas: Sin link / Pendiente / En progreso / Completado. Storage: `pending` \| `in_progress` \| `completed` |
| Prevención segundo envío | **No** | `finalizeCompleteEvaluationByTokenLocal` sobrescribe registro completed |
| Token inexistente | Débil | Si formato `a__b` y campaña existe, crea evaluation; no exige worker existente. Token inválido: `createEvaluationRecordFromToken` → `null`, pero UI sigue permitiendo contestar en memoria y puede fallar al persistir |
| Token completado | **No bloquea** | Se puede reabrir y reenviar |
| Borrar trabajador | Incompleto | `deleteWorker` no elimina assignments/evaluations huérfanas |
| Desactivar trabajador | Parcial | Sale de generación de links activos; evaluaciones previas permanecen |
| Limpiar localStorage | Destructivo | `clearNom035LocalData` borra las 9 keys; re-seed recrea mocks |

**Bugs / inconsistencias / integridad (destacados):**

- Tokens adivinables (`campaign-001__worker-001`).
- Reenvío permitido sobre evaluación ya `completed`.
- Cascade incompleto al borrar trabajador.
- `employeeNumber` = `A-${current.length + 1001}` puede colisionar tras borrados.
- Campañas UI afirma flujo celular → panel de resultados (falso entre dispositivos).

---

## 6. Auditoría Guía I (sin modificar código)

| Verificación | Resultado |
|---|---|
| Cantidad exacta de preguntas | **15** |
| IDs únicos | **15/15** |
| Orden secciones | I(1) → II(2) → III(7) → IV(5) |
| Flujo condicional | Sección I = NO → no muestra II–IV; I = SÍ → exige II–III–IV |
| Umbral II | ≥ 1 Sí → alerta |
| Umbral III | ≥ 3 Sí → alerta |
| Umbral IV | ≥ 2 Sí → alerta |
| Respuestas obligatorias cuando aplican | Validado en UI (`hasMissingAnswers`) |
| Resultado al trabajador | **No se muestra** (redirige a `/gracias`) |
| Resultado admin | Coherente con `calculateGuiaIResult` si los datos están en el mismo navegador |

### Tests confirmados (`scoring-engine.test.ts`)

| Caso | Cubierto |
|---|---|
| Sin acontecimiento traumático (I = NO) | Sí — caso 1 |
| Alerta por Sección II | Sí — caso 2 |
| Alerta por 3 Sí en Sección III | Sí — caso 3 |
| Alerta por 2 Sí en Sección IV | Sí — caso 4 |
| Evento sin alcanzar umbrales | Sí — caso 5 |

---

## 7. Auditoría Guía II (sin modificar código)

### Tabla de cobertura

| Concepto | Valor |
|---|---|
| Cantidad de reactivos | **46** (numerados 1–46) |
| Números faltantes | **0** |
| Números duplicados | **0** |
| IDs únicos | **46/46** |
| Grupo directo | **30** reactivos |
| Grupo invertido | **16** reactivos (`18–33`) |
| En ambos grupos | **0** |
| En ninguno | **0** |
| Reactivos condicionales | **41–43** (clientes), **44–46** (supervisión) |
| Cobertura grupos cat/dom/dim 1–46 | **46/46**, sin duplicados accidentales de nombres detectados |

### Comportamiento

| Verificación | Resultado |
|---|---|
| Compuerta clientes omite 41–43 | Sí (`skippedQuestions`, score 0) — test existe |
| Compuerta jefe omite 44–46 | Sí — test existe |
| Puntaje final = suma aplicablestodos reactivos (omitidos = 0) | Sí en motor |
| Umbrales en límites exactos | Cubiertos por `getRiskLevelFromThresholds` tests |
| UI no finaliza con aplicables incompletos | Sí (`validateCurrentGuiaIIBlock`) |
| Motor si faltan respuestas aplicables | **Asume 0** y agrega alerta — riesgo de integridad si se llama sin UI |

**Hallazgos scoring (reportados, no corregidos):**

- **P0-scoring-soft:** `calculateGuiaIIResult` tolera respuestas faltantes asumiendo 0. La UI mitiga, pero no hay capa server. Clasificado como **P1** (no P0 de fórmula) porque no se encontró error de fórmula 1–46 / directo-invertido / umbrales en límites bajo tests actuales. **No se cambió scoring.**

---

## 8. Auditoría de cálculo y resultados

| Verificación | Estado |
|---|---|
| Cálculo al finalizar | Sí — `calculateGuiaIResult` / `calculateGuiaIIResult` en submit final |
| Assignment completed sin resultado | Posible inconsistencia legacy; flujo actual escribe `guiaIResult` (y `guiaIIResult` si aplica) al completar |
| Resultado sin assignment | Posible: `createEvaluationRecordFromToken` puede crear evaluation si hay campaña aunque no haya assignment explícito |
| Duplicados al recargar | Un registro por `id: eval-${token}`; recargar UI no duplica, pero **reenviar sobrescribe** |
| Recálculo con incompletos | Motor Guia II puede puntuar con faltantes=0 |
| Categoría / dominio / dimensión | Calculados en motor |
| Riesgo predominante / deptos / dominios críticos / filtros | `results-analytics.ts` |
| Privacidad resultados | Solo ocultos al trabajador en UI; **visibles en localStorage y admin sin auth** |
| Consistencia dashboard vs reporte | Ambos usan helpers analytics + última completed por trabajador |

**¿Analytics usa siempre la última evaluación válida por trabajador?**  
**Sí** — `getLatestCompletedByWorker` en `results-analytics.ts` ordena por `completedAt`/`submittedAtISO` y conserva la más reciente.

---

## 9. Auditoría de privacidad y seguridad

| Control | Estado | Clasificación |
|---|---|---|
| Autenticación | No implementado | **Bloqueador** |
| Autorización | No implementado | **Bloqueador** |
| Roles | No implementado | **Bloqueador** |
| Restricciones por usuario | No implementado | **Bloqueador** |
| Acceso a resultados individuales | Cualquiera con `/admin` | **Bloqueador** |
| Acceso a quejas | Cualquiera con `/admin/quejas` + localStorage | **Bloqueador** |
| Acceso a datos de contacto | En localStorage y UI trabajadores | **Bloqueador** |
| Exposición en localStorage | Total datos NOM-035 | **Bloqueador** |
| Protección de tokens | Token en URL, predecible | **Bloqueador** |
| Generación criptográfica de token | No (`campaignId__workerId`) | **Bloqueador** |
| Expiración de tokens | No | Parcial / no implementado (P1) |
| Uso único | No (overwrite) | **Bloqueador** |
| Rate limiting | No | No implementado (P1) |
| Validación server-side | No (no hay API) | **Bloqueador** |
| Sanitización de campos | Básica UI; sin Zod | Parcial (P1) |
| Riesgo XSS | Bajo-moderado (React escapa texto; no `dangerouslySetInnerHTML` encontrado) | Parcial |
| CSRF | N/A relativo (sin mutaciones server auth); riesgo futuro al agregar API | No implementado |
| Secretos / env expuestos | No `.env` en repo; existe `.vercel/project.json` con project/org ids | Parcial |
| Logs con PII | No hay logging estructurado server | No implementado |

---

## 10. Auditoría de módulos administrativos

| Módulo | Fuente de datos | Operaciones | Persistencia | Validaciones | Estado vacío | Errores posibles | Demo | Producción |
|---|---|---|---|---|---|---|---|---|
| Dashboard `/admin` | localStorage | Resumen + seed/clear demo | Local | Mínimas | Ceros / skeleton | Pérdida al clear | Sí | No |
| Configuración | Mock/company local | Solo lectura | Local | N/A | Skeleton | Datos desactualizados | Sí | No |
| Trabajadores | localStorage | CRUD + CSV | Local | Campos requeridos UI | Skeleton | CSV frágil, huérfanos | Sí | No |
| Campañas | localStorage | Links, copy, generate | Local | Feedback | Skeleton | Promesa cross-device falsa | Sí | No |
| Resultados | Evaluations local | Filtros, cards | Local | N/A | Mensaje vacío | Datos solo locales | Sí | No |
| Reportes | Analytics local | Print + campos responsable | Local | Manual | Informe vacío | Incompleto normativo | Sí | No |
| Plan de acción | localStorage | CRUD + sugerencias | Local | UI | Lista vacía | Sin auditoría formal | Sí | No |
| Evidencias | localStorage | CRUD metadata | Local | Título/desc | Checklist | Sin archivo real | Sí | No |
| Quejas | localStorage | CRUD admin | Local | UI | Vacío | Sin confidencialidad real | Sí | No |
| Política | localStorage | Generar/publicar | Local | UI | Sin doc | Sin difusión real | Sí | No |

---

## 11. Reporte imprimible

| Elemento | Estado |
|---|---|
| Datos de empresa | Sí (desde company local) |
| Objetivo / alcance / método | Presentes en plantilla de `/admin/reportes` |
| Resultados | Agregados Guia I/II si hay completed locales |
| Conclusiones / recomendaciones / intervención | Generados por helpers |
| Responsable | Campos capturados manualmente en UI (nombre, cargo, cédula, fecha) |
| Impresión | `window.print()` |
| Estilos print | `@media print`; oculta `.admin-nav` y `.no-print` |
| Tablas | `page-break-inside: avoid` (mitiga cortes; no garantiza perfecta) |
| Sin resultados | Informe con ceros / vacío |
| Uno o varios departamentos | `getDepartmentSummaries` |

**Información NOM aún manual o ausente (ejemplos):**

- Firma/cédula profesional del responsable (manual).
- Evidencia documental adjunta real.
- Trazabilidad de canalización clínica individual (confidencial) fuera del agregado.
- Guía III / entorno organizacional completo para >50.
- Respaldos y cadena de custodia ante inspección STPS.

---

## 12. Evidencias y archivos

Confirmado:

- Se registra **título, descripción, `fileName`, `fileUrl` como texto**.
- **No** existe upload real.
- **No** existe Storage (Supabase/S3/etc.).
- **No** hay control MIME, límite de tamaño, permisos, versionado ni respaldo de archivos.

**Clasificación:** **bloqueador de producción** para el módulo de evidencias y para una entrega formal ante inspección que exija expediente documental confiable.

---

## 13. Quejas confidenciales

| Aspecto | Estado |
|---|---|
| Envío anónimo | Sí (UI) |
| Envío identificado | Sí (nombre/contacto) |
| Folio único | Local (`NOM035-Q-YYYY-####`) |
| Datos de contacto | Guardados en localStorage si identifica |
| Acceso admin | Sin auth |
| Cambio estado / responsable / notas / cierre | Sí en `/admin/quejas` |
| Duplicados | Posibles (no hay dedupe de contenido) |
| Pérdida por localStorage | Total |
| Privacidad real | **No** (cualquiera con el navegador / DevTools) |

### Confirmación expresa

> **Una queja enviada desde el celular de un trabajador NO sería visible en la computadora del administrador con la arquitectura actual**, salvo que ambos usen el mismo navegador/perfil con el mismo `localStorage` (escenario irreal en operación).

---

## 14. Adecuación según número de trabajadores

Función: `getRequiredQuestionnaires(employeeCount)`.

| employeeCount | Resultado |
|---|---|
| 0 | `["GUIA_I"]` (cae en `<= 15`) |
| 1 | `["GUIA_I"]` |
| 15 | `["GUIA_I"]` |
| 16 | `["GUIA_I","GUIA_II"]` |
| 50 | `["GUIA_I","GUIA_II"]` |
| 51 | `["GUIA_I","GUIA_II","GUIA_III"]` |
| >50 | Igual, incluye `GUIA_III` |

Confirmaciones:

- **Hasta 15:** hoy aplica flujo real de **Guía I** (Guía II no se fuerza por tamaño).
- **16–50:** Guía I + Guía II en evaluación (según `employeeCount` local; mock = 28).
- **>50:** Guía III **declarada pero no implementada** (nota en UI de evaluación).

**Si la empresa real tiene >50 trabajadores → bloqueador de producción (P0).**  
Empresa mock actual: 28 → no bloquea por Guía III **en este dataset**, pero la regla del producto sí lo hará al subir el conteo.

---

## 15. Despliegue

| Elemento | Estado |
|---|---|
| Configuración Vercel | Existe carpeta `.vercel/` con `project.json` (proyecto `mom`); **no** hay `vercel.json` de app |
| Variables de entorno | No hay `.env*` en el repo |
| Dominio / HTTPS | No verificado en producción en este bloque; no se desplegó |
| Supabase / Auth / RLS / DB / migraciones | **No** |
| Backups / monitoreo / logs / recuperación | **No** |
| Smoke test de producción | **No ejecutado** (prohibido desplegar en este bloque) |

---

## 16. Prueba de flujo integral

| Paso | Mismo navegador | Dispositivos distintos |
|---|---|---|
| 1. Crear trabajador | Funciona | No compartido |
| 2. Generar link | Funciona | Link URL puede abrirse, pero datos no sincronizan |
| 3. Abrir link | Funciona | Abre app, pero escribe en *su* localStorage |
| 4. Contestar Guía I | Funciona | Local al dispositivo |
| 5. Contestar Guía II | Funciona (si employeeCount 16–50) | Local al dispositivo |
| 6. Finalizar | Funciona | Local al dispositivo |
| 7. Ver estado completado (admin) | Funciona **solo mismo browser** | **No funciona** |
| 8. Ver resultado | Idem | **No funciona** |
| 9. Generar reporte | Idem | **No funciona** con datos remotos |
| 10. Crear plan de acción | Idem | Local |
| 11. Registrar evidencia | Metadata local | Local |
| 12. Enviar queja | Local | **No visible en admin remoto** |
| 13. Gestionar queja | Local | No |
| 14. Publicar política | Local | No |

---

## 17. Clasificación de hallazgos

### P0 — bloquean producción / integridad / privacidad

| Código | Descripción | Evidencia | Archivo(s) | Impacto | Corrección recomendada | Requiere |
|---|---|---|---|---|---|---|
| P0-01 | Persistencia solo en `localStorage` | Keys `nom035.*` | `storage-local.ts`, `demo-data.ts` | Sin multi-dispositivo ni multi-usuario real | Backend + DB | Supabase/DB |
| P0-02 | Evaluaciones no llegan del celular al admin en otra PC | Arquitectura client-only | `evaluacion/[token]/page.tsx`, `storage-local.ts` | Operación real imposible | API de submit + lectura admin | Supabase + Auth |
| P0-03 | Quejas no llegan cross-device | `saveComplaint` local | `queja-confidencial/page.tsx`, `storage-local.ts` | Canal “confidencial” inútil en producción | API + ACL | Supabase + Auth + RLS |
| P0-04 | `/admin` sin autenticación ni roles | Layout admin sin guard | `admin/layout.tsx`, páginas admin | Cualquiera accede a PII/resultados/quejas | Auth + RBAC | Auth |
| P0-05 | Datos sensibles en navegador | JSON completo en Local Storage | `storage-local.ts` | Filtración trivial | No persistir secretos/PII clínicos en cliente | DB + RLS |
| P0-06 | Tokens predecibles | `${campaignId}__${workerId}` | `storage-local.ts`, `campanas/page.tsx` | Enumeración / suplantación | Token opaco criptográfico, un solo uso | Backend |
| P0-07 | Sin uso único; reenvío sobrescribe completed | `finalizeCompleteEvaluationByTokenLocal` | `storage-local.ts`, `evaluacion/[token]/page.tsx` | Integridad de resultados | Bloquear si `completed`; versionar | Backend |
| P0-08 | Sin backups; clear/caché destruye expediente | `clearNom035LocalData` | `demo-data.ts` | Pérdida total | Backups DB | DB + política backup |
| P0-09 | Guía III no implementada para >50 | `getRequiredQuestionnaires` retorna GUIA_III; UI “pendiente” | `get-required-questionnaires.ts`, `evaluacion/...` | Incumplimiento si N>50 | Implementar Guía III o bloquear altas >50 | Feature + posiblemente UI |
| P0-10 | Evidencias sin Storage real | Solo `fileName`/`fileUrl` texto | `evidencias/page.tsx`, `storage-local.ts` | Expediente no auditables | Upload + MIME + ACL | Storage |
| P0-11 | Sin validación server-side / sin RLS | No hay API/Zod/middleware | repo | Manipulación client-side | Endpoints validados + RLS | Supabase + Zod + RLS |
| P0-12 | Despliegue productivo incompleto | Sin env/auth/db/monitor | `.vercel/`, ausencia `.env` | No hay entorno seguro listo | Pipeline prod + controles | Infra |

### P1 — corregir antes de entrega formal

| Código | Descripción | Evidencia | Archivo(s) | Impacto | Corrección | Requiere |
|---|---|---|---|---|---|---|
| P1-01 | Riesgo hydration en evaluación | `seedNom035LocalData()` en cuerpo de render | `evaluacion/[token]/page.tsx` | Warnings/errores React | Mover seed a `useEffect` | Cambio UI menor |
| P1-02 | Copy de campañas promete sync celular→panel | Texto “El trabajador responde desde su celular… resultados en panel” | `campanas/page.tsx` | Expectativa falsa | Ajustar copy o implementar backend | UI y/o Supabase |
| P1-03 | `deleteWorker` no limpia assignments/evals | Solo filtra workers | `storage-local.ts` | Datos huérfanos | Cascade / soft-delete | Backend preferible |
| P1-04 | Token sin expiración / campaña vencida no enforced | Fechas campaña no bloquean submit | campaigns + evaluación | Enlaces eternos | Validar ventana temporal | Backend |
| P1-05 | Sin Zod / sanitización fuerte | No matches Zod | repo | Datos basura / inyección futura | Schemas en API | Zod |
| P1-06 | npm audit: 7 vulnerabilidades (6 high) | Salida `npm ci` / `npm audit` | dependencias | Riesgo supply-chain | Actualizar deps con plan | Dependencias |
| P1-07 | Guia II motor asume 0 si falta respuesta | Alert string en scoring | `scoring-engine.ts` | Sesgo de puntaje si se bypasea UI | Fallar hard sin respuesta | Scoring policy (reportado; no cambiado aquí) |
| P1-08 | Configuración empresa solo lectura | UI sin save | `configuracion/page.tsx` | No operable para cliente real | CRUD empresa | UI + storage/API |
| P1-09 | CSV frágil | split por coma | `trabajadores/page.tsx` | Import corrupto | Parser CSV robusto | UI |
| P1-10 | Folios/IDs con `Math.random` | Varios `save*` | `storage-local.ts` | Colisiones teóricas | UUID criptográfico server-side | Backend |
| P1-11 | Sin rate limiting / anti-abuso en quejas y eval | N/A | formularios públicos | Spam | Rate limit edge/API | Infra |
| P1-12 | Informe NOM incompleto vs expediente formal | Campos manuales; sin anexos | `reportes/page.tsx` | Entrega débil a inspección | Completar plantilla + anexos Storage | UI + Storage |

### P2 — mejora posterior

| Código | Descripción | Evidencia | Archivo(s) | Impacto | Corrección |
|---|---|---|---|---|---|
| P2-01 | Ortografía residual en alertas scoring (“Seccion”) | Strings en motor | `scoring-engine.ts` | Cosmético admin | Acentos |
| P2-02 | `employeeNumber` por `length+1001` | `saveWorker` | `storage-local.ts` | Colisiones tras deletes | Secuencia durable |
| P2-03 | Landing declara explícitamente MVP local | `/` | `page.tsx` | OK para demo; no branding prod | Copy prod |
| P2-04 | Tests no cubren límites exactos 0/15/16/50/51 de guías | Solo 10/30/120 | `get-required-questionnaires.test.ts` | Cobertura | Ampliar tests |
| P2-05 | Estilos print no 100% a prueba de tablas largas | CSS mitigate | `reportes/page.tsx` | Cortes ocasionales | Ajustes print |

---

## 18. Veredicto y plan

### Veredicto exacto

**NO-GO PARA PRODUCCIÓN**

### Bloqueadores P0 (lista cerrada)

1. P0-01 Persistencia solo localStorage  
2. P0-02 Evaluaciones sin sync cross-device  
3. P0-03 Quejas sin sync cross-device  
4. P0-04 Sin Auth/roles en admin  
5. P0-05 PII/resultados/quejas en localStorage  
6. P0-06 Tokens predecibles  
7. P0-07 Sin uso único / overwrite completed  
8. P0-08 Sin backups / pérdida total  
9. P0-09 Guía III ausente para >50  
10. P0-10 Evidencias sin Storage real  
11. P0-11 Sin validación server-side / RLS  
12. P0-12 Despliegue productivo incompleto  

### Orden recomendado de implementación (por bloques, no horas)

1. **B-Backend-Core:** Postgres/Supabase + migraciones + modelos (company, workers, campaigns, assignments, evaluations, complaints, policies, action_plans, evidences metadata).  
2. **B-Auth-RBAC:** Login admin, roles, middleware, RLS por organización.  
3. **B-Eval-API:** Tokens opacos, expiración, un solo uso, submit server-side, cálculo server-side, anti-reescriura.  
4. **B-Complaints-API:** Canal confidencial con ACL estricta y auditoría.  
5. **B-Storage-Evidence:** Upload real + MIME + límites + versionado.  
6. **B-Guia-III-or-Cap:** Implementar Guía III **o** bloquear empresas >50 hasta tenerla.  
7. **B-Ops:** Backups, monitoreo, logs sin PII, env prod, smoke tests, harden deps.  
8. **B-Hardening-UI:** Corregir hydration, copy engañoso, CSV, configuración editable (sin rediseño amplio).

### Criterio objetivo para cambiar a GO

Todos los P0 cerrados **y**:

- Un trabajador en dispositivo A completa evaluación; admin en dispositivo B ve `completed` + resultado en < N segundos sin compartir navegador.  
- Queja anónima desde A visible solo a rol autorizado en B.  
- Tokens no enumerables; completed no reescribible.  
- Auth obligatoria en `/admin/**`.  
- Evidencia con archivo real almacenado y ACL.  
- Si `employeeCount > 50`, Guía III operativa o alta bloqueada.  
- Backup restaurable verificado.  
- Lint + typecheck + tests + build + smoke prod en verde.

**GO CON CONDICIONES** solo sería aceptable si: N≤50, uso piloto controlado, Auth+DB+sync ya desplegados, y se acepta explícitamente ausencia de Guía III/Storage avanzado — **hoy no aplica** porque ni Auth ni sync existen.

---

## 19. Conteos

| Severidad | Cantidad |
|---|---|
| P0 | **12** |
| P1 | **12** |
| P2 | **5** |

---

## Confirmación de alcance

- **No se modificó código funcional.**  
- **No se conectó Supabase.**  
- **No se cambió scoring ni preguntas.**  
- **No se rediseñó la interfaz.**  
- **Único archivo creado:** `docs/PRODUCTION_READINESS_AUDIT.md`.

---

*Fin del informe.*
