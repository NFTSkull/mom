# B4.27 — Gráficas Excel visibles (presentation-ready)

## Causa raíz B4.26

| Hallazgo | Detalle |
|----------|---------|
| CURRENT_MEDIA_COUNT | ≥1 (PNG embebidos) |
| Problema | Gráficas ancladas **después** de tablas/indicadores |
| Resumen | `row: tipRow+2` (~fila 30+) |
| Categorías/Dominios | `row: 5 + dataRows` (después de tabla) |
| Labels | Truncados `slice(0,12)` / `…` |
| Tipografía | `bold`/`pt` → `fillText` fallaba en pureimage |

## Corrección

- Primera hoja + `activeTab=0`: Resumen Ejecutivo
- Chart-first en hojas conceptuales
- `embedVisibleChart` tl/br + alturas de fila
- PNG 1400×700, wrap multilínea, fuente embebida
- Auditoría: `xlsx-visual-audit.ts`

## Anclas nuevas (0-based drawing)

- Resumen: fromRow=8 → brRow=26
- Categorías: fromRow=3 → 24
- Dominios: 3→24 y 26→47
- Distribución: 3→22
- ATS: 6→22
