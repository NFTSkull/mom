# B4.2.1 — Remediación definitiva de dependencias

**Fecha:** 2026-07-24  
**Veredicto:** **CERTIFICADO**

## 1. Estado inicial

| Campo | Valor |
|---|---|
| `pwd` / raíz Git | `/Users/grecovillanuevaortiz/Desktop/Mom` |
| Rama / commit | `main` / `b037cad` |
| Node / npm | v20.20.1 / 10.8.2 |
| Lockfile | v3; SHA-256 inicial `ad54c281…ebb4bbe` |
| Next / React | 16.2.11 / 19.2.4 |
| eslint-config-next | 16.2.11 |
| PostCSS | 8.5.23 (raíz) + **8.4.31** (`next/node_modules`) |
| sharp | **0.34.5**, opcional transitiva de Next |

`npm ci` limpio no cambió el lockfile y reprodujo 3 high en audit completo y
producción. Exit codes iniciales: `npm ci=0`, ambos audits JSON=`1`,
`npm outdated=1` (hay paquetes con versiones más nuevas), `npm ls/explain=0`.

## 2. Advisories iniciales exactos

| Paquete | GHSA / CVE | Severidad | Instalado afectado | Rango vulnerable | Primera corregida | Nodo / ruta | Producción |
|---|---|---:|---:|---|---:|---|---|
| PostCSS | `GHSA-qx2v-qp2m-jg93` / `CVE-2026-41305` | moderate | 8.4.31 | `<8.5.10` | 8.5.10 | `next → postcss`; `node_modules/next/node_modules/postcss` | Instalado en prod; build CSS, no browser bundle |
| PostCSS | `GHSA-6g55-p6wh-862q` / `CVE-2026-45623` | high | 8.4.31 | `<=8.5.11` | 8.5.12 | misma | misma |
| PostCSS | `GHSA-r28c-9q8g-f849` / **sin CVE asignado** | high | 8.4.31 | `<=8.5.17` | 8.5.18 | misma | misma |
| sharp | `GHSA-f88m-g3jw-g9cj` / `CVE-2026-33327`, `-33328`, `-35590`, `-35591` | high | 0.34.5 | `<0.35.0` | 0.35.0 | `next → sharp`; `node_modules/sharp` | Opcional, pero instalado en prod |

Fuentes contrastadas:

- JSON real de npm audit (`/tmp/mom-audit-{full,prod}.json`).
- GitHub Advisory Database / OSV para cada GHSA.
- Registro npm (`npm view`): PostCSS latest 8.5.23; sharp latest 0.35.3;
  Next latest estable 16.2.11.
- Árbol real (`npm ls`, `npm explain`) y `package-lock.json`.
- Next.js, “July 2026 Security Release”: 16.2.11 es el parche Active LTS
  oficial para los advisories propios de Next.

### Por qué npm mostraba `next` como high

El JSON de audit **no contenía un advisory propio de Next residual**. Para `next`,
`via` era únicamente `["postcss","sharp"]`. npm calculó una **metavulnerabilidad**
y mostró el rango agregado `9.3.4-canary.0 - 16.3.0-preview.7`; no era un rango
GHSA independiente de Next. El `fixAvailable` de los tres nodos era un objeto:

```json
{"name":"next","version":"9.3.3","isSemVerMajor":true}
```

Ese downgrade propuesto por npm no era aceptable. Next 16.2.11 sí era la versión
estable de seguridad oficial, pero declaraba `postcss: "8.4.31"` y
`optionalDependencies.sharp: "^0.34.5"`, manteniendo los transitivos afectados.

## 3. Superficie real

- **PostCSS:** está instalado en producción bajo Next y participa en compilación
  CSS. No se envía al bundle del navegador. La aplicación no acepta CSS de usuario;
  por tanto, los vectores de `sourceMappingURL` no eran alcanzables desde una ruta
  pública conocida, pero el paquete vulnerable seguía presente y debía corregirse.
- **sharp:** está instalado como dependencia opcional de Next. `src` no importa
  `next/image` ni procesa imágenes de usuario, así que el optimizador no era una
  superficie activa. Esto reduce exposición, pero no sustituye el parche.

## 4. Remediación

Se añadieron overrides exactos, estables y del mismo API principal:

```json
"overrides": {
  "postcss": "8.5.23",
  "sharp": "0.35.3"
}
```

Justificación:

- Una dependencia directa no corregía PostCSS porque Next fijaba exactamente
  8.4.31.
- Una dependencia directa de sharp 0.35.3 no satisfacía `^0.34.5`; habría dejado
  otra copia 0.34.5.
- Los overrides sustituyen ambos nodos vulnerables; no cambian Next ni usan
  prereleases.

Se ejecutó `npm install`, `npm dedupe` y luego una segunda instalación totalmente
limpia (`rm -rf node_modules .next`, `npm cache verify`, `npm ci`). Resultado:
exit 0, 404 paquetes, 0 vulnerabilidades y lockfile reproducible
(`c555c38c…f74915c`).

## 5. Árbol final

```text
next@16.2.11
├── postcss@8.5.23 deduped/overridden
└── sharp@0.35.3 overridden
@tailwindcss/postcss → postcss@8.5.23
vitest → vite → postcss@8.5.23
```

Una copia por paquete, integridades SHA-512 presentes, URLs del registro npm,
sin referencias Git/file/tarballs externos. Next/PostCSS/sharp no son prerelease.

`gensync@1.0.0-beta.2` permanece como transitiva **dev-only** de Babel; era previa,
npm `latest` apunta a esa misma versión y no existe release estable. No fue usada
para remediar ni entra al runtime de producción.

## 6. Validación de sharp

- `sharp@0.35.3`, libvips `8.18.3`, Node 20, macOS arm64.
- Carga nativa: exit 0.
- Prueba Vitest: SVG mínimo en memoria → resize 6×4 → PNG; dimensiones verificadas.
- No se usaron archivos personales ni red.
- No hay `next/image` en `src`; por ello no se inventó un smoke de optimización.

## 7. Audits finales

| Audit | critical | high | moderate | low | Exit |
|---|---:|---:|---:|---:|---:|
| Completo JSON/texto | 0 | 0 | 0 | 0 | 0 |
| Producción JSON/texto | 0 | 0 | 0 | 0 | 0 |

## 8. Regresión

| Validación | Resultado |
|---|---|
| lint | PASS, exit 0 |
| typecheck | PASS, exit 0 |
| Vitest | **13 archivos / 99 pruebas**, PASS |
| build | PASS, Next 16.2.11, sin secretos |
| pgTAP | **170 assertions**, PASS |
| Smoke HTTP | **11/11 rutas 200** |
| Fuente canónica | 220837 bytes; SHA-256 `8d5c2c63…7a76` |
| scoringVersion | `nom035-stps-2018-guia-i-ii-v1`, intacta |
| repository mode | `local`, intacto |
| tipos generados | SHA-256 `4060b8fa…d4d30`, sin cambio |

El primer intento de `npm run db:test` dio exit 127 porque los scripts asumían un
binario `supabase` local no declarado. Se corrigieron los seis scripts `db:*` para
usar `npx --yes supabase`; la repetición ejecutó PostgreSQL real y pasó 170/170.

## 9. Veredicto

**CERTIFICADO**

Se cumplen 0 high/critical en ambos audits; PostCSS y sharp están parcheados;
Next permanece en la versión estable oficial 16.2.11; instalación limpia,
regresión, pgTAP y smoke pasan.

Sin preview/canary/beta/RC para la remediación; sin `npm audit fix --force`;
sin Supabase remoto/link/db push; sin login/usuarios/Guía III/deploy/commit/push;
sin cambios al scoring, preguntas o manifiesto certificados.
