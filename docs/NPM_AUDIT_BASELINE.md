# Baseline npm audit — Portal NOM-035

**Fecha:** 2026-07-24  
**Comando:** `npm audit --json`  
**Política de este bloque:** solo línea base; **no** se ejecutó `npm audit fix` ni `npm audit fix --force`.

## Resumen

| Severidad | Cantidad |
|---|---|
| critical | 0 |
| high | 6 |
| moderate | 0 |
| low | 1 |
| **total** | **7** |

Nota: npm agrega varios advisories bajo el mismo paquete `next` / `postcss` / etc.; el conteo de metadatos es 7 entradas de vulnerabilidades.

## Detalle por paquete

| Paquete | Severidad npm | Directa / transitiva | Ruta de dependencia | Versión instalada (aprox.) | Corrección disponible | Breaking change | Recomendación |
|---|---|---|---|---|---|---|---|
| `next` | high | **Directa** | `mom-nom035-local → next` | `16.2.4` | `16.2.11` (semver minor/patch) | No (mismo major 16) | Actualizar a `16.2.11` en bloque dedicado de hardening de deps. Cubrir con lint/typecheck/test/build. |
| `postcss` | high | Transitiva | `next → postcss` (y copia en next/node_modules) | embebida en next 16.2.4 | Via actualizar `next` a `16.2.11` | No | Resolver junto con bump de Next. |
| `sharp` | high | Transitiva | `next → sharp` | `<0.35.0` vía next | Via actualizar `next` | Posible cambio de binarios nativos | Resolver con bump de Next; verificar build en CI/macOS/Linux. |
| `brace-expansion` | high | Transitiva | `eslint` / `@typescript-eslint` → `minimatch` → `brace-expansion` | varias copias | fixAvailable true (parches 1.1.16 / 5.0.7) | No esperado | Actualizar toolchain ESLint en bloque deps; o overrides npm si se aprueba. |
| `js-yaml` | high | Transitiva | toolchain lint/test | `4.x` vulnerable | `>=4.3.0` / parches listados | Bajo | Actualizar en bloque deps. |
| `vite` | high | Transitiva | `vitest → vite` | `8.0.x` vulnerable | fixAvailable true | Posible minor Vite | Actualizar vitest/vite en bloque deps; re-ejecutar tests. |
| `@babel/core` | low | Transitiva | toolchain | `<=7.29.0` | fixAvailable true | Bajo | Actualizar en bloque deps. |

## Advisory destacados en `next@16.2.4`

Incluyen (lista no exhaustiva del JSON de audit): DoS Server Components, middleware/proxy bypass, cache poisoning, XSS CSP nonce / beforeInteractive, Image Optimization DoS, SSRF en websockets/rewrites/server actions. Fix consolidado reportado: **`16.2.11`**.

## Decisiones de este bloque

- **No** se aplicaron fixes automáticos.
- **No** se usó `--force`.
- La remediación de vulnerabilidades queda para un bloque posterior (p. ej. B4.x Hardening deps), con pruebas completas.

## Riesgo operativo

Mientras el MVP siga solo en localhost con localStorage, la exposición de red es limitada. Antes de cualquier despliegue público, el bump de `next` a `16.2.11+` debe tratarse como **P1 bloqueante de entrega formal**.
