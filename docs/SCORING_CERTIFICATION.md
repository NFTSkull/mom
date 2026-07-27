# Certificado de conformidad técnica — Scoring NOM-035

**Bloque:** B4.1  
**Fecha:** 2026-07-24  
**Veredicto:** **CERTIFICADO**

---

## 1. Entorno del agente

| Campo | Valor |
|---|---|
| `pwd` | `/Users/grecovillanuevaortiz/Desktop/Mom` |
| `git rev-parse --show-toplevel` | `/Users/grecovillanuevaortiz/Desktop/Mom` |
| Worktree | Único: `/Users/grecovillanuevaortiz/Desktop/Mom  b037cad [main]` |
| Contenedor/sandbox host | **No** (`NOT_DOCKER`; Darwin host con acceso al filesystem) |

`find /Users/grecovillanuevaortiz -name "NOM-035-STPS-2018-oficial.txt"` →  
`/Users/grecovillanuevaortiz/Desktop/Mom/docs/source/NOM-035-STPS-2018-oficial.txt`

---

## 2. Fuente canónica

| Chequeo | Esperado | Observado | OK |
|---|---|---|---|
| Existe | sí | `EXISTS` | Sí |
| Tamaño | 220837 bytes | 220837 | Sí |
| SHA-256 | `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76` | idéntico | Sí |

### Ubicación normativa en el `.txt`

| Sección | Localización aproximada |
|---|---|
| Guía de Referencia I | ~L1870 |
| Guía de Referencia II | ~L1947 |
| Apartado II.1 | ~L2144 |
| Apartado II.2 | ~L2160 |
| Apartado II.3 | ~L2187 |
| Tabla 2 (calificación por reactivo) | ~L2192 |
| Tabla 3 (dimensiones / dominios / categorías) | ~L2218 |
| Tabla 4 (umbrales) | ~L2333 |

---

## 3. Conteos certificados

| Métrica | Valor |
|---|---|
| Guía I — preguntas | 15 |
| Guía II — reactivos | 46 |
| Scoring directo | 30 |
| Scoring invertido | 16 |
| Condicionales (gates) | 6 (41–43 clientes; 44–46 jefe) |
| Dimensiones | 20 |
| Dominios | 8 |
| Categorías | 4 |
| Fixtures golden | 10 |
| `NOM035_SCORING_VERSION` | `nom035-stps-2018-guia-i-ii-v1` |

---

## 4. Comparación fuente vs código — discrepancias

| Ítem | Estado |
|---|---|
| Textos Guía I (15) | Coinciden con fuente |
| Textos Guía II (46) | 0 mismatches de redactado vs fuente |
| Tabla 2 (directo 1–17, 34–46; invertido 18–33) | Coincide |
| Compuertas clientes/jefe | Coincide |
| Nombres cat/dom/dim | Corregidos acentos oficiales vía manifiesto |
| Umbrales tipográficos ambiguos | Política operativa documentada en `docs/SCORING_BOUNDARY_POLICY.md` (inferior inclusivo, superior exclusivo, último ≥) |
| Respuestas faltantes | Motor **falla duro** (ya no asume score 0) |

**Discrepancias abiertas de contenido normativo:** ninguna.

---

## 5. Controles de producto incluidos

- Manifiesto único: `src/data/nom035/guia-ii-manifest.ts`
- Validación estricta: `src/lib/nom035/validate-guia-ii.ts`
- Revisión final del trabajador (sin puntajes/riesgo) + confirmación + anti doble envío
- Etiqueta “versión no registrada” para resultados legacy en admin
- Contrato de acceso individual: `docs/INDIVIDUAL_RESULT_ACCESS.md`

---

## 6. Validación automatizada

```text
npm run lint       → EXIT 0
npm run typecheck  → EXIT 0
npm test           → 11 files / 86 tests passed
npm run build      → EXIT 0
```

---

## 7. Confirmaciones de restricciones

- Sin Supabase remoto / sin aplicar SQL
- Sin login / sin usuarios Auth
- Sin Guía III
- Sin deploy
- Sin commit / sin push

---

## Veredicto

**CERTIFICADO** — preguntas, scoring, agrupaciones, fronteras operativas documentadas, fixtures golden, revisión final y suite de calidad del bloque B4.1 aprobadas contra la fuente canónica verificada.
