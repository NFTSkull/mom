# Trazabilidad de scoring — Guía de Referencia III (NOM-035-STPS-2018)

**Bloque:** B4.9  
**Fecha:** 2026-07-30  
**Veredicto de instrumento:** IMPLEMENTADA EN MOTOR (certificación E2E producto pendiente)

---

## Fuentes

| Fuente | Ubicación | SHA-256 |
|---|---|---|
| DOF / texto oficial | `docs/source/NOM-035-STPS-2018-oficial.txt` | `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76` |
| Word MAT STPS | `/Users/.../Downloads/Nom 035 - 2018_10_23_MAT_stps2a11_C.doc` (fuera de Git) | `3eedb20e4362458f9159ecb6ee4a1a6688728ea789f2a42f9598700554e1d936` |

Ubicación Guía III en `.txt`: ~L2387–L2991.

---

## Versiones

| Campo | Valor |
|---|---|
| `scoringVersion` | `nom035-stps-2018-guia-iii-v1` |
| `questionnaireVersion` | `nom035-stps-2018-guia-referencia-iii` |
| Archivo manifiesto | `src/data/nom035/guia-iii-manifest.ts` |
| Motor | `src/lib/nom035/scoring-engine.ts` → `calculateGuiaIIIResult` |
| Validación | `src/lib/nom035/validate-guia-iii.ts` |
| Pruebas | `src/lib/nom035/__tests__/guia-iii-scoring.test.ts` |

---

## Conteos oficiales

| Métrica | Valor oficial | Implementación |
|---|---|---|
| Reactivos | 72 | 72 |
| Scoring reverse (Tabla 5, Siempre=0) | 35 | 35 |
| Scoring direct (Tabla 5, Siempre=4) | 37 | 37 |
| Condicionales clientes | 65–68 | gate `clientes` |
| Condicionales jefe | 69–72 | gate `jefe` |
| Categorías | 5 | 5 |
| Dominios | 10 | 10 |

---

## Tablas oficiales → código

| Tabla | Contenido | Código |
|---|---|---|
| Cuestionario Guía III | Textos 1–72 | `GUIA_III_MANIFEST[].text` |
| Tabla 5 | Valores Likert directo/inverso | `scoring` + `scoreGuiaIIIAnswer` |
| Tabla 6 | Cat/dom/dim/ítems | `category`/`domain`/`dimension` |
| Rangos final/cat/dom | Umbrales tipográficos | `GUIA_III_*_THRESHOLDS` |
| Tabla 7 | Acciones por nivel | `GUIA_III_ACTION_BY_LEVEL` |

---

## Política de fronteras (igual que Guía II)

Documentada en `docs/SCORING_BOUNDARY_POLICY.md`.

Para Guía III final (Tabla tipográfica `Cfinal<50`, `50<Cfinal<75`, …, `Cfinal>140`):

| Nivel | Operativo |
|---|---|
| nulo | `score < 50` |
| bajo | `50 <= score < 75` |
| medio | `75 <= score < 99` |
| alto | `99 <= score < 140` |
| muy_alto | `score >= 140` |

Sin huecos ni solapes en enteros.

---

## Relación Auth → resultado (existente)

```
auth.users.id
  → worker_accounts.auth_user_id (UNIQUE)
  → worker_accounts.worker_id (UNIQUE) → workers.id
  → evaluation_assignments (UNIQUE campaign_id, worker_id)
  → evaluation_sessions.assignment_id
  → evaluation_answers.assignment_id (+ question_id)
  → evaluation_results.assignment_id (UNIQUE)
```

Contraseñas solo en Auth. Sin password en tablas públicas.

---

## Asignación normativa por tamaño

| N trabajadores | Instrumento FRP |
|---|---|
| ≤50 | Guía I + Guía II |
| >50 | Guía I + Guía III (no Guía II) |

`getRequiredQuestionnaires` actualizado en consecuencia.

---

## Pendiente para “LISTO PARA CREAR 83 CUENTAS”

- UI/flujo público y portal con Guía III (hoy el motor de evaluación productiva sigue en I+II).
- Submit atómico con snapshot Guía III en backend RPC.
- Suites E2E Playwright Guía III, A/B, carga 83, backup/restore.
- Campaña productiva de 83 con `questionnaire_version` Guía III.

**No se crearon las 83 cuentas reales en esta fase.**
