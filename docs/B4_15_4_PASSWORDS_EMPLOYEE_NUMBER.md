# B4.15.4B — Passwords = NOM + número de empleado

**Fecha UTC:** 2026-08-04  
**Veredicto:** **PASSWORDS ACTUALIZADAS A NOM + NÚMERO**

## Regla

```
PASSWORD = "NOM" + numero_empleado_canonico
```

Ejemplos (ficticios): `0003` → `NOM0003`; `0127` → `NOM0127`.  
Sin `!`, espacios, guiones u otros símbolos. Número como string; ceros iniciales preservados (pad 4 alineado al username).

## Resultado

| Métrica | Valor |
|---|---:|
| Passwords actualizadas | **83** |
| Formato sin `!` | sí |
| Longitud | 7 (todas) |
| Política Auth | PASSWORD_POLICY_OK |
| Usernames / auth_user_id modificados | 0 / 0 |
| worker_accounts modificados | 0 |
| must_change_password=false | 83 |
| Campaña | draft |
| Sesiones / respuestas / resultados | 0 / 0 / 0 |
| PLAINTEXT_CREDENTIAL_FILES | 0 |

## Paquete cifrado (no entregar aún)

`~/Desktop/nom035-production-secrets/worker-credentials-b4154b/`  
(`.enc` + `.key` + `COMO-DESCIFRAR.txt`; permisos 700/600)

## Smoke (3 cuentas)

Login + 2.º login OK; sin cambio obligatorio; `evaluationStatus=awaiting_campaign` (UI «Evaluación asignada», sin Comenzar); campaña draft.

## Confirmaciones

- Passwords no impresas / no en Git  
- ConCasa intacto  
- Campaña no abierta  
- Credenciales **no entregadas** en este bloque
