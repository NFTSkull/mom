# Modelo de amenazas — evaluación pública (B4.3)

| Amenaza | Mitigación | Riesgo residual |
|---------|------------|-----------------|
| Robo de token en URL / historial | Intercambio inmediato por cookie HttpOnly; token sale de la URL (`/evaluacion/contestar`) | Token usable hasta el primer intercambio o vencimiento |
| Token en Referer | `Referrer-Policy: no-referrer` en `/evaluacion/*` y API | Sitios maliciosos no reciben el token vía Referer |
| Fuerza bruta de token | Prefijo + 32 bytes aleatorios; rate limit HMAC; mensajes genéricos 404 | Extremadamente improbable |
| Reutilización tras completar | Estado `completed` irreversible; exchange rechaza completed | — |
| Doble envío / doble clic | Transacción `FOR UPDATE` + `UNIQUE(assignment_id)` + idempotencia por `submission_id` | — |
| Manipulación de scores | Cálculo solo servidor (`prepareCanonicalSubmission`); campos de autoridad ignorados y auditados en `validation_warnings` | — |
| CSRF | `SameSite=Strict` + validación de `Origin` en mutaciones | — |
| XSS | CSP (`frame-ancestors 'none'`, `default-src 'self'`); sin HTML libre del usuario en UI | CSP permite `'unsafe-inline'` por Next |
| Sesión robada | Cookie HttpOnly; una sesión activa; nueva sesión revoca la anterior | XSS + acceso físico al navegador |
| Caché de respuestas | `Cache-Control: no-store` | — |
| Logs con secretos | No se registran token, cookie ni body del examen | Operadores deben mantener la política |
| Acceso directo a Supabase | Tablas con RLS+FORCE; sin políticas anon; funciones EXECUTE solo `service_role` | Mal manejo de secret key en servidor |
| Pérdida de conexión | Draft central; envío final bloqueado si `navigator.onLine === false` | Draft puede quedar desfasado entre pestañas (mitigado con `expectedUpdatedAt`) |
| Concurrencia de submit | `FOR UPDATE` + unique result; prueba Vitest de doble submit | — |

## Controles positivos verificados

- Token almacenado solo como HMAC-SHA-256 + `token_last4`
- Sesión almacenada solo como HMAC-SHA-256
- Rate limit sin IP/token/UA en claro
- Trabajador nunca recibe scores
- `ACTIVE_REPOSITORY_MODE` general permanece `local`
