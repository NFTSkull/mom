# Certificación de seguridad de dependencias — B4.2

**Fecha:** 2026-07-24  
**Node:** v20.20.1 · **npm:** 10.8.2  
**Comandos:** `npm ci`, `npm audit --json`, `npm audit --omit=dev --json`, `npm outdated`, `npm audit fix` (sin `--force`).

> No se copian secretos ni blobs JSON completos. Solo resultados procesados.

## 1. Línea base (antes de corregir)

`npm audit` completo:

| Severidad | Cantidad |
|---|---|
| critical | 0 |
| high | 6 |
| moderate | 0 |
| low | 1 |
| **total** | **7** |

`npm audit --omit=dev` (producción): **3 high** (`next`, `postcss`, `sharp`).

## 2. Detalle y decisiones

| Paquete | Versión instalada | Directa/Transitiva | Prod/Dev | Aviso | Severidad | Fix disponible | Breaking | Decisión |
|---|---|---|---|---|---|---|---|---|
| `next` | 16.2.4 → **16.2.11** | Directa | Prod | DoS RSC, bypass middleware/proxy, cache poisoning, XSS CSP, SSRF, Image DoS | high | Solo `preview/canary` (rango vulnerable llega a `16.3.0-preview.7`) | — | **Actualizado a la última estable (`16.2.11`, dist-tag `latest`)**. Sigue marcado high: no hay build estable fuera del rango. |
| `postcss` | (bajo `next`) | Transitiva | Prod | XSS `</style>`, path traversal sourceMappingURL | high | Solo vía `next` estable inexistente | — | Depende de `next`; sin fix estable. |
| `sharp` | (bajo `next`) | Transitiva | Prod | libvips CVE-2026-33327/33328/35590/35591 | high | Solo vía `next` estable inexistente | — | Depende de `next`; sin fix estable. |
| `brace-expansion` | transitiva toolchain | Transitiva | Dev | DoS expansión exponencial | high | Parche | No | **Corregido** con `npm audit fix`. |
| `js-yaml` | 4.0.0–4.2.0 | Transitiva | Dev | DoS cuadrático merge keys | high | Parche | No | **Corregido** con `npm audit fix`. |
| `vite` | 8.0.x | Transitiva (vitest) | Dev | `server.fs.deny` bypass / NTLM (Windows) | high | Parche | No | **Corregido** con `npm audit fix`. |
| `@babel/core` | <=7.29.0 | Transitiva | Dev | Arbitrary file read sourceMappingURL | low | Parche | No | **Corregido** con `npm audit fix`. |

## 3. Estado después de corregir

`npm audit` completo:

| Severidad | Cantidad |
|---|---|
| critical | 0 |
| high | **3** (`next`, `postcss`, `sharp`) |
| moderate | 0 |
| low | 0 |
| **total** | **3** |

`npm audit --omit=dev` (producción): **3 high** (`next`, `postcss`, `sharp`).

Cambios en `package.json`: `next` `16.2.4 → 16.2.11`, `eslint-config-next` `16.2.4 → 16.2.11`. `package-lock.json` regenerado por `npm audit fix` (parches transitivos de dev).

## 4. Bloqueo de certificación (honesto)

- El criterio obligatorio del bloque exige `0 critical / 0 high` en `npm audit --omit=dev`.
- La versión **estable** (`latest`) de Next.js es `16.2.11`, pero el rango vulnerable del advisory abarca `9.3.4-canary.0 — 16.3.0-preview.7`, es decir, **incluye toda versión estable disponible**.
- Las únicas versiones fuera del rango son `16.3.0-preview.8/9` y `16.3.0-canary.*`, **prohibidas** por las reglas del bloque (nada de beta/canary/RC/experimental).
- npm solo ofrece "fix" vía `--force` proponiendo `next@9.3.3` (downgrade mayor a una versión de 2020), también prohibido y peor en seguridad.

**Conclusión de dependencias:** quedan **3 high en producción** (`next` + transitivos `postcss`/`sharp`) **sin solución estable disponible al momento de ejecución**. No se ocultan bajo “solo desarrollo”: son de producción. Por la regla explícita del bloque, esto **impide el veredicto CERTIFICADO** de B4.2.

## 5. Recomendación

- Vigilar el canal estable de Next.js y actualizar a la primera versión `>= 16.3.0` estable que salga del rango del advisory; reejecutar toda la regresión.
- Mientras el MVP siga en localhost con `localStorage` (sin exposición pública), el riesgo operativo real es limitado, pero **antes de cualquier deploy** este bump es P1 bloqueante.

---

## 6. Reevaluación B4.2.1 — 2026-07-24

**Resultado:** **CERTIFICADO**

La conclusión inicial “sin solución estable” era incompleta: npm marcaba `next`
como **metavulnerabilidad** por sus dependencias, no por un advisory residual propio.
Se identificaron los GHSA exactos y se corrigieron con versiones estables:

- PostCSS: `GHSA-qx2v-qp2m-jg93` (CVE-2026-41305, fix 8.5.10),
  `GHSA-6g55-p6wh-862q` (CVE-2026-45623, fix 8.5.12) y
  `GHSA-r28c-9q8g-f849` (sin CVE asignado, fix 8.5.18).
- sharp: `GHSA-f88m-g3jw-g9cj` (CVE-2026-33327, -33328, -35590,
  -35591; fix 0.35.0).

Overrides aplicados: PostCSS **8.5.23** y sharp **0.35.3**. Árbol final único,
instalación limpia reproducible y audits completo/producción: **0 vulnerabilidades**.

Evidencia completa: `docs/B4_2_1_DEPENDENCY_REMEDIATION.md`.
