# Política de fronteras de scoring — Guía II NOM-035

**Fuente canónica:** `docs/source/NOM-035-STPS-2018-oficial.txt`  
**SHA-256:** `8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76`  
**Ubicación en fuente:** calificaciones finales/categoría/dominio (alrededor de líneas 2274–2325).

## Transcripción de límites impresos (Tabla de resultados)

La norma imprime desigualdades del tipo:

| Nivel | Forma impresa (final) |
|---|---|
| Nulo o despreciable | `Cfinal < 20` |
| Bajo | `20 < Cfinal < 45` |
| Medio | `45 < Cfinal < 70` |
| Alto | `70 < Cfinal < 90` |
| Muy alto | `Cfinal > 90` |

Patrón análogo en categorías y dominios (p. ej. Ambiente: `<3`, `3<Ccat<5`, …, `Ccat>9`).

## Problema de igualdad

Los valores exactos de frontera (`20`, `45`, `70`, `90`, y equivalentes por categoría/dominio) **no quedan asignados de forma explícita** en la impresión tipográfica (ni al lado inferior ni al superior).

Esto no es un diagnóstico clínico: es un hueco tipográfico de la tabla.

## Política operativa determinística del sistema

Para todo score entero:

- **nulo:** `score < bajoMin`
- **bajo:** `bajoMin <= score < medioMin`
- **medio:** `medioMin <= score < altoMin`
- **alto:** `altoMin <= score < muyAltoMin`
- **muy_alto:** `score >= muyAltoMin`

Es decir: **límite inferior inclusivo**, **superior exclusivo**, **último nivel inclusivo hacia arriba**.

Valores canónicos finales: `bajoMin=20`, `medioMin=45`, `altoMin=70`, `muyAltoMin=90`.

## Ejemplos (resultado final)

| Score | Nivel operativo |
|---|---|
| 19 | nulo |
| 20 | bajo |
| 21 | bajo |
| 44 | bajo |
| 45 | medio |
| 46 | medio |
| 69 | medio |
| 70 | alto |
| 71 | alto |
| 89 | alto |
| 90 | muy_alto |
| 91 | muy_alto |

La misma regla se aplica a cada umbral de categoría y dominio del manifiesto.

## Aclaración

Esta normalización es **técnica y documentada** para obtener resultados reproducibles.  
**No sustituye** una valoración clínica profesional ni modifica los reactivos oficiales.
