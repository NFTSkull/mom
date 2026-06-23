# Changelog

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
