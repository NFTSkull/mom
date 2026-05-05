# Devlog

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
