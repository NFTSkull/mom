# B4.14 — GO-LIVE FINAL

**Fecha UTC:** 2026-08-03  
**Veredicto:** **PRODUCCIÓN BLOQUEADA**

## Bloqueos duros (no se crearon cuentas)

### 1. MFA administrador

| Requisito | Estado |
|---|---|
| Admin activo | sí (1) |
| Rol admin | sí |
| Factors MFA verified ≥ 1 | **0** |
| `mfa_required=true` | **false** |
| Sesión AAL2 | no verificable sin MFA |

→ Regla B4.14: MFA=0 ⇒ **no crear cuentas / no abrir campaña**.

### 2. Política de backups

| Tipo | Estado |
|---|---|
| PITR | deshabilitado |
| Backups administrados Supabase | no disponibles |
| Backup lógico verificado | disponible (off-repo) |
| Aceptación explícita «RIESGO TEMPORAL ACEPTADO» | **ausente** |

→ Sin opción A ni aceptación B ⇒ **PRODUCCIÓN BLOQUEADA**.

## Estado preparado (sin escritura de cuentas)

- Workers reales: 83 (vinculados por número de empleado; nombres ya en DB)
- Username planificado: `empleado.<numero_normalizado>` (no nombres)
- Dry-run: PASS (I=83, III=83, II=0, colisiones=0)
- Assignments activos: 0
- Legacy revocado: 2 drafts preservados
- Empresa: `NOM035_EMPRESA_OPERATIVA` / total=83
- Runtime login: solo Usuario + Contraseña + «Iniciar sesión» (commit pendiente de CI/deploy)

## Para desbloquear

1. Admin completa MFA (factor verified ≥ 1) y `mfa_required=true`.
2. Activar PITR/backups administrados **o** firmar aceptación B (cifrado diario, copia externa, 30 días, hash, restore semanal).
3. Proveer `GH_TOKEN` temporal para push + CI del SHA final.
4. Reanudar B4.14 desde deploy → campaña draft → lotes 83 → abrir.

## Confirmaciones de seguridad

- Cuentas Auth creadas en esta fase: **0**
- Passwords generadas: **0**
- Campaña abierta: **no**
- CSV en Git: **no**
- ConCasa: intacto (`linked=false`)
