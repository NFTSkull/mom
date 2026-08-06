# B4.16 — Certificación final Production (antes de abrir campaña)

**Fecha UTC:** 2026-08-04  
**SHA esperado desplegado:** `f2666b910a81e9c2543b2675ee62eacb684cb853`  
**Deploy Production:** `dpl_FRRdTUwgi62D5c32emN9sxALLPA8` → https://nom035-production.vercel.app  

## Veredictos

| Tipo | Resultado |
|---|---|
| Funcional | **SISTEMA FUNCIONAL CERTIFICADO PARA 83 TRABAJADORES** |
| Revisión individual | **RESPUESTAS INDIVIDUALES DISPONIBLES** (`GET /api/admin/nom035/results/[id]` + `results.individual.read` + AAL2) |
| Apertura campaña real | **APERTURA DE CAMPAÑA BLOQUEADA** |

## Bloqueos de apertura

| Flag | Valor |
|---|---|
| MFA_FACTORS_ADMIN | **0** |
| ADMIN_AAL2 | **false** |
| MFA_REQUIRED | **false** |
| PITR_ENABLED | **false** |
| BACKUP_POLICY_ACCEPTED | **false** |

La prueba sintética se ejecutó; **no** se abrió `Evaluación NOM-035 2026`.

## Cuenta sintética

- Worker: `TST-PROD-FINAL-001`
- Campaña: `TST-PROD-FINAL-CAMPAIGN` (**active**, solo sintético)
- Instrumentos: Guía I + III; Guía II = 0
- Limpieza: residuo **0**

## Flujo certificado (sintético)

Login → open → draft Guía I → logout/relogin → recuperación → transición I→III → draft III → submit atómico → snapshot match → doble submit bloqueado → assignment `completed`.

## Panel / métricas

| Pregunta | Respuesta |
|---|---|
| A. ¿Admin puede abrir trabajador individual? | **Sí** (detalle resultado) |
| B. ¿Puede revisar respuestas exactas? | **Sí** (con permiso sensible + AAL2) |
| C. ¿Solo puntuaciones/riesgo? | Lista/reportes: sí; detalle: también raw |
| D. ¿Individuales, agregadas o ambas? | **Ambas** |

### Matriz

| Dato | Visible |
|---|---|
| Datos por trabajador | sí |
| Respuestas crudas | sí (detalle) |
| Puntuaciones | sí |
| Dominios / categorías | sí |
| Agregados / reporte | sí |
| Exportación | sí (reportes) |

Nota: AAL2 no operable hoy (MFA=0); el contrato RBAC/UI existe.

## Conteos reales finales (intactos)

workers/Auth/WA/assignments = 83; I/III/II = 83/83/0; sesiones/respuestas/resultados = 0/0/0; campaña = **draft**.

## Herramienta

`scripts/b416-certify-prod-final.ts` (+ `scripts/lib/b416-constants.ts`)

## Confirmaciones

- Campaña real no abierta  
- 83 reales no modificados  
- Credenciales no entregadas  
- ConCasa intacto  
- Passwords no impresas  
