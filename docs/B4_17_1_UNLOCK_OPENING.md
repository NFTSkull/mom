# B4.17.1 — Desbloquear apertura (MFA + política de backups)

**Fecha UTC:** 2026-08-04  
**Veredicto:** **APERTURA BLOQUEADA**

## Resultado

No se ejecutó `B417_EXECUTE=1`. La campaña `Evaluación NOM-035 2026` permanece **draft**.

## Precondiciones medidas

| Flag | Valor | Acción |
|---|---|---|
| MFA factors verified | **0** | Detener — no abrir |
| TOTP activo | **0** | — |
| ADMIN_AAL2 | **false** | Pedir re-login con MFA (cuando exista factor) |
| mfa_required admin | **false** | No se cambió (falta factor+AAL2) |
| BACKUP_POLICY_ACCEPTED | **false** (archivo ausente) | No inventar aceptación |
| PITR_ENABLED | **false** | — |

Regla respetada: **no crear** `backup-policy-accepted.txt` sin autorización expresa del usuario.

## Estado de datos (intactos)

- workers / Auth / WA / assignments pending: 83  
- Guía I / II / III: 83 / 0 / 83  
- sesiones / respuestas / resultados: 0 / 0 / 0  
- campaña: **draft**; `activated_at` null  
- passwords modificadas: 0  
- ConCasa intacto  

## Acciones humanas para desbloquear

### A) MFA admin

1. Entrar al panel admin en Production.  
2. Enroll TOTP y verificar factor (`auth.mfa_factors.status=verified` ≥ 1).  
3. Cerrar sesión y volver a entrar con MFA → AAL2.  
4. Avisar al agente; entonces se podrá poner `mfa_required=true` **solo** en el admin.

### B) Política de backup

Crear (tú, no el agente) el archivo:

`~/Desktop/nom035-production-secrets/backup-policy-accepted.txt`

con aceptación explícita de: backup lógico cifrado diario, copia externa, retención 30 días, SHA-256, restauración semanal (p. ej. primera línea `RIESGO TEMPORAL ACEPTADO` o `ACCEPTED` + el texto de alcance).

### C) Reintento

Con MFA+AAL2+backup (o PITR):

```bash
B417_EXECUTE=1 npx tsx scripts/b417-open-real-campaign.ts
```

## Confirmaciones

- Campaña no abierta  
- Credenciales no entregadas  
- Workers/passwords no modificados  
- ConCasa no tocado  
